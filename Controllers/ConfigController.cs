using System;
using System.Linq;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Database.Implementations.Enums;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.StudioHubs.Controllers;

public sealed class StudioHubsConfigUpdateDto
{
    public bool? EnablePlugin { get; set; }
    public bool? EnableStudioHubs { get; set; }
    public int? StudioHubsCardCount { get; set; }
    public bool? StudioHubsHoverVideo { get; set; }
    public bool? StudioHubsRandomOrder { get; set; }
    public double? StudioHubsMinRating { get; set; }
    public string? StudioHubsPlaceAfter { get; set; }
    public string? StudioHubsPlaceBefore { get; set; }
}

[ApiController]
[Route("StudioHubs/config")]
[Route("Plugins/StudioHubs/config")]
public sealed class ConfigController : ControllerBase
{
    private readonly IUserManager _users;

    public ConfigController(IUserManager users)
    {
        _users = users;
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Get()
    {
        var plugin = StudioHubsPlugin.Instance ?? throw new InvalidOperationException("Plugin not available.");
        var cfg = plugin.Configuration;

        NoCache();
        return Ok(new
        {
            ok = true,
            config = new
            {
                cfg.EnablePlugin,
                cfg.EnableStudioHubs,
                cfg.StudioHubsCardCount,
                cfg.StudioHubsHoverVideo,
                cfg.StudioHubsRandomOrder,
                cfg.StudioHubsMinRating,
                cfg.StudioHubsPlaceAfter,
                cfg.StudioHubsPlaceBefore
            }
        });
    }

    [HttpPost]
    public IActionResult Update([FromBody] StudioHubsConfigUpdateDto? incoming)
    {
        var user = TryGetRequestUser();
        if (user.Result is not null)
        {
            return user.Result;
        }

        if (!IsAdminUser(user.User))
        {
            return StatusCode(403, new { ok = false, error = "Admin required." });
        }

        var plugin = StudioHubsPlugin.Instance ?? throw new InvalidOperationException("Plugin not available.");
        var cfg = plugin.Configuration;

        if (incoming?.EnablePlugin is bool enablePlugin)
        {
            cfg.EnablePlugin = enablePlugin;
        }

        if (incoming?.EnableStudioHubs is bool enableStudioHubs)
        {
            cfg.EnableStudioHubs = enableStudioHubs;
        }

        if (incoming?.StudioHubsCardCount is int cardCount)
        {
            cfg.StudioHubsCardCount = Math.Clamp(cardCount, 0, 500);
        }

        if (incoming?.StudioHubsHoverVideo is bool hover)
        {
            cfg.StudioHubsHoverVideo = hover;
        }

        if (incoming?.StudioHubsRandomOrder is bool randomOrder)
        {
            cfg.StudioHubsRandomOrder = randomOrder;
        }

        if (incoming?.StudioHubsMinRating is double minRating)
        {
            cfg.StudioHubsMinRating = Math.Clamp(minRating, 0.0, 10.0);
        }

        if (incoming?.StudioHubsPlaceAfter is not null)
        {
            cfg.StudioHubsPlaceAfter = NormalizeKeywordCsv(incoming.StudioHubsPlaceAfter);
        }

        if (incoming?.StudioHubsPlaceBefore is not null)
        {
            cfg.StudioHubsPlaceBefore = NormalizeKeywordCsv(incoming.StudioHubsPlaceBefore);
        }

        plugin.UpdateConfiguration(cfg);

        NoCache();
        return Ok(new
        {
            ok = true,
            config = new
            {
                cfg.EnablePlugin,
                cfg.EnableStudioHubs,
                cfg.StudioHubsCardCount,
                cfg.StudioHubsHoverVideo,
                cfg.StudioHubsRandomOrder,
                cfg.StudioHubsMinRating,
                cfg.StudioHubsPlaceAfter,
                cfg.StudioHubsPlaceBefore
            }
        });
    }

    private (User? User, IActionResult? Result) TryGetRequestUser()
    {
        if (!TryGetRequestUserId(out var userId))
        {
            return (null, Unauthorized(new { ok = false, error = "X-Emby-UserId required." }));
        }

        var user = _users.GetUserById(userId);
        if (user is null)
        {
            return (null, Unauthorized(new { ok = false, error = "User not found." }));
        }

        return (user, null);
    }

    private bool TryGetRequestUserId(out Guid userId)
    {
        var userIdHeader =
            Request.Headers["X-Emby-UserId"].FirstOrDefault() ??
            Request.Headers["X-MediaBrowser-UserId"].FirstOrDefault();

        return Guid.TryParse(userIdHeader, out userId) && userId != Guid.Empty;
    }

    private static bool IsAdminUser(User? user)
    {
        if (user is null)
        {
            return false;
        }

        return user.Permissions.Any(permission =>
            permission.Kind == PermissionKind.IsAdministrator && permission.Value);
    }

    private void NoCache()
    {
        Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
        Response.Headers["Pragma"] = "no-cache";
        Response.Headers["Expires"] = "0";
    }

    private static string NormalizeKeywordCsv(string value)
    {
        var parts = (value ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .Take(30)
            .ToArray();

        return string.Join(",", parts);
    }
}
