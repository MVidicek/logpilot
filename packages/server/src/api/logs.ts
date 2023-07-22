import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ClickHouseStorage } from '../storage/clickhouse';
import { registerSearchRoutes } from '../query/search';
import { registerAggregationRoutes } from '../query/aggregation';
import Redis from 'ioredis';
import { Config } from '../config';
import type { WebSocket } from '@fastify/websocket';

interface TailQuery {
  Querystring: {
    level?: string;
    source?: string;
    q?: string;
  };
}

export function registerLogRoutes(
  app: FastifyInstance,
  clickhouse: ClickHouseStorage,
  config: Config
): void {
  // Register search and aggregation routes
  registerSearchRoutes(app, clickhouse);
  registerAggregationRoutes(app, clickhouse);

  // WebSocket live tail
  app.get<TailQuery>('/api/v1/logs/tail', { websocket: true }, (socket: WebSocket, request: FastifyRequest<TailQuery>) => {
    const filters = {
      level: request.query.level?.split(',').map((l) => l.trim().toLowerCase()),
      source: request.query.source,
      query: request.query.q?.toLowerCase(),
    };

    const subRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });

    subRedis.subscribe(config.ingestion.redisPubSubChannel).catch((err) => {
      console.error('[tail] Redis subscribe error:', err);
    });

    subRedis.on('message', (_channel: string, message: string) => {
      try {
        const log = JSON.parse(message);

        // Apply filters
        if (filters.level && filters.level.length > 0 && !filters.level.includes(log.level)) {
          return;
        }
        if (filters.source && log.source !== filters.source) {
          return;
        }
        if (filters.query && !log.message.toLowerCase().includes(filters.query)) {
          return;
        }

        socket.send(message);
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      subRedis.unsubscribe().catch(() => {});
      subRedis.quit().catch(() => {});
    });

    socket.on('error', () => {
      subRedis.unsubscribe().catch(() => {});
      subRedis.quit().catch(() => {});
    });
  });

  // Get distinct sources
  app.get('/api/v1/sources', async (_request: FastifyRequest, reply: FastifyReply) => {
    const sources = await clickhouse.getSources();
    reply.send({ sources });
  });
}
