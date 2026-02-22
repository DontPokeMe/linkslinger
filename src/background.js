/********************
 * settings_manager.js (refactored for chrome.storage)
 ********************/

const CURRENT_VERSION = "5";
/** Schema version of the settings object; bump on migrations. */
const SETTINGS_SCHEMA_VERSION = 1;

function normKey(k) {
  if (typeof k !== "string") return "";
  const s = k.trim().toLowerCase();
  return s.length === 1 ? s : "";
}

function normMods(m) {
  return {
    shift: !!m?.shift,
    alt: !!m?.alt,
    ctrl: !!m?.ctrl,
    meta: !!m?.meta
  };
}

function triggerSig(t) {
  const btn = Number.isInteger(t.mouseButton) ? t.mouseButton : 0;
  if (t.kind === "key") return `key:${t.key}|btn:${btn}`;
  const mods = t.mods || {};
  return `mods:${+mods.shift}${+mods.alt}${+mods.ctrl}${+mods.meta}|btn:${btn}`;
}

class SettingsManager {
  constructor() {
    this._cache = null;
    this._version = null;
  }

  /**
   * Normalize settings: fill defaults, migrate old keys, remove invalid values.
   * Prevents schema drift and partial-write breakage. Always read-modify-write
   * the full settings object; use this before save and after load.
   * Pure and idempotent: does not mutate input; normalize(normalize(x)) === normalize(x).
   */
  normalizeSettings(settings) {
    if (!settings || typeof settings !== "object") {
      return this.initDefaults();
    }
    const out = {
      version: typeof settings.version === "number" ? settings.version : SETTINGS_SCHEMA_VERSION,
      actions: typeof settings.actions === "object" && settings.actions !== null ? { ...settings.actions } : {},
      blocked: Array.isArray(settings.blocked) ? settings.blocked.filter(b => typeof b === "string") : [],
      profiles: Array.isArray(settings.profiles) ? [...settings.profiles] : undefined
    };
    const defaultAction = this.initDefaults().actions["101"];
    for (const id of Object.keys(out.actions)) {
      const a = out.actions[id];
      if (!a || typeof a !== "object") {
        delete out.actions[id];
        continue;
      }
      var actionVal = a.action;
      if (actionVal === "window") actionVal = "win";
      out.actions[id] = {
        mouse: typeof a.mouse === "number" ? a.mouse : defaultAction.mouse,
        key: typeof a.key === "number" ? a.key : defaultAction.key,
        action: ["tabs", "win", "copy", "bm", "export"].includes(actionVal) ? actionVal : defaultAction.action,
        color: typeof a.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(a.color) ? a.color : defaultAction.color,
        options: {
          smart: a.options && (a.options.smart === 0 || a.options.smart === 1) ? a.options.smart : defaultAction.options.smart,
          ignore: Array.isArray(a.options && a.options.ignore) ? a.options.ignore : defaultAction.options.ignore,
          delay: typeof (a.options && a.options.delay) === "number" ? a.options.delay : defaultAction.options.delay,
          close: typeof (a.options && a.options.close) === "number" ? a.options.close : defaultAction.options.close,
          block: typeof (a.options && a.options.block) === "boolean" ? a.options.block : defaultAction.options.block,
          reverse: typeof (a.options && a.options.reverse) === "boolean" ? a.options.reverse : defaultAction.options.reverse,
          end: typeof (a.options && a.options.end) === "boolean" ? a.options.end : defaultAction.options.end,
          filterPattern: typeof (a.options && a.options.filterPattern) === "string" ? a.options.filterPattern : "",
          filterMode: (a.options && a.options.filterMode === "include") ? "include" : "exclude",
          filterCaseInsensitive: typeof (a.options && a.options.filterCaseInsensitive) === "boolean" ? a.options.filterCaseInsensitive : true,
          copy: typeof (a.options && a.options.copy) === "number" && a.options.copy >= 0 && a.options.copy <= 6 ? a.options.copy : 1
        }
      };
    }
    if (Object.keys(out.actions).length === 0) {
      out.actions = { "101": defaultAction };
    }
    // Ensure Bookmark action (104) exists for store compliance and existing users
    const defs = this.initDefaults();
    if (!out.actions["104"]) {
      out.actions["104"] = defs.actions["104"];
    }

    const actionIds = Object.keys(out.actions);
    const firstActionId = actionIds[0] || "101";

    if (!Array.isArray(out.profiles) || out.profiles.length === 0) {
      out.profiles = [
        {
          id: "p1",
          name: "Default",
          trigger: {
            kind: "key",
            key: "z",
            mods: { shift: false, alt: false, ctrl: false, meta: false },
            mouseButton: 0
          },
          actionId: firstActionId
        }
      ];
    } else {
      const seen = new Set();
      out.profiles = out.profiles
        .map((p, idx) => {
          const trigger = p?.trigger || {};
          const kind = trigger.kind === "mods" ? "mods" : "key";
          const key = kind === "key" ? normKey(trigger.key) : "";
          const mods = kind === "mods" ? normMods(trigger.mods) : normMods({});
          const mouseButton = Number.isInteger(trigger.mouseButton) ? trigger.mouseButton : 0;
          const actionId = String(p?.actionId || firstActionId);
          const validActionId = out.actions[actionId] ? actionId : firstActionId;
          const cleaned = {
            id: typeof p?.id === "string" && p.id ? p.id : `p${idx + 1}`,
            name: typeof p?.name === "string" && p.name ? p.name : `Profile ${idx + 1}`,
            trigger: { kind, key, mods, mouseButton },
            actionId: validActionId
          };
          if (cleaned.trigger.kind === "key" && !cleaned.trigger.key) cleaned.trigger.key = "z";
          return cleaned;
        })
        .filter((p) => {
          const sig = triggerSig(p.trigger);
          if (seen.has(sig)) return false;
          seen.add(sig);
          return true;
        });

      // Ensure "no key" fallback exists so left-drag works when key events never reach the page
      const noKeySig = "mods:0000|btn:0";
      if (!seen.has(noKeySig)) {
        out.profiles.push({
          id: "p0-no-key",
          name: "Default (no key)",
          trigger: { kind: "mods", key: "", mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 },
          actionId: firstActionId
        });
        seen.add(noKeySig);
      }

      if (out.profiles.length === 0) {
        out.profiles = [
          {
            id: "p1",
            name: "Default",
            trigger: { kind: "key", key: "z", mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 },
            actionId: firstActionId
          }
        ];
      }
    }

    return out;
  }

