import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import { Config } from './config';
import { ClickHouseStorage } from './storage/clickhouse';
import { PostgresStorage } from './storage/postgres';
import { HttpIngestion } from './ingestion/http';
import { SyslogReceiver } from './ingestion/syslog';
import { AlertEngine } from './alerts/engine';
import { registerLogRoutes } from './api/logs';
import { registerAlertRoutes } from './api/alerts';
import { registerDashboardRoutes } from './api/dashboards';
import { registerAdminRoutes } from './api/admin';
import { createApiKeyAuth } from './auth/apikey';
import { createSessionAuth } from './auth/session';

export interface AppContext {
  app: FastifyInstance;
  clickhouse: ClickHouseStorage;
  postgres: PostgresStorage;
  httpIngestion: HttpIngestion;
  syslogReceiver: SyslogReceiver;
  alertEngine: AlertEngine;
}

// Routes that don't require session authentication
const PUBLIC_ROUTES = new Set([
  '/health',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
]);

export async function buildApp(config: Config): Promise<AppContext> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.auth.sessionSecret,
  });
  await app.register(websocket);

  // Initialize storage
  const clickhouse = new ClickHouseStorage(config);
  const postgres = new PostgresStorage(config);

  await clickhouse.initialize();
  await postgres.initialize();

  // Initialize ingestion
  const httpIngestion = new HttpIngestion(config, clickhouse);
  const syslogReceiver = new SyslogReceiver(config, clickhouse);

  // Initialize alert engine
  const alertEngine = new AlertEngine(
    postgres,
    clickhouse,
    config.alerts.checkIntervalSeconds * 1000
  );

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Auth hooks
  const apiKeyAuth = createApiKeyAuth(postgres);
  const sessionAuth = createSessionAuth(postgres);

  app.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0];

    // API key auth for log ingestion
    if (url === '/api/v1/logs' && request.method === 'POST') {
      await apiKeyAuth(request, reply);
      return;
    }

    // Session auth for all other /api routes (except public ones)
    if (url.startsWith('/api/') && !PUBLIC_ROUTES.has(url)) {
      await sessionAuth(request, reply);
    }
  });

  // Register routes
  httpIngestion.registerRoutes(app);
  registerLogRoutes(app, clickhouse, config);
  registerAlertRoutes(app, postgres);
  registerDashboardRoutes(app, postgres);
  registerAdminRoutes(app, postgres, config);

  return {
    app,
    clickhouse,
    postgres,
    httpIngestion,
    syslogReceiver,
    alertEngine,
  };
}
