const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

const allowedOrigins = [
    'http://localhost:3000',
    'https://group-8-bbd.vercel.app',
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// ✅ In-memory session store
const sessions = {}; // sessionId => { hostId, players, spectators, started, teamPoints }
const teamShotModifiers = {}; // sessionId -> { red, blue }
const purpleScansRemaining = {}; // sessionId -> { red, blue }

function makeCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Helper: Only send plain lobby data (no socket or circular refs)
function getPublicLobby(s) {
    return {
        hostId: s.hostId,
        players: s.players.map(p => ({ id: p.id, name: p.name })), // ensure plain objects
        spectators: s.spectators.map(sp => ({ id: sp.id, name: sp.name })),
        started: s.started,
        teamPoints: s.teamPoints,
        timer: s.timer
    };
}

io.on('connection', socket => {

    socket.on('createSession', ({ username }) => {
        const sessionId = makeCode();
        sessions[sessionId] = {
            timer: 120, // 2 minutes
            interval: null,
            hostId: socket.id,
            players: [{ id: socket.id, name: username }],
            spectators: [],
            started: false,
            teamPoints: { red: 100, blue: 100 }
        };
        socket.join(sessionId);
        io.to(socket.id).emit('sessionCreated', { sessionId, lobby: getPublicLobby(sessions[sessionId]) });
    });

    socket.on('joinSession', ({ username, sessionId, asSpectator }) => {
        const s = sessions[sessionId];

        if (!s) {
            return socket.emit('errorMsg', '❌ Session does not exist.');
        }

        if (s.started) {
            return socket.emit('errorMsg', '❌ Game has already started. You cannot join at this stage.');
        }

        const nameTaken = s.players.concat(s.spectators).some(p => p.name === username);
        if (nameTaken) {
            return socket.emit('errorMsg', '❌ Username already taken in this session.');
        }

        socket.join(sessionId);

        if (asSpectator) {
            s.spectators.push({ id: socket.id, name: username });
        } else {
            s.players.push({ id: socket.id, name: username });
        }

        io.to(sessionId).emit('lobbyUpdate', getPublicLobby(s));
    });

    socket.on('startGame', ({ sessionId }) => {
        const s = sessions[sessionId];
        if (!s) return;

        // Only host can start & we need an even number of players (minimum 2)
        if (socket.id !== s.hostId || s.players.length < 2 || s.players.length % 2 !== 0) return;

        s.started = true;
        teamShotModifiers[sessionId] = { red: 3, blue: 3 };
        purpleScansRemaining[sessionId] = { red: 3, blue: 3 };
        s.teamPoints = { red: 100, blue: 100 };
        s.timer = 120; // 2 minutes
        s.interval = null;

        io.to(sessionId).emit('gameStarted', getPublicLobby(s));

        // Emit initial points and modifiers
        io.to(sessionId).emit('pointsUpdate', {
            red: s.teamPoints.red,
            blue: s.teamPoints.blue,
            modifiers: teamShotModifiers[sessionId],
            purpleLeft: purpleScansRemaining[sessionId]
        });

        // Start game timer
        s.interval = setInterval(() => {
            s.timer--;
            io.to(sessionId).emit('timerUpdate', s.timer);

            if (s.timer <= 0) {
                clearInterval(s.interval);
                let result;
                if (s.teamPoints.red > s.teamPoints.blue) result = 'red';
                else if (s.teamPoints.blue > s.teamPoints.red) result = 'blue';
                else result = 'draw';

                io.to(sessionId).emit('gameEnded', result);
            }
        }, 1000);
    });

    socket.on('teamHit', ({ sessionId, shooterTeam, victimTeam, scannedColor }) => {
        const s = sessions[sessionId];

        // Prevent hit processing if session or game isn't valid
        if (!s || !s.started || !s.teamPoints || !s.teamPoints[shooterTeam] || !s.teamPoints[victimTeam]) return;

        if (!teamShotModifiers[sessionId]) {
            teamShotModifiers[sessionId] = { red: 3, blue: 3 };
        }

        if (!purpleScansRemaining[sessionId]) {
            purpleScansRemaining[sessionId] = { red: 3, blue: 3 };
        }

        const mod = teamShotModifiers[sessionId][shooterTeam];

        if (scannedColor === 'purple') {
            if (purpleScansRemaining[sessionId][shooterTeam] > 0) {
                s.teamPoints[shooterTeam] += 10;
                purpleScansRemaining[sessionId][shooterTeam]--;
            }
        } else if (scannedColor === 'yellow') {
            if (teamShotModifiers[sessionId][shooterTeam] < 5) {
                teamShotModifiers[sessionId][shooterTeam]++;
            }
        } else if (scannedColor === victimTeam) {
            s.teamPoints[shooterTeam] += 1;
            s.teamPoints[victimTeam] -= mod;
            if (s.teamPoints[victimTeam] < 0) s.teamPoints[victimTeam] = 0;
        }

        io.to(sessionId).emit('pointsUpdate', {
            red: s.teamPoints.red,
            blue: s.teamPoints.blue,
            modifiers: teamShotModifiers[sessionId],
            purpleLeft: purpleScansRemaining[sessionId]
        });

        // 🛑 Only end game if it's running AND a team hits 0
        if (s.started && s.teamPoints[victimTeam] <= 0) {
            clearInterval(s.interval);
            io.to(sessionId).emit('gameEnded', shooterTeam); // Winning team
        }
    });

    socket.on('disconnect', () => {
        for (const [sid, s] of Object.entries(sessions)) {
            const idxP = s.players.findIndex(p => p.id === socket.id);
            const idxS = s.spectators.findIndex(sp => sp.id === socket.id);
            if (idxP > -1) s.players.splice(idxP, 1);
            if (idxS > -1) s.spectators.splice(idxS, 1);

            if (s.players.length === 0 && s.spectators.length === 0) {
                delete sessions[sid];
                delete teamShotModifiers[sid];
                delete purpleScansRemaining[sid];
            } else {
                io.to(sid).emit('lobbyUpdate', getPublicLobby(s));
            }
        }
    });

    // Spectator requests to watch a player's camera
    socket.on('spectator-watch-player', ({ sessionId, playerId }) => {
        // Forward this to the player so they can start WebRTC signaling
        io.to(playerId).emit('spectator-watch-request', { spectatorId: socket.id });
    });

    // WebRTC offer/answer/candidate signaling
    socket.on('webrtc-offer', ({ to, offer }) => {
        io.to(to).emit('webrtc-offer', { from: socket.id, offer });
    });
    socket.on('webrtc-answer', ({ to, answer }) => {
        io.to(to).emit('webrtc-answer', { from: socket.id, answer });
    });
    socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
        io.to(to).emit('webrtc-ice-candidate', { from: socket.id, candidate });
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
