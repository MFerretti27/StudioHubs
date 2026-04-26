const DEFAULT_ORDER = [
  "Netflix",
  "Disney+",
  "DC",
  "Marvel Studios",
  "Pixar",
  "Walt Disney Pictures",
  "Warner Bros. Pictures",
  "Lucasfilm Ltd.",
  "Columbia Pictures",
  "Paramount Pictures",
  "DreamWorks Animation"
];

const STUDIO_ALIASES = {
  "Marvel Studios": ["marvel", "marvel entertainment", "marvel studios llc"],
  "Pixar": ["pixar animation studios", "disney pixar"],
  "Walt Disney Pictures": ["walt disney"],
  "Disney+": ["disney plus", "disney+ originals", "disney plus originals"],
  "DC": ["dc entertainment"],
  "Warner Bros. Pictures": ["warner bros", "warner bros.", "warner brothers"],
  "Lucasfilm Ltd.": ["lucasfilm", "lucasfilm ltd"],
  "Columbia Pictures": ["columbia", "columbia pictures industries"],
  "Paramount Pictures": ["paramount", "paramount pictures corporation"],
  "DreamWorks Animation": ["dreamworks", "dreamworks pictures"]
};

const STUDIO_VIDEO_SLUGS = {
  "Marvel Studios": "marvel-studios",
  "Pixar": "pixar",
  "Walt Disney Pictures": "walt-disney-pictures",
  "Disney+": "disney",
  "DC": "dc",
  "Warner Bros. Pictures": "warner-bros-pictures",
  "Lucasfilm Ltd.": "lucasfilm-ltd",
  "Columbia Pictures": "columbia-pictures",
  "Paramount Pictures": "paramount-pictures",
  "Netflix": "netflix",
  "DreamWorks Animation": "dreamworks-animation",
  "Universal": "universal"
};

const STUDIO_LOGO_SLUGS = {
  "Marvel Studios": "marvel-studios",
  "Pixar": "pixar",
  "Walt Disney Pictures": "walt-disney-pictures",
  "Disney+": "disney",
  "DC": "dc",
  "Warner Bros. Pictures": "warner-bros-pictures",
  "Lucasfilm Ltd.": "lucasfilm-ltd",
  "Columbia Pictures": "columbia-pictures",
  "Paramount Pictures": "paramount-pictures",
  "Netflix": "netflix",
  "DreamWorks Animation": "dreamworks-animation",
  "Universal": "universal"
};

const ALIAS_TO_CANONICAL = (() => {
  const map = new Map();
  for (const [canonical, aliases] of Object.entries(STUDIO_ALIASES)) {
    map.set(String(canonical).toLowerCase(), canonical);
    for (const alias of aliases || []) {
      map.set(String(alias).toLowerCase(), canonical);
    }
  }
  return map;
})();

