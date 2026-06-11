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
  detective:     { label: 'Detective',          emoji: '🕵️',  domain: 'Detective',  prompt: 'You are a private detective AI agent. You think in terms of motive, means, and opportunity. You build timelines, interrogate inconsistencies in alibis, follow the evidence wherever it leads, and form working theories of the case that you revise as new facts emerge. You are observant, sceptical, and methodical.' },
  forensic:      { label: 'Forensic Analyst',   emoji: '🔬',   domain: 'Detective',  prompt: 'You are a forensic analyst AI agent. You focus on physical evidence: fingerprints, DNA, trace materials, ballistics, digital footprints, and document analysis. You insist on chain of custody, distinguish what evidence proves from what it merely suggests, and ground every conclusion in verifiable analysis.' },
  profiler:      { label: 'Criminal Profiler',  emoji: '🧠',   domain: 'Detective',  prompt: 'You are a criminal profiler AI agent. You analyze behavior, psychology, and patterns: why a perpetrator acted, what their actions reveal about them, and how they are likely to behave next. You build offender profiles from crime scene behavior and victimology, and you challenge theories that don\'t fit the psychology.' },
  informant:     { label: 'Street Informant',   emoji: '🗞️',  domain: 'Detective',  prompt: 'You are a street informant AI agent. You know the neighborhood, the rumors, who owes whom, and what happened the night in question. You contribute local knowledge, gossip, and leads the official investigation would miss — some reliable, some needing verification. You speak plainly and colorfully.' },
};

// ── Task/project definitions, grouped by domain ─────────────────────────────
const TASKS = {
  Software: [
    { id: 'library',   label: 'Library Management System', description: 'Design and build a system for managing books, members, loans, and reservations at a library.' },
    { id: 'music',     label: 'Music Catalog System',       description: 'Design and build a system for cataloging artists, albums, tracks, and playlists.' },
    { id: 'inventory', label: 'Inventory Tracking System',  description: 'Design and build a system for tracking warehouse stock levels, suppliers, and orders.' },
    { id: 'taskboard', label: 'Task/Project Management Tool', description: 'Design and build a tool for tracking projects, tasks, assignees, and deadlines.' },
  ],
  Legal: [
    { id: 'contract-dispute', label: 'Contract Dispute Case',          description: 'Work through a case involving a breach of contract between two business parties.' },
    { id: 'employment',       label: 'Employment Discrimination Case', description: 'Work through a case involving alleged workplace discrimination.' },
    { id: 'ip-case',          label: 'Intellectual Property Case',     description: 'Work through a case involving disputed ownership of a patent or trademark.' },
    { id: 'personal-injury',  label: 'Personal Injury Case',           description: 'Work through a case involving a claim for damages after an accident.' },
  ],
  Healthcare: [
    { id: 'diabetes-care',     label: 'Diabetes Care Plan',                  description: 'Discuss a treatment, monitoring, and lifestyle plan for a newly diagnosed Type 2 diabetes patient.' },
    { id: 'post-op',           label: 'Post-Operative Recovery Case',        description: 'Discuss the recovery plan, monitoring, and follow-up care for a patient after major surgery.' },
    { id: 'outbreak-response', label: 'Infectious Disease Outbreak Response', description: 'Plan the clinical and public-health response to a localized infectious disease outbreak.' },
    { id: 'chronic-pain',      label: 'Chronic Pain Management Case',        description: 'Discuss a long-term pain management plan for a patient with chronic back pain.' },
  ],
  Detective: [
    { id: 'vanished-heiress', label: 'The Vanished Heiress',      description: 'Solve the disappearance of heiress Eleanor Voss, last seen leaving a charity gala at 11:40 PM. Her car was found abandoned by the docks, engine running, with her phone still inside. Three people had motives: a disinherited brother, a business partner facing a buyout, and a fiancé with gambling debts.' },
    { id: 'gallery-heist',    label: 'The Midnight Gallery Heist', description: 'Solve the theft of a $4M painting from the Hargrove Gallery. The alarm never triggered, the security footage has a 9-minute gap, and the night guard claims he saw nothing. A replica was left in the frame — discovered only three days later.' },
    { id: 'cold-case-1998',   label: 'The Lighthouse Cold Case (1998)', description: 'Re-open the 1998 unsolved death of lighthouse keeper Martin Crane, ruled an accident at the time. New DNA technology has surfaced an unknown profile on the railing, and a deathbed letter from a former fisherman claims "it was no accident."' },
    { id: 'poisoned-pen',     label: 'The Poisoned Pen Letters',   description: 'Identify who is sending threatening letters to members of the town council. The letters use cut-out newspaper print, show inside knowledge of council votes, and the latest one correctly predicted a fire at the mayor\'s warehouse.' },
  ],
};

