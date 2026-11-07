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

From the plugin root, run the local build/package script:

```sh
bash scripts/build-local.sh
```

The script publishes the plugin, checks the required files (and JSON syntax when `jq` is installed), creates a ZIP, and verifies the ZIP contents. It does not create a Git tag, modify release metadata, or publish a GitHub release.

Default outputs:

- `dist/local/StudioHubs-v<version>.zip` — installable plugin package
- `dist/local/StudioHubs-v<version>/` — unpacked package files
- `bin/Release/<target-framework>/publish/` — full .NET publish output

Optional arguments:

- `--configuration Debug` to use another build configuration
- `--output-dir PATH` to write artifacts somewhere else

To test the package, stop Jellyfin, back up the existing plugin folder, then extract the ZIP into a new plugin folder under Jellyfin's plugins directory and restart the server. Review the Jellyfin log for plugin load errors. Remove the test folder and restore the backup to roll back.

Local and release packages include:

- Jellyfin.Plugin.StudioHubs.dll
- Jellyfin.Plugin.StudioHubs.deps.json
- manifest.json
- meta.json
- StudioHubs.png

## Release Workflow

This repository includes a manually triggered GitHub Actions workflow at `.github/workflows/create_release.yml`.

When run from the Actions tab, it:

1. Computes the next `StudioHubs_vX.Y.Z` tag (patch increment).
2. Builds with `dotnet publish -c Release`.
3. Creates a ZIP release asset named after the tag (for example, `StudioHubs_v1.0.1.zip`).
4. Creates a GitHub release and uploads that ZIP asset.
5. Uses the merged PR description as release notes when available.
