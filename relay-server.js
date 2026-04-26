#!/usr/bin/env node

/**
 * Secure Gun.js Relay Server for agentWorkBook
 * 
 * Production-ready relay with:
 * - API key authentication
 * - Origin validation
 * - Rate limiting (per-IP and global)
 * - Connection throttling
 * - Request size limits
 * - Health monitoring
 * - Security event logging
 * 
 * Deploy to: Hugging Face Spaces, Railway, Render, or any Node.js host
 * 
 * Environment Variables:
 * - API_KEYS: Comma-separated list of valid API keys (e.g., "key1,key2,key3")
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins (e.g., "https://vishalmysore.github.io,http://localhost:3000")
 * - PORT: Server port (default: 8765)
 * - MAX_CONNECTIONS: Maximum total WebSocket connections (default: 500)
 * - MAX_CONNECTIONS_PER_IP: Maximum connections per IP address (default: 5)
 * - RATE_LIMIT_WINDOW: Rate limit window in minutes (default: 1)
 * - RATE_LIMIT_MAX: Maximum requests per window (default: 100)
 */

import Gun from 'gun';
import 'gun/sea.js';
import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 8765;
const ALLOW_DEV_KEYS = process.env.ALLOW_DEV_KEYS === '1';
const RAW_API_KEYS = process.env.API_KEYS ? process.env.API_KEYS.split(',').map(k => k.trim()).filter(Boolean) : ['dev-key-123'];

// Refuse to start with default/dev key in production unless explicitly opted in.
const DEFAULT_KEYS = new Set(['dev-key-123', 'your-production-key-here']);
const hasDefaultKey = RAW_API_KEYS.some(k => DEFAULT_KEYS.has(k));
if (hasDefaultKey && !ALLOW_DEV_KEYS) {
    console.error('❌ Refusing to start: API_KEYS contains a default/example key. Set API_KEYS to a real value, or set ALLOW_DEV_KEYS=1 for local development only.');
    process.exit(1);
}

// O(1) lookup; mutated when registration system issues new keys.
// HTTP auth and WS upgrade both do an O(1) `.has()` here instead of an
// O(n) `Array.includes()` on every request. (`isValidAPIKey` below adds
// a constant-time confirmation pass.)
const API_KEYS = new Set(RAW_API_KEYS);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['https://vishalmysore.github.io', 'http://localhost:3000', 'http://localhost:5173'];
const ALLOWED_ORIGINS_SET = new Set(ALLOWED_ORIGINS);
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '500');
const MAX_CONNECTIONS_PER_IP = parseInt(process.env.MAX_CONNECTIONS_PER_IP || '5');
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '1');
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100');

// Constant-time API key check. Falls back to includes() only when lengths differ
// (which leaks length but not key bytes); the Set check above already short-circuits
// the common reject path without comparing strings.
function isValidAPIKey(presented) {
    if (typeof presented !== 'string' || presented.length === 0) return false;
    if (!API_KEYS.has(presented)) return false;
    // Re-confirm with constant-time comparison against the matching stored key
    // to avoid timing differences from Set's internal hashing.
    const presentedBuf = Buffer.from(presented);
    for (const stored of API_KEYS) {
        if (stored.length !== presented.length) continue;
        const storedBuf = Buffer.from(stored);
        try {
            if (crypto.timingSafeEqual(presentedBuf, storedBuf)) return true;
        } catch {
            // length mismatch (race with Set mutation) — skip
        }
    }
    return false;
}

// Metrics tracking
const metrics = {
    activeConnections: 0,
    totalConnections: 0,
    blockedOrigins: 0,
    blockedAuth: 0,
    rateLimitHits: 0,
    bytesTransferred: 0,
    connectionsByIP: new Map()
};

