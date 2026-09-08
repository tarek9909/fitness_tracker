-- =====================================================================
-- FITNESS TRACKING PLATFORM - RUNTIME REALIGNMENT SCRIPT
-- Realigns MySQL tables with TypeScript application models
-- =====================================================================

USE fitness_platform;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. workout_sessions
ALTER TABLE workout_sessions 
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'assigned',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed';

-- 2. workout_session_exercises
ALTER TABLE workout_session_exercises 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS started_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL;

-- 3. cardio_logs
ALTER TABLE cardio_logs 
  ADD COLUMN IF NOT EXISTS cardio_date DATE NULL,
  ADD COLUMN IF NOT EXISTS cardio_activity_id BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS speed_kmh DECIMAL(6,2) NULL,
  ADD COLUMN IF NOT EXISTS incline DECIMAL(5,2) NULL,
  ADD COLUMN IF NOT EXISTS started_at DATETIME NULL;

UPDATE cardio_logs SET cardio_date = target_date WHERE cardio_date IS NULL AND target_date IS NOT NULL;

-- 4. Re-create daily_tasks with canonical runtime schema
DROP TABLE IF EXISTS daily_tasks;
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

-- 5. Missing columns in auxiliary tables
ALTER TABLE measurement_units 
  ADD COLUMN IF NOT EXISTS base_unit INT NOT NULL DEFAULT 0;

ALTER TABLE exercises 
  ADD COLUMN IF NOT EXISTS primary_muscle_group_id BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS secondary_muscle_group_id BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS is_custom INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_archived INT NOT NULL DEFAULT 0;

ALTER TABLE foods 
  ADD COLUMN IF NOT EXISTS serving_unit VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS serving_size DECIMAL(8,2) NULL,
  ADD COLUMN IF NOT EXISTS calories_per_serving DECIMAL(8,2) NULL,
  ADD COLUMN IF NOT EXISTS protein_grams DECIMAL(6,2) NULL,
  ADD COLUMN IF NOT EXISTS carbs_grams DECIMAL(6,2) NULL,
  ADD COLUMN IF NOT EXISTS fat_grams DECIMAL(6,2) NULL,
  ADD COLUMN IF NOT EXISTS fiber_grams DECIMAL(6,2) NULL,
  ADD COLUMN IF NOT EXISTS sugar_grams DECIMAL(6,2) NULL,
  ADD COLUMN IF NOT EXISTS is_system INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified INT NOT NULL DEFAULT 0;

ALTER TABLE user_adherence_configs
  ADD COLUMN IF NOT EXISTS diet_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS workout_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS cardio_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS water_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS weight_logging_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 10;

ALTER TABLE workout_plan_versions
  ADD COLUMN IF NOT EXISTS published_at DATETIME NULL;

ALTER TABLE diet_plan_versions
  ADD COLUMN IF NOT EXISTS published_at DATETIME NULL;

ALTER TABLE meal_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE meal_log_selections
  ADD COLUMN IF NOT EXISTS fiber_g_snapshot DECIMAL(10,2) NULL;

-- 6. workout_plan_days & workout_plan_exercises
ALTER TABLE workout_plan_days 
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS description TEXT NULL;

ALTER TABLE workout_plan_exercises
  ADD COLUMN IF NOT EXISTS exercise_order INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS exercise_name_snapshot VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS tracking_type_snapshot VARCHAR(30) NOT NULL DEFAULT 'weight_reps',
  ADD COLUMN IF NOT EXISTS target_sets INT UNSIGNED NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS target_reps_min INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS target_reps_max INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS target_duration_seconds INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS target_distance_meters DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS rest_seconds INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE;

-- 7. meal_log_selections
ALTER TABLE meal_log_selections
  MODIFY COLUMN diet_meal_option_group_id BIGINT UNSIGNED NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- Pre-seed daily tasks for Tarek for today (2026-09-06)
INSERT IGNORE INTO daily_tasks (user_id, task_date, task_key, task_type, title_snapshot, scheduled_at, due_at, status) VALUES
  (3, '2026-09-06', 'weight', 'weight', 'Log Morning Body Weight', '2026-09-06 08:00:00', '2026-09-06 12:00:00', 'pending'),
  (3, '2026-09-06', 'water', 'water', 'Hit Daily Water Goal', '2026-09-06 21:00:00', '2026-09-06 23:59:59', 'pending'),
  (3, '2026-09-06', 'meal:1', 'meal', 'Meal: Breakfast', '2026-09-06 08:00:00', '2026-09-06 09:00:00', 'pending'),
  (3, '2026-09-06', 'meal:2', 'meal', 'Meal: Lunch', '2026-09-06 12:30:00', '2026-09-06 13:30:00', 'pending'),
  (3, '2026-09-06', 'meal:3', 'meal', 'Meal: Pre-Workout Snack', '2026-09-06 16:00:00', '2026-09-06 17:00:00', 'pending'),
  (3, '2026-09-06', 'meal:4', 'meal', 'Meal: Dinner', '2026-09-06 19:30:00', '2026-09-06 20:30:00', 'pending');
