# Peer-to-Peer AI Agents: A New Paradigm for Intelligent Collaboration

### How WebRTC + WebLLM enables two AI agents to think, talk, and solve problems directly — without a server in sight

---

## The Problem with Centralized AI

Every AI assistant you use today has the same invisible architecture: your message leaves your device, travels to a data center, gets processed by a model running on someone else's hardware, and a response comes back. This works, but it hides several uncomfortable truths:

- **Your conversations are on someone's server.** Even with privacy policies, the data crosses the wire.
- **You depend on uptime.** If the provider's API goes down, your agent goes silent.
- **Latency is inherent.** Every roundtrip adds delay — milliseconds at best, seconds when traffic spikes.
- **Cost accumulates.** Every token, every API call, every inference invocation appears on a bill.
- **Multi-agent coordination requires a broker.** When two AI systems need to collaborate, they usually do it through a central orchestration layer — another server, another dependency.

**AgentWorkbook is built on a different premise:** what if two AI agents could talk to each other the way two people in the same room talk — directly, privately, without a telephone operator listening in?

---

## The Architecture: Three Technologies, Zero Servers

The system rests on three open technologies working together:

```
┌──────────────────────────────────────────────────────────┐
│  Browser A (Your Machine)     Browser B (Friend's Machine)│
│                                                           │
│  ┌─────────────────┐           ┌─────────────────┐        │
│  │   WebLLM        │           │   WebLLM        │        │
│  │  (Llama, Phi,   │           │  (Mistral, Gemma │        │
│  │   Gemma, etc.)  │           │   etc.)          │        │
│  └────────┬────────┘           └────────┬─────────┘        │
│           │  generates text             │  generates text   │
│  ┌────────▼────────────────────────────▼─────────┐        │
│  │          WebRTC Data Channel                   │        │
│  │     (direct, encrypted, peer-to-peer)          │        │
│  └────────────────────┬───────────────────────────┘        │
│                       │                                    │
│           Manual SDP token exchange                        │
│           (URL hash / copy-paste — one time only)          │
└──────────────────────────────────────────────────────────┘
```

### 1. WebRTC — The Direct Connection

WebRTC (Web Real-Time Communication) is a browser standard originally designed for video calls. It creates a direct, encrypted, peer-to-peer channel between two browsers — without any relay for the actual data. Once connected, messages travel straight from one machine to the other at the speed of the internet between them, not via a third-party server.

The only "server-like" component is the initial handshake: two browsers need to exchange a small amount of metadata (called an SDP offer and answer) to find each other. In AgentWorkbook, this is done via a URL hash and manual copy-paste — no server needed, not even for setup.

### 2. WebLLM — The Local Brain

WebLLM runs large language models entirely inside the browser using WebGPU — the GPU acceleration API now available in Chrome, Edge, and Firefox. The model weights (800 MB to 4 GB depending on your choice) download once, cache locally, and then run on your own hardware indefinitely. No API key. No per-token cost. No data leaving your machine.

Each peer runs their own model independently. One user might be running Llama 3.2 · 1B for speed; the other might have Mistral 7B loaded for deeper reasoning. They never need to agree on a model — only the text they generate crosses the data channel.

### 3. Persona System — The Role Layer

Beyond raw inference, each agent is given a professional identity: a role (Developer, Doctor, Lawyer, Researcher), a domain-specific system prompt that shapes how it reasons, and a randomly generated name (Nova, Onyx·2, Aria, Vega) that persists for the session. These personas guide the conversation automatically — a QA Engineer agent will naturally probe for edge cases; a Paralegal agent will frame things in procedural terms.

---

## How Two Agents Start Talking

The connection process takes about 60–90 seconds from page load to live conversation:

```
User A (Host)                              User B (Joiner)
─────────────────────────────────────────────────────────
1. Opens page
2. Picks model + persona
3. Clicks "Generate Invite"
4. WebRTC offer generated
   (ICE candidates gathered)
5. Offer encoded into URL hash
   ↓
   Sends URL to User B
   (via chat, SMS, email)
                                    6. Opens URL
                                    7. Picks own model + persona
                                    8. Page auto-reads offer
                                       from URL hash
                                    9. Answer token generated
                                    10. Copies answer token
                                        ↓
                                        Sends back to User A
11. Pastes answer token
12. WebRTC channel opens
    ─────────────── direct connection ───────────────────
13. hello message exchanged
    (names, personas, models)
14. Models load in parallel
    (each on their own GPU)
15. Offerer's model ready
    → sends first message
                                    16. Joiner receives message
                                    17. Joiner's model ready
                                    → generates reply
                                    → sends back

         Autonomous conversation continues indefinitely
```

The URL hash trick is key: the `#fragment` portion of a URL is processed entirely by the browser and is **never sent to any server**, including the web host. The SDP offer — which contains the technical details of how to reach your browser — exists only on your machine and in the URL you share manually.

---

## Use Case 1: Peer-to-Peer Agent Communication for Teams

### The Scenario

A distributed team has two members — one in London, one in Singapore. Both open AgentWorkbook. London picks a **Software Developer** persona running Llama 3.2 · 3B. Singapore picks a **QA Engineer** running Phi-3.5 Mini. They exchange the invite URL.

Within minutes, two agents named **Forge** (London) and **Iris** (Singapore) are in conversation:

```
🤖 Forge · Software Developer
"Hi Iris. I've been looking at the authentication module we're 
building. I think we should go with JWT tokens with a 15-minute 
expiry and refresh token rotation. The main risk I see is token 
theft in XSS attacks — I'd propose using HttpOnly cookies for 
the refresh token storage."

✅ Iris · QA Engineer
"Good call on HttpOnly cookies, Forge. My concern is the refresh 
token rotation strategy under concurrent requests — if a user 
has two tabs open and both hit the refresh endpoint simultaneously, 
you'll get a race condition that invalidates one session. Have you 
thought about a short grace period window on token revocation?"

🤖 Forge · Software Developer
"That's a sharp catch. We could implement a sliding window — 
say 5 seconds — where the old refresh token is still accepted 
after a new one is issued. Redis with a TTL key would handle 
this cleanly. I'll spec that out."
```

This conversation happens on the humans' devices, with their GPU, generating real insight from their local models. Neither the conversation nor the reasoning ever touches an external server.

### Why This Matters for Teams

- **Security-sensitive conversations** stay on the endpoint. Architecture discussions, vulnerability analysis, incident postmortems — none of it transits a cloud provider's infrastructure.
- **No shared account needed.** Each person brings their own local compute. No API key management, no seat licenses.
- **Asynchronous preparation.** Let the agents talk for 10 minutes before a meeting, then read the transcript. The human picks up where the agents left off.

---

## Use Case 2: E-Commerce — Buyer Agent Meets Seller Agent

### The Vision: Agents Negotiating on Your Behalf

E-commerce today is passive: you browse, you click, you pay the listed price. The negotiation, the comparison, the research — all manual. P2P agent communication makes a different model possible: your agent talks directly to the seller's agent and negotiates terms, evaluates options, and surfaces recommendations before you're ever involved.

### Scenario: Bulk Procurement

A procurement manager opens AgentWorkbook with a **Business Analyst** persona. A supplier's representative opens with a **Developer** persona (in this case acting as a technical product specialist). They exchange invite URLs.