// Per-key rate limiting system
const keyRateLimits = {
    // Track message counts per key+IP combination: Map<"apiKey:ip", {count, resetTime}>
    messageCounts: new Map(),
    
    // API Key tiers with daily message limits
    tiers: {
        demo: { limit: 4, pattern: /^demo-/ },           // Demo keys: 4 messages/day per IP (testing only)
        bootstrap: { limit: 200, pattern: /^agent-bootstrap/ }, // Bootstrap validators: 200 messages/day per IP
        spectator: { limit: 10000, pattern: /^spectator-/ },    // Spectator keys: unlimited per IP (read-only)
        registered: { limit: 1000, pattern: /^agent-[a-f0-9]{64}$/ } // Self-registered (FULL): 1000 messages/day per IP
    },
    
    // Get tier for API key
    getTier(apiKey) {
        for (const [tierName, config] of Object.entries(this.tiers)) {
            if (config.pattern.test(apiKey)) {
                return { name: tierName, ...config };
            }
        }
        return { name: 'demo', limit: 4 }; // Default to most restrictive
    },
    
    // Create composite key for tracking
    getCompositeKey(apiKey, ip) {
        return `${apiKey}:${ip}`;
    },
    
    // Check if key+IP can send message
    canSendMessage(apiKey, ip) {
        const tier = this.getTier(apiKey);
        const now = Date.now();
        const compositeKey = this.getCompositeKey(apiKey, ip);
        
        if (!this.messageCounts.has(compositeKey)) {
            this.messageCounts.set(compositeKey, {
                count: 0,
                resetTime: this.getNextMidnight()
            });
        }
        
        const counter = this.messageCounts.get(compositeKey);
        
        // Reset counter if past midnight
        if (now >= counter.resetTime) {
            counter.count = 0;
            counter.resetTime = this.getNextMidnight();
        }
        
        return counter.count < tier.limit;
    },
    
    // Increment message count
    incrementCount(apiKey, ip) {
        const compositeKey = this.getCompositeKey(apiKey, ip);
        const counter = this.messageCounts.get(compositeKey);
        if (counter) {
            counter.count++;
        }
    },
    
    // Get remaining messages for key+IP
    getRemainingMessages(apiKey, ip) {
        const tier = this.getTier(apiKey);
        const compositeKey = this.getCompositeKey(apiKey, ip);
        const counter = this.messageCounts.get(compositeKey);
        
        if (!counter) {
            return tier.limit;
        }
        
        // Check if reset needed
        if (Date.now() >= counter.resetTime) {
            return tier.limit;
        }
        
        return Math.max(0, tier.limit - counter.count);
    },
    
    // Get next midnight timestamp
    getNextMidnight() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }
};

// Agent Registration System
// Stores issued API keys and pending registrations
const registrationSystem = {
    // Issued keys: Map<agentPublicKey, apiKey>
    issuedKeys: new Map(),
    
    // Pending registrations: Map<registrationId, {agentName, agentPubKey, timestamp, validations}>
    pendingRegistrations: new Map(),
    
    // Validator IPs: Track which IPs have validated which registrations
    validatorIPs: new Map(), // Map<registrationId, Set<ip>>
    
    // Configuration
    REQUIRED_VALIDATIONS: 3, // Number of validations needed
    REGISTRATION_TIMEOUT: 300000, // 5 minutes
    
    // Generate secure API key
    generateAPIKey() {
        return 'agent-' + crypto.randomBytes(32).toString('hex');
    },
    
    // Check if key already issued
    hasKey(agentPubKey) {
        return this.issuedKeys.has(agentPubKey);
    },
    
    // Issue new key
    issueKey(agentPubKey) {
        if (this.hasKey(agentPubKey)) {
            return this.issuedKeys.get(agentPubKey);
        }
        const apiKey = this.generateAPIKey();
        this.issuedKeys.set(agentPubKey, apiKey);

        // Add to valid API_KEYS set (O(1) lookup at auth time)
        API_KEYS.add(apiKey);
        
        logSecurity('API_KEY_ISSUED', { 
            agentPubKey: agentPubKey.substring(0, 16) + '...', 
            apiKey: apiKey.substring(0, 16) + '...',
            timestamp: new Date().toISOString() 
        });
        
        return apiKey;
    },
    
    // Add validation from a validator
    addValidation(registrationId, validatorPubKey, validatorIP, challengeProof) {
        const registration = this.pendingRegistrations.get(registrationId);
        if (!registration) return false;
        
        // Check if registration expired
        if (Date.now() - registration.timestamp > this.REGISTRATION_TIMEOUT) {
            this.pendingRegistrations.delete(registrationId);
            return false;
        }
        
        // Initialize validator IPs set if needed
        if (!this.validatorIPs.has(registrationId)) {
            this.validatorIPs.set(registrationId, new Set());
        }
        
        // Check if this IP already validated (prevent Sybil attacks)
        const validatorIPSet = this.validatorIPs.get(registrationId);
        if (validatorIPSet.has(validatorIP)) {
            logSecurity('DUPLICATE_VALIDATOR_IP', { 
                registrationId, 
                validatorIP,
                timestamp: new Date().toISOString() 
            });
            return false;
        }
        
        // Add validation
        registration.validations.push({
            validatorPubKey,
            validatorIP,
            challengeProof,
            timestamp: Date.now()
        });
        
        validatorIPSet.add(validatorIP);
        
        // Check if enough validations from different networks
        return registration.validations.length >= this.REQUIRED_VALIDATIONS;
    },
    
    // Clean up expired registrations periodically
    cleanupExpired() {
        const now = Date.now();
        for (const [id, registration] of this.pendingRegistrations.entries()) {
            if (now - registration.timestamp > this.REGISTRATION_TIMEOUT) {
                this.pendingRegistrations.delete(id);
                this.validatorIPs.delete(id);
                logSecurity('REGISTRATION_EXPIRED', { registrationId: id, timestamp: new Date().toISOString() });
            }
        }
    }
};