const CACHE = {
  studios: null,
  ts: 0,
  config: null,
  configTs: 0,
  manualEntries: null,
  manualEntriesTs: 0,
  visibility: null,
  visibilityTs: 0,
  videoEntries: null,
  videoEntriesTs: 0,
};
const STUDIO_ID_BY_NAME_CACHE = new Map();
const DEBUG_STATE = {
  lastRender: [],
  lastAt: 0,
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const EMPTY_STUDIOS_RETRY_MS = 45 * 1000;
const CONFIG_CACHE_TTL_MS = 30 * 1000;
const CONFIG_RETRY_DELAY_MS = 15 * 60 * 1000;
const VISIBILITY_RETRY_DELAY_MS = 5 * 60 * 1000;
const NO_CARDS_RETRY_DELAY_MS = 20 * 1000;
const MIN_RENDER_INTERVAL_MS = 900;
const FAST_RENDER_DELAY_MS = 40;
const DEFAULT_RENDER_DELAY_MS = 120;
const PLUGIN_DATA_CACHE_TTL_MS = 15 * 1000;
let busy = false;
let scheduleTimer = null;
let lastRenderAt = 0;
let visibilityFallbackUntil = 0;
let configFallbackUntil = 0;
let lastRenderSignature = "";
let homeVisibleLastTick = false;
let homeVisitId = 0;
let randomOrderCache = { visitId: 0, key: "", order: [] };
const BOOT_GUARD_KEY = "__studioHubsBooted";

function ensureCss() {
  if (document.getElementById("studiohubs-css")) return;
  const link = document.createElement("link");
  link.id = "studiohubs-css";
  link.rel = "stylesheet";
  link.href = withServer(`/studiohubs/studioHubs.css?v=${Date.now()}`);
  document.head.appendChild(link);
}

function getCfgFromLocalStorage() {
  const enabled = localStorage.getItem("studiohubs.enabled");
  const minRating = Number(localStorage.getItem("studiohubs.minRating") || 6.5);
  const hoverVideo = localStorage.getItem("studiohubs.hoverVideo");
  const randomOrder = localStorage.getItem("studiohubs.randomOrder");
  const placeAfter = String(localStorage.getItem("studiohubs.placeAfter") || "").trim();
  const placeBefore = String(localStorage.getItem("studiohubs.placeBefore") || "").trim();

  return {
    enablePlugin: true,
    enableStudioHubs: enabled == null ? true : enabled !== "false",
    enabled: enabled == null ? true : enabled !== "false",
    minRating: Number.isFinite(minRating) ? minRating : 6.5,
    hoverVideo: hoverVideo == null ? true : hoverVideo !== "false",
    randomOrder: randomOrder === "true",
    placeAfter,
    placeBefore,
  };
}

async function getCfg() {
  if (Date.now() < configFallbackUntil) {
    const fallback = getCfgFromLocalStorage();
    CACHE.config = fallback;
    CACHE.configTs = Date.now();
    return fallback;
  }

  if (CACHE.config && (Date.now() - CACHE.configTs) < CONFIG_CACHE_TTL_MS) return CACHE.config;

  const fallback = getCfgFromLocalStorage();
  try {
    const payload = await fetchJson(`/Plugins/StudioHubs/config?ts=${Date.now()}`);
    const cfg = payload?.config || {};

    const readCfg = (camelKey, pascalKey, fallbackValue) => {
      if (Object.prototype.hasOwnProperty.call(cfg, camelKey)) return cfg[camelKey];
      if (Object.prototype.hasOwnProperty.call(cfg, pascalKey)) return cfg[pascalKey];
      return fallbackValue;
    };

    const minRatingRaw = Number(readCfg("studioHubsMinRating", "StudioHubsMinRating", fallback.minRating));

    CACHE.config = {
      enablePlugin: readCfg("enablePlugin", "EnablePlugin", true) !== false,
      enableStudioHubs: readCfg("enableStudioHubs", "EnableStudioHubs", true) !== false,
      enabled: readCfg("enableStudioHubs", "EnableStudioHubs", true) !== false,
      minRating: Number.isFinite(minRatingRaw)
        ? minRatingRaw
        : fallback.minRating,
      hoverVideo: readCfg("studioHubsHoverVideo", "StudioHubsHoverVideo", fallback.hoverVideo) !== false,
      randomOrder: readCfg("studioHubsRandomOrder", "StudioHubsRandomOrder", fallback.randomOrder) === true,
      placeAfter: String(readCfg("studioHubsPlaceAfter", "StudioHubsPlaceAfter", fallback.placeAfter || "")).trim(),
      placeBefore: String(readCfg("studioHubsPlaceBefore", "StudioHubsPlaceBefore", fallback.placeBefore || "")).trim(),
      studioHubsStudioOrder: Array.isArray(readCfg("studioHubsStudioOrder", "StudioHubsStudioOrder", [])) ? readCfg("studioHubsStudioOrder", "StudioHubsStudioOrder", []) : [],
      studioHubsEnabledStudios: Array.isArray(readCfg("studioHubsEnabledStudios", "StudioHubsEnabledStudios", [])) ? readCfg("studioHubsEnabledStudios", "StudioHubsEnabledStudios", []) : [],
    };
    CACHE.configTs = Date.now();
    return CACHE.config;
  } catch {
    configFallbackUntil = Date.now() + CONFIG_RETRY_DELAY_MS;
    CACHE.config = fallback;
    CACHE.configTs = Date.now();
    return fallback;
  }
}

async function getHeaders(extra = {}) {
  let token = "";
  try {
    token =
      window.ApiClient?.accessToken?.() ||
      window.ApiClient?._accessToken ||
      window.ApiClient?._serverInfo?.AccessToken ||
      "";
  } catch {
    token = "";
  }

  let userId = String(window.ApiClient?._serverInfo?.UserId || "").trim();
  if (!userId) {
    userId = await getCurrentUserIdSafe();
  }

  const device = String(window.ApiClient?._deviceInfo?.name || "Browser").replace(/"/g, "");
  const deviceId = String(window.ApiClient?._deviceInfo?.id || window.ApiClient?._deviceId || "web").replace(/"/g, "");
  const version = String(window.ApiClient?._appVersion || "10.11.8").replace(/"/g, "");
  const client = String(window.ApiClient?._appName || "Jellyfin Web").replace(/"/g, "");
  const embyAuth = `MediaBrowser Client="${client}", Device="${device}", DeviceId="${deviceId}", Version="${version}", Token="${String(token || "").replace(/"/g, "")}"`;

  return {
    Accept: "application/json",
    ...(token ? { "X-Emby-Authorization": embyAuth } : {}),
    ...(token ? { "X-Emby-Token": token } : {}),
    ...(userId ? { "X-Emby-UserId": userId, "X-MediaBrowser-UserId": userId } : {}),
    ...extra,
  };
}

function withServer(url) {
  return url;
}

function getHomeContainer() {
  const candidates = Array.from(document.querySelectorAll("#indexPage, #homePage"));
  const page = candidates.find((p) => !p.classList.contains("hide") && p.offsetParent !== null) ||
    document.querySelector("#indexPage:not(.hide)") ||
    document.querySelector("#homePage:not(.hide)");
  if (!page) return null;
  return page.querySelector(".homeSectionsContainer") || page.querySelector(".itemsContainer") || null;
}

function normalizeSectionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSectionTitleText(sectionEl) {
  if (!sectionEl) return "";
  const titleEl =
    sectionEl.querySelector(".sectionTitle") ||
    sectionEl.querySelector("h1, h2, h3, h4") ||
    sectionEl.querySelector("[data-role='title']");
  return normalizeSectionText(titleEl?.textContent || "");
}

function parseKeywordList(rawValue, fallbackList) {
  const raw = String(rawValue || "").trim();
  const values = raw
    ? raw.split(",").map((v) => normalizeSectionText(v)).filter(Boolean)
    : fallbackList;
  return Array.from(new Set(values));
}

function getPlacementConfig() {
  const defaultAfter = ["continue watching"];
  const defaultBefore = ["recently added", "latest", "recent"];
  const configuredAfter = String(CACHE.config?.placeAfter || "").trim();
  const configuredBefore = String(CACHE.config?.placeBefore || "").trim();

  return {
    afterKeywords: parseKeywordList(configuredAfter || localStorage.getItem("studiohubs.placeAfter"), defaultAfter),
    beforeKeywords: parseKeywordList(configuredBefore || localStorage.getItem("studiohubs.placeBefore"), defaultBefore),
  };
}

function sectionTitleMatchesAnyKeyword(sectionEl, keywords) {
  const title = getSectionTitleText(sectionEl);
  if (!title) return false;
  return keywords.some((keyword) => keyword && title.includes(keyword));
}

function placeSection(root, section) {
  if (!root || !section) return;

  const children = Array.from(root.children).filter((el) => el !== section);
  const { afterKeywords, beforeKeywords } = getPlacementConfig();
  const afterTarget = children.find((el) => sectionTitleMatchesAnyKeyword(el, afterKeywords)) || null;
  const beforeTarget = children.find((el) => sectionTitleMatchesAnyKeyword(el, beforeKeywords)) || null;

  if (afterTarget && afterTarget.parentElement === root) {
    const next = afterTarget.nextElementSibling;
    if (next !== section) {
      root.insertBefore(section, next);
    }
    return;
  }

  if (beforeTarget && beforeTarget.parentElement === root && beforeTarget !== section) {
    root.insertBefore(section, beforeTarget);
    return;
  }

  const firstChild = root.firstElementChild;
  if (!firstChild) {
    if (section.parentElement !== root) {
      root.appendChild(section);
    }
    return;
  }

  if (firstChild !== section) {
    root.insertBefore(section, firstChild);
  }
}

function ensureSection(root) {
  let section = document.getElementById("studio-hubs");
  const hasRow = !!section?.querySelector(".studio-hubs-row, .hub-row, .itemsContainer.hub-row");
  const hasNativeScroller = !!section?.querySelector(".studio-hubs-native-scroller");

  if (!section || !hasRow || !hasNativeScroller) {
    if (!section) {
      section = document.createElement("div");
      section.id = "studio-hubs";
    }

    section.className = "homeSection";
    section.innerHTML = `
      <div class="sectionTitleContainer sectionTitleContainer-cards">
        <h2 class="sectionTitle sectionTitle-cards">Studio Collections</h2>
      </div>
      <div is="emby-scroller" class="studio-hubs-native-scroller padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">
        <div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x animatedScrollX studio-hubs-row" data-monitor="videoplayback,markplayed" role="list"></div>
      </div>
    `;
  }

  placeSection(root, section);
  return section;
}

function setupRowScroller(section, row) {
  if (!section) return;

  let activeRow = row || section.querySelector(".studio-hubs-row, .hub-row, .itemsContainer.hub-row");
  if (!activeRow) return;

  activeRow.classList.add("studio-hubs-row", "itemsContainer", "scrollSlider", "focuscontainer-x", "animatedScrollX");

  let nativeScroller = section.querySelector(".studio-hubs-native-scroller");
  if (!nativeScroller) {
    nativeScroller = document.createElement("div");
    nativeScroller.className = "studio-hubs-native-scroller padded-top-focusscale padded-bottom-focusscale";
    nativeScroller.setAttribute("is", "emby-scroller");
    nativeScroller.setAttribute("data-centerfocus", "true");

    const parent = activeRow.parentElement;
    if (parent) {
      parent.insertBefore(nativeScroller, activeRow);
      nativeScroller.appendChild(activeRow);
    } else {
      section.appendChild(nativeScroller);
      nativeScroller.appendChild(activeRow);
    }
  }

  if (activeRow.parentElement !== nativeScroller) {
    nativeScroller.appendChild(activeRow);
  }
}

async function fetchJsonViaApiClient(url) {
  const client = window.ApiClient;
  if (!client) throw new Error("ApiClient unavailable");

  if (typeof client.getJSON === "function") {
    return await client.getJSON(url);
  }

  if (typeof client.ajax === "function") {
    return await client.ajax({
      type: "GET",
      url,
      dataType: "json",
      cache: false,
    });
  }

  throw new Error("No supported ApiClient JSON method");
}

async function fetchJson(url) {
  try {
    return await fetchJsonViaApiClient(url);
  } catch {
    // fall back to manual request path for environments without ApiClient JSON helpers
  }

  const headers = await getHeaders();
  const token = String(headers["X-Emby-Token"] || "").trim();
  const requestUrl = token && !/[?&]api_key=/.test(url)
    ? `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(token)}`
    : url;

  const res = await fetch(withServer(requestUrl), {
    method: "GET",
    headers,
    cache: "no-store",
    credentials: "same-origin"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getCurrentUserIdSafe() {
  try {
    const user = await window.ApiClient?.getCurrentUser?.();
    if (user?.Id) return String(user.Id);
  } catch {
    // ignore and fallback below
  }

  const fromServerInfo = String(window.ApiClient?._serverInfo?.UserId || "").trim();
  if (fromServerInfo) return fromServerInfo;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      if (!/credential|server/i.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      const servers = Array.isArray(data?.Servers) ? data.Servers : [];
      const uid = String(servers.find((s) => s?.UserId)?.UserId || "").trim();
      if (uid) return uid;
    }
  } catch {
    // ignore
  }

  return "";
}

async function fetchManualEntries() {
  if (CACHE.manualEntries && (Date.now() - CACHE.manualEntriesTs) < PLUGIN_DATA_CACHE_TTL_MS) {
    return CACHE.manualEntries;
  }

  const payload = await fetchJson(`/Plugins/StudioHubs/studio-hubs/collection?ts=${Date.now()}`);
  CACHE.manualEntries = Array.isArray(payload?.entries) ? payload.entries : [];
  CACHE.manualEntriesTs = Date.now();
  return CACHE.manualEntries;
}

async function fetchVisibility() {
  if (CACHE.visibility && (Date.now() - CACHE.visibilityTs) < PLUGIN_DATA_CACHE_TTL_MS) {
    return CACHE.visibility;
  }

  if (Date.now() < visibilityFallbackUntil) {
    return CACHE.visibility || { hiddenNames: [], orderNames: [] };
  }

  const payload = await fetchJson(`/Plugins/StudioHubs/studio-hubs/visibility?profile=desktop&ts=${Date.now()}`);
  visibilityFallbackUntil = 0;
  CACHE.visibility = {
    hiddenNames: Array.isArray(payload?.hiddenNames) ? payload.hiddenNames : [],
    orderNames: Array.isArray(payload?.orderNames) ? payload.orderNames : [],
  };
  CACHE.visibilityTs = Date.now();
  return CACHE.visibility;
}

async function fetchVideoEntries() {
  if (CACHE.videoEntries && (Date.now() - CACHE.videoEntriesTs) < PLUGIN_DATA_CACHE_TTL_MS) {
    return CACHE.videoEntries;
  }

  const payload = await fetchJson(`/Plugins/StudioHubs/studio-hubs/video?ts=${Date.now()}`);
  CACHE.videoEntries = Array.isArray(payload?.entries) ? payload.entries : [];
  CACHE.videoEntriesTs = Date.now();
  return CACHE.videoEntries;
}

async function fetchStudios(userId) {
  if (CACHE.studios) {
    const ageMs = Date.now() - CACHE.ts;
    const ttlMs = CACHE.studios.length ? CACHE_TTL_MS : EMPTY_STUDIOS_RETRY_MS;
    if (ageMs < ttlMs) return CACHE.studios;
  }

  let items = [];
  try {
    const payload = await fetchJson(`/Studios?Limit=400&Recursive=true&SortBy=SortName&SortOrder=Ascending`);
    items = Array.isArray(payload?.Items) ? payload.Items : [];
  } catch {
    items = [];
  }

  // Fallback for servers/configs where /Studios can be empty or restricted.
  if (!items.length && userId) {
    try {
      const qs = new URLSearchParams({
        Recursive: "true",
        Limit: "300",
        IncludeItemTypes: "Movie,Series",
        Fields: "Studios"
      });
      const payload = await fetchJson(`/Users/${encodeURIComponent(userId)}/Items?${qs.toString()}`);
      const mediaItems = Array.isArray(payload?.Items) ? payload.Items : [];
      const map = new Map();

      for (const media of mediaItems) {
        for (const studio of media?.Studios || []) {
          const id = String(studio?.Id || "").trim();
          const name = String(studio?.Name || "").trim();
          if (!id || !name) continue;
          if (!map.has(id)) {
            map.set(id, { Id: id, Name: name });
          }
        }
      }

      items = Array.from(map.values());
    } catch {
      items = [];
    }
  }

  CACHE.studios = items;
  CACHE.ts = Date.now();
  return items;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeNameLoose(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[().,\-:_+]/g, " ")
    .replace(/\b(ltd|ltd\.|llc|inc|inc\.|company|co\.|corp|corp\.|the|pictures|studios|animation|film|films)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toCanonicalStudioName(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  return ALIAS_TO_CANONICAL.get(clean.toLowerCase()) || clean;
}

function buildStudioLookup(studios) {
  const byExact = new Map();
  const byLoose = new Map();

  for (const studio of studios || []) {
    const name = String(studio?.Name || "").trim();
    if (!name) continue;

    const exact = normalizeName(name);
    const loose = normalizeNameLoose(name);
    if (!byExact.has(exact)) byExact.set(exact, studio);
    if (loose && !byLoose.has(loose)) byLoose.set(loose, studio);

    const canonical = toCanonicalStudioName(name);
    const canonicalExact = normalizeName(canonical);
    const canonicalLoose = normalizeNameLoose(canonical);
    if (canonicalExact && !byExact.has(canonicalExact)) byExact.set(canonicalExact, studio);
    if (canonicalLoose && !byLoose.has(canonicalLoose)) byLoose.set(canonicalLoose, studio);
  }

  return { byExact, byLoose };
}

function resolveStudioByName(lookup, name) {
  const canonical = toCanonicalStudioName(name);
  const exact = normalizeName(canonical);
  const loose = normalizeNameLoose(canonical);
  return lookup.byExact.get(exact) || lookup.byLoose.get(loose) || null;
}

async function resolveStudioIdByName(name) {
  const canonical = toCanonicalStudioName(name);
  const key = normalizeName(canonical || name);
  if (!key) return "";

  if (STUDIO_ID_BY_NAME_CACHE.has(key)) {
    return STUDIO_ID_BY_NAME_CACHE.get(key) || "";
  }

  try {
    const searchTerm = String(canonical || name || "").trim();
    const qs = new URLSearchParams({
      Recursive: "true",
      Limit: "60",
      SortBy: "SortName",
      SortOrder: "Ascending",
      ...(searchTerm ? { SearchTerm: searchTerm } : {}),
    });

    const payload = await fetchJson(`/Studios?${qs.toString()}`);
    const items = Array.isArray(payload?.Items) ? payload.Items : [];
    const lookup = buildStudioLookup(items);
    const matched = resolveStudioByName(lookup, canonical || name);
    const id = String(matched?.Id || "").trim();
    STUDIO_ID_BY_NAME_CACHE.set(key, id);
    return id;
  } catch {
    STUDIO_ID_BY_NAME_CACHE.set(key, "");
    return "";
  }
}

function mergeOrder(orderFromVisibility, manualEntries, autoStudioNames) {
  const merged = [];
  const seen = new Set();
  const add = (name) => {
    const clean = toCanonicalStudioName(name);
    if (!clean) return;
    const key = normalizeName(clean);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(clean);
  };

  orderFromVisibility.forEach(add);
  manualEntries.map((e) => e?.name || e?.Name).forEach(add);
  DEFAULT_ORDER.forEach(add);
  autoStudioNames.forEach(add);
  return merged;
}

function buildLogoUrl(entry) {
  const fileName = String(entry?.logoFileName || entry?.LogoFileName || "").trim();
  if (!fileName) return null;
  const v = Number(entry?.updatedAtUtc || entry?.UpdatedAtUtc || Date.now());
  return withServer(`/Plugins/StudioHubs/studio-hubs/logo/${encodeURIComponent(fileName)}?v=${encodeURIComponent(v)}`);
}

function buildBundledLogoUrl(name) {
  const canonical = toCanonicalStudioName(name);
  const slug = STUDIO_LOGO_SLUGS[canonical] || STUDIO_LOGO_SLUGS[String(name || "").trim()] || "";
  if (!slug) return null;
  return withServer(`/studiohubs/studios/${encodeURIComponent(slug)}.webp`);
}

function hasBundledLogo(name) {
  const canonical = toCanonicalStudioName(name);
  const slug = STUDIO_LOGO_SLUGS[canonical] || STUDIO_LOGO_SLUGS[String(name || "").trim()] || "";
  return !!slug;
}

function buildStudioPrimaryImageUrl(studio) {
  const id = String(studio?.Id || "").trim();
  if (!id) return null;

  const primaryTag = String(studio?.ImageTags?.Primary || "").trim();
  const query = primaryTag
    ? `?tag=${encodeURIComponent(primaryTag)}`
    : "";

  return withServer(`/Items/${encodeURIComponent(id)}/Images/Primary${query}`);
}

function buildVideoUrl(entry) {
  const fileName = String(entry?.fileName || entry?.FileName || "").trim();
  if (!fileName) return null;
  const v = Number(entry?.updatedAtUtc || entry?.UpdatedAtUtc || Date.now());
  return withServer(`/Plugins/StudioHubs/studio-hubs/video/${encodeURIComponent(fileName)}?v=${encodeURIComponent(v)}`);
}

function buildBundledVideoUrl(name) {
  const canonical = toCanonicalStudioName(name);
  const slug = STUDIO_VIDEO_SLUGS[canonical] || STUDIO_VIDEO_SLUGS[String(name || "").trim()] || "";
  if (!slug) return null;
  return withServer(`/studiohubs/videos/${encodeURIComponent(slug)}.mp4`);
}

function pickBackdrop(item) {
  const tags = item?.BackdropImageTags || [];
  if (!tags.length) return null;
  return withServer(`/Items/${item.Id}/Images/Backdrop/0?tag=${encodeURIComponent(tags[0])}&quality=90`);
}

function buildStudioHref(studioId, name) {
  const serverId = window.ApiClient?._serverInfo?.Id || "";
  if (studioId) {
    return `#/list?studioId=${encodeURIComponent(studioId)}${serverId ? `&serverId=${encodeURIComponent(serverId)}` : ""}`;
  }
  return `#/search.html?query=${encodeURIComponent(name)}`;
}

async function fetchStudioItems(userId, studioId, minRating) {
  const qs = new URLSearchParams({
    StartIndex: "0",
    Limit: "80",
    Fields: "ImageTags,BackdropImageTags,CommunityRating,CriticRating",
    Recursive: "true",
    IncludeItemTypes: "Movie,Series",
    StudioIds: studioId,
    SortOrder: "Descending",
    MinCommunityRating: String(minRating),
  });

  const payload = await fetchJson(`/Users/${encodeURIComponent(userId)}/Items?${qs.toString()}`);
  return Array.isArray(payload?.Items) ? payload.Items : [];
}

function createCard(name, studioId, logoUrl, backdropUrl, videoUrl) {
  const a = document.createElement("a");
  a.className = "studio-hub-card";
  a.href = buildStudioHref(studioId, name);
  a.dataset.studioName = String(name || "");
  a.dataset.studioId = String(studioId || "");
  a.dataset.hrefSource = studioId ? "studioId" : "search";
  a.dataset.studioPending = studioId ? "0" : "1";
  a.setAttribute("aria-label", name);

  if (backdropUrl || logoUrl) {
    const img = document.createElement("img");
    img.className = logoUrl ? "studio-hub-img studio-hub-logo" : "studio-hub-img";
    img.src = logoUrl || backdropUrl;
    img.alt = name;
    a.appendChild(img);
  }

  if (videoUrl) {
    const video = document.createElement("video");
    video.className = "studio-hub-video";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.src = videoUrl;
    a.appendChild(video);

    a.addEventListener("mouseenter", () => {
      video.currentTime = 0;
      video.play().catch(() => {});
      video.classList.add("on");
    });
    a.addEventListener("mouseleave", () => {
      video.pause();
      video.classList.remove("on");
    });
  }

  return a;
}

async function resolvePendingCardLinks(row) {
  if (!row) return;

  const pendingCards = Array.from(row.querySelectorAll(".studio-hub-card[data-studio-pending='1']"));
  if (!pendingCards.length) return;

  const nameKeys = new Map();
  for (const card of pendingCards) {
    const rawName = String(card.dataset.studioName || card.getAttribute("aria-label") || "").trim();
    const key = normalizeName(rawName);
    if (!key) continue;
    if (!nameKeys.has(key)) nameKeys.set(key, rawName);
  }

  const resolvedByKey = new Map();
  await Promise.all(Array.from(nameKeys.entries()).map(async ([key, rawName]) => {
    const id = await resolveStudioIdByName(rawName).catch(() => "");
    resolvedByKey.set(key, String(id || "").trim());
  }));

  for (const card of pendingCards) {
    const rawName = String(card.dataset.studioName || card.getAttribute("aria-label") || "").trim();
    const key = normalizeName(rawName);
    const id = key ? (resolvedByKey.get(key) || "") : "";
    if (!id) continue;

    card.href = buildStudioHref(id, rawName);
    card.dataset.studioId = id;
    card.dataset.hrefSource = "studioId";
    card.dataset.studioPending = "0";
  }
}

function ensureEmptyState(row, message) {
  if (!row) return;
  const state = document.createElement("div");
  state.className = "studio-hubs-empty";
  state.textContent = message || "No studios available to display.";
  row.appendChild(state);
}

function ensureLoadingState(row) {
  if (!row) return;
  const hasCards = !!row.querySelector(".studio-hub-card");
  const hasState = !!row.querySelector(".studio-hubs-empty");
  if (hasCards || hasState) return;
  ensureEmptyState(row, "Loading studios...");
}

function isHomeVisible() {
  return !!document.querySelector("#indexPage:not(.hide), #homePage:not(.hide)");
}

function tickHomeVisitState() {
  const visible = isHomeVisible();
  if (visible && !homeVisibleLastTick) {
    homeVisitId += 1;
    randomOrderCache = { visitId: homeVisitId, key: "", order: [] };
  }
  homeVisibleLastTick = visible;
}

function shuffleArray(values) {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getVisitStableOrder(names, cfg) {
  if (!cfg?.randomOrder) {
    return names;
  }

  const key = JSON.stringify(names.map((n) => normalizeName(n)));
  if (
    randomOrderCache.visitId === homeVisitId &&
    randomOrderCache.key === key &&
    Array.isArray(randomOrderCache.order) &&
    randomOrderCache.order.length
  ) {
    return randomOrderCache.order.slice();
  }

  const shuffled = shuffleArray(names);
  randomOrderCache = {
    visitId: homeVisitId,
    key,
    order: shuffled.slice(),
  };
  return shuffled;
}

function buildRenderSignature(entries, cfg) {
  return JSON.stringify({
    hoverVideo: cfg?.hoverVideo !== false,
    minRating: Number(cfg?.minRating || 0),
    entries,
  });
}

async function renderStudioHubs(force = false) {
  tickHomeVisitState();
  if (busy) return;
  const now = Date.now();
  if (!force && (now - lastRenderAt) < MIN_RENDER_INTERVAL_MS) return;
  lastRenderAt = now;

  const root = getHomeContainer();
  if (!root) return;

  busy = true;
  try {
    const section = ensureSection(root);
    const row = section.querySelector(".studio-hubs-row");
    setupRowScroller(section, row);
    ensureLoadingState(row);

    const cfg = await getCfg();
    if (!cfg.enablePlugin || !cfg.enableStudioHubs || !cfg.enabled) {
      section.style.display = "none";
      return;
    }

    section.style.display = "";
    const renderDebug = [];

    const userId = await getCurrentUserIdSafe();

    const [manualEntries, videoEntries] = await Promise.all([
      fetchManualEntries().catch(() => []),
      fetchVideoEntries().catch(() => []),
    ]);

    // Use admin-configured studio order and visibility (global for all users)
    const adminStudioOrder = Array.isArray(cfg.studioHubsStudioOrder) && cfg.studioHubsStudioOrder.length > 0
      ? cfg.studioHubsStudioOrder
      : DEFAULT_ORDER;
    const adminEnabledStudios = Array.isArray(cfg.studioHubsEnabledStudios) && cfg.studioHubsEnabledStudios.length > 0
      ? cfg.studioHubsEnabledStudios
      : null;

    // Build the final studio order
    let mergedOrder = getVisitStableOrder(adminStudioOrder, cfg);
    
    // If no specific studios enabled, show all in order; otherwise filter to enabled only
    if (adminEnabledStudios) {
      const enabledSet = new Set(adminEnabledStudios.map(normalizeName));
      mergedOrder = mergedOrder.filter((name) => enabledSet.has(normalizeName(name)));
    }

    // Only render studios that have an explicit image source (manual logo or bundled logo mapping).
    mergedOrder = mergedOrder.filter((name) => {
      const manual = manualEntries.find((e) => normalizeName(e?.name || e?.Name) === normalizeName(name));
      const hasManualLogo = !!String(manual?.logoFileName || manual?.LogoFileName || "").trim();
      return hasManualLogo || hasBundledLogo(name);
    });

    const cardModels = [];

    for (const name of mergedOrder) {
      const manual = manualEntries.find((e) => normalizeName(e?.name || e?.Name) === normalizeName(name));
      const manualStudioId = String(manual?.studioId || manual?.StudioId || "").trim();
      let studioId = manualStudioId;
      let idSource = manualStudioId ? "manual" : "none";

      const displayName = String(manual?.name || manual?.Name || name).trim();

      if (!studioId) {
        idSource = "pending";
      }

      const logoUrl = buildLogoUrl(manual) || buildBundledLogoUrl(displayName || name);
      const videoEntry = videoEntries.find((e) => normalizeName(e?.name || e?.Name) === normalizeName(name));
      const videoUrl = cfg.hoverVideo ? (buildVideoUrl(videoEntry) || buildBundledVideoUrl(displayName || name)) : null;

      let backdropUrl = null;
      if (!logoUrl && userId && studioId) {
        const items = await fetchStudioItems(userId, studioId, cfg.minRating).catch(() => []);
        backdropUrl = pickBackdrop(items.find((i) => Array.isArray(i?.BackdropImageTags) && i.BackdropImageTags.length));
      }

      cardModels.push({
        displayName: displayName || name,
        studioId,
        logoUrl,
        backdropUrl,
        videoUrl,
      });
      renderDebug.push({
        inputName: String(name || ""),
        displayName: String(displayName || ""),
        manualStudioId,
        resolvedStudioId: String(studioId || ""),
        idSource,
        href: buildStudioHref(studioId, displayName || name),
      });
    }

    const signature = buildRenderSignature(renderDebug, cfg);
    const hasExistingRowContent = !!row.querySelector(".studio-hub-card, .studio-hubs-empty");
    if (signature === lastRenderSignature && hasExistingRowContent) {
      DEBUG_STATE.lastRender = renderDebug;
      DEBUG_STATE.lastAt = Date.now();
      section.style.display = "";
      return;
    }

    lastRenderSignature = signature;
    row.innerHTML = "";

    for (const cardModel of cardModels) {
      row.appendChild(createCard(
        cardModel.displayName,
        cardModel.studioId,
        cardModel.logoUrl,
        cardModel.backdropUrl,
        cardModel.videoUrl,
      ));
    }

    // Resolve unknown studio IDs after first paint so Home does not wait on many /Studios lookups.
    void resolvePendingCardLinks(row);
    setupRowScroller(section, row);

    DEBUG_STATE.lastRender = renderDebug;
    DEBUG_STATE.lastAt = Date.now();

    if (!row.children.length) {
      ensureEmptyState(row, "No studio cards could be generated from current data.");
      setupRowScroller(section, row);
      setTimeout(scheduleRender, NO_CARDS_RETRY_DELAY_MS);
    }

    section.style.display = "";
  } finally {
    busy = false;
  }
}

function scheduleRender(options = {}) {
  const force = options.force === true;
  const delayMs = Number.isFinite(options.delayMs)
    ? Math.max(0, Number(options.delayMs))
    : (force ? FAST_RENDER_DELAY_MS : DEFAULT_RENDER_DELAY_MS);

  tickHomeVisitState();

  if (options.prepaint !== false && isHomeVisible()) {
    const root = getHomeContainer();
    if (root) {
      const section = ensureSection(root);
      const row = section.querySelector(".studio-hubs-row");
      setupRowScroller(section, row);
      ensureLoadingState(row);
      section.style.display = "";
    }
  }

  if (scheduleTimer) clearTimeout(scheduleTimer);
  scheduleTimer = setTimeout(() => {
    scheduleTimer = null;
    void renderStudioHubs(force);
  }, delayMs);
}

function installLifecycleHooks() {
  const onNav = () => scheduleRender({ force: true, delayMs: FAST_RENDER_DELAY_MS });

  // Jellyfin Web can navigate without a hard reload or hash change.
  window.addEventListener("hashchange", onNav, { passive: true });
  window.addEventListener("popstate", onNav, { passive: true });
  window.addEventListener("pageshow", onNav, { passive: true });
  window.addEventListener("focus", onNav, { passive: true });
  document.addEventListener("viewshow", onNav, { passive: true });
  document.addEventListener("viewbeforeshow", onNav, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) onNav();
  }, { passive: true });

  // If Home DOM is rebuilt and our section gets dropped, add it back.
  const observer = new MutationObserver(() => {
    if (!isHomeVisible()) return;
    if (!document.getElementById("studio-hubs")) {
      onNav();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function boot() {
  if (window[BOOT_GUARD_KEY]) return;
  window[BOOT_GUARD_KEY] = true;

  window.__studioHubsDebug = {
    dump() {
      return JSON.parse(JSON.stringify(DEBUG_STATE.lastRender || []));
    },
    unresolved() {
      return (DEBUG_STATE.lastRender || []).filter((x) => !String(x?.resolvedStudioId || "").trim());
    },
    cards() {
      return Array.from(document.querySelectorAll("#studio-hubs .studio-hub-card")).map((el) => ({
        title: String(el.getAttribute("aria-label") || ""),
        studioId: String(el.dataset.studioId || ""),
        hrefSource: String(el.dataset.hrefSource || ""),
        href: String(el.getAttribute("href") || ""),
      }));
    },
    async resolve(name) {
      const id = await resolveStudioIdByName(name);
      return {
        name: String(name || ""),
        resolvedStudioId: String(id || ""),
      };
    },
    lastAt() {
      return DEBUG_STATE.lastAt || 0;
    },
  };

  ensureCss();
  scheduleRender({ force: true, delayMs: 0 });
  installLifecycleHooks();
  window.addEventListener("jms:studio-hubs-visibility-updated", scheduleRender, { passive: true });
}

boot();
