using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.StudioHubs;

public class StudioHubsPlugin : BasePlugin<StudioHubsConfiguration>, IHasWebPages
{
    public override string Name => "Studio Hubs";
    public override Guid Id => Guid.Parse("8ab79914-1be0-4f4a-92aa-25ecf5ecad16");
    public override string Description => "Jellyfin plugin for configurable Studio Hubs on Home Screen, with hover videos and configurable settings.";

    private readonly IApplicationPaths _paths;
    public static StudioHubsPlugin Instance { get; private set; } = null!;

    public StudioHubsPlugin(IApplicationPaths paths, IXmlSerializer xmlSerializer)
        : base(paths, xmlSerializer)
    {
        _paths = paths;
        Instance = this;
    }

    public string BuildScriptsHtml()
    {
        var sb = new StringBuilder();
        sb.AppendLine("<!-- STUDIO-HUBS-INJECT BEGIN -->");
        sb.AppendLine($"<script type=\"module\" src=\"{AssetVersioning.AppendVersionQuery("../studiohubs/main.js")}\"></script>");
        sb.AppendLine("<!-- STUDIO-HUBS-INJECT END -->");
        return sb.ToString();
    }

    public IEnumerable<PluginPageInfo> GetPages()
    {
        var ns = typeof(StudioHubsPlugin).Namespace;
        return new[]
        {
            new PluginPageInfo
            {
                Name = "StudioHubsConfigPage",
                EmbeddedResourcePath = $"{ns}.Web.configuration.html",
                EnableInMainMenu = false
            }
        };
    }

    public string GetStorageDirectory(params string[] segments)
    {
        var basePath =
            ReadPathValue(_paths, "PluginConfigurationsPath") ??
            ReadPathValue(_paths, "ProgramDataPath") ??
            ReadPathValue(_paths, "DataPath") ??
            Path.GetDirectoryName(ReadPathValue(this, "ConfigurationPath") ?? string.Empty) ??
            AppContext.BaseDirectory;

        var current = Path.Combine(basePath, "StudioHubs");
        Directory.CreateDirectory(current);

        foreach (var segment in segments ?? Array.Empty<string>())
        {
            var cleanSegment = string.IsNullOrWhiteSpace(segment)
                ? string.Empty
                : segment.Trim().Trim(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (string.IsNullOrWhiteSpace(cleanSegment))
            {
                continue;
            }

            current = Path.Combine(current, cleanSegment);
            Directory.CreateDirectory(current);
        }

        return current;
    }

    private static string? ReadPathValue(object? source, string propertyName)
    {
        try
        {
            return source?.GetType().GetProperty(propertyName)?.GetValue(source) as string;
        }
        catch
        {
            return null;
        }
    }
}
