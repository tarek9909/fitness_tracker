-- =====================================================================
-- FITNESS TRACKING PLATFORM - COMPLETE PRODUCTION DATABASE DUMP
-- Generated: 2026-09-06T17:40:50.689Z
-- Target Engine: MySQL 8.x / MariaDB 10.5+
--
-- Usage Instructions:
--   mysql -h <host> -P <port> -u <user> -p <database_name> < fitness_tracker_dump.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `fitness_platform`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `fitness_platform`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET NAMES utf8mb4;

-- =====================================================================
-- 0. SCHEMA MIGRATIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(191) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- CANONICAL BASELINE SCHEMA (50+ TABLES)
-- =====================================================================

-- =====================================================================
-- FITNESS TRACKING PLATFORM
-- Complete Canonical MySQL 8.x Database Schema
-- =====================================================================





-- =====================================================================
-- 1. ROLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_roles_name UNIQUE (name)
) ENGINE=InnoDB;

-- =====================================================================
-- 2. USERS
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id BIGINT UNSIGNED NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    date_of_birth DATE NULL,
    height_cm DECIMAL(6,2) NULL,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL,
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    locale VARCHAR(20) NOT NULL DEFAULT 'en',
    status ENUM('pending', 'active', 'disabled') NOT NULL DEFAULT 'active',
    security_version INT UNSIGNED NOT NULL DEFAULT 1,
    email_verified_at TIMESTAMP(3) NULL,
    unit_system VARCHAR(10) NOT NULL DEFAULT 'metric',
    last_login_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_users_role (role_id),
    INDEX idx_users_status (status),
    INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB;

-- =====================================================================
-- 3. REFRESH TOKENS / SESSIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_refresh_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    device_name VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(1000) NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    revoked_at TIMESTAMP(3) NULL,
    rotated_from_token_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_rotated_from FOREIGN KEY (rotated_from_token_id) REFERENCES user_refresh_tokens(id) ON DELETE SET NULL,
    INDEX idx_refresh_tokens_user (user_id),
    INDEX idx_refresh_tokens_expires (expires_at),
    INDEX idx_refresh_tokens_revoked (revoked_at)
) ENGINE=InnoDB;

-- =====================================================================
-- 4. PASSWORD RESET TOKENS
-- =====================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    used_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_password_reset_token UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_expires (expires_at)
) ENGINE=InnoDB;

-- =====================================================================
-- 4b. AUTH OTP CHALLENGES
-- =====================================================================

CREATE TABLE IF NOT EXISTS auth_otp_challenges (
    id VARCHAR(64) PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    purpose VARCHAR(50) NOT NULL,
    destination_email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    consumed_at TIMESTAMP(3) NULL,
    failed_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
    last_sent_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_otp_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_otp_challenges_user (user_id, purpose),
    INDEX idx_otp_challenges_dest (destination_email, purpose)
) ENGINE=InnoDB;

-- =====================================================================
-- 4c. USER EMAIL CHANGE REQUESTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_email_change_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    new_email VARCHAR(255) NOT NULL,
    current_email_challenge_id VARCHAR(64) NOT NULL,
    new_email_challenge_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP(3) NOT NULL,
    completed_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_email_change_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_email_change_cur_challenge FOREIGN KEY (current_email_challenge_id) REFERENCES auth_otp_challenges(id) ON DELETE CASCADE,
    CONSTRAINT fk_email_change_new_challenge FOREIGN KEY (new_email_challenge_id) REFERENCES auth_otp_challenges(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 5. MOBILE PUSH DEVICES
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_push_devices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    device_uuid VARCHAR(191) NOT NULL,
    platform ENUM('ios', 'android') NOT NULL,
    push_token VARCHAR(1000) NOT NULL,
    app_version VARCHAR(50) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_user_push_device UNIQUE (user_id, device_uuid),
    CONSTRAINT fk_push_devices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_push_devices_active (user_id, is_active)
) ENGINE=InnoDB;

-- =====================================================================
-- 6. SYSTEM SETTINGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(191) NOT NULL,
    setting_value JSON NOT NULL,
    description VARCHAR(500) NULL,
    updated_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_system_settings_key UNIQUE (setting_key),
    CONSTRAINT fk_system_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================================
-- 7. MEASUREMENT UNITS
-- =====================================================================

CREATE TABLE IF NOT EXISTS measurement_units (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    unit_type ENUM('mass', 'volume', 'count', 'serving', 'distance', 'time', 'other') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_measurement_units_code UNIQUE (code)
) ENGINE=InnoDB;

-- =====================================================================
-- 8. MUSCLE GROUPS
-- =====================================================================

CREATE TABLE IF NOT EXISTS muscle_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_muscle_groups_name UNIQUE (name)
) ENGINE=InnoDB;

-- =====================================================================
-- 9. EQUIPMENT LIBRARY
-- =====================================================================

CREATE TABLE IF NOT EXISTS equipment_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_equipment_types_name UNIQUE (name)
) ENGINE=InnoDB;

-- =====================================================================
-- 10. EXERCISE LIBRARY
-- =====================================================================

CREATE TABLE IF NOT EXISTS exercises (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    equipment_type_id BIGINT UNSIGNED NULL,
    tracking_type ENUM('weight_reps', 'reps_only', 'duration', 'distance', 'weight_duration', 'custom') NOT NULL DEFAULT 'weight_reps',
    instructions TEXT NULL,
    video_url VARCHAR(1000) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_exercises_name UNIQUE (name),
    CONSTRAINT fk_exercises_equipment FOREIGN KEY (equipment_type_id) REFERENCES equipment_types(id) ON DELETE SET NULL,
    CONSTRAINT fk_exercises_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_exercises_equipment (equipment_type_id),
    INDEX idx_exercises_active (is_active)
) ENGINE=InnoDB;

-- =====================================================================
-- 11. EXERCISE - MUSCLE GROUP MAP
-- =====================================================================

CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
    exercise_id BIGINT UNSIGNED NOT NULL,
    muscle_group_id BIGINT UNSIGNED NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (exercise_id, muscle_group_id),
    CONSTRAINT fk_exercise_muscles_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_muscles_group FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id) ON DELETE CASCADE,
    INDEX idx_exercise_muscles_group (muscle_group_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 12. CARDIO ACTIVITY LIBRARY
-- =====================================================================

CREATE TABLE IF NOT EXISTS cardio_activities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    supports_speed BOOLEAN NOT NULL DEFAULT FALSE,
    supports_incline BOOLEAN NOT NULL DEFAULT FALSE,
    supports_distance BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_cardio_activities_name UNIQUE (name)
) ENGINE=InnoDB;

-- =====================================================================
-- 13. WORKOUT PLANS
-- =====================================================================

CREATE TABLE IF NOT EXISTS workout_plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    goal VARCHAR(500) NULL,
    status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    owner_user_id BIGINT UNSIGNED NULL,
    visibility ENUM('admin', 'private') NOT NULL DEFAULT 'admin',
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_workout_plans_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_workout_plans_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_workout_plans_status (status)
) ENGINE=InnoDB;

-- =====================================================================
-- 14. WORKOUT PLAN VERSIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS workout_plan_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workout_plan_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL DEFAULT 1,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    change_notes VARCHAR(1000) NULL,
    created_by BIGINT UNSIGNED NULL,
    published_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_workout_plan_version UNIQUE (workout_plan_id, version_number),
    CONSTRAINT fk_workout_versions_plan FOREIGN KEY (workout_plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_versions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_workout_versions_published_by FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_workout_versions_status (workout_plan_id, status)
) ENGINE=InnoDB;

-- =====================================================================
-- 15. WORKOUT PLAN DAYS
-- =====================================================================

