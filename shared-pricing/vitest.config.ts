import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/**/*.d.ts'],
      // Floors track the current numbers minus ~1pp slack. Bumped after
      // 2026-04-25 Tier 2 (asset-swap.ts 62→100% lines, 56→94% branches).
      // Current: lines 92.77 / branches 78.54 / functions 98.75 /
      // statements 89.96. Pricing engine is load-bearing — keep ratcheting
      // up toward 95/85/100/95 as gaps close.
      thresholds: {
        lines: 91,
        branches: 77,
        functions: 97,
        statements: 88,
      },
    },
  },
})
