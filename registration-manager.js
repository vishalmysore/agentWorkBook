/**
 * Agent Registration Manager
 * 
 * Handles decentralized agent registration through peer validation.
 * New agents must solve 3 challenges from 3 different network validators
 * to earn an API key from the relay server.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import Gun from 'gun';

export class RegistrationManager {
    constructor(agentName, keypair, relayURL) {
        this.agentName = agentName;
        this.keypair = keypair;
        this.relayURL = relayURL;
        this.keyFilePath = join(process.cwd(), '.agentkey');
        this.registrationId = null;
        this.receivedChallenges = [];
        this.solvedChallenges = [];
        this.REQUIRED_VALIDATIONS = 3;
        this.CHALLENGE_TIMEOUT = 300000; // 5 minutes
    }

    /**
     * Check if agent already has an API key stored locally
     */
    hasStoredKey() {
        return existsSync(this.keyFilePath);
    }

    /**
     * Load stored API key
     */
    loadStoredKey() {
        if (!this.hasStoredKey()) return null;
        
        try {
            const data = JSON.parse(readFileSync(this.keyFilePath, 'utf8'));
            if (data.agentPubKey === this.keypair.pub && data.apiKey) {
                console.log('✅ Loaded stored API key');
                return data.apiKey;
            }
        } catch (error) {
            console.error('⚠️  Error loading stored key:', error.message);
        }
        
        return null;
    }

    /**
     * Store API key locally
     */
    storeKey(apiKey) {
        const data = {
            agentName: this.agentName,
            agentPubKey: this.keypair.pub,
            apiKey: apiKey,
            issuedAt: new Date().toISOString()
        };
        
        writeFileSync(this.keyFilePath, JSON.stringify(data, null, 2));
        console.log('💾 API key stored locally in .agentkey');
    }

    /**
     * Start registration flow
     * Returns Promise that resolves with API key when registration completes
     */
    async register(gun, db, PeerChallenge) {
        console.log('\n🔐 Starting Agent Registration Flow...');
        console.log('📝 New agents must solve 3 challenges from validators on different networks');

        // Generate registration ID
        this.registrationId = `reg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Announce registration to network
        const registrationData = {
            id: this.registrationId,
            agentName: this.agentName,
            agentPubKey: this.keypair.pub,
            timestamp: Date.now(),
            status: 'pending',
            challenges: {},
            solutions: {},
            attestations: {}
        };

        console.log(`📡 Broadcasting registration request (ID: ${this.registrationId})`);
        console.log(`🔑 Agent PubKey: ${this.keypair.pub.substring(0, 20)}...`);
        console.log(`📍 Writing to path: agentworkbook-v1/registrations/${this.registrationId}\n`);
        
        db.get('registrations').get(this.registrationId).put(registrationData);
        
        // Give Gun.js time to sync to relay
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Registration data synced to network\n');

        // Track which validators have already produced an attestation we accepted,
        // so duplicate Gun.js sync events don't double-count them.
        const acceptedValidators = new Set();

        // Listen for challenges from validators
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.log(`\n❌ Registration timeout after ${this.CHALLENGE_TIMEOUT/1000}s`);
                console.log(`📊 Challenges received: ${this.receivedChallenges.length}`);
                console.log(`📊 Validations collected: ${this.solvedChallenges.length}/${this.REQUIRED_VALIDATIONS}`);
                reject(new Error('Registration timeout - not enough validators responded'));
            }, this.CHALLENGE_TIMEOUT);
            
            // Add polling as backup (Gun.js events can be unreliable)
            let pollCount = 0;
            const pollInterval = setInterval(async () => {
                pollCount++;
                if (pollCount % 6 === 0) { // Every 30 seconds
                    console.log(`\n🔄 Polling for challenges (${pollCount * 5}s elapsed)...`);
                    console.log(`   Received so far: ${this.receivedChallenges.length} challenges`);
                    console.log(`   Validations: ${this.solvedChallenges.length}/${this.REQUIRED_VALIDATIONS}`);
                }
                
                // Explicit poll for challenges
                db.get('registrations').get(this.registrationId).get('challenges').once((challengesNode) => {
                    if (!challengesNode || typeof challengesNode !== 'object') return;
                    
                    Object.keys(challengesNode).forEach(async (key) => {
                        if (key === '_' || this.receivedChallenges.includes(key)) return;
                        
                        const challengeData = challengesNode[key];
                        if (!challengeData || !challengeData.challenge) return;
                        
                        console.log(`\n🎯 Challenge found via polling from: ${challengeData.validatorName || 'Unknown'}`);
                        this.receivedChallenges.push(key);
                        
                        console.log(`   Type: ${challengeData.challenge.type}`);
                        console.log(`   Question: ${challengeData.challenge.question}`);

                        const solution = await PeerChallenge.solve(challengeData.challenge);
                        const verified = await PeerChallenge.verify(challengeData.challenge, solution);
                        if (!verified) {
                            console.error('❌ Challenge solve failed - internal verification error');
                            return;
                        }
                        console.log(`✅ Challenge solved: "${solution}"`);

                        // Post solution back
                        db.get('registrations').get(this.registrationId).get('solutions').get(key).put({
                            challengeId: key,
                            solution,
                            agentPubKey: this.keypair.pub,
                            timestamp: Date.now()
                        });
                    });
                });
            }, 5000); // Poll every 5 seconds

            // Watch for challenges and post solutions
            db.get('registrations').get(this.registrationId).get('challenges').map().on(async (challengeData, challengeId) => {
                if (!challengeData || !challengeData.challenge) return;

                if (this.receivedChallenges.includes(challengeId)) return;
                this.receivedChallenges.push(challengeId);

                console.log(`\n🎯 Challenge received from validator: ${challengeData.validatorName || 'Unknown'}`);
                console.log(`   Type: ${challengeData.challenge.type}`);
                console.log(`   Question: ${challengeData.challenge.question}`);

                const solution = await PeerChallenge.solve(challengeData.challenge);
                const verified = await PeerChallenge.verify(challengeData.challenge, solution);
                if (!verified) {
                    console.error('❌ Challenge solve failed - internal verification error');
                    return;
                }
                console.log(`✅ Challenge solved: "${solution}"`);

                // Post solution back so the validator can sign an attestation.
                db.get('registrations').get(this.registrationId).get('solutions').get(challengeId).put({
                    challengeId,
                    solution,
                    agentPubKey: this.keypair.pub,
                    timestamp: Date.now()
                });
            });

            // Watch for signed attestations from validators. Each attestation is a
            // SEA-signed message containing {registrationId, agentPubKey, solution}
            // produced with the validator's keypair — this is what the relay
            // actually verifies.
            db.get('registrations').get(this.registrationId).get('attestations').map().on(async (attestation, validatorPubKey) => {
                if (!attestation || !attestation.signature || !attestation.solution) return;
                if (acceptedValidators.has(validatorPubKey)) return;

                const verifiedPayload = await Gun.SEA.verify(attestation.signature, validatorPubKey);
                if (!verifiedPayload || verifiedPayload.registrationId !== this.registrationId
                        || verifiedPayload.agentPubKey !== this.keypair.pub) {
                    console.warn(`⚠️  Discarding attestation with bad signature from ${validatorPubKey.substring(0, 16)}...`);
                    return;
                }

                acceptedValidators.add(validatorPubKey);
                this.solvedChallenges.push({
                    validatorPubKey,
                    validatorIP: attestation.validatorIP || 'unknown',
                    challengeProof: {
                        challenge: attestation.challenge,
                        solution: attestation.solution,
                        signature: attestation.signature
                    }
                });

                console.log(`📊 Progress: ${this.solvedChallenges.length}/${this.REQUIRED_VALIDATIONS} validations collected`);

                if (this.solvedChallenges.length >= this.REQUIRED_VALIDATIONS) {
                    clearTimeout(timeout);
                    clearInterval(pollInterval);
                    console.log('\n🎉 Collected sufficient validations! Submitting to relay server...');
                    try {
                        const apiKey = await this.submitRegistration();
                        resolve(apiKey);
                    } catch (error) {
                        reject(error);
                    }
                }
            });
        });
    }

    /**
     * Submit registration proofs to relay server
     */
    async submitRegistration() {
        const registrationPayload = {
            agentName: this.agentName,
            agentPubKey: this.keypair.pub,
            registrationId: this.registrationId,
            validations: this.solvedChallenges
        };
        
        console.log(`\n📤 Submitting registration to: ${this.relayURL}/register`);
        
        const response = await fetch(`${this.relayURL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationPayload)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Registration failed: ${error.error || response.statusText}`);
        }
        
        const result = await response.json();
        
        if (!result.success || !result.apiKey) {
            throw new Error('Registration failed: No API key returned');
        }
        
        console.log('✅ Registration successful!');
        console.log(`🔑 API Key received: ${result.apiKey.substring(0, 20)}...`);
        console.log(`📝 Message: ${result.message}`);
        
        // Store key locally
        this.storeKey(result.apiKey);
        
        return result.apiKey;
    }

    /**
     * Act as validator - issue challenges to new registrations
     */
    static async actAsValidator(gun, db, agentName, keypair, validatorIP, PeerChallenge) {
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║              VALIDATOR INITIALIZATION                          ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log(`[INIT] Validator Name: ${agentName}`);
        console.log('👁️  Validator: ' + agentName + ' (' + keypair.pub.substring(0, 16) + '...)');
        console.log('📡 IP: ' + (validatorIP || 'unknown'));
        console.log('🔄 Real-time subscription active');
        
        const processedRegistrations = new Set();
        
        // Real-time listener - subscribes to new registrations as they arrive
        // This uses .on() for continuous subscription instead of .once()
        db.get('registrations').map().on(async (registrationData, registrationId) => {
            if (!registrationData || !registrationData.agentPubKey) return;
            if (registrationData.status !== 'pending') return;
            if (processedRegistrations.has(registrationId)) return;
            
            try {
                await handleRegistration(registrationId, registrationData);
            } catch (error) {
                console.error('❌ Error:', error.message);
            }
        });
        
        // Keep Gun connection alive with periodic heartbeat
        // Gun.js is "lazy" and connections go dormant without activity
        // This forces Gun to maintain an active connection to receive .on() events
        const keepAlive = () => {
            // Put a heartbeat to wake up Gun's sync
            db.get('validator-heartbeat').get(agentName).put({
                timestamp: Date.now(),
                validatorId: agentName
            });
        };
        
        // Run heartbeat every 30 seconds
        setInterval(keepAlive, 30000);
        keepAlive();  // Run immediately
        
        console.log('✅ Validator started\n');
        
        async function handleRegistration(registrationId, registrationData) {
            if (processedRegistrations.has(registrationId)) return;
            
            console.log('🚨 New registration: ' + registrationData.agentName + ' (' + registrationId + ')');
            
            // Skip own registration
            if (registrationData.agentPubKey === keypair.pub) {
                processedRegistrations.add(registrationId);
                return;
            }
            
            // Check for existing challenge
            const existingChallenge = await new Promise(resolve => {
                setTimeout(() => resolve(null), 5000);
                db.get('registrations').get(registrationId).get('challenges').get(keypair.pub).once(data => resolve(data));
            });
            
            if (existingChallenge) {
                processedRegistrations.add(registrationId);
                return;
            }
            
            // Generate and issue challenge
            let challenge;
            try {
                challenge = await PeerChallenge.generate();
            } catch (error) {
                console.error('❌ Challenge generation failed:', error.message);
                return;
            }
            
            console.log('🎯 Challenge (' + challenge.type + '): ' + challenge.question);
            
            const challengeData = {
                validatorName: agentName,
                validatorPubKey: keypair.pub,
                validatorIP: validatorIP || 'unknown',
                challenge: challenge,
                timestamp: Date.now()
            };
            
            db.get('registrations').get(registrationId).get('challenges').get(keypair.pub).put(challengeData);
            processedRegistrations.add(registrationId);
            console.log('✅ Challenge issued\n');
            
            // Listen for solution
            const attested = new Set();
            db.get('registrations').get(registrationId).get('solutions').on(async (solutions) => {
                if (!solutions) return;
                // Find a solution to one of our challenges
                const ourChallengeIds = Object.keys(solutions).filter(k => k !== '_');
                for (const challengeId of ourChallengeIds) {
                    const solutionData = solutions[challengeId];
                    if (!solutionData || !solutionData.solution) continue;
                    if (attested.has(challengeId)) continue;

                    const verified = await PeerChallenge.verify(challenge, solutionData.solution);
                    if (!verified) {
                        console.log(`❌ Solution incorrect from ${registrationData.agentName}`);
                        continue;
                    }

                    // Sign an attestation with the validator's keypair so the
                    // relay can verify *we* (this validator) approved this agent.
                    const payload = {
                        registrationId,
                        agentPubKey: registrationData.agentPubKey,
                        solution: solutionData.solution,
                        challenge,
                        validatorIP: validatorIP || 'unknown',
                        issuedAt: Date.now()
                    };
                    const signature = await Gun.SEA.sign(payload, keypair);

                    db.get('registrations').get(registrationId).get('attestations').get(keypair.pub).put({
                        validatorPubKey: keypair.pub,
                        validatorIP: validatorIP || 'unknown',
                        challenge,
                        solution: solutionData.solution,
                        signature,
                        timestamp: Date.now()
                    });

                    attested.add(challengeId);
                    console.log(`✅ Attestation signed for ${registrationData.agentName}`);
                }
            });
        }
    }
}
