# Validation and release acceptance

Automated checks distinguish protocol evidence from live-service acceptance.
No automated test points at a real Delta account or a paid model endpoint.
The separately authorized manual 0.2.0 account check, including its incomplete
steps, is recorded in [UX tests and acceptance](testing.md).

| Check                  | Coverage                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`    | Strict TypeScript and protocol boundary usage                                                                                                                                                    |
| `npm test`             | Reference CLI parsers and remote context, translation, images, atomic storage, partial acknowledgments, retries, fencing, settings, sharing, joining, completed children, approvals, private IPC |
| `npm run test:native`  | Installed Codex 0.166.0, isolated profile, local fixture model, real history and context injection; real marketplace installation and discovery of all nine untrusted hooks                      |
| `npm run test:package` | Clean npm archive installation, required files, no runtime dependencies, executable CLI                                                                                                          |
| `npm run test:ui`      | Built panel through the standard MCP Apps browser bridge, with synthetic operations and optional-capability fallbacks                                                                            |
| `npm run format:check` | Consistent source and documentation formatting                                                                                                                                                   |
| `nix flake check`      | Sandboxed build and portable tests, pinned npm dependency integrity, generated-bundle consistency, installed CLI, Nix formatting                                                                 |
| Nix CI                 | Linux/Apple Silicon macOS builds and native fixture tests using the pinned shell; all three system definitions evaluated                                                                         |

The native model test runs a local HTTP fixture with deterministic Responses
events. It proves Codex sees injected context on the next actual turn, exports
native items, and does not generate merely because context was injected. It does
not establish model quality, Delta cloud connectivity, or cross-device file
convergence.

Before an official release, run these acceptance scenarios on two disposable
accounts/checkouts with authorized participants:

1. Private share → invite a second account → join from another computer. Verify
   access, staged/unstaged/untracked files, tool diffs, images, and message order.
2. Edit on one computer, finish a turn, then read the file from the other mounted
   checkout. A `live` watch frame alone is not proof of file convergence.
3. Start a slow tool, take over from the other participant, and verify exact-turn
   cancellation and late-tool denial. Inspect any already completed side effects.
4. Disconnect, record offline, reconnect without conflict. Then repeat while the
   other participant changes the thread; verify fork-before-discard preserves the
   rejected edits and that a new session resumes safely.
5. Kill the bridge after Delta accepts a batch but before its receipt is saved.
   Restart and verify duplicate acknowledgments, no sequence reuse, and mount recovery.
6. Add/remove a thread worktree. Confirm new mounts become ready before old mounts
   release, and that directory relocation is reported instead of silently changing cwd.
7. Run an isolated writable child, decline and accept specific tool approvals,
   steer it, cancel it, and merge only after inspecting the diff.
8. Repeat native installation, hook trust, daemon connection, shutdown, and
   application update on macOS and Windows. Portable unit tests alone do not
   establish native host support.

The plugin is ready for this review process, but these live multi-account and
native-platform scenarios were not run during implementation. They should not
be represented as passed in a release announcement.
