import { getDatabase } from '../connection';

/**
 * Lookup rows the app cannot function without: without these the Fee Type,
 * Uniform and Event pickers are empty and nothing can be assigned. Unlike the
 * demo data in seedData.ts this runs in release builds too.
 *
 * INSERT OR IGNORE keeps anything the academy has already edited or added.
 */
export async function seedReferenceData(): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      INSERT OR IGNORE INTO roles (id, role_name, description) VALUES
        ('role_admin', 'ADMIN', 'Full Administrative Access'),
        ('role_instructor', 'INSTRUCTOR', 'Silambam Master / Trainer'),
        ('role_staff', 'STAFF', 'Office Staff & Accounts');

      INSERT OR IGNORE INTO training_centers (id, code, name_en, name_ta, city) VALUES
        ('tc_01', 'VS-01', 'Vagai Silambam Academy', 'வாகை சிலம்பம் கழகம்', 'Tamil Nadu');

      INSERT OR IGNORE INTO fee_types (id, name_en, name_ta, default_amount) VALUES
        ('ft_01', 'Monthly Training Fee', 'மாதாந்திர சிலம்பக் கட்டணம்', 1000.0),
        ('ft_02', 'Admission & Academy Registration', 'சேர்க்கை & பதிவு கட்டணம்', 1500.0),
        ('ft_03', 'Championship Entry Fee', 'போட்டி பதிவுக் கட்டணம்', 500.0),
        ('ft_04', 'Uniform & Staff Fee', 'சீருடை & கம்பு கட்டணம்', 850.0),
        ('ft_05', 'Belt Grading & Assessment Fee', 'நிலைத் தேர்வு கட்டணம்', 600.0);

      INSERT OR IGNORE INTO uniform_types (id, name_en, name_ta, description_en, description_ta, default_price) VALUES
        ('ut_01', 'Traditional Silambam Kurta & Dhoti', 'பாரம்பரிய சிலம்ப குர்தா & வேட்டி', 'Pure cotton white martial uniform', 'தூய பருத்தி வெள்ளை சிலம்ப சீருடை', 750.0),
        ('ut_02', 'Academy T-Shirt', 'கழக டி-சர்ட்', 'Breathable sports practice t-shirt', 'பயிற்சிக்கான டி-சர்ட்', 350.0),
        ('ut_03', 'Silambam Bamboo Staff', 'சிலம்பக் கம்பு', 'Treated flexible traditional bamboo stick', 'பதப்படுத்தப்பட்ட சிலம்பக் கம்பு', 250.0),
        ('ut_04', 'Grading Sash / Belt', 'நிலைத் தேர்வு கச்சை', 'Official coloured grading rank sash', 'அதிகாரப்பூர்வ தர கச்சை', 150.0);

      INSERT OR IGNORE INTO event_types (id, name_en, name_ta, description_en, description_ta) VALUES
        ('et_01', 'Competition', 'சிலம்பப் போட்டி', 'District and State level championship', 'மாவட்ட மற்றும் மாநில அளவிலான போட்டி'),
        ('et_02', 'Training Camp', 'பயிற்சி முகாம்', 'Intensive weapons and self-defense camp', 'ஆயுதப் பயிற்சி முகாம்'),
        ('et_03', 'Demonstration', 'பொது செயல்விளக்கம்', 'Public displays at festivals and sports days', 'பொது நிகழ்வுகளில் செயல்விளக்கம்'),
        ('et_04', 'Workshop', 'ஆயுதப் பயிலரங்கம்', 'Specialised weapon training', 'சிறப்பு ஆயுதப் பயிலரங்கம்'),
        ('et_05', 'Tournament', 'சாம்பியன்ஷிப்', 'State level championship tournament', 'மாநில சாம்பியன்ஷிப் தொடர்');
    `);
  });
}