// Placeholder hints for the "Agent Instructions" box, per domain.
const GUIDANCE_HINTS = {
  Software:   "Give your agent a focus… e.g. 'Always advocate for TDD' or 'Stay sceptical of new features'",
  Legal:      "Give your agent a focus… e.g. 'Push for settlement options' or 'Flag every compliance risk'",
  Healthcare: "Give your agent a focus… e.g. 'Prioritize patient safety' or 'Insist on evidence-based options'",
  Detective:  "Give your agent a focus… e.g. 'Suspect the fiancé' or 'Demand hard evidence before naming anyone'",
};

function domainOf(personaKey) {
  return PERSONAS[personaKey]?.domain ?? 'Software';
}

function findTask(domain, taskId) {
  return (TASKS[domain] ?? []).find(t => t.id === taskId) ?? null;
}

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
let myDomain     = 'Software';
let myTaskId     = '';   // '' = no specific task chosen
let lockedDomain = null; // set for answerers — domain enforced by the invite link
let lockedTaskId = null; // set for answerers when the inviter already picked a task

// Knowledge documents.
// myDocuments:   docs this agent owns — full text stays local, only summaries leave.
// peerDocuments: summaries of docs owned by other agents, keyed by docId.
let myDocuments   = new Map(); // docId → {id, name, text, summary}
let peerDocuments = new Map(); // docId → {id, name, summary, owner}
let docSeq        = 0;

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

// Documents panel
const docFileInput    = document.getElementById('doc-file-input');
const docUploadBtn    = document.getElementById('doc-upload-btn');
const docUploadStatus = document.getElementById('doc-upload-status');
const docsListEl      = document.getElementById('docs-list');

// Room panel (new)
const peersListEl    = document.getElementById('peers-list');
const inviteMoreBtn  = document.getElementById('invite-more-btn');
const inviteUrlWrap  = document.getElementById('invite-url-wrap');
const inviteUrlEl    = document.getElementById('invite-url');
const copyInviteBtn  = document.getElementById('copy-invite-btn');
const inviteCopied   = document.getElementById('invite-copied');
const inviteAnswerInputEl = document.getElementById('invite-answer-input');
const inviteConnectBtn    = document.getElementById('invite-connect-btn');
const inviteConnStatus    = document.getElementById('invite-conn-status');

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
  myDomain      = domainOf(myPersona);
  myTaskId      = getSelectedValue('task')    || '';
  humanGuidance = setupGuidanceEl?.value.trim() || '';
  const p = PERSONAS[myPersona], m = MODELS.find(x => x.id === myModelId);
  const t = findTask(myDomain, myTaskId);
  setupSummary.textContent = `${p.emoji} ${p.label} · ${m.label}` + (t ? ` · ${t.label}` : '');
  hide(viewSetup);
  show(viewLoading);
  startAsCreator();
});

// Persona radios on the setup view determine which task list is shown
// (a task belongs to the same domain as the chosen persona).
document.querySelectorAll('input[name="persona"]').forEach(el => {
  el.addEventListener('change', () => {
    updateTaskGroups('task-groups', getSelectedValue('persona'));
    updateGuidanceHint();
  });
});
updateTaskGroups('task-groups', getSelectedValue('persona'));
updateGuidanceHint();

function updateGuidanceHint() {
  const domain = domainOf(getSelectedValue('persona'));
  const hint = GUIDANCE_HINTS[domain] ?? GUIDANCE_HINTS.Software;
  if (setupGuidanceEl) setupGuidanceEl.placeholder = hint;
  if (humanGuidanceEl) humanGuidanceEl.placeholder = hint;
}

