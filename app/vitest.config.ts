import path from 'node:path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        // Next.js route shims are intentionally thin per frontend-style.md
        // ("Thin route files in src/app/ delegate to features"). Their
        // feature modules are tested; the shim itself has no behaviour.
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        // shadcn/ui primitives — library code, not unit-tested directly.
        'src/components/ui/**',
      ],
      // Floors track the current numbers minus ~1pp slack. Current
      // (post-exclusions): lines 87.22 / branches 73.67 / functions
      // 85.34 / statements 84.63. Tier 2 didn't touch app code; numbers
      // unchanged from initial measurement.
      thresholds: {
        lines: 86,
        branches: 72,
        functions: 84,
        statements: 83,
      },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
