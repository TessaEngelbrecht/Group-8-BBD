const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// ✅ List of allowed frontend origins (local + Vercel)
const allowedOrigins = [
    'http://localhost:3000',
    'https://group-8-bbd.vercel.app'
];

// ✅ CORS setup for REST and WebSocket preflight
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// ✅ Create server and configure Socket.IO with same CORS
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// ✅ Store all active sessions
const sessions = {}; // { sessionId: { hostId, players: [], spectators: [], started: false } }

function makeCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// ✅ Handle Socket.IO events
io.on('connection', socket => {
    socket.on('createSession', ({ username }) => {
        const sessionId = makeCode();
        sessions[sessionId] = {
            hostId: socket.id,
            players: [{ id: socket.id, name: username }],
            spectators: [],
            started: false
        };
        socket.join(sessionId);
        io.to(socket.id).emit('sessionCreated', { sessionId, lobby: sessions[sessionId] });
    });

    socket.on('joinSession', ({ username, sessionId, asSpectator }) => {
        const s = sessions[sessionId];
        if (!s) return socket.emit('errorMsg', 'Session not found');
        socket.join(sessionId);
        if (asSpectator) {
            s.spectators.push({ id: socket.id, name: username });
        } else {
            s.players.push({ id: socket.id, name: username });
        }
        io.to(sessionId).emit('lobbyUpdate', s);
    });

    socket.on('startGame', ({ sessionId }) => {
        const s = sessions[sessionId];
        if (!s) return;
        if (socket.id !== s.hostId || s.players.length < 2) return;
        s.started = true;
        io.to(sessionId).emit('gameStarted', s);
    });

    socket.on('disconnect', () => {
        for (const [sid, s] of Object.entries(sessions)) {
            const idxP = s.players.findIndex(p => p.id === socket.id);
            const idxS = s.spectators.findIndex(sp => sp.id === socket.id);
            if (idxP > -1) s.players.splice(idxP, 1);
            if (idxS > -1) s.spectators.splice(idxS, 1);
            if (s.players.length === 0 && s.spectators.length === 0) {
                delete sessions[sid];
            } else {
                io.to(sid).emit('lobbyUpdate', s);
            }
        }
    });

    //Snapshot
    socket.on('playerSnapshot', ({ sessionId, username, image }) => {
  io.to(sessionId).emit('snapshotUpdate', { username, image });
});

});

// ✅ Dynamic port for Railway (fallback for local)
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