function updateTaskGroups(containerId, personaKey, domainOverride) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const domain = domainOverride || domainOf(personaKey);
  container.querySelectorAll('[data-task-domain]').forEach(group => {
    group.style.display = group.dataset.taskDomain === domain ? '' : 'none';
  });
  // Make sure a "no task" option is selected by default for the visible group.
  const visibleGroup = container.querySelector(`[data-task-domain="${domain}"]`);
  const checked = visibleGroup?.querySelector('input[type="radio"]:checked');
  if (!checked) {
    const blank = visibleGroup?.querySelector('input[type="radio"][value=""]');
    if (blank) blank.checked = true;
  }
}

answererSetupBtn?.addEventListener('click', () => {
  myPersona = getSelectedValue('persona-b') || 'developer';
  myModelId = getSelectedValue('model-b')   || MODELS[0].id;
  myDomain  = lockedDomain || domainOf(myPersona);
  myTaskId  = lockedTaskId ?? (getSelectedValue('task-b') || '');
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
  const params = new URLSearchParams();
  params.set('offer', await encodeSDP(sdp));
  params.set('domain', myDomain);
  if (myTaskId) params.set('task', myTaskId);
  const url = `${location.origin}${location.pathname}#${params.toString()}`;

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

    inviteAnswerInputEl.value    = '';
    inviteAnswerInputEl.disabled = false;
    inviteConnectBtn.disabled    = false;
    setStatus(inviteConnStatus, 'Waiting…', 'idle');

    inviteConnectBtn.onclick = async () => {
      const raw = inviteAnswerInputEl.value.trim();
      if (!raw) return;
      try {
        inviteConnectBtn.disabled    = true;
        inviteAnswerInputEl.disabled = true;
        setStatus(inviteConnStatus, 'Setting remote description…', 'connecting');
        await pm.setAnswer(slot, await decodeSDP(raw));
        setStatus(inviteConnStatus, 'WebRTC connected! 🎉', 'connected');
      } catch {
        setStatus(inviteConnStatus, 'Invalid answer token. Try again.', 'error');
        inviteConnectBtn.disabled    = false;
        inviteAnswerInputEl.disabled = false;
      }
    };
  }
}

// ── Joiner (answerer) flow ───────────────────────────────────────────────────
let pendingOffer = null;

async function startAsAnswerer(offerToken, domain, taskId) {
  try { pendingOffer = await decodeSDP(offerToken); }
  catch { loadingText.textContent = '❌ Invalid invite link.'; return; }

  lockedDomain = TASKS[domain] ? domain : 'Software';
  lockedTaskId = taskId || null;
  applyDomainLock();

  hide(viewLoading);
  show(viewAnswerer);
}

