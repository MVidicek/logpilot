# LogPilot

**Ship, search, and alert on logs without the Datadog bill.**

Self-hosted log aggregation for small teams. Ingest logs over HTTP or syslog, search them with full-text queries, set up alerts with Slack/Discord notifications, and monitor everything through a clean web UI.

## Why LogPilot?

|                      | LogPilot      | ELK Stack       | Loki + Grafana   | Datadog         |
|----------------------|---------------|-----------------|------------------|-----------------|
| **Setup time**       | 5 minutes     | 30-60 minutes   | 15-30 minutes    | 10 minutes      |
| **Monthly cost**     | $0 (self-host)| $0 (self-host)  | $0 (self-host)   | $100+/host      |
| **Services to run**  | 4             | 3-7             | 3-4              | 0 (SaaS)        |
| **Built-in alerting**| Yes           | With ElastAlert  | With Grafana     | Yes             |
| **Search**           | Full-text     | Full-text + DSL | LogQL            | Full-text + DSL |
| **Storage engine**   | ClickHouse    | Elasticsearch   | Object storage   | Proprietary     |
| **Memory footprint** | ~500MB        | 2-4GB+          | ~1GB             | N/A             |

## Quick Start

```bash
# Clone and start everything
git clone https://github.com/MVidicek/logpilot.git
cd logpilot/deploy
docker compose up -d

# Wait for services to start (~30s), then open the UI
open http://localhost:5173
```

**Register your admin account** (first user only), then **create an API key** in Settings and send your first log:

```bash
curl -X POST http://localhost:3100/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"level": "info", "message": "Hello LogPilot!", "source": "quickstart"}'
```

Head to the Log Explorer in the UI and you'll see it.

## Architecture

```
                    ┌─────────────┐
                    │   Web UI    │ (Vue 3)
                    │  :5173      │
                    └──────┬──────┘
                           │
┌──────────┐       ┌───────▼──────┐       ┌─────────────┐
│  Your    │──HTTP──▶  Fastify    │──────▶ │ ClickHouse  │
│  Apps    │  :3100 │  Server     │  bulk  │  (logs)     │
└──────────┘       │             │ insert │             │
                    │  ┌─────────┐│       └─────────────┘
┌──────────┐       │  │ Alert   ││
│ Syslog   │──UDP──▶  │ Engine  ││       ┌─────────────┐
│ Sources  │ :5514 │  └────┬────┘│──────▶│ PostgreSQL  │
└──────────┘       └───────┼──────┘       │ (config)    │
                           │              └─────────────┘
                    ┌──────▼──────┐
                    │   Redis     │ (buffer + pub/sub)
                    └─────────────┘
```

- **ClickHouse** stores log data. Column-oriented, fast for aggregations, handles billions of rows.
- **PostgreSQL** stores configuration: users, API keys, alert rules, dashboards.
- **Redis** buffers incoming logs and powers the live tail via pub/sub.

## Screenshots

> *Screenshots coming soon — run it locally to see the UI.*

## SDKs

### Node.js

```bash
npm install @logpilot/node
```

```typescript
import { LogPilot } from '@logpilot/node';

const logger = new LogPilot({
  endpoint: 'http://localhost:3100',
  apiKey: 'lp_your_key_here',
  source: 'my-app',
});

logger.info('User signed up', { userId: '42' });
logger.error('Payment failed', { orderId: '123' });
```

### Python

```bash
pip install logpilot-sdk
```

```python
from logpilot import LogPilot

logger = LogPilot(
    endpoint="http://localhost:3100",
    api_key="lp_your_key_here",
    source="my-service",
)

logger.info("User signed up", user_id="42")
logger.error("Payment failed", order_id="123")
```

Both SDKs batch logs automatically and flush on process exit.

## Features

- **HTTP + Syslog ingestion** — Send logs via REST API or point your syslog at it
- **Auto-format detection** — Parses JSON, nginx, Apache, and syslog formats automatically
- **Full-text search** — Find logs by message content, level, source, and time range
- **Live tail** — Watch logs stream in real-time via WebSocket
- **Alerting** — Threshold and pattern-based rules with Slack, Discord, and webhook notifications
- **Dashboards** — Log volume, error rate, and top sources at a glance
- **API key management** — Create and revoke keys from the UI
- **Saved searches** — Save frequent queries for quick access
- **Retention policies** — Automatic TTL-based cleanup in ClickHouse
- **Batch ingestion** — SDKs buffer and batch for throughput

## Configuration

All configuration is via environment variables:

| Variable                  | Default           | Description                        |
|---------------------------|-------------------|------------------------------------|
| `PORT`                    | `3100`            | HTTP server port                   |
| `CLICKHOUSE_URL`          | `http://localhost:8123` | ClickHouse HTTP endpoint     |
| `CLICKHOUSE_DB`           | `logpilot`        | ClickHouse database name           |
| `POSTGRES_HOST`           | `localhost`       | PostgreSQL host                    |
| `POSTGRES_PORT`           | `5432`            | PostgreSQL port                    |
| `POSTGRES_DB`             | `logpilot`        | PostgreSQL database                |
| `POSTGRES_USER`           | `logpilot`        | PostgreSQL user                    |
| `POSTGRES_PASSWORD`       | `logpilot`        | PostgreSQL password                |
| `REDIS_HOST`              | `localhost`       | Redis host                         |
| `REDIS_PORT`              | `6379`            | Redis port                         |
| `SYSLOG_ENABLED`          | `true`            | Enable syslog receiver             |
| `SYSLOG_UDP_PORT`         | `5514`            | Syslog UDP port                    |
| `SESSION_SECRET`          | (required in prod)| Cookie session secret              |
| `RETENTION_DAYS`          | `30`              | Days to keep logs in ClickHouse    |
| `ALERT_CHECK_INTERVAL`    | `60`              | Seconds between alert checks       |
| `INGESTION_BATCH_SIZE`    | `500`             | Logs per ClickHouse insert batch   |
| `CORS_ORIGIN`             | `*`               | Allowed CORS origin (set in prod)  |

## Production Deployment

Use the production compose override:

```bash
cd deploy
SESSION_SECRET=$(openssl rand -hex 32) \
POSTGRES_PASSWORD=$(openssl rand -hex 16) \
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Recommendations:
- Set a real `SESSION_SECRET` and `POSTGRES_PASSWORD`
- Put a reverse proxy (Caddy, nginx) in front for TLS
- Monitor ClickHouse disk usage — logs add up
- Back up the PostgreSQL database (it has your config)
- Consider ClickHouse replication for high availability

## Alternatives

- **ELK Stack** (Elasticsearch + Logstash + Kibana) — The standard. Powerful query language and visualization, but heavy on resources and complex to operate. Good if you have a dedicated ops team.
- **Loki + Grafana** — Lightweight log aggregation from the Grafana team. Labels-based indexing keeps costs low, but you need Grafana for the UI and PromQL familiarity helps.
- **Datadog** — Best UX in the space, but pricing scales with log volume and host count. Great if you have the budget.

LogPilot fits the gap: simpler than ELK, more batteries-included than Loki, cheaper than Datadog.

## License

MIT -- see [LICENSE](LICENSE).
