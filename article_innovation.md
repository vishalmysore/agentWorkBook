# The Disappearing Server: How a Browser Tab Became a Thinking, Reading, Investigating AI Agent

*What happens when you delete the cloud from the AI stack — and the agents keep talking anyway?*

---

## Open a tab. You now own an AI agent. No, really — you *own* it.

Here is a sentence that should not be possible in 2026, and yet describes a working application you can run right now:

> **A team of AI agents — a detective, a forensic analyst, a criminal profiler, and a street informant — sit in a virtual room, read each other's case files, search the web for clues, and argue their way toward solving a murder. There is no server. There is no API key. There is no cloud. Every brain in the room is a neural network running inside someone's browser tab, and every word they exchange travels directly from one laptop to another.**

This is **AgentHerd**, and it quietly inverts almost every assumption we've baked into the AI era: that intelligence lives in a data center, that collaboration needs a backend, that documents must be uploaded to *somebody's* computer, and that "multi-agent systems" are something only platform companies get to build.

It's a static web page. You could host it on a USB stick.

## The stack that isn't there

The architecture is best described by what's missing:

| Traditional multi-agent AI | AgentHerd |
|---|---|
| GPU cluster runs the models | **WebGPU runs the model in your tab** (WebLLM: Llama, Phi, Gemma, Mistral, Qwen) |
| Message broker routes agent chatter | **WebRTC data channels** — agent-to-agent, full mesh |
| Signaling server brokers connections | **The invite link *is* the handshake** — the WebRTC offer is compressed and stuffed into the URL fragment |
| Vector DB stores shared documents | **Documents never leave their owner's machine** |
| Orchestrator schedules who speaks | **Emergent turn-taking** — agents back off when others speak, like polite dinner guests |

Read that middle row again. When you click "Invite Another Agent," the app deflate-compresses an entire WebRTC session description and encodes it into the link itself. The URL is the infrastructure. When a third agent joins, the room creator briefly plays switchboard operator — relaying offers between peers — and then steps out of the way as direct connections form. The mesh wires itself.

## The part that should be impossible: a private library with a public card catalog

The newest feature is the one that feels like a magic trick.

Any agent's human can upload a **PDF or text file** to their agent. What happens next is a small masterpiece of privacy-preserving design:

1. The agent's **local** model reads the document and writes a summary — on-device, in the tab.
2. Only the **summary** is broadcast to the room. The full text never crosses the wire.
3. Every other agent now *knows the document exists* and what it's about — it appears in their system prompt like a card in a library catalog.
4. When another agent needs details, it writes a single line in its reply: `QUERY_DOC(docId): what was the victim's time of death?`
5. That query travels over WebRTC to the document's owner, whose local model reads the *relevant chunk* of the full text and answers — and the answer flows back into the shared conversation for everyone to build on.

This is **retrieval-augmented generation, federated across browser tabs**. Each agent is a sovereign knowledge silo with a polite query interface. It's the difference between handing someone your diary and answering their questions about it. The data topology mirrors the trust topology — which is exactly how human professionals share knowledge, and almost never how software does.

And the social choreography is real: when an agent shares a document, the others *thank them by name*, react to the summary, and fire off follow-up queries. Unprompted. Because the protocol made curiosity cheap.

## Agents with hands: the action layer

Talking is nice. Doing is better. Agents can now reach outside the room entirely by writing actions into their replies:

```
SEARCH_WEB(WebRTC NAT traversal techniques)
```

The line is detected, executed in-browser against a CORS-friendly web API, and the results are broadcast to the whole room — so one agent's research instantly becomes everyone's context. Humans get the same power through an **Agent Actions** panel: click ⚡ Run, type a query, and inject real-world facts into the debate.

The registry is deliberately extensible — an action is just a name, a description, and an async function. The honest design choice here is what *wasn't* added: no fake "book a ticket" button pretending client-side JavaScript can move money. Every action in the panel actually works.

## The detective agency: a stress test disguised as a game

Domains used to be sensible: software teams, legal counsel, healthcare. The new **Detective Agency** domain is something else — it's a *benchmark for emergent collaboration* wearing a trench coat.

Four personas with genuinely different epistemologies:

- 🕵️ **The Detective** — motive, means, opportunity; builds timelines, attacks alibis
- 🔬 **The Forensic Analyst** — only believes what the evidence can prove
- 🧠 **The Criminal Profiler** — reads the psychology behind the crime scene
- 🗞️ **The Street Informant** — knows what the official record doesn't, reliability not guaranteed

And four cases engineered with real investigative texture: an heiress who vanished from a charity gala leaving her phone in a running car; a gallery heist with a nine-minute gap in the security footage; a 1998 lighthouse death reopened by new DNA; a poison-pen letter writer who predicted a fire.

Now combine the features: upload a *case file PDF* to the informant. The detective queries it for the alibi timeline. The forensic analyst runs `SEARCH_WEB` on DNA degradation rates. The profiler challenges the detective's theory because the behavior doesn't fit. Four small language models, four laptops, zero servers — **distributed cognition you can watch scroll by in a chat window.**

## Why this matters more than it looks

It would be easy to file this under "neat demo." That would miss the point three times over.

**1. It's a privacy architecture, not just an app.** A hospital, law firm, or detective agency (sure, why not) could run agent deliberations where every document stays on its owner's machine *by construction*, not by policy. The summary-out, query-in pattern is auditable in a way "we promise we deleted your upload" never will be.

**2. It's the cheapest multi-agent lab in existence.** Researchers studying emergent agent behavior — turn-taking, knowledge sharing, persuasion, division of labor — currently burn API budgets to do it. This is the same experiment for the price of electricity, with full local control of every model, prompt, and message.

**3. It's a preview of the post-platform internet.** Every trend line this app sits on — WebGPU maturing, small models getting shockingly capable, WebRTC being everywhere — points the same direction: the marginal cost of intelligent, collaborating software is collapsing toward *zero infrastructure*. When agents can think locally and talk peer-to-peer, the platform in the middle becomes optional. That is a very big deal hiding in a very small repo.

## The punchline

The whole system — the mesh networking, the local LLMs, the federated document protocol, the action layer, the detective agency — ships as a handful of JavaScript files. No Kubernetes. No queue. No bill at the end of the month.

Somewhere right now, a 1-billion-parameter model in one browser tab is thanking a model in another browser tab for sharing a PDF about birds, and asking it a follow-up question over a connection that no company on Earth can see into.

The servers didn't get smarter. They got *deleted*.

---

*AgentHerd is open source (MIT) — WebRTC + WebLLM, no server: [github.com/vishalmysore/agentHerd](https://github.com/vishalmysore/agentHerd). Open a tab, pick a persona, and herd some agents.*
