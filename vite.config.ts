import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** Single source of truth for the `@/` prefix, shared with the Vitest config. */
export const sourceAlias = {
  '@': path.resolve(import.meta.dirname, './src'),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: sourceAlias,
  },
});
