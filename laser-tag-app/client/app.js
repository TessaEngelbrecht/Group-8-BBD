// ✅ laser-tag-static/app.js (Finalised for Team Points, Sockets, Sync)
const socket = io('https://group-8-bbd-production.up.railway.app', {
  transports: ['websocket']
});

let username = '';
let sessionId = '';
let isHost = false;
//let playerTeam = null;
//et teamPoints = { red: 100, blue: 100 };
let allPlayers = []; // [{ name, team }]

// DOM
const loginScreen = document.getElementById('login-screen');
const chooseScreen = document.getElementById('choose-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
//const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const ctx = canvasElement.getContext('2d');

const timerDisplay = document.getElementById('game-timer');
//const gameOverOverlay = document.getElementById('game-over-overlay');
//const winnerText = document.getElementById('winner-text');



const timerPlayer = document.getElementById('game-timer-player');
const timerSpectator = document.getElementById('game-timer-spectator');
const gameOverOverlay = document.getElementById('game-over-overlay');
const winnerText = document.getElementById('winner-text');
const videoElement = document.getElementById('webcam');
let playerTeam = null;
let teamPoints = { red: 100, blue: 100 };

// Buttons
const continueBtn = document.getElementById('continue-btn');
const createBtn = document.getElementById('create-session-btn');
const joinCodeInput = document.getElementById('join-code');
const joinPlayerBtn = document.getElementById('join-player-btn');
const joinSpectatorBtn = document.getElementById('join-spectator-btn');
const startGameBtn = document.getElementById('start-game-btn');
const copyGameIdBtn = document.getElementById('copy-game-id-btn');
const shootBtn = document.getElementById('shoot-btn');

shootBtn.onclick = () => {
  //alert('vibrate' in navigator);
  if ('vibrate' in navigator) {
    alert('in');
    navigator.vibrate([100, 50, 100]); // or [100, 50, 100] for a pattern
  }
  detectColor();
};

continueBtn.onclick = () => {
  username = document.getElementById('username').value.trim();
  if (username) {
    document.getElementById('display-username').textContent = username;
    switchScreen('login-screen', 'choose-screen');
  }
};

createBtn.onclick = () => {
  socket.emit('createSession', { username });
};

joinPlayerBtn.onclick = () => {
  sessionId = joinCodeInput.value.trim();
  if (sessionId) {
    socket.emit('joinSession', { username, sessionId, asSpectator: false });
  }
  //switchScreen("choose-screen", "lobby-screen")
};

joinSpectatorBtn.onclick = () => {
  sessionId = joinCodeInput.value.trim();
  if (sessionId) {
    socket.emit('joinSession', { username, sessionId, asSpectator: true });
  }
  //switchScreen("choose-screen", "lobby-screen")
};

startGameBtn.onclick = () => {
  socket.emit('startGame', { sessionId });
};

copyGameIdBtn.onclick = () => {
  navigator.clipboard.writeText(sessionId);
  alert('Game code copied!');
};

socket.on('sessionCreated', ({ sessionId: id, lobby }) => {
  isHost = true;
  sessionId = id;
  updateLobby(lobby);
  switchScreen('choose-screen', 'lobby-screen');
});

socket.on('lobbyUpdate', lobby => {
  updateLobby(lobby);
  if (!gameScreen.classList.contains('hidden')) return; // Already in game
  switchScreen('choose-screen', 'lobby-screen');
});

socket.on('gameStarted', lobby => {
  updateLobby(lobby);
  const me = lobby.players.find(p => p.name === username);
  const isSpectator = !me;

  if (isSpectator) {
    switchScreen('lobby-screen', 'spectator-screen');
    updateSpectatorView(lobby);
  } else {
    assignTeam(lobby);
    switchScreen('lobby-screen', 'game-screen');
    startWebcam();
  }
});


socket.on('pointsUpdate', ({ red, blue, modifiers, purpleLeft }) => {
  teamPoints = { red, blue };
  updateUsageLog(modifiers, purpleLeft);
  renderLeaderboard();
  updateSpectatorView({ players: allPlayers });
  checkGameOver();
});

socket.on('timerUpdate', seconds => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatted = `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;

  if (timerPlayer) timerPlayer.textContent = formatted;
  if (timerSpectator) timerSpectator.textContent = formatted;
});


// Game Ended: show overlay for all, with correct winner text
socket.on('gameEnded', winner => {
  if (videoElement && typeof videoElement.pause === 'function') videoElement.pause();
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  gameOverOverlay.classList.remove('hidden');

  // Determine if this client is a spectator
  const isSpectator = !playerTeam;

  if (winner === 'draw') {
    winnerText.textContent = `🤝 It's a DRAW!`;
  } else if (isSpectator) {
    // Spectator: show which team won
    if (winner === 'red') winnerText.textContent = `🔴 RED TEAM WON!`;
    else if (winner === 'blue') winnerText.textContent = `🔵 BLUE TEAM WON!`;
  } else if (playerTeam === winner) {
    winnerText.textContent = `🏆 Your Team (${winner.toUpperCase()}) WON!`;
    launchConfetti();
  } else {
    winnerText.textContent = `💀 Your Team LOST...`;
  }
});





