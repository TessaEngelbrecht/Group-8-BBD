// ✅ laser-tag-static/app.js (Finalised for Team Points, Sockets, Sync)
const socket = io('https://group-8-bbd-production.up.railway.app', {
  transports: ['websocket']
});

let username = '';
let sessionId = '';
let isHost = false;
let allPlayers = []; // [{ name, team }]
let lastPlayerIds = [];
let socketEventListeners = {};


// Track multiple peer connections for desktop
const spectatorPeerConnections = {};
let selectedPlayerMobile = null;

// Queue ICE candidates until remote description is set
const pendingIceCandidates = {};

// DOM
const loginScreen = document.getElementById('login-screen');
const chooseScreen = document.getElementById('choose-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const canvasElement = document.getElementById('overlay');
const ctx = canvasElement.getContext('2d');

const timerDisplay = document.getElementById('game-timer');
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

document.ondblclick = function (e) {
  e.preventDefault();
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

document.getElementById('restart-btn').onclick = () => {
  window.location.reload();
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
  if (!gameScreen.classList.contains('hidden')) return; // Already in game
  switchScreen('choose-screen', 'lobby-screen');
});

socket.on('gameStarted', lobby => {
  document.getElementById('particles-bg').style.display = 'none';
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

// Blood/Damage System
let playerHealth = 100;
let bloodSplats = [];
let maxBloodSplats = 15;

// Initialize blood system
function initBloodSystem() {
  const bloodCanvas = document.getElementById('blood-canvas');
  if (bloodCanvas) {
    bloodCanvas.width = window.innerWidth;
    bloodCanvas.height = window.innerHeight;
  }

  // Reset health and clear blood
  playerHealth = 100;
  clearAllBlood();
}

// More intense blood effect: splat count and size scale with missing health
function createBloodSplat(intensity = 1) {
  const bloodSplatsContainer = document.querySelector('.blood-splats');
  if (!bloodSplatsContainer) return;
  // More splats at lower health
  const splatCount = Math.floor(intensity * 6) + 2; // was 3, now up to 8
  for (let i = 0; i < splatCount; i++) {
    const splat = document.createElement('div');
    splat.className = 'blood-splat';
    // Position: more likely to be near the center as health drops
    const centerBias = 1 - Math.max(0, playerHealth / 100);
    const x = 50 + (Math.random() - 0.5) * 80 * (1 - centerBias) + (Math.random() - 0.5) * 20 * centerBias;
    const y = 50 + (Math.random() - 0.5) * 80 * (1 - centerBias) + (Math.random() - 0.5) * 20 * centerBias;
    const size = (Math.random() * 60 + 40) * intensity; // up to 100px
    const rotation = Math.random() * 360;
    splat.style.left = `${x}%`;
    splat.style.top = `${y}%`;
    splat.style.width = `${size}px`;
    splat.style.height = `${size}px`;
    splat.style.opacity = `${0.7 + 0.3 * (1 - playerHealth / 100)}`; // more opaque at low health
    splat.style.transform = `rotate(${rotation}deg)`;
    bloodSplatsContainer.appendChild(splat);
    bloodSplats.push(splat);
    // Remove oldest splats if too many
    if (bloodSplats.length > maxBloodSplats) {
      const oldSplat = bloodSplats.shift();
      if (oldSplat && oldSplat.parentNode) {
        oldSplat.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => {
          if (oldSplat.parentNode) oldSplat.parentNode.removeChild(oldSplat);
        }, 500);
      }
    }
  }
}

// Make vignette much darker at low health
function updateDamageVignette() {
  const vignette = document.querySelector('.damage-vignette');
  if (!vignette) return;
  vignette.className = 'damage-vignette';
  if (playerHealth <= 15) {
    vignette.classList.add('critical-health', 'max-blood');
  } else if (playerHealth <= 30) {
    vignette.classList.add('critical-health');
  } else if (playerHealth <= 60) {
    vignette.classList.add('low-health');
  }
}

// Show damage indicator
function showDamageIndicator(damage) {
  const indicator = document.getElementById('damage-indicator');
  if (!indicator) return;

  const damageText = indicator.querySelector('.damage-text');
  damageText.textContent = `-SHOT`;

  indicator.classList.remove('hidden');

  // Screen shake effect
  document.body.classList.add('screen-shake');

  setTimeout(() => {
    indicator.classList.add('hidden');
    document.body.classList.remove('screen-shake');
  }, 500);
}

// Show heal indicator
function showHealIndicator(healAmount) {
  const indicator = document.getElementById('heal-indicator');
  if (!indicator) return;

  const healText = indicator.querySelector('.heal-text');
  healText.textContent = `+HEALED`;

  indicator.classList.remove('hidden');

  setTimeout(() => {
    indicator.classList.add('hidden');
  }, 1000);
}

// Clear some blood (healing effect)
function clearSomeBlood(percentage = 0.3) {
  const splatsToRemove = Math.floor(bloodSplats.length * percentage);

  for (let i = 0; i < splatsToRemove; i++) {
    if (bloodSplats.length > 0) {
      const splat = bloodSplats.shift();
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

// Clear all blood
function clearAllBlood() {
  bloodSplats.forEach(splat => {
    if (splat && splat.parentNode) {
      splat.parentNode.removeChild(splat);
    }
  });
  bloodSplats = [];

  const vignette = document.querySelector('.damage-vignette');
  if (vignette) {
    vignette.className = 'damage-vignette';
  }
}

// Handle taking damage
function takeDamage(damage) {
  playerHealth = Math.max(0, playerHealth - damage);

  // Create blood splat based on damage
  const intensity = damage / 10; // Scale intensity
  createBloodSplat(intensity);

  // Show damage indicator
  showDamageIndicator(damage);

  // Update vignette
  updateDamageVignette();

  // Vibrate if supported
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
}

// Handle healing (when shooting enemy)
function healPlayer(healAmount = 5) {
  const oldHealth = playerHealth;
  playerHealth = Math.min(100, playerHealth + healAmount);
  const actualHeal = playerHealth - oldHealth;

  if (actualHeal > 0) {
    // Clear some blood
    clearSomeBlood(0.2);

    // Show heal indicator
    showHealIndicator(actualHeal);

    // Update vignette
    updateDamageVignette();
  }
}

// Spectator blood effects for player cameras
function createSpectatorBloodEffect(playerId, intensity = 1) {
  const playerBlock = document.querySelector(`#camera-${playerId}`);
  if (!playerBlock) return;

  let overlay = playerBlock.parentNode.querySelector('.spectator-blood-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'spectator-blood-overlay';
    overlay.innerHTML = '<div class="spectator-damage-vignette"></div>';
    playerBlock.parentNode.appendChild(overlay);
  }

  const vignette = overlay.querySelector('.spectator-damage-vignette');
  vignette.style.opacity = Math.min(0.6, intensity * 0.2);

  // Fade out after a while
  setTimeout(() => {
    vignette.style.opacity = Math.max(0, vignette.style.opacity - 0.1);
  }, 2000);
}

// Update your existing socket handlers
socket.on('pointsUpdate', ({ red, blue, modifiers, purpleLeft }) => {
  const oldTeamPoints = { ...teamPoints };
  teamPoints = { red, blue };

  // Check if our team lost points (took damage)
  if (playerTeam && oldTeamPoints[playerTeam] > teamPoints[playerTeam]) {
    const damage = oldTeamPoints[playerTeam] - teamPoints[playerTeam];
    takeDamage(damage * 2); // Scale damage for visual effect
  }

  // Check if our team gained points (healed from successful shot)
  if (playerTeam && oldTeamPoints[playerTeam] < teamPoints[playerTeam]) {
    healPlayer(3);
  }

  updateUsageLog(modifiers, purpleLeft);
  renderLeaderboard();
  updateSpectatorView({ players: allPlayers });
  checkGameOver();
});



// Process pending ICE candidates after remote description is set
function processPendingCandidates(playerId) {
  if (pendingIceCandidates[playerId] && spectatorPeerConnections[playerId]) {
    const pc = spectatorPeerConnections[playerId];
    pendingIceCandidates[playerId].forEach(candidate => {
      if (pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(error => console.warn(`Failed to add ICE candidate for ${playerId}:`, error));
      }
    });
    pendingIceCandidates[playerId] = [];
  }
}

// Updated socket event handlers - REMOVE DUPLICATES FIRST
socket.off('webrtc-offer');
socket.off('webrtc-answer');
socket.off('webrtc-ice-candidate');

// WebRTC signaling handlers
socket.on('webrtc-offer', async ({ from, offer }) => {
  const pc = spectatorPeerConnections[from];
  if (!pc || pc.signalingState === 'closed') return;

  try {
    // Only set remote description if we're in the right state
    if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { to: from, answer });

      // Process any pending ICE candidates
      processPendingCandidates(from);
    }
  } catch (error) {
    console.warn(`WebRTC offer error for player ${from}:`, error);
  }
});

socket.on('webrtc-ice-candidate', ({ from, candidate }) => {
  const pc = spectatorPeerConnections[from];
  if (!pc || !candidate) return;

  // If remote description is set, add candidate immediately
  if (pc.remoteDescription) {
    pc.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(error => console.warn(`Failed to add ICE candidate for ${from}:`, error));
  } else {
    // Queue candidate for later
    if (!pendingIceCandidates[from]) {
      pendingIceCandidates[from] = [];
    }
    pendingIceCandidates[from].push(candidate);
  }
});
// --- PLAYER (broadcaster) WebRTC logic ---
const outgoingPeerConnections = {};

socket.on('spectator-watch-request', async ({ spectatorId }) => {
  if (!videoElement.srcObject) return;

  const pc = new RTCPeerConnection();
  outgoingPeerConnections[spectatorId] = pc;
  videoElement.srcObject.getTracks().forEach(track => pc.addTrack(track, videoElement.srcObject));

  pc.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', { to: spectatorId, candidate: event.candidate });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('webrtc-offer', { to: spectatorId, offer });

  const answerHandler = async ({ from, answer }) => {
    if (from === spectatorId) {
      if (pc.signalingState !== 'stable' && pc.signalingState !== 'closed') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }      
      socket.off('webrtc-answer', answerHandler);
    }
  };
  socket.on('webrtc-answer', answerHandler);

  const iceHandler = ({ from, candidate }) => {
    if (from === spectatorId && candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };
  socket.on('webrtc-ice-candidate', iceHandler);
});

// --- SPECTATOR (viewer) WebRTC logic ---
function removeSocketListeners(playerId) {
  if (socketEventListeners[playerId]) {
    socket.off('webrtc-offer', socketEventListeners[playerId].offer);
    socket.off('webrtc-ice-candidate', socketEventListeners[playerId].iceCandidate);
    delete socketEventListeners[playerId];
  }
}

function closePeerConnection(playerId) {
  if (spectatorPeerConnections[playerId]) {
    spectatorPeerConnections[playerId].close();
    delete spectatorPeerConnections[playerId];
  }
  delete pendingIceCandidates[playerId];
  removeSocketListeners(playerId);
}

// function requestPlayerCameraDesktop(playerId) {
//   closePeerConnection(playerId);
//   socket.emit('spectator-watch-player', { sessionId, playerId });

//   const pc = new RTCPeerConnection();
//   spectatorPeerConnections[playerId] = pc;
//   pendingIceCandidates[playerId] = [];

//   pc.ontrack = event => {
//     const video = document.getElementById(`camera-${playerId}`);
//     const placeholder = document.getElementById(`placeholder-${playerId}`);
//     if (video && placeholder) {
//       video.srcObject = event.streams[0];
//       video.style.display = 'block';
//       placeholder.style.display = 'none';
//     }
//   };

//   pc.onicecandidate = event => {
//     if (event.candidate && pc.signalingState !== 'closed') {
//       socket.emit('webrtc-ice-candidate', { to: playerId, candidate: event.candidate });
//     }
//   };

//   const handleOffer = async ({ from, offer }) => {
//     if (from === playerId && pc.signalingState !== 'closed') {
//       try {
//         await pc.setRemoteDescription(new RTCSessionDescription(offer));
//         const answer = await pc.createAnswer();
//         await pc.setLocalDescription(answer);
//         socket.emit('webrtc-answer', { to: playerId, answer });
//         (pendingIceCandidates[playerId] || []).forEach(candidate => {
//           pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
//         });
//         pendingIceCandidates[playerId] = [];
//       } catch (error) {
//         console.warn(`WebRTC offer error for player ${playerId}:`, error);
//       }
//     }
//   };

//   const handleIceCandidate = ({ from, candidate }) => {
//     if (from === playerId && candidate && pc.signalingState !== 'closed') {
//       if (pc.remoteDescription) {
//         pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
//       } else {
//         pendingIceCandidates[playerId].push(candidate);
//       }
//     }
//   };

//   socketEventListeners[playerId] = { offer: handleOffer, iceCandidate: handleIceCandidate };
//   socket.on('webrtc-offer', handleOffer);
//   socket.on('webrtc-ice-candidate', handleIceCandidate);
// }

function selectPlayerCameraMobile(playerId, playerName) {
  selectedPlayerMobile = playerId;
  document.querySelectorAll('#red-team-list li, #blue-team-list li').forEach(li => li.classList.remove('selected'));
  const selectedLi = document.querySelector(`li[data-player-id="${playerId}"]`);
  if (selectedLi) selectedLi.classList.add('selected');
  Object.keys(spectatorPeerConnections).forEach(closePeerConnection);

  document.getElementById('spectator-camera-feed').style.display = 'block';
  document.getElementById('spectator-camera-label').textContent = `Watching: ${playerName}`;
  socket.emit('spectator-watch-player', { sessionId, playerId });

  const pc = new RTCPeerConnection();
  spectatorPeerConnections[playerId] = pc;
  pendingIceCandidates[playerId] = [];

  pc.ontrack = event => {
    const videoElement = document.getElementById('spectator-camera-feed');
    if (videoElement) videoElement.srcObject = event.streams[0];
  };

  pc.onicecandidate = event => {
    if (event.candidate && pc.signalingState !== 'closed') {
      socket.emit('webrtc-ice-candidate', { to: playerId, candidate: event.candidate });
    }
  };

  const handleOfferMobile = async ({ from, offer }) => {
    if (from === playerId && pc.signalingState !== 'closed') {
      try {
        if (pc.signalingState === 'stable') {
          // Already negotiated, ignore duplicate offer
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        if (pc.signalingState === 'have-remote-offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc-answer', { to: playerId, answer });
          (pendingIceCandidates[playerId] || []).forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
          });
          pendingIceCandidates[playerId] = [];
        }
      } catch (error) {
        console.warn(`Mobile WebRTC offer error for player ${playerId}:`, error);
      }
    }
  };
  

  const handleIceCandidateMobile = ({ from, candidate }) => {
    if (from === playerId && candidate && pc.signalingState !== 'closed') {
      if (pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
      } else {
        pendingIceCandidates[playerId].push(candidate);
      }
    }
  };

  socketEventListeners[playerId] = { offer: handleOfferMobile, iceCandidate: handleIceCandidateMobile };
  socket.on('webrtc-offer', handleOfferMobile);
  socket.on('webrtc-ice-candidate', handleIceCandidateMobile);
}

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
    li.style.cursor = 'pointer';
    li.onclick = () => selectPlayerCameraMobile(p.id, p.name);
    if (selectedPlayerMobile === p.id) li.classList.add('selected');
    if (i % 2 === 0) redList.appendChild(li);
    else blueList.appendChild(li);
  });

  redScore.textContent = teamPoints.red;
  blueScore.textContent = teamPoints.blue;
}