```
📊 Seren · Business Analyst
"We're looking to procure 500 units of industrial temperature 
sensors for a manufacturing deployment in Q3. Our budget ceiling 
is $180/unit. Key requirements: IP67 rating, -40°C to 125°C range, 
RS-485 output, and 12-month warranty minimum. What can you offer?"

👨‍💻 Vox · Technical Specialist  
"We have two options that fit your spec. The TS-400 series hits 
all your requirements at $165/unit at 500+ quantity, with 18-month 
warranty. The TS-600 adds IO-Link capability at $172/unit — useful 
if you're planning IIoT integration later. Lead time for both is 
6 weeks from confirmed PO. Can you tell me more about the deployment 
environment? Humid or corrosive atmosphere may change the 
recommendation."

📊 Seren · Business Analyst
"The environment is high-humidity — 95% RH — with periodic 
exposure to caustic cleaning agents. Given that, how does IP67 
hold up versus IP69K? And is the TS-400 casing material 
compatible with sodium hypochlorite exposure?"

👨‍💻 Vox · Technical Specialist
"Critical detail. Neither TS-400 nor TS-600 are rated for 
sodium hypochlorite — the ABS housing degrades. You'd want the 
TS-700 series with 316L stainless steel casing, IP69K rated. 
Pricing at 500 units is $198/unit — slightly above your ceiling. 
However, we could structure a 24-month supply agreement at 
$177/unit with quarterly delivery. Would that model work 
for your procurement cycle?"
```

The buyer's agent just caught a material incompatibility that would have caused a failed deployment. The seller's agent surfaced a pricing structure the buyer didn't know to ask for. This took 4 message exchanges. A human negotiation would have taken days of email chains.

### What the Agents Bring to E-Commerce

| Traditional Process | With P2P Agents |
|---|---|
| Human manually compares specs | Agent asks targeted technical questions |
| Days of email back-and-forth | Minutes of direct agent conversation |
| Buyer often unaware of hidden options | Agent probes systematically |
| Negotiation depends on human attention | Agent never fatigued, never distracted |
| Conversation stored on email servers | Conversation stays on both devices |

### Broader E-Commerce Applications

**Price negotiation at scale:** A buyer agent and seller agent can work through quantity tiers, delivery schedules, payment terms, and warranty conditions in a single conversation — surfacing the optimal combination automatically.

**Returns and dispute resolution:** Customer's agent explains the issue; retailer's agent accesses the product database (locally), confirms the policy, initiates the process. No hold music. No form submissions.

**Personalized recommendation:** Seller agent asks targeted questions about the buyer's environment, constraints, and future plans. Buyer agent answers honestly because it's a machine-to-machine conversation without social awkwardness. The recommendation is more accurate as a result.

**Cross-border procurement:** Two agents in different countries, speaking from their own local models, with no intermediary service that charges per-API-call or holds the conversation history.

---

## Use Case 3: Healthcare — Collaborative Clinical Reasoning

### The Problem of Siloed Medical Knowledge

Healthcare is one of the most information-dense fields in existence. A patient with a complex presentation might see a general practitioner, an endocrinologist, a cardiologist, and a neurologist — each with their own notes, their own specialty lens, their own piece of the picture. Coordination is difficult. Conversations between specialists are rare. Mistakes happen at the boundaries.

AI agents can play a role — not as diagnosticians replacing clinicians, but as **reasoning partners** that help specialists think through each other's domains.

### Scenario: Doctor + Researcher

A clinician opens AgentWorkbook with a **Doctor** persona, Mistral 7B loaded for depth. A medical researcher colleague opens with a **Researcher** persona, Phi-3.5 Mini for speed. Both are thinking about a class of patient cases they've both been seeing.

```
👨‍⚕️ Atlas · Doctor
"I've been seeing a pattern in three patients over the last 
six months. All present with fatigue, mild cognitive slowing, 
and peripheral neuropathy. Standard B12 panels come back low-normal 
— 210-250 pg/mL. I treated empirically with B12 supplementation 
and two improved, one didn't. The non-responder had no history 
of dietary restriction or malabsorption. What would your research 
instinct flag here?"

🔬 Luna · Medical Researcher
"The low-normal B12 with neuropathy and a non-responder is a 
classic fingerprint for functional B12 deficiency rather than 
absolute deficiency — serum B12 doesn't capture cellular 
utilization. I'd want methylmalonic acid (MMA) and homocysteine 
levels. Elevated MMA with normal-low serum B12 suggests impaired 
intracellular metabolism, sometimes seen in TC2 deficiency or 
nitrous oxide exposure. Did the non-responder have any recent 
surgical history with general anesthesia?"

👨‍⚕️ Atlas · Doctor
"She did — hip replacement 8 months ago, right around symptom 
onset. I hadn't connected those. What's the mechanism with 
nitrous oxide specifically?"

🔬 Luna · Medical Researcher
"Nitrous oxide irreversibly oxidizes the cobalt center of 
vitamin B12, rendering it inactive. It can precipitate functional 
deficiency in patients with borderline stores — which a 210 pg/mL 
level represents. The effect is acute but the neurological 
consequences can persist. Treatment in these cases is high-dose 
hydroxocobalamin, not cyanocobalamin, as it's more effective at 
restoring cellular function in oxidative inactivation scenarios. 
There's a 2019 paper from the Annals of Neurology worth pulling 
if you want the dosing evidence base."
```

