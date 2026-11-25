import { io } from 'socket.io-client';

let socket;
export function getSocket() { return socket; }
export function connectSocket(userId) {
  if (socket?.connected) return socket;
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  socket = io(url, { auth: { userId }, transports: ['websocket', 'polling'] });
  socket.on('connect', () => socket.emit('join', userId));
  return socket;
}
export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = undefined; }
}
