import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
// O Socket.IO é servido SOB o prefixo /api (path '/api/socket.io') para que,
// em produção, o Caddy roteie a conexão (handle /api/*) ao container da API.
// Sem isso, '/socket.io' cairia no handler "tudo o mais" -> container web.
// Base da conexão: mesma origem em prod (API_URL='/api' => ''), ou host direto
// da API em dev (http://localhost:3333). String vazia => mesma origem.
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? API_URL.replace(/\/api\/?$/, '');
const WS_PATH = '/api/socket.io';

let socket: Socket | null = null;

/**
 * Socket.IO singleton. O token é resolvido dinamicamente a cada (re)conexão,
 * então um refresh de access token é refletido nas reconexões automáticas.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(WS_BASE || undefined, {
    path: WS_PATH,
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
