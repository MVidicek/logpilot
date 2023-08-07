import { FastifyRequest, FastifyReply } from 'fastify';
import { PostgresStorage } from '../storage/postgres';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
    userName?: string;
  }
}

const SESSION_COOKIE = 'logpilot_session';

export function createSessionAuth(postgres: PostgresStorage) {
  return async function sessionAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const sessionId = (request.cookies as Record<string, string>)?.[SESSION_COOKIE];

    if (!sessionId) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const session = await postgres.getSession(sessionId);
    if (!session) {
      reply.status(401).send({ error: 'Session expired or invalid' });
      return;
    }

    request.userId = session.userId;
    request.userEmail = session.email;
    request.userName = session.name;
  };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}
