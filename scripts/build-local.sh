#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_FILE="$ROOT_DIR/StudioHubsPlugin.csproj"
CONFIGURATION="Release"
OUTPUT_DIR="$ROOT_DIR/dist/local"
VERSION_OVERRIDE=""

usage() {
  cat <<'EOF'
Build and package Studio Hubs locally without creating a release.

Usage: scripts/build-local.sh [--configuration NAME] [--output-dir PATH] [--version X.Y.Z.W]

Options:
  --configuration NAME  Build configuration (default: Release)
  --output-dir PATH     Output directory (default: dist/local)
  --version X.Y.Z.W     Override the local build version without editing the project
  -h, --help            Show this help
EOF
}

while (($# > 0)); do
  case "$1" in
    --version)
      (($# >= 2)) || { echo "Missing value for --version" >&2; exit 2; }
      VERSION_OVERRIDE="$2"
      [[ "$VERSION_OVERRIDE" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
        echo "Version must use X.Y.Z.W format." >&2
        exit 2
      }
      shift 2
      ;;
    --configuration)
      (($# >= 2)) || { echo "Missing value for --configuration" >&2; exit 2; }
      CONFIGURATION="$2"
      shift 2
      ;;
    --output-dir)
      (($# >= 2)) || { echo "Missing value for --output-dir" >&2; exit 2; }
      OUTPUT_DIR="$2"
      [[ "$OUTPUT_DIR" = /* ]] || OUTPUT_DIR="$ROOT_DIR/$OUTPUT_DIR"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command in dotnet zip unzip; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command not found: $command" >&2
    exit 1
  }
done

VERSION="$(dotnet msbuild "$PROJECT_FILE" -getProperty:Version)"
VERSION="${VERSION_OVERRIDE:-$VERSION}"
TARGET_FRAMEWORK="$(dotnet msbuild "$PROJECT_FILE" -getProperty:TargetFramework)"
PUBLISH_DIR="$ROOT_DIR/bin/$CONFIGURATION/$TARGET_FRAMEWORK/publish"
PACKAGE_DIR="$OUTPUT_DIR/StudioHubs-v$VERSION"
ZIP_FILE="$OUTPUT_DIR/StudioHubs-v$VERSION.zip"

echo "Publishing Studio Hubs $VERSION ($TARGET_FRAMEWORK, $CONFIGURATION)..."
dotnet publish "$PROJECT_FILE" --configuration "$CONFIGURATION" -p:Version="$VERSION"

PACKAGE_FILES=(
  "Jellyfin.Plugin.StudioHubs.dll"
  "Jellyfin.Plugin.StudioHubs.deps.json"
  "manifest.json"
  "meta.json"
  "StudioHubs.png"
)

for file in "${PACKAGE_FILES[@]}"; do
  if [[ ! -f "$PUBLISH_DIR/$file" ]]; then
    echo "Required publish file missing: $PUBLISH_DIR/$file" >&2
    exit 1
  fi
done

if command -v jq >/dev/null 2>&1; then
  jq empty "$PUBLISH_DIR/manifest.json" "$PUBLISH_DIR/meta.json"
fi

mkdir -p "$OUTPUT_DIR"
rm -rf "$PACKAGE_DIR"
rm -f "$ZIP_FILE"
mkdir -p "$PACKAGE_DIR"
for file in "${PACKAGE_FILES[@]}"; do
  cp "$PUBLISH_DIR/$file" "$PACKAGE_DIR/$file"
done

zip -q -j "$ZIP_FILE" "${PACKAGE_FILES[@]/#/$PACKAGE_DIR/}"
unzip -t "$ZIP_FILE"

echo
echo "Local package is ready:"
echo "  ZIP:     $ZIP_FILE"
echo "  Files:   $PACKAGE_DIR"
echo "  Publish: $PUBLISH_DIR"