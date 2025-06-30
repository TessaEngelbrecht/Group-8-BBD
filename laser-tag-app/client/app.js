// ✅ laser-tag-static/app.js (Finalised with point logic, popups & leaderboard sync)
const socket = io('https://group-8-bbd-production.up.railway.app', {
  transports: ['websocket']
});

let username = '';
let sessionId = '';
let isHost = false;
let playerId = -1;
let playerSymbol = null;
let playerPoints = 100;
let allPlayers = [];

const colorAssignments = ['red', 'blue', 'green', 'yellow'];

// DOM
const loginScreen = document.getElementById('login-screen');
const chooseScreen = document.getElementById('choose-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
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
  switchScreen("choose-screen", "lobby-screen")
};

joinSpectatorBtn.onclick = () => {
  sessionId = joinCodeInput.value.trim();
  if (sessionId) {
    socket.emit('joinSession', { username, sessionId, asSpectator: true });
  }
  switchScreen("choose-screen", "lobby-screen")
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
});

socket.on('gameStarted', lobby => {
  updateLobby(lobby);
  assignPlayerSymbol(lobby);
  switchScreen('lobby-screen', 'game-screen');
  startWebcam();
});

socket.on('errorMsg', msg => {
  alert(msg);
});

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
  allPlayers = lobby.players.map((p, index) => ({ ...p, color: colorAssignments[index % colorAssignments.length], points: p.points ?? 100 }));

  lobby.players.forEach((p, index) => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${colorAssignments[index % colorAssignments.length]})`;
    if (p.name === username) {
      playerId = index;
    }
    playersList.appendChild(li);
  });

  lobby.spectators.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s.name;
    spectatorsList.appendChild(li);
  });

  const statusText = lobby.started
    ? 'Game Started!'
    : lobby.players.length < 2
      ? 'Waiting for 1 more player...'
      : 'Ready to start!';
  document.getElementById('game-status').textContent = statusText;

  if (isHost && !lobby.started && lobby.players.length >= 2) {
    startGameBtn.classList.remove('hidden');
  } else {
    startGameBtn.classList.add('hidden');
  }

  renderLeaderboard();
}

function assignPlayerSymbol(lobby) {
  if (playerId >= 0) {
    const color = colorAssignments[playerId % colorAssignments.length];
    playerSymbol = { color };
    document.getElementById('player-symbol').textContent = `Your tag color: ${playerSymbol.color}`;
    document.getElementById('player-points').textContent = `Points: ${playerPoints}`;
  }
}

function startWebcam() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoElement.srcObject = stream;
      videoElement.play();
      detectColorLoop();
    })
    .catch(err => {
      alert('Camera access denied or not available');
    });
}

function detectColorLoop() {
  setInterval(() => {
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    const frame = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = frame.data;

    let detectedColor = detectDominantColor(data);

    if (detectedColor && detectedColor !== playerSymbol.color) {
      const victim = allPlayers.find(p => p.color === detectedColor);

      if (victim && victim.name !== username) {
        const attacker = allPlayers.find(p => p.name === username);
        if (attacker) attacker.points += 5;
        victim.points -= 10;

        if (victim.name === username) {
          playerPoints = victim.points;
        } else if (attacker) {
          playerPoints = attacker.points;
        }

        document.getElementById('player-points').textContent = `Points: ${playerPoints}`;
        renderLeaderboard();

        const toast = document.createElement('div');
        toast.textContent = `🎯 Detected ${detectedColor}! Points updated.`;
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

        if (playerPoints <= 0) {
          alert('💀 Game Over! You are out.');
          videoElement.pause();
        }
      }
    }
  }, 700);
}

function detectDominantColor(data) {
  let colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r > 180 && g < 100 && b < 100) colorCounts.red++;
    else if (b > 150 && r < 100 && g < 100) colorCounts.blue++;
    else if (g > 180 && r < 100 && b < 100) colorCounts.green++;
    else if (r > 180 && g > 180 && b < 100) colorCounts.yellow++;
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
  const all = [...allPlayers];
  const me = { name: username, color: playerSymbol?.color, points: playerPoints };
  all.push(me);
  const unique = new Map();
  all.forEach(p => unique.set(p.name, p));
  const sorted = [...unique.values()].sort((a, b) => b.points - a.points);
  sorted.forEach(p => {
    const li = document.createElement('div');
    li.textContent = `${p.name} (${p.color}): ${p.points} pts`;
    leaderboard.appendChild(li);
  });
}
