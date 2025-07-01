const socket = io('https://group-8-bbd-production.up.railway.app', {
  transports: ['websocket']
});

let username = '';
let sessionId = '';
let isHost = false;
let isSpectator = false;
let playerId = -1;
let playerSymbol = null;
let playerPoints = 100;
let playerScore = 0;
let playerKills = 0;
let allPlayers = [];
let currentSpectatedPlayer = null;
let peerConnection = null;
let detectedColor = 'None';

const colorAssignments = ['red', 'blue', 'green', 'yellow'];

// DOM
const loginScreen = document.getElementById('login-screen');
const chooseScreen = document.getElementById('choose-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const spectatorScreen = document.getElementById('spectator-screen');
const videoElement = document.getElementById('webcam');
const spectatorVideo = document.getElementById('spectator-video');
const canvasElement = document.getElementById('overlay');
const ctx = canvasElement.getContext('2d');
const shootBtn = document.getElementById('shoot-btn');
const hudHP = document.getElementById('player-hp');
const hudScore = document.getElementById('player-score');
const hudKills = document.getElementById('player-kills');

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
  switchScreen("choose-screen", "lobby-screen");
};

joinSpectatorBtn.onclick = () => {
  sessionId = joinCodeInput.value.trim();
  if (sessionId) {
    socket.emit('joinSession', { username, sessionId, asSpectator: true });
    isSpectator = true;
  }
  switchScreen("choose-screen", "lobby-screen");
};

startGameBtn.onclick = () => {
  socket.emit('startGame', { sessionId });
};

copyGameIdBtn.onclick = () => {
  navigator.clipboard.writeText(sessionId);
  alert('Game code copied!');
};


//Shoot button functionality
shootBtn.onclick = () => {
  console.log('Shoot button clicked, detectedColor:', detectedColor, 'playerSymbol:', playerSymbol?.color);
  if (detectedColor !== 'None' && playerSymbol?.color) {
    if (detectedColor === playerSymbol.color) {
      // Self-hit
      playerPoints = Math.max(playerPoints - 10, 0);
      playerScore -= 10;
      console.log('Self-hit, new HP:', playerPoints, 'new Score:', playerScore);
    } else if (colorAssignments.includes(detectedColor) && detectedColor !== playerSymbol.color) {
      // Enemy hit
      playerScore += 5;
      playerKills += 1;
      const victim = allPlayers.find(p => p.color === detectedColor);
        victim.points = Math.max(victim.points - 10, 0);
        socket.emit('updatePoints', { sessionId, playerId: victim.id, points: victim.points });
        console.log('Enemy hit, victim:', victim.name, 'new Victim HP:', victim.points);
      console.log('Enemy hit, new Score:', playerScore, 'new Kills:', playerKills);
    }
    socket.emit('updatePoints', { sessionId, playerId: allPlayers.find(p => p.name === username)?.id, points: playerPoints });
    hudHP.textContent = `HP: ${playerPoints}`;
    hudScore.textContent = `Score: ${playerScore}`;
    hudKills.textContent = `Kills: ${playerKills}`;
    renderLeaderboard();
    if (playerPoints <= 0) {
      socket.emit('updatePoints', { sessionId, playerId: allPlayers.find(p => p.name === username)?.id, points: 0 });
      videoElement.pause();
      console.log('Player eliminated, HP reached 0');
    }
  } else {
    console.log('Shoot failed: No detected color or player symbol');
  }
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
  console.log('Game started event received', { isSpectator, playerId, lobby });
  updateLobby(lobby);
  if (!isSpectator && playerId >= 0) {
    assignPlayerSymbol(lobby);
    switchScreen('lobby-screen', 'game-screen');
    startWebcam();
    console.log('Switched to game screen, isSpectator:', isSpectator, 'Screen visible:', !gameScreen.classList.contains('hidden'));
  } else {
    switchScreen('lobby-screen', 'spectator-screen');
    initSpectatorView(lobby);
    console.log('Switched to spectator screen, isSpectator:', isSpectator);
  }
});

socket.on('errorMsg', msg => {
  alert(msg);
});

socket.on('offer', async ({ from, offer }) => {
  if (isSpectator && from !== socket.id) {
    peerConnection = new RTCPeerConnection();
    peerConnection.ontrack = (event) => {
      spectatorVideo.srcObject = event.streams[0];
      console.log('Spectator received video stream from', from);
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { to: from, candidate: event.candidate });
      }
    };
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { to: from, answer });
    console.log('Spectator sent answer to', from);
  }
});

socket.on('answer', async ({ from, answer }) => {
  if (!isSpectator) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('Player received answer from', from);
  }
});

socket.on('ice-candidate', async ({ from, candidate }) => {
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Added ICE candidate from', from);
    } catch (err) {
      console.error('ICE candidate error:', err);
    }
  }
});

