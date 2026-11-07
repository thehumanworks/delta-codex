# Codex and ChatGPT UX research

Reviewed **2026-11-07**. The baseline research below was recorded before
implementation; the final section adds implementation evidence. The
[UX plan](ux-plan.md) records delivery and deferrals; [PARITY.md](../PARITY.md)
remains the record of what the plugin actually implements.

## Conclusion

Delta can become substantially more visible in both Codex CLI and the ChatGPT
desktop app while retaining its native integration. Presets provide a keyboard
entry point. MCP tools give the agent explicit operations. MCP Apps and ChatGPT
extensions provide controls and persistent views for the person using it.

The earlier assessment that skills were the only useful command surface was too
narrow. However, these capabilities are different: a preset recalls input, an
MCP tool performs an operation, and an MCP App renders an interface. Combining
them does not establish a programmable terminal-widget API.

The largest opportunity is to expose the collaboration engine we already have.
Presence, background runs, child threads, pending approvals, offline state, and
recovery exist behind CLI/JSON operations. A person should be able to see and
control those features without asking the agent to reconstruct their state.

## Evidence and limits

| Subject      | Evidence examined                                                                                                                                  | What this establishes                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| delta-codex  | Checkout `b324681c1c99d8d4c97fd2f83cee31de9e9bd8d6`; README, PARITY, manifest, hooks, skills, bridge, IPC, CLI and native tests                    | Current implementation and reusable boundaries                       |
| Codex CLI    | Nix-pinned `codex-cli 0.166.0`; help, generated experimental app-server schema, isolated terminal probe                                            | Installed capabilities, not just current website claims              |
| Delta CLI    | Installed `delta 0.23.0`; `thread --help` and `thread share --help`                                                                                | Local command availability; no live account operation                |
| delta-pi     | Sibling checkout `c0b0e8721a34e55ffb41ba20af8d1af149e40943`; README, PARITY, `index.ts`, band and status modules                                   | Actual pi integration and its documented differences                 |
| delta-claude | `zed-industries/delta-claude` at `9c6cac8a11e26c9932f0cc491fd6393c175f0b25`, plugin 0.1.42; README, manifest, command registration and band source | Current upstream UX; newer than pi's pinned 0.1.32 reference         |
| ChatGPT app  | Current official MCP Apps, extensions, navigation and packaging documentation                                                                      | Documented surfaces; no native desktop acceptance test was performed |

Labels used below: **observed** means inspected locally or exercised;
**documented** means stated by the host's current documentation;
**proposed** means a design recommendation; **unverified** means a compatibility
test is still needed. A protocol field alone does not prove a frontend renders it.

### Reproducing the harness inspection

From this checkout:

```sh
nix develop -c codex --version
nix develop -c codex app-server generate-json-schema --experimental --out /tmp/delta-codex-protocol
nix develop -c delta thread share --help
```

The terminal probe used a disposable `CODEX_HOME` and workspace, a fixture
provider pointing only at loopback, and `--strict-config --no-daemon`. It saved
one `tui.presets.1` entry with a Delta label and `$delta-codex:status` input.
Typing `/presets` as individual keys displayed the saved entry and the native
new/from-settings/edit/delete controls. The saved preset was not executed.
A first attempt that sent the entire input at once was inconclusive; the
separate-key probe is the evidence for menu rendering. This is UI inspection,
not a test of Delta recording with `--no-daemon`.

No real Delta account or paid model endpoint was used. Temporary schemas and
terminal captures were inspection artifacts, not plugin implementation files.

## 1. Presets improve CLI discovery, with a specific boundary

