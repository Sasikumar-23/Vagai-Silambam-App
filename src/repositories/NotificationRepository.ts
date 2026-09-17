import { getDatabase } from '../database/connection';
import { Notification } from '../models/types';

export interface NotificationWithReadStatus extends Notification {
  recipient_id: string;
  is_read: number;
}

export const NotificationRepository = {
  async getUserNotifications(userId: string): Promise<NotificationWithReadStatus[]> {
    const db = await getDatabase();
    return db.getAllAsync<NotificationWithReadStatus>(`
      SELECT 
        n.*, nr.id as recipient_id, nr.is_read
      FROM notifications n
      JOIN notification_recipients nr ON n.id = nr.notification_id
      WHERE nr.user_id = ?
      ORDER BY datetime(n.created_at) DESC
    `, userId);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM notification_recipients
      WHERE user_id = ? AND is_read = 0
    `, userId);
    return row?.count || 0;
  },

  async markAsRead(recipientId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE notification_recipients SET is_read = 1, read_at = datetime('now') WHERE id = ?",
      recipientId
    );
  },

  async markAllAsRead(userId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE notification_recipients SET is_read = 1, read_at = datetime('now') WHERE user_id = ? AND is_read = 0",
      userId
    );
  },

  async createNotification(
    type: string,
    titleEn: string,
    titleTa: string,
    messageEn: string,
    messageTa: string,
    targetUserIds: string[],
    referenceType?: string,
    referenceId?: string
  ): Promise<void> {
    const db = await getDatabase();
    const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO notifications (id, notification_type, title_en, title_ta, message_en, message_ta, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        notifId, type, titleEn, titleTa, messageEn, messageTa, referenceType || null, referenceId || null
      );

      for (const uid of targetUserIds) {
        const nrId = 'nr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        await db.runAsync(
          'INSERT INTO notification_recipients (id, notification_id, user_id, is_read) VALUES (?, ?, ?, 0)',
          nrId, notifId, uid
        );
      }
    });
  }
};
