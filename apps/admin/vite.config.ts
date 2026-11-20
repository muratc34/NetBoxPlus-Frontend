import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The gateway allows this origin for admin requests (Cors:AdminOrigins), so the port is fixed.
const port = 5174;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
  // No public source maps; an error tracker would get hidden ones.
  build: { sourcemap: false },
  test: {
    environment: 'jsdom',
    setupFiles: ['@netboxplus/config/vitest/setup', './src/test/setup.ts'],
  },
});