socket.on('requestStream', ({ spectatorId }) => {
  if (!isSpectator) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        peerConnection.createOffer().then(offer => {
          peerConnection.setLocalDescription(offer);
          socket.emit('offer', { to: spectatorId, offer });
          console.log('Player sent offer to spectator', spectatorId);
        });
      })
      .catch(err => console.error('Stream request error:', err));
  }
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
    if (p.name === username && !isSpectator) {
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

  if (!isSpectator) {
    renderLeaderboard();
  } else {
    renderSpectatorLeaderboard();
  }
}

function assignPlayerSymbol(lobby) {
  if (playerId >= 0) {
    const color = colorAssignments[playerId % colorAssignments.length];
    playerSymbol = { color };
    hudHP.textContent = `HP: ${playerPoints}`;
    hudScore.textContent = `Score: ${playerScore}`;
    hudKills.textContent = `Kills: ${playerKills}`;
    initWebRTC();
  }
}

function initWebRTC() {
  peerConnection = new RTCPeerConnection();
  if (!isSpectator) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        peerConnection.onicecandidate = event => {
          if (event.candidate) {
            socket.emit('ice-candidate', { to: 'all', candidate: event.candidate });
          }
        };
        peerConnection.createOffer().then(offer => {
          peerConnection.setLocalDescription(offer);
          socket.emit('offer', { to: 'all', offer });
        });
      })
      .catch(err => console.error('WebRTC error:', err));
  }
}

function initSpectatorView(lobby) {
  if (lobby.players.length > 0) {
    currentSpectatedPlayer = lobby.players[0].id;
    document.getElementById('current-player').textContent = lobby.players[0].name;
    socket.emit('requestStream', { playerId: currentSpectatedPlayer });
  }
  renderSpectatorLeaderboard();
}

function renderSpectatorLeaderboard() {
  const leaderboard = document.getElementById('spectator-leaderboard');
  leaderboard.innerHTML = '<h3>Leaderboard</h3>';
  const sorted = [...allPlayers].sort((a, b) => b.points - a.points);
  sorted.forEach(p => {
    const div = document.createElement('div');
    div.textContent = `${p.name} (${p.color}): ${p.points} pts`;
    div.onclick = () => {
      currentSpectatedPlayer = p.id;
      document.getElementById('current-player').textContent = p.name;
      socket.emit('requestStream', { playerId: p.id });
    };
    leaderboard.appendChild(div);
  });
}

function startWebcam() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoElement.srcObject = stream;
      videoElement.play();
      canvasElement.width = window.innerWidth;
      canvasElement.height = window.innerHeight;
      detectColors();
    })
    .catch(err => {
      console.error('Camera error:', err);
      alert('Camera access denied or not available');
    });
}

function detectColors() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scopeRadius = 50;
  const centerX = width / 2;
  const centerY = height / 2;

  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = width;
  hiddenCanvas.height = height;
  const hiddenCtx = hiddenCanvas.getContext('2d');

  function loop() {
    requestAnimationFrame(loop);

    // Capture the current video frame for color detection
    hiddenCtx.drawImage(videoElement, 0, 0, width, height);

    const imageData = hiddenCtx.getImageData(centerX - scopeRadius, centerY - scopeRadius, scopeRadius * 2, scopeRadius * 2);
    const data = imageData.data;

    let redFound = false, greenFound = false, blueFound = false;

    for (let y = 0; y < scopeRadius * 2; y++) {
      for (let x = 0; x < scopeRadius * 2; x++) {
        const dx = x - scopeRadius;
        const dy = y - scopeRadius;
        if (dx * dx + dy * dy > scopeRadius * scopeRadius) continue;

        const index = (y * scopeRadius * 2 + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        if (r > 150 && g < 100 && b < 100) redFound = true;
        if (g > 150 && r < 100 && b < 100) greenFound = true;
        if (b > 150 && r < 100 && g < 100) blueFound = true;
      }
    }

    let newDetectedColor = 'None';
    if (redFound) newDetectedColor = 'red';
    else if (greenFound) newDetectedColor = 'green';
    else if (blueFound) newDetectedColor = 'blue';

    if (newDetectedColor !== detectedColor) {
      detectedColor = newDetectedColor;
      console.log('Detected color changed to:', detectedColor);
    }

    // CLEAR the overlay canvas before drawing the scope
    ctx.clearRect(0, 0, width, height);

    // Draw a single scope with cross
    ctx.beginPath();
    ctx.arc(centerX, centerY, scopeRadius, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = detectedColor === playerSymbol?.color ? '#ff0000' : 
                      colorAssignments.includes(detectedColor) && detectedColor !== playerSymbol?.color ? '#00ff00' : '#ffffff';
    ctx.stroke();

    ctx.beginPath();
    ctx.setLineDash([5, 5]);
ctx.moveTo(centerX - scopeRadius, centerY);
ctx.lineTo(centerX + scopeRadius, centerY);
ctx.moveTo(centerX, centerY - scopeRadius);
ctx.lineTo(centerX, centerY + scopeRadius);
ctx.stroke();
  }

  requestAnimationFrame(loop);
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