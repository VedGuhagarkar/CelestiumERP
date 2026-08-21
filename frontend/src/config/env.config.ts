/**
 * Client Environment Configuration
 */

export const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Astralis ERP',
  DEFAULT_TENANT_ID: import.meta.env.VITE_DEFAULT_TENANT_ID || 'tenant_default_001',
  ENABLE_MOCK_AUTH: import.meta.env.VITE_ENABLE_MOCK_AUTH === 'true'
};
