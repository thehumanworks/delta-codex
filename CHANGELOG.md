# Changelog

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
