// Readable names for the role codes the server sends, in English and Tamil.
const ROLE_LABELS: Record<string, { en: string; ta: string }> = {
  ADMIN: { en: 'Admin', ta: 'நிர்வாகி' },
  INSTRUCTOR: { en: 'Instructor', ta: 'ஆசான்' },
  STAFF: { en: 'Staff', ta: 'பணியாளர்' },
  STAFF_ACCOUNTANT: { en: 'Accountant', ta: 'கணக்காளர்' },
  STUDENT: { en: 'Student', ta: 'மாணவர்' },
  PARENT: { en: 'Parent', ta: 'பெற்றோர்' },
};

export function roleLabel(role: string | null | undefined, language: string = 'en'): string {
  if (!role) return '';
  const label = ROLE_LABELS[role];
  if (!label) return role;
  return language === 'ta' ? label.ta : label.en;
}
