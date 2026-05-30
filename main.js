import * as webllm from '@mlc-ai/web-llm';

// ── Random agent name generator ────────────────────────────────────────────
const NAME_PREFIXES = [
  'Aria','Atlas','Axon','Blaze','Bolt','Cleo','Coda','Cora','Dax','Drift',
  'Echo','Eden','Enki','Flux','Forge','Gale','Helix','Iris','Jade','Juno',
  'Kira','Knox','Lark','Lexa','Lumen','Luna','Lyra','Mira','Mox','Nash',
  'Neo','Nova','Nyx','Onyx','Orion','Pixel','Pulse','Quinn','Remy','Rift',
  'Rio','Rook','Sage','Scout','Seren','Shade','Sigma','Skye','Sol','Spark',
  'Sable','Tara','Thorn','Titan','Vale','Vega','Vex','Vox','Wave','Wren',
  'Xen','Zara','Zero','Zeta','Zinn','Zoe','Zuri',
];
const NAME_SUFFIXES = [
  '','','','', // blank = no suffix (more likely)
  '-7','-9','-X','·1','·2','·3',
];

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

// ── Persona definitions ────────────────────────────────────────────────────
const PERSONAS = {
  // Software
  developer: {
    label: 'Software Developer', emoji: '👨‍💻', domain: 'Software',
    prompt: 'You are a senior software developer AI agent. You think in terms of architecture, code quality, design patterns, and technical trade-offs. You discuss features from an implementation perspective, raise technical debt concerns, and advocate for clean, maintainable code.',
  },
  tester: {
    label: 'Software Tester', emoji: '🧪', domain: 'Software',
    prompt: 'You are a software testing AI agent. You think in terms of edge cases, test coverage, regression risks, and quality assurance. You challenge assumptions, probe for failure modes, and advocate for thorough testing strategies.',
  },
  ba: {
    label: 'Business Analyst', emoji: '📊', domain: 'Software',
    prompt: 'You are a business analyst AI agent. You think in terms of requirements, stakeholder needs, user stories, and business value. You bridge technical and business concerns, clarify ambiguities, and ensure solutions align with business goals.',
  },
  qa: {
    label: 'QA Engineer', emoji: '✅', domain: 'Software',
    prompt: 'You are a QA engineer AI agent. You focus on process quality, test automation, CI/CD pipelines, and release readiness. You think about metrics, defect rates, and continuous improvement of the software delivery process.',
  },

  // Legal
  lawyer: {
    label: 'Lawyer', emoji: '⚖️', domain: 'Legal',
    prompt: 'You are a legal counsel AI agent. You think in terms of statutes, case law, risk exposure, and legal strategy. You identify legal implications, cite relevant precedents, and advise on compliance and liability. Always note that this is AI discussion, not formal legal advice.',
  },
  administrator: {
    label: 'Legal Administrator', emoji: '🗂️', domain: 'Legal',
    prompt: 'You are a legal administrator AI agent. You focus on case management, court filings, document processing, deadlines, and procedural compliance. You ensure operational efficiency in legal workflows and keep processes on track.',
  },
  paralegal: {
    label: 'Paralegal', emoji: '📋', domain: 'Legal',
    prompt: 'You are a paralegal AI agent. You conduct legal research, draft documents, summarize case facts, and support attorneys. You are meticulous with details, skilled at legal writing, and knowledgeable about court procedures and legal terminology.',
  },

  // Healthcare
  doctor: {
    label: 'Doctor', emoji: '👨‍⚕️', domain: 'Healthcare',
    prompt: 'You are a medical doctor AI agent. You think in terms of diagnosis, treatment protocols, clinical evidence, and patient outcomes. You discuss medical conditions, therapies, and healthcare decisions based on evidence-based medicine. Always note this is AI discussion, not medical advice.',
  },
  researcher: {
    label: 'Medical Researcher', emoji: '🔬', domain: 'Healthcare',
    prompt: 'You are a medical research AI agent. You think in terms of study design, clinical trials, data interpretation, and advancing medical knowledge. You evaluate research quality, discuss emerging findings, and identify gaps in current medical understanding.',
  },
  nurse: {
    label: 'Nurse', emoji: '💊', domain: 'Healthcare',
    prompt: 'You are a nurse practitioner AI agent. You focus on patient care, clinical workflows, medication management, and holistic wellbeing. You bridge clinical knowledge with compassionate care and advocate for practical, patient-centered solutions.',
  },
};

const MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',  label: 'Llama 3.2 · 1B',  size: '~800 MB' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',  label: 'Llama 3.2 · 3B',  size: '~2 GB'   },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',  label: 'Phi-3.5 Mini',    size: '~2.2 GB' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC',          label: 'Gemma 2 · 2B',    size: '~1.5 GB' },
  { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC', label: 'Mistral 7B',    size: '~4 GB'   },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',  label: 'Qwen 2.5 · 1.5B', size: '~1 GB'  },
];

// Only public STUN — discovers your public IP, never sees your data
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// ── Runtime state ──────────────────────────────────────────────────────────
let pc = null;
let dataChannel = null;
let engine = null;
let myModelReady = false;
let agentRunning = false;
let isOfferer = false;
let conversationHistory = [];

let myPersona   = 'developer';
let myModelId   = MODELS[0].id;
let peerPersona = null;
let peerName    = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const viewSetup     = document.getElementById('view-setup');
const viewOfferer   = document.getElementById('view-offerer');
const viewAnswerer  = document.getElementById('view-answerer');
const viewLoading   = document.getElementById('view-loading');
const viewConnected = document.getElementById('view-connected');
const loadingText   = document.getElementById('loading-text');

// Setup (offerer)
const setupDoneBtn  = document.getElementById('setup-done-btn');
const setupSummary  = document.getElementById('setup-summary');

// Offerer
const offerUrlEl       = document.getElementById('offer-url');
const copyOfferUrlBtn  = document.getElementById('copy-offer-url');
const offerCopied      = document.getElementById('offer-copied');
const answerInputEl    = document.getElementById('answer-input');
const connectAnswerBtn = document.getElementById('connect-answer-btn');
const connStatusA      = document.getElementById('conn-status-a');

// Answerer
const answererSetupDiv  = document.getElementById('answerer-setup');
const answererTokensDiv = document.getElementById('answerer-tokens');
const answererSetupBtn  = document.getElementById('answerer-setup-btn');
const answerOutputEl    = document.getElementById('answer-output');
const copyAnswerBtn     = document.getElementById('copy-answer');
const answerCopied      = document.getElementById('answer-copied');
const connStatusB       = document.getElementById('conn-status-b');

// Connected
const agentIdentityEl = document.getElementById('agent-identity');
const modelStatusTxt  = document.getElementById('model-status-text');
const modelBadge      = document.getElementById('model-badge');
const progressWrap    = document.getElementById('progress-wrap');
const progressBar     = document.getElementById('progress-bar');
const modelHint       = document.getElementById('model-hint');
const chatMessages    = document.getElementById('chat-messages');
const agentStatusEl   = document.getElementById('agent-status');
const peerLabelEl     = document.getElementById('peer-label');

// ── Helpers ────────────────────────────────────────────────────────────────
function show(el) { el.style.display = 'block'; }
function hide(el) { el.style.display = 'none'; }

function encodeSDP(desc) {
  return btoa(JSON.stringify({ type: desc.type, sdp: desc.sdp }));
}
function decodeSDP(token) {
  return JSON.parse(atob(token.trim()));
}

function waitForICE(conn) {
  return new Promise((resolve) => {
    if (conn.iceGatheringState === 'complete') { resolve(); return; }
    const t = setTimeout(resolve, 12000);
    conn.addEventListener('icegatheringstatechange', function h() {
      if (conn.iceGatheringState === 'complete') {
        clearTimeout(t);
        conn.removeEventListener('icegatheringstatechange', h);
        resolve();
      }
    });
  });
}

function getSelectedValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

