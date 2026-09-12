import bcrypt from 'bcryptjs';
import { getDatabasePool } from '../database/pool.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export async function applyTarekProductionSeed() {
  const db = getDatabasePool();
  logger.info({ dbClient: env.dbClient, host: env.databaseHost }, 'Starting Tarek production seed...');

  // 1. Ensure or update user aswadt12@gmail.com
  const passwordHash = await bcrypt.hash('12345678', 10);

  // Check if aswadt12@gmail.com already exists
  let user = await db.queryOne<{ id: number; email: string }>(
    `SELECT id, email FROM users WHERE email = 'aswadt12@gmail.com'`
  );

  if (!user) {
    // Check if aswadt12222@gmail.com exists (from prior typo)
    const typoUser = await db.queryOne<{ id: number }>(
      `SELECT id FROM users WHERE email = 'aswadt12222@gmail.com'`
    );

    if (typoUser) {
      await db.execute(
        `UPDATE users SET email = 'aswadt12@gmail.com', password_hash = ?, first_name = 'Tarek', last_name = 'Aswad', status = 'active', timezone = 'Asia/Beirut', unit_system = 'metric' WHERE id = ?`,
        [passwordHash, typoUser.id]
      );
      user = { id: typoUser.id, email: 'aswadt12@gmail.com' };
      logger.info({ userId: user.id }, 'Updated existing user to aswadt12@gmail.com with new password');
    } else {
      const res = await db.execute(
        `INSERT INTO users (role_id, first_name, last_name, email, password_hash, height_cm, timezone, locale, status, security_version, unit_system)
         VALUES (3, 'Tarek', 'Aswad', 'aswadt12@gmail.com', ?, 180, 'Asia/Beirut', 'en', 'active', 1, 'metric')`,
        [passwordHash]
      );
      user = { id: res.insertId, email: 'aswadt12@gmail.com' };
      logger.info({ userId: user.id }, 'Created user aswadt12@gmail.com with new password');
    }
  } else {
    // Update password to 12345678 and ensure active
    await db.execute(
      `UPDATE users SET password_hash = ?, first_name = 'Tarek', last_name = 'Aswad', status = 'active', timezone = 'Asia/Beirut', unit_system = 'metric' WHERE id = ?`,
      [passwordHash, user.id]
    );
    logger.info({ userId: user.id }, 'Updated password for aswadt12@gmail.com');
  }

  const userId = user.id;

  // 2. Ensure Workout Plan: 4-Day Gym Program (Fat Loss & Muscle Building)
  let workoutPlan = await db.queryOne<{ id: number }>(
    `SELECT id FROM workout_plans WHERE name = '4-Day Gym Program (Fat Loss & Muscle Building)'`
  );

  if (!workoutPlan) {
    const wpRes = await db.execute(
      `INSERT INTO workout_plans (name, description, goal, status, owner_user_id, visibility, created_by)
       VALUES ('4-Day Gym Program (Fat Loss & Muscle Building)', 
               'Refined 4-day Upper / Lower / Push / Pull split balancing hypertrophy, strength, and fatigue management with stable machine variations.',
               'hypertrophy', 'active', NULL, 'admin', 1)`
    );
    workoutPlan = { id: wpRes.insertId };
    logger.info({ workoutPlanId: workoutPlan.id }, 'Created workout plan');
  }

  // Ensure Workout Plan Version
  let wpv = await db.queryOne<{ id: number }>(
    `SELECT id FROM workout_plan_versions WHERE workout_plan_id = ? AND version_number = 1`,
    [workoutPlan.id]
  );

  if (!wpv) {
    const wpvRes = await db.execute(
      `INSERT INTO workout_plan_versions (workout_plan_id, version_number, status, change_notes, created_by, published_by, published_at)
       VALUES (?, 1, 'published', 'Initial published version from refined gym program', 1, 1, CURRENT_TIMESTAMP)`,
      [workoutPlan.id]
    );
    wpv = { id: wpvRes.insertId };
    logger.info({ wpvId: wpv.id }, 'Created workout plan version');
  }

  const workoutPlanVersionId = wpv.id;

  // 3. Define the 7 Days and their exercises
  interface ExerciseDef {
    name: string;
    trackingType: 'weight_reps' | 'duration';
    targetSets: number;
    repsMin: number;
    repsMax: number;
    restSeconds: number;
    notes?: string;
    isOptional?: boolean;
    sets: Array<{ setNumber: number; repsMin: number; repsMax: number; restSeconds: number }>;
  }

  interface DayDef {
    weekday: number;
    dayOrder: number;
    name: string;
    description: string;
    isRestDay: boolean;
    notes?: string;
    exercises: ExerciseDef[];
  }

  const days: DayDef[] = [
    {
      weekday: 1,
      dayOrder: 1,
      name: 'Upper Body',
      description: 'Balanced upper-body work with stable positions and controlled loading.',
      isRestDay: false,
      notes: 'Technique note: Keep your chest supported during rows and maintain a neutral neck. Stop if an exercise causes sharp or radiating pain.',
      exercises: [
        {
          name: 'Machine Chest Press',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Keep chest supported and maintain neutral neck.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Neutral-Grip Lat Pulldown',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Full stretch at the top, squeeze lats.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Chest-Supported Row',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Keep chest firmly supported on bench/pad.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Cable Lateral Raise',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 12,
          repsMax: 20,
          restSeconds: 75,
          notes: 'Raise to shoulder level with controlled tempo.',
          sets: [
            { setNumber: 1, repsMin: 12, repsMax: 20, restSeconds: 75 },
            { setNumber: 2, repsMin: 12, repsMax: 20, restSeconds: 75 },
          ],
        },
        {
          name: 'Rope Face Pull',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 12,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Pull towards forehead, rotating hands back.',
          sets: [
            { setNumber: 1, repsMin: 12, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 12, repsMax: 15, restSeconds: 75 },
          ],
        },
        {
          name: 'Rope Triceps Pushdown',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Keep elbows tight and spread rope at the bottom.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 10, repsMax: 15, restSeconds: 75 },
          ],
        },
        {
          name: 'Cable Biceps Curl',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Maintain strict elbow position throughout.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 10, repsMax: 15, restSeconds: 75 },
          ],
        },
      ],
    },
    {
      weekday: 2,
      dayOrder: 2,
      name: 'Combined Leg Day',
      description: 'One complete lower-body session combining the strongest elements of Lower A and Lower B.',
      isRestDay: false,
      notes: 'Technique note: Choose either the leg press or hack squat as the main squat pattern. The reverse lunge is optional; skip it if fatigue or recovery becomes excessive. Keep your hips and lower back supported during machine work.',
      exercises: [
        {
          name: 'Hack Squat / Leg Press',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Main squat pattern: choose either leg press or hack squat.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Supported Bulgarian Split Squat',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 8,
          repsMax: 10,
          restSeconds: 90,
          notes: '8-10 reps per leg. Maintain upright/slight forward torso.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 10, restSeconds: 90 },
            { setNumber: 2, repsMin: 8, repsMax: 10, restSeconds: 90 },
          ],
        },
        {
          name: 'Hip Thrust',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Drive through heels, pause at top with neutral spine.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Seated Leg Curl',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 90,
          notes: 'Control eccentric phase smoothly on every rep.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 15, restSeconds: 90 },
            { setNumber: 2, repsMin: 10, repsMax: 15, restSeconds: 90 },
            { setNumber: 3, repsMin: 10, repsMax: 15, restSeconds: 90 },
          ],
        },
        {
          name: 'Leg Extension',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Pause briefly at full extension without hyperextending.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 10, repsMax: 15, restSeconds: 75 },
          ],
        },
        {
          name: 'Standing Calf Raise',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Full stretch at bottom, peak squeeze at top.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 3, repsMin: 10, repsMax: 15, restSeconds: 75 },
          ],
        },
        {
          name: 'Pallof Press',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 10,
          repsMax: 12,
          restSeconds: 60,
          notes: '10-12 reps per side. Brace core and resist rotation.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 12, restSeconds: 60 },
            { setNumber: 2, repsMin: 10, repsMax: 12, restSeconds: 60 },
            { setNumber: 3, repsMin: 10, repsMax: 12, restSeconds: 60 },
          ],
        },
        {
          name: 'Supported Reverse Lunge',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 8,
          repsMax: 10,
          restSeconds: 90,
          notes: 'Optional movement (8-10 reps/leg). Skip if recovery or fatigue warrants.',
          isOptional: true,
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 10, restSeconds: 90 },
            { setNumber: 2, repsMin: 8, repsMax: 10, restSeconds: 90 },
          ],
        },
      ],
    },
    {
      weekday: 3,
      dayOrder: 3,
      name: 'Push - Chest, Shoulders, Triceps',
      description: 'Chest, shoulders, and triceps using stable pressing variations.',
      isRestDay: false,
      notes: 'Technique note: Keep your head supported and avoid pushing it forward. Replace the landmine press if it aggravates your neck or shoulder.',
      exercises: [
        {
          name: 'Incline Machine Chest Press',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Upper chest focus. Keep shoulders retracted.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Machine Chest Press',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 10,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Flat press variation for mid chest hypertrophy.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 10, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Single-Arm Landmine Press',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 90,
          notes: '8-12 reps per arm. Keep head supported, avoid pushing neck forward.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 90 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 90 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
          ],
        },
        {
          name: 'Cable Lateral Raise',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 12,
          repsMax: 20,
          restSeconds: 75,
          notes: 'Side deltoid hypertrophy with continuous tension.',
          sets: [
            { setNumber: 1, repsMin: 12, repsMax: 20, restSeconds: 75 },
            { setNumber: 2, repsMin: 12, repsMax: 20, restSeconds: 75 },
            { setNumber: 3, repsMin: 12, repsMax: 20, restSeconds: 75 },
          ],
        },
        {
          name: 'Pec-Deck Fly',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 12,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Deep stretch across pecs, squeeze at center.',
          sets: [
            { setNumber: 1, repsMin: 12, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 12, repsMax: 15, restSeconds: 75 },
          ],
        },
        {
          name: 'Rope Triceps Pushdown',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Full elbow extension and lockouts.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 3, repsMin: 10, repsMax: 15, restSeconds: 75 },
          ],
        },
      ],
    },
    {
      weekday: 4,
      dayOrder: 4,
      name: 'Pull - Back, Rear Delts, Biceps',
      description: 'Back, rear shoulders, trapezius, and biceps with stable rowing positions.',
      isRestDay: false,
      notes: 'Technique note: Shrug upward without rolling your shoulders. Keep your neck neutral and use controlled repetitions.',
      exercises: [
        {
          name: 'Neutral-Grip Lat Pulldown',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Vertical pull targeting lats with joint-friendly grip.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Chest-Supported Row',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 120,
          notes: 'Horizontal compound pull with zero lower back strain.',
          sets: [
            { setNumber: 1, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 2, repsMin: 8, repsMax: 12, restSeconds: 120 },
            { setNumber: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
        {
          name: 'Seated Cable Row',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 10,
          repsMax: 12,
          restSeconds: 90,
          notes: 'Maintain neutral spine, pull smoothly to lower abdomen.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 12, restSeconds: 90 },
            { setNumber: 2, repsMin: 10, repsMax: 12, restSeconds: 90 },
          ],
        },
        {
          name: 'Reverse Pec-Deck',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 12,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Rear deltoid flyes, leading with elbows.',
          sets: [
            { setNumber: 1, repsMin: 12, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 12, repsMax: 15, restSeconds: 75 },
            { setNumber: 3, repsMin: 12, repsMax: 15, restSeconds: 75 },
          ],
        },
        {
          name: 'Rope Face Pull',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 12,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Upper back and external rotator cuff focus.',
          sets: [
            { setNumber: 1, repsMin: 12, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 12, repsMax: 15, restSeconds: 75 },
          ],
        },
        {
          name: 'Chest-Supported Dumbbell Shrug',
          trackingType: 'weight_reps',
          targetSets: 2,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Shrug upward without rolling shoulders. Keep neck neutral.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 10, repsMax: 15, restSeconds: 75 },
          ],
        },
        {
          name: 'Cable Biceps Curl',
          trackingType: 'weight_reps',
          targetSets: 3,
          repsMin: 10,
          repsMax: 15,
          restSeconds: 75,
          notes: 'Controlled tempo bicep builder with peak squeeze.',
          sets: [
            { setNumber: 1, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 2, repsMin: 10, repsMax: 15, restSeconds: 75 },
            { setNumber: 3, repsMin: 10, repsMax: 15, restSeconds: 75 },
          ],
        },
      ],
    },
    {
      weekday: 5,
      dayOrder: 5,
      name: 'Recovery & Walking',
      description: 'Active recovery and steady-state movement.',
      isRestDay: true,
      notes: 'Do 30-40 minutes of easy-to-moderate cardio on Friday or Saturday. Consistency matters more than exhausting cardio sessions.',
      exercises: [],
    },
    {
      weekday: 6,
      dayOrder: 6,
      name: 'Optional Light Cardio / Walking',
      description: 'Optional light cardio or walking session.',
      isRestDay: true,
      notes: 'Optional 30-40 minutes easy-to-moderate cardio or walking.',
      exercises: [],
    },
    {
      weekday: 7,
      dayOrder: 7,
      name: 'Full Rest Day',
      description: 'Full rest, nervous system recovery, and sleep prioritization.',
      isRestDay: true,
      notes: 'Use Friday through Sunday to recover. Keep at least one full rest day and prioritize regular sleep.',
      exercises: [],
    },
  ];

  // Fetch all exercises from catalog to map names to IDs
  const allExercises = await db.query<{ id: number; name: string }>(`SELECT id, name FROM exercises`);
  const exerciseMap = new Map<string, number>();
  for (const ex of allExercises) {
    exerciseMap.set(ex.name.toLowerCase().trim(), ex.id);
  }

  for (const day of days) {
    let dayRow = await db.queryOne<{ id: number }>(
      `SELECT id FROM workout_plan_days WHERE workout_plan_version_id = ? AND weekday = ?`,
      [workoutPlanVersionId, day.weekday]
    );

    if (!dayRow) {
      const dRes = await db.execute(
        `INSERT INTO workout_plan_days (workout_plan_version_id, weekday, name, description, is_rest_day, day_order, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [workoutPlanVersionId, day.weekday, day.name, day.description, day.isRestDay ? 1 : 0, day.dayOrder, day.notes || null]
      );
      dayRow = { id: dRes.insertId };
    }

    const dayId = dayRow.id;

    for (let order = 0; order < day.exercises.length; order++) {
      const exDef = day.exercises[order];
      const exId = exerciseMap.get(exDef.name.toLowerCase().trim());
      if (!exId) {
        logger.warn({ exerciseName: exDef.name }, 'Exercise not found in catalog, skipping');
        continue;
      }

      let wpeRow = await db.queryOne<{ id: number }>(
        `SELECT id FROM workout_plan_exercises WHERE workout_plan_day_id = ? AND exercise_id = ?`,
        [dayId, exId]
      );

      if (!wpeRow) {
        const wpeRes = await db.execute(
          `INSERT INTO workout_plan_exercises (workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot, target_sets, target_reps_min, target_reps_max, rest_seconds, notes, is_optional)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dayId, exId, order + 1, exDef.name, exDef.trackingType, exDef.targetSets, exDef.repsMin, exDef.repsMax, exDef.restSeconds, exDef.notes || null, exDef.isOptional ? 1 : 0]
        );
        wpeRow = { id: wpeRes.insertId };

        // Insert sets
        for (const s of exDef.sets) {
          await db.execute(
            `INSERT INTO workout_plan_exercise_sets (workout_plan_exercise_id, set_number, target_reps_min, target_reps_max, rest_seconds, set_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [wpeRow.id, s.setNumber, s.repsMin, s.repsMax, s.restSeconds, s.setNumber]
          );
        }
      }
    }
  }

  logger.info({ workoutPlanVersionId }, 'Workout plan days, exercises, and sets verified');

  // 4. Assign Workout Plan to user aswadt12@gmail.com
  // Deactivate existing assignments
  await db.execute(
    `UPDATE user_workout_assignments SET status = 'ended', effective_until = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'`,
    [userId]
  );

  await db.execute(
    `INSERT INTO user_workout_assignments (user_id, workout_plan_version_id, effective_from, status, assignment_source, assigned_by)
     VALUES (?, ?, '2026-01-01', 'active', 'admin', 1)`,
    [userId, workoutPlanVersionId]
  );
  logger.info({ userId, workoutPlanVersionId }, 'Assigned workout plan to aswadt12@gmail.com');

  // 5. Assign Diet Plan 2 (Tarek Refined Diet Plan) to aswadt12@gmail.com
  const dietPlan = await db.queryOne<{ id: number }>(
    `SELECT id FROM diet_plans WHERE name LIKE '%Tarek Refined Diet Plan%' LIMIT 1`
  );

  if (dietPlan) {
    const dpv = await db.queryOne<{ id: number }>(
      `SELECT id FROM diet_plan_versions WHERE diet_plan_id = ? AND status = 'published' ORDER BY version_number DESC LIMIT 1`,
      [dietPlan.id]
    );

    if (dpv) {
      await db.execute(
        `UPDATE user_diet_assignments SET status = 'ended', effective_until = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'`,
        [userId]
      );

      await db.execute(
        `INSERT INTO user_diet_assignments (user_id, diet_plan_version_id, effective_from, status, assignment_source, assigned_by)
         VALUES (?, ?, '2026-01-01', 'active', 'admin', 1)`,
        [userId, dpv.id]
      );
      logger.info({ userId, dietPlanVersionId: dpv.id }, 'Assigned diet plan to aswadt12@gmail.com');
    }
  }

  // 6. User goals, water, cardio, adherence configs
  // Water target
  const existingWater = await db.queryOne<{ id: number }>(
    `SELECT id FROM user_water_targets WHERE user_id = ? AND status = 'active'`,
    [userId]
  );
  if (!existingWater) {
    await db.execute(
      `INSERT INTO user_water_targets (user_id, target_ml, effective_from, status)
       VALUES (?, 3500, '2026-01-01', 'active')`,
      [userId]
    );
  }

  // Quick add water options
  const existingQuickAdds = await db.query<{ id: number }>(
    `SELECT id FROM user_water_quick_add_options WHERE user_id = ?`,
    [userId]
  );
  if (existingQuickAdds.length === 0) {
    await db.execute(
      `INSERT INTO user_water_quick_add_options (user_id, amount_ml, display_order, is_active) VALUES
       (?, 250, 1, 1), (?, 500, 2, 1), (?, 750, 3, 1), (?, 1000, 4, 1)`,
      [userId, userId, userId, userId]
    );
  }

  // Weight goal
  const existingWeight = await db.queryOne<{ id: number }>(
    `SELECT id FROM user_weight_goals WHERE user_id = ? AND status = 'active'`,
    [userId]
  );
  if (!existingWeight) {
    await db.execute(
      `INSERT INTO user_weight_goals (user_id, goal_type, starting_weight_kg, target_weight_kg, start_date, target_date, status)
       VALUES (?, 'lose_weight', 105.2, 86.3, '2026-01-01', '2026-12-31', 'active')`,
      [userId]
    );
  }

  // Cardio target
  const existingCardio = await db.queryOne<{ id: number }>(
    `SELECT id FROM user_cardio_targets WHERE user_id = ? AND status = 'active'`,
    [userId]
  );
  if (!existingCardio) {
    const cRes = await db.execute(
      `INSERT INTO user_cardio_targets (user_id, cardio_activity_id, target_minutes_min, target_minutes_max, effective_from, status)
       VALUES (?, 2, 30, 40, '2026-01-01', 'active')`,
      [userId]
    );
    await db.execute(
      `INSERT INTO user_cardio_target_days (user_cardio_target_id, weekday) VALUES (?, 5), (?, 6)`,
      [cRes.insertId, cRes.insertId]
    );
  }

  // Adherence config
  const existingAdherence = await db.queryOne<{ id: number }>(
    `SELECT id FROM user_adherence_configs WHERE user_id = ? AND is_active = 1`,
    [userId]
  );
  if (!existingAdherence) {
    await db.execute(
      `INSERT INTO user_adherence_configs (user_id, diet_weight_pct, workout_weight_pct, cardio_weight_pct, water_weight_pct, weight_logging_weight_pct, effective_from, is_active)
       VALUES (?, 35.0, 25.0, 15.0, 15.0, 10.0, '2026-01-01', 1)`,
      [userId]
    );
  }

  // Notification settings
  const existingNotif = await db.queryOne<{ user_id: number }>(
    `SELECT user_id FROM user_notification_settings WHERE user_id = ?`,
    [userId]
  );
  if (!existingNotif) {
    await db.execute(
      `INSERT INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled)
       VALUES (?, 1, 1, 1)`,
      [userId]
    );
  }

  logger.info({ userId }, '🎉 Successfully applied complete Tarek production seed for aswadt12@gmail.com!');
}

if (process.argv[1]?.includes('seed-tarek')) {
  applyTarekProductionSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('FATAL SEED ERROR:', err);
      process.exit(1);
    });
}
