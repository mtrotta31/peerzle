import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: Date;
}

interface EmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  contact_phone: string;
  relationship: string | null;
  created_at: Date;
  updated_at: Date;
}

// GET /api/profile - Get current user's profile
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [userResult, contactResult] = await Promise.all([
      query<UserProfile>(
        'SELECT id, email, first_name, last_name, created_at FROM users WHERE id = $1',
        [userId]
      ),
      query<EmergencyContact>(
        'SELECT * FROM emergency_contacts WHERE user_id = $1',
        [userId]
      ),
    ]);

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    const emergencyContact = contactResult.rows[0] || null;

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      createdAt: user.created_at,
      emergencyContact: emergencyContact
        ? {
            id: emergencyContact.id,
            contactName: emergencyContact.contact_name,
            contactPhone: emergencyContact.contact_phone,
            relationship: emergencyContact.relationship,
            createdAt: emergencyContact.created_at,
            updatedAt: emergencyContact.updated_at,
          }
        : null,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/profile - Update first_name, last_name
router.put('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { firstName, lastName } = req.body;

    // Validate inputs
    if (firstName !== undefined) {
      const trimmed = String(firstName).trim();
      if (trimmed.length === 0 || trimmed.length > 100) {
        res.status(400).json({ error: 'First name must be 1-100 characters' });
        return;
      }
    }

    if (lastName !== undefined) {
      const trimmed = String(lastName).trim();
      if (trimmed.length === 0 || trimmed.length > 100) {
        res.status(400).json({ error: 'Last name must be 1-100 characters' });
        return;
      }
    }

    // Build update query
    const updates: string[] = [];
    const params: string[] = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      params.push(String(firstName).trim());
    }

    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      params.push(String(lastName).trim());
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    params.push(userId);

    const result = await query<UserProfile>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, first_name, last_name, created_at`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profile/emergency-contact - Get emergency contact
router.get('/emergency-contact', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query<EmergencyContact>(
      'SELECT * FROM emergency_contacts WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      res.json(null);
      return;
    }

    const contact = result.rows[0];

    res.json({
      id: contact.id,
      contactName: contact.contact_name,
      contactPhone: contact.contact_phone,
      relationship: contact.relationship,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    });
  } catch (error) {
    console.error('Get emergency contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/profile/emergency-contact - Create or update emergency contact
router.put('/emergency-contact', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { contactName, contactPhone, relationship } = req.body;

    // Validate required fields
    if (!contactName || !contactPhone) {
      res.status(400).json({ error: 'Contact name and phone are required' });
      return;
    }

    const trimmedName = String(contactName).trim();
    const trimmedPhone = String(contactPhone).trim();
    const trimmedRelationship = relationship ? String(relationship).trim() : null;

    if (trimmedName.length === 0 || trimmedName.length > 200) {
      res.status(400).json({ error: 'Contact name must be 1-200 characters' });
      return;
    }

    if (trimmedPhone.length === 0 || trimmedPhone.length > 20) {
      res.status(400).json({ error: 'Phone number must be 1-20 characters' });
      return;
    }

    if (trimmedRelationship && trimmedRelationship.length > 100) {
      res.status(400).json({ error: 'Relationship must be 100 characters or less' });
      return;
    }

    // Upsert emergency contact
    const result = await query<EmergencyContact>(
      `INSERT INTO emergency_contacts (user_id, contact_name, contact_phone, relationship)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         contact_name = EXCLUDED.contact_name,
         contact_phone = EXCLUDED.contact_phone,
         relationship = EXCLUDED.relationship,
         updated_at = NOW()
       RETURNING *`,
      [userId, trimmedName, trimmedPhone, trimmedRelationship]
    );

    const contact = result.rows[0];

    res.json({
      id: contact.id,
      contactName: contact.contact_name,
      contactPhone: contact.contact_phone,
      relationship: contact.relationship,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    });
  } catch (error) {
    console.error('Update emergency contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/profile/emergency-contact - Remove emergency contact
router.delete('/emergency-contact', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query(
      'DELETE FROM emergency_contacts WHERE user_id = $1 RETURNING id',
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No emergency contact found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete emergency contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
