---
name: share
description: Share the current Codex conversation and Git checkout on Delta privately, with an organization, or with specific email recipients. Use when the user asks to start sharing this session.
---

# Share with Delta

Run `node <plugin-root>/bin/delta-codex.mjs`, where `<plugin-root>` is two
directories above this skill's directory. Use its absolute path and separate, safely
quoted arguments; do not assume a command is installed on PATH. Results are JSON.

Use the current session ID from the Delta SessionStart context or
`CODEX_THREAD_ID` for `--session`. Never guess the newest session or inspect
another transcript to find an ID. If unavailable, ask the user to review the
hooks and start a new Codex session.

Honor the user's audience and recipients. If missing, ask once whether they
want private, organization-wide, or invite-only sharing. Explain that sharing
uploads sent prompts, replies, visible reasoning, tool inputs and outputs,
conversation images, and nonignored checkout files, including uncommitted and
untracked files. It excludes unsent prompts, ignored files,
system/developer/hook instructions, and encrypted reasoning. Private sharing
still uploads to Delta under the selected organization.

Run `doctor` as needed to check dependencies and the shared local Codex daemon.
Use `org list` to resolve the organization the user selected; if more than one
fits and their choice is unclear, ask. Personal organizations support private
sharing. Missing dependencies are covered in [setup](../delta/references/setup.md).
Browser sign-in and installation require the user's intent for those actions.
Keep Codex hook trust and tool approvals in force.

Use the matching command, substituting the current session and chosen organization:

```text
node <plugin-root>/bin/delta-codex.mjs share --session CODEX_ID --audience private --org ORG_ID
node <plugin-root>/bin/delta-codex.mjs share --session CODEX_ID --audience organization --org ORG_ID
node <plugin-root>/bin/delta-codex.mjs share --session CODEX_ID --audience invite --org ORG_ID --email ADDRESS
```

Repeat `--email` for each requested recipient. Existing authorization to share
with that audience is enough; do not ask for approval again. Sharing imports
earlier persisted conversation history and continues synchronizing this session.
A thread already shared more widely cannot be made private by this plugin.

Report the returned state and per-recipient invitation results, including any
failures. Return only a URL actually reported by Delta. If upload is pending,
say so and use `status --session CODEX_ID` to inspect it; do not invent a link or
claim delivery. Preserve recording state on failure. For recovery or future
repository sync, read [workflows](../delta/references/workflows.md); a request to
share this session alone does not configure automatic sharing for future ones.
