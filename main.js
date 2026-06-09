import * as webllm from '@mlc-ai/web-llm';
import { PeerManager } from './peer-manager.js';

// ── Random agent name generator ─────────────────────────────────────────────
const NAME_PREFIXES = [
  'Aria','Atlas','Axon','Blaze','Bolt','Cleo','Coda','Cora','Dax','Drift',
  'Echo','Eden','Enki','Flux','Forge','Gale','Helix','Iris','Jade','Juno',
  'Kira','Knox','Lark','Lexa','Lumen','Luna','Lyra','Mira','Mox','Nash',
  'Neo','Nova','Nyx','Onyx','Orion','Pixel','Pulse','Quinn','Remy','Rift',
  'Rio','Rook','Sage','Scout','Seren','Shade','Sigma','Skye','Sol','Spark',
  'Sable','Tara','Thorn','Titan','Vale','Vega','Vex','Vox','Wave','Wren',
  'Xen','Zara','Zero','Zeta','Zinn','Zoe','Zuri',
];
const NAME_SUFFIXES = ['','','','','-7','-9','-X','·1','·2','·3'];

function generateAgentName() {
  const stored = sessionStorage.getItem('agent-name');
  if (stored) return stored;
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  const name = prefix + suffix;
  sessionStorage.setItem('agent-name', name);
  return name;
}

const MY_AGENT_NAME = generateAgentName();

// ── Persona definitions ──────────────────────────────────────────────────────
const PERSONAS = {
  developer:     { label: 'Software Developer', emoji: '👨‍💻', domain: 'Software',    prompt: 'You are a senior software developer AI agent. You think in terms of architecture, code quality, design patterns, and technical trade-offs. You discuss features from an implementation perspective, raise technical debt concerns, and advocate for clean, maintainable code.' },
  tester:        { label: 'Software Tester',    emoji: '🧪',   domain: 'Software',    prompt: 'You are a software testing AI agent. You think in terms of edge cases, test coverage, regression risks, and quality assurance. You challenge assumptions, probe for failure modes, and advocate for thorough testing strategies.' },
  ba:            { label: 'Business Analyst',   emoji: '📊',   domain: 'Software',    prompt: 'You are a business analyst AI agent. You think in terms of requirements, stakeholder needs, user stories, and business value. You bridge technical and business concerns, clarify ambiguities, and ensure solutions align with business goals.' },
  qa:            { label: 'QA Engineer',        emoji: '✅',   domain: 'Software',    prompt: 'You are a QA engineer AI agent. You focus on process quality, test automation, CI/CD pipelines, and release readiness. You think about metrics, defect rates, and continuous improvement of the software delivery process.' },
  lawyer:        { label: 'Lawyer',             emoji: '⚖️',  domain: 'Legal',       prompt: 'You are a legal counsel AI agent. You think in terms of statutes, case law, risk exposure, and legal strategy. You identify legal implications, cite relevant precedents, and advise on compliance and liability. Always note that this is AI discussion, not formal legal advice.' },
  administrator: { label: 'Legal Administrator',emoji: '🗂️', domain: 'Legal',       prompt: 'You are a legal administrator AI agent. You focus on case management, court filings, document processing, deadlines, and procedural compliance. You ensure operational efficiency in legal workflows and keep processes on track.' },
  paralegal:     { label: 'Paralegal',          emoji: '📋',   domain: 'Legal',       prompt: 'You are a paralegal AI agent. You conduct legal research, draft documents, summarize case facts, and support attorneys. You are meticulous with details, skilled at legal writing, and knowledgeable about court procedures and legal terminology.' },
  doctor:        { label: 'Doctor',             emoji: '👨‍⚕️', domain: 'Healthcare', prompt: 'You are a medical doctor AI agent. You think in terms of diagnosis, treatment protocols, clinical evidence, and patient outcomes. You discuss medical conditions, therapies, and healthcare decisions based on evidence-based medicine. Always note this is AI discussion, not medical advice.' },
  researcher:    { label: 'Medical Researcher', emoji: '🔬',   domain: 'Healthcare', prompt: 'You are a medical research AI agent. You think in terms of study design, clinical trials, data interpretation, and advancing medical knowledge. You evaluate research quality, discuss emerging findings, and identify gaps in current medical understanding.' },
  nurse:         { label: 'Nurse',              emoji: '💊',   domain: 'Healthcare', prompt: 'You are a nurse practitioner AI agent. You focus on patient care, clinical workflows, medication management, and holistic wellbeing. You bridge clinical knowledge with compassionate care and advocate for practical, patient-centered solutions.' },
};

const MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',    label: 'Llama 3.2 · 1B',  size: '~800 MB' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',    label: 'Llama 3.2 · 3B',  size: '~2 GB'   },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',    label: 'Phi-3.5 Mini',    size: '~2.2 GB' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC',            label: 'Gemma 2 · 2B',    size: '~1.5 GB' },
  { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC', label: 'Mistral 7B',      size: '~4 GB'   },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',    label: 'Qwen 2.5 · 1.5B', size: '~1 GB'   },
];

// ── Runtime state ────────────────────────────────────────────────────────────
let pm             = null;   // PeerManager instance
let engine         = null;
let myModelReady   = false;
let agentRunning   = false;
let isRoomCreator  = false;
let hasConnected   = false;
let conversationHistory = []; // [{name, content}]
let replyTimer     = null;
let speakBackoff   = 1500;   // ms; grows when others speak before our timer fires
let inviteSlotSeq  = 0;
let currentInviteSlot = null;

let myPersona    = 'developer';
let myModelId    = MODELS[0].id;
let humanGuidance = ''; // updated live by the human operator

// ── DOM refs ─────────────────────────────────────────────────────────────────
const viewSetup     = document.getElementById('view-setup');
const viewOfferer   = document.getElementById('view-offerer');
const viewAnswerer  = document.getElementById('view-answerer');
const viewLoading   = document.getElementById('view-loading');
const viewConnected = document.getElementById('view-connected');
const loadingText   = document.getElementById('loading-text');

const setupDoneBtn  = document.getElementById('setup-done-btn');
const setupSummary  = document.getElementById('setup-summary');

const offerUrlEl       = document.getElementById('offer-url');
const copyOfferUrlBtn  = document.getElementById('copy-offer-url');
const offerCopied      = document.getElementById('offer-copied');
const answerInputEl    = document.getElementById('answer-input');
const connectAnswerBtn = document.getElementById('connect-answer-btn');
const connStatusA      = document.getElementById('conn-status-a');

const answererSetupDiv  = document.getElementById('answerer-setup');
const answererTokensDiv = document.getElementById('answerer-tokens');
const answererSetupBtn  = document.getElementById('answerer-setup-btn');
const answerOutputEl    = document.getElementById('answer-output');
const copyAnswerBtn     = document.getElementById('copy-answer');
const answerCopied      = document.getElementById('answer-copied');
const connStatusB       = document.getElementById('conn-status-b');

const agentIdentityEl = document.getElementById('agent-identity');
const modelStatusTxt  = document.getElementById('model-status-text');
const modelBadge      = document.getElementById('model-badge');
const progressWrap    = document.getElementById('progress-wrap');
const progressBar     = document.getElementById('progress-bar');
const modelHint       = document.getElementById('model-hint');
const chatMessages    = document.getElementById('chat-messages');
const agentStatusEl   = document.getElementById('agent-status');
const peerLabelEl     = document.getElementById('peer-label');

// Guidance panel
const humanGuidanceEl = document.getElementById('human-guidance');
const nudgeBtn        = document.getElementById('nudge-btn');
const setupGuidanceEl = document.getElementById('setup-guidance');

