import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  const token = localStorage.getItem('token');

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function joinConversation(conversationId: string): void {
  socket?.emit('join_conversation', conversationId);
}

export function leaveConversation(conversationId: string): void {
  socket?.emit('leave_conversation', conversationId);
}

export function sendTypingIndicator(conversationId: string, isTyping: boolean): void {
  socket?.emit('typing', { conversationId, isTyping });
}
