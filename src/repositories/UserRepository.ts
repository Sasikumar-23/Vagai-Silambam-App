import { getDatabase } from '../database/connection';
import { User, UserRole } from '../models/types';
import { AuditRepository } from './AuditRepository';

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

  async verifyCredentials(username: string, passwordAttempt: string): Promise<User | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;

    // In local demo / MVP, credentials match stored hash/password
    if (user.password_hash === passwordAttempt) {
      await AuditRepository.log('LOGIN', 'users', user.id, user.id, null, { username });
      return user;
    }
    return null;
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
    const role: UserRole = data.role || 'INSTRUCTOR';

    await db.runAsync(
      `INSERT INTO users (id, username, password_hash, full_name_en, full_name_ta, email, phone, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      newUserId,
      cleanUsername,
      data.password,
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

  async updateUserRole(userId: string, role: UserRole): Promise<User | null> {
    const db = await getDatabase();
    await db.runAsync('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', role, new Date().toISOString(), userId);
    return this.findById(userId);
  },

  async switchRoleForDemo(role: UserRole): Promise<User | null> {
    const db = await getDatabase();
    const user = await db.getFirstAsync<User>(
      'SELECT * FROM users WHERE role = ? AND is_active = 1 LIMIT 1',
      role
    );
    return user || null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const db = await getDatabase();
    return db.getFirstAsync<User>(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      email.trim().toLowerCase()
    );
  },

  async findOrCreateGoogleUser(
    profile: { id: string; email: string; name: string },
    selectedRole: UserRole = 'INSTRUCTOR'
  ): Promise<User> {
    const db = await getDatabase();
    const existing = await this.findByEmail(profile.email);
    if (existing) {
      if (existing.role !== selectedRole) {
        await db.runAsync('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', selectedRole, new Date().toISOString(), existing.id);
        existing.role = selectedRole;
      }
      await AuditRepository.log('LOGIN_GOOGLE', 'users', existing.id, existing.id, null, { email: profile.email, role: selectedRole });
      return existing;
    }

    const usernamePrefix = profile.email.split('@')[0].toLowerCase();
    const existingByUsername = await this.findByUsername(usernamePrefix);
    if (existingByUsername) {
      await db.runAsync(
        'UPDATE users SET email = ?, role = ?, updated_at = ? WHERE id = ?',
        profile.email,
        selectedRole,
        new Date().toISOString(),
        existingByUsername.id
      );
      return { ...existingByUsername, email: profile.email, role: selectedRole };
    }

    const newUserId = `usr_google_${Date.now()}`;
    const now = new Date().toISOString();
    const role: UserRole = selectedRole;

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