**Documented and observed:** `/presets` opens saved inputs. The documented
workflow uses numbered slots; `n` creates an entry and `s` captures settings.
The changelog describes ten slots. The sample configuration uses
`tui.presets.<slot>` with `label` and `input`.
[Commands](https://learn.chatgpt.com/docs/developer-commands#reuse-prompts-and-commands-with-presets),
[configuration](https://learn.chatgpt.com/docs/config-file/config-sample),
[changelog](https://learn.chatgpt.com/docs/changelog?date=2026-10-15).

**Not established:** automatic preset installation from a plugin manifest,
arbitrary named `/delta-share` handlers, or an executable callback behind a
preset. No such declaration was found in the reviewed packaging documentation.
The installed menu proves that a saved Delta input is discoverable, not that
running it avoids a model turn.

**Implication:** offer a small, optional Delta preset collection targeting the
existing skills: status, share, join, and setup. Start with status and share;
leave the user's other slots alone. A preset should express an operation on the
current session, never embed a session ID from installation time. Use prompt
presets, not a settings snapshot that could change permissions or model choice.

This approaches the familiar `/delta` launcher experience. It does not yet
match Claude/pi's direct command dispatch or its latency. Describe the actual
interaction as `/presets` followed by a selected Delta entry, not as a native
`/delta` command. Keep `$delta-codex:…` and the CLI available when presets are
unavailable or the user does not want them.

## 2. The agent can have a better interface than shell commands

**Observed:** the package currently declares skills and hooks, with no bundled
MCP server. The agent learns the current native session ID from `SessionStart`,
reads a skill, constructs a CLI invocation, and interprets JSON. The private
bridge already dispatches named operations; it does not accept arbitrary shell
commands or arbitrary app-server calls. See [main](../src/main.ts),
[IPC](../src/ipc.ts), [bridge](../src/bridge.ts), and
[architecture](architecture.md).

**Documented:** Codex consumes MCP initialization `instructions` as server-wide
guidance; the first 512 characters should stand on their own. Local clients
share MCP configuration for the same Codex host. This is a useful place for
short rules about session identity, references, and side effects.
[Codex MCP](https://learn.chatgpt.com/docs/extend/mcp).

Skills remain useful for choosing workflows and explaining decision points.
Tool descriptions should name user intentions, inputs, outputs and side effects;
authorization belongs in the server. Distinct consequential actions should be
distinct tools, rather than an unrestricted command executor.
[Skills](https://developers.openai.com/plugins/build/skills),
[tool design](https://developers.openai.com/plugins/plan/tools),
[tool exposure requirements](https://developers.openai.com/plugins/plugin-guidelines#mcp-requirements).

**Proposed:** add a thin local MCP adapter to the existing bridge. Expose a
small initial tool catalogue for status, organizations, sharing, joining, and
history. Add separate run/steer/interrupt/recovery operations as their UX is
ready. Keep the existing CLI as a supported fallback and automation interface.
Use one operation implementation behind all three callers: CLI, agent tools,
and app controls.

Return explicit outcomes rather than making the agent infer success: exact
native session and Delta reference, observed audience, connection freshness,
pending count, operation progress, per-recipient invitation results, and the
next available action. "Queued" must remain different from "delivered."
`recording: false` must not imply that a thread was never shared or that access
has been revoked.

Do not place the whole conversation, all sessions, or rapidly changing presence
into every tool response. The agent needs a bounded summary and an explicit
way to request details. Tool selection and correct arguments should be tested
with representative user prompts, including requests that should do nothing.
[Metadata evaluation](https://developers.openai.com/plugins/guides/optimize-metadata).

## 3. MCP Apps provide a real visual surface

**Documented:** MCP Apps associate tools with UI resources through
`_meta.ui.resourceUri`. ChatGPT renders them in an iframe connected through the
MCP Apps bridge. The UI can call tools; tools must remain useful in clients
that do not render UI. Prefer the standard protocol and feature-detect
ChatGPT-specific additions.
[MCP Apps in ChatGPT](https://developers.openai.com/plugins/build/chatgpt-ui).

**Documented:** ChatGPT extensions include global sidebar entry points,
conversation panels, settings, deep links, composer mentions, structured forms,
and onboarding. A global entry point uses `type: "global"`; a conversation
entry point uses `type: "thread"`. Composer mentions are currently documented
as desktop-only. Availability still depends on surface and rollout.
[Extensions](https://developers.openai.com/plugins/build/extensions).

**Proposed mapping:**

| Surface             | Delta experience                                                                  | Why it matters                                                                   |
| ------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Inline card         | Share result, real link, audience, upload state, open/copy actions                | Immediate feedback next to the action that produced it                           |
| Conversation panel  | Current thread, presence, live activity, child runs, pending approvals, recovery  | Closest app equivalent to the Claude/pi status band, with room for useful detail |
| Global sidebar app  | Search and browse threads, recent work, organizations, explicit session selection | Makes Delta usable before the user knows what to ask the agent                   |
| Settings/onboarding | Connection readiness, repository policy, chosen organization, optional presets    | Replaces scattered setup instructions with a visible path to readiness           |
| Composer mention    | Find a Delta thread and attach a bounded, attributed reference                    | Gives the agent the intended thread without guessing or dumping history          |
| Native forms        | Audience, organization and recipients when missing                                | Makes the same choice understandable in terminal and app clients                 |

File viewers/editors are possible but are lower priority. Delta already has
thread/worktree concepts, and the host already has file and diff views. First
improve sharing, awareness, and handoff; introduce a custom viewer only for a
specific comparison workflow the existing surfaces cannot express.

**Observed in the generated 0.166.0 protocol:**

- `McpAppUi` carries a resource URI and preferred model display mode; the
  generated enum includes `inline` and `fullscreen`.
- `mcpServer/tool/call` takes a native `threadId`, server, tool, arguments and
  optional metadata. Results carry content, structured content and metadata.
- Resource reads and MCP event-stream start/stop/notification methods exist.
- MCP elicitation has form and URL requests. Current documentation also
  describes the separately negotiated OpenAI form variant.

These are useful host integration points. They do not establish that the CLI
renders an HTML panel, that every ChatGPT extension is available in every
desktop mode, or that event streams are forwarded to an app iframe. Those are
prototype gates. The app-server documentation describes tool calls, UI
presentation metadata and elicitation separately.
[App-server](https://learn.chatgpt.com/docs/app-server).

## 4. Session binding is the critical design problem

**Documented:** `content` and `structuredContent` reach the model and UI;
tool-result `_meta` can hydrate the UI without entering model context. Tool
visibility can distinguish model and app callers. The documented
`openai/session` field is an anonymized ChatGPT conversation correlation ID.
It is not documented as the native Codex thread ID.
[UI and tool reference](https://developers.openai.com/plugins/reference).

**Proposed:** keep three identities distinct: the native Codex session, the
opaque Delta thread reference, and the app view's selected target. Resolve the
current native session through a verified host binding. Until that binding is
proven, use the exact hook-supplied ID for agent calls and explicit selection
for an unbound sidebar. Never select the most recent session as a substitute.
Do not assume an MCP process is dedicated to one conversation or that its
startup environment stays current when the user changes tabs.

The UI should always show what it controls. Its backend must revalidate the
target, ownership and applicable permissions before a write, especially after
a tab switch, reconnect or takeover. A stale card must not send to the wrong
thread. Browser state and model-provided arguments are not authorization.

UI-only metadata reduces context clutter; it is not a place for credentials or
the bridge token. Keep authentication and the outbox in the local service.
Rendering, selecting a row, or updating presence must not start an agent turn.
Only an explicit send/run action should do that.

## 5. Live state needs its own delivery path

**Observed:** `Bridge.status()` already exposes presence, children, remote turn,
pending records, diagnostics and paused state. IPC currently uses request and
response; the bridge owns the continuing Delta watch. A panel therefore needs
a projection of that watch, not an independent recorder or a second owner of
mounts and producer state.

**Proposed:** first provide read-only refresh with freshness and disconnected
states; then verify host-supported subscriptions for smoother updates. Bound
refresh frequency, pause it when the view is hidden, and resynchronize after
reconnection. Keep the UI usable while the agent is busy or idle. An activity
update should not require a new model turn or a new transcript card.

**Documented distinction:** ChatGPT's hosted MCP Events integration uses HTTP
subscriptions and webhook callbacks for user-configured tasks in supported
cloud Work/dots surfaces. It is not the same as updating a local status panel;
the published integration does not support polling or streaming delivery.
[MCP Events](https://developers.openai.com/plugins/build/mcp-events).

Do not use hosted event-triggered tasks as a substitute for passive presence.
A future "notify me when this thread finishes" or "act on these comments"
workflow would be a separately configured feature with explicit user intent.

For the CLI, hook `statusMessage` is temporary execution feedback and
`systemMessage` is surfaced as a warning. These are not a persistent band.
Reserve warnings for actionable failures or takeover/recovery information;
do not simulate normal presence by emitting warning spam.
[Hook output](https://learn.chatgpt.com/docs/hooks).

## 6. Joining can become a much better handoff

**Observed:** `join` creates a native session, mounts its worktrees, imports
context without starting a model turn, and returns a resume argv. The caller's
session remains unchanged.

**Documented:** `codex://threads/<thread-id>` opens an existing local chat.
New-chat links can prefill a workspace and prompt without sending it.
[Desktop navigation](https://learn.chatgpt.com/docs/reference/commands#chats).

**Proposed:** return an "Open joined session" action targeting the exact new
native ID, alongside the terminal resume command. Verify routing from the
actual plugin UI, profile selection, mounted directory and unsupported URL
scheme handling before calling this desktop handoff supported. A generic
"send to new chat" extension is not proof that it opens an already-created
native session in the required checkout.

This can match Claude's desktop handoff without replacing Codex. For CLI,
retain the explicit resume action unless the host exposes a supported session
switch. Do not drive keystrokes or edit its database to simulate one.

## 7. Packaging and distribution remain consequential

**Documented:** an onboarding skill can be declared in the OpenAI extension
metadata or compatibility manifest. Local MCP servers are supported; hook
bundles still require manual trust and remain ineligible for the public plugin
directory. Adding an MCP App does not remove that dependency.
[Packaging](https://developers.openai.com/plugins/build/plugins).

Local execution can be declared with `requires_local_executor`. Public local
MCP submissions currently require approved-partner access. Manual local
development and public submission are different milestones.
[Desktop-only distribution](https://developers.openai.com/plugins/deploy/desktop-only).

**Proposed:** preserve `.codex-plugin/plugin.json` and its native hook-discovery
test while adding capabilities. Do not migrate to a root manifest merely to
copy a current example: this project's 0.166.0 test exists because that layout
previously skipped hooks. Add an icon, clear starter prompts and setup entry
point when implementing the UX, with truthful local-execution copy.

The first release should keep the MCP adapter local and reuse existing Delta
authentication. A remote ChatGPT connector would need separate authentication,
hosting and a deliberate local-agent handoff. A remote iframe/server cannot
be assumed to reach this checkout or its private Unix socket. Web-only ChatGPT
support is a separate product scope, not a packaging switch.

## 8. What parity actually means

The benchmarks are the current [Claude integration](https://github.com/zed-industries/delta-claude/blob/9c6cac8a11e26c9932f0cc491fd6393c175f0b25/README.md),
its [command registration](https://github.com/zed-industries/delta-claude/blob/9c6cac8a11e26c9932f0cc491fd6393c175f0b25/hooks/setup/commands.ts),
its [band](https://github.com/zed-industries/delta-claude/blob/9c6cac8a11e26c9932f0cc491fd6393c175f0b25/hooks/band/band.tsx),
and the inspected [pi README](../../delta-pi/README.md) and
[pi parity record](../../delta-pi/PARITY.md). The sibling links assume the
development checkout layout; the pinned revisions above identify the baseline.

| Expected experience      | Claude / pi benchmark              | Delta for Codex today                           | Opportunity                                        |
| ------------------------ | ---------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| Find an action           | `/delta` menu and focused commands | Four skills and natural language                | Presets, app entry points, focused tools           |
| Choose an audience       | Interactive choices                | Agent-guided conversation                       | Native forms and a share dialog                    |
| Know what is shared      | Band shows audience and link       | JSON/status response                            | Current-session card and panel                     |
| See collaborators        | Band and attributed activity       | Watch data plus injected context                | Visible presence and activity with freshness       |
| Continue a shared thread | Host-specific session handoff      | Resume command                                  | Desktop deep link plus CLI fallback                |
| Recover offline work     | Visible recovery actions           | Explicit recovery CLI                           | Explain cause and present the applicable action    |
| Coordinate child work    | Claude messaging; pi's thread tool | Async run, steer, wait, interrupt already exist | Run list with progress and scoped approval details |
| Discover old work        | Shared thread context and tools    | Search/show/tree CLI                            | Searchable workspace and composer references       |

Current Claude additionally documents `/delta-unshare`, retaining explicit
invitations. Installed Delta 0.23.0 only advertises `organization` as a value
for `thread share --visibility`; this adapter has no unshare operation.
Treat "Make private" as a capability-gated follow-up requiring a newer verified
CLI contract. Stopping synchronization is not revoking access.

Claude also documents generated summaries using the user's model credentials.
Codex currently preserves native/manual titles without additional inference.
Better search summaries are a later, explicit-cost feature; they should not be
bundled silently into a visual refresh.

The app can exceed a narrow band by showing a thread tree, several runs and
recovery details together. The CLI can gain functional parity and better
discovery. Exact persistent-band parity in the terminal remains unverified:
no public general-purpose plugin TUI renderer was established by this review.

## Questions to resolve before shipping the visual integration

1. Does a packaged local stdio MCP App render inline and as a conversation
   panel in each target ChatGPT desktop mode? What minimum app version works?
2. What verified context reaches tools launched from the agent, a thread panel
   and a global sidebar? Can it be bound to the correct native Codex session?
3. Which live-update path reaches the rendered component without starting
   turns? How does it behave when hidden, disconnected or reopened?
4. Can a component open the documented native chat deep link in the correct
   profile and checkout? What is the usable fallback?
5. Which standard/extended elicitation forms actually render in CLI and app,
   and how are cancellation and background approval ownership represented?
6. How are presets installed and removed without overwriting user slots or
   permission settings? Does a prompt preset reliably select its skill?
7. Does combined skills/hooks/MCP packaging retain all four skills and nine
   untrusted hooks, with no unsolicited sharing or login during discovery?

These are compatibility gates for the [plan](ux-plan.md), not reasons to
discard the supported surfaces or to replace the native harness.

## Implementation evidence — 2026-11-07

The implementation probes resolved several questions left open above:

- Codex 0.166 sends the exact native calling thread in `_meta.threadId` on MCP
  `tools/call`. Its MCP process does not inherit `CODEX_THREAD_ID`; do not use
  the server process environment for session identity. The ChatGPT anonymized
  `openai/session` value remains a different identifier.
- MCP subprocesses do not inherit `CODEX_HOME` by default. Explicit `env_vars`
  forwarding is supported by the compatibility manifest. Native installation
  tests place a synthetic saved binding in an isolated profile and confirm the
  packaged tool reads that binding, not the user's normal profile.
- The 0.166 compatibility MCP loader does not interpolate `${PLUGIN_ROOT}` or
  `${CLAUDE_PLUGIN_ROOT}` in arguments. It does resolve relative `cwd` against
  the installed plugin root. Use `command: "node"`, `cwd: "."`, and relative
  argument `bin/delta-codex.mjs`. This is verified by installation and matches
  the [0.166 plugin MCP parser](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/codex-mcp/src/plugin_config.rs).
  The portable Agent Plugins parser is a separate path; its documented
  placeholder support must not be assumed for the compatibility manifest.
- `config/read` with layers and `config/batchWrite` with `expectedVersion` can
  add an individual `tui.presets.N` entry and remove it with a null replacement.
  The native editor preserves comments and other slots. The installer refuses
  insufficient capacity atomically and leaves customized Delta entries alone.
- The real harness discovers the packaged tools, `ui://delta/workspace.html`,
  standard app resource metadata, and global/thread entrypoint declarations.
  This establishes discovery, not actual ChatGPT sidebar placement.
- The compiled iframe passes browser tests through the SDK's `AppBridge` and
  `PostMessageTransport`, including direct tool calls, session selection,
  mutation validation, errors, join navigation, dark mode, narrow layout and
  a host without fullscreen. No external assets or direct iframe network
  access are needed. Desktop approval presentation and actual deep-link routing
  remain separate platform acceptance items.

Pinned SDKs: MCP 1.32.2, MCP Apps 1.7.5 and OpenAI extensions 0.2.1. Apps 1.7.5
matches the OpenAI package's peer range; overriding its older Zod dependency
with the directly pinned 4.6.7 removes the reported collection-validation
advisory. These choices are backed by protocol and browser tests, rather than
forcing incompatible peer versions.
