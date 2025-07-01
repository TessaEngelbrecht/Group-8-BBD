// ✅ laser-tag-static/app.js
const socket = io('https://group-8-bbd-production.up.railway.app', {
  transports: ['websocket']
});

let username = '';
let sessionId = '';
let isHost = false;
let playerTeam = null;
let teamPoints = { red: 100, blue: 100 };
let allPlayers = [];
let modifiers = { red: 3, blue: 3 };
let purpleLeft = { red: 3, blue: 3 };

// DOM elements
const loginScreen = document.getElementById('login-screen');
const chooseScreen = document.getElementById('choose-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const spectatorScreen = document.getElementById('spectator-screen');
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const ctx = canvasElement.getContext('2d');

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
};

joinSpectatorBtn.onclick = () => {
  sessionId = joinCodeInput.value.trim();
  if (sessionId) {
    socket.emit('joinSession', { username, sessionId, asSpectator: true });
  }
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
  if (!gameScreen.classList.contains('hidden')) return;
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

socket.on('pointsUpdate', data => {
  teamPoints = { red: data.red, blue: data.blue };
  modifiers = data.modifiers;
  purpleLeft = data.purpleLeft;
  renderLeaderboard();
  updateSpectatorView({ players: allPlayers });
  checkGameOver();
});

socket.on('timerUpdate', ({ minutes, seconds }) => {
  document.getElementById('timer').textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
});

socket.on('gameEnded', ({ winner }) => {
  alert(`Game Over! Winner: ${winner === 'draw' ? 'It\'s a Draw!' : winner.toUpperCase()} Team`);
  videoElement.pause();
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
    (i % 2 === 0 ? redList : blueList).appendChild(li);
  });

  redScore.textContent = teamPoints.red;
  blueScore.textContent = teamPoints.blue;
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

function assignTeam(lobby) {
  const index = lobby.players.findIndex(p => p.name === username);
  if (index !== -1) {
    playerTeam = index % 2 === 0 ? 'red' : 'blue';
    document.getElementById('player-symbol').textContent = `You are on team: ${playerTeam.toUpperCase()}`;
  }
}

function startWebcam() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } } })
    .then(stream => {
      videoElement.srcObject = stream;
      videoElement.play();
    })
    .catch(() => {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          videoElement.srcObject = stream;
          videoElement.play();
        })
        .catch(() => alert('Camera access denied'));
    });
}

function detectColor() {
  ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
  const frame = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
  const data = frame.data;

  const colorCounts = { red: 0, blue: 0, purple: 0, yellow: 0 };

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (r > 180 && g < 100 && b < 100) colorCounts.red++;
    else if (b > 150 && r < 100 && g < 100) colorCounts.blue++;
    else if (r > 130 && b > 130 && g < 100) colorCounts.purple++;
    else if (r > 200 && g > 200 && b < 100) colorCounts.yellow++;
  }

  const max = Object.entries(colorCounts).reduce((a, b) => b[1] > a[1] ? b : a);
  const [detectedColor, count] = max;
  if (count > 2000) {
    socket.emit('teamHit', { sessionId, shooterTeam: playerTeam, victimTeam: playerTeam === 'red' ? 'blue' : 'red', scannedColor: detectedColor });
  }
}

function renderLeaderboard() {
  const leaderboard = document.getElementById('leaderboard');
  leaderboard.innerHTML = `<h3>Leaderboard</h3>
    <div>🔴 RED TEAM: ${teamPoints.red} pts (MOD: ${modifiers.red}, PURPLE LEFT: ${purpleLeft.red})</div>
    <div>🔵 BLUE TEAM: ${teamPoints.blue} pts (MOD: ${modifiers.blue}, PURPLE LEFT: ${purpleLeft.blue})</div>`;
}

function checkGameOver() {
  if (teamPoints[playerTeam] <= 0) {
    alert('💀 Your team is out of points. Game Over!');
    videoElement.pause();
  }
}
