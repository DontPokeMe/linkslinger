const el = {
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  settingsVersion: document.getElementById("settingsVersion")
};

document.addEventListener("DOMContentLoaded", () => {
  if (el.openSettingsBtn) {
    el.openSettingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (el.settingsVersion && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    el.settingsVersion.textContent = "Version " + (manifest.version || "");
  }
});
