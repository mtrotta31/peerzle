import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import communityRoutes from './routes/communities';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import helperRoutes from './routes/helpers';
import ratingRoutes from './routes/ratings';
import historyRoutes from './routes/history';
import dashboardRoutes from './routes/dashboard';
import facilitatorRoutes from './routes/facilitator';
import adminRoutes from './routes/admin';
import { initializeSocket } from './config/socket';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.io
initializeSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/helpers', helperRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/facilitator', facilitatorRoutes);
app.use('/api/admin', adminRoutes);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, httpServer };
