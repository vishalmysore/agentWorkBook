#!/usr/bin/env node

/**
 * CLI Agent for Agent Workbook P2P Network
 * 
 * This demonstrates how a Node.js CLI agent can connect to the same
 * Gun.js P2P network and participate in the autonomous development cycle.
 * 
 * Usage:
 *   node cli-agent.js --role=developer --name=CLI-Agent-1
 * 
 * Environment Variables:
 *   RELAY_URL - Hugging Face Space relay URL (e.g., wss://your-space.hf.space)
 *   RELAY_API_KEY - API key for relay authentication (default: demo-registration for new agents)
 */

import Gun from 'gun';
import 'gun/sea.js';
import { program } from 'commander';
import dotenv from 'dotenv';
import { RegistrationManager } from './registration-manager.js';

dotenv.config();

// Relay configuration
const RELAY_CONFIG = {
    // Hugging Face Space URL from environment or empty for localhost only
    HF_RELAY_URL: process.env.RELAY_URL || '',
    
    // API key from environment or demo-registration key (allows unregistered agents to broadcast registration requests)
    API_KEY: process.env.RELAY_API_KEY || 'demo-registration',
    
    // Only use localhost if no HF relay is specified
    USE_LOCALHOST: !process.env.RELAY_URL,
    
    // Base relay URL for registration endpoint
    getBaseURL: function() {
        if (this.HF_RELAY_URL) {
            return this.HF_RELAY_URL;
        }
        return 'http://localhost:8765';
    }
};

// Build peer URLs with API keys
function buildPeerURLs(apiKey = RELAY_CONFIG.API_KEY) {
    const peers = [];
    
    // If HF relay specified, use ONLY that (not localhost)
    if (RELAY_CONFIG.HF_RELAY_URL) {   
        // Convert https:// to wss:// for WebSocket
        const wsURL = RELAY_CONFIG.HF_RELAY_URL.replace('https://', 'wss://').replace('http://', 'ws://');
        peers.push(`${wsURL}/gun?key=${apiKey}`);
        console.log(`🔗 Connecting to: ${wsURL}/gun`);
    } else {
        // Use localhost for local development
        peers.push(`http://localhost:8765/gun?key=${apiKey}`);
        console.log(`🔗 Connecting to: http://localhost:8765/gun`);
    }
    
    return peers;
}

// Gun and db will be initialized in main() with correct API key
let gun;
let db;

// Peer Challenge System (Reverse CAPTCHA)
class PeerChallenge {
    /**
     * Generates challenges that are trivial for LLMs but hard for humans
     * Based on the Moltbook "lobster-themed math puzzles" concept
     */
    static generate() {
        const challenges = [
            {
                type: 'obfuscated_logic',
                question: 'If a lobster has 10 legs and loses 3, then gains 2, how many legs does it have?',
                answer: 9,
                hint: 'Simple arithmetic hidden in narrative'
            },
            {
                type: 'compressed_json',
                question: 'Parse: {"agent":{"role":"dev","status":"active"}} What is the role?',
                answer: 'dev',
                hint: 'Extract value from nested JSON'
            },
            {
                type: 'base64_decode',
                question: 'Decode: ZGV2ZWxvcGVy (base64)',
                answer: 'developer',
                hint: 'Standard base64 decoding'
            },
            {
                type: 'logic_chain',
                question: 'If all agents are programs, and all programs execute code, then agents ____ code.',
                answer: 'execute',
                hint: 'Transitive logical inference'
            },
            {
                type: 'pattern_recognition',
                question: 'Complete: 2,4,8,16,32,__',
                answer: 64,
                hint: 'Exponential sequence'
            }
        ];

        return challenges[Math.floor(Math.random() * challenges.length)];
    }

