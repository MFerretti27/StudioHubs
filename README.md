# Studio Hubs Plugin

Standalone Jellyfin plugin that adds a Studio Hubs row to the Home screen.

This plugin was extracted from the original MonWUI/JMSFusion Studio Hubs functionality and focuses only on Studio Hubs behavior.

## Compatibility

- Target framework: net9.0
- Target Jellyfin ABI: 10.11.0.0

## Highlights

- Adds a Studio Hubs row to Home screen with clickable studio cards
- Uses admin-managed global settings for studio visibility and studio order
- Supports hover videos
- Optional random order on each Home visit

## Install (Jellyfin GUI via Repository)

You can install this plugin directly from Jellyfin's plugin catalog by adding this repository manifest URL:

```text
https://raw.githubusercontent.com/MFerretti27/StudioHubs/main/manifest.json
```

Steps:

1. Open Jellyfin as an admin.
2. Go to Dashboard, Plugins, Repositories.
3. Click Add and paste the repository URL above.
4. Save, then go to Catalog.
5. Find Studio Hubs and click Install.
6. Restart Jellyfin if prompted.

## Settings

Open Admin Dashboard, then Plugins, then Studio Hubs.

Available settings:

- Enable hover video
- Randomize studio order on each Home visit
- Minimum rating
- Place after sections (comma-separated title keywords)
- Place before sections (comma-separated title keywords)

Studio Management (global, admin-only):

- Enable or disable studios
- Reorder studios via drag and drop
- Defaults to all studios enabled when no explicit enabled list is saved

### Placement behavior

Placement resolution order:

1. Place after first matching section title
2. Else place before first matching section title
3. Else fallback to top of Home sections

Default placement intent:

- After Continue Watching
- Before Recently Added

## Random Order Behavior

When Randomize studio order on each Home visit is enabled:

- Studio order is reshuffled when a new Home visit starts

## Developer Documentation

For API endpoints, build output details, and release workflow notes, see:

- [Developer Notes](docs/DEVELOPER.md)

## Install (Manual)

1. Stop Jellyfin
2. Copy plugin files to the Studio Hubs plugin folder under Jellyfin plugins directory
3. Start Jellyfin
4. Open Admin Dashboard, Plugins, and confirm Studio Hubs is listed

For Unraid deployments, use your standard Jellyfin plugin folder mapping and replace files with the latest build package.

## Notes

- If Studio Hubs does not appear immediately, refresh the Catalog or restart Jellyfin.