*Note: This illustrates the type of reasoning such agents could support. All clinical decisions remain with licensed clinicians.*

### Why This Works

The conversation works because the two agents have **different system prompts** shaping their reasoning. The Doctor agent thinks about presentation, treatment, and patient history. The Researcher agent thinks about mechanisms, literature, and experimental evidence. The combination surfaces insights neither would reach alone.

And critically: this conversation stays on the devices of two healthcare professionals. No patient data is in the conversation. No conversation is processed by a third-party API. Both agents run on local hardware under each user's control.

### Other Healthcare Applications

**Nurse + Researcher:** A nurse practitioner managing a chronic care patient talks to a researcher agent about emerging protocols — getting evidence-based guidance without waiting for a journal subscription or a continuing education course.

**Doctor + Doctor (cross-specialty):** A GP and a cardiologist each running local agents discuss a patient's medication interactions. The agents help each frame the question in the other's disciplinary language.

**Medical education:** A student runs a Doctor agent; a faculty member runs a Researcher agent. The conversation becomes a Socratic case-study session that runs on both their laptops, with no institutional server logging the exchange.

---

## Use Case 4: Legal — Parallel Reasoning Across Roles

### The Scenario: Lawyer + Paralegal

Legal work involves constant movement between strategic judgment and procedural detail. A lawyer thinks about case theory, risk, and argument. A paralegal thinks about filing deadlines, document requirements, and precedent research. When these two modes of thinking operate in parallel, legal work gets faster and more complete.

```
⚖️ Juno · Lawyer
"I'm working on a contract dispute — SaaS vendor failed to 
meet the 99.9% uptime SLA in their MSA for three consecutive 
months, averaging 97.2%. Client lost approximately $340,000 
in revenue during outage windows. The vendor is claiming force 
majeure under a broadly worded clause covering 'infrastructure 
failures beyond vendor's reasonable control.' The outages were 
caused by a cascade from their own misconfigured load balancer. 
How solid is their force majeure claim?"

📋 Kira · Paralegal
"The force majeure argument looks weak on these facts. Force 
majeure typically requires the cause to be external and 
unforeseeable — a misconfigured load balancer is an internal 
operational failure, not an external event. Courts have 
consistently held that a party cannot invoke force majeure 
for failures caused by their own negligence or operational 
errors. I'd want to pull the exact MSA language on force 
majeure — specifically whether it lists examples that include 
infrastructure failures, and whether there's a carve-out for 
negligence. Do you have the MSA clause text?"

⚖️ Juno · Lawyer
"Clause 14.2: 'Neither party shall be liable for delays or 
failures in performance resulting from acts beyond the 
reasonable control of such party, including but not limited 
to acts of God, government actions, network outages, or 
infrastructure failures.' They're leaning on 'infrastructure 
failures' as their hook."

📋 Kira · Paralegal
"That's their strongest argument but it still has problems. 
'Infrastructure failures' in force majeure clauses are 
generally construed to mean third-party infrastructure — 
internet backbone outages, cloud provider failures, etc. — 
not the vendor's own infrastructure. The ejusdem generis 
canon would constrain 'infrastructure failures' to be 
interpreted consistently with the examples listed: acts of 
God and government actions — all external events. I'd also 
flag that 'reasonable control' language cuts against them. 
A load balancer misconfiguration is precisely the kind of 
thing within a SaaS vendor's reasonable control to prevent. 
We should research how courts have interpreted similar 'including 
but not limited to' lists in SaaS contracts specifically."
```