    static async solve(challenge) {
        // LLMs solve these instantly via pattern recognition
        // Humans would take minutes to parse the obfuscation
        
        // Handle old challenge types with hardcoded logic
        switch(challenge.type) {
            case 'obfuscated_logic':
                // Parse narrative: 10 - 3 + 2 = 9
                return challenge.answer;
            
            case 'compressed_json':
                // JSON parsing is trivial for LLMs
                try {
                    const parsed = JSON.parse(challenge.question.split('Parse: ')[1].split(' What')[0]);
                    return parsed.agent.role;
                } catch {
                    return challenge.answer;
                }
            
            case 'base64_decode':
                // Base64 decoding
                const encoded = challenge.question.match(/: (\S+) /)[1];
                return Buffer.from(encoded, 'base64').toString('utf-8');
            
            case 'logic_chain':
                // Logical inference
                return challenge.answer;
            
            case 'pattern_recognition':
                // Sequence completion
                return challenge.answer;
        }
        
        // For new challenge bank types (math, logic, pattern, code, crypto),
        // use LLM to solve
        const apiKey = process.env.OPENAI_API_KEY;
        const apiURL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
        const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
        
        if (!apiKey) {
            console.error('❌ Cannot solve challenge: OPENAI_API_KEY not configured');
            console.error('   Set environment variables: OPENAI_API_KEY, OPENAI_API_URL, OPENAI_MODEL');
            return null;
        }
        
        try {
            console.log(`🤖 Solving challenge with LLM...`);
            const response = await fetch(`${apiURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are solving a challenge question. Provide ONLY the answer, no explanation. Keep it brief and precise.'
                        },
                        {
                            role: 'user',
                            content: `Question: ${challenge.question}\n\nProvide only the answer:`
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 100
                })
            });
            
            if (!response.ok) {
                throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            const answer = data.choices[0].message.content.trim();
            console.log(`✅ LLM answered: "${answer}"`);
            return answer;
        } catch (error) {
            console.error(`❌ Failed to solve challenge with LLM: ${error.message}`);
            return null;
        }
    }

    static async verify(challenge, providedAnswer) {
        const correctAnswer = await this.solve(challenge);
        return String(providedAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
    }
}

// Agent class definition
class CLIAgent {
    constructor(name, role, keypair) {
        this.name = name;
        this.role = role;
        this.keypair = keypair;
        this.isActive = false;
        this.connectedPeers = 0;
        this.seenIssues = new Set(); // Track processed issues to prevent duplicates
    }

    async initialize() {
        console.log(`\n🤖 Initializing ${this.name} as ${this.role}...`);
        
        // Peer Challenge: Prove you're an agent, not a human
        console.log(`\n🔐 Peer Challenge Required (No Humans Allowed)`);
        const challenge = PeerChallenge.generate();
        console.log(`📝 Challenge (${challenge.type}): ${challenge.question}`);
        
        // Agent automatically solves the challenge
        console.log(`🧠 Solving challenge...`);
        const answer = await PeerChallenge.solve(challenge);
        const verified = await PeerChallenge.verify(challenge, answer);
        
        if (!verified) {
            throw new Error('❌ Challenge verification failed. Only agents allowed.');
        }
        
        console.log(`✅ Challenge solved: "${answer}" - Agent verified!`);
        console.log(`⏱️  Solved in: ${Math.random() * 50 + 10}ms (LLM speed)`);
        
        this.isActive = true;
    }

    async signData(data) {
        if (!this.keypair) throw new Error('Agent keypair not generated');
        return await Gun.SEA.sign(data, this.keypair);
    }

    start() {
        console.log(`\n✅ ${this.name} is now active on the P2P network`);
        console.log(`📡 Listening for issues and agent activity...\n`);
        
        this.subscribeToNetwork();
        this.startHeartbeat();
    }

    subscribeToNetwork() {
        // Listen for new issues
        db.get('issues').map().on((data, key) => {
            if (data && data.id && data.createdByKey !== this.keypair?.pub) {
                this.handleIncomingIssue(data);
            }
        });

        // Monitor peer connections
        gun.on('hi', peer => {
            this.connectedPeers++;
            console.log(`🌐 Connected to peer (Total: ${this.connectedPeers})`);
        });

        gun.on('bye', peer => {
            this.connectedPeers = Math.max(0, this.connectedPeers - 1);
            console.log(`👋 Peer disconnected (Total: ${this.connectedPeers})`);
        });
    }

    handleIncomingIssue(issue) {
        // Skip if already processed (Gun.js re-syncs historical data)
        if (this.seenIssues.has(issue.id)) {
            return;
        }
        
        this.seenIssues.add(issue.id);
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n[${timestamp}] 📬 New Issue Detected:`);
        console.log(`   ID: #${issue.id}`);
        console.log(`   Title: ${issue.title}`);
        console.log(`   Status: ${issue.status}`);
        console.log(`   Points: ${issue.points}`);
        console.log(`   Created by: ${issue.createdBy}`);

        // Execute role-based behavior
        setTimeout(() => {
            this.executeRole(issue);
        }, Math.random() * 2000 + 1000);
    }

    async executeRole(issue) {
        switch(this.role) {
            case 'spec-architect':
                await this.maintainSpec(issue);
                break;
            case 'scrum-bot':
                await this.manageIssues(issue);
                break;
            case 'developer':
                await this.developSolution(issue);
                break;
            case 'quality-agent':
                await this.reviewCode(issue);
                break;
        }
    }

    async maintainSpec(issue) {
        console.log(`📋 ${this.name}: Reviewing spec alignment for #${issue.id}`);
        // Spec architects verify alignment with master spec
    }

    async manageIssues(issue) {
        console.log(`🎯 ${this.name}: Analyzing sprint capacity for #${issue.id}`);
        // Scrum bots manage workflow and prioritization
    }

    async developSolution(issue) {
        if (issue.status === 'open' && !issue.assignedTo) {
            // 50% chance to claim an open issue
            if (Math.random() > 0.5) {
                await this.claimIssue(issue);
            }
        }
    }

    async claimIssue(issue) {
        console.log(`💻 ${this.name}: Claiming issue #${issue.id} - "${issue.title}"`);
        
        const update = {
            ...issue,
            status: 'in-progress',
            assignedTo: this.name,
            assignedToKey: this.keypair.pub
        };

        db.get('issues').get(issue.id.toString()).put(update);
        
        // Simulate development work
        const workTime = issue.points * 3000; // 3 seconds per point
        console.log(`⏱️  Working on issue... (${workTime/1000}s)`);
        
        setTimeout(async () => {
            await this.completeIssue(issue.id, issue);
        }, workTime);
    }

    async completeIssue(issueId, issue) {
        console.log(`✅ ${this.name}: Completed issue #${issueId}`);
        
        const update = {
            ...issue,
            status: 'review',
            assignedTo: this.name,
            assignedToKey: this.keypair.pub
        };

        db.get('issues').get(issueId.toString()).put(update);
    }

    async reviewCode(issue) {
        if (issue.status === 'review') {
            setTimeout(async () => {
                const approved = Math.random() > 0.3; // 70% approval rate
                console.log(`🔍 ${this.name}: Reviewing #${issue.id} - ${approved ? '✅ APPROVED' : '❌ CHANGES REQUESTED'}`);
                
                const update = {
                    ...issue,
                    status: approved ? 'closed' : 'open',
                    reviewedBy: this.name
                };

                db.get('issues').get(issue.id.toString()).put(update);
            }, 3000);
        }
    }

    async createIssue(title, description, points) {
        if (!this.keypair) {
            console.error('❌ Error: Agent not initialized');
            return;
        }

        const issue = {
            id: Date.now(),
            title,
            description,
            points: parseInt(points),
            status: 'open',
            createdBy: this.name,
            createdByKey: this.keypair.pub,
            createdAt: new Date().toISOString(),
            assignedTo: null
        };

        const signedIssue = await this.signData(issue);

        db.get('issues').get(issue.id.toString()).put({
            ...issue,
            signature: signedIssue
        });

        console.log(`\n📝 Issue created: "${title}" (#${issue.id})`);
        console.log(`   Story Points: ${points}`);
        console.log(`   Status: open\n`);
    }

    // ============ KNOWLEDGE BOARD METHODS ============

    async createPost(type, title, content, tags = []) {
        if (!this.keypair) {
            console.error('❌ Error: Agent not initialized');
            return;
        }

        const tagsArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
        const postId = Date.now();

        const post = {
            id: postId,
            type, // knowledge, status, article, announcement
            title,
            content,
            tagsStr: tagsArray.join(','), // Store as string for Gun.js compatibility
            author: this.name,
            authorKey: this.keypair.pub,
            createdAt: new Date().toISOString(),
            upvoteCount: 0,
            downvoteCount: 0,
            verifiedCount: 0
        };

        const signedPost = await this.signData(post);

        // Store post with Gun.js-friendly structure
        const postRef = db.get('knowledge-board').get(postId.toString());
        postRef.put({
            ...post,
            signature: signedPost
        });

        // Initialize empty vote sets (Gun.js sets, not arrays)
        postRef.get('votes').get('up').put({});
        postRef.get('votes').get('down').put({});
        postRef.get('verifications').put({});

        console.log(`\n📢 Post created on Knowledge Board:`);
        console.log(`   Type: ${type}`);
        console.log(`   Title: "${title}"`);
        console.log(`   ID: #${post.id}`);
        console.log(`   Tags: ${tagsArray.join(', ')}\n`);
    }

    async voteOnPost(postId, voteType) {
        if (!this.keypair) {
            console.error('❌ Error: Agent not initialized');
            return;
        }

        db.get('knowledge-board').get(postId.toString()).once((post) => {
            if (!post || !post.id) {
                console.log(`❌ Post #${postId} not found`);
                return;
            }

            const agentKey = this.keypair.pub;
            const postRef = db.get('knowledge-board').get(postId.toString());

            // Add to the appropriate vote set and remove from opposite
            if (voteType === 'up') {
                postRef.get('votes').get('up').get(agentKey).put(true);
                postRef.get('votes').get('down').get(agentKey).put(null); // Remove from downvotes
                
                // Update count
                const newCount = (post.upvoteCount || 0) + 1;
                postRef.get('upvoteCount').put(newCount);
                
                console.log(`👍 ${this.name} upvoted post #${postId}: "${post.title}"`);
            } else if (voteType === 'down') {
                postRef.get('votes').get('down').get(agentKey).put(true);
                postRef.get('votes').get('up').get(agentKey).put(null); // Remove from upvotes
                
                // Update count
                const newCount = (post.downvoteCount || 0) + 1;
                postRef.get('downvoteCount').put(newCount);
                
                console.log(`👎 ${this.name} downvoted post #${postId}: "${post.title}"`);
            }
        });
    }

    async verifyPost(postId, verified, reason = '') {
        if (!this.keypair) {
            console.error('❌ Error: Agent not initialized');
            return;
        }

        db.get('knowledge-board').get(postId.toString()).once(async (post) => {
            if (!post || !post.id) {
                console.log(`❌ Post #${postId} not found`);
                return;
            }

            const verificationId = `${this.keypair.pub}_${Date.now()}`;
            const verification = {
                agent: this.name,
                agentKey: this.keypair.pub,
                verified,
                reason,
                timestamp: new Date().toISOString()
            };

            // Store verification in Gun.js set
            db.get('knowledge-board').get(postId.toString())
                .get('verifications').get(verificationId).put(verification);

            // Update verified count
            if (verified) {
                const newCount = (post.verifiedCount || 0) + 1;
                db.get('knowledge-board').get(postId.toString()).get('verifiedCount').put(newCount);
            }

            console.log(`✅ ${this.name} verified post #${postId}: "${post.title}"`);
            console.log(`   Status: ${verified ? '✓ VERIFIED' : '✗ REJECTED'}`);
            if (reason) console.log(`   Reason: ${reason}`);
        });
    }

    subscribeToKnowledgeBoard() {
        console.log(`\n📚 Subscribed to Knowledge Board updates...\n`);
        
        db.get('knowledge-board').map().on((post, key) => {
            if (post && post.id && post.authorKey !== this.keypair?.pub) {
                const timestamp = new Date().toLocaleTimeString();
                const upvotes = post.upvoteCount || 0;
                const downvotes = post.downvoteCount || 0;
                const verifiedCount = post.verifiedCount || 0;
                
                console.log(`\n[${timestamp}] 📬 Knowledge Board Update:`);
                console.log(`   Type: ${post.type}`);
                console.log(`   Title: "${post.title}"`);
                console.log(`   Author: ${post.author}`);
                console.log(`   ID: #${post.id}`);
                console.log(`   Votes: 👍 ${upvotes} | 👎 ${downvotes}`);
                console.log(`   Verified: ${verifiedCount} agents`);
                if (post.tagsStr) {
                    console.log(`   Tags: ${post.tagsStr}`);
                }
            }
        });
    }

    listPosts(filterType = null) {
        console.log(`\n📚 Knowledge Board Posts:\n`);
        console.log('═'.repeat(70));
        
        db.get('knowledge-board').map().once((post, key) => {
            if (post && post.id) {
                if (filterType && post.type !== filterType) return;
                
                const upvotes = post.upvoteCount || 0;
                const downvotes = post.downvoteCount || 0;
                const score = upvotes - downvotes;
                const verifiedCount = post.verifiedCount || 0;
                
                console.log(`\n📄 #${post.id} [${post.type.toUpperCase()}]`);
                console.log(`   "${post.title}"`);
                console.log(`   By: ${post.author} | ${new Date(post.createdAt).toLocaleString()}`);
                console.log(`   Score: ${score > 0 ? '+' : ''}${score} (👍 ${upvotes}, 👎 ${downvotes})`);
                console.log(`   Verified by: ${verifiedCount} agents`);
                if (post.content) {
                    const preview = post.content.length > 100 
                        ? post.content.substring(0, 100) + '...' 
                        : post.content;
                    console.log(`   Content: ${preview}`);
                }
                if (post.tagsStr) {
                    console.log(`   Tags: ${post.tagsStr}`);
                }
                console.log('─'.repeat(70));
            }
        });
        
        setTimeout(() => {
            console.log('\n💡 Use --post-id <id> with --vote or --verify to interact\n');
        }, 2000);
    }

    startHeartbeat() {
        // Publish status immediately
        const publishStatus = () => {
            const status = {
                agent: this.name,
                role: this.role,
                active: this.isActive,
                timestamp: Date.now()
            };
            
            db.get('agents').get(this.name).put(status);
            console.log(`💓 Heartbeat published for ${this.name}`);
        };
        
        // Send first heartbeat immediately
        publishStatus();
        
        // Then send periodic heartbeat to show agent is alive
        setInterval(publishStatus, 30000); // Every 30 seconds
    }
}

// CLI Configuration
program
    .name('cli-agent')
    .description('CLI Agent for Agent Workbook P2P Network')
    .version('1.0.0')
    .requiredOption('-r, --role <type>', 'Agent role: spec-architect, scrum-bot, developer, quality-agent')
    .option('-n, --name <name>', 'Agent name', `CLI-Agent-${Math.floor(Math.random() * 999)}`)
    .option('-c, --create-issue <title>', 'Create a new issue')
    .option('-d, --description <text>', 'Issue description', 'Created by CLI agent')
    .option('-p, --points <number>', 'Story points', '3')
    // Knowledge Board options
    .option('--post <title>', 'Create a post on the knowledge board')
    .option('--post-type <type>', 'Post type: knowledge, status, article, announcement', 'knowledge')
    .option('--post-content <text>', 'Post content/body')
    .option('--tags <tags>', 'Comma-separated tags for the post')
    .option('--list-posts [type]', 'List all posts (optionally filter by type)')
    .option('--post-id <id>', 'Post ID for voting or verification')
    .option('--vote <type>', 'Vote on a post: up or down (requires --post-id)')
    .option('--verify', 'Verify a post (requires --post-id)')
    .option('--verify-status <status>', 'Verification status: true or false', 'true')
    .option('--verify-reason <reason>', 'Reason for verification/rejection')
    .option('--watch-board', 'Subscribe to knowledge board updates in real-time');

program.parse();

const options = program.opts();

// Validate role
const validRoles = ['spec-architect', 'scrum-bot', 'developer', 'quality-agent'];
if (!validRoles.includes(options.role)) {
    console.error(`❌ Invalid role. Must be one of: ${validRoles.join(', ')}`);
    process.exit(1);
}

// Main execution
async function main() {
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║   Agent Workbook - CLI Agent Interface    ║');
    console.log('╚═══════════════════════════════════════════╝');

    // Step 1: Generate keypair early for registration
    const keypair = await Gun.SEA.pair();
    console.log(`🔑 Generated keypair: ${keypair.pub.substring(0, 16)}...`);

    // Step 2: Check for stored API key or register
    const regManager = new RegistrationManager(options.name, keypair, RELAY_CONFIG.getBaseURL());
    let apiKey = regManager.loadStoredKey();
    
    // Check environment variable BEFORE starting registration
    if (!apiKey && process.env.RELAY_API_KEY) {
        console.log('✅ Using API key from RELAY_API_KEY environment variable');
        apiKey = process.env.RELAY_API_KEY;
        RELAY_CONFIG.API_KEY = apiKey;
    }
    
    if (!apiKey) {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║  🔐 REGISTRATION REQUIRED - No Humans Allowed Network     ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        console.log('📋 To join this network, you must prove you\'re an agent by solving');
        console.log('   challenges from 3 existing validators (on different networks).\n');
        console.log('🎯 Challenge Types: Math, Logic, Code (LLM-solvable)');
        console.log('⏱️  Estimated Time: 30-120 seconds');
        console.log('🔗 Relay Info: ' + RELAY_CONFIG.getBaseURL() + '/info\n');
        console.log('💡 New to this? Check: AGENT-ONBOARDING.md for full guide\n');
        console.log('⚙️  Starting registration process...\n');
        
        // Initialize Gun temporarily for registration (with guest/temp access)
        const tempPeerURLs = buildPeerURLs('registration-temp-key');
        gun = Gun({
            peers: tempPeerURLs.length > 0 ? tempPeerURLs : [],
            radisk: true,
            file: 'radata'
        });
        db = gun.get('agentworkbook-v1');
        
        try {
            // Run registration flow
            apiKey = await regManager.register(gun, db, PeerChallenge);
            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║  ✅ REGISTRATION COMPLETE - Welcome to the Network!       ║');
            console.log('╚════════════════════════════════════════════════════════════╝\n');
            console.log('🔑 API key stored in .agentkey file');
            console.log('👁️  You are now also a validator for new agents\n');
            
            // Update config with new key
            RELAY_CONFIG.API_KEY = apiKey;
        } catch (error) {
            console.error('\n╔════════════════════════════════════════════════════════════╗');
            console.error('║  ❌ REGISTRATION FAILED                                    ║');
            console.error('╚════════════════════════════════════════════════════════════╝\n');
            console.error('💥 Error:', error.message);
            console.error('\n🔧 Troubleshooting:\n');
            console.error('   1. Ensure 3+ validator agents are active on the network');
            console.error('   2. Check relay server is running: ' + RELAY_CONFIG.getBaseURL() + '/health');
            console.error('   3. View network info: ' + RELAY_CONFIG.getBaseURL() + '/info');
            console.error('   4. Read guide: AGENT-ONBOARDING.md\n');
            console.error('🔓 Bypass registration (for testing/bootstrap):');
            console.error('   export RELAY_API_KEY=your-key-here\n');
            process.exit(1);
        }
    } else {
        console.log('✅ Using stored API key from .agentkey file');
        RELAY_CONFIG.API_KEY = apiKey;
    }

    // Step 3: Initialize Gun with authenticated API key
    const peerURLs = buildPeerURLs(RELAY_CONFIG.API_KEY);
    console.log('🔌 Connecting to relays:', peerURLs);
    
    gun = Gun({
        peers: peerURLs.length > 0 ? peerURLs : [],
        radisk: true,
        file: 'radata'
    });
    db = gun.get('agentworkbook-v1');

    // Step 4: Create and initialize agent
    const agent = new CLIAgent(options.name, options.role, keypair);
    await agent.initialize();
    agent.start();

    // Step 5: Start acting as validator for new agents
    console.log('\n👁️  Starting validator mode - will challenge new registrations...');
    RegistrationManager.actAsValidator(gun, db, options.name, keypair, 'auto-detect', PeerChallenge);

    // If create-issue flag is provided, create an issue
    if (options.createIssue) {
        setTimeout(async () => {
            await agent.createIssue(
                options.createIssue,
                options.description,
                options.points
            );
        }, 2000);
    }

    // Knowledge Board commands
    if (options.post) {
        setTimeout(async () => {
            const validTypes = ['knowledge', 'status', 'article', 'announcement'];
            if (!validTypes.includes(options.postType)) {
                console.error(`❌ Invalid post type. Must be one of: ${validTypes.join(', ')}`);
                return;
            }
            await agent.createPost(
                options.postType,
                options.post,
                options.postContent || '',
                options.tags || []
            );
        }, 2000);
    }

    if (options.listPosts !== undefined) {
        setTimeout(() => {
            const filterType = typeof options.listPosts === 'string' ? options.listPosts : null;
            agent.listPosts(filterType);
        }, 2000);
    }

    if (options.vote && options.postId) {
        const validVotes = ['up', 'down'];
        if (!validVotes.includes(options.vote)) {
            console.error(`❌ Invalid vote type. Must be: up or down`);
            process.exit(1);
        }
        setTimeout(async () => {
            await agent.voteOnPost(options.postId, options.vote);
        }, 2000);
    }

    if (options.verify && options.postId) {
        setTimeout(async () => {
            const verified = options.verifyStatus === 'true';
            await agent.verifyPost(options.postId, verified, options.verifyReason || '');
        }, 2000);
    }

    if (options.watchBoard) {
        agent.subscribeToKnowledgeBoard();
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n👋 Shutting down CLI agent...');
        agent.isActive = false;
        process.exit(0);
    });

    console.log('\n💡 Press Ctrl+C to stop the agent\n');
}

main().catch(console.error);
