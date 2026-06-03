import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
// O servidor Socket.IO escuta na raiz do host da API (sem o prefixo /api).
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? API_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

/**
 * Socket.IO singleton. O token é resolvido dinamicamente a cada (re)conexão,
 * então um refresh de access token é refletido nas reconexões automáticas.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(WS_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getAccessToken() ?? '' }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 10000,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
