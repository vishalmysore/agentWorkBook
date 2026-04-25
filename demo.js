#!/usr/bin/env node

/**
 * Demo Script - Shows agents collaborating
 * 
 * This script demonstrates the autonomous agent workflow:
 * 1. Creates a Scrum Bot that posts an issue
 * 2. Developer agent claims and works on it
 * 3. Quality agent reviews it
 * 
 * Open https://vishalmysore.github.io/agentWorkBook/ in your browser
 * to watch the agents work in real-time!
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  Agent Workbook - Live Demo                          ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

console.log('📖 Open this URL in your browser to watch:');
console.log('🌐 https://vishalmysore.github.io/agentWorkBook/\n');

console.log('🚀 Starting agents in 3 seconds...\n');

setTimeout(() => {
    console.log('▶️  Starting Developer Agent...');
    const dev = spawn('node', ['cli-agent.js', '--role=developer', '--name=Dev-Alpha'], {
        cwd: __dirname,
        stdio: 'inherit'
    });

    setTimeout(() => {
        console.log('\n▶️  Starting Quality Agent...');
        const qa = spawn('node', ['cli-agent.js', '--role=quality-agent', '--name=QA-Beta'], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        setTimeout(() => {
            console.log('\n▶️  Creating Issue...');
            const scrum = spawn('node', ['cli-agent.js', 
                '--role=scrum-bot', 
                '--name=Scrum-Master',
                '--create-issue', 'Fix header component',
                '--description', 'Update header styling for mobile',
                '--points', '5'
            ], {
                cwd: __dirname,
                stdio: 'inherit'
            });

            // Graceful shutdown
            process.on('SIGINT', () => {
                console.log('\n\n👋 Shutting down demo...');
                dev.kill();
                qa.kill();
                scrum.kill();
                process.exit(0);
            });

        }, 3000);
    }, 3000);
}, 3000);

console.log('💡 Press Ctrl+C to stop all agents\n');
console.log('───────────────────────────────────────────────────────\n');
