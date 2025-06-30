const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] }
});

const sessions = {}; // { sessionId: { hostId, players: [], spectators: [], started: false } }

function makeCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

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
            if (s.players.length === 0 && s.spectators.length === 0) delete sessions[sid];
            else io.to(sid).emit('lobbyUpdate', s);
        }
    });
});

server.listen(4000, () => console.log('Server running on :4000'));
