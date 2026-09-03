-- =====================================================================
-- FITNESS TRACKING PLATFORM
-- Complete MySQL 8.x Database Schema
-- =====================================================================
--
-- Architecture:
--   Backend: Node.js REST API
--   Admin:   React + Vite
--   Mobile:  Flutter
--   DB:      MySQL 8.x
--
-- Important:
--   - Configuration is separate from execution/history.
--   - Diet/workout plans are versioned.
--   - Published versions should be immutable at the application layer.
--   - Historical logs store snapshots where appropriate.
--   - User dates are resolved using users.timezone.
--   - Application/server/database environment should use UTC timestamps.
--
-- No personal seed data is included.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS fitness_platform
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE fitness_platform;

-- =====================================================================
-- 1. ROLES
-- =====================================================================

CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_roles_name UNIQUE (name)
) ENGINE=InnoDB;


-- =====================================================================
-- 2. USERS
-- =====================================================================

CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    role_id BIGINT UNSIGNED NOT NULL,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NULL,

    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    phone VARCHAR(50) NULL,

    date_of_birth DATE NULL,

    height_cm DECIMAL(6,2) NULL,

    gender ENUM(
        'male',
        'female',
        'other',
        'prefer_not_to_say'
    ) NULL,

    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',

    locale VARCHAR(20) NOT NULL DEFAULT 'en',

    status ENUM(
        'pending',
        'active',
        'disabled'
    ) NOT NULL DEFAULT 'active',

    security_version INT UNSIGNED NOT NULL DEFAULT 1,

    email_verified_at TIMESTAMP(3) NULL,

    unit_system VARCHAR(10) NOT NULL DEFAULT 'metric',

    last_login_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_users_email UNIQUE (email),

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_users_height
        CHECK (height_cm IS NULL OR height_cm BETWEEN 50 AND 300),

    INDEX idx_users_role (role_id),
    INDEX idx_users_status (status),
    INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB;


-- =====================================================================
-- 3. REFRESH TOKENS / SESSIONS
-- =====================================================================

CREATE TABLE user_refresh_tokens (
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

    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_refresh_tokens_rotated_from
        FOREIGN KEY (rotated_from_token_id)
        REFERENCES user_refresh_tokens(id)
        ON DELETE SET NULL,

    INDEX idx_refresh_tokens_user (user_id),
    INDEX idx_refresh_tokens_expires (expires_at),
    INDEX idx_refresh_tokens_revoked (revoked_at)
) ENGINE=InnoDB;


-- =====================================================================
-- 4. PASSWORD RESET TOKENS
-- =====================================================================

CREATE TABLE password_reset_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    token_hash CHAR(64) NOT NULL,

    expires_at TIMESTAMP(3) NOT NULL,
    used_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_password_reset_token UNIQUE (token_hash),

    CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_expires (expires_at)
) ENGINE=InnoDB;


CREATE TABLE auth_otp_challenges (
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
    CONSTRAINT fk_otp_challenges_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_otp_challenges_user (user_id, purpose),
    INDEX idx_otp_challenges_dest (destination_email, purpose)
) ENGINE=InnoDB;


CREATE TABLE user_email_change_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    new_email VARCHAR(255) NOT NULL,
    current_email_challenge_id VARCHAR(64) NOT NULL,
    new_email_challenge_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP(3) NOT NULL,
    completed_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_email_change_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_email_change_cur_challenge
        FOREIGN KEY (current_email_challenge_id)
        REFERENCES auth_otp_challenges(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_email_change_new_challenge
        FOREIGN KEY (new_email_challenge_id)
        REFERENCES auth_otp_challenges(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;


-- =====================================================================
-- 5. MOBILE PUSH DEVICES
-- =====================================================================

CREATE TABLE user_push_devices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    device_uuid VARCHAR(191) NOT NULL,

    platform ENUM(
        'ios',
        'android'
    ) NOT NULL,

    push_token VARCHAR(1000) NOT NULL,

    app_version VARCHAR(50) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_seen_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_user_push_device
        UNIQUE (user_id, device_uuid),

    CONSTRAINT fk_push_devices_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_push_devices_active (user_id, is_active)
) ENGINE=InnoDB;


-- =====================================================================
-- 6. SYSTEM SETTINGS
-- Semi-structured configuration is appropriate here.
-- =====================================================================

CREATE TABLE system_settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    setting_key VARCHAR(191) NOT NULL,

    setting_value JSON NOT NULL,

    description VARCHAR(500) NULL,

    updated_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_system_settings_key UNIQUE (setting_key),

    CONSTRAINT fk_system_settings_user
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB;


-- =====================================================================
-- 7. MEASUREMENT UNITS
-- =====================================================================

CREATE TABLE measurement_units (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,

    unit_type ENUM(
        'mass',
        'volume',
        'count',
        'serving',
        'distance',
        'time',
        'other'
    ) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_measurement_units_code UNIQUE (code)
) ENGINE=InnoDB;


-- =====================================================================
-- 8. MUSCLE GROUPS
-- =====================================================================

CREATE TABLE muscle_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_muscle_groups_name UNIQUE (name)
) ENGINE=InnoDB;


-- =====================================================================
-- 9. EQUIPMENT LIBRARY
-- =====================================================================

CREATE TABLE equipment_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_equipment_types_name UNIQUE (name)
) ENGINE=InnoDB;


-- =====================================================================
-- 10. EXERCISE LIBRARY
-- =====================================================================

