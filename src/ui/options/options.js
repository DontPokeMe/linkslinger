function isValidRegex(pattern) {
  if (typeof pattern !== 'string' || !pattern.trim()) return true;
  try {
    new RegExp(pattern);
    return true;
  } catch (_) {
    return false;
  }
}

const TRIGGER_OPTIONS = [
  { value: "key:z", label: "Z", trigger: { kind: "key", key: "z", mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 } },
  { value: "mods:shift", label: "Shift", trigger: { kind: "mods", key: "", mods: { shift: true, alt: false, ctrl: false, meta: false }, mouseButton: 0 } },
  { value: "mods:alt", label: "Alt", trigger: { kind: "mods", key: "", mods: { shift: false, alt: true, ctrl: false, meta: false }, mouseButton: 0 } },
  { value: "mods:ctrl", label: "Ctrl", trigger: { kind: "mods", key: "", mods: { shift: false, alt: false, ctrl: true, meta: false }, mouseButton: 0 } },
  { value: "mods:meta", label: "Meta", trigger: { kind: "mods", key: "", mods: { shift: false, alt: false, ctrl: false, meta: true }, mouseButton: 0 } }
];

function triggerToDisplay(trigger) {
  if (!trigger) return "";
  if (trigger.kind === "key" && trigger.key) return (trigger.key.toUpperCase()) + " + Left drag";
  const m = trigger.mods || {};
  const parts = [];
  if (m.shift) parts.push("Shift");
  if (m.alt) parts.push("Alt");
  if (m.ctrl) parts.push("Ctrl");
  if (m.meta) parts.push("Meta");
  if (parts.length) return parts.join("+") + " + Left drag";
  return "Left drag";
}

function triggerToValue(trigger) {
  if (!trigger) return TRIGGER_OPTIONS[0].value;
  if (trigger.kind === "key" && trigger.key) return "key:" + trigger.key.toLowerCase();
  const m = trigger.mods || {};
  if (m.shift && !m.alt && !m.ctrl && !m.meta) return "mods:shift";
  if (m.alt && !m.shift && !m.ctrl && !m.meta) return "mods:alt";
  if (m.ctrl && !m.shift && !m.alt && !m.meta) return "mods:ctrl";
  if (m.meta && !m.shift && !m.alt && !m.ctrl) return "mods:meta";
  return TRIGGER_OPTIONS[0].value;
}

