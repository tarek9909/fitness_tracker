import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabasePool } from '../../database/pool.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { recordAuditEvent } from '../../shared/utils/audit-utils.js';

const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
      description: z.string().optional(),
    })
  ),
});

export class SettingsController {
  private db = getDatabasePool();

  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await this.db.query('SELECT * FROM system_settings ORDER BY setting_key ASC');

    return reply.status(200).send({
      success: true,
      data: {
        systemSettings: settings,
      },
    });
  }

  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const body = updateSettingsSchema.parse(request.body);

    for (const item of body.settings) {
      const existing = await this.db.queryOne('SELECT id FROM system_settings WHERE setting_key = ?', [item.key]);
      if (existing) {
        await this.db.execute(
          'UPDATE system_settings SET setting_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
          [item.value, auth.userId, item.key]
        );
      } else {
        await this.db.execute(
          `INSERT INTO system_settings (setting_key, setting_value, description, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [item.key, item.value, item.description || null, auth.userId]
        );
      }
    }

    await recordAuditEvent(request, 'settings.updated', 'system_setting', null, {
      updatedCount: body.settings.length,
      keys: body.settings.map((s) => s.key),
    });

    const updatedSettings = await this.db.query('SELECT * FROM system_settings ORDER BY setting_key ASC');

    return reply.status(200).send({
      success: true,
      data: {
        message: 'Settings updated successfully',
        systemSettings: updatedSettings,
      },
    });
  }
}

export async function settingsRoutes(fastify: FastifyInstance) {
  const controller = new SettingsController();

  fastify.get('/admin/settings', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getSettings(req, res));
  fastify.put('/admin/settings', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateSettings(req, res));
}
