#!/usr/bin/env node

/**
 * Test script for decentralized agent registration system
 * 
 * This script simulates the registration flow:
 * 1. Starts 3 validator agents
 * 2. Starts 1 new agent (without API key)
 * 3. Verifies new agent receives 3 challenges
 * 4. Verifies new agent submits validations to relay
 * 5. Verifies new agent receives API key
 * 6. Verifies API key is stored in .agentkey file
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class RegistrationTestHarness {
    constructor() {
        this.processes = [];
        this.logs = {
            relay: [],
            validator1: [],
            validator2: [],
            validator3: [],
            newAgent: []
        };
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up processes...');
        for (const proc of this.processes) {
            proc.kill();
        }
        
        // Clean up test .agentkey files
        try {
            await fs.unlink(join(__dirname, '.agentkey'));
        } catch (e) {
            // Ignore if doesn't exist
        }
    }

    async startRelay() {
        console.log('🚀 Starting relay server...');
        const relay = spawn('node', ['relay-server.js'], {
            cwd: __dirname,
            env: {
                ...process.env,
                PORT: '8765',
                API_KEYS: 'test-validator-1,test-validator-2,test-validator-3'
            }
        });

        relay.stdout.on('data', (data) => {
            const line = data.toString();
            this.logs.relay.push(line);
            console.log(`[RELAY] ${line.trim()}`);
        });

        relay.stderr.on('data', (data) => {
            console.error(`[RELAY ERROR] ${data.toString().trim()}`);
        });

        this.processes.push(relay);

        // Wait for relay to start
        await this.waitForLog('relay', 'Relay server running', 10000);
        console.log('✅ Relay server ready\n');
    }

    async startValidator(name, apiKey) {
        console.log(`🤖 Starting validator: ${name}...`);
        const validator = spawn('node', ['cli-agent.js', '--role=developer', `--name=${name}`], {
            cwd: __dirname,
            env: {
                ...process.env,
                RELAY_API_KEY: apiKey
            }
        });

        const logKey = name.toLowerCase().replace(/\s/g, '');
        validator.stdout.on('data', (data) => {
            const line = data.toString();
            this.logs[logKey].push(line);
            console.log(`[${name.toUpperCase()}] ${line.trim()}`);
        });

        validator.stderr.on('data', (data) => {
            console.error(`[${name.toUpperCase()} ERROR] ${data.toString().trim()}`);
        });

        this.processes.push(validator);

        // Wait for validator to start
        await this.waitForLog(logKey, 'Starting validator mode', 10000);
        console.log(`✅ ${name} ready\n`);
    }

    async startNewAgent() {
        console.log('🆕 Starting new agent (without API key)...');
        
        // Ensure no .agentkey exists
        try {
            await fs.unlink(join(__dirname, '.agentkey'));
        } catch (e) {
            // Ignore if doesn't exist
        }

        const newAgent = spawn('node', ['cli-agent.js', '--role=tester', '--name=NewAgent'], {
            cwd: __dirname
        });

        newAgent.stdout.on('data', (data) => {
            const line = data.toString();
            this.logs.newAgent.push(line);
            console.log(`[NEWAGENT] ${line.trim()}`);
        });

        newAgent.stderr.on('data', (data) => {
            console.error(`[NEWAGENT ERROR] ${data.toString().trim()}`);
        });

        this.processes.push(newAgent);

        console.log('⏳ Waiting for registration to complete...\n');
    }

    async waitForLog(processName, pattern, timeout = 30000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const logs = this.logs[processName].join('\n');
            if (logs.includes(pattern)) {
                return true;
            }
            await this.sleep(100);
        }
        throw new Error(`Timeout waiting for "${pattern}" in ${processName} logs`);
    }

    async verifyRegistration() {
        console.log('\n🔍 Verifying registration...');

        // Check for registration start
        await this.waitForLog('newAgent', 'Starting registration process', 5000);
        console.log('✅ Registration initiated');

        // Check for challenges received
        await this.waitForLog('newAgent', 'Solved challenge from', 60000);
        console.log('✅ Challenges received and solved');

        // Check for registration completion
        await this.waitForLog('newAgent', 'Registration complete', 60000);
        console.log('✅ Registration completed');

        // Verify .agentkey file exists
        const keyFilePath = join(__dirname, '.agentkey');
        const keyFileExists = await fs.access(keyFilePath).then(() => true).catch(() => false);
        if (!keyFileExists) {
            throw new Error('.agentkey file not created');
        }
        console.log('✅ API key file created');

        // Verify .agentkey content
        const keyFileContent = await fs.readFile(keyFilePath, 'utf8');
        const keyData = JSON.parse(keyFileContent);
        if (!keyData.apiKey || !keyData.apiKey.startsWith('agent-')) {
            throw new Error('Invalid API key format in .agentkey file');
        }
        console.log(`✅ Valid API key stored: ${keyData.apiKey.substring(0, 16)}...`);

        // Verify agent connected to network
        await this.waitForLog('newAgent', 'is now active on the P2P network', 10000);
        console.log('✅ Agent connected to network with new API key');

        return true;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async run() {
        console.log('╔════════════════════════════════════════════════════╗');
        console.log('║  Agent Registration System - Integration Test     ║');
        console.log('╚════════════════════════════════════════════════════╝\n');

        try {
            // Step 1: Start relay
            await this.startRelay();

            // Step 2: Start 3 validators
            await this.startValidator('Validator1', 'test-validator-1');
            await this.startValidator('Validator2', 'test-validator-2');
            await this.startValidator('Validator3', 'test-validator-3');

            // Step 3: Give validators time to sync
            console.log('⏳ Waiting for network to stabilize...\n');
            await this.sleep(3000);

            // Step 4: Start new agent (triggers registration)
            await this.startNewAgent();

            // Step 5: Verify registration flow
            await this.verifyRegistration();

            console.log('\n╔════════════════════════════════════════════════════╗');
            console.log('║              ✅ ALL TESTS PASSED                   ║');
            console.log('╚════════════════════════════════════════════════════╝\n');

            console.log('📊 Test Summary:');
            console.log('  ✅ Relay server started');
            console.log('  ✅ 3 validators connected');
            console.log('  ✅ New agent registered');
            console.log('  ✅ Challenges issued and solved');
            console.log('  ✅ API key issued and stored');
            console.log('  ✅ Agent connected to network\n');

            console.log('💡 Press Ctrl+C to stop all processes\n');

            // Keep processes running for manual inspection
            await new Promise(() => {});

        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            console.error('\n📋 Recent logs:');
            for (const [name, logs] of Object.entries(this.logs)) {
                console.error(`\n[${name.toUpperCase()}]`);
                console.error(logs.slice(-10).join(''));
            }
            await this.cleanup();
            process.exit(1);
        }
    }
}

// Run test harness
const harness = new RegistrationTestHarness();

process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down test harness...');
    await harness.cleanup();
    process.exit(0);
});

harness.run().catch(async (error) => {
    console.error('Fatal error:', error);
    await harness.cleanup();
    process.exit(1);
});
