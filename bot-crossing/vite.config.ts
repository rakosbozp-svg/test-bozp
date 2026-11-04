import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Only answer on localhost (mirrors the API's Host guard).
    allowedHosts: ['localhost', '127.0.0.1'],
  },
});