function getTriggerByValue(value) {
  const opt = TRIGGER_OPTIONS.find((o) => o.value === value);
  return opt ? opt.trigger : TRIGGER_OPTIONS[0].trigger;
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

// Navigation handling
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all nav items and sections
      navItems.forEach(nav => nav.classList.remove('active'));
      sections.forEach(section => section.classList.remove('active'));
      
      // Add active class to clicked nav item
      item.classList.add('active');
      
      // Show corresponding section
      const sectionId = item.getAttribute('data-section');
      const targetSection = document.getElementById(sectionId);
      if (targetSection) {
        targetSection.classList.add('active');
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
    const data = await chrome.storage.local.get(['settings']);
    
    if (data.settings && data.settings.actions) {
      // Find the first action to display default settings
      const firstActionId = Object.keys(data.settings.actions)[0];
      if (firstActionId) {
        const action = data.settings.actions[firstActionId];
        
        // Set activation key based on keyCode
        const activationKeySelect = document.getElementById('activationKey');
        if (activationKeySelect) {
          // Only Z key supported for now (keyCode 90)
          if (action.key === 90) {
            activationKeySelect.value = 'z';
          } else {
            // Default to Z if key doesn't match
            activationKeySelect.value = 'z';
          }
        }
        
        // Set default action
        const defaultActionRadios = document.querySelectorAll('input[name="defaultAction"]');
        defaultActionRadios.forEach(radio => {
          if (radio.value === action.action) {
            radio.checked = true;
          }
        });
        
        // Set smart select
        const smartSelectCheckbox = document.getElementById('smartSelect');
        if (smartSelectCheckbox) {
          smartSelectCheckbox.checked = action.options && action.options.smart === 1;
        }

        // Filter (regex)
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

function renderProfilesTable(profiles, actions) {
  const tbody = document.getElementById('profilesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const actionIds = Object.keys(actions || {});
  profiles.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.profileIndex = idx;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = p.name || 'Profile ' + (idx + 1);
    nameInput.placeholder = 'Name';
    const triggerSelect = document.createElement('select');
    TRIGGER_OPTIONS.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (triggerToValue(p.trigger) === opt.value) o.selected = true;
      triggerSelect.appendChild(o);
    });
    const actionSelect = document.createElement('select');
    actionIds.forEach((id) => {
      const o = document.createElement('option');
      o.value = id;
      const action = actions[id];
      const label = id + ' (' + (action && action.action ? action.action : 'tabs') + ')';
      o.textContent = label;
      if (p.actionId === id) o.selected = true;
      actionSelect.appendChild(o);
    });
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-profile';
    deleteBtn.textContent = 'Delete';
    deleteBtn.ariaLabel = 'Delete profile';
    deleteBtn.addEventListener('click', () => {
      if (tbody.querySelectorAll('tr').length <= 1) return;
      tr.remove();
    });
    tr.appendChild(document.createElement('td')).appendChild(nameInput);
    tr.appendChild(document.createElement('td')).appendChild(triggerSelect);
    tr.appendChild(document.createElement('td')).appendChild(actionSelect);
    tr.appendChild(document.createElement('td')).appendChild(deleteBtn);
    tbody.appendChild(tr);
  });
}

async function saveProfiles() {
  try {
    const data = await chrome.storage.local.get(['settings']);
    let settings = data.settings;
    if (!settings) settings = { actions: {}, blocked: [], profiles: [] };
    if (!settings.actions) settings.actions = {};
    const tbody = document.getElementById('profilesTableBody');
    if (!tbody) return;
    const actionIds = Object.keys(settings.actions);
    const profiles = [];
    tbody.querySelectorAll('tr').forEach((tr, idx) => {
      const nameInput = tr.querySelector('input[type="text"]');
      const triggerSelect = tr.querySelector('select:first-of-type');
      const actionSelect = tr.querySelector('select:last-of-type');
      if (!nameInput || !triggerSelect || !actionSelect) return;
      const name = nameInput.value.trim() || 'Profile ' + (idx + 1);
      const trigger = getTriggerByValue(triggerSelect.value);
      const actionId = actionIds.includes(actionSelect.value) ? actionSelect.value : actionIds[0] || '101';
      profiles.push({
        id: 'p' + (idx + 1),
        name,
        trigger: { ...trigger },
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

  const addProfileBtn = document.getElementById('addProfileBtn');
  const saveProfilesBtn = document.getElementById('saveProfilesBtn');
  if (addProfileBtn) {
    addProfileBtn.addEventListener('click', async () => {
      const tbody = document.getElementById('profilesTableBody');
      if (!tbody) return;
      const data = await chrome.storage.local.get(['settings']);
      const actions = data.settings?.actions || {};
      const actionIds = Object.keys(actions);
      const firstId = actionIds[0] || '101';
      const tr = document.createElement('tr');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = 'New profile';
      nameInput.placeholder = 'Name';
      const triggerSelect = document.createElement('select');
      TRIGGER_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === 'mods:ctrl') o.selected = true;
        triggerSelect.appendChild(o);
      });
      const actionSelect = document.createElement('select');
      actionIds.forEach((id) => {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = id + ' (' + (actions[id]?.action || 'tabs') + ')';
        if (id === firstId) o.selected = true;
        actionSelect.appendChild(o);
      });
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-profile';
      deleteBtn.textContent = 'Delete';
      deleteBtn.ariaLabel = 'Delete profile';
      deleteBtn.addEventListener('click', () => {
        if (tbody.querySelectorAll('tr').length <= 1) return;
        tr.remove();
      });
      tr.appendChild(document.createElement('td')).appendChild(nameInput);
      tr.appendChild(document.createElement('td')).appendChild(triggerSelect);
      tr.appendChild(document.createElement('td')).appendChild(actionSelect);
      tr.appendChild(document.createElement('td')).appendChild(deleteBtn);
      tbody.appendChild(tr);
    });
  }
  if (saveProfilesBtn) {
    saveProfilesBtn.addEventListener('click', () => saveProfiles());
  }
}

// Save general settings
async function saveGeneralSettings() {
  try {
    // Get current settings
    const data = await chrome.storage.local.get(['settings']);
    let settings = data.settings;
    
    if (!settings || !settings.actions) {
      console.error('No settings found');
      return;
    }
    
    // Get form values
    const activationKey = document.getElementById('activationKey').value;
    const defaultAction = document.querySelector('input[name="defaultAction"]:checked').value;
    const smartSelect = document.getElementById('smartSelect').checked;
    
    // Map activation key to keyCode
    // Only Z key supported for now
    let keyCode = 90; // Z key
    
    // Update first action (or create if doesn't exist)
    const firstActionId = Object.keys(settings.actions)[0] || '101';
    if (!settings.actions[firstActionId]) {
      settings.actions[firstActionId] = {
        mouse: 0,
        key: keyCode,
        action: defaultAction,
        color: '#3b82f6',
        options: {
          smart: smartSelect ? 1 : 0,
          ignore: [0],
          delay: 0,
          close: 0,
          block: true,
          reverse: false,
          end: false
        }
      };
    } else {
      settings.actions[firstActionId].key = keyCode;
      settings.actions[firstActionId].action = defaultAction;
      if (settings.actions[firstActionId].options) {
        settings.actions[firstActionId].options.smart = smartSelect ? 1 : 0;
      }
    }
    
    // Save to storage
    await chrome.storage.local.set({ settings });
    
    // Notify background script to broadcast update
    chrome.runtime.sendMessage({
      message: 'update',
      settings: settings
    });
    
    // Show success feedback
    const btn = document.getElementById('saveSettings');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 2000);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
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
    
    // Save to storage
    await chrome.storage.local.set({ settings });
    
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