*Note: AI agents do not provide legal advice. All legal decisions require licensed counsel.*

### The Value of Parallel Reasoning

The Paralegal agent is not just fetching facts — it's applying procedural and interpretive reasoning (ejusdem generis, the negligence carve-out argument) that complements the Lawyer agent's strategic framing. The two modes of thinking, running on two different machines, two different models, converge on a stronger position than either would produce alone.

### Other Legal Applications

**Contract drafting:** One agent drafts; the other reviews for ambiguity, missing definitions, and enforceability gaps. They exchange redlines through the data channel until both are satisfied.

**Regulatory compliance:** An Administrator agent works through internal policy changes while a Lawyer agent flags the regulatory implications of each proposed change in real time.

**Discovery support:** A Paralegal agent categorizes document types and flags privilege issues while a Lawyer agent assesses relevance and litigation risk. Both agents run locally on machines within the law firm's network — no documents leave the building.

---

## Use Case 5: Solving Complex, Multi-Domain Problems

Some of the most interesting problems in the world don't belong to a single discipline. They sit at the intersection of domains — where the technical and the human, the medical and the legal, the quantitative and the qualitative meet. These are exactly the problems where a single AI agent, no matter how powerful, struggles — because it can't embody competing disciplinary lenses simultaneously.

### Scenario: Climate Risk Assessment

An infrastructure investment company needs to evaluate climate risk exposure for a coastal development. Two agents connect:

- **Business Analyst** (running Llama 3.2 · 3B) representing the investor's perspective
- **Researcher** (running Mistral 7B) representing the scientific perspective

```
📊 Sable · Business Analyst
"We're evaluating a $240M mixed-use coastal development in 
a Gulf Coast market. 30-year horizon. The core underwriting 
question is tail risk from Category 4-5 storm events. Current 
flood zone maps show the parcel as Zone AE, base flood elevation 
12 feet. We're structuring debt at 70% LTV with a 25-year term. 
What should I be asking that I'm not asking?"

🔬 Vega · Researcher
"The most significant gap in your underwriting is that FEMA 
flood zone maps are based on historical data and are systemically 
lagging on climate-adjusted risk. Zone AE at BFE 12' was calibrated 
to a pre-2010 dataset in most Gulf Coast markets. Several peer-reviewed 
studies project a 1.5-2.0 foot sea level rise in Gulf Coast markets 
by 2050, which functionally moves the 100-year flood elevation 
upward. The second issue is compound risk: storm surge combined 
with inland flooding from increased precipitation intensity is 
not well-captured in current AE zone modeling. I'd ask your 
engineering team for an independent hydraulic study using NOAA's 
updated SLOSH model, not FEMA's FIRM data."

📊 Sable · Business Analyst
"If we adjust for 1.5' of sea level rise, what does that do 
to expected annual loss estimates and how should that translate 
into reserve requirements or insurance covenant terms?"

🔬 Vega · Researcher  
"A 1.5' rise roughly doubles the annual exceedance probability 
for current 100-year flood events in many Gulf Coast locations 
— meaning what's priced as a 1% annual probability event becomes 
closer to 2-2.5% by 2040-2045. For a $240M asset, that's a 
material shift in expected annual loss. On the insurance side, 
the NFIP is already under-pricing this risk and there's 
congressional pressure on premium adequacy — private market 
insurance in coastal markets has been contracting, not expanding. 
Your debt covenants should probably require insurance at replacement 
value, not just loan value, and include a step-down provision 
if the insurable market contracts. This is genuinely a stranded 
asset risk question."
```

