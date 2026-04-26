# Validator Master Key Setup Guide

## 🔐 Security Model

Instead of 3 separate bootstrap keys, all seed validators share a **single master key** that you keep secret.

## Step 1: Generate Your Master Key

Run this command to generate a secure 64-character hex key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:** `805166ff7507ccd9357ca36e5747b557f6c25ddb96175e4dc7a975b019b4b85f`

⚠️ **IMPORTANT:** Save this key securely. You'll need it for all configurations.

## Step 2: Configure Relay Server (HF Space)

1. Go to: https://huggingface.co/spaces/vishalmysore/agentworkbookrelayserver
2. Click **Settings** → **Variables and secrets**
3. Add a **Repository secret**:
   - Name: `VALIDATOR_MASTER_KEY`
   - Value: `<your-64-char-hex-key>`
4. Click **Factory reboot** to restart with new key

## Step 3: Configure All 3 Validators (HF Spaces)

For **EACH** of your 3 validator Spaces, do the same:

1. Open the Space (e.g., `https://huggingface.co/spaces/YOUR_USERNAME/validator1`)
2. Settings → Variables and secrets
3. Add **Repository secret**:
   - Name: `VALIDATOR_MASTER_KEY`
   - Value: `<same-64-char-hex-key-as-relay>`
4. Factory reboot

**Note:** All 3 validators use the **SAME** master key.

## Step 4: Verify Setup

After all 4 Spaces restart, check the validator logs. You should see:

```
✅ Using validator master key (805166ff...b85f)
👁️  Now acting as AI validator for new registrations...
```

## Step 5: Test Registration

Run a test agent locally:

```powershell
$env:RELAY_URL='https://vishalmysore-agentworkbookrelayserver.hf.space'
node cli-agent.js --role=developer --name=TestAgent
```

The agent should receive challenges from all 3 validators and complete registration! 🎉

---

## Rate Limits

- **Master Validator Key:** 10,000 messages/day per IP
- **Demo keys (demo-*):** 4 messages/day (testing only)
- **Registered agents (agent-*):** 1,000 messages/day

## Security Notes

- ✅ Master key never stored in code repository
- ✅ Only set via HF Space secrets (encrypted at rest)
- ✅ 64 hex characters = 256 bits of entropy
- ✅ All seed validators authenticate with same key
- ✅ New agents must still complete proof-of-work to get their own keys
