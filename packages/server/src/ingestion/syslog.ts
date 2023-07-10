import * as dgram from 'dgram';
import * as net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config';
import { ClickHouseStorage } from '../storage/clickhouse';
import { parseSyslogRFC5424, parseSyslogBSD, detectFormat } from './parser';
import { LogEntry } from '../types/log';
import Redis from 'ioredis';

export class SyslogReceiver {
  private udpServer: dgram.Socket | null = null;
  private tcpServer: net.Server | null = null;
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private pubRedis: Redis;

  constructor(
    private config: Config,
    private clickhouse: ClickHouseStorage
  ) {
    this.pubRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
    });
  }

  async start(): Promise<void> {
    if (!this.config.syslog.enabled) {
      console.log('[syslog] Syslog receiver disabled');
      return;
    }

    this.startFlushInterval();
    await this.startUDP();
    await this.startTCP();
  }

  private async startUDP(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.udpServer = dgram.createSocket('udp4');

      this.udpServer.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        const raw = msg.toString('utf-8').trim();
        this.handleMessage(raw, rinfo.address);
      });

      this.udpServer.on('error', (err) => {
        console.error('[syslog] UDP error:', err);
        reject(err);
      });

      this.udpServer.bind(this.config.syslog.udpPort, () => {
        console.log(`[syslog] UDP listening on port ${this.config.syslog.udpPort}`);
        resolve();
      });
    });
  }

  private async startTCP(): Promise<void> {
    return new Promise((resolve) => {
      this.tcpServer = net.createServer((socket) => {
        let remainder = '';
        const remoteAddr = socket.remoteAddress || 'unknown';

        socket.on('data', (data: Buffer) => {
          remainder += data.toString('utf-8');
          const lines = remainder.split('\n');
          remainder = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0) {
              this.handleMessage(trimmed, remoteAddr);
            }
          }
        });

        socket.on('error', (err) => {
          console.error('[syslog] TCP connection error:', err.message);
        });
      });

      this.tcpServer.listen(this.config.syslog.tcpPort, () => {
        console.log(`[syslog] TCP listening on port ${this.config.syslog.tcpPort}`);
        resolve();
      });
    });
  }

  private handleMessage(raw: string, remoteAddr: string): void {
    const format = detectFormat(raw);
    let parsed;

    if (format === 'syslog_rfc5424') {
      parsed = parseSyslogRFC5424(raw);
    } else if (format === 'syslog_bsd') {
      parsed = parseSyslogBSD(raw);
    } else {
      // Treat as plain syslog-ish message
      parsed = {
        timestamp: new Date(),
        level: 'info' as const,
        message: raw,
        source: remoteAddr,
        metadata: {},
      };
    }

    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: parsed.timestamp || new Date(),
      level: parsed.level,
      message: parsed.message,
      source: parsed.source || remoteAddr,
      metadata: { ...parsed.metadata, remote_addr: remoteAddr },
      raw,
    };

    this.buffer.push(entry);

    // Publish for live tail
    const serialized = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      source: entry.source,
      metadata: entry.metadata,
    });

    this.pubRedis.publish(this.config.ingestion.redisPubSubChannel, serialized).catch(() => {});

    // Flush if buffer is large
    if (this.buffer.length >= this.config.ingestion.batchSize) {
      this.flush().catch((err) => {
        console.error('[syslog] Flush error:', err);
      });
    }
  }

  private startFlushInterval(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush().catch((err) => {
          console.error('[syslog] Flush error:', err);
        });
      }
    }, this.config.ingestion.flushIntervalMs);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.config.ingestion.batchSize);
    try {
      await this.clickhouse.insert(batch);
    } catch (err) {
      this.buffer.unshift(...batch);
      throw err;
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush().catch(() => {});

    if (this.udpServer) {
      this.udpServer.close();
      this.udpServer = null;
    }

    if (this.tcpServer) {
      this.tcpServer.close();
      this.tcpServer = null;
    }

    await this.pubRedis.quit();
  }
}
