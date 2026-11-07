# Contributing

Use `nix develop` from the checkout root, then `npm ci`. The flake pins Node,
Codex, and the supporting tools; Linux also gets Delta. Run `npm run verify`,
`npm run test:native`, and `npm run test:package`. Run `nix fmt` after Nix edits
and `nix flake check` before submitting changes. CI uses the same flake and
lockfiles. See [the Nix guide](docs/nix.md) for direnv, platform support, and
updating dependencies.

Without Nix, use Node 22.19+ and Git, then the same npm commands. Native tests
also require Codex 0.166.0+. The Nix package's npm dependency hash must be updated
alongside `package-lock.json`; the guide explains the exact command.

For panel changes, run `npm run test:ui`. Install its browser with
`npx playwright-core install chromium`, or set `DELTA_CODEX_CHROMIUM` to an
existing Chromium executable. `DELTA_CODEX_UI_ARTIFACTS` optionally saves browser
screenshots. The browser suite uses the standard MCP Apps bridge and synthetic
operations; it does not sign in. See [testing and acceptance](docs/testing.md).

Keep test traffic off real accounts. The fixture model in `test/native.test.ts`
uses an isolated Codex profile and listens only on localhost. Add behavior tests
for changes to sequencing, receipts, lifecycle, approvals, or permissions.
Use the CLI's original fixture output; do not edit fixtures to make an assumption
pass. Document any new contract requirement in PARITY.md.

Do not broaden a run's permissions to make a test pass, auto-answer a tool
approval, change users' hook trust, or inspect application databases. Keep
untrusted collaboration content at user/data authority. All executable process
arguments should remain arrays without a shell.

Rebuild all of `dist/` after source changes. It is committed so a local marketplace
installation works without a build on the user's machine. Changes to code used
by hooks require normal Codex hook review after an update.

The OpenAI extensions package currently pins an older Zod; the npm override
uses the directly pinned patched Zod version. Preserve the SDK compatibility
and browser tests when updating those packages. Build-generated third-party
notices accompany both bundles.
