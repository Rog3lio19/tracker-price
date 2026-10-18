import { defineConfig } from 'vitest/config'

// Config separada de vite.config.ts: las pruebas no necesitan los plugins de
// TanStack Start / Nitro / devtools (y algunos impiden que Vitest termine)
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ['src/**/*.test.ts'] },
})
