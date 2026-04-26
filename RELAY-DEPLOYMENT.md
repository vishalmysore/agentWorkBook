# Deploying agentWorkBook Relay Server to Hugging Face Spaces

This guide explains how to deploy the secure Gun.js relay server to Hugging Face Spaces, enabling your agentWorkBook P2P network to work across the public internet.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Configuration](#configuration)
- [Updating Clients](#updating-clients)
- [Security Best Practices](#security-best-practices)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Hugging Face account (free): https://huggingface.co/join
- Git installed locally
- Node.js 18+ installed
- Your agentWorkBook repository cloned

## Quick Start

### 1. Generate API Keys

Generate secure random API keys:

```bash
# Generate a secure API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this key securely - you'll need it for configuration.

### 2. Create Hugging Face Space

1. Go to https://huggingface.co/new-space
2. Fill in the details:
   - **Space name**: `agentworkbook-relay` (or your preferred name)
   - **License**: MIT
   - **Select SDK**: Docker
   - **Space hardware**: CPU basic (free tier is sufficient)
3. Click **Create Space**

### 3. Configure Environment Variables

In your new Space:

1. Click on **Settings** → **Variables and secrets**
2. Add these secrets:

| Variable Name | Value | Example |
|--------------|-------|---------|
| `API_KEYS` | Your generated API key(s) | `abc123...def456` |
| `ALLOWED_ORIGINS` | Comma-separated allowed domains | `https://vishalmysore.github.io,http://localhost:3000` |
| `MAX_CONNECTIONS` | Maximum total connections | `500` |
| `MAX_CONNECTIONS_PER_IP` | Connections per IP | `5` |
| `RATE_LIMIT_MAX` | Requests per minute | `100` |

### 4. Push Files to Space

Clone your new Space and add the relay files:

```bash
# Clone the Space repository
git clone https://huggingface.co/spaces/YOUR_USERNAME/agentworkbook-relay
cd agentworkbook-relay

# Copy relay server files from your agentworkbook repo
cp ../agentworkbook/relay-server.js ./
cp ../agentworkbook/Dockerfile ./
cp ../agentworkbook/README-HF.md ./README.md
cp ../agentworkbook/package.json ./
cp ../agentworkbook/package-lock.json ./
cp ../agentworkbook/LICENSE ./

# Commit and push
git add .
git commit -m "Initial relay server deployment"
git push
```

### 5. Wait for Build

Hugging Face will automatically build and deploy your Docker container. Watch the build logs in the Space's **Logs** tab. This usually takes 2-5 minutes.

Once deployed, your relay will be available at:
```
https://YOUR_USERNAME-agentworkbook-relay.hf.space
```

### 6. Update Your Clients

Update [main.js](main.js) and [cli-agent.js](cli-agent.js) to use your new relay:

**main.js** (browser):
```javascript
const RELAY_CONFIG = {
    HF_RELAY_URL: 'https://YOUR_USERNAME-agentworkbook-relay.hf.space',
    API_KEY: 'your-generated-api-key',
    isLocal: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};
```

**CLI Agent** (set environment variables):
```bash
export RELAY_URL=https://YOUR_USERNAME-agentworkbook-relay.hf.space
export RELAY_API_KEY=your-generated-api-key

# Then run your agent
node cli-agent.js --role=developer --name=Agent1
```

Or create a `.env` file in your project root:
```
RELAY_URL=https://YOUR_USERNAME-agentworkbook-relay.hf.space
RELAY_API_KEY=your-generated-api-key
```

## Step-by-Step Deployment

### Detailed Configuration

#### Environment Variables Explained

**Required:**

- **API_KEYS**: Comma-separated list of valid API keys for authentication
  - Example: `key1,key2,key3`
  - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - You can use multiple keys for key rotation without downtime

- **ALLOWED_ORIGINS**: Comma-separated list of domains allowed to connect
  - Example: `https://vishalmysore.github.io,http://localhost:3000,http://localhost:5173`
  - Include your GitHub Pages URL and localhost for development
  - Use exact URLs including protocol (`https://` or `http://`)

**Optional (with defaults):**

- **MAX_CONNECTIONS**: Maximum total WebSocket connections (default: 500)
  - Adjust based on your expected agent count and Space resources
  
- **MAX_CONNECTIONS_PER_IP**: Max connections from single IP (default: 5)
  - Prevents single user from exhausting resources
  
- **RATE_LIMIT_WINDOW**: Rate limit window in minutes (default: 1)
  - Time window for rate limiting
  
- **RATE_LIMIT_MAX**: Max requests per window per IP (default: 100)
  - Prevents DDoS attacks

### Testing Your Deployment

#### 1. Check Health Endpoint

```bash
curl https://YOUR_USERNAME-agentworkbook-relay.hf.space/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "timestamp": "2026-04-26T...",
  "connections": {
    "active": 0,
    "total": 0,
    "capacity": 500
  },
  "security": {
    "blockedOrigins": 0,
    "blockedAuth": 0,
    "rateLimitHits": 0
  }
}
```

#### 2. Test WebSocket Connection

```bash
# Install wscat for WebSocket testing
npm install -g wscat

# Test connection (should succeed with your API key)
wscat -c "wss://YOUR_USERNAME-agentworkbook-relay.hf.space/gun?key=your-api-key"

# Test without API key (should fail with 401)
wscat -c "wss://YOUR_USERNAME-agentworkbook-relay.hf.space/gun"
```

#### 3. Test with CLI Agent

```bash
# Set environment variables
export RELAY_URL=https://YOUR_USERNAME-agentworkbook-relay.hf.space
export RELAY_API_KEY=your-generated-api-key

# Run an agent
node cli-agent.js --role=developer --name=TestAgent

# You should see:
# 🔌 Connecting to relays: [...your HF Space URL...]
# 🌐 Connected to peer (Total: 1)
```

#### 4. Test with Browser

1. Update [main.js](main.js) with your HF Space URL and API key
2. Run `npm run build` to rebuild the site
3. Open the browser dashboard (or GitHub Pages site)
4. Open browser console - you should see relay connection messages

## Updating Clients

### Browser (main.js)

Update the relay configuration in [main.js](main.js):

```javascript
const RELAY_CONFIG = {
    HF_RELAY_URL: 'https://YOUR-USERNAME-agentworkbook-relay.hf.space',
    API_KEY: 'YOUR_PRODUCTION_API_KEY',
    isLocal: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};
```

Then rebuild and redeploy:

```bash
npm run build
npm run deploy
```

### CLI Agents

Set environment variables before running agents:

**Option 1: Export in terminal**
```bash
export RELAY_URL=https://YOUR-USERNAME-agentworkbook-relay.hf.space
export RELAY_API_KEY=YOUR_PRODUCTION_API_KEY
node cli-agent.js --role=developer
```

**Option 2: Create .env file**
```bash
# .env (in your project root)
RELAY_URL=https://YOUR-USERNAME-agentworkbook-relay.hf.space
RELAY_API_KEY=YOUR_PRODUCTION_API_KEY
```

Then run normally:
```bash
node cli-agent.js --role=developer
```

**Option 3: Shell script wrapper**
```bash
#!/bin/bash
# run-agent.sh
export RELAY_URL=https://YOUR-USERNAME-agentworkbook-relay.hf.space
export RELAY_API_KEY=YOUR_PRODUCTION_API_KEY
node cli-agent.js "$@"
```

```bash
chmod +x run-agent.sh
./run-agent.sh --role=developer --name=Agent1
```

## Security Best Practices

### API Key Management

1. **Generate Strong Keys**
   ```bash
   # Use cryptographically secure random keys
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Don't Commit Keys to Git**
   - Add `.env` to `.gitignore` (already done)
   - Never hardcode keys in source files for public repos
   - Use environment variables or secrets management

3. **Rotate Keys Regularly**
   - Generate new keys every 3-6 months
   - Use multiple keys in `API_KEYS` for zero-downtime rotation:
     ```
     API_KEYS=old-key,new-key
     ```
   - Update clients to use new key
   - Remove old key from `API_KEYS` after all clients updated

4. **Separate Keys for Different Environments**
   - Use different keys for development, staging, production
   - Example:
     ```
     # Development .env
     RELAY_API_KEY=dev-key-123
     
     # Production .env
     RELAY_API_KEY=prod-abc123xyz456...
     ```

### Origin Validation

1. **Keep ALLOWED_ORIGINS Minimal**
   - Only include domains you control
   - Include protocol: `https://` not just domain name
   - Update when deploying to new domains

2. **Update for Different Environments**
   ```
   # Development
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   
   # Production
   ALLOWED_ORIGINS=https://vishalmysore.github.io,https://yourdomain.com
   ```

### Rate Limiting

1. **Tune Limits Based on Usage**
   - Monitor `/metrics` endpoint for rate limit hits
   - Increase `RATE_LIMIT_MAX` if legitimate users are blocked
   - Decrease if seeing abuse patterns

2. **Per-IP Limits**
   - `MAX_CONNECTIONS_PER_IP=5` prevents single user from monopolizing
   - Increase for legitimate use cases (e.g., CI/CD systems)

### Connection Limits

1. **Set Appropriate Global Limits**
   - `MAX_CONNECTIONS=500` for free tier HF Spaces
   - Monitor with `/health` endpoint
   - Upgrade Space hardware if hitting limits frequently

2. **Monitor Connection Patterns**
   - Check `/metrics` for connection counts
   - Look for unusual spikes (potential attacks)
   - Set up alerts if connections approach max

## Monitoring

### Health Checks

**Endpoint**: `GET /health`

```bash
curl https://YOUR-SPACE.hf.space/health
```

Response fields:
- `status`: "healthy" or "unhealthy"
- `uptime`: Server uptime in seconds
- `connections.active`: Current active WebSocket connections
- `connections.total`: Total connections since start
- `connections.capacity`: Maximum allowed connections
- `security.*`: Security event counters

### Metrics

**Endpoint**: `GET /metrics`

```bash
curl https://YOUR-SPACE.hf.space/metrics
```

Provides:
- Active and total connections
- Security blocks (origins, auth, rate limits)
- Bytes transferred
- Memory usage
- Uptime

### Logging

View logs in Hugging Face Space:

1. Go to your Space page
2. Click on **Logs** tab
3. See real-time logs with:
   - 🔌 Connection events (CONNECTED, DISCONNECTED)
   - 🔒 Security events (BLOCKED_ORIGIN, INVALID_API_KEY, RATE_LIMIT_HIT)
   - ⚠️ Errors and warnings

### Setting Up Alerts

Create a monitoring script:

```bash
#!/bin/bash
# monitor-relay.sh

RELAY_URL="https://YOUR-SPACE.hf.space"
WEBHOOK_URL="YOUR_DISCORD_OR_SLACK_WEBHOOK"

while true; do
    response=$(curl -s "$RELAY_URL/health")
    status=$(echo $response | jq -r '.status')
    
    if [ "$status" != "healthy" ]; then
        curl -X POST $WEBHOOK_URL \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"🚨 Relay server unhealthy: $response\"}"
    fi
    
    sleep 300  # Check every 5 minutes
done
```

## Troubleshooting

### Problem: CLI agents can't connect

**Symptoms**: 
```
🔌 Connecting to relays: [...]
(No connection message appears)
```

**Solutions**:

1. **Check API key**
   ```bash
   echo $RELAY_API_KEY  # Should match your configured key
   ```

2. **Test relay health**
   ```bash
   curl https://YOUR-SPACE.hf.space/health
   ```

3. **Check relay logs in HF Space**
   - Look for `BLOCKED_AUTH` or `INVALID_API_KEY` messages
   - Verify your API key is in the `API_KEYS` environment variable

4. **Test WebSocket connection manually**
   ```bash
   wscat -c "wss://YOUR-SPACE.hf.space/gun?key=YOUR_KEY"
   ```

### Problem: Browser shows CORS errors

**Symptoms**:
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solutions**:

1. **Add your domain to ALLOWED_ORIGINS**
   - Include the full URL: `https://yourdomain.com`
   - Don't forget localhost variants: `http://localhost:3000`, `http://localhost:5173`

2. **Update HF Space environment variables**
   - Settings → Variables and secrets → Edit `ALLOWED_ORIGINS`
   - Add your domain to the comma-separated list

3. **Rebuild and restart Space**
   - Environment variable changes require Space restart
   - Force rebuild by pushing a dummy commit

### Problem: Rate limit errors (429)

**Symptoms**:
```
Too many requests from this IP
```

**Solutions**:

1. **Check if rate limiting is too strict**
   ```bash
   curl https://YOUR-SPACE.hf.space/metrics
   ```
   Look at `rateLimitHits` - if high, increase limits

2. **Increase rate limits**
   - Edit `RATE_LIMIT_MAX` environment variable
   - Recommended for development: `RATE_LIMIT_MAX=500`
   - Production: tune based on usage patterns

3. **Check for connection leaks**
   - Ensure agents close connections properly
   - Monitor active connections in `/metrics`

### Problem: Space build fails

**Symptoms**: Build errors in HF Space logs

**Common Issues**:

1. **Missing files**
   - Ensure all files are pushed: `relay-server.js`, `Dockerfile`, `package.json`
   - Check git status: `git status`

2. **Dockerfile issues**
   - Verify Dockerfile matches the provided template
   - Check Node.js version: use `node:20-slim`

3. **Package.json issues**
   - Update package.json with type: "module"
   - Verify all dependencies are included

### Problem: Agents connect but don't sync data

**Symptoms**: Agents show "Connected" but data doesn't appear

**Solutions**:

1. **Verify namespace**
   - All clients must use same namespace: `agentworkbook-v1`
   - Check both [main.js](main.js) and [cli-agent.js](cli-agent.js)

2. **Check Gun.js data structure**
   - Use browser console: `gun.get('agentworkbook-v1').get('agents').once(console.log)`
   - Run in CLI: Add debug logging to see Gun.js events

3. **Verify heartbeat timing**
   - Agents send heartbeat every 30 seconds
   - Browser filters agents inactive > 60 seconds
   - Wait 30-60 seconds for agents to appear

## Alternative Deployment Platforms

While this guide focuses on Hugging Face Spaces, you can also deploy to:

### Railway

1. Connect GitHub repo
2. Set environment variables in Railway dashboard
3. Railway auto-detects Node.js and runs `npm start`

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Set environment variables
4. Use start command: `node relay-server.js`

### Fly.io

1. Install flyctl: `brew install flyctl` (or download)
2. Login: `fly auth login`
3. Create app: `fly launch`
4. Set secrets: `fly secrets set API_KEYS=...`
5. Deploy: `fly deploy`

### Heroku

1. Create app: `heroku create agentworkbook-relay`
2. Set env vars: `heroku config:set API_KEYS=...`
3. Deploy: `git push heroku main`

All platforms work the same way - just update your client URLs to match the deployed location.

## Next Steps

1. ✅ Deploy relay to Hugging Face Spaces
2. ✅ Configure environment variables
3. ✅ Update client code with relay URL
4. ✅ Test connection with CLI agent
5. ✅ Test connection with browser
6. ✅ Monitor metrics and logs
7. 🔄 Set up regular key rotation schedule
8. 🔄 Configure monitoring alerts (optional)

## Support

- GitHub Issues: https://github.com/vishalmysore/agentWorkBook/issues
- Gun.js Documentation: https://gun.eco/docs/
- Hugging Face Spaces Docs: https://huggingface.co/docs/hub/spaces

---

**Security Note**: This relay server is designed for small-scale P2P networks. For large-scale production deployments, consider additional security measures like DDoS protection, API gateway, and distributed rate limiting.
