const DEFAULT_ORDER = [
  "Netflix",
  "Disney+",
  "Apple TV+",
  "DC",
  "Marvel Studios",
  "Pixar",
  "Walt Disney Pictures",
  "Warner Bros. Pictures",
  "Lucasfilm Ltd.",
  "Columbia Pictures",
  "Paramount Pictures",
  "MGM Studios",
  "Sony Pictures",
  "DreamWorks Animation",
  "Lionsgate",
  "Amazon Prime",
  "Fox"
];

const STUDIO_ALIASES = {
  "marvel studios": ["marvel", "marvel entertainment", "marvel studios llc"],
  "pixar": ["pixar animation studios", "disney pixar"],
  "walt disney pictures": ["walt disney pictures", "walt disney animation studios", "walt disney studios motion pictures"],
  "disney+": ["disney plus", "disney+ originals", "disney plus originals"],
  "apple tv+": ["apple tv", "apple tv plus", "apple original", "apple originals", "apple tv+ originals", "apple studios"],
  "dc": ["dc entertainment", "dc studios"],
  "fox": ["20th century fox", "20th century studios", "twentieth century fox", "twentieth century studios", "fox searchlight pictures", "searchlight pictures", "20th Century Fox"],
  "warner bros. pictures": ["warner bros", "warner bros.", "warner brothers"],
  "lucasfilm ltd.": ["lucasfilm", "lucasfilm ltd"],
  "columbia pictures": ["columbia", "columbia pictures industries"],
  "paramount pictures": ["paramount", "paramount pictures corporation"],
  "mgm studios": ["mgm", "metro goldwyn mayer", "metro-goldwyn-mayer", "metro-goldwyn-mayer studios", "amazon mgm studios"],
  "sony pictures": ["sony", "sony pictures entertainment", "sony pictures classics", "sony pictures animation", "sony pictures television"],
  "dreamworks animation": ["dreamworks", "dreamworks pictures"],
  "amazon prime": ["amazon studios", "prime video", "amazon prime video", "amazon mgm studios"],
  "lionsgate": ["lions gate", "lions gate entertainment", "lions gate entertainment corp", "lions gate films"]
};

const STUDIO_VIDEO_SLUGS = {
  "Marvel Studios": "marvel-studios",
  "Pixar": "pixar",
  "Walt Disney Pictures": "walt-disney-pictures",
  "Disney+": "disney",
  "Apple TV+": "apple-tv-plus",
  "DC": "dc",
  "Fox": "fox",
  "Warner Bros. Pictures": "warner-bros-pictures",
  "Lucasfilm Ltd.": "lucasfilm-ltd",
  "Columbia Pictures": "columbia-pictures",
  "Paramount Pictures": "paramount-pictures",
  "MGM Studios": "metro-goldwyn-mayer",
  "Sony Pictures": "sony",
  "Netflix": "netflix",
  "DreamWorks Animation": "dreamworks-animation",
  "Lionsgate": "lionsgate",
  "Amazon Prime": "prime",
  "Universal": "universal"
};

const STUDIO_LOGO_SLUGS = {
  "Marvel Studios": "marvel-studios",
  "Pixar": "pixar",
  "Walt Disney Pictures": "walt-disney-pictures",
  "Disney+": "disney",
  "Apple TV+": "apple-tv-plus",
  "DC": "dc",
  "Fox": "fox",
  "Warner Bros. Pictures": "warner-bros-pictures",
  "Lucasfilm Ltd.": "lucasfilm-ltd",
  "Columbia Pictures": "columbia-pictures",
  "Paramount Pictures": "paramount-pictures",
  "MGM Studios": "metro-goldwyn-mayer",
  "Sony Pictures": "sony",
  "Netflix": "netflix",
  "DreamWorks Animation": "dreamworks-animation",
  "Lionsgate": "lionsgate",
  "Amazon Prime": "prime",
  "Universal": "universal"
};

const STUDIO_LOGO_EXTENSIONS = {
  Fox: "png",
  "Apple TV+": "png",
  "MGM Studios": "png",
  "Sony Pictures": "png",
  "Lionsgate": "webp",
  "Amazon Prime": "png"
};

const CANONICAL_DISPLAY_BY_KEY = (() => {
  const map = new Map();
  const add = (name) => {
    const key = String(name || "").trim().toLowerCase();
    if (!key || map.has(key)) return;
    map.set(key, String(name || "").trim());
  };

  Object.keys(STUDIO_LOGO_SLUGS).forEach(add);
  Object.keys(STUDIO_VIDEO_SLUGS).forEach(add);
  DEFAULT_ORDER.forEach(add);
  return map;
})();

