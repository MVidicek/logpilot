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

export interface AppContext {
  app: FastifyInstance;
  clickhouse: ClickHouseStorage;
  postgres: PostgresStorage;
  httpIngestion: HttpIngestion;
  syslogReceiver: SyslogReceiver;
  alertEngine: AlertEngine;
}

export async function buildApp(config: Config): Promise<AppContext> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(cookie);
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

  // API key auth hook for ingestion endpoint
  const apiKeyAuth = createApiKeyAuth(postgres);

  app.addHook('onRequest', async (request, reply) => {
    // Only require API key for log ingestion
    if (request.url === '/api/v1/logs' && request.method === 'POST') {
      await apiKeyAuth(request, reply);
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
