// src/socket.js
import { io } from 'socket.io-client';

const socket = io('https://group-8-bbd-production.up.railway.app'); // ✅ Use your Railway URL

export default socket;