CREATE TABLE IF NOT EXISTS workout_plan_days (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workout_plan_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,
    day_order INT UNSIGNED NOT NULL,
    description TEXT NULL,
    is_rest_day BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_workout_plan_day_weekday UNIQUE (workout_plan_version_id, weekday),
    CONSTRAINT uq_workout_plan_day_order UNIQUE (workout_plan_version_id, day_order),
    CONSTRAINT fk_workout_days_version FOREIGN KEY (workout_plan_version_id) REFERENCES workout_plan_versions(id) ON DELETE CASCADE,
    INDEX idx_workout_days_version (workout_plan_version_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 16. WORKOUT PLAN EXERCISES
-- =====================================================================

CREATE TABLE IF NOT EXISTS workout_plan_exercises (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workout_plan_day_id BIGINT UNSIGNED NOT NULL,
    exercise_id BIGINT UNSIGNED NOT NULL,
    exercise_order INT UNSIGNED NOT NULL,
    exercise_name_snapshot VARCHAR(191) NOT NULL,
    tracking_type_snapshot ENUM('weight_reps', 'reps_only', 'duration', 'distance', 'weight_duration', 'custom') NOT NULL,
    target_sets INT UNSIGNED NOT NULL,
    target_reps_min INT UNSIGNED NULL,
    target_reps_max INT UNSIGNED NULL,
    target_duration_seconds INT UNSIGNED NULL,
    target_distance_meters DECIMAL(10,2) NULL,
    rest_seconds INT UNSIGNED NULL,
    notes TEXT NULL,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_workout_day_exercise_order UNIQUE (workout_plan_day_id, exercise_order),
    CONSTRAINT fk_workout_plan_exercises_day FOREIGN KEY (workout_plan_day_id) REFERENCES workout_plan_days(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_plan_exercises_library FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
    INDEX idx_workout_plan_exercises_day (workout_plan_day_id),
    INDEX idx_workout_plan_exercises_exercise (exercise_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 17. OPTIONAL PER-SET WORKOUT CONFIGURATION
-- =====================================================================

CREATE TABLE IF NOT EXISTS workout_plan_exercise_sets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workout_plan_exercise_id BIGINT UNSIGNED NOT NULL,
    set_number INT UNSIGNED NOT NULL,
    target_reps INT UNSIGNED NULL,
    target_reps_min INT UNSIGNED NULL,
    target_reps_max INT UNSIGNED NULL,
    target_weight_kg DECIMAL(8,2) NULL,
    target_duration_seconds INT UNSIGNED NULL,
    target_distance_meters DECIMAL(10,2) NULL,
    rest_seconds INT UNSIGNED NULL,
    notes VARCHAR(1000) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_workout_plan_set UNIQUE (workout_plan_exercise_id, set_number),
    CONSTRAINT fk_workout_plan_sets_exercise FOREIGN KEY (workout_plan_exercise_id) REFERENCES workout_plan_exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 18. DIET PLANS
-- =====================================================================

CREATE TABLE IF NOT EXISTS diet_plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    owner_user_id BIGINT UNSIGNED NULL,
    visibility ENUM('admin', 'private') NOT NULL DEFAULT 'admin',
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_diet_plans_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_diet_plans_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_diet_plans_status (status)
) ENGINE=InnoDB;

-- =====================================================================
-- 19. DIET PLAN VERSIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS diet_plan_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    diet_plan_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL DEFAULT 1,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    daily_calorie_target DECIMAL(10,2) NULL,
    daily_protein_target_g DECIMAL(10,2) NULL,
    daily_carbs_target_g DECIMAL(10,2) NULL,
    daily_fat_target_g DECIMAL(10,2) NULL,
    change_notes VARCHAR(1000) NULL,
    created_by BIGINT UNSIGNED NULL,
    published_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_diet_plan_version UNIQUE (diet_plan_id, version_number),
    CONSTRAINT fk_diet_version_plan FOREIGN KEY (diet_plan_id) REFERENCES diet_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_diet_version_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_diet_version_published_by FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_diet_versions_status (diet_plan_id, status)
) ENGINE=InnoDB;

-- =====================================================================
-- 20. FOOD LIBRARY
-- =====================================================================

CREATE TABLE IF NOT EXISTS foods (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    brand VARCHAR(191) NULL,
    reference_quantity DECIMAL(10,3) NULL,
    reference_unit_id BIGINT UNSIGNED NULL,
    calories DECIMAL(10,2) NULL,
    protein_g DECIMAL(10,2) NULL,
    carbs_g DECIMAL(10,2) NULL,
    fat_g DECIMAL(10,2) NULL,
    fiber_g DECIMAL(10,2) NULL,
    notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_foods_unit FOREIGN KEY (reference_unit_id) REFERENCES measurement_units(id) ON DELETE SET NULL,
    CONSTRAINT fk_foods_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_foods_name (name),
    INDEX idx_foods_active (is_active)
) ENGINE=InnoDB;

-- =====================================================================
-- 21. DIET MEALS
-- =====================================================================

CREATE TABLE IF NOT EXISTS diet_meals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    diet_plan_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    meal_order INT UNSIGNED NOT NULL,
    scheduled_time TIME NULL,
    default_grace_minutes INT UNSIGNED NOT NULL DEFAULT 60,
    description TEXT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_diet_version_meal_order UNIQUE (diet_plan_version_id, meal_order),
    CONSTRAINT fk_diet_meals_version FOREIGN KEY (diet_plan_version_id) REFERENCES diet_plan_versions(id) ON DELETE CASCADE,
    INDEX idx_diet_meals_version (diet_plan_version_id),
    INDEX idx_diet_meals_schedule (scheduled_time)
) ENGINE=InnoDB;

-- =====================================================================
-- 22. DIET MEAL OPTION GROUPS
-- =====================================================================

CREATE TABLE IF NOT EXISTS diet_meal_option_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    diet_meal_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    group_order INT UNSIGNED NOT NULL,
    min_selection_count INT UNSIGNED NOT NULL DEFAULT 0,
    max_selection_count INT UNSIGNED NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    notes VARCHAR(1000) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_meal_group_order UNIQUE (diet_meal_id, group_order),
    CONSTRAINT fk_meal_groups_meal FOREIGN KEY (diet_meal_id) REFERENCES diet_meals(id) ON DELETE CASCADE,
    INDEX idx_meal_option_groups_meal (diet_meal_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 23. DIET MEAL OPTIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS diet_meal_options (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    diet_meal_option_group_id BIGINT UNSIGNED NOT NULL,
    food_id BIGINT UNSIGNED NULL,
    option_order INT UNSIGNED NOT NULL,
    label VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,3) NULL,
    unit_id BIGINT UNSIGNED NULL,
    calories_snapshot DECIMAL(10,2) NULL,
    protein_g_snapshot DECIMAL(10,2) NULL,
    carbs_g_snapshot DECIMAL(10,2) NULL,
    fat_g_snapshot DECIMAL(10,2) NULL,
    fiber_g_snapshot DECIMAL(10,2) NULL,
    notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_meal_option_order UNIQUE (diet_meal_option_group_id, option_order),
    CONSTRAINT fk_meal_options_group FOREIGN KEY (diet_meal_option_group_id) REFERENCES diet_meal_option_groups(id) ON DELETE CASCADE,
    CONSTRAINT fk_meal_options_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL,
    CONSTRAINT fk_meal_options_unit FOREIGN KEY (unit_id) REFERENCES measurement_units(id) ON DELETE SET NULL,
    INDEX idx_meal_options_group (diet_meal_option_group_id),
    INDEX idx_meal_options_food (food_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 24. USER WORKOUT ASSIGNMENTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_workout_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    workout_plan_version_id BIGINT UNSIGNED NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    status ENUM('active', 'ended', 'cancelled') NOT NULL DEFAULT 'active',
    assignment_source ENUM('admin', 'self_service') NOT NULL DEFAULT 'admin',
    assigned_by BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_user_workout_assignment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_workout_assignment_version FOREIGN KEY (workout_plan_version_id) REFERENCES workout_plan_versions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_workout_assignment_admin FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_workout_assignment_lookup (user_id, status, effective_from, effective_until),
    INDEX idx_user_workout_assignment_version (workout_plan_version_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 25. USER DIET ASSIGNMENTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_diet_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    diet_plan_version_id BIGINT UNSIGNED NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    status ENUM('active', 'ended', 'cancelled') NOT NULL DEFAULT 'active',
    assignment_source ENUM('admin', 'self_service') NOT NULL DEFAULT 'admin',
    assigned_by BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_user_diet_assignment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_diet_assignment_version FOREIGN KEY (diet_plan_version_id) REFERENCES diet_plan_versions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_diet_assignment_admin FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_diet_assignment_lookup (user_id, status, effective_from, effective_until),
    INDEX idx_user_diet_assignment_version (diet_plan_version_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 26. WEIGHT GOALS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_weight_goals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    goal_type VARCHAR(30) NULL DEFAULT 'lose_weight',
    starting_weight_kg DECIMAL(6,2) NOT NULL,
    target_weight_kg DECIMAL(6,2) NOT NULL,
    start_date DATE NOT NULL,
    target_date DATE NULL,
    status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_weight_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_weight_goals_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_weight_goals_user_status (user_id, status)
) ENGINE=InnoDB;

-- =====================================================================
-- 27. WATER TARGETS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_water_targets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    target_ml INT UNSIGNED NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    status ENUM('active', 'ended', 'cancelled') NOT NULL DEFAULT 'active',
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_water_targets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_water_targets_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_water_targets_lookup (user_id, status, effective_from, effective_until)
) ENGINE=InnoDB;

-- =====================================================================
-- 28. USER WATER QUICK-ADD OPTIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_water_quick_add_options (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    amount_ml INT UNSIGNED NOT NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_user_water_quick_amount UNIQUE (user_id, amount_ml),
    CONSTRAINT fk_water_quick_options_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_water_quick_options_order (user_id, is_active, display_order)
) ENGINE=InnoDB;

-- =====================================================================
-- 29. CARDIO TARGETS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_cardio_targets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    cardio_activity_id BIGINT UNSIGNED NULL,
    target_minutes_min INT UNSIGNED NULL,
    target_minutes_max INT UNSIGNED NULL,
    target_speed_min_kmh DECIMAL(6,2) NULL,
    target_speed_max_kmh DECIMAL(6,2) NULL,
    target_incline_min DECIMAL(6,2) NULL,
    target_incline_max DECIMAL(6,2) NULL,
    target_distance_min_km DECIMAL(8,2) NULL,
    target_distance_max_km DECIMAL(8,2) NULL,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    status ENUM('active', 'ended', 'cancelled') NOT NULL DEFAULT 'active',
    notes TEXT NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_cardio_targets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cardio_targets_activity FOREIGN KEY (cardio_activity_id) REFERENCES cardio_activities(id) ON DELETE SET NULL,
    CONSTRAINT fk_cardio_targets_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_cardio_targets_lookup (user_id, status, effective_from, effective_until)
) ENGINE=InnoDB;

-- =====================================================================
-- 30. CARDIO TARGET DAYS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_cardio_target_days (
    user_cardio_target_id BIGINT UNSIGNED NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_cardio_target_id, weekday),
    CONSTRAINT fk_cardio_target_days_target FOREIGN KEY (user_cardio_target_id) REFERENCES user_cardio_targets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 31. ADHERENCE SCORE CONFIGURATION
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_adherence_configs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    diet_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 35,
    workout_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 25,
    cardio_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 15,
    water_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 15,
    weight_logging_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 10,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_adherence_config_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 32. WORKOUT SESSIONS (ACTUAL EXECUTION)
-- =====================================================================

CREATE TABLE IF NOT EXISTS workout_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    user_workout_assignment_id BIGINT UNSIGNED NULL,
    workout_plan_version_id BIGINT UNSIGNED NULL,
    workout_plan_day_id BIGINT UNSIGNED NULL,
    workout_date DATE NOT NULL,
    workout_name_snapshot VARCHAR(150) NOT NULL,
    started_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at TIMESTAMP(3) NULL,
    perceived_rpe DECIMAL(3,1) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_workout_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_sessions_assignment FOREIGN KEY (user_workout_assignment_id) REFERENCES user_workout_assignments(id) ON DELETE SET NULL,
    CONSTRAINT fk_workout_sessions_version FOREIGN KEY (workout_plan_version_id) REFERENCES workout_plan_versions(id) ON DELETE SET NULL,
    CONSTRAINT fk_workout_sessions_day FOREIGN KEY (workout_plan_day_id) REFERENCES workout_plan_days(id) ON DELETE SET NULL,
    INDEX idx_workout_sessions_user_date (user_id, workout_date)
) ENGINE=InnoDB;

-- =====================================================================
-- 33. WORKOUT SESSION EXERCISES
-- =====================================================================

CREATE TABLE IF NOT EXISTS workout_session_exercises (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workout_session_id BIGINT UNSIGNED NOT NULL,
    workout_plan_exercise_id BIGINT UNSIGNED NULL,
    exercise_id BIGINT UNSIGNED NOT NULL,
    exercise_order INT UNSIGNED NOT NULL,
    exercise_name_snapshot VARCHAR(191) NOT NULL,
    tracking_type_snapshot ENUM('weight_reps', 'reps_only', 'duration', 'distance', 'weight_duration', 'custom') NOT NULL,
    planned_sets_snapshot INT UNSIGNED NULL,
    planned_reps_min_snapshot INT UNSIGNED NULL,
    planned_reps_max_snapshot INT UNSIGNED NULL,
    planned_rest_seconds_snapshot INT UNSIGNED NULL,
    started_at TIMESTAMP(3) NULL,
    completed_at TIMESTAMP(3) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_session_exercise_order UNIQUE (workout_session_id, exercise_order),
    CONSTRAINT fk_session_exercises_session FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_exercises_plan_exercise FOREIGN KEY (workout_plan_exercise_id) REFERENCES workout_plan_exercises(id) ON DELETE SET NULL,
    CONSTRAINT fk_session_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
    INDEX idx_session_exercises_session (workout_session_id),
    INDEX idx_session_exercises_exercise (exercise_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 34. WORKOUT SET LOGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS workout_sets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workout_session_exercise_id BIGINT UNSIGNED NOT NULL,
    set_number INT UNSIGNED NOT NULL,
    set_type ENUM('warmup', 'normal', 'drop_set', 'failure', 'amrap') NOT NULL DEFAULT 'normal',
    weight_kg DECIMAL(6,2) NULL,
    reps INT UNSIGNED NULL,
    duration_seconds INT UNSIGNED NULL,
    distance_meters DECIMAL(10,2) NULL,
    rpe DECIMAL(3,1) NULL,
    completed BOOLEAN NOT NULL DEFAULT TRUE,
    performed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_session_exercise_set UNIQUE (workout_session_exercise_id, set_number),
    CONSTRAINT fk_workout_sets_session_exercise FOREIGN KEY (workout_session_exercise_id) REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
    INDEX idx_workout_sets_session_exercise (workout_session_exercise_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 35. MEAL LOGS (ACTUAL EXECUTION)
-- =====================================================================

CREATE TABLE IF NOT EXISTS meal_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    user_diet_assignment_id BIGINT UNSIGNED NULL,
    diet_plan_version_id BIGINT UNSIGNED NULL,
    diet_meal_id BIGINT UNSIGNED NOT NULL,
    meal_date DATE NOT NULL,
    meal_name_snapshot VARCHAR(150) NOT NULL,
    scheduled_time_snapshot TIME NULL,
    actual_calories DECIMAL(10,2) NULL,
    actual_protein_g DECIMAL(10,2) NULL,
    actual_carbs_g DECIMAL(10,2) NULL,
    actual_fat_g DECIMAL(10,2) NULL,
    status ENUM('completed', 'partial', 'skipped') NOT NULL DEFAULT 'completed',
    completed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    notes TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_user_meal_log_instance UNIQUE (user_id, diet_meal_id, meal_date),
    CONSTRAINT fk_meal_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_meal_logs_assignment FOREIGN KEY (user_diet_assignment_id) REFERENCES user_diet_assignments(id) ON DELETE SET NULL,
    CONSTRAINT fk_meal_logs_version FOREIGN KEY (diet_plan_version_id) REFERENCES diet_plan_versions(id) ON DELETE SET NULL,
    CONSTRAINT fk_meal_logs_meal FOREIGN KEY (diet_meal_id) REFERENCES diet_meals(id) ON DELETE RESTRICT,
    INDEX idx_meal_logs_user_date (user_id, meal_date)
) ENGINE=InnoDB;

-- =====================================================================
-- 36. MEAL LOG SELECTIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS meal_log_selections (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    meal_log_id BIGINT UNSIGNED NOT NULL,
    diet_meal_option_group_id BIGINT UNSIGNED NOT NULL,
    diet_meal_option_id BIGINT UNSIGNED NULL,
    group_name_snapshot VARCHAR(150) NOT NULL,
    option_label_snapshot VARCHAR(255) NOT NULL,
    quantity_snapshot DECIMAL(10,3) NULL,
    unit_code_snapshot VARCHAR(30) NULL,
    calories_snapshot DECIMAL(10,2) NULL,
    protein_g_snapshot DECIMAL(10,2) NULL,
    carbs_g_snapshot DECIMAL(10,2) NULL,
    fat_g_snapshot DECIMAL(10,2) NULL,
    fiber_g_snapshot DECIMAL(10,2) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_meal_log_selections_log FOREIGN KEY (meal_log_id) REFERENCES meal_logs(id) ON DELETE CASCADE,
    CONSTRAINT fk_meal_log_selections_group FOREIGN KEY (diet_meal_option_group_id) REFERENCES diet_meal_option_groups(id) ON DELETE RESTRICT,
    CONSTRAINT fk_meal_log_selections_option FOREIGN KEY (diet_meal_option_id) REFERENCES diet_meal_options(id) ON DELETE SET NULL,
    INDEX idx_meal_log_selections_log (meal_log_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 37. CARDIO LOGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS cardio_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    user_cardio_target_id BIGINT UNSIGNED NULL,
    cardio_activity_id BIGINT UNSIGNED NOT NULL,
    activity_name_snapshot VARCHAR(150) NOT NULL,
    target_date DATE NOT NULL,
    duration_minutes INT UNSIGNED NOT NULL,
    distance_km DECIMAL(8,2) NULL,
    calories_burned INT UNSIGNED NULL,
    average_speed_kmh DECIMAL(6,2) NULL,
    incline_pct DECIMAL(5,2) NULL,
    heart_rate_avg INT UNSIGNED NULL,
    heart_rate_max INT UNSIGNED NULL,
    notes TEXT NULL,
    completed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_cardio_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cardio_logs_target FOREIGN KEY (user_cardio_target_id) REFERENCES user_cardio_targets(id) ON DELETE SET NULL,
    CONSTRAINT fk_cardio_logs_activity FOREIGN KEY (cardio_activity_id) REFERENCES cardio_activities(id) ON DELETE RESTRICT,
    INDEX idx_cardio_logs_user_date (user_id, target_date)
) ENGINE=InnoDB;

-- =====================================================================
-- 38. WATER LOGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS water_entries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    user_water_target_id BIGINT UNSIGNED NULL,
    intake_date DATE NOT NULL,
    amount_ml INT UNSIGNED NOT NULL,
    recorded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_water_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_water_entries_target FOREIGN KEY (user_water_target_id) REFERENCES user_water_targets(id) ON DELETE SET NULL,
    INDEX idx_water_entries_user_date (user_id, intake_date)
) ENGINE=InnoDB;

-- =====================================================================
-- 39. BODY WEIGHT LOGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS body_weight_entries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    measurement_date DATE NOT NULL,
    measured_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    weight_kg DECIMAL(6,2) NOT NULL,
    weight_unit_id BIGINT UNSIGNED NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_user_weight_measurement UNIQUE (user_id, measurement_date, measured_at),
    CONSTRAINT fk_body_weight_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_body_weight_unit FOREIGN KEY (weight_unit_id) REFERENCES measurement_units(id) ON DELETE SET NULL,
    INDEX idx_body_weight_user_date (user_id, measurement_date)
) ENGINE=InnoDB;

-- =====================================================================
-- 40. DAILY TASKS / AGENDA
-- =====================================================================

CREATE TABLE IF NOT EXISTS daily_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    task_date DATE NOT NULL,
    task_order INT UNSIGNED NOT NULL,
    task_key VARCHAR(100) NOT NULL,
    category ENUM('workout', 'meal', 'cardio', 'water', 'weight', 'custom') NOT NULL,
    label VARCHAR(255) NOT NULL,
    scheduled_time TIME NULL,
    target_value DECIMAL(10,2) NULL,
    actual_value DECIMAL(10,2) NULL,
    unit_id BIGINT UNSIGNED NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_user_task_key UNIQUE (user_id, task_date, task_key),
    CONSTRAINT fk_daily_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_daily_tasks_unit FOREIGN KEY (unit_id) REFERENCES measurement_units(id) ON DELETE SET NULL,
    INDEX idx_daily_tasks_user_date (user_id, task_date)
) ENGINE=InnoDB;

-- =====================================================================
-- 41. USER NOTIFICATION SETTINGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_notification_settings (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    local_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start TIME NULL,
    quiet_hours_end TIME NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_user_notification_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 42. USER NOTIFICATION PREFERENCES
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    task_category ENUM('workout', 'meal', 'cardio', 'water', 'weight', 'general') NOT NULL,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_user_notification_pref UNIQUE (user_id, task_category),
    CONSTRAINT fk_notification_prefs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 43. REMINDER RULES
-- =====================================================================

CREATE TABLE IF NOT EXISTS reminder_rules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    diet_meal_id BIGINT UNSIGNED NULL,
    workout_plan_day_id BIGINT UNSIGNED NULL,
    target_category ENUM('workout', 'meal', 'cardio', 'water', 'weight', 'custom') NOT NULL,
    offset_minutes INT NOT NULL DEFAULT 0,
    grace_period_minutes INT UNSIGNED NOT NULL DEFAULT 30,
    repeat_interval_minutes INT UNSIGNED NULL,
    max_repeats INT UNSIGNED NOT NULL DEFAULT 0,
    active_window_start TIME NULL,
    active_window_end TIME NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_reminder_rules_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reminder_rules_meal FOREIGN KEY (diet_meal_id) REFERENCES diet_meals(id) ON DELETE CASCADE,
    CONSTRAINT fk_reminder_rules_workout_day FOREIGN KEY (workout_plan_day_id) REFERENCES workout_plan_days(id) ON DELETE CASCADE,
    CONSTRAINT fk_reminder_rules_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_reminder_rules_target (user_id, target_category, is_active)
) ENGINE=InnoDB;

-- =====================================================================
-- 44. REMINDER RULE WEEKDAYS
-- =====================================================================

CREATE TABLE IF NOT EXISTS reminder_rule_weekdays (
    reminder_rule_id BIGINT UNSIGNED NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (reminder_rule_id, weekday),
    CONSTRAINT fk_reminder_weekdays_rule FOREIGN KEY (reminder_rule_id) REFERENCES reminder_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 45. IN-APP NOTIFICATIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    daily_task_id BIGINT UNSIGNED NULL,
    reminder_rule_id BIGINT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    deep_link VARCHAR(500) NULL,
    dedupe_key VARCHAR(191) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP(3) NULL,
    scheduled_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    dismissed_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_notifications_dedupe UNIQUE (user_id, dedupe_key),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_task FOREIGN KEY (daily_task_id) REFERENCES daily_tasks(id) ON DELETE SET NULL,
    CONSTRAINT fk_notifications_rule FOREIGN KEY (reminder_rule_id) REFERENCES reminder_rules(id) ON DELETE SET NULL,
    INDEX idx_notifications_user_unread (user_id, is_read, scheduled_at)
) ENGINE=InnoDB;

-- =====================================================================
-- 46. NOTIFICATION DELIVERIES
-- =====================================================================

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    notification_id BIGINT UNSIGNED NOT NULL,
    user_push_device_id BIGINT UNSIGNED NULL,
    channel ENUM('in_app', 'push', 'local') NOT NULL,
    provider_message_id VARCHAR(255) NULL,
    status ENUM('pending', 'sent', 'failed', 'delivered') NOT NULL DEFAULT 'pending',
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    sent_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_deliveries_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    CONSTRAINT fk_deliveries_device FOREIGN KEY (user_push_device_id) REFERENCES user_push_devices(id) ON DELETE SET NULL,
    INDEX idx_deliveries_status (status, attempt_count)
) ENGINE=InnoDB;

-- =====================================================================
-- 47. DAILY SUMMARY TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_daily_summaries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    summary_date DATE NOT NULL,
    diet_adherence_pct DECIMAL(5,2) NULL,
    workout_adherence_pct DECIMAL(5,2) NULL,
    cardio_adherence_pct DECIMAL(5,2) NULL,
    water_adherence_pct DECIMAL(5,2) NULL,
    weight_logging_adherence_pct DECIMAL(5,2) NULL,
    overall_adherence_pct DECIMAL(5,2) NULL,
    weight_kg DECIMAL(6,2) NULL,
    meals_expected INT UNSIGNED NOT NULL DEFAULT 0,
    meals_completed INT UNSIGNED NOT NULL DEFAULT 0,
    meals_partial INT UNSIGNED NOT NULL DEFAULT 0,
    meals_skipped INT UNSIGNED NOT NULL DEFAULT 0,
    workout_expected BOOLEAN NOT NULL DEFAULT FALSE,
    workout_completed BOOLEAN NOT NULL DEFAULT FALSE,
    cardio_target_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    cardio_actual_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    water_target_ml INT UNSIGNED NOT NULL DEFAULT 0,
    water_actual_ml INT UNSIGNED NOT NULL DEFAULT 0,
    weight_logged BOOLEAN NOT NULL DEFAULT FALSE,
    calculated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_user_daily_summary UNIQUE (user_id, summary_date),
    CONSTRAINT fk_daily_summaries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_daily_summary_history (user_id, summary_date)
) ENGINE=InnoDB;