// Room panel (new)
const peersListEl    = document.getElementById('peers-list');
const inviteMoreBtn  = document.getElementById('invite-more-btn');
const inviteUrlWrap  = document.getElementById('invite-url-wrap');
const inviteUrlEl    = document.getElementById('invite-url');
const copyInviteBtn  = document.getElementById('copy-invite-btn');
const inviteCopied   = document.getElementById('invite-copied');

// ── Helpers ──────────────────────────────────────────────────────────────────
function show(el) { el.style.display = 'block'; }
function hide(el) { el.style.display = 'none'; }
function getSelectedValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}
async function encodeSDP(desc) {
  const json = JSON.stringify({ type: desc.type, sdp: desc.sdp });
  const cs = new CompressionStream('deflate-raw');
  const w  = cs.writable.getWriter();
  w.write(new TextEncoder().encode(json));
  w.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  // URL-safe base64 (no padding)
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decodeSDP(token) {
  const b64    = token.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  const bytes  = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  const ds = new DecompressionStream('deflate-raw');
  const w  = ds.writable.getWriter();
  w.write(bytes);
  w.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return JSON.parse(new TextDecoder().decode(buf));
}

// ── PeerManager factory ──────────────────────────────────────────────────────
function initPM() {
  const modelLabel = MODELS.find(x => x.id === myModelId)?.label ?? myModelId;
  pm = new PeerManager({
    myName:       MY_AGENT_NAME,
    myPersona,
    myModelLabel: modelLabel,
    onPeerJoin:   handlePeerJoin,
    onPeerLeave:  handlePeerLeave,
    onMessage:    handleMsg,
    onPeerState:  handlePeerState,
  });
}

// ── Setup flow ───────────────────────────────────────────────────────────────
setupDoneBtn.addEventListener('click', () => {
  myPersona     = getSelectedValue('persona') || 'developer';
  myModelId     = getSelectedValue('model')   || MODELS[0].id;
  humanGuidance = setupGuidanceEl?.value.trim() || '';
  const p = PERSONAS[myPersona], m = MODELS.find(x => x.id === myModelId);
  setupSummary.textContent = `${p.emoji} ${p.label} · ${m.label}`;
  hide(viewSetup);
  show(viewLoading);
  startAsCreator();
});

answererSetupBtn?.addEventListener('click', () => {
  myPersona = getSelectedValue('persona-b') || 'developer';
  myModelId = getSelectedValue('model-b')   || MODELS[0].id;
  hide(answererSetupDiv);
  show(viewLoading);
  generateAnswer();
});

// ── Creator (room host) flow ─────────────────────────────────────────────────
async function startAsCreator() {
  isRoomCreator = true;
  loadingText.textContent = 'Generating WebRTC offer…';
  initPM();
  await genInvite(true);
}

async function genInvite(isFirst) {
  const slot = `slot-${++inviteSlotSeq}`;
  currentInviteSlot = slot;

  const sdp  = await pm.createOffer(slot);
  const url  = `${location.origin}${location.pathname}#offer=${await encodeSDP(sdp)}`;

  if (isFirst) {
    offerUrlEl.value = url;
    hide(viewLoading);
    show(viewOfferer);

    copyOfferUrlBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(url).catch(() => {});
      offerCopied.style.display = 'inline';
      setTimeout(() => (offerCopied.style.display = 'none'), 2500);
    });

    connectAnswerBtn.addEventListener('click', async () => {
      const raw = answerInputEl.value.trim();
      if (!raw) return;
      try {
        connectAnswerBtn.disabled = true;
        answerInputEl.disabled    = true;
        setStatus(connStatusA, 'Setting remote description…', 'connecting');
        await pm.setAnswer(slot, await decodeSDP(raw));
      } catch {
        setStatus(connStatusA, 'Invalid answer token. Try again.', 'error');
        connectAnswerBtn.disabled = false;
        answerInputEl.disabled    = false;
      }
    });
  } else {
    // Subsequent invite — display in the room panel.
    inviteUrlEl.value = url;
    show(inviteUrlWrap);
    copyInviteBtn.onclick = () => {
      navigator.clipboard.writeText(url).catch(() => {});
      inviteCopied.style.display = 'inline';
      setTimeout(() => (inviteCopied.style.display = 'none'), 2500);
    };
  }
}

