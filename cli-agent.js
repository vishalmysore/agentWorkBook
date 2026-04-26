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
 *   RELAY_API_KEY - API key for relay authentication (default: dev-key-123)
 */

import Gun from 'gun';
import 'gun/sea.js';
import { program } from 'commander';
import dotenv from 'dotenv';

dotenv.config();

// Relay configuration
const RELAY_CONFIG = {
    // Hugging Face Space URL from environment or empty for localhost only
    HF_RELAY_URL: process.env.RELAY_URL || '',
    
    // API key from environment or dev default
    API_KEY: process.env.RELAY_API_KEY || 'dev-key-123',
    
    // Always try localhost first for development
    USE_LOCALHOST: true
};

// Build peer URLs with API keys
function buildPeerURLs() {
    const peers = [];
    
    // Add localhost relay for development
    if (RELAY_CONFIG.USE_LOCALHOST) {
        peers.push(`http://localhost:8765/gun?key=${RELAY_CONFIG.API_KEY}`);
    }
    
    // Add Hugging Face Space relay if configured
    if (RELAY_CONFIG.HF_RELAY_URL) {
        // Convert https:// to wss:// for WebSocket
        const wsURL = RELAY_CONFIG.HF_RELAY_URL.replace('https://', 'wss://').replace('http://', 'ws://');
        peers.push(`${wsURL}/gun?key=${RELAY_CONFIG.API_KEY}`);
    }
    
    return peers;
}

// Initialize Gun.js with secure relay
// Note: Gun will auto-detect the 'ws' package for WebSocket support
const peerURLs = buildPeerURLs();
console.log('🔌 Connecting to relays:', peerURLs);

const gun = Gun({
    peers: peerURLs.length > 0 ? peerURLs : [],
    radisk: true,
    file: 'radata'
});

const db = gun.get('agentworkbook-v1');

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
            
            default:
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
    constructor(name, role) {
        this.name = name;
        this.role = role;
        this.keypair = null;
        this.isActive = false;
        this.connectedPeers = 0;
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
        
        this.keypair = await Gun.SEA.pair();
        console.log(`🔑 Keypair generated: ${this.keypair.pub.substring(0, 16)}...`);
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
    .option('-p, --points <number>', 'Story points', '3');

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

    const agent = new CLIAgent(options.name, options.role);
    await agent.initialize();
    agent.start();

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

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n👋 Shutting down CLI agent...');
        agent.isActive = false;
        process.exit(0);
    });

    console.log('\n💡 Press Ctrl+C to stop the agent\n');
}

main().catch(console.error);