// ── Setup confirmation (offerer side) ─────────────────────────────────────
setupDoneBtn.addEventListener('click', () => {
  myPersona = getSelectedValue('persona') || 'developer';
  myModelId = getSelectedValue('model') || MODELS[0].id;
  const p = PERSONAS[myPersona];
  const m = MODELS.find(x => x.id === myModelId);
  setupSummary.textContent = `${p.emoji} ${p.label} · ${m.label}`;
  hide(viewSetup);
  show(viewLoading);
  startAsOfferer();
});

// ── Answerer setup confirmation ────────────────────────────────────────────
answererSetupBtn?.addEventListener('click', () => {
  myPersona = getSelectedValue('persona-b') || 'developer';
  myModelId = getSelectedValue('model-b') || MODELS[0].id;
  hide(answererSetupDiv);
  show(viewLoading);
  generateAnswer();
});

// ── WebRTC ────────────────────────────────────────────────────────────────
function createPC() {
  const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  conn.onconnectionstatechange = () => {
    const s = conn.connectionState;
    const statusEl = isOfferer ? connStatusA : connStatusB;
    if (s === 'connected') {
      setStatus(statusEl, 'WebRTC connected! 🎉', 'connected');
      hide(viewLoading);
      show(viewConnected);
      showAgentIdentity();
      // Don't call loadModel() here — wait for data channel to open first
    } else if (s === 'failed') {
      setStatus(statusEl, 'Connection failed — check both tokens.', 'error');
    } else if (s === 'connecting') {
      setStatus(statusEl, 'Forming WebRTC channel…', 'connecting');
    }
  };
  return conn;
}

// ── OFFERER ────────────────────────────────────────────────────────────────
async function startAsOfferer() {
  isOfferer = true;
  loadingText.textContent = 'Generating WebRTC offer…';

  pc = createPC();
  dataChannel = pc.createDataChannel('agent', { ordered: true });
  setupDataChannel(dataChannel);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  loadingText.textContent = 'Gathering ICE candidates (up to 12 s)…';
  await waitForICE(pc);

  const token = encodeSDP(pc.localDescription);
  const shareUrl = `${location.origin}${location.pathname}#offer=${token}`;
  offerUrlEl.value = shareUrl;

  hide(viewLoading);
  show(viewOfferer);

  copyOfferUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    offerCopied.style.display = 'inline';
    setTimeout(() => (offerCopied.style.display = 'none'), 2500);
  });

  connectAnswerBtn.addEventListener('click', async () => {
    const raw = answerInputEl.value.trim();
    if (!raw) return;
    try {
      connectAnswerBtn.disabled = true;
      answerInputEl.disabled = true;
      setStatus(connStatusA, 'Setting remote description…', 'connecting');
      await pc.setRemoteDescription(new RTCSessionDescription(decodeSDP(raw)));
    } catch {
      setStatus(connStatusA, 'Invalid answer token. Try again.', 'error');
      connectAnswerBtn.disabled = false;
      answerInputEl.disabled = false;
    }
  });
}

// ── ANSWERER ───────────────────────────────────────────────────────────────
let pendingOffer = null;

async function startAsAnswerer(offerToken) {
  let offer;
  try { offer = decodeSDP(offerToken); }
  catch { loadingText.textContent = '❌ Invalid invite link.'; return; }
  pendingOffer = offer;

  // Show answerer setup first
  hide(viewLoading);
  show(viewAnswerer);
}

async function generateAnswer() {
  loadingText.textContent = 'Setting up WebRTC…';
  show(viewLoading);

  pc = createPC();
  pc.ondatachannel = (e) => { dataChannel = e.channel; setupDataChannel(dataChannel); };

  await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  loadingText.textContent = 'Gathering ICE candidates (up to 12 s)…';
  await waitForICE(pc);

  const answerToken = encodeSDP(pc.localDescription);
  answerOutputEl.value = answerToken;

  hide(viewLoading);
  hide(answererSetupDiv);
  show(answererTokensDiv);

  copyAnswerBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(answerToken).catch(() => {});
    answerCopied.style.display = 'inline';
    setTimeout(() => (answerCopied.style.display = 'none'), 2500);
  });
}

