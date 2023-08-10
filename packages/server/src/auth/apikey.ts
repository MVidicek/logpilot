import { FastifyRequest, FastifyReply } from 'fastify';
import { PostgresStorage } from '../storage/postgres';

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyId?: string;
    apiKeyName?: string;
  }
}

export function createApiKeyAuth(postgres: PostgresStorage) {
  return async function apiKeyAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      reply.status(401).send({ error: 'Missing X-API-Key header' });
      return;
    }

    const result = await postgres.validateApiKey(apiKey);
    if (!result) {
      reply.status(401).send({ error: 'Invalid API key' });
      return;
    }

    request.apiKeyId = result.id;
    request.apiKeyName = result.name;
  };
}
