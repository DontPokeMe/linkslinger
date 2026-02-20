/********************
 * settings_manager.js (refactored for chrome.storage)
 ********************/

const CURRENT_VERSION = "5";

class SettingsManager {
  // Use a constructor to hold an in-memory cache, if desired
  constructor() {
    this._cache = null; // optional: store the last loaded settings in memory
    this._version = null;
  }

  // Load settings + version from chrome.storage.local
  // Returns a Promise that resolves with the settings object
  async load() {
    const data = await this._getStorageData(["settings", "version"]);
    this._version = data.version;
    if (data.settings) {
      this._cache = data.settings;
      return this._cache;
    } else {
      // If not found, initialize defaults
      const defaults = this.initDefaults();
      await this.save(defaults);
      return defaults;
    }
  }

  // Save the provided settings to chrome.storage.local
  async save(settings) {
    // remove any error messages from the object if needed
    if (settings && settings.error) {
      delete settings.error;
    }

    // store them
    await this._setStorageData({ settings });
    this._cache = settings;
  }

  // Check if we have a "version" in storage to see if it’s "initialized"
  async isInit() {
    const data = await this._getStorageData(["version"]);
    return (typeof data.version !== "undefined");
  }

  // Check if version in storage matches CURRENT_VERSION
  async isLatest() {
    const data = await this._getStorageData(["version"]);
    return data.version === CURRENT_VERSION;
  }

  // Initialize the default settings object
  // This does NOT automatically persist them
  initDefaults() {
    // same object you had in your old init() method
    const defaults = {
      "actions": {
        "101": {
          "mouse": 0,  // left mouse button
          "key": 90,   // z key
          "action": "tabs",
          "color": "#FFA500",
          "options": {
            "smart": 0,
            "ignore": [0],
            "delay": 0,
            "close": 0,
            "block": true,
            "reverse": false,
            "end": false
          }
        }
      },
      "blocked": []
    };

    return defaults;
  }

  // Initialize storage with default settings + CURRENT_VERSION
  async init() {
    const defaults = this.initDefaults();
    await this._setStorageData({
      settings: defaults,
      version: CURRENT_VERSION
    });
    this._cache = defaults;
    this._version = CURRENT_VERSION;
    return defaults;
  }

  // Migrate or fill in missing fields if version changed
  async update() {
    if (!await this.isInit()) {
      // If not even initialized, do so
      await this.init();
      return;
    }

    // If we’re behind the CURRENT_VERSION, fill in any needed fields
    const data = await this._getStorageData(["settings", "version"]);
    if (data.version !== CURRENT_VERSION) {
      // do your migration logic here, or just re-init
      await this._setStorageData({ version: CURRENT_VERSION });
    }
  }

  // Helper: read from chrome.storage.local
  _getStorageData(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (res) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(res);
        }
      });
    });
  }

  // Helper: write to chrome.storage.local
  _setStorageData(obj) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}


/********************
 * background.js (Service Worker)
 ********************/

var settingsManager = new SettingsManager();

/**
 * Utility: ensure list of URL objects is unique
 *   [
 *     { url: "...", title: "..." },
 *     { url: "...", title: "..." }
 *   ]
 */
Array.prototype.unique = function() {
  const uniqueArray = [];
  for (let i = 0; i < this.length; i++) {
    for (let j = i + 1; j < this.length; j++) {
      if (this[i].url === this[j].url) {
        j = ++i;
      }
    }
    uniqueArray.push(this[i]);
  }
  return uniqueArray;
};

function openTab(urls, delay, windowId, openerTabId, tabPosition, closeTime) {
  const obj = {
    windowId,
    url: urls.shift().url,
    active: false
  };

  if (!delay) {
    obj.openerTabId = openerTabId;
  }

  if (tabPosition != null) {
    obj.index = tabPosition;
    tabPosition++;
  }

  chrome.tabs.create(obj, function(tab) {
    if (closeTime > 0) {
      setTimeout(() => chrome.tabs.remove(tab.id), closeTime * 1000);
    }
  });

  if (urls.length > 0) {
    setTimeout(() => {
      openTab(urls, delay, windowId, openerTabId, tabPosition, closeTime);
    }, delay * 1000);
  }
}

// Use the Navigator Clipboard API in the service worker
function copyToClipboard(text) {
  // Requires "clipboardWrite" permission in manifest.json
  navigator.clipboard.writeText(text).catch(err => {
    console.error("Failed to copy text:", err);
  });
}

function pad(number, length) {
  let str = "" + number;
  while (str.length < length) {
    str = "0" + str;
  }
  return str;
}

function timeConverter(a) {
  const year = a.getFullYear();
  const month = pad(a.getMonth() + 1, 2);
  const day = pad(a.getDate(), 2);
  const hour = pad(a.getHours(), 2);
  const min = pad(a.getMinutes(), 2);
  const sec = pad(a.getSeconds(), 2);
  return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
}

// Link copy formats
const URLS_WITH_TITLES = 0;
const URLS_ONLY = 1;
const URLS_ONLY_SPACE_SEPARATED = 2;
const TITLES_ONLY = 3;
const AS_LINK_HTML = 4;
const AS_LIST_LINK_HTML = 5;
const AS_MARKDOWN = 6;

function formatLink({ url, title }, copyFormat) {
  switch (parseInt(copyFormat, 10)) {
    case URLS_WITH_TITLES:
      return title + "\t" + url + "\n";
    case URLS_ONLY:
      return url + "\n";
    case URLS_ONLY_SPACE_SEPARATED:
      return url + " ";
    case TITLES_ONLY:
      return title + "\n";
    case AS_LINK_HTML:
      return `<a href="${url}">${title}</a>\n`;
    case AS_LIST_LINK_HTML:
      return `<li><a href="${url}">${title}</a></li>\n`;
    case AS_MARKDOWN:
      return `[${title}](${url})\n`;
  }
}

async function handleRequests(request, sender, callback) {
  // We want to load the settings before responding, to ensure we have the latest
  let currentSettings = await settingsManager.load();

  switch (request.message) {
    case "activate":
      if (request.setting.options.block) {
        request.urls = request.urls.unique();
      }
      if (request.urls.length === 0) {
        return;
      }
      if (request.setting.options.reverse) {
        request.urls.reverse();
      }

      switch (request.setting.action) {
        case "copy": {
          let text = "";
          for (let i = 0; i < request.urls.length; i++) {
            text += formatLink(request.urls[i], request.setting.options.copy);
          }
          if (request.setting.options.copy === AS_LIST_LINK_HTML) {
            text = `<ul>\n${text}</ul>\n`;
          }
          copyToClipboard(text);
          break;
        }
        case "bm":
          chrome.bookmarks.getTree((bookmarkTreeNodes) => {
            chrome.bookmarks.create(
              {
                parentId: bookmarkTreeNodes[0].children[1].id, 
                title: "LinkSlinger " + timeConverter(new Date())
              },
              function(newFolder) {
                request.urls.forEach((u) => {
                  chrome.bookmarks.create({
                    parentId: newFolder.id,
                    title: u.title,
                    url: u.url
                  });
                });
              }
            );
          });
          break;
        case "win":
          chrome.windows.getCurrent((currentWindow) => {
            chrome.windows.create(
              {
                url: request.urls.shift().url,
                focused: !request.setting.options.unfocus
              },
              (newWindow) => {
                if (request.urls.length > 0) {
                  openTab(
                    request.urls,
                    request.setting.options.delay,
                    newWindow.id,
                    undefined,
                    null,
                    0
                  );
                }
              }
            );
            if (request.setting.options.unfocus) {
              chrome.windows.update(currentWindow.id, { focused: true });
            }
          });
          break;
        case "tabs":
          chrome.tabs.get(sender.tab.id, (tab) => {
            chrome.windows.getCurrent((window) => {
              let tab_index = null;
              if (!request.setting.options.end) {
                tab_index = tab.index + 1;
              }
              openTab(
                request.urls,
                request.setting.options.delay,
                window.id,
                tab.id,
                tab_index,
                request.setting.options.close
              );
            });
          });
          break;
      }
      break;

    case "init":
      // Return the loaded settings
      if (callback) {
        callback(currentSettings);
      }
      break;

    case "update":
      // Save new settings, then broadcast them to all tabs
      await settingsManager.save(request.settings);
      broadcastUpdatedSettings();
      break;
  }
}

// Broadcast updated settings to all tabs
async function broadcastUpdatedSettings() {
  const newSettings = await settingsManager.load();
  chrome.windows.getAll({ populate: true }, (windowList) => {
    windowList.forEach((win) => {
      win.tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          message: "update",
          settings: newSettings
        });
      });
    });
  });
}

// In MV3, use chrome.runtime.onMessage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // handleRequests is async, so we need to handle it properly
  if (request.message === "init") {
    // For init messages, we need to send a response
    handleRequests(request, sender, sendResponse).then(() => {
      // Response sent in handleRequests via callback
    });
    return true; // Keep channel open for async response
  } else {
    // For other messages, no response needed
    handleRequests(request, sender, sendResponse);
    return false;
  }
});

// On startup, do an async check for initialization or updates
(async function initExtension() {
  if (!await settingsManager.isInit()) {
    console.log("Settings not initialized, setting defaults...");
    await settingsManager.init();

    // Inject content.js into all current windows/tabs
    chrome.windows.getAll({ populate: true }, (windows) => {
      windows.forEach((win) => {
        win.tabs.forEach((tab) => {
          if (!/^https?:\/\//.test(tab.url)) return;
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          });
        });
      });
    });

    // Open options page for new user
    const optionsUrl = chrome.runtime.getURL("ui/options/options.html?init=true");
    chrome.windows.create({
      url: optionsUrl,
      width: 900,
      height: 700
    });
  } else if (!await settingsManager.isLatest()) {
    console.log("Settings version mismatch, performing update...");
    await settingsManager.update();
  } else {
    console.log("Settings up to date.");
  }
})();
