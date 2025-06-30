import React from 'react';

function LobbyView({ sessionId, lobby, isHost, onStart, gameStarted }) {
    return (
        <div className="screen">
            <h2>Session Lobby</h2>
            <div style={{ marginBottom: '15px' }}>
                <span id="game-id-display">{sessionId}</span>
                <button id="copy-game-id-btn"
                    onClick={() => {
                        navigator.clipboard.writeText(sessionId);
                        alert('Game code copied!');
                    }}
                >
                    Copy Code
                </button>
            </div>

            <h3>Players</h3>
            <ul id="player-list">
                {lobby.players.map(p => (
                    <li key={p.id}>{p.name}</li>
                ))}
            </ul>

            {lobby.spectators.length > 0 && (
                <>
                    <h3>Spectators</h3>
                    <ul id="player-list">
                        {lobby.spectators.map(s => (
                            <li key={s.id}>{s.name}</li>
                        ))}
                    </ul>
                </>
            )}

            <p>
                Status: <strong>{gameStarted
                    ? 'Started'
                    : lobby.players.length < 2
                        ? 'Waiting for 1 more player...'
                        : 'Ready to start!'}</strong>
            </p>

            {isHost && !gameStarted && lobby.players.length >= 2 && (
                <button onClick={onStart}>Start Game</button>
            )}
        </div>
    );
}

export default LobbyView;
