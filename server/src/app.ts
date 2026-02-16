import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env file (works in both development and production)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import passwordResetRoutes from './routes/password-reset';
import communityRoutes from './routes/communities';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import helperRoutes from './routes/helpers';
import ratingRoutes from './routes/ratings';
import historyRoutes from './routes/history';
import dashboardRoutes from './routes/dashboard';
import facilitatorRoutes from './routes/facilitator';
import adminRoutes from './routes/admin';
import adminStatsRoutes from './routes/admin-stats';
import organizationsRoutes from './routes/organizations';
import verificationRoutes from './routes/verification';
import trainingRoutes from './routes/training';
import legalRoutes from './routes/legal';
import onboardingRoutes from './routes/onboarding';
import reportsRoutes from './routes/reports';
import suggestionsRoutes from './routes/suggestions';
import pushRoutes from './routes/push';
import superAdminRoutes from './routes/super-admin';
import webhookRoutes from './routes/webhooks';
import profileRoutes from './routes/profile';
import moodCheckinsRoutes from './routes/mood-checkins';
import adminMoodRoutes from './routes/admin-mood';
import { initializeSocket } from './config/socket';
import { startMoodCheckinScheduler } from './services/mood-checkin-scheduler';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiting behind Railway's load balancer
app.set('trust proxy', 1);

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
app.use('/api/auth', passwordResetRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/helpers', helperRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/facilitator', facilitatorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/communities', verificationRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/mood-checkins', moodCheckinsRoutes);
app.use('/api/admin', adminMoodRoutes);

// Serve static files from client build in production
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // Serve index.html for all non-API routes (SPA fallback)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log('Serving static files from:', clientDistPath);
}

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start the daily mood check-in notification scheduler
  startMoodCheckinScheduler();
});

export { app, httpServer };
