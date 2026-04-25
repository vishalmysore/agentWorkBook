# Optional: Self-Hosted Gun.js Relay Server

## Why Host Your Own?

The public Gun.js relay servers (`gun-manhattan.herokuapp.com`, etc.) work perfectly fine, but you might want your own for:

- **Complete control** over peer discovery
- **Better uptime guarantees**
- **Custom authentication** or rate limiting
- **Private networks** (corporate environments)

## Quick Setup

### Option 1: Node.js Server (Local/Cloud)

1. **Create a relay server file:**

```bash
# Create new directory
mkdir gun-relay-server
cd gun-relay-server
npm init -y
npm install gun express
```

2. **Create `server.js`:**

```javascript
const Gun = require('gun');
const express = require('express');
const app = express();
const port = process.env.PORT || 8765;

// Enable CORS for your agents
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve Gun
app.use(Gun.serve);

const server = app.listen(port, () => {
    console.log(`🔫 Gun relay server running on port ${port}`);
});

// Initialize Gun
Gun({ web: server });
```

3. **Run it:**

```bash
node server.js
```

### Option 2: Deploy to Cloud

#### Deploy to Railway

1. Push your `server.js` to GitHub
2. Go to [Railway.app](https://railway.app)
3. Connect your repo
4. Railway auto-detects Node.js and deploys
5. Get your URL: `https://your-app.railway.app`

#### Deploy to Render

1. Push to GitHub
2. Go to [Render.com](https://render.com)
3. Create new Web Service
4. Connect repo and deploy
5. Get URL: `https://your-app.onrender.com`

#### Deploy to Fly.io

```bash
# Install flyctl
npm install -g flyctl

# Login
fly auth login

# Deploy
fly launch
fly deploy
```

### Option 3: Use GitHub Actions + Your Own Server

If you have a VPS (DigitalOcean, AWS EC2, etc.):

```yaml
# .github/workflows/deploy-relay.yml
name: Deploy Gun Relay

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/gun-relay
            git pull
            npm install
            pm2 restart gun-relay
```

## Update Your Code

Once you have your own relay server, update both files:

### In `cli-agent.js` and `main.js`:

```javascript
// Before:
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun', 'https://gun-us.herokuapp.com/gun']);

// After (with your server):
const gun = Gun([
    'https://your-relay.railway.app/gun',
    'https://gun-manhattan.herokuapp.com/gun'  // Keep public as fallback
]);
```

## Why Keep Public Relays as Fallback?

Even with your own server, keeping public relays as fallback ensures:
- Better redundancy
- Peer discovery even if your server is down
- More connection paths between agents

## Environment Variable Approach

Better yet, use environment variables:

```javascript
// In both cli-agent.js and main.js
const RELAY_SERVERS = process.env.GUN_RELAYS 
    ? process.env.GUN_RELAYS.split(',')
    : [
        'https://gun-manhattan.herokuapp.com/gun',
        'https://gun-us.herokuapp.com/gun'
      ];

const gun = Gun(RELAY_SERVERS);
```

Then run:
```bash
# Use custom relay
export GUN_RELAYS="https://your-relay.railway.app/gun,https://gun-manhattan.herokuapp.com/gun"
node cli-agent.js --role=developer

# Or use default public relays
node cli-agent.js --role=developer
```

## Security Considerations

If hosting your own relay:

1. **Rate Limiting**: Prevent abuse
2. **Authentication**: Optional peer authentication
3. **Monitoring**: Track peer connections
4. **Backups**: Regular data exports (though peers should have local copies)

## When You DON'T Need Your Own Relay

The public relays are fine if:
- ✅ You're experimenting or prototyping
- ✅ You trust the public Gun.js infrastructure
- ✅ You don't need guaranteed 100% uptime
- ✅ Your data is already encrypted (Gun.SEA signatures)

## When You SHOULD Host Your Own

Consider your own relay if:
- 🏢 Corporate/private network environment
- 🔒 Need complete control over routing
- 📊 Want detailed analytics on peer connections
- ⚡ Need guaranteed low latency to specific regions
- 🎯 Building production apps with SLA requirements

---

**Bottom Line**: The public relays work great for this project. Your own server is **optional** for production control.