socket.on('errorMsg', msg => {
  alert(msg);
  if (msg.includes('Username already taken')) {
    switchScreen('choose-screen', 'login-screen');
    document.getElementById('username').value = '';
  }
});

function updateSpectatorView(lobby) {
  const redList = document.getElementById('red-team-list');
  const blueList = document.getElementById('blue-team-list');
  const redScore = document.getElementById('red-score');
  const blueScore = document.getElementById('blue-score');

  redList.innerHTML = '';
  blueList.innerHTML = '';

  lobby.players.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = p.name;
    if (i % 2 === 0) {
      redList.appendChild(li);
    } else {
      blueList.appendChild(li);
    }
  });

  redScore.textContent = teamPoints.red;
  blueScore.textContent = teamPoints.blue;
}


function launchConfetti() {
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

function switchScreen(hideId, showId) {
  document.getElementById(hideId).classList.add('hidden');
  document.getElementById(showId).classList.remove('hidden');
}

function updateLobby(lobby) {
  document.getElementById('game-id-display').textContent = sessionId;
  const playersList = document.getElementById('players-list');
  const spectatorsList = document.getElementById('spectators-list');
  playersList.innerHTML = '';
  spectatorsList.innerHTML = '';
  allPlayers = lobby.players;

  const teamCounts = { red: 0, blue: 0 };

  allPlayers.forEach((p, i) => {
    const li = document.createElement('li');
    const team = i % 2 === 0 ? 'red' : 'blue';
    li.textContent = `${p.name} (${team})`;
    playersList.appendChild(li);
  });

  lobby.spectators.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s.name;
    spectatorsList.appendChild(li);
  });

  const statusText = lobby.started
    ? 'Game Started!'
    : lobby.players.length < 2 || lobby.players.length % 2 !== 0
      ? 'Waiting for even number of players (minimum 2)...'
      : 'Ready to start!';
  document.getElementById('game-status').textContent = statusText;

  if (isHost && !lobby.started && lobby.players.length >= 2 && lobby.players.length % 2 === 0) {
    startGameBtn.classList.remove('hidden');
  } else {
    startGameBtn.classList.add('hidden');
  }

  renderLeaderboard();
}

// Helper to hide all screens except overlay
function showGameOverOverlay(winner) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  // Show overlay
  gameOverOverlay.classList.remove('hidden');

  // Set winner text and effects
  if (winner === 'draw') {
    winnerText.innerHTML = `🤝 <span style="color:#f39c12;">It's a DRAW!</span>`;
    gameOverOverlay.style.background = 'radial-gradient(circle, #333 60%, #f39c12 100%)';
  } else if (playerTeam === winner) {
    winnerText.innerHTML = `🏆 <span style="color:#4a90e2;text-shadow:0 0 20px #4a90e2;">Your Team (${winner.toUpperCase()}) WON!</span>`;
    gameOverOverlay.style.background = 'radial-gradient(circle, #4a90e2 60%, #fff 100%)';
    launchConfetti();
  } else {
    winnerText.innerHTML = `💀 <span style="color:#e74c3c;text-shadow:0 0 20px #e74c3c;">Your Team LOST...</span>`;
    gameOverOverlay.style.background = 'radial-gradient(circle, #222 60%, #e74c3c 100%)';
  }
  // Animate overlay
  gameOverOverlay.style.animation = 'popIn 0.8s cubic-bezier(0.23, 1, 0.32, 1)';
}


