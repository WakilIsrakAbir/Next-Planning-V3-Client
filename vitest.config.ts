import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Golden-master harness of the order page (tests/, rule map in tests/golden/RULES.md).
// Dates on the page are shown in local time, so the tests always run in the users' time zone,
// and API_BASE is fixed so the mocked server sees the same URLs on every machine.
process.env.TZ = 'Asia/Dhaka';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup/setup.ts'],
    env: {
      TZ: 'Asia/Dhaka',
      NEXT_PUBLIC_API_URL: 'http://api.test',
    },
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
