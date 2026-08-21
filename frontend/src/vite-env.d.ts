/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_ENABLE_MOCK_AUTH: string;
  readonly VITE_DEFAULT_TENANT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
