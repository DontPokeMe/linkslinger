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
      }
    }
    
    // Load blocklist
    if (data.settings && data.settings.blocked) {
      const blocklistTextarea = document.getElementById('blocklist');
      if (blocklistTextarea) {
        blocklistTextarea.value = data.settings.blocked.join('\n');
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
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
    const data = await chrome.storage.local.get(['settings']);
    let settings = data.settings;
    
    if (!settings) {
      settings = { actions: {}, blocked: [] };
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
