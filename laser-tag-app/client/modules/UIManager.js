export class UIManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.eventHandlers = {};
        this.initDOMElements();
    }

    initDOMElements() {
        // Screens
        this.loginScreen = document.getElementById('login-screen');
        this.chooseScreen = document.getElementById('choose-screen');
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.spectatorScreen = document.getElementById('spectator-screen');
        this.gameOverOverlay = document.getElementById('game-over-overlay');

        // Elements
        this.timerPlayer = document.getElementById('game-timer-player');
        this.timerSpectator = document.getElementById('game-timer-spectator');
        this.winnerText = document.getElementById('winner-text');
        this.usernameInput = document.getElementById('username');
        this.joinCodeInput = document.getElementById('join-code');
    }

    // Event system for communication between modules
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    emit(event, ...args) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => handler(...args));
        }
    }

    switchScreen(hideId, showId) {
        if (hideId === 'spectator-screen') {
            this.emit('cleanupSpectator');
        }
        document.getElementById(hideId).classList.add('hidden');
        document.getElementById(showId).classList.remove('hidden');
    }

    updateLobby(lobby) {
        document.getElementById('game-id-display').textContent = this.gameState.sessionId;

        const redPlayers = document.getElementById('red-players');
        const bluePlayers = document.getElementById('blue-players');
        const spectatorsList = document.getElementById('spectators-list');

        redPlayers.innerHTML = '';
        bluePlayers.innerHTML = '';
        spectatorsList.innerHTML = '';

        this.gameState.setPlayers(lobby.players);

        lobby.players.forEach((player, index) => {
            const li = document.createElement('li');
            li.textContent = player.name;
            li.className = 'player-item';

            if (index % 2 === 0) {
                li.classList.add('red-player');
                redPlayers.appendChild(li);
            } else {
                li.classList.add('blue-player');
                bluePlayers.appendChild(li);
            }
        });

        lobby.spectators.forEach(spectator => {
            const li = document.createElement('li');
            li.textContent = spectator.name;
            li.className = 'spectator-item';
            spectatorsList.appendChild(li);
        });

        const statusText = this.getGameStatusText(lobby);
        document.getElementById('game-status').textContent = statusText;
        this.updateStartGameButton(lobby);
        this.renderLeaderboard(this.gameState.teamPoints);
    }

    getGameStatusText(lobby) {
        if (lobby.started) return 'Mission Active!';
        if (lobby.players.length < 2 || lobby.players.length % 2 !== 0) {
            return 'Awaiting warriors (minimum 2, even numbers)...';
        }
        return 'Ready for deployment!';
    }

    updateStartGameButton(lobby) {
        const canStart = this.gameState.isHost &&
            !lobby.started &&
            lobby.players.length >= 2 &&
            lobby.players.length % 2 === 0;

        document.getElementById('start-game-btn').classList.toggle('hidden', !canStart);
    }

    assignTeam(lobby, username) {
        const index = lobby.players.findIndex(p => p.name === username);
        if (index !== -1) {
            const team = index % 2 === 0 ? 'red' : 'blue';
            this.gameState.setPlayerTeam(team);

            const indicator = document.getElementById('player-symbol');
            indicator.textContent = `TEAM ${team.toUpperCase()}`;
            indicator.className = `team-indicator ${team}`;
            this.setTeamAmbient(team);
        }
    }

    setTeamAmbient(team) {
        const ambient = document.getElementById('team-ambient');
        ambient.classList.remove('hidden', 'red-ambient', 'blue-ambient');
        if (team) {
            ambient.classList.add(`${team}-ambient`);
        }
    }

    updateTimer(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const formatted = `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;

        if (this.timerPlayer) this.timerPlayer.textContent = formatted;
        if (this.timerSpectator) this.timerSpectator.textContent = formatted;
    }

    showGameOver(winner, playerTeam) {
        const videoElement = document.getElementById('webcam');
        if (videoElement && typeof videoElement.pause === 'function') {
            videoElement.pause();
        }

        document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
        this.gameOverOverlay.classList.remove('hidden');

        const isSpectator = !playerTeam;

        if (winner === 'draw') {
            this.winnerText.textContent = `🤝 It's a DRAW!`;
        } else if (isSpectator) {
            const teamName = winner === 'red' ? 'RED' : 'BLUE';
            const emoji = winner === 'red' ? '🔴' : '🔵';
            this.winnerText.textContent = `${emoji} ${teamName} TEAM WON!`;
        } else if (playerTeam === winner) {
            this.winnerText.textContent = `🏆 Your Team (${winner.toUpperCase()}) WON!`;
            this.emit('launchConfetti');
        } else {
            this.winnerText.textContent = `💀 Your Team LOST...`;
        }
    }

    showError(msg) {
        alert(msg);
        if (msg.includes('Username already taken')) {
            this.switchScreen('choose-screen', 'login-screen');
            this.usernameInput.value = '';
        }
    }

    renderLeaderboard(teamPoints) {
        const leaderboard = document.getElementById('leaderboard');
        if (!leaderboard) return;

        leaderboard.innerHTML = `
        <div class="score-item red-score">
          <div class="team-label">🔴 RED</div>
          <div class="score-value">${teamPoints.red}</div>
        </div>
        <div class="score-item blue-score">
          <div class="team-label">🔵 BLUE</div>
          <div class="score-value">${teamPoints.blue}</div>
        </div>
      `;
    }

    updateUsageLog(modifiers = {}, purpleLeft = {}) {
        const modLogs = document.getElementsByClassName('modifiers-log');
        const purpleLogs = document.getElementsByClassName('purple-log');

        const modContent = `
        <strong>🔥 Shot Damage Modifiers:</strong><br>
        🔴 Red: ${modifiers?.red ?? '?'}<br>
        🔵 Blue: ${modifiers?.blue ?? '?'}
      `;

        const purpleContent = `
        <strong>🍇 Purple Scans Left:</strong><br>
        🔴 Red: ${purpleLeft?.red ?? '?'}<br>
        🔵 Blue: ${purpleLeft?.blue ?? '?'}
      `;

        Array.from(modLogs).forEach(log => log.innerHTML = modContent);
        Array.from(purpleLogs).forEach(log => log.innerHTML = purpleContent);
    }

    updateSpectatorView(lobby) {
        const redList = document.getElementById('red-team-list');
        const blueList = document.getElementById('blue-team-list');
        const redScore = document.getElementById('red-score');
        const blueScore = document.getElementById('blue-score');

        if (!redList || !blueList) return;

        redList.innerHTML = '';
        blueList.innerHTML = '';

        lobby.players.forEach((player, index) => {
            const li = document.createElement('li');
            li.textContent = player.name;
            li.dataset.playerId = player.id;
            li.dataset.playerName = player.name;
            li.dataset.team = index % 2 === 0 ? 'red' : 'blue';
            li.style.cursor = 'pointer';
            li.onclick = () => this.emit('selectPlayerCamera', player.id, player.name);

            if (index % 2 === 0) {
                redList.appendChild(li);
            } else {
                blueList.appendChild(li);
            }
        });

        if (redScore) redScore.textContent = this.gameState.teamPoints.red;
        if (blueScore) blueScore.textContent = this.gameState.teamPoints.blue;
    }
}
  