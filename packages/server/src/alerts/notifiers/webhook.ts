import { AlertNotification } from '../../types/alert';

export async function sendWebhookNotification(
  webhookUrl: string,
  notification: AlertNotification
): Promise<void> {
  const { rule, match_count, sample_logs, triggered_at } = notification;

  const payload = {
    event: 'alert.triggered',
    alert: {
      id: rule.id,
      name: rule.name,
      type: rule.type,
      condition: rule.condition,
    },
    match_count,
    sample_logs,
    triggered_at: triggered_at.toISOString(),
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'LogPilot/1.0',
      'X-LogPilot-Event': 'alert.triggered',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }
}
