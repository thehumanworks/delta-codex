# Changelog

## Unreleased

- Install status/share/join presets automatically on the first trusted session
  start. Preserve occupied slots, later edits/deletions, and explicit removal.
  Report setup failures without blocking sessions or changing sharing state.
- Rename the marketplace from `delta-codex-local` to `delta-codex`. Install with
  `codex plugin add delta-codex@delta-codex`; existing installations should follow
  the README migration steps to avoid duplicate hooks and MCP tools.

## 0.2.0

- Add typed local MCP tools and a self-contained MCP App collaboration panel.
  Includes session selection, explicit audiences, links, joining, sync/presence,
  recovery, thread reads, child runs, steering, interruption and native approval
  handoff. Skills and CLI commands remain supported.
- Add opt-in numbered CLI presets and a setup/onboarding skill. Preserve user
  shortcuts, comments and concurrent config edits.
- Bind tools to native host session metadata, forward profile environment, keep
  discovery side-effect free, and retain bounded text fallbacks.
- Add protocol, native installation/profile, preset, browser and clean-package
  coverage, plus documented UX research and acceptance boundaries.
- Fix overlapping worktree preparation and retain Delta's returned attachment
  reference. Refresh cloud upload, visibility and URL separately from local
  recording delivery.

## 0.1.0

Initial independent Codex integration. Adds native hooks and a private bridge,
sharing and repository policies, durable recording, joins, collaboration
context, takeover cancellation, native subagent backfill, isolated child threads,
asynchronous thread runs, explicit approvals, recovery, and local marketplace
packaging. Adapts the Delta/pi protocol and remote-context reference modules.

Includes a pinned Nix development environment, optional direnv activation,
sandboxed package builds and checks, and Linux/macOS Nix CI coverage.

Tests include an isolated real-Codex run against a local fixture model and a
native plugin installation check. Live Delta cross-device acceptance remains
documented separately.

The shared-daemon transport uses WebSocket framing over Codex's raw socket
proxy. The native fixture test covers this production transport, including a
real turn, rather than only a standalone stdio app-server.
