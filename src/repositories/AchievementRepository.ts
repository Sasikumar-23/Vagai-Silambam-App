import { getDatabase } from '../database/connection';
import { Achievement } from '../models/types';
import { AuditRepository } from './AuditRepository';

export interface AchievementWithDetails extends Achievement {
  student_name_en: string;
  student_name_ta: string;
  student_code: string;
  event_name_en?: string;
  event_name_ta?: string;
}

export const AchievementRepository = {
  async getAllAchievements(): Promise<AchievementWithDetails[]> {
    const db = await getDatabase();
    return db.getAllAsync<AchievementWithDetails>(`
      SELECT 
        a.*,
        s.name_en AS student_name_en,
        s.name_ta AS student_name_ta,
        s.student_id AS student_code,
        e.name_en AS event_name_en,
        e.name_ta AS event_name_ta
      FROM achievements a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN events e ON a.event_id = e.id
      ORDER BY a.achievement_date DESC
    `);
  },

  async getStudentAchievements(studentId: string): Promise<Achievement[]> {
    const db = await getDatabase();
    return db.getAllAsync<Achievement>(
      'SELECT * FROM achievements WHERE student_id = ? ORDER BY achievement_date DESC',
      studentId
    );
  },

  async addAchievement(
    data: Omit<Achievement, 'id' | 'created_at' | 'updated_at'>,
    userId: string = 'system'
  ): Promise<Achievement> {
    const db = await getDatabase();
    const id = 'ach_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    await db.runAsync(
      `INSERT INTO achievements (
        id, student_id, event_id, achievement_type, title_en, title_ta, position,
        achievement_date, description_en, description_ta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.student_id,
      data.event_id || null,
      data.achievement_type || 'Competition',
      data.title_en,
      data.title_ta || data.title_en,
      data.position || null,
      data.achievement_date || new Date().toISOString().split('T')[0],
      data.description_en || null,
      data.description_ta || null
    );

    await AuditRepository.log('CREATE_ACHIEVEMENT', 'achievements', id, userId, null, {
      student_id: data.student_id,
      title_en: data.title_en
    });

    const ach = await db.getFirstAsync<Achievement>('SELECT * FROM achievements WHERE id = ?', id);
    if (!ach) throw new Error('Failed to create achievement record.');
    return ach;
  }
};