-- =====================================================================
-- 48. PROGRESS SNAPSHOTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_progress_snapshots (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    period_type ENUM('daily', 'weekly', 'monthly') NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    starting_weight_kg DECIMAL(6,2) NULL,
    ending_weight_kg DECIMAL(6,2) NULL,
    average_weight_kg DECIMAL(6,2) NULL,
    weight_change_kg DECIMAL(7,2) NULL,
    diet_adherence_pct DECIMAL(5,2) NULL,
    workout_adherence_pct DECIMAL(5,2) NULL,
    cardio_adherence_pct DECIMAL(5,2) NULL,
    water_adherence_pct DECIMAL(5,2) NULL,
    overall_adherence_pct DECIMAL(5,2) NULL,
    workout_sessions_completed INT UNSIGNED NOT NULL DEFAULT 0,
    cardio_minutes_total INT UNSIGNED NOT NULL DEFAULT 0,
    water_average_ml INT UNSIGNED NULL,
    calculated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_progress_snapshot UNIQUE (user_id, period_type, period_start, period_end),
    CONSTRAINT fk_progress_snapshots_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_progress_snapshots_lookup (user_id, period_type, period_start)
) ENGINE=InnoDB;

-- =====================================================================
-- 49. API IDEMPOTENCY KEYS
-- =====================================================================

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    client_operation_id CHAR(36) NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    request_hash CHAR(64) NULL,
    response_status INT UNSIGNED NULL,
    response_body JSON NULL,
    completed_at TIMESTAMP(3) NULL,
    expires_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_user_client_operation UNIQUE (user_id, client_operation_id),
    CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_idempotency_expiry (expires_at)
) ENGINE=InnoDB;

