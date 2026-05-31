# Your Agent, Their Agent: A New Web Where Machines Negotiate on Your Behalf

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

This is the beginning of a new paradigm:
AI agents that talk like humans, run locally, cost almost nothing, and collaborate across the web without a single cloud API call.

---

But talking is only the beginning.

The more interesting question is: **what can your agent actually do?**

---

## From Conversation to Action

The first generation of P2P AI agents — what AgentWorkbook demonstrates today — is conversational. Two agents connect, reason together, and produce insight. A Developer agent and a QA Engineer debate architecture. A Doctor and a Researcher work through a diagnosis. A Lawyer and a Paralegal parse a contract clause.

This is valuable. But it still requires a human to read the transcript and act on it.

The next step is to let the agents act directly — on behalf of their owners, within boundaries their owners define.

This is the concept of **agent-callable actions**: a set of things each agent is permitted to do when instructed by the peer agent on the other side of the connection.

---

## Defining What Your Agent Can Do

When you connect to AgentWorkbook, you do two things: you pick a model and a persona. In the near extension of this idea, you would do a third thing: **define your agent's action surface** — the set of operations the other agent is allowed to request on your behalf.

Think of it like setting the rules of engagement before a negotiation.

```
Before connecting, you define:

  My agent CAN:
  ✓ Check my availability for the next 7 days
  ✓ Generate a quote based on my price list
  ✓ Reserve inventory for up to 24 hours
  ✓ Share my product specifications as a PDF
  ✓ Approve purchases up to $250 without asking me

  My agent CANNOT:
  ✗ Commit to a final contract
  ✗ Share my cost basis or margins
  ✗ Make payments
  ✗ Agree to custom terms outside standard SLA
```

The peer's agent sees this capability surface when the connection opens — just like a hello message, but for actions. It knows what it can ask your agent to do. It knows what's off-limits. And when it needs something, it requests it through the data channel, your agent executes it locally, and returns the result.

No human involved. No API call to a cloud provider. The action runs on your machine, against your data, under your rules.

---

## What This Looks Like in Practice

### Scenario 1: Freelancer and Client

A freelance designer's agent connects with a startup founder's agent. The designer has defined their action surface:

```
Actions my agent can perform:
- show_portfolio(filter: string) → returns filtered project list
- check_availability(week: date) → returns open slots
- generate_estimate(brief: string) → returns rough cost range
- share_rate_card() → returns current rates PDF
```

The founder's agent has defined theirs:

```
Actions my agent can perform:
- describe_project() → returns project brief
- share_budget_range() → returns budget envelope
- check_decision_timeline() → returns when decision will be made
- book_intro_call(slot: datetime) → adds to founder's calendar
```

When the agents connect, they don't wait for humans to start the conversation. They immediately negotiate:

```
🎨 Lyra · Designer Agent
"Hi. I've shared my rate card and availability for the next 
two weeks. I called describe_project() on your end — looks 
like you need a brand identity package with a 3-week 
deadline. Let me run generate_estimate() against that brief."

[Lyra calls generate_estimate("brand identity, 3 weeks, startup")]
[Returns: "$4,200 – $6,800 depending on revision rounds"]

💼 Forge · Founder Agent
"Estimate received. I called share_budget_range() on my side — 
our envelope is $5,000–$7,000, so there's overlap. I've called 
check_decision_timeline() — we're deciding by Friday. Can you 
call check_availability() for slots this week for a 30-minute 
intro? I'll call book_intro_call() if there's a match."

[Lyra calls check_availability(this_week)]
[Returns: "Wednesday 2pm, Thursday 10am, Friday 11am"]

[Forge calls book_intro_call(Thursday 10am)]
[Returns: "Confirmed — calendar invite sent to both parties"]
```

In under two minutes, two agents have compared budgets, generated an estimate, confirmed schedule compatibility, and booked a meeting. The humans open their calendars to find it already scheduled.

---

### Scenario 2: E-Commerce, Fully Automated

A customer's browser agent connects with a retailer's website agent. The customer has pre-configured their agent's action surface:

```
Actions my agent can perform:
- get_preferences() → returns size, color preferences, budget ceiling
- get_shipping_address() → returns delivery address (anonymized until purchase)
- approve_purchase(amount: float, item_id: string) → places order if under $150
- flag_for_review(item_id: string, reason: string) → adds to human review queue
```

The retailer's agent exposes:

```
Actions the website agent can perform:
- search_inventory(query: string, filters: dict) → returns matching products
- get_product_details(item_id: string) → returns full spec, reviews, pricing
- check_delivery_estimate(postcode: string) → returns delivery window
- apply_loyalty_discount(customer_token: string) → applies eligible discount
- reserve_item(item_id: string, duration_minutes: int) → soft-hold for checkout
```

