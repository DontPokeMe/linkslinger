const END_KEYCODE = 35;
const HOME_KEYCODE = 36;
const Z_INDEX = 2147483647;
const OS_WIN = 1;
const OS_LINUX = 0;
const LEFT_BUTTON = 0;
const EXCLUDE_LINKS = 0;
const INCLUDE_LINKS = 1;

var settings = null;
var setting = -1;
var activeActionId = null;
var key_pressed = 0;
var heldKey = "";
var heldMods = { shift: false, alt: false, ctrl: false, meta: false };
var mouse_button = null;
var stop_menu = false;
var box_on = false;
var smart_select = false;
var mouse_x = -1;
var mouse_y = -1;
var scroll_id = 0;
var links = [];
var box = null;
var count_label = null;
var overlay = null;
var currentSelectionColor = "#3b82f6";
var linkFilterRegex = null;
var linkFilterMode = "exclude";
var linkFilterCaseInsensitive = true;
var isFilterBroken = false;
var scroll_bug_ignore = false;
var os = ((navigator.appVersion.indexOf("Win") === -1) ? OS_LINUX : OS_WIN);
var timer = 0;

// Late-arm support (key trigger only)
var mouseIsDown = false;
var lateArmTimer = 0;
var lateArmStartX = 0;
var lateArmStartY = 0;
var lateArmButton = LEFT_BUTTON;

// Debug Mode is controlled by settings.debugMode (Options → Advanced → Debug Mode).

// Attach listeners immediately so selection works even if init callback is delayed (e.g. service worker cold start).
function attachListeners() {
  if (window.__linkslingerListenersAttached) return;
  window.__linkslingerListenersAttached = true;
  window.addEventListener("mousedown", mousedown, true);
  window.addEventListener("keydown", keydown, true);
  window.addEventListener("keyup", keyup, true);
  window.addEventListener("blur", blur, true);
  window.addEventListener("contextmenu", contextmenu, true);
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("keyup", keyup, true);
}
attachListeners();

chrome.runtime.sendMessage({ message: "init" }, function(response) {
  if (chrome.runtime.lastError) {
    console.error("LinkSlinger: Error loading settings:", chrome.runtime.lastError.message);
    return;
  }
  if (response === null || response === undefined) {
    console.error("LinkSlinger: Null response from init");
    return;
  }
  if (response.hasOwnProperty("error")) {
    console.error("LinkSlinger: Init error:", response.error);
    return;
  }
  if (!response.actions || typeof response.actions !== "object") {
    console.error("LinkSlinger: Invalid settings structure");
    return;
  }

  settings = response;
  applySelectionColorFromSettings();
  applyFilterFromSettings();

  var allowed = true;
  if (settings.blocked && Array.isArray(settings.blocked)) {
    for (var i in settings.blocked) {
      if (settings.blocked[i] === "") continue;
      try {
        var re = new RegExp(settings.blocked[i], "i");
        if (re.test(window.location.href)) { allowed = false; break; }
      } catch (e) { /* skip invalid regex */ }
    }
  }
  if (allowed && settings.actions) {
    console.log("LinkSlinger: Settings loaded");
  }
});

// Changed from chrome.extension.onMessage to chrome.runtime.onMessage
chrome.runtime.onMessage.addListener(function(request, sender, callback) {
  if (request.message === "update") {
    settings = request.settings;
    // QA: verify normalized profiles reach content script (remove for release)
    if (typeof console !== "undefined" && console.log) {
      console.log("LinkSlinger settings.profiles", settings.profiles);
    }
    applySelectionColorFromSettings();
    applyFilterFromSettings();
    if (box) {
      box.style.setProperty("--ls-box-color", currentSelectionColor);
      if (count_label) count_label.style.setProperty("--ls-box-color", currentSelectionColor);
    }
  }
});

var DEFAULT_SELECTION_COLOR = "#3b82f6";

function normalizeHexColor(value) {
  if (typeof value !== "string" || !value) return DEFAULT_SELECTION_COLOR;
  var hex = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) return "#" + hex;
  return DEFAULT_SELECTION_COLOR;
}

function getActiveActionCfg() {
  if (activeActionId && settings?.actions?.[activeActionId]) return settings.actions[activeActionId];
  var firstId = Object.keys(settings?.actions || {})[0];
  return firstId ? settings.actions[firstId] : null;
}

function normalizeKeyForContent(k) {
  if (typeof k !== "string") return "";
  var s = k.trim().toLowerCase();
  return s.length >= 1 ? s : "";
}

