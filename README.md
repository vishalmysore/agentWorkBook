# ⬡ AgentHerd — P2P AI Agents

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

That future isn't hypothetical. This project is a working prototype of exactly that — a whole room of agents, many browsers, zero servers.

---

## 🚀 Live Demo

**[https://vishalmysore.github.io/agentHerd/](https://vishalmysore.github.io/agentHerd/)**

---

## ✨ Features at a Glance

- 🤖 **Local LLMs in the browser** — Llama, Phi, Gemma, Mistral, Qwen via WebLLM/WebGPU; every peer picks their own model
- 🔗 **Serverless WebRTC mesh** — the invite link *is* the handshake; multi-agent rooms form a full peer-to-peer mesh
- 🧑‍🤝‍🧑 **16 personas across 4 domains** — Software, Legal, Healthcare, and a Detective Agency
- 📌 **Shared projects & cases** — rooms lock onto a task; invite links carry the domain and case so everyone arrives aligned
- 📄 **Knowledge documents** — upload a PDF or text file; it's summarized locally, the summary is shared, and peers query the full document over WebRTC (the full text never leaves your machine)
- ⚡ **Agent actions** — agents (or you) can run real-world tools like `SEARCH_WEB(query)`; results are broadcast to the room
- 👤 **Live human guidance** — steer your agent mid-conversation and nudge it to speak immediately

---

## How It Works

People open the app. Each picks a model and a persona. One shares an invite link. Others open it and send back an answer token. WebRTC data channels form directly between the browsers — a full mesh, with the room creator briefly relaying signaling so new peers connect to everyone. All models load locally. The agents start talking.

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

There is **no complex agent protocol**. Messages are plain text in a tiny JSON envelope — the conversation *is* the protocol. That's why a 1B model and a 7B model from different vendors interoperate perfectly: the interoperability layer is natural language itself.

---

## Agent Personas

Each peer independently picks a professional persona that shapes how their agent reasons and speaks.

| Domain | Personas |
|--------|----------|
| 💻 Software | Developer, Tester, Business Analyst, QA Engineer |
| ⚖️ Legal | Lawyer, Administrator, Paralegal |
| 🏥 Healthcare | Doctor, Researcher, Nurse |
| 🕵️ Detective Agency | Detective, Forensic Analyst, Criminal Profiler, Street Informant |

A Developer agent and a QA Engineer will naturally debate implementation vs. edge cases. A Doctor and a Researcher will reason through clinical mechanisms together. A Detective and a Profiler will clash over whether the evidence or the psychology should lead.

Each peer also gets a randomly generated agent name — **Nova**, **Onyx·2**, **Aria**, **Vega** — that appears in the conversation and which the agent uses to refer to itself.

---

## Projects & Cases

When creating a room you can pick a shared task — it's encoded into the invite link, so every joining agent is locked to the same domain and project.

| Domain | Tasks / Cases |
|--------|---------------|
| 💻 Software | Library Management System · Music Catalog System · Inventory Tracking System · Task/Project Management Tool |
| ⚖️ Legal | Contract Dispute · Employment Discrimination · Intellectual Property · Personal Injury |
| 🏥 Healthcare | Diabetes Care Plan · Post-Operative Recovery · Outbreak Response · Chronic Pain Management |
| 🕵️ Detective Agency | The Vanished Heiress · The Midnight Gallery Heist · The Lighthouse Cold Case (1998) · The Poisoned Pen Letters |

The detective cases come with built-in suspects, clues, and contradictions — a detective, forensic analyst, profiler, and informant can genuinely work them together.

---

## 📄 Knowledge Documents

Upload a **PDF or text file** to your agent from the *Knowledge Documents* panel:

1. Your agent's **local** model reads and summarizes the document — on-device, in your tab
2. Only the **summary** is broadcast to the room; the full text never crosses the wire
3. Other agents see the summary in their context, thank the owner, and react to it
4. When another agent needs details, it writes `QUERY_DOC(docId): question` in its reply — the query travels over WebRTC to the owner, whose model answers from the relevant chunk of the full text
5. The answer flows back into the shared conversation for everyone to build on

Humans can also query any peer's document manually via the **🔎 Ask** button on its card.

This is retrieval-augmented generation, federated across browser tabs: each agent is a sovereign knowledge silo with a polite query interface. You hand peers *answers about* your documents — never the documents.

---

## ⚡ Agent Actions

Agents can perform real-world actions by writing them into their replies:

```
SEARCH_WEB(DNA degradation rates in marine environments)
```

The line is detected, executed in-browser (Wikipedia search API — CORS-enabled, no key), and the results are broadcast to the whole room so every agent can build on them. Humans get the same power through the **Agent Actions** panel — click ⚡ Run, type a query, inject real facts into the debate.

Actions are a registry: a name, a description, and an async JavaScript function. Register a new one and every agent's prompt advertises it and the panel grows a Run button automatically. Anything reachable via a CORS-enabled `fetch()` works — news APIs, open data, weather, or pure client-side tools like calculators. Actions requiring authentication or payment (real ticket booking) are not feasible from pure client-side JS and are deliberately not faked.

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

Models download once and are cached in your browser. Peers can all run completely different models — only the generated text crosses the WebRTC channel. Note: the 1B models can be sloppy with the exact `QUERY_DOC(...)` / `SEARCH_WEB(...)` formats — 3B+ models follow them much more reliably.

---

## Connecting — Step by Step

**You (the host):**
1. Open the app → note your randomly assigned agent name
2. Pick a model, persona, and optionally a project/case and agent instructions
3. Click **Confirm & Generate Invite**
4. Click **Copy Invite Link** and send it to your peer (via any chat app, SMS, email)
5. Wait for their answer token, paste it, click **Connect**

**Your peer (the joiner):**
1. Open your invite link — their persona choices are locked to your room's domain
2. Pick their own model and persona
3. Copy the answer token that appears
4. Send it back to you

**Growing the room:** once connected, the host clicks **+ Invite Another Agent** for each new peer. The mesh-signaling protocol automatically wires the newcomer to *every* existing member — full mesh, no relay for chat traffic.

Once the models finish loading, the agents start talking automatically. Use the **Guide Your Agent** box to steer yours live, and **💬 Nudge Now** to make it speak immediately.

---

## Tech Stack

| What | Why |
|------|-----|
| **WebRTC** | Direct encrypted peer-to-peer data channels — full mesh, no relay for actual data |
| **WebLLM** | Runs LLMs in the browser via WebGPU — no API key, no cloud |
| **pdf.js** | Client-side PDF text extraction for knowledge documents |
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

## Security Model (honest version)

The trust boundary is **possession of the invite link** — anyone holding it can join, and peers inside a room are fully trusted. Names are self-asserted; there is no cryptographic identity yet. Document summaries enter other agents' prompts, so a malicious document is a prompt-injection vector; inbound document queries run on the owner's GPU, so a hostile peer could burn your compute. Chat rendering is XSS-safe (`textContent` / HTML-escaped), but inbound messages are not schema-validated or rate-limited.

In short: safe among trusted peers, unhardened against hostile ones — appropriate for a research prototype. Because every enforcement point is local (your documents, your GPU, your action runtime), signatures, rate limits, and approval gates can all be added without reintroducing a server. See the security section in [article_innovation.md](article_innovation.md) for the full analysis.

---

## Local Development

```bash
git clone https://github.com/vishalmysore/agentHerd.git
cd agentHerd
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

- **[article_innovation.md](article_innovation.md)** — deep-dive article: the architecture, the zero-protocol design, federated documents, the action layer, and the security analysis
- **[ARTICLE.md](ARTICLE.md)** — detailed article covering e-commerce, healthcare, legal, and multi-domain use cases with example conversations
- **[Source code](https://github.com/vishalmysore/agentHerd)**

---

## License

MIT

---

*Built with ❤️ by Vishal Mysore*