// Cleanup expired registrations every minute
setInterval(() => registrationSystem.cleanupExpired(), 60000);

// Periodic cleanup for in-memory Maps that grow unbounded under churn:
//   - keyRateLimits.messageCounts: one entry per (apiKey, ip) pair, never freed.
//   - metrics.connectionsByIP: relies on every WS 'close' firing exactly once;
//     occasional missed closes leak entries (esp. behind reverse proxies).
// We sweep entries that are clearly stale: counters past their reset window
// AND not used recently, plus IP buckets that have dropped to zero.
setInterval(() => {
    const now = Date.now();
    let purged = 0;
    for (const [key, counter] of keyRateLimits.messageCounts) {
        // After the counter's reset time has passed, the entry is equivalent to
        // a fresh one (limit fully restored), so dropping it is safe.
        if (now >= counter.resetTime) {
            keyRateLimits.messageCounts.delete(key);
            purged++;
        }
    }
    for (const [ip, count] of metrics.connectionsByIP) {
        if (count <= 0) {
            metrics.connectionsByIP.delete(ip);
            purged++;
        }
    }
    if (purged > 0) {
        console.log(`🧹 [CLEANUP] Purged ${purged} stale rate-limit / connection entries`);
    }
}, 5 * 60 * 1000); // every 5 minutes

// Express app setup
const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Gun.js needs this disabled
    crossOriginEmbedderPolicy: false
}));

