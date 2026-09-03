import bcrypt from 'bcryptjs';
import { UsersRepository, UserDetail } from './users.repository.js';
import { NotFoundError, ConflictError } from '../../shared/errors/app-error.js';

export class UsersService {
  private repo = new UsersRepository();

  async getUsers(params: { search?: string; status?: string; role?: string; page?: number; limit?: number }) {
    return this.repo.findAll(params);
  }

  async getUserById(userId: number): Promise<UserDetail> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async createUser(data: {
    roleId?: number;
    firstName: string;
    lastName?: string;
    email: string;
    password: string;
    phone?: string;
    heightCm?: number;
    gender?: string;
    timezone?: string;
    locale?: string;
  }): Promise<UserDetail> {
    const existing = await this.repo.findAll({ search: data.email });
    const duplicate = existing.users.find(u => u.email.toLowerCase() === data.email.toLowerCase());
    if (duplicate) {
      throw new ConflictError('Email already in use', 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userId = await this.repo.createUser({
      role_id: data.roleId || 3, // Default to normal user
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      password_hash: passwordHash,
      phone: data.phone,
      height_cm: data.heightCm,
      gender: data.gender,
      timezone: data.timezone,
      locale: data.locale,
    });

    return this.getUserById(userId);
  }

  async updateUser(userId: number, fields: {
    firstName?: string;
    lastName?: string | null;
    phone?: string | null;
    dateOfBirth?: string | null;
    heightCm?: number | null;
    gender?: string | null;
    unitSystem?: string;
    timezone?: string;
    locale?: string;
    status?: string;
  }): Promise<UserDetail> {
    await this.getUserById(userId);
    await this.repo.updateUser(userId, {
      first_name: fields.firstName,
      last_name: fields.lastName,
      phone: fields.phone,
      date_of_birth: fields.dateOfBirth,
      height_cm: fields.heightCm,
      gender: fields.gender,
      unit_system: fields.unitSystem,
      timezone: fields.timezone,
      locale: fields.locale,
      status: fields.status,
    });
    return this.getUserById(userId);
  }

  async setAccountStatus(userId: number, status: 'active' | 'disabled'): Promise<UserDetail> {
    return this.updateUser(userId, { status });
  }

  async getUserSettings(userId: number) {
    return this.repo.getUserSettings(userId);
  }

  async updateUserSettings(userId: number, settings: any) {
    await this.repo.updateUserSettings(userId, settings);
    return this.repo.getUserSettings(userId);
  }

  async getNotificationSettings(userId: number) {
    return this.repo.getNotificationSettings(userId);
  }

  async updateNotificationSettings(userId: number, settings: any) {
    return this.repo.updateNotificationSettings(userId, settings);
  }

  async getFitnessConfiguration(userId: number) {
    const config = await this.repo.getFitnessConfiguration(userId);
    if (!config) throw new NotFoundError('User not found');
    return config;
  }

  async getUserMonitoring(userId: number) {
    const dossier = await this.repo.getUserMonitoringDossier(userId);
    if (!dossier) throw new NotFoundError('User not found');
    return dossier;
  }
}
