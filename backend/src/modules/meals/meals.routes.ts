import { getDatabasePool } from '../../database/pool.js';
import { getUserLocalDate } from '../../shared/utils/date-utils.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { AuthenticatedRequest } from '../../shared/types/index.js';
import { UsersRepository } from '../users/users.repository.js';
import { AssignmentRepository } from '../assignments/assignment.routes.js';
import { beginIdempotentRequest, completeIdempotentRequest, releaseIdempotentRequest, isDateOnly, parsePositiveInt, parseOptionalDateOnly, parseBoundedPositiveInt } from '../../shared/utils/request-utils.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors/app-error.js';

const logMealSchema = z.object({
  status: z.enum(['completed', 'skipped', 'partial']).default('completed'),
  logDate: z.string().refine(isDateOnly, 'Use YYYY-MM-DD').optional(),
  selections: z.array(z.object({
    optionGroupId: z.number().int().positive(),
    optionId: z.number().int().positive(),
    foodId: z.number().int().positive().optional(),
    quantity: z.number().positive().max(100000).optional(),
  })).max(100).optional(),
  notes: z.string().max(2000).optional(),
  clientOperationId: z.string().min(8).max(191).optional(),
});

export class MealsController {
  private db = getDatabasePool();
  private usersRepo = new UsersRepository();
  private assignRepo = new AssignmentRepository();

