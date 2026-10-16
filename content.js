(function () {
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
    search: [
      "ytd-search ytd-video-renderer",
      "ytd-search ytd-reel-item-renderer",
      "ytd-search ytd-shorts-lockup-view-model",
      "ytd-search yt-lockup-view-model",
      "ytd-search-pod-renderer ytd-video-renderer",
      "ytd-search-pod-renderer yt-lockup-view-model"
    ].join(","),
    lockups: "yt-lockup-view-model"
  };
  const DISCLOSURE_LINK = 'a[href*="youtube/answer/15447836"]';
  const LABEL_ATTRIBUTES = '[aria-label], [title]';
  const LABEL_TEXT = /^(?:ai:\s*)?(?:content was made with ai|made with ai|altered or synthetic content)$/i;
  const settings = { ...EAISettings.defaults };
  let scanTimer;

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
    if (
      item.matches(SELECTORS.shorts) ||
      item.querySelector('a[href*="/shorts/"]') ||
      location.pathname.startsWith("/shorts/")
    ) return "shorts";

    if (item.closest("ytd-watch-next-secondary-results-renderer")) return "sidebar";
    if (item.closest("ytd-search, ytd-search-pod-renderer")) return "search";
    return null;
  }

  function apply(item) {
    const context = itemContext(item);
    const blocked = Boolean(context && settings.enabled && settings[context] && hasDisclosure(item));
    item.classList.toggle("eai-hidden", blocked);
    item.dataset.eaiBlocked = blocked ? "true" : "false";
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
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 120);
  }

  EAISettings.get().then((stored) => {
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