CREATE TABLE exercises (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(191) NOT NULL,

    description TEXT NULL,

    equipment_type_id BIGINT UNSIGNED NULL,

    tracking_type ENUM(
        'weight_reps',
        'reps_only',
        'duration',
        'distance',
        'weight_duration',
        'custom'
    ) NOT NULL DEFAULT 'weight_reps',

    instructions TEXT NULL,

    video_url VARCHAR(1000) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_exercises_name UNIQUE (name),

    CONSTRAINT fk_exercises_equipment
        FOREIGN KEY (equipment_type_id)
        REFERENCES equipment_types(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_exercises_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_exercises_active (is_active),
    INDEX idx_exercises_tracking_type (tracking_type),
    INDEX idx_exercises_equipment (equipment_type_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 11. EXERCISE <-> MUSCLE GROUPS
-- =====================================================================

CREATE TABLE exercise_muscle_groups (
    exercise_id BIGINT UNSIGNED NOT NULL,
    muscle_group_id BIGINT UNSIGNED NOT NULL,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (exercise_id, muscle_group_id),

    CONSTRAINT fk_exercise_muscles_exercise
        FOREIGN KEY (exercise_id)
        REFERENCES exercises(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_exercise_muscles_group
        FOREIGN KEY (muscle_group_id)
        REFERENCES muscle_groups(id)
        ON DELETE CASCADE,

    INDEX idx_exercise_muscles_group (muscle_group_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 12. CARDIO ACTIVITY LIBRARY
-- =====================================================================

CREATE TABLE cardio_activities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    description VARCHAR(500) NULL,

    supports_speed BOOLEAN NOT NULL DEFAULT FALSE,
    supports_incline BOOLEAN NOT NULL DEFAULT FALSE,
    supports_distance BOOLEAN NOT NULL DEFAULT TRUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_cardio_activities_name UNIQUE (name)
) ENGINE=InnoDB;


-- =====================================================================
-- WORKOUT CONFIGURATION
-- =====================================================================

-- =====================================================================
-- 13. WORKOUT PLANS
-- Logical plan container.
-- =====================================================================

CREATE TABLE workout_plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(191) NOT NULL,

    description TEXT NULL,
    goal VARCHAR(500) NULL,

    status ENUM(
        'active',
        'archived'
    ) NOT NULL DEFAULT 'active',

    owner_user_id BIGINT UNSIGNED NULL,
    visibility ENUM('admin', 'private') NOT NULL DEFAULT 'admin',

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_workout_plans_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_workout_plans_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_workout_plans_status (status)
) ENGINE=InnoDB;


-- =====================================================================
-- 14. WORKOUT PLAN VERSIONS
-- =====================================================================

CREATE TABLE workout_plan_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    workout_plan_id BIGINT UNSIGNED NOT NULL,

    version_number INT UNSIGNED NOT NULL,

    status ENUM(
        'draft',
        'published',
        'archived'
    ) NOT NULL DEFAULT 'draft',

    change_notes TEXT NULL,

    published_at TIMESTAMP(3) NULL,

    created_by BIGINT UNSIGNED NULL,
    published_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_workout_plan_version
        UNIQUE (workout_plan_id, version_number),

    CONSTRAINT fk_workout_version_plan
        FOREIGN KEY (workout_plan_id)
        REFERENCES workout_plans(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_workout_version_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_workout_version_published_by
        FOREIGN KEY (published_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_workout_versions_status
        (workout_plan_id, status)
) ENGINE=InnoDB;


-- =====================================================================
-- 15. WORKOUT PLAN DAYS
-- weekday:
--   1 Monday
--   2 Tuesday
--   3 Wednesday
--   4 Thursday
--   5 Friday
--   6 Saturday
--   7 Sunday
-- =====================================================================

CREATE TABLE workout_plan_days (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    workout_plan_version_id BIGINT UNSIGNED NOT NULL,

    weekday TINYINT UNSIGNED NOT NULL,

    name VARCHAR(150) NOT NULL,

    description TEXT NULL,

    is_rest_day BOOLEAN NOT NULL DEFAULT FALSE,

    day_order INT UNSIGNED NOT NULL DEFAULT 1,

    notes TEXT NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_workout_version_weekday
        UNIQUE (workout_plan_version_id, weekday),

    CONSTRAINT fk_workout_days_version
        FOREIGN KEY (workout_plan_version_id)
        REFERENCES workout_plan_versions(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_workout_days_weekday
        CHECK (weekday BETWEEN 1 AND 7),

    INDEX idx_workout_days_version
        (workout_plan_version_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 16. WORKOUT PLAN EXERCISES
-- Snapshot columns protect historical plan display if library metadata changes.
-- =====================================================================

CREATE TABLE workout_plan_exercises (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    workout_plan_day_id BIGINT UNSIGNED NOT NULL,
    exercise_id BIGINT UNSIGNED NOT NULL,

    exercise_order INT UNSIGNED NOT NULL,

    exercise_name_snapshot VARCHAR(191) NOT NULL,

    tracking_type_snapshot ENUM(
        'weight_reps',
        'reps_only',
        'duration',
        'distance',
        'weight_duration',
        'custom'
    ) NOT NULL,

    target_sets INT UNSIGNED NOT NULL,

    target_reps_min INT UNSIGNED NULL,
    target_reps_max INT UNSIGNED NULL,

    target_duration_seconds INT UNSIGNED NULL,

    target_distance_meters DECIMAL(10,2) NULL,

    rest_seconds INT UNSIGNED NULL,

    notes TEXT NULL,

    is_optional BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_workout_day_exercise_order
        UNIQUE (workout_plan_day_id, exercise_order),

    CONSTRAINT fk_workout_plan_exercises_day
        FOREIGN KEY (workout_plan_day_id)
        REFERENCES workout_plan_days(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_workout_plan_exercises_library
        FOREIGN KEY (exercise_id)
        REFERENCES exercises(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_workout_target_sets
        CHECK (target_sets > 0),

    CONSTRAINT chk_workout_rep_range
        CHECK (
            target_reps_min IS NULL
            OR target_reps_max IS NULL
            OR target_reps_max >= target_reps_min
        ),

    INDEX idx_workout_plan_exercises_day
        (workout_plan_day_id),

    INDEX idx_workout_plan_exercises_exercise
        (exercise_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 17. OPTIONAL PER-SET WORKOUT CONFIGURATION
-- If no rows exist here, workout_plan_exercises generic targets apply.
-- =====================================================================

CREATE TABLE workout_plan_exercise_sets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    workout_plan_exercise_id BIGINT UNSIGNED NOT NULL,

    set_number INT UNSIGNED NOT NULL,

    target_reps_min INT UNSIGNED NULL,
    target_reps_max INT UNSIGNED NULL,

    target_weight_kg DECIMAL(8,2) NULL,

    target_duration_seconds INT UNSIGNED NULL,

    target_distance_meters DECIMAL(10,2) NULL,

    rest_seconds INT UNSIGNED NULL,

    notes VARCHAR(1000) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_workout_plan_specific_set
        UNIQUE (workout_plan_exercise_id, set_number),

    CONSTRAINT fk_workout_specific_sets_exercise
        FOREIGN KEY (workout_plan_exercise_id)
        REFERENCES workout_plan_exercises(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_workout_specific_set_number
        CHECK (set_number > 0),

    CONSTRAINT chk_workout_specific_rep_range
        CHECK (
            target_reps_min IS NULL
            OR target_reps_max IS NULL
            OR target_reps_max >= target_reps_min
        )
) ENGINE=InnoDB;


-- =====================================================================
-- DIET CONFIGURATION
-- =====================================================================

-- =====================================================================
-- 18. DIET PLANS
-- =====================================================================

CREATE TABLE diet_plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(191) NOT NULL,

    description TEXT NULL,

    status ENUM(
        'active',
        'archived'
    ) NOT NULL DEFAULT 'active',

    owner_user_id BIGINT UNSIGNED NULL,
    visibility ENUM('admin', 'private') NOT NULL DEFAULT 'admin',

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_diet_plans_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_diet_plans_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_diet_plans_status (status)
) ENGINE=InnoDB;


-- =====================================================================
-- 19. DIET PLAN VERSIONS
-- =====================================================================

CREATE TABLE diet_plan_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    diet_plan_id BIGINT UNSIGNED NOT NULL,

    version_number INT UNSIGNED NOT NULL,

    status ENUM(
        'draft',
        'published',
        'archived'
    ) NOT NULL DEFAULT 'draft',

    daily_calorie_target DECIMAL(8,2) NULL,
    daily_protein_target_g DECIMAL(8,2) NULL,
    daily_carbs_target_g DECIMAL(8,2) NULL,
    daily_fat_target_g DECIMAL(8,2) NULL,

    change_notes TEXT NULL,

    published_at TIMESTAMP(3) NULL,

    created_by BIGINT UNSIGNED NULL,
    published_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_diet_plan_version
        UNIQUE (diet_plan_id, version_number),

    CONSTRAINT fk_diet_version_plan
        FOREIGN KEY (diet_plan_id)
        REFERENCES diet_plans(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_diet_version_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_diet_version_published_by
        FOREIGN KEY (published_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_diet_versions_status
        (diet_plan_id, status)
) ENGINE=InnoDB;


-- =====================================================================
-- 20. FOOD LIBRARY
-- =====================================================================

CREATE TABLE foods (
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
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_foods_unit
        FOREIGN KEY (reference_unit_id)
        REFERENCES measurement_units(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_foods_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_food_reference_quantity
        CHECK (
            reference_quantity IS NULL
            OR reference_quantity > 0
        ),

    INDEX idx_foods_name (name),
    INDEX idx_foods_active (is_active)
) ENGINE=InnoDB;


-- =====================================================================
-- 21. DIET MEALS
-- scheduled_time is interpreted in the user's configured timezone.
-- =====================================================================

CREATE TABLE diet_meals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    diet_plan_version_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(150) NOT NULL,

    meal_order INT UNSIGNED NOT NULL,

    scheduled_time TIME NULL,

    default_grace_minutes INT UNSIGNED NOT NULL DEFAULT 60,

    description TEXT NULL,

    is_required BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_diet_version_meal_order
        UNIQUE (diet_plan_version_id, meal_order),

    CONSTRAINT fk_diet_meals_version
        FOREIGN KEY (diet_plan_version_id)
        REFERENCES diet_plan_versions(id)
        ON DELETE CASCADE,

    INDEX idx_diet_meals_version
        (diet_plan_version_id),

    INDEX idx_diet_meals_schedule
        (scheduled_time)
) ENGINE=InnoDB;


-- =====================================================================
-- 22. DIET MEAL OPTION GROUPS
-- Example:
--   Group = Protein
--   min_selection_count = 1
--   max_selection_count = 1
-- =====================================================================

CREATE TABLE diet_meal_option_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    diet_meal_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(150) NOT NULL,

    group_order INT UNSIGNED NOT NULL,

    min_selection_count INT UNSIGNED NOT NULL DEFAULT 0,
    max_selection_count INT UNSIGNED NULL,

    is_required BOOLEAN NOT NULL DEFAULT FALSE,

    notes VARCHAR(1000) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_meal_group_order
        UNIQUE (diet_meal_id, group_order),

    CONSTRAINT fk_meal_groups_meal
        FOREIGN KEY (diet_meal_id)
        REFERENCES diet_meals(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_option_group_selection
        CHECK (
            max_selection_count IS NULL
            OR max_selection_count >= min_selection_count
        ),

    INDEX idx_meal_option_groups_meal
        (diet_meal_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 23. DIET MEAL OPTIONS
--
-- food_id is optional.
--
-- This allows composite options such as:
-- "2 whole eggs + 3 egg whites"
--
-- without requiring the choice to represent one food-library row.
-- =====================================================================

CREATE TABLE diet_meal_options (
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
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_meal_option_order
        UNIQUE (diet_meal_option_group_id, option_order),

    CONSTRAINT fk_meal_options_group
        FOREIGN KEY (diet_meal_option_group_id)
        REFERENCES diet_meal_option_groups(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_meal_options_food
        FOREIGN KEY (food_id)
        REFERENCES foods(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_meal_options_unit
        FOREIGN KEY (unit_id)
        REFERENCES measurement_units(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_meal_option_quantity
        CHECK (
            quantity IS NULL
            OR quantity > 0
        ),

    INDEX idx_meal_options_group
        (diet_meal_option_group_id),

    INDEX idx_meal_options_food
        (food_id)
) ENGINE=InnoDB;


-- =====================================================================
-- PLAN ASSIGNMENTS
-- =====================================================================

-- =====================================================================
-- 24. USER WORKOUT ASSIGNMENTS
-- =====================================================================

CREATE TABLE user_workout_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    workout_plan_version_id BIGINT UNSIGNED NOT NULL,

    effective_from DATE NOT NULL,
    effective_until DATE NULL,

    status ENUM(
        'active',
        'ended',
        'cancelled'
    ) NOT NULL DEFAULT 'active',

    assignment_source ENUM('admin', 'self_service') NOT NULL DEFAULT 'admin',

    assigned_by BIGINT UNSIGNED NULL,

    notes TEXT NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_user_workout_assignment_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_workout_assignment_version
        FOREIGN KEY (workout_plan_version_id)
        REFERENCES workout_plan_versions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_workout_assignment_admin
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_user_workout_assignment_dates
        CHECK (
            effective_until IS NULL
            OR effective_until >= effective_from
        ),

    INDEX idx_user_workout_assignment_lookup
        (user_id, status, effective_from, effective_until),

    INDEX idx_user_workout_assignment_version
        (workout_plan_version_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 25. USER DIET ASSIGNMENTS
-- =====================================================================

CREATE TABLE user_diet_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    diet_plan_version_id BIGINT UNSIGNED NOT NULL,

    effective_from DATE NOT NULL,
    effective_until DATE NULL,

    status ENUM(
        'active',
        'ended',
        'cancelled'
    ) NOT NULL DEFAULT 'active',

    assignment_source ENUM('admin', 'self_service') NOT NULL DEFAULT 'admin',

    assigned_by BIGINT UNSIGNED NULL,

    notes TEXT NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_user_diet_assignment_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_diet_assignment_version
        FOREIGN KEY (diet_plan_version_id)
        REFERENCES diet_plan_versions(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_diet_assignment_admin
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_user_diet_assignment_dates
        CHECK (
            effective_until IS NULL
            OR effective_until >= effective_from
        ),

    INDEX idx_user_diet_assignment_lookup
        (user_id, status, effective_from, effective_until),

    INDEX idx_user_diet_assignment_version
        (diet_plan_version_id)
) ENGINE=InnoDB;


-- =====================================================================
-- USER TARGETS / GOALS
-- =====================================================================

-- =====================================================================
-- 26. WEIGHT GOALS
-- =====================================================================

CREATE TABLE user_weight_goals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    goal_type VARCHAR(30) NULL DEFAULT 'lose_weight',

    starting_weight_kg DECIMAL(6,2) NOT NULL,
    target_weight_kg DECIMAL(6,2) NOT NULL,

    start_date DATE NOT NULL,
    target_date DATE NULL,

    status ENUM(
        'active',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'active',

    notes TEXT NULL,

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_weight_goals_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_weight_goals_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_weight_goal_start
        CHECK (starting_weight_kg BETWEEN 20 AND 500),

    CONSTRAINT chk_weight_goal_target
        CHECK (target_weight_kg BETWEEN 20 AND 500),

    INDEX idx_weight_goals_user_status
        (user_id, status)
) ENGINE=InnoDB;


-- =====================================================================
-- 27. WATER TARGETS
-- =====================================================================

CREATE TABLE user_water_targets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    target_ml INT UNSIGNED NOT NULL,

    effective_from DATE NOT NULL,
    effective_until DATE NULL,

    status ENUM(
        'active',
        'ended',
        'cancelled'
    ) NOT NULL DEFAULT 'active',

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_water_targets_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_water_targets_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_water_target_amount
        CHECK (target_ml BETWEEN 1 AND 20000),

    CONSTRAINT chk_water_target_dates
        CHECK (
            effective_until IS NULL
            OR effective_until >= effective_from
        ),

    INDEX idx_water_targets_lookup
        (user_id, status, effective_from, effective_until)
) ENGINE=InnoDB;


-- =====================================================================
-- 28. USER WATER QUICK-ADD OPTIONS
-- =====================================================================

CREATE TABLE user_water_quick_add_options (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    amount_ml INT UNSIGNED NOT NULL,

    display_order INT UNSIGNED NOT NULL DEFAULT 1,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_user_water_quick_amount
        UNIQUE (user_id, amount_ml),

    CONSTRAINT fk_water_quick_options_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_water_quick_amount
        CHECK (amount_ml BETWEEN 1 AND 5000),

    INDEX idx_water_quick_options_order
        (user_id, is_active, display_order)
) ENGINE=InnoDB;


-- =====================================================================
-- 29. CARDIO TARGETS
-- =====================================================================

CREATE TABLE user_cardio_targets (
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

    status ENUM(
        'active',
        'ended',
        'cancelled'
    ) NOT NULL DEFAULT 'active',

    notes TEXT NULL,

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_cardio_targets_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cardio_targets_activity
        FOREIGN KEY (cardio_activity_id)
        REFERENCES cardio_activities(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_cardio_targets_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_cardio_minutes_range
        CHECK (
            target_minutes_min IS NULL
            OR target_minutes_max IS NULL
            OR target_minutes_max >= target_minutes_min
        ),

    CONSTRAINT chk_cardio_speed_range
        CHECK (
            target_speed_min_kmh IS NULL
            OR target_speed_max_kmh IS NULL
            OR target_speed_max_kmh >= target_speed_min_kmh
        ),

    CONSTRAINT chk_cardio_incline_range
        CHECK (
            target_incline_min IS NULL
            OR target_incline_max IS NULL
            OR target_incline_max >= target_incline_min
        ),

    CONSTRAINT chk_cardio_distance_range
        CHECK (
            target_distance_min_km IS NULL
            OR target_distance_max_km IS NULL
            OR target_distance_max_km >= target_distance_min_km
        ),

    CONSTRAINT chk_cardio_target_dates
        CHECK (
            effective_until IS NULL
            OR effective_until >= effective_from
        ),

    INDEX idx_cardio_targets_lookup
        (user_id, status, effective_from, effective_until)
) ENGINE=InnoDB;


-- =====================================================================
-- 30. CARDIO TARGET DAYS
-- =====================================================================

CREATE TABLE user_cardio_target_days (
    user_cardio_target_id BIGINT UNSIGNED NOT NULL,

    weekday TINYINT UNSIGNED NOT NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (user_cardio_target_id, weekday),

    CONSTRAINT fk_cardio_target_days_target
        FOREIGN KEY (user_cardio_target_id)
        REFERENCES user_cardio_targets(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_cardio_target_day
        CHECK (weekday BETWEEN 1 AND 7)
) ENGINE=InnoDB;


-- =====================================================================
-- 31. ADHERENCE SCORE CONFIGURATION
-- Percentages should total 100.
-- =====================================================================

CREATE TABLE user_adherence_configs (
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
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_adherence_config_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_adherence_total
        CHECK (
            ROUND(
                diet_weight_pct +
                workout_weight_pct +
                cardio_weight_pct +
                water_weight_pct +
                weight_logging_weight_pct,
                2
            ) = 100.00
        ),

    CONSTRAINT chk_adherence_dates
        CHECK (
            effective_until IS NULL
            OR effective_until >= effective_from
        ),

    INDEX idx_adherence_config_lookup
        (user_id, is_active, effective_from, effective_until)
) ENGINE=InnoDB;


-- =====================================================================
-- NOTIFICATIONS / REMINDERS
-- =====================================================================

-- =====================================================================
-- 32. USER NOTIFICATION SETTINGS
-- =====================================================================

CREATE TABLE user_notification_settings (
    user_id BIGINT UNSIGNED PRIMARY KEY,

    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    local_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    quiet_hours_start TIME NULL,
    quiet_hours_end TIME NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_notification_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;


-- =====================================================================
-- 33. USER NOTIFICATION CATEGORY PREFERENCES
-- =====================================================================

CREATE TABLE user_notification_preferences (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    category ENUM(
        'meal',
        'workout',
        'cardio',
        'water',
        'weight',
        'progress',
        'system'
    ) NOT NULL,

    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_user_notification_category
        UNIQUE (user_id, category),

    CONSTRAINT fk_notification_preferences_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;


-- =====================================================================
-- 34. REMINDER RULES
-- =====================================================================

CREATE TABLE reminder_rules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(191) NOT NULL,

    category ENUM(
        'meal',
        'workout',
        'cardio',
        'water',
        'weight'
    ) NOT NULL,

    rule_scope ENUM(
        'system',
        'user',
        'meal',
        'workout_day'
    ) NOT NULL,

    user_id BIGINT UNSIGNED NULL,

    diet_meal_id BIGINT UNSIGNED NULL,

    workout_plan_day_id BIGINT UNSIGNED NULL,

    trigger_mode ENUM(
        'fixed_time',
        'relative_to_task',
        'interval'
    ) NOT NULL,

    fixed_time TIME NULL,

    offset_minutes INT NULL,

    grace_period_minutes INT UNSIGNED NOT NULL DEFAULT 0,

    repeat_interval_minutes INT UNSIGNED NULL,

    max_repeats INT UNSIGNED NOT NULL DEFAULT 1,

    active_window_start TIME NULL,
    active_window_end TIME NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_reminder_rules_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reminder_rules_meal
        FOREIGN KEY (diet_meal_id)
        REFERENCES diet_meals(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reminder_rules_workout_day
        FOREIGN KEY (workout_plan_day_id)
        REFERENCES workout_plan_days(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_reminder_rules_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_reminder_max_repeats
        CHECK (max_repeats > 0),

    INDEX idx_reminder_rules_category
        (category, is_active),

    INDEX idx_reminder_rules_user
        (user_id, is_active),

    INDEX idx_reminder_rules_meal
        (diet_meal_id),

    INDEX idx_reminder_rules_workout_day
        (workout_plan_day_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 35. REMINDER RULE WEEKDAYS
-- Empty means all applicable days.
-- =====================================================================

CREATE TABLE reminder_rule_weekdays (
    reminder_rule_id BIGINT UNSIGNED NOT NULL,

    weekday TINYINT UNSIGNED NOT NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (reminder_rule_id, weekday),

    CONSTRAINT fk_reminder_weekdays_rule
        FOREIGN KEY (reminder_rule_id)
        REFERENCES reminder_rules(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_reminder_weekday
        CHECK (weekday BETWEEN 1 AND 7)
) ENGINE=InnoDB;


-- =====================================================================
-- DAILY PLAN / DAILY TASK ENGINE
-- =====================================================================

-- =====================================================================
-- 36. DAILY TASKS
--
-- Generated by the daily-plan engine.
--
-- task_key examples:
--   weight
--   water
--   meal:123
--   workout:55
--   cardio:21
--
-- target_snapshot is intentionally JSON because different task categories
-- have different target structures.
-- =====================================================================

CREATE TABLE daily_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    task_date DATE NOT NULL,

    task_key VARCHAR(191) NOT NULL,

    task_type ENUM(
        'weight',
        'meal',
        'workout',
        'cardio',
        'water'
    ) NOT NULL,

    user_diet_assignment_id BIGINT UNSIGNED NULL,
    user_workout_assignment_id BIGINT UNSIGNED NULL,

    diet_meal_id BIGINT UNSIGNED NULL,
    workout_plan_day_id BIGINT UNSIGNED NULL,
    user_cardio_target_id BIGINT UNSIGNED NULL,
    user_water_target_id BIGINT UNSIGNED NULL,
    user_weight_goal_id BIGINT UNSIGNED NULL,

    title_snapshot VARCHAR(255) NOT NULL,
    description_snapshot TEXT NULL,

    target_snapshot JSON NULL,

    scheduled_at TIMESTAMP(3) NULL,
    due_at TIMESTAMP(3) NULL,

    status ENUM(
        'pending',
        'in_progress',
        'completed',
        'skipped',
        'missed',
        'not_required'
    ) NOT NULL DEFAULT 'pending',

    completed_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_daily_task
        UNIQUE (user_id, task_date, task_key),

    CONSTRAINT fk_daily_tasks_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_daily_tasks_diet_assignment
        FOREIGN KEY (user_diet_assignment_id)
        REFERENCES user_diet_assignments(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_daily_tasks_workout_assignment
        FOREIGN KEY (user_workout_assignment_id)
        REFERENCES user_workout_assignments(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_daily_tasks_meal
        FOREIGN KEY (diet_meal_id)
        REFERENCES diet_meals(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_daily_tasks_workout_day
        FOREIGN KEY (workout_plan_day_id)
        REFERENCES workout_plan_days(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_daily_tasks_cardio_target
        FOREIGN KEY (user_cardio_target_id)
        REFERENCES user_cardio_targets(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_daily_tasks_water_target
        FOREIGN KEY (user_water_target_id)
        REFERENCES user_water_targets(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_daily_tasks_weight_goal
        FOREIGN KEY (user_weight_goal_id)
        REFERENCES user_weight_goals(id)
        ON DELETE SET NULL,

    INDEX idx_daily_tasks_user_date
        (user_id, task_date),

    INDEX idx_daily_tasks_due
        (status, due_at),

    INDEX idx_daily_tasks_type
        (user_id, task_date, task_type, status)
) ENGINE=InnoDB;


-- =====================================================================
-- EXECUTION / TRACKING
-- =====================================================================

-- =====================================================================
-- 37. BODY WEIGHT ENTRIES
-- One official daily measurement per user.
-- =====================================================================

CREATE TABLE body_weight_entries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    measurement_date DATE NOT NULL,

    weight_kg DECIMAL(6,2) NOT NULL,

    measured_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    notes TEXT NULL,

    source ENUM(
        'manual',
        'admin',
        'import'
    ) NOT NULL DEFAULT 'manual',

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_body_weight_user_date
        UNIQUE (user_id, measurement_date),

    CONSTRAINT fk_body_weight_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_body_weight_value
        CHECK (weight_kg BETWEEN 20 AND 500),

    INDEX idx_body_weight_history
        (user_id, measurement_date)
) ENGINE=InnoDB;


-- =====================================================================
-- 38. WATER ENTRIES
-- Individual events instead of one mutable daily total.
-- =====================================================================

CREATE TABLE water_entries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    user_water_target_id BIGINT UNSIGNED NULL,

    intake_date DATE NOT NULL,

    amount_ml INT UNSIGNED NOT NULL,

    recorded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    source ENUM(
        'manual',
        'quick_add',
        'admin',
        'sync'
    ) NOT NULL DEFAULT 'manual',

    notes VARCHAR(1000) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_water_entries_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_water_entries_target
        FOREIGN KEY (user_water_target_id)
        REFERENCES user_water_targets(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_water_entry_amount
        CHECK (amount_ml BETWEEN 1 AND 10000),

    INDEX idx_water_entries_user_date
        (user_id, intake_date),

    INDEX idx_water_entries_recorded
        (user_id, recorded_at)
) ENGINE=InnoDB;


-- =====================================================================
-- 39. CARDIO LOGS
-- Multiple cardio sessions per day are supported.
-- =====================================================================

CREATE TABLE cardio_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    user_cardio_target_id BIGINT UNSIGNED NULL,

    cardio_activity_id BIGINT UNSIGNED NULL,

    cardio_date DATE NOT NULL,

    activity_name_snapshot VARCHAR(191) NOT NULL,

    duration_minutes INT UNSIGNED NOT NULL,

    distance_km DECIMAL(10,3) NULL,

    speed_kmh DECIMAL(8,2) NULL,

    incline DECIMAL(8,2) NULL,

    calories_burned DECIMAL(10,2) NULL,

    started_at TIMESTAMP(3) NULL,
    completed_at TIMESTAMP(3) NULL,

    notes TEXT NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_cardio_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cardio_logs_target
        FOREIGN KEY (user_cardio_target_id)
        REFERENCES user_cardio_targets(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_cardio_logs_activity
        FOREIGN KEY (cardio_activity_id)
        REFERENCES cardio_activities(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_cardio_log_duration
        CHECK (duration_minutes > 0),

    INDEX idx_cardio_logs_user_date
        (user_id, cardio_date)
) ENGINE=InnoDB;


-- =====================================================================
-- 40. MEAL LOGS
-- =====================================================================

CREATE TABLE meal_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    user_diet_assignment_id BIGINT UNSIGNED NULL,

    diet_plan_version_id BIGINT UNSIGNED NULL,

    diet_meal_id BIGINT UNSIGNED NULL,

    meal_date DATE NOT NULL,

    meal_name_snapshot VARCHAR(191) NOT NULL,

    scheduled_time_snapshot TIME NULL,

    status ENUM(
        'completed',
        'partial',
        'skipped'
    ) NOT NULL,

    actual_calories DECIMAL(10,2) NULL,
    actual_protein_g DECIMAL(10,2) NULL,
    actual_carbs_g DECIMAL(10,2) NULL,
    actual_fat_g DECIMAL(10,2) NULL,

    notes TEXT NULL,

    completed_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_user_meal_daily
        UNIQUE (user_id, diet_meal_id, meal_date),

    CONSTRAINT fk_meal_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_meal_logs_assignment
        FOREIGN KEY (user_diet_assignment_id)
        REFERENCES user_diet_assignments(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_meal_logs_plan_version
        FOREIGN KEY (diet_plan_version_id)
        REFERENCES diet_plan_versions(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_meal_logs_meal
        FOREIGN KEY (diet_meal_id)
        REFERENCES diet_meals(id)
        ON DELETE SET NULL,

    INDEX idx_meal_logs_user_date
        (user_id, meal_date),

    INDEX idx_meal_logs_status
        (user_id, meal_date, status)
) ENGINE=InnoDB;


-- =====================================================================
-- 41. MEAL LOG SELECTIONS
-- Snapshot the selected option.
-- =====================================================================

CREATE TABLE meal_log_selections (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    meal_log_id BIGINT UNSIGNED NOT NULL,

    diet_meal_option_group_id BIGINT UNSIGNED NULL,
    diet_meal_option_id BIGINT UNSIGNED NULL,

    group_name_snapshot VARCHAR(191) NULL,
    option_label_snapshot VARCHAR(255) NOT NULL,

    quantity_snapshot DECIMAL(10,3) NULL,
    unit_code_snapshot VARCHAR(30) NULL,

    calories_snapshot DECIMAL(10,2) NULL,
    protein_g_snapshot DECIMAL(10,2) NULL,
    carbs_g_snapshot DECIMAL(10,2) NULL,
    fat_g_snapshot DECIMAL(10,2) NULL,
    fiber_g_snapshot DECIMAL(10,2) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_meal_selections_log
        FOREIGN KEY (meal_log_id)
        REFERENCES meal_logs(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_meal_selections_group
        FOREIGN KEY (diet_meal_option_group_id)
        REFERENCES diet_meal_option_groups(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_meal_selections_option
        FOREIGN KEY (diet_meal_option_id)
        REFERENCES diet_meal_options(id)
        ON DELETE SET NULL,

    INDEX idx_meal_selections_log
        (meal_log_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 42. WORKOUT SESSIONS
-- Supports planned and manual workouts.
-- =====================================================================

CREATE TABLE workout_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    source_type ENUM(
        'planned',
        'manual'
    ) NOT NULL DEFAULT 'planned',

    user_workout_assignment_id BIGINT UNSIGNED NULL,

    workout_plan_version_id BIGINT UNSIGNED NULL,

    workout_plan_day_id BIGINT UNSIGNED NULL,

    workout_date DATE NOT NULL,

    workout_name_snapshot VARCHAR(191) NOT NULL,

    status ENUM(
        'pending',
        'in_progress',
        'completed',
        'skipped'
    ) NOT NULL DEFAULT 'pending',

    started_at TIMESTAMP(3) NULL,
    completed_at TIMESTAMP(3) NULL,

    notes TEXT NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_planned_workout_session
        UNIQUE (
            user_id,
            workout_date,
            workout_plan_day_id
        ),

    CONSTRAINT fk_workout_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_workout_sessions_assignment
        FOREIGN KEY (user_workout_assignment_id)
        REFERENCES user_workout_assignments(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_workout_sessions_version
        FOREIGN KEY (workout_plan_version_id)
        REFERENCES workout_plan_versions(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_workout_sessions_day
        FOREIGN KEY (workout_plan_day_id)
        REFERENCES workout_plan_days(id)
        ON DELETE SET NULL,

    INDEX idx_workout_sessions_user_date
        (user_id, workout_date),

    INDEX idx_workout_sessions_status
        (user_id, status, workout_date)
) ENGINE=InnoDB;


-- =====================================================================
-- 43. WORKOUT SESSION EXERCISES
-- Planned targets are snapshotted into each session.
-- =====================================================================

CREATE TABLE workout_session_exercises (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    workout_session_id BIGINT UNSIGNED NOT NULL,

    workout_plan_exercise_id BIGINT UNSIGNED NULL,

    exercise_id BIGINT UNSIGNED NULL,

    exercise_order INT UNSIGNED NOT NULL,

    exercise_name_snapshot VARCHAR(191) NOT NULL,

    tracking_type_snapshot ENUM(
        'weight_reps',
        'reps_only',
        'duration',
        'distance',
        'weight_duration',
        'custom'
    ) NOT NULL,

    planned_sets_snapshot INT UNSIGNED NULL,

    planned_reps_min_snapshot INT UNSIGNED NULL,
    planned_reps_max_snapshot INT UNSIGNED NULL,

    planned_rest_seconds_snapshot INT UNSIGNED NULL,

    status ENUM(
        'pending',
        'in_progress',
        'completed',
        'skipped'
    ) NOT NULL DEFAULT 'pending',

    notes TEXT NULL,

    started_at TIMESTAMP(3) NULL,
    completed_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_workout_session_exercise_order
        UNIQUE (workout_session_id, exercise_order),

    CONSTRAINT fk_session_exercises_session
        FOREIGN KEY (workout_session_id)
        REFERENCES workout_sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_session_exercises_plan
        FOREIGN KEY (workout_plan_exercise_id)
        REFERENCES workout_plan_exercises(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_session_exercises_library
        FOREIGN KEY (exercise_id)
        REFERENCES exercises(id)
        ON DELETE SET NULL,

    INDEX idx_session_exercises_session
        (workout_session_id),

    INDEX idx_session_exercises_library
        (exercise_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 44. WORKOUT SETS
-- This is the core progressive-overload history table.
-- =====================================================================

CREATE TABLE workout_sets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    workout_session_exercise_id BIGINT UNSIGNED NOT NULL,

    set_number INT UNSIGNED NOT NULL,

    set_type ENUM(
        'warmup',
        'working',
        'drop',
        'backoff',
        'other'
    ) NOT NULL DEFAULT 'working',

    weight_kg DECIMAL(8,2) NULL,

    reps INT UNSIGNED NULL,

    duration_seconds INT UNSIGNED NULL,

    distance_meters DECIMAL(10,2) NULL,

    completed BOOLEAN NOT NULL DEFAULT TRUE,

    notes VARCHAR(1000) NULL,

    performed_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_workout_session_set
        UNIQUE (
            workout_session_exercise_id,
            set_number
        ),

    CONSTRAINT fk_workout_sets_session_exercise
        FOREIGN KEY (workout_session_exercise_id)
        REFERENCES workout_session_exercises(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_workout_set_number
        CHECK (set_number > 0),

    CONSTRAINT chk_workout_set_weight
        CHECK (
            weight_kg IS NULL
            OR weight_kg >= 0
        ),

    INDEX idx_workout_sets_exercise
        (workout_session_exercise_id)
) ENGINE=InnoDB;


-- =====================================================================
-- 45. NOTIFICATIONS
-- Logical notification record.
-- =====================================================================

CREATE TABLE notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    daily_task_id BIGINT UNSIGNED NULL,

    reminder_rule_id BIGINT UNSIGNED NULL,

    category ENUM(
        'meal',
        'workout',
        'cardio',
        'water',
        'weight',
        'progress',
        'system'
    ) NOT NULL,

    notification_type VARCHAR(100) NOT NULL,

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    deep_link VARCHAR(500) NULL,

    dedupe_key VARCHAR(191) NULL,

    scheduled_at TIMESTAMP(3) NULL,

    status ENUM(
        'unread',
        'read',
        'dismissed',
        'expired'
    ) NOT NULL DEFAULT 'unread',

    read_at TIMESTAMP(3) NULL,
    dismissed_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_notification_dedupe
        UNIQUE (user_id, dedupe_key),

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notifications_task
        FOREIGN KEY (daily_task_id)
        REFERENCES daily_tasks(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_notifications_rule
        FOREIGN KEY (reminder_rule_id)
        REFERENCES reminder_rules(id)
        ON DELETE SET NULL,

    INDEX idx_notifications_user_status
        (user_id, status, created_at),

    INDEX idx_notifications_scheduled
        (scheduled_at)
) ENGINE=InnoDB;


-- =====================================================================
-- 46. NOTIFICATION DELIVERY ATTEMPTS
-- Tracks push/in-app/local delivery separately.
-- =====================================================================

CREATE TABLE notification_deliveries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    notification_id BIGINT UNSIGNED NOT NULL,

    user_push_device_id BIGINT UNSIGNED NULL,

    channel ENUM(
        'in_app',
        'push',
        'local'
    ) NOT NULL,

    status ENUM(
        'pending',
        'sent',
        'delivered',
        'failed',
        'skipped'
    ) NOT NULL DEFAULT 'pending',

    provider_message_id VARCHAR(500) NULL,

    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,

    last_error TEXT NULL,

    sent_at TIMESTAMP(3) NULL,
    delivered_at TIMESTAMP(3) NULL,

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT fk_notification_delivery_notification
        FOREIGN KEY (notification_id)
        REFERENCES notifications(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notification_delivery_device
        FOREIGN KEY (user_push_device_id)
        REFERENCES user_push_devices(id)
        ON DELETE SET NULL,

    INDEX idx_notification_delivery_pending
        (status, created_at),

    INDEX idx_notification_delivery_notification
        (notification_id)
) ENGINE=InnoDB;


-- =====================================================================
-- ANALYTICS / PROGRESS
-- =====================================================================

-- =====================================================================
-- 47. USER DAILY SUMMARIES
--
-- These are derived/cache-style records.
-- Source logs remain authoritative.
-- =====================================================================

CREATE TABLE user_daily_summaries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    summary_date DATE NOT NULL,

    weight_kg DECIMAL(6,2) NULL,

    meals_expected INT UNSIGNED NOT NULL DEFAULT 0,
    meals_completed INT UNSIGNED NOT NULL DEFAULT 0,
    meals_partial INT UNSIGNED NOT NULL DEFAULT 0,
    meals_skipped INT UNSIGNED NOT NULL DEFAULT 0,

    workout_expected BOOLEAN NOT NULL DEFAULT FALSE,
    workout_completed BOOLEAN NOT NULL DEFAULT FALSE,

    cardio_target_minutes INT UNSIGNED NULL,
    cardio_actual_minutes INT UNSIGNED NOT NULL DEFAULT 0,

    water_target_ml INT UNSIGNED NULL,
    water_actual_ml INT UNSIGNED NOT NULL DEFAULT 0,

    weight_logged BOOLEAN NOT NULL DEFAULT FALSE,

    diet_adherence_pct DECIMAL(5,2) NULL,
    workout_adherence_pct DECIMAL(5,2) NULL,
    cardio_adherence_pct DECIMAL(5,2) NULL,
    water_adherence_pct DECIMAL(5,2) NULL,
    weight_logging_adherence_pct DECIMAL(5,2) NULL,

    overall_adherence_pct DECIMAL(5,2) NULL,

    calculated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT uq_user_daily_summary
        UNIQUE (user_id, summary_date),

    CONSTRAINT fk_daily_summaries_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_daily_summary_overall_pct
        CHECK (
            overall_adherence_pct IS NULL
            OR overall_adherence_pct BETWEEN 0 AND 100
        ),

    INDEX idx_daily_summary_history
        (user_id, summary_date)
) ENGINE=InnoDB;


-- =====================================================================
-- 48. PROGRESS SNAPSHOTS
-- Useful for fast weekly/monthly analytics.
-- =====================================================================

CREATE TABLE user_progress_snapshots (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    period_type ENUM(
        'daily',
        'weekly',
        'monthly'
    ) NOT NULL,

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

    CONSTRAINT uq_progress_snapshot
        UNIQUE (
            user_id,
            period_type,
            period_start,
            period_end
        ),

    CONSTRAINT fk_progress_snapshots_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_progress_period
        CHECK (period_end >= period_start),

    INDEX idx_progress_snapshots_lookup
        (user_id, period_type, period_start)
) ENGINE=InnoDB;


-- =====================================================================
-- OFFLINE SYNC / IDEMPOTENCY
-- =====================================================================

-- =====================================================================
-- 49. API IDEMPOTENCY KEYS
--
-- Flutter sends a unique client_operation_id for mutation requests.
-- Repeated retries return the previous operation instead of duplicating data.
-- =====================================================================

CREATE TABLE api_idempotency_keys (
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

    CONSTRAINT uq_user_client_operation
        UNIQUE (user_id, client_operation_id),

    CONSTRAINT fk_idempotency_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_idempotency_expiry
        (expires_at)
) ENGINE=InnoDB;


-- =====================================================================
-- AUDITING
-- =====================================================================

-- =====================================================================
-- 50. AUDIT LOGS
-- =====================================================================

CREATE TABLE audit_logs (
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

    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_audit_logs_actor
        (actor_user_id, created_at),

    INDEX idx_audit_logs_entity
        (entity_type, entity_id),

    INDEX idx_audit_logs_action
        (action, created_at),

    INDEX idx_audit_logs_created_at
        (created_at)
) ENGINE=InnoDB;


-- =====================================================================
-- OPTIONAL USEFUL VIEWS
-- =====================================================================

-- =====================================================================
-- 51. DAILY WATER TOTALS
-- =====================================================================

CREATE OR REPLACE VIEW v_user_daily_water_totals AS
SELECT
    user_id,
    intake_date,
    SUM(amount_ml) AS total_water_ml,
    COUNT(*) AS entry_count
FROM water_entries
GROUP BY
    user_id,
    intake_date;


-- =====================================================================
-- 52. DAILY CARDIO TOTALS
-- =====================================================================

CREATE OR REPLACE VIEW v_user_daily_cardio_totals AS
SELECT
    user_id,
    cardio_date,
    SUM(duration_minutes) AS total_cardio_minutes,
    SUM(COALESCE(distance_km, 0)) AS total_distance_km,
    COUNT(*) AS session_count
FROM cardio_logs
GROUP BY
    user_id,
    cardio_date;


-- =====================================================================
-- 53. WORKOUT SET VOLUME
--
-- Only meaningful for weight × rep sets.
-- =====================================================================

CREATE OR REPLACE VIEW v_workout_set_volume AS
SELECT
    ws.id AS workout_set_id,
    wse.workout_session_id,
    ws.workout_session_exercise_id,
    wse.exercise_id,
    ws.set_number,
    ws.weight_kg,
    ws.reps,

    CASE
        WHEN ws.weight_kg IS NOT NULL
             AND ws.reps IS NOT NULL
        THEN ws.weight_kg * ws.reps
        ELSE NULL
    END AS volume_kg

FROM workout_sets ws

INNER JOIN workout_session_exercises wse
    ON wse.id = ws.workout_session_exercise_id

WHERE ws.completed = TRUE;


-- =====================================================================
-- 54. LATEST USER WEIGHT
-- Requires MySQL 8 window functions.
-- =====================================================================

CREATE OR REPLACE VIEW v_user_latest_weight AS
SELECT
    ranked.user_id,
    ranked.weight_kg,
    ranked.measurement_date,
    ranked.measured_at

FROM (
    SELECT
        bwe.user_id,
        bwe.weight_kg,
        bwe.measurement_date,
        bwe.measured_at,

        ROW_NUMBER() OVER (
            PARTITION BY bwe.user_id
            ORDER BY
                bwe.measurement_date DESC,
                bwe.measured_at DESC
        ) AS row_number_rank

    FROM body_weight_entries bwe
) ranked

WHERE ranked.row_number_rank = 1;


-- =====================================================================
-- 55. USER 7-DAY WEIGHT AVERAGE
--
-- This uses the last 7 measurements available in chronological order.
-- For more exact "calendar 7-day" calculations, calculate via backend query.
-- =====================================================================

CREATE OR REPLACE VIEW v_user_weight_rolling_average AS
SELECT
    user_id,
    measurement_date,
    weight_kg,

    AVG(weight_kg) OVER (
        PARTITION BY user_id
        ORDER BY measurement_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_7_measurement_average

FROM body_weight_entries;


-- =====================================================================
-- END OF INITIAL SCHEMA
-- =====================================================================