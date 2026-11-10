
# StudioHubs Jellyfin Plugin

<p align="center">
  <img src="Resources/studiohubs/StudioHubs.png" alt="Studio Hubs Logo" width="600"/>
</p>


<p align="center">
  <img src="https://github.com/MFerretti27/StudioHubs/actions/workflows/build.yml/badge.svg?branch=main" alt="Build"/>
  <img src="https://img.shields.io/github/downloads/MFerretti27/StudioHubs/total?label=Total%20Downloads&logo=github" alt="GitHub Releases"/>
  <a href="https://buymeacoffee.com/mferretti27"><img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?logo=buy-me-a-coffee&logoColor=black" alt="Buy me a coffee"/></a>
</p>

Jellyfin plugin that adds a Studio Hubs row to the Home screen.



https://github.com/user-attachments/assets/2c126286-2a56-4e2f-aa46-17cf4cd3f631

<p align="center">
<img width="717" height="418" alt="Screenshot 2026-06-21 at 8 04 25 PM" src="https://github.com/user-attachments/assets/638306ae-96ad-40dd-8384-2f5206aa796a" />
</p>


This plugin was extracted from the Studio Hubs functionality in [G-grbz/Jellyfin-MonWUI-Plugin](https://github.com/G-grbz/Jellyfin-MonWUI-Plugin) and focuses/improves only on Studio Hubs behavior.

- Targets .NET 10 and Jellyfin 12.4 (plugin ABI 12.4.0.0).

## Highlights

- Adds a Studio Hubs row to Home screen with clickable studio cards
- Uses admin-managed settings for studio visibility and studio order
- Supports hover videos
- Optional random order on each Home visit

## Installation

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

Open Admin Dashboard and select **Studio Hubs** under **Plugins** in the sidebar for quick access to settings.

Available settings:

- Enable hover video
- Randomize studio order on each Home visit
- Home row position for all users (dropdown)

Studio Management (global, admin-only):

- Enable or disable studios
- Reorder studios via drag and drop
- Defaults to all studios enabled when no explicit enabled list is saved

### Placement behavior

Choose **At top of Home**, or place Studio Hubs after **My Media**, **Continue Watching**,
**Latest Media**, **Next Up**, **Continue Listening**, **Continue Reading**, **Live TV**, or
**Active Recordings**. Section matching uses Jellyfin's translated titles when available.

Default placement: after **My Media**. If the selected section is missing from a user's Home,
placement falls back to My Media, then the first native section, then the top if no sections exist.

This replaces the old free-text placement setting. Existing installations default to **After My Media**;
select a new position in settings to override it. Legacy placement fields are retained in saved configuration
for compatibility but no longer control the row.

## Linking a Movie or Show to a Studio

Studio Hubs groups your library by the "Studios" field on each item's metadata. If a movie or
show isn't showing up under the studio you expect:

1. Open the item in Jellyfin and click the pencil (Edit Metadata) icon.
2. Scroll to the **Studios** field.
3. Add the studio's name exactly as it appears in the Studio Management list (for example,
   `Marvel Studios`, `Pixar`, or `Warner Bros. Pictures`).
4. Save the metadata change.

The item should appear on its studio's hub the next time Home refreshes (a page reload forces
this immediately).

## Random Order Behavior

When Randomize studio order on each Home visit is enabled:

- Studio order is reshuffled when a new Home visit starts

## Developer Documentation

For API endpoints, build output details, and release workflow notes, see:

- [Developer Notes](docs/DEVELOPER.md)

## Notes

- If Studio Hubs does not appear immediately, refresh the Catalog or restart Jellyfin.

---

## License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Jellyfin Team** – For the excellent media server platform
- **MONWUI** – Original Studio Hubs implementation and inspiration

## Support

- **Issues:** [GitHub Issues](../../issues)
- **Other Amazing Plugins:** [Awesome Jellyfin Repo](https://github.com/awesome-jellyfin/awesome-jellyfin/blob/main/README.md)
- **Jellyfin Community:** [Official Jellyfin Forums](https://forum.jellyfin.org/)
