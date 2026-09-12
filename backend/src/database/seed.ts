import bcrypt from 'bcryptjs';
import { getDatabasePool } from './pool.js';
import { runMigrations } from './migrate.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { DatabasePool } from './types.js';

export function toDialectInsertOrIgnore(sql: string, client: 'sqlite' | 'mysql' = env.dbClient): string {
  if (client === 'mysql') {
    return sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO');
  }
  return sql;
}

export async function seedDatabase(customDb?: DatabasePool, targetClient: 'sqlite' | 'mysql' = env.dbClient) {
  if (env.nodeEnv === 'production') {
    throw new Error('FATAL: Demo seeding is disabled when NODE_ENV=production. Use an approved data migration instead.');
  }

  await runMigrations(customDb);
  const db = customDb || getDatabasePool();
  logger.info('Seeding baseline and demo data...');

  const safeExecute = async (sql: string, params?: any[]) => {
    const dialectSql = toDialectInsertOrIgnore(sql, targetClient);
    try {
      return await db.execute(dialectSql, params);
    } catch (err) {
      console.error('FAILED SQL STATEMENT:', dialectSql.slice(0, 150));
      throw err;
    }
  };

  // 1. Roles
  await safeExecute(`INSERT OR IGNORE INTO roles (id, name, description) VALUES
    (1, 'super_admin', 'Full platform administrative control'),
    (2, 'admin', 'Plan builder and client manager'),
    (3, 'user', 'Fitness tracking client application user')`);

  // 2. Measurement units
  await safeExecute(`INSERT OR IGNORE INTO measurement_units (id, code, name, unit_type) VALUES
    (1, 'g', 'Grams', 'mass'),
    (2, 'kg', 'Kilograms', 'mass'),
    (3, 'ml', 'Milliliters', 'volume'),
    (4, 'l', 'Liters', 'volume'),
    (5, 'serving', 'Serving', 'serving'),
    (6, 'item', 'Item / Piece', 'count'),
    (7, 'km', 'Kilometers', 'distance'),
    (8, 'minute', 'Minutes', 'time'),
    (9, 'second', 'Seconds', 'time')`);

  // 3. Muscle groups
  await safeExecute(`INSERT OR IGNORE INTO muscle_groups (id, name) VALUES
    (1, 'Chest'),
    (2, 'Back'),
    (3, 'Shoulders'),
    (4, 'Biceps'),
    (5, 'Triceps'),
    (6, 'Quadriceps'),
    (7, 'Hamstrings'),
    (8, 'Glutes'),
    (9, 'Calves'),
    (10, 'Core'),
    (11, 'Cardio / Full Body')`);

  // 4. Equipment types
  await safeExecute(`INSERT OR IGNORE INTO equipment_types (id, name) VALUES
    (1, 'Barbell'),
    (2, 'Dumbbell'),
    (3, 'Cable Machine'),
    (4, 'Plate Loaded / Machine'),
    (5, 'Bodyweight'),
    (6, 'Cardio Machine'),
    (7, 'Resistance Band')`);

  // 5. Exercises (Baseline catalog + Refined 4-Day Gym Program exercises)
  await safeExecute(`INSERT OR IGNORE INTO exercises (id, name, description, equipment_type_id, tracking_type, instructions, video_url, is_active) VALUES
    (1, 'Barbell Bench Press', 'Compound horizontal chest press', 1, 'weight_reps', 'Lower bar to mid-chest, drive feet into floor, press up without flaring elbows.', 'https://www.youtube.com/results?search_query=barbell+bench+press+proper+form', 1),
    (2, 'Incline Dumbbell Press', 'Upper chest hypertrophy movement', 2, 'weight_reps', 'Set bench to 30 degrees. Press dumbbells up in a slight arc.', 'https://www.youtube.com/results?search_query=incline+dumbbell+press+proper+form', 1),
    (3, 'Barbell Back Squat', 'Fundamental compound lower body exercise', 1, 'weight_reps', 'Descend until hip crease is below top of knees. Maintain neutral spine.', 'https://www.youtube.com/results?search_query=barbell+back+squat+proper+form', 1),
    (4, 'Leg Press 45°', 'Quad-dominant machine press', 4, 'weight_reps', 'Place feet shoulder-width on platform. Lower sled under control.', 'https://www.youtube.com/results?search_query=leg+press+proper+form', 1),
    (5, 'Romanian Deadlift (RDL)', 'Posterior chain builder targeting hamstrings and glutes', 1, 'weight_reps', 'Hinge at the hips with slight knee bend, lowering barbell along shins.', 'https://www.youtube.com/results?search_query=romanian+deadlift+proper+form', 1),
    (6, 'Lat Pulldown (Wide Grip)', 'Vertical back pulling exercise', 3, 'weight_reps', 'Pull bar smoothly to upper chest, retracting shoulder blades.', 'https://www.youtube.com/results?search_query=lat+pulldown+wide+grip+form', 1),
    (7, 'Barbell Bent-Over Row', 'Horizontal compound back pull', 1, 'weight_reps', 'Hinge torso to 45 degrees, row bar to lower ribcage.', 'https://www.youtube.com/results?search_query=barbell+bent+over+row+proper+form', 1),
    (8, 'Standing Overhead Dumbbell Press', 'Deltoid vertical pressing movement', 2, 'weight_reps', 'Press dumbbells overhead from shoulder height, core braced.', 'https://www.youtube.com/results?search_query=standing+overhead+dumbbell+press+form', 1),
    (9, 'Dumbbell Lateral Raise', 'Side deltoid isolation', 2, 'weight_reps', 'Raise dumbbells out to sides until parallel to floor. Slight forward lean.', 'https://www.youtube.com/results?search_query=dumbbell+lateral+raise+proper+form', 1),
    (10, 'Barbell Bicep Curl', 'Bicep isolation', 1, 'weight_reps', 'Curl bar up keeping elbows pinned at sides.', 'https://www.youtube.com/results?search_query=barbell+bicep+curl+form', 1),
    (11, 'Rope Triceps Pushdown', 'Tricep cable isolation using rope attachment', 3, 'weight_reps', 'Extend elbows fully and spread rope at the bottom. Keep elbows pinned at sides.', 'https://www.youtube.com/results?search_query=rope+triceps+pushdown+proper+form+tutorial', 1),
    (12, 'Plank Hold', 'Isometric core endurance', 5, 'duration', 'Hold rigid pushup or forearm position without sagging hips.', 'https://www.youtube.com/results?search_query=plank+hold+proper+form', 1),
    (13, 'Machine Chest Press', 'Chest press on machine providing stable path and controlled loading', 4, 'weight_reps', 'Set seat height so handles align with mid-chest. Press smoothly without locking elbows.', 'https://www.youtube.com/results?search_query=machine+chest+press+proper+form+tutorial', 1),
    (14, 'Neutral-Grip Lat Pulldown', 'Vertical pulling movement utilizing neutral grip for joint-friendly lat activation', 3, 'weight_reps', 'Grip neutral handles, pull elbows down toward hips while keeping chest tall.', 'https://www.youtube.com/results?search_query=neutral+grip+lat+pulldown+proper+form+tutorial', 1),
    (15, 'Chest-Supported Row', 'Horizontal row with supported chest eliminating lower back stress', 4, 'weight_reps', 'Keep chest firmly supported on pad. Row elbows back and squeeze shoulder blades.', 'https://www.youtube.com/results?search_query=chest+supported+row+proper+form+tutorial', 1),
    (16, 'Cable Lateral Raise', 'Side deltoid exercise with constant cable resistance profile', 3, 'weight_reps', 'Set cable to wrist height or lowest setting. Raise arm out to side until parallel to floor.', 'https://www.youtube.com/results?search_query=cable+lateral+raise+proper+form+tutorial', 1),
    (17, 'Rope Face Pull', 'Upper back and rear deltoid builder protecting shoulder health', 3, 'weight_reps', 'Attach rope high. Pull towards forehead/eyes and rotate hands back externally.', 'https://www.youtube.com/results?search_query=E3+Rehab+face+pull+exercise+tutorial', 1),
    (18, 'Cable Biceps Curl', 'Constant tension cable curl for bicep hypertrophy', 3, 'weight_reps', 'Maintain upright posture, pin elbows at sides, and curl attachment smoothly upward.', 'https://www.youtube.com/results?search_query=cable+biceps+curl+proper+form+tutorial', 1),
    (19, 'Hack Squat / Leg Press', 'Lower body compound builder focusing on quadriceps and glutes with back support', 4, 'weight_reps', 'Place feet shoulder-width on platform. Lower sled under control until knees reach 90 degrees.', 'https://www.youtube.com/results?search_query=leg+press+hack+squat+proper+form+tutorial', 1),
    (20, 'Supported Bulgarian Split Squat', 'Unilateral quad and glute exercise with stable hand support', 2, 'weight_reps', 'Place rear foot on bench. Use hand on rack for balance if needed. Lower until front thigh is parallel.', 'https://www.youtube.com/results?search_query=supported+Bulgarian+split+squat+proper+form+tutorial', 1),
    (21, 'Hip Thrust', 'Primary glute builder with back elevated against bench', 4, 'weight_reps', 'Rest upper back across bench. Drive through heels to full hip extension, tucking chin.', 'https://www.youtube.com/results?search_query=hip+thrust+proper+form+tutorial+neutral+spine', 1),
    (22, 'Seated Leg Curl', 'Hamstring isolation in stretched hip flexion position', 4, 'weight_reps', 'Lock thigh pad securely. Curl heels back under thighs and control the return.', 'https://www.youtube.com/results?search_query=seated+leg+curl+proper+form+tutorial', 1),
    (23, 'Leg Extension', 'Direct quadriceps isolation movement', 4, 'weight_reps', 'Align knee joints with machine pivot point. Extend legs fully with a 1-second squeeze at top.', 'https://www.youtube.com/results?search_query=leg+extension+proper+form+tutorial', 1),
    (24, 'Standing Calf Raise', 'Gastrocnemius calf isolation through full plantarflexion range', 4, 'weight_reps', 'Lower heels for a deep 2-second calf stretch, then rise onto balls of feet explosively.', 'https://www.youtube.com/results?search_query=calf+raise+proper+form+full+range+tutorial', 1),
    (25, 'Pallof Press', 'Anti-rotation core stability exercise resisting rotational torque', 3, 'weight_reps', 'Hold cable handle at chest level with side-on stance. Press straight out and resist rotation.', 'https://www.youtube.com/results?search_query=E3+Rehab+Pallof+press+tutorial', 1),
    (26, 'Supported Reverse Lunge', 'Joint-friendly unilateral lower body exercise with support', 2, 'weight_reps', 'Step back into a controlled lunge. Lightly support hand on frame for stability.', 'https://www.youtube.com/results?search_query=supported+reverse+lunge+proper+form+tutorial', 1),
    (27, 'Incline Machine Chest Press', 'Upper clavicular chest hypertrophy variation with fixed path', 4, 'weight_reps', 'Adjust seat so handles align with upper chest. Press up smoothly along incline path.', 'https://www.youtube.com/results?search_query=incline+machine+chest+press+proper+form+tutorial', 1),
    (28, 'Single-Arm Landmine Press', 'Angled unilateral shoulder and chest press friendly on shoulder joint', 1, 'weight_reps', 'Hold end of barbell at shoulder. Press upward and forward at natural angle without overarching.', 'https://www.youtube.com/results?search_query=E3+Rehab+single+arm+landmine+press+tutorial', 1),
    (29, 'Pec-Deck Fly', 'Direct chest fly isolation with continuous peak contraction', 4, 'weight_reps', 'Maintain slight elbow bend. Sweep arms together across chest, emphasizing peak contraction.', 'https://www.youtube.com/results?search_query=pec+deck+fly+proper+form+tutorial', 1),
    (30, 'Seated Cable Row', 'Horizontal compound back pull with neutral grip', 3, 'weight_reps', 'Sit tall with knees slightly bent. Pull handle to upper abdomen while keeping chest high.', 'https://www.youtube.com/results?search_query=seated+cable+row+proper+form+neutral+spine+tutorial', 1),
    (31, 'Reverse Pec-Deck', 'Posterior deltoid and upper back isolation', 4, 'weight_reps', 'Face machine pad. Move arms outward and back horizontally, leading with elbows.', 'https://www.youtube.com/results?search_query=reverse+pec+deck+proper+form+rear+delts+tutorial', 1),
    (32, 'Chest-Supported Dumbbell Shrug', 'Upper trapezius builder performed prone on incline bench', 2, 'weight_reps', 'Lie chest-down on incline bench. Shrug shoulders upward towards ears without rolling.', 'https://www.youtube.com/results?search_query=chest+supported+dumbbell+shrug+proper+form+tutorial', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group_id, is_primary) VALUES
    (1, 1, 1),
    (2, 1, 1),
    (3, 6, 1),
    (4, 6, 1),
    (5, 7, 1),
    (6, 2, 1),
    (7, 2, 1),
    (8, 3, 1),
    (9, 3, 1),
    (10, 4, 1),
    (11, 5, 1),
    (12, 10, 1),
    (13, 1, 1),
    (14, 2, 1),
    (15, 2, 1),
    (16, 3, 1),
    (17, 3, 1),
    (18, 4, 1),
    (19, 6, 1),
    (20, 6, 1),
    (21, 8, 1),
    (22, 7, 1),
    (23, 6, 1),
    (24, 9, 1),
    (25, 10, 1),
    (26, 6, 1),
    (27, 1, 1),
    (28, 3, 1),
    (29, 1, 1),
    (30, 2, 1),
    (31, 3, 1),
    (32, 2, 1)`);

  // 6. Cardio activities
  await safeExecute(`INSERT OR IGNORE INTO cardio_activities (id, name, supports_speed, supports_incline, supports_distance, is_active) VALUES
    (1, 'Treadmill Incline Walking', 1, 1, 1, 1),
    (2, 'Stationary Cycling', 1, 0, 1, 1),
    (3, 'Rowing Machine', 1, 0, 1, 1),
    (4, 'Outdoor Running', 1, 0, 1, 1),
    (5, 'Stair Climber', 1, 0, 0, 1)`);

  // 7. Foods (Baseline catalog + Refined Diet Plan foods)
  await safeExecute(`INSERT OR IGNORE INTO foods (id, name, reference_unit_id, reference_quantity, calories, protein_g, carbs_g, fat_g, fiber_g) VALUES
    (1, 'Skinless Chicken Breast (Cooked)', 1, 100, 165, 31.0, 0.0, 3.6, 0.0),
    (2, 'Brown Rice (Cooked)', 1, 100, 111, 2.6, 23.0, 0.9, 1.8),
    (3, 'Rolled Oats (Dry)', 1, 100, 389, 16.9, 66.3, 6.9, 10.6),
    (4, 'Whole Large Egg', 6, 1, 72, 6.3, 0.4, 4.8, 0.0),
    (5, 'Liquid Egg Whites', 1, 100, 52, 10.9, 0.7, 0.2, 0.0),
    (6, 'Whey Protein Isolate Powder', 5, 1, 120, 24.0, 2.0, 1.0, 0.0),
    (7, 'Greek Yogurt 0% Fat', 1, 100, 59, 10.0, 3.6, 0.4, 0.0),
    (8, 'Raw Whole Almonds', 1, 30, 170, 6.0, 6.0, 15.0, 3.5),
    (9, 'Medium Banana', 6, 1, 105, 1.3, 27.0, 0.3, 3.1),
    (10, 'Extra Virgin Olive Oil', 1, 10, 88, 0.0, 0.0, 10.0, 0.0),
    (11, 'Lean Ground Beef 93/7', 1, 100, 152, 21.4, 0.0, 7.3, 0.0),
    (12, 'Sweet Potato (Baked)', 1, 100, 90, 2.0, 20.7, 0.1, 3.3),
    (13, 'Medium French Bread / خبز فرنجي وسط', 6, 1, 140, 4.5, 28.0, 1.0, 1.2),
    (14, 'Oat Bread / خبز شوفان', 6, 1, 120, 4.5, 22.0, 1.5, 3.0),
    (15, 'Boiled Potato / بطاطا مسلوقة', 1, 100, 87, 1.9, 20.1, 0.1, 1.8),
    (16, 'Low Fat White Cheese / جبنة بيضاء قليلة الدسم', 1, 100, 180, 20.0, 2.0, 10.0, 0.0),
    (17, 'Traditional Labneh / لبنة', 1, 100, 110, 9.0, 4.0, 6.0, 0.0),
    (18, 'Smoked Turkey Breast / صدر حبش مدخن', 1, 100, 105, 22.0, 1.5, 1.5, 0.0),
    (19, 'Boiled Pasta / معكرونة مسلوقة', 1, 100, 158, 5.8, 30.9, 0.9, 1.8),
    (20, 'Grilled Chicken Escalope / اسكالوب دجاج مشوي', 1, 100, 170, 26.0, 6.0, 4.0, 0.5),
    (21, 'Grilled Shish Tawook / شيش طاووق مشوي', 1, 100, 150, 25.0, 2.0, 4.5, 0.0),
    (22, 'Lean Beef Steak / ستيك عجل قليل الدهن', 1, 100, 160, 26.0, 0.0, 6.0, 0.0),
    (23, 'Grilled Fish Fillet / سمك فيليه مشوي', 1, 100, 110, 23.0, 0.0, 2.0, 0.0),
    (24, 'Crab Sticks / أصابع كراب', 1, 100, 95, 15.0, 7.0, 0.5, 0.0),
    (25, 'Light Halloumi Cheese / جبنة حلوم لايت', 1, 100, 260, 21.0, 2.0, 19.0, 0.0),
    (26, 'Skim Milk / حليب خالي الدسم', 3, 240, 86, 8.4, 12.2, 0.2, 0.0),
    (27, 'Fresh Fruit Serving / حصة فاكهة طازجة', 5, 1, 80, 1.0, 20.0, 0.3, 3.0),
    (28, 'Fresh Garden Salad / سلطة خضراء', 5, 1, 35, 1.8, 7.0, 0.4, 2.5),
    (29, 'Steamed or Raw Vegetables / خضار مسلوقة أو طازجة', 5, 1, 35, 2.0, 7.0, 0.3, 3.0)`);

  // 8. Users (Admin + Demo User + Tarek + aswadt12)
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const userPasswordHash = await bcrypt.hash('User123!', 10);
  const tarekPasswordHash = await bcrypt.hash('Tarek123!', 10);
  const aswadPasswordHash = await bcrypt.hash('12345678', 10);

  await safeExecute(`INSERT OR IGNORE INTO users (id, role_id, first_name, last_name, email, password_hash, height_cm, timezone, locale, status) VALUES
    (1, 1, 'Platform', 'Administrator', 'admin@fitnessplatform.com', ?, 182.0, 'UTC', 'en', 'active'),
    (2, 3, 'John', 'Doe', 'john.doe@fitnessplatform.com', ?, 180.0, 'UTC', 'en', 'active'),
    (3, 3, 'Tarek', 'Aswad', 'tarek.aswad@fitnessplatform.com', ?, 180.0, 'Asia/Beirut', 'en', 'active'),
    (4, 3, 'Tarek', 'Aswad', 'aswadt12@gmail.com', ?, 180.0, 'Asia/Beirut', 'en', 'active')`,
    [adminPasswordHash, userPasswordHash, tarekPasswordHash, aswadPasswordHash]
  );

  // 9. Workout Plan 1 (Baseline Demo Split for John Doe)
  await safeExecute(`INSERT OR IGNORE INTO workout_plans (id, name, description, goal, status, created_by) VALUES
    (1, '4-Day Hypertrophy Split (Upper / Lower)', 'Progressive overload 4-day split balancing strength and hypertrophy', 'hypertrophy', 'active', 1),
    (2, '4-Day Gym Program (Fat Loss & Muscle Building)', 'Refined 4-day Upper / Lower / Push / Pull split balancing hypertrophy, strength, and fatigue management with stable machine variations.', 'hypertrophy', 'active', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO workout_plan_versions (id, workout_plan_id, version_number, status, change_notes, published_at, created_by) VALUES
    (1, 1, 1, 'published', 'Initial 4-day Upper/Lower version with periodized volume', CURRENT_TIMESTAMP, 1),
    (2, 2, 1, 'published', 'Refined Monday-Thursday schedule with combined leg day, full exercise volume, and form guides.', CURRENT_TIMESTAMP, 1)`);

  // Workout Days for Plan 1 (Days 1-7) & Plan 2 (Days 8-14)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_days (id, workout_plan_version_id, weekday, name, description, is_rest_day, day_order, notes) VALUES
    -- Plan 1 (Upper / Lower Demo)
    (1, 1, 1, 'Upper Body A', 'Baseline upper body strength session', 0, 1, NULL),
    (2, 1, 2, 'Lower Body A', 'Baseline lower body strength session with core duration hold', 0, 2, NULL),
    (3, 1, 3, 'Active Recovery & Rest', 'Rest and active recovery', 1, 3, NULL),
    (4, 1, 4, 'Upper Body B', 'Upper body hypertrophy session', 0, 4, NULL),
    (5, 1, 5, 'Lower Body B', 'Lower body hypertrophy session', 0, 5, NULL),
    (6, 1, 6, 'Weekend Rest Day', 'Weekend rest', 1, 6, NULL),
    (7, 1, 7, 'Weekend Rest Day', 'Weekend rest', 1, 7, NULL),
    -- Plan 2 (Tarek Refined 4-Day Gym Program)
    (8, 2, 1, 'Upper Body', 'Balanced upper-body work with stable positions and controlled loading.', 0, 1, 'Technique note: Keep your chest supported during rows and maintain a neutral neck. Stop if an exercise causes sharp or radiating pain.'),
    (9, 2, 2, 'Combined Leg Day', 'One complete lower-body session combining the strongest elements of Lower A and Lower B.', 0, 2, 'Technique note: Choose either the leg press or hack squat as the main squat pattern. The reverse lunge is optional; skip it if fatigue or recovery becomes excessive. Keep your hips and lower back supported during machine work.'),
    (10, 2, 3, 'Push - Chest, Shoulders, Triceps', 'Chest, shoulders, and triceps using stable pressing variations.', 0, 3, 'Technique note: Keep your head supported and avoid pushing it forward. Replace the landmine press if it aggravates your neck or shoulder.'),
    (11, 2, 4, 'Pull - Back, Rear Delts, Biceps', 'Back, rear shoulders, trapezius, and biceps with stable rowing positions.', 0, 4, 'Technique note: Shrug upward without rolling your shoulders. Keep your neck neutral and use controlled repetitions.'),
    (12, 2, 5, 'Recovery & Walking', 'Active recovery and steady-state movement.', 1, 5, 'Do 30-40 minutes of easy-to-moderate cardio on Friday or Saturday. Consistency matters more than exhausting cardio sessions.'),
    (13, 2, 6, 'Optional Light Cardio / Walking', 'Optional light cardio or walking session.', 1, 6, 'Optional 30-40 minutes easy-to-moderate cardio or walking.'),
    (14, 2, 7, 'Full Rest Day', 'Full rest, nervous system recovery, and sleep prioritization.', 1, 7, 'Use Friday through Sunday to recover. Keep at least one full rest day and prioritize regular sleep.')`);

  // Workout Plan Exercises for Plan 1 (Exercises 1-9)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_exercises (id, workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot, target_sets, target_reps_min, target_reps_max, rest_seconds, notes, is_optional) VALUES
    (1, 1, 1, 1, 'Flat Barbell Bench Press', 'weight_reps', 4, 6, 8, 120, 'Pyramid warm-ups, then 4 heavy working sets.', 0),
    (2, 1, 6, 2, 'Lat Pulldown (Wide Grip)', 'weight_reps', 4, 8, 12, 90, 'Full stretch at the top, squeeze lats.', 0),
    (3, 1, 8, 3, 'Standing Overhead Barbell Press', 'weight_reps', 3, 8, 10, 90, 'Maintain vertical torso, brace glutes.', 0),
    (4, 1, 7, 4, 'Seated Cable Row', 'weight_reps', 3, 8, 12, 90, 'Pull towards belly button.', 0),
    (5, 1, 11, 5, 'Triceps Rope Pushdown', 'weight_reps', 3, 12, 15, 60, 'Keep elbows tight.', 0),
    (6, 2, 3, 1, 'Barbell Back Squat', 'weight_reps', 4, 6, 8, 150, 'Warm up thoroughly. Descend to depth with upright chest.', 0),
    (7, 2, 5, 2, 'Romanian Deadlift (Barbell)', 'weight_reps', 4, 8, 10, 120, 'Feel the hamstring stretch. Keep back straight.', 0),
    (8, 2, 4, 3, 'Leg Press 45°', 'weight_reps', 3, 10, 12, 90, 'Full range of motion, avoid locking knees.', 0),
    (9, 2, 12, 4, 'Plank', 'duration', 3, NULL, NULL, 60, 'Target: 60 seconds hold per set.', 0)`);

  // Workout Plan Exercises for Plan 2 (Exercises 10-37)
  // Day 8 (Mon - Upper Body)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_exercises (id, workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot, target_sets, target_reps_min, target_reps_max, rest_seconds, notes, is_optional) VALUES
    (10, 8, 13, 1, 'Machine Chest Press', 'weight_reps', 3, 8, 12, 120, 'Keep chest supported and maintain neutral neck.', 0),
    (11, 8, 14, 2, 'Neutral-Grip Lat Pulldown', 'weight_reps', 3, 8, 12, 120, 'Full stretch at the top, squeeze lats.', 0),
    (12, 8, 15, 3, 'Chest-Supported Row', 'weight_reps', 3, 8, 12, 120, 'Keep chest firmly supported on bench/pad.', 0),
    (13, 8, 16, 4, 'Cable Lateral Raise', 'weight_reps', 2, 12, 20, 75, 'Raise to shoulder level with controlled tempo.', 0),
    (14, 8, 17, 5, 'Rope Face Pull', 'weight_reps', 2, 12, 15, 75, 'Pull towards forehead, rotating hands back.', 0),
    (15, 8, 11, 6, 'Rope Triceps Pushdown', 'weight_reps', 2, 10, 15, 75, 'Keep elbows tight and spread rope at the bottom.', 0),
    (16, 8, 18, 7, 'Cable Biceps Curl', 'weight_reps', 2, 10, 15, 75, 'Maintain strict elbow position throughout.', 0)`);

  // Day 9 (Tue - Combined Leg Day)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_exercises (id, workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot, target_sets, target_reps_min, target_reps_max, rest_seconds, notes, is_optional) VALUES
    (17, 9, 19, 1, 'Hack Squat / Leg Press', 'weight_reps', 3, 8, 12, 120, 'Main squat pattern: choose either leg press or hack squat.', 0),
    (18, 9, 20, 2, 'Supported Bulgarian Split Squat', 'weight_reps', 2, 8, 10, 90, '8-10 reps per leg. Maintain upright/slight forward torso.', 0),
    (19, 9, 21, 3, 'Hip Thrust', 'weight_reps', 3, 8, 12, 120, 'Drive through heels, pause at top with neutral spine.', 0),
    (20, 9, 22, 4, 'Seated Leg Curl', 'weight_reps', 3, 10, 15, 90, 'Control eccentric phase smoothly on every rep.', 0),
    (21, 9, 23, 5, 'Leg Extension', 'weight_reps', 2, 10, 15, 75, 'Pause briefly at full extension without hyperextending.', 0),
    (22, 9, 24, 6, 'Standing Calf Raise', 'weight_reps', 3, 10, 15, 75, 'Full stretch at bottom, peak squeeze at top.', 0),
    (23, 9, 25, 7, 'Pallof Press', 'weight_reps', 3, 10, 12, 60, '10-12 reps per side. Brace core and resist rotation.', 0),
    (24, 9, 26, 8, 'Supported Reverse Lunge', 'weight_reps', 2, 8, 10, 90, 'Optional movement (8-10 reps/leg). Skip if recovery or fatigue warrants.', 1)`);

  // Day 10 (Wed - Push - Chest, Shoulders, Triceps)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_exercises (id, workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot, target_sets, target_reps_min, target_reps_max, rest_seconds, notes, is_optional) VALUES
    (25, 10, 27, 1, 'Incline Machine Chest Press', 'weight_reps', 3, 8, 12, 120, 'Upper chest focus. Keep shoulders retracted.', 0),
    (26, 10, 13, 2, 'Machine Chest Press', 'weight_reps', 2, 10, 12, 120, 'Flat press variation for mid chest hypertrophy.', 0),
    (27, 10, 28, 3, 'Single-Arm Landmine Press', 'weight_reps', 3, 8, 12, 90, '8-12 reps per arm. Keep head supported, avoid pushing neck forward.', 0),
    (28, 10, 16, 4, 'Cable Lateral Raise', 'weight_reps', 3, 12, 20, 75, 'Side deltoid hypertrophy with continuous tension.', 0),
    (29, 10, 29, 5, 'Pec-Deck Fly', 'weight_reps', 2, 12, 15, 75, 'Deep stretch across pecs, squeeze at center.', 0),
    (30, 10, 11, 6, 'Rope Triceps Pushdown', 'weight_reps', 3, 10, 15, 75, 'Full elbow extension and lockouts.', 0)`);

  // Day 11 (Thu - Pull - Back, Rear Delts, Biceps)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_exercises (id, workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot, target_sets, target_reps_min, target_reps_max, rest_seconds, notes, is_optional) VALUES
    (31, 11, 14, 1, 'Neutral-Grip Lat Pulldown', 'weight_reps', 3, 8, 12, 120, 'Vertical pull targeting lats with joint-friendly grip.', 0),
    (32, 11, 15, 2, 'Chest-Supported Row', 'weight_reps', 3, 8, 12, 120, 'Horizontal compound pull with zero lower back strain.', 0),
    (33, 11, 30, 3, 'Seated Cable Row', 'weight_reps', 2, 10, 12, 90, 'Maintain neutral spine, pull smoothly to lower abdomen.', 0),
    (34, 11, 31, 4, 'Reverse Pec-Deck', 'weight_reps', 3, 12, 15, 75, 'Rear deltoid flyes, leading with elbows.', 0),
    (35, 11, 17, 5, 'Rope Face Pull', 'weight_reps', 2, 12, 15, 75, 'Upper back and external rotator cuff focus.', 0),
    (36, 11, 32, 6, 'Chest-Supported Dumbbell Shrug', 'weight_reps', 2, 10, 15, 75, 'Shrug upward without rolling shoulders. Keep neck neutral.', 0),
    (37, 11, 18, 7, 'Cable Biceps Curl', 'weight_reps', 3, 10, 15, 75, 'Controlled tempo bicep builder with peak squeeze.', 0)`);

  // Workout Plan Exercise Sets for Plan 2
  const setRows: string[] = [];
  let setId = 1;
  const exercisesConfig = [
    // Plan 2 Day 8 (exId 10..16)
    { exId: 10, sets: 3, rMin: 8, rMax: 12, rest: 120 },
    { exId: 11, sets: 3, rMin: 8, rMax: 12, rest: 120 },
    { exId: 12, sets: 3, rMin: 8, rMax: 12, rest: 120 },
    { exId: 13, sets: 2, rMin: 12, rMax: 20, rest: 75 },
    { exId: 14, sets: 2, rMin: 12, rMax: 15, rest: 75 },
    { exId: 15, sets: 2, rMin: 10, rMax: 15, rest: 75 },
    { exId: 16, sets: 2, rMin: 10, rMax: 15, rest: 75 },
    // Plan 2 Day 9 (exId 17..24)
    { exId: 17, sets: 3, rMin: 8, rMax: 12, rest: 120 },
    { exId: 18, sets: 2, rMin: 8, rMax: 10, rest: 90 },
    { exId: 19, sets: 3, rMin: 8, rMax: 12, rest: 120 },
    { exId: 20, sets: 3, rMin: 10, rMax: 15, rest: 90 },
    { exId: 21, sets: 2, rMin: 10, rMax: 15, rest: 75 },
    { exId: 22, sets: 3, rMin: 10, rMax: 15, rest: 75 },
    { exId: 23, sets: 3, rMin: 10, rMax: 12, rest: 60 },
    { exId: 24, sets: 2, rMin: 8, rMax: 10, rest: 90 },
    // Plan 2 Day 10 (exId 25..30)
    { exId: 25, sets: 3, rMin: 8, rMax: 12, rest: 120 },
    { exId: 26, sets: 2, rMin: 10, rMax: 12, rest: 120 },
    { exId: 27, sets: 3, rMin: 8, rMax: 12, rest: 90 },
    { exId: 28, sets: 3, rMin: 12, rMax: 20, rest: 75 },
    { exId: 29, sets: 2, rMin: 12, rMax: 15, rest: 75 },
    { exId: 30, sets: 3, rMin: 10, rMax: 15, rest: 75 },
    // Plan 2 Day 11 (exId 31..37)
    { exId: 31, sets: 3, rMin: 8, rMax: 12, rest: 120 },
    { exId: 32, sets: 3, rMin: 8, rMax: 12, rest: 120 },
    { exId: 33, sets: 2, rMin: 10, rMax: 12, rest: 90 },
    { exId: 34, sets: 3, rMin: 12, rMax: 15, rest: 75 },
    { exId: 35, sets: 2, rMin: 12, rMax: 15, rest: 75 },
    { exId: 36, sets: 2, rMin: 10, rMax: 15, rest: 75 },
    { exId: 37, sets: 3, rMin: 10, rMax: 15, rest: 75 },
  ];

  for (const cfg of exercisesConfig) {
    for (let s = 1; s <= cfg.sets; s++) {
      setRows.push(`(${setId++}, ${cfg.exId}, ${s}, ${cfg.rMin}, ${cfg.rMax}, NULL, NULL, NULL, ${cfg.rest}, NULL)`);
    }
  }

  await safeExecute(`INSERT OR IGNORE INTO workout_plan_exercise_sets 
    (id, workout_plan_exercise_id, set_number, target_reps_min, target_reps_max, target_weight_kg, target_duration_seconds, target_distance_meters, rest_seconds, notes) VALUES
    ${setRows.join(',\n    ')}`);

  // 10. Diet Plans: Plan 1 (Demo Bulk) & Plan 2 (Tarek Refined Diet Plan)
  await safeExecute(`INSERT OR IGNORE INTO diet_plans (id, name, description, status, created_by) VALUES
    (1, '2,200 kcal Clean Lean Bulk & Recomposition', 'High-protein nutritional protocol with configurable options', 'active', 1),
    (2, 'Tarek Refined Diet Plan (خطة الغذاء المنقحة)', 'High-protein nutritional protocol designed by nutritionist Farah El-Moubader. Features 7 timed meals with balanced carbohydrate choices, lean protein sources, and strict portion controls.', 'active', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO diet_plan_versions (id, diet_plan_id, version_number, status, daily_calorie_target, daily_protein_target_g, daily_carbs_target_g, daily_fat_target_g, change_notes, published_at, created_by) VALUES
    (1, 1, 1, 'published', 2200, 180.0, 220.0, 65.0, 'Initial balanced 4-meal plan with flexible protein and carb choices', CURRENT_TIMESTAMP, 1),
    (2, 2, 1, 'published', 2050, 200.0, 185.0, 45.0, 'Refined 7-meal protocol with standardized lean protein substitutes and adjusted halloumi portions.', CURRENT_TIMESTAMP, 1)`);

  // Meals for Plan 1 (Meals 1-4) & Plan 2 (Meals 5-11)
  await safeExecute(`INSERT OR IGNORE INTO diet_meals (id, diet_plan_version_id, name, meal_order, scheduled_time, default_grace_minutes, description, is_required) VALUES
    -- Plan 1 (4 Meals)
    (1, 1, 'Breakfast', 1, '08:00:00', 60, NULL, 1),
    (2, 1, 'Lunch', 2, '12:30:00', 60, NULL, 1),
    (3, 1, 'Pre-Workout Snack', 3, '16:00:00', 60, NULL, 1),
    (4, 1, 'Dinner', 4, '19:30:00', 60, NULL, 1),
    -- Plan 2 (7 Timed Meals)
    (5, 2, 'الفطور - 7:30 (Breakfast 1)', 1, '07:30:00', 60, 'تناول كوبين من المياه بعد الاستيقاظ بنصف ساعة إلى ساعة. اختر خياراً واحداً للنشويات وخياراً واحداً للبروتين. قهوة بدون سكر.', 1),
    (6, 2, 'الفطور - 10:00 (Breakfast 2)', 2, '10:00:00', 60, 'نفس خيارات فطور 7:30 ونفس الكميات. اختر بديلاً واحداً من النشويات وبديلاً واحداً من البروتين.', 1),
    (7, 2, 'الغداء - 12:00 (Lunch)', 3, '12:00:00', 60, 'اختر مصدراً واحداً للنشويات (100غ) ومصدراً واحداً للبروتين (150غ) مع سلطة خس وبندورة وخيار بدون صلصات دسمة.', 1),
    (8, 2, 'سناك - 3:00 (Afternoon Snack 1)', 4, '15:00:00', 60, 'كوب حليب خالي الدسم أو 1/2 كوب لبن يوناني + حصة فاكهة + 2 ملعقة طعام شوفان.', 1),
    (9, 2, 'سناك - 5:00 (Pre-Workout Snack)', 5, '17:00:00', 60, 'حصة فاكهة كمصدر بسيط للطاقة قبل التمرين.', 1),
    (10, 2, 'العشاء - 7:00 (Dinner 1)', 6, '19:00:00', 60, 'اختر مصدراً واحداً للنشويات ومصدراً واحداً للبروتين مع خضار نيئة أو مطبوخة حسب الرغبة.', 1),
    (11, 2, 'العشاء - 10:00 (Dinner 2)', 7, '22:00:00', 60, 'بروتين خفيف بدون نشويات مع خضار قبل النوم.', 1)`);

  // Option Groups: Plan 1 (Groups 1-4) & Plan 2 (Groups 5-20)
  await safeExecute(`INSERT OR IGNORE INTO diet_meal_option_groups (id, diet_meal_id, name, group_order, min_selection_count, max_selection_count, is_required, notes) VALUES
    -- Plan 1 Groups
    (1, 1, 'Protein Source', 1, 1, 1, 1, NULL),
    (2, 1, 'Carbohydrate Source', 2, 1, 1, 1, NULL),
    (3, 2, 'Main Lean Protein', 1, 1, 1, 1, NULL),
    (4, 2, 'Starch / Grain Base', 2, 1, 1, 1, NULL),
    -- Plan 2 Groups
    -- Meal 5: Breakfast 1 (07:30)
    (5, 5, 'Carbohydrate Source / مصدر النشويات', 1, 1, 1, 1, 'اختر بديلاً واحداً فقط'),
    (6, 5, 'Protein Source / مصدر البروتين', 2, 1, 1, 1, 'اختر بديلاً واحداً فقط (أولوية للبيض أو الحبش في أيام التمرين)'),
    -- Meal 6: Breakfast 2 (10:00)
    (7, 6, 'Carbohydrate Source / مصدر النشويات', 1, 1, 1, 1, 'اختر بديلاً واحداً فقط'),
    (8, 6, 'Protein Source / مصدر البروتين', 2, 1, 1, 1, 'اختر بديلاً واحداً فقط'),
    -- Meal 7: Lunch (12:00)
    (9, 7, 'Carbohydrate Base / النشويات (100غ)', 1, 1, 1, 1, 'اختر 100غ من الرز أو البطاطا أو المعكرونة المسلوقة'),
    (10, 7, 'Lean Protein / بروتين قليل الدهن (150غ)', 2, 1, 1, 1, 'اختر 150غ من البروتين الصافي المشوي أو المسلوق'),
    (11, 7, 'Fresh Salad / سلطة طازجة', 3, 0, 1, 0, 'سلطة خس وبندورة وخيار بدون صلصات دسمة'),
    -- Meal 8: Snack 1 (15:00)
    (12, 8, 'Dairy Base / الحليب أو اللبن', 1, 1, 1, 1, 'كوب حليب خالي الدسم أو نصف كوب لبن يوناني'),
    (13, 8, 'Fruit Portion / حصة فاكهة', 2, 1, 1, 1, 'حصة فاكهة طازجة'),
    (14, 8, 'Oats / شوفان', 3, 1, 1, 1, '2 ملعقة طعام شوفان (20غ)'),
    -- Meal 9: Snack 2 (17:00)
    (15, 9, 'Pre-Workout Fruit / فاكهة قبل التمرين', 1, 1, 1, 1, 'حصة فاكهة كمصدر سريع للطاقة قبل التمرين'),
    -- Meal 10: Dinner 1 (19:00)
    (16, 10, 'Carbohydrate Base / النشويات (100غ)', 1, 1, 1, 1, 'اختر 100غ مسلوق'),
    (17, 10, 'Protein Source / مصدر البروتين (150غ)', 2, 1, 1, 1, '150غ بروتين أو 60-80غ جبنة حلوم'),
    (18, 10, 'Vegetables / خضار', 3, 0, 1, 0, 'خضار نيئة أو مطبوخة حسب الرغبة'),
    -- Meal 11: Dinner 2 (22:00)
    (19, 11, 'Late Protein Source / بروتين مسائي (150غ)', 1, 1, 1, 1, '150غ بروتين أو 60-80غ جبنة حلوم بدون نشويات'),
    (20, 11, 'Vegetables / خضار', 2, 0, 1, 0, 'خضار نيئة أو مطبوخة حسب الرغبة')`);

  // Option Choices: Plan 1 (Options 1-8) & Plan 2 (Options 9-53)
  await safeExecute(`INSERT OR IGNORE INTO diet_meal_options 
    (id, diet_meal_option_group_id, food_id, option_order, label, quantity, unit_id, calories_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot, is_active) VALUES
    -- Plan 1 Options
    (1, 1, 4, 1, '3 Whole Large Eggs', 3, 6, 216, 18.9, 1.2, 14.4, 1),
    (2, 1, 5, 2, '250g Liquid Egg Whites + 1 Whole Egg', 1, 1, 202, 33.5, 2.1, 5.3, 1),
    (3, 2, 3, 1, '80g Rolled Oats', 80, 1, 311, 13.5, 53.0, 5.5, 1),
    (4, 2, 9, 2, '2 Medium Bananas', 2, 6, 210, 2.6, 54.0, 0.6, 1),
    (5, 3, 1, 1, '180g Grilled Chicken Breast', 180, 1, 297, 55.8, 0.0, 6.5, 1),
    (6, 3, 11, 2, '180g Lean Ground Beef (93/7)', 180, 1, 274, 38.5, 0.0, 13.1, 1),
    (7, 4, 2, 1, '200g Cooked Brown Rice', 200, 1, 222, 5.2, 46.0, 1.8, 1),
    (8, 4, 12, 2, '250g Baked Sweet Potato', 250, 1, 225, 5.0, 51.7, 0.2, 1),

    -- Plan 2 Options (Tarek Refined Plan)
    -- Meal 5 (07:30) Carbs
    (9, 5, 13, 1, '1 Medium French Bread (1 خبز فرنجي وسط بلا سمسم)', 1, 6, 140, 4.5, 28.0, 1.0, 1),
    (10, 5, 14, 2, '1 Oat Bread (1 خبز شوفان)', 1, 6, 120, 4.5, 22.0, 1.5, 1),
    (11, 5, 15, 3, '1 Boiled Potato 50g (1 حبة بطاطا مسلوقة 50غ)', 50, 1, 44, 1.0, 10.0, 0.1, 1),
    -- Meal 5 (07:30) Protein
    (12, 6, 4, 1, '2 Whole Eggs + 3 Egg Whites (2 بيضة كاملة + 3 بياض البيض)', 1, 5, 196, 23.5, 1.4, 9.8, 1),
    (13, 6, 16, 2, '60g Low Fat White Cheese (60غ جبنة بيضاء)', 60, 1, 108, 12.0, 1.2, 6.0, 1),
    (14, 6, 17, 3, '4 Tbsp Labneh (4 ملاعق طعام لبنة)', 60, 1, 66, 5.4, 2.4, 3.6, 1),
    (15, 6, 18, 4, '60g Smoked Turkey Breast (60غ حبش مدخن)', 60, 1, 63, 13.2, 0.9, 0.9, 1),

    -- Meal 6 (10:00) Carbs
    (16, 7, 13, 1, '1 Medium French Bread (1 خبز فرنجي وسط بلا سمسم)', 1, 6, 140, 4.5, 28.0, 1.0, 1),
    (17, 7, 14, 2, '1 Oat Bread (1 خبز شوفان)', 1, 6, 120, 4.5, 22.0, 1.5, 1),
    (18, 7, 15, 3, '1 Boiled Potato 50g (1 حبة بطاطا مسلوقة 50غ)', 50, 1, 44, 1.0, 10.0, 0.1, 1),
    -- Meal 6 (10:00) Protein
    (19, 8, 4, 1, '2 Whole Eggs + 3 Egg Whites (2 بيضة كاملة + 3 بياض البيض)', 1, 5, 196, 23.5, 1.4, 9.8, 1),
    (20, 8, 16, 2, '60g Low Fat White Cheese (60غ جبنة بيضاء)', 60, 1, 108, 12.0, 1.2, 6.0, 1),
    (21, 8, 17, 3, '4 Tbsp Labneh (4 ملاعق طعام لبنة)', 60, 1, 66, 5.4, 2.4, 3.6, 1),
    (22, 8, 18, 4, '60g Smoked Turkey Breast (60غ حبش مدخن)', 60, 1, 63, 13.2, 0.9, 0.9, 1),

    -- Meal 7 (12:00) Carbs (100g)
    (23, 9, 2, 1, '100g Boiled Rice (100غ رز مسلوق)', 100, 1, 130, 2.7, 28.2, 0.3, 1),
    (24, 9, 15, 2, '100g Boiled Potato (100غ بطاطا مسلوقة)', 100, 1, 87, 1.9, 20.1, 0.1, 1),
    (25, 9, 19, 3, '100g Boiled Pasta (100غ معكرونة مسلوقة)', 100, 1, 158, 5.8, 30.9, 0.9, 1),
    -- Meal 7 (12:00) Protein (150g)
    (26, 10, 1, 1, '150g Grilled Skinless Chicken Breast (150غ صدر دجاج مشوي)', 150, 1, 248, 46.5, 0.0, 5.4, 1),
    (27, 10, 20, 2, '150g Grilled Chicken Escalope (150غ اسكالوب دجاج مشوي)', 150, 1, 255, 39.0, 9.0, 6.0, 1),
    (28, 10, 21, 3, '150g Grilled Shish Tawook (150غ شيش طاووق مشوي)', 150, 1, 225, 37.5, 3.0, 6.8, 1),
    (29, 10, 22, 4, '150g Lean Beef Steak (150غ ستايك عجل بدون دهن)', 150, 1, 240, 39.0, 0.0, 9.0, 1),
    (30, 10, 23, 5, '150g Grilled Fish Fillet (150غ سمك فيليه مشوي)', 150, 1, 165, 34.5, 0.0, 3.0, 1),
    -- Meal 7 (12:00) Salad
    (31, 11, 28, 1, 'Fresh Garden Salad: Lettuce, Tomato, Cucumber (سلطة خضراء طازجة)', 1, 5, 35, 1.8, 7.0, 0.4, 1),

    -- Meal 8 (15:00) Dairy
    (32, 12, 26, 1, '1 Cup Skim Milk (1 كوب حليب خالي الدسم)', 240, 3, 86, 8.4, 12.2, 0.2, 1),
    (33, 12, 7, 2, '1/2 Cup Greek Yogurt 0% Fat (1/2 كوب لبن يوناني خالي الدسم)', 120, 1, 71, 12.0, 4.3, 0.5, 1),
    -- Meal 8 (15:00) Fruit
    (34, 13, 27, 1, '1 Serving Fresh Fruit (1 حصة فاكهة طازجة)', 1, 5, 80, 1.0, 20.0, 0.3, 1),
    -- Meal 8 (15:00) Oats
    (35, 14, 3, 1, '2 Tbsp Rolled Oats (2 ملعقة طعام شوفان - 20غ)', 20, 1, 78, 3.4, 13.3, 1.4, 1),

    -- Meal 9 (17:00) Pre-workout Fruit
    (36, 15, 27, 1, '1 Serving Fruit: Banana or Apple (1 حصة فاكهة: موزة أو تفاح)', 1, 5, 95, 1.2, 24.0, 0.3, 1),

    -- Meal 10 (19:00) Carbs (100g)
    (37, 16, 2, 1, '100g Boiled Rice (100غ رز مسلوق)', 100, 1, 130, 2.7, 28.2, 0.3, 1),
    (38, 16, 15, 2, '100g Boiled Potato (100غ بطاطا مسلوقة)', 100, 1, 87, 1.9, 20.1, 0.1, 1),
    (39, 16, 19, 3, '100g Boiled Pasta (100غ معكرونة مسلوقة)', 100, 1, 158, 5.8, 30.9, 0.9, 1),
    -- Meal 10 (19:00) Protein (150g)
    (40, 17, 18, 1, '150g Turkey Breast (150غ صدر حبش)', 150, 1, 158, 33.0, 2.3, 2.3, 1),
    (41, 17, 24, 2, '150g Crab Sticks (150غ أصابع كراب)', 150, 1, 143, 22.5, 10.5, 0.8, 1),
    (42, 17, 1, 3, '150g Skinless Chicken Breast (150غ صدر دجاج بدون جلد)', 150, 1, 248, 46.5, 0.0, 5.4, 1),
    (43, 17, 11, 4, '150g Lean Beef (150غ لحمة بدون دهن)', 150, 1, 228, 32.1, 0.0, 11.0, 1),
    (44, 17, 21, 5, '150g Shish Tawook (150غ شيش طاووق)', 150, 1, 225, 37.5, 3.0, 6.8, 1),
    (45, 17, 25, 6, '70g Light Halloumi Cheese (70غ جبنة حلوم لايت)', 70, 1, 182, 14.7, 1.4, 13.3, 1),
    -- Meal 10 (19:00) Veggies
    (46, 18, 29, 1, 'Raw or Steamed Vegetables (خضار نيئة أو مطبوخة حسب الرغبة)', 1, 5, 35, 2.0, 7.0, 0.3, 1),

    -- Meal 11 (22:00) Late Protein (150g)
    (47, 19, 18, 1, '150g Turkey Breast (150غ صدر حبش)', 150, 1, 158, 33.0, 2.3, 2.3, 1),
    (48, 19, 24, 2, '150g Crab Sticks (150غ أصابع كراب)', 150, 1, 143, 22.5, 10.5, 0.8, 1),
    (49, 19, 1, 3, '150g Skinless Chicken Breast (150غ صدر دجاج بدون جلد)', 150, 1, 248, 46.5, 0.0, 5.4, 1),
    (50, 19, 11, 4, '150g Lean Beef (150غ لحمة بدون دهن)', 150, 1, 228, 32.1, 0.0, 11.0, 1),
    (51, 19, 21, 5, '150g Shish Tawook (150غ شيش طاووق)', 150, 1, 225, 37.5, 3.0, 6.8, 1),
    (52, 19, 25, 6, '70g Light Halloumi Cheese (70غ جبنة حلوم لايت)', 70, 1, 182, 14.7, 1.4, 13.3, 1),
    -- Meal 11 (22:00) Veggies
    (53, 20, 29, 1, 'Raw or Steamed Vegetables (خضار نيئة أو مطبوخة حسب الرغبة)', 1, 5, 35, 2.0, 7.0, 0.3, 1)`);

  // 11. User Assignments for John Doe (User 2)
  await safeExecute(`INSERT OR IGNORE INTO user_workout_assignments (id, user_id, workout_plan_version_id, effective_from, status, assigned_by) VALUES
    (1, 2, 1, '2026-01-01', 'active', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO user_diet_assignments (id, user_id, diet_plan_version_id, effective_from, status, assigned_by) VALUES
    (1, 2, 1, '2026-01-01', 'active', 1)`);

  // 12. User Weight Goal & Water/Cardio Targets
  await safeExecute(`INSERT OR IGNORE INTO user_weight_goals (id, user_id, starting_weight_kg, target_weight_kg, start_date, target_date, status) VALUES
    (1, 2, 92.5, 82.0, '2026-01-01', '2026-12-31', 'active')`);

  await safeExecute(`INSERT OR IGNORE INTO user_water_targets (id, user_id, target_ml, effective_from, status) VALUES
    (1, 2, 3000, '2026-01-01', 'active')`);

  await safeExecute(`INSERT OR IGNORE INTO user_water_quick_add_options (id, user_id, amount_ml, display_order, is_active) VALUES
    (1, 2, 250, 1, 1),
    (2, 2, 500, 2, 1),
    (3, 2, 750, 3, 1),
    (4, 2, 1000, 4, 1)`);

  await safeExecute(`INSERT OR IGNORE INTO user_cardio_targets (id, user_id, cardio_activity_id, target_minutes_min, target_minutes_max, effective_from, status) VALUES
    (1, 2, 2, 25, 35, '2026-01-01', 'active')`);

  await safeExecute(`INSERT OR IGNORE INTO user_cardio_target_days (user_cardio_target_id, weekday) VALUES
    (1, 1),
    (1, 3),
    (1, 5)`);

  // 13. User Adherence Config & Notification Settings
  await safeExecute(`INSERT OR IGNORE INTO user_adherence_configs (id, user_id, diet_weight_pct, workout_weight_pct, cardio_weight_pct, water_weight_pct, weight_logging_weight_pct, effective_from, is_active) VALUES
    (1, 2, 35.0, 25.0, 15.0, 15.0, 10.0, '2026-01-01', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled) VALUES
    (2, 1, 1, 1)`);

  // 14. User Assignments for Tarek (User 3) & aswadt12 (User 4) -> Assigned Refined Plan 2
  await safeExecute(`INSERT OR IGNORE INTO user_workout_assignments (id, user_id, workout_plan_version_id, effective_from, status, assigned_by) VALUES
    (2, 3, 2, '2026-01-01', 'active', 1),
    (3, 4, 2, '2026-01-01', 'active', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO user_diet_assignments (id, user_id, diet_plan_version_id, effective_from, status, assigned_by) VALUES
    (2, 3, 2, '2026-01-01', 'active', 1),
    (3, 4, 2, '2026-01-01', 'active', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO user_weight_goals (id, user_id, starting_weight_kg, target_weight_kg, start_date, target_date, status) VALUES
    (2, 3, 105.2, 86.3, '2026-01-01', '2026-12-31', 'active'),
    (3, 4, 105.2, 86.3, '2026-01-01', '2026-12-31', 'active')`);

  await safeExecute(`INSERT OR IGNORE INTO user_water_targets (id, user_id, target_ml, effective_from, status) VALUES
    (2, 3, 3500, '2026-01-01', 'active'),
    (3, 4, 3500, '2026-01-01', 'active')`);

  await safeExecute(`INSERT OR IGNORE INTO user_water_quick_add_options (id, user_id, amount_ml, display_order, is_active) VALUES
    (5, 3, 250, 1, 1),
    (6, 3, 500, 2, 1),
    (7, 3, 750, 3, 1),
    (8, 3, 1000, 4, 1),
    (9, 4, 250, 1, 1),
    (10, 4, 500, 2, 1),
    (11, 4, 750, 3, 1),
    (12, 4, 1000, 4, 1)`);

  await safeExecute(`INSERT OR IGNORE INTO user_cardio_targets (id, user_id, cardio_activity_id, target_minutes_min, target_minutes_max, effective_from, status) VALUES
    (2, 3, 2, 30, 40, '2026-01-01', 'active'),
    (3, 4, 2, 30, 40, '2026-01-01', 'active')`);

  await safeExecute(`INSERT OR IGNORE INTO user_cardio_target_days (user_cardio_target_id, weekday) VALUES
    (2, 5), (2, 6),
    (3, 5), (3, 6)`);

  await safeExecute(`INSERT OR IGNORE INTO user_adherence_configs (id, user_id, diet_weight_pct, workout_weight_pct, cardio_weight_pct, water_weight_pct, weight_logging_weight_pct, effective_from, is_active) VALUES
    (2, 3, 35.0, 25.0, 15.0, 15.0, 10.0, '2026-01-01', 1),
    (3, 4, 35.0, 25.0, 15.0, 15.0, 10.0, '2026-01-01', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO user_notification_settings (user_id, in_app_enabled, push_enabled, local_notifications_enabled) VALUES
    (3, 1, 1, 1),
    (4, 1, 1, 1)`);

  // 15. Reminder Rules
  await safeExecute(`INSERT OR IGNORE INTO reminder_rules (id, name, category, rule_scope, trigger_mode, fixed_time, is_active) VALUES
    (1, 'Morning Weight Log', 'weight', 'user', 'fixed_time', '08:00:00', 1),
    (2, 'Hydration Reminder', 'water', 'user', 'interval', NULL, 1),
    (3, 'Workout Time', 'workout', 'user', 'fixed_time', '17:00:00', 1)`);

  logger.info('Database successfully seeded with comprehensive default and demo entities.');
}

if (process.argv[1]?.includes('seed')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
