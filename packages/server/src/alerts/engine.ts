import { PostgresStorage } from '../storage/postgres';
import { ClickHouseStorage } from '../storage/clickhouse';
import { AlertRule, AlertNotification, ThresholdCondition, PatternCondition } from '../types/alert';
import { sendSlackNotification } from './notifiers/slack';
import { sendDiscordNotification } from './notifiers/discord';
import { sendWebhookNotification } from './notifiers/webhook';

export class AlertEngine {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private postgres: PostgresStorage,
    private clickhouse: ClickHouseStorage,
    private checkIntervalMs: number
  ) {}

  start(): void {
    if (this.timer) return;

    console.log(`[alerts] Starting alert engine (interval: ${this.checkIntervalMs / 1000}s)`);

    this.timer = setInterval(() => {
      this.evaluate().catch((err) => {
        console.error('[alerts] Evaluation error:', err);
      });
    }, this.checkIntervalMs);

    // Run once immediately
    this.evaluate().catch((err) => {
      console.error('[alerts] Initial evaluation error:', err);
    });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async evaluate(): Promise<void> {
    if (this.running) return; // Prevent overlapping runs
    this.running = true;

    try {
      const rules = await this.postgres.getActiveAlertRules();

      for (const rule of rules) {
        try {
          await this.evaluateRule(rule);
        } catch (err) {
          console.error(`[alerts] Error evaluating rule "${rule.name}" (${rule.id}):`, err);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<void> {
    // Check cooldown
    if (rule.last_triggered_at) {
      const cooldownMs = rule.cooldown_minutes * 60 * 1000;
      const elapsed = Date.now() - rule.last_triggered_at.getTime();
      if (elapsed < cooldownMs) {
        return; // Still in cooldown period
      }
    }

    let triggered = false;
    let matchCount = 0;
    let sampleLogs: Array<{ timestamp: string; level: string; message: string }> = [];

    if (rule.condition.type === 'threshold') {
      const result = await this.evaluateThreshold(rule.condition);
      triggered = result.triggered;
      matchCount = result.count;
      sampleLogs = result.samples;
    } else if (rule.condition.type === 'pattern') {
      const result = await this.evaluatePattern(rule.condition);
      triggered = result.triggered;
      matchCount = result.count;
      sampleLogs = result.samples;
    }

    if (triggered) {
      console.log(`[alerts] Rule "${rule.name}" triggered (${matchCount} matches)`);

      const notification: AlertNotification = {
        rule,
        match_count: matchCount,
        sample_logs: sampleLogs,
        triggered_at: new Date(),
      };

      await this.sendNotifications(notification);
      await this.postgres.updateAlertRuleTriggered(rule.id);
    }
  }

  private async evaluateThreshold(
    condition: ThresholdCondition
  ): Promise<{ triggered: boolean; count: number; samples: Array<{ timestamp: string; level: string; message: string }> }> {
    const count = await this.clickhouse.countSince(condition.window_minutes, {
      level: condition.level,
      source: condition.source,
      query: condition.query,
    });

    let triggered = false;
    switch (condition.operator) {
      case 'gt':
        triggered = count > condition.threshold;
        break;
      case 'gte':
        triggered = count >= condition.threshold;
        break;
      case 'lt':
        triggered = count < condition.threshold;
        break;
      case 'lte':
        triggered = count <= condition.threshold;
        break;
      case 'eq':
        triggered = count === condition.threshold;
        break;
    }

    let samples: Array<{ timestamp: string; level: string; message: string }> = [];
    if (triggered) {
      // Get some sample logs for the notification
      const result = await this.clickhouse.query({
        from: new Date(Date.now() - condition.window_minutes * 60 * 1000),
        level: condition.level as any,
        source: condition.source,
        query: condition.query,
        limit: 5,
        offset: 0,
      });
      samples = result.logs.map((l) => ({
        timestamp: l.timestamp.toISOString(),
        level: l.level,
        message: l.message,
      }));
    }

    return { triggered, count, samples };
  }

  private async evaluatePattern(
    condition: PatternCondition
  ): Promise<{ triggered: boolean; count: number; samples: Array<{ timestamp: string; level: string; message: string }> }> {
    // Check last 5 minutes for pattern matches by default
    const windowMinutes = 5;

    const result = await this.clickhouse.searchPattern(
      condition.pattern,
      condition.is_regex,
      windowMinutes,
      { level: condition.level, source: condition.source }
    );

    return {
      triggered: result.count > 0,
      count: result.count,
      samples: result.samples,
    };
  }

  private async sendNotifications(notification: AlertNotification): Promise<void> {
    const { notifiers } = notification.rule;

    for (const notifier of notifiers) {
      try {
        switch (notifier.type) {
          case 'slack':
            await sendSlackNotification(notifier.webhook_url, notification);
            break;
          case 'discord':
            await sendDiscordNotification(notifier.webhook_url, notification);
            break;
          case 'webhook':
            await sendWebhookNotification(notifier.webhook_url, notification);
            break;
          default:
            console.warn(`[alerts] Unknown notifier type: ${notifier.type}`);
        }
      } catch (err) {
        console.error(`[alerts] Failed to send ${notifier.type} notification:`, err);
      }
    }
  }
}
