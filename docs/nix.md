# Reproducible Nix development

The flake pins the development tools, and `package-lock.json` pins JavaScript
dependencies. CI uses the same inputs. Neither a global Node installation nor
a global npm package is needed.

## First checkout

Install [Nix](https://nix.dev/install-nix) and enable `nix-command` and `flakes`.
For a standalone installation, add this to `~/.config/nix/nix.conf`:

```ini
experimental-features = nix-command flakes
```

On NixOS, use `nix.settings.experimental-features = [ "nix-command" "flakes" ];`
in the system configuration instead. From the repository root:

```sh
nix develop
npm ci
npm run verify
npm run test:native
npm run test:package
```

The first shell entry downloads its pinned tools. `npm ci` installs the exact
dependency graph from the lockfile, including development dependencies under
normal npm settings. For environments with `NODE_ENV=production`, use
`npm ci --include=dev`. Repeat it after pulling changes to `package-lock.json`
or switching between incompatible Node/platform environments.

Entering the shell only sets up tools and PATH. It does not install JavaScript
packages, open a browser, log in, enable hook trust, or start a model request.
Dependency installation is an explicit step so a branch switch cannot silently
replace an engineer's `node_modules` during shell activation.

One-shot commands use the same environment:

```sh
nix develop -c npm ci --include=dev
nix develop -c npm run verify
nix develop -c npm run test:native
```

The initial pin matches the reviewed `delta-pi` environment: Node 22.23.4
(npm 10.9.9), Codex 0.166.0, and Delta 0.23.0. `flake.lock` records the exact
Nixpkgs and `zed-industries/delta-nix` revisions and content hashes. Local Nix
channels and globally installed tools do not choose these versions. The shell
puts this checkout's `node_modules/.bin` on PATH for the locked npm tools.

## Platforms and shells

| System                 | `nix develop`                                   | `nix develop .#minimal` |
| ---------------------- | ----------------------------------------------- | ----------------------- |
| Linux x86_64 / aarch64 | Build tools, Codex, official Delta package      | Build tools             |
| macOS Apple Silicon    | Build tools and Codex; install Delta separately | Build tools             |

Both shells provide Node/npm, Git/SSH, Bash, coreutils, curl, jq, ripgrep,
nixfmt, and the npm dependency prefetcher. `minimal` is useful for portable
code changes when the application CLIs are unnecessary. It does not guarantee
that inherited host tools are absent; native tests are explicitly opt-in.

The [official Delta Nix distribution](https://github.com/zed-industries/delta-nix)
currently targets Linux. Its package owns its runtime-library configuration and
uses its own narrowly scoped unfree-package allowance. This flake does not
change global Nix policy or substitute the unrelated `git-delta` program.
On macOS, install Delta from [the CLI documentation](https://delta.dev/docs/cli).
Intel macOS is not an output of this flake: the pinned Nixpkgs release has
[dropped x86_64-darwin support](https://nixos.org/manual/nixpkgs/unstable/release-notes#x86_64-darwin-26.11).
Use the npm workflow with a separately installed toolchain on that platform.
Windows contributors can also use the existing npm workflow, or a Linux checkout
inside WSL for the Nix environment. WSL does not bridge a Windows Codex daemon.

Nixpkgs disables Codex's automatic daemon startup at the initial pin. The full
shell provides a small `codex` wrapper that enables `daemon_auto_start` for
that invocation, since this plugin requires the native shared daemon. It does
not edit `~/.codex/config.toml`. Run Codex from inside the shell so its hooks
inherit Node and Delta on PATH. A desktop app launched outside the shell does
not automatically inherit the development environment.

The Nix definitions cover these three systems; local validation was performed on
x86_64 Linux. CI is configured to build and run the native fixture tests on
Linux and Apple Silicon macOS. Evaluating a definition is not a cross-platform runtime test.

## Optional direnv

Install [direnv](https://direnv.net/docs/installation.html), add its shell hook,
then run this once from the checkout:

```sh
direnv allow
npm ci
```

The checked-in `.envrc` uses the default flake shell. `nix-direnv` is optional
and makes repeated activation faster. If present, its fallback to a previously
working environment is disabled so a broken new pin is visible. `.direnv/`
is ignored. The environment unloads when leaving the directory. Approval is
direnv's normal review of `.envrc`, separate from Codex hook trust.

## Sandboxed builds and checks

```sh
nix flake check --print-build-logs
nix build
./result/bin/delta-codex --help
nix run . -- --version
```

The package rebuilds `dist/cli.js` from source with the pinned Node toolchain.
It installs dependencies from a hash-verified npm cache, then builds and runs
the portable checks without registry access. The checks include TypeScript,
unit/integration tests, formatting, an exact comparison with the committed
bundle, and the installed executable. `nix flake check` also checks Nix
formatting. Neither local `node_modules` nor unrelated checkout files enter
the package source. `result` links are ignored by Git.

Native Codex tests run separately in `nix develop`, where the localhost fixture
server and native process lifecycle can operate outside the Nix build sandbox.
They use temporary Codex profiles and no paid model or live Delta account.
The npm package-installation test runs there too.

The Nix build installs the CLI, including bundled plugin resources. For local
plugin development, register this source checkout as the marketplace using the
[README installation steps](../README.md#install) from within the full shell.
No Nix build or check installs a plugin into the engineer's Codex profile.

## Updating pins

Update application/toolchain pins deliberately, review the lockfile diff, and
run both portable and native checks:

```sh
nix flake update nixpkgs deltanix
nix develop -c npm ci --include=dev
nix develop -c npm run verify
nix develop -c npm run test:native
nix develop -c npm run test:package
nix flake check --print-build-logs
```

To update JavaScript dependencies, use npm inside the development shell and
review `package.json` and `package-lock.json` together. Then compute the cache
hash and replace `npmDepsHash` in `nix/package.nix` with the printed value:

```sh
nix develop .#minimal -c prefetch-npm-deps package-lock.json
nix develop -c npm run build
nix fmt
nix flake check --print-build-logs
```

Commit lockfiles, the dependency hash, and the rebuilt bundle together. Do not
use `--impure`, a machine-local Nixpkgs path, or disable integrity checks to
work around stale pins. The normal development shell can still be entered
while updating a stale npm cache hash; it does not depend on the package build.

## Troubleshooting

- **Flake or source file missing:** Nix's Git source excludes untracked files.
  Add new project files to Git before evaluating, or use `nix develop path:.`
  for a temporary untracked source tree. Run commands from the checkout root.
- **Lock/hash mismatch:** regenerate `npmDepsHash` after npm lockfile changes.
  It verifies the complete dependency cache, including optional platform packages.
- **Bundle comparison fails:** run `nix develop -c npm run build` and include
  `dist/cli.js` with the source change.
- **Missing native module after switching environments:** run `npm ci` again
  inside the target shell. Do not reuse `node_modules` between operating systems.
- **Registry or binary-cache outage:** the first fetch needs network access.
  Retry when the registry/cache is available; `--offline` only works once the
  required inputs, dependencies, and tools have been cached.
- **Delta graphics-library mismatch on NixOS:** follow the upstream Delta Nix
  advice on aligning Nixpkgs with the host graphics stack. The plugin's portable
  tests do not require a running Delta GUI.

The [Nix develop reference](https://nix.dev/manual/nix/stable/command-ref/new-cli/nix3-develop)
and [Nixpkgs JavaScript documentation](https://nixos.org/manual/nixpkgs/unstable/#javascript-buildNpmPackage)
describe the underlying shell and package mechanisms.
