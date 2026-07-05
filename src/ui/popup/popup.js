const el = {
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  quickUseText: document.getElementById("quickUseText"),
  settingsVersion: document.getElementById("settingsVersion")
};

function displayTrigger(trigger) {
  if (!trigger) return "your activator shortcut";
  const mods = trigger.mods || {};
  const parts = [];
  if (mods.shift) parts.push("Shift");
  if (mods.alt) parts.push("Alt");
  if (mods.ctrl) parts.push("Ctrl");
  const key = typeof trigger.key === "string" && trigger.key.trim() ? trigger.key.trim() : "z";
  parts.push(key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1));
  return parts.join("+");
}

document.addEventListener("DOMContentLoaded", async () => {
  if (el.openSettingsBtn) {
    el.openSettingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (el.settingsVersion && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    el.settingsVersion.textContent = "Version " + (manifest.version || "");
  }

  if (el.quickUseText && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get(["settings"]);
    if (!data.settings || !Array.isArray(data.settings.profiles)) {
      data.settings = await chrome.runtime.sendMessage({ message: "init" });
    }
    const profile = data.settings && Array.isArray(data.settings.profiles) ? data.settings.profiles[0] : null;
    el.quickUseText.textContent = "Hold " + displayTrigger(profile && profile.trigger) + " and drag over links to draw the selection box.";
  }
});
