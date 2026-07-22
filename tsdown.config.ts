import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2021',
  outDir: 'dist',
  clean: true,
  dts: { sourcemap: true },
  sourcemap: true,
})
