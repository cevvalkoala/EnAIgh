(function () {
  // Keep selectors centralized because YouTube's renderer markup changes often.
  const api = globalThis.browser ?? globalThis.chrome;
  const CACHE_KEY = "eaiDisclosureCache";
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
  const MAX_CONCURRENT_FETCHES = 3;
  const SELECTORS = {
    shorts: [
      "ytd-reel-video-renderer",
      "ytd-reel-item-renderer",
      "ytd-shorts-lockup-view-model",
      "ytm-shorts-lockup-view-model"
    ].join(","),
    sidebar: [
      "ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer",
      "ytd-watch-next-secondary-results-renderer ytd-compact-autoplay-renderer",
      "ytd-watch-next-secondary-results-renderer ytd-video-renderer",
      "ytd-watch-next-secondary-results-renderer yt-lockup-view-model"
    ].join(","),
    searchItems: [
      "ytd-video-renderer",
      "ytd-reel-item-renderer",
      "ytd-shorts-lockup-view-model",
      "ytd-compact-video-renderer",
      "yt-lockup-view-model"
    ].join(",")
  };
  const DISCLOSURE_LINK = 'a[href*="youtube/answer/15447836"]';
  const LABEL_ATTRIBUTES = '[aria-label], [title]';
  const LABEL_TEXT = /^(?:ai:\s*)?(?:content was made with ai|made with ai|altered or synthetic content)$/i;
  const WATCH_DISCLOSURE = /"howThisWasMadeSectionViewModel"\s*:\s*\{[\s\S]{0,3000}?"bodyHeader"\s*:\s*\{\s*"content"\s*:\s*"Made with AI"/i;
  const settings = { ...EAISettings.defaults };
  const itemsByVideoId = new Map();
  const itemVideoIds = new WeakMap();
  const observedIds = new WeakMap();
  const queuedIds = new Set();
  const activeIds = new Set();
  const retryAfter = new Map();
  const fetchQueue = [];
  let disclosureCache = {};
  let activeFetches = 0;
  let scanTimer;

  const cacheReady = api.storage.local.get(CACHE_KEY).then((stored) => {
    const now = Date.now();
    const saved = stored[CACHE_KEY] || {};
    for (const [id, entry] of Object.entries(saved)) {
      if (entry && now - entry.checkedAt < CACHE_TTL) disclosureCache[id] = entry;
    }
  }).catch(() => {});

  const visibilityObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = entry.target;
        visibilityObserver.unobserve(item);
        observedIds.delete(item);
        const id = videoId(item);
        if (id) enqueueVideo(id);
      }
    })
    : null;

  function hasDisclosure(item) {
    if (item.matches(DISCLOSURE_LINK) || item.querySelector(DISCLOSURE_LINK)) return true;

    const labelElements = [
      ...(item.matches(LABEL_ATTRIBUTES) ? [item] : []),
      ...item.querySelectorAll(LABEL_ATTRIBUTES)
    ];
    for (const element of labelElements) {
      if (LABEL_TEXT.test((element.getAttribute("aria-label") || "").trim())) return true;
      if (LABEL_TEXT.test((element.getAttribute("title") || "").trim())) return true;
    }

    for (const element of item.querySelectorAll("ytd-video-attribute-view-model, .ytVideoAttributeViewModelHost")) {
      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (LABEL_TEXT.test(text)) return true;
    }
    return false;
  }

  function itemContext(item) {
    if (location.pathname.startsWith("/shorts/")) return "shorts";
    if (item.closest("ytd-watch-next-secondary-results-renderer")) return "sidebar";
    if (location.pathname.startsWith("/results") || item.closest("ytd-search, ytd-search-pod-renderer")) return "search";
    if (item.matches(SELECTORS.shorts) || item.querySelector('a[href*="/shorts/"]')) return "shorts";
    return null;
  }

  function videoId(item) {
    const candidates = [item, ...item.querySelectorAll("a[href]")];
    for (const anchor of candidates) {
      const href = anchor.href || anchor.getAttribute("href");
      if (!href) continue;
      try {
        const url = new URL(href, location.origin);
        const id = url.pathname === "/watch"
          ? url.searchParams.get("v")
          : url.pathname.match(/^\/shorts\/([^/?]+)/)?.[1];
        if (id) return id;
      } catch {
        // Ignore malformed links inside YouTube renderers.
      }
    }
    return item.getAttribute("video-id") || item.dataset.videoId || null;
  }

  function setBlocked(item, blocked) {
    item.classList.toggle("eai-hidden", blocked);
    item.dataset.eaiBlocked = blocked ? "true" : "false";
  }

  function trackItem(item, id) {
    const previousId = itemVideoIds.get(item);
    if (previousId && previousId !== id) itemsByVideoId.get(previousId)?.delete(item);
    itemVideoIds.set(item, id);
    if (!itemsByVideoId.has(id)) itemsByVideoId.set(id, new Set());
    itemsByVideoId.get(id).add(item);
  }

  function apply(item) {
    const context = itemContext(item);
    if (!context || !settings.enabled || !settings[context]) {
      setBlocked(item, false);
      return;
    }

    if (hasDisclosure(item)) {
      setBlocked(item, true);
      return;
    }

    const id = videoId(item);
    if (!id) {
      setBlocked(item, false);
      return;
    }

    trackItem(item, id);
    const cached = disclosureCache[id];
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
      setBlocked(item, cached.blocked);
      return;
    }

    setBlocked(item, false);
    if (visibilityObserver) {
      if (observedIds.get(item) !== id) {
        observedIds.set(item, id);
        visibilityObserver.observe(item);
      }
    } else if (isVisible(item)) {
      enqueueVideo(id);
    }
  }

  function isVisible(item) {
    const bounds = item.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.right > 0 && bounds.top < innerHeight && bounds.left < innerWidth;
  }

  function enqueueVideo(id) {
    if (queuedIds.has(id) || activeIds.has(id)) return;
    if (disclosureCache[id] && Date.now() - disclosureCache[id].checkedAt < CACHE_TTL) return;
    if ((retryAfter.get(id) || 0) > Date.now()) return;
    queuedIds.add(id);
    fetchQueue.push(id);
    drainFetchQueue();
  }

  function drainFetchQueue() {
    while (activeFetches < MAX_CONCURRENT_FETCHES && fetchQueue.length) {
      const id = fetchQueue.shift();
      queuedIds.delete(id);
      activeIds.add(id);
      activeFetches += 1;
      void checkWatchPage(id).finally(() => {
        activeIds.delete(id);
        activeFetches -= 1;
        drainFetchQueue();
      });
    }
  }

  async function checkWatchPage(id) {
    await cacheReady;
    if (disclosureCache[id] && Date.now() - disclosureCache[id].checkedAt < CACHE_TTL) {
      refreshItems(id);
      return;
    }

    try {
      const response = await fetch(`/watch?v=${encodeURIComponent(id)}`, { credentials: "omit" });
      if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
      const html = await response.text();
      disclosureCache[id] = { blocked: WATCH_DISCLOSURE.test(html), checkedAt: Date.now() };
      retryAfter.delete(id);
      refreshItems(id);
      await api.storage.local.set({ [CACHE_KEY]: disclosureCache }).catch(() => {});
    } catch {
      retryAfter.set(id, Date.now() + 60_000);
    }
  }

  function refreshItems(id) {
    const items = itemsByVideoId.get(id);
    if (!items) return;
    for (const item of items) {
      if (item.isConnected) apply(item);
      else items.delete(item);
    }
  }

  function scan() {
    if (!settings.enabled) {
      document.querySelectorAll(".eai-hidden").forEach((item) => item.classList.remove("eai-hidden"));
      return;
    }

    const items = new Set();
    for (const selector of Object.values(SELECTORS)) {
      document.querySelectorAll(selector).forEach((item) => items.add(item));
    }
    for (const item of items) apply(item);

    for (const [id, videoItems] of itemsByVideoId) {
      for (const item of videoItems) {
        if (!item.isConnected) videoItems.delete(item);
      }
      if (!videoItems.size) itemsByVideoId.delete(id);
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 120);
  }

  Promise.all([EAISettings.get(), cacheReady]).then(([stored]) => {
    Object.assign(settings, stored);
    scan();
  });

  EAISettings.onChanged((updated) => {
    Object.assign(settings, updated);
    scheduleScan();
  });

  document.addEventListener("yt-navigate-finish", scheduleScan);
  window.addEventListener("popstate", scheduleScan);

  const observer = new MutationObserver(scheduleScan);
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-label", "title", "href"],
      childList: true,
      subtree: true
    });
  }
})();
