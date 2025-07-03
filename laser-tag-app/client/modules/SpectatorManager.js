export class SpectatorManager {
    constructor(gameState, socketManager, uiManager, webrtcManager) {
        this.gameState = gameState;
        this.socketManager = socketManager;
        this.uiManager = uiManager;
        this.webrtcManager = webrtcManager;
        this.selectedPlayerMobile = null;

        this.setupUIEvents();
    }

    setupUIEvents() {
        this.uiManager.on('selectPlayerCamera', (playerId, playerName) => this.selectPlayerCameraMobile(playerId, playerName));
        this.uiManager.on('cleanupSpectator', () => this.cleanupSpectatorConnections());
    }

    selectPlayerCameraMobile(playerId, playerName) {
        this.selectedPlayerMobile = playerId;
        document.querySelectorAll('#red-team-list li, #blue-team-list li').forEach(li => li.classList.remove('selected'));
        const selectedLi = document.querySelector(`li[data-player-id="${playerId}"]`);
        if (selectedLi) selectedLi.classList.add('selected');

        // Clean up existing connections
        this.webrtcManager.cleanupAll();

        document.getElementById('spectator-camera-feed').style.display = 'block';
        document.getElementById('spectator-camera-label').textContent = `Watching: ${playerName}`;
        this.socketManager.socket.emit('spectator-watch-player', {
            sessionId: this.gameState.sessionId,
            playerId
        });
    }

    cleanupSpectatorConnections() {
        this.webrtcManager.cleanupAll();
        this.selectedPlayerMobile = null;
    }
}
