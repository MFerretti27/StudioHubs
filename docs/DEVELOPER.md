# Developer Notes

## API Endpoints

Configuration:

- GET /Plugins/StudioHubs/config
- POST /Plugins/StudioHubs/config

Studio Hubs data:

- GET/POST /Plugins/StudioHubs/studio-hubs/studios-manage
- GET/POST/DELETE /Plugins/StudioHubs/studio-hubs/collection
- GET/POST/DELETE /Plugins/StudioHubs/studio-hubs/video
- GET/DELETE /Plugins/StudioHubs/studio-hubs/logo
- GET /Plugins/StudioHubs/studio-hubs/logo/{fileName}
- GET /Plugins/StudioHubs/studio-hubs/video/{fileName}

Notes:

- Config GET is readable for dashboard loading reliability.
- Config POST remains admin-protected.

## Build

From plugin root:

```bash
dotnet publish -c Release
```

Main output folder:

- bin/Release/net9.0/publish

Lean package includes:

- Jellyfin.Plugin.StudioHubs.dll
- Jellyfin.Plugin.StudioHubs.deps.json
- manifest.json
- meta.json

## Release Workflow

This repository includes a GitHub Actions workflow at `.github/workflows/release.yml`.

On push/merge to `main`, it:

1. Computes the next `StudioHubs_vX.Y.Z` tag (patch increment).
2. Builds with `dotnet publish -c Release`.
3. Creates a ZIP release asset named after the tag (for example, `StudioHubs_v1.0.1.zip`).
4. Creates a GitHub release and uploads that ZIP asset.
5. Uses the merged PR description as release notes when available.
