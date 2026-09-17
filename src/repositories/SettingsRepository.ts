import { getDatabase } from '../database/connection';
import { SettingItem } from '../models/types';

export const SettingsRepository = {
  async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<SettingItem>('SELECT * FROM settings WHERE key = ?', key);
    return row?.value ?? defaultValue;
  },

  async setSetting(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value
    );
  },

  async getAllSettings(): Promise<Record<string, string>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<SettingItem>('SELECT * FROM settings');
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  }
};
