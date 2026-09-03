/**
 * Schema & Dialect Compatibility Adapter
 * 
 * Reconciles the 45 entity structural divergences between the canonical MySQL 8.x schema
 * (fitness_tracker.db, 50 tables) and the active runtime entity models (51 tables with worker_locks).
 */

export interface TableColumnMapping {
  tableName: string;
  /** Maps canonical column name to active runtime entity field name */
  canonicalToActive: Record<string, string>;
  /** Maps active runtime entity field name to canonical column name */
  activeToCanonical: Record<string, string>;
  /** Snapshot columns required for historical immutability in canonical MySQL */
  snapshotColumns?: string[];
  /** Offline mutation / idempotency columns used by mobile client sync */
  clientSyncColumns?: string[];
}

export const SCHEMA_DIVERGENCE_MAPPINGS: Record<string, TableColumnMapping> = {
  workout_sessions: {
    tableName: 'workout_sessions',
    canonicalToActive: {
      workout_date: 'session_date',
      workout_name_snapshot: 'workout_name',
      user_workout_assignment_id: 'assignment_id',
      workout_plan_version_id: 'version_id',
    },
    activeToCanonical: {
      session_date: 'workout_date',
      duration_seconds: 'duration_seconds',
      status: 'status',
      rating: 'rating',
      client_operation_id: 'client_operation_id',
    },
    snapshotColumns: ['workout_name_snapshot'],
    clientSyncColumns: ['client_operation_id'],
  },

  workout_sets: {
    tableName: 'workout_sets',
    canonicalToActive: {
      performed_at: 'created_at',
    },
    activeToCanonical: {
      set_type: 'set_type',
      weight_kg: 'weight_kg',
      reps_completed: 'reps_completed',
      rpe: 'rpe',
      is_warmup: 'is_warmup',
    },
    snapshotColumns: [],
  },

  meal_logs: {
    tableName: 'meal_logs',
    canonicalToActive: {
      meal_date: 'log_date',
      completed_at: 'consumed_at',
      scheduled_time_snapshot: 'scheduled_time',
      meal_name_snapshot: 'meal_name',
      actual_calories: 'total_calories',
      actual_protein_g: 'total_protein_g',
      actual_carbs_g: 'total_carbs_g',
      actual_fat_g: 'total_fat_g',
      user_diet_assignment_id: 'assignment_id',
      diet_plan_version_id: 'version_id',
    },
    activeToCanonical: {
      log_date: 'meal_date',
      consumed_at: 'completed_at',
      status: 'status',
      client_operation_id: 'client_operation_id',
    },
    snapshotColumns: ['meal_name_snapshot', 'scheduled_time_snapshot'],
    clientSyncColumns: ['client_operation_id'],
  },

  meal_log_selections: {
    tableName: 'meal_log_selections',
    canonicalToActive: {
      group_name_snapshot: 'group_name',
      option_label_snapshot: 'option_label',
      quantity_snapshot: 'quantity',
      unit_code_snapshot: 'unit_code',
      calories_snapshot: 'calories',
      protein_g_snapshot: 'protein_g',
      carbs_g_snapshot: 'carbs_g',
      fat_g_snapshot: 'fat_g',
      fiber_g_snapshot: 'fiber_g',
    },
    activeToCanonical: {
      food_id: 'food_id',
      quantity: 'quantity_snapshot',
      calories: 'calories_snapshot',
      protein_g: 'protein_g_snapshot',
      carbs_g: 'carbs_g_snapshot',
      fat_g: 'fat_g_snapshot',
    },
    snapshotColumns: ['group_name_snapshot', 'option_label_snapshot', 'quantity_snapshot', 'unit_code_snapshot'],
  },

  user_weight_goals: {
    tableName: 'user_weight_goals',
    canonicalToActive: {
      starting_weight_kg: 'start_weight_kg',
      created_by: 'created_by_user_id',
    },
    activeToCanonical: {
      start_weight_kg: 'starting_weight_kg',
      target_weight_kg: 'target_weight_kg',
      target_date: 'target_date',
      status: 'status',
    },
  },

  user_water_targets: {
    tableName: 'user_water_targets',
    canonicalToActive: {
      target_ml: 'daily_target_ml',
      created_by: 'created_by_user_id',
    },
    activeToCanonical: {
      daily_target_ml: 'target_ml',
      status: 'status',
    },
  },

  water_entries: {
    tableName: 'water_entries',
    canonicalToActive: {
      recorded_at: 'logged_at',
      user_water_target_id: 'target_id',
    },
    activeToCanonical: {
      logged_at: 'recorded_at',
      amount_ml: 'amount_ml',
      client_operation_id: 'client_operation_id',
    },
    clientSyncColumns: ['client_operation_id'],
  },

  cardio_activities: {
    tableName: 'cardio_activities',
    canonicalToActive: {
      supports_distance: 'tracks_distance',
      supports_speed: 'tracks_speed',
      supports_incline: 'tracks_incline',
    },
    activeToCanonical: {
      tracks_distance: 'supports_distance',
      tracks_speed: 'supports_speed',
      tracks_incline: 'supports_incline',
      tracks_heart_rate: 'supports_heart_rate',
      category: 'category',
    },
  },

  cardio_logs: {
    tableName: 'cardio_logs',
    canonicalToActive: {
      incline: 'incline_pct',
      activity_name_snapshot: 'activity_name',
      user_cardio_target_id: 'target_id',
    },
    activeToCanonical: {
      incline_pct: 'incline',
      average_heart_rate: 'average_heart_rate',
      calories_burned: 'calories_burned',
      client_operation_id: 'client_operation_id',
    },
    snapshotColumns: ['activity_name_snapshot'],
    clientSyncColumns: ['client_operation_id'],
  },

  user_cardio_targets: {
    tableName: 'user_cardio_targets',
    canonicalToActive: {
      target_minutes_min: 'min_duration_minutes',
      target_minutes_max: 'max_duration_minutes',
      target_distance_min_km: 'target_distance_km',
      target_speed_min_kmh: 'min_speed_kmh',
      target_speed_max_kmh: 'max_speed_kmh',
      target_incline_min: 'min_incline_pct',
      target_incline_max: 'max_incline_pct',
    },
    activeToCanonical: {
      min_duration_minutes: 'target_minutes_min',
      max_duration_minutes: 'target_minutes_max',
      target_distance_km: 'target_distance_min_km',
      min_speed_kmh: 'target_speed_min_kmh',
      max_speed_kmh: 'target_speed_max_kmh',
      min_incline_pct: 'target_incline_min',
      max_incline_pct: 'target_incline_max',
      status: 'status',
    },
  },

  workout_plan_days: {
    tableName: 'workout_plan_days',
    canonicalToActive: {
      weekday: 'weekday_number',
      day_order: 'order_index',
    },
    activeToCanonical: {
      weekday_number: 'weekday',
      order_index: 'day_order',
      description: 'description',
    },
  },

  workout_plan_exercises: {
    tableName: 'workout_plan_exercises',
    canonicalToActive: {
      exercise_order: 'order_index',
      target_reps_min: 'reps_min',
      target_reps_max: 'reps_max',
      exercise_name_snapshot: 'exercise_name',
    },
    activeToCanonical: {
      order_index: 'exercise_order',
      reps_min: 'target_reps_min',
      reps_max: 'target_reps_max',
    },
    snapshotColumns: ['exercise_name_snapshot'],
  },

  workout_session_exercises: {
    tableName: 'workout_session_exercises',
    canonicalToActive: {
      exercise_order: 'order_index',
      planned_sets_snapshot: 'planned_sets',
      planned_reps_min_snapshot: 'reps_min_target',
      planned_reps_max_snapshot: 'reps_max_target',
      planned_rest_seconds_snapshot: 'rest_seconds_target',
      exercise_name_snapshot: 'exercise_name',
    },
    activeToCanonical: {
      order_index: 'exercise_order',
      planned_sets: 'planned_sets_snapshot',
      reps_min_target: 'planned_reps_min_snapshot',
      reps_max_target: 'planned_reps_max_snapshot',
      rest_seconds_target: 'planned_rest_seconds_snapshot',
    },
    snapshotColumns: ['exercise_name_snapshot', 'planned_sets_snapshot'],
  },

  reminder_rules: {
    tableName: 'reminder_rules',
    canonicalToActive: {
      name: 'title',
      offset_minutes: 'relative_minutes_offset',
      repeat_interval_minutes: 'interval_minutes',
    },
    activeToCanonical: {
      title: 'name',
      category: 'category',
      mode: 'mode',
      relative_minutes_offset: 'offset_minutes',
      interval_minutes: 'repeat_interval_minutes',
      message_template: 'message_template',
    },
  },

  user_adherence_configs: {
    tableName: 'user_adherence_configs',
    canonicalToActive: {
      diet_weight_pct: 'diet_weight',
      workout_weight_pct: 'workout_weight',
      cardio_weight_pct: 'cardio_weight',
      water_weight_pct: 'water_weight',
      weight_logging_weight_pct: 'weight_logging_weight',
    },
    activeToCanonical: {
      diet_weight: 'diet_weight_pct',
      workout_weight: 'workout_weight_pct',
      cardio_weight: 'cardio_weight_pct',
      water_weight: 'water_weight_pct',
      weight_logging_weight: 'weight_logging_weight_pct',
    },
  },

  user_daily_summaries: {
    tableName: 'user_daily_summaries',
    canonicalToActive: {
      weight_kg: 'weight_recorded_kg',
      weight_logging_adherence_pct: 'weight_logging_pct',
      water_actual_ml: 'total_water_ml',
      cardio_actual_minutes: 'total_cardio_minutes',
      workout_completed: 'workout_session_completed',
    },
    activeToCanonical: {
      weight_recorded_kg: 'weight_kg',
      weight_logging_pct: 'weight_logging_adherence_pct',
      total_water_ml: 'water_actual_ml',
      total_cardio_minutes: 'cardio_actual_minutes',
      workout_session_completed: 'workout_completed',
    },
  },

  user_notification_settings: {
    tableName: 'user_notification_settings',
    canonicalToActive: {
      in_app_enabled: 'allow_in_app',
      push_enabled: 'allow_push',
    },
    activeToCanonical: {
      allow_in_app: 'in_app_enabled',
      allow_push: 'push_enabled',
      allow_reminders: 'allow_reminders',
      allow_missed_task_alerts: 'allow_missed_task_alerts',
    },
  },

  user_water_quick_add_options: {
    tableName: 'user_water_quick_add_options',
    canonicalToActive: {
      display_order: 'order_index',
    },
    activeToCanonical: {
      order_index: 'display_order',
      amount_ml: 'amount_ml',
      label: 'label',
    },
  },
};

/**
 * Normalizes a database row from Canonical MySQL column names to Active runtime object fields.
 */
export function normalizeCanonicalRow<T = any>(tableName: string, row: Record<string, any>): T {
  const mapping = SCHEMA_DIVERGENCE_MAPPINGS[tableName];
  if (!mapping) return row as T;

  const result: Record<string, any> = { ...row };
  for (const [canonicalCol, activeField] of Object.entries(mapping.canonicalToActive)) {
    if (row[canonicalCol] !== undefined) {
      result[activeField] = row[canonicalCol];
    }
  }
  return result as T;
}

/**
 * Translates an active query parameter/payload object into canonical MySQL schema columns.
 */
export function translateActivePayload(tableName: string, payload: Record<string, any>): Record<string, any> {
  const mapping = SCHEMA_DIVERGENCE_MAPPINGS[tableName];
  if (!mapping) return payload;

  const result: Record<string, any> = { ...payload };
  for (const [activeField, canonicalCol] of Object.entries(mapping.activeToCanonical)) {
    if (payload[activeField] !== undefined) {
      result[canonicalCol] = payload[activeField];
    }
  }
  return result;
}
