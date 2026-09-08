import { ExercisesRepository, ExerciseItem } from './exercises.repository.js';
import { NotFoundError, ConflictError } from '../../shared/errors/app-error.js';

export class ExercisesService {
  private repo = new ExercisesRepository();

  async getExercises(params: {
    search?: string;
    muscleGroupId?: number;
    equipmentTypeId?: number;
    trackingType?: string;
    isArchived?: boolean;
    page?: number;
    limit?: number;
  }) {
    return this.repo.findAll(params);
  }

  async getExerciseById(id: number): Promise<ExerciseItem> {
    const item = await this.repo.findById(id);
    if (!item) {
      throw new NotFoundError('Exercise not found');
    }
    return item;
  }

  async createExercise(data: {
    name: string;
    description?: string;
    primaryMuscleGroupId?: number;
    equipmentTypeId?: number;
    trackingType: string;
    videoUrl?: string;
    instructions?: string;
  }, throwOnDuplicate = false): Promise<ExerciseItem> {
    const trimmedName = data.name.trim();
    const existing = await this.repo.findAll({ search: trimmedName, isArchived: false });
    const duplicate = existing.exercises.find(e => e.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      if (throwOnDuplicate) {
        throw new ConflictError('An exercise with this name already exists', 'EXERCISE_NAME_EXISTS');
      }
      return duplicate;
    }

    const id = await this.repo.create({ ...data, name: trimmedName });
    return this.getExerciseById(id);
  }

  async updateExercise(id: number, data: Partial<{
    name: string;
    description: string;
    primaryMuscleGroupId: number;
    equipmentTypeId: number;
    trackingType: string;
    videoUrl: string;
    instructions: string;
  }>): Promise<ExerciseItem> {
    await this.getExerciseById(id);
    await this.repo.update(id, data);
    return this.getExerciseById(id);
  }

  async setArchiveStatus(id: number, isArchived: boolean): Promise<ExerciseItem> {
    await this.getExerciseById(id);
    await this.repo.update(id, { isArchived: isArchived ? 1 : 0 });
    return this.getExerciseById(id);
  }

  async getMetadata() {
    const [muscleGroups, equipmentTypes, measurementUnits, cardioActivities] = await Promise.all([
      this.repo.getMuscleGroups(),
      this.repo.getEquipmentTypes(),
      this.repo.getMeasurementUnits(),
      this.repo.getCardioActivities(),
    ]);

    return {
      muscleGroups,
      equipmentTypes,
      measurementUnits,
      cardioActivities,
      trackingTypes: [
        'weight_reps',
        'reps_only',
        'duration',
        'distance',
        'weight_duration',
        'custom',
      ],
    };
  }
}
