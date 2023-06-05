import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ClickHouseStorage } from '../storage/clickhouse';
import { SearchParams, LogLevel } from '../types/log';

interface SearchQuery {
  Querystring: {
    q?: string;
    level?: string;
    source?: string;
    from?: string;
    to?: string;
    limit?: string;
    offset?: string;
  };
}

export function buildSearchParams(query: SearchQuery['Querystring']): SearchParams {
  const params: SearchParams = {
    limit: Math.min(parseInt(query.limit || '50', 10) || 50, 1000),
    offset: parseInt(query.offset || '0', 10) || 0,
  };

  if (query.q) {
    params.query = query.q;
  }

  if (query.level) {
    const levels = query.level.split(',').map((l) => l.trim().toLowerCase()) as LogLevel[];
    if (levels.length === 1) {
      params.level = levels[0];
    } else {
      params.level = levels;
    }
  }

  if (query.source) {
    params.source = query.source;
  }

  if (query.from) {
    const from = new Date(query.from);
    if (!isNaN(from.getTime())) params.from = from;
  }

  if (query.to) {
    const to = new Date(query.to);
    if (!isNaN(to.getTime())) params.to = to;
  }

  // Default time range: last 24 hours if no from specified
  if (!params.from) {
    params.from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  return params;
}

export function registerSearchRoutes(app: FastifyInstance, clickhouse: ClickHouseStorage): void {
  app.get<SearchQuery>('/api/v1/logs', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          level: { type: 'string' },
          source: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest<SearchQuery>, reply: FastifyReply) => {
      const params = buildSearchParams(request.query);
      const result = await clickhouse.query(params);

      reply.send({
        logs: result.logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp.toISOString(),
          level: log.level,
          message: log.message,
          source: log.source,
          metadata: log.metadata,
        })),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    },
  });
}
