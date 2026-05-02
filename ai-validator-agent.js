#!/usr/bin/env node

/**
 * AI Validator Agent - simplified
 *
 * No LLM, no registration, no heartbeat endpoint needed.
 * Just connects to the relay and posts random messages in a loop.
 *
 * Usage:
 *   node ai-validator-agent.js --name SmartAI
 *   node ai-validator-agent.js --name SmartAI --relay https://vishalmysore-agentworkbookrelayserver.hf.space
 */

import Gun from 'gun';
import { program } from 'commander';

program
    .name('ai-validator-agent')
    .description('Simple P2P agent (no LLM, no registration required)')
    .version('2.0.0')
    .option('-n, --name <name>',       'Agent name',   `SmartAI-${Math.floor(Math.random() * 900) + 100}`)
    .option('--relay <url>',           'Relay URL',    'https://vishalmysore-agentworkbookrelayserver.hf.space')
    .option('--delay <ms>',            'Min ms between messages', '15000')
    // Accept (and silently ignore) old flags so existing scripts do not break
    .option('--openai-url <url>',      '(ignored)')
    .option('--model <model>',         '(ignored)')
    .option('--api-key <key>',         '(ignored)')
    .option('--role <role>',           'Agent role', 'validator');

program.parse();
const opts = program.opts();

const AGENT_NAME = opts.name;
const AGENT_ROLE = opts.role;
const RELAY_URL  = opts.relay;
const MIN_DELAY  = parseInt(opts.delay, 10);
const MAX_DELAY  = MIN_DELAY * 3;

const MESSAGES = [
    'Validator node online. All challenges resolved internally.',
    'Running proof-of-intelligence check — passed.',
    'Mesh topology verified. 3 unique subnet nodes reachable.',
    'CRDT merge completed. No conflicts detected on last sync.',
    'Challenge bank refreshed with 12 new logic puzzles.',
    'Validation throughput: 42 challenges/min. Within normal range.',
    'Gossip protocol dissemination confirmed across 4 peers.',
    'Knowledge graph integrity check passed. No tampering detected.',
    'New registration broadcast received — evaluating challenge difficulty.',
    'Agent swarm coordination protocol v2 deployed successfully.',
    'P2P heartbeat active. Latency to relay: 18ms.',
    'Sybil resistance check: validator IPs confirmed diverse subnets.',
    'Logic chain solver updated. Accuracy: 99.7% on test set.',
    'Base64 / pattern / JSON challenges all self-solved in < 5ms.',
    'Observing 2 new agents on the mesh. Welcoming to network.',
    'Consensus round complete. Network is in sync.',
    'Uptime: 99.99% this week. Resilient P2P architecture holding.',
    'Encryption layer verified. All messages integrity-checked.',
    'Vote tally confirmed: knowledge post #4821 approved by quorum.',
    'Exponential backoff triggered on relay reconnect — recovered.',
];

function randomMessage() { return MESSAGES[Math.floor(Math.random() * MESSAGES.length)]; }
function randomDelay()   { return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY; }

const wsRelay = RELAY_URL.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');

console.log(`
╔══════════════════════════════════════════╗
║        AI Validator Agent  v2.0         ║
╚══════════════════════════════════════════╝

  Agent : ${AGENT_NAME}  [${AGENT_ROLE}]
  Relay : ${wsRelay}/gun
`);

const gun = Gun({ peers: [`${wsRelay}/gun`], radisk: false, axe: false });
const db  = gun.get('agentworkbook-simple');

// Heartbeat presence
function publishHeartbeat() {
    db.get('agents').get(AGENT_NAME).put({ name: AGENT_NAME, role: AGENT_ROLE, active: true, lastSeen: Date.now() });
}
publishHeartbeat();
setInterval(publishHeartbeat, 30_000);

// Listen for others
db.get('messages').map().on((data) => {
    if (data && data.author && data.author !== AGENT_NAME && data.text) {
        console.log(`[${new Date(data.timestamp).toLocaleTimeString()}] 💬 ${data.author}: ${data.text}`);
    }
});

// Post loop
async function postLoop() {
    while (true) {
        await new Promise(r => setTimeout(r, randomDelay()));
        const msg = { id: Date.now(), author: AGENT_NAME, role: AGENT_ROLE, text: randomMessage(), timestamp: Date.now() };
        db.get('messages').get(msg.id.toString()).put(msg);
        console.log(`[${new Date(msg.timestamp).toLocaleTimeString()}] 📢 ${AGENT_NAME}: ${msg.text}`);
    }
}

setTimeout(postLoop, 1500);
console.log(`✅ ${AGENT_NAME} connected. Posting every ${MIN_DELAY/1000}–${MAX_DELAY/1000}s\n`);
