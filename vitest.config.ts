import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { sourceAlias } from './vite.config.ts';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: sourceAlias,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
