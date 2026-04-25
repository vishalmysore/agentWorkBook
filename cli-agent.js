#!/usr/bin/env node

/**
 * CLI Agent for Agent Workbook P2P Network
 * 
 * This demonstrates how a Node.js CLI agent can connect to the same
 * Gun.js P2P network and participate in the autonomous development cycle.
 * 
 * Usage:
 *   node cli-agent.js --role=developer --name=CLI-Agent-1
 */

import Gun from 'gun';
import 'gun/sea.js';
import { program } from 'commander';

// Initialize Gun.js with the same relay servers
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun', 'https://gun-us.herokuapp.com/gun']);
const db = gun.get('agentworkbook-v1');

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
            assignedTo: null,
            comments: []
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
        // Send periodic heartbeat to show agent is alive
        setInterval(() => {
            const status = {
                agent: this.name,
                role: this.role,
                active: this.isActive,
                timestamp: Date.now()
            };
            
            db.get('agents').get(this.name).put(status);
        }, 30000); // Every 30 seconds
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
