import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../connection';
import * as migration001 from './001_initial_schema';
import * as migration002 from './002_indexes_and_views';
import * as migration003 from './003_single_training_center';
import * as migration004 from './004_enforce_single_center';

interface Migration {
  id: string;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    id: '001',
    name: '001_initial_schema',
    up: migration001.up,
  },
  {
    id: '002',
    name: '002_indexes_and_views',
    up: migration002.up,
  },
  {
    id: '003',
    name: '003_single_training_center',
    up: migration003.up,
  },
  {
    id: '004',
    name: '004_enforce_single_center',
    up: migration004.up,
  },
];

export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const executedRows = await db.getAllAsync<{ id: string }>('SELECT id FROM schema_migrations');
  const executedSet = new Set(executedRows.map(r => r.id));

  for (const migration of MIGRATIONS) {
    if (!executedSet.has(migration.id)) {
      console.log(`Running migration: ${migration.name}`);
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (id, name) VALUES (?, ?)',
        migration.id,
        migration.name
      );
      console.log(`Migration ${migration.name} completed successfully.`);
    }
  }
}
