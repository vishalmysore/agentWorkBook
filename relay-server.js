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
import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 8765;
const API_KEYS = process.env.API_KEYS ? process.env.API_KEYS.split(',').map(k => k.trim()) : ['dev-key-123'];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
    : ['https://vishalmysore.github.io', 'http://localhost:3000', 'http://localhost:5173'];
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '500');
const MAX_CONNECTIONS_PER_IP = parseInt(process.env.MAX_CONNECTIONS_PER_IP || '5');
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '1');
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100');

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

// Express app setup
const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Gun.js needs this disabled
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Check if origin is allowed
        const isAllowed = ALLOWED_ORIGINS.some(allowed => {
            return origin.startsWith(allowed);
        });
        
        if (isAllowed) {
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
    
    if (!API_KEYS.includes(apiKey)) {
        metrics.blockedAuth++;
        logSecurity('INVALID_API_KEY', { 
            ip: getClientIP(req), 
            key: apiKey.substring(0, 8) + '...', 
            timestamp: new Date().toISOString() 
        });
        return res.status(403).json({ error: 'Invalid API key' });
    }
    
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
            
            <hr>
            <p><small>This relay enables P2P synchronization for the agentWorkBook autonomous development network.</small></p>
            <p><small>Unauthorized access attempts are logged and blocked.</small></p>
        </body>
        </html>
    `);
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

app.get('/metrics', (req, res) => {
    const metricsData = {
        activeConnections: metrics.activeConnections,
        totalConnections: metrics.totalConnections,
        blockedOrigins: metrics.blockedOrigins,
        blockedAuth: metrics.blockedAuth,
        rateLimitHits: metrics.rateLimitHits,
        bytesTransferred: metrics.bytesTransferred,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    };
    
    res.json(metricsData);
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

// Track WebSocket connections
server.on('upgrade', (request, socket, head) => {
    const ip = getClientIP({ headers: request.headers, connection: socket });
    
    metrics.activeConnections++;
    metrics.totalConnections++;
    
    const currentIPConnections = metrics.connectionsByIP.get(ip) || 0;
    metrics.connectionsByIP.set(ip, currentIPConnections + 1);
    
    logConnection('CONNECTED', { ip, active: metrics.activeConnections });
    
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
   ✓ API Key Authentication (${API_KEYS.length} keys configured)
   ✓ Origin Validation (${ALLOWED_ORIGINS.length} origins allowed)
   ✓ Rate Limiting (${RATE_LIMIT_MAX} req/${RATE_LIMIT_WINDOW}min)
   ✓ Connection Throttling (${MAX_CONNECTIONS_PER_IP}/IP, ${MAX_CONNECTIONS} global)
   ✓ Request Size Limits (1MB max)
   ✓ Security Event Logging

📡 Agents can now connect and sync through this relay.
🛑 Press Ctrl+C to stop the server.
    `);
    
    if (API_KEYS.includes('dev-key-123')) {
        console.log('\n⚠️  WARNING: Using default API key! Set API_KEYS environment variable for production.\n');
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
