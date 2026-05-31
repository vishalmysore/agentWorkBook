# ⬡ P2P AI Agents

Can AI agents talk to each other the way humans do — negotiating, questioning, clarifying, and collaborating in plain English? And can we achieve this without API keys, without installing anything, and at almost zero cost?

Surprisingly, yes.

The key is to stop thinking of AI as something that must live in the cloud. With WebGPU enabling local LLMs and WebRTC enabling direct peer‑to‑peer communication, we can imagine a very different future: one where intelligence runs on your device, and conversations happen directly between machines — no servers, no intermediaries, no per‑token billing.

Imagine a world where every website ships with a tiny LLM built in, optimized for its own domain. And your browser has its own built‑in LLM, representing you — your preferences, constraints, and goals — all stored locally.

You open an online store.
Your browser's agent wakes up.
The website's agent wakes up.
And the two begin talking — privately, directly, over WebRTC.

Your agent explains what you actually want.
Their agent explains what they actually offer.
Together, they narrow the choices, compare tradeoffs, and surface the best options.

Not "the website decides what you should buy," but your agent advocates for you, and their agent advocates for them. A negotiation — automated, private, and instant.

This is the beginning of a new paradigm: AI agents that talk like humans, run locally, cost almost nothing, and collaborate across the web without a single cloud API call.

That future isn't hypothetical. This project is a working prototype of exactly that — two agents, two browsers, zero servers.

---

## 🚀 Live Demo

**[https://vishalmysore.github.io/agentWorkBook/](https://vishalmysore.github.io/agentWorkBook/)**

---

## How It Works

Two people open the app. Each picks a model and a persona. One shares an invite link. The other opens it and sends back an answer token. A WebRTC data channel forms directly between the two browsers. Both models load locally. The agents start talking.

```
Your Browser                        Friend's Browser
─────────────────────────────────────────────────────
WebLLM (your chosen model)          WebLLM (their chosen model)
runs on your GPU                    runs on their GPU
       │                                   │
       └──────── WebRTC data channel ──────┘
                 (direct, encrypted)
                 
No server sees this conversation. Ever.
```

The only "server-like" step is the initial handshake — exchanging a small SDP token via URL hash and copy-paste. After that, all traffic is peer-to-peer. Public STUN servers help with NAT traversal but never see your data.

---

## Agent Personas

Each peer independently picks a professional persona that shapes how their agent reasons and speaks.

| Domain | Personas |
|--------|----------|
| 💻 Software | Developer, Tester, Business Analyst, QA Engineer |
| ⚖️ Legal | Lawyer, Administrator, Paralegal |
| 🏥 Healthcare | Doctor, Researcher, Nurse |

A Developer agent and a QA Engineer will naturally debate implementation vs. edge cases. A Doctor and a Researcher will reason through clinical mechanisms together. A Lawyer and a Paralegal will parse contract language from complementary angles.

Each peer also gets a randomly generated agent name — **Nova**, **Onyx·2**, **Aria**, **Vega** — that appears in the conversation and which the agent uses to refer to itself.

---

## AI Models (each peer chooses independently)

| Model | Size | Notes |
|-------|------|-------|
| Llama 3.2 · 1B | ~800 MB | Fastest, good for quick sessions |
| Llama 3.2 · 3B | ~2 GB | Balanced quality and speed |
| Phi-3.5 Mini | ~2.2 GB | Strong reasoning |
| Gemma 2 · 2B | ~1.5 GB | Google architecture |
| Mistral 7B | ~4 GB | Highest quality, needs a good GPU |
| Qwen 2.5 · 1.5B | ~1 GB | Efficient, multilingual capable |

Models download once and are cached in your browser. Both peers can run completely different models — only the generated text crosses the WebRTC channel.

---

## Connecting — Step by Step

**You (the host):**
1. Open the app → note your randomly assigned agent name
2. Pick a model and persona
3. Click **Confirm & Generate Invite**
4. Click **Copy Invite Link** and send it to your peer (via any chat app, SMS, email)
5. Wait for their answer token, paste it, click **Connect**

**Your peer (the joiner):**
1. Open your invite link
2. Pick their own model and persona
3. Copy the answer token that appears
4. Send it back to you

Once both models finish loading, the agents start talking automatically.

---

## Tech Stack

| What | Why |
|------|-----|
| **WebRTC** | Direct encrypted peer-to-peer data channel — no relay for actual data |
| **WebLLM** | Runs LLMs in the browser via WebGPU — no API key, no cloud |
| **Vite** | Build tooling |
| **GitHub Pages** | Static hosting — serves only HTML/JS/CSS, no server-side compute |
| **Public STUN** | NAT traversal only — sees no conversation data |

**Requirements:** A modern browser with WebGPU support (Chrome 113+, Edge 113+). A GPU helps — integrated works for 1B models, discrete recommended for 7B.

---

## What You Do NOT Need

```
✗ An API key          ✗ A server
✗ A cloud account     ✗ A subscription
✗ Node.js             ✗ Any installation
✗ A data agreement with an AI provider
```

---

## Local Development

```bash
git clone https://github.com/vishalmysore/agentWorkBook.git
cd agentWorkBook
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via GitHub Actions.

To activate: go to your repo **Settings → Pages → Source → GitHub Actions**.

---

## Further Reading

- **[ARTICLE.md](ARTICLE.md)** — detailed article covering e-commerce, healthcare, legal, and multi-domain use cases with example conversations
- **[Source code](https://github.com/vishalmysore/agentWorkBook)**

---

## License

MIT

---

*Built with ❤️ by Vishal Mysore*
