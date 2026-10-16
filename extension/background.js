if (!globalThis.EAISettings) importScripts("settings.js");

const api = globalThis.browser ?? globalThis.chrome;
const manifest = api.runtime.getManifest();
const backgroundPath = manifest.background.service_worker ?? manifest.background.scripts?.find((path) => path.endsWith("background.js"));
const backgroundDirectory = backgroundPath?.includes("/") ? backgroundPath.slice(0, backgroundPath.lastIndexOf("/")) : "";
const iconPrefix = [backgroundDirectory, "icons"].filter(Boolean).join("/");
const useImageDataIcons = Boolean(manifest.background.service_worker);
const iconDataCache = new Map();

function actionIconPaths(enabled) {
  const state = enabled ? "on" : "off";
  return Object.fromEntries([16, 32, 48, 96, 128].map((size) => [
    size,
    `${iconPrefix}/${state}/icon-${size}.png`
  ]));
}

async function loadActionIconData(enabled) {
  const state = enabled ? "on" : "off";
  if (!iconDataCache.has(state)) {
    const imageDataPromise = Promise.all([16, 32, 48, 96, 128].map(async (size) => {
      const path = `${iconPrefix}/${state}/icon-${size}.png`;
      const response = await fetch(api.runtime.getURL(path));
      if (!response.ok) throw new Error(`Unable to load toolbar icon: ${path}`);
      const bitmap = await createImageBitmap(await response.blob());
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to create toolbar icon canvas");
        context.drawImage(bitmap, 0, 0);
        return [size, context.getImageData(0, 0, bitmap.width, bitmap.height)];
      } finally {
        bitmap.close();
      }
    })).then(Object.fromEntries);
    iconDataCache.set(state, imageDataPromise);
  }
  try {
    return await iconDataCache.get(state);
  } catch (error) {
    iconDataCache.delete(state);
    throw error;
  }
}

async function updateAction() {
  const { enabled } = await EAISettings.get();
  await api.action.setBadgeText({ text: "" });
  await api.action.setTitle({ title: "EnAIgh" });
  try {
    if (useImageDataIcons) {
      await api.action.setIcon({ imageData: await loadActionIconData(enabled) });
    } else {
      await api.action.setIcon({ path: actionIconPaths(enabled) });
    }
  } catch (error) {
    console.error("EnAIgh could not update its toolbar icon", error);
  }
}

api.runtime.onInstalled.addListener(async () => {
  const stored = await EAISettings.getStored();
  const missing = {};
  for (const [key, value] of Object.entries(EAISettings.defaults)) {
    if (!(key in stored)) missing[key] = value;
  }
  if (Object.keys(missing).length) await EAISettings.set(missing);
  await updateAction();
});

api.runtime.onStartup.addListener(updateAction);
api.storage.onChanged.addListener((changes) => {
  if (changes.enabled) void updateAction();
});

api.action.onClicked.addListener(async () => {
  const { enabled } = await EAISettings.get();
  await EAISettings.set({ enabled: !enabled });
  await updateAction();
});

void updateAction();
