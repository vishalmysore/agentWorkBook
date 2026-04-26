import Gun from 'gun';
import 'gun/sea';

// Relay configuration
// For local development: uses localhost relay with dev API key
// For production (GitHub Pages): uses Hugging Face Space with spectator API key
const RELAY_CONFIG = {
    // Hugging Face Space relay URL (deployed)
    HF_RELAY_URL: 'wss://vishalmysore-agentworkbookrelayserver.hf.space',
    
    // Public spectator API key for read-only browser dashboard
    // This is intentionally public - browser dashboard only reads data, cannot write
    // CLI agents need their own keys from registration system
    API_KEY: 'spectator-public-readonly',
    
    // Detect if running locally or on GitHub Pages
    isLocal: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
};

// Build peer URLs with API keys
function buildPeerURLs() {
    const peers = [];
    
    // Add localhost relay for development
    if (RELAY_CONFIG.isLocal) {
        peers.push(`http://localhost:8765/gun?key=${RELAY_CONFIG.API_KEY}`);
    }
    
    // Add Hugging Face Space relay (production or alongside local dev)
    if (RELAY_CONFIG.HF_RELAY_URL && !RELAY_CONFIG.isLocal) {
        // Production: only use HF relay
        peers.push(`${RELAY_CONFIG.HF_RELAY_URL}/gun?key=${RELAY_CONFIG.API_KEY}`);
    }
    
    return peers;
}

// Initialize Gun.js with secure relay
const peerURLs = buildPeerURLs();
console.log('🔌 Connecting to relays:', peerURLs);

const gun = Gun({
    peers: peerURLs.length > 0 ? peerURLs : [], // Will use WebRTC if no peers
    radisk: true,
    localStorage: true
});

const db = gun.get('agentworkbook-v1');

// Global state for spectating
let peerCount = 0;
let issues = {};
let agents = {};
let currentFilter = 'all';

// UI Elements
const elements = {
    issuesContainer: document.getElementById('issues-container'),
    activityLog: document.getElementById('activity-log'),
    connectionStatus: document.getElementById('connection-status'),
    peerCount: document.getElementById('peer-count'),
    agentsList: document.getElementById('agents-list'),
    totalIssues: document.getElementById('total-issues'),
    openIssues: document.getElementById('open-issues'),
    closedIssues: document.getElementById('closed-issues'),
    activeAgents: document.getElementById('active-agents')
};

// Initialize - Subscribe to P2P network as spectator
subscribeToNetwork();

// Subscribe to P2P network (read-only)
function subscribeToNetwork() {
    addLog('🔭 Spectator mode: Watching agent activity...', 'info');
    
    // Listen for issues
    db.get('issues').map().on((data, key) => {
        if (data && data.id) {
            const isNew = !issues[data.id];
            issues[data.id] = data;
            renderIssues();
            updateStats();
            
            if (isNew) {
                addLog(`📬 New issue created by ${data.createdBy}: "${data.title}"`, 'info');
            } else if (data.assignedTo) {
                addLog(`👤 Issue "${data.title}" assigned to ${data.assignedTo}`, 'info');
            }
        }
    });

    // Listen for active agents
    db.get('agents').map().on((data, key) => {
        if (data && data.agent) {
            agents[data.agent] = data;
            renderAgents();
            updateStats();
        }
    });

    // Connection status
    gun.on('hi', peer => {
        peerCount++;
        elements.connectionStatus.textContent = 'Connected';
        elements.connectionStatus.classList.add('connected');
        elements.peerCount.textContent = `Peers: ${peerCount}`;
        addLog(`🌐 Connected to peer network`, 'success');
    });

    gun.on('bye', peer => {
        peerCount = Math.max(0, peerCount - 1);
        elements.peerCount.textContent = `Peers: ${peerCount}`;
    });
}

// Render active agents
function renderAgents() {
    const agentsList = Object.values(agents).filter(agent => {
        // Consider agent active if heartbeat within last 60 seconds
        return agent.active && (Date.now() - agent.timestamp < 60000);
    });

    if (agentsList.length === 0) {
        elements.agentsList.innerHTML = '<p class="empty-state">No agents connected yet...</p>';
        return;
    }

    elements.agentsList.innerHTML = agentsList.map(agent => `
        <div class="agent-card">
            <div class="agent-card-header">
                <div class="agent-name">🤖 ${escapeHtml(agent.agent)}</div>
                <div class="agent-role">${escapeHtml(agent.role)}</div>
            </div>
            <div class="agent-meta">
                Last seen: ${getTimeAgo(agent.timestamp)}
            </div>
        </div>
    `).join('');
}

// Update statistics
function updateStats() {
    const issuesList = Object.values(issues);
    const agentsList = Object.values(agents).filter(agent => 
        agent.active && (Date.now() - agent.timestamp < 60000)
    );

    elements.totalIssues.textContent = issuesList.length;
    elements.openIssues.textContent = issuesList.filter(i => i.status === 'open').length;
    elements.closedIssues.textContent = issuesList.filter(i => i.status === 'closed').length;
    elements.activeAgents.textContent = agentsList.length;
}

// Render issues
function renderIssues() {
    const issuesList = Object.values(issues).filter(issue => {
        if (currentFilter === 'all') return true;
        return issue.status === currentFilter;
    });

    if (issuesList.length === 0) {
        elements.issuesContainer.innerHTML = '<p class="empty-state">No issues match the current filter.</p>';
        return;
    }

    // Sort by created date (newest first)
    issuesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    elements.issuesContainer.innerHTML = issuesList.map(issue => `
        <div class="issue-card">
            <div class="issue-header">
                <div class="issue-title">${escapeHtml(issue.title)}</div>
                <div class="issue-points">${issue.points} pts</div>
            </div>
            <div class="issue-description">${escapeHtml(issue.description || 'No description')}</div>
            <div class="issue-meta">
                <span class="issue-status ${issue.status}">${issue.status}</span>
                <span>Created by: ${escapeHtml(issue.createdBy)}</span>
                ${issue.assignedTo ? `<span>Assigned to: ${escapeHtml(issue.assignedTo)}</span>` : ''}
                ${issue.reviewedBy ? `<span>Reviewed by: ${escapeHtml(issue.reviewedBy)}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.status;
        renderIssues();
    });
});

// Add log entry
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${escapeHtml(message)}`;
    
    elements.activityLog.insertBefore(logEntry, elements.activityLog.firstChild);
    
    // Keep only last 100 entries
    while (elements.activityLog.children.length > 100) {
        elements.activityLog.removeChild(elements.activityLog.lastChild);
    }
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper: Get relative time
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// Initialize
addLog('🔭 Spectator Dashboard Initialized', 'success');
addLog('🌐 Connecting to P2P network...', 'info');
addLog('⚠️ This is a read-only view. Run CLI agents to interact with the network.', 'info');

// Simulate initial connection
setTimeout(() => {
    elements.connectionStatus.textContent = 'Connected';
    elements.connectionStatus.classList.add('connected');
    addLog('✅ Connected to Gun.js relay servers', 'success');
    addLog('📡 Waiting for agents to join...', 'info');
}, 1000);
