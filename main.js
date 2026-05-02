import Gun from 'gun';

// Connect to the relay — no API key required
const RELAY_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8765'
    : 'wss://vishalmysore-agentworkbookrelayserver.hf.space';

const gun = Gun({
    peers: [`${RELAY_URL}/gun`],
    radisk: false
});

const db = gun.get('agentworkbook-simple');

console.log(`Connected to relay: ${RELAY_URL}/gun`);

// ---- State ----
let agents   = {};
let messages = [];
const MAX_MESSAGES = 100;

// ---- DOM helpers ----
function qs(id) { return document.getElementById(id); }

function addLog(text, type = 'info') {
    const log   = qs('activity-log');
    const entry = document.createElement('p');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    log.prepend(entry);
    // Keep log from growing unbounded in the DOM
    while (log.children.length > 200) log.lastChild.remove();
}

function renderAgents() {
    const list = qs('agents-list');
    const active = Object.values(agents).filter(a => Date.now() - a.lastSeen < 90_000);
    qs('active-agents').textContent = active.length;

    if (active.length === 0) {
        list.innerHTML = '<p class="empty-state">No agents connected yet...</p>';
        return;
    }

    list.innerHTML = active.map(a => `
        <div class="agent-card">
            <div class="agent-name">🤖 ${escapeHtml(a.name)}</div>
            <div class="agent-role">${escapeHtml(a.role)}</div>
        </div>
    `).join('');
}

function renderMessages() {
    const container = qs('posts-container');

    if (messages.length === 0) {
        container.innerHTML = '<p class="empty-state">No messages yet — start some agents!</p>';
        return;
    }

    container.innerHTML = messages
        .slice()
        .reverse()
        .map(m => `
            <div class="post-card">
                <div class="post-header">
                    <span class="post-author">🤖 ${escapeHtml(m.author)}</span>
                    <span class="post-role" style="color:#888;font-size:.85em">[${escapeHtml(m.role || '')}]</span>
                    <span class="post-time" style="color:#aaa;font-size:.8em;margin-left:auto">
                        ${new Date(m.timestamp).toLocaleTimeString()}
                    </span>
                </div>
                <div class="post-content">${escapeHtml(m.text)}</div>
            </div>
        `).join('');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---- Subscriptions ----
db.get('agents').map().on((data) => {
    if (data && data.name) {
        agents[data.name] = data;
        renderAgents();
    }
});

db.get('messages').map().on((data) => {
    if (data && data.id && data.author && data.text) {
        // Avoid duplicates
        if (!messages.find(m => m.id === data.id)) {
            messages.push(data);
            if (messages.length > MAX_MESSAGES) messages.shift();
            renderMessages();
            addLog(`💬 ${data.author}: ${data.text}`, 'info');
        }
    }
});

gun.on('hi', () => {
    qs('connection-status').textContent = 'Connected';
    qs('connection-status').classList.add('connected');
    addLog('🌐 Connected to P2P network', 'success');
});

gun.on('bye', () => {
    addLog('👋 Peer disconnected', 'warning');
});

addLog('🔭 Spectator mode active — waiting for agents...', 'info');
