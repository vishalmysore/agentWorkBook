const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

function waitForICE(pc) {
  return new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const t = setTimeout(resolve, 12000);
    pc.addEventListener('icegatheringstatechange', function h() {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        pc.removeEventListener('icegatheringstatechange', h);
        resolve();
      }
    });
  });
}

// Full-mesh WebRTC peer manager.
// Each peer entry is keyed by a slotId initially (e.g. 'slot-1', 'host'), then re-keyed
// to the agent's real name once the hello handshake completes.
export class PeerManager {
  peers = new Map(); // key → {pc, channel, name, persona, modelLabel, state}

  constructor({ myName, myPersona, myModelLabel, onPeerJoin, onPeerLeave, onMessage, onPeerState }) {
    this.myName        = myName;
    this.myPersona     = myPersona;
    this.myModelLabel  = myModelLabel;
    this.onPeerJoin    = onPeerJoin;
    this.onPeerLeave   = onPeerLeave;
    this.onMessage     = onMessage;
    this.onPeerState   = onPeerState;
  }

  // We are the initiator: create an offer and store under slotId.
  async createOffer(slotId) {
    const pc = this._makePC(slotId);
    const channel = pc.createDataChannel('agent', { ordered: true });
    this._wire(slotId, channel);
    await pc.setLocalDescription(await pc.createOffer());
    await waitForICE(pc);
    return pc.localDescription;
  }

  // We are the answerer: accept an inbound offer stored under slotId.
  async acceptOffer(slotId, offerSdp) {
    const pc = this._makePC(slotId);
    pc.ondatachannel = e => this._wire(slotId, e.channel);
    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    await pc.setLocalDescription(await pc.createAnswer());
    await waitForICE(pc);
    return pc.localDescription;
  }

  // Complete a handshake where we were the offerer.
  async setAnswer(key, sdp) {
    const p = this.peers.get(key);
    if (p) await p.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  broadcast(msg) {
    const str = JSON.stringify(msg);
    for (const [, p] of this.peers) {
      if (p.channel?.readyState === 'open') p.channel.send(str);
    }
  }

  sendTo(name, msg) {
    const p = this.peers.get(name);
    if (p?.channel?.readyState === 'open') p.channel.send(JSON.stringify(msg));
  }

  getConnected() {
    return [...this.peers.values()].filter(p => p.state === 'connected');
  }

  _makePC(key) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peers.set(key, { pc, channel: null, name: key, persona: null, modelLabel: null, state: 'connecting' });

    pc.onconnectionstatechange = () => {
      // Find by PC reference — the map key may have changed after hello re-keying.
      let foundKey = null, foundPeer = null;
      for (const [k, p] of this.peers) {
        if (p.pc === pc) { foundKey = k; foundPeer = p; break; }
      }
      if (!foundPeer) return;
      this.onPeerState?.(foundPeer.name, pc.connectionState);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        const name = foundPeer.name;
        this.peers.delete(foundKey);
        this.onPeerLeave?.(name);
      }
    };

    return pc;
  }

  _wire(key, ch) {
    const entry = this.peers.get(key);
    if (entry) entry.channel = ch;

    ch.onopen = () => ch.send(JSON.stringify({
      type: 'hello',
      name: this.myName,
      persona: this.myPersona,
      modelLabel: this.myModelLabel,
    }));

    ch.onmessage = e => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'hello') {
        const realName = msg.name;
        let peer = this.peers.get(key);
        if (peer && key !== realName) {
          // Re-key from temporary slot ID to the peer's real name.
          this.peers.delete(key);
          peer.name = realName;
          this.peers.set(realName, peer);
        } else {
          peer = this.peers.get(realName) ?? peer;
        }
        if (peer) {
          peer.persona     = msg.persona;
          peer.modelLabel  = msg.modelLabel;
          peer.state       = 'connected';
        }
        this.onPeerJoin?.(realName, msg);
      } else {
        // After hello the key may already be the real name; fall back to channel scan.
        const peer = this.peers.get(key) ??
          [...this.peers.values()].find(p => p.channel === ch);
        this.onMessage?.(peer?.name ?? key, msg);
      }
    };
  }
}