-- =====================================================================
-- 50. AUDIT LOGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(191) NULL,
    before_data JSON NULL,
    after_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(1000) NULL,
    request_id VARCHAR(100) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_logs_actor (actor_user_id, created_at),
    INDEX idx_audit_logs_entity (entity_type, entity_id),
    INDEX idx_audit_logs_action (action, created_at),
    INDEX idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB;

-- =====================================================================
-- 51. WORKER LOCKS (DAEMON CONCURRENCY LEASE)
-- =====================================================================

CREATE TABLE IF NOT EXISTS worker_locks (
    worker_name VARCHAR(100) PRIMARY KEY,
    locked_until DATETIME(3) NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

-- =====================================================================
-- 52. USER PASSKEYS (WEBAUTHN / BIOMETRICS)
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_passkeys (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    credential_id VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    credential_format VARCHAR(30) NOT NULL DEFAULT 'webauthn-cose',
    counter BIGINT UNSIGNED NOT NULL DEFAULT 0,
    device_name VARCHAR(150) NOT NULL,
    transports VARCHAR(255) NULL,
    aaguid VARCHAR(64) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_used_at TIMESTAMP(3) NULL,
    CONSTRAINT uq_passkeys_credential_id UNIQUE (credential_id),
    CONSTRAINT fk_passkeys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_passkeys_user (user_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 53. WEBAUTHN CHALLENGES
-- =====================================================================

CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
    id VARCHAR(100) PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    challenge VARCHAR(255) NOT NULL,
    ceremony_type VARCHAR(30) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_webauthn_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_webauthn_challenges_exp (expires_at)
) ENGINE=InnoDB;

-- =====================================================================
-- BASELINE DATA & SEED CATALOG INSERTS
-- =====================================================================

-- Table: schema_migrations (8 rows)
LOCK TABLES `schema_migrations` WRITE;
INSERT IGNORE INTO `schema_migrations` (`version`, `applied_at`) VALUES
  ('001-initial-schema', '2026-09-03 18:03:08'),
  ('002-workout-sessions-unique-user-date', '2026-09-03 18:03:08'),
  ('003-worker-locks-table', '2026-09-03 18:03:08'),
  ('004-harmonize-schema-columns', '2026-09-03 18:03:08'),
  ('005-self-service-and-rir-removal', '2026-09-03 18:03:08'),
  ('006-cardio-and-plan-validation-compatibility', '2026-09-06 13:06:37'),
  ('007-passkey-authentication-tables', '2026-09-06 13:06:37'),
  ('008-passkey-credential-format-and-plan-set-compatibility', '2026-09-06 13:09:35');
UNLOCK TABLES;

-- Table: roles (3 rows)
LOCK TABLES `roles` WRITE;
INSERT IGNORE INTO `roles` (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES
  (1, 'super_admin', 'Full platform administrative control', '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 'admin', 'Plan builder and client manager', '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (3, 'user', 'Fitness tracking client application user', '2026-09-03 18:03:08', '2026-09-03 18:03:08');
UNLOCK TABLES;

-- Table: measurement_units (9 rows)
LOCK TABLES `measurement_units` WRITE;
INSERT IGNORE INTO `measurement_units` (`id`, `code`, `name`, `unit_type`, `is_active`, `created_at`, `updated_at`, `base_unit`) VALUES
  (1, 'g', 'Grams', 'mass', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0),
  (2, 'kg', 'Kilograms', 'mass', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0),
  (3, 'ml', 'Milliliters', 'volume', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0),
  (4, 'l', 'Liters', 'volume', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0),
  (5, 'serving', 'Serving', 'serving', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0),
  (6, 'item', 'Item / Piece', 'count', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0),
  (7, 'km', 'Kilometers', 'distance', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0),
  (8, 'minute', 'Minutes', 'time', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0),
  (9, 'second', 'Seconds', 'time', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0);
UNLOCK TABLES;

-- Table: muscle_groups (11 rows)
LOCK TABLES `muscle_groups` WRITE;
INSERT IGNORE INTO `muscle_groups` (`id`, `name`, `is_active`, `created_at`, `updated_at`) VALUES
  (1, 'Chest', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 'Back', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (3, 'Shoulders', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (4, 'Biceps', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (5, 'Triceps', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (6, 'Quadriceps', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (7, 'Hamstrings', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (8, 'Glutes', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (9, 'Calves', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (10, 'Core', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (11, 'Cardio / Full Body', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08');
UNLOCK TABLES;

-- Table: equipment_types (7 rows)
LOCK TABLES `equipment_types` WRITE;
INSERT IGNORE INTO `equipment_types` (`id`, `name`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
  (1, 'Barbell', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 'Dumbbell', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (3, 'Cable Machine', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (4, 'Plate Loaded / Machine', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (5, 'Bodyweight', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (6, 'Cardio Machine', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (7, 'Resistance Band', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08');
UNLOCK TABLES;

-- Table: exercises (12 rows)
LOCK TABLES `exercises` WRITE;
INSERT IGNORE INTO `exercises` (`id`, `name`, `description`, `equipment_type_id`, `tracking_type`, `instructions`, `video_url`, `is_active`, `created_by`, `created_at`, `updated_at`, `primary_muscle_group_id`, `secondary_muscle_group_id`, `is_custom`, `is_archived`) VALUES
  (1, 'Barbell Bench Press', 'Compound horizontal chest press', 1, 'weight_reps', 'Lower bar to mid-chest, drive feet into floor, press up without flaring elbows.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (2, 'Incline Dumbbell Press', 'Upper chest hypertrophy movement', 2, 'weight_reps', 'Set bench to 30 degrees. Press dumbbells up in a slight arc.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (3, 'Barbell Back Squat', 'Fundamental compound lower body exercise', 1, 'weight_reps', 'Descend until hip crease is below top of knees. Maintain neutral spine.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (4, 'Leg Press 45°', 'Quad-dominant machine press', 4, 'weight_reps', 'Place feet shoulder-width on platform. Lower sled under control.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (5, 'Romanian Deadlift (RDL)', 'Posterior chain builder targeting hamstrings and glutes', 1, 'weight_reps', 'Hinge at the hips with slight knee bend, lowering barbell along shins.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (6, 'Lat Pulldown (Wide Grip)', 'Vertical back pulling exercise', 3, 'weight_reps', 'Pull bar smoothly to upper chest, retracting shoulder blades.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (7, 'Barbell Bent-Over Row', 'Horizontal compound back pull', 1, 'weight_reps', 'Hinge torso to 45 degrees, row bar to lower ribcage.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (8, 'Standing Overhead Dumbbell Press', 'Deltoid vertical pressing movement', 2, 'weight_reps', 'Press dumbbells overhead from shoulder height, core braced.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (9, 'Dumbbell Lateral Raise', 'Side deltoid isolation', 2, 'weight_reps', 'Raise dumbbells out to sides until parallel to floor. Slight forward lean.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (10, 'Barbell Bicep Curl', 'Bicep isolation', 1, 'weight_reps', 'Curl bar up keeping elbows pinned at sides.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (11, 'Tricep Cable Rope Pushdown', 'Tricep isolation', 3, 'weight_reps', 'Extend elbows fully and spread rope at the bottom.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0),
  (12, 'Plank Hold', 'Isometric core endurance', 5, 'duration', 'Hold rigid pushup or forearm position without sagging hips.', NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, 0, 0);
UNLOCK TABLES;

-- Table: exercise_muscle_groups (12 rows)
LOCK TABLES `exercise_muscle_groups` WRITE;
INSERT IGNORE INTO `exercise_muscle_groups` (`exercise_id`, `muscle_group_id`, `is_primary`, `created_at`) VALUES
  (1, 1, 1, '2026-09-03 18:03:08'),
  (2, 1, 1, '2026-09-03 18:03:08'),
  (3, 6, 1, '2026-09-03 18:03:08'),
  (4, 6, 1, '2026-09-03 18:03:08'),
  (5, 7, 1, '2026-09-03 18:03:08'),
  (6, 2, 1, '2026-09-03 18:03:08'),
  (7, 2, 1, '2026-09-03 18:03:08'),
  (8, 3, 1, '2026-09-03 18:03:08'),
  (9, 3, 1, '2026-09-03 18:03:08'),
  (10, 4, 1, '2026-09-03 18:03:08'),
  (11, 5, 1, '2026-09-03 18:03:08'),
  (12, 10, 1, '2026-09-03 18:03:08');
UNLOCK TABLES;

-- Table: foods (12 rows)
LOCK TABLES `foods` WRITE;
INSERT IGNORE INTO `foods` (`id`, `name`, `brand`, `reference_quantity`, `reference_unit_id`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `notes`, `is_active`, `created_by`, `created_at`, `updated_at`, `serving_unit`, `serving_size`, `calories_per_serving`, `protein_grams`, `carbs_grams`, `fat_grams`, `fiber_grams`, `sugar_grams`, `is_system`, `is_verified`) VALUES
  (1, 'Skinless Chicken Breast (Cooked)', NULL, 100, 1, 165, 31, 0, 3.6, 0, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (2, 'Brown Rice (Cooked)', NULL, 100, 1, 111, 2.6, 23, 0.9, 1.8, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (3, 'Rolled Oats (Dry)', NULL, 100, 1, 389, 16.9, 66.3, 6.9, 10.6, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (4, 'Whole Large Egg', NULL, 1, 6, 72, 6.3, 0.4, 4.8, 0, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (5, 'Liquid Egg Whites', NULL, 100, 1, 52, 10.9, 0.7, 0.2, 0, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (6, 'Whey Protein Isolate Powder', NULL, 1, 5, 120, 24, 2, 1, 0, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (7, 'Greek Yogurt 0% Fat', NULL, 100, 1, 59, 10, 3.6, 0.4, 0, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (8, 'Raw Whole Almonds', NULL, 30, 1, 170, 6, 6, 15, 3.5, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (9, 'Medium Banana', NULL, 1, 6, 105, 1.3, 27, 0.3, 3.1, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (10, 'Extra Virgin Olive Oil', NULL, 10, 1, 88, 0, 0, 10, 0, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (11, 'Lean Ground Beef 93/7', NULL, 100, 1, 152, 21.4, 0, 7.3, 0, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0),
  (12, 'Sweet Potato (Baked)', NULL, 100, 1, 90, 2, 20.7, 0.1, 3.3, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0);
UNLOCK TABLES;

-- Table: cardio_activities (5 rows)
LOCK TABLES `cardio_activities` WRITE;
INSERT IGNORE INTO `cardio_activities` (`id`, `name`, `description`, `supports_speed`, `supports_incline`, `supports_distance`, `is_active`, `created_at`, `updated_at`, `met_value`, `is_system`) VALUES
  (1, 'Treadmill Incline Walking', NULL, 1, 1, 1, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 1),
  (2, 'Stationary Cycling', NULL, 1, 0, 1, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 1),
  (3, 'Rowing Machine', NULL, 1, 0, 1, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 1),
  (4, 'Outdoor Running', NULL, 1, 0, 1, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 1),
  (5, 'Stair Climber', NULL, 1, 0, 0, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 1);
UNLOCK TABLES;

-- Table: users (3 rows)
LOCK TABLES `users` WRITE;
INSERT IGNORE INTO `users` (`id`, `role_id`, `first_name`, `last_name`, `email`, `password_hash`, `phone`, `date_of_birth`, `height_cm`, `gender`, `timezone`, `locale`, `status`, `security_version`, `email_verified_at`, `unit_system`, `last_login_at`, `created_at`, `updated_at`) VALUES
  (1, 1, 'Platform', 'Administrator', 'admin@fitnessplatform.com', '$2a$10$YAd3wnXxZtxq7Ap94p/SauvmDPiO0lRXBMvhfFzZkJUgkMCmbdVa6', NULL, NULL, 182, NULL, 'UTC', 'en', 'active', 1, NULL, 'metric', NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 3, 'John', 'Doe', 'john.doe@fitnessplatform.com', '$2a$10$QFZFZJ4QIApMVHDulOirpeF/bDVKXUxmTMyjVGtiCIrnfrYHCKp.y', NULL, NULL, 180, NULL, 'UTC', 'en', 'active', 1, NULL, 'metric', NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (3, 3, 'Tarek', 'Aswad', 'tarek.aswad@fitnessplatform.com', '$2a$10$pSC8XRHwf4h8eRmqqJT/n.w9gk0WNXZ1jQxUfWQqvtxqRNdB4ig5O', NULL, NULL, 180, NULL, 'Asia/Beirut', 'en', 'active', 1, NULL, 'metric', '2026-09-06 13:34:46', '2026-09-03 23:23:01', '2026-09-03 23:23:01');
UNLOCK TABLES;

-- Table: user_notification_settings (2 rows)
LOCK TABLES `user_notification_settings` WRITE;
INSERT IGNORE INTO `user_notification_settings` (`user_id`, `in_app_enabled`, `push_enabled`, `local_notifications_enabled`, `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`, `created_at`, `updated_at`) VALUES
  (2, 1, 1, 1, 0, NULL, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (3, 1, 1, 1, 0, NULL, NULL, '2026-09-03 23:23:11', '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: user_adherence_configs (2 rows)
LOCK TABLES `user_adherence_configs` WRITE;
INSERT IGNORE INTO `user_adherence_configs` (`id`, `user_id`, `diet_weight_pct`, `workout_weight_pct`, `cardio_weight_pct`, `water_weight_pct`, `weight_logging_weight_pct`, `effective_from`, `effective_until`, `is_active`, `created_at`, `updated_at`) VALUES
  (1, 2, 35, 25, 15, 15, 10, '2026-01-01', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 3, 35, 25, 15, 15, 10, '2026-01-01', NULL, 1, '2026-09-03 23:23:11', '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: user_water_targets (2 rows)
LOCK TABLES `user_water_targets` WRITE;
INSERT IGNORE INTO `user_water_targets` (`id`, `user_id`, `target_ml`, `effective_from`, `effective_until`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
  (1, 2, 3000, '2026-01-01', NULL, 'active', NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 3, 3500, '2026-01-01', NULL, 'active', NULL, '2026-09-03 23:23:11', '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: user_water_quick_add_options (8 rows)
LOCK TABLES `user_water_quick_add_options` WRITE;
INSERT IGNORE INTO `user_water_quick_add_options` (`id`, `user_id`, `amount_ml`, `display_order`, `is_active`, `created_at`) VALUES
  (1, 2, 250, 1, 1, '2026-09-03 18:03:08'),
  (2, 2, 500, 2, 1, '2026-09-03 18:03:08'),
  (3, 2, 750, 3, 1, '2026-09-03 18:03:08'),
  (4, 2, 1000, 4, 1, '2026-09-03 18:03:08'),
  (5, 3, 250, 1, 1, '2026-09-03 23:23:11'),
  (6, 3, 500, 2, 1, '2026-09-03 23:23:11'),
  (7, 3, 750, 3, 1, '2026-09-03 23:23:11'),
  (8, 3, 1000, 4, 1, '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: user_weight_goals (2 rows)
LOCK TABLES `user_weight_goals` WRITE;
INSERT IGNORE INTO `user_weight_goals` (`id`, `user_id`, `goal_type`, `starting_weight_kg`, `target_weight_kg`, `start_date`, `target_date`, `status`, `notes`, `created_by`, `created_at`, `updated_at`) VALUES
  (1, 2, 'lose_weight', 92.5, 82, '2026-01-01', '2026-12-31', 'active', NULL, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 3, 'lose_weight', 105.2, 86.3, '2026-01-01', '2026-12-31', 'active', NULL, NULL, '2026-09-03 23:23:11', '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: user_cardio_targets (2 rows)
LOCK TABLES `user_cardio_targets` WRITE;
INSERT IGNORE INTO `user_cardio_targets` (`id`, `user_id`, `cardio_activity_id`, `target_minutes_min`, `target_minutes_max`, `target_speed_min_kmh`, `target_speed_max_kmh`, `target_incline_min`, `target_incline_max`, `target_distance_min_km`, `target_distance_max_km`, `effective_from`, `effective_until`, `status`, `notes`, `created_by`, `created_at`, `updated_at`) VALUES
  (1, 2, 2, 25, 35, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-01', NULL, 'active', NULL, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 3, 2, 30, 40, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-01', NULL, 'active', NULL, NULL, '2026-09-03 23:23:11', '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: user_cardio_target_days (7 rows)
LOCK TABLES `user_cardio_target_days` WRITE;
INSERT IGNORE INTO `user_cardio_target_days` (`user_cardio_target_id`, `weekday`, `created_at`) VALUES
  (1, 1, '2026-09-03 18:03:08'),
  (1, 3, '2026-09-03 18:03:08'),
  (1, 5, '2026-09-03 18:03:08'),
  (2, 1, '2026-09-03 23:23:11'),
  (2, 2, '2026-09-03 23:23:11'),
  (2, 4, '2026-09-03 23:23:11'),
  (2, 5, '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: workout_plans (1 rows)
LOCK TABLES `workout_plans` WRITE;
INSERT IGNORE INTO `workout_plans` (`id`, `name`, `description`, `goal`, `status`, `owner_user_id`, `visibility`, `created_by`, `created_at`, `updated_at`, `is_archived`, `archived_at`) VALUES
  (1, '4-Day Hypertrophy Split (Upper / Lower)', 'Progressive overload 4-day split balancing strength and hypertrophy', 'hypertrophy', 'active', NULL, 'admin', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0, NULL);
UNLOCK TABLES;

-- Table: workout_plan_versions (1 rows)
LOCK TABLES `workout_plan_versions` WRITE;
INSERT IGNORE INTO `workout_plan_versions` (`id`, `workout_plan_id`, `version_number`, `status`, `change_notes`, `published_at`, `created_by`, `published_by`, `created_at`, `updated_at`, `change_summary`) VALUES
  (1, 1, 1, 'published', 'Initial 4-day Upper/Lower version with periodized volume', '2026-09-03 18:03:08', 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL);
UNLOCK TABLES;

-- Table: workout_plan_days (7 rows)
LOCK TABLES `workout_plan_days` WRITE;
INSERT IGNORE INTO `workout_plan_days` (`id`, `workout_plan_version_id`, `weekday`, `name`, `description`, `is_rest_day`, `day_order`, `notes`, `created_at`, `updated_at`) VALUES
  (1, 1, 1, 'Upper Body A', NULL, 0, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 1, 2, 'Lower Body A', NULL, 0, 2, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (3, 1, 3, 'Active Recovery & Rest', NULL, 1, 3, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (4, 1, 4, 'Upper Body B', NULL, 0, 4, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (5, 1, 5, 'Lower Body B', NULL, 0, 5, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (6, 1, 6, 'Weekend Rest Day', NULL, 1, 6, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (7, 1, 7, 'Weekend Rest Day', NULL, 1, 7, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08');
UNLOCK TABLES;

-- Table: workout_plan_exercises (9 rows)
LOCK TABLES `workout_plan_exercises` WRITE;
INSERT IGNORE INTO `workout_plan_exercises` (`id`, `workout_plan_day_id`, `exercise_id`, `exercise_order`, `exercise_name_snapshot`, `tracking_type_snapshot`, `target_sets`, `target_reps_min`, `target_reps_max`, `target_duration_seconds`, `target_distance_meters`, `rest_seconds`, `notes`, `is_optional`, `created_at`, `updated_at`) VALUES
  (1, 1, 1, 1, 'Flat Barbell Bench Press', 'weight_reps', 4, 6, 8, NULL, NULL, 120, 'Pyramid warm-ups, then 4 heavy working sets.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 1, 6, 2, 'Lat Pulldown (Wide Grip)', 'weight_reps', 4, 8, 12, NULL, NULL, 90, 'Full stretch at the top, squeeze lats.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (3, 1, 8, 3, 'Standing Overhead Barbell Press', 'weight_reps', 3, 8, 10, NULL, NULL, 90, 'Maintain vertical torso, brace glutes.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (4, 1, 7, 4, 'Seated Cable Row', 'weight_reps', 3, 8, 12, NULL, NULL, 90, 'Pull towards belly button.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (5, 1, 11, 5, 'Triceps Rope Pushdown', 'weight_reps', 3, 12, 15, NULL, NULL, 60, 'Keep elbows tight.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (6, 2, 3, 1, 'Barbell Back Squat', 'weight_reps', 4, 6, 8, NULL, NULL, 150, 'Warm up thoroughly. Descend to depth with upright chest.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (7, 2, 5, 2, 'Romanian Deadlift (Barbell)', 'weight_reps', 4, 8, 10, NULL, NULL, 120, 'Feel the hamstring stretch. Keep back straight.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (8, 2, 4, 3, 'Leg Press 45°', 'weight_reps', 3, 10, 12, NULL, NULL, 90, 'Full range of motion, avoid locking knees.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (9, 2, 12, 4, 'Plank', 'duration', 3, NULL, NULL, NULL, NULL, 60, 'Target: 60 seconds hold per set.', 0, '2026-09-03 18:03:08', '2026-09-03 18:03:08');
UNLOCK TABLES;

-- Table: user_workout_assignments (2 rows)
LOCK TABLES `user_workout_assignments` WRITE;
INSERT IGNORE INTO `user_workout_assignments` (`id`, `user_id`, `workout_plan_version_id`, `effective_from`, `effective_until`, `status`, `assignment_source`, `notes`, `assigned_by`, `created_at`, `updated_at`) VALUES
  (1, 2, 1, '2026-01-01', NULL, 'active', 'admin', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 3, 1, '2026-01-01', NULL, 'active', 'admin', NULL, 1, '2026-09-03 23:23:11', '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: diet_plans (1 rows)
LOCK TABLES `diet_plans` WRITE;
INSERT IGNORE INTO `diet_plans` (`id`, `name`, `description`, `status`, `owner_user_id`, `visibility`, `created_by`, `created_at`, `updated_at`, `is_archived`, `archived_at`) VALUES
  (1, '2,200 kcal Clean Lean Bulk & Recomposition', 'High-protein nutritional protocol with configurable options', 'active', NULL, 'admin', 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 0, NULL);
UNLOCK TABLES;

-- Table: diet_plan_versions (1 rows)
LOCK TABLES `diet_plan_versions` WRITE;
INSERT IGNORE INTO `diet_plan_versions` (`id`, `diet_plan_id`, `version_number`, `status`, `daily_calorie_target`, `daily_protein_target_g`, `daily_carbs_target_g`, `daily_fat_target_g`, `change_notes`, `published_at`, `created_by`, `published_by`, `created_at`, `updated_at`, `change_summary`) VALUES
  (1, 1, 1, 'published', 2200, 180, 220, 65, 'Initial balanced 4-meal plan with flexible protein and carb choices', '2026-09-03 18:03:08', 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL);
UNLOCK TABLES;

-- Table: diet_meals (4 rows)
LOCK TABLES `diet_meals` WRITE;
INSERT IGNORE INTO `diet_meals` (`id`, `diet_plan_version_id`, `name`, `meal_order`, `scheduled_time`, `default_grace_minutes`, `description`, `is_required`, `created_at`, `updated_at`, `meal_date`, `order_index`) VALUES
  (1, 1, 'Breakfast', 1, '08:00:00', 60, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 1),
  (2, 1, 'Lunch', 2, '12:30:00', 60, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 2),
  (3, 1, 'Pre-Workout Snack', 3, '16:00:00', 60, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 3),
  (4, 1, 'Dinner', 4, '19:30:00', 60, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', NULL, 4);
UNLOCK TABLES;

-- Table: diet_meal_option_groups (4 rows)
LOCK TABLES `diet_meal_option_groups` WRITE;
INSERT IGNORE INTO `diet_meal_option_groups` (`id`, `diet_meal_id`, `name`, `group_order`, `min_selection_count`, `max_selection_count`, `is_required`, `notes`, `created_at`, `updated_at`, `order_index`) VALUES
  (1, 1, 'Protein Source', 1, 1, 1, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 1),
  (2, 1, 'Carbohydrate Source', 2, 1, 1, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 2),
  (3, 2, 'Main Lean Protein', 1, 1, 1, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 1),
  (4, 2, 'Starch / Grain Base', 2, 1, 1, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 2);
UNLOCK TABLES;

-- Table: diet_meal_options (8 rows)
LOCK TABLES `diet_meal_options` WRITE;
INSERT IGNORE INTO `diet_meal_options` (`id`, `diet_meal_option_group_id`, `food_id`, `option_order`, `label`, `quantity`, `unit_id`, `calories_snapshot`, `protein_g_snapshot`, `carbs_g_snapshot`, `fat_g_snapshot`, `fiber_g_snapshot`, `notes`, `is_active`, `created_at`, `updated_at`, `order_index`, `custom_label`, `serving_quantity`, `protein_snapshot`, `carbs_snapshot`, `fat_snapshot`) VALUES
  (1, 1, 4, 1, '3 Whole Large Eggs', 3, 6, 216, 18.9, 1.2, 14.4, NULL, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 1, NULL, NULL, NULL, NULL, NULL),
  (2, 1, 5, 2, '250g Liquid Egg Whites + 1 Whole Egg', 1, 1, 202, 33.5, 2.1, 5.3, NULL, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 2, NULL, NULL, NULL, NULL, NULL),
  (3, 2, 3, 1, '80g Rolled Oats', 80, 1, 311, 13.5, 53, 5.5, NULL, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 1, NULL, NULL, NULL, NULL, NULL),
  (4, 2, 9, 2, '2 Medium Bananas', 2, 6, 210, 2.6, 54, 0.6, NULL, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 2, NULL, NULL, NULL, NULL, NULL),
  (5, 3, 1, 1, '180g Grilled Chicken Breast', 180, 1, 297, 55.8, 0, 6.5, NULL, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 1, NULL, NULL, NULL, NULL, NULL),
  (6, 3, 11, 2, '180g Lean Ground Beef (93/7)', 180, 1, 274, 38.5, 0, 13.1, NULL, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 2, NULL, NULL, NULL, NULL, NULL),
  (7, 4, 2, 1, '200g Cooked Brown Rice', 200, 1, 222, 5.2, 46, 1.8, NULL, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 1, NULL, NULL, NULL, NULL, NULL),
  (8, 4, 12, 2, '250g Baked Sweet Potato', 250, 1, 225, 5, 51.7, 0.2, NULL, NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08', 2, NULL, NULL, NULL, NULL, NULL);
UNLOCK TABLES;

-- Table: user_diet_assignments (2 rows)
LOCK TABLES `user_diet_assignments` WRITE;
INSERT IGNORE INTO `user_diet_assignments` (`id`, `user_id`, `diet_plan_version_id`, `effective_from`, `effective_until`, `status`, `assignment_source`, `notes`, `assigned_by`, `created_at`, `updated_at`) VALUES
  (1, 2, 1, '2026-01-01', NULL, 'active', 'admin', NULL, 1, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 3, 1, '2026-01-01', NULL, 'active', 'admin', NULL, 1, '2026-09-03 23:23:11', '2026-09-03 23:23:11');
UNLOCK TABLES;

-- Table: daily_tasks (14 rows)
LOCK TABLES `daily_tasks` WRITE;
INSERT IGNORE INTO `daily_tasks` (`id`, `user_id`, `task_date`, `task_key`, `task_type`, `user_diet_assignment_id`, `user_workout_assignment_id`, `diet_meal_id`, `workout_plan_day_id`, `user_cardio_target_id`, `user_water_target_id`, `user_weight_goal_id`, `title_snapshot`, `description_snapshot`, `target_snapshot`, `scheduled_at`, `due_at`, `status`, `completed_at`, `created_at`, `updated_at`) VALUES
  (1, 3, '2026-09-04', 'weight', 'weight', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Log Morning Body Weight', NULL, NULL, '2026-09-04 08:00:00', '2026-09-04 12:00:00', 'pending', NULL, '2026-09-03 23:23:02', '2026-09-03 23:23:02'),
  (2, 3, '2026-09-04', 'water', 'water', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Hit Daily Water Goal', NULL, NULL, '2026-09-04 21:00:00', '2026-09-04 23:59:59', 'pending', NULL, '2026-09-03 23:23:26', '2026-09-03 23:23:26'),
  (3, 3, '2026-09-04', 'meal:1', 'meal', NULL, NULL, 1, NULL, NULL, NULL, NULL, 'Meal: Breakfast', NULL, NULL, '2026-09-04 08:00:00', '2026-09-04 09:00:00', 'pending', NULL, '2026-09-03 23:23:26', '2026-09-03 23:23:26'),
  (4, 3, '2026-09-04', 'meal:2', 'meal', NULL, NULL, 2, NULL, NULL, NULL, NULL, 'Meal: Lunch', NULL, NULL, '2026-09-04 12:30:00', '2026-09-04 13:30:00', 'pending', NULL, '2026-09-03 23:23:26', '2026-09-03 23:23:26'),
  (5, 3, '2026-09-04', 'meal:3', 'meal', NULL, NULL, 3, NULL, NULL, NULL, NULL, 'Meal: Pre-Workout Snack', NULL, NULL, '2026-09-04 16:00:00', '2026-09-04 17:00:00', 'pending', NULL, '2026-09-03 23:23:26', '2026-09-03 23:23:26'),
  (6, 3, '2026-09-04', 'meal:4', 'meal', NULL, NULL, 4, NULL, NULL, NULL, NULL, 'Meal: Dinner', NULL, NULL, '2026-09-04 19:30:00', '2026-09-04 20:30:00', 'pending', NULL, '2026-09-03 23:23:26', '2026-09-03 23:23:26'),
  (7, 3, '2026-09-04', 'workout:5', 'workout', NULL, NULL, NULL, 5, NULL, NULL, NULL, 'Workout: Lower Body B', NULL, NULL, '2026-09-04 17:00:00', '2026-09-04 23:59:59', 'pending', NULL, '2026-09-03 23:23:26', '2026-09-03 23:23:26'),
  (8, 3, '2026-09-04', 'cardio:2', 'cardio', NULL, NULL, NULL, NULL, 2, NULL, NULL, 'Cardio: Stationary Cycling', NULL, NULL, '2026-09-04 18:00:00', '2026-09-04 23:59:59', 'pending', NULL, '2026-09-03 23:23:26', '2026-09-03 23:23:26'),
  (9, 3, '2026-09-06', 'weight', 'weight', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Log Morning Body Weight', NULL, NULL, '2026-09-06 08:00:00', '2026-09-06 12:00:00', 'pending', NULL, '2026-09-06 13:34:46', '2026-09-06 13:34:46'),
  (10, 3, '2026-09-06', 'water', 'water', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Hit Daily Water Goal', NULL, NULL, '2026-09-06 21:00:00', '2026-09-06 23:59:59', 'pending', NULL, '2026-09-06 13:34:46', '2026-09-06 13:34:46'),
  (11, 3, '2026-09-06', 'meal:1', 'meal', NULL, NULL, 1, NULL, NULL, NULL, NULL, 'Meal: Breakfast', NULL, NULL, '2026-09-06 08:00:00', '2026-09-06 09:00:00', 'pending', NULL, '2026-09-06 13:34:46', '2026-09-06 13:34:46'),
  (12, 3, '2026-09-06', 'meal:2', 'meal', NULL, NULL, 2, NULL, NULL, NULL, NULL, 'Meal: Lunch', NULL, NULL, '2026-09-06 12:30:00', '2026-09-06 13:30:00', 'pending', NULL, '2026-09-06 13:34:46', '2026-09-06 13:34:46'),
  (13, 3, '2026-09-06', 'meal:3', 'meal', NULL, NULL, 3, NULL, NULL, NULL, NULL, 'Meal: Pre-Workout Snack', NULL, NULL, '2026-09-06 16:00:00', '2026-09-06 17:00:00', 'pending', NULL, '2026-09-06 13:34:46', '2026-09-06 13:34:46'),
  (14, 3, '2026-09-06', 'meal:4', 'meal', NULL, NULL, 4, NULL, NULL, NULL, NULL, 'Meal: Dinner', NULL, NULL, '2026-09-06 19:30:00', '2026-09-06 20:30:00', 'pending', NULL, '2026-09-06 13:34:46', '2026-09-06 13:34:46');
UNLOCK TABLES;

-- Table: reminder_rules (3 rows)
LOCK TABLES `reminder_rules` WRITE;
INSERT IGNORE INTO `reminder_rules` (`id`, `name`, `category`, `rule_scope`, `user_id`, `diet_meal_id`, `workout_plan_day_id`, `trigger_mode`, `fixed_time`, `offset_minutes`, `grace_period_minutes`, `repeat_interval_minutes`, `max_repeats`, `active_window_start`, `active_window_end`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES
  (1, 'Morning Weight Log', 'weight', 'user', NULL, NULL, NULL, 'fixed_time', '08:00:00', NULL, 0, NULL, 1, NULL, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (2, 'Hydration Reminder', 'water', 'user', NULL, NULL, NULL, 'interval', NULL, NULL, 0, NULL, 1, NULL, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08'),
  (3, 'Workout Time', 'workout', 'user', NULL, NULL, NULL, 'fixed_time', '17:00:00', NULL, 0, NULL, 1, NULL, NULL, 1, NULL, '2026-09-03 18:03:08', '2026-09-03 18:03:08');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- END OF DUMP
-- =====================================================================