// Restrict the answerer's persona/task choices to the domain (and optionally
// the task) chosen by the room creator, so everyone in the room stays aligned.
function applyDomainLock() {
  // Persona chips: hide domains other than the locked one.
  document.querySelectorAll('#answerer-setup .domain-group[data-domain]').forEach(group => {
    group.style.display = group.dataset.domain === lockedDomain ? '' : 'none';
  });
  const checkedPersona = document.querySelector('input[name="persona-b"]:checked');
  if (!checkedPersona || domainOf(checkedPersona.value) !== lockedDomain) {
    const firstInDomain = document.querySelector(`#answerer-setup .domain-group[data-domain="${lockedDomain}"] input[name="persona-b"]`);
    if (firstInDomain) firstInDomain.checked = true;
  }

  const hint = document.getElementById('domain-lock-hint');
  if (hint) {
    hint.style.display = '';
    hint.textContent = `This room is for the ${lockedDomain} domain — your agent persona must come from here.`;
  }

  // Task: if the inviter already chose one, lock it in and hide the picker.
  const taskGroupsB = document.getElementById('task-groups-b');
  const lockedDisplay = document.getElementById('locked-task-display');
  const task = lockedTaskId ? findTask(lockedDomain, lockedTaskId) : null;
  if (task) {
    if (taskGroupsB) hide(taskGroupsB);
    if (lockedDisplay) {
      lockedDisplay.style.display = '';
      lockedDisplay.textContent = `📌 ${task.label} — ${task.description}`;
    }
  } else {
    if (lockedDisplay) hide(lockedDisplay);
    if (taskGroupsB) {
      show(taskGroupsB);
      updateTaskGroups('task-groups-b', /* force */ null, lockedDomain);
    }
  }
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

  // Share summaries of our documents with the newcomer.
  for (const doc of myDocuments.values()) {
    pm.sendTo(name, { type: 'doc-summary', docId: doc.id, docName: doc.name, summary: doc.summary, owner: MY_AGENT_NAME });
  }

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
    case 'doc-summary':    onDocSummary(fromName, msg);           break;
    case 'doc-query':      await onDocQuery(fromName, msg);       break;
    case 'doc-answer':     onDocAnswer(fromName, msg);            break;
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
  if (humanGuidanceEl) humanGuidanceEl.placeholder = GUIDANCE_HINTS[myDomain] ?? GUIDANCE_HINTS.Software;
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
  await agentReply(true); // nudged = true
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
  const task = myTaskId ? findTask(myDomain, myTaskId) : null;

  let docsBlock = '';
  const myDocLines   = [...myDocuments.values()].map(d => `- "${d.name}" (yours): ${d.summary}`);
  const peerDocLines = [...peerDocuments.values()].map(d => `- "${d.name}" [docId: ${d.id}] (owned by ${d.owner}): ${d.summary}`);
  if (myDocLines.length || peerDocLines.length) {
    docsBlock = `\n\nShared knowledge documents in this room:\n${[...myDocLines, ...peerDocLines].join('\n')}`;
    if (peerDocLines.length) {
      docsBlock +=
        `\nIf you need details from a document owned by another agent, include a line in your reply formatted exactly as: ` +
        `QUERY_DOC(docId): your specific question — the owner's agent will look it up in the full document and answer.` +
        `\nWhen another agent shares a new document, thank them by name, react to what the summary says, and if it is ` +
        `relevant to the discussion, follow up with a QUERY_DOC line asking about a specific detail.`;
    }
  }

  return (
    `Your name is ${MY_AGENT_NAME}. ${me.prompt}\n\n` +
    `You are in a peer-to-peer AI agent room — no humans, no servers. ` +
    (peerDescs ? `Other agents in the room: ${peerDescs}. ` : '') +
    (task ? `\n\nThe room's shared project is the "${task.label}": ${task.description} Keep the discussion focused on this project. ` : '') +
    `Always identify yourself as ${MY_AGENT_NAME}. Address others by name. ` +
    `Keep replies concise (2–4 sentences). Build on what others say.` +
    `\n\nYou can perform real actions by writing a line in your reply formatted exactly as ACTION_NAME(argument):\n` +
    Object.entries(AGENT_ACTIONS).map(([n, a]) => `- ${n}(argument): ${a.description}`).join('\n') +
    `\nThe result is posted back into the conversation automatically. Only use an action when it genuinely helps.` +
    docsBlock +
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
  // WebLLM requires the final message to be role 'user'.
  // This can fail when the agent speaks last (e.g. Nudge Now after own reply).
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== 'user') {
    msgs.push({ role: 'user', content: 'Please continue the conversation.' });
  }
  return msgs;
}

function onChatReceived(fromName, msg) {
  conversationHistory.push({ name: fromName, content: msg.content });
  appendMessage('peer', msg.content, msg.persona, fromName, msg.nudged);
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

async function agentReply(nudged = false) {
  if (!engine || !pm || pm.getConnected().length === 0) return;
  const res = await engine.chat.completions.create({
    messages:    buildLLMMessages(),
    temperature: 0.85,
    max_tokens:  180,
  });
  sendChat(res.choices[0].message.content.trim(), nudged);
}

function sendChat(text, nudged = false) {
  conversationHistory.push({ name: MY_AGENT_NAME, content: text });
  appendMessage('me', text, myPersona, MY_AGENT_NAME, nudged);
  pm.broadcast({ type: 'chat', content: text, persona: myPersona, nudged });
  dispatchDocQueries(text);
  dispatchActions(text);
}

// Scan agent output for QUERY_DOC(docId): question lines and route each to the
// document's owner over WebRTC.
function dispatchDocQueries(text) {
  const re = /QUERY_DOC\(([^)]+)\)\s*:\s*([^\n]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const docId    = m[1].trim();
    const question = m[2].trim();
    const doc = peerDocuments.get(docId);
    if (!doc) continue;
    pm.sendTo(doc.owner, { type: 'doc-query', docId, question, from: MY_AGENT_NAME });
    appendSystemMsg(`📨 ${MY_AGENT_NAME} queried "${doc.name}" (owned by ${doc.owner})`);
  }
}

