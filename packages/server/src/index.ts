import { loadConfig } from './config';
import { buildApp } from './app';

async function main(): Promise<void> {
  const config = loadConfig();

  console.log('[logpilot] Starting server...');

  const { app, clickhouse, postgres, httpIngestion, syslogReceiver, alertEngine } =
    await buildApp(config);

  // Start syslog receiver
  await syslogReceiver.start();

  // Start alert engine
  alertEngine.start();

  // Start HTTP server
  await app.listen({ port: config.port, host: config.host });
  console.log(`[logpilot] Server listening on ${config.host}:${config.port}`);

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[logpilot] Received ${signal}, shutting down...`);

    alertEngine.stop();

    await syslogReceiver.shutdown();
    await httpIngestion.shutdown();
    await app.close();
    await clickhouse.close();
    await postgres.close();

    console.log('[logpilot] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[logpilot] Fatal error:', err);
  process.exit(1);
});
