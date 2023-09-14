import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ClickHouseStorage } from '../storage/clickhouse';

export function registerSourceRoutes(app: FastifyInstance, clickhouse: ClickHouseStorage): void {
  app.get('/api/v1/sources', async (_request: FastifyRequest, reply: FastifyReply) => {
    const sources = await clickhouse.getSources();
    reply.send({ sources });
  });
}
