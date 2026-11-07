{
  description = "Reproducible development and builds for Delta for Codex";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    deltanix = {
      url = "github:zed-industries/delta-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      deltanix,
      ...
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      forEachSystem = f: forAllSystems (system: f system nixpkgs.legacyPackages.${system});
    in
    {
      packages = forEachSystem (
        _system: pkgs:
        let
          delta-codex = pkgs.callPackage ./nix/package.nix { nodejs = pkgs.nodejs_22; };
        in
        {
          inherit delta-codex;
          default = delta-codex;
        }
      );

      apps = forEachSystem (
        system: pkgs: {
          default = {
            type = "app";
            program = pkgs.lib.getExe self.packages.${system}.delta-codex;
            meta.description = "Run the Delta for Codex CLI";
          };
        }
      );

      devShells = forEachSystem (
        system: pkgs:
        let
          # nixpkgs disables daemon_auto_start at this pin. The plugin needs the
          # native shared daemon; enable it per invocation without changing config.
          codex = pkgs.writeShellScriptBin "codex" ''
            exec ${pkgs.lib.getExe pkgs.codex} --enable daemon_auto_start "$@"
          '';
          tools = with pkgs; [
            nodejs_22
            git
            openssh
            bashInteractive
            coreutils
            curl
            jq
            ripgrep
            nixfmt
            prefetch-npm-deps
          ];
          mkShell =
            extraPackages:
            pkgs.mkShellNoCC {
              packages = tools ++ extraPackages;
              SSL_CERT_FILE = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
              shellHook = ''
                # Resolve the checkout, including when direnv loads from a subdirectory.
                delta_codex_root="$PWD"
                while [[ "$delta_codex_root" != / && ! -f "$delta_codex_root/flake.nix" ]]; do
                  delta_codex_root="$(dirname "$delta_codex_root")"
                done
                if [[ -f "$delta_codex_root/package.json" ]]; then
                  export PATH="$delta_codex_root/node_modules/.bin:$PATH"
                fi
                unset delta_codex_root
              '';
            };
        in
        {
          default = mkShell (
            [ codex ] ++ pkgs.lib.optional pkgs.stdenv.hostPlatform.isLinux deltanix.packages.${system}.delta
          );
          # Same build tools, without downloading the application CLIs.
          minimal = mkShell [ ];
        }
      );

      checks = forEachSystem (
        system: pkgs: {
          package = self.packages.${system}.delta-codex;
          nix-format = pkgs.runCommand "delta-codex-nix-format" { nativeBuildInputs = [ pkgs.nixfmt ]; } ''
            nixfmt --check ${./flake.nix} ${./nix/package.nix}
            touch "$out"
          '';
        }
      );

      formatter = forEachSystem (_system: pkgs: pkgs.nixfmt-tree);
    };
}