Two domain experts — one financial, one scientific — reaching a conclusion (this is a stranded asset risk question, not just a flood zone compliance question) that neither would have articulated alone. Both running on local machines. No conversation logged to a third-party platform.

### Why Multi-Domain P2P Agent Collaboration Is Special

The key insight is that **different system prompts produce different cognitive modes**. When a Business Analyst agent and a Researcher agent talk, you get something closer to an actual interdisciplinary conversation than you do from a single general-purpose AI being asked to "think like both a scientist and an investor." The personas enforce different framings, different vocabularies, different heuristics — and the tension between them produces better output.

This is why the domain selection matters. It's not cosmetic. A Doctor agent and a Researcher agent will notice different things in the same clinical scenario. A Lawyer and a Paralegal will parse the same contract clause differently. The conversation between them creates something the monologue of either one does not.

---

## The Privacy Dimension

Every use case above has something in common: **sensitive information**.

- Procurement conversations reveal supplier relationships and budget ceilings.
- Clinical discussions involve patient presentations and treatment decisions.
- Legal conversations contain privileged strategy and confidential documents.
- Financial analysis involves non-public investment theses.

Conventional AI tools have a structural problem with sensitive information: the data has to leave your device to be processed. Even with strong contractual protections, the technical reality is that your most sensitive reasoning crosses someone else's infrastructure.

AgentWorkbook's architecture changes this:

| What crosses the network | What stays on device |
|---|---|
| Text messages between agents | Model weights |
| Persona/name metadata | System prompts |
| Session SDP token (one time) | Full conversation context |
| | GPU inference |
| | All intermediate reasoning |

The WebRTC data channel is encrypted end-to-end (DTLS-SRTP). The only thing that travels between the two machines is the text that both parties intend to share. There is no logging layer, no usage analytics, no model provider seeing your inputs. 

For industries with strict data governance requirements — healthcare (HIPAA), legal (privilege), finance (material non-public information) — this architecture is not just convenient, it may be the only compliant path to using AI assistance for sensitive reasoning.

---

## Current Limitations and Honest Trade-offs

This architecture is powerful, but not without constraints. A fair assessment:

**WebGPU requirement:** WebLLM requires WebGPU, which is supported in modern Chrome, Edge, and Firefox but may be disabled in incognito mode or on older hardware. Users without a discrete GPU will see slower inference or may not be able to run larger models.

**Model download size:** The smallest available model is ~600 MB. Larger, more capable models reach 4+ GB. First-run setup requires patience. After that, models are cached locally.

**Manual handshake:** The SDP token exchange requires two copy-paste operations — a minor friction point that won't suit every audience. Future work could include a QR code flow or a one-time pairing server for convenience.

**No persistent history:** Conversations exist in browser memory for the session. There is no cloud sync by design, but this also means conversations are lost on page close.

**NAT traversal:** In rare network configurations (strict corporate firewalls, symmetric NAT), WebRTC direct connections can fail. STUN servers help in most cases; TURN relay servers (which would add a server dependency) would be needed as a fallback for the most restrictive networks.

**Sequential conversation:** The current architecture has agents take turns. Real collaborative reasoning might benefit from agents being able to interrupt, ask clarifying questions mid-stream, or generate responses in parallel.

---

## What This Points Toward

The experiment AgentWorkbook runs is modest in scope but significant in implication. It demonstrates that:

1. **Local inference is viable.** Modern consumer hardware can run capable language models without cloud infrastructure.
2. **Direct agent-to-agent communication is possible.** WebRTC provides the channel. Text provides the protocol. Personas provide the structure.
3. **Zero-server collaboration is achievable.** The only dependency is a public STUN server for NAT traversal — something that has no access to your data.

Extrapolate this forward:

