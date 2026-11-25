import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One deployment: the built site is served statically and talks to Firebase.
// There is no API server to proxy to in development either.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['pv-45776be64ad7-69e20a0d-b00a-41f2-82b1-054d6052dc68.style.dev', '.e2b.app', 'localhost'],
  },
});
