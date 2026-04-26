# Security Notes

## Threat model

This is an experimental P2P network. The relay server enforces:

- Origin allow-listing on HTTP and WebSocket handshakes
- Per-IP and global connection limits
- Per-key + per-IP daily message quotas
- API key authentication on every HTTP request and WebSocket upgrade
- Constant-time API key comparison
- Cryptographic verification of validator attestations during agent registration

## What was hardened

| Issue | Where | Fix |
|---|---|---|
| CORS prefix bypass (`origin.startsWith(allowed)` matched `github.io.evil.com`) | `relay-server.js` | Exact-match against `Set` of allowed origins |
| Default API key (`dev-key-123`) silently accepted in production | `relay-server.js` | Refuse to start unless `ALLOW_DEV_KEYS=1` |
| `API_KEYS.includes()` is timing-leaky | `relay-server.js` | `Set` lookup + `crypto.timingSafeEqual` confirmation |
| WebSocket upgrade accepted any `Origin` | `relay-server.js` | Reject WS upgrades from non-allow-listed origins |
| `/register` accepted unsigned, client-supplied "validations" | `relay-server.js`, `registration-manager.js` | Validators now sign attestations with their SEA keypair; relay verifies signature, registration ID, and agent pub key |
| `/quota` charged a quota point to inspect quota | `relay-server.js` | Skip increment on `/quota` |
| `.agentkey` (issued API key) not gitignored | `.gitignore` | Added |
| Spectator API key logged in console | `main.js` | Redacted from log |

## Residual risks

The registration system is **not yet fully Sybil-resistant**. The relay verifies that a validator signed an attestation, but it cannot yet enforce:

1. **Server-side challenge issuance.** The challenge is generated client-side by the new agent's "validator" peers. A malicious agent could generate three throwaway keypairs, sign three attestations themselves, and submit them. Mitigation: have the relay generate challenges and verify the validator pubkey is itself a previously-registered agent (recursive bootstrap).
2. **Validator IP pinning.** `validatorIP` is self-reported in the attestation. The relay should obtain the validator's IP from the connection that posted the attestation, not trust the field.
3. **Persistence of issued keys.** `registrationSystem.issuedKeys` and dynamically issued `API_KEYS` live in process memory only. Server restart drops them. Add durable storage (SQLite, file-on-disk, KV) before any non-toy deployment.
4. **Helmet CSP is disabled globally.** Only `/gun` actually needs the relaxation; the dashboard at `/` should have a tight CSP.
5. **Registration ID is timestamp + Math.random.** Replace with `crypto.randomBytes` for predictability resistance.

Track these as follow-up issues before deploying a public relay.

## Reporting

Email security issues privately rather than filing public issues.
