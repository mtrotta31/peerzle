import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from './database';

interface JwtPayload {
  userId: string;
  email: string;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

let io: Server;

// Track userId -> Set of socketIds for multi-tab support
const userSockets = new Map<string, Set<string>>();

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      socket.userId = decoded.userId;
      socket.email = decoded.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId}`);

    // Track this socket for the user
    if (socket.userId) {
      if (!userSockets.has(socket.userId)) {
        userSockets.set(socket.userId, new Set());
      }
      userSockets.get(socket.userId)!.add(socket.id);
    }

    // Join user to their active conversation rooms
    try {
      const result = await query<{ id: string }>(
        `SELECT c.id FROM conversations c
         JOIN memberships m ON m.id = c.seeker_membership_id OR m.id = c.helper_membership_id
         WHERE m.user_id = $1 AND c.status != 'ended'`,
        [socket.userId]
      );

      for (const conv of result.rows) {
        socket.join(`conversation:${conv.id}`);
        console.log(`User ${socket.userId} joined conversation:${conv.id}`);
      }
    } catch (error) {
      console.error('Error joining conversation rooms:', error);
    }

    // Join a specific conversation room
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} joined conversation:${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} left conversation:${conversationId}`);
    });

    // Typing indicator
    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_typing', {
        conversationId: data.conversationId,
        userId: socket.userId,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);

      // Remove this socket from the user's set
      if (socket.userId) {
        const sockets = userSockets.get(socket.userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(socket.userId);
          }
        }
      }
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

export function emitToConversation(conversationId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

/**
 * Get all active socket IDs for a given user.
 */
export function getUserSocketIds(userId: string): string[] {
  const sockets = userSockets.get(userId);
  return sockets ? Array.from(sockets) : [];
}

/**
 * Emit an event to all of a user's connected sockets.
 */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  const socketIds = getUserSocketIds(userId);
  for (const socketId of socketIds) {
    io.to(socketId).emit(event, data);
  }
}