// ── Knowledge documents ──────────────────────────────────────────────────────
const DOC_MAX_CHARS       = 60000; // cap stored text
const DOC_CONTEXT_CHARS   = 6000;  // how much raw text the local LLM sees at once

docUploadBtn?.addEventListener('click', () => docFileInput?.click());

docFileInput?.addEventListener('change', async () => {
  const file = docFileInput.files?.[0];
  if (!file) return;
  docFileInput.value = '';

  if (!myModelReady) {
    docUploadStatus.textContent = '⏳ Wait for the model to finish loading first.';
    return;
  }

  try {
    docUploadStatus.textContent = `Reading "${file.name}"…`;
    let text;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      text = await extractPdfText(file);
    } else {
      text = await file.text();
    }
    text = text.replace(/\s+\n/g, '\n').trim().slice(0, DOC_MAX_CHARS);
    if (!text) { docUploadStatus.textContent = '❌ No readable text found in that file.'; return; }

    docUploadStatus.textContent = `Summarizing "${file.name}" with local model…`;
    const summary = await summarizeDocument(file.name, text);

    const docId = `${MY_AGENT_NAME}-doc-${++docSeq}`;
    myDocuments.set(docId, { id: docId, name: file.name, text, summary });
    pm?.broadcast({ type: 'doc-summary', docId, docName: file.name, summary, owner: MY_AGENT_NAME });

    docUploadStatus.textContent = '✓ Shared with the room';
    appendSystemMsg(`📄 You shared "${file.name}" — summary sent to all connected agents`);
    renderDocsList();

    // Let the agent mention its new knowledge in conversation.
    if (agentRunning) scheduleReply();
  } catch (err) {
    console.error('Document upload failed:', err);
    docUploadStatus.textContent = `❌ Failed: ${err.message ?? err}`;
  }
});

async function extractPdfText(file) {
  // Lazy-load pdf.js only when a PDF is actually uploaded.
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc =
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = '';
  for (let i = 1; i <= pdf.numPages && out.length < DOC_MAX_CHARS; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map(it => it.str).join(' ') + '\n\n';
  }
  return out;
}

async function summarizeDocument(name, text) {
  const res = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: 'You summarize documents accurately and concisely. Output only the summary.' },
      { role: 'user',   content: `Summarize the key points of this document ("${name}") in 3-5 sentences so other AI agents know what it contains:\n\n${text.slice(0, DOC_CONTEXT_CHARS)}` },
    ],
    temperature: 0.3,
    max_tokens:  220,
  });
  return res.choices[0].message.content.trim();
}

// A peer shared a document summary with us.
function onDocSummary(fromName, msg) {
  const owner = msg.owner ?? fromName;
  peerDocuments.set(msg.docId, { id: msg.docId, name: msg.docName, summary: msg.summary, owner });
  appendSystemMsg(`📄 ${owner} shared "${msg.docName}" — your agent can now query it`);
  renderDocsList();

  // Feed the share into the conversation so our agent reacts to it:
  // acknowledge the document and ask a relevant question about it.
  conversationHistory.push({
    name: owner,
    content: `I just shared a document with the room: "${msg.docName}" [docId: ${msg.docId}]. Summary: ${msg.summary}`,
  });
  scheduleReply();
}

