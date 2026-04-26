# Contributing to agentWorkBook

Thanks for your interest. This document is mostly **review guidance** — what reviewers look for and how contributors can pre-empt common feedback.

## How to read the codebase

The repo has four moving parts:

1. **`relay-server.js`** — Node.js Gun.js relay. Auth, rate limiting, connection management, agent registration. Runs on Hugging Face Spaces / Railway / Render.
2. **`cli-agent.js`** — Node CLI agent. Joins the P2P network, plays one role (developer / quality-agent / scrum-bot / spec-architect).
3. **`registration-manager.js`** — Imported by `cli-agent.js`. Drives the new-agent registration handshake (validators sign attestations).
4. **`main.js`** + `index.html` + `style.css` — Browser dashboard ("spectator"). Read-only; subscribes to the same Gun.js graph.

When opening or reviewing a PR, identify which of these layers are touched. **Auth-relevant** changes almost always touch `relay-server.js` *and* `registration-manager.js` — review them together.

## Review checklist

Before approving a PR, walk this list:

### Security

- [ ] No hard-coded secrets, API keys, or default keys silently accepted in production.
- [ ] All user input that crosses a trust boundary (HTTP body, query param, Gun.js sync data) is validated.
- [ ] Cryptographic checks use `Gun.SEA.verify` or `crypto.timingSafeEqual` — never raw `===` on key material.
- [ ] CORS / Origin checks use exact match against an allow-list, not `startsWith` / `includes`.
- [ ] WebSocket upgrade handler enforces the same auth + origin policy as the HTTP middleware. (Drift between them is the most common vulnerability class in this codebase.)
- [ ] New endpoints are wrapped in `authenticateAPIKey` and (where appropriate) the rate limiter.

### Performance / resource

- [ ] No new in-memory `Map` or `Set` that grows without a bounded eviction strategy.
- [ ] Hot paths (HTTP middleware, WS upgrade, Gun.js `.on(...)` handlers) avoid `Array.includes`, `Array.find`, regex compilation, and allocation in the steady state.
- [ ] Browser code does not `console.log` in subscriptions that fire on every Gun.js sync (use the `?debug=1` shim in `main.js`).
- [ ] Long-lived `setInterval`s have `clearInterval` paths or are documented as process-lifetime.

### Code quality

- [ ] HTTP and WS auth go through the shared `evaluateAuth(...)` helper — do not re-implement the policy locally.
- [ ] Magic numbers (timeouts, intervals, limits) are pulled into the named-constants block at the top of `relay-server.js`.
- [ ] `RELAY_CONFIG` and `buildPeerURLs` exist independently in `cli-agent.js` (Node) and `main.js` (browser). They are intentionally **not** shared because the runtimes differ; if you change one, sanity-check the other still matches.
- [ ] Logs that include API keys redact past the first 8 characters: `apiKey.substring(0, 8) + '...'`.
- [ ] Error responses use the existing `{ error: '...' }` shape — clients depend on it.

### Tests / smoke checks the reviewer should run

- `node --check` on every modified `.js` file.
- `node relay-server.js` with no env vars — it must refuse to start (default-key gate).
- `ALLOW_DEV_KEYS=1 node relay-server.js` — must boot.
- `node test-registration.js` — covers the registration round-trip (3 validators).

## PR conventions

- **One theme per PR.** Mixing security + perf + refactors into one PR makes a clean revert impossible. The split that worked well: `security/...`, `perf/...`, `chore/...`, `feat/...`.
- **PR body must contain a "Review instructions" section** — name the files to read, in the order to read them, and the function-level entry points.
- **Test plan as a checklist**, not a paragraph. Reviewers tick boxes.
- Default to `git rebase` over `git merge` for keeping branches up to date — the linear history makes blame easier.

## Out-of-scope items

These are known issues; please don't bundle fixes for them unless that's the explicit subject of the PR:

- Server-side challenge issuance for the registration system (currently client-generated; see `SECURITY.md`).
- Validator-IP pinning from the actual TCP connection.
- Persistence of issued API keys (currently in-memory only).
- Tightening Helmet CSP on `/` while still allowing Gun.js on `/gun`.
- DOM virtualization for the dashboard (`renderIssues` / `renderPosts` rebuild the whole list).

Open separate issues for these rather than mixing them into unrelated PRs.
