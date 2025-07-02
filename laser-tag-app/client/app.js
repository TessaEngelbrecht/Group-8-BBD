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
  // if ('vibrate' in navigator) {
  //   //alert('in');
  //   navigator.vibrate([100, 50, 100]); // or [100, 50, 100] for a pattern
  // }
  detectColor();
};

continueBtn.onclick = () => {
  username = document.getElementById('username').value.trim();
  if (username.length === 0) {
    alert('Username cannot be empty');
    return;
  }
  if (username.length > 15) {
    alert('Username cannot be longer than 15 characters');
    return;
  }
  document.getElementById('display-username').textContent = username;
  switchScreen('login-screen', 'choose-screen');
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

document.getElementById('restart-btn').onclick = () => {
  window.location.reload();
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
// Keep track of outgoing peer connections by spectator socket id
const outgoingPeerConnections = {};

// When a spectator wants to watch this player's camera
socket.on('spectator-watch-request', async ({ spectatorId }) => {
  // Create a new RTCPeerConnection
  const pc = new RTCPeerConnection();
  outgoingPeerConnections[spectatorId] = pc;

  // Add local camera stream tracks
  const stream = videoElement.srcObject;
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // ICE candidates
  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', { to: spectatorId, candidate: event.candidate });
    }
  };

  // Create and send offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('webrtc-offer', { to: spectatorId, offer });

  // Listen for answer
  socket.on('webrtc-answer', async ({ from, answer }) => {
    if (from === spectatorId) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  // Listen for ICE candidates from spectator
  socket.on('webrtc-ice-candidate', ({ from, candidate }) => {
    if (from === spectatorId && candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
});

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

// Track multiple peer connections for desktop
const spectatorPeerConnections = {};
let selectedPlayerMobile = null;

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
    li.dataset.playerId = p.id;
    li.dataset.playerName = p.name;
    li.dataset.team = i % 2 === 0 ? 'red' : 'blue';

    // Mobile: clickable for single view
    if (window.innerWidth <= 767) {
      li.style.cursor = 'pointer';
      li.onclick = () => selectPlayerCameraMobile(p.id, p.name);

      if (selectedPlayerMobile === p.id) {
        li.classList.add('selected');
      }
    }

    if (i % 2 === 0) {
      redList.appendChild(li);
    } else {
      blueList.appendChild(li);
    }
  });

  redScore.textContent = teamPoints.red;
  blueScore.textContent = teamPoints.blue;

  // Desktop: Update camera grid
  if (window.innerWidth > 767) {
    updateCameraGrid(lobby.players);
  }
}

// Desktop: Create camera grid
function updateCameraGrid(players) {
  const grid = document.getElementById('spectator-cameras-grid');
  grid.innerHTML = '';

  players.forEach((player, i) => {
    const team = i % 2 === 0 ? 'red' : 'blue';
    const block = document.createElement('div');
    block.className = `player-camera-block ${team}-team`;
    block.innerHTML = `
      <div class="player-camera-header ${team}-team">
        ${team === 'red' ? '🔴' : '🔵'} ${player.name}
      </div>
      <video class="player-camera-video" id="camera-${player.id}" autoplay playsinline muted></video>
      <div class="player-camera-placeholder" id="placeholder-${player.id}">
        Waiting for camera feed...
      </div>
    `;
    grid.appendChild(block);

    // Request camera feed for this player
    requestPlayerCameraDesktop(player.id);
  });
}

// Desktop: Request camera for specific player
function requestPlayerCameraDesktop(playerId) {
  if (spectatorPeerConnections[playerId]) {
    spectatorPeerConnections[playerId].close();
  }

  socket.emit('spectator-watch-player', { sessionId, playerId });

  const pc = new RTCPeerConnection();
  spectatorPeerConnections[playerId] = pc;

  pc.ontrack = event => {
    const video = document.getElementById(`camera-${playerId}`);
    const placeholder = document.getElementById(`placeholder-${playerId}`);
    if (video && placeholder) {
      video.srcObject = event.streams[0];
      video.style.display = 'block';
      placeholder.style.display = 'none';
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', { to: playerId, candidate: event.candidate });
    }
  };

  // Handle WebRTC signaling for this specific connection
  const handleOffer = ({ from, offer }) => {
    if (from === playerId) {
      pc.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          socket.emit('webrtc-answer', { to: playerId, answer: pc.localDescription });
        });
    }
  };

  const handleIceCandidate = ({ from, candidate }) => {
    if (from === playerId && candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  socket.on('webrtc-offer', handleOffer);
  socket.on('webrtc-ice-candidate', handleIceCandidate);
}

// Mobile: Single camera selection
function selectPlayerCameraMobile(playerId, playerName) {
  selectedPlayerMobile = playerId;

  // Update UI selection
  document.querySelectorAll('#red-team-list li, #blue-team-list li').forEach(li => {
    li.classList.remove('selected');
  });
  document.querySelector(`li[data-player-id="${playerId}"]`).classList.add('selected');

  // Close and clear existing peer connections without reassigning the const
  Object.values(spectatorPeerConnections).forEach(pc => pc.close());
  for (const key in spectatorPeerConnections) {
    delete spectatorPeerConnections[key];
  }

  document.getElementById('spectator-camera-feed').style.display = 'block';
  document.getElementById('spectator-camera-label').textContent = `Watching: ${playerName}`;

  socket.emit('spectator-watch-player', { sessionId, playerId });

  const pc = new RTCPeerConnection();
  spectatorPeerConnections[playerId] = pc;

  pc.ontrack = event => {
    document.getElementById('spectator-camera-feed').srcObject = event.streams[0];
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', { to: playerId, candidate: event.candidate });
    }
  };

  socket.on('webrtc-offer', async ({ from, offer }) => {
    if (from === playerId) {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { to: playerId, answer });
    }
  });

  socket.on('webrtc-ice-candidate', ({ from, candidate }) => {
    if (from === playerId && candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
}


// Handle window resize
window.addEventListener('resize', () => {
  if (document.getElementById('spectator-screen').classList.contains('hidden')) return;

  const lobby = { players: allPlayers };
  updateSpectatorView(lobby);
});

let spectatorPeerConnection = null;

function selectPlayerCamera(playerId, playerName) {
  // Clean up any previous connection
  if (spectatorPeerConnection) {
    spectatorPeerConnection.close();
    spectatorPeerConnection = null;
  }
  document.getElementById('spectator-camera-feed').style.display = 'block';
  document.getElementById('spectator-camera-label').textContent = `Watching: ${playerName}`;

  // Ask the server to start the WebRTC connection with the selected player
  socket.emit('spectator-watch-player', { sessionId, playerId });

  // Set up WebRTC as receiver
  spectatorPeerConnection = new RTCPeerConnection();

  // Show incoming video
  spectatorPeerConnection.ontrack = event => {
    document.getElementById('spectator-camera-feed').srcObject = event.streams[0];
  };

  // ICE candidates
  spectatorPeerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', { to: playerId, candidate: event.candidate });
    }
  };

  // Listen for offer from player
  socket.on('webrtc-offer', async ({ from, offer }) => {
    if (from === playerId) {
      await spectatorPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await spectatorPeerConnection.createAnswer();
      await spectatorPeerConnection.setLocalDescription(answer);
      socket.emit('webrtc-answer', { to: playerId, answer });
    }
  });

  // Listen for ICE candidates from player
  socket.on('webrtc-ice-candidate', ({ from, candidate }) => {
    if (from === playerId && candidate) {
      spectatorPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
}









let socketEventListeners = {}; // Track event listeners to remove them

// Helper function to remove socket event listeners
function removeSocketListeners(playerId) {
  if (socketEventListeners[playerId]) {
    socket.off('webrtc-offer', socketEventListeners[playerId].offer);
    socket.off('webrtc-ice-candidate', socketEventListeners[playerId].iceCandidate);
    delete socketEventListeners[playerId];
  }
}

// Helper function to safely close peer connection
function closePeerConnection(playerId) {
  if (spectatorPeerConnections[playerId]) {
    if (spectatorPeerConnections[playerId].signalingState !== 'closed') {
      spectatorPeerConnections[playerId].close();
    }
    delete spectatorPeerConnections[playerId];
  }
  removeSocketListeners(playerId);
}

// Desktop: Request camera for specific player
function requestPlayerCameraDesktop(playerId) {
  // Clean up existing connection
  closePeerConnection(playerId);

  socket.emit('spectator-watch-player', { sessionId, playerId });

  const pc = new RTCPeerConnection();
  spectatorPeerConnections[playerId] = pc;

  pc.ontrack = event => {
    const video = document.getElementById(`camera-${playerId}`);
    const placeholder = document.getElementById(`placeholder-${playerId}`);
    if (video && placeholder) {
      video.srcObject = event.streams[0];
      video.style.display = 'block';
      placeholder.style.display = 'none';
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate && pc.signalingState !== 'closed') {
      socket.emit('webrtc-ice-candidate', { to: playerId, candidate: event.candidate });
    }
  };

  // Create specific event handlers for this connection
  const handleOffer = async ({ from, offer }) => {
    if (from === playerId && pc.signalingState !== 'closed') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { to: playerId, answer: pc.localDescription });
      } catch (error) {
        console.warn(`WebRTC offer error for player ${playerId}:`, error);
      }
    }
  };

  const handleIceCandidate = ({ from, candidate }) => {
    if (from === playerId && candidate && pc.signalingState !== 'closed') {
      try {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn(`WebRTC ICE candidate error for player ${playerId}:`, error);
      }
    }
  };

  // Store listeners so we can remove them later
  socketEventListeners[playerId] = {
    offer: handleOffer,
    iceCandidate: handleIceCandidate
  };

  socket.on('webrtc-offer', handleOffer);
  socket.on('webrtc-ice-candidate', handleIceCandidate);
}

// Mobile: Single camera selection
function selectPlayerCameraMobile(playerId, playerName) {
  selectedPlayerMobile = playerId;

  // Update UI
  document.querySelectorAll('#red-team-list li, #blue-team-list li').forEach(li => {
    li.classList.remove('selected');
  });
  const selectedLi = document.querySelector(`li[data-player-id="${playerId}"]`);
  if (selectedLi) {
    selectedLi.classList.add('selected');
  }

  // Clean up all existing connections
  Object.keys(spectatorPeerConnections).forEach(closePeerConnection);

  document.getElementById('spectator-camera-feed').style.display = 'block';
  document.getElementById('spectator-camera-label').textContent = `Watching: ${playerName}`;

  // Request camera feed
  socket.emit('spectator-watch-player', { sessionId, playerId });

  const pc = new RTCPeerConnection();
  spectatorPeerConnections[playerId] = pc;

  pc.ontrack = event => {
    const videoElement = document.getElementById('spectator-camera-feed');
    if (videoElement) {
      videoElement.srcObject = event.streams[0];
    }
  };

  pc.onicecandidate = event => {
    if (event.candidate && pc.signalingState !== 'closed') {
      socket.emit('webrtc-ice-candidate', { to: playerId, candidate: event.candidate });
    }
  };

  // Create specific event handlers
  const handleOfferMobile = async ({ from, offer }) => {
    if (from === playerId && pc.signalingState !== 'closed') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { to: playerId, answer });
      } catch (error) {
        console.warn(`Mobile WebRTC offer error for player ${playerId}:`, error);
      }
    }
  };

  const handleIceCandidateMobile = ({ from, candidate }) => {
    if (from === playerId && candidate && pc.signalingState !== 'closed') {
      try {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn(`Mobile WebRTC ICE candidate error for player ${playerId}:`, error);
      }
    }
  };

  // Store listeners
  socketEventListeners[playerId] = {
    offer: handleOfferMobile,
    iceCandidate: handleIceCandidateMobile
  };

  socket.on('webrtc-offer', handleOfferMobile);
  socket.on('webrtc-ice-candidate', handleIceCandidateMobile);
}

