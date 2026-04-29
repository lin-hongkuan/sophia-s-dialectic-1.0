import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const sophiaApiKey = env.SOPHIA_API_KEY || process.env.SOPHIA_API_KEY || '';
  const sophiaApiBaseUrl = env.SOPHIA_API_BASE_URL || process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1';
  const sophiaApiModel = env.SOPHIA_API_MODEL || process.env.SOPHIA_API_MODEL || 'gpt-5.4-mini';
  const sophiaApiProvider = env.SOPHIA_API_PROVIDER || process.env.SOPHIA_API_PROVIDER || 'OpenAI-compatible';

  return {
    base: './',
    server: {
      port: 7878,
      strictPort: true,
      host: '127.0.0.1',
    },
    plugins: [react()],
    define: {
      'process.env.SOPHIA_API_KEY': JSON.stringify(sophiaApiKey),
      'process.env.SOPHIA_API_BASE_URL': JSON.stringify(sophiaApiBaseUrl),
      'process.env.SOPHIA_API_MODEL': JSON.stringify(sophiaApiModel),
      'process.env.SOPHIA_API_PROVIDER': JSON.stringify(sophiaApiProvider),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