function triggerSigContent(t) {
  var btn = Number.isInteger(t.mouseButton) ? t.mouseButton : 0;
  var m = t.mods || {};
  var modStr = (+m.shift) + "" + (+m.alt) + (+m.ctrl) + (+m.meta);
  if (t.kind === "key" && t.key) return "key:" + normalizeKeyForContent(t.key) + "|mods:" + modStr + "|btn:" + btn;
  return "mods:" + modStr + "|btn:" + btn;
}

function resolveActiveActionId(mouseButton, e) {
  var profiles = Array.isArray(settings?.profiles) ? settings.profiles : [];
  var actions = settings?.actions;
  if (!profiles.length) {
    if (actions && Object.keys(actions).length > 0 && mouseButton === LEFT_BUTTON) {
      return Object.keys(actions)[0];
    }
    return null;
  }
  if (heldKey) {
    var m = heldMods || {};
    var modStr = (+m.shift) + "" + (+m.alt) + (+m.ctrl) + (+m.meta);
    var sig = "key:" + heldKey + "|mods:" + modStr + "|btn:" + mouseButton;
    for (var i = 0; i < profiles.length; i++) {
      var p = profiles[i];
      if (p?.trigger && triggerSigContent(p.trigger) === sig && settings.actions?.[p.actionId]) return p.actionId;
    }
  }
  // Match modifier-only profiles: Shift/Ctrl/Alt/Meta only active when set as part of a trigger.
  var mods = { shift: !!e.shiftKey, alt: !!e.altKey, ctrl: !!e.ctrlKey, meta: !!e.metaKey };
  var modSig = "mods:" + (+mods.shift) + (+mods.alt) + (+mods.ctrl) + (+mods.meta) + "|btn:" + mouseButton;
  for (var j = 0; j < profiles.length; j++) {
    var q = profiles[j];
    if (q?.trigger && triggerSigContent(q.trigger) === modSig && settings.actions?.[q.actionId]) return q.actionId;
  }
  return null;
}

function applySelectionColorFromSettings() {
  var cfg = getActiveActionCfg();
  if (cfg && cfg.color) currentSelectionColor = normalizeHexColor(cfg.color);
}

function applyFilterFromSettings(optionalActionId) {
  var cfg = optionalActionId && settings?.actions?.[optionalActionId] ? settings.actions[optionalActionId] : getActiveActionCfg();
  if (!cfg || !cfg.options) {
    linkFilterRegex = null;
    linkFilterMode = "exclude";
    linkFilterCaseInsensitive = true;
    isFilterBroken = false;
    return;
  }
  var opts = cfg.options;
  var pattern = typeof opts.filterPattern === "string" ? opts.filterPattern.trim() : "";
  linkFilterMode = opts.filterMode === "include" ? "include" : "exclude";
  linkFilterCaseInsensitive = opts.filterCaseInsensitive !== false;
  if (!pattern) {
    linkFilterRegex = null;
    isFilterBroken = false;
    return;
  }
  try {
    linkFilterRegex = new RegExp(pattern, linkFilterCaseInsensitive ? "i" : "");
    isFilterBroken = false;
  } catch (e) {
    if (typeof console !== "undefined" && console.error) {
      console.error("LinkSlinger: Invalid regex filter from settings.", e);
    }
    linkFilterRegex = null;
    isFilterBroken = true;
  }
}

function shouldSelectLink(url) {
  if (isFilterBroken) return true;
  if (!linkFilterRegex) return true;
  var matches = linkFilterRegex.test(url);
  return linkFilterMode === "include" ? matches : !matches;
}

function mousemove(event) {
  prevent_escalation(event);

  if (allow_selection() || scroll_bug_ignore) {
    scroll_bug_ignore = false;
    update_box(event.pageX, event.pageY);

    // while detect keeps on calling false then recall the method
    while (!detech(event.pageX, event.pageY, false)) {
      // empty
    }
  } else {
    // only stop if the mouseup timer is no longer set
    if (timer === 0) {
      stop();
    }
  }
}

function clean_up() {
  // remove the box
  box.style.visibility = "hidden";
  count_label.style.visibility = "hidden";
  box_on = false;

  // remove the link boxes
  for (var i = 0; i < links.length; i++) {
    if (links[i].box !== null) {
      document.body.removeChild(links[i].box);
      links[i].box = null;
    }
  }
  links = [];

  // wipe clean the smart select
  smart_select = false;
  mouse_button = -1;
  key_pressed = 0;
}

