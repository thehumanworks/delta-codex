---
name: status
description: Check the current Codex session's Delta sharing and synchronization status, pending records, pause reasons, connection diagnostics, and collaborator presence. Use for Delta status checks without starting sharing or recovery.
---

# Check Delta status

Prefer `delta_status` for concise data, or `delta_panel` when the user wants the
collaboration controls. The MCP host supplies the calling native session; omit
`session` for that default. If the host cannot bind a session, select an explicit
ID supplied by the user. These reads do not start the bridge or recording.
Use the CLI fallback below when the tools are unavailable.

Run `node <plugin-root>/bin/delta-codex.mjs`, where `<plugin-root>` is two
directories above this skill's directory. Use its absolute path and separate, safely
quoted arguments; do not assume a command is installed on PATH. Results are JSON.

Use the current session ID from the Delta SessionStart context or
`CODEX_THREAD_ID` for `--session`. Never guess the newest session or inspect
another transcript to find an ID. If unavailable, explain the limitation and
use `doctor` for installation diagnostics if helpful. Ask the user to review
the hooks and start a new session to restore current-session identification.
Omitting `--session` lists other sessions; do that only when requested.

```text
node <plugin-root>/bin/delta-codex.mjs status --session CODEX_ID
```

Summarize the returned fields that explain the session's condition:

- `recording: false` means no active recording. Saved thread details, pending
  records, or `stopped: true` can still exist; do not call it never shared or
  say access has been revoked.
- Report `ready`, the `pending` record count, `paused`, and `diagnostic`
  together. A ready connection with pending records is not fully delivered.
  Missing fields are unknown, not evidence of a healthy connection.
- Include the actual thread URL and visibility when present. Never manufacture
  a URL or infer private visibility from a missing value.
- Report cloud `upload.state` separately. Zero local pending records does not
  prove cloud delivery; a missing audience can still be awaiting upload.
- Summarize presence, child threads, and the remote turn when relevant. Preserve
  opaque references and distinguish reported remote activity from this session.

If status fails, use `doctor` as needed to check executables, recording contract,
and the shared local daemon. It does not sign in or upload. Consult
[setup](../delta/references/setup.md) for missing dependencies. Avoid printing
transcripts, access tokens, or the bridge's authentication token.

A status check does not authorize sharing, browser sign-in, installation,
repository policy changes, or recovery. Explain the reported problem and a
next step. If the user has also asked for recovery, follow
[workflows](../delta/references/workflows.md), preserving pending records,
producer IDs, and sequence numbers. Never delete state to repair recording,
automatically approve tools, or change hook trust.
