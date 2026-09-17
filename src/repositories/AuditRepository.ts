import { getDatabase } from '../database/connection';
import { AuditLog } from '../models/types';

export const AuditRepository = {
  async log(
    action: string,
    entityType: string,
    entityId: string,
    userId: string = 'system',
    oldValues?: any,
    newValues?: any
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const id = 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await db.runAsync(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_values, new_values)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null
      );
    } catch (e) {
      console.warn('Audit logging failed:', e);
    }
  },

  async getRecentLogs(limit: number = 50): Promise<AuditLog[]> {
    const db = await getDatabase();
    return db.getAllAsync<AuditLog>(
      'SELECT * FROM audit_logs ORDER BY datetime(created_at) DESC LIMIT ?',
      limit
    );
  }
};