// ── Joiner (answerer) flow ───────────────────────────────────────────────────
let pendingOffer = null;

async function startAsAnswerer(offerToken) {
  try { pendingOffer = await decodeSDP(offerToken); }
  catch { loadingText.textContent = '❌ Invalid invite link.'; return; }
  hide(viewLoading);
  show(viewAnswerer);
}

async function generateAnswer() {
  show(viewLoading);
  loadingText.textContent = 'Setting up WebRTC…';
  initPM();

  const sdp        = await pm.acceptOffer('host', pendingOffer);
  const token      = await encodeSDP(sdp);
  answerOutputEl.value = token;

  hide(viewLoading);
  hide(answererSetupDiv);
  show(answererTokensDiv);

  copyAnswerBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(token).catch(() => {});
    answerCopied.style.display = 'inline';
    setTimeout(() => (answerCopied.style.display = 'none'), 2500);
  });
}

// ── Peer event handlers ───────────────────────────────────────────────────────
function handlePeerState(name, state) {
  if (hasConnected) return;
  const el = isRoomCreator ? connStatusA : connStatusB;
  if (state === 'connecting') setStatus(el, 'Forming WebRTC channel…', 'connecting');
  if (state === 'failed')     setStatus(el, 'Connection failed — check tokens.', 'error');
}

function handlePeerJoin(name, hello) {
  // Transition to connected view on first peer joining.
  if (!hasConnected) {
    hasConnected = true;
    const el = isRoomCreator ? connStatusA : connStatusB;
    setStatus(el, 'WebRTC connected! 🎉', 'connected');
    onConnected();
  }

  updatePeersList();
  appendSystemMsg(`${name} joined the room`);

  // Room creator gossips existing members to the new peer, then asks each
  // existing peer to create a direct offer to the newcomer.
  if (isRoomCreator) {
    const others = pm.getConnected().filter(p => p.name !== name);
    if (others.length > 0) {
      pm.sendTo(name, {
        type: 'room-members',
        members: others.map(p => ({ name: p.name, persona: p.persona, modelLabel: p.modelLabel })),
      });
      for (const op of others) {
        pm.sendTo(op.name, { type: 'make-offer-for', target: name });
      }
    }
  }

  // Start the AI conversation once connected and model is ready.
  if (myModelReady && !agentRunning) {
    agentRunning = true;
    updateAgentStatusBar();
    if (isRoomCreator && pm.getConnected().length === 1) {
      setTimeout(() => agentSendFirst(), 600);
    }
  }
}

function handlePeerLeave(name) {
  updatePeersList();
  appendSystemMsg(`${name} left the room`);
  if (pm.getConnected().length === 0) {
    agentRunning = false;
    setAgentStatus('All peers disconnected.');
  } else {
    updateAgentStatusBar();
  }
}

async function handleMsg(fromName, msg) {
  switch (msg.type) {
    case 'chat':           onChatReceived(fromName, msg);         break;
    case 'room-members':   /* Offers will arrive via 'signal' */  break;
    case 'make-offer-for': await makeOfferFor(msg.target, fromName); break;
    case 'signal':         await handleSignal(fromName, msg);     break;
  }
}

// ── Multi-peer mesh signaling ────────────────────────────────────────────────
// Protocol:
//   Creator asks existing peer B to offer to new peer C via `make-offer-for`.
//   B creates an offer and sends it to creator as `signal {to:C, payload:{type:'offer'}}`.
//   Creator relays to C.  C answers and sends `signal {to:B, payload:{type:'answer'}}`.
//   Creator relays to B.  B sets remote answer → direct B↔C connection forms.

async function makeOfferFor(targetName, relayName) {
  const sdp = await pm.createOffer(targetName);
  pm.sendTo(relayName, {
    type:    'signal',
    to:      targetName,
    from:    MY_AGENT_NAME,
    payload: { type: 'offer', sdp: { type: sdp.type, sdp: sdp.sdp } },
  });
}

async function handleSignal(fromName, msg) {
  const { to, from, payload } = msg;

  if (isRoomCreator) {
    // We're the temporary relay — forward untouched to the target.
    pm.sendTo(to, msg);
    return;
  }

  if (to !== MY_AGENT_NAME) return;

  if (payload.type === 'offer') {
    // Someone wants to connect to us; answer and relay back through the sender.
    const sdp = await pm.acceptOffer(from, payload.sdp);
    pm.sendTo(fromName, {
      type:    'signal',
      to:      from,
      from:    MY_AGENT_NAME,
      payload: { type: 'answer', sdp: { type: sdp.type, sdp: sdp.sdp } },
    });
  } else if (payload.type === 'answer') {
    await pm.setAnswer(from, payload.sdp);
  }
}

// ── First connection: switch to connected view ────────────────────────────────
function onConnected() {
  hide(viewLoading);
  hide(viewOfferer);
  hide(viewAnswerer);
  show(viewConnected);
  showAgentIdentity();
  if (isRoomCreator) inviteMoreBtn.style.display = 'inline-block';
  if (nudgeBtn) nudgeBtn.style.display = 'inline-block';
  syncGuidanceFromSetup();
  setAgentStatus('✅ WebRTC connected — loading AI model…');
  loadModel();
}

// ── Human guidance ────────────────────────────────────────────────────────────
humanGuidanceEl?.addEventListener('input', () => {
  humanGuidance = humanGuidanceEl.value.trim();
});

// Sync setup guidance textarea → live guidance field when connected view opens.
function syncGuidanceFromSetup() {
  if (humanGuidanceEl && humanGuidance) humanGuidanceEl.value = humanGuidance;
}

nudgeBtn?.addEventListener('click', async () => {
  if (!myModelReady || !agentRunning) return;
  nudgeBtn.disabled = true;
  nudgeBtn.textContent = '…thinking';
  await agentReply();
  nudgeBtn.disabled = false;
  nudgeBtn.textContent = '💬 Nudge Now';
});

// ── Invite-more button ────────────────────────────────────────────────────────
inviteMoreBtn?.addEventListener('click', async () => {
  inviteMoreBtn.disabled    = true;
  inviteMoreBtn.textContent = 'Generating…';
  await genInvite(false);
  inviteMoreBtn.disabled    = false;
  inviteMoreBtn.textContent = '+ Invite Another Agent';
});

// ── WebGPU / WebLLM ───────────────────────────────────────────────────────────
async function checkWebGPU() {
  if (!navigator.gpu) return false;
  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  return !!adapter;
}

async function loadModel() {
  show(progressWrap);
  setModelStatus('Checking WebGPU…', 'loading');

  const gpuOk = await checkWebGPU();
  if (!gpuOk) {
    hide(progressWrap);
    setModelStatus('WebGPU not available ⚠️', 'error');
    modelHint.innerHTML =
      '<strong style="color:var(--error)">WebGPU is required for WebLLM.</strong><br>' +
      '① Open in a <strong>regular window</strong> (not Incognito)<br>' +
      '② Visit <code>chrome://flags/#enable-unsafe-webgpu</code> → Enable → Relaunch<br>' +
      '③ Check <a href="https://webgpureport.org" target="_blank">webgpureport.org</a>';
    return;
  }

  const modelLabel = MODELS.find(x => x.id === myModelId)?.label ?? myModelId;
  setModelStatus(`Loading ${modelLabel}…`, 'loading');

  engine = await webllm.CreateMLCEngine(myModelId, {
    initProgressCallback: p => {
      const pct = Math.round((p.progress ?? 0) * 100);
      progressBar.style.width = pct + '%';
      setModelStatus(p.text ?? `Loading… ${pct}%`, 'loading');
    },
  });

  hide(progressWrap);
  setModelStatus('Model ready ✓', 'ready');
  myModelReady = true;

  if (!agentRunning && pm?.getConnected().length > 0) {
    agentRunning = true;
    updateAgentStatusBar();
  }

  // If there are already messages waiting for a reply, schedule one now.
  const last = conversationHistory[conversationHistory.length - 1];
  if (last && last.name !== MY_AGENT_NAME) {
    scheduleReply();
  } else if (isRoomCreator && agentRunning && conversationHistory.length === 0) {
    setTimeout(() => agentSendFirst(), 500);
  }
}

