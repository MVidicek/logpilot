import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { LogEntry, LogIngestionPayload, LogLevel } from '../types/log';
import { parse, normalizeLevel } from './parser';
import { Config } from '../config';
import { ClickHouseStorage } from '../storage/clickhouse';

interface IngestBody {
  Body: LogIngestionPayload | LogIngestionPayload[];
}

export class HttpIngestion {
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private redis: Redis;
  private pubRedis: Redis;

  constructor(
    private config: Config,
    private clickhouse: ClickHouseStorage
  ) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
    });

    this.pubRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
    });

    this.startFlushInterval();
  }

  registerRoutes(app: FastifyInstance): void {
    app.post<IngestBody>('/api/v1/logs', {
      schema: {
        body: {
          oneOf: [
            {
              type: 'object',
              required: ['message'],
              properties: {
                level: { type: 'string' },
                message: { type: 'string' },
                source: { type: 'string' },
                timestamp: { type: 'string' },
                metadata: { type: 'object' },
              },
            },
            {
              type: 'array',
              items: {
                type: 'object',
                required: ['message'],
                properties: {
                  level: { type: 'string' },
                  message: { type: 'string' },
                  source: { type: 'string' },
                  timestamp: { type: 'string' },
                  metadata: { type: 'object' },
                },
              },
            },
          ],
        },
      },
      handler: async (request: FastifyRequest<IngestBody>, reply: FastifyReply) => {
        const payloads = Array.isArray(request.body) ? request.body : [request.body];
        const entries: LogEntry[] = [];

        for (const payload of payloads) {
          const entry = this.payloadToEntry(payload, request);
          entries.push(entry);
        }

        // Add to buffer for batch insertion
        this.buffer.push(...entries);

        // Push to Redis stream for live tail
        for (const entry of entries) {
          const serialized = JSON.stringify({
            id: entry.id,
            timestamp: entry.timestamp.toISOString(),
            level: entry.level,
            message: entry.message,
            source: entry.source,
            metadata: entry.metadata,
          });

          // Publish for live tail subscribers
          await this.pubRedis.publish(
            this.config.ingestion.redisPubSubChannel,
            serialized
          ).catch(() => {});

          // Add to stream as backup
          await this.redis.xadd(
            this.config.ingestion.redisStreamKey,
            'MAXLEN', '~', '10000',
            '*',
            'data', serialized
          ).catch(() => {});
        }

        // Flush if buffer is large enough
        if (this.buffer.length >= this.config.ingestion.batchSize) {
          await this.flush();
        }

        reply.status(202).send({
          accepted: entries.length,
          message: 'Logs accepted for processing',
        });
      },
    });
  }

  private payloadToEntry(payload: LogIngestionPayload, request: FastifyRequest): LogEntry {
    let timestamp: Date;
    if (payload.timestamp) {
      const parsed = new Date(payload.timestamp);
      timestamp = isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      timestamp = new Date();
    }

    const level: LogLevel = payload.level
      ? normalizeLevel(payload.level)
      : 'info';

    // If the message looks like a structured log format, parse it
    const parsed = parse(payload.message);

    return {
      id: uuidv4(),
      timestamp: parsed.timestamp || timestamp,
      level: payload.level ? level : parsed.level,
      message: parsed.message || payload.message,
      source: payload.source || parsed.source || 'unknown',
      metadata: { ...parsed.metadata, ...(payload.metadata || {}) },
      raw: payload.message,
    };
  }

  private startFlushInterval(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush().catch((err) => {
          console.error('[ingestion] Flush error:', err);
        });
      }
    }, this.config.ingestion.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.config.ingestion.batchSize);

    try {
      await this.clickhouse.insert(batch);
    } catch (err) {
      // Put failed entries back at the front of the buffer
      this.buffer.unshift(...batch);
      throw err;
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flush().catch((err) => {
      console.error('[ingestion] Final flush error:', err);
    });

    await this.redis.quit();
    await this.pubRedis.quit();
  }
}
