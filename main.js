import Gun from 'gun';
import 'gun/sea';

// Initialize Gun.js with public relay servers
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun', 'https://gun-us.herokuapp.com/gun']);
const db = gun.get('agentworkbook-v1');

// Agent class definition
class Agent {
    constructor(name, role) {
        this.name = name;
        this.role = role;
        this.keypair = null;
        this.isActive = false;
        this.tasks = [];
    }

    async generateKeypair() {
        this.keypair = await Gun.SEA.pair();
        return this.keypair.pub;
    }

    async signData(data) {
        if (!this.keypair) throw new Error('Agent keypair not generated');
        return await Gun.SEA.sign(data, this.keypair);
    }

    async verifySignature(signedData, publicKey) {
        return await Gun.SEA.verify(signedData, publicKey);
    }

    start() {
        this.isActive = true;
        addLog(`${this.name} (${this.role}) started`, 'success');
    }

    stop() {
        this.isActive = false;
        addLog(`${this.name} stopped`, 'info');
    }

    // Role-specific behaviors
    async executeRole(issue) {
        switch(this.role) {
            case 'spec-architect':
                return this.maintainSpec(issue);
            case 'scrum-bot':
                return this.manageIssues(issue);
            case 'developer':
                return this.developSolution(issue);
            case 'quality-agent':
                return this.reviewCode(issue);
            default:
                return null;
        }
    }

    maintainSpec(issue) {
        addLog(`📋 ${this.name}: Reviewing spec for issue #${issue.id}`, 'info');
        return {
            action: 'spec-review',
            approved: true,
            recommendations: ['Ensure alignment with master spec']
        };
    }

    manageIssues(issue) {
        addLog(`🎯 ${this.name}: Breaking down issue #${issue.id}`, 'info');
        return {
            action: 'breakdown',
            subtasks: Math.ceil(issue.points / 3),
            assignedAgents: []
        };
    }

    developSolution(issue) {
        addLog(`💻 ${this.name}: Claiming issue #${issue.id}`, 'success');
        return {
            action: 'claim',
            estimatedTime: issue.points * 10,
            status: 'in-progress'
        };
    }

    reviewCode(issue) {
        addLog(`✅ ${this.name}: Reviewing issue #${issue.id}`, 'info');
        return {
            action: 'review',
            approved: Math.random() > 0.3, // 70% approval rate
            feedback: ['Code looks good', 'Tests passing']
        };
    }
}

// Global state
let currentAgent = null;
let issueCounter = 0;
let peerCount = 0;
let issues = {};
let currentFilter = 'all';

// UI Elements
const elements = {
    agentRole: document.getElementById('agent-role'),
    agentName: document.getElementById('agent-name'),
    startAgentBtn: document.getElementById('start-agent'),
    stopAgentBtn: document.getElementById('stop-agent'),
    agentState: document.getElementById('agent-state'),
    agentKey: document.getElementById('agent-key'),
    createIssueBtn: document.getElementById('create-issue-btn'),
    issueTitle: document.getElementById('issue-title'),
    issueDescription: document.getElementById('issue-description'),
    issuePoints: document.getElementById('issue-points'),
    issuesContainer: document.getElementById('issues-container'),
    activityLog: document.getElementById('activity-log'),
    connectionStatus: document.getElementById('connection-status'),
    peerCount: document.getElementById('peer-count')
};

