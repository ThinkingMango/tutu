import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('../', import.meta.url)) }],
  },
  test: {
    root: fileURLToPath(new URL('../', import.meta.url)),
    environment: 'node',
    include: ['.v0-live/**/*.live.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
})
