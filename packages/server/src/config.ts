export interface Config {
  port: number;
  host: string;
  logLevel: string;

  clickhouse: {
    url: string;
    database: string;
    username: string;
    password: string;
  };

  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };

  redis: {
    host: string;
    port: number;
    password: string | undefined;
  };

  syslog: {
    enabled: boolean;
    udpPort: number;
    tcpPort: number;
  };

  auth: {
    sessionSecret: string;
    sessionMaxAge: number;
    bcryptRounds: number;
  };

  alerts: {
    checkIntervalSeconds: number;
  };

  retention: {
    defaultDays: number;
  };

  ingestion: {
    batchSize: number;
    flushIntervalMs: number;
    redisStreamKey: string;
    redisPubSubChannel: string;
  };
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function loadConfig(): Config {
  const sessionSecret = envStr('SESSION_SECRET', 'change-me-in-production');

  // Prevent running with the default secret in production
  if (process.env.NODE_ENV === 'production' && sessionSecret === 'change-me-in-production') {
    throw new Error('SESSION_SECRET must be set in production. Generate one with: openssl rand -hex 32');
  }

  return {
    port: envInt('PORT', 3100),
    host: envStr('HOST', '0.0.0.0'),
    logLevel: envStr('LOG_LEVEL', 'info'),

    clickhouse: {
      url: envStr('CLICKHOUSE_URL', 'http://localhost:8123'),
      database: envStr('CLICKHOUSE_DB', 'logpilot'),
      username: envStr('CLICKHOUSE_USER', 'default'),
      password: envStr('CLICKHOUSE_PASSWORD', ''),
    },

    postgres: {
      host: envStr('POSTGRES_HOST', 'localhost'),
      port: envInt('POSTGRES_PORT', 5432),
      database: envStr('POSTGRES_DB', 'logpilot'),
      user: envStr('POSTGRES_USER', 'logpilot'),
      password: envStr('POSTGRES_PASSWORD', 'logpilot'),
    },

    redis: {
      host: envStr('REDIS_HOST', 'localhost'),
      port: envInt('REDIS_PORT', 6379),
      password: process.env['REDIS_PASSWORD'] || undefined,
    },

    syslog: {
      enabled: envStr('SYSLOG_ENABLED', 'true') === 'true',
      udpPort: envInt('SYSLOG_UDP_PORT', 5514),
      tcpPort: envInt('SYSLOG_TCP_PORT', 5514),
    },

    auth: {
      sessionSecret,
      sessionMaxAge: envInt('SESSION_MAX_AGE', 86400000), // 24 hours
      bcryptRounds: envInt('BCRYPT_ROUNDS', 10),
    },

    alerts: {
      checkIntervalSeconds: envInt('ALERT_CHECK_INTERVAL', 60),
    },

    retention: {
      defaultDays: envInt('RETENTION_DAYS', 30),
    },

    ingestion: {
      batchSize: envInt('INGESTION_BATCH_SIZE', 500),
      flushIntervalMs: envInt('INGESTION_FLUSH_INTERVAL_MS', 2000),
      redisStreamKey: envStr('REDIS_STREAM_KEY', 'logpilot:logs'),
      redisPubSubChannel: envStr('REDIS_PUBSUB_CHANNEL', 'logpilot:live'),
    },
  };
}
