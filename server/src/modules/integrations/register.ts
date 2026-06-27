import { connectorRegistry } from './connector';
import { quickbooksConnector } from './quickbooks.connector';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// Registers concrete connectors at startup — only when their credentials are
// configured, so an un-provisioned environment cleanly shows "request interest".
export function registerConnectors(): void {
  if (env.QBO_CLIENT_ID && env.QBO_CLIENT_SECRET && env.QBO_REDIRECT_URI && env.INTEGRATIONS_ENC_KEY) {
    connectorRegistry.quickbooks = quickbooksConnector;
    logger.info('Connector registered: quickbooks');
  }
}
