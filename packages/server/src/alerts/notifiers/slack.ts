import { AlertNotification } from '../../types/alert';

export async function sendSlackNotification(
  webhookUrl: string,
  notification: AlertNotification
): Promise<void> {
  const { rule, match_count, sample_logs, triggered_at } = notification;

  const levelEmoji: Record<string, string> = {
    debug: ':white_circle:',
    info: ':large_blue_circle:',
    warn: ':warning:',
    error: ':red_circle:',
    fatal: ':skull:',
  };

  const sampleText = sample_logs
    .slice(0, 3)
    .map((log) => {
      const emoji = levelEmoji[log.level] || ':black_circle:';
      return `${emoji} \`${log.timestamp}\` [${log.level.toUpperCase()}] ${log.message.slice(0, 200)}`;
    })
    .join('\n');

  const conditionDesc =
    rule.condition.type === 'threshold'
      ? `${match_count} logs matched (threshold: ${rule.condition.threshold} in ${rule.condition.window_minutes}m)`
      : `Pattern "${(rule.condition as { pattern: string }).pattern}" found ${match_count} times`;

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `LogPilot Alert: ${rule.name}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: conditionDesc,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Sample logs:*\n${sampleText}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Triggered at ${triggered_at.toISOString()} | Rule type: ${rule.type}`,
          },
        ],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
  }
}
