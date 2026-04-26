using Jellyfin.Plugin.StudioHubs.Hosting;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.StudioHubs;

public sealed class StudioHubsServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection services, IServerApplicationHost applicationHost)
    {
        services.AddTransient<IStartupFilter, StudioHubsStartupFilter>();
    }
}

// Some Jellyfin/plugin loader combinations look for this conventional class name.
public sealed class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection services, IServerApplicationHost applicationHost)
    {
        services.AddTransient<IStartupFilter, StudioHubsStartupFilter>();
    }
}
