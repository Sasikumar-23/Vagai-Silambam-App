import * as SQLite from 'expo-sqlite';

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
  // Ensure primary training center tc_01 exists
  await db.runAsync(`
    INSERT OR IGNORE INTO training_centers (id, code, name_en, name_ta, address_en, address_ta, city, contact_person, contact_phone)
    VALUES ('tc_01', 'VS-CHE', 'Chennai Head Dojo (Velachery)', 'சென்னை தலைமை சிலம்பக்கூடம் (வேளச்சேரி)', 'No 14, Gandhi Salai, Velachery, Chennai', 'எண் 14, காந்தி சாலை, வேளச்சேரி, சென்னை', 'Chennai', 'K. Senthilvel', '+91 98401 23456')
  `);

  // Consolidate all students and instructors into the single training center
  await db.runAsync("UPDATE students SET training_center_id = 'tc_01'");
  await db.runAsync("UPDATE instructors SET training_center_id = 'tc_01'");

  // Delete secondary branches so only one training center remains
  await db.runAsync("DELETE FROM training_centers WHERE id != 'tc_01'");
}