// A peer is asking a question about a document we own — answer with the local
// model grounded in the relevant slice of the full text.
async function onDocQuery(fromName, msg) {
  const doc = myDocuments.get(msg.docId);
  if (!doc || !engine) {
    pm.sendTo(fromName, { type: 'doc-answer', docId: msg.docId, docName: doc?.name ?? 'unknown', question: msg.question, answer: 'Sorry, I cannot answer that — document unavailable.' });
    return;
  }
  appendSystemMsg(`🔎 ${msg.from ?? fromName} is querying your document "${doc.name}"`);

  const context = pickRelevantText(doc.text, msg.question);
  const res = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: 'You answer questions strictly based on the provided document excerpt. If the answer is not in the excerpt, say so. Be concise (2-4 sentences).' },
      { role: 'user',   content: `Document "${doc.name}" excerpt:\n\n${context}\n\nQuestion from agent ${msg.from ?? fromName}: ${msg.question}` },
    ],
    temperature: 0.3,
    max_tokens:  200,
  });
  const answer = res.choices[0].message.content.trim();
  pm.sendTo(fromName, { type: 'doc-answer', docId: doc.id, docName: doc.name, question: msg.question, answer });

  // Show the exchange locally and keep it in the shared conversation context.
  const line = `📖 [from "${doc.name}"] Re: "${msg.question}" — ${answer}`;
  conversationHistory.push({ name: MY_AGENT_NAME, content: line });
  appendMessage('me', line, myPersona, MY_AGENT_NAME);
  pm.broadcast({ type: 'chat', content: line, persona: myPersona });
}

// We received a direct answer to a document query we made. The owner also
// broadcasts the answer as a regular chat message (which lands in the
// conversation history), so here we only surface a status note.
function onDocAnswer(fromName, msg) {
  appendSystemMsg(`✅ ${fromName} answered your query about "${msg.docName}"`);
}

// Crude keyword relevance: pick the chunk of the document that shares the most
// words with the question; falls back to the beginning of the document.
function pickRelevantText(text, question) {
  if (text.length <= DOC_CONTEXT_CHARS) return text;
  const words = question.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  const chunkSize = DOC_CONTEXT_CHARS;
  let best = { score: -1, start: 0 };
  for (let start = 0; start < text.length; start += Math.floor(chunkSize / 2)) {
    const chunk = text.slice(start, start + chunkSize).toLowerCase();
    let score = 0;
    for (const w of words) if (chunk.includes(w)) score++;
    if (score > best.score) best = { score, start };
  }
  return text.slice(best.start, best.start + chunkSize);
}