function resolveKeyTriggeredActionId(mouseButton) {
  if (!settings || !settings.profiles || !settings.actions) return null;

  var hk = (heldKey || "").trim().toLowerCase();
  if (!hk) return null;

  var m = heldMods || {};
  var modStr = (+m.shift) + "" + (+m.alt) + (+m.ctrl) + (+m.meta);
  var sig = "key:" + hk + "|mods:" + modStr + "|btn:" + mouseButton;

  for (var i = 0; i < settings.profiles.length; i++) {
    var p = settings.profiles[i];
    if (!p || !p.trigger || p.trigger.kind !== "key") continue;
    if (triggerSigContent(p.trigger) !== sig) continue;
    if (typeof p.trigger.mouseButton === "number" && p.trigger.mouseButton !== mouseButton) continue;
    if (p.actionId && settings.actions[p.actionId]) return p.actionId;
  }
  return null;
}

function startSelectionFromEvent(event) {
  // This is the "else" block of your current mousedown, extracted as a function.
  if (box_on) clean_up();

  var actionCfg = settings.actions[activeActionId];
  var boxColor = normalizeHexColor(actionCfg && actionCfg.color ? actionCfg.color : currentSelectionColor);

  if (box === null) {
    box = document.createElement("span");
    box.className = "linkslinger-selection-box";
    box.style.visibility = "hidden";
    box.style.setProperty("--ls-box-color", boxColor);

    count_label = document.createElement("span");
    count_label.className = "linkslinger-tooltip";
    count_label.style.visibility = "hidden";
    count_label.style.setProperty("--ls-box-color", boxColor);

    document.body.appendChild(box);
    document.body.appendChild(count_label);
  } else {
    box.style.setProperty("--ls-box-color", boxColor);
    if (count_label) count_label.style.setProperty("--ls-box-color", boxColor);
  }

  box.x = event.pageX;
  box.y = event.pageY;
  update_box(event.pageX, event.pageY);

  window.addEventListener("mousemove", mousemove, true);
  window.addEventListener("mouseup", mouseup, true);
  window.addEventListener("mousewheel", mousewheel, true);
  window.addEventListener("mouseout", mouseout, true);
}

function mousedown(event) {
  mouse_button = event.button;
  mouseIsDown = true;
  lateArmButton = mouse_button;
  lateArmStartX = event.pageX;
  lateArmStartY = event.pageY;

  var target = event.target;
  var isInputField =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable ||
    (target.closest && target.closest('input, textarea, [contenteditable="true"]'));
  if (isInputField) return;

  if (!settings || !settings.actions) {
    var ev = { pageX: event.pageX, pageY: event.pageY };
    chrome.runtime.sendMessage({ message: "init" }, function(r) {
      if (!r || r.error || !r.actions) return;
      settings = r;
      applySelectionColorFromSettings();
      applyFilterFromSettings();
      var firstId = Object.keys(settings.actions)[0];
      // Only start selection if activation key is held (same rule as normal path).
      if (firstId && ev && heldKey && heldKey !== "") {
        activeActionId = resolveActiveActionId(mouse_button, event) || firstId;
        applyFilterFromSettings(activeActionId);
        if (os === OS_WIN) stop_menu = false;
        startSelectionFromEvent(ev);
      }
    });
    return;
  }

  activeActionId = resolveActiveActionId(mouse_button, event);

  // Key triggers require the key to be held; modifier-only profiles (Shift, Alt, etc.) do not.
  if (activeActionId && settings && settings.profiles) {
    var matchedProfile = settings.profiles.find(function (p) { return p.actionId === activeActionId; });
    if (matchedProfile && matchedProfile.trigger && matchedProfile.trigger.kind === "key" && (!heldKey || heldKey === "")) {
      activeActionId = null;
    }
  }

  if (settings && settings.debugMode && typeof console !== "undefined" && console.log) {
    var profile = settings && settings.profiles ? settings.profiles.find(function (p) { return p.actionId === activeActionId; }) : null;
    console.log("LinkSlinger [QA] mousedown:", { heldKey: heldKey, eventKey: event.key, activeActionId: activeActionId, profileName: profile ? profile.name : null });
  }

  // Late-arm: key trigger only (e.g., user presses Z after mouse down).
  // If no match at mousedown, wait up to 250ms for heldKey to become valid.
  if (!activeActionId) {
    if (lateArmTimer) {
      clearTimeout(lateArmTimer);
      lateArmTimer = 0;
    }

    lateArmTimer = setTimeout(function () {
      lateArmTimer = 0;
      // If mouse is no longer down, abort.
      if (!mouseIsDown) return;
      // Only key trigger profiles
      var keyActionId = resolveKeyTriggeredActionId(lateArmButton);
      if (!keyActionId) return;

      activeActionId = keyActionId;
      applyFilterFromSettings(activeActionId);

      // Replicate the minimal side effects from the normal path
      if (os === OS_WIN) stop_menu = false;
      if (os === OS_LINUX || (os === OS_WIN && lateArmButton === LEFT_BUTTON)) {
        // Use original mousedown location for escalation prevention consistency.
        // We don't have the original event object here, so only prevent further escalation by disabling menu.
        // The selection will still work normally.
      }

      // Start selection anchored at original mousedown coords
      startSelectionFromEvent({
        pageX: lateArmStartX,
        pageY: lateArmStartY
      });
    }, 250);

    return;
  }

  // Normal path (unchanged behavior)
  applyFilterFromSettings(activeActionId);

  if (os === OS_WIN) stop_menu = false;
  if (os === OS_LINUX || (os === OS_WIN && mouse_button === LEFT_BUTTON)) {
    prevent_escalation(event);
  }

  if (timer !== 0) {
    clearTimeout(timer);
    timer = 0;
    if (os === OS_WIN) stop_menu = true;
  } else {
    startSelectionFromEvent(event);
  }
}

