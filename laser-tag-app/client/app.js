// ✅ laser-tag-static/app.js (Finalised with point logic, popups & leaderboard sync)
const socket = io("https://group-8-bbd-production.up.railway.app", {
  transports: ["websocket"],
});

let username = "";
let sessionId = "";
let isHost = false;
let playerId = -1;
let playerSymbol = null;
let playerPoints = 100;
let allPlayers = [];

const colorAssignments = ["red", "blue", "green", "yellow"];

// DOM
const loginScreen = document.getElementById("login-screen");
const chooseScreen = document.getElementById("choose-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");
const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("overlay");
const ctx = canvasElement.getContext("2d");
// Sound effect
let shootSound;
window.addEventListener("DOMContentLoaded", () => {
  shootSound = document.getElementById("shoot-sound");
});

// Buttons
const continueBtn = document.getElementById("continue-btn");
const createBtn = document.getElementById("create-session-btn");
const joinCodeInput = document.getElementById("join-code");
const joinPlayerBtn = document.getElementById("join-player-btn");
const joinSpectatorBtn = document.getElementById("join-spectator-btn");
const startGameBtn = document.getElementById("start-game-btn");
const copyGameIdBtn = document.getElementById("copy-game-id-btn");
const usernameInput = document.getElementById("username");

continueBtn.onclick = () => {
  console.log("Continue button clicked");
  alert("Continue handler fired");
  username = usernameInput.value.trim();
  if (username) {
    document.getElementById("display-username").textContent = username;
    switchScreen("login-screen", "choose-screen");
  } else {
    alert("Please enter a username.");
  }
};

// Allow pressing Enter to trigger continue
usernameInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    continueBtn.click();
  }
});

createBtn.onclick = () => {
  socket.emit("createSession", { username });
};

joinPlayerBtn.onclick = () => {
  sessionId = joinCodeInput.value.trim();
  if (sessionId) {
    socket.emit("joinSession", { username, sessionId, asSpectator: false });
  }
  switchScreen("choose-screen", "lobby-screen");
};

joinSpectatorBtn.onclick = () => {
  sessionId = joinCodeInput.value.trim();
  if (sessionId) {
    socket.emit("joinSession", { username, sessionId, asSpectator: true });
  }
  switchScreen("choose-screen", "lobby-screen");
};

startGameBtn.onclick = () => {
  socket.emit("startGame", { sessionId });
};

copyGameIdBtn.onclick = () => {
  if (sessionId) {
    navigator.clipboard
      .writeText(sessionId)
      .then(() => {
        alert("Game code copied!");
      })
      .catch(() => {
        alert("Failed to copy game code. Please copy manually.");
      });
  } else {
    alert("No game code to copy yet.");
  }
};

socket.on("sessionCreated", ({ sessionId: id, lobby }) => {
  isHost = true;
  sessionId = id;
  updateLobby(lobby);
  switchScreen("choose-screen", "lobby-screen");
});

socket.on("lobbyUpdate", (lobby) => {
  updateLobby(lobby);
});

// --- Tab and Enemy Info Logic ---
const tabYouBtn = document.getElementById("tab-you");
const tabEnemyBtn = document.getElementById("tab-enemy");
const tabContentYou = document.getElementById("tab-content-you");
const tabContentEnemy = document.getElementById("tab-content-enemy");
const leaderboardDiv = document.getElementById("leaderboard");

function showTab(tab) {
  if (tab === "you") {
    tabYouBtn.classList.add("active");
    tabEnemyBtn.classList.remove("active");
    tabContentYou.style.display = "block";
    tabContentEnemy.style.display = "none";
  } else {
    tabYouBtn.classList.remove("active");
    tabEnemyBtn.classList.add("active");
    tabContentYou.style.display = "none";
    tabContentEnemy.style.display = "block";
  }
}

tabYouBtn.addEventListener("click", () => showTab("you"));
tabEnemyBtn.addEventListener("click", () => showTab("enemy"));

function updateEnemyInfo() {
  // Find the first other player as the enemy
  const enemy = allPlayers.find((p) => p.name !== username);
  if (enemy) {
    document.getElementById(
      "enemy-symbol"
    ).textContent = `Enemy color: ${enemy.color}`;
    document.getElementById(
      "enemy-points"
    ).textContent = `Points: ${enemy.points}`;
    document.getElementById("enemy-ammo").textContent = `Ammunition: ${
      enemy.ammo ?? 10
    }`;
  } else {
    document.getElementById("enemy-symbol").textContent = "No enemy found.";
    document.getElementById("enemy-points").textContent = "";
    document.getElementById("enemy-ammo").textContent = "";
  }
}