function renderDocsList() {
  if (!docsListEl) return;
  let html = '';
  for (const d of myDocuments.values()) {
    html += `
    <div class="doc-entry doc-mine">
      <div class="doc-title">📄 ${escapeHtml(d.name)} <span class="peer-pill peer-pill-you">yours</span></div>
      <div class="doc-summary">${escapeHtml(d.summary)}</div>
    </div>`;
  }
  for (const d of peerDocuments.values()) {
    html += `
    <div class="doc-entry">
      <div class="doc-title">📄 ${escapeHtml(d.name)} <span class="peer-pill peer-pill-on">${escapeHtml(d.owner)}</span>
        <button class="btn-doc-ask" data-doc-id="${escapeHtml(d.id)}">🔎 Ask</button>
      </div>
      <div class="doc-summary">${escapeHtml(d.summary)}</div>
      <div class="doc-ask-row" data-ask-for="${escapeHtml(d.id)}" style="display:none">
        <input type="text" class="doc-ask-input" placeholder="Ask ${escapeHtml(d.owner)} a question about this document…" />
        <button class="btn-doc-ask doc-ask-send">Send</button>
      </div>
    </div>`;
  }
  docsListEl.innerHTML = html || '<p class="muted" style="margin:0">No documents shared yet.</p>';

  docsListEl.querySelectorAll('.btn-doc-ask[data-doc-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = docsListEl.querySelector(`[data-ask-for="${CSS.escape(btn.dataset.docId)}"]`);
      if (!row) return;
      const open = row.style.display !== 'none';
      row.style.display = open ? 'none' : 'flex';
      if (!open) row.querySelector('.doc-ask-input')?.focus();
    });
  });

  docsListEl.querySelectorAll('.doc-ask-row').forEach(row => {
    const docId = row.dataset.askFor;
    const input = row.querySelector('.doc-ask-input');
    const send  = () => {
      const doc = peerDocuments.get(docId);
      const q   = input.value.trim();
      if (!doc || !q) return;
      pm.sendTo(doc.owner, { type: 'doc-query', docId: doc.id, question: q, from: MY_AGENT_NAME });
      appendSystemMsg(`📨 You asked ${doc.owner} about "${doc.name}": ${q}`);
      input.value = '';
      row.style.display = 'none';
    };
    row.querySelector('.doc-ask-send')?.addEventListener('click', send);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Agent actions ─────────────────────────────────────────────────────────────
// Real-world capabilities an agent can invoke by writing ACTION_NAME(argument)
// in its reply. Each action runs locally in this browser and its result is
// posted back into the shared conversation. Add new actions here — anything
// reachable via a CORS-enabled fetch() works (actions needing auth/payment,
// like real ticket booking, are not feasible from pure client-side JS).
const AGENT_ACTIONS = {
  SEARCH_WEB: {
    description: 'look up real-world facts and background information on the web',
    run: searchWeb,
  },
};

async function searchWeb(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=3`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`search request failed (${res.status})`);
  const data = await res.json();
  const hits = data?.query?.search ?? [];
  if (hits.length === 0) return `No results found for "${query}".`;
  return hits
    .map(h => `• ${h.title}: ${h.snippet.replace(/<[^>]+>/g, '')}…`)
    .join('\n');
}

// Scan agent output for ACTION_NAME(argument) calls and execute each.
function dispatchActions(text) {
  const re = /\b([A-Z][A-Z_]{2,})\(([^)\n]+)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1], arg = m[2].trim();
    if (name === 'QUERY_DOC') continue; // handled by dispatchDocQueries
    const action = AGENT_ACTIONS[name];
    if (!action || !arg) continue;
    runAction(name, arg);
  }
}

async function runAction(name, arg) {
  appendSystemMsg(`⚡ ${MY_AGENT_NAME} is running ${name}("${arg}")…`);
  let result;
  try {
    result = await AGENT_ACTIONS[name].run(arg);
  } catch (err) {
    result = `Action failed: ${err.message ?? err}`;
  }
  // Share the result with the whole room so every agent can build on it.
  const line = `⚡ [${name}: "${arg}"]\n${result}`;
  conversationHistory.push({ name: MY_AGENT_NAME, content: line });
  appendMessage('me', line, myPersona, MY_AGENT_NAME);
  pm?.broadcast({ type: 'chat', content: line, persona: myPersona });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showAgentIdentity() {
  const p = PERSONAS[myPersona];
  const m = MODELS.find(x => x.id === myModelId);
  agentIdentityEl.innerHTML =
    `<span class="identity-name">${MY_AGENT_NAME}</span>` +
    `<span class="identity-badge">${p.emoji} ${p.label}</span>` +
    `<span class="identity-model">${m?.label ?? myModelId}</span>`;

  const banner = document.getElementById('room-task-banner');
  if (banner) {
    const task = myTaskId ? findTask(myDomain, myTaskId) : null;
    if (task) {
      banner.style.display = '';
      banner.textContent = `📌 Project: ${task.label} — ${task.description}`;
    } else {
      banner.style.display = '';
      banner.textContent = `Domain: ${myDomain} — no specific project chosen.`;
    }
  }
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

function appendMessage(side, text, personaKey, name, nudged = false) {
  const p = personaKey
    ? (PERSONAS[personaKey] ?? { emoji: '🤖', label: personaKey })
    : { emoji: '🤖', label: 'Agent' };
  const displayName = name ?? (side === 'me' ? MY_AGENT_NAME : 'Peer');

  const wrap = document.createElement('div');
  wrap.className = `message ${side === 'me' ? 'msg-me' : 'msg-peer'}`;

  const lbl = document.createElement('div');
  lbl.className = 'msg-label';
  lbl.textContent = `${p.emoji} ${displayName} · ${p.label}`;
  if (nudged) {
    const tag = document.createElement('span');
    tag.className = 'nudge-tag';
    tag.textContent = '👤 human-guided';
    lbl.appendChild(tag);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
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

const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
const offerToken = hashParams.get('offer');

if (offerToken) {
  hide(viewSetup);
  show(viewAnswerer);
  startAsAnswerer(offerToken, hashParams.get('domain'), hashParams.get('task'));
} else {
  show(viewSetup);
}
