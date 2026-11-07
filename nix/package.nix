{
  lib,
  buildNpmPackage,
  nodejs,
  gitMinimal,
}:
buildNpmPackage {
  pname = "delta-codex";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  inherit nodejs;

  # Only project sources enter the store, never node_modules, local state,
  # release archives, or unrelated files from a developer's checkout.
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../.agents
      ../.codex-plugin
      ../.github
      ../.envrc
      ../.gitignore
      ../.prettierignore
      ../.prettierrc.json
      ../AGENTS.md
      ../CHANGELOG.md
      ../CONTRIBUTING.md
      ../LICENSE
      ../NOTICE
      ../PARITY.md
      ../README.md
      ../bin
      ../dist
      ../docs
      ../flake.nix
      ../flake.lock
      ../hooks
      ../nix
      ../package.json
      ../package-lock.json
      ../scripts
      ../skills
      ../src
      ../test
      ../tsconfig.json
    ];
  };

  npmDepsHash = "sha256-Oa6B8UsjRbue/bXBylAsyvSE2+qpQ56YEx5su/XR67U=";
  npmFlags = [
    "--no-audit"
    "--no-fund"
  ];
  npmInstallFlags = [ "--include=dev" ];
  npmPruneFlags = [ ];
  nativeCheckInputs = [ gitMinimal ];
  env.CI = "true";

  preBuild = ''
    delta_codex_bundle=$(mktemp)
    cp dist/cli.js "$delta_codex_bundle"
  '';
  doCheck = true;
  checkPhase = ''
    runHook preCheck
    npm run typecheck
    npm test
    npm run format:check
    cmp dist/cli.js "$delta_codex_bundle"
    runHook postCheck
  '';

  doInstallCheck = true;
  postInstall = ''
    # Vitest's results contain run timings and must not enter the package.
    rm -rf "$out/lib/node_modules/delta-codex/node_modules/.vite"
  '';
  installCheckPhase = ''
    runHook preInstallCheck
    test "$("$out/bin/delta-codex" --version)" = "${(builtins.fromJSON (builtins.readFile ../package.json)).version}"
    "$out/bin/delta-codex" --help > /dev/null
    test -f "$out/lib/node_modules/delta-codex/.codex-plugin/plugin.json"
    test -f "$out/lib/node_modules/delta-codex/hooks/hooks.json"
    runHook postInstallCheck
  '';

  meta = {
    description = "Native Codex collaboration through Delta";
    license = lib.licenses.agpl3Only;
    mainProgram = "delta-codex";
    platforms = [
      "x86_64-linux"
      "aarch64-linux"
      "aarch64-darwin"
    ];
  };
}
