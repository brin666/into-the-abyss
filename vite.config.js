import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_DEPLOY_BASE || '/',
  server: {
    allowedHosts: ['.loca.lt', '.lhr.life'],
    watch: {
      ignored: ['**/build/**', '**/dist/**'],
    },
  },
});
