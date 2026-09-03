import { UserAuthPayload } from '../../shared/types/index.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/app-error.js';

export function assertCanViewWorkoutPlan(
  plan: { owner_user_id?: number | null; visibility?: string } | null | undefined,
  user: UserAuthPayload
): void {
  if (!plan) {
    throw new NotFoundError('Workout plan not found');
  }

  const isAdmin = user.roleName === 'admin' || user.roleName === 'super_admin';
  if (isAdmin) {
    return;
  }

  if (plan.visibility === 'admin') {
    return;
  }

  if (Number(plan.owner_user_id) === Number(user.userId)) {
    return;
  }

  throw new ForbiddenError('You do not have permission to view this workout plan', 'WORKOUT_PLAN_FORBIDDEN');
}

export function assertCanModifyWorkoutPlan(
  plan: { owner_user_id?: number | null; visibility?: string } | null | undefined,
  user: UserAuthPayload
): void {
  if (!plan) {
    throw new NotFoundError('Workout plan not found');
  }

  const isAdmin = user.roleName === 'admin' || user.roleName === 'super_admin';
  if (isAdmin) {
    return;
  }

  if (Number(plan.owner_user_id) === Number(user.userId)) {
    return;
  }

  throw new ForbiddenError('You do not have permission to modify this workout plan', 'WORKOUT_PLAN_FORBIDDEN');
}