  async logMeal(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const params = request.params as { mealId: string };
    const mealId = parsePositiveInt(params.mealId, 'mealId');
    const body = logMealSchema.parse(request.body);

    const { reservation, replay } = await beginIdempotentRequest(this.db, request, auth.userId, body);
    if (replay) {
      return reply.status(replay.statusCode).send(replay.body);
    }

    try {
      const user = await this.usersRepo.findById(auth.userId);
      const dateStr = body.logDate || getUserLocalDate(user?.timezone || 'UTC');

      const meal = await this.db.queryOne<any>('SELECT * FROM diet_meals WHERE id = ?', [mealId]);
      if (!meal) throw new NotFoundError('Meal not found');

      const activeDietAssign = await this.assignRepo.getActiveDietAssignment(auth.userId, dateStr);
      if (!activeDietAssign || meal.diet_plan_version_id !== activeDietAssign.diet_plan_version_id) {
        throw new ForbiddenError('Meal does not belong to your active diet plan', 'MEAL_NOT_ASSIGNED');
      }

      const responsePayload = await this.db.withTransaction(async (conn) => {
        const existingLog = await conn.queryOne(
          'SELECT id FROM meal_logs WHERE user_id = ? AND diet_meal_id = ? AND meal_date = ?',
          [auth.userId, mealId, dateStr]
        );

        let currentLogId: number;
        if (existingLog) {
          currentLogId = existingLog.id;
          await conn.execute(
            'UPDATE meal_logs SET status = ?, notes = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [body.status, body.notes || null, currentLogId]
          );
          // Remove previous selections to replace with new selections
          await conn.execute('DELETE FROM meal_log_selections WHERE meal_log_id = ?', [currentLogId]);
        } else {
          const res = await conn.execute(
            `INSERT INTO meal_logs (
               user_id, user_diet_assignment_id, diet_plan_version_id, diet_meal_id, meal_date,
               meal_name_snapshot, scheduled_time_snapshot, status, notes, completed_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              auth.userId,
              activeDietAssign?.id || null,
              activeDietAssign?.diet_plan_version_id || null,
              mealId,
              dateStr,
              meal.name || 'Meal',
              meal.scheduled_time || null,
              body.status,
              body.notes || null,
            ]
          );
          currentLogId = res.insertId;
        }

        // Validate the complete meal hierarchy in bounded batches before
        // writing snapshots. This avoids one query per submitted selection.
        const selections = body.selections || [];
        let groupsById = new Map<number, any>();
        let optionsById = new Map<number, any>();
        if (body.selections !== undefined) {
          const groups = await conn.query<any>(
            'SELECT * FROM diet_meal_option_groups WHERE diet_meal_id = ? ORDER BY group_order ASC',
            [mealId],
          );
          groupsById = new Map<number, any>(groups.map((group: any) => [Number(group.id), group]));
          const optionIds = [...new Set(selections.map((selection) => selection.optionId))];
          const options = optionIds.length > 0
            ? await conn.query<any>(
              `SELECT * FROM diet_meal_options WHERE id IN (${optionIds.map(() => '?').join(',')})`,
              optionIds,
            )
            : [];
          optionsById = new Map<number, any>(options.map((option: any) => [Number(option.id), option]));
          const selectionsByGroup = new Map<number, number>();
          const submittedOptionIds = new Set<number>();

          for (const sel of selections) {
            if (submittedOptionIds.has(sel.optionId)) {
              throw new ValidationError('The same meal option cannot be submitted more than once');
            }
            submittedOptionIds.add(sel.optionId);

            const group = groupsById.get(sel.optionGroupId);
            if (!group) {
              throw new ValidationError('Selected option group does not belong to this meal');
            }
            const opt = optionsById.get(sel.optionId);
            if (!opt || Number(opt.diet_meal_option_group_id) !== sel.optionGroupId || opt.is_active === 0) {
              throw new ValidationError('Selected option does not belong to the specified option group');
            }
            if (sel.foodId !== undefined && Number(opt.food_id) !== sel.foodId) {
              throw new ValidationError('Selected food does not match the specified meal option');
            }
            selectionsByGroup.set(
              sel.optionGroupId,
              (selectionsByGroup.get(sel.optionGroupId) || 0) + 1,
            );
          }

          for (const group of groups) {
            const groupId = Number(group.id);
            const selectedCount = selectionsByGroup.get(groupId) || 0;
            const minimum = Number(group.min_selection_count || 0);
            const requiredMinimum = Number(group.is_required) === 1 ? Math.max(1, minimum) : minimum;
            const maximum = group.max_selection_count == null ? null : Number(group.max_selection_count);
            if (selectedCount < requiredMinimum) {
              throw new ValidationError(`Select at least ${requiredMinimum} option(s) for ${group.name}`);
            }
            if (maximum !== null && selectedCount > maximum) {
              throw new ValidationError(`Select no more than ${maximum} option(s) for ${group.name}`);
            }
          }
        }

        for (const sel of selections) {
          const group = groupsById.get(sel.optionGroupId)!;
          const opt = optionsById.get(sel.optionId)!;
          await conn.execute(
            `INSERT INTO meal_log_selections (
               meal_log_id, diet_meal_option_group_id, diet_meal_option_id, group_name_snapshot,
               option_label_snapshot, quantity_snapshot, calories_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              currentLogId,
              sel.optionGroupId,
              sel.optionId,
              group.name,
              opt.label || opt.custom_label || 'Serving',
              sel.quantity ?? opt.quantity ?? opt.serving_quantity ?? 1,
              opt.calories_snapshot || opt.calories || null,
              opt.protein_g_snapshot || opt.protein_g || null,
              opt.carbs_g_snapshot || opt.carbs_g || null,
              opt.fat_g_snapshot || opt.fat_g || null,
            ]
          );
        }

        // Mark daily task
        const taskKey = `meal:${mealId}`;
        const taskStatus = body.status === 'completed' ? 'completed' : body.status === 'skipped' ? 'skipped' : 'in_progress';
        await conn.execute(
          `UPDATE daily_tasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND task_date = ? AND task_key = ?`,
          [taskStatus, auth.userId, dateStr, taskKey]
        );

        const payload = {
          success: true,
          data: {
            logId: currentLogId,
            mealId,
            date: dateStr,
            status: body.status,
          },
        };

        if (reservation) {
          await completeIdempotentRequest(conn, reservation, 200, payload);
        }

        return payload;
      });

      return reply.status(200).send(responsePayload);
    } catch (err) {
      if (reservation) {
        await releaseIdempotentRequest(this.db, reservation);
      }
      throw err;
    }
  }

