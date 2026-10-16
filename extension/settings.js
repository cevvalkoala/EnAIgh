(function (global) {
  // Firefox exposes browser; Chrome exposes the equivalent chrome namespace.
  const api = global.browser ?? global.chrome;
  const defaults = Object.freeze({
    enabled: true,
    sidebar: true,
    search: true,
    shorts: true
  });
  let storageArea = api.storage.sync;

  async function get() {
    try {
      storageArea = api.storage.sync;
      return { ...defaults, ...(await storageArea.get(defaults)) };
    } catch {
      storageArea = api.storage.local;
      return { ...defaults, ...(await storageArea.get(defaults)) };
    }
  }

  async function getStored() {
    try {
      storageArea = api.storage.sync;
      return await storageArea.get(null);
    } catch {
      storageArea = api.storage.local;
      return await storageArea.get(null);
    }
  }

  async function set(values) {
    try {
      await storageArea.set(values);
    } catch {
      storageArea = api.storage.local;
      await storageArea.set(values);
    }
  }

  function onChanged(listener) {
    api.storage.onChanged.addListener((changes) => {
      const updated = {};
      for (const key of Object.keys(defaults)) {
        if (changes[key]) updated[key] = changes[key].newValue;
      }
      if (Object.keys(updated).length) listener(updated);
    });
  }

  global.EAISettings = { defaults, get, getStored, set, onChanged };
})(globalThis);
