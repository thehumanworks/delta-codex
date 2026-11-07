# Local setup

Requirements: Node 22.19+, Git, Codex CLI 0.166.0+ using its shared daemon, and
Delta CLI with recording contract 8–10 (Delta 0.22.0 introduced contract 8).
`doctor` checks the available executables without signing in or uploading.
`DELTA_CODEX_DELTA_BIN` and `DELTA_CODEX_CODEX_BIN` can select explicit executables.

Install Delta using the official instructions at
https://delta.dev/docs/cli. If an unrelated diff viewer is on PATH as
`delta`, select the application CLI by absolute path. Do not run downloaded
installers as part of background discovery. A requested installation can use
the official platform instructions after verifying the current download URL.

For a local checkout of this plugin:

1. `npm ci && npm run build` (development checkouts only; release packages include the bundle).
2. `codex plugin marketplace add /absolute/path/to/delta-codex`.
3. `codex plugin add delta-codex@delta-codex-local`, or install from the plugin browser.
4. Review its hooks in `/hooks` or the desktop app's hook settings.
5. Start a new Codex session in a Git checkout and invoke `$delta`.

Codex does not automatically trust plugin hooks. A changed hook script needs
review again. Do not edit trust hashes or use a hook-trust bypass flag.

The local bridge needs the same executable environment and `CODEX_HOME` as the
Codex daemon. Run `codex` normally with its shared daemon enabled; `--no-daemon`
and remote/cloud execution are outside this release's support boundary.
Manually installed local plugins can bundle hooks; hook-based packages are not
currently eligible for OpenAI's public plugin directory.

The bridge stores session mappings, pending records and collaborator-delivery
ledgers under `$DELTA_CODEX_HOME` or `$CODEX_HOME/delta` (default `~/.codex/delta`).
These files contain conversation content. Keep them private. Never reset or
delete them to fix a sequence mismatch; use a fresh Codex session instead.
`PLUGIN_DATA` is intentionally not used so sharing state survives plugin updates.
