import { getDatabasePool } from '../../database/pool.js';
import { getUserLocalDate } from '../../shared/utils/date-utils.js';

export interface UserDetail {
  id: number;
  role_id: number;
  role_name: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  gender: string | null;
  timezone: string;
  locale: string;
  unit_system?: string;
  email_verified_at?: string | null;
  security_version?: number;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

export class UsersRepository {
  private db = getDatabasePool();

  async findAll(params: { search?: string; status?: string; role?: string; page?: number; limit?: number }): Promise<{ users: UserDetail[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let whereClauses: string[] = ['1=1'];
    let values: any[] = [];

    if (params.search) {
      whereClauses.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term);
    }

    if (params.status) {
      whereClauses.push('u.status = ?');
      values.push(params.status);
    }

    if (params.role) {
      whereClauses.push('r.name = ?');
      values.push(params.role);
    }

    const whereStr = whereClauses.join(' AND ');

    const countSql = `SELECT COUNT(*) as count FROM users u JOIN roles r ON r.id = u.role_id WHERE ${whereStr}`;
    const countRes = await this.db.queryOne<{ count: number }>(countSql, values);
    const total = countRes?.count || 0;

    const sql = `
      SELECT u.id, u.role_id, r.name as role_name, u.first_name, u.last_name, u.email,
             u.phone, u.date_of_birth, u.height_cm, u.gender, u.timezone, u.locale,
             u.unit_system, u.email_verified_at, u.security_version,
             u.status, u.last_login_at, u.created_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE ${whereStr}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
    `;
    const users = await this.db.query<UserDetail>(sql, [...values, limit, offset]);

    return { users, total };
  }

  async findById(userId: number): Promise<UserDetail | null> {
    const sql = `
      SELECT u.id, u.role_id, r.name as role_name, u.first_name, u.last_name, u.email,
             u.phone, u.date_of_birth, u.height_cm, u.gender, u.timezone, u.locale,
             u.unit_system, u.email_verified_at, u.security_version,
             u.status, u.last_login_at, u.created_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
    `;
    return this.db.queryOne<UserDetail>(sql, [userId]);
  }

