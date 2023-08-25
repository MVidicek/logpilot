import { AlertNotification } from '../../types/alert';

export async function sendDiscordNotification(
  webhookUrl: string,
  notification: AlertNotification
): Promise<void> {
  const { rule, match_count, sample_logs, triggered_at } = notification;

  const levelColor: Record<string, number> = {
    debug: 0x6b7280,   // gray
    info: 0x3b82f6,    // blue
    warn: 0xf59e0b,    // amber
    error: 0xef4444,   // red
    fatal: 0x7f1d1d,   // dark red
  };

  // Pick color from the most severe sample log
  const severityOrder = ['fatal', 'error', 'warn', 'info', 'debug'];
  const highestLevel = sample_logs.reduce((highest, log) => {
    const currentIdx = severityOrder.indexOf(log.level);
    const highestIdx = severityOrder.indexOf(highest);
    return currentIdx < highestIdx ? log.level : highest;
  }, 'debug');

  const conditionDesc =
    rule.condition.type === 'threshold'
      ? `${match_count} logs matched (threshold: ${rule.condition.threshold} in ${rule.condition.window_minutes}m)`
      : `Pattern "${(rule.condition as { pattern: string }).pattern}" found ${match_count} times`;

  const sampleText = sample_logs
    .slice(0, 3)
    .map((log) => `\`${log.timestamp}\` **[${log.level.toUpperCase()}]** ${log.message.slice(0, 150)}`)
    .join('\n');

  const payload = {
    embeds: [
      {
        title: `Alert: ${rule.name}`,
        description: conditionDesc,
        color: levelColor[highestLevel] || 0x6b7280,
        fields: [
          {
            name: 'Sample Logs',
            value: sampleText || 'No samples available',
          },
          {
            name: 'Rule Type',
            value: rule.type,
            inline: true,
          },
          {
            name: 'Match Count',
            value: match_count.toString(),
            inline: true,
          },
        ],
        footer: {
          text: 'LogPilot',
        },
        timestamp: triggered_at.toISOString(),
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
  }
}
