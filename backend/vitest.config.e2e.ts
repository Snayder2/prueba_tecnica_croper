import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Separate database: the e2e suite drops it before and after running.
    env: {
      PORT: '3000',
      MONGO_URI: 'mongodb://localhost:27017/productos_db_e2e',
      JWT_SECRET: 'e2e-only-secret-not-used-anywhere-else',
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
});