  async createUser(data: {
    role_id: number;
    first_name: string;
    last_name?: string | null;
    email: string;
    password_hash: string;
    phone?: string | null;
    height_cm?: number | null;
    gender?: string | null;
    timezone?: string;
    locale?: string;
  }): Promise<number> {
    const sql = `
      INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, height_cm, gender, timezone, locale, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;
    const res = await this.db.execute(sql, [
      data.role_id,
      data.first_name,
      data.last_name || null,
      data.email.toLowerCase().trim(),
      data.password_hash,
      data.phone || null,
      data.height_cm || null,
      data.gender || null,
      data.timezone || 'UTC',
      data.locale || 'en',
    ]);
    return res.insertId;
  }

  async updateUser(userId: number, fields: Partial<UserDetail>): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (fields.first_name !== undefined) {
      setClauses.push('first_name = ?');
      values.push(fields.first_name);
    }
    if (fields.last_name !== undefined) {
      setClauses.push('last_name = ?');
      values.push(fields.last_name);
    }
    if (fields.phone !== undefined) {
      setClauses.push('phone = ?');
      values.push(fields.phone);
    }
    if (fields.height_cm !== undefined) {
      setClauses.push('height_cm = ?');
      values.push(fields.height_cm);
    }
    if (fields.timezone !== undefined) {
      setClauses.push('timezone = ?');
      values.push(fields.timezone);
    }
    if (fields.locale !== undefined) {
      setClauses.push('locale = ?');
      values.push(fields.locale);
    }
    if (fields.gender !== undefined) {
      setClauses.push('gender = ?');
      values.push(fields.gender);
    }
    if (fields.date_of_birth !== undefined) {
      setClauses.push('date_of_birth = ?');
      values.push(fields.date_of_birth);
    }
    if (fields.unit_system !== undefined) {
      setClauses.push('unit_system = ?');
      values.push(fields.unit_system);
    }
    if (fields.status !== undefined) {
      setClauses.push('status = ?');
      values.push(fields.status);
    }

    if (setClauses.length === 0) return;

    const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;
    await this.db.execute(sql, [...values, userId]);
  }

  async getUserSettings(userId: number): Promise<any> {
    const sql = `
      SELECT *,
             push_enabled as allow_push,
             in_app_enabled as allow_in_app,
             local_notifications_enabled as allow_reminders,
             1 as allow_missed_task_alerts
      FROM user_notification_settings 
      WHERE user_id = ?
    `;
    return this.db.queryOne(sql, [userId]);
  }

  async updateUserSettings(userId: number, settings: any): Promise<void> {
    const existing = await this.getUserSettings(userId);
    if (!existing) {
      const sql = `
        INSERT INTO user_notification_settings (user_id, push_enabled, in_app_enabled, local_notifications_enabled)
        VALUES (?, ?, ?, ?)
      `;
      await this.db.execute(sql, [
        userId,
        settings.allowPush ? 1 : 0,
        settings.allowInApp ? 1 : 0,
        settings.allowReminders ? 1 : 0,
      ]);
    } else {
      const sql = `
        UPDATE user_notification_settings
        SET push_enabled = ?, in_app_enabled = ?, local_notifications_enabled = ?
        WHERE user_id = ?
      `;
      await this.db.execute(sql, [
        settings.allowPush ? 1 : 0,
        settings.allowInApp ? 1 : 0,
        settings.allowReminders ? 1 : 0,
        userId,
      ]);
    }
  }

  async getNotificationSettings(userId: number): Promise<any> {
    let settings = await this.db.queryOne<any>(
      `SELECT in_app_enabled, push_enabled, local_notifications_enabled,
              quiet_hours_enabled, quiet_hours_start, quiet_hours_end
       FROM user_notification_settings WHERE user_id = ?`,
      [userId]
    );

    if (!settings) {
      settings = {
        in_app_enabled: 1,
        push_enabled: 1,
        local_notifications_enabled: 1,
        quiet_hours_enabled: 0,
        quiet_hours_start: null,
        quiet_hours_end: null,
      };
    }

    const categoryRows = await this.db.query<{ category: string; is_enabled: number }>(
      'SELECT category, is_enabled FROM user_notification_preferences WHERE user_id = ?',
      [userId]
    );

    const categories: Record<string, boolean> = {};
    for (const row of categoryRows) {
      categories[row.category] = row.is_enabled === 1;
    }

    return {
      userId,
      inAppEnabled: settings.in_app_enabled === 1,
      pushEnabled: settings.push_enabled === 1,
      localNotificationsEnabled: settings.local_notifications_enabled === 1,
      quietHoursEnabled: settings.quiet_hours_enabled === 1,
      quietHoursStart: settings.quiet_hours_start || null,
      quietHoursEnd: settings.quiet_hours_end || null,
      categories,
    };
  }

  async updateNotificationSettings(userId: number, input: {
    inAppEnabled?: boolean;
    pushEnabled?: boolean;
    localNotificationsEnabled?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    categories?: Record<string, boolean>;
  }): Promise<any> {
    await this.db.withTransaction(async (conn) => {
      const existing = await conn.queryOne<any>(
        'SELECT * FROM user_notification_settings WHERE user_id = ?',
        [userId]
      );

      const inApp = input.inAppEnabled !== undefined ? (input.inAppEnabled ? 1 : 0) : (existing?.in_app_enabled ?? 1);
      const push = input.pushEnabled !== undefined ? (input.pushEnabled ? 1 : 0) : (existing?.push_enabled ?? 1);
      const local = input.localNotificationsEnabled !== undefined ? (input.localNotificationsEnabled ? 1 : 0) : (existing?.local_notifications_enabled ?? 1);
      const quiet = input.quietHoursEnabled !== undefined ? (input.quietHoursEnabled ? 1 : 0) : (existing?.quiet_hours_enabled ?? 0);
      const quietStart = input.quietHoursStart !== undefined ? input.quietHoursStart : (existing?.quiet_hours_start ?? null);
      const quietEnd = input.quietHoursEnd !== undefined ? input.quietHoursEnd : (existing?.quiet_hours_end ?? null);

      if (!existing) {
        await conn.execute(
          `INSERT INTO user_notification_settings
           (user_id, in_app_enabled, push_enabled, local_notifications_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, inApp, push, local, quiet, quietStart, quietEnd]
        );
      } else {
        await conn.execute(
          `UPDATE user_notification_settings
           SET in_app_enabled = ?, push_enabled = ?, local_notifications_enabled = ?,
               quiet_hours_enabled = ?, quiet_hours_start = ?, quiet_hours_end = ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [inApp, push, local, quiet, quietStart, quietEnd, userId]
        );
      }

      if (input.categories && typeof input.categories === 'object') {
        for (const [category, isEnabled] of Object.entries(input.categories)) {
          const val = isEnabled ? 1 : 0;
          const existingPref = await conn.queryOne<any>(
            'SELECT id FROM user_notification_preferences WHERE user_id = ? AND category = ?',
            [userId, category]
          );
          if (existingPref) {
            await conn.execute(
              'UPDATE user_notification_preferences SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [val, existingPref.id]
            );
          } else {
            await conn.execute(
              'INSERT INTO user_notification_preferences (user_id, category, is_enabled) VALUES (?, ?, ?)',
              [userId, category, val]
            );
          }
        }
      }
    });

    return this.getNotificationSettings(userId);
  }

  async getFitnessConfiguration(userId: number): Promise<any> {
    const user = await this.findById(userId);
    if (!user) return null;
    const today = getUserLocalDate(user.timezone || 'UTC');

    const [weightGoal, waterTarget, waterQuickAdd, cardioTargets, reminders, activeWorkout, activeDiet] =
      await Promise.all([
        this.db.queryOne(
          `SELECT *, starting_weight_kg as start_weight_kg FROM user_weight_goals WHERE user_id = ? AND status = 'active' ORDER BY start_date DESC, id DESC LIMIT 1`,
          [userId]
        ),
        this.db.queryOne(
          `SELECT *, target_ml as daily_target_ml FROM user_water_targets WHERE user_id = ? AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until >= ?) ORDER BY effective_from DESC, id DESC LIMIT 1`,
          [userId, today, today]
        ),
        this.db.query(
          `SELECT id, user_id, amount_ml, display_order, is_active FROM user_water_quick_add_options WHERE user_id = ? ORDER BY display_order ASC`,
          [userId]
        ),
        this.db.query(
          `SELECT uct.*, ca.name as activity_name FROM user_cardio_targets uct LEFT JOIN cardio_activities ca ON ca.id = uct.cardio_activity_id WHERE uct.user_id = ? AND uct.status = 'active' ORDER BY uct.id ASC`,
          [userId]
        ),
        this.db.query(
          `SELECT *, name as title, trigger_mode as mode FROM reminder_rules WHERE user_id = ? OR (rule_scope = 'system' AND user_id IS NULL AND is_active = 1) ORDER BY id ASC`,
          [userId]
        ),
        this.db.queryOne(
          `SELECT uwa.*, wp.id as workout_plan_id, wp.name as plan_name, wp.visibility as plan_visibility, wp.owner_user_id as plan_owner_user_id, wpv.version_number
           FROM user_workout_assignments uwa
           JOIN workout_plan_versions wpv ON wpv.id = uwa.workout_plan_version_id
           JOIN workout_plans wp ON wp.id = wpv.workout_plan_id
           WHERE uwa.user_id = ? AND uwa.status = 'active' AND uwa.effective_from <= ? AND (uwa.effective_until IS NULL OR uwa.effective_until >= ?)
           ORDER BY uwa.effective_from DESC LIMIT 1`,
          [userId, today, today]
        ),
        this.db.queryOne(
          `SELECT uda.*, dp.id as diet_plan_id, dp.name as plan_name, dp.visibility as plan_visibility, dp.owner_user_id as plan_owner_user_id, dpv.version_number, dpv.daily_calorie_target
           FROM user_diet_assignments uda
           JOIN diet_plan_versions dpv ON dpv.id = uda.diet_plan_version_id
           JOIN diet_plans dp ON dp.id = dpv.diet_plan_id
           WHERE uda.user_id = ? AND uda.status = 'active' AND uda.effective_from <= ? AND (uda.effective_until IS NULL OR uda.effective_until >= ?)
           ORDER BY uda.effective_from DESC LIMIT 1`,
          [userId, today, today]
        ),
      ]);

    return {
      profile: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        heightCm: user.height_cm,
        gender: user.gender,
        timezone: user.timezone,
        locale: user.locale,
        unitSystem: user.unit_system || 'metric',
        emailVerifiedAt: user.email_verified_at,
        securityVersion: user.security_version,
      },
      weightGoal: weightGoal || null,
      waterTarget: waterTarget || null,
      waterQuickAdd: waterQuickAdd || [],
      cardioTargets: cardioTargets || [],
      reminders: reminders || [],
      activeWorkoutPlan: activeWorkout || null,
      activeDietPlan: activeDiet || null,
    };
  }

  async getUserMonitoringDossier(userId: number): Promise<any | null> {
    const user = await this.findById(userId);
    if (!user) return null;
    const localDate = getUserLocalDate(user.timezone || 'UTC');

    const [
      activeWorkoutAssignment,
      activeDietAssignment,
      weightGoal,
      waterTarget,
      cardioTargets,
      waterQuickAddOptions,
      adherenceConfig,
      latestWeights,
      todayWater,
      todayWorkout,
      todayMeals,
      todayCardio,
      recentTasks,
      pushDevices,
    ] = await Promise.all([
      this.db.queryOne(
        `SELECT uwa.*, wp.name as workout_plan_name, wp.visibility as workout_plan_visibility, wp.owner_user_id as workout_plan_owner_user_id, wpv.version_number
         FROM user_workout_assignments uwa
         JOIN workout_plan_versions wpv ON wpv.id = uwa.workout_plan_version_id
         JOIN workout_plans wp ON wp.id = wpv.workout_plan_id
         WHERE uwa.user_id = ? AND uwa.status = 'active'
         ORDER BY uwa.effective_from DESC LIMIT 1`,
        [userId]
      ),
      this.db.queryOne(
        `SELECT uda.*, dp.name as diet_plan_name, dp.visibility as diet_plan_visibility, dp.owner_user_id as diet_plan_owner_user_id, dpv.version_number
         FROM user_diet_assignments uda
         JOIN diet_plan_versions dpv ON dpv.id = uda.diet_plan_version_id
         JOIN diet_plans dp ON dp.id = dpv.diet_plan_id
         WHERE uda.user_id = ? AND uda.status = 'active'
         ORDER BY uda.effective_from DESC LIMIT 1`,
        [userId]
      ),
      this.db.queryOne(
        `SELECT * FROM user_weight_goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
        [userId]
      ),
      this.db.queryOne(
        `SELECT * FROM user_water_targets WHERE user_id = ? AND status = 'active' AND effective_from <= ? AND (effective_until IS NULL OR effective_until >= ?) ORDER BY effective_from DESC, id DESC LIMIT 1`,
        [userId, localDate, localDate]
      ),
      this.db.query(
        `SELECT uct.*, 
                uct.target_minutes_min as min_duration_minutes,
                uct.target_minutes_max as max_duration_minutes,
                ca.name as activity_name 
         FROM user_cardio_targets uct
         LEFT JOIN cardio_activities ca ON ca.id = uct.cardio_activity_id
         WHERE uct.user_id = ? AND uct.status = 'active' AND uct.effective_from <= ? AND (uct.effective_until IS NULL OR uct.effective_until >= ?)
         ORDER BY uct.effective_from DESC, uct.id DESC`,
        [userId, localDate, localDate]
      ),
      this.db.query(
        `SELECT * FROM user_water_quick_add_options WHERE user_id = ? ORDER BY display_order ASC`,
        [userId]
      ),
      this.db.queryOne(
        `SELECT * FROM user_adherence_configs WHERE user_id = ? AND is_active = 1 AND effective_from <= ? AND (effective_until IS NULL OR effective_until >= ?) ORDER BY effective_from DESC, id DESC LIMIT 1`,
        [userId, localDate, localDate]
      ),
      this.db.query(
        `SELECT * FROM body_weight_entries WHERE user_id = ? ORDER BY measurement_date DESC LIMIT 7`,
        [userId]
      ),
      this.db.queryOne<{ total_ml: number }>(
        `SELECT COALESCE(SUM(amount_ml), 0) as total_ml FROM water_entries WHERE user_id = ? AND intake_date = ?`,
        [userId, localDate]
      ),
      this.db.queryOne(
        `SELECT *, workout_date as session_date FROM workout_sessions WHERE user_id = ? AND workout_date = ? ORDER BY id DESC LIMIT 1`,
        [userId, localDate]
      ),
      this.db.query(
        `SELECT ml.*, dm.name as meal_name 
         FROM meal_logs ml
         JOIN diet_meals dm ON dm.id = ml.diet_meal_id
         WHERE ml.user_id = ? AND ml.meal_date = ?
         ORDER BY ml.id DESC`,
        [userId, localDate]
      ),
      this.db.query(
        `SELECT cl.*, ca.name as activity_name 
         FROM cardio_logs cl
         JOIN cardio_activities ca ON ca.id = cl.cardio_activity_id
         WHERE cl.user_id = ? AND cl.cardio_date = ?
         ORDER BY cl.id DESC`,
        [userId, localDate]
      ),
      this.db.query(
        `SELECT * FROM daily_tasks WHERE user_id = ? ORDER BY task_date DESC, id DESC LIMIT 20`,
        [userId]
      ),
      this.db.query(
        `SELECT id, device_uuid, platform, app_version, is_active, last_seen_at, created_at 
         FROM user_push_devices 
         WHERE user_id = ? 
         ORDER BY id DESC`,
        [userId]
      ),
    ]);

    for (const ct of cardioTargets as any[]) {
      const dayRows = await this.db.query<{ weekday: number }>(
        `SELECT weekday FROM user_cardio_target_days WHERE user_cardio_target_id = ? ORDER BY weekday ASC`,
        [ct.id]
      );
      ct.weekdays = dayRows.map((r) => r.weekday);
    }

    // Calculate adherence stats from tasks
    let completedTasksCount = 0;
    let missedTasksCount = 0;
    for (const t of recentTasks) {
      if (t.status === 'completed') completedTasksCount++;
      if (t.status === 'missed' || t.status === 'skipped') missedTasksCount++;
    }
    const adherenceRate = recentTasks.length > 0 ? Math.round((completedTasksCount / recentTasks.length) * 100) : 100;

    return {
      user,
      localDate,
      assignments: {
        workout: activeWorkoutAssignment,
        diet: activeDietAssignment,
      },
      goals: {
        weight: weightGoal,
        water: waterTarget,
        cardio: cardioTargets,
        waterQuickAdd: waterQuickAddOptions,
        adherenceConfig: adherenceConfig || {
          diet_weight_pct: 35,
          workout_weight_pct: 25,
          cardio_weight_pct: 15,
          water_weight_pct: 15,
          weight_logging_weight_pct: 10,
          is_default: true,
        },
      },
      today: {
        waterMl: todayWater?.total_ml || 0,
        latestWeight: latestWeights[0] || null,
        workout: todayWorkout || null,
        meals: todayMeals,
        cardio: todayCardio,
      },
      recentWeightHistory: latestWeights.reverse(),
      adherence: {
        totalTasksEvaluated: recentTasks.length,
        completedTasksCount,
        missedTasksCount,
        adherenceRate,
      },
      recentTasks,
      pushDevices: pushDevices || [],
    };
  }
}
