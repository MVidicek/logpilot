import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostgresStorage } from '../storage/postgres';
import { Config } from '../config';
import { getSessionCookieName } from '../auth/session';

interface LoginBody {
  Body: { email: string; password: string };
}

interface RegisterBody {
  Body: { email: string; password: string; name?: string };
}

interface CreateKeyBody {
  Body: { name: string };
}

interface IdParam {
  Params: { id: string };
}

interface SaveSearchBody {
  Body: { name: string; query: string; filters: Record<string, unknown> };
}

export function registerAdminRoutes(
  app: FastifyInstance,
  postgres: PostgresStorage,
  config: Config
): void {
  // --- Auth ---

  app.post<LoginBody>('/api/v1/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
    handler: async (request: FastifyRequest<LoginBody>, reply: FastifyReply) => {
      const { email, password } = request.body;
      const user = await postgres.authenticateUser(email, password);

      if (!user) {
        reply.status(401).send({ error: 'Invalid credentials' });
        return;
      }

      const sessionId = await postgres.createSession(user.id, config.auth.sessionMaxAge);

      reply
        .setCookie(getSessionCookieName(), sessionId, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: config.auth.sessionMaxAge / 1000,
        })
        .send({ user: { id: user.id, email: user.email, name: user.name } });
    },
  });

  app.post('/api/v1/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = (request.cookies as Record<string, string>)?.[getSessionCookieName()];
    if (sessionId) {
      await postgres.deleteSession(sessionId);
    }

    reply
      .clearCookie(getSessionCookieName(), { path: '/' })
      .send({ message: 'Logged out' });
  });

  app.get('/api/v1/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = (request.cookies as Record<string, string>)?.[getSessionCookieName()];
    if (!sessionId) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const session = await postgres.getSession(sessionId);
    if (!session) {
      reply.status(401).send({ error: 'Session expired' });
      return;
    }

    reply.send({ user: { id: session.userId, email: session.email, name: session.name } });
  });

  app.post<RegisterBody>('/api/v1/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' },
        },
      },
    },
    handler: async (request: FastifyRequest<RegisterBody>, reply: FastifyReply) => {
      // Only allow registration if no users exist yet (first-user setup)
      const userCount = await postgres.getUserCount();
      if (userCount > 0) {
        reply.status(403).send({ error: 'Registration is disabled. Contact an admin for access.' });
        return;
      }

      try {
        const { email, password, name } = request.body;
        const user = await postgres.createUser(email, password, name);
        reply.status(201).send({ user: { id: user.id } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('duplicate key') || message.includes('unique')) {
          reply.status(409).send({ error: 'Email already registered' });
          return;
        }
        throw err;
      }
    },
  });

  // --- API Keys ---

  app.get('/api/v1/api-keys', async (_request: FastifyRequest, reply: FastifyReply) => {
    const keys = await postgres.listApiKeys();
    reply.send({ keys });
  });

  app.post<CreateKeyBody>('/api/v1/api-keys', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: async (request: FastifyRequest<CreateKeyBody>, reply: FastifyReply) => {
      const result = await postgres.createApiKey(request.body.name);
      reply.status(201).send({
        id: result.id,
        key: result.key,
        prefix: result.prefix,
        message: 'Store this key securely — it will not be shown again.',
      });
    },
  });

  app.delete<IdParam>('/api/v1/api-keys/:id', async (request: FastifyRequest<IdParam>, reply: FastifyReply) => {
    await postgres.revokeApiKey(request.params.id);
    reply.status(204).send();
  });

  // --- Saved Searches ---

  app.get('/api/v1/saved-searches', async (_request: FastifyRequest, reply: FastifyReply) => {
    const searches = await postgres.listSavedSearches();
    reply.send({ searches });
  });

  app.post<SaveSearchBody>('/api/v1/saved-searches', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'query'],
        properties: {
          name: { type: 'string', minLength: 1 },
          query: { type: 'string' },
          filters: { type: 'object' },
        },
      },
    },
    handler: async (request: FastifyRequest<SaveSearchBody>, reply: FastifyReply) => {
      const { name, query, filters } = request.body;
      const result = await postgres.createSavedSearch(name, query, filters || {});
      reply.status(201).send(result);
    },
  });

  app.delete<IdParam>('/api/v1/saved-searches/:id', async (request: FastifyRequest<IdParam>, reply: FastifyReply) => {
    const deleted = await postgres.deleteSavedSearch(request.params.id);
    if (!deleted) {
      reply.status(404).send({ error: 'Saved search not found' });
      return;
    }
    reply.status(204).send();
  });
}
