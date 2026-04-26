#!/usr/bin/env node

/**
 * AI-Powered Validator Agent
 * 
 * Uses OpenAI (or compatible LLM) to generate dynamic proof-of-work challenges
 * for new agents joining the network. Each challenge is unique and adaptive.
 * 
 * Usage:
 *   node ai-validator-agent.js \
 *     --name ValidatorAI \
 *     --openai-url https://api.openai.com/v1 \
 *     --model gpt-4 \
 *     --api-key sk-...
 */

import Gun from 'gun';
import 'gun/sea.js';
import 'gun/lib/radix.js';
import 'gun/lib/radisk.js';
import 'gun/lib/store.js';
import 'gun/lib/rindexed.js';

// LLM Client for generating challenges
class LLMClient {
    constructor(apiUrl, apiKey, model = 'gpt-4') {
        this.apiUrl = apiUrl || 'https://api.openai.com/v1';
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateChallenge(difficulty = 'medium') {
        const prompt = `Generate a unique proof-of-intelligence challenge for an AI agent registration system.

Requirements:
- Difficulty: ${difficulty}
- Question must be solvable by an intelligent agent
- Include a clear, unambiguous answer (one word or short phrase)
- Challenge types: math, logic, pattern recognition, word puzzles, or code comprehension

Return ONLY valid JSON with this structure:
{
  "question": "your challenge question",
  "answer": "correct answer",
  "type": "math|logic|pattern|code|word",
  "difficulty": "${difficulty}"
}

Be creative and avoid common questions. The question should test intelligence, not memorization.`;

        try {
            const response = await fetch(`${this.apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a challenge generator for an AI agent network. Generate creative, fair, and solvable puzzles.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.9, // High creativity
                    max_tokens: 300
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`   API Response Status: ${response.status}`);
                console.error(`   API Response Body: ${errorText}`);
                throw new Error(`LLM API error: ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content.trim();
            
            // Clean up markdown code blocks if present
            const jsonStr = content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('❌ Failed to generate challenge:', error.message);
            
            // Fallback to hardcoded challenge
            return {
                question: 'What is 7 + 8?',
                answer: '15',
                type: 'math',
                difficulty: 'easy'
            };
        }
    }

    async solveChallenge(question, type) {
        const prompt = `Solve this challenge:

Type: ${type}
Question: ${question}

Provide ONLY the answer - no explanation, no extra text. Just the answer.`;

        try {
            const response = await fetch(`${this.apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You solve puzzles and challenges. Provide only the answer, no explanation.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3, // Low temperature for accuracy
                    max_tokens: 50
                })
            });

            if (!response.ok) {
                throw new Error(`LLM API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('❌ Failed to solve challenge:', error.message);
            return null;
        }
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.apiUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// AI Validator Agent
class AIValidatorAgent {
    constructor(name, llmClient, relayUrl, apiKey) {
        this.name = name;
        this.llm = llmClient;
        this.relayUrl = relayUrl;
        this.apiKey = apiKey;
        this.keypair = null;
        this.gun = null;
        this.issuedChallenges = new Map(); // Track challenges issued
    }

    async initialize() {
        console.log(`\n🤖 AI Validator Agent: ${this.name}`);
        console.log(`🔗 Relay: ${this.relayUrl}`);
        
        // Generate keypair
        this.keypair = await Gun.SEA.pair();
        console.log(`🔑 Public Key: ${this.keypair.pub.substring(0, 20)}...`);

        // Initialize Gun
        this.gun = Gun({
            peers: [`${this.relayUrl}/gun?key=${this.apiKey}`],
            localStorage: false,
            radisk: false
        });
        this.db = this.gun.get('agentworkbook-v1');

        console.log(`✅ Validator initialized\n`);
    }

    async start() {
        console.log(`👂 Subscribing to registration requests...\n`);

        // Watch for registration requests
        this.db.get('registrations').map().on(async (registration, id) => {
            if (!registration || !registration.agentName) return;
            
            // Skip if we already issued a challenge for this registration
            if (this.issuedChallenges.has(id)) return;
            
            console.log(`\n🆕 New registration detected: ${registration.agentName}`);
            console.log(`📍 IP: ${registration.ip || 'unknown'}`);
            
            // Generate AI challenge
            console.log(`🤖 Generating AI challenge...`);
            const challenge = await this.llm.generateChallenge('medium');
            
            console.log(`🎯 Generated challenge:`);
            console.log(`   Type: ${challenge.type}`);
            console.log(`   Question: ${challenge.question}`);
            console.log(`   Difficulty: ${challenge.difficulty}`);
            
            // Issue challenge
            const challengeId = `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const issuedChallenge = {
                id: challengeId,
                registrationId: id,
                validator: this.name,
                validatorPub: this.keypair.pub,
                question: challenge.question,
                type: challenge.type,
                difficulty: challenge.difficulty,
                timestamp: Date.now()
            };

            // Store expected answer (encrypted for validator only)
            this.issuedChallenges.set(challengeId, {
                answer: challenge.answer.toLowerCase().trim(),
                registrationId: id
            });

            // Publish challenge to the network
            const signedChallenge = await Gun.SEA.sign(issuedChallenge, this.keypair);
            this.db.get('challenges').get(challengeId).put(signedChallenge);
            
            console.log(`📤 Issued challenge ID: ${challengeId}`);
            console.log(`⏳ Waiting for response...\n`);
        });

        // Watch for challenge responses
        this.db.get('challengeResponses').map().on(async (response, responseId) => {
            if (!response || !response.challengeId) return;
            
            const challengeData = this.issuedChallenges.get(response.challengeId);
            if (!challengeData) return; // Not our challenge
            
            console.log(`\n📥 Received response to challenge: ${response.challengeId}`);
            console.log(`   From: ${response.agentName}`);
            console.log(`   Answer: ${response.answer}`);
            
            // Validate answer
            const submittedAnswer = (response.answer || '').toLowerCase().trim();
            const correctAnswer = challengeData.answer;
            const isCorrect = submittedAnswer === correctAnswer;
            
            console.log(`   Expected: ${correctAnswer}`);
            console.log(`   Result: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
            
            // Publish validation result
            const validation = {
                challengeId: response.challengeId,
                registrationId: challengeData.registrationId,
                validator: this.name,
                validatorPub: this.keypair.pub,
                agentName: response.agentName,
                isValid: isCorrect,
                timestamp: Date.now()
            };

            const signedValidation = await Gun.SEA.sign(validation, this.keypair);
            this.db.get('validations').get(responseId).put(signedValidation);
            
            console.log(`📤 Validation published\n`);
            
            // Clean up
            if (isCorrect) {
                this.issuedChallenges.delete(response.challengeId);
            }
        });

        // Publish heartbeat
        setInterval(() => {
            this.db.get('agents').get(this.name).put({
                name: this.name,
                role: 'validator',
                type: 'ai-powered',
                pub: this.keypair.pub,
                lastSeen: Date.now(),
                challengesIssued: this.issuedChallenges.size
            });
        }, 30000);
    }
}

// CLI Argument Parsing
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        name: 'AI-Validator',
        openaiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL || 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY,
        relayUrl: process.env.RELAY_URL || 'https://vishalmysore-agentworkbookrelayserver.hf.space',
        relayApiKey: process.env.RELAY_API_KEY
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--name':
                config.name = args[++i];
                break;
            case '--openai-url':
                config.openaiUrl = args[++i];
                break;
            case '--model':
                config.model = args[++i];
                break;
            case '--api-key':
                config.apiKey = args[++i];
                break;
            case '--relay-url':
                config.relayUrl = args[++i];
                break;
            case '--relay-key':
                config.relayApiKey = args[++i];
                break;
            case '--help':
                console.log(`
AI Validator Agent - Dynamic Challenge Generator

Usage:
  node ai-validator-agent.js [options]

Options:
  --name <name>           Validator agent name (default: AI-Validator)
  --openai-url <url>      OpenAI API URL (default: https://api.openai.com/v1)
  --model <model>         LLM model (default: gpt-4)
  --api-key <key>         OpenAI API key (or env: OPENAI_API_KEY)
  --relay-url <url>       Gun.js relay URL (or env: RELAY_URL)
  --relay-key <key>       Relay API key (or env: RELAY_API_KEY)
  --help                  Show this help

Environment Variables:
  OPENAI_API_URL          OpenAI API endpoint
  OPENAI_MODEL            Model name (gpt-4, gpt-3.5-turbo, etc.)
  OPENAI_API_KEY          OpenAI API key
  RELAY_URL               Gun.js relay server URL
  RELAY_API_KEY           Relay authentication key

Examples:
  # Basic usage with OpenAI
  node ai-validator-agent.js --api-key sk-...

  # Custom model and URL
  node ai-validator-agent.js \\
    --model gpt-3.5-turbo \\
    --api-key sk-...

  # Using environment variables
  export OPENAI_API_KEY=sk-...
  export RELAY_API_KEY=agent-bootstrap1
  node ai-validator-agent.js --name ValidatorBot

  # Ollama (local, free)
  node ai-validator-agent.js \\
    --openai-url http://localhost:11434/v1 \\
    --model llama2 \\
    --api-key ollama

  # Azure OpenAI
  node ai-validator-agent.js \\
    --openai-url https://your-resource.openai.azure.com/openai/deployments/your-deployment \\
    --api-key your-azure-key
`);
                process.exit(0);
        }
    }

    return config;
}

// Main
async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   AI-Powered Validator Agent                 ║');
    console.log('║   Dynamic Challenge Generation via LLM       ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    const config = parseArgs();

    // Validate required config
    if (!config.apiKey) {
        console.error('❌ Error: OpenAI API key required');
        console.error('   Provide via --api-key or OPENAI_API_KEY environment variable\n');
        process.exit(1);
    }

    if (!config.relayApiKey) {
        console.error('❌ Error: Relay API key required');
        console.error('   Provide via --relay-key or RELAY_API_KEY environment variable\n');
        process.exit(1);
    }

    // Initialize LLM client
    console.log('🧪 Testing LLM connection...');
    const llm = new LLMClient(config.openaiUrl, config.apiKey, config.model);
    
    const isConnected = await llm.testConnection();
    if (!isConnected) {
        console.warn('⚠️  Warning: Could not verify LLM connection');
        console.warn('   Will attempt to use anyway...\n');
    } else {
        console.log('✅ LLM connection verified\n');
    }

    // Test challenge generation
    console.log('🎯 Generating test challenge...');
    const testChallenge = await llm.generateChallenge('easy');
    console.log(`   Question: ${testChallenge.question}`);
    console.log(`   Type: ${testChallenge.type}`);
    console.log(`   (Answer: ${testChallenge.answer})`);
    console.log('✅ Challenge generation working!\n');

    // Initialize validator agent
    const agent = new AIValidatorAgent(
        config.name,
        llm,
        config.relayUrl,
        config.relayApiKey
    );

    await agent.initialize();
    await agent.start();

    // Keep alive
    console.log('🚀 Agent is now running. Press Ctrl+C to stop.\n');
    console.log('═'.repeat(50));
}

// Run
main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
