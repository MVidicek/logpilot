import { Pool, PoolConfig } from 'pg';
import { Config } from '../config';
import { AlertRule, CreateAlertRuleInput, UpdateAlertRuleInput, NotifierConfig } from '../types/alert';
import { Dashboard, Widget, CreateDashboardInput, CreateWidgetInput } from '../types/dashboard';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  condition JSONB NOT NULL,
  notifiers JSONB NOT NULL DEFAULT '[]',
  cooldown_minutes INT NOT NULL DEFAULT 5,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  query TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":6,"h":4}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

export class PostgresStorage {
  private pool: Pool;
  private bcryptRounds: number;

  constructor(private config: Config) {
    const poolConfig: PoolConfig = {
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      max: 20,
      idleTimeoutMillis: 30000,
    };
    this.pool = new Pool(poolConfig);
    this.bcryptRounds = config.auth.bcryptRounds;
  }

  async initialize(): Promise<void> {
    const statements = MIGRATIONS.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await this.pool.query(statement);
    }
  }

  // --- API Key Management ---

  async createApiKey(name: string): Promise<{ id: string; key: string; prefix: string }> {
    const rawKey = `lp_${uuidv4().replace(/-/g, '')}`;
    const prefix = rawKey.slice(0, 7);
    const keyHash = await bcrypt.hash(rawKey, this.bcryptRounds);

    const result = await this.pool.query(
      'INSERT INTO api_keys (name, key_hash, key_prefix) VALUES ($1, $2, $3) RETURNING id',
      [name, keyHash, prefix]
    );

    return { id: result.rows[0].id, key: rawKey, prefix };
  }

  async validateApiKey(key: string): Promise<{ id: string; name: string } | null> {
    const prefix = key.slice(0, 7);
    const result = await this.pool.query(
      'SELECT id, name, key_hash FROM api_keys WHERE key_prefix = $1 AND is_active = TRUE',
      [prefix]
    );

    for (const row of result.rows) {
      const valid = await bcrypt.compare(key, row.key_hash);
      if (valid) {
        // Update last_used_at asynchronously
        this.pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]).catch(() => {});
        return { id: row.id, name: row.name };
      }
    }

    return null;
  }

  async listApiKeys(): Promise<Array<{ id: string; name: string; prefix: string; created_at: Date; last_used_at: Date | null; is_active: boolean }>> {
    const result = await this.pool.query(
      'SELECT id, name, key_prefix as prefix, created_at, last_used_at, is_active FROM api_keys ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.pool.query('UPDATE api_keys SET is_active = FALSE WHERE id = $1', [id]);
  }

  // --- User Management ---

  async getUserCount(): Promise<number> {
    const result = await this.pool.query('SELECT count(*)::int AS cnt FROM users');
    return result.rows[0].cnt;
  }

  async createUser(email: string, password: string, name?: string): Promise<{ id: string }> {
    const passwordHash = await bcrypt.hash(password, this.bcryptRounds);
    const result = await this.pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      [email, passwordHash, name || null]
    );
    return { id: result.rows[0].id };
  }

  async authenticateUser(email: string, password: string): Promise<{ id: string; email: string; name: string } | null> {
    const result = await this.pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) return null;

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return null;

    return { id: user.id, email: user.email, name: user.name };
  }

  // --- Session Management ---

  async createSession(userId: string, maxAgeMs: number): Promise<string> {
    const expiresAt = new Date(Date.now() + maxAgeMs);
    const result = await this.pool.query(
      'INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id',
      [userId, expiresAt]
    );
    return result.rows[0].id;
  }

  async getSession(sessionId: string): Promise<{ userId: string; email: string; name: string } | null> {
    const result = await this.pool.query(
      `SELECT s.user_id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (result.rows.length === 0) return null;
    return {
      userId: result.rows[0].user_id,
      email: result.rows[0].email,
      name: result.rows[0].name,
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  // --- Alert Rules ---

  async createAlertRule(input: CreateAlertRuleInput): Promise<AlertRule> {
    const result = await this.pool.query(
      `INSERT INTO alert_rules (name, type, condition, notifiers, cooldown_minutes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.name,
        input.type,
        JSON.stringify(input.condition),
        JSON.stringify(input.notifiers),
        input.cooldown_minutes || 5,
      ]
    );
    return this.rowToAlertRule(result.rows[0]);
  }

  async updateAlertRule(id: string, input: UpdateAlertRuleInput): Promise<AlertRule | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.status !== undefined) {
      sets.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.condition !== undefined) {
      sets.push(`condition = $${paramIndex++}`);
      values.push(JSON.stringify(input.condition));
    }
    if (input.notifiers !== undefined) {
      sets.push(`notifiers = $${paramIndex++}`);
      values.push(JSON.stringify(input.notifiers));
    }
    if (input.cooldown_minutes !== undefined) {
      sets.push(`cooldown_minutes = $${paramIndex++}`);
      values.push(input.cooldown_minutes);
    }

    values.push(id);
    const result = await this.pool.query(
      `UPDATE alert_rules SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.rowToAlertRule(result.rows[0]);
  }

  async getAlertRule(id: string): Promise<AlertRule | null> {
    const result = await this.pool.query('SELECT * FROM alert_rules WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToAlertRule(result.rows[0]);
  }

  async listAlertRules(): Promise<AlertRule[]> {
    const result = await this.pool.query('SELECT * FROM alert_rules ORDER BY created_at DESC');
    return result.rows.map((row) => this.rowToAlertRule(row));
  }

  async getActiveAlertRules(): Promise<AlertRule[]> {
    const result = await this.pool.query(
      "SELECT * FROM alert_rules WHERE status = 'active' ORDER BY created_at DESC"
    );
    return result.rows.map((row) => this.rowToAlertRule(row));
  }

  async deleteAlertRule(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM alert_rules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async updateAlertRuleTriggered(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE alert_rules SET last_triggered_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  // --- Saved Searches ---

  async createSavedSearch(name: string, query: string, filters: Record<string, unknown>): Promise<{ id: string }> {
    const result = await this.pool.query(
      'INSERT INTO saved_searches (name, query, filters) VALUES ($1, $2, $3) RETURNING id',
      [name, query, JSON.stringify(filters)]
    );
    return { id: result.rows[0].id };
  }

  async listSavedSearches(): Promise<Array<{ id: string; name: string; query: string; filters: Record<string, unknown>; created_at: Date }>> {
    const result = await this.pool.query('SELECT * FROM saved_searches ORDER BY created_at DESC');
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      query: row.query,
      filters: row.filters,
      created_at: row.created_at,
    }));
  }

  async deleteSavedSearch(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM saved_searches WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // --- Dashboards ---

  async createDashboard(input: CreateDashboardInput): Promise<Dashboard> {
    const result = await this.pool.query(
      'INSERT INTO dashboards (name, description) VALUES ($1, $2) RETURNING *',
      [input.name, input.description || '']
    );
    return { ...result.rows[0], widgets: [] };
  }

  async getDashboard(id: string): Promise<Dashboard | null> {
    const dashResult = await this.pool.query('SELECT * FROM dashboards WHERE id = $1', [id]);
    if (dashResult.rows.length === 0) return null;

    const widgetResult = await this.pool.query(
      'SELECT * FROM dashboard_widgets WHERE dashboard_id = $1 ORDER BY created_at ASC',
      [id]
    );

    return {
      ...dashResult.rows[0],
      widgets: widgetResult.rows.map((w) => ({
        id: w.id,
        dashboard_id: w.dashboard_id,
        type: w.type,
        title: w.title,
        config: w.config,
        position: w.position,
      })),
    };
  }

  async listDashboards(): Promise<Dashboard[]> {
    const result = await this.pool.query('SELECT * FROM dashboards ORDER BY updated_at DESC');
    return result.rows.map((row) => ({ ...row, widgets: [] }));
  }

  async deleteDashboard(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM dashboards WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async addWidget(dashboardId: string, input: CreateWidgetInput): Promise<Widget> {
    const result = await this.pool.query(
      `INSERT INTO dashboard_widgets (dashboard_id, type, title, config, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dashboardId, input.type, input.title, JSON.stringify(input.config), JSON.stringify(input.position)]
    );

    await this.pool.query('UPDATE dashboards SET updated_at = NOW() WHERE id = $1', [dashboardId]);

    return {
      id: result.rows[0].id,
      dashboard_id: result.rows[0].dashboard_id,
      type: result.rows[0].type,
      title: result.rows[0].title,
      config: result.rows[0].config,
      position: result.rows[0].position,
    };
  }

  async deleteWidget(widgetId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM dashboard_widgets WHERE id = $1', [widgetId]);
    return (result.rowCount ?? 0) > 0;
  }

  // --- Helpers ---

  private rowToAlertRule(row: Record<string, unknown>): AlertRule {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as AlertRule['type'],
      status: row.status as AlertRule['status'],
      condition: row.condition as AlertRule['condition'],
      notifiers: (row.notifiers as NotifierConfig[]) || [],
      cooldown_minutes: row.cooldown_minutes as number,
      last_triggered_at: row.last_triggered_at ? new Date(row.last_triggered_at as string) : null,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