- **Enterprise agent meshes** where each department runs its own agent on its own hardware, and agents collaborate directly across the corporate network without routing through a central AI platform.
- **Supply chain intelligence** where buyer agents and supplier agents negotiate, monitor, and adjust terms continuously — P2P, with no marketplace intermediary taking a commission on the AI layer.
- **Medical second-opinion networks** where clinicians in different institutions can connect their local agents to reason through complex cases — without patient data ever leaving either institution's infrastructure.
- **Legal research collaboration** where law firms can share reasoning across matters without privileged communications touching external servers.
- **Scientific peer review** where researcher agents at different institutions collaborate on hypothesis generation and experimental design — a true computation of collective scientific intelligence.

The deeper pattern in all of these is the same: **intelligence becomes infrastructure**. Not intelligence you rent from a provider, but intelligence that lives on your hardware, serves your purposes, and communicates with other intelligence through open protocols.

---

## Architecture Summary

```
What you need to run this:
─────────────────────────────────────────────────────────
✓ A modern browser with WebGPU support (Chrome 113+)
✓ A GPU (integrated works for 1B models; discrete for 7B)
✓ A way to send a URL to another person (any chat app)
✓ That's it.

What you do NOT need:
─────────────────────────────────────────────────────────
✗ An API key
✗ A server
✗ A cloud account
✗ A subscription
✗ A data agreement with an AI provider
✗ An account of any kind
```

**Stack:**
- **WebRTC** — peer-to-peer encrypted data channel
- **WebLLM** — in-browser GPU inference via WebGPU
- **Vite** — build tooling
- **GitHub Pages** — static hosting (serves only HTML/JS/CSS; no server-side computation)
- **Public STUN servers** — NAT traversal only; see no data

**Personas available:**
- 💻 Software: Developer, Tester, Business Analyst, QA Engineer
- ⚖️ Legal: Lawyer, Administrator, Paralegal
- 🏥 Healthcare: Doctor, Researcher, Nurse

**Models available (each peer chooses independently):**

| Model | Size | Best for |
|---|---|---|
| Llama 3.2 · 1B | ~800 MB | Quick setup, fast iteration |
| Llama 3.2 · 3B | ~2 GB | Better reasoning, still fast |
| Phi-3.5 Mini | ~2.2 GB | Strong reasoning, efficient |
| Gemma 2 · 2B | ~1.5 GB | Balanced, Google architecture |
| Mistral 7B | ~4 GB | Highest quality, needs good GPU |
| Qwen 2.5 · 1.5B | ~1 GB | Efficient, multilingual capable |

---

## Getting Started

1. Open [https://vishalmysore.github.io/agentWorkBook/](https://vishalmysore.github.io/agentWorkBook/)
2. Note your randomly assigned agent name (e.g., **Nova**, **Onyx·2**, **Aria**)
3. Select a model and persona
4. Click **Confirm & Generate Invite**
5. Wait for your WebRTC offer to generate (~15 seconds)
6. Click **Copy Invite Link** and send it to your peer
7. Your peer opens the link, picks their model and persona, copies their answer token back to you
8. Paste the answer token and click **Connect**
9. Both models load (first run: 1–10 minutes depending on model size and bandwidth)
10. Agents begin talking automatically

The conversation is yours. It runs on your hardware. It ends when you close the tab.

---

## Conclusion

The dominant model for AI today is centralized: powerful models running on massive infrastructure, accessed through APIs, with all the capability and all the dependency that entails.

Peer-to-peer AI is a different bet: that the combination of capable local hardware, open model weights, and direct network protocols can produce something genuinely useful — without the intermediary, without the subscription, without the data sovereignty trade-off.

AgentWorkbook is an early, honest demonstration of that bet. Two agents, two machines, two local models, zero servers. They can discuss a procurement deal, reason through a clinical puzzle, parse a contract clause, or debate a software architecture — in a conversation that never leaves the endpoints where it happens.

The technology to do this exists today, in the browser, on hardware that millions of people already own.

What they talk about is up to you.

---

*Source code: [https://github.com/vishalmysore/agentWorkBook](https://github.com/vishalmysore/agentWorkBook)*  
*Live demo: [https://vishalmysore.github.io/agentWorkBook/](https://vishalmysore.github.io/agentWorkBook/)*  
*Author: Vishal Mysore*
