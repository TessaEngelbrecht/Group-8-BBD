// ✅ laser-tag-static/app.js (Updated for colour detection instead of COCO-SSD)
const socket = io('https://group-8-bbd-production.up.railway.app', {
  transports: ['websocket']
});

let username = '';
let sessionId = '';
let isHost = false;
let playerId = -1;
let playerSymbol = null;
let playerPoints = 100;

const colorAssignments = ['red', 'blue', 'green', 'yellow'];

// DOM
const loginScreen = document.getElementById('login-screen');
const chooseScreen = document.getElementById('choose-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const startDetectionBtn = document.getElementById('start-detect-btn');
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

// Socket handlers
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
    })
    .catch(err => {
      alert('Camera access denied or not available');
    });
}

// ✅ Colour detection instead of object detection
let detectionInterval;

startDetectionBtn.onclick = () => {
  if (!playerSymbol) return alert('You have no assigned color.');
  alert('🎯 Detection started');
  detectColorLoop();
};

function detectColorLoop() {
  detectionInterval = setInterval(() => {
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    const frame = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = frame.data;

    let matchingPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (isMatchingColor(r, g, b, playerSymbol.color)) {
        matchingPixels++;
      }
    }

    if (matchingPixels > 2000) {
      playerPoints -= 10;
      document.getElementById('player-points').textContent = `Points: ${playerPoints}`;
      alert(`💥 You got hit by ${playerSymbol.color} tag! -10 points`);
      clearInterval(detectionInterval);
    }
  }, 500);
}

function isMatchingColor(r, g, b, targetColor) {
  switch (targetColor) {
    case 'red': return r > 180 && g < 100 && b < 100;
    case 'blue': return b > 150 && r < 100 && g < 100;
    case 'green': return g > 180 && r < 100 && b < 100;
    case 'yellow': return r > 180 && g > 180 && b < 100;
    default: return false;
  }
}