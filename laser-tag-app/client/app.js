import { GameState } from './modules/GameState.js';
import { SocketManager } from './modules/SocketManager.js';
import { UIManager } from './modules/UIManager.js';
import { CameraManager } from './modules/CameraManager.js';
import { BloodSystem } from './modules/BloodSystem.js';
import { WebRTCManager } from './modules/WebRTCManager.js';
import { SpectatorManager } from './modules/SpectatorManager.js';
import { launchConfetti, preventDoubleClick, addCustomStyles } from './utils/helpers.js';

class LaserTagGame {
  constructor() {
    // Initialize core modules
    this.gameState = new GameState();
    this.uiManager = new UIManager(this.gameState);
    this.socketManager = new SocketManager(this.gameState, this.uiManager);
    this.cameraManager = new CameraManager(this.gameState, this.socketManager, this.uiManager);
    this.bloodSystem = new BloodSystem(this.gameState, this.uiManager);
    this.webrtcManager = new WebRTCManager(this.gameState, this.socketManager, this.uiManager);
    this.spectatorManager = new SpectatorManager(this.gameState, this.socketManager, this.uiManager, this.webrtcManager);

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupUIEvents();
    addCustomStyles();
    preventDoubleClick();
  }

  setupEventListeners() {
    // Button event listeners
    document.getElementById('continue-btn').addEventListener('click', () => this.handleContinue());
    document.getElementById('create-session-btn').addEventListener('click', () => this.handleCreateSession());
    document.getElementById('join-player-btn').addEventListener('click', () => this.handleJoinPlayer());
    document.getElementById('join-spectator-btn').addEventListener('click', () => this.handleJoinSpectator());
    document.getElementById('start-game-btn').addEventListener('click', () => this.handleStartGame());
    document.getElementById('copy-game-id-btn').addEventListener('click', () => this.handleCopyGameId());
    document.getElementById('shoot-btn').addEventListener('click', () => this.cameraManager.detectColor());
    document.getElementById('restart-btn').addEventListener('click', () => window.location.reload());

    window.addEventListener('resize', () => this.handleWindowResize());
  }

  setupUIEvents() {
    this.uiManager.on('launchConfetti', () => launchConfetti());
  }

  // Event handlers
  handleContinue() {
    const username = document.getElementById('username').value.trim();

    if (!username) {
      alert('Username cannot be empty');
      return;
    }

    if (username.length > 15) {
      alert('Username cannot be longer than 15 characters');
      return;
    }

    this.gameState.setUsername(username);
    document.getElementById('display-username').textContent = username;
    this.uiManager.switchScreen('login-screen', 'choose-screen');
  }

  handleCreateSession() {
    this.socketManager.createSession(this.gameState.username);
  }

  handleJoinPlayer() {
    const sessionId = document.getElementById('join-code').value.trim();
    if (sessionId) {
      this.gameState.setSessionId(sessionId);
      this.socketManager.joinSession(this.gameState.username, sessionId, false);
    }
  }

  handleJoinSpectator() {
    const sessionId = document.getElementById('join-code').value.trim();
    if (sessionId) {
      this.gameState.setSessionId(sessionId);
      this.socketManager.joinSession(this.gameState.username, sessionId, true);
    }
  }

  handleStartGame() {
    this.socketManager.startGame(this.gameState.sessionId);
  }

  handleCopyGameId() {
    navigator.clipboard.writeText(this.gameState.sessionId);
    alert('Game code copied!');
  }

  handleWindowResize() {
    if (!document.getElementById('spectator-screen').classList.contains('hidden')) {
      this.uiManager.updateSpectatorView({ players: this.gameState.allPlayers });
    }
  }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LaserTagGame();
});
