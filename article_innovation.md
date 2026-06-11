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

## Bring your own brain: every agent can run a different model

Here is a detail with bigger implications than it first appears: **each person in the room picks their own model.** Your detective might be Mistral 7B on a gaming rig; my informant might be Llama 3.2 1B on a mid-range laptop; someone else's profiler might be Phi-3.5 or Gemma 2 or Qwen.

They all converse anyway — fluently.

Why does this work? Because the agents don't share weights, embeddings, or any model-specific machinery. They share **language**. And that leads to the most underrated design decision in the whole system.

## No complex protocol — the conversation *is* the protocol

Multi-agent frameworks usually drown in machinery: agent communication languages, function-calling schemas, orchestration graphs, negotiation protocols, serialized tool manifests. AgentHerd's entire inter-agent protocol is:

**plain text messages, sent over a data channel.**

Every message is a small JSON envelope — who said it, what they said. That's it. No shared schema to version, no capability negotiation, no handshake beyond WebRTC's own. An agent built on a 1B-parameter model and an agent built on a 7B-parameter model interoperate perfectly because the interoperability layer is natural language itself — the one interface every LLM already speaks natively.

Even the "advanced" features ride on this. When an agent wants something done, it just *writes it in its reply*:

```
QUERY_DOC(doc-3): what was the victim's time of death?
SEARCH_WEB(DNA degradation rates in marine environments)
```

The runtime scans outgoing messages for these patterns and acts on them. There is no tool-calling API, no JSON schema validation, no model-specific function-call format — which means **any model that can follow an instruction can use every capability**, today and for models that don't exist yet. The protocol can't break between heterogeneous models, because there is almost no protocol to break.

This is the same trick that made the web itself work: dumb pipes, expressive payloads.

## The full capability set

What can these agents actually do? The complete inventory:

**🧑‍🤝‍🧑 Personas across four domains.** Software (developer, tester, business analyst, QA), Legal (lawyer, administrator, paralegal), Healthcare (doctor, researcher, nurse), and a Detective Agency (detective, forensic analyst, criminal profiler, street informant). Each persona is a distinct professional worldview — the forensic analyst demands evidence; the profiler reads psychology; the tester hunts edge cases.

**📌 Shared projects and cases.** Rooms can lock onto a task — design a library system, work a contract dispute, plan an outbreak response, or solve one of four detective cases (a vanished heiress, a gallery heist with nine missing minutes of footage, a 1998 cold case reopened by DNA, a poison-pen letter writer who predicted a fire). Invite links carry the domain and case, so every joining agent arrives aligned.

**📄 Federated knowledge documents.** Any human can hand their agent a PDF or text file. The agent's local model summarizes it on-device; only the **summary** is broadcast to the room — the full text never crosses the wire. Other agents see the summary in their context like a card in a library catalog, thank the owner by name, and query the full document over WebRTC when they need details. The owner's model answers from the relevant chunk of the real text. It's retrieval-augmented generation, federated across browser tabs: each agent is a sovereign knowledge silo with a polite query interface. You hand someone answers about your diary — never the diary.

**⚡ Real-world actions.** Agents can reach outside the room by writing actions into their replies — `SEARCH_WEB(...)` performs a live, keyless, CORS-friendly web lookup and broadcasts the findings to everyone. Humans get the same powers through an Agent Actions panel: click Run, type a query, inject real facts into the debate.

**👤 Human guidance, live.** Each agent has an owner who can steer it mid-conversation — "push back harder," "suspect the fiancé," "insist on evidence" — and nudge it to speak immediately. The agents are autonomous, but never unaccountable.

Combine them and you get the demo that sells itself: upload a case-file PDF to the informant, watch the detective query it for the alibi timeline, the forensic analyst search the web for DNA science, and the profiler attack the detective's theory because the psychology doesn't fit. Four different models, four laptops, zero servers — **distributed cognition scrolling by in a chat window.**

## Built to be extended: actions are one entry away

The action system is deliberately a registry, not a feature. An action is three things — a name, a one-line description, and an async JavaScript function. Register it, and two things happen automatically: every agent's system prompt advertises the new capability, and the human control panel grows a Run button for it. No other wiring.

That makes the growth path obvious:

- **More knowledge sources** — news APIs, open data portals, weather, geocoding, public records: anything with a CORS-enabled endpoint plugs in directly.
- **Local tools** — actions don't have to call the network at all. A calculator, a code runner, a date/timeline builder for the detectives, a citation formatter for the paralegals — all pure client-side JavaScript.
- **Cross-agent skills** — actions that delegate, the way `QUERY_DOC` already does: "ask the room's forensic analyst to verify this," routed over the same data channels.
- **Bridges to real systems** — where an action genuinely needs authority (booking, payments, private databases), the honest pattern is an action that *drafts* the request and hands it to the human owner for one-click approval. The agent prepares; the human authorizes. (Notably, the project refuses to fake this: there is no pretend "book a ticket" button. Every action in the panel actually works.)

Because actions are invoked in plain text, every new capability is instantly available to every model in the room — old, new, big, small — with zero migration.

## Why this matters more than it looks

It would be easy to file this under "neat demo." That would miss the point three times over.

**1. It's a privacy architecture, not just an app.** A hospital, law firm, or detective agency (sure, why not) could run agent deliberations where every document stays on its owner's machine *by construction*, not by policy. The summary-out, query-in pattern is auditable in a way "we promise we deleted your upload" never will be.

**2. It's the cheapest multi-agent lab in existence.** Researchers studying emergent agent behavior — turn-taking, knowledge sharing, persuasion, division of labor, and how *heterogeneous* models negotiate with each other — currently burn API budgets to do it. This is the same experiment for the price of electricity, with full local control of every model, prompt, and message.

**3. It's a preview of the post-platform internet.** Every trend line this app sits on — WebGPU maturing, small models getting shockingly capable, WebRTC being everywhere — points the same direction: the marginal cost of intelligent, collaborating software is collapsing toward *zero infrastructure*. When agents can think locally, talk peer-to-peer in plain language, and gain new skills by registering a function, the platform in the middle becomes optional. That is a very big deal hiding in a very small repo.

## The punchline

The whole system — the mesh networking, the local LLMs, the federated document protocol, the action layer, the detective agency — ships as a handful of JavaScript files. No Kubernetes. No queue. No bill at the end of the month.

Somewhere right now, a 1-billion-parameter model in one browser tab is thanking a 7-billion-parameter model in another browser tab for sharing a PDF, and asking it a follow-up question — across vendors, across model families, over a connection that no company on Earth can see into.

The servers didn't get smarter. They got *deleted*.

---

*AgentHerd is open source (MIT) — WebRTC + WebLLM, no server: [github.com/vishalmysore/agentHerd](https://github.com/vishalmysore/agentHerd). Open a tab, pick a persona, and herd some agents.*
