import { getDatabase } from '../database/connection';
import { Certificate } from '../models/types';
import { AuditRepository } from './AuditRepository';

export interface CertificateWithDetails extends Certificate {
  student_name_en: string;
  student_name_ta: string;
  student_code: string;
  event_name_en?: string;
  event_name_ta?: string;
}

export const CertificateRepository = {
  async generateCertificateNumber(): Promise<string> {
    const db = await getDatabase();
    const currentYear = new Date().getFullYear();
    const prefix = `CERT-VS-${currentYear}-`;

    const row = await db.getFirstAsync<{ max_code: string | null }>(
      'SELECT MAX(certificate_number) as max_code FROM certificates WHERE certificate_number LIKE ?',
      `${prefix}%`
    );

    let nextNum = 1;
    if (row && row.max_code) {
      const parts = row.max_code.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }

    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  },

  async getAllCertificates(): Promise<CertificateWithDetails[]> {
    const db = await getDatabase();
    return db.getAllAsync<CertificateWithDetails>(`
      SELECT 
        c.*,
        s.name_en AS student_name_en,
        s.name_ta AS student_name_ta,
        s.student_id AS student_code,
        e.name_en AS event_name_en,
        e.name_ta AS event_name_ta
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      LEFT JOIN events e ON c.event_id = e.id
      ORDER BY c.issue_date DESC
    `);
  },

  async getStudentCertificates(studentId: string): Promise<Certificate[]> {
    const db = await getDatabase();
    return db.getAllAsync<Certificate>(
      'SELECT * FROM certificates WHERE student_id = ? ORDER BY issue_date DESC',
      studentId
    );
  },

  async issueCertificate(
    data: Omit<Certificate, 'id' | 'certificate_number' | 'created_at' | 'updated_at'>,
    userId: string = 'system'
  ): Promise<Certificate> {
    const db = await getDatabase();
    const id = 'cert_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const certNumber = await this.generateCertificateNumber();

    await db.runAsync(
      `INSERT INTO certificates (
        id, certificate_number, student_id, event_id, achievement_id,
        certificate_title_en, certificate_title_ta, issue_date, file_url, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      certNumber,
      data.student_id,
      data.event_id || null,
      data.achievement_id || null,
      data.certificate_title_en,
      data.certificate_title_ta || data.certificate_title_en,
      data.issue_date || new Date().toISOString().split('T')[0],
      data.file_url || null,
      data.remarks || null
    );

    await AuditRepository.log('ISSUE_CERTIFICATE', 'certificates', id, userId, null, {
      certificate_number: certNumber,
      student_id: data.student_id
    });

    const cert = await db.getFirstAsync<Certificate>('SELECT * FROM certificates WHERE id = ?', id);
    if (!cert) throw new Error('Failed to issue certificate.');
    return cert;
  }
};