// Clean up when leaving spectator mode
function cleanupSpectatorConnections() {
  Object.keys(spectatorPeerConnections).forEach(closePeerConnection);
  selectedPlayerMobile = null;
}

// Call cleanup when switching screens
function switchScreen(hideId, showId) {
  if (hideId === 'spectator-screen') {
    cleanupSpectatorConnections();
  }
  document.getElementById(hideId).classList.add('hidden');
  document.getElementById(showId).classList.remove('hidden');
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
  const redPlayers = document.getElementById('red-players');
  const bluePlayers = document.getElementById('blue-players');
  const spectatorsList = document.getElementById('spectators-list');

  redPlayers.innerHTML = '';
  bluePlayers.innerHTML = '';
  spectatorsList.innerHTML = '';
  allPlayers = lobby.players;

  allPlayers.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = p.name;
    li.className = 'player-item';

    if (i % 2 === 0) {
      li.classList.add('red-player');
      redPlayers.appendChild(li);
    } else {
      li.classList.add('blue-player');
      bluePlayers.appendChild(li);
    }
  });

  lobby.spectators.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s.name;
    li.className = 'spectator-item';
    spectatorsList.appendChild(li);
  });

  const statusText = lobby.started
    ? 'Mission Active!'
    : lobby.players.length < 2 || lobby.players.length % 2 !== 0
      ? 'Awaiting warriors (minimum 2, even numbers)...'
      : 'Ready for deployment!';
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
function setTeamAmbient(team) {
  const ambient = document.getElementById('team-ambient');
  ambient.classList.remove('hidden', 'red-ambient', 'blue-ambient');
  if (team) {
    ambient.classList.add(`${team}-ambient`);
  }
}