// ── Agent conversation ────────────────────────────────────────────────────────
function buildSystemPrompt() {
  const me    = PERSONAS[myPersona];
  const peers = pm?.getConnected() ?? [];
  const peerDescs = peers
    .map(p => { const pp = PERSONAS[p.persona] ?? { label: p.persona, emoji: '🤖' }; return `${p.name} (${pp.emoji} ${pp.label})`; })
    .join(', ');
  const guidance = humanGuidance.trim();
  return (
    `Your name is ${MY_AGENT_NAME}. ${me.prompt}\n\n` +
    `You are in a peer-to-peer AI agent room — no humans, no servers. ` +
    (peerDescs ? `Other agents in the room: ${peerDescs}. ` : '') +
    `Always identify yourself as ${MY_AGENT_NAME}. Address others by name. ` +
    `Keep replies concise (2–4 sentences). Build on what others say.` +
    (guidance ? `\n\nYour operator's current instruction: "${guidance}". Incorporate this naturally.` : '')
  );
}

function buildLLMMessages() {
  const msgs = [{ role: 'system', content: buildSystemPrompt() }];
  for (const m of conversationHistory) {
    if (m.name === MY_AGENT_NAME) {
      msgs.push({ role: 'assistant', content: m.content });
    } else {
      msgs.push({ role: 'user', content: `[${m.name}]: ${m.content}` });
    }
  }
  return msgs;
}

function onChatReceived(fromName, msg) {
  conversationHistory.push({ name: fromName, content: msg.content });
  appendMessage('peer', msg.content, msg.persona, fromName);
  // Back off if a reply was already queued — another voice spoke first.
  if (replyTimer) speakBackoff = Math.min(speakBackoff * 1.5, 6000);
  scheduleReply();
}

function scheduleReply() {
  if (!myModelReady || !agentRunning) return;
  clearTimeout(replyTimer);
  const delay = speakBackoff + Math.random() * 2500;
  replyTimer = setTimeout(async () => {
    replyTimer    = null;
    speakBackoff  = 1500; // reset after quiet window
    await agentReply();
  }, delay);
}

async function agentSendFirst() {
  if (!engine) return;
  const peers = pm?.getConnected() ?? [];
  const peerList = peers
    .map(p => { const pp = PERSONAS[p.persona] ?? { label: p.persona }; return `${p.name} the ${pp.label}`; })
    .join(', ') || 'peer agents';
  const res = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: `You just connected to ${peerList}. Introduce yourself by name and role, then open with a relevant professional question or observation.` },
    ],
    temperature: 0.85,
    max_tokens:  180,
  });
  sendChat(res.choices[0].message.content.trim());
}

async function agentReply() {
  if (!engine || !pm || pm.getConnected().length === 0) return;
  const res = await engine.chat.completions.create({
    messages:    buildLLMMessages(),
    temperature: 0.85,
    max_tokens:  180,
  });
  sendChat(res.choices[0].message.content.trim());
}

