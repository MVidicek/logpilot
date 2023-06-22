export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  metadata: Record<string, string>;
}

export interface SearchResult {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AlertRule {
  id: string;
  name: string;
  type: 'threshold' | 'pattern';
  status: 'active' | 'paused';
  condition: ThresholdCondition | PatternCondition;
  notifiers: NotifierConfig[];
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThresholdCondition {
  type: 'threshold';
  level?: string;
  source?: string;
  query?: string;
  threshold: number;
  window_minutes: number;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
}

export interface PatternCondition {
  type: 'pattern';
  pattern: string;
  is_regex: boolean;
  source?: string;
  level?: string;
}

export interface NotifierConfig {
  type: 'slack' | 'discord' | 'webhook';
  webhook_url: string;
  channel?: string;
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

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  created_at: string;
  updated_at: string;
}

export interface Widget {
  id: string;
  dashboard_id: string;
  type: 'log_volume' | 'error_rate' | 'top_sources' | 'recent_alerts' | 'log_count';
  title: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export type TimeRange = '15m' | '1h' | '4h' | '12h' | '24h' | '3d' | '7d' | 'custom';

export interface TimeRangeOption {
  label: string;
  value: TimeRange;
  minutes: number;
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { label: '15 min', value: '15m', minutes: 15 },
  { label: '1 hour', value: '1h', minutes: 60 },
  { label: '4 hours', value: '4h', minutes: 240 },
  { label: '12 hours', value: '12h', minutes: 720 },
  { label: '24 hours', value: '24h', minutes: 1440 },
  { label: '3 days', value: '3d', minutes: 4320 },
  { label: '7 days', value: '7d', minutes: 10080 },
];
