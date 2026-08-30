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

  const safeExecute = (sql: string, params?: any[]) => {
    const dialectSql = toDialectInsertOrIgnore(sql, targetClient);
    return db.execute(dialectSql, params);
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

  // 5. Exercises
  await safeExecute(`INSERT OR IGNORE INTO exercises (id, name, description, equipment_type_id, tracking_type, instructions, is_active) VALUES
    (1, 'Barbell Bench Press', 'Compound horizontal chest press', 1, 'weight_reps', 'Lower bar to mid-chest, drive feet into floor, press up without flaring elbows.', 1),
    (2, 'Incline Dumbbell Press', 'Upper chest hypertrophy movement', 2, 'weight_reps', 'Set bench to 30 degrees. Press dumbbells up in a slight arc.', 1),
    (3, 'Barbell Back Squat', 'Fundamental compound lower body exercise', 1, 'weight_reps', 'Descend until hip crease is below top of knees. Maintain neutral spine.', 1),
    (4, 'Leg Press 45°', 'Quad-dominant machine press', 4, 'weight_reps', 'Place feet shoulder-width on platform. Lower sled under control.', 1),
    (5, 'Romanian Deadlift (RDL)', 'Posterior chain builder targeting hamstrings and glutes', 1, 'weight_reps', 'Hinge at the hips with slight knee bend, lowering barbell along shins.', 1),
    (6, 'Lat Pulldown (Wide Grip)', 'Vertical back pulling exercise', 3, 'weight_reps', 'Pull bar smoothly to upper chest, retracting shoulder blades.', 1),
    (7, 'Barbell Bent-Over Row', 'Horizontal compound back pull', 1, 'weight_reps', 'Hinge torso to 45 degrees, row bar to lower ribcage.', 1),
    (8, 'Standing Overhead Dumbbell Press', 'Deltoid vertical pressing movement', 2, 'weight_reps', 'Press dumbbells overhead from shoulder height, core braced.', 1),
    (9, 'Dumbbell Lateral Raise', 'Side deltoid isolation', 2, 'weight_reps', 'Raise dumbbells out to sides until parallel to floor. Slight forward lean.', 1),
    (10, 'Barbell Bicep Curl', 'Bicep isolation', 1, 'weight_reps', 'Curl bar up keeping elbows pinned at sides.', 1),
    (11, 'Tricep Cable Rope Pushdown', 'Tricep isolation', 3, 'weight_reps', 'Extend elbows fully and spread rope at the bottom.', 1),
    (12, 'Plank Hold', 'Isometric core endurance', 5, 'duration', 'Hold rigid pushup or forearm position without sagging hips.', 1)`);

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
    (12, 10, 1)`);

  // 6. Cardio activities
  await safeExecute(`INSERT OR IGNORE INTO cardio_activities (id, name, supports_speed, supports_incline, supports_distance, is_active) VALUES
    (1, 'Treadmill Incline Walking', 1, 1, 1, 1),
    (2, 'Stationary Cycling', 1, 0, 1, 1),
    (3, 'Rowing Machine', 1, 0, 1, 1),
    (4, 'Outdoor Running', 1, 0, 1, 1),
    (5, 'Stair Climber', 1, 0, 0, 1)`);

  // 7. Foods
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
    (12, 'Sweet Potato (Baked)', 1, 100, 90, 2.0, 20.7, 0.1, 3.3)`);

  // 8. Users (Admin + Demo User)
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const userPasswordHash = await bcrypt.hash('User123!', 10);

  await safeExecute(`INSERT OR IGNORE INTO users (id, role_id, first_name, last_name, email, password_hash, height_cm, timezone, locale, status) VALUES
    (1, 1, 'Platform', 'Administrator', 'admin@fitnessplatform.com', ?, 182.0, 'UTC', 'en', 'active'),
    (2, 3, 'John', 'Doe', 'john.doe@fitnessplatform.com', ?, 180.0, 'UTC', 'en', 'active')`,
    [adminPasswordHash, userPasswordHash]
  );

  // 9. Workout Plan & Version 1
  await safeExecute(`INSERT OR IGNORE INTO workout_plans (id, name, description, goal, status, created_by) VALUES
    (1, '4-Day Hypertrophy Split (Upper / Lower)', 'Progressive overload 4-day split balancing strength and hypertrophy', 'hypertrophy', 'active', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO workout_plan_versions (id, workout_plan_id, version_number, status, change_notes, published_at, created_by) VALUES
    (1, 1, 1, 'published', 'Initial 4-day Upper/Lower version with periodized volume', CURRENT_TIMESTAMP, 1)`);

  // Workout Days (Mon: 1, Tue: 2, Wed: 3 Rest, Thu: 4, Fri: 5, Sat: 6 Rest, Sun: 7 Rest)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_days (id, workout_plan_version_id, weekday, name, is_rest_day, day_order) VALUES
    (1, 1, 1, 'Upper Body A', 0, 1),
    (2, 1, 2, 'Lower Body A', 0, 2),
    (3, 1, 3, 'Active Recovery & Rest', 1, 3),
    (4, 1, 4, 'Upper Body B', 0, 4),
    (5, 1, 5, 'Lower Body B', 0, 5),
    (6, 1, 6, 'Weekend Rest Day', 1, 6),
    (7, 1, 7, 'Weekend Rest Day', 1, 7)`);

  // Workout Plan Exercises for Day 1 (Upper Body A)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_exercises (id, workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot, target_sets, target_reps_min, target_reps_max, rir_target, rest_seconds, notes) VALUES
    (1, 1, 1, 1, 'Flat Barbell Bench Press', 'weight_reps', 4, 6, 8, 2, 120, 'Pyramid warm-ups, then 4 heavy working sets.'),
    (2, 1, 6, 2, 'Lat Pulldown (Wide Grip)', 'weight_reps', 4, 8, 12, 2, 90, 'Full stretch at the top, squeeze lats.'),
    (3, 1, 8, 3, 'Standing Overhead Barbell Press', 'weight_reps', 3, 8, 10, 1, 90, 'Maintain vertical torso, brace glutes.'),
    (4, 1, 7, 4, 'Seated Cable Row', 'weight_reps', 3, 8, 12, 2, 90, 'Pull towards belly button.'),
    (5, 1, 11, 5, 'Triceps Rope Pushdown', 'weight_reps', 3, 12, 15, 1, 60, 'Keep elbows tight.')`);

  // Workout Plan Exercises for Day 2 (Lower Body A)
  await safeExecute(`INSERT OR IGNORE INTO workout_plan_exercises (id, workout_plan_day_id, exercise_id, exercise_order, exercise_name_snapshot, tracking_type_snapshot, target_sets, target_reps_min, target_reps_max, rir_target, rest_seconds, notes) VALUES
    (6, 2, 3, 1, 'Barbell Back Squat', 'weight_reps', 4, 6, 8, 2, 150, 'Warm up thoroughly. Descend to depth with upright chest.'),
    (7, 2, 5, 2, 'Romanian Deadlift (Barbell)', 'weight_reps', 4, 8, 10, 2, 120, 'Feel the hamstring stretch. Keep back straight.'),
    (8, 2, 4, 3, 'Leg Press 45°', 'weight_reps', 3, 10, 12, 1, 90, 'Full range of motion, avoid locking knees.'),
    (9, 2, 12, 4, 'Plank', 'duration', 3, NULL, NULL, 0, 60, 'Target: 60 seconds hold per set.')`);

  // 10. Diet Plan & Version 1
  await safeExecute(`INSERT OR IGNORE INTO diet_plans (id, name, description, status, created_by) VALUES
    (1, '2,200 kcal Clean Lean Bulk & Recomposition', 'High-protein nutritional protocol with configurable options', 'active', 1)`);

  await safeExecute(`INSERT OR IGNORE INTO diet_plan_versions (id, diet_plan_id, version_number, status, daily_calorie_target, daily_protein_target_g, daily_carbs_target_g, daily_fat_target_g, change_notes, published_at, created_by) VALUES
    (1, 1, 1, 'published', 2200, 180.0, 220.0, 65.0, 'Initial balanced 4-meal plan with flexible protein and carb choices', CURRENT_TIMESTAMP, 1)`);

  // Meals
  await safeExecute(`INSERT OR IGNORE INTO diet_meals (id, diet_plan_version_id, name, scheduled_time, meal_order) VALUES
    (1, 1, 'Breakfast', '08:00:00', 1),
    (2, 1, 'Lunch', '12:30:00', 2),
    (3, 1, 'Pre-Workout Snack', '16:00:00', 3),
    (4, 1, 'Dinner', '19:30:00', 4)`);

  // Option Groups & Choices for Breakfast (Meal 1)
  await safeExecute(`INSERT OR IGNORE INTO diet_meal_option_groups (id, diet_meal_id, name, is_required, min_selection_count, max_selection_count, group_order) VALUES
    (1, 1, 'Protein Source', 1, 1, 1, 1),
    (2, 1, 'Carbohydrate Source', 1, 1, 1, 2)`);

  await safeExecute(`INSERT OR IGNORE INTO diet_meal_options (id, diet_meal_option_group_id, food_id, label, quantity, unit_id, calories_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot, is_active, option_order) VALUES
    (1, 1, 4, '3 Whole Large Eggs', 3, 6, 216, 18.9, 1.2, 14.4, 1, 1),
    (2, 1, 5, '250g Liquid Egg Whites + 1 Whole Egg', 1, 1, 202, 33.5, 2.1, 5.3, 1, 2),
    (3, 2, 3, '80g Rolled Oats', 80, 1, 311, 13.5, 53.0, 5.5, 1, 1),
    (4, 2, 9, '2 Medium Bananas', 2, 6, 210, 2.6, 54.0, 0.6, 1, 2)`);

  // Option Groups & Choices for Lunch (Meal 2)
  await safeExecute(`INSERT OR IGNORE INTO diet_meal_option_groups (id, diet_meal_id, name, is_required, min_selection_count, max_selection_count, group_order) VALUES
    (3, 2, 'Main Lean Protein', 1, 1, 1, 1),
    (4, 2, 'Starch / Grain Base', 1, 1, 1, 2)`);

  await safeExecute(`INSERT OR IGNORE INTO diet_meal_options (id, diet_meal_option_group_id, food_id, label, quantity, unit_id, calories_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot, is_active, option_order) VALUES
    (5, 3, 1, '180g Grilled Chicken Breast', 180, 1, 297, 55.8, 0.0, 6.5, 1, 1),
    (6, 3, 11, '180g Lean Ground Beef (93/7)', 180, 1, 274, 38.5, 0.0, 13.1, 1, 2),
    (7, 4, 2, '200g Cooked Brown Rice', 200, 1, 222, 5.2, 46.0, 1.8, 1, 1),
    (8, 4, 12, '250g Baked Sweet Potato', 250, 1, 225, 5.0, 51.7, 0.2, 1, 2)`);

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

  // 14. Reminder Rules
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