function update_box(x, y) {
  var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  var scrollY = window.pageYOffset || document.documentElement.scrollTop;

  if (x > box.x) {
    box.x1 = box.x;
    box.x2 = x;
  } else {
    box.x1 = x;
    box.x2 = box.x;
  }
  if (y > box.y) {
    box.y1 = box.y;
    box.y2 = y;
  } else {
    box.y1 = y;
    box.y2 = box.y;
  }

  // position:fixed uses viewport coordinates; event.pageX/pageY are document (page) coordinates.
  // Convert page -> viewport so the box stays under the cursor when scrolling.
  box.style.left = (box.x1 - scrollX) + "px";
  box.style.width = box.x2 - box.x1 + "px";
  box.style.top = (box.y1 - scrollY) + "px";
  box.style.height = box.y2 - box.y1 + "px";

  count_label.style.left = (x - scrollX + 12) + "px";
  count_label.style.top = (y - scrollY + 12) + "px";
}

function mousewheel() {
  scroll_bug_ignore = true;
}

function mouseout(event) {
  mousemove(event);
  // the mouse wheel event might also call this event
  scroll_bug_ignore = true;
}

function prevent_escalation(event) {
  event.stopPropagation();
  event.preventDefault();
}

function mouseup(event) {
  mouseIsDown = false;
  if (lateArmTimer) {
    clearTimeout(lateArmTimer);
    lateArmTimer = 0;
  }

  prevent_escalation(event);

  if (box_on) {
    // all the detection of the mouse to bounce
    if (allow_selection() && timer === 0) {
      timer = setTimeout(function() {
        update_box(event.pageX, event.pageY);
        detech(event.pageX, event.pageY, true);
        stop();
        timer = 0;
      }, 100);
    }
  } else {
    // false alarm
    stop();
  }
}

/**
 * Return element position and size in page coordinates (to match event.pageX/pageY).
 * Uses getBoundingClientRect so coordinates are correct with scroll, transforms, and scrollable containers.
 */
function getXY(element) {
  var rect = element.getBoundingClientRect();
  var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  var scrollY = window.pageYOffset || document.documentElement.scrollTop;
  return {
    x: rect.left + scrollX,
    y: rect.top + scrollY,
    width: rect.width,
    height: rect.height
  };
}

