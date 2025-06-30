// app.js
const socket = io('https://group-8-bbd-production.up.railway.app', {
  transports: ['websocket']
});

let username = '';
let sessionId = '';
let isHost = false;

let isSpectator = false;
let localVideoStreem= null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chooseScreen = document.getElementById('choose-screen');
const lobbyScreen = document.getElementById('lobby-screen');

const continueBtn = document.getElementById('continue-btn');
const createBtn = document.getElementById('create-session-btn');
const joinCodeInput = document.getElementById('join-code');
const joinPlayerBtn = document.getElementById('join-player-btn');
const joinSpectatorBtn = document.getElementById('join-spectator-btn');
const startGameBtn = document.getElementById('start-game-btn');
const copyGameIdBtn = document.getElementById('copy-game-id-btn');

const playerStatsList = document.getElementById('player-stats')

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

  startCamera();


  switchScreen("choose-screen", "lobby-screen")

  startSendingSnapshots();

};

joinSpectatorBtn.onclick = () => {
  sessionId = joinCodeInput.value.trim();
  if (sessionId) {
    isSpectator = true;
    socket.emit('joinSession', { username, sessionId, asSpectator: true });
  }

  startCamera();

  switchScreen("choose-screen", "lobby-screen")
};

startGameBtn.onclick = () => {
  socket.emit('startGame', { sessionId });

};

copyGameIdBtn.onclick = () => {
  navigator.clipboard.writeText(sessionId);
  alert('Game code copied!');
};

// SOCKET EVENTS
socket.on('sessionCreated', ({ sessionId: id, lobby }) => {
  isHost = true;
  sessionId = id;
  updateLobby(lobby);
  switchScreen('choose-screen', 'lobby-screen');
});

socket.on('lobbyUpdate', lobby => {
  updateLobby(lobby);
});

socket.on('lobbyUpdate', lobby => {
  updateLobby(lobby);
  
  if (isSpectator && document.getElementById('spectator-screen')?.classList.contains('hidden') === false) {
    updateSpectatorView(lobby);
  }
});


socket.on('gameStarted', lobby => {
  updateLobby(lobby);
  document.getElementById('game-status').textContent = 'Game Started!';

  if(isSpectator){
    switchScreen('lobby-screen', 'spectator-screen');
    updateSpectatorView(lobby);
  }
});

socket.on('errorMsg', msg => {
  alert(msg);
});

socket.on('snapshotUpdate', ({ username, image }) => {
  // Create or update the image element for this player
  const container = document.getElementById('video-section');
  let img = document.getElementById(`snapshot-${username}`);

  if (!img) {
    img = document.createElement('img');
    img.id = `snapshot-${username}`;
    img.alt = username;
    img.style = 'width: 100%; max-width: 250px; margin-bottom: 10px; border-radius: 10px;';
    container.appendChild(img);
  }

  img.src = image;
});



// SCREEN SWITCHING
function switchScreen(hideId, showId) {
  document.getElementById(hideId).classList.add('hidden');
  document.getElementById(showId).classList.remove('hidden');
}

// UPDATE LOBBY VIEW
function updateLobby(lobby) {
  document.getElementById('game-id-display').textContent = sessionId;

  const playersList = document.getElementById('players-list');
  const spectatorsList = document.getElementById('spectators-list');
  playersList.innerHTML = '';
  spectatorsList.innerHTML = '';

  lobby.players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
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

//UPDATE SPECTATOR VIEW
function updateSpectatorView(lobby) {
  const playerStatsList = document.getElementById('player-stats');
  playerStatsList.innerHTML = '';

  lobby.players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = `${player.name} | Health: ${player.health || 100} | Points: ${player.points || 0} | Weapon: ${player.weapon || 'None'}`;
    playerStatsList.appendChild(li);
  });
}

//CAMERA PERMISSION FUNCTION
async function startCamera() {
  try {
    localVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoEl = document.getElementById('camera-feed');
    videoEl.srcObject = localVideoStream;
  } catch (err) {
    alert("Camera access is required to play or spectate.");
    console.error("Camera error:", err);
  }
}

//SENDING SNAPSHOTS FUNCTION
function startSendingSnapshots() {
  setInterval(() => {
    if (!localVideoStream) return;

    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('snapshot-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg', 0.6); // Compress slightly

    socket.emit('playerSnapshot', {
      sessionId,
      username,
      image: imageData
    });
  }, 3000); // Every 3 seconds (adjust later)
}


//TEST SNAPSHOT

async function startCameraAndSnapshot() {
  const video = document.getElementById('test-video');
  const canvas = document.getElementById('test-canvas');
  const preview = document.getElementById('snapshot-preview');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    setInterval(() => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL('image/jpeg', 0.6);
      preview.src = imageData; // Show snapshot
    }, 1000); // Every 3 seconds
  } catch (err) {
    alert("Camera access is required.");
    console.error(err);
  }
}

//TEST SNAPSHOT


