import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // 优先使用 .env 文件中的变量，如果没有则使用系统环境变量 (CI 环境)
    const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '';

    return {
      // GitHub Pages 需要设置 base 路径
      base: './', 
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.DEEPSEEK_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
