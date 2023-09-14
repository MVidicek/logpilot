import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostgresStorage } from '../storage/postgres';
import { CreateDashboardInput, CreateWidgetInput } from '../types/dashboard';

interface CreateDashBody {
  Body: CreateDashboardInput;
}

interface IdParam {
  Params: { id: string };
}

interface AddWidgetBody {
  Params: { id: string };
  Body: CreateWidgetInput;
}

interface WidgetIdParam {
  Params: { id: string; widgetId: string };
}

export function registerDashboardRoutes(app: FastifyInstance, postgres: PostgresStorage): void {
  // List dashboards
  app.get('/api/v1/dashboards', async (_request: FastifyRequest, reply: FastifyReply) => {
    const dashboards = await postgres.listDashboards();
    reply.send({ dashboards });
  });

  // Get dashboard with widgets
  app.get<IdParam>('/api/v1/dashboards/:id', async (request: FastifyRequest<IdParam>, reply: FastifyReply) => {
    const dashboard = await postgres.getDashboard(request.params.id);
    if (!dashboard) {
      reply.status(404).send({ error: 'Dashboard not found' });
      return;
    }
    reply.send(dashboard);
  });

  // Create dashboard
  app.post<CreateDashBody>('/api/v1/dashboards', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest<CreateDashBody>, reply: FastifyReply) => {
      const dashboard = await postgres.createDashboard(request.body);
      reply.status(201).send(dashboard);
    },
  });

  // Delete dashboard
  app.delete<IdParam>('/api/v1/dashboards/:id', async (request: FastifyRequest<IdParam>, reply: FastifyReply) => {
    const deleted = await postgres.deleteDashboard(request.params.id);
    if (!deleted) {
      reply.status(404).send({ error: 'Dashboard not found' });
      return;
    }
    reply.status(204).send();
  });

  // Add widget to dashboard
  app.post<AddWidgetBody>('/api/v1/dashboards/:id/widgets', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'title', 'config', 'position'],
        properties: {
          type: { type: 'string', enum: ['log_volume', 'error_rate', 'top_sources', 'recent_alerts', 'log_count'] },
          title: { type: 'string', minLength: 1 },
          config: { type: 'object' },
          position: {
            type: 'object',
            required: ['x', 'y', 'w', 'h'],
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              w: { type: 'number' },
              h: { type: 'number' },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest<AddWidgetBody>, reply: FastifyReply) => {
      const dashboard = await postgres.getDashboard(request.params.id);
      if (!dashboard) {
        reply.status(404).send({ error: 'Dashboard not found' });
        return;
      }

      const widget = await postgres.addWidget(request.params.id, request.body);
      reply.status(201).send(widget);
    },
  });

  // Delete widget
  app.delete<WidgetIdParam>(
    '/api/v1/dashboards/:id/widgets/:widgetId',
    async (request: FastifyRequest<WidgetIdParam>, reply: FastifyReply) => {
      const deleted = await postgres.deleteWidget(request.params.widgetId);
      if (!deleted) {
        reply.status(404).send({ error: 'Widget not found' });
        return;
      }
      reply.status(204).send();
    }
  );
}
