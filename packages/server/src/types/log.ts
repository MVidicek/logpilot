export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id?: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source: string;
  metadata: Record<string, string>;
  raw?: string;
}

export interface LogIngestionPayload {
  level?: string;
  message: string;
  source?: string;
  timestamp?: string;
  metadata?: Record<string, string>;
}

export interface ParsedLog {
  timestamp: Date | null;
  level: LogLevel;
  message: string;
  source: string;
  metadata: Record<string, string>;
}

export interface SearchParams {
  query?: string;
  level?: LogLevel | LogLevel[];
  source?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

export interface SearchResult {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AggregationBucket {
  bucket: string;
  count: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

export interface ErrorRate {
  bucket: string;
  total: number;
  errors: number;
  rate: number;
}
