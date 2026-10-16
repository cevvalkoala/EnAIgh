if (!globalThis.EAISettings) importScripts("settings.js");

const api = globalThis.browser ?? globalThis.chrome;

async function updateBadge() {
  const { enabled } = await EAISettings.get();
  await api.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
  await api.action.setBadgeBackgroundColor({ color: enabled ? "#18794e" : "#70757a" });
  await api.action.setTitle({
    title: `YouTube AI Label Blocker: ${enabled ? "On" : "Off"}`
  });
}

api.runtime.onInstalled.addListener(async () => {
  const stored = await EAISettings.getStored();
  const missing = {};
  for (const [key, value] of Object.entries(EAISettings.defaults)) {
    if (!(key in stored)) missing[key] = value;
  }
  if (Object.keys(missing).length) await EAISettings.set(missing);
  await updateBadge();
});

api.runtime.onStartup.addListener(updateBadge);
api.storage.onChanged.addListener((changes) => {
  if (changes.enabled) void updateBadge();
});

api.action.onClicked.addListener(async () => {
  const { enabled } = await EAISettings.get();
  await EAISettings.set({ enabled: !enabled });
  await updateBadge();
});

void updateBadge();
