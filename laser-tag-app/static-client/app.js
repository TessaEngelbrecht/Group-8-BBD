// app.js
const socket = io('https://group-8-bbd-production.up.railway.app', {
    transports: ['websocket']
});

let username = '';
let sessionId = '';
let isHost = false;

const loginScreen = document.getElementById('login-screen');
const chooseScreen = document.getElementById('choose-screen');
const lobbyScreen = document.getElementById('lobby-screen');

const continueBtn = document.getElementById('continue-btn');
const createBtn = document.getElementById('create-session-btn');
const joinCodeInput = document.getElementById('join-code');
const joinPlayerBtn = document.getElementById('join-player-btn');
const joinSpectatorBtn = document.getElementById('join-spectator-btn');
const startGameBtn = document.getElementById('start-game-btn');

continueBtn.onclick = () => {
    username = document.getElementById('username').value.trim();
    if (username) {
        document.getElementById('display-username').textContent = username;
        loginScreen.classList.add('hidden');
        chooseScreen.classList.remove('hidden');
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

document.getElementById('copy-game-id-btn').onclick = () => {
    navigator.clipboard.writeText(sessionId);
    alert('Game code copied!');
};

socket.on('sessionCreated', ({ sessionId: id, lobby }) => {
    isHost = true;
    sessionId = id;
    updateLobby(lobby);
    chooseScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
});

socket.on('lobbyUpdate', lobby => {
    updateLobby(lobby);
});

socket.on('gameStarted', lobby => {
    updateLobby(lobby);
    document.getElementById('game-status').textContent = 'Game Started!';
});

socket.on('errorMsg', msg => {
    alert(msg);
});

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
  