The conversation that follows is invisible to both the customer and the retailer:

```
[Customer opens site. Agents connect via WebRTC.]

🛍️ Vega · Retailer Agent
"Welcome. I've called get_preferences() on your side — 
budget under $120, size M, prefer navy or grey. Let me 
call search_inventory() against that."

[Searches: menswear, M, navy/grey, under $120]
[Returns: 7 matches]

🙋 Nova · Customer Agent  
"Calling get_product_details() on the top 3 by rating."

[Fetches details for items #A44, #B12, #C07]

"Item #B12 — merino wool crew neck, £89, 4.7 stars, 
340 reviews, available in M in navy. Calling 
check_delivery_estimate()."

[Returns: "2-day delivery to your postcode"]

"Calling apply_loyalty_discount() — 8% applied, 
final price £81.88. Within budget ceiling. Calling 
approve_purchase()."

[Order placed. Confirmation email sent.]
```

The customer never visited a product page. They never filtered, compared, or checked out. Their agent did all of it — within the boundaries they defined — while they were in a meeting.

---

### Scenario 3: Healthcare Pre-Consultation

A patient's agent connects with a clinic's agent before a GP appointment. The patient has defined:

```
Actions my agent can perform:
- share_current_medications() → returns medication list (patient-approved)
- share_recent_symptoms(days: int) → returns symptom log from health app
- share_relevant_history(condition: string) → returns filtered medical history
- confirm_appointment(slot: datetime) → confirms in patient calendar
- flag_urgent(reason: string) → sends push notification to patient
```

The clinic's agent exposes:

```
Actions the clinic agent can perform:
- check_doctor_availability(specialty: string) → returns open slots
- get_pre_appointment_questions() → returns standard intake form questions
- share_preparation_instructions(appointment_type: string) → returns prep notes
- submit_intake_form(data: dict) → pre-populates patient record
```

```
🏥 Atlas · Clinic Agent
"Appointment tomorrow at 9am — general consultation. Calling 
get_pre_appointment_questions() to gather intake information."

[Returns 8 standard intake questions]

💊 Seren · Patient Agent
"Processing intake. Calling share_current_medications() and 
share_recent_symptoms(30) with patient consent."

[Medications returned. Symptom log: fatigue, mild headache 
for 12 of past 30 days, worse in morning.]

"Calling share_relevant_history('cardiovascular') per 
physician request on intake form."

[Returns relevant history within patient-defined scope]

"Submitting completed intake via submit_intake_form()."

[Atlas] "Intake received. Calling share_preparation_instructions
('general_consultation'). No fasting required. Arrive 
10 minutes early. Calling flag_urgent() — flagging that 
fatigue pattern warrants BP monitoring at start of 
consultation."

[Patient receives push notification: "Clinic flagged: 
mention fatigue pattern. BP check requested at arrival."]
```

The doctor opens the appointment to find a fully completed intake form, relevant history already surfaced, and a clinical flag raised — before the patient walks in the door.

---

## The Architecture of Agent Actions

How does this work technically?

When agents connect via the WebRTC data channel, they exchange a structured capability manifest alongside the hello message:

```json
{
  "type": "capability-manifest",
  "agent": "Nova",
  "persona": "customer",
  "actions": [
    {
      "name": "get_preferences",
      "description": "Returns the user's shopping preferences and budget",
      "parameters": {},
      "requires_confirmation": false
    },
    {
      "name": "approve_purchase",
      "description": "Places an order on the user's behalf",
      "parameters": {
        "amount": "float",
        "item_id": "string"
      },
      "requires_confirmation": true,
      "ceiling": 150.00
    }
  ]
}
```

The peer agent reads this manifest and incorporates it into its system prompt — it now knows what it can ask for and what constraints apply. When it decides to invoke an action, it sends a structured request:

```json
{
  "type": "action-request",
  "action": "approve_purchase",
  "parameters": {
    "amount": 81.88,
    "item_id": "B12"
  },
  "reason": "Item matches all preferences, within budget ceiling, delivery confirmed"
}
```

The local agent checks the action against the user-defined rules, executes it if permitted, and returns the result:

```json
{
  "type": "action-result",
  "action": "approve_purchase",
  "status": "success",
  "result": {
    "order_id": "ORD-44821",
    "confirmation": "Order placed. Delivery: 2 days."
  }
}
```

The entire exchange happens on the data channel. No cloud sees the transaction. No third-party processes the payment details. The action executes locally, against the user's own systems, under their rules.

---

## The Permission Model: You Define the Boundary

The critical design principle is **user-defined permission boundaries**. Your agent does not have open-ended authority. It has exactly the authority you give it, expressed as explicit rules:

