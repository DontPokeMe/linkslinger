function isValidRegex(pattern) {
  if (typeof pattern !== 'string' || !pattern.trim()) return true;
  try {
    new RegExp(pattern);
    return true;
  } catch (_) {
    return false;
  }
}

const MODIFIER_KEYS = new Set(['Shift', 'Alt', 'Control']);

/** Ensure the trigger key is not also set as a modifier (e.g. key Shift + mod shift is invalid). */
function modsForKey(key, mods) {
  const m = { ...mods };
  const k = (key || "").trim().toLowerCase();
  if (k === "shift") m.shift = false;
  else if (k === "alt") m.alt = false;
  else if (k === "control" || k === "ctrl") m.ctrl = false;
  return m;
}

function keyToDisplayLabel(key) {
  if (!key || typeof key !== 'string') return '';
  const k = key.trim().toLowerCase();
  if (k.length === 1) return k.toUpperCase();
  return k.charAt(0).toUpperCase() + k.slice(1);
}

function triggerToDisplay(trigger) {
  if (!trigger) return "";
  const m = trigger.mods || {};
  const modParts = [];
  if (m.shift) modParts.push("Shift");
  if (m.alt) modParts.push("Alt");
  if (m.ctrl) modParts.push("Ctrl");
  if (trigger.kind === "key" && trigger.key) {
    const keyPart = keyToDisplayLabel(trigger.key);
    if (modParts.length) return modParts.join("+") + "+" + keyPart;
    return keyPart;
  }
  if (modParts.length) return modParts.join("+");
  return "Left drag (no key)";
}

function triggerFromKeyEvent(e) {
  let key = (e.key && typeof e.key === "string") ? e.key.trim().toLowerCase() : "";
  if (MODIFIER_KEYS.has(e.key) || !key) key = "z";
  const mods = {
    shift: !!e.shiftKey,
    alt: !!e.altKey,
    ctrl: !!e.ctrlKey,
    meta: false
  };
  if (key === "shift") mods.shift = false;
  else if (key === "alt") mods.alt = false;
  else if (key === "control" || key === "ctrl") mods.ctrl = false;
  return { kind: "key", key, mods, mouseButton: 0 };
}

const ACTION_TYPES = [
  { value: "tabs", label: "Open in new tabs" },
  { value: "win", label: "Open in new window" },
  { value: "copy", label: "Copy to clipboard" },
  { value: "bm", label: "Bookmark" },
  { value: "export", label: "Export" }
];

function actionDisplayLabel(actionType) {
  const labels = { bm: "Bookmark", copy: "Copy", tabs: "Open in tabs", win: "New window", export: "Export" };
  return labels[actionType] || actionType || "tabs";
}

function getNextActionId(actions) {
  const ids = Object.keys(actions).filter((k) => /^\d+$/.test(k)).map(Number);
  return String(ids.length ? Math.max(...ids) + 1 : 101);
}

function defaultActionOptions(smart = 0) {
  return {
    smart: smart ? 1 : 0,
    ignore: [0],
    delay: 0,
    close: 0,
    block: true,
    reverse: false,
    end: false,
    filterPattern: "",
    filterMode: "exclude",
    filterCaseInsensitive: true,
    copy: 1
  };
}

function updateApiKeyUI(storedKey) {
  const raw = typeof storedKey === 'string' ? storedKey.trim() : '';
  const hasKey = raw.length > 0;
  const inputContainer = document.getElementById('api-input-container');
  const lockedContainer = document.getElementById('api-locked-container');
  const apiKeyInput = document.getElementById('dontpokeApiKey');
  if (!inputContainer || !lockedContainer) return;
  if (hasKey) {
    inputContainer.style.display = 'none';
    lockedContainer.style.display = 'flex';
    if (apiKeyInput) apiKeyInput.value = '';
  } else {
    inputContainer.style.display = '';
    lockedContainer.style.display = 'none';
    if (apiKeyInput) apiKeyInput.value = '';
  }
}

let filterValidationTimer = null;
function validateFilterPattern() {
  const input = document.getElementById('filterPattern');
  const errorEl = document.getElementById('filterPatternError');
  const saveBtn = document.getElementById('saveAdvanced');
  if (!input || !errorEl || !saveBtn) return;
  const pattern = input.value.trim();
  const valid = isValidRegex(pattern);
  input.classList.toggle('input-error', !valid);
  errorEl.hidden = valid;
  saveBtn.disabled = !valid;
}

// Activate a section by id (settings, advanced, about); used for nav clicks and initial hash
function activateSection(sectionId) {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');
  navItems.forEach((nav) => {
    const target = nav.getAttribute('data-section');
    nav.classList.toggle('active', target === sectionId);
  });
  sections.forEach((section) => {
    section.classList.toggle('active', section.id === sectionId);
  });
}