// // Desktop: Create camera grid (only when player list changes)
// function updateCameraGrid(players) {
//   const grid = document.getElementById('spectator-cameras-grid');
//   grid.innerHTML = '';

//   // Close all existing connections since we're rebuilding
//   Object.keys(spectatorPeerConnections).forEach(closePeerConnection);

//   players.forEach((player, i) => {
//     const team = i % 2 === 0 ? 'red' : 'blue';
//     const block = document.createElement('div');
//     block.className = `player-camera-block ${team}-team`;
//     block.innerHTML = `
//       <div class="player-camera-header ${team}-team">
//         ${team === 'red' ? '🔴' : '🔵'} ${player.name}
//       </div>
//       <video class="player-camera-video" id="camera-${player.id}" autoplay playsinline muted style="display:none;"></video>
//       <div class="player-camera-placeholder" id="placeholder-${player.id}">
//         Waiting for camera feed...
//       </div>
//     `;
//     grid.appendChild(block);

//     // Request camera feed for this player
//     requestPlayerCameraDesktop(player.id);
//   });
// }



// Mobile: Single camera selection


// Handle window resize
window.addEventListener('resize', () => {
  if (document.getElementById('spectator-screen').classList.contains('hidden')) return;

  const lobby = { players: allPlayers };
  updateSpectatorView(lobby);
});

// Clean up when leaving spectator mode
function cleanupSpectatorConnections() {
  Object.keys(spectatorPeerConnections).forEach(closePeerConnection);
  selectedPlayerMobile = null;
  lastPlayerIds = [];
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
  if (hideId === 'spectator-screen') {
    cleanupSpectatorConnections();
  }
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

// Initialize blood system when starting webcam
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

      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;

      const context = canvasElement.getContext('2d', { willReadFrequently: true });

      // Initialize blood system
      initBloodSystem();
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

      // Initialize blood system
      initBloodSystem();
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

function detectDominantColor(data) {
  let colorCounts = { red: 0, blue: 0, purple: 0, yellow: 0 };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r > 180 && g < 100 && b < 100) colorCounts.red++;
    else if (b > 150 && r < 100 && g < 100) colorCounts.blue++;
    else if (r > 100 && b > 100 && g < 80) colorCounts.purple++;
    else if (r > 200 && g > 200 && b < 100) colorCounts.yellow++;
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

// Add CSS fadeOut animation
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
