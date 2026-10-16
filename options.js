const checkboxes = ["enabled", "sidebar", "search", "shorts"].map((id) => document.getElementById(id));
const master = document.getElementById("enabled");
const status = document.getElementById("status");

function render(values) {
  for (const checkbox of checkboxes) {
    if (Object.hasOwn(values, checkbox.id)) checkbox.checked = Boolean(values[checkbox.id]);
  }
  for (const checkbox of checkboxes.slice(1)) checkbox.disabled = !master.checked;
}

async function load() {
  render(await EAISettings.get());
}

for (const checkbox of checkboxes) {
  checkbox.addEventListener("change", async () => {
    try {
      await EAISettings.set({ [checkbox.id]: checkbox.checked });
      render({ [checkbox.id]: checkbox.checked, enabled: master.checked });
      status.textContent = "Settings saved";
      setTimeout(() => { status.textContent = ""; }, 1400);
    } catch {
      status.textContent = "Could not save settings";
    }
  });
}

EAISettings.onChanged(render);
void load();
