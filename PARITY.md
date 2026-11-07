# Parity and support boundary

Reference points reviewed on 2026-11-06:

| Source                                     | Revision                                                  |
| ------------------------------------------ | --------------------------------------------------------- |
| `../delta-pi`                              | `c0b0e8721a34e55ffb41ba20af8d1af149e40943`                |
| pi's pinned Claude reference               | `ac769c681ba7a95ec7347b591f0858857a1a9e80`, plugin 0.1.32 |
| Current `zed-industries/delta-claude/main` | `9c6cac8a11e26c9932f0cc491fd6393c175f0b25`, plugin 0.1.42 |
| Delta installed during development         | 0.23.0, reports contract 8                                |
| Native Codex tested                        | 0.166.0                                                   |

The plugin implements the collaboration workflow through Codex's native APIs.
This is a feature and behavior matrix, **not** a claim that Claude's entire test
suite has been ported. Sixty protocol/context tests were adapted from pi; the
other tests exercise this implementation's storage, lifecycle, transport,
translation, native app-server and packaging.

| Capability                        | Codex implementation                                                                            | Evidence / boundary                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Private, team, invite sharing     | Explicit audience; stable `codex` producer and native session ID                                | Bridge tests; per-recipient invitation results retained                                                                                        |
| Focused skill entry points        | `delta-codex:share`, `delta-codex:join`, and `delta-codex:status`, plus the general Delta skill | Native plugin discovery and package checks; skills do not register custom slash handlers or TUI widgets                                        |
| Repository policy                 | Manual/private/organization, local Git exclusion                                                | Settings tests; invalid policy never auto-shares                                                                                               |
| Authentication and organizations  | CLI status/login/list/current/create/switch/invite                                              | Native Delta command help inspected; account mutations not live-tested                                                                         |
| Automatic dependency installation | Guided official installation                                                                    | Intentional difference: no background download/installer execution                                                                             |
| Messages and visible reasoning    | Codex item projection to ACP                                                                    | Translation tests; encrypted reasoning is unavailable and never fabricated                                                                     |
| Images                            | Data URLs and local user-image attachments                                                      | Image tests; PNG/JPEG/GIF/WebP, 20 MiB per local image; missing/unsupported attachments remain explicit text descriptors                       |
| Tools and edits                   | Shell/MCP/dynamic/native collaboration tools; structured ACP diffs                              | Translation tests; unknown future Codex item kinds are skipped                                                                                 |
| Plans                             | `update_plan` hook → ACP plan on contract 10                                                    | Bridge test; contracts 8/9 retain ordinary tool output                                                                                         |
| Titles                            | Native name, otherwise first prompt; follows renames                                            | Metadata polling; no additional inference call                                                                                                 |
| Automatic generated summaries     | Not implemented                                                                                 | Current Claude's contract-9 model-generated summaries are optional; Codex does not provide equivalent generated summaries through this adapter |
| Durable recording                 | Atomic state/outbox transaction; stable sequence and content; prefix acknowledgments            | Lost-receipt, partial-batch, disk-failure, concurrency and frontier tests                                                                      |
| Offline owned recording           | `--acknowledge local`, retry hints and backoff                                                  | Fake CLI tests; actual multi-device offline conflict needs acceptance testing                                                                  |
| Takeover                          | `turn/interrupt` plus late `PreToolUse` denial                                                  | Bridge tests; already executed tool effects cannot be undone                                                                                   |
| Live messages/comments            | Watch snapshot, edits/removals, ledger, bounded context injection at idle                       | Adapted context tests and bridge tests; incoming data never starts a turn                                                                      |
| Presence and children             | Available in JSON status                                                                        | No custom Codex transcript pane or persistent status band                                                                                      |
| Join                              | Access check, all worktrees mounted, fresh native thread, explicit resume command               | Bridge/native tests; no automatic desktop-tab switch                                                                                           |
| Worktree attachment changes       | Replacement mount becomes ready before old mount releases                                       | Implemented; changed aggregate directory requires fresh join                                                                                   |
| Completed subagent backfill       | Discover native child IDs and read retained histories                                           | Bridge test; expands pi's unsupported case                                                                                                     |
| Isolation                         | Delta isolated worktrees and explicit merge                                                     | Branch test; actual merge is delegated to Delta and not live-tested                                                                            |
| Asynchronous thread runs          | Start, wait, steer, interrupt; single-operation approval responses                              | Bridge tests; expands pi's blocking thread-run model                                                                                           |
| Slash-prefixed prompts            | Sent as literal app-server text                                                                 | Codex app-server input, not a CLI slash-command interpreter                                                                                    |
| Retained pre-compaction history   | Paginated native history, without a 4,096-message cap                                           | Pagination/native tests; deleted/ephemeral Codex history cannot be recovered                                                                   |
| Recovery                          | Fork-before-discard; preserve local outbox; fresh producer on continuation                      | Failure-order test; does not retarget old sequence numbers                                                                                     |
| Delta updates                     | Explicit CLI update/check                                                                       | No unattended application restart                                                                                                              |
| Plugin updates                    | Normal Codex marketplace upgrade and hook review                                                | No private self-update service or custom update banner                                                                                         |

## Codex-specific constraints

- Requires local shared-daemon APIs. A hook-only/no-daemon fallback would lack
  reliable native history and immediate cancellation, so it is not presented as
  equivalent support. Managed installations may disallow local hooks.
- Hooks require user trust. OpenAI's public plugin directory currently excludes
  hook-dependent packages; this release is for manual/local-marketplace installs.
- The native 0.166.0 loader test requires `.codex-plugin/plugin.json` with no root
  `plugin.json`. Keep that test when reconsidering portable packaging.
- Delta takeover stops the specified turn; a transport loss can delay the
  interruption. Trusted hooks deny subsequent local tool calls once fenced,
  and fail closed for bound sessions when the bridge cannot be reached.
- Model context and transcript UI are different surfaces. Injected collaborator
  items persist for subsequent model requests but are not a bespoke live UI pane.
- Incoming rows are committed after app-server acknowledgment. If that response
  is lost, a reconnect may repeat one labeled context row. No message or tool is
  executed by replay. Delta recording itself uses idempotent sequence receipts.
- A join is a new native session and preserves the old one. Native session forks
  use a new producer and follow repository policy; they are not automatically
  mapped to a Delta fork of their source.
- Background approvals are connection-owned. If the bridge dies while a run is
  waiting for approval, reopen its Codex session interactively. The plugin never
  automatically repeats a possibly accepted `turn/start` or a tool approval.
- Unknown Codex items and optional new Delta features need an explicit adapter.
  Delta contract negotiation stops at 10. It never claims support for a future
  incompatible minimum contract.

## Following upstream

The retained pure protocol and context modules preserve pi's structure. Compare
`src/cli/thread-commands.ts` and `src/watch/conversation.ts` with the pinned pi
revision, then review current Claude changes. Keep original CLI JSON fixtures
unchanged and adapt producer names only in `test/cli-fixtures.ts`. Add a targeted
behavior test for each adopted feature. Do not copy Claude-specific hook APIs or
assume a similarly named Codex hook has the same effect.