const ALIAS_TO_CANONICAL = (() => {
  const map = new Map();
  for (const [canonical, aliases] of Object.entries(STUDIO_ALIASES)) {
    const canonicalKey = String(canonical || "").trim().toLowerCase();
    const canonicalDisplay = CANONICAL_DISPLAY_BY_KEY.get(canonicalKey) || canonical;
    map.set(canonicalKey, canonicalDisplay);
    for (const alias of aliases || []) {
      map.set(String(alias || "").trim().toLowerCase(), canonicalDisplay);
    }
  }
  return map;
})();

const ALIAS_TO_CANONICAL_LOOSE = (() => {
  const map = new Map();
  for (const [canonical, aliases] of Object.entries(STUDIO_ALIASES)) {
    const canonicalKey = String(canonical || "").trim().toLowerCase();
    const canonicalDisplay = CANONICAL_DISPLAY_BY_KEY.get(canonicalKey) || canonical;

    const canonicalLoose = normalizeNameLoose(canonical);
    if (canonicalLoose && !map.has(canonicalLoose)) {
      map.set(canonicalLoose, canonicalDisplay);
    }

    for (const alias of aliases || []) {
      const aliasLoose = normalizeNameLoose(alias);
      if (aliasLoose && !map.has(aliasLoose)) {
        map.set(aliasLoose, canonicalDisplay);
      }
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
const STUDIO_IDS_BY_NAME_CACHE = new Map();
const STUDIO_MEDIA_COUNTS_CACHE = new Map();
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
const STUDIO_MODAL_LIMIT = 48;
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
  const hoverVideo = localStorage.getItem("studiohubs.hoverVideo");
  const randomOrder = localStorage.getItem("studiohubs.randomOrder");
  const placeAfter = String(localStorage.getItem("studiohubs.placeAfter") || "").trim();
  const placeBefore = String(localStorage.getItem("studiohubs.placeBefore") || "").trim();

  return {
    enablePlugin: true,
    enableStudioHubs: enabled == null ? true : enabled !== "false",
    enabled: enabled == null ? true : enabled !== "false",
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

    CACHE.config = {
      enablePlugin: readCfg("enablePlugin", "EnablePlugin", true) !== false,
      enableStudioHubs: readCfg("enableStudioHubs", "EnableStudioHubs", true) !== false,
      enabled: readCfg("enableStudioHubs", "EnableStudioHubs", true) !== false,
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
  } catch (err) {
    console.error("[StudioHubs] fetchJsonViaApiClient failed:", err, url);
    // fall back to manual request path for environments without ApiClient JSON helpers
  }

  const headers = await getHeaders();
  const token = String(headers["X-Emby-Token"] || "").trim();
  const requestUrl = token && !/[?&]api_key=/.test(url)
    ? `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(token)}`
    : url;

  try {
    const res = await fetch(withServer(requestUrl), {
      method: "GET",
      headers,
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("[StudioHubs] fetchJson failed:", err, requestUrl);
    throw err;
  }
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
  const raw = String(name || "").trim();
  if (!raw) return "";

  const exactKey = raw.toLowerCase();
  const exact = ALIAS_TO_CANONICAL.get(exactKey);
  if (exact) return exact;

  const looseKey = normalizeNameLoose(raw);
  const loose = ALIAS_TO_CANONICAL_LOOSE.get(looseKey);
  if (loose) return loose;

  return CANONICAL_DISPLAY_BY_KEY.get(exactKey) || raw;
}

function getStudioMapValue(map, name) {
  const raw = String(name || "").trim();
  if (!raw) return "";

  if (Object.prototype.hasOwnProperty.call(map, raw)) {
    return map[raw];
  }

  const lower = raw.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (String(key).toLowerCase() === lower) {
      return value;
    }
  }

  return "";
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

function scoreStudioCandidateName(studioName, targetName) {
  const studioRaw = String(studioName || "").trim();
  const targetCanonical = toCanonicalStudioName(targetName);

  const studioExact = normalizeName(studioRaw);
  const targetExact = normalizeName(targetCanonical || targetName);
  const studioCanonicalExact = normalizeName(toCanonicalStudioName(studioRaw));

  const studioLoose = normalizeNameLoose(studioRaw);
  const targetLoose = normalizeNameLoose(targetCanonical || targetName);

  let score = 0;
  if (studioExact && studioExact === targetExact) score += 10;
  if (studioCanonicalExact && studioCanonicalExact === targetExact) score += 8;
  if (studioLoose && studioLoose === targetLoose) score += 5;
  if (targetExact && studioExact.includes(targetExact)) score += 2;
  return score;
}

async function fetchStudioTypeCount(userId, studioId, includeItemTypes) {
  const cacheKey = `${String(userId || "").trim()}:${String(studioId || "").trim()}:${includeItemTypes}`;
  if (STUDIO_MEDIA_COUNTS_CACHE.has(cacheKey)) {
    return Number(STUDIO_MEDIA_COUNTS_CACHE.get(cacheKey) || 0);
  }

  try {
    const qs = new URLSearchParams({
      Recursive: "true",
      Limit: "1",
      IncludeItemTypes: includeItemTypes,
      StudioIds: String(studioId || "").trim(),
    });

    const payload = await fetchJson(`/Users/${encodeURIComponent(userId)}/Items?${qs.toString()}`);
    const count = Number(payload?.TotalRecordCount || 0);
    STUDIO_MEDIA_COUNTS_CACHE.set(cacheKey, count);
    return count;
  } catch {
    STUDIO_MEDIA_COUNTS_CACHE.set(cacheKey, 0);
    return 0;
  }
}

function getStudioSearchTerms(name) {
  const canonical = toCanonicalStudioName(name);
  const canonicalKey = normalizeName(canonical);
  const aliases = Array.isArray(STUDIO_ALIASES[canonicalKey]) ? STUDIO_ALIASES[canonicalKey] : [];

  const out = [];
  const seen = new Set();
  const add = (term) => {
    const clean = String(term || "").trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };

  add(canonical);
  add(name);
  aliases.forEach(add);
  return out.slice(0, 8);
}

async function resolveStudioIdByName(name) {
  const resolved = await resolveStudioIdsByName(name);
  return resolved?.primaryId || "";
}

async function resolveStudioIdsByName(name) {
  const canonical = toCanonicalStudioName(name);
  const key = normalizeName(canonical || name);
  if (!key) return { primaryId: "", studioIds: [] };

  if (STUDIO_IDS_BY_NAME_CACHE.has(key)) {
    const cachedIds = Array.isArray(STUDIO_IDS_BY_NAME_CACHE.get(key))
      ? STUDIO_IDS_BY_NAME_CACHE.get(key)
      : [];
    const primaryId = String(cachedIds[0] || STUDIO_ID_BY_NAME_CACHE.get(key) || "").trim();
    return {
      primaryId,
      studioIds: cachedIds.filter(Boolean),
    };
  }

  if (STUDIO_ID_BY_NAME_CACHE.has(key)) {
    const cachedPrimary = String(STUDIO_ID_BY_NAME_CACHE.get(key) || "").trim();
    return {
      primaryId: cachedPrimary,
      studioIds: cachedPrimary ? [cachedPrimary] : [],
    };
  }

  try {
    const terms = getStudioSearchTerms(canonical || name);
    const payloads = await Promise.all(terms.map(async (searchTerm) => {
      const qs = new URLSearchParams({
        Recursive: "true",
        Limit: "60",
        SortBy: "SortName",
        SortOrder: "Ascending",
        ...(searchTerm ? { SearchTerm: searchTerm } : {}),
      });
      return fetchJson(`/Studios?${qs.toString()}`).catch(() => ({ Items: [] }));
    }));

    const allItems = [];
    const seenStudioIds = new Set();
    for (const payload of payloads) {
      for (const item of Array.isArray(payload?.Items) ? payload.Items : []) {
        const id = String(item?.Id || "").trim();
        const studioName = String(item?.Name || "").trim();
        if (!id || !studioName || seenStudioIds.has(id)) continue;
        seenStudioIds.add(id);
        allItems.push(item);
      }
    }

    // Some servers return sparse/empty results from /Studios for valid names.
    // Fall back to scanning user media and extracting referenced studio IDs.
    if (!allItems.length) {
      const fallbackUserId = await getCurrentUserIdSafe().catch(() => "");
      if (fallbackUserId) {
        const mediaPayloads = await Promise.all(terms.map(async (searchTerm) => {
          const qs = new URLSearchParams({
            Recursive: "true",
            Limit: "300",
            IncludeItemTypes: "Movie,Series",
            Fields: "Studios",
            ...(searchTerm ? { SearchTerm: searchTerm } : {}),
          });

          return fetchJson(`/Users/${encodeURIComponent(fallbackUserId)}/Items?${qs.toString()}`)
            .catch(() => ({ Items: [] }));
        }));

        for (const payload of mediaPayloads) {
          for (const media of Array.isArray(payload?.Items) ? payload.Items : []) {
            for (const studio of Array.isArray(media?.Studios) ? media.Studios : []) {
              const id = String(studio?.Id || "").trim();
              const studioName = String(studio?.Name || "").trim();
              if (!id || !studioName || seenStudioIds.has(id)) continue;
              seenStudioIds.add(id);
              allItems.push({ Id: id, Name: studioName });
            }
          }
        }
      }
    }

    if (!allItems.length) {
      STUDIO_ID_BY_NAME_CACHE.set(key, "");
      STUDIO_IDS_BY_NAME_CACHE.set(key, []);
      return { primaryId: "", studioIds: [] };
    }

    const scored = allItems
      .map((studio) => ({
        studio,
        score: scoreStudioCandidateName(studio?.Name, canonical || name),
      }))
      .sort((a, b) => b.score - a.score);

    const strongest = scored[0]?.score || 0;
    const candidates = scored
      .filter((entry) => entry.score >= Math.max(0, strongest - 3))
      .slice(0, 8);

    let chosen = candidates[0]?.studio || null;
    let chosenScore = Number(candidates[0]?.score || 0);
    let approvedIds = [];
    const userIdForCounts = await getCurrentUserIdSafe().catch(() => "");
    if (userIdForCounts && candidates.length > 1) {
      const enriched = await Promise.all(candidates.map(async ({ studio, score }) => {
        const id = String(studio?.Id || "").trim();
        const movieCount = id ? await fetchStudioTypeCount(userIdForCounts, id, "Movie") : 0;
        const seriesCount = id ? await fetchStudioTypeCount(userIdForCounts, id, "Series") : 0;
        return {
          studio,
          score,
          movieCount,
          seriesCount,
        };
      }));

      enriched.sort((a, b) => {
        if (b.movieCount !== a.movieCount) return b.movieCount - a.movieCount;
        if (b.score !== a.score) return b.score - a.score;
        if (b.seriesCount !== a.seriesCount) return b.seriesCount - a.seriesCount;
        return String(a.studio?.Name || "").localeCompare(String(b.studio?.Name || ""));
      });

      const primary = enriched[0] || null;
      chosen = primary?.studio || chosen;
      chosenScore = Number(primary?.score || chosenScore || 0);

      let coveredMovies = Number(primary?.movieCount || 0) > 0;
      let coveredSeries = Number(primary?.seriesCount || 0) > 0;

      if (primary?.studio?.Id) {
        approvedIds.push(String(primary.studio.Id).trim());
      }

      for (const candidate of enriched.slice(1)) {
        const candidateId = String(candidate?.studio?.Id || "").trim();
        if (!candidateId || approvedIds.includes(candidateId)) continue;

        const confidenceGate = Number(candidate?.score || 0) >= Math.max(6, chosenScore - 1);
        if (!confidenceGate) continue;

        const hasMovies = Number(candidate?.movieCount || 0) > 0;
        const hasSeries = Number(candidate?.seriesCount || 0) > 0;
        if (!hasMovies && !hasSeries) continue;

        const addsMissingType = (!coveredMovies && hasMovies) || (!coveredSeries && hasSeries);
        const salvageCase = !coveredMovies && !coveredSeries;
        if (!addsMissingType && !salvageCase) continue;

        approvedIds.push(candidateId);
        coveredMovies = coveredMovies || hasMovies;
        coveredSeries = coveredSeries || hasSeries;

        if (coveredMovies && coveredSeries) break;
      }

      if (!approvedIds.length) {
        const fallbackPrimaryId = String(primary?.studio?.Id || "").trim();
        if (fallbackPrimaryId) approvedIds = [fallbackPrimaryId];
      }
    }

    const lookup = buildStudioLookup(allItems);
    const fallback = resolveStudioByName(lookup, canonical || name);
    const id = String(chosen?.Id || fallback?.Id || "").trim();

    if (!approvedIds.length && id) {
      approvedIds = [id];
    }

    const uniqueApprovedIds = Array.from(new Set(approvedIds.filter(Boolean))).slice(0, 4);
    STUDIO_ID_BY_NAME_CACHE.set(key, id);
    STUDIO_IDS_BY_NAME_CACHE.set(key, uniqueApprovedIds);
    return {
      primaryId: id,
      studioIds: uniqueApprovedIds,
    };
  } catch {
    STUDIO_ID_BY_NAME_CACHE.set(key, "");
    STUDIO_IDS_BY_NAME_CACHE.set(key, []);
    return { primaryId: "", studioIds: [] };
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
  const slug = getStudioMapValue(STUDIO_LOGO_SLUGS, canonical) || getStudioMapValue(STUDIO_LOGO_SLUGS, name);
  if (!slug) return null;
  const resolveMappedExtension = (studioName) => {
    const rawName = String(studioName || "").trim();
    if (!rawName) return null;

    if (Object.prototype.hasOwnProperty.call(STUDIO_LOGO_EXTENSIONS, rawName)) {
      return STUDIO_LOGO_EXTENSIONS[rawName];
    }

    const lower = rawName.toLowerCase();
    for (const [key, value] of Object.entries(STUDIO_LOGO_EXTENSIONS)) {
      if (String(key).toLowerCase() === lower) {
        return value;
      }
    }

    return null;
  };

  const extension = resolveMappedExtension(canonical) ?? resolveMappedExtension(name) ?? "webp";

  if (extension === "") {
    return withServer(`/studiohubs/studios/${encodeURIComponent(slug)}`);
  }

  return withServer(`/studiohubs/studios/${encodeURIComponent(slug)}.${encodeURIComponent(extension || "webp")}`);
}

function hasBundledLogo(name) {
  const canonical = toCanonicalStudioName(name);
  const slug = getStudioMapValue(STUDIO_LOGO_SLUGS, canonical) || getStudioMapValue(STUDIO_LOGO_SLUGS, name);
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
  const slug = getStudioMapValue(STUDIO_VIDEO_SLUGS, canonical) || getStudioMapValue(STUDIO_VIDEO_SLUGS, name);
  if (!slug) return null;
  return withServer(`/studiohubs/videos/${encodeURIComponent(slug)}.mp4`);
}

function pickBackdrop(item) {
  const tags = item?.BackdropImageTags || [];
  if (!tags.length) return null;
  return withServer(`/Items/${item.Id}/Images/Backdrop/0?tag=${encodeURIComponent(tags[0])}&quality=90`);
}

function buildStudioHref(studioId, name, studioIds = []) {
  const serverId = window.ApiClient?._serverInfo?.Id || "";
  const ids = Array.from(new Set(
    (Array.isArray(studioIds) ? studioIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  ));

  const appendCommonListParams = (qs) => {
    qs.set("includeItemTypes", "Movie,Series");
    qs.set("recursive", "true");
    return qs;
  };

  if (studioId && !ids.includes(studioId)) {
    ids.unshift(studioId);
  }

  if (ids.length > 1) {
    const qs = appendCommonListParams(new URLSearchParams());
    qs.set("studioId", ids[0]);
    qs.set("studioIds", ids.join(","));
    if (serverId) qs.set("serverId", String(serverId));
    return `#/list?${qs.toString()}`;
  }

  if (studioId || ids.length === 1) {
    const selectedId = String(studioId || ids[0] || "").trim();
    const qs = appendCommonListParams(new URLSearchParams());
    qs.set("studioId", selectedId);
    if (serverId) qs.set("serverId", String(serverId));
    return `#/list?${qs.toString()}`;
  }
  return `#/search.html?query=${encodeURIComponent(name)}`;
}

async function fetchStudioItems(userId, studioId) {
  const qs = new URLSearchParams({
    StartIndex: "0",
    Limit: "80",
    Fields: "ImageTags,BackdropImageTags,CommunityRating,CriticRating",
    Recursive: "true",
    IncludeItemTypes: "Movie,Series",
    StudioIds: studioId,
    SortOrder: "Descending",
  });

  const payload = await fetchJson(`/Users/${encodeURIComponent(userId)}/Items?${qs.toString()}`);
  return Array.isArray(payload?.Items) ? payload.Items : [];
}

function getStudioModalElements() {
  let root = document.getElementById("studio-hubs-modal");
  if (!root) {
    root = document.createElement("div");
    root.id = "studio-hubs-modal";
    root.className = "studio-hubs-modal";
    root.innerHTML = `
      <div class="studio-hubs-modal__backdrop" data-close="1"></div>
      <div class="studio-hubs-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="studio-hubs-modal-title">
        <button type="button" class="studio-hubs-modal__close" aria-label="Close">Close</button>
        <div class="studio-hubs-modal__header">
          <h2 id="studio-hubs-modal-title" class="studio-hubs-modal__title">Studio</h2>
        </div>
        <div class="studio-hubs-modal__body">
          <section class="studio-hubs-modal__section">
            <h3 class="studio-hubs-modal__section-title">Movies</h3>
            <div class="studio-hubs-modal__grid" data-section="movies"></div>
          </section>
          <section class="studio-hubs-modal__section">
            <h3 class="studio-hubs-modal__section-title">TV Shows</h3>
            <div class="studio-hubs-modal__grid" data-section="series"></div>
          </section>
        </div>
      </div>
    `;

    const close = () => {
      root.classList.remove("is-open");
      document.body.classList.remove("studio-hubs-modal-open");
    };

    root.querySelector(".studio-hubs-modal__backdrop")?.addEventListener("click", close);
    root.querySelector(".studio-hubs-modal__close")?.addEventListener("click", close);
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && root.classList.contains("is-open")) {
        close();
      }
    });

    document.body.appendChild(root);
  }

  return {
    root,
    title: root.querySelector("#studio-hubs-modal-title"),
    moviesGrid: root.querySelector('[data-section="movies"]'),
    seriesGrid: root.querySelector('[data-section="series"]'),
  };
}

function closeStudioSectionsModal() {
  const root = document.getElementById("studio-hubs-modal");
  if (!root) return;
  root.classList.remove("is-open");
  document.body.classList.remove("studio-hubs-modal-open");
}

function buildStudioModalItemHref(itemId) {
  const id = String(itemId || "").trim();
  if (!id) return "#/";
  const serverId = String(window.ApiClient?._serverInfo?.Id || "").trim();
  const qs = new URLSearchParams({ id });
  if (serverId) qs.set("serverId", serverId);
  return `#/details?${qs.toString()}`;
}

function buildStudioModalItemImage(item) {
  const id = String(item?.Id || "").trim();
  if (!id) return "";

  const primaryTag = String(item?.ImageTags?.Primary || "").trim();
  if (!primaryTag) return "";

  const qs = new URLSearchParams({
    tag: primaryTag,
    fillWidth: "360",
    fillHeight: "540",
    quality: "90",
  });

  return withServer(`/Items/${encodeURIComponent(id)}/Images/Primary?${qs.toString()}`);
}

async function fetchStudioItemsByTypes(userId, studioIds, includeItemTypes) {
  const ids = Array.from(new Set((studioIds || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (!userId || !ids.length) return [];

  const qs = new URLSearchParams({
    StartIndex: "0",
    Limit: String(STUDIO_MODAL_LIMIT),
    Recursive: "true",
    IncludeItemTypes: includeItemTypes,
    SortBy: "DateCreated,SortName",
    SortOrder: "Descending",
    Fields: "ImageTags,PrimaryImageAspectRatio,ProductionYear,CommunityRating",
    StudioIds: ids.join(","),
  });

  const payload = await fetchJson(`/Users/${encodeURIComponent(userId)}/Items?${qs.toString()}`);
  return Array.isArray(payload?.Items) ? payload.Items : [];
}

function renderStudioModalGrid(gridEl, items, emptyText) {
  if (!gridEl) return;
  gridEl.innerHTML = "";

  if (!Array.isArray(items) || !items.length) {
    const empty = document.createElement("div");
    empty.className = "studio-hubs-modal__empty";
    empty.textContent = emptyText;
    gridEl.appendChild(empty);
    return;
  }

  for (const item of items) {
    const id = String(item?.Id || "").trim();
    const name = String(item?.Name || "Untitled").trim() || "Untitled";

    const card = document.createElement("a");
    card.className = "studio-hubs-modal__item";
    card.href = buildStudioModalItemHref(id);
    card.setAttribute("aria-label", name);
    card.addEventListener("click", () => {
      closeStudioSectionsModal();
    });

    const imageUrl = buildStudioModalItemImage(item);
    if (imageUrl) {
      const img = document.createElement("img");
      img.className = "studio-hubs-modal__item-image";
      img.src = imageUrl;
      img.alt = name;
      card.appendChild(img);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "studio-hubs-modal__item-fallback";
      fallback.textContent = name;
      card.appendChild(fallback);
    }

    const label = document.createElement("div");
    label.className = "studio-hubs-modal__item-title";
    label.textContent = name;
    card.appendChild(label);

    gridEl.appendChild(card);
  }
}

async function openStudioSectionsModal(name, studioId, studioIds = []) {
  const modal = getStudioModalElements();
  if (!modal?.root || !modal.moviesGrid || !modal.seriesGrid) return;

  const title = String(name || "Studio").trim() || "Studio";
  if (modal.title) {
    modal.title.textContent = title;
  }

  modal.moviesGrid.innerHTML = '<div class="studio-hubs-modal__empty">Loading movies...</div>';
  modal.seriesGrid.innerHTML = '<div class="studio-hubs-modal__empty">Loading TV shows...</div>';
  modal.root.classList.add("is-open");
  document.body.classList.add("studio-hubs-modal-open");

  const seedIds = Array.from(new Set([
    String(studioId || "").trim(),
    ...(Array.isArray(studioIds) ? studioIds : []).map((x) => String(x || "").trim()),
  ].filter(Boolean)));

  // Always merge name-resolved aliases so split studio IDs can cover both Movies and TV.
  const resolvedByName = await resolveStudioIdsByName(title).catch(() => ({ studioIds: [] }));
  let resolvedIds = Array.from(new Set([
    ...seedIds,
    ...(Array.isArray(resolvedByName?.studioIds) ? resolvedByName.studioIds : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean),
  ]));

  if (!resolvedIds.length) {
    renderStudioModalGrid(modal.moviesGrid, [], "No movies found for this studio.");
    renderStudioModalGrid(modal.seriesGrid, [], "No TV shows found for this studio.");
    return;
  }

  const userId = await getCurrentUserIdSafe().catch(() => "");
  if (!userId) {
    renderStudioModalGrid(modal.moviesGrid, [], "Could not determine current user.");
    renderStudioModalGrid(modal.seriesGrid, [], "Could not determine current user.");
    return;
  }

  const [movies, series] = await Promise.all([
    fetchStudioItemsByTypes(userId, resolvedIds, "Movie").catch(() => []),
    fetchStudioItemsByTypes(userId, resolvedIds, "Series").catch(() => []),
  ]);

  renderStudioModalGrid(modal.moviesGrid, movies, "No movies found for this studio.");
  renderStudioModalGrid(modal.seriesGrid, series, "No TV shows found for this studio.");
}

function createCard(name, studioId, logoUrl, backdropUrl, videoUrl, studioIds = []) {
  const a = document.createElement("a");
  a.className = "studio-hub-card";
  a.href = buildStudioHref(studioId, name, studioIds);
  a.dataset.studioName = String(name || "");
  a.dataset.studioId = String(studioId || "");
  a.dataset.studioIds = Array.isArray(studioIds) ? studioIds.join(",") : "";
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

  a.addEventListener("click", (ev) => {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();

    // Prefer dataset values because they may have been enriched after first paint.
    const liveName = String(a.dataset.studioName || name || "").trim();
    const liveStudioId = String(a.dataset.studioId || studioId || "").trim();
    const liveStudioIds = String(a.dataset.studioIds || "")
      .split(",")
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    void openStudioSectionsModal(liveName || name, liveStudioId || studioId, liveStudioIds.length ? liveStudioIds : studioIds);
  });

  return a;
}

async function resolvePendingCardLinks(row) {
  if (!row) return;

  const cards = Array.from(row.querySelectorAll(".studio-hub-card"));
  if (!cards.length) return;

  const nameKeys = new Map();
  for (const card of cards) {
    const rawName = String(card.dataset.studioName || card.getAttribute("aria-label") || "").trim();
    const key = normalizeName(rawName);
    if (!key) continue;
    if (!nameKeys.has(key)) nameKeys.set(key, rawName);
  }

  const resolvedByKey = new Map();
  await Promise.all(Array.from(nameKeys.entries()).map(async ([key, rawName]) => {
    const resolved = await resolveStudioIdsByName(rawName).catch(() => ({ primaryId: "", studioIds: [] }));
    resolvedByKey.set(key, {
      primaryId: String(resolved?.primaryId || "").trim(),
      studioIds: Array.isArray(resolved?.studioIds)
        ? resolved.studioIds.map((x) => String(x || "").trim()).filter(Boolean)
        : [],
    });
  }));

  for (const card of cards) {
    const rawName = String(card.dataset.studioName || card.getAttribute("aria-label") || "").trim();
    const key = normalizeName(rawName);
    const resolved = key ? resolvedByKey.get(key) : null;
    const resolvedIds = Array.isArray(resolved?.studioIds) ? resolved.studioIds : [];

    const existingId = String(card.dataset.studioId || "").trim();
    const existingIds = String(card.dataset.studioIds || "")
      .split(",")
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    const mergedIds = Array.from(new Set([
      existingId,
      ...existingIds,
      ...resolvedIds,
    ].filter(Boolean))).slice(0, 4);

    const primaryId = String(resolved?.primaryId || existingId || mergedIds[0] || "").trim();
    if (!primaryId) continue;

    card.href = buildStudioHref(primaryId, rawName, mergedIds);
    card.dataset.studioId = primaryId;
    card.dataset.studioIds = mergedIds.join(",");
    card.dataset.hrefSource = resolved?.primaryId ? "studioId+aliases" : "studioId";
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

    let cfg;
    try {
      cfg = await getCfg();
    } catch (err) {
      console.error("[StudioHubs] getCfg failed:", err);
      ensureEmptyState(row, "Failed to load configuration.");
      return;
    }
    if (!cfg.enablePlugin || !cfg.enableStudioHubs || !cfg.enabled) {
      section.style.display = "none";
      return;
    }

    section.style.display = "";
    const renderDebug = [];

    let userId;
    try {
      userId = await getCurrentUserIdSafe();
    } catch (err) {
      console.error("[StudioHubs] getCurrentUserIdSafe failed:", err);
      ensureEmptyState(row, "Failed to get user information.");
      return;
    }

    let manualEntries = [], videoEntries = [];
    try {
      [manualEntries, videoEntries] = await Promise.all([
        fetchManualEntries().catch((err) => { console.error("[StudioHubs] fetchManualEntries failed:", err); return []; }),
        fetchVideoEntries().catch((err) => { console.error("[StudioHubs] fetchVideoEntries failed:", err); return []; }),
      ]);
    } catch (err) {
      console.error("[StudioHubs] fetch manual/video entries failed:", err);
      ensureEmptyState(row, "Failed to load studio data.");
      return;
    }

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
        const items = await fetchStudioItems(userId, studioId).catch(() => []);
        backdropUrl = pickBackdrop(items.find((i) => Array.isArray(i?.BackdropImageTags) && i.BackdropImageTags.length));
      }

      cardModels.push({
        displayName: displayName || name,
        studioId,
        studioIds: studioId ? [studioId] : [],
        logoUrl,
        backdropUrl,
        videoUrl,
      });
      renderDebug.push({
        inputName: String(name || ""),
        displayName: String(displayName || ""),
        manualStudioId,
        resolvedStudioId: String(studioId || ""),
        resolvedStudioIds: studioId ? [String(studioId)] : [],
        idSource,
        href: buildStudioHref(studioId, displayName || name, studioId ? [studioId] : []),
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
        cardModel.studioIds,
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
  } catch (err) {
    console.error("[StudioHubs] renderStudioHubs failed:", err);
    const root = getHomeContainer();
    if (root) {
      const section = ensureSection(root);
      const row = section.querySelector(".studio-hubs-row");
      ensureEmptyState(row, "An error occurred while rendering studios.");
    }
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
    } else {
      // Home container not ready yet, retry soon
      if (!options._retryCount || options._retryCount < 10) {
        setTimeout(() => {
          scheduleRender({ ...options, _retryCount: (options._retryCount || 0) + 1, delayMs: 100 });
        }, 100);
      }
      return;
    }
  }

  if (scheduleTimer) clearTimeout(scheduleTimer);
  scheduleTimer = setTimeout(() => {
    scheduleTimer = null;
    void renderStudioHubs(force);
  }, delayMs);
}

function installLifecycleHooks() {
  const onNav = () => {
    scheduleRender({ force: true, delayMs: FAST_RENDER_DELAY_MS });
    // Fallback: after a short delay, check if cards are missing and force another render if needed
    setTimeout(() => {
      const row = document.querySelector(".studio-hubs-row");
      if (row && !row.querySelector(".studio-hub-card") && !row.querySelector(".studio-hubs-empty")) {
        scheduleRender({ force: true, delayMs: 0 });
      }
    }, 800);
  };

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
      const resolved = await resolveStudioIdsByName(name);
      return {
        name: String(name || ""),
        resolvedStudioId: String(resolved?.primaryId || ""),
        resolvedStudioIds: Array.isArray(resolved?.studioIds) ? resolved.studioIds : [],
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
