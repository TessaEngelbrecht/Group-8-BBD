export class SocketManager {
    constructor(gameState, uiManager) {
        this.socket = io('https://group-8-bbd-production.up.railway.app', {
            transports: ['websocket']
        });
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.setupListeners();
    }

    setupListeners() {
        this.socket.on('sessionCreated', (data) => this.handleSessionCreated(data));
        this.socket.on('lobbyUpdate', (lobby) => this.handleLobbyUpdate(lobby));
        this.socket.on('gameStarted', (lobby) => this.handleGameStarted(lobby));
        this.socket.on('timerUpdate', (seconds) => this.handleTimerUpdate(seconds));
        this.socket.on('gameEnded', (winner) => this.handleGameEnded(winner));
        this.socket.on('errorMsg', (msg) => this.handleError(msg));
        this.socket.on('pointsUpdate', (data) => this.handlePointsUpdate(data));
    }

    handleSessionCreated({ sessionId, lobby }) {
        this.gameState.setHost(true);
        this.gameState.setSessionId(sessionId);
        this.uiManager.updateLobby(lobby);
        this.uiManager.switchScreen('choose-screen', 'lobby-screen');
    }

    handleLobbyUpdate(lobby) {
        this.uiManager.updateLobby(lobby);
        if (!document.getElementById('game-screen').classList.contains('hidden')) return;
        this.uiManager.switchScreen('choose-screen', 'lobby-screen');
    }

    handleGameStarted(lobby) {
        document.getElementById('particles-bg').style.display = 'none';
        this.uiManager.updateLobby(lobby);

        const me = lobby.players.find(p => p.name === this.gameState.username);
        const isSpectator = !me;

        if (isSpectator) {
            this.uiManager.switchScreen('lobby-screen', 'spectator-screen');
            this.uiManager.updateSpectatorView(lobby);
        } else {
            this.uiManager.assignTeam(lobby, this.gameState.username);
            this.uiManager.switchScreen('lobby-screen', 'game-screen');
            // Trigger webcam start event
            this.uiManager.emit('startWebcam');
        }
    }

    handleTimerUpdate(seconds) {
        this.uiManager.updateTimer(seconds);
    }

    handleGameEnded(winner) {
        this.uiManager.showGameOver(winner, this.gameState.playerTeam);
    }

    handleError(msg) {
        this.uiManager.showError(msg);
    }

    handlePointsUpdate({ red, blue, modifiers, purpleLeft }) {
        const oldPoints = { ...this.gameState.teamPoints };
        this.gameState.updateTeamPoints({ red, blue });

        // Emit damage/heal events
        if (this.gameState.playerTeam) {
            if (oldPoints[this.gameState.playerTeam] > this.gameState.teamPoints[this.gameState.playerTeam]) {
                const damage = oldPoints[this.gameState.playerTeam] - this.gameState.teamPoints[this.gameState.playerTeam];
                this.uiManager.emit('takeDamage', damage * 2);
            }

            if (oldPoints[this.gameState.playerTeam] < this.gameState.teamPoints[this.gameState.playerTeam]) {
                this.uiManager.emit('heal', 3);
            }
        }

        this.uiManager.updateUsageLog(modifiers, purpleLeft);
        this.uiManager.renderLeaderboard(this.gameState.teamPoints);
        this.uiManager.updateSpectatorView({ players: this.gameState.allPlayers });
    }

    // Socket emission methods
    createSession(username) {
        this.socket.emit('createSession', { username });
    }

    joinSession(username, sessionId, asSpectator) {
        this.socket.emit('joinSession', { username, sessionId, asSpectator });
    }

    startGame(sessionId) {
        this.socket.emit('startGame', { sessionId });
    }

    emitTeamHit(shooterTeam, victimTeam, scannedColor) {
        this.socket.emit('teamHit', {
            sessionId: this.gameState.sessionId,
            shooterTeam,
            victimTeam,
            scannedColor
        });
    }
}
  