function start() {
  // stop user from selecting text/elements
  document.body.style.khtmlUserSelect = "none";

  // turn on the box
  box.style.visibility = "visible";
  count_label.style.visibility = "visible";

  // find all links
  var page_links = document.links;

  // create RegExp once
  var re1 = new RegExp("^javascript:", "i");
  var re2 = new RegExp(settings.actions[activeActionId].options.ignore.slice(1).join("|"), "i");
  var re3 = new RegExp("^H\\d$");

  for (var i = 0; i < page_links.length; i++) {
    // reject javascript: links
    if (re1.test(page_links[i].href)) {
      continue;
    }
    // reject href="" or href="#"
    if (!page_links[i].getAttribute("href") || page_links[i].getAttribute("href") === "#") {
      continue;
    }
    // include/exclude links
    if (settings.actions[activeActionId].options.ignore.length > 1) {
      if (re2.test(page_links[i].href) || re2.test(page_links[i].innerHTML)) {
        if (settings.actions[activeActionId].options.ignore[0] === EXCLUDE_LINKS) {
          continue;
        }
      } else if (settings.actions[activeActionId].options.ignore[0] === INCLUDE_LINKS) {
        continue;
      }
    }

    // attempt to ignore invisible links
    var comp = window.getComputedStyle(page_links[i], null);
    if (comp.visibility === "hidden" || comp.display === "none") {
      continue;
    }

    var pos = getXY(page_links[i]);
    var width = pos.width != null ? pos.width : page_links[i].offsetWidth;
    var height = pos.height != null ? pos.height : page_links[i].offsetHeight;

    // Expand bounds if a child IMG is larger (e.g. image links)
    for (var k = 0; k < page_links[i].childNodes.length; k++) {
      if (page_links[i].childNodes[k].nodeName === "IMG") {
        var pos2 = getXY(page_links[i].childNodes[k]);
        if (pos.y >= pos2.y) {
          pos.y = pos2.y;
        }
        width = Math.max(width, pos2.width != null ? pos2.width : page_links[i].childNodes[k].offsetWidth);
        height = Math.max(height, pos2.height != null ? pos2.height : page_links[i].childNodes[k].offsetHeight);
      }
    }

    page_links[i].x1 = pos.x;
    page_links[i].y1 = pos.y;
    page_links[i].x2 = pos.x + width;
    page_links[i].y2 = pos.y + height;
    page_links[i].height = height;
    page_links[i].width = width;
    page_links[i].box = null;
    page_links[i].important = (settings.actions[activeActionId].options.smart === 0 &&
                               page_links[i].parentNode != null &&
                               re3.test(page_links[i].parentNode.nodeName));

    links.push(page_links[i]);
  }

  box_on = true;

  // turn off menu for windows so mouse up doesn't trigger context menu
  if (os === OS_WIN) {
    stop_menu = true;
  }
}

function stop() {
  // allow user to select text/elements
  document.body.style.khtmlUserSelect = "";

  // turn off mouse move and mouse up
  window.removeEventListener("mousemove", mousemove, true);
  window.removeEventListener("mouseup", mouseup, true);
  window.removeEventListener("mousewheel", mousewheel, true);
  window.removeEventListener("mouseout", mouseout, true);

  if (box_on) {
    clean_up();
  }

  // turn on menu for linux
  if (os === OS_LINUX && settings.actions[activeActionId].key != key_pressed) {
    stop_menu = false;
  }
}

function scroll() {
  if (allow_selection()) {
    var y = mouse_y - window.scrollY;
    var win_height = window.innerHeight;

    if (y > win_height - 20) { // down
      let speed = win_height - y;
      if (speed < 2) {
        speed = 60;
      } else if (speed < 10) {
        speed = 30;
      } else {
        speed = 10;
      }
      window.scrollBy(0, speed);
      mouse_y += speed;
      update_box(mouse_x, mouse_y);
      detech(mouse_x, mouse_y, false);

      scroll_bug_ignore = true;
      return;
    } else if (window.scrollY > 0 && y < 20) { // up
      let speed = y;
      if (speed < 2) {
        speed = 60;
      } else if (speed < 10) {
        speed = 30;
      } else {
        speed = 10;
      }
      window.scrollBy(0, -speed);
      mouse_y -= speed;
      update_box(mouse_x, mouse_y);
      detech(mouse_x, mouse_y, false);

      scroll_bug_ignore = true;
      return;
    }
  }

  clearInterval(scroll_id);
  scroll_id = 0;
}

