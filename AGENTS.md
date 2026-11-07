# Delta for Codex

This is a native Codex plugin, not a replacement agent harness. Read README.md
and PARITY.md before changing its behavior. `src/bridge.ts` owns lifecycle;
`src/codex/rpc.ts` talks to the shared daemon; `src/cli/delta.ts` owns Delta CLI
calls; `src/recording/` owns durable delivery and translation.

Preserve stable producer IDs, sequence numbers, pending records, opaque Delta
references, and Codex permission boundaries. Never repair a failed recording by
deleting its state. Do not automatically approve tool requests or change hook
trust. Keep process arguments as arrays without shell interpolation.

Run `npm run format` and `npm run verify` after changes. When Codex is available,
run `npm run test:native`; it uses an isolated profile and local fixture model.
For packaging changes also run `npm run test:package`. Tests must not target a
live Delta account or paid model endpoint. Rebuild the committed dist bundle.

When Nix is available, run project commands inside `nix develop -c ...` from
the checkout root. Use `npm ci` after dependency changes; shell entry does not
install packages. Nix changes also require `nix fmt` and `nix flake check`.
Keep `flake.lock` and the npm dependency hash in `nix/package.nix` in sync with
their inputs; see docs/nix.md. Do not replace pins with local machine paths.

Keep native installation coverage: Codex 0.166.0 silently skipped hooks when a
portable root plugin.json was present. The compatibility manifest is tested.
Do not claim live service or platform acceptance without running those checks.