// ── Data channel ───────────────────────────────────────────────────────────
function setupDataChannel(ch) {
  ch.onopen = () => {
    // Channel is guaranteed open here — safe to send hello and start model load
    ch.send(JSON.stringify({
      type: 'hello',
      persona: myPersona,
      name: MY_AGENT_NAME,
      modelLabel: MODELS.find(x => x.id === myModelId)?.label,
    }));
    setAgentStatus('✅ WebRTC channel open — loading AI model…');
    loadModel(); // start model load now that channel is ready
  };

  ch.onmessage = async (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'hello') {
      peerPersona = msg.persona;
      peerName    = msg.name || 'Peer';
      const p = PERSONAS[peerPersona] || { label: peerPersona, emoji: '🤖' };
      peerLabelEl.textContent = `↔ ${peerName} · ${p.emoji} ${p.label}${msg.modelLabel ? ' · ' + msg.modelLabel : ''}`;
      // Update agent status bar with both names now that we know the peer
      updateAgentStatusNames();
      return;
    }

    if (msg.type === 'chat') {
      appendMessage('peer', msg.content, msg.persona);
      conversationHistory.push({ role: 'user', content: msg.content });
      if (myModelReady) {
        // Model already loaded — reply straight away
        setTimeout(() => agentReply(), 600 + Math.random() * 800);
      }
      // If model still loading, agentReply() will fire once it's ready (see loadModel)
    }
  };
}

function sendMsg(obj) {
  if (dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify(obj));
  }
}

// ── Agent identity display ─────────────────────────────────────────────────
function showAgentIdentity() {
  const p = PERSONAS[myPersona];
  const m = MODELS.find(x => x.id === myModelId);
  agentIdentityEl.innerHTML =
    `<span class="identity-name">${MY_AGENT_NAME}</span>` +
    `<span class="identity-badge">${p.emoji} ${p.label}</span>` +
    `<span class="identity-model">${m?.label || myModelId}</span>`;
}

function updateAgentStatusNames() {
  if (!agentRunning) {
    const p  = PERSONAS[myPersona];
    const pp = peerPersona ? (PERSONAS[peerPersona] || { label: peerPersona, emoji: '🤖' }) : null;
    if (pp && peerName) {
      setAgentStatus(`${MY_AGENT_NAME} (${p.emoji} ${p.label}) ↔ ${peerName} (${pp.emoji} ${pp.label})`);
    }
  }
}

// ── WebLLM ─────────────────────────────────────────────────────────────────
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

  setModelStatus(`Loading ${MODELS.find(x => x.id === myModelId)?.label || myModelId}…`, 'loading');

  engine = await webllm.CreateMLCEngine(myModelId, {
    initProgressCallback: (p) => {
      const pct = Math.round((p.progress || 0) * 100);
      progressBar.style.width = pct + '%';
      setModelStatus(p.text || `Loading… ${pct}%`, 'loading');
    },
  });

  hide(progressWrap);
  setModelStatus('Model ready ✓', 'ready');
  myModelReady = true;

  // If peer already sent us a message while our model was loading, reply now
  const lastMsg = conversationHistory[conversationHistory.length - 1];
  if (lastMsg?.role === 'user') {
    setAgentStatus('🤖 Model loaded — replying to peer…');
    setTimeout(() => agentReply(), 500);
  } else {
    maybeStartAgents();
  }
}

// ── Agent conversation ─────────────────────────────────────────────────────
function maybeStartAgents() {
  // Only need MY model ready — peer independently manages their side
  if (agentRunning) return;
  if (!myModelReady) return;
  if (dataChannel?.readyState !== 'open') return;

  agentRunning = true;
  const p  = PERSONAS[myPersona];
  const pp = peerPersona ? (PERSONAS[peerPersona] || { label: peerPersona, emoji: '🤖' }) : { label: 'peer agent', emoji: '🤖' };
  const peerDisplay = peerName ? `${peerName} (${pp.emoji} ${pp.label})` : `${pp.emoji} ${pp.label}`;
  setAgentStatus(`${MY_AGENT_NAME} (${p.emoji} ${p.label}) ↔ ${peerDisplay} — conversation active`);

  // Offerer kicks off the conversation; answerer waits for first message
  if (isOfferer) setTimeout(() => agentSendFirst(), 500);
}

