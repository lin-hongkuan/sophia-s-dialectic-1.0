import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const sophiaApiKey = env.SOPHIA_API_KEY || process.env.SOPHIA_API_KEY || '';
  const sophiaApiBaseUrl = env.SOPHIA_API_BASE_URL || process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1';
  const sophiaApiModel = env.SOPHIA_API_MODEL || process.env.SOPHIA_API_MODEL || 'gpt-5.4-mini';
  const sophiaImageModel = env.SOPHIA_IMAGE_MODEL || process.env.SOPHIA_IMAGE_MODEL || 'grok-imagine-image-lite';
  const sophiaImageSize = env.SOPHIA_IMAGE_SIZE || process.env.SOPHIA_IMAGE_SIZE || '1024x1024';
  const sophiaImageAspectHint = env.SOPHIA_IMAGE_ASPECT_HINT || process.env.SOPHIA_IMAGE_ASPECT_HINT || 'portrait 1:1.2 aspect ratio';
  const sophiaApiProvider = env.SOPHIA_API_PROVIDER || process.env.SOPHIA_API_PROVIDER || 'OpenAI-compatible';
  const sophiaApiProxyPath = '/sophia-api';
  const useLocalApiProxy = env.GITHUB_ACTIONS !== 'true' && process.env.GITHUB_ACTIONS !== 'true';
  const parsedSophiaApiBaseUrl = new URL(sophiaApiBaseUrl);
  const proxyTargetPath = parsedSophiaApiBaseUrl.pathname.replace(/\/$/, '');
  const sophiaApiProxy = {
    [sophiaApiProxyPath]: {
      target: parsedSophiaApiBaseUrl.origin,
      changeOrigin: true,
      secure: true,
      rewrite: (proxyPath: string) => proxyPath.replace(new RegExp(`^${sophiaApiProxyPath}`), proxyTargetPath),
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any) => {
          if (sophiaApiKey) {
            proxyReq.setHeader('Authorization', `Bearer ${sophiaApiKey}`);
          }
        });
      },
    },
  };

  return {
    base: '/',
    server: {
      port: 7878,
      strictPort: true,
      host: '127.0.0.1',
      proxy: sophiaApiProxy,
    },
    preview: {
      port: 7878,
      strictPort: true,
      host: '127.0.0.1',
      proxy: sophiaApiProxy,
    },
    plugins: [react()],
    define: {
      'process.env.SOPHIA_API_KEY': JSON.stringify(useLocalApiProxy ? '' : sophiaApiKey),
      'process.env.SOPHIA_API_BASE_URL': JSON.stringify(useLocalApiProxy ? sophiaApiProxyPath : sophiaApiBaseUrl),
      'process.env.SOPHIA_API_MODEL': JSON.stringify(sophiaApiModel),
      'process.env.SOPHIA_IMAGE_MODEL': JSON.stringify(sophiaImageModel),
      'process.env.SOPHIA_IMAGE_SIZE': JSON.stringify(sophiaImageSize),
      'process.env.SOPHIA_IMAGE_ASPECT_HINT': JSON.stringify(sophiaImageAspectHint),
      'process.env.SOPHIA_API_PROVIDER': JSON.stringify(sophiaApiProvider),
      'process.env.SOPHIA_API_CONFIGURED': JSON.stringify(sophiaApiKey ? 'true' : 'false'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