// Navigation handling
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');

  // Open to hash section if present (e.g. #about for new installs)
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (hash && document.getElementById(hash)) {
    activateSection(hash);
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = item.getAttribute('data-section');
      if (sectionId) {
        activateSection(sectionId);
      }
    });
  });

  // Load and display current settings
  loadSettings();
  
  // Set up save handlers
  setupSaveHandlers();

  // Filter pattern: validate on input (debounced 300ms) and on blur
  const filterInput = document.getElementById('filterPattern');
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      clearTimeout(filterValidationTimer);
      filterValidationTimer = setTimeout(validateFilterPattern, 300);
    });
    filterInput.addEventListener('blur', validateFilterPattern);
  }
});

// Load settings from storage
async function loadSettings() {
  try {
    // Load from chrome.storage.local (where background.js stores settings)
    const data = await chrome.storage.local.get(['settings', 'dontpokeApiKey']);
    
    if (data.settings && data.settings.actions) {
      const firstActionId = Object.keys(data.settings.actions)[0];
      if (firstActionId) {
        const action = data.settings.actions[firstActionId];

        // Filter (regex) – used by first action for Advanced display
        const filterPatternInput = document.getElementById('filterPattern');
        const filterModeSelect = document.getElementById('filterMode');
        if (filterPatternInput && action.options) {
          filterPatternInput.value = action.options.filterPattern || '';
        }
        if (filterModeSelect && action.options) {
          filterModeSelect.value = action.options.filterMode === 'include' ? 'include' : 'exclude';
        }
        const filterCaseInsensitiveCheckbox = document.getElementById('filterCaseInsensitive');
        if (filterCaseInsensitiveCheckbox) {
          filterCaseInsensitiveCheckbox.checked = action.options.filterCaseInsensitive !== false;
        }
      }
    }
    validateFilterPattern();

    // Load blocklist
    if (data.settings && data.settings.blocked) {
      const blocklistTextarea = document.getElementById('blocklist');
      if (blocklistTextarea) {
        blocklistTextarea.value = data.settings.blocked.join('\n');
      }
    }

    updateApiKeyUI(typeof data.dontpokeApiKey === 'string' ? data.dontpokeApiKey : '');

    const debugModeCheckbox = document.getElementById('debugMode');
    if (debugModeCheckbox) {
      debugModeCheckbox.checked = !!(data.settings && data.settings.debugMode);
    }

    // Load profiles (migrate if missing)
    if (data.settings && data.settings.actions) {
      if (!Array.isArray(data.settings.profiles) || data.settings.profiles.length === 0) {
        const firstId = Object.keys(data.settings.actions)[0] || '101';
        data.settings.profiles = [
          { id: 'p1', name: 'Default', trigger: { kind: 'key', key: 'z', mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 }, actionId: firstId }
        ];
      }
      renderProfilesTable(data.settings.profiles, data.settings.actions);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

const TRASH_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

function attachTriggerCapture(triggerDisplay, modsWrap) {
  function syncModsFromTriggerToCheckboxes(t) {
    const mods = t && t.mods ? t.mods : {};
    modsWrap.querySelectorAll('.trigger-mod-checkbox').forEach((cb) => {
      const k = cb.dataset.mod;
      cb.checked = !!(k && mods[k]);
    });
  }
    function syncModsFromCheckboxesToTrigger() {
      const t = JSON.parse(triggerDisplay.dataset.trigger || '{}');
      const mods = { shift: false, alt: false, ctrl: false, meta: false };
      modsWrap.querySelectorAll('.trigger-mod-checkbox').forEach((cb) => {
        const k = cb.dataset.mod;
        if (k) mods[k] = cb.checked;
      });
      t.kind = 'key';
      if (!t.key || typeof t.key !== 'string') t.key = 'z';
      t.mods = modsForKey(t.key, mods);
      triggerDisplay.dataset.trigger = JSON.stringify(t);
      triggerDisplay.value = triggerToDisplay(t);
    }
  modsWrap.querySelectorAll('.trigger-mod-checkbox').forEach((cb) => {
    cb.addEventListener('change', syncModsFromCheckboxesToTrigger);
  });
  triggerDisplay.addEventListener('mousedown', (e) => {
    if (e.target !== triggerDisplay) return;
    e.preventDefault();
    triggerDisplay.value = 'Press any key...';
    const captureListener = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const t = triggerFromKeyEvent(ev);
      triggerDisplay.value = triggerToDisplay(t);
      triggerDisplay.dataset.trigger = JSON.stringify(t);
      syncModsFromTriggerToCheckboxes(t);
      triggerDisplay.blur();
      window.removeEventListener('keydown', captureListener, true);
    };
    window.addEventListener('keydown', captureListener, true);
    triggerDisplay.addEventListener('blur', () => {
      window.removeEventListener('keydown', captureListener, true);
      try {
        const stored = JSON.parse(triggerDisplay.dataset.trigger || '{}');
        triggerDisplay.value = triggerToDisplay(stored);
      } catch (_) {}
    }, { once: true });
  }, true);
}

function createProfileCard(p, idx, actions, gridEl) {
  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.profileIndex = idx;
  card.setAttribute('role', 'listitem');

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'delete-profile profile-card-delete';
  deleteBtn.innerHTML = TRASH_ICON_SVG;
  deleteBtn.setAttribute('aria-label', 'Delete profile');
  deleteBtn.addEventListener('click', () => {
    if (gridEl && gridEl.querySelectorAll('.profile-card').length <= 1) return;
    card.remove();
  });

  const nameLabel = document.createElement('span');
  nameLabel.className = 'field-label';
  nameLabel.textContent = 'Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = p.name || 'Profile ' + (idx + 1);
  nameInput.placeholder = 'Name';
  nameInput.className = 'setting-input profile-name-input';

  const trigger = normalizeTriggerForUI(p.trigger);
  const triggerLabel = document.createElement('span');
  triggerLabel.className = 'field-label';
  triggerLabel.textContent = 'Trigger';
  const triggerWrap = document.createElement('div');
  triggerWrap.className = 'trigger-capture-wrap';
  const triggerDisplay = document.createElement('input');
  triggerDisplay.type = 'text';
  triggerDisplay.readOnly = true;
  triggerDisplay.className = 'trigger-capture-input setting-input input-glass';
  triggerDisplay.placeholder = 'Click then press key combo';
  triggerDisplay.value = triggerToDisplay(trigger);
  triggerDisplay.dataset.trigger = JSON.stringify(trigger);
  triggerWrap.appendChild(triggerDisplay);
  const modsLabel = document.createElement('span');
  modsLabel.className = 'field-label field-label-modifiers';
  modsLabel.textContent = 'Modifiers';
  const modsWrap = document.createElement('div');
  modsWrap.className = 'modifier-group';
  modsWrap.setAttribute('aria-label', 'Trigger modifiers');
  [{ key: 'shift', label: 'Shift' }, { key: 'ctrl', label: 'Ctrl' }, { key: 'alt', label: 'Alt' }].forEach(({ key, label }) => {
    const lab = document.createElement('label');
    lab.className = 'trigger-mod-label modifier-toggle-wrap';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'trigger-mod-checkbox modifier-checkbox mod-' + key;
    cb.dataset.mod = key;
    cb.checked = !!(trigger.mods && trigger.mods[key]);
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(label));
    modsWrap.appendChild(lab);
  });
  triggerWrap.appendChild(modsLabel);
  triggerWrap.appendChild(modsWrap);
  attachTriggerCapture(triggerDisplay, modsWrap);

  const actionLabel = document.createElement('span');
  actionLabel.className = 'field-label';
  actionLabel.textContent = 'Action';
  const actionTypeSelect = document.createElement('select');
  actionTypeSelect.className = 'setting-input select-glass';
  const profileAction = actions[p.actionId];
  const currentActionType = (profileAction && profileAction.action) || 'tabs';
  ACTION_TYPES.forEach(({ value, label }) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    if (value === currentActionType) o.selected = true;
    actionTypeSelect.appendChild(o);
  });
  const smartLabel = document.createElement('label');
  smartLabel.className = 'toggle-switch-label smart-label';
  const smartCheckbox = document.createElement('input');
  smartCheckbox.type = 'checkbox';
  smartCheckbox.className = 'toggle-switch-input smart-checkbox';
  smartCheckbox.checked = profileAction && profileAction.options && profileAction.options.smart === 1;
  smartCheckbox.setAttribute('aria-label', 'Smart selection');
  const smartSlider = document.createElement('span');
  smartSlider.className = 'toggle-switch-slider';
  smartSlider.setAttribute('aria-hidden', 'true');
  const smartText = document.createElement('span');
  smartText.className = 'toggle-switch-text';
  smartText.textContent = 'Smart selection';
  smartLabel.appendChild(smartCheckbox);
  smartLabel.appendChild(smartSlider);
  smartLabel.appendChild(smartText);

  card.dataset.actionId = p.actionId || '';

  const nameBlock = document.createElement('div');
  nameBlock.className = 'profile-card-field profile-card-name';
  nameBlock.appendChild(nameLabel);
  nameBlock.appendChild(nameInput);

  const triggerBlock = document.createElement('div');
  triggerBlock.className = 'profile-card-field profile-card-trigger';
  triggerBlock.appendChild(triggerLabel);
  triggerBlock.appendChild(triggerWrap);

  const actionBlock = document.createElement('div');
  actionBlock.className = 'profile-card-field profile-card-action';
  actionBlock.appendChild(actionLabel);
  actionBlock.appendChild(actionTypeSelect);
  actionBlock.appendChild(smartLabel);

  const content = document.createElement('div');
  content.className = 'profile-card-content';
  content.appendChild(nameBlock);
  content.appendChild(triggerBlock);
  content.appendChild(actionBlock);

  card.appendChild(deleteBtn);
  card.appendChild(content);
  return card;
}