  async getTodayMeals(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const user = await this.usersRepo.findById(auth.userId);
    const localToday = getUserLocalDate(user?.timezone || 'UTC');
    const dateStr = parseOptionalDateOnly((request.query as any)?.date, 'date', localToday);

    const activeDietAssign = await this.assignRepo.getActiveDietAssignment(auth.userId, dateStr);
    if (!activeDietAssign) {
      return reply.status(200).send({
        success: true,
        data: {
          date: dateStr,
          meals: [],
          assignment: null,
        },
      });
    }

    const mealsSql = `
      SELECT *, 
             meal_order as order_index, 
             description as notes 
      FROM diet_meals 
      WHERE diet_plan_version_id = ? 
      ORDER BY meal_order ASC
    `;
    const meals = await this.db.query<any>(mealsSql, [activeDietAssign.diet_plan_version_id]);
    if (meals.length === 0) {
      return reply.status(200).send({
        success: true,
        data: {
          date: dateStr,
          meals: [],
          assignment: activeDietAssign,
        },
      });
    }

    const mealIds = meals.map((m: any) => m.id);
    const mealPlaceholders = mealIds.map(() => '?').join(',');

    // Batch load logs for all meals
    const logs = await this.db.query(
      `SELECT *, meal_date as log_date FROM meal_logs 
       WHERE user_id = ? AND meal_date = ? AND diet_meal_id IN (${mealPlaceholders})`,
      [auth.userId, dateStr, ...mealIds]
    );
    const logsByMealId = new Map<number, any>();
    for (const log of logs) {
      logsByMealId.set(log.diet_meal_id, log);
    }

    // Batch load option groups
    const groupsSql = `
      SELECT *, 
             group_order as order_index, 
             min_selection_count as min_selections, 
             max_selection_count as max_selections 
      FROM diet_meal_option_groups 
      WHERE diet_meal_id IN (${mealPlaceholders})
      ORDER BY group_order ASC
    `;
    const allGroups = await this.db.query(groupsSql, mealIds);

    let allOptions: any[] = [];
    if (allGroups.length > 0) {
      const groupIds = allGroups.map((g: any) => g.id);
      const groupPlaceholders = groupIds.map(() => '?').join(',');
      const optionsSql = `
        SELECT dmo.*, 
               dmo.option_order as order_index,
               dmo.label as custom_label,
               dmo.quantity as serving_quantity,
               dmo.unit_id as serving_unit_id,
               dmo.calories_snapshot as calories,
               dmo.protein_g_snapshot as protein_g,
               dmo.carbs_g_snapshot as carbs_g,
               dmo.fat_g_snapshot as fat_g,
               f.name as food_name, 
               mu.code as unit_code
        FROM diet_meal_options dmo
        LEFT JOIN foods f ON f.id = dmo.food_id
        LEFT JOIN measurement_units mu ON mu.id = dmo.unit_id
        WHERE dmo.diet_meal_option_group_id IN (${groupPlaceholders})
        ORDER BY dmo.option_order ASC
      `;
      allOptions = await this.db.query(optionsSql, groupIds);
    }

    const optionsByGroupId = new Map<number, any[]>();
    for (const opt of allOptions) {
      if (!optionsByGroupId.has(opt.diet_meal_option_group_id)) {
        optionsByGroupId.set(opt.diet_meal_option_group_id, []);
      }
      optionsByGroupId.get(opt.diet_meal_option_group_id)!.push(opt);
    }

    const groupsByMealId = new Map<number, any[]>();
    for (const g of allGroups) {
      g.options = optionsByGroupId.get(g.id) || [];
      if (!groupsByMealId.has(g.diet_meal_id)) {
        groupsByMealId.set(g.diet_meal_id, []);
      }
      groupsByMealId.get(g.diet_meal_id)!.push(g);
    }

    for (const meal of meals) {
      meal.optionGroups = groupsByMealId.get(meal.id) || [];
      meal.log = logsByMealId.get(meal.id) || null;
    }

    return reply.status(200).send({
      success: true,
      data: {
        date: dateStr,
        meals,
        assignment: activeDietAssign,
      },
    });
  }

  async getMealHistory(request: FastifyRequest, reply: FastifyReply) {
    const auth = (request as AuthenticatedRequest).user;
    const query = (request.query || {}) as { limit?: string; page?: string };
    const limit = parseBoundedPositiveInt(query.limit, 'limit', 1, 100, 50);
    const page = parseBoundedPositiveInt(query.page, 'page', 1, 100000, 1);
    const offset = (page - 1) * limit;
    const [logs, totalRow] = await Promise.all([
      this.db.query(`
        SELECT ml.*, 
               ml.meal_date as log_date,
               dm.name as meal_name 
        FROM meal_logs ml
        JOIN diet_meals dm ON dm.id = ml.diet_meal_id
        WHERE ml.user_id = ?
        ORDER BY ml.meal_date DESC, dm.meal_order ASC
        LIMIT ? OFFSET ?
      `, [auth.userId, limit, offset]),
      this.db.queryOne<{ total: number }>(
        'SELECT COUNT(*) as total FROM meal_logs WHERE user_id = ?',
        [auth.userId],
      ),
    ]);
    const total = Number(totalRow?.total || 0);

    return reply.status(200).send({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
}

export async function mealsRoutes(fastify: FastifyInstance) {
  const controller = new MealsController();

  fastify.get('/me/meals/today', { preHandler: [authenticate] }, (req, res) => controller.getTodayMeals(req, res));
  fastify.put('/me/meals/:mealId/log', { preHandler: [authenticate] }, (req, res) => controller.logMeal(req, res));
  fastify.get('/me/meals/history', { preHandler: [authenticate] }, (req, res) => controller.getMealHistory(req, res));
}