function assignTeam(lobby) {
  const index = lobby.players.findIndex(p => p.name === username);
  if (index !== -1) {
    playerTeam = index % 2 === 0 ? 'red' : 'blue';
    document.getElementById('player-symbol').textContent = `You are on team: ${playerTeam.toUpperCase()}`;
  }
}

function startWebcam() {
  const constraints = {
    video: {
      facingMode: { exact: "environment" } // Tries to use the back camera
    }
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      videoElement.srcObject = stream;
      videoElement.play();
      // detectColorLoop();
    })
    .catch(err => {
      console.warn('Could not use back camera. Falling back to default.', err);
      fallbackToDefaultCamera();
    });
}

function fallbackToDefaultCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoElement.srcObject = stream;
      videoElement.play();
      // detectColorLoop();
    })
    .catch(err => {
      alert('Camera access denied or not available');
    });
}

function detectColor() {
  ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
  const frame = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
  const data = frame.data;

  let detectedColor = detectDominantColor(data);

  if (detectedColor) {
    // Vibrate the device for 200ms if supported
    if (navigator.vibrate) {
      navigator.vibrate(200); // You can adjust the duration or use a pattern
    }
    socket.emit('teamHit', {
      sessionId,
      shooterTeam: playerTeam,
      victimTeam: playerTeam === 'red' ? 'blue' : 'red',
      scannedColor: detectedColor
    });

    const toast = document.createElement('div');
    toast.textContent = `🟡 Scanned: ${detectedColor.toUpperCase()}`;
    toast.style.position = 'absolute';
    toast.style.top = '10px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = '#333';
    toast.style.color = '#fff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '6px';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 2000);
  }
}

function detectColorLoop() {
  setInterval(detectColor, 700);
}

function detectDominantColor(data) {
  let colorCounts = { red: 0, blue: 0, purple: 0, yellow: 0 };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r > 180 && g < 100 && b < 100) colorCounts.red++;
    else if (b > 150 && r < 100 && g < 100) colorCounts.blue++;
    else if (r > 100 && b > 100 && g < 80) colorCounts.purple++;
    else if (r > 200 && g > 200 && b < 100) colorCounts.yellow++; // 💡 new
  }

  let dominant = null;
  let maxCount = 2000;

  for (const color in colorCounts) {
    if (colorCounts[color] > maxCount) {
      dominant = color;
      maxCount = colorCounts[color];
    }
  }

  return dominant;
}


function renderLeaderboard() {
  const leaderboard = document.getElementById('leaderboard');
  leaderboard.innerHTML = '<h3>Leaderboard</h3>';
  const red = document.createElement('div');
  red.textContent = `🔴 RED TEAM: ${teamPoints.red} pts`;
  const blue = document.createElement('div');
  blue.textContent = `🔵 BLUE TEAM: ${teamPoints.blue} pts`;
  leaderboard.appendChild(red);
  leaderboard.appendChild(blue);
}

function updateUsageLog(modifiers = {}, purpleLeft = {}) {
  const modLogs = document.getElementsByClassName('modifiers-log');
  const purpleLogs = document.getElementsByClassName('purple-log');

  for (let i = 0; i < modLogs.length; i++) {
    modLogs[i].innerHTML = `
      <strong>🔥 Shot Damage Modifiers:</strong><br>
      🔴 Red: ${modifiers?.red ?? '?'}<br>
      🔵 Blue: ${modifiers?.blue ?? '?'}
    `;
  }

  for (let i = 0; i < purpleLogs.length; i++) {
    purpleLogs[i].innerHTML = `
      <strong>🍇 Purple Scans Left:</strong><br>
      🔴 Red: ${purpleLeft?.red ?? '?'}<br>
      🔵 Blue: ${purpleLeft?.blue ?? '?'}
    `;
  }
}

function checkGameOver() {
  // This is only a client-side check for display; the server is authoritative
  if (playerTeam && teamPoints[playerTeam] <= 0) {
    videoElement.pause();
    gameOverOverlay.classList.remove('hidden');
    winnerText.textContent = `💀 Your Team LOST...`;
  }
}