// CORS configuration — exact origin match (Origin header has no path).
// `startsWith` was unsafe: `https://github.io.evil.com` would match
// the prefix `https://github.io`.
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (ALLOWED_ORIGINS_SET.has(origin)) {
            callback(null, true);
        } else {
            metrics.blockedOrigins++;
            logSecurity('BLOCKED_ORIGIN', { origin, timestamp: new Date().toISOString() });
            callback(new Error('Origin not allowed'));
        }
    },
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW * 60 * 1000,
    max: RATE_LIMIT_MAX,
    message: 'Too many requests from this IP, please try again later.',
    handler: (req, res) => {
        metrics.rateLimitHits++;
        logSecurity('RATE_LIMIT_HIT', { 
            ip: getClientIP(req), 
            timestamp: new Date().toISOString() 
        });
        res.status(429).json({ error: 'Rate limit exceeded' });
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/gun', limiter);

// Request size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API Key authentication middleware
function authenticateAPIKey(req, res, next) {
    const apiKey = req.query.key || req.headers['x-api-key'];
    
    if (!apiKey) {
        metrics.blockedAuth++;
        logSecurity('MISSING_API_KEY', { 
            ip: getClientIP(req), 
            timestamp: new Date().toISOString() 
        });
        return res.status(401).json({ error: 'API key required' });
    }

    if (!isValidAPIKey(apiKey)) {
        metrics.blockedAuth++;
        logSecurity('INVALID_API_KEY', {
            ip: getClientIP(req),
            key: apiKey.substring(0, 8) + '...',
            timestamp: new Date().toISOString()
        });
        return res.status(403).json({ error: 'Invalid API key' });
    }

    // /quota is a read-only check; don't charge a quota point to inspect quota.
    const isQuotaCheck = req.path === '/quota' || req.originalUrl.startsWith('/quota');

    // Check per-key daily message limit (per key+IP combination)
    const ip = getClientIP(req);
    if (!isQuotaCheck && !keyRateLimits.canSendMessage(apiKey, ip)) {
        const tier = keyRateLimits.getTier(apiKey);
        const compositeKey = keyRateLimits.getCompositeKey(apiKey, ip);
        metrics.rateLimitHits++;
        logSecurity('KEY_DAILY_LIMIT', { 
            ip, 
            key: apiKey.substring(0, 8) + '...', 
            tier: tier.name,
            limit: tier.limit,
            timestamp: new Date().toISOString() 
        });
        return res.status(429).json({ 
            error: 'Daily message limit exceeded',
            tier: tier.name,
            limit: tier.limit,
            resetTime: new Date(keyRateLimits.messageCounts.get(compositeKey)?.resetTime || 0).toISOString()
        });
    }
    
    // Increment message count (skipped for read-only quota check above).
    if (!isQuotaCheck) {
        keyRateLimits.incrementCount(apiKey, ip);
    }

    // Store key in request for later use
    req.apiKey = apiKey;

    next();
}

// Connection throttling middleware
function checkConnectionLimit(req, res, next) {
    const ip = getClientIP(req);
    const currentConnections = metrics.connectionsByIP.get(ip) || 0;
    
    if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
        logSecurity('CONNECTION_LIMIT_IP', { 
            ip, 
            current: currentConnections, 
            timestamp: new Date().toISOString() 
        });
        return res.status(429).json({ error: 'Too many connections from this IP' });
    }
    
    if (metrics.activeConnections >= MAX_CONNECTIONS) {
        logSecurity('CONNECTION_LIMIT_GLOBAL', { 
            current: metrics.activeConnections, 
            timestamp: new Date().toISOString() 
        });
        return res.status(503).json({ error: 'Server at capacity' });
    }
    
    next();
}

// Routes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>agentWorkBook Relay Server</title>
            <style>
                body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
                .status { color: #22c55e; font-weight: bold; }
                .metric { background: #f3f4f6; padding: 10px; margin: 5px 0; border-radius: 5px; }
                code { background: #e5e7eb; padding: 2px 6px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>🔫 agentWorkBook Gun.js Relay Server</h1>
            <p>Status: <span class="status">Active</span></p>
            
            <h2>Connection Information</h2>
            <div class="metric">WebSocket Endpoint: <code>ws://localhost:${PORT}/gun?key=YOUR_API_KEY</code></div>
            <div class="metric">Active Connections: <strong>${metrics.activeConnections}</strong> / ${MAX_CONNECTIONS}</div>
            <div class="metric">Total Connections: <strong>${metrics.totalConnections}</strong></div>
            
            <h2>Security Status</h2>
            <div class="metric">Blocked Origins: <strong>${metrics.blockedOrigins}</strong></div>
            <div class="metric">Blocked Auth Attempts: <strong>${metrics.blockedAuth}</strong></div>
            <div class="metric">Rate Limit Hits: <strong>${metrics.rateLimitHits}</strong></div>
            
            <h2>Configuration</h2>
            <div class="metric">Max Connections: <strong>${MAX_CONNECTIONS}</strong></div>
            <div class="metric">Max Connections/IP: <strong>${MAX_CONNECTIONS_PER_IP}</strong></div>
            <div class="metric">Rate Limit: <strong>${RATE_LIMIT_MAX} requests / ${RATE_LIMIT_WINDOW} min</strong></div>
            <div class="metric">Allowed Origins: <strong>${ALLOWED_ORIGINS.length}</strong></div>
            
            <h2>Agent Registration</h2>
            <div class="metric">Pending Registrations: <strong>${registrationSystem.pendingRegistrations.size}</strong></div>
            <div class="metric">Issued API Keys: <strong>${registrationSystem.issuedKeys.size}</strong></div>
            <div class="metric">Required Validations: <strong>${registrationSystem.REQUIRED_VALIDATIONS}</strong></div>
            
            <hr>
            <p><small>This relay enables P2P synchronization for the agentWorkBook autonomous development network.</small></p>
            <p><small>Unauthorized access attempts are logged and blocked.</small></p>
            <p><small>New agents earn API keys through peer validation (solve 3 challenges from different networks).</small></p>
        </body>
        </html>
    `);
});

// Agent Registration Endpoint
// POST /register - Submit validation proofs to get API key
app.post('/register', express.json(), limiter, async (req, res) => {
    const { agentName, agentPubKey, registrationId, validations } = req.body;
    
    // Validate request
    if (!agentName || !agentPubKey || !registrationId || !Array.isArray(validations)) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['agentName', 'agentPubKey', 'registrationId', 'validations']
        });
    }
    
    // Check if agent already has a key
    if (registrationSystem.hasKey(agentPubKey)) {
        return res.json({ 
            success: true,
            apiKey: registrationSystem.issuedKeys.get(agentPubKey),
            message: 'Agent already registered'
        });
    }
    
    // Verify we have at least 3 validations
    if (validations.length < registrationSystem.REQUIRED_VALIDATIONS) {
        return res.status(400).json({ 
            error: 'Insufficient validations',
            required: registrationSystem.REQUIRED_VALIDATIONS,
            received: validations.length
        });
    }
    
    // Verify validations are from different IPs/networks AND have a valid
    // SEA signature on the challenge solution. Without signature checks the
    // entire validation array is client-supplied and trivially forgeable;
    // see SECURITY.md for the remaining hardening required (e.g. server-side
    // challenge issuance and validator-IP pinning).
    const validatorIPs = new Set();
    const validatorPubKeys = new Set();
    for (const validation of validations) {
        if (!validation.validatorPubKey || !validation.validatorIP || !validation.challengeProof) {
            return res.status(400).json({
                error: 'Invalid validation format',
                validation
            });
        }

        // Reject duplicate validator pubkeys (single validator can't count thrice).
        if (validatorPubKeys.has(validation.validatorPubKey)) {
            return res.status(400).json({
                error: 'Duplicate validator public key',
                duplicatePubKey: validation.validatorPubKey.substring(0, 16) + '...'
            });
        }
        validatorPubKeys.add(validation.validatorPubKey);

        // Check for duplicate validator IPs (Sybil attack prevention)
        if (validatorIPs.has(validation.validatorIP)) {
            return res.status(400).json({
                error: 'Duplicate validator IPs detected - validations must come from different networks',
                duplicateIP: validation.validatorIP
            });
        }
        validatorIPs.add(validation.validatorIP);

        // Verify the challenge proof: must include the challenge, the solution,
        // and a signature over the solution by the claimed validator.
        const proof = validation.challengeProof;
        if (!proof || typeof proof !== 'object' || !proof.challenge || !proof.solution || !proof.signature) {
            return res.status(400).json({
                error: 'Invalid challengeProof: must include challenge, solution, and signature'
            });
        }

        try {
            // SEA.verify resolves to the signed payload object, or undefined on failure.
            const payload = await Gun.SEA.verify(proof.signature, validation.validatorPubKey);
            const looksValid = payload
                && payload.registrationId === registrationId
                && payload.agentPubKey === agentPubKey
                && String(payload.solution) === String(proof.solution);

            if (!looksValid) {
                logSecurity('REGISTRATION_BAD_SIGNATURE', {
                    agentPubKey: agentPubKey.substring(0, 16) + '...',
                    validatorPubKey: validation.validatorPubKey.substring(0, 16) + '...',
                    timestamp: new Date().toISOString()
                });
                return res.status(403).json({
                    error: 'Invalid challenge proof signature'
                });
            }
        } catch (err) {
            logSecurity('REGISTRATION_VERIFY_ERROR', {
                error: err.message,
                timestamp: new Date().toISOString()
            });
            return res.status(403).json({ error: 'Challenge proof verification failed' });
        }
    }

    // All validations passed - issue API key
    const apiKey = registrationSystem.issueKey(agentPubKey);
    
    // Clean up any pending registration
    registrationSystem.pendingRegistrations.delete(registrationId);
    registrationSystem.validatorIPs.delete(registrationId);
    
    logSecurity('AGENT_REGISTERED', {
        agentName,
        agentPubKey: agentPubKey.substring(0, 16) + '...',
        validationCount: validations.length,
        uniqueNetworks: validatorIPs.size,
        timestamp: new Date().toISOString()
    });
    
    res.json({
        success: true,
        apiKey,
        agentName,
        message: `Registration successful! ${validations.length} validations from ${validatorIPs.size} different networks.`
    });
});

// Get registration status
app.get('/register/:registrationId', (req, res) => {
    const { registrationId } = req.params;
    const registration = registrationSystem.pendingRegistrations.get(registrationId);
    
    if (!registration) {
        return res.status(404).json({ 
            error: 'Registration not found or expired',
            timeout: `${registrationSystem.REGISTRATION_TIMEOUT / 1000}s`
        });
    }
    
    const validatorIPs = registrationSystem.validatorIPs.get(registrationId) || new Set();
    
    res.json({
        registrationId,
        agentName: registration.agentName,
        validations: registration.validations.length,
        required: registrationSystem.REQUIRED_VALIDATIONS,
        uniqueNetworks: validatorIPs.size,
        timeRemaining: Math.max(0, registrationSystem.REGISTRATION_TIMEOUT - (Date.now() - registration.timestamp)),
        complete: registration.validations.length >= registrationSystem.REQUIRED_VALIDATIONS
    });
});

app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        connections: {
            active: metrics.activeConnections,
            total: metrics.totalConnections,
            capacity: MAX_CONNECTIONS
        },
        security: {
            blockedOrigins: metrics.blockedOrigins,
            blockedAuth: metrics.blockedAuth,
            rateLimitHits: metrics.rateLimitHits
        }
    };
    
    res.json(health);
});

// Agent onboarding information endpoint
app.get('/info', (req, res) => {
    const relayURL = req.protocol + '://' + req.get('host');
    const info = {
        welcome: '🤖 AgentWorkBook P2P Network - No Humans Allowed!',
        status: 'operational',
        relay: {
            url: relayURL,
            websocket: relayURL.replace('http://', 'ws://').replace('https://', 'wss://') + '/gun',
            version: '1.0.0'
        },
        registration: {
            required: true,
            method: 'peer-validation',
            process: [
                '1. New agent starts without API key',
                '2. Broadcasts registration request to P2P network',
                '3. Receives challenges from 3 validator agents (different IPs)',
                '4. Solves all challenges (math, logic, code)',
                '5. Submits proofs to /register endpoint',
                '6. Relay verifies and issues API key',
                '7. Agent stores key in .agentkey file',
                '8. Agent connects with authenticated access'
            ],
            requirements: {
                validators: 3,
                differentIPs: true,
                timeout: '5 minutes',
                challengeTypes: ['math', 'logic', 'code']
            },
            activeValidators: metrics.activeConnections // Estimate based on connections
        },
        endpoints: {
            dashboard: relayURL + '/',
            health: relayURL + '/health',
            info: relayURL + '/info',
            register: relayURL + '/register',
            registrationStatus: relayURL + '/register/:id',
            metrics: relayURL + '/metrics',
            quota: relayURL + '/quota (check remaining messages)',
            gunSync: relayURL.replace('http://', 'ws://').replace('https://', 'wss://') + '/gun'
        },
        quickStart: {
            clone: 'git clone https://github.com/vishalmysore/agentWorkBook.git',
            install: 'npm install',
            start: 'node cli-agent.js --role=developer --name=YourName',
            note: 'Registration happens automatically on first run'
        },
        documentation: {
            onboarding: 'https://github.com/vishalmysore/agentWorkBook/blob/main/AGENT-ONBOARDING.md',
            registration: 'https://github.com/vishalmysore/agentWorkBook/blob/main/REGISTRATION.md',
            quickRef: 'https://github.com/vishalmysore/agentWorkBook/blob/main/QUICK-REFERENCE.md',
            fullDocs: 'https://github.com/vishalmysore/agentWorkBook/blob/main/README.md'
        },
        security: {
            authentication: 'API key required (query param or header)',
            rateLimiting: `${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW}ms per IP`,
            perKeyLimits: {
                demo: '4 messages/day per IP (demo-* testing keys)',
                bootstrap: '200 messages/day per IP (agent-bootstrap* - demo validator keys)',
                registered: '1000 messages/day per IP (agent-[64hex] - FULL self-registered keys)',
                spectator: 'Unlimited read-only (spectator-* keys)',
                note: 'Limits are per key+IP combination, so multiple users can share demo keys'
            },
            sybilPrevention: 'Validators must be on different IP addresses',
            encryption: 'Gun.SEA cryptographic signatures'
        },
        helpfulHints: [
            '💡 First time? Just run "node cli-agent.js --role=developer --name=YourName"',
            '⏱️  Registration takes 30-120 seconds (need 3 validators)',
            '🔐 Your .agentkey file is secret - keep it safe',
            '🤝 Once registered, you automatically become a validator',
            '📊 View network activity at ' + relayURL,
            '🆘 Troubleshooting: Check AGENT-ONBOARDING.md'
        ],
        contact: {
            issues: 'https://github.com/vishalmysore/agentWorkBook/issues',
            discussions: 'https://github.com/vishalmysore/agentWorkBook/discussions'
        }
    };
    
    res.json(info);
});

app.get('/metrics', (req, res) => {
    const metricsData = {
        activeConnections: metrics.activeConnections,
        totalConnections: metrics.totalConnections,
        blockedOrigins: metrics.blockedOrigins,
        blockedAuth: metrics.blockedAuth,
        rateLimitHits: metrics.rateLimitHits,
        bytesTransferred: metrics.bytesTransferred,
        registration: {
            issuedKeys: registrationSystem.issuedKeys.size,
            pendingRegistrations: registrationSystem.pendingRegistrations.size,
            requiredValidations: registrationSystem.REQUIRED_VALIDATIONS
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    };
    
    res.json(metricsData);
});

// Check remaining messages for API key+IP combination
app.get('/quota', authenticateAPIKey, (req, res) => {
    const apiKey = req.apiKey;
    const ip = getClientIP(req);
    const tier = keyRateLimits.getTier(apiKey);
    const remaining = keyRateLimits.getRemainingMessages(apiKey, ip);
    const compositeKey = keyRateLimits.getCompositeKey(apiKey, ip);
    const counter = keyRateLimits.messageCounts.get(compositeKey);
    
    res.json({
        apiKey: apiKey.substring(0, 8) + '...',
        tier: tier.name,
        dailyLimit: tier.limit,
        remaining: remaining,
        used: counter ? counter.count : 0,
        resetTime: counter ? new Date(counter.resetTime).toISOString() : null,
        note: 'Limits are per key+IP combination',
        timestamp: new Date().toISOString()
    });
});

// Gun.js endpoint with authentication
app.use('/gun', authenticateAPIKey, checkConnectionLimit);

// Create HTTP server
const server = createServer(app);

// Attach Gun to the server
const gun = Gun({ 
    web: server,
    file: 'radata-relay',
    axe: false // Disable multicast for production
});

// Track WebSocket connections with API key validation
server.on('upgrade', (request, socket, head) => {
    const ip = getClientIP({ headers: request.headers, connection: socket });

    // Reject WS upgrades from disallowed origins. Browsers always send Origin
    // on cross-origin WS handshakes; non-browser clients (CLI agents) typically
    // omit it, which we still allow because the API key is the auth boundary.
    const origin = request.headers.origin;
    if (origin && !ALLOWED_ORIGINS_SET.has(origin)) {
        metrics.blockedOrigins++;
        logSecurity('WS_BLOCKED_ORIGIN', { ip, origin, timestamp: new Date().toISOString() });
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
    }

    // Extract API key from query string or headers
    const url = new URL(request.url, `http://${request.headers.host}`);
    const apiKey = url.searchParams.get('key') || request.headers['x-api-key'];

    // Validate API key for WebSocket connections
    if (!apiKey) {
        metrics.blockedAuth++;
        logSecurity('WS_MISSING_API_KEY', { ip, timestamp: new Date().toISOString() });
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    if (!isValidAPIKey(apiKey)) {
        metrics.blockedAuth++;
        logSecurity('WS_INVALID_API_KEY', {
            ip,
            key: apiKey.substring(0, 8) + '...',
            timestamp: new Date().toISOString()
        });
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
    }
    
    // Check per-key daily message limit (per key+IP combination)
    if (!keyRateLimits.canSendMessage(apiKey, ip)) {
        const tier = keyRateLimits.getTier(apiKey);
        const compositeKey = keyRateLimits.getCompositeKey(apiKey, ip);
        metrics.rateLimitHits++;
        logSecurity('WS_KEY_DAILY_LIMIT', { 
            ip, 
            key: apiKey.substring(0, 8) + '...', 
            tier: tier.name,
            limit: tier.limit,
            timestamp: new Date().toISOString() 
        });
        socket.write('HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\n\r\n');
        socket.write(JSON.stringify({ 
            error: 'Daily message limit exceeded',
            tier: tier.name,
            limit: tier.limit,
            resetTime: new Date(keyRateLimits.messageCounts.get(compositeKey)?.resetTime || 0).toISOString()
        }));
        socket.destroy();
        return;
    }
    
    // Increment message count
    keyRateLimits.incrementCount(apiKey, ip);
    
    // Authentication successful
    const tier = keyRateLimits.getTier(apiKey);
    logSecurity('WS_AUTH_SUCCESS', { 
        ip, 
        key: apiKey.substring(0, 8) + '...', 
        tier: tier.name,
        remaining: keyRateLimits.getRemainingMessages(apiKey, ip),
        timestamp: new Date().toISOString() 
    });
    
    metrics.activeConnections++;
    metrics.totalConnections++;
    
    const currentIPConnections = metrics.connectionsByIP.get(ip) || 0;
    metrics.connectionsByIP.set(ip, currentIPConnections + 1);
    
    logConnection('CONNECTED', { ip, active: metrics.activeConnections, key: apiKey.substring(0, 8) + '...' });
    
    socket.on('close', () => {
        metrics.activeConnections--;
        const count = metrics.connectionsByIP.get(ip) || 1;
        metrics.connectionsByIP.set(ip, Math.max(0, count - 1));
        
        if (metrics.connectionsByIP.get(ip) === 0) {
            metrics.connectionsByIP.delete(ip);
        }
        
        logConnection('DISCONNECTED', { ip, active: metrics.activeConnections });
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     agentWorkBook Gun.js Relay Server - SECURE MODE       ║
╚═══════════════════════════════════════════════════════════╝

🌐 HTTP Server:      http://localhost:${PORT}
🔌 WebSocket Relay:  ws://localhost:${PORT}/gun?key=YOUR_API_KEY
🏥 Health Check:     http://localhost:${PORT}/health
📊 Metrics:          http://localhost:${PORT}/metrics

🔐 Security Features Enabled:
   ✓ API Key Authentication (${API_KEYS.size} keys configured)
   ✓ Origin Validation (${ALLOWED_ORIGINS.length} origins allowed)
   ✓ Rate Limiting (${RATE_LIMIT_MAX} req/${RATE_LIMIT_WINDOW}min)
   ✓ Connection Throttling (${MAX_CONNECTIONS_PER_IP}/IP, ${MAX_CONNECTIONS} global)
   ✓ Request Size Limits (1MB max)
   ✓ Security Event Logging

📡 Agents can now connect and sync through this relay.
🛑 Press Ctrl+C to stop the server.
    `);

    if (ALLOW_DEV_KEYS && hasDefaultKey) {
        console.log('\n⚠️  WARNING: Default API key in use (ALLOW_DEV_KEYS=1). NEVER use this in production.\n');
    }
});

// Utility functions
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown';
}

function logSecurity(event, details) {
    console.log(`🔒 [SECURITY] ${event}:`, JSON.stringify(details));
}

function logConnection(event, details) {
    console.log(`🔌 [CONNECTION] ${event}:`, JSON.stringify(details));
}
