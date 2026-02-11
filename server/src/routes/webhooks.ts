import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/superAdmin';
import { sendTestWebhook, generateSecretKey } from '../services/webhookDispatcher';

const router = Router();

// Types
interface WebhookConfig {
  id: string;
  community_id: string;
  organization_id: string | null;
  event_type: string;
  endpoint_url: string;
  secret_key: string;
  is_active: boolean;
  include_pii: boolean;
  created_at: Date;
  updated_at: Date;
  community_name?: string;
  organization_name?: string | null;
  last_delivery_status?: string | null;
  last_delivery_at?: Date | null;
}

interface WebhookDelivery {
  id: string;
  webhook_config_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  attempt_number: number;
  status: string;
  error_message: string | null;
  created_at: Date;
  delivered_at: Date | null;
}

// Middleware: Check if user is super admin OR community admin for a specific community
async function requireWebhookAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Super admins have full access
    if (req.user!.isSuperAdmin) {
      next();
      return;
    }

    // For non-super-admins, check if they're an admin of the community in question
    const communityId = req.body.community_id || req.query.community_id;
    if (!communityId) {
      res.status(400).json({ error: 'community_id is required' });
      return;
    }

    const result = await query<{ role: string }>(
      `SELECT m.role FROM memberships m
       WHERE m.user_id = $1 AND m.community_id = $2`,
      [userId, communityId]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required for this community' });
      return;
    }

    next();
  } catch (error) {
    console.error('Webhook access middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Middleware: Check access to a specific webhook config
async function requireWebhookConfigAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const webhookId = req.params.id;

    // Super admins have full access
    if (req.user!.isSuperAdmin) {
      next();
      return;
    }

    // Check if user is admin of the webhook's community
    const result = await query<{ role: string }>(
      `SELECT m.role FROM webhook_configs wc
       JOIN memberships m ON m.community_id = wc.community_id AND m.user_id = $1
       WHERE wc.id = $2`,
      [userId, webhookId]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Webhook config access middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/webhooks - Create a webhook config
router.post('/', authenticate, requireWebhookAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { community_id, organization_id, event_type, endpoint_url, include_pii } = req.body;

    // Validate required fields
    if (!community_id || !event_type || !endpoint_url) {
      res.status(400).json({ error: 'community_id, event_type, and endpoint_url are required' });
      return;
    }

    // Validate event type
    const validEventTypes = ['crisis_alert', 'high_severity_alert', 'user_report'];
    if (!validEventTypes.includes(event_type)) {
      res.status(400).json({ error: 'Invalid event_type. Must be: crisis_alert, high_severity_alert, or user_report' });
      return;
    }

    // Validate URL
    try {
      new URL(endpoint_url);
    } catch {
      res.status(400).json({ error: 'Invalid endpoint_url' });
      return;
    }

    // Verify community exists
    const communityCheck = await query(
      'SELECT id FROM communities WHERE id = $1',
      [community_id]
    );
    if (communityCheck.rows.length === 0) {
      res.status(400).json({ error: 'Community not found' });
      return;
    }

    // Verify organization exists if provided
    if (organization_id) {
      const orgCheck = await query(
        'SELECT id FROM organizations WHERE id = $1 AND community_id = $2',
        [organization_id, community_id]
      );
      if (orgCheck.rows.length === 0) {
        res.status(400).json({ error: 'Organization not found in this community' });
        return;
      }
    }

    // Generate secret key
    const secretKey = generateSecretKey();

    // Create webhook config
    const result = await query<WebhookConfig>(
      `INSERT INTO webhook_configs (community_id, organization_id, event_type, endpoint_url, secret_key, include_pii)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [community_id, organization_id || null, event_type, endpoint_url, secretKey, include_pii || false]
    );

    const webhook = result.rows[0];

    // Return with the secret key visible (only time it's shown)
    res.status(201).json({
      id: webhook.id,
      communityId: webhook.community_id,
      organizationId: webhook.organization_id,
      eventType: webhook.event_type,
      endpointUrl: webhook.endpoint_url,
      secretKey: webhook.secret_key, // Only returned on creation
      isActive: webhook.is_active,
      includePii: webhook.include_pii,
      createdAt: webhook.created_at,
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhooks - List webhook configs
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { community_id } = req.query;

    let queryText = `
      SELECT wc.*,
             c.name as community_name,
             o.name as organization_name,
             (SELECT status FROM webhook_deliveries wd
              WHERE wd.webhook_config_id = wc.id
              ORDER BY wd.created_at DESC LIMIT 1) as last_delivery_status,
             (SELECT created_at FROM webhook_deliveries wd
              WHERE wd.webhook_config_id = wc.id
              ORDER BY wd.created_at DESC LIMIT 1) as last_delivery_at
      FROM webhook_configs wc
      JOIN communities c ON c.id = wc.community_id
      LEFT JOIN organizations o ON o.id = wc.organization_id
    `;
    const params: (string | null)[] = [];
    let paramIndex = 1;

    // Super admins can see all, otherwise filter by community admin access
    if (!req.user!.isSuperAdmin) {
      queryText += `
        JOIN memberships m ON m.community_id = wc.community_id
          AND m.user_id = $${paramIndex}
          AND m.role = 'admin'
      `;
      params.push(userId);
      paramIndex++;
    }

    // Filter by community if specified
    if (community_id && typeof community_id === 'string') {
      if (params.length > 0) {
        queryText += ` WHERE wc.community_id = $${paramIndex}`;
      } else {
        queryText += ` WHERE wc.community_id = $${paramIndex}`;
      }
      params.push(community_id);
    }

    queryText += ' ORDER BY wc.created_at DESC';

    const result = await query<WebhookConfig>(queryText, params);

    const webhooks = result.rows.map((row) => ({
      id: row.id,
      communityId: row.community_id,
      communityName: row.community_name,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      eventType: row.event_type,
      endpointUrl: row.endpoint_url,
      isActive: row.is_active,
      includePii: row.include_pii,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastDeliveryStatus: row.last_delivery_status,
      lastDeliveryAt: row.last_delivery_at,
    }));

    res.json(webhooks);
  } catch (error) {
    console.error('List webhooks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/webhooks/:id - Update a webhook config
router.put('/:id', authenticate, requireWebhookConfigAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhookId = req.params.id;
    const { event_type, endpoint_url, is_active, include_pii, organization_id } = req.body;

    // Build update query dynamically
    const updates: string[] = [];
    const params: (string | boolean | null)[] = [];
    let paramIndex = 1;

    if (event_type !== undefined) {
      const validEventTypes = ['crisis_alert', 'high_severity_alert', 'user_report'];
      if (!validEventTypes.includes(event_type)) {
        res.status(400).json({ error: 'Invalid event_type' });
        return;
      }
      updates.push(`event_type = $${paramIndex++}`);
      params.push(event_type);
    }

    if (endpoint_url !== undefined) {
      try {
        new URL(endpoint_url);
      } catch {
        res.status(400).json({ error: 'Invalid endpoint_url' });
        return;
      }
      updates.push(`endpoint_url = $${paramIndex++}`);
      params.push(endpoint_url);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(Boolean(is_active));
    }

    if (include_pii !== undefined) {
      updates.push(`include_pii = $${paramIndex++}`);
      params.push(Boolean(include_pii));
    }

    if (organization_id !== undefined) {
      updates.push(`organization_id = $${paramIndex++}`);
      params.push(organization_id || null);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    params.push(webhookId);

    const result = await query<WebhookConfig>(
      `UPDATE webhook_configs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const webhook = result.rows[0];
    res.json({
      id: webhook.id,
      communityId: webhook.community_id,
      organizationId: webhook.organization_id,
      eventType: webhook.event_type,
      endpointUrl: webhook.endpoint_url,
      isActive: webhook.is_active,
      includePii: webhook.include_pii,
      createdAt: webhook.created_at,
      updatedAt: webhook.updated_at,
    });
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/webhooks/:id - Delete a webhook config
router.delete('/:id', authenticate, requireWebhookConfigAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhookId = req.params.id;

    const result = await query(
      'DELETE FROM webhook_configs WHERE id = $1 RETURNING id',
      [webhookId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webhooks/:id/test - Send a test payload
router.post('/:id/test', authenticate, requireWebhookConfigAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhookId = req.params.id;

    const result = await sendTestWebhook(webhookId);

    if (result.success) {
      res.json({
        success: true,
        statusCode: result.statusCode,
        message: 'Test webhook delivered successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        statusCode: result.statusCode,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhooks/:id/deliveries - Get delivery log for a webhook
router.get('/:id/deliveries', authenticate, requireWebhookConfigAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const webhookId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM webhook_deliveries WHERE webhook_config_id = $1',
      [webhookId]
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Get deliveries
    const result = await query<WebhookDelivery>(
      `SELECT * FROM webhook_deliveries
       WHERE webhook_config_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [webhookId, limit, offset]
    );

    const deliveries = result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      payload: row.payload,
      responseStatus: row.response_status,
      responseBody: row.response_body,
      attemptNumber: row.attempt_number,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
    }));

    res.json({
      deliveries,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhooks/communities - Get communities for dropdown (super admin only)
router.get('/communities', authenticate, requireSuperAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query<{ id: string; name: string; slug: string }>(
      'SELECT id, name, slug FROM communities ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get communities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhooks/organizations/:communityId - Get organizations for dropdown
router.get('/organizations/:communityId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communityId } = req.params;
    const userId = req.user!.userId;

    // Verify access to community
    if (!req.user!.isSuperAdmin) {
      const accessCheck = await query(
        `SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2 AND role = 'admin'`,
        [userId, communityId]
      );
      if (accessCheck.rows.length === 0) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const result = await query<{ id: string; name: string; slug: string }>(
      'SELECT id, name, slug FROM organizations WHERE community_id = $1 ORDER BY name',
      [communityId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