socket.on("gameStarted", (lobby) => {
  updateLobby(lobby);
  assignPlayerSymbol(lobby);
  switchScreen("lobby-screen", "game-screen");
  showTab("you");
  leaderboardDiv.style.display = "none";
  updateEnemyInfo();
  // Play ambient eerie sound if available
  let ambient = document.getElementById("ambient-sound");
  if (ambient) {
    ambient.currentTime = 0;
    ambient.volume = 0.3;
    ambient.loop = true;
    ambient.play();
  }
  startWebcam();
});

function startWebcam() {
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      videoElement.srcObject = stream;
      videoElement.play();
      detectColorLoop();
    })
    .catch((err) => {
      alert("Camera access denied or not available");
    });
}

// Add ammo property to each player (default 10)
function updateLobby(lobby) {
  document.getElementById("game-id-display").textContent = sessionId;
  const playersList = document.getElementById("players-list");
  const spectatorsList = document.getElementById("spectators-list");
  playersList.innerHTML = "";
  spectatorsList.innerHTML = "";
  allPlayers = lobby.players.map((p, index) => ({
    ...p,
    color: colorAssignments[index % colorAssignments.length],
    points: p.points ?? 100,
    ammo: p.ammo !== undefined ? p.ammo : 10,
  }));

  lobby.players.forEach((p, index) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${
      colorAssignments[index % colorAssignments.length]
    })`;
    if (p.name === username) {
      playerId = index;
    }
    playersList.appendChild(li);
  });

  lobby.spectators.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s.name;
    spectatorsList.appendChild(li);
  });

  const statusText = lobby.started
    ? "Game Started!"
    : lobby.players.length < 2
    ? "Waiting for 1 more player..."
    : "Ready to start!";
  document.getElementById("game-status").textContent = statusText;

  if (isHost && !lobby.started && lobby.players.length >= 2) {
    startGameBtn.classList.remove("hidden");
  } else {
    startGameBtn.classList.add("hidden");
  }

  // Only show leaderboard if not in game
  if (!lobby.started) {
    leaderboardDiv.style.display = "block";
  }
  renderLeaderboard();
  updateEnemyInfo();
}

// Show ammo in player and enemy info
function assignPlayerSymbol(lobby) {
  if (playerId >= 0) {
    const color = colorAssignments[playerId % colorAssignments.length];
    playerSymbol = { color };
    document.getElementById(
      "player-symbol"
    ).textContent = `Your tag color: ${playerSymbol.color}`;
    document.getElementById(
      "player-points"
    ).textContent = `Points: ${playerPoints}`;
    document.getElementById("player-ammo").textContent = `Ammunition: ${
      allPlayers[playerId]?.ammo ?? 10
    }`;
  }
}

function updateEnemyInfo() {
  // Find the first other player as the enemy
  const enemy = allPlayers.find((p) => p.name !== username);
  if (enemy) {
    document.getElementById(
      "enemy-symbol"
    ).textContent = `Enemy color: ${enemy.color}`;
    document.getElementById(
      "enemy-points"
    ).textContent = `Points: ${enemy.points}`;
    document.getElementById("enemy-ammo").textContent = `Ammunition: ${
      enemy.ammo ?? 10
    }`;
  } else {
    document.getElementById("enemy-symbol").textContent = "No enemy found.";
    document.getElementById("enemy-points").textContent = "";
    document.getElementById("enemy-ammo").textContent = "";
  }
}

// Update detectColorLoop to decrease ammo
let isReloading = false;
let reloadTimeout = null;

function pauseAmbientSound() {
  const ambient = document.getElementById("ambient-sound");
  if (ambient) ambient.pause();
}

function endGameForPlayer(message) {
  document.getElementById("game-screen").classList.add("hidden");
  pauseAmbientSound();
  console.log("Game over for player: " + username);
  alert(message || "💀 Game Over! You are out.");
}

function showWinMessage() {
  document.getElementById("game-screen").classList.add("hidden");
  pauseAmbientSound();
  console.log("You win!");
  alert("🎉 You win!");
}

const shootBtn = document.getElementById("shoot-btn");
let lastDetectedColor = null;

// Modify detectColorLoop to only update lastDetectedColor
function detectColorLoop() {
  setInterval(() => {
    if (isReloading) return;
    ctx.drawImage(
      videoElement,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );
    const frame = ctx.getImageData(
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );
    const data = frame.data;
    lastDetectedColor = detectDominantColor(data);
  }, 700);
}

shootBtn.onclick = function () {
  if (isReloading) {
    console.log("Tried to shoot while reloading");
    return;
  }
  const detectedColor = lastDetectedColor;
  console.log(
    `Shoot button clicked. Detected color: ${detectedColor}, Player color: ${playerSymbol.color}`
  );
  if (
    detectedColor &&
    playerSymbol.color &&
    detectedColor !== playerSymbol.color &&
    ["red", "blue", "green", "yellow"].includes(detectedColor)
  ) {
    const victim = allPlayers.find((p) => p.color === detectedColor);
    const attacker = allPlayers.find((p) => p.name === username);
    if (victim && victim.name !== username && attacker && attacker.ammo > 0) {
      console.log(
        `Shooting at ${victim.name} (${victim.color}). Attacker: ${attacker.name}, Ammo before: ${attacker.ammo}, Points before: ${attacker.points}`
      );
      // Play shoot sound effect
      if (shootSound) {
        shootSound.currentTime = 0;
        shootSound.play();
      }
      attacker.points += 5;
      attacker.ammo -= 1;
      victim.points -= 10;
      console.log(
        `Attacker points: ${attacker.points}, Attacker ammo: ${attacker.ammo}, Victim points: ${victim.points}`
      );
      if (victim.name === username) {
        playerPoints = victim.points;
      } else if (attacker) {
        playerPoints = attacker.points;
      }
      document.getElementById(
        "player-points"
      ).textContent = `Points: ${playerPoints}`;
      document.getElementById(
        "player-ammo"
      ).textContent = `Ammunition: ${attacker.ammo}`;
      renderLeaderboard();
      updateEnemyInfo && updateEnemyInfo();
      const toast = document.createElement("div");
      toast.textContent = `🎯 Shot ${detectedColor}! Points updated.`;
      toast.style.position = "absolute";
      toast.style.top = "10px";
      toast.style.left = "50%";
      toast.style.transform = "translateX(-50%)";
      toast.style.backgroundColor = "#333";
      toast.style.color = "#fff";
      toast.style.padding = "10px 20px";
      toast.style.borderRadius = "6px";
      toast.style.zIndex = "9999";
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 2000);
      // Eliminate if points <= 0
      if (victim.points <= 0) {
        console.log(`${victim.name} eliminated!`);
        if (victim.name === username) {
          videoElement.pause();
          endGameForPlayer("💀 Game Over! You are out.");
          setTimeout(() => {
            const winner = allPlayers.find(
              (p) => p.name !== username && p.points > 0
            );
            if (winner && winner.name === username) {
              showWinMessage();
            }
          }, 500);
        } else {
          const killToast = document.createElement("div");
          killToast.textContent = `💀 ${victim.name} (${victim.color}) eliminated!`;
          killToast.style.position = "absolute";
          killToast.style.top = "40px";
          killToast.style.left = "50%";
          killToast.style.transform = "translateX(-50%)";
          killToast.style.backgroundColor = "#900";
          killToast.style.color = "#fff";
          killToast.style.padding = "10px 20px";
          killToast.style.borderRadius = "6px";
          killToast.style.zIndex = "9999";
          document.body.appendChild(killToast);
          setTimeout(() => document.body.removeChild(killToast), 2000);
          if (attacker && attacker.name === username) {
            setTimeout(() => showWinMessage(), 700);
          }
        }
        pauseAmbientSound();
      }
      // Handle reload if attacker runs out of ammo
      if (attacker.ammo <= 0 && attacker.name === username) {
        isReloading = true;
        pauseAmbientSound();
        document.getElementById(
          "player-ammo"
        ).textContent = `Ammunition: 0 (Reloading...)`;
        const reloadToast = document.createElement("div");
        reloadToast.textContent = `You are out of ammo, reloading...`;
        reloadToast.style.position = "absolute";
        reloadToast.style.top = "60px";
        reloadToast.style.left = "50%";
        reloadToast.style.transform = "translateX(-50%)";
        reloadToast.style.backgroundColor = "#222";
        reloadToast.style.color = "#fff";
        reloadToast.style.padding = "10px 20px";
        reloadToast.style.borderRadius = "6px";
        reloadToast.style.zIndex = "9999";
        document.body.appendChild(reloadToast);
        setTimeout(() => document.body.removeChild(reloadToast), 2000);
        console.log("Reloading ammo...");
        reloadTimeout = setTimeout(() => {
          attacker.ammo = 10;
          document.getElementById("player-ammo").textContent = `Ammunition: 10`;
          isReloading = false;
          const me = allPlayers.find((p) => p.name === username);
          if (me && me.points > 0) {
            const ambient = document.getElementById("ambient-sound");
            if (ambient) {
              ambient.currentTime = 0;
              ambient.volume = 0.3;
              ambient.loop = true;
              ambient.play();
            }
          }
          console.log("Reload complete.");
        }, 3000);
      }
    }
  } else {
    console.log("No valid target detected or tried to shoot own color.");
    const toast = document.createElement("div");
    toast.textContent = `No valid target detected!`;
    toast.style.position = "absolute";
    toast.style.top = "10px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.backgroundColor = "#333";
    toast.style.color = "#fff";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "6px";
    toast.style.zIndex = "9999";
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 1200);
  }
};

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

// Show ammo in leaderboard
function renderLeaderboard() {
  const leaderboard = document.getElementById("leaderboard");
  leaderboard.innerHTML = `<h3 style="color:#ff0033;text-shadow:0 0 10px #ff0033,0 0 20px #000;letter-spacing:2px;">Leaderboard</h3>`;
  const all = [...allPlayers];
  const me = {
    name: username,
    color: playerSymbol?.color,
    points: playerPoints,
    ammo: allPlayers.find((p) => p.name === username)?.ammo ?? 10,
  };
  all.push(me);
  const unique = new Map();
  all.forEach((p) => unique.set(p.name, p));
  const sorted = [...unique.values()].sort((a, b) => b.points - a.points);
  sorted.forEach((p) => {
    const li = document.createElement("div");
    li.innerHTML = `<span style="color:${
      p.color
    };font-weight:bold;text-shadow:0 0 8px ${p.color},0 0 2px #fff;">${
      p.name
    }</span> <span style="color:#fff;">(${
      p.color
    }):</span> <span style="color:#ff0033;font-weight:bold;">${
      p.points
    } pts</span> <span style='color:#fff'>(Ammo: ${p.ammo ?? 10})</span>`;
    li.style.background = "rgba(20,0,0,0.7)";
    li.style.margin = "6px 0";
    li.style.padding = "8px 16px";
    li.style.borderRadius = "8px";
    li.style.boxShadow = "0 0 8px #ff0033, 0 0 2px #000";
    leaderboard.appendChild(li);
  });
}

// --- Ensure switchScreen is defined early ---
function switchScreen(hideId, showId) {
  document.getElementById(hideId).classList.add("hidden");
  document.getElementById(showId).classList.remove("hidden");
  // Add eerie background and flicker for game screen
  if (showId === "game-screen") {
    document.body.style.background =
      "radial-gradient(ellipse at center, #1a1a1a 0%, #000000 100%)";
    document.body.style.transition = "background 1s";
    document.body.classList.add("eerie-flicker");
  } else {
    document.body.style.background = "#181818";
    document.body.classList.remove("eerie-flicker");
  }
}

// --- Settings: Ambient Sound Toggle ---
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeSettings = document.getElementById("close-settings");
const toggleAmbient = document.getElementById("toggle-ambient");
const ambient = document.getElementById("ambient-sound");

settingsBtn.onclick = () => {
  settingsModal.style.display = "flex";
};
closeSettings.onclick = () => {
  settingsModal.style.display = "none";
};
toggleAmbient.onchange = function () {
  if (toggleAmbient.checked) {
    if (ambient) {
      ambient.currentTime = 0;
      ambient.volume = 0.3;
      ambient.loop = true;
      ambient.play();
    }
  } else {
    if (ambient) ambient.pause();
  }
};
// Hide modal if clicking outside the settings card
settingsModal.addEventListener("click", function (e) {
  if (e.target === settingsModal) settingsModal.style.display = "none";
});