function detech(x, y, open) {
  mouse_x = x;
  mouse_y = y;

  if (!box_on) {
    if (box.x2 - box.x1 < 5 && box.y2 - box.y1 < 5) {
      return true;
    } else {
      start();
    }
  }

  if (!scroll_id) {
    scroll_id = setInterval(scroll, 100);
  }

  var count_tabs = new Set();
  var open_tabs = [];
  var overlap_count = 0;

  for (var i = 0; i < links.length; i++) {
    var overlaps = !(links[i].x1 > box.x2 || links[i].x2 < box.x1 || links[i].y1 > box.y2 || links[i].y2 < box.y1);
    if (overlaps) overlap_count++;
    var passesFilter = shouldSelectLink(links[i].href);
    if (overlaps && passesFilter) {
      if (open) {
        open_tabs.push({
          "url": links[i].href,
          "title": links[i].innerText
        });
      }

      var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      var vpLeft = links[i].x1 - scrollX;
      var vpTop = links[i].y1 - scrollY;

      if (links[i].box === null) {
        var link_box = document.createElement("span");
        link_box.style.id = "linkslinger-link";
        link_box.style.margin = "0px auto";
        link_box.style.border = "1px solid red";
        link_box.style.position = "fixed";
        link_box.style.width = links[i].width + "px";
        link_box.style.height = links[i].height + "px";
        link_box.style.top = vpTop + "px";
        link_box.style.left = vpLeft + "px";
        link_box.style.zIndex = Z_INDEX;

        document.body.appendChild(link_box);
        links[i].box = link_box;
      } else {
        links[i].box.style.left = vpLeft + "px";
        links[i].box.style.top = vpTop + "px";
        links[i].box.style.visibility = "visible";
      }

      count_tabs.add(links[i].href);
    } else {
      if (links[i].box !== null) {
        links[i].box.style.visibility = "hidden";
      }
    }
  }

  var link_count = count_tabs.size;
  var filtered_count = overlap_count - link_count;
  var label = link_count === 1 ? "1 link selected" : link_count + " links selected";
  if (isFilterBroken) {
    label += " (Filter invalid)";
  } else if (linkFilterRegex && filtered_count > 0) {
    label = link_count + (link_count === 1 ? " link" : " links") + " (" + filtered_count + " filtered)";
  }
  if (activeActionId && settings?.profiles) {
    var profile = settings.profiles.find(function (p) { return p.actionId === activeActionId; });
    if (profile && profile.name) label += " — " + profile.name;
  }
  count_label.innerText = label;

  if (open_tabs.length > 0) {
    // Changed from chrome.extension.sendMessage to chrome.runtime.sendMessage
    chrome.runtime.sendMessage({
      message: "activate",
      urls: open_tabs,
      setting: settings.actions[activeActionId]
    });
  }

  return true;
}

function allow_key(keyCode) {
  if (!settings?.actions) return false;
  for (var i in settings.actions) {
    if (settings.actions[i].key === keyCode) return true;
  }
  return false;
}

function keydown(event) {
  // CRITICAL: Don't activate when typing in input fields (per Midori's guide Section 2.3)
  var target = event.target;
  var isInputField = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable ||
                     (target.closest && target.closest('input, textarea, [contenteditable="true"]'));
  
  if (isInputField) {
    // Still allow key tracking for input fields, but don't activate selection
    // This prevents interference with normal typing
    return;
  }
  
  if (event.keyCode !== END_KEYCODE && event.keyCode !== HOME_KEYCODE) {
    key_pressed = event.keyCode;
    if (!event.repeat && typeof event.key === "string" && event.key.length >= 1) {
      heldKey = normalizeKeyForContent(event.key);
      heldMods = { shift: !!event.shiftKey, alt: !!event.altKey, ctrl: !!event.ctrlKey, meta: !!event.metaKey };
    }
    if (os === OS_LINUX && allow_key(key_pressed)) stop_menu = true;
  } else {
    scroll_bug_ignore = true;
  }
}

function blur() {
  remove_key();
}

function keyup(event) {
  // CRITICAL: Don't process keyup in input fields (per Midori's guide Section 2.3)
  var target = event.target;
  var isInputField = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable ||
                     (target.closest && target.closest('input, textarea, [contenteditable="true"]'));
  
  if (isInputField) {
    return; // Don't interfere with normal typing
  }
  
  if (event.keyCode !== END_KEYCODE && event.keyCode !== HOME_KEYCODE) {
    if (typeof event.key === "string" && event.key.length >= 1 && normalizeKeyForContent(event.key) === heldKey) {
      heldKey = "";
      heldMods = { shift: false, alt: false, ctrl: false, meta: false };
    }
    remove_key();
  }
}

function remove_key() {
  if (os === OS_LINUX) stop_menu = false;
  key_pressed = 0;
}

function allow_selection() {
  if (box_on) return true;
  // During initial drag, box exists but box_on is still false until detech() calls start() (after 5px).
  // Allow mousemove to update the box and run detech instead of calling stop().
  if (box !== null) return true;
  return false;
}

function contextmenu(event) {
  if (stop_menu) {
    event.preventDefault();
  }
}
