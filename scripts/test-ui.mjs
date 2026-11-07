import { spawnSync } from 'node:child_process'
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'test/ui.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DELTA_CODEX_UI_TEST: '1' },
})
process.exitCode = result.status ?? 1
