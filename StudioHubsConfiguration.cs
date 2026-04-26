using System.Collections.Generic;
using System.Text.Json.Serialization;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.StudioHubs;

public class StudioHubsConfiguration : BasePluginConfiguration
{
    [JsonPropertyName("enablePlugin")]
    public bool EnablePlugin { get; set; } = true;

    [JsonPropertyName("enableStudioHubs")]
    public bool EnableStudioHubs { get; set; } = true;

    [JsonPropertyName("studioHubsCardCount")]
    public int StudioHubsCardCount { get; set; } = 0;

    [JsonPropertyName("studioHubsHoverVideo")]
    public bool StudioHubsHoverVideo { get; set; } = true;

    [JsonPropertyName("studioHubsRandomOrder")]
    public bool StudioHubsRandomOrder { get; set; } = false;

    [JsonPropertyName("studioHubsPlaceAfter")]
    public string StudioHubsPlaceAfter { get; set; } = "continue watching";

    [JsonPropertyName("studioHubsPlaceBefore")]
    public string StudioHubsPlaceBefore { get; set; } = "recently added,latest,recent";

    [JsonPropertyName("studioHubVideoEntries")]
    public List<StudioHubVideoEntry> StudioHubVideoEntries { get; set; } = new();

    [JsonPropertyName("studioHubManualEntries")]
    public List<StudioHubManualEntry> StudioHubManualEntries { get; set; } = new();

    [JsonPropertyName("studioHubVisibilityEntries")]
    public List<StudioHubVisibilityEntry> StudioHubVisibilityEntries { get; set; } = new();

    [JsonPropertyName("studioHubsEnabledStudios")]
    public List<string> StudioHubsEnabledStudios { get; set; } = new();

    [JsonPropertyName("studioHubsStudioOrder")]
    public List<string> StudioHubsStudioOrder { get; set; } = new();
}

public class StudioHubVideoEntry
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("fileName")]
    public string FileName { get; set; } = string.Empty;

    [JsonPropertyName("updatedAtUtc")]
    public long UpdatedAtUtc { get; set; }

    [JsonPropertyName("updatedBy")]
    public string? UpdatedBy { get; set; }

    [JsonPropertyName("updatedByUserId")]
    public string? UpdatedByUserId { get; set; }
}

public class StudioHubManualEntry
{
    [JsonPropertyName("studioId")]
    public string StudioId { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("logoFileName")]
    public string? LogoFileName { get; set; }

    [JsonPropertyName("addedAtUtc")]
    public long AddedAtUtc { get; set; }

    [JsonPropertyName("updatedAtUtc")]
    public long UpdatedAtUtc { get; set; }

    [JsonPropertyName("addedBy")]
    public string? AddedBy { get; set; }

    [JsonPropertyName("addedByUserId")]
    public string? AddedByUserId { get; set; }
}

public class StudioHubVisibilityEntry
{
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;

    [JsonPropertyName("userName")]
    public string? UserName { get; set; }

    [JsonPropertyName("profile")]
    public string Profile { get; set; } = "desktop";

    [JsonPropertyName("hiddenNames")]
    public List<string> HiddenNames { get; set; } = new();

    [JsonPropertyName("orderNames")]
    public List<string> OrderNames { get; set; } = new();

    [JsonPropertyName("updatedAtUtc")]
    public long UpdatedAtUtc { get; set; }
}
