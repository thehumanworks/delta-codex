---
name: setup
description: Set up Delta for Codex, check local dependencies and account status, and inspect or repair its automatically installed CLI presets. Use for Delta onboarding or shortcut setup.
---

# Set up Delta

This plugin uses the native Codex daemon and the local Delta CLI. It needs a
local executor; a web-only ChatGPT session cannot mount a checkout.

Run `node <plugin-root>/bin/delta-codex.mjs doctor`, where `<plugin-root>` is two
directories above this skill's directory. Use separate, safely quoted arguments.
For missing dependencies or sign-in, read
[setup requirements](../delta/references/setup.md). Check available organizations
with `delta_account` when the tool is available, or the CLI `auth status` and
`org list`. Never print auth files or tokens. Installing the plugin does not
authorize sharing, automatic repository sync, or hook trust changes.

Offer the supported entry points: Delta skills, typed MCP tools and the
`delta_panel` app view. The panel is optional; CLI JSON remains available.
CLI presets are installed automatically on the first trusted SessionStart.
Use `delta_presets` with `action: list`, or `presets list`, to inspect assigned
slots and `automaticSetup`. During requested onboarding, repair `pending` setup
with `action: install` unless the user asks otherwise. Leave `disabled` setup
alone unless they request reinstallation. If slots are full, explain that they
must free space in `/presets`; do not replace existing shortcuts.

`/presets` provides numbered slots, not plugin-owned named commands. Successful
setup runs once per Codex profile and preserves later edits and deletions.
`presets remove` removes only unchanged Delta shortcuts and disables automatic
setup; `presets install` explicitly restores them. Restart the CLI if its menu
has not refreshed. Hook review is still required for automatic startup setup.

Finish by reporting dependency/account readiness and the actual assigned slots.
If the user requested a first share or join, continue using that focused skill;
onboarding alone does not authorize either action.
