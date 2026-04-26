using System;

namespace Jellyfin.Plugin.StudioHubs;

internal static class AssetVersioning
{
    private static readonly string AssetVersion = BuildAssetVersion();

    public static string AppendVersionQuery(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return path ?? string.Empty;
        }

        if (path.IndexOf("v=", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            return path;
        }

        var separator = path.Contains('?', StringComparison.Ordinal) ? '&' : '?';
        return $"{path}{separator}v={Uri.EscapeDataString(AssetVersion)}";
    }

    private static string BuildAssetVersion()
    {
        try
        {
            var v = typeof(StudioHubsPlugin).Assembly.GetName().Version;
            if (v is null)
            {
                return DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
            }

            return $"{v.Major}.{v.Minor}.{Math.Max(v.Build, 0)}.{Math.Max(v.Revision, 0)}";
        }
        catch
        {
            return DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        }
    }
}
