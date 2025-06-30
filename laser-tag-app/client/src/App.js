// src/App.js
import React, { useEffect, useState } from 'react';
import socket from './socket';
import LobbyView from './LobbyView';
import './App.css';


function App() {
  const [step, setStep] = useState('login');
  const [username, setUsername] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [inputSessionId, setInputSessionId] = useState('');
  const [lobby, setLobby] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // 🔌 Setup socket listeners
  useEffect(() => {
    socket.on('sessionCreated', ({ sessionId, lobby }) => {
      setSessionId(sessionId);
      setLobby(lobby);
      setIsHost(true);
      setStep('lobby');
    });

    socket.on('lobbyUpdate', lobby => {
      setLobby(lobby);
    });

    socket.on('gameStarted', lobby => {
      setGameStarted(true);
      setLobby(lobby);
    });

    socket.on('errorMsg', msg => alert(msg));

    return () => {
      socket.off('sessionCreated');
      socket.off('lobbyUpdate');
      socket.off('gameStarted');
      socket.off('errorMsg');
    };
  }, []);

  // Login screen
  if (step === 'login') {
    return (
      <div className="screen">
        <h2>Enter your username</h2>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <button
          disabled={!username.trim()}
          onClick={() => setStep('choose')}
        >
          Continue
        </button>
      </div>
    );
  }


  // Choose screen
  if (step === 'choose') {
    return (
      <div className="screen">
        <h2>Welcome, {username}</h2>
        <button onClick={() => socket.emit('createSession', { username })}>
          ➕ Create New Game
        </button>
        <input
          type="text"
          placeholder="Enter Session Code"
          value={inputSessionId}
          onChange={e => setInputSessionId(e.target.value)}
        />
        <button
          onClick={() => {
            setSessionId(inputSessionId);
            socket.emit('joinSession', {
              username,
              sessionId: inputSessionId,
              asSpectator: false
            });
            setStep('lobby');
          }}
          disabled={!inputSessionId.trim()}
        >
          🎮 Join as Player
        </button>
        <button
          onClick={() => {
            setSessionId(inputSessionId);
            socket.emit('joinSession', {
              username,
              sessionId: inputSessionId,
              asSpectator: true
            });
            setStep('lobby');
          }}
          disabled={!inputSessionId.trim()}
        >
          👁 Join as Spectator
        </button>
      </div>
    );
  }


  // 🛡 Step 3: Lobby
  if (step === 'lobby' && lobby) {
    return (
      <LobbyView
        sessionId={sessionId}
        lobby={lobby}
        isHost={isHost}
        onStart={() => socket.emit('startGame', { sessionId })}
        gameStarted={gameStarted}
      />
    );
  }

  return <div>Loading...</div>;
}

export default App;
