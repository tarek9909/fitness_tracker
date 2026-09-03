import { UserAuthPayload } from '../../shared/types/index.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/app-error.js';

export function assertCanViewDietPlan(
  plan: { owner_user_id?: number | null; visibility?: string } | null | undefined,
  user: UserAuthPayload
): void {
  if (!plan) {
    throw new NotFoundError('Diet plan not found');
  }

  const isAdmin = user.roleName === 'admin' || user.roleName === 'super_admin';
  if (isAdmin) {
    return;
  }

  if (plan.visibility === 'admin') {
    return;
  }

  if (plan.owner_user_id === user.userId) {
    return;
  }

  throw new ForbiddenError('You do not have permission to view this diet plan', 'DIET_PLAN_FORBIDDEN');
}

export function assertCanModifyDietPlan(
  plan: { owner_user_id?: number | null; visibility?: string } | null | undefined,
  user: UserAuthPayload
): void {
  if (!plan) {
    throw new NotFoundError('Diet plan not found');
  }

  const isAdmin = user.roleName === 'admin' || user.roleName === 'super_admin';
  if (isAdmin) {
    return;
  }

  if (plan.owner_user_id === user.userId) {
    return;
  }

  throw new ForbiddenError('You do not have permission to modify this diet plan', 'DIET_PLAN_FORBIDDEN');
}