  async load() {
    const data = await this._getStorageData(["settings", "version"]);
    this._version = data.version;
    if (data.settings) {
      this._cache = this.normalizeSettings(data.settings);
      return this._cache;
    }
    const defaults = this.initDefaults();
    await this.save(defaults);
    return defaults;
  }

  async save(settings) {
    if (settings && settings.error) {
      delete settings.error;
    }
    const normalized = this.normalizeSettings(settings);
    await this._setStorageData({ settings: normalized });
    this._cache = normalized;
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

  initDefaults() {
    const defaults = {
      version: SETTINGS_SCHEMA_VERSION,
      actions: {
        "101": {
          mouse: 0,
          key: 90,
          action: "tabs",
          color: "#FFA500",
          options: {
            smart: 0,
            ignore: [0],
            delay: 0,
            close: 0,
            block: true,
            reverse: false,
            end: false,
            filterPattern: "",
            filterMode: "exclude",
            filterCaseInsensitive: true
          }
        },
        "102": {
          mouse: 0,
          key: 90,
          action: "copy",
          color: "#3b82f6",
          options: {
            smart: 0,
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
          }
        },
        "103": {
          mouse: 0,
          key: 90,
          action: "export",
          color: "#22c55e",
          options: {
            smart: 0,
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
          }
        },
        "104": {
          mouse: 0,
          key: 90,
          action: "bm",
          color: "#8b5cf6",
          options: {
            smart: 0,
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
          }
        }
      },
      blocked: [],
      profiles: [
        { id: "p1", name: "Default", trigger: { kind: "key", key: "z", mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "101" },
        { id: "p2", name: "Default (Shift)", trigger: { kind: "mods", key: "", mods: { shift: true, alt: false, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "101" },
        { id: "p3", name: "Default (no key)", trigger: { kind: "mods", key: "", mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "101" },
        { id: "p4", name: "Copy", trigger: { kind: "mods", key: "", mods: { shift: false, alt: true, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "102" },
        { id: "p5", name: "Export", trigger: { kind: "mods", key: "", mods: { shift: false, alt: false, ctrl: false, meta: true }, mouseButton: 0 }, actionId: "103" },
        { id: "p6", name: "Bookmark", trigger: { kind: "mods", key: "", mods: { shift: false, alt: false, ctrl: true, meta: false }, mouseButton: 0 }, actionId: "104" }
      ]
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
      if (typeof console !== "undefined" && console.warn) {
        console.warn("LinkSlinger: settings migration applied (version bump).");
      }
      const normalized = this.normalizeSettings(data.settings);
      await this._setStorageData({ settings: normalized, version: CURRENT_VERSION });
      this._cache = normalized;
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

/**
 * Copy to Clipboard using Offscreen Document Pattern
 * 
 * Per Midori's Migration Guide Section 2.4:
 * Service workers cannot access navigator.clipboard directly.
 * We use an offscreen document to provide DOM context for clipboard operations.
 */
async function copyToClipboard(text) {
  try {
    // Check if offscreen document already exists
    const clients = await chrome.offscreen.hasDocument();
    
    if (!clients) {
      // Create offscreen document for clipboard operations
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['CLIPBOARD'],
        justification: 'Copy links to clipboard for LinkSlinger extension'
      });
    }

    // Send message to offscreen document to perform clipboard operation
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'copy-to-clipboard',
      text: text
    });

    if (!response || !response.success) {
      console.error('LinkSlinger: Clipboard operation failed:', response?.error);
    }
  } catch (error) {
    console.error('LinkSlinger: Failed to copy to clipboard:', error);
    // Fallback: Try direct clipboard API (may work in some contexts)
    try {
      await navigator.clipboard.writeText(text);
    } catch (fallbackError) {
      console.error('LinkSlinger: Fallback clipboard also failed:', fallbackError);
    }
  }
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

// ——— Bookmark action: save selected links under Bookmarks Bar → LinkSlinger → YYYY-MM-DD ———
function findBookmarksBar(tree) {
  if (!tree || !tree[0]) return null;
  let found = null;
  (function walk(node) {
    if (!node) return;
    if (node.id === "1") found = node;
    if (node.title && node.title.toLowerCase().includes("bookmarks bar")) found = node;
    if (node.children) node.children.forEach(walk);
  })(tree[0]);
  return found;
}

async function ensureFolder(parentId, title) {
  const kids = await chrome.bookmarks.getChildren(parentId);
  const existing = kids.find((k) => !k.url && k.title === title);
  if (existing) return existing.id;
  const created = await chrome.bookmarks.create({ parentId, title });
  return created.id;
}

async function handleBookmarkAction(urls) {
  const raw = urls || [];
  const safe = raw.map((u) => (u && typeof u.url === "string" ? u.url : typeof u === "string" ? u : "")).filter((u) => /^https?:\/\//i.test(u));

  const tree = await chrome.bookmarks.getTree();
  const bar = findBookmarksBar(tree);
  const rootId = bar?.id || "1";

  const lsFolderId = await ensureFolder(rootId, "LinkSlinger");
  const dateTitle = new Date().toISOString().slice(0, 10);
  const dateFolderId = await ensureFolder(lsFolderId, dateTitle);

  const existing = await chrome.bookmarks.getChildren(dateFolderId);
  const existingSet = new Set(existing.filter((n) => n.url).map((n) => n.url));

  let added = 0;
  let skipped = 0;
  for (const url of safe) {
    if (existingSet.has(url)) {
      skipped++;
      continue;
    }
    let title;
    try {
      const u = new URL(url);
      title = u.hostname || url;
    } catch (e) {
      title = url;
    }
    await chrome.bookmarks.create({ parentId: dateFolderId, title, url });
    added++;
    existingSet.add(url);
  }

  if (typeof console !== "undefined" && console.log) {
    console.log("LinkSlinger: Bookmark action — added:", added, "skipped:", skipped, "total:", safe.length);
  }
  return { added, skipped, total: safe.length };
}

async function handleRequests(request, sender, sendResponse) {
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
        case "bm": {
          const result = await handleBookmarkAction(request.urls);
          if (typeof console !== "undefined" && console.log) {
            console.log("LinkSlinger: Bookmark —", result.added, "added,", result.skipped, "skipped");
          }
          break;
        }
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
        case "export":
          if (typeof console !== "undefined" && console.log) {
            console.log("LinkSlinger: Export (stub) —", request.urls.length, "links. Sprint 2C will add downloads.");
          }
          break;
      }
      break;

    case "init":
      // Return the loaded settings (synchronous callback for compatibility)
      if (sendResponse) {
        sendResponse(currentSettings);
      }
      return currentSettings;

    case "update": {
      // Never store or broadcast raw settings: normalize first so trigger.key is always lowercase
      const normalized = settingsManager.normalizeSettings(request.settings);
      await settingsManager._setStorageData({ settings: normalized });
      settingsManager._cache = normalized;
      broadcastUpdatedSettings();
      break;
    }
  }
}

// Broadcast updated settings to all tabs
async function broadcastUpdatedSettings() {
  const newSettings = await settingsManager.load();
  chrome.windows.getAll({ populate: true }, (windowList) => {
    windowList.forEach((win) => {
      win.tabs.forEach((tab) => {
        // Skip non-http(s) URLs (chrome://, extension://, etc.)
        if (!tab.url || !/^https?:\/\//.test(tab.url)) return;
        
        // Skip chrome:// and extension:// pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
        
        chrome.tabs.sendMessage(tab.id, {
          message: "update",
          settings: newSettings
        }).catch((error) => {
          // Silently ignore errors for tabs without content script listeners
          // This is normal for tabs that don't have the extension's content script loaded
          // or tabs that have been closed/reloaded
        });
      });
    });
  });
}

// In MV3, use chrome.runtime.onMessage
// Note: In MV3, sendResponse must be called synchronously or return true to keep channel open
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // handleRequests is async, so we need to handle it properly
  if (request.message === "init") {
    // For init messages, we need to send a response asynchronously
    handleRequests(request, sender, sendResponse).catch((error) => {
      console.error("Error handling init request:", error);
      if (typeof sendResponse === 'function') {
        try {
          sendResponse({ error: error.message });
        } catch (e) {
          // Response already sent or channel closed - this is normal
        }
      }
    });
    return true; // Keep channel open for async response
  } else {
    // For other messages, no response needed
    handleRequests(request, sender, sendResponse).catch((error) => {
      console.error("Error handling request:", error);
    });
    return false;
  }
});

// Context menu: "Inspect with LinkSlinger" → open dontpoke.me link expander with URL
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "linkslinger-inspect",
      title: "Inspect with LinkSlinger",
      contexts: ["link"]
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "linkslinger-inspect" || !info.linkUrl) return;
  const raw = info.linkUrl.trim();
  if (!/^https?:\/\//i.test(raw)) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("LinkSlinger: Inspect skipped — only http/https links are supported.", raw.slice(0, 50));
    }
    return;
  }
  const url = "https://dontpoke.me/tools/link-expander?url=" + encodeURIComponent(raw);
  chrome.tabs.create({ url });
});

// On startup, do an async check for initialization or updates
(async function initExtension() {
  setupContextMenu();
  if (!await settingsManager.isInit()) {
    console.log("Settings not initialized, setting defaults...");
    await settingsManager.init();

    // Inject content.js into all current windows/tabs
    // Note: Content scripts are auto-injected via manifest.json, but we inject into existing tabs on install/update
    chrome.windows.getAll({ populate: true }, (windows) => {
      windows.forEach((win) => {
        win.tabs.forEach((tab) => {
          // Skip non-http(s) URLs (chrome://, extension://, etc.)
          if (!tab.url || !/^https?:\/\//.test(tab.url)) return;
          
          // Skip chrome:// and extension:// pages
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
          
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          }).catch((error) => {
            // Silently ignore errors for tabs we can't access (chrome:// pages, etc.)
            // Content scripts will be injected automatically for new tabs via manifest.json
            console.log(`Could not inject into tab ${tab.id}: ${error.message}`);
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
