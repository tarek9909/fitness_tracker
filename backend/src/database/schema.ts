export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    date_of_birth DATE NULL,
    height_cm DECIMAL(6,2) NULL,
    gender VARCHAR(20) NULL,
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    locale VARCHAR(20) NOT NULL DEFAULT 'en',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    security_version INTEGER NOT NULL DEFAULT 1,
    email_verified_at DATETIME NULL,
    unit_system VARCHAR(10) NOT NULL DEFAULT 'metric',
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS user_refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    device_name VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(1000) NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    rotated_from_token_id INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rotated_from_token_id) REFERENCES user_refresh_tokens(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_otp_challenges (
    id VARCHAR(64) PRIMARY KEY,
    user_id INTEGER NULL,
    purpose VARCHAR(50) NOT NULL,
    destination_email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(128) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_email_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    new_email VARCHAR(255) NOT NULL,
    current_email_challenge_id VARCHAR(64) NOT NULL,
    new_email_challenge_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (current_email_challenge_id) REFERENCES auth_otp_challenges(id) ON DELETE CASCADE,
    FOREIGN KEY (new_email_challenge_id) REFERENCES auth_otp_challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_push_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_uuid VARCHAR(191) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    push_token VARCHAR(1000) NOT NULL,
    app_version VARCHAR(50) NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_seen_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, device_uuid),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key VARCHAR(191) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description VARCHAR(500) NULL,
    updated_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS measurement_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    unit_type VARCHAR(20) NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS muscle_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500) NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(191) NOT NULL UNIQUE,
    description TEXT NULL,
    equipment_type_id INTEGER NULL,
    tracking_type VARCHAR(30) NOT NULL DEFAULT 'weight_reps',
    instructions TEXT NULL,
    video_url VARCHAR(1000) NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_type_id) REFERENCES equipment_types(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
    exercise_id INTEGER NOT NULL,
    muscle_group_id INTEGER NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (exercise_id, muscle_group_id),
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cardio_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(150) NOT NULL UNIQUE,
    description VARCHAR(500) NULL,
    supports_speed INTEGER NOT NULL DEFAULT 0,
    supports_incline INTEGER NOT NULL DEFAULT 0,
    supports_distance INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workout_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    goal VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    owner_user_id INTEGER NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'admin',
    created_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workout_plan_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_plan_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    change_notes TEXT NULL,
    published_at DATETIME NULL,
    created_by INTEGER NULL,
    published_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workout_plan_id, version_number),
    FOREIGN KEY (workout_plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workout_plan_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_plan_version_id INTEGER NOT NULL,
    weekday INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    is_rest_day INTEGER NOT NULL DEFAULT 0,
    day_order INTEGER NOT NULL DEFAULT 1,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workout_plan_version_id, weekday),
    FOREIGN KEY (workout_plan_version_id) REFERENCES workout_plan_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_plan_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_plan_day_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    exercise_order INTEGER NOT NULL,
    exercise_name_snapshot VARCHAR(191) NOT NULL,
    tracking_type_snapshot VARCHAR(30) NOT NULL DEFAULT 'weight_reps',
    target_sets INTEGER NOT NULL DEFAULT 3,
    target_reps_min INTEGER NULL,
    target_reps_max INTEGER NULL,
    target_duration_seconds INTEGER NULL,
    target_distance_meters DECIMAL(10,2) NULL,
    rest_seconds INTEGER NULL,
    notes TEXT NULL,
    is_optional INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workout_plan_day_id, exercise_order),
    FOREIGN KEY (workout_plan_day_id) REFERENCES workout_plan_days(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS workout_plan_exercise_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_plan_exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    target_reps_min INTEGER NULL,
    target_reps_max INTEGER NULL,
    target_weight_kg DECIMAL(8,2) NULL,
    target_duration_seconds INTEGER NULL,
    target_distance_meters DECIMAL(10,2) NULL,
    rest_seconds INTEGER NULL,
    notes VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workout_plan_exercise_id, set_number),
    FOREIGN KEY (workout_plan_exercise_id) REFERENCES workout_plan_exercises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS diet_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(191) NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    owner_user_id INTEGER NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'admin',
    created_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS diet_plan_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diet_plan_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    daily_calorie_target DECIMAL(8,2) NULL,
    daily_protein_target_g DECIMAL(8,2) NULL,
    daily_carbs_target_g DECIMAL(8,2) NULL,
    daily_fat_target_g DECIMAL(8,2) NULL,
    change_notes TEXT NULL,
    published_at DATETIME NULL,
    created_by INTEGER NULL,
    published_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (diet_plan_id, version_number),
    FOREIGN KEY (diet_plan_id) REFERENCES diet_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(191) NOT NULL,
    brand VARCHAR(191) NULL,
    reference_quantity DECIMAL(10,3) NULL,
    reference_unit_id INTEGER NULL,
    calories DECIMAL(10,2) NULL,
    protein_g DECIMAL(10,2) NULL,
    carbs_g DECIMAL(10,2) NULL,
    fat_g DECIMAL(10,2) NULL,
    fiber_g DECIMAL(10,2) NULL,
    notes TEXT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reference_unit_id) REFERENCES measurement_units(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS diet_meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diet_plan_version_id INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    meal_order INTEGER NOT NULL,
    scheduled_time TIME NULL,
    default_grace_minutes INTEGER NOT NULL DEFAULT 60,
    description TEXT NULL,
    is_required INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (diet_plan_version_id, meal_order),
    FOREIGN KEY (diet_plan_version_id) REFERENCES diet_plan_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS diet_meal_option_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diet_meal_id INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    group_order INTEGER NOT NULL,
    min_selection_count INTEGER NOT NULL DEFAULT 0,
    max_selection_count INTEGER NULL,
    is_required INTEGER NOT NULL DEFAULT 0,
    notes VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (diet_meal_id, group_order),
    FOREIGN KEY (diet_meal_id) REFERENCES diet_meals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS diet_meal_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diet_meal_option_group_id INTEGER NOT NULL,
    food_id INTEGER NULL,
    option_order INTEGER NOT NULL,
    label VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,3) NULL,
    unit_id INTEGER NULL,
    calories_snapshot DECIMAL(10,2) NULL,
    protein_g_snapshot DECIMAL(10,2) NULL,
    carbs_g_snapshot DECIMAL(10,2) NULL,
    fat_g_snapshot DECIMAL(10,2) NULL,
    fiber_g_snapshot DECIMAL(10,2) NULL,
    notes TEXT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (diet_meal_option_group_id, option_order),
    FOREIGN KEY (diet_meal_option_group_id) REFERENCES diet_meal_option_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL,
    FOREIGN KEY (unit_id) REFERENCES measurement_units(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_workout_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    workout_plan_version_id INTEGER NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    assignment_source VARCHAR(20) NOT NULL DEFAULT 'admin',
    notes TEXT NULL,
    assigned_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workout_plan_version_id) REFERENCES workout_plan_versions(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_diet_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    diet_plan_version_id INTEGER NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    assignment_source VARCHAR(20) NOT NULL DEFAULT 'admin',
    notes TEXT NULL,
    assigned_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (diet_plan_version_id) REFERENCES diet_plan_versions(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_weight_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    goal_type VARCHAR(30) NULL DEFAULT 'lose_weight',
    starting_weight_kg DECIMAL(6,2) NOT NULL,
    target_weight_kg DECIMAL(6,2) NOT NULL,
    start_date DATE NOT NULL,
    target_date DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_water_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    target_ml INTEGER NOT NULL DEFAULT 3000,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_water_quick_add_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount_ml INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, amount_ml),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_cardio_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cardio_activity_id INTEGER NULL,
    target_minutes_min INTEGER NULL,
    target_minutes_max INTEGER NULL,
    target_speed_min_kmh DECIMAL(6,2) NULL,
    target_speed_max_kmh DECIMAL(6,2) NULL,
    target_incline_min DECIMAL(6,2) NULL,
    target_incline_max DECIMAL(6,2) NULL,
    target_distance_min_km DECIMAL(8,2) NULL,
    target_distance_max_km DECIMAL(8,2) NULL,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    notes TEXT NULL,
    created_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (cardio_activity_id) REFERENCES cardio_activities(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_cardio_target_days (
    user_cardio_target_id INTEGER NOT NULL,
    weekday INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_cardio_target_id, weekday),
    FOREIGN KEY (user_cardio_target_id) REFERENCES user_cardio_targets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_adherence_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    diet_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 35,
    workout_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 25,
    cardio_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 15,
    water_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 15,
    weight_logging_weight_pct DECIMAL(5,2) NOT NULL DEFAULT 10,
    effective_from DATE NOT NULL,
    effective_until DATE NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_notification_settings (
    user_id INTEGER PRIMARY KEY,
    in_app_enabled INTEGER NOT NULL DEFAULT 1,
    push_enabled INTEGER NOT NULL DEFAULT 1,
    local_notifications_enabled INTEGER NOT NULL DEFAULT 1,
    quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
    quiet_hours_start TIME NULL,
    quiet_hours_end TIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category VARCHAR(30) NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, category),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reminder_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(191) NOT NULL,
    category VARCHAR(20) NOT NULL,
    rule_scope VARCHAR(20) NOT NULL,
    user_id INTEGER NULL,
    diet_meal_id INTEGER NULL,
    workout_plan_day_id INTEGER NULL,
    trigger_mode VARCHAR(20) NOT NULL,
    fixed_time TIME NULL,
    offset_minutes INTEGER NULL,
    grace_period_minutes INTEGER NOT NULL DEFAULT 0,
    repeat_interval_minutes INTEGER NULL,
    max_repeats INTEGER NOT NULL DEFAULT 1,
    active_window_start TIME NULL,
    active_window_end TIME NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (diet_meal_id) REFERENCES diet_meals(id) ON DELETE CASCADE,
    FOREIGN KEY (workout_plan_day_id) REFERENCES workout_plan_days(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reminder_rule_weekdays (
    reminder_rule_id INTEGER NOT NULL,
    weekday INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reminder_rule_id, weekday),
    FOREIGN KEY (reminder_rule_id) REFERENCES reminder_rules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_date DATE NOT NULL,
    task_key VARCHAR(191) NOT NULL,
    task_type VARCHAR(20) NOT NULL,
    user_diet_assignment_id INTEGER NULL,
    user_workout_assignment_id INTEGER NULL,
    diet_meal_id INTEGER NULL,
    workout_plan_day_id INTEGER NULL,
    user_cardio_target_id INTEGER NULL,
    user_water_target_id INTEGER NULL,
    user_weight_goal_id INTEGER NULL,
    title_snapshot VARCHAR(255) NOT NULL,
    description_snapshot TEXT NULL,
    target_snapshot TEXT NULL,
    scheduled_at DATETIME NULL,
    due_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, task_date, task_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_diet_assignment_id) REFERENCES user_diet_assignments(id) ON DELETE SET NULL,
    FOREIGN KEY (user_workout_assignment_id) REFERENCES user_workout_assignments(id) ON DELETE SET NULL,
    FOREIGN KEY (diet_meal_id) REFERENCES diet_meals(id) ON DELETE SET NULL,
    FOREIGN KEY (workout_plan_day_id) REFERENCES workout_plan_days(id) ON DELETE SET NULL,
    FOREIGN KEY (user_cardio_target_id) REFERENCES user_cardio_targets(id) ON DELETE SET NULL,
    FOREIGN KEY (user_water_target_id) REFERENCES user_water_targets(id) ON DELETE SET NULL,
    FOREIGN KEY (user_weight_goal_id) REFERENCES user_weight_goals(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS body_weight_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    measurement_date DATE NOT NULL,
    weight_kg DECIMAL(6,2) NOT NULL,
    measured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, measurement_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS water_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_water_target_id INTEGER NULL,
    intake_date DATE NOT NULL,
    amount_ml INTEGER NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    notes VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_water_target_id) REFERENCES user_water_targets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cardio_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_cardio_target_id INTEGER NULL,
    cardio_activity_id INTEGER NULL,
    cardio_date DATE NOT NULL,
    activity_name_snapshot VARCHAR(191) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    distance_km DECIMAL(10,3) NULL,
    speed_kmh DECIMAL(8,2) NULL,
    incline DECIMAL(8,2) NULL,
    calories_burned DECIMAL(10,2) NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_cardio_target_id) REFERENCES user_cardio_targets(id) ON DELETE SET NULL,
    FOREIGN KEY (cardio_activity_id) REFERENCES cardio_activities(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meal_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_diet_assignment_id INTEGER NULL,
    diet_plan_version_id INTEGER NULL,
    diet_meal_id INTEGER NULL,
    meal_date DATE NOT NULL,
    meal_name_snapshot VARCHAR(191) NOT NULL,
    scheduled_time_snapshot TIME NULL,
    status VARCHAR(20) NOT NULL,
    actual_calories DECIMAL(10,2) NULL,
    actual_protein_g DECIMAL(10,2) NULL,
    actual_carbs_g DECIMAL(10,2) NULL,
    actual_fat_g DECIMAL(10,2) NULL,
    notes TEXT NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, diet_meal_id, meal_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_diet_assignment_id) REFERENCES user_diet_assignments(id) ON DELETE SET NULL,
    FOREIGN KEY (diet_plan_version_id) REFERENCES diet_plan_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (diet_meal_id) REFERENCES diet_meals(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meal_log_selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_log_id INTEGER NOT NULL,
    diet_meal_option_group_id INTEGER NULL,
    diet_meal_option_id INTEGER NULL,
    group_name_snapshot VARCHAR(191) NULL,
    option_label_snapshot VARCHAR(255) NOT NULL,
    quantity_snapshot DECIMAL(10,3) NULL,
    unit_code_snapshot VARCHAR(30) NULL,
    calories_snapshot DECIMAL(10,2) NULL,
    protein_g_snapshot DECIMAL(10,2) NULL,
    carbs_g_snapshot DECIMAL(10,2) NULL,
    fat_g_snapshot DECIMAL(10,2) NULL,
    fiber_g_snapshot DECIMAL(10,2) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_log_id) REFERENCES meal_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (diet_meal_option_group_id) REFERENCES diet_meal_option_groups(id) ON DELETE SET NULL,
    FOREIGN KEY (diet_meal_option_id) REFERENCES diet_meal_options(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'planned',
    user_workout_assignment_id INTEGER NULL,
    workout_plan_version_id INTEGER NULL,
    workout_plan_day_id INTEGER NULL,
    workout_date DATE NOT NULL,
    workout_name_snapshot VARCHAR(191) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, workout_date, workout_plan_day_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_workout_assignment_id) REFERENCES user_workout_assignments(id) ON DELETE SET NULL,
    FOREIGN KEY (workout_plan_version_id) REFERENCES workout_plan_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (workout_plan_day_id) REFERENCES workout_plan_days(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workout_session_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_session_id INTEGER NOT NULL,
    workout_plan_exercise_id INTEGER NULL,
    exercise_id INTEGER NULL,
    exercise_order INTEGER NOT NULL,
    exercise_name_snapshot VARCHAR(191) NOT NULL,
    tracking_type_snapshot VARCHAR(30) NOT NULL DEFAULT 'weight_reps',
    planned_sets_snapshot INTEGER NULL,
    planned_reps_min_snapshot INTEGER NULL,
    planned_reps_max_snapshot INTEGER NULL,
    planned_rest_seconds_snapshot INTEGER NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workout_session_id, exercise_order),
    FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (workout_plan_exercise_id) REFERENCES workout_plan_exercises(id) ON DELETE SET NULL,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_session_exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    set_type VARCHAR(20) NOT NULL DEFAULT 'working',
    weight_kg DECIMAL(8,2) NULL,
    reps INTEGER NULL,
    duration_seconds INTEGER NULL,
    distance_meters DECIMAL(10,2) NULL,
    completed INTEGER NOT NULL DEFAULT 1,
    notes VARCHAR(1000) NULL,
    performed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workout_session_exercise_id, set_number),
    FOREIGN KEY (workout_session_exercise_id) REFERENCES workout_session_exercises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    daily_task_id INTEGER NULL,
    reminder_rule_id INTEGER NULL,
    category VARCHAR(20) NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    deep_link VARCHAR(500) NULL,
    dedupe_key VARCHAR(191) NULL,
    scheduled_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unread',
    read_at DATETIME NULL,
    dismissed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, dedupe_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (daily_task_id) REFERENCES daily_tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (reminder_rule_id) REFERENCES reminder_rules(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id INTEGER NOT NULL,
    user_push_device_id INTEGER NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider_message_id VARCHAR(500) NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    sent_at DATETIME NULL,
    delivered_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_push_device_id) REFERENCES user_push_devices(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    summary_date DATE NOT NULL,
    weight_kg DECIMAL(6,2) NULL,
    meals_expected INTEGER NOT NULL DEFAULT 0,
    meals_completed INTEGER NOT NULL DEFAULT 0,
    meals_partial INTEGER NOT NULL DEFAULT 0,
    meals_skipped INTEGER NOT NULL DEFAULT 0,
    workout_expected INTEGER NOT NULL DEFAULT 0,
    workout_completed INTEGER NOT NULL DEFAULT 0,
    cardio_target_minutes INTEGER NULL,
    cardio_actual_minutes INTEGER NOT NULL DEFAULT 0,
    water_target_ml INTEGER NULL,
    water_actual_ml INTEGER NOT NULL DEFAULT 0,
    weight_logged INTEGER NOT NULL DEFAULT 0,
    diet_adherence_pct DECIMAL(5,2) NULL,
    workout_adherence_pct DECIMAL(5,2) NULL,
    cardio_adherence_pct DECIMAL(5,2) NULL,
    water_adherence_pct DECIMAL(5,2) NULL,
    weight_logging_adherence_pct DECIMAL(5,2) NULL,
    overall_adherence_pct DECIMAL(5,2) NULL,
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, summary_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_progress_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    period_type VARCHAR(20) NOT NULL,
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
    workout_sessions_completed INTEGER NOT NULL DEFAULT 0,
    cardio_minutes_total INTEGER NOT NULL DEFAULT 0,
    water_average_ml INTEGER NULL,
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, period_type, period_start, period_end),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_operation_id VARCHAR(36) NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    request_hash CHAR(64) NULL,
    response_status INTEGER NULL,
    response_body TEXT NULL,
    completed_at DATETIME NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, client_operation_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(191) NULL,
    before_data TEXT NULL,
    after_data TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(1000) NULL,
    request_id VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_passkeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    credential_id VARCHAR(255) NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    credential_format VARCHAR(30) NOT NULL DEFAULT 'webauthn-cose',
    counter INTEGER NOT NULL DEFAULT 0,
    device_name VARCHAR(150) NOT NULL,
    transports VARCHAR(255) NULL,
    aaguid VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
    id VARCHAR(100) PRIMARY KEY,
    user_id INTEGER NULL,
    challenge VARCHAR(255) NOT NULL,
    ceremony_type VARCHAR(30) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS worker_locks (
    worker_name VARCHAR(100) PRIMARY KEY,
    locked_until TIMESTAMP NOT NULL,
    locked_by VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