function renderProfilesTable(profiles, actions) {
  const grid = document.getElementById('profilesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  (profiles || []).forEach((p, idx) => {
    grid.appendChild(createProfileCard(p, idx, actions || {}, grid));
  });
}

function normalizeTriggerForUI(trigger) {
  if (!trigger || typeof trigger !== 'object') {
    return { kind: 'key', key: 'z', mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 };
  }
  const kind = 'key';
  const key = (trigger.kind === 'mods' || !trigger.key) ? 'z' : String(trigger.key).trim().toLowerCase() || 'z';
  const rawMods = {
    shift: !!(trigger.mods && trigger.mods.shift),
    alt: !!(trigger.mods && trigger.mods.alt),
    ctrl: !!(trigger.mods && trigger.mods.ctrl),
    meta: false
  };
  const mods = modsForKey(key, rawMods);
  return { kind, key, mods, mouseButton: Number.isInteger(trigger.mouseButton) ? trigger.mouseButton : 0 };
}

async function saveProfiles() {
  try {
    const data = await chrome.storage.local.get(['settings']);
    let settings = data.settings;
    if (!settings) settings = { actions: {}, blocked: [], profiles: [] };
    if (!settings.actions) settings.actions = {};
    const grid = document.getElementById('profilesGrid');
    if (!grid) return;
    const actionIds = Object.keys(settings.actions);
    const profiles = [];
    grid.querySelectorAll('.profile-card').forEach((card, idx) => {
      const nameInput = card.querySelector('.profile-name-input');
      const triggerDisplay = card.querySelector('.trigger-capture-input');
      const modsWrap = card.querySelector('.modifier-group');
      const actionTypeSelect = card.querySelector('select');
      const smartCheckbox = card.querySelector('.smart-checkbox');
      if (!nameInput || !triggerDisplay || !actionTypeSelect) return;
      const name = nameInput.value.trim() || 'Profile ' + (idx + 1);
      let trigger;
      try {
        trigger = JSON.parse(triggerDisplay.dataset.trigger || '{}');
      } catch (_) {
        trigger = { kind: 'key', key: 'z', mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 };
      }
      trigger = normalizeTriggerForUI(trigger);
      if (modsWrap) {
        const mods = { shift: false, alt: false, ctrl: false, meta: false };
        modsWrap.querySelectorAll('.trigger-mod-checkbox').forEach((cb) => {
          const k = cb.dataset.mod;
          if (k) mods[k] = cb.checked;
        });
        trigger.mods = modsForKey(trigger.key || 'z', mods);
      }
      const safeTrigger = { ...trigger, kind: 'key', key: String(trigger.key || 'z').trim().toLowerCase() };
      const actionType = ACTION_TYPES.some((t) => t.value === actionTypeSelect.value) ? actionTypeSelect.value : 'tabs';
      const smart = smartCheckbox ? smartCheckbox.checked : false;
      let actionId = card.dataset.actionId || '';
      if (!actionId || !settings.actions[actionId]) {
        actionId = getNextActionId(settings.actions);
        const colors = { tabs: '#FFA500', copy: '#3b82f6', export: '#22c55e', bm: '#8b5cf6', win: '#f59e0b' };
        settings.actions[actionId] = {
          mouse: 0,
          key: 90,
          action: actionType,
          color: colors[actionType] || colors.tabs,
          options: defaultActionOptions(smart ? 1 : 0)
        };
      } else {
        settings.actions[actionId].action = actionType;
        if (settings.actions[actionId].options) {
          settings.actions[actionId].options.smart = smart ? 1 : 0;
        } else {
          settings.actions[actionId].options = defaultActionOptions(smart ? 1 : 0);
        }
      }
      profiles.push({
        id: 'p' + (idx + 1),
        name,
        trigger: safeTrigger,
        actionId
      });
    });
    settings.profiles = profiles;
    await chrome.storage.local.set({ settings });
    chrome.runtime.sendMessage({ message: 'update', settings });
    const btn = document.getElementById('saveProfilesBtn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Saved!';
      btn.style.background = 'var(--success)';
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
    }
  } catch (e) {
    console.error('Error saving profiles:', e);
  }
}

// Set up save handlers
function setupSaveHandlers() {
  const saveSettingsBtn = document.getElementById('saveSettings');
  const saveAdvancedBtn = document.getElementById('saveAdvanced');
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      await saveGeneralSettings();
    });
  }
  
  if (saveAdvancedBtn) {
    saveAdvancedBtn.addEventListener('click', async () => {
      await saveAdvancedSettings();
    });
  }

  const removeApiKeyBtn = document.getElementById('removeApiKeyBtn');
  if (removeApiKeyBtn) {
    removeApiKeyBtn.addEventListener('click', async () => {
      await chrome.storage.local.set({ dontpokeApiKey: '' });
      updateApiKeyUI('');
    });
  }

  const addProfileBtn = document.getElementById('addProfileBtn');
  const saveProfilesBtn = document.getElementById('saveProfilesBtn');
  if (addProfileBtn) {
    addProfileBtn.addEventListener('click', async () => {
      const grid = document.getElementById('profilesGrid');
      if (!grid) return;
      const data = await chrome.storage.local.get(['settings']);
      const actions = (data.settings && data.settings.actions) || {};
      const defaultTrigger = { kind: 'key', key: 'z', mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 };
      const newProfile = {
        name: 'New profile',
        trigger: defaultTrigger,
        actionId: ''
      };
      const idx = grid.querySelectorAll('.profile-card').length;
      const card = createProfileCard(newProfile, idx, actions, grid);
      grid.appendChild(card);
    });
  }
  if (saveProfilesBtn) {
    saveProfilesBtn.addEventListener('click', () => saveProfiles());
  }
}

