import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        // Type-only or pure re-export files have no behaviour to test.
        'src/services/mark-publisher/index.ts',
        'src/services/mark-publisher/replay-types.ts',
        'src/shared/types.ts',
      ],
      // Floors track the current numbers minus ~1pp slack. Bumped after
      // 2026-04-25 Tier 2 (replay.ts 58→100%, replay-decode-irs already
      // 100% via resolve-swap tests). Current: lines 77.43 / branches
      // 85.18 / functions 91.17 / statements 77.43. Ratchet up again
      // when targeted gap-filling lifts substantive code further.
      thresholds: {
        lines: 76,
        branches: 84,
        functions: 90,
        statements: 76,
      },
    },
  },
})
