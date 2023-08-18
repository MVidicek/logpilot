import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostgresStorage } from '../storage/postgres';
import { CreateAlertRuleInput, UpdateAlertRuleInput } from '../types/alert';

interface CreateBody {
  Body: CreateAlertRuleInput;
}

interface UpdateBody {
  Body: UpdateAlertRuleInput;
  Params: { id: string };
}

interface IdParam {
  Params: { id: string };
}

export function registerAlertRuleRoutes(app: FastifyInstance, postgres: PostgresStorage): void {
  // List all alert rules
  app.get('/api/v1/alerts', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rules = await postgres.listAlertRules();
    reply.send({ rules });
  });

  // Get single alert rule
  app.get<IdParam>('/api/v1/alerts/:id', async (request: FastifyRequest<IdParam>, reply: FastifyReply) => {
    const rule = await postgres.getAlertRule(request.params.id);
    if (!rule) {
      reply.status(404).send({ error: 'Alert rule not found' });
      return;
    }
    reply.send(rule);
  });

  // Create alert rule
  app.post<CreateBody>('/api/v1/alerts', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type', 'condition', 'notifiers'],
        properties: {
          name: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['threshold', 'pattern'] },
          condition: { type: 'object' },
          notifiers: { type: 'array' },
          cooldown_minutes: { type: 'number', minimum: 1 },
        },
      },
    },
    handler: async (request: FastifyRequest<CreateBody>, reply: FastifyReply) => {
      const rule = await postgres.createAlertRule(request.body);
      reply.status(201).send(rule);
    },
  });

  // Update alert rule
  app.patch<UpdateBody>('/api/v1/alerts/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['active', 'paused'] },
          condition: { type: 'object' },
          notifiers: { type: 'array' },
          cooldown_minutes: { type: 'number', minimum: 1 },
        },
      },
    },
    handler: async (request: FastifyRequest<UpdateBody>, reply: FastifyReply) => {
      const rule = await postgres.updateAlertRule(request.params.id, request.body);
      if (!rule) {
        reply.status(404).send({ error: 'Alert rule not found' });
        return;
      }
      reply.send(rule);
    },
  });

  // Delete alert rule
  app.delete<IdParam>('/api/v1/alerts/:id', async (request: FastifyRequest<IdParam>, reply: FastifyReply) => {
    const deleted = await postgres.deleteAlertRule(request.params.id);
    if (!deleted) {
      reply.status(404).send({ error: 'Alert rule not found' });
      return;
    }
    reply.status(204).send();
  });
}
