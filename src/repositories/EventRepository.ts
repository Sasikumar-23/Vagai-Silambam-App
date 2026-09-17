import { getDatabase } from '../database/connection';
import {
  EventItem, EventType, EventRegistration, EventResult,
  EventCustomField, EventCustomFieldOption, EventCustomFieldValue,
  EventResultType, ParticipationStatus, RegistrationStatus
} from '../models/types';
import { AuditRepository } from './AuditRepository';

export const EventRepository = {
  async generateRegistrationCode(): Promise<string> {
    const db = await getDatabase();
    const currentYear = new Date().getFullYear();
    const prefix = `VSE-${currentYear}-`;

    const row = await db.getFirstAsync<{ max_code: string | null }>(
      'SELECT MAX(registration_code) as max_code FROM event_registrations WHERE registration_code LIKE ?',
      `${prefix}%`
    );

    let nextNum = 1;
    if (row && row.max_code) {
      const parts = row.max_code.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }

    return `${prefix}${nextNum.toString().padStart(5, '0')}`;
  },

  async getAllEvents(statusFilter?: string): Promise<EventItem[]> {
    const db = await getDatabase();
    if (statusFilter && statusFilter !== 'ALL') {
      return db.getAllAsync<EventItem>(
        'SELECT * FROM events WHERE status = ? ORDER BY event_date ASC',
        statusFilter
      );
    }
    return db.getAllAsync<EventItem>('SELECT * FROM events ORDER BY event_date ASC');
  },

  async getEventById(id: string): Promise<EventItem | null> {
    const db = await getDatabase();
    return db.getFirstAsync<EventItem>('SELECT * FROM events WHERE id = ?', id);
  },

  async createEvent(
    data: Omit<EventItem, 'id' | 'created_at' | 'updated_at'>,
    userId: string = 'system'
  ): Promise<EventItem> {
    const db = await getDatabase();
    const eventId = 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    await db.runAsync(
      `INSERT INTO events (
        id, event_code, name_en, name_ta, event_type_id, event_date, start_time, end_time,
        location_en, location_ta, organizer_en, organizer_ta, description_en, description_ta,
        registration_required, registration_deadline, event_fee, maximum_participants, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      eventId,
      data.event_code,
      data.name_en,
      data.name_ta || data.name_en,
      data.event_type_id,
      data.event_date,
      data.start_time,
      data.end_time,
      data.location_en,
      data.location_ta || data.location_en,
      data.organizer_en,
      data.organizer_ta || data.organizer_en,
      data.description_en || null,
      data.description_ta || null,
      data.registration_required ? 1 : 0,
      data.registration_deadline || null,
      data.event_fee || 0.0,
      data.maximum_participants || 0,
      data.status || 'OPEN',
      userId
    );

    await AuditRepository.log('CREATE_EVENT', 'events', eventId, userId, null, {
      name_en: data.name_en,
      date: data.event_date
    });

    const created = await this.getEventById(eventId);
    if (!created) throw new Error('Failed to create event.');
    return created;
  },

  async getEventTypes(): Promise<EventType[]> {
    const db = await getDatabase();
    return db.getAllAsync<EventType>('SELECT * FROM event_types ORDER BY name_en ASC');
  },

  async getEventRegistrations(eventId: string): Promise<any[]> {
    const db = await getDatabase();
    return db.getAllAsync<any>(
      `SELECT 
        er.*, s.student_id as student_code, s.name_en, s.name_ta, s.training_level, s.contact_number
       FROM event_registrations er
       JOIN students s ON er.student_id = s.id
       WHERE er.event_id = ?
       ORDER BY er.registration_date DESC`,
      eventId
    );
  },

  async registerStudentForEvent(
    eventId: string,
    studentId: string,
    details?: {
      category?: string;
      ageCategory?: string;
      customFieldValues?: Record<string, string>;
    },
    userId: string = 'system'
  ): Promise<EventRegistration> {
    const db = await getDatabase();
    const event = await this.getEventById(eventId);
    if (!event) throw new Error('Event not found.');

    if (event.status === 'CLOSED' || event.status === 'CANCELLED') {
      throw new Error('This event is not accepting registrations.');
    }

    // Check duplicate
    const existing = await db.getFirstAsync<EventRegistration>(
      'SELECT * FROM event_registrations WHERE event_id = ? AND student_id = ?',
      eventId,
      studentId
    );
    if (existing) {
      throw new Error('This student is already registered for this event.');
    }

    // Check capacity
    if (event.maximum_participants > 0) {
      const countRow = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ? AND registration_status != 'CANCELLED'",
        eventId
      );
      if (countRow && countRow.count >= event.maximum_participants) {
        throw new Error('Event registration limit reached (Capacity full).');
      }
    }

    const regUuid = 'reg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const code = await this.generateRegistrationCode();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO event_registrations (
          id, registration_code, event_id, student_id, registration_date,
          category, age_category, registration_status, participation_status, created_by
        ) VALUES (?, ?, ?, ?, date('now'), ?, ?, 'CONFIRMED', 'NOT_MARKED', ?)`,
        regUuid,
        code,
        eventId,
        studentId,
        details?.category || null,
        details?.ageCategory || null,
        userId
      );

      // Save custom field values
      if (details?.customFieldValues) {
        for (const [fieldId, val] of Object.entries(details.customFieldValues)) {
          const valId = 'cfv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          await db.runAsync(
            `INSERT INTO event_custom_field_values (id, registration_id, field_id, value_text)
             VALUES (?, ?, ?, ?)`,
            valId,
            regUuid,
            fieldId,
            val
          );
        }
      }

      await AuditRepository.log('REGISTER_EVENT', 'event_registrations', regUuid, userId, null, {
        event_id: eventId,
        student_id: studentId,
        registration_code: code
      });
    });

    const reg = await db.getFirstAsync<EventRegistration>(
      'SELECT * FROM event_registrations WHERE id = ?',
      regUuid
    );
    if (!reg) throw new Error('Registration failed.');
    return reg;
  },

  async bulkRegisterStudents(
    eventId: string,
    studentIds: string[],
    category?: string,
    userId: string = 'system'
  ): Promise<{ registered: number; failed: number }> {
    let registered = 0;
    let failed = 0;

    for (const stuId of studentIds) {
      try {
        await this.registerStudentForEvent(eventId, stuId, { category }, userId);
        registered++;
      } catch (e) {
        failed++;
      }
    }
    return { registered, failed };
  },

  async recordEventResult(
    eventId: string,
    studentId: string,
    resultData: {
      category?: string;
      result: EventResultType;
      position?: string;
      medal?: string;
      remarks?: string;
    },
    userId: string = 'system'
  ): Promise<EventResult> {
    const db = await getDatabase();
    const resultUuid = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const event = await this.getEventById(eventId);

    await db.withTransactionAsync(async () => {
      // 1. Insert or update result
      await db.runAsync(
        `INSERT INTO event_results (
          id, event_id, student_id, category, participation, result, position, medal, remarks
        ) VALUES (?, ?, ?, ?, 'PARTICIPATED', ?, ?, ?, ?)`,
        resultUuid,
        eventId,
        studentId,
        resultData.category || null,
        resultData.result,
        resultData.position || null,
        resultData.medal || null,
        resultData.remarks || null
      );

      // 2. Update participation status on registration
      await db.runAsync(
        "UPDATE event_registrations SET participation_status = 'PARTICIPATED' WHERE event_id = ? AND student_id = ?",
        eventId,
        studentId
      );

      // 3. Automatically create an achievement record when result is notable (Winner, Runner-up, Third Place, Special Award)
      if (resultData.result !== 'Other') {
        const achUuid = 'ach_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const titleEn = `${resultData.result} - ${event?.name_en || 'Silambam Event'}`;
        const titleTa = `${resultData.result === 'Winner' ? 'முதலிடம்' : resultData.result === 'Runner-up' ? 'இரண்டாமிடம்' : 'சாதனை'} - ${event?.name_ta || 'சிலம்ப நிகழ்வு'}`;

        await db.runAsync(
          `INSERT INTO achievements (
            id, student_id, event_id, achievement_type, title_en, title_ta, position, achievement_date, description_en
          ) VALUES (?, ?, ?, 'Competition', ?, ?, ?, date('now'), ?)`,
          achUuid,
          studentId,
          eventId,
          titleEn,
          titleTa,
          resultData.position || resultData.result,
          resultData.remarks || null
        );
      }

      await AuditRepository.log('RECORD_EVENT_RESULT', 'event_results', resultUuid, userId, null, {
        event_id: eventId,
        student_id: studentId,
        result: resultData.result
      });
    });

    const res = await db.getFirstAsync<EventResult>('SELECT * FROM event_results WHERE id = ?', resultUuid);
    if (!res) throw new Error('Failed to record event result.');
    return res;
  },

  async getCustomFields(eventId: string): Promise<EventCustomField[]> {
    const db = await getDatabase();
    return db.getAllAsync<EventCustomField>(
      'SELECT * FROM event_custom_fields WHERE event_id = ? ORDER BY sort_order ASC',
      eventId
    );
  },

  async addCustomField(
    eventId: string,
    field: Omit<EventCustomField, 'id' | 'event_id' | 'created_at'>,
    options?: string[]
  ): Promise<EventCustomField> {
    const db = await getDatabase();
    const fieldId = 'cf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO event_custom_fields (id, event_id, field_name_en, field_name_ta, field_type, is_required, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        fieldId,
        eventId,
        field.field_name_en,
        field.field_name_ta || field.field_name_en,
        field.field_type,
        field.is_required ? 1 : 0,
        field.sort_order || 0
      );

      if (options && options.length > 0) {
        for (let i = 0; i < options.length; i++) {
          const optId = 'cfo_' + Date.now() + '_' + i;
          await db.runAsync(
            `INSERT INTO event_custom_field_options (id, field_id, option_label_en, option_label_ta, option_value, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            optId,
            fieldId,
            options[i],
            options[i],
            options[i],
            i + 1
          );
        }
      }
    });

    const created = await db.getFirstAsync<EventCustomField>('SELECT * FROM event_custom_fields WHERE id = ?', fieldId);
    if (!created) throw new Error('Failed to create custom field.');
    return created;
  }
};
