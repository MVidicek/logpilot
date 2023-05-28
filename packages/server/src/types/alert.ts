export type AlertRuleType = 'threshold' | 'pattern';
export type AlertStatus = 'active' | 'paused';
export type NotifierType = 'slack' | 'discord' | 'webhook';

export interface AlertRule {
  id: string;
  name: string;
  type: AlertRuleType;
  status: AlertStatus;
  condition: ThresholdCondition | PatternCondition;
  notifiers: NotifierConfig[];
  created_at: Date;
  updated_at: Date;
  last_triggered_at: Date | null;
  cooldown_minutes: number;
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
  type: NotifierType;
  webhook_url: string;
  channel?: string;
}

export interface AlertNotification {
  rule: AlertRule;
  match_count: number;
  sample_logs: Array<{ timestamp: string; level: string; message: string }>;
  triggered_at: Date;
}

export interface CreateAlertRuleInput {
  name: string;
  type: AlertRuleType;
  condition: ThresholdCondition | PatternCondition;
  notifiers: NotifierConfig[];
  cooldown_minutes?: number;
}

export interface UpdateAlertRuleInput {
  name?: string;
  status?: AlertStatus;
  condition?: ThresholdCondition | PatternCondition;
  notifiers?: NotifierConfig[];
  cooldown_minutes?: number;
}
