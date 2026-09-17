import { getDatabase } from '../database/connection';
import { TrainingCenter, Instructor } from '../models/types';

export const TrainingCenterRepository = {
  async getAllCenters(): Promise<TrainingCenter[]> {
    const db = await getDatabase();
    return db.getAllAsync<TrainingCenter>(
      'SELECT * FROM training_centers WHERE is_active = 1 ORDER BY name_en ASC'
    );
  },

  async getCenterById(id: string): Promise<TrainingCenter | null> {
    const db = await getDatabase();
    return db.getFirstAsync<TrainingCenter>('SELECT * FROM training_centers WHERE id = ?', id);
  },

  async getAllInstructors(centerId?: string): Promise<Instructor[]> {
    const db = await getDatabase();
    if (centerId) {
      return db.getAllAsync<Instructor>(
        'SELECT * FROM instructors WHERE training_center_id = ? AND is_active = 1 ORDER BY name_en ASC',
        centerId
      );
    }
    return db.getAllAsync<Instructor>('SELECT * FROM instructors WHERE is_active = 1 ORDER BY name_en ASC');
  },

  async getInstructorById(id: string): Promise<Instructor | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Instructor>('SELECT * FROM instructors WHERE id = ?', id);
  }
};
