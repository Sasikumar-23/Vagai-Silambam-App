import * as SQLite from 'expo-sqlite';

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
  // Ensure attendance_sessions also point to tc_01
  await db.runAsync("UPDATE attendance_sessions SET training_center_id = 'tc_01'");

  // Move any students/instructors still on other centers
  await db.runAsync("UPDATE students SET training_center_id = 'tc_01'");
  await db.runAsync("UPDATE instructors SET training_center_id = 'tc_01'");

  // Hard-delete all centers except tc_01
  await db.runAsync("DELETE FROM training_centers WHERE id != 'tc_01'");

  console.log('[Migration 004] Enforced single training center: tc_01');
}