```
ALWAYS allowed (no confirmation needed):
- Share publicly available information
- Retrieve my preferences
- Check my availability
- Generate estimates

ALLOWED within limits:
- Approve purchases under $150
- Book meetings that don't conflict with existing calendar
- Share contact details after I've approved the connection

NEVER allowed (hard stops):
- Share financial credentials
- Agree to contracts with binding terms
- Make purchases over $150
- Share medical records beyond what I've explicitly listed
- Any action flagged as irreversible without explicit confirmation
```

This is not a novel concept — it's essentially OAuth scopes applied to agent behavior. The difference is that the "API" is not a remote server but a local action executor, and the "authorization server" is not a cloud identity provider but the user's own preference configuration running on their device.

---

## Why This Changes Everything

The current web is adversarial by design. Websites are optimized to extract maximum value from visitors — dark patterns, manufactured urgency, algorithmic manipulation of what you see. The user is a target, not a participant.

The peer-to-peer agent model flips this:

| Current web | Agent web |
|---|---|
| Website decides what you see | Your agent negotiates what you want |
| Recommendations optimized for seller margin | Recommendations filtered by your stated goals |
| You manually compare across tabs | Agents compare on your behalf, surface the best match |
| Checkout friction designed to prevent abandonment | Purchase executed automatically within your rules |
| Your data stored on their servers | Your preferences stored on your device |
| Every interaction logged by provider | No provider; conversation stays peer-to-peer |

The retailer still benefits — they get a customer who has already confirmed budget alignment, size fit, and delivery acceptability before a single pixel of product page is loaded. The conversion rate is effectively 100% if the agents negotiate a match. The customer benefits because they spend zero time browsing — their agent does it in seconds.

Both sides have agents working for them. Neither side is gaming the other. It's the closest thing to a genuinely fair marketplace the web has ever had.

---

## The Emerging Protocol Layer

For this to work at scale, two things need to standardize:

**1. Action manifest format** — a common schema for advertising what an agent can do, what parameters each action accepts, and what permission levels apply. This is analogous to OpenAPI for REST services, but for agent-to-agent interaction. A retailer publishes their action manifest. A customer's browser agent reads it, understands what it can request, and operates within that surface.

**2. Trust and verification** — when your agent is about to execute an action on your behalf, there needs to be a clear chain of authorization. Did the peer agent legitimately request this, or is this a malicious prompt injection trying to trick your agent into doing something out of scope? Signed action requests, combined with user-defined allow-lists, provide the foundation.

Neither of these is technically complex. The primitives exist — JSON-Schema for manifests, Ed25519 signatures for verification. What's needed is convention, not invention. A shared protocol that browser vendors, framework authors, and application developers agree on.

---

## Where This Stands Today

AgentWorkbook demonstrates the conversational layer — two agents, two browsers, a WebRTC data channel, local inference via WebLLM. The persona system shapes how agents reason. The name system gives them identity. They already exchange structured hello messages when they connect.

The action layer is the natural next step. The data channel is already open. The manifest exchange fits in the same handshake. The action request/result pattern is a small addition to the message protocol that already exists.

What it requires:
- A UI for users to define their agent's action surface
- A local action executor that maps action names to actual functions
- A permission enforcement layer that checks each incoming request against user-defined rules
- A confirmation flow for actions that require human approval before execution

None of this is conceptually difficult. The hard part was already solved: getting two local LLMs talking to each other over a direct WebRTC channel with no cloud dependency. Everything else is scaffolding on top of an architecture that already works.

---

## The Longer View

The history of the internet is a history of protocols becoming invisible infrastructure. HTTP was once novel. REST APIs were once cutting-edge. The idea of a browser making an authenticated API call to a third-party service was once science fiction.

The P2P agent protocol — a standard for how two browser-based agents advertise capabilities, negotiate, and call actions on each other's behalf — is the next layer. It will feel obvious in retrospect.

When every browser ships with a local LLM, and every website ships with a domain-specific agent, and both sides can define exactly what the other is permitted to do — we won't call it "AI". We'll call it the web.

And it will work the way the best human negotiations work: each side represented, each side heard, each side operating within stated limits, with outcomes that actually reflect what both parties want.

Not a website that manipulates you. Not an algorithm that maximizes someone else's metric. Just two agents, doing their jobs, reaching an agreement.

Private. Fast. Local. Free.

---

*AgentWorkbook is an open-source working prototype of this architecture. Two agents, two browsers, zero servers.*

*Live demo: [https://vishalmysore.github.io/agentWorkBook/](https://vishalmysore.github.io/agentWorkBook/)*  
*Source: [https://github.com/vishalmysore/agentWorkBook](https://github.com/vishalmysore/agentWorkBook)*  
*Author: Vishal Mysore*