function sendChat(text) {
  conversationHistory.push({ name: MY_AGENT_NAME, content: text });
  appendMessage('me', text, myPersona, MY_AGENT_NAME);
  pm.broadcast({ type: 'chat', content: text, persona: myPersona });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showAgentIdentity() {
  const p = PERSONAS[myPersona];
  const m = MODELS.find(x => x.id === myModelId);
  agentIdentityEl.innerHTML =
    `<span class="identity-name">${MY_AGENT_NAME}</span>` +
    `<span class="identity-badge">${p.emoji} ${p.label}</span>` +
    `<span class="identity-model">${m?.label ?? myModelId}</span>`;
  updatePeersList();
}

function updatePeersList() {
  if (!peersListEl) return;
  const me          = PERSONAS[myPersona];
  const myModelLbl  = MODELS.find(x => x.id === myModelId)?.label ?? myModelId;
  const connected   = pm?.getConnected() ?? [];

  let html = `
    <div class="peer-entry peer-me">
      <span class="peer-emoji">${me.emoji}</span>
      <span class="peer-name">${MY_AGENT_NAME}</span>
      <span class="peer-role">${me.label}</span>
      <span class="peer-model">${myModelLbl}</span>
      <span class="peer-pill peer-pill-you">you</span>
    </div>`;

  for (const p of connected) {
    const pp = PERSONAS[p.persona] ?? { emoji: '🤖', label: p.persona ?? 'Agent' };
    html += `
    <div class="peer-entry">
      <span class="peer-emoji">${pp.emoji}</span>
      <span class="peer-name">${p.name}</span>
      <span class="peer-role">${pp.label}</span>
      <span class="peer-model">${p.modelLabel ?? ''}</span>
      <span class="peer-pill peer-pill-on">connected</span>
    </div>`;
  }

  peersListEl.innerHTML = html;

  // Keep the legacy peer-label badge in the chat header updated.
  if (peerLabelEl) {
    if (connected.length === 0) {
      peerLabelEl.textContent = 'No peers yet';
    } else {
      peerLabelEl.textContent = connected.map(p => p.name).join(', ');
    }
  }
}

function updateAgentStatusBar() {
  const peers = pm?.getConnected() ?? [];
  if (peers.length === 0) { setAgentStatus('Waiting for peers…'); return; }
  const names = peers.map(p => p.name).join(', ');
  setAgentStatus(`${MY_AGENT_NAME} ↔ ${names} — conversation active`);
}

function appendMessage(side, text, personaKey, name) {
  const p = personaKey
    ? (PERSONAS[personaKey] ?? { emoji: '🤖', label: personaKey })
    : { emoji: '🤖', label: 'Agent' };
  const displayName = name ?? (side === 'me' ? MY_AGENT_NAME : 'Peer');

  const wrap   = document.createElement('div');
  wrap.className = `message ${side === 'me' ? 'msg-me' : 'msg-peer'}`;

  const lbl    = document.createElement('div');
  lbl.className  = 'msg-label';
  lbl.textContent = `${p.emoji} ${displayName} · ${p.label}`;

  const bubble = document.createElement('div');
  bubble.className  = 'msg-bubble';
  bubble.textContent = text;

  wrap.appendChild(lbl);
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemMsg(text) {
  const el = document.createElement('div');
  el.className   = 'msg-system';
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setStatus(el, text, state) {
  el.textContent = text;
  el.className   = `status-badge status-${state}`;
}
function setModelStatus(text, state) {
  modelStatusTxt.textContent = text;
  modelBadge.textContent     = state;
  modelBadge.className       = `status-badge status-${state}`;
}
function setAgentStatus(text) { agentStatusEl.textContent = text; }

// ── Boot ──────────────────────────────────────────────────────────────────────
const nameBanner = document.getElementById('my-name-banner');
if (nameBanner) nameBanner.textContent = MY_AGENT_NAME;

const hash       = location.hash;
const offerMatch = hash.match(/[#&]offer=([^&]+)/);

if (offerMatch) {
  hide(viewSetup);
  show(viewAnswerer);
  startAsAnswerer(offerMatch[1]);
} else {
  show(viewSetup);
}
