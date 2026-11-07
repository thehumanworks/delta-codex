import { build } from 'esbuild'
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/cli.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  legalComments: 'eof',
  banner: { js: '// Delta for Codex — AGPL-3.0-only. See LICENSE and NOTICE.' },
})
