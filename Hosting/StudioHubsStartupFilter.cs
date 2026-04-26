using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.StudioHubs.Hosting;

public sealed class StudioHubsStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            var logger = app.ApplicationServices.GetRequiredService<ILogger<StudioHubsStartupFilter>>();
            logger.LogInformation("[StudioHubs] Startup filter configured.");

            var asm = typeof(StudioHubsStartupFilter).Assembly;
            var embedded = new ManifestEmbeddedFileProvider(asm, "Resources/studiohubs");
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = embedded,
                RequestPath = "/studiohubs"
            });

            app.Use(async (ctx, nextMiddleware) =>
            {
                if (!HttpMethods.IsGet(ctx.Request.Method) || !IsIndexRequest(ctx.Request.Path))
                {
                    await nextMiddleware();
                    return;
                }

                var originalAcceptEncoding = ctx.Request.Headers["Accept-Encoding"].ToString();
                ctx.Request.Headers["Accept-Encoding"] = "identity";

                var originalBody = ctx.Response.Body;
                await using var mem = new MemoryStream();
                ctx.Response.Body = mem;

                try
                {
                    await nextMiddleware();

                    if (ctx.Response.StatusCode != StatusCodes.Status200OK)
                    {
                        mem.Position = 0;
                        await mem.CopyToAsync(originalBody);
                        return;
                    }

                    var contentType = ctx.Response.ContentType ?? string.Empty;
                    if (!contentType.StartsWith("text/html", StringComparison.OrdinalIgnoreCase))
                    {
                        mem.Position = 0;
                        await mem.CopyToAsync(originalBody);
                        return;
                    }

                    if (ctx.Response.Headers.ContainsKey("Content-Encoding"))
                    {
                        ctx.Response.Headers.Remove("Content-Encoding");
                    }

                    mem.Position = 0;
                    string html;
                    using (var reader = new StreamReader(mem, Encoding.UTF8, true, 8192, true))
                    {
                        html = await reader.ReadToEndAsync();
                    }

                    if (html.IndexOf("<!-- STUDIO-HUBS-INJECT BEGIN -->", StringComparison.OrdinalIgnoreCase) < 0)
                    {
                        var snippet = StudioHubsPlugin.Instance.BuildScriptsHtml();
                        var headEnd = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
                        if (headEnd >= 0)
                        {
                            html = html.Insert(headEnd, "\n" + snippet + "\n");
                        }
                        else
                        {
                            html += "\n" + snippet + "\n";
                        }

                        logger.LogInformation("[StudioHubs] Injected script block for path {Path}.", ctx.Request.Path);
                    }

                    var outBytes = Encoding.UTF8.GetBytes(html);
                    ctx.Response.ContentLength = outBytes.Length;
                    await originalBody.WriteAsync(outBytes, 0, outBytes.Length, ctx.RequestAborted);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "[StudioHubs] Index injection failed for path {Path}.", ctx.Request.Path);
                    mem.Position = 0;
                    await mem.CopyToAsync(originalBody);
                }
                finally
                {
                    if (string.IsNullOrEmpty(originalAcceptEncoding))
                    {
                        ctx.Request.Headers.Remove("Accept-Encoding");
                    }
                    else
                    {
                        ctx.Request.Headers["Accept-Encoding"] = originalAcceptEncoding;
                    }

                    ctx.Response.Body = originalBody;
                }
            });

            next(app);
        };
    }

    private static bool IsIndexRequest(PathString path)
    {
        var p = (path.Value ?? string.Empty).ToLowerInvariant();
         return p == "/" ||
             p.EndsWith("/index.html") ||
             p.EndsWith("/web") ||
               p.EndsWith("/web/") ||
               p.EndsWith("/web/index.html") ||
               p.EndsWith("/web/index.html.gz") ||
               p.EndsWith("/web/index.html.br");
    }
}
