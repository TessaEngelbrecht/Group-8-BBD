// app.js - Laser Tag Game Client
class LaserTagGame {
  constructor() {
    this.socket = io('https://group-8-bbd-production.up.railway.app', {
      transports: ['websocket']
    });

    // Game state
    this.username = '';
    this.sessionId = '';
    this.isHost = false;
    this.allPlayers = [];
    this.playerTeam = null;
    this.teamPoints = { red: 100, blue: 100 };
    this.playerHealth = 100;
    this.bloodSplats = [];
    this.maxBloodSplats = 15;

    // WebRTC connections
    this.spectatorPeerConnections = {};
    this.outgoingPeerConnections = {};
    this.selectedPlayerMobile = null;
    this.pendingIceCandidates = {};
    this.socketEventListeners = {};

    // DOM elements
    this.initDOMElements();

    // Initialize
    this.init();
  }

  initDOMElements() {
    // Screens
    this.loginScreen = document.getElementById('login-screen');
    this.chooseScreen = document.getElementById('choose-screen');
    this.lobbyScreen = document.getElementById('lobby-screen');
    this.gameScreen = document.getElementById('game-screen');
    this.spectatorScreen = document.getElementById('spectator-screen');
    this.gameOverOverlay = document.getElementById('game-over-overlay');

    // Game elements
    this.canvasElement = document.getElementById('overlay');
    this.ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });
    this.videoElement = document.getElementById('webcam');
    this.timerPlayer = document.getElementById('game-timer-player');
    this.timerSpectator = document.getElementById('game-timer-spectator');
    this.winnerText = document.getElementById('winner-text');

    // Buttons
    this.continueBtn = document.getElementById('continue-btn');
    this.createBtn = document.getElementById('create-session-btn');
    this.joinPlayerBtn = document.getElementById('join-player-btn');
    this.joinSpectatorBtn = document.getElementById('join-spectator-btn');
    this.startGameBtn = document.getElementById('start-game-btn');
    this.copyGameIdBtn = document.getElementById('copy-game-id-btn');
    this.shootBtn = document.getElementById('shoot-btn');
    this.restartBtn = document.getElementById('restart-btn');

    // Inputs
    this.usernameInput = document.getElementById('username');
    this.joinCodeInput = document.getElementById('join-code');
  }

  init() {
    this.setupEventListeners();
    this.setupSocketListeners();
    this.addCustomStyles();
    this.preventDoubleClick();
  }

  setupEventListeners() {
    this.continueBtn.addEventListener('click', () => this.handleContinue());
    this.createBtn.addEventListener('click', () => this.handleCreateSession());
    this.joinPlayerBtn.addEventListener('click', () => this.handleJoinPlayer());
    this.joinSpectatorBtn.addEventListener('click', () => this.handleJoinSpectator());
    this.startGameBtn.addEventListener('click', () => this.handleStartGame());
    this.copyGameIdBtn.addEventListener('click', () => this.handleCopyGameId());
    this.shootBtn.addEventListener('click', () => this.detectColor());
    this.restartBtn.addEventListener('click', () => window.location.reload());

    window.addEventListener('resize', () => this.handleWindowResize());
  }

  setupSocketListeners() {
    this.socket.on('sessionCreated', (data) => this.handleSessionCreated(data));
    this.socket.on('lobbyUpdate', (lobby) => this.handleLobbyUpdate(lobby));
    this.socket.on('gameStarted', (lobby) => this.handleGameStarted(lobby));
    this.socket.on('timerUpdate', (seconds) => this.handleTimerUpdate(seconds));
    this.socket.on('gameEnded', (winner) => this.handleGameEnded(winner));
    this.socket.on('errorMsg', (msg) => this.handleError(msg));
    this.socket.on('pointsUpdate', (data) => this.handlePointsUpdate(data));

    // WebRTC events
    this.socket.on('webrtc-offer', (data) => this.handleWebRTCOffer(data));
    this.socket.on('webrtc-answer', (data) => this.handleWebRTCAnswer(data));
    this.socket.on('webrtc-ice-candidate', (data) => this.handleWebRTCIceCandidate(data));
    this.socket.on('spectator-watch-request', (data) => this.handleSpectatorWatchRequest(data));
  }

  // Event Handlers
  handleContinue() {
    this.username = this.usernameInput.value.trim();

    if (!this.username) {
      alert('Username cannot be empty');
      return;
    }

    if (this.username.length > 15) {
      alert('Username cannot be longer than 15 characters');
      return;
    }

    document.getElementById('display-username').textContent = this.username;
    this.switchScreen('login-screen', 'choose-screen');
  }

  handleCreateSession() {
    this.socket.emit('createSession', { username: this.username });
  }

  handleJoinPlayer() {
    this.sessionId = this.joinCodeInput.value.trim();
    if (this.sessionId) {
      this.socket.emit('joinSession', {
        username: this.username,
        sessionId: this.sessionId,
        asSpectator: false
      });
    }
  }

  handleJoinSpectator() {
    this.sessionId = this.joinCodeInput.value.trim();
    if (this.sessionId) {
      this.socket.emit('joinSession', {
        username: this.username,
        sessionId: this.sessionId,
        asSpectator: true
      });
    }
  }

  handleStartGame() {
    this.socket.emit('startGame', { sessionId: this.sessionId });
  }

  handleCopyGameId() {
    navigator.clipboard.writeText(this.sessionId);
    alert('Game code copied!');
  }

  handleWindowResize() {
    if (!this.spectatorScreen.classList.contains('hidden')) {
      this.updateSpectatorView({ players: this.allPlayers });
    }
  }

  // Socket Event Handlers
  handleSessionCreated({ sessionId, lobby }) {
    this.isHost = true;
    this.sessionId = sessionId;
    this.updateLobby(lobby);
    this.switchScreen('choose-screen', 'lobby-screen');
  }

  handleLobbyUpdate(lobby) {
    this.updateLobby(lobby);
    if (!this.gameScreen.classList.contains('hidden')) return;
    this.switchScreen('choose-screen', 'lobby-screen');
  }

  handleGameStarted(lobby) {
    document.getElementById('particles-bg').style.display = 'none';
    this.updateLobby(lobby);

    const me = lobby.players.find(p => p.name === this.username);
    const isSpectator = !me;

    if (isSpectator) {
      this.switchScreen('lobby-screen', 'spectator-screen');
      this.updateSpectatorView(lobby);
    } else {
      this.assignTeam(lobby);
      this.switchScreen('lobby-screen', 'game-screen');
      this.startWebcam();
    }
  }

  handleTimerUpdate(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;

    if (this.timerPlayer) this.timerPlayer.textContent = formatted;
    if (this.timerSpectator) this.timerSpectator.textContent = formatted;
  }

  handleGameEnded(winner) {
    if (this.videoElement && typeof this.videoElement.pause === 'function') {
      this.videoElement.pause();
    }

    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    this.gameOverOverlay.classList.remove('hidden');

    const isSpectator = !this.playerTeam;

    if (winner === 'draw') {
      this.winnerText.textContent = `🤝 It's a DRAW!`;
    } else if (isSpectator) {
      const teamName = winner === 'red' ? 'RED' : 'BLUE';
      const emoji = winner === 'red' ? '🔴' : '🔵';
      this.winnerText.textContent = `${emoji} ${teamName} TEAM WON!`;
    } else if (this.playerTeam === winner) {
      this.winnerText.textContent = `🏆 Your Team (${winner.toUpperCase()}) WON!`;
      this.launchConfetti();
    } else {
      this.winnerText.textContent = `💀 Your Team LOST...`;
    }
  }

  handleError(msg) {
    alert(msg);
    if (msg.includes('Username already taken')) {
      this.switchScreen('choose-screen', 'login-screen');
      this.usernameInput.value = '';
    }
  }

  handlePointsUpdate({ red, blue, modifiers, purpleLeft }) {
    const oldTeamPoints = { ...this.teamPoints };
    this.teamPoints = { red, blue };

    // Handle damage/healing effects
    if (this.playerTeam) {
      if (oldTeamPoints[this.playerTeam] > this.teamPoints[this.playerTeam]) {
        const damage = oldTeamPoints[this.playerTeam] - this.teamPoints[this.playerTeam];
        this.takeDamage(damage * 2);
      }

      if (oldTeamPoints[this.playerTeam] < this.teamPoints[this.playerTeam]) {
        this.healPlayer(3);
      }
    }

    this.updateUsageLog(modifiers, purpleLeft);
    this.renderLeaderboard();
    this.updateSpectatorView({ players: this.allPlayers });
    this.checkGameOver();
  }

  // WebRTC Handlers
  async handleWebRTCOffer({ from, offer }) {
    const pc = this.spectatorPeerConnections[from];
    if (!pc || pc.signalingState === 'closed') return;

    try {
      if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('webrtc-answer', { to: from, answer });
        this.processPendingCandidates(from);
      }
    } catch (error) {
      console.warn(`WebRTC offer error for player ${from}:`, error);
    }
  }

  handleWebRTCAnswer({ from, answer }) {
    const pc = this.outgoingPeerConnections[from];
    if (pc && pc.signalingState !== 'stable' && pc.signalingState !== 'closed') {
      pc.setRemoteDescription(new RTCSessionDescription(answer))
        .catch(error => console.warn('WebRTC answer error:', error));
    }
  }

  handleWebRTCIceCandidate({ from, candidate }) {
    const pc = this.spectatorPeerConnections[from];
    if (!pc || !candidate) return;

    if (pc.remoteDescription) {
      pc.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(error => console.warn(`Failed to add ICE candidate for ${from}:`, error));
    } else {
      if (!this.pendingIceCandidates[from]) {
        this.pendingIceCandidates[from] = [];
      }
      this.pendingIceCandidates[from].push(candidate);
    }
  }

  async handleSpectatorWatchRequest({ spectatorId }) {
    if (!this.videoElement.srcObject) return;

    const pc = new RTCPeerConnection();
    this.outgoingPeerConnections[spectatorId] = pc;

    this.videoElement.srcObject.getTracks().forEach(track => {
      pc.addTrack(track, this.videoElement.srcObject);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc-ice-candidate', {
          to: spectatorId,
          candidate: event.candidate
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.socket.emit('webrtc-offer', { to: spectatorId, offer });
  }

  // Game Logic Methods
  switchScreen(hideId, showId) {
    if (hideId === 'spectator-screen') {
      this.cleanupSpectatorConnections();
    }
    document.getElementById(hideId).classList.add('hidden');
    document.getElementById(showId).classList.remove('hidden');
  }

  updateLobby(lobby) {
    document.getElementById('game-id-display').textContent = this.sessionId;

    const redPlayers = document.getElementById('red-players');
    const bluePlayers = document.getElementById('blue-players');
    const spectatorsList = document.getElementById('spectators-list');

    redPlayers.innerHTML = '';
    bluePlayers.innerHTML = '';
    spectatorsList.innerHTML = '';

    this.allPlayers = lobby.players;

    this.allPlayers.forEach((player, index) => {
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
    this.renderLeaderboard();
  }

  getGameStatusText(lobby) {
    if (lobby.started) {
      return 'Mission Active!';
    }

    if (lobby.players.length < 2 || lobby.players.length % 2 !== 0) {
      return 'Awaiting warriors (minimum 2, even numbers)...';
    }

    return 'Ready for deployment!';
  }

  updateStartGameButton(lobby) {
    const canStart = this.isHost &&
      !lobby.started &&
      lobby.players.length >= 2 &&
      lobby.players.length % 2 === 0;

    this.startGameBtn.classList.toggle('hidden', !canStart);
  }

  assignTeam(lobby) {
    const index = lobby.players.findIndex(p => p.name === this.username);
    if (index !== -1) {
      this.playerTeam = index % 2 === 0 ? 'red' : 'blue';
      const indicator = document.getElementById('player-symbol');
      indicator.textContent = `TEAM ${this.playerTeam.toUpperCase()}`;
      indicator.className = `team-indicator ${this.playerTeam}`;
      this.setTeamAmbient(this.playerTeam);
    }
  }

  setTeamAmbient(team) {
    const ambient = document.getElementById('team-ambient');
    ambient.classList.remove('hidden', 'red-ambient', 'blue-ambient');
    if (team) {
      ambient.classList.add(`${team}-ambient`);
    }
  }

  startWebcam() {
    const constraints = {
      video: { facingMode: { exact: "environment" } }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => this.handleWebcamSuccess(stream))
      .catch(() => this.fallbackToDefaultCamera());
  }

  handleWebcamSuccess(stream) {
    this.videoElement.srcObject = stream;
    this.videoElement.play();

    this.canvasElement.width = this.videoElement.videoWidth || 640;
    this.canvasElement.height = this.videoElement.videoHeight || 480;

    this.initBloodSystem();
  }

  fallbackToDefaultCamera() {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => this.handleWebcamSuccess(stream))
      .catch(() => alert('Camera access denied or not available'));
  }

  detectColor() {
    this.ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
    const frame = this.ctx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
    const detectedColor = this.detectDominantColor(frame.data);

    if (detectedColor) {
      this.handleColorDetected(detectedColor);
    }
  }

  detectDominantColor(data) {
    const colorCounts = { red: 0, blue: 0, purple: 0, yellow: 0 };
    const threshold = 2000;

    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];

      if (r > 180 && g < 100 && b < 100) colorCounts.red++;
      else if (b > 150 && r < 100 && g < 100) colorCounts.blue++;
      else if (r > 100 && b > 100 && g < 80) colorCounts.purple++;
      else if (r > 200 && g > 200 && b < 100) colorCounts.yellow++;
    }

    return Object.entries(colorCounts)
      .find(([, count]) => count > threshold)?.[0] || null;
  }

  handleColorDetected(color) {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    this.socket.emit('teamHit', {
      sessionId: this.sessionId,
      shooterTeam: this.playerTeam,
      victimTeam: this.playerTeam === 'red' ? 'blue' : 'red',
      scannedColor: color
    });

    this.showScanToast(color);
  }

  showScanToast(color) {
    const toast = document.createElement('div');
    toast.textContent = `🎯 Scanned: ${color.toUpperCase()}`;
    toast.className = 'scan-toast';
    toast.style.cssText = this.getScanToastStyles();

    document.body.appendChild(toast);
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 2000);
  }

  getScanToastStyles() {
    return `
      position: fixed;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: var(--neon-yellow);
      padding: 8px 16px;
      border-radius: 20px;
      border: 1px solid var(--neon-yellow);
      z-index: 9999;
      font-family: 'Orbitron', monospace;
      font-weight: 700;
      font-size: 0.9rem;
      text-shadow: 0 0 10px currentColor;
      animation: scanToast 2s ease-out forwards;
    `;
  }

  // Blood System Methods
  initBloodSystem() {
    const bloodCanvas = document.getElementById('blood-canvas');
    if (bloodCanvas) {
      bloodCanvas.width = window.innerWidth;
      bloodCanvas.height = window.innerHeight;
    }

    this.playerHealth = 100;
    this.clearAllBlood();
  }

  takeDamage(damage) {
    this.playerHealth = Math.max(0, this.playerHealth - damage);

    const intensity = damage / 10;
    this.createBloodSplat(intensity);
    this.showDamageIndicator(damage);
    this.updateDamageVignette();

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }

  healPlayer(healAmount = 5) {
    const oldHealth = this.playerHealth;
    this.playerHealth = Math.min(100, this.playerHealth + healAmount);
    const actualHeal = this.playerHealth - oldHealth;

    if (actualHeal > 0) {
      this.clearSomeBlood(0.2);
      this.showHealIndicator(actualHeal);
      this.updateDamageVignette();
    }
  }

  createBloodSplat(intensity = 1) {
    const bloodSplatsContainer = document.querySelector('.blood-splats');
    if (!bloodSplatsContainer) return;

    const splatCount = Math.floor(intensity * 6) + 2;

    for (let i = 0; i < splatCount; i++) {
      const splat = this.createSingleBloodSplat(intensity);
      bloodSplatsContainer.appendChild(splat);
      this.bloodSplats.push(splat);
    }

    this.removeOldBloodSplats();
  }

  createSingleBloodSplat(intensity) {
    const splat = document.createElement('div');
    splat.className = 'blood-splat';

    const centerBias = 1 - Math.max(0, this.playerHealth / 100);
    const x = 50 + (Math.random() - 0.5) * 80 * (1 - centerBias) + (Math.random() - 0.5) * 20 * centerBias;
    const y = 50 + (Math.random() - 0.5) * 80 * (1 - centerBias) + (Math.random() - 0.5) * 20 * centerBias;
    const size = (Math.random() * 60 + 40) * intensity;
    const rotation = Math.random() * 360;

    Object.assign(splat.style, {
      left: `${x}%`,
      top: `${y}%`,
      width: `${size}px`,
      height: `${size}px`,
      opacity: `${0.7 + 0.3 * (1 - this.playerHealth / 100)}`,
      transform: `rotate(${rotation}deg)`
    });

    return splat;
  }

  removeOldBloodSplats() {
    while (this.bloodSplats.length > this.maxBloodSplats) {
      const oldSplat = this.bloodSplats.shift();
      if (oldSplat && oldSplat.parentNode) {
        oldSplat.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => {
          if (oldSplat.parentNode) {
            oldSplat.parentNode.removeChild(oldSplat);
          }
        }, 500);
      }
    }
  }

  updateDamageVignette() {
    const vignette = document.querySelector('.damage-vignette');
    if (!vignette) return;

    vignette.className = 'damage-vignette';

    if (this.playerHealth <= 15) {
      vignette.classList.add('critical-health', 'max-blood');
    } else if (this.playerHealth <= 30) {
      vignette.classList.add('critical-health');
    } else if (this.playerHealth <= 60) {
      vignette.classList.add('low-health');
    }
  }

  showDamageIndicator() {
    const indicator = document.getElementById('damage-indicator');
    if (!indicator) return;

    const damageText = indicator.querySelector('.damage-text');
    damageText.textContent = '-SHOT';

    indicator.classList.remove('hidden');
    document.body.classList.add('screen-shake');

    setTimeout(() => {
      indicator.classList.add('hidden');
      document.body.classList.remove('screen-shake');
    }, 500);
  }

  showHealIndicator() {
    const indicator = document.getElementById('heal-indicator');
    if (!indicator) return;

    const healText = indicator.querySelector('.heal-text');
    healText.textContent = '+HEALED';

    indicator.classList.remove('hidden');

    setTimeout(() => {
      indicator.classList.add('hidden');
    }, 1000);
  }

  clearSomeBlood(percentage = 0.3) {
    const splatsToRemove = Math.floor(this.bloodSplats.length * percentage);

    for (let i = 0; i < splatsToRemove; i++) {
      if (this.bloodSplats.length > 0) {
        const splat = this.bloodSplats.shift();
        if (splat && splat.parentNode) {
          splat.style.animation = 'fadeOut 0.8s ease-out forwards';
          setTimeout(() => {
            if (splat.parentNode) {
              splat.parentNode.removeChild(splat);
            }
          }, 800);
        }
      }
    }
  }

  clearAllBlood() {
    this.bloodSplats.forEach(splat => {
      if (splat && splat.parentNode) {
        splat.parentNode.removeChild(splat);
      }
    });
    this.bloodSplats = [];

    const vignette = document.querySelector('.damage-vignette');
    if (vignette) {
      vignette.className = 'damage-vignette';
    }
  }

  // Spectator Methods
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
      li.onclick = () => this.selectPlayerCameraMobile(player.id, player.name);

      if (this.selectedPlayerMobile === player.id) {
        li.classList.add('selected');
      }

      if (index % 2 === 0) {
        redList.appendChild(li);
      } else {
        blueList.appendChild(li);
      }
    });

    if (redScore) redScore.textContent = this.teamPoints.red;
    if (blueScore) blueScore.textContent = this.teamPoints.blue;
  }

  selectPlayerCameraMobile(playerId, playerName) {
    this.selectedPlayerMobile = playerId;

    // Update UI
    document.querySelectorAll('#red-team-list li, #blue-team-list li')
      .forEach(li => li.classList.remove('selected'));

    const selectedLi = document.querySelector(`li[data-player-id="${playerId}"]`);
    if (selectedLi) selectedLi.classList.add('selected');

    // Clean up existing connections
    Object.keys(this.spectatorPeerConnections).forEach(id => {
      this.closePeerConnection(id);
    });

    // Setup new connection
    document.getElementById('spectator-camera-feed').style.display = 'block';
    document.getElementById('spectator-camera-label').textContent = `Watching: ${playerName}`;

    this.socket.emit('spectator-watch-player', {
      sessionId: this.sessionId,
      playerId
    });

    this.setupSpectatorPeerConnection(playerId);
  }

  setupSpectatorPeerConnection(playerId) {
    const pc = new RTCPeerConnection();
    this.spectatorPeerConnections[playerId] = pc;
    this.pendingIceCandidates[playerId] = [];

    pc.ontrack = (event) => {
      const videoElement = document.getElementById('spectator-camera-feed');
      if (videoElement) {
        videoElement.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && pc.signalingState !== 'closed') {
        this.socket.emit('webrtc-ice-candidate', {
          to: playerId,
          candidate: event.candidate
        });
      }
    };

    this.setupSpectatorSocketHandlers(playerId, pc);
  }

  setupSpectatorSocketHandlers(playerId, pc) {
    const handleOffer = async ({ from, offer }) => {
      if (from === playerId && pc.signalingState !== 'closed') {
        try {
          if (pc.signalingState === 'stable') return;

          await pc.setRemoteDescription(new RTCSessionDescription(offer));

          if (pc.signalingState === 'have-remote-offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.socket.emit('webrtc-answer', { to: playerId, answer });

            // Process pending candidates
            (this.pendingIceCandidates[playerId] || []).forEach(candidate => {
              pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
            });
            this.pendingIceCandidates[playerId] = [];
          }
        } catch (error) {
          console.warn(`Mobile WebRTC offer error for player ${playerId}:`, error);
        }
      }
    };

    const handleIceCandidate = ({ from, candidate }) => {
      if (from === playerId && candidate && pc.signalingState !== 'closed') {
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
        } else {
          this.pendingIceCandidates[playerId].push(candidate);
        }
      }
    };

    this.socketEventListeners[playerId] = {
      offer: handleOffer,
      iceCandidate: handleIceCandidate
    };

    this.socket.on('webrtc-offer', handleOffer);
    this.socket.on('webrtc-ice-candidate', handleIceCandidate);
  }

  processPendingCandidates(playerId) {
    if (this.pendingIceCandidates[playerId] && this.spectatorPeerConnections[playerId]) {
      const pc = this.spectatorPeerConnections[playerId];
      this.pendingIceCandidates[playerId].forEach(candidate => {
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => console.warn(`Failed to add ICE candidate for ${playerId}:`, error));
        }
      });
      this.pendingIceCandidates[playerId] = [];
    }
  }

  closePeerConnection(playerId) {
    if (this.spectatorPeerConnections[playerId]) {
      this.spectatorPeerConnections[playerId].close();
      delete this.spectatorPeerConnections[playerId];
    }
    delete this.pendingIceCandidates[playerId];
    this.removeSocketListeners(playerId);
  }

  removeSocketListeners(playerId) {
    if (this.socketEventListeners[playerId]) {
      this.socket.off('webrtc-offer', this.socketEventListeners[playerId].offer);
      this.socket.off('webrtc-ice-candidate', this.socketEventListeners[playerId].iceCandidate);
      delete this.socketEventListeners[playerId];
    }
  }

  cleanupSpectatorConnections() {
    Object.keys(this.spectatorPeerConnections).forEach(id => {
      this.closePeerConnection(id);
    });
    this.selectedPlayerMobile = null;
  }

  // Utility Methods
  renderLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    if (!leaderboard) return;

    leaderboard.innerHTML = `
      <div class="score-item red-score">
        <div class="team-label">🔴 RED</div>
        <div class="score-value">${this.teamPoints.red}</div>
      </div>
      <div class="score-item blue-score">
        <div class="team-label">🔵 BLUE</div>
        <div class="score-value">${this.teamPoints.blue}</div>
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

  checkGameOver() {
    if (this.playerTeam && this.teamPoints[this.playerTeam] <= 0) {
      this.videoElement.pause();
      this.gameOverOverlay.classList.remove('hidden');
      this.winnerText.textContent = `💀 Your Team LOST...`;
    }
  }

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.classList.remove('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });

    myConfetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    myConfetti({ particleCount: 60, spread: 120, startVelocity: 40, origin: { y: 0.7 } });
    myConfetti({ particleCount: 40, spread: 90, startVelocity: 60, origin: { y: 0.8 } });

    setTimeout(() => {
      canvas.classList.add('hidden');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 2000);
  }

  preventDoubleClick() {
    document.addEventListener('dblclick', (e) => {
      e.preventDefault();
    });
  }

  addCustomStyles() {
    const additionalCSS = `
      @keyframes fadeOut {
        0% { opacity: 0.8; }
        100% { opacity: 0; }
      }

      @keyframes scanToast {
        0% {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px) scale(0.8);
        }
        20% {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1.1);
        }
        100% {
          opacity: 0;
          transform: translateX(-50%) translateY(-10px) scale(0.9);
        }
      }
    `;

    const style = document.createElement('style');
    style.textContent = additionalCSS;
    document.head.appendChild(style);
  }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LaserTagGame();
});
