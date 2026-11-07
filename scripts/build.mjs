import { build } from 'esbuild'
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/cli.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  legalComments: 'eof',
  // ws is bundled; its optional native accelerators are not required.
  external: ['bufferutil', 'utf-8-validate'],
  banner: {
    js: '// Delta for Codex — AGPL-3.0-only. See LICENSE and NOTICE.\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
})
