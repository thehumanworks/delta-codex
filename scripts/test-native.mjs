import { spawnSync } from 'node:child_process'
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'test/native.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DELTA_CODEX_NATIVE_TEST: '1' },
})
process.exitCode = result.status ?? 1
