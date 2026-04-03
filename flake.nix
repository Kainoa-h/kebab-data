{
  description = "A Nix-flake-based Python development environment for RDNA 4";

  nixConfig = {
    extra-substituters = [ "https://llama-cpp.cachix.org" ];
    extra-trusted-public-keys = [
      "llama-cpp.cachix.org-1:H75X+w83wUKTIPSO1KWy9ADUrzThyGs8P5tmAbkWhQc="
    ];
  };

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs, ... }@inputs:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forEachSupportedSystem =
        f:
        nixpkgs.lib.genAttrs supportedSystems (
          system:
          f {
            inherit system;
            pkgs = import nixpkgs {
              inherit system;
              config = {
                allowUnfree = true;
                # Globally set the ROCm target so any compiled ROCm packages only build for your card
                rocmTargets = [ "gfx1201" ];
              };
            };
          }
        );

      version = "3.13";
    in
    {
      devShells = forEachSupportedSystem (
        { pkgs, system }:
        let
          python = pkgs."python${nixpkgs.lib.replaceStrings [ "." ] [ "" ] version}";
          isLinux = pkgs.lib.hasSuffix "-linux" system;

          # Dynamically choose llama-cpp based on OS to prevent Darwin evaluation crashes
          llama-cpp-custom =
            if isLinux then
              (pkgs.llama-cpp.override { rocmSupport = true; }).overrideAttrs (old: {
                # Force CMake to only build for RDNA4 to save compile time if not cached
                cmakeFlags = (old.cmakeFlags or [ ]) ++ [ "-DAMDGPU_TARGETS=gfx1201" ];
              })
            else
              pkgs.llama-cpp; # Fallback for Darwin/Mac (uses Metal)
        in
        {
          default = pkgs.mkShellNoCC (
            {
              venvDir = ".venv";

              postShellHook = ''
                venvVersionWarn() {
                  local venvVersion
                  if [ -f "$venvDir/bin/python" ]; then
                    venvVersion="$("$venvDir/bin/python" -c 'import platform; print(platform.python_version())')"
                    [[ "$venvVersion" == "${python.version}" ]] && return
                    echo "Warning: Python version mismatch: [$venvVersion (venv)] != [${python.version}]"
                    echo "Delete '$venvDir' and reload to rebuild for version ${python.version}"
                  fi
                }
                venvVersionWarn
              '';

              packages =
                (with python.pkgs; [
                  venvShellHook
                  pip
                  uv
                  huggingface-hub
                ])
                ++ [
                  self.formatter.${system}
                  pkgs.gnumake
                  pkgs.ffmpeg
                  pkgs.nodejs
                  pkgs.pnpm
                  llama-cpp-custom
                ];
            }
            // pkgs.lib.optionalAttrs isLinux {
              # Inject RDNA 4 optimizations only if on Linux
              HSA_OVERRIDE_GFX_VERSION = "12.0.1";
              GGML_HIP_GRAPHS = "1";
              # Restrict ROCm to the discrete GPU only (Device 0: RX 9060 XT).
              # Without this, the iGPU is also enumerated and HSA_OVERRIDE_GFX_VERSION
              # misidentifies it as gfx1201, causing a GPU memory fault on launch.
              HIP_VISIBLE_DEVICES = "0";
            }
          );
        }
      );

      formatter = forEachSupportedSystem ({ pkgs, ... }: pkgs.nixfmt-rfc-style);
    };
}
