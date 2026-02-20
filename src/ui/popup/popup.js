// Load settings from storage
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await chrome.storage.sync.get(['smartSelect', 'newWindow']);
    
    const smartSelectEl = document.getElementById('smartSelect');
    const newWindowEl = document.getElementById('newWindow');
    
    if (smartSelectEl) {
      smartSelectEl.checked = settings.smartSelect || false;
    }
    if (newWindowEl) {
      newWindowEl.checked = settings.newWindow || false;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
});

// Save settings on change
const smartSelectEl = document.getElementById('smartSelect');
const newWindowEl = document.getElementById('newWindow');

if (smartSelectEl) {
  smartSelectEl.addEventListener('change', (e) => {
    chrome.storage.sync.set({ smartSelect: e.target.checked });
  });
}

if (newWindowEl) {
  newWindowEl.addEventListener('change', (e) => {
    chrome.storage.sync.set({ newWindow: e.target.checked });
  });
}

// Open settings page
const openSettingsBtn = document.getElementById('openSettings');
if (openSettingsBtn) {
  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}
