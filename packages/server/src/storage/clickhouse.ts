import { createClient, ClickHouseClient } from '@clickhouse/client';
import { Config } from '../config';
import { LogEntry, SearchParams, SearchResult, AggregationBucket, SourceCount, ErrorRate } from '../types/log';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS logs (
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3, 'UTC'),
  level Enum8('debug' = 1, 'info' = 2, 'warn' = 3, 'error' = 4, 'fatal' = 5),
  message String,
  source String,
  metadata Map(String, String),
  raw String
)
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (source, level, timestamp, id)
TTL toDateTime(timestamp) + INTERVAL {retention_days:UInt32} DAY
SETTINGS index_granularity = 8192
`;

const SCHEMA_SQL_DEFAULT = `
CREATE TABLE IF NOT EXISTS logs (
  id UUID DEFAULT generateUUIDv4(),
  timestamp DateTime64(3, 'UTC'),
  level Enum8('debug' = 1, 'info' = 2, 'warn' = 3, 'error' = 4, 'fatal' = 5),
  message String,
  source String,
  metadata Map(String, String),
  raw String
)
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (source, level, timestamp, id)
TTL toDateTime(timestamp) + INTERVAL 30 DAY
SETTINGS index_granularity = 8192
`;

export class ClickHouseStorage {
  private client: ClickHouseClient;
  private database: string;

  constructor(private config: Config) {
    this.database = config.clickhouse.database;
    this.client = createClient({
      url: config.clickhouse.url,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      database: this.database,
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 0,
      },
    });
  }

  async initialize(): Promise<void> {
    // Create database if it doesn't exist
    await this.client.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${this.database}`,
    });

    // Create logs table
    await this.client.exec({
      query: SCHEMA_SQL_DEFAULT,
    });
  }

  async insert(logs: LogEntry[]): Promise<void> {
    if (logs.length === 0) return;

    const rows = logs.map((log) => ({
      id: log.id || crypto.randomUUID(),
      timestamp: log.timestamp.toISOString().replace('T', ' ').replace('Z', ''),
      level: log.level,
      message: log.message,
      source: log.source,
      metadata: log.metadata,
      raw: log.raw || '',
    }));

    await this.client.insert({
      table: 'logs',
      values: rows,
      format: 'JSONEachRow',
    });
  }

  async query(params: SearchParams): Promise<SearchResult> {
    const { conditions, queryParams } = this.buildWhereClause(params);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT count() as total FROM logs ${whereClause}`;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: queryParams,
      format: 'JSONEachRow',
    });
    const countRows = await countResult.json<{ total: string }>();
    const total = parseInt(countRows[0]?.total || '0', 10);

    // Get page of results
    const dataQuery = `
      SELECT id, timestamp, level, message, source, metadata, raw
      FROM logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}
      OFFSET {offset:UInt32}
    `;

    const dataResult = await this.client.query({
      query: dataQuery,
      query_params: { ...queryParams, limit: params.limit, offset: params.offset },
      format: 'JSONEachRow',
    });

    const rows = await dataResult.json<{
      id: string;
      timestamp: string;
      level: string;
      message: string;
      source: string;
      metadata: Record<string, string>;
      raw: string;
    }>();

    const logs: LogEntry[] = rows.map((row) => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      level: row.level as LogEntry['level'],
      message: row.message,
      source: row.source,
      metadata: row.metadata || {},
      raw: row.raw,
    }));

    return { logs, total, limit: params.limit, offset: params.offset };
  }

  async getLogVolume(
    from: Date,
    to: Date,
    intervalMinutes: number,
    source?: string,
    level?: string
  ): Promise<AggregationBucket[]> {
    const conditions: string[] = [
      'timestamp >= {from:DateTime64(3)}',
      'timestamp <= {to:DateTime64(3)}',
    ];
    const queryParams: Record<string, unknown> = {
      from: from.toISOString(),
      to: to.toISOString(),
      interval: intervalMinutes,
    };

    if (source) {
      conditions.push('source = {source:String}');
      queryParams.source = source;
    }
    if (level) {
      conditions.push('level = {level:String}');
      queryParams.level = level;
    }

    const query = `
      SELECT
        toStartOfInterval(timestamp, INTERVAL {interval:UInt32} MINUTE) AS bucket,
        count() AS count
      FROM logs
      WHERE ${conditions.join(' AND ')}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const result = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await result.json<{ bucket: string; count: string }>();
    return rows.map((r) => ({ bucket: r.bucket, count: parseInt(r.count, 10) }));
  }

  async getErrorRate(
    from: Date,
    to: Date,
    intervalMinutes: number
  ): Promise<ErrorRate[]> {
    const query = `
      SELECT
        toStartOfInterval(timestamp, INTERVAL {interval:UInt32} MINUTE) AS bucket,
        count() AS total,
        countIf(level IN ('error', 'fatal')) AS errors
      FROM logs
      WHERE timestamp >= {from:DateTime64(3)} AND timestamp <= {to:DateTime64(3)}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const result = await this.client.query({
      query,
      query_params: {
        from: from.toISOString(),
        to: to.toISOString(),
        interval: intervalMinutes,
      },
      format: 'JSONEachRow',
    });

    const rows = await result.json<{ bucket: string; total: string; errors: string }>();
    return rows.map((r) => {
      const total = parseInt(r.total, 10);
      const errors = parseInt(r.errors, 10);
      return {
        bucket: r.bucket,
        total,
        errors,
        rate: total > 0 ? errors / total : 0,
      };
    });
  }

  async getTopSources(from: Date, to: Date, limit: number = 10): Promise<SourceCount[]> {
    const query = `
      SELECT source, count() AS count
      FROM logs
      WHERE timestamp >= {from:DateTime64(3)} AND timestamp <= {to:DateTime64(3)}
      GROUP BY source
      ORDER BY count DESC
      LIMIT {limit:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: {
        from: from.toISOString(),
        to: to.toISOString(),
        limit,
      },
      format: 'JSONEachRow',
    });

    const rows = await result.json<{ source: string; count: string }>();
    return rows.map((r) => ({ source: r.source, count: parseInt(r.count, 10) }));
  }

  async getSources(): Promise<string[]> {
    const result = await this.client.query({
      query: 'SELECT DISTINCT source FROM logs ORDER BY source',
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ source: string }>();
    return rows.map((r) => r.source);
  }

  async countSince(
    sinceMinutes: number,
    filters?: { level?: string; source?: string; query?: string }
  ): Promise<number> {
    const conditions: string[] = [
      'timestamp >= now() - INTERVAL {minutes:UInt32} MINUTE',
    ];
    const queryParams: Record<string, unknown> = { minutes: sinceMinutes };

    if (filters?.level) {
      conditions.push('level = {level:String}');
      queryParams.level = filters.level;
    }
    if (filters?.source) {
      conditions.push('source = {source:String}');
      queryParams.source = filters.source;
    }
    if (filters?.query) {
      conditions.push('position(lower(message), lower({search:String})) > 0');
      queryParams.search = filters.query;
    }

    const q = `SELECT count() as cnt FROM logs WHERE ${conditions.join(' AND ')}`;
    const result = await this.client.query({
      query: q,
      query_params: queryParams,
      format: 'JSONEachRow',
    });
    const rows = await result.json<{ cnt: string }>();
    return parseInt(rows[0]?.cnt || '0', 10);
  }

  async searchPattern(
    pattern: string,
    isRegex: boolean,
    sinceMinutes: number,
    filters?: { level?: string; source?: string }
  ): Promise<{ count: number; samples: Array<{ timestamp: string; level: string; message: string }> }> {
    const conditions: string[] = [
      'timestamp >= now() - INTERVAL {minutes:UInt32} MINUTE',
    ];
    const queryParams: Record<string, unknown> = { minutes: sinceMinutes };

    if (isRegex) {
      conditions.push('match(message, {pattern:String})');
    } else {
      conditions.push('position(lower(message), lower({pattern:String})) > 0');
    }
    queryParams.pattern = pattern;

    if (filters?.level) {
      conditions.push('level = {level:String}');
      queryParams.level = filters.level;
    }
    if (filters?.source) {
      conditions.push('source = {source:String}');
      queryParams.source = filters.source;
    }

    const where = conditions.join(' AND ');

    const countResult = await this.client.query({
      query: `SELECT count() as cnt FROM logs WHERE ${where}`,
      query_params: queryParams,
      format: 'JSONEachRow',
    });
    const countRows = await countResult.json<{ cnt: string }>();
    const count = parseInt(countRows[0]?.cnt || '0', 10);

    const sampleResult = await this.client.query({
      query: `SELECT timestamp, level, message FROM logs WHERE ${where} ORDER BY timestamp DESC LIMIT 5`,
      query_params: queryParams,
      format: 'JSONEachRow',
    });
    const samples = await sampleResult.json<{ timestamp: string; level: string; message: string }>();

    return { count, samples };
  }

  private buildWhereClause(params: SearchParams): {
    conditions: string[];
    queryParams: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const queryParams: Record<string, unknown> = {};

    if (params.from) {
      conditions.push('timestamp >= {from:DateTime64(3)}');
      queryParams.from = params.from.toISOString();
    }

    if (params.to) {
      conditions.push('timestamp <= {to:DateTime64(3)}');
      queryParams.to = params.to.toISOString();
    }

    if (params.level) {
      if (Array.isArray(params.level)) {
        const placeholders = params.level.map((_, i) => `{level_${i}:String}`);
        conditions.push(`level IN (${placeholders.join(', ')})`);
        params.level.forEach((l, i) => {
          queryParams[`level_${i}`] = l;
        });
      } else {
        conditions.push('level = {level:String}');
        queryParams.level = params.level;
      }
    }

    if (params.source) {
      conditions.push('source = {source:String}');
      queryParams.source = params.source;
    }

    if (params.query) {
      conditions.push('position(lower(message), lower({search:String})) > 0');
      queryParams.search = params.query;
    }

    return { conditions, queryParams };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
