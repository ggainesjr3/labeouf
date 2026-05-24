import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3001',
      '/posts': 'http://localhost:3001',
      '/users': 'http://localhost:3001',
      '/messages': 'http://localhost:3001',
      '/bookmarks': 'http://localhost:3001',
      '/upload': 'http://localhost:3001',
      '/push': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/notifications': 'http://localhost:3001',
      '/admin': 'http://localhost:3001',
      '/search': 'http://localhost:3001',
      '/reports': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    pool: 'threads',
  },
});