function assignTeam(lobby) {
  const index = lobby.players.findIndex(p => p.name === username);
  if (index !== -1) {
    playerTeam = index % 2 === 0 ? 'red' : 'blue';
    const indicator = document.getElementById('player-symbol');
    indicator.textContent = `TEAM ${playerTeam.toUpperCase()}`;
    indicator.className = `team-indicator ${playerTeam}`;

    // Set ambient lighting
    setTeamAmbient(playerTeam);
  }
}

// Fix Canvas2D performance warning
function startWebcam() {
  const constraints = {
    video: {
      facingMode: { exact: "environment" }
    }
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      videoElement.srcObject = stream;
      videoElement.play();

      // Fix: Set willReadFrequently when getting canvas context
      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;

      // This fixes the Canvas2D warning
      const context = canvasElement.getContext('2d', { willReadFrequently: true });

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

      // Fix: Set willReadFrequently here too
      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;

      // This fixes the Canvas2D warning
      const context = canvasElement.getContext('2d', { willReadFrequently: true });

    })
    .catch(err => {
      alert('Camera access denied or not available');
    });
}

// Update detectColor function to use the context with willReadFrequently
function detectColor() {
  // Get context with willReadFrequently if not already set
  const context = canvasElement.getContext('2d', { willReadFrequently: true });

  context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
  const frame = context.getImageData(0, 0, canvasElement.width, canvasElement.height);
  const data = frame.data;

  let detectedColor = detectDominantColor(data);

  if (detectedColor) {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    socket.emit('teamHit', {
      sessionId,
      shooterTeam: playerTeam,
      victimTeam: playerTeam === 'red' ? 'blue' : 'red',
      scannedColor: detectedColor
    });

    const toast = document.createElement('div');
    toast.textContent = `🎯 Scanned: ${detectedColor.toUpperCase()}`;
    toast.className = 'scan-toast';
    toast.style.cssText = `
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

    document.body.appendChild(toast);
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 2000);
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