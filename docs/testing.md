# UX tests and acceptance

The tests exercise one collaboration engine through CLI, agent tools and app
controls. Automated suites use synthetic state and local fixtures, with no live
Delta account or paid model endpoint. Existing recording/permission coverage is
described in [validation](validation.md).

| Layer             | What it verifies                                                                                                                                                     | Command                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Portable behavior | Durable records, receipts, permissions, preparation races, opaque attachment references, cloud-vs-local status                                                       | `npm run verify`       |
| MCP contracts     | Side-effect-free discovery, tool schemas, native session binding, cross-session refusal, duplicate/ambiguous operations, bounded output and no transcript in status  | Included in `npm test` |
| Native harness    | Real installation with five skills, nine untrusted hooks, MCP resource/tools, isolated profile forwarding and exact calling thread                                   | `npm run test:native`  |
| Native presets    | Versioned edits, occupied slots, idempotent install, preserved comments and customized entries                                                                       | `npm run test:native`  |
| Browser           | Built iframe through the standard SDK host bridge; share validation, join/navigation, errors, selection, cancellation, light/dark/narrow layout, optional fullscreen | `npm run test:ui`      |
| Package           | Clean npm installation, bundled MCP startup/resource read, required assets/licenses, no runtime npm dependencies or temporary plans                                  | `npm run test:package` |
| Nix               | Pinned dependency integrity, reproducible executable/panel/notices, portable tests and installed executable                                                          | `nix flake check`      |

Run project commands inside `nix develop -c ...` when available. Install a test
browser with `npx playwright-core install chromium`, or set
`DELTA_CODEX_CHROMIUM` to an existing executable. Browser tests are opt-in
locally and a separate CI job; a missing browser must not silently pass that
job. `DELTA_CODEX_UI_ARTIFACTS` optionally saves screenshots.

## Account acceptance on 2026-11-07

The user explicitly authorized testing their Delta and Codex accounts for this
implementation. The manual check used a disposable synthetic Git repository,
a native authenticated model turn and private sharing in the user's own
organization. It did not share the development conversation, this repository,
invite other users or change hook trust.

Verified against the accounts:

- The native model turn completed with the synthetic response.
- Typed MCP sharing created a private cloud thread. The Delta service confirmed
  the private audience; a queued local upload was not counted as confirmation.
- The local outbox reached zero and a Delta transcript read contained the
  exact synthetic conversation.
- MCP join created a distinct native session whose cwd matched Delta's mounted
  aggregate directory.

The initial fixture lacked a Git remote. Retrying after adding a local bare
remote exposed overlapping preparation and ignored attachment references;
both issues were fixed and regression-tested without resetting recording
state. A fresh native fork verified the corrected share path.

The first joined-file assertion used the aggregate directory instead of its
worktree subdirectory. After correcting the assertion, subsequent Delta calls
returned `failed (remote): disconnected`. Therefore final mounted-file
convergence and the end-to-end stop recheck are **not recorded as passed**.
Synthetic recordings were stopped and test threads archived where the service
accepted the cleanup; durable state was retained. Do not equate the partial
account check with cross-device acceptance.

## Remaining platform acceptance

Actual ChatGPT desktop rendering, global/thread sidebar placement, native deep
link opening, and approval presentation need a local-executor desktop host.
The implementation environment had Chromium and Codex CLI but no such app.
Browser bridge tests and metadata discovery do not establish those outcomes.

Before publishing broader support, check share → confirmed audience/upload →
copy link → join → open the correct native session in the real app. Repeat on
macOS and Windows, then perform the multi-account, conflict, takeover and file
convergence scenarios in [validation](validation.md). Text tools, skills and
resume arguments are the supported fallbacks when an optional UI surface is
unavailable.
