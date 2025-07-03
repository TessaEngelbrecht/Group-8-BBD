export class WebRTCManager {
    constructor(gameState, socketManager, uiManager) {
        this.gameState = gameState;
        this.socketManager = socketManager;
        this.uiManager = uiManager;

        this.spectatorPeerConnections = {};
        this.outgoingPeerConnections = {};
        this.pendingIceCandidates = {};
        this.socketEventListeners = {};

        this.setupSocketEvents();
    }

    setupSocketEvents() {
        const socket = this.socketManager.socket;

        socket.on('webrtc-offer', (data) => this.handleOffer(data));
        socket.on('webrtc-answer', (data) => this.handleAnswer(data));
        socket.on('webrtc-ice-candidate', (data) => this.handleIceCandidate(data));
        socket.on('spectator-watch-request', (data) => this.handleSpectatorWatchRequest(data));
    }

    // --- PLAYER (broadcaster) logic ---
    async handleSpectatorWatchRequest({ spectatorId }) {
        const videoElement = document.getElementById('webcam');
        if (!videoElement || !videoElement.srcObject) return;

        const pc = new RTCPeerConnection();
        this.outgoingPeerConnections[spectatorId] = pc;
        videoElement.srcObject.getTracks().forEach(track => pc.addTrack(track, videoElement.srcObject));

        pc.onicecandidate = event => {
            if (event.candidate) {
                this.socketManager.socket.emit('webrtc-ice-candidate', { to: spectatorId, candidate: event.candidate });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socketManager.socket.emit('webrtc-offer', { to: spectatorId, offer });
    }

    // --- SPECTATOR (viewer) logic ---
    async handleOffer({ from, offer }) {
        let pc = this.spectatorPeerConnections[from];
        if (!pc) {
            pc = new RTCPeerConnection();
            this.spectatorPeerConnections[from] = pc;
            this.pendingIceCandidates[from] = [];
            pc.ontrack = event => {
                const videoElement = document.getElementById('spectator-camera-feed');
                if (videoElement) videoElement.srcObject = event.streams[0];
            };
            pc.onicecandidate = event => {
                if (event.candidate) {
                    this.socketManager.socket.emit('webrtc-ice-candidate', { to: from, candidate: event.candidate });
                }
            };
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.socketManager.socket.emit('webrtc-answer', { to: from, answer });

            // Process any pending ICE candidates
            (this.pendingIceCandidates[from] || []).forEach(candidate => {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
            });
            this.pendingIceCandidates[from] = [];
        } catch (err) {
            console.warn('WebRTC offer error:', err);
        }
    }

    handleAnswer({ from, answer }) {
        const pc = this.outgoingPeerConnections[from];
        if (pc && pc.signalingState !== 'closed') {
            pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => { });
        }
    }

    handleIceCandidate({ from, candidate }) {
        let pc = this.spectatorPeerConnections[from] || this.outgoingPeerConnections[from];
        if (!pc || !candidate) return;

        if (pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
        } else {
            if (!this.pendingIceCandidates[from]) this.pendingIceCandidates[from] = [];
            this.pendingIceCandidates[from].push(candidate);
        }
    }

    // Clean up all peer connections (e.g., when leaving spectator mode)
    cleanupAll() {
        Object.values(this.spectatorPeerConnections).forEach(pc => pc.close());
        Object.values(this.outgoingPeerConnections).forEach(pc => pc.close());
        this.spectatorPeerConnections = {};
        this.outgoingPeerConnections = {};
        this.pendingIceCandidates = {};
        this.socketEventListeners = {};
    }
}
  