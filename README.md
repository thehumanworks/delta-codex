# Delta for Codex

Share a native Codex conversation and its Git checkout through [Delta](https://delta.dev),
then continue with teammates using Codex, Claude Code, pi, or the Delta app.

This is an independent, local Codex plugin prepared for review by the Zed team.
It is not an official Zed or OpenAI release. Version **0.2.0** targets Codex CLI
**0.166.0+**, Node **22.19+**, and Delta recording contracts **8–10**.

## What it does

- Share privately, with an organization, or with specific email recipients.
- Set a repository policy for automatic private or team synchronization.
- Record prompts, replies, visible reasoning, images, tools, patches, titles, and
  contract-10 plans. Keep a durable outbox across disconnections and restarts.
- Join a Delta thread in a fresh native Codex session with mounted worktrees and
  collaborator context. Teammate messages do not start agent turns.
- Interrupt the exact Codex turn when a collaborator takes over, and deny late
  tool calls from that turn.
- Record native subagents, including completed subagents discovered when a
  conversation is shared later. Export retained history across compaction.
- Create isolated Delta child threads, run them asynchronously, steer or cancel
  them, and inspect their results and pending approvals.
- Search shared history, inspect thread trees, fork, merge, manage teams, and
  preserve rejected offline changes before recovery.
- Use typed MCP tools, opt-in numbered CLI presets, and an MCP App collaboration
  panel with sharing, joining, status, recovery and child-run controls.

The plugin uses the [Delta CLI integration contract](https://delta.dev/docs/cli/build-a-plugin)
and [Codex's app-server](https://learn.chatgpt.com/docs/app-server) for native sessions.
It does not modify Codex transcripts or either
application's database. See [parity and limitations](PARITY.md) for the precise
support boundary.

The [UX research](docs/ux-research.md) records host capabilities and native
compatibility findings. The [UX plan](docs/ux-plan.md) tracks the delivered
scope and remaining platform acceptance. See [testing](docs/testing.md) for
the distinction between automated, account and desktop validation.

## Install

Install Git, the application CLI from [Delta's CLI documentation](https://delta.dev/docs/cli),
Node 22.19 or newer, and Codex 0.166.0 or newer. The `delta` executable must be
Delta from delta.dev, not the Git diff viewer of the same name.

### Install from GitHub

```sh
codex plugin marketplace add https://github.com/thehumanworks/delta-codex.git --ref main
codex plugin add delta-codex@delta-codex-local
```

Run these commands from any directory. Codex downloads the GitHub repository
and installs its bundled plugin. The repository includes the compiled `dist/`
files, so no manual clone, `npm ci`, or build is needed.

**`delta-codex-local` is the marketplace's name**, including when its source is
GitHub. It comes from `.agents/plugins/marketplace.json`; it does not mean you
need a local development checkout. The plugin entry's `source.path: "./"`
correctly points to the root of the downloaded repository.

### Replace an existing local source with GitHub

If you previously registered `/absolute/path/to/delta-codex`, use this sequence
instead of the fresh-install commands above:

```sh
codex plugin marketplace remove delta-codex-local
codex plugin marketplace add https://github.com/thehumanworks/delta-codex.git --ref main
codex plugin add delta-codex@delta-codex-local
codex plugin marketplace list --json
```

This replaces Codex's registered marketplace location while keeping the same
plugin identifier, `delta-codex@delta-codex-local`. Do not change the repository's
`source.path` to the GitHub URL. In the final command's output, find
`delta-codex-local` and check that `marketplaceSource.sourceType` is `"git"` and
`marketplaceSource.source` is `"https://github.com/thehumanworks/delta-codex.git"`.
Its root is Codex's downloaded snapshot rather than your development checkout.
Use the same `CODEX_HOME` profile for all commands.

If the source is already `git@github.com:thehumanworks/delta-codex.git`, you are
already fetching from GitHub over SSH. The same remove/add sequence switches
that source to the public HTTPS URL if desired.

The local-to-GitHub replacement sequence was verified with Codex 0.166.0 in an
isolated profile against this public repository.

### Finish installation

Restart Codex, open **`/hooks`**, and review the nine Delta hooks. Start a new
session in a Git repository and invoke **`$delta-codex:setup`** to check account
readiness and optionally install the numbered CLI presets. In the desktop app,
restart the app and use **Settings → Hooks** to review them. Hook trust is
required and is never bypassed by the installer.

### Update from GitHub

```sh
codex plugin marketplace upgrade delta-codex-local
```

This refreshes the registered source from `main`. Restart Codex to load the
updated plugin, and review hooks again when Codex requests it. See the
[official marketplace commands](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

### Install a development checkout

Use this when editing the plugin locally. If the GitHub source is already
registered, remove it with `codex plugin marketplace remove delta-codex-local`
before adding the checkout:

```sh
nix develop  # optional; supplies the pinned tools described below
npm ci
npm run build
codex plugin marketplace add /absolute/path/to/delta-codex
codex plugin add delta-codex@delta-codex-local
```

Then follow **Finish installation** above.

Release packages include the executable and self-contained panel in `dist/`
and need no runtime npm dependencies.
The compatibility manifest in `.codex-plugin/` is intentional: the installed
Codex 0.166.0 loader skipped bundled hooks when a root portable manifest was
present. An integration test installs this layout and checks hook discovery.

Use Codex's **shared local daemon**. `--no-daemon`, cloud/remote execution, and
web-only plugin installations are not supported. Linux was exercised here;
macOS and Windows are included in CI for the portable code, but native desktop
and Windows daemon integration still need platform acceptance testing.

## Start collaborating

Choose a focused skill in the CLI's `/skills` picker, or type `$` to select it:

| Skill                | Use it to                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `delta-codex:share`  | Share this conversation privately, with an organization, or with email recipients.       |
| `delta-codex:join`   | Open a Delta thread in a fresh Codex session with its shared checkout and context.       |
| `delta-codex:status` | Check this session's recording, pending uploads, diagnostics, and collaborator presence. |
| `delta-codex:delta`  | Configure repository sync, search history, run isolated work, or recover recording.      |
| `delta-codex:setup`  | Check readiness and optionally install numbered CLI shortcuts.                           |

For example, invoke `$delta-codex:status` to check this session. These are skill
entry points; the plugin does not register native `/delta` slash commands or
custom terminal widgets. You can also ask Codex directly:

> Use Delta to share this conversation privately.

> Share this conversation with ada@example.com.

> Join this Delta thread: https://delta.dev/join/…

> Check this session's Delta sync status.

> Set up automatic private Delta sync for this repository.

For CLI shortcuts, ask to install Delta presets or run:

```sh
node /path/to/delta-codex/bin/delta-codex.mjs presets install
```

Open `/presets` to see the assigned numbered slots for **Delta status**, **Delta
share**, and **Delta join**. The installer uses free slots and preserves existing
shortcuts. `presets list` inspects them; `presets remove` removes only unchanged
Delta entries. Restart the CLI if its menu has not refreshed. Skills remain
available and are the workflow instructions behind these shortcuts.

In a ChatGPT app host with a local executor and MCP Apps support, ask to open
the Delta panel. It shows the selected native session, checkout, audience,
recording state and pending delivery, with share, join, link, retry and stop
controls. It also provides thread browsing and child-run controls. Supporting
hosts can expose its global/thread sidebar entry points and fullscreen mode.
Routine button actions call tools directly. Status refreshes every 15 seconds
while visible; it is a snapshot, not an instantaneous delivery guarantee.

An **Open in Codex** button returns to the correct native session; resume
arguments remain visible when a host cannot handle the deep link. Native
approvals stay in Codex. A web-only ChatGPT session cannot access the local
checkout. Actual ChatGPT desktop rendering and sidebar placement require
platform acceptance; the standard iframe bridge is covered by browser tests.

MCP discovery starts no bridge and uploads nothing. The tools use Codex's
`_meta.threadId`, and the package explicitly forwards the profile environment.
Viewing another session does not retarget the active conversation: open it
before changing its sharing or runs. Hosts without session metadata require
an explicit native session selection; the plugin never picks the newest one.

Codex checks the installed CLI, helps choose an organization, and uses the
audience you request. The sign-in command opens Delta's browser flow when you
request it. A join returns a command like:

```sh
codex -C /path/returned/by/delta resume CODEX_SESSION_ID
```

Opening that session moves you into the mounted checkout. The original Codex
session stays in its original directory. Joining itself does not run the model.

Sharing uploads sent prompts, replies, available reasoning, tool inputs and
outputs, conversation images, and nonignored checkout files, including staged,
unstaged and untracked changes. System/developer/hook instructions, encrypted
reasoning, unsent prompts, ignored files, and local Git branch state stay out.
Private synchronization still uploads to Delta under your chosen organization.
A shared thread cannot be made private again by this plugin.

## Command line

The skill uses the bundled command directly; installing it globally is optional.
All operation results are JSON.

```sh
node /path/to/delta-codex/bin/delta-codex.mjs doctor
node /path/to/delta-codex/bin/delta-codex.mjs --help
```

Use the **current Codex session ID**, supplied by the SessionStart hook or
`CODEX_THREAD_ID`. The plugin never guesses the newest session. Examples below
assume the optional `delta-codex` command is on PATH:

```sh
delta-codex org list
delta-codex share --session CODEX_ID --audience private --org ORG_ID
delta-codex share --session CODEX_ID --audience invite --org ORG_ID --email ada@example.com
delta-codex setup --mode organization --org ORG_ID
delta-codex status --session CODEX_ID
delta-codex join THREAD_OR_LINK
```

Setup writes `.delta/settings.json` and adds `.delta/` to Git's local
`info/exclude`. It preserves unrelated settings and refuses to rewrite a tracked
policy. Invalid settings disable automatic sharing and produce a diagnostic.
Setup affects future sessions; share the current one explicitly if wanted.

For parallel work, create a child, use its returned opaque reference, and keep
the returned Codex session/turn IDs:

```sh
delta-codex branch --session PARENT_CODEX_ID --name "Parser review" --isolated
delta-codex run CHILD_REFERENCE --session PARENT_CODEX_ID --prompt "Review the parser"
delta-codex wait --session CHILD_CODEX_ID --seconds 30
delta-codex send --session CHILD_CODEX_ID --turn TURN_ID --prompt "Also check error paths"
delta-codex pending --session CHILD_CODEX_ID
delta-codex interrupt --session CHILD_CODEX_ID --turn TURN_ID
```

Runs default to read-only. `--write` enables checkout edits only if the parent
permits writes; the parent's model and approval policy are retained. Requests
for tool approval remain pending until the user answers the specific request.
Unsupported custom permission profiles require an interactive Codex session.
A branch name and isolation choice are idempotent within a parent session; use
a different name for a separate branch. `merge CHILD --into PARENT --confirm`
applies an isolated child's changes when requested.

The [skill command reference](skills/delta/references/workflows.md) covers team
management, search, recovery, approvals and updates.

## Recovery and diagnostics

`status` reports pending record count, pause reason, connection diagnostics,
presence, remote turn state, and child references. `doctor` checks executable
versions, recording contract, and the native daemon without login or upload.

- **Untrusted hooks:** review `/hooks`, then start a new session. Updates that
  change hook scripts require review again.
- **No native daemon:** start Codex normally with its shared daemon enabled.
  The bridge must use the same `CODEX_HOME` and executable environment.
- **Transient outage:** records stay on disk; delivery retries with backoff.
  Owned recordings use Delta's local acknowledgments for offline capture.
- **Paused recording:** fix the reported cause, then `retry --session ID`.
  The bridge never resets sequence numbers to hide an error.
- **Rejected offline changes:** `resolve --session ID --action fork --confirm`
  preserves a Delta fork before discarding the rejected local version. Join the
  kept thread in a fresh session. `--action discard` intentionally drops the
  rejected changes. Local pending records remain available for inspection.
- **Stop sharing activity:** `stop --session ID` releases that session's watches
  and mounts, and stops inherited recording. It preserves saved records. This
  does not revoke access to an already shared thread. Joined runs are interrupted
  before their mounts are released.

`DELTA_CODEX_HOME` selects the private state directory (default
`${CODEX_HOME:-~/.codex}/delta`). `DELTA_CODEX_DELTA_BIN` and
`DELTA_CODEX_CODEX_BIN` select executable paths. The bridge uses a private Unix
socket or Windows named pipe with a local authentication token; it opens no
network listener. No credentials are copied from either application.

Do not publish the state directory: outboxes contain conversation content.
`PLUGIN_DATA` is deliberately not used so state survives plugin upgrades.

Before replacing an installed build, run `delta-codex bridge-stop`, upgrade the
marketplace, and review the changed hooks. The next hook or command starts the
new bridge and resumes saved recording state. This also provides a graceful
way to stop the local service without deleting recovery data.

## Develop and review

The recommended environment is the repository's Nix flake. On Linux it provides
Node, npm, Codex, Delta, Git, and the development tools from `flake.lock`. On
Apple Silicon macOS it provides the same toolchain and Codex; install Delta separately because
its upstream Nix distribution is Linux-only. No global npm installation is needed.

```sh
nix develop
npm ci
npm run verify
npm run test:native      # pinned Codex; uses only a local fixture model
npm run test:package     # packs and installs into a temporary directory
```

For automatic shell activation, install and configure direnv, then run
`direnv allow`. Entering the environment does not install npm dependencies or
change account configuration; run `npm ci` after checkout and lockfile changes.
`nix develop .#minimal` omits Codex and Delta for portable development.

`nix flake check` builds the plugin in a sandbox, runs the portable checks, and
checks Nix formatting. `nix build` creates the CLI at `result/bin/delta-codex`;
`nix run . -- --help` runs it directly. The [Nix guide](docs/nix.md) covers setup,
supported platforms, dependency updates, CI, and troubleshooting. Without Nix,
install Node 22.19+ and Git yourself and use the same npm commands.

Tests use a fake Delta CLI adapter, upstream CLI output fixtures, and a local
Responses fixture endpoint for native Codex. They do not log in to or mutate a
real Delta account, and they make no paid model requests. Real two-user Delta
synchronization remains an acceptance step; see [validation](docs/validation.md).

[Architecture](docs/architecture.md) explains the boundaries and invariants.
[PARITY.md](PARITY.md) maps features and gaps against the reference integrations.
[NOTICE](NOTICE) records upstream provenance. The project is licensed under
**AGPL-3.0-only**, consistent with the adapted Delta/pi code.
