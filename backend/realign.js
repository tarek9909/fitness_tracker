import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || 'fitness_user',
    password: process.env.DATABASE_PASSWORD || 'MySecureFitnessDbPass2026!',
    database: process.env.DATABASE_NAME || 'fitness_platform',
  });

  console.log('Connected to MySQL successfully!');

  async function addCol(table, col, def) {
    const [rows] = await conn.query(
      'SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [table, col]
    );
    if (rows[0].cnt === 0) {
      console.log(`Adding ${col} to ${table}...`);
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
    } else {
      console.log(`Column ${table}.${col} already exists.`);
    }
  }

  // 1. workout_sessions
  await addCol('workout_sessions', 'source_type', "VARCHAR(20) NOT NULL DEFAULT 'assigned'");
  await addCol('workout_sessions', 'status', "VARCHAR(20) NOT NULL DEFAULT 'completed'");

  // 2. workout_session_exercises
  await addCol('workout_session_exercises', 'status', "VARCHAR(20) NOT NULL DEFAULT 'pending'");
  await addCol('workout_session_exercises', 'started_at', 'DATETIME NULL');
  await addCol('workout_session_exercises', 'completed_at', 'DATETIME NULL');

  // 3. cardio_logs
  await addCol('cardio_logs', 'cardio_date', 'DATE NULL');
  await addCol('cardio_logs', 'cardio_activity_id', 'BIGINT UNSIGNED NULL');
  await addCol('cardio_logs', 'speed_kmh', 'DECIMAL(6,2) NULL');
  await addCol('cardio_logs', 'incline', 'DECIMAL(5,2) NULL');
  await addCol('cardio_logs', 'started_at', 'DATETIME NULL');

  try {
    await conn.query('UPDATE cardio_logs SET cardio_date = target_date WHERE cardio_date IS NULL AND target_date IS NOT NULL');
  } catch (e) {
    // target_date might not exist
  }

  // 4. Recreate daily_tasks cleanly
  console.log('Recreating daily_tasks table...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('DROP TABLE IF EXISTS daily_tasks');
  await conn.query(`
    CREATE TABLE daily_tasks (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      task_date DATE NOT NULL,
      task_key VARCHAR(191) NOT NULL,
      task_type VARCHAR(20) NOT NULL DEFAULT 'custom',
      user_diet_assignment_id BIGINT UNSIGNED NULL,
      user_workout_assignment_id BIGINT UNSIGNED NULL,
      diet_meal_id BIGINT UNSIGNED NULL,
      workout_plan_day_id BIGINT UNSIGNED NULL,
      user_cardio_target_id BIGINT UNSIGNED NULL,
      user_water_target_id BIGINT UNSIGNED NULL,
      user_weight_goal_id BIGINT UNSIGNED NULL,
      title_snapshot VARCHAR(255) NOT NULL DEFAULT '',
      description_snapshot TEXT NULL,
      target_snapshot TEXT NULL,
      scheduled_at DATETIME NULL,
      due_at DATETIME NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      completed_at DATETIME NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_user_task_key (user_id, task_date, task_key),
      INDEX idx_daily_tasks_user_date (user_id, task_date),
      CONSTRAINT fk_daily_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Pre-seed tasks for Tarek for today
  await conn.query(`
    INSERT IGNORE INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, scheduled_at, due_at, status) VALUES
      (3, '2026-09-06', 'weight', 'weight', 'Log Morning Body Weight', '2026-09-06 08:00:00', '2026-09-06 12:00:00', 'pending'),
      (3, '2026-09-06', 'water', 'water', 'Hit Daily Water Goal', '2026-09-06 21:00:00', '2026-09-06 23:59:59', 'pending'),
      (3, '2026-09-06', 'meal:1', 'meal', 'Meal: Breakfast', '2026-09-06 08:00:00', '2026-09-06 09:00:00', 'pending'),
      (3, '2026-09-06', 'meal:2', 'meal', 'Meal: Lunch', '2026-09-06 12:30:00', '2026-09-06 13:30:00', 'pending'),
      (3, '2026-09-06', 'meal:3', 'meal', 'Meal: Pre-Workout Snack', '2026-09-06 16:00:00', '2026-09-06 17:00:00', 'pending'),
      (3, '2026-09-06', 'meal:4', 'meal', 'Meal: Dinner', '2026-09-06 19:30:00', '2026-09-06 20:30:00', 'pending');
  `);

  // 5. Other auxiliary tables
  await addCol('measurement_units', 'base_unit', 'INT NOT NULL DEFAULT 0');
  await addCol('exercises', 'primary_muscle_group_id', 'BIGINT UNSIGNED NULL');
  await addCol('exercises', 'secondary_muscle_group_id', 'BIGINT UNSIGNED NULL');
  await addCol('exercises', 'is_custom', 'INT NOT NULL DEFAULT 0');
  await addCol('exercises', 'is_archived', 'INT NOT NULL DEFAULT 0');

  await addCol('foods', 'serving_unit', 'VARCHAR(50) NULL');
  await addCol('foods', 'serving_size', 'DECIMAL(8,2) NULL');
  await addCol('foods', 'calories_per_serving', 'DECIMAL(8,2) NULL');
  await addCol('foods', 'protein_grams', 'DECIMAL(6,2) NULL');
  await addCol('foods', 'carbs_grams', 'DECIMAL(6,2) NULL');
  await addCol('foods', 'fat_grams', 'DECIMAL(6,2) NULL');
  await addCol('foods', 'fiber_grams', 'DECIMAL(6,2) NULL');
  await addCol('foods', 'sugar_grams', 'DECIMAL(6,2) NULL');
  await addCol('foods', 'is_system', 'INT NOT NULL DEFAULT 0');
  await addCol('foods', 'is_verified', 'INT NOT NULL DEFAULT 0');

  await addCol('user_adherence_configs', 'diet_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 35');
  await addCol('user_adherence_configs', 'workout_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 25');
  await addCol('user_adherence_configs', 'cardio_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 15');
  await addCol('user_adherence_configs', 'water_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 15');
  await addCol('user_adherence_configs', 'weight_logging_weight_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 10');

  await addCol('workout_plan_versions', 'published_at', 'DATETIME NULL');
  await addCol('diet_plan_versions', 'published_at', 'DATETIME NULL');
  await addCol('meal_log_selections', 'fiber_g_snapshot', 'DECIMAL(10,2) NULL');
  try {
    await conn.query('ALTER TABLE meal_log_selections MODIFY COLUMN diet_meal_option_group_id BIGINT UNSIGNED NULL');
    console.log('Modified meal_log_selections.diet_meal_option_group_id to NULLABLE');
  } catch (e) {
    console.warn('Could not modify meal_log_selections column:', e.message);
  }

  // 6. workout_plan_days & workout_plan_exercises
  await addCol('workout_plan_days', 'notes', 'TEXT NULL');
  await addCol('workout_plan_days', 'description', 'TEXT NULL');

  await addCol('workout_plan_exercises', 'exercise_order', 'INT UNSIGNED NOT NULL DEFAULT 1');
  await addCol('workout_plan_exercises', 'exercise_name_snapshot', 'VARCHAR(191) NULL');
  await addCol('workout_plan_exercises', 'tracking_type_snapshot', "VARCHAR(30) NOT NULL DEFAULT 'weight_reps'");
  await addCol('workout_plan_exercises', 'target_sets', 'INT UNSIGNED NOT NULL DEFAULT 3');
  await addCol('workout_plan_exercises', 'target_reps_min', 'INT UNSIGNED NULL');
  await addCol('workout_plan_exercises', 'target_reps_max', 'INT UNSIGNED NULL');
  await addCol('workout_plan_exercises', 'target_duration_seconds', 'INT UNSIGNED NULL');
  await addCol('workout_plan_exercises', 'target_distance_meters', 'DECIMAL(10,2) NULL');
  await addCol('workout_plan_exercises', 'rest_seconds', 'INT UNSIGNED NULL');
  await addCol('workout_plan_exercises', 'notes', 'TEXT NULL');
  await addCol('workout_plan_exercises', 'is_optional', 'BOOLEAN NOT NULL DEFAULT FALSE');

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
  console.log('Realignment completed successfully! All tables match application runtime.');
}

run().catch(err => {
  console.error('Error during realignment:', err);
  process.exit(1);
});
