import { getDatabase } from '../database/connection';
import { User, UserRole } from '../models/types';
import { AuditRepository } from './AuditRepository';
import { hashPassword, isHashed, verifyPassword } from '../utils/password';

export const UserRepository = {
  async findByUsername(username: string): Promise<User | null> {
    const db = await getDatabase();
    return db.getFirstAsync<User>(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      username.trim().toLowerCase()
    );
  },

  async findById(id: string): Promise<User | null> {
    const db = await getDatabase();
    return db.getFirstAsync<User>('SELECT * FROM users WHERE id = ?', id);
  },

  async getAllUsers(): Promise<User[]> {
    const db = await getDatabase();
    return db.getAllAsync<User>('SELECT * FROM users ORDER BY role ASC, full_name_en ASC');
  },

  async countUsers(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) as total FROM users');
    return row?.total ?? 0;
  },

  async verifyCredentials(username: string, passwordAttempt: string): Promise<User | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;

    if (!(await verifyPassword(passwordAttempt, user.password_hash))) return null;

    // Accounts created before hashing still hold a plain-text password; upgrade on first successful login.
    if (!isHashed(user.password_hash)) {
      const db = await getDatabase();
      const upgraded = await hashPassword(passwordAttempt);
      await db.runAsync(
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        upgraded,
        new Date().toISOString(),
        user.id
      );
      user.password_hash = upgraded;
    }

    await AuditRepository.log('LOGIN', 'users', user.id, user.id, null, { username });
    return user;
  },

  async createUser(data: {
    username: string;
    password: string;
    fullNameEn: string;
    fullNameTa?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
  }): Promise<User> {
    const db = await getDatabase();
    const cleanUsername = data.username.trim().toLowerCase();
    const existing = await this.findByUsername(cleanUsername);
    if (existing) {
      throw new Error(`Username "${cleanUsername}" is already taken.`);
    }

    const newUserId = `usr_${Date.now()}`;
    const now = new Date().toISOString();
    // Self-registration must not grant privileges: only the very first account on a
    // fresh install bootstraps as ADMIN, everyone after that signs up as an instructor.
    const role: UserRole = (await this.countUsers()) === 0 ? 'ADMIN' : 'INSTRUCTOR';

    await db.runAsync(
      `INSERT INTO users (id, username, password_hash, full_name_en, full_name_ta, email, phone, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      newUserId,
      cleanUsername,
      await hashPassword(data.password),
      data.fullNameEn.trim(),
      data.fullNameTa?.trim() || data.fullNameEn.trim(),
      data.email?.trim() || null,
      data.phone?.trim() || null,
      role,
      now,
      now
    );

    const created = await this.findById(newUserId);
    if (!created) throw new Error('Failed to create user account.');
    await AuditRepository.log('CREATE_USER', 'users', created.id, created.id, null, { username: cleanUsername, role });
    return created;
  },

  async findByEmail(email: string): Promise<User | null> {
    const db = await getDatabase();
    return db.getFirstAsync<User>(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      email.trim().toLowerCase()
    );
  },

  async findOrCreateGoogleUser(profile: { id: string; email: string; name: string }): Promise<User> {
    const db = await getDatabase();
    const existing = await this.findByEmail(profile.email);
    if (existing) {
      // Signing in never changes the account's role — that would let anyone pick ADMIN.
      await AuditRepository.log('LOGIN_GOOGLE', 'users', existing.id, existing.id, null, { email: profile.email, role: existing.role });
      return existing;
    }

    const usernamePrefix = profile.email.split('@')[0].toLowerCase();
    const existingByUsername = await this.findByUsername(usernamePrefix);
    if (existingByUsername) {
      await db.runAsync(
        'UPDATE users SET email = ?, updated_at = ? WHERE id = ?',
        profile.email,
        new Date().toISOString(),
        existingByUsername.id
      );
      return { ...existingByUsername, email: profile.email };
    }

    const newUserId = `usr_google_${Date.now()}`;
    const now = new Date().toISOString();
    const role: UserRole = (await this.countUsers()) === 0 ? 'ADMIN' : 'INSTRUCTOR';

    try {
      await db.runAsync(
        `INSERT INTO users (id, username, password_hash, full_name_en, full_name_ta, email, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        newUserId,
        usernamePrefix,
        'google_oauth_auth',
        profile.name || usernamePrefix,
        profile.name || usernamePrefix,
        profile.email,
        role,
        now,
        now
      );

      const created = await this.findById(newUserId);
      if (created) {
        await AuditRepository.log('REGISTER_GOOGLE', 'users', created.id, created.id, null, { email: profile.email, role });
        return created;
      }
    } catch (e) {
      console.warn('Failed to insert new Google user:', e);
    }

    return {
      id: newUserId,
      username: usernamePrefix,
      password_hash: '',
      full_name_en: profile.name || usernamePrefix,
      full_name_ta: profile.name || usernamePrefix,
      email: profile.email,
      role,
      is_active: 1,
      created_at: now,
      updated_at: now,
    };
  },

  async deleteUserByEmail(email: string): Promise<number> {
    try {
      const db = await getDatabase();
      const cleanEmail = email.trim().toLowerCase();
      const res = await db.runAsync(
        'DELETE FROM users WHERE LOWER(email) = ? OR username = ?',
        cleanEmail,
        cleanEmail.split('@')[0]
      );
      return res.changes;
    } catch (e) {
      console.warn('Failed to delete user by email:', e);
      return 0;
    }
  }
};

