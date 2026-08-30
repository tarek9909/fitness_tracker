import { getDatabasePool } from '../../database/pool.js';

export interface ExerciseItem {
  id: number;
  name: string;
  description: string | null;
  primary_muscle_group_id: number | null;
  primary_muscle_group_name: string | null;
  equipment_type_id: number | null;
  equipment_type_name: string | null;
  tracking_type: string;
  video_url: string | null;
  instructions: string | null;
  is_archived: number;
  created_at: string;
}

export class ExercisesRepository {
  private db = getDatabasePool();

  async findAll(params: {
    search?: string;
    muscleGroupId?: number;
    equipmentTypeId?: number;
    trackingType?: string;
    isArchived?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ exercises: ExerciseItem[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let where: string[] = ['1=1'];
    let values: any[] = [];

    if (params.search) {
      where.push('e.name LIKE ?');
      values.push(`%${params.search}%`);
    }
    if (params.muscleGroupId) {
      where.push('emg.muscle_group_id = ?');
      values.push(params.muscleGroupId);
    }
    if (params.equipmentTypeId) {
      where.push('e.equipment_type_id = ?');
      values.push(params.equipmentTypeId);
    }
    if (params.trackingType) {
      where.push('e.tracking_type = ?');
      values.push(params.trackingType);
    }
    if (params.isArchived !== undefined) {
      where.push('e.is_active = ?');
      values.push(params.isArchived ? 0 : 1);
    } else {
      where.push('e.is_active = 1');
    }

    const whereStr = where.join(' AND ');

    const countSql = `
      SELECT COUNT(DISTINCT e.id) as count 
      FROM exercises e 
      LEFT JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id AND emg.is_primary = 1
      WHERE ${whereStr}
    `;
    const countRes = await this.db.queryOne<{ count: number }>(countSql, values);
    const total = countRes?.count || 0;

    const sql = `
      SELECT e.id, e.name, e.description,
             emg.muscle_group_id as primary_muscle_group_id,
             mg.name as primary_muscle_group_name,
             e.equipment_type_id, eq.name as equipment_type_name, e.tracking_type,
             e.video_url, e.instructions,
             (CASE WHEN e.is_active = 0 THEN 1 ELSE 0 END) as is_archived,
             e.is_active, e.created_at
      FROM exercises e
      LEFT JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id AND emg.is_primary = 1
      LEFT JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
      LEFT JOIN equipment_types eq ON eq.id = e.equipment_type_id
      WHERE ${whereStr}
      ORDER BY e.name ASC
      LIMIT ? OFFSET ?
    `;

    const exercises = await this.db.query<ExerciseItem>(sql, [...values, limit, offset]);
    return { exercises, total };
  }

  async findById(id: number): Promise<ExerciseItem | null> {
    const sql = `
      SELECT e.id, e.name, e.description,
             emg.muscle_group_id as primary_muscle_group_id,
             mg.name as primary_muscle_group_name,
             e.equipment_type_id, eq.name as equipment_type_name, e.tracking_type,
             e.video_url, e.instructions,
             (CASE WHEN e.is_active = 0 THEN 1 ELSE 0 END) as is_archived,
             e.is_active, e.created_at
      FROM exercises e
      LEFT JOIN exercise_muscle_groups emg ON emg.exercise_id = e.id AND emg.is_primary = 1
      LEFT JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
      LEFT JOIN equipment_types eq ON eq.id = e.equipment_type_id
      WHERE e.id = ?
    `;
    return this.db.queryOne<ExerciseItem>(sql, [id]);
  }

  async create(data: {
    name: string;
    description?: string | null;
    primaryMuscleGroupId?: number | null;
    equipmentTypeId?: number | null;
    trackingType: string;
    videoUrl?: string | null;
    instructions?: string | null;
  }): Promise<number> {
    const sql = `
      INSERT INTO exercises (name, description, equipment_type_id, tracking_type, video_url, instructions, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `;
    const res = await this.db.execute(sql, [
      data.name,
      data.description || null,
      data.equipmentTypeId || null,
      data.trackingType || 'weight_reps',
      data.videoUrl || null,
      data.instructions || null,
    ]);
    const exerciseId = res.insertId;

    if (data.primaryMuscleGroupId) {
      await this.db.execute(
        `INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id, is_primary) VALUES (?, ?, 1)`,
        [exerciseId, data.primaryMuscleGroupId]
      );
    }

    return exerciseId;
  }

  async update(id: number, data: Partial<{
    name: string;
    description: string | null;
    primaryMuscleGroupId: number | null;
    equipmentTypeId: number | null;
    trackingType: string;
    videoUrl: string | null;
    instructions: string | null;
    isArchived: number;
  }>): Promise<void> {
    const set: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { set.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { set.push('description = ?'); values.push(data.description); }
    if (data.equipmentTypeId !== undefined) { set.push('equipment_type_id = ?'); values.push(data.equipmentTypeId); }
    if (data.trackingType !== undefined) { set.push('tracking_type = ?'); values.push(data.trackingType); }
    if (data.videoUrl !== undefined) { set.push('video_url = ?'); values.push(data.videoUrl); }
    if (data.instructions !== undefined) { set.push('instructions = ?'); values.push(data.instructions); }
    if (data.isArchived !== undefined) { set.push('is_active = ?'); values.push(data.isArchived ? 0 : 1); }

    if (set.length > 0) {
      const sql = `UPDATE exercises SET ${set.join(', ')} WHERE id = ?`;
      await this.db.execute(sql, [...values, id]);
    }

    if (data.primaryMuscleGroupId !== undefined) {
      await this.db.execute(`DELETE FROM exercise_muscle_groups WHERE exercise_id = ? AND is_primary = 1`, [id]);
      if (data.primaryMuscleGroupId) {
        await this.db.execute(
          `INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id, is_primary) VALUES (?, ?, 1)`,
          [id, data.primaryMuscleGroupId]
        );
      }
    }
  }

  async getMuscleGroups(): Promise<any[]> {
    return this.db.query('SELECT * FROM muscle_groups WHERE is_active = 1 ORDER BY name ASC');
  }

  async getEquipmentTypes(): Promise<any[]> {
    return this.db.query('SELECT * FROM equipment_types WHERE is_active = 1 ORDER BY name ASC');
  }

  async getMeasurementUnits(): Promise<any[]> {
    return this.db.query('SELECT * FROM measurement_units WHERE is_active = 1 ORDER BY name ASC');
  }

  async getCardioActivities(): Promise<any[]> {
    return this.db.query('SELECT * FROM cardio_activities WHERE is_active = 1 ORDER BY name ASC');
  }
}
