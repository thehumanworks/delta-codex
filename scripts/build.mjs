import { build } from 'esbuild'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
const panel = await build({
  entryPoints: ['src/ui/panel.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  write: false,
  metafile: true,
})
const html = (await readFile('src/ui/panel.html', 'utf8'))
  .replace('/* DELTA_CSS */', await readFile('src/ui/panel.css', 'utf8'))
  .replace('/* DELTA_JS */', () => panel.outputFiles[0].text.replaceAll('</script', '<\\/script'))
await mkdir('dist', { recursive: true })
await writeFile('dist/panel.html', html)
const cli = await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/cli.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  legalComments: 'eof',
  metafile: true,
  // ws is bundled; its optional native accelerators are not required.
  external: ['bufferutil', 'utf-8-validate'],
  banner: {
    js: '// Delta for Codex — AGPL-3.0-only. See LICENSE and NOTICE.\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
})

// Preserve the complete notices for every third-party package included in either bundle.
const packages = new Set()
for (const file of [...Object.keys(panel.metafile.inputs), ...Object.keys(cli.metafile.inputs)]) {
  const match = file.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//)
  if (match) packages.add(match[1])
}
const notices = ['Third-party software bundled with Delta for Codex.\n']
for (const root of [...packages].sort()) {
  const info = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  notices.push(`\n=== ${info.name} ${info.version} (${info.license}) ===\n`)
  const files = (await readdir(root, { withFileTypes: true }))
    .filter((f) => f.isFile() && /^(licen[cs]e|copying|notice)([.-]|$)/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (!files.length) throw new Error(`No license file found for bundled package ${info.name}`)
  for (const file of files) notices.push(await readFile(join(root, file.name), 'utf8'))
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n'))
