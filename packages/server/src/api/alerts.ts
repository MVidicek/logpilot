import { FastifyInstance } from 'fastify';
import { PostgresStorage } from '../storage/postgres';
import { registerAlertRuleRoutes } from '../alerts/rules';

export function registerAlertRoutes(app: FastifyInstance, postgres: PostgresStorage): void {
  registerAlertRuleRoutes(app, postgres);
}
