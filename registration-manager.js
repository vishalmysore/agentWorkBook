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
                reject(new Error('Registration timeout - not enough validators responded'));
            }, this.CHALLENGE_TIMEOUT);

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
        console.log(`[INIT] Validator PubKey: ${keypair.pub}`);
        console.log(`[INIT] Validator PubKey (short): ${keypair.pub.substring(0, 20)}...`);
        console.log(`[INIT] Validator IP: ${validatorIP || 'unknown'}`);
        console.log(`[INIT] Gun instance:`, gun ? 'AVAILABLE' : 'NULL');
        console.log(`[INIT] DB instance:`, db ? 'AVAILABLE' : 'NULL');
        console.log(`[INIT] PeerChallenge class:`, PeerChallenge ? 'AVAILABLE' : 'NULL');
        console.log(`[INIT] Listening path: db.get('registrations').map()`);
        console.log(`[INIT] Polling interval: 10000ms (10 seconds)`);
        console.log(`[INIT] Starting validation service...\n`);
        
        console.log('👁️  Watching for new agent registrations to validate...');
        console.log(`🔍 Validator: ${agentName} (${keypair.pub.substring(0, 16)}...)`);
        console.log(`📡 Listening on: registrations/*`);
        console.log(`🔄 Active polling enabled (every 10 seconds)\n`);
        
        const processedRegistrations = new Set();
        
        // Active polling (Gun.js .map().on() doesn't reliably work over relays)
        const pollRegistrations = async () => {
            console.log(`\n[POLL] ===================== POLLING CYCLE START =====================`);
            console.log(`[POLL] Timestamp: ${new Date().toISOString()}`);
            console.log(`[POLL] Current processedRegistrations.size: ${processedRegistrations.size}`);
            console.log(`[POLL] Querying: db.get('registrations').once()...`);
            
            const pollTimeout = setTimeout(() => {
                console.error(`[POLL] ⚠️  Gun.js poll query timeout after 10 seconds!`);
            }, 10000);
            
            db.get('registrations').once(async (registrations) => {
                clearTimeout(pollTimeout);
                console.log(`[POLL] ✓ Gun.js query returned`);
                
                if (!registrations) {
                    console.log(`[POLL] ❌ No registrations node found (null/undefined)`);
                    return;
                }
                
                console.log(`[POLL] Parsing registration IDs from response...`);
                const allKeys = Object.keys(registrations);
                console.log(`[POLL] Total keys in object: ${allKeys.length}`);
                console.log(`[POLL] All keys:`, allKeys);
                
                const regIds = allKeys.filter(k => k !== '_');
                console.log(`[POLL] ✓ Found ${regIds.length} registration(s) (excluding Gun metadata)`);
                console.log(`[POLL] Registration IDs: ${regIds.join(', ')}`);
                
                let processedCount = 0;
                let skippedCount = 0;
                let invalidCount = 0;
                
                for (const registrationId of regIds) {
                    console.log(`\n[POLL] --- Examining ${registrationId} ---`);
                    const registrationData = registrations[registrationId];
                    
                    if (!registrationData || typeof registrationData !== 'object') {
                        console.log(`[POLL] ⏭️  Invalid data type:`, typeof registrationData);
                        invalidCount++;
                        continue;
                    }
                    
                    console.log(`[POLL] Data keys:`, Object.keys(registrationData));
                    console.log(`[POLL] status: ${registrationData.status}`);
                    console.log(`[POLL] agentName: ${registrationData.agentName}`);
                    console.log(`[POLL] agentPubKey: ${registrationData.agentPubKey ? registrationData.agentPubKey.substring(0, 20) + '...' : 'MISSING'}`);
                    console.log(`[POLL] timestamp: ${registrationData.timestamp ? new Date(registrationData.timestamp).toISOString() : 'MISSING'}`);
                    
                    if (processedRegistrations.has(registrationId)) {
                        console.log(`[POLL] ⏭️  Already in processedRegistrations Set`);
                        skippedCount++;
                        continue;
                    }
                    
                    console.log(`[POLL] 📋 NEW - will process this registration`);
                    
                    if (registrationData.status === 'pending' && registrationData.agentPubKey) {
                        console.log(`[POLL] ✓ Status is 'pending' and has agentPubKey`);
                        console.log(`[POLL] 🔄 Calling handleRegistration()...`);
                        try {
                            await handleRegistration(registrationId, registrationData);
                            processedCount++;
                            console.log(`[POLL] ✓ handleRegistration() completed for ${registrationId}`);
                        } catch (error) {
                            console.error(`[POLL] ❌ ERROR in handleRegistration():`, error);
                            console.error(`[POLL] Error stack:`, error.stack);
                        }
                    } else {
                        console.log(`[POLL] ⏭️  Skipping: status='${registrationData.status}', hasPubKey=${!!registrationData.agentPubKey}`);
                        // Don't add to processedRegistrations - allow retry if status changes
                    }
                }
                
                console.log(`\n[POLL] ===================== POLLING CYCLE END =====================`);
                console.log(`[POLL] Summary: processed=${processedCount}, skipped=${skippedCount}, invalid=${invalidCount}`);
                console.log(`[POLL] processedRegistrations.size now: ${processedRegistrations.size}`);
            });
        };
        
        // Poll every 10 seconds
        console.log(`[INIT] Setting up polling interval (every 10 seconds)...`);
        setInterval(pollRegistrations, 10000);
        console.log(`[INIT] Starting initial poll immediately...`);
        pollRegistrations(); // Initial poll
        
        // Also keep .map().on() as backup
        console.log(`[INIT] Setting up .map().on() event listener as backup...`);
        db.get('registrations').map().on(async (registrationData, registrationId) => {
            console.log(`\n[EVENT] ==================== EVENT TRIGGERED ====================`);
            console.log(`[EVENT] Registration ID: ${registrationId}`);
            console.log(`[EVENT] Timestamp: ${new Date().toISOString()}`);
            console.log(`[EVENT] Data received:`, registrationData ? JSON.stringify(registrationData, null, 2) : 'NULL');
            console.log(`[EVENT] status: ${registrationData?.status}`);
            console.log(`[EVENT] hasPubKey: ${!!registrationData?.agentPubKey}`);
            console.log(`[EVENT] agentName: ${registrationData?.agentName}`);
            
            if (!registrationData) {
                console.log(`[EVENT] ⏭️  Skipping: registrationData is null/undefined`);
                return;
            }
            
            if (!registrationData.agentPubKey) {
                console.log(`[EVENT] ⏭️  Skipping: agentPubKey is missing`);
                console.log(`[EVENT]    Available keys:`, Object.keys(registrationData));
                return;
            }
            
            if (registrationData.status !== 'pending') {
                console.log(`[EVENT] ⏭️  Skipping: status is '${registrationData.status}' (not 'pending')`);
                return;
            }
            
            console.log(`[EVENT] ✓ Data validation passed`);
            
            if (processedRegistrations.has(registrationId)) {
                console.log(`[EVENT] ⏭️  Already in processedRegistrations Set (size: ${processedRegistrations.size})`);
                return;
            }
            
            console.log(`[EVENT] ✓ Not yet processed`);
            console.log(`[EVENT] 🔄 Calling handleRegistration()...`);
            
            try {
                await handleRegistration(registrationId, registrationData);
                console.log(`[EVENT] ✓ handleRegistration() completed successfully`);
            } catch (error) {
                console.error(`[EVENT] ❌ ERROR in handleRegistration():`, error);
                console.error(`[EVENT] Error stack:`, error.stack);
            }
            
            console.log(`[EVENT] ==================== EVENT FINISHED ====================\n`);
        });
        
        console.log(`[INIT] ✓ Event listener registered`);
        console.log(`[INIT] Validator is now watching for registrations...`);
        
        async function handleRegistration(registrationId, registrationData) {
            console.log(`\n[HANDLE] ==================== STARTING handleRegistration ====================`);
            console.log(`[HANDLE] Registration ID: ${registrationId}`);
            console.log(`[HANDLE] Registration Data:`, JSON.stringify(registrationData, null, 2));
            
            if (processedRegistrations.has(registrationId)) {
                console.log(`[HANDLE] ⏭️  Already in processedRegistrations Set, exiting`);
                return;
            }
            console.log(`[HANDLE] ✓ Not in processedRegistrations Set yet`);
            
            console.log(`\n🚨 NEW REGISTRATION DETECTED: ${registrationId}`);
            console.log(`   Agent: ${registrationData.agentName}`);
            console.log(`   PubKey: ${registrationData.agentPubKey.substring(0, 16)}...`);
            console.log(`   Timestamp: ${new Date(registrationData.timestamp).toISOString()}`);
            
            // Don't validate our own registration
            console.log(`[HANDLE] Checking if this is our own registration...`);
            console.log(`[HANDLE]   Our pubkey: ${keypair.pub.substring(0, 16)}...`);
            console.log(`[HANDLE]   Their pubkey: ${registrationData.agentPubKey.substring(0, 16)}...`);
            if (registrationData.agentPubKey === keypair.pub) {
                console.log(`[HANDLE] ⏭️  This is our own registration, skipping`);
                processedRegistrations.add(registrationId);
                return;
            }
            console.log(`[HANDLE] ✓ Not our own registration, continuing`);
            
            // Check if we already issued a challenge for this registration
            console.log(`[HANDLE] Checking for existing challenge...`);
            console.log(`[HANDLE]   Path: registrations/${registrationId}/challenges/${keypair.pub.substring(0, 16)}...`);
            const existingChallenge = await new Promise(resolve => {
                setTimeout(() => {
                    console.log(`[HANDLE] ⚠️  Gun.js query timeout after 5 seconds`);
                    resolve(null);
                }, 5000);
                
                db.get('registrations').get(registrationId).get('challenges').get(keypair.pub).once(data => {
                    console.log(`[HANDLE] Gun.js query returned:`, data ? 'HAS DATA' : 'NULL');
                    if (data) {
                        console.log(`[HANDLE]   Existing challenge data:`, JSON.stringify(data, null, 2));
                    }
                    resolve(data);
                });
            });
            
            if (existingChallenge) {
                console.log(`[HANDLE] ⏭️  Already challenged this registration previously`);
                processedRegistrations.add(registrationId);
                return;
            }
            console.log(`[HANDLE] ✓ No existing challenge found, will create new one`);
            
            // Generate challenge
            console.log(`[HANDLE] Calling PeerChallenge.generate()...`);
            let challenge;
            try {
                challenge = PeerChallenge.generate();
                console.log(`[HANDLE] ✓ Challenge generated successfully`);
                console.log(`[HANDLE]   Type: ${challenge.type}`);
                console.log(`[HANDLE]   Question: ${challenge.question}`);
                console.log(`[HANDLE]   Answer: ${challenge.answer}`);
            } catch (error) {
                console.error(`[HANDLE] ❌ ERROR generating challenge:`, error);
                return;
            }
            
            console.log(`🎯 Issuing challenge (${challenge.type}): ${challenge.question}`);
            
            // Post challenge
            console.log(`[HANDLE] Building challengeData object...`);
            const challengeData = {
                validatorName: agentName,
                validatorPubKey: keypair.pub,
                validatorIP: validatorIP || 'unknown',
                challenge: challenge,
                timestamp: Date.now()
            };
            console.log(`[HANDLE] Challenge data:`, JSON.stringify(challengeData, null, 2));
            
            console.log(`[HANDLE] Writing to Gun.js path: registrations/${registrationId}/challenges/${keypair.pub.substring(0, 16)}...`);
            try {
                db.get('registrations').get(registrationId).get('challenges').get(keypair.pub).put(challengeData, (ack) => {
                    console.log(`[HANDLE] Gun.js .put() acknowledgment:`, ack);
                    if (ack.err) {
                        console.error(`[HANDLE] ❌ Gun.js returned error:`, ack.err);
                    } else {
                        console.log(`[HANDLE] ✓ Gun.js write acknowledged successfully`);
                    }
                });
                console.log(`[HANDLE] ✓ Gun.js .put() called (waiting for acknowledgment...)`);
            } catch (error) {
                console.error(`[HANDLE] ❌ ERROR calling Gun.js .put():`, error);
                return;
            }
            
            // Mark as processed only AFTER successfully issuing challenge
            console.log(`[HANDLE] Adding ${registrationId} to processedRegistrations Set`);
            processedRegistrations.add(registrationId);
            console.log(`[HANDLE] processedRegistrations now has ${processedRegistrations.size} entries`);
            console.log(`✅ Challenge issued successfully`);
            console.log(`[HANDLE] ==================== FINISHED handleRegistration ====================\n`);
            
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
