import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app/app.js';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { getDatabasePool, closeDatabasePool, resetDatabasePool } from '../src/database/pool.js';
import { testOtpStore } from '../src/shared/services/email.service.js';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `self_service_${process.pid}_${Date.now()}.db`);

describe('Self-Service Configuration & Security Test Suite', () => {
  let app: FastifyInstance;
  let userToken: string;
  let janeToken: string;
  let userId: number;
  let janeId: number;
  const origDbClient = env.dbClient;

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    process.env.SQLITE_DB_PATH = testDbPath;
    env.sqliteDbPath = testDbPath;
    env.dbClient = 'sqlite';
    resetDatabasePool();

    await runMigrations();
    await seedDatabase();

    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const userHash = await bcrypt.hash('User123!', 10);
    const db = getDatabasePool();
    await db.execute('UPDATE users SET password_hash = ? WHERE email = ?', [userHash, 'john.doe@fitnessplatform.com']);
    await db.execute(
      `INSERT INTO users (role_id, first_name, last_name, email, password_hash, status)
       VALUES (3, 'Jane', 'Smith', 'jane.smith@fitnessplatform.com', ?, 'active')`,
      [userHash]
    );

    const users = await db.query<any>('SELECT id, email FROM users');
    const john = users.find(u => u.email === 'john.doe@fitnessplatform.com');
    const jane = users.find(u => u.email === 'jane.smith@fitnessplatform.com');
    userId = john.id;
    janeId = jane.id;

    app = await buildApp();
    await app.ready();

    // Log in John
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'john.doe@fitnessplatform.com', password: 'User123!' },
    });
    userToken = loginRes.json().data.accessToken;

    // Log in Jane
    const janeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'jane.smith@fitnessplatform.com', password: 'User123!' },
    });
    janeToken = janeRes.json().data.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabasePool();
    env.dbClient = origDbClient;
    resetDatabasePool();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  describe('1. Self-Service Profile & Configuration Endpoints', () => {
    it('PATCH /me updates unitSystem, dateOfBirth, and gender', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          unitSystem: 'imperial',
          gender: 'male',
          dateOfBirth: '1992-05-15',
          heightCm: 182,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.unit_system).toBe('imperial');
      expect(data.gender).toBe('male');
      expect(data.date_of_birth).toBe('1992-05-15');
      expect(data.height_cm).toBe(182);
    });

    it('GET /me/fitness-configuration returns aggregate configuration payload', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/fitness-configuration',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.profile).toBeDefined();
      expect(data.profile.unitSystem).toBe('imperial');
      expect(data.waterTarget).toBeDefined();
      expect(data.reminders).toBeDefined();
    });

    it('PUT /me/goals/weight creates or updates user active weight goal', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/goals/weight',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          goalType: 'lose_weight',
          startWeightKg: 88,
          targetWeightKg: 78,
          targetDate: '2026-12-31',
          notes: 'Cutting for summer',
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.starting_weight_kg).toBe(88);
      expect(data.target_weight_kg).toBe(78);
      expect(data.goal_type).toBe('lose_weight');
      expect(data.status).toBe('active');
    });

    it('PUT /me/goals/water sets daily water target', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/goals/water',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { dailyTargetMl: 3200 },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.target_ml).toBe(3200);
      expect(data.status).toBe('active');
    });

    it('PUT /me/goals/water-quick-add saves quick-add options', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/goals/water-quick-add',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          options: [
            { amountMl: 250, displayOrder: 1 },
            { amountMl: 500, displayOrder: 2 },
            { amountMl: 750, displayOrder: 3 },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      const options = res.json().data;
      expect(options.length).toBe(3);
      expect(options[0].amount_ml).toBe(250);
      expect(options[1].amount_ml).toBe(500);
    });

    it('Cardio targets lifecycle: POST, GET, and DELETE /me/goals/cardio', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/goals/cardio',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          cardioActivityId: 1,
          minDurationMinutes: 30,
          maxDurationMinutes: 45,
          targetSpeedMinKmh: 8.5,
          weekdays: [1, 3, 5],
          notes: 'Morning run',
        },
      });
      expect(postRes.statusCode).toBe(201);
      const createdTarget = postRes.json().data;
      expect(createdTarget.id).toBeDefined();

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/goals/cardio',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().data.length).toBeGreaterThan(0);

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/me/goals/cardio/${createdTarget.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(delRes.statusCode).toBe(200);
    });

    it('User reminders lifecycle: POST, GET, PUT, and DELETE /me/reminders', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/reminders',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          title: 'Drink Water Midday',
          category: 'water',
          mode: 'fixed_time',
          fixedTime: '13:00:00',
          isActive: true,
        },
      });
      expect(postRes.statusCode).toBe(201);
      const reminder = postRes.json().data;
      expect(reminder.id).toBeDefined();
      expect(reminder.title).toBe('Drink Water Midday');

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/reminders',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(getRes.statusCode).toBe(200);

      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/reminders/${reminder.id}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          title: 'Drink Water Afternoon',
          fixedTime: '14:30:00',
        },
      });
      expect(putRes.statusCode).toBe(200);
      expect(putRes.json().data.title).toBe('Drink Water Afternoon');

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/me/reminders/${reminder.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(delRes.statusCode).toBe(200);
    });
  });

  describe('2. Private Workout Plans from Scratch & Lifecycle', () => {
    let myWorkoutPlanId: number;
    let myVersionId: number;
    let dayId: number;
    let exerciseId: number;

    it('POST /me/workout-plans creates a private draft workout plan', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/workout-plans',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'My Custom Hypertrophy Routine',
          description: 'Created by John for self-service hypertrophy training',
          goalCategory: 'hypertrophy',
        },
      });
      expect(res.statusCode).toBe(201);
      const plan = res.json().data;
      expect(plan.id).toBeDefined();
      expect(plan.owner_user_id).toBe(userId);
      expect(plan.visibility).toBe('private');
      expect(plan.versions.length).toBe(1);
      myWorkoutPlanId = plan.id;
      myVersionId = plan.versions[0].id;
    });

    it('GET /me/workout-plans lists private plan for owner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/workout-plans',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      const plans = res.json().data;
      const found = plans.find((p: any) => p.id === myWorkoutPlanId);
      expect(found).toBeDefined();
      expect(found.name).toBe('My Custom Hypertrophy Routine');
    });

    it('Mutates days and exercises on the private draft version', async () => {
      const verRes = await app.inject({
        method: 'GET',
        url: `/api/v1/me/workout-plans/${myWorkoutPlanId}/versions/${myVersionId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(verRes.statusCode).toBe(200);
      const days = verRes.json().data.days;
      expect(days.length).toBe(0);

      const dayCreateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${myWorkoutPlanId}/versions/${myVersionId}/days`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { weekdayNumber: 1, name: 'Chest & Triceps Day', isRestDay: false },
      });
      expect(dayCreateRes.statusCode).toBe(201);
      dayId = dayCreateRes.json().data.id;

      const dayUpdateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/workout-plans/${myWorkoutPlanId}/days/${dayId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Chest & Triceps Day', isRestDay: false },
      });
      expect(dayUpdateRes.statusCode).toBe(200);

      const addExRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${myWorkoutPlanId}/days/${dayId}/exercises`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          exerciseId: 1,
          targetSets: 4,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Focus on contraction',
        },
      });
      expect(addExRes.statusCode).toBe(201);
      exerciseId = addExRes.json().data.id;

      const updateExRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/workout-plans/${myWorkoutPlanId}/exercises/${exerciseId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { targetSets: 5, notes: 'Pyramid up' },
      });
      expect(updateExRes.statusCode).toBe(200);
    });

    it('POST /me/workout-plans/:id/versions/:versionId/publish publishes draft version', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${myWorkoutPlanId}/versions/${myVersionId}/publish`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('published');
    });

    it('POST /me/workout-plans/:id/activate sets assignment_source=self_service and reflects on /me/today', async () => {
      const actRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${myWorkoutPlanId}/activate`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(actRes.statusCode).toBe(200);
      expect(actRes.json().data.workoutPlanId).toBe(myWorkoutPlanId);

      const db = getDatabasePool();
      const assignment = await db.queryOne<any>(
        'SELECT * FROM user_workout_assignments WHERE user_id = ? AND status = "active"',
        [userId]
      );
      expect(assignment.assignment_source).toBe('self_service');

      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(todayRes.statusCode).toBe(200);
      const todayData = todayRes.json().data;
      expect(todayData.activeWorkoutAssignment).toBeDefined();
      expect(todayData.activeWorkoutAssignment.workout_plan_version_id).toBe(myVersionId);
    });

    it('POST /me/workout-plans/:id/clone clones private plan to another private plan', async () => {
      const cloneRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/workout-plans/${myWorkoutPlanId}/clone`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'My Cloned Hypertrophy Routine' },
      });
      expect(cloneRes.statusCode).toBe(201);
      const cloned = cloneRes.json().data;
      expect(cloned.name).toBe('My Cloned Hypertrophy Routine');
      expect(cloned.owner_user_id).toBe(userId);
      expect(cloned.visibility).toBe('private');
    });
  });

  describe('3. Private Diet Plans from Scratch & Lifecycle', () => {
    let myDietPlanId: number;
    let myDietVersionId: number;
    let mealId: number;
    let groupId: number;
    let optionId: number;

    it('POST /me/diet-plans creates a private draft diet plan', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/me/diet-plans',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'My Custom Cutting Diet',
          description: 'High protein cutting diet by John',
          dailyCaloriesTarget: 2200,
        },
      });
      expect(res.statusCode).toBe(201);
      const plan = res.json().data;
      expect(plan.id).toBeDefined();
      expect(plan.owner_user_id).toBe(userId);
      expect(plan.visibility).toBe('private');
      myDietPlanId = plan.id;
      myDietVersionId = plan.versions[0].id;
    });

    it('Mutates meals, option groups, and options on private diet plan', async () => {
      const mealRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${myDietPlanId}/versions/${myDietVersionId}/meals`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Breakfast Bowl',
          scheduledTime: '08:00',
          orderIndex: 1,
        },
      });
      expect(mealRes.statusCode).toBe(201);
      const versionData = mealRes.json().data;
      const meal = versionData.meals.find((m: any) => m.name === 'Breakfast Bowl');
      expect(meal).toBeDefined();
      mealId = meal.id;

      const groupRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${myDietPlanId}/meals/${mealId}/option-groups`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Protein Base',
          isRequired: true,
          minSelections: 1,
          maxSelections: 1,
        },
      });
      expect(groupRes.statusCode).toBe(201);
      groupId = groupRes.json().data.id;

      const optRes = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${myDietPlanId}/option-groups/${groupId}/options`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          foodId: 1,
          customLabel: 'Scrambled Eggs',
          servingQuantity: 200,
          servingUnitId: 1,
          calories: 280,
          proteinG: 24,
          carbsG: 2,
          fatG: 18,
          isDefault: true,
        },
      });
      expect(optRes.statusCode).toBe(201);
      optionId = optRes.json().data.id;
    });

    it('POST /me/diet-plans/:id/versions/:versionId/publish publishes draft diet version', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${myDietPlanId}/versions/${myDietVersionId}/publish`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('published');
    });

    it('POST /me/diet-plans/:id/activate activates diet plan and reflects on /me/today', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${myDietPlanId}/activate`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.dietPlanId).toBe(myDietPlanId);

      const db = getDatabasePool();
      const assignment = await db.queryOne<any>(
        'SELECT * FROM user_diet_assignments WHERE user_id = ? AND status = "active"',
        [userId]
      );
      expect(assignment.assignment_source).toBe('self_service');

      const todayRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/today',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(todayRes.statusCode).toBe(200);
      expect(todayRes.json().data.activeDietAssignment.diet_plan_version_id).toBe(myDietVersionId);
    });

    it('POST /me/diet-plans/:id/clone clones private diet plan with meals and groups', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/me/diet-plans/${myDietPlanId}/clone`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'My Cloned Cutting Diet' },
      });
      expect(res.statusCode).toBe(201);
      const plan = res.json().data;
      expect(plan.name).toBe('My Cloned Cutting Diet');
      expect(plan.owner_user_id).toBe(userId);
    });
  });

  describe('4. Ownership Boundary & Isolation Security Checks', () => {
    it('Prevents Jane from viewing or editing John’s private workout plan', async () => {
      const db = getDatabasePool();
      const johnPlan = await db.queryOne<any>(
        'SELECT id FROM workout_plans WHERE owner_user_id = ? AND visibility = "private" LIMIT 1',
        [userId]
      );

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/me/workout-plans/${johnPlan.id}`,
        headers: { authorization: `Bearer ${janeToken}` },
      });
      expect(getRes.statusCode).toBe(403);

      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/workout-plans/${johnPlan.id}`,
        headers: { authorization: `Bearer ${janeToken}` },
        payload: { name: 'Malicious Overwrite' },
      });
      expect(putRes.statusCode).toBe(403);
    });

    it('Prevents Jane from viewing or editing John’s private diet plan', async () => {
      const db = getDatabasePool();
      const johnPlan = await db.queryOne<any>(
        'SELECT id FROM diet_plans WHERE owner_user_id = ? AND visibility = "private" LIMIT 1',
        [userId]
      );

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/me/diet-plans/${johnPlan.id}`,
        headers: { authorization: `Bearer ${janeToken}` },
      });
      expect(getRes.statusCode).toBe(403);

      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/me/diet-plans/${johnPlan.id}`,
        headers: { authorization: `Bearer ${janeToken}` },
        payload: { name: 'Malicious Overwrite' },
      });
      expect(putRes.statusCode).toBe(403);
    });
  });

  describe('5. OTP Security Flows & Session Revocation', () => {
    it('Password Change via Current-Email OTP: requests OTP, verifies OTP, updates password, increments security_version', async () => {
      testOtpStore.clear();

      const reqRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/security/password-change/request',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(reqRes.statusCode).toBe(200);
      const challengeId = reqRes.json().data.challengeId;
      expect(challengeId).toBeDefined();

      const otp = testOtpStore.get('john.doe@fitnessplatform.com');
      expect(otp).toBeDefined();

      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/security/password-change/verify',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          challengeId,
          otp,
          currentPassword: 'User123!',
          newPassword: 'NewUser123!',
        },
      });
      expect(verifyRes.statusCode).toBe(200);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(meRes.statusCode).toBe(401);
      expect(meRes.json().error.code).toBe('SESSION_REVOKED');

      const newLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'john.doe@fitnessplatform.com', password: 'NewUser123!' },
      });
      expect(newLogin.statusCode).toBe(200);
      userToken = newLogin.json().data.accessToken;
    });

    it('Dual-OTP Email Change: requires both current and new email OTP verification', async () => {
      testOtpStore.clear();
      const newEmail = 'john.updated@fitnessplatform.com';

      const reqRes = await app.inject({
        method: 'POST',
        url: '/api/v1/me/security/email-change/request',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { newEmail },
      });
      expect(reqRes.statusCode).toBe(200);
      const { currentEmailChallengeId, newEmailChallengeId } = reqRes.json().data;
      expect(currentEmailChallengeId).toBeDefined();
      expect(newEmailChallengeId).toBeDefined();

      const curOtp = testOtpStore.get('john.doe@fitnessplatform.com');
      const newOtp = testOtpStore.get(newEmail.toLowerCase());
      expect(curOtp).toBeDefined();
      expect(newOtp).toBeDefined();

      const badVerify = await app.inject({
        method: 'POST',
        url: '/api/v1/me/security/email-change/verify',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          currentEmailOtp: '000000',
          newEmailOtp: newOtp,
          password: 'NewUser123!',
        },
      });
      expect(badVerify.statusCode).toBe(400);

      const goodVerify = await app.inject({
        method: 'POST',
        url: '/api/v1/me/security/email-change/verify',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          currentEmailOtp: curOtp,
          newEmailOtp: newOtp,
          password: 'NewUser123!',
        },
      });
      expect(goodVerify.statusCode).toBe(200);
      expect(goodVerify.json().data.email).toBe(newEmail);

      const meCheck = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(meCheck.statusCode).toBe(401);

      const newLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: newEmail, password: 'NewUser123!' },
      });
      expect(newLogin.statusCode).toBe(200);
      userToken = newLogin.json().data.accessToken;
    });

    it('Password Recovery Migration to OTP: enumeration-resistant request & OTP verification', async () => {
      testOtpStore.clear();

      const nonExistent = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/request',
        payload: { email: 'nonexistent@randomdomain.com' },
      });
      expect(nonExistent.statusCode).toBe(200);
      expect(nonExistent.json().data.challengeId).toBeDefined();

      const resetReq = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/request',
        payload: { email: 'john.updated@fitnessplatform.com' },
      });
      expect(resetReq.statusCode).toBe(200);
      const challengeId = resetReq.json().data.challengeId;
      const otp = testOtpStore.get('john.updated@fitnessplatform.com');
      expect(otp).toBeDefined();

      const resetVerify = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/verify',
        payload: {
          challengeId,
          otp,
          newPassword: 'BrandNewPassword123!',
        },
      });
      expect(resetVerify.statusCode).toBe(200);

      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'john.updated@fitnessplatform.com', password: 'BrandNewPassword123!' },
      });
      expect(login.statusCode).toBe(200);
    });
  });
});