// Generate a random agent name
function generateAgentName() {
    const adjectives = ['Swift', 'Clever', 'Mighty', 'Quantum', 'Neural', 'Cyber', 'Digital', 'Prime'];
    const nouns = ['Agent', 'Bot', 'Droid', 'AI', 'Mind', 'Core', 'Unit', 'Entity'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}-${nouns[Math.floor(Math.random() * nouns.length)]}-${Math.floor(Math.random() * 999)}`;
}

// Initialize default agent name
elements.agentName.value = generateAgentName();

// Start Agent
elements.startAgentBtn.addEventListener('click', async () => {
    const name = elements.agentName.value.trim() || generateAgentName();
    const role = elements.agentRole.value;

    currentAgent = new Agent(name, role);
    const publicKey = await currentAgent.generateKeypair();
    currentAgent.start();

    // Update UI
    elements.agentState.textContent = 'Active';
    elements.agentState.style.color = 'var(--success)';
    elements.agentKey.textContent = publicKey.substring(0, 16) + '...';
    elements.startAgentBtn.disabled = true;
    elements.stopAgentBtn.disabled = false;
    elements.createIssueBtn.disabled = false;
    elements.agentName.disabled = true;
    elements.agentRole.disabled = true;

    // Subscribe to agent network
    subscribeToNetwork();
});

// Stop Agent
elements.stopAgentBtn.addEventListener('click', () => {
    if (currentAgent) {
        currentAgent.stop();
        currentAgent = null;
    }

    elements.agentState.textContent = 'Offline';
    elements.agentState.style.color = 'var(--text-secondary)';
    elements.agentKey.textContent = 'Not Generated';
    elements.startAgentBtn.disabled = false;
    elements.stopAgentBtn.disabled = true;
    elements.createIssueBtn.disabled = true;
    elements.agentName.disabled = false;
    elements.agentRole.disabled = false;
});

// Create Issue
elements.createIssueBtn.addEventListener('click', async () => {
    const title = elements.issueTitle.value.trim();
    const description = elements.issueDescription.value.trim();
    const points = parseInt(elements.issuePoints.value);

    if (!title) {
        addLog('Error: Issue title is required', 'error');
        return;
    }

    if (!currentAgent) {
        addLog('Error: Start an agent first', 'error');
        return;
    }

    const issue = {
        id: Date.now(),
        title,
        description,
        points,
        status: 'open',
        createdBy: currentAgent.name,
        createdByKey: currentAgent.keypair.pub,
        createdAt: new Date().toISOString(),
        assignedTo: null,
        comments: []
    };

    // Sign the issue
    const signedIssue = await currentAgent.signData(issue);

    // Push to Gun.js
    db.get('issues').get(issue.id.toString()).put({
        ...issue,
        signature: signedIssue
    });

    addLog(`Issue created: ${title}`, 'success');

    // Clear form
    elements.issueTitle.value = '';
    elements.issueDescription.value = '';
    elements.issuePoints.value = '3';

    // Trigger agent role behavior
    if (currentAgent) {
        setTimeout(() => {
            currentAgent.executeRole(issue);
        }, 500);
    }
});

// Subscribe to P2P network
function subscribeToNetwork() {
    // Listen for new issues
    db.get('issues').map().on((data, key) => {
        if (data && data.id) {
            issues[data.id] = data;
            renderIssues();
            
            // Auto-respond based on agent role
            if (currentAgent && currentAgent.isActive && data.createdByKey !== currentAgent.keypair?.pub) {
                setTimeout(() => {
                    handleIncomingIssue(data);
                }, Math.random() * 2000 + 1000); // Random delay 1-3 seconds
            }
        }
    });

    // Connection status
    gun.on('hi', peer => {
        peerCount++;
        elements.connectionStatus.textContent = 'Connected';
        elements.connectionStatus.classList.add('connected');
        elements.peerCount.textContent = `Peers: ${peerCount}`;
        addLog(`Connected to peer network`, 'success');
    });

    gun.on('bye', peer => {
        peerCount = Math.max(0, peerCount - 1);
        elements.peerCount.textContent = `Peers: ${peerCount}`;
    });
}

// Handle incoming issues from other agents
function handleIncomingIssue(issue) {
    if (!currentAgent || !currentAgent.isActive) return;

    // Developer agents claim open issues
    if (currentAgent.role === 'developer' && issue.status === 'open' && !issue.assignedTo) {
        const shouldClaim = Math.random() > 0.5; // 50% chance to claim
        if (shouldClaim) {
            claimIssue(issue.id);
        }
    }

    // Quality agents review in-progress issues
    if (currentAgent.role === 'quality-agent' && issue.status === 'in-progress') {
        setTimeout(() => {
            reviewIssue(issue.id);
        }, 5000);
    }

    // Scrum bot manages workflow
    if (currentAgent.role === 'scrum-bot') {
        currentAgent.executeRole(issue);
    }
}

// Claim an issue
function claimIssue(issueId) {
    const issue = issues[issueId];
    if (!issue || issue.assignedTo) return;

    const update = {
        ...issue,
        status: 'in-progress',
        assignedTo: currentAgent.name,
        assignedToKey: currentAgent.keypair.pub
    };

    db.get('issues').get(issueId.toString()).put(update);
    addLog(`Claimed issue: ${issue.title}`, 'success');

    // Simulate work completion
    setTimeout(() => {
        completeIssue(issueId);
    }, issue.points * 2000); // points * 2 seconds
}

// Complete an issue
function completeIssue(issueId) {
    const issue = issues[issueId];
    if (!issue) return;

    const update = {
        ...issue,
        status: 'review'
    };

    db.get('issues').get(issueId.toString()).put(update);
    addLog(`Completed issue: ${issue.title}`, 'success');
}

// Review an issue
function reviewIssue(issueId) {
    const issue = issues[issueId];
    if (!issue) return;

    const result = currentAgent.executeRole(issue);
    
    const update = {
        ...issue,
        status: result.approved ? 'closed' : 'open',
        reviewedBy: currentAgent.name
    };

    db.get('issues').get(issueId.toString()).put(update);
    addLog(`Reviewed issue: ${issue.title} - ${result.approved ? 'Approved' : 'Changes requested'}`, result.approved ? 'success' : 'error');
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
            </div>
            <div class="issue-actions">
                ${issue.status === 'open' && currentAgent?.role === 'developer' ? 
                    `<button class="issue-btn" onclick="claimIssue(${issue.id})">Claim</button>` : ''}
                ${issue.status === 'review' && currentAgent?.role === 'quality-agent' ? 
                    `<button class="issue-btn" onclick="reviewIssue(${issue.id})">Review</button>` : ''}
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
    
    // Keep only last 50 entries
    while (elements.activityLog.children.length > 50) {
        elements.activityLog.removeChild(elements.activityLog.lastChild);
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally for onclick handlers
window.claimIssue = claimIssue;
window.reviewIssue = reviewIssue;

// Initialize
addLog('Agent Workbook initialized', 'success');
addLog('Connecting to P2P network...', 'info');

// Simulate initial connection
setTimeout(() => {
    elements.connectionStatus.textContent = 'Connected';
    elements.connectionStatus.classList.add('connected');
    addLog('Connected to Gun.js relay servers', 'success');
}, 1000);
