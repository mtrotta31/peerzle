import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { CURRENT_TOS_VERSION } from '../data/legal-content';

const router = Router();

// Rate limiters for auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per window (increased for testing)
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 signups per hour (increased for testing)
  message: { error: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const SALT_ROUNDS = 10;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  is_super_admin: boolean;
  first_name: string | null;
  last_name: string | null;
}

function generateToken(userId: string, email: string, isSuperAdmin: boolean = false): string {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { userId, email, isSuperAdmin },
    process.env.JWT_SECRET!,
    { expiresIn } as jwt.SignOptions
  );
}

// POST /api/auth/signup
router.post('/signup', signupLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, acceptedTermsVersion, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (!firstName || !lastName) {
      res.status(400).json({ error: 'First name and last name are required' });
      return;
    }

    // Validate name lengths
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (trimmedFirstName.length === 0 || trimmedFirstName.length > 100) {
      res.status(400).json({ error: 'First name must be 1-100 characters' });
      return;
    }

    if (trimmedLastName.length === 0 || trimmedLastName.length > 100) {
      res.status(400).json({ error: 'Last name must be 1-100 characters' });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    // Validate terms acceptance
    if (!acceptedTermsVersion || acceptedTermsVersion !== CURRENT_TOS_VERSION) {
      res.status(400).json({ error: 'You must accept the current Terms of Service to create an account' });
      return;
    }

    const existing = await query<UserRow>(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user with TOS acceptance and name
    const result = await query<UserRow>(
      `INSERT INTO users (email, password_hash, first_name, last_name, tos_accepted_at, tos_version)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
       RETURNING id, email, first_name, last_name, created_at`,
      [email.toLowerCase(), passwordHash, trimmedFirstName, trimmedLastName, CURRENT_TOS_VERSION]
    );

    const user = result.rows[0];

    // Get IP address for audit log
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      null;

    // Log the acceptance for audit trail
    await query(
      `INSERT INTO tos_acceptance_log (user_id, version, ip_address)
       VALUES ($1, $2, $3)`,
      [user.id, CURRENT_TOS_VERSION, ipAddress]
    );

    const token = generateToken(user.id, user.email);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await query<UserRow>(
      `SELECT id, email, password_hash, created_at, first_name, last_name,
              COALESCE(is_super_admin, false) as is_super_admin
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    await query(
      'UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    const token = generateToken(user.id, user.email, user.is_super_admin);

    // Check if user needs to update their profile (missing name)
    const needsProfileUpdate = !user.first_name || !user.last_name;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
        isSuperAdmin: user.is_super_admin,
        needsProfileUpdate,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    // Get user's current password hash
    const result = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query<UserRow>(
      `SELECT id, email, first_name, last_name, created_at,
              COALESCE(is_super_admin, false) as is_super_admin
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    const needsProfileUpdate = !user.first_name || !user.last_name;

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      createdAt: user.created_at,
      isSuperAdmin: user.is_super_admin,
      needsProfileUpdate,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