// Save general settings (no-op: action and smart selection are per-profile under Profiles)
async function saveGeneralSettings() {
  // General section has no form fields; all settings are in Profiles and Advanced.
}

// Save advanced settings
async function saveAdvancedSettings() {
  try {
    if (!isValidRegex(document.getElementById('filterPattern').value.trim())) {
      return;
    }
    const data = await chrome.storage.local.get(['settings']);
    let settings = data.settings;
    
    if (!settings) {
      settings = { actions: {}, blocked: [] };
    }
    if (!settings.actions) {
      settings.actions = {};
    }

    const firstActionId = Object.keys(settings.actions)[0] || '101';
    if (settings.actions[firstActionId]) {
      if (!settings.actions[firstActionId].options) {
        settings.actions[firstActionId].options = {};
      }
      const patternInput = document.getElementById('filterPattern');
      const modeSelect = document.getElementById('filterMode');
      const caseInsensitiveCheckbox = document.getElementById('filterCaseInsensitive');
      settings.actions[firstActionId].options.filterPattern = patternInput ? patternInput.value.trim() : '';
      settings.actions[firstActionId].options.filterMode = modeSelect && modeSelect.value === 'include' ? 'include' : 'exclude';
      settings.actions[firstActionId].options.filterCaseInsensitive = caseInsensitiveCheckbox ? caseInsensitiveCheckbox.checked : true;
    }
    
    // Get blocklist
    const blocklistTextarea = document.getElementById('blocklist');
    if (blocklistTextarea) {
      const blocklist = blocklistTextarea.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      settings.blocked = blocklist;
    }

    const debugModeCheckbox = document.getElementById('debugMode');
    if (debugModeCheckbox) {
      settings.debugMode = debugModeCheckbox.checked;
    }

    // Save to storage
    await chrome.storage.local.set({ settings });

    const apiInputContainer = document.getElementById('api-input-container');
    const apiKeyInput = document.getElementById('dontpokeApiKey');
    const keyToSave = (apiInputContainer && apiInputContainer.style.display !== 'none' && apiKeyInput)
      ? apiKeyInput.value.trim() || ''
      : (await chrome.storage.local.get(['dontpokeApiKey'])).dontpokeApiKey || '';
    await chrome.storage.local.set({ dontpokeApiKey: keyToSave });
    updateApiKeyUI(keyToSave);

    // Notify background script
    chrome.runtime.sendMessage({
      message: 'update',
      settings: settings
    });

    // Show success feedback
    const btn = document.getElementById('saveAdvanced');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 2000);
  } catch (error) {
    console.error('Error saving advanced settings:', error);
  }
}