function buildSystemPrompt() {
  const me = PERSONAS[myPersona];
  const peer = peerPersona ? (PERSONAS[peerPersona] || null) : null;
  const peerDesc = peer
    ? `You are speaking with ${peerName || 'a peer agent'}, a ${peer.label} (${peer.domain} domain).`
    : 'You are speaking with another AI agent.';
  return (
    `Your name is ${MY_AGENT_NAME}. ${me.prompt}\n\n` +
    `You are communicating directly over a peer-to-peer WebRTC connection — no humans, no servers. ` +
    `${peerDesc} ` +
    `Always refer to yourself as ${MY_AGENT_NAME} and address the other agent by name when you know it. ` +
    `Have a professional, insightful conversation relevant to both your roles. ` +
    `Keep each reply concise — 2-4 sentences. Build on what the other agent says.`
  );
}

async function agentSendFirst() {
  if (!engine) return;
  const peer = peerPersona ? (PERSONAS[peerPersona] || { label: peerPersona }) : { label: 'peer agent' };
  const me = PERSONAS[myPersona];
  const peerDisplay = peerName ? `${peerName} the ${peer.label}` : `a ${peer.label}`;
  const res = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: `Your name is ${MY_AGENT_NAME}. You just connected peer-to-peer with ${peerDisplay}. Introduce yourself by name and role, then start a relevant professional conversation.` },
    ],
    temperature: 0.85,
    max_tokens: 180,
  });
  sendChat(res.choices[0].message.content.trim());
}

async function agentReply() {
  if (!engine || dataChannel?.readyState !== 'open') return;
  const res = await engine.chat.completions.create({
    messages: [{ role: 'system', content: buildSystemPrompt() }, ...conversationHistory],
    temperature: 0.85,
    max_tokens: 180,
  });
  sendChat(res.choices[0].message.content.trim());
}

function sendChat(text) {
  conversationHistory.push({ role: 'assistant', content: text });
  appendMessage('me', text, myPersona);
  sendMsg({ type: 'chat', content: text, persona: myPersona });
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function appendMessage(side, text, personaKey) {
  const p = personaKey ? (PERSONAS[personaKey] || { emoji: '🤖', label: personaKey }) : { emoji: '🤖', label: 'Agent' };
  const name = side === 'me' ? MY_AGENT_NAME : (peerName || 'Peer');

  const wrap = document.createElement('div');
  wrap.className = `message ${side === 'me' ? 'msg-me' : 'msg-peer'}`;

  const lbl = document.createElement('div');
  lbl.className = 'msg-label';
  lbl.textContent = `${p.emoji} ${name} · ${p.label}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  wrap.appendChild(lbl);
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setStatus(el, text, state) {
  el.textContent = text;
  el.className = `status-badge status-${state}`;
}
function setModelStatus(text, state) {
  modelStatusTxt.textContent = text;
  modelBadge.textContent = state;
  modelBadge.className = `status-badge status-${state}`;
}
function setAgentStatus(text) { agentStatusEl.textContent = text; }

// ── Boot ───────────────────────────────────────────────────────────────────

// Show name on setup banner
const nameBanner = document.getElementById('my-name-banner');
if (nameBanner) nameBanner.textContent = MY_AGENT_NAME;

const hash = location.hash;
const offerMatch = hash.match(/[#&]offer=([^&]+)/);

if (offerMatch) {
  // User B — show their setup first, then generate answer
  hide(viewSetup);
  show(viewAnswerer);
  startAsAnswerer(offerMatch[1]);
} else {
  // User A — show setup, then generate offer on confirm
  show(viewSetup);
}
