import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { normalizeApiOrigin } from './src/lib/apiEndpoint';

export default defineConfig({
  plugins: [react(), { name: 'validate-api-origin', configResolved(config) { normalizeApiOrigin(config.env.VITE_API_ORIGIN ?? ''); } }],
  base: './',
  server: {
    proxy: {
      // 保留浏览器请求的 Host，使局域网同源请求通过后端的来源校验。
      '/api': { target: 'http://127.0.0.1:5175', changeOrigin: false },
    },
  },
});
