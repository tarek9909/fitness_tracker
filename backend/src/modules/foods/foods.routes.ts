import { FoodsRepository } from './foods.repository.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/authorize.js';
import { parseBoundedPositiveInt, parsePositiveInt } from '../../shared/utils/request-utils.js';

export class FoodsService {
  private repo = new FoodsRepository();

  async getFoods(params: { search?: string; page?: number; limit?: number; isArchived?: boolean; includeInactive?: boolean }) {
    return this.repo.findAll(params);
  }

  async getFoodById(id: number) {
    const food = await this.repo.findById(id);
    if (!food) throw new NotFoundError('Food not found');
    return food;
  }

  async createFood(data: any) {
    const id = await this.repo.create(data);
    return this.getFoodById(id);
  }

  async updateFood(id: number, data: any) {
    await this.getFoodById(id);
    await this.repo.update(id, data);
    return this.getFoodById(id);
  }

  async setArchiveStatus(id: number, isArchived: boolean) {
    await this.getFoodById(id);
    await this.repo.setArchiveStatus(id, isArchived);
    return this.getFoodById(id);
  }

  async getMeasurementUnits() {
    return this.repo.getMeasurementUnits();
  }
}

const createFoodSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  measurementUnitId: z.number().int().positive().optional(),
  referenceUnitId: z.number().int().positive().optional(),
  defaultServingAmount: z.number().positive().optional(),
  referenceQuantity: z.number().positive().optional(),
  calories: z.number().min(0).optional(),
  proteinG: z.number().min(0).optional(),
  carbsG: z.number().min(0).optional(),
  fatG: z.number().min(0).optional(),
  fiberG: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const updateFoodSchema = createFoodSchema.partial();

export class FoodsController {
  private service = new FoodsService();

  async listFoods(request: FastifyRequest, reply: FastifyReply) {
    const q = (request.query || {}) as any;
    const page = parseBoundedPositiveInt(q.page, 'page', 1, 100000, 1);
    const limit = parseBoundedPositiveInt(q.limit, 'limit', 1, 100, 50);
    const isArchived = q.isArchived !== undefined ? q.isArchived === 'true' || q.isArchived === '1' : undefined;

    const result = await this.service.getFoods({
      search: q.search,
      isArchived,
      includeInactive: q.includeInactive === 'true' || q.includeInactive === '1',
      page,
      limit,
    });

    return reply.status(200).send({
      success: true,
      data: result.foods,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  }

  async getFood(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const foodId = parsePositiveInt(params.id, 'foodId');
    const food = await this.service.getFoodById(foodId);
    return reply.status(200).send({ success: true, data: food });
  }

  async createFood(request: FastifyRequest, reply: FastifyReply) {
    const body = createFoodSchema.parse(request.body);
    const food = await this.service.createFood(body);
    return reply.status(201).send({ success: true, data: food });
  }

  async updateFood(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const foodId = parsePositiveInt(params.id, 'foodId');
    const body = updateFoodSchema.parse(request.body);
    const food = await this.service.updateFood(foodId, body);
    return reply.status(200).send({ success: true, data: food });
  }

  async archiveFood(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const foodId = parsePositiveInt(params.id, 'foodId');
    const food = await this.service.setArchiveStatus(foodId, true);
    return reply.status(200).send({ success: true, data: food });
  }

  async restoreFood(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const foodId = parsePositiveInt(params.id, 'foodId');
    const food = await this.service.setArchiveStatus(foodId, false);
    return reply.status(200).send({ success: true, data: food });
  }

  async getMeasurementUnits(request: FastifyRequest, reply: FastifyReply) {
    const units = await this.service.getMeasurementUnits();
    return reply.status(200).send({ success: true, data: units });
  }
}

export async function foodsRoutes(fastify: FastifyInstance) {
  const controller = new FoodsController();

  fastify.get('/admin/foods/measurement-units', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getMeasurementUnits(req, res));
  fastify.get('/admin/foods', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.listFoods(req, res));
  fastify.get('/foods', { preHandler: [authenticate] }, (req, res) => controller.listFoods(req, res));
  fastify.post('/admin/foods', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.createFood(req, res));
  fastify.get('/admin/foods/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.getFood(req, res));
  fastify.patch('/admin/foods/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.updateFood(req, res));
  fastify.delete('/admin/foods/:id', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.archiveFood(req, res));
  fastify.post('/admin/foods/:id/archive', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.archiveFood(req, res));
  fastify.post('/admin/foods/:id/restore', { preHandler: [authenticate, requireAdmin] }, (req, res) => controller.restoreFood(req, res));
}
