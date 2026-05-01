import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    core: 'src/core.ts',
    react: 'src/react.tsx',
    ui: 'src/ui.tsx',
  },
  format: ['esm'],
  dts: true,
  external: ['react', 'react-dom'],
  clean: true,
})
