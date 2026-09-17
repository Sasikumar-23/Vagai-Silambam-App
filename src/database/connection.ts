import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'vagai_silambam.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
  }
  return dbInstance;
}

export function resetDatabaseConnection(): void {
  dbInstance = null;
  isInitialized = false;
}
