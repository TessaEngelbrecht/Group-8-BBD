# Group-8-BBD

# 🎯 Neon Laser Arena - Real-Time Laser Tag Game

- **Real-time multiplayer gameplay** with Socket.IO
- **Computer vision color detection** using device cameras
- **Live spectator mode** with WebRTC video streaming
- **Futuristic neon UI** with blood damage effects
- **Cross-platform compatibility** (mobile \& desktop)
- **Team-based scoring system** with power-ups


## 🛠️ Tech Stack

### Backend

- **Node.js** with **Express** - Server framework
- **Socket.IO** - Real-time bidirectional communication
- **CORS** - Cross-origin resource sharing middleware


### Frontend

- **HTML5** - Structure and Canvas API for effects
- **CSS3** - Neon-themed styling with animations
- **Vanilla JavaScript** - DOM manipulation and game logic
- **WebRTC** - Peer-to-peer video streaming for spectators


### Real-Time Communication

- **WebSocket** integration via Socket.IO
- **Custom event system** for game state management
- **WebRTC signaling** for video streaming

## 🏃‍♂️ How to Run

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** or **yarn**
- **Modern web browser** with camera access
- **HTTPS** (required for camera access in production)


### Installation

1. **Clone the repository**

```bash
git clone https://github.com/TessaEngelbrecht/Group-8-BBD.git
cd laser-tag-game
```

2. **Install dependencies**

```bash
npm install
```

3. **Run client**

```
cd client
serve .

Open http://localhost:3000 
```

## 🎮 How to Play

### For Players

1. **Enter your callsign** (username)
2. **Create a new mission** or **join existing** with mission code
3. **Wait for even number of players** (minimum 2)
4. **Host starts the game**
5. **Use your camera to scan colored targets**:
    - 🔴 **Red** - Damage enemy team
    - 🔵 **Blue** - Damage enemy team
    - 🟡 **Yellow** - Increase damage modifier (limited uses)
    - 🟣 **Purple** - Bonus points (limited uses)
6. **Survive until time runs out** or enemy team reaches 0 points

### For Spectators

1. **Join as Observer** using mission code
2. **Select players** to watch their camera feeds
3. **Monitor team scores** and game progress in real-time

## 🔧 Game Mechanics

### Color Detection System

- **Canvas-based processing** of webcam feed
- **RGB threshold detection** for color identification
- **Dominant color algorithm** with configurable sensitivity
- **Real-time feedback** with scan notifications


### Scoring System

- **Base team health**: 100 points each
- **Damage modifiers**: Increase with yellow scans
- **Purple bonuses**: Limited special power-ups
- **Real-time updates** across all connected clients


### WebRTC Spectator System

- **Peer-to-peer video streaming** between players and spectators
- **Dynamic camera switching** for spectators
- **ICE candidate handling** for NAT traversal
- **Automatic connection cleanup**


## 🎨 Visual Effects

### Blood Damage System

- **Dynamic blood splatter** based on damage taken
- **Progressive screen vignette** as health decreases
- **Screen shake effects** on damage, only on android
- **Healing animations** when scoring points


## 🔒 Security Considerations

- **Input validation** on all socket events
- **Session-based game isolation**
- **CORS configuration** for allowed origins


## 🐛 Troubleshooting

### Common Issues

1. **Camera not working**
    - Ensure HTTPS in production
    - Grant camera permissions
    - Check browser compatibility
2. **Socket connection fails**
    - Check firewall settings
    - Confirm correct port/URL
3. **WebRTC not connecting**
    - Check NAT/firewall configuration
    - Verify STUN/TURN servers (for production)
    - Test on same network first

## 📱 Browser Compatibility

- **Chrome 80+** (recommended)
- **Firefox 75+**
- **Safari 13+**
- **Edge 80+**

**Note**: Camera access requires HTTPS.


