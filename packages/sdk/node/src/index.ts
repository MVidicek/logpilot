type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogPilotOptions {
  /** LogPilot server URL (e.g. http://localhost:3100) */
  endpoint: string;
  /** API key for authentication */
  apiKey: string;
  /** Default source identifier for this application */
  source: string;
  /** Number of logs to buffer before flushing (default: 10) */
  batchSize?: number;
  /** Flush interval in milliseconds (default: 5000) */
  flushInterval?: number;
  /** Maximum retry attempts on failure (default: 3) */
  maxRetries?: number;
  /** Whether to flush remaining logs on process exit (default: true) */
  flushOnExit?: boolean;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  metadata: Record<string, string>;
}

export class LogPilot {
  private endpoint: string;
  private apiKey: string;
  private source: string;
  private batchSize: number;
  private maxRetries: number;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(options: LogPilotOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.source = options.source;
    this.batchSize = options.batchSize ?? 10;
    this.maxRetries = options.maxRetries ?? 3;

    const flushInterval = options.flushInterval ?? 5000;
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[logpilot] Flush error:', err.message);
      });
    }, flushInterval);

    // Prevent the timer from keeping the process alive
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }

    // Flush on exit
    if (options.flushOnExit !== false) {
      const onExit = () => {
        this.flushSync();
      };
      process.on('beforeExit', onExit);
      process.on('SIGINT', () => {
        this.flushSync();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        this.flushSync();
        process.exit(0);
      });
    }
  }

  /** Log a debug-level message */
  debug(message: string, metadata: Record<string, string> = {}): void {
    this.log('debug', message, metadata);
  }

  /** Log an info-level message */
  info(message: string, metadata: Record<string, string> = {}): void {
    this.log('info', message, metadata);
  }

  /** Log a warn-level message */
  warn(message: string, metadata: Record<string, string> = {}): void {
    this.log('warn', message, metadata);
  }

  /** Log an error-level message */
  error(message: string, metadata: Record<string, string> = {}): void {
    this.log('error', message, metadata);
  }

  /** Log a fatal-level message */
  fatal(message: string, metadata: Record<string, string> = {}): void {
    this.log('fatal', message, metadata);
  }

  /** Log a message with the specified level */
  log(level: LogLevel, message: string, metadata: Record<string, string> = {}): void {
    const entry: LogEntry = {
      level,
      message,
      source: this.source,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.buffer.push(entry);

    if (this.buffer.length >= this.batchSize) {
      this.flush().catch((err) => {
        console.error('[logpilot] Flush error:', err.message);
      });
    }
  }

  /** Flush buffered logs to the server */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;

    this.flushing = true;
    const batch = this.buffer.splice(0, this.batchSize);

    try {
      await this.sendWithRetry(batch);
    } catch (err) {
      // Put failed entries back
      this.buffer.unshift(...batch);
      throw err;
    } finally {
      this.flushing = false;
    }

    // If there are more logs, flush again
    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  /** Synchronous flush for process exit — uses spawnSync to avoid shell injection */
  private flushSync(): void {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);

    try {
      const { spawnSync } = require('child_process');
      const url = `${this.endpoint}/api/v1/logs`;
      const body = JSON.stringify(batch);

      // Use spawnSync with argv array — no shell interpolation
      spawnSync('curl', [
        '-s', '-X', 'POST', url,
        '-H', 'Content-Type: application/json',
        '-H', `X-API-Key: ${this.apiKey}`,
        '-d', body,
      ], { timeout: 5000, stdio: 'ignore' });
    } catch {
      // Best effort — data may be lost on exit
    }
  }

  private async sendWithRetry(batch: LogEntry[]): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.send(batch);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.maxRetries - 1) {
          // Exponential backoff: 100ms, 200ms, 400ms...
          const delay = 100 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private async send(batch: LogEntry[]): Promise<void> {
    const url = `${this.endpoint}/api/v1/logs`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      throw new Error(`LogPilot API error: ${response.status} ${response.statusText}`);
    }
  }

  /** Stop the flush timer and flush remaining logs */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }
}

export default LogPilot;
