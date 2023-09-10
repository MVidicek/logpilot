import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ClickHouseStorage } from '../storage/clickhouse';

interface AggregationQuery {
  Querystring: {
    from?: string;
    to?: string;
    interval?: string;
    source?: string;
    level?: string;
    limit?: string;
  };
}

function parseTimeRange(query: AggregationQuery['Querystring']): { from: Date; to: Date; interval: number } {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const interval = parseInt(query.interval || '15', 10) || 15;
  return { from, to, interval };
}

export function registerAggregationRoutes(app: FastifyInstance, clickhouse: ClickHouseStorage): void {
  // Log volume over time
  app.get<AggregationQuery>('/api/v1/aggregations/volume', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          interval: { type: 'string' },
          source: { type: 'string' },
          level: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest<AggregationQuery>, reply: FastifyReply) => {
      const { from, to, interval } = parseTimeRange(request.query);
      const buckets = await clickhouse.getLogVolume(
        from,
        to,
        interval,
        request.query.source,
        request.query.level
      );

      reply.send({ buckets, from: from.toISOString(), to: to.toISOString(), interval });
    },
  });

  // Error rate over time
  app.get<AggregationQuery>('/api/v1/aggregations/error-rate', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          interval: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest<AggregationQuery>, reply: FastifyReply) => {
      const { from, to, interval } = parseTimeRange(request.query);
      const buckets = await clickhouse.getErrorRate(from, to, interval);

      reply.send({ buckets, from: from.toISOString(), to: to.toISOString(), interval });
    },
  });

  // Top sources
  app.get<AggregationQuery>('/api/v1/aggregations/top-sources', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest<AggregationQuery>, reply: FastifyReply) => {
      const { from, to } = parseTimeRange(request.query);
      const limit = parseInt(request.query.limit || '10', 10);
      const sources = await clickhouse.getTopSources(from, to, limit);

      reply.send({ sources, from: from.toISOString(), to: to.toISOString() });
    },
  });
}
