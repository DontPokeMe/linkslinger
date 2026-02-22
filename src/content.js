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
var key_pressed = 0;
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
var scroll_bug_ignore = false;
var os = ((navigator.appVersion.indexOf("Win") === -1) ? OS_LINUX : OS_WIN);
var timer = 0;

// Changed from chrome.extension.sendMessage to chrome.runtime.sendMessage
chrome.runtime.sendMessage({
  message: "init"
}, function(response) {
  if (chrome.runtime.lastError) {
    console.error("LinkSlinger: Error loading settings:", chrome.runtime.lastError.message);
    return;
  }
  
  if (response === null || response === undefined) {
    console.error("Unable to load LinkSlinger due to null response");
    return;
  }
  
  if (response.hasOwnProperty("error")) {
    console.error("Unable to properly load LinkSlinger, returning to default settings: " + JSON.stringify(response));
    return;
  }

  if (!response.actions || typeof response.actions !== 'object') {
    console.error("LinkSlinger: Invalid settings structure:", response);
    return;
  }

  settings = response.actions;

  var allowed = true;
  if (response.blocked && Array.isArray(response.blocked)) {
    for (var i in response.blocked) {
      if (response.blocked[i] === "") continue;
      var re = new RegExp(response.blocked[i], "i");

      if (re.test(window.location.href)) {
        allowed = false;
        console.log("LinkSlinger is blocked on this site: " + response.blocked[i] + "~" + window.location.href);
      }
    }
  }

  if (allowed && settings) {
    // Debug: log settings to verify they loaded
    console.log("LinkSlinger: Settings loaded", settings);
    console.log("LinkSlinger: Default key should be 90 (Z)");
    
    window.addEventListener("mousedown", mousedown, true);
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);
    window.addEventListener("blur", blur, true);
    window.addEventListener("contextmenu", contextmenu, true);
    
    // Also listen on document for better key capture (capture phase)
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("keyup", keyup, true);
  } else {
    console.log("LinkSlinger: Not initialized - allowed:", allowed, "settings:", settings);
  }
});

// Changed from chrome.extension.onMessage to chrome.runtime.onMessage
chrome.runtime.onMessage.addListener(function(request, sender, callback) {
  if (request.message === "update") {
    settings = request.settings.actions;
  }
});

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

function mousedown(event) {
  mouse_button = event.button;

  // Use key_pressed tracked from keydown events
  // Focus on Z key (90) for now
  var current_key = key_pressed;
  
  console.log("LinkSlinger: mousedown - mouse_button:", mouse_button, "key_pressed:", key_pressed, "current_key:", current_key);
  
  // CRITICAL: Don't activate in input fields (per Midori's guide Section 2.3)
  var target = event.target;
  var isInputField = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable ||
                     (target.closest && target.closest('input, textarea, [contenteditable="true"]'));
  
  if (isInputField) {
    console.log("LinkSlinger: Ignoring mousedown in input field");
    return;
  }
  
  // Temporarily set key_pressed for allow_selection check
  var saved_key_pressed = key_pressed;
  key_pressed = current_key;

  // turn on menu for windows
  if (os === OS_WIN) {
    stop_menu = false;
  }

  if (allow_selection()) {
    // don't prevent for windows right click as it breaks spell checker
    // do prevent for left as otherwise the page becomes highlighted
    if (os === OS_LINUX || (os === OS_WIN && mouse_button === LEFT_BUTTON)) {
      prevent_escalation(event);
    }

    // if mouse up timer is set then clear it as it was just caused by bounce
    if (timer !== 0) {
      // console.log("bounced!");
      clearTimeout(timer);
      timer = 0;

      // keep menu off for windows
      if (os === OS_WIN) {
        stop_menu = true;
      }
    } else {
      // clean up any mistakes
      if (box_on) {
        console.log("box wasn't removed from previous operation");
        clean_up();
      }

      // create the box
      if (box === null) {
        box = document.createElement("span");
        box.className = "linkslinger-selection-box";
        box.style.visibility = "hidden";

        count_label = document.createElement("span");
        count_label.className = "linkslinger-tooltip";
        count_label.style.visibility = "hidden";

        document.body.appendChild(box);
        document.body.appendChild(count_label);
      }

      // update position
      box.x = event.pageX;
      box.y = event.pageY;
      update_box(event.pageX, event.pageY);

      // setup mouse move and mouse up
      window.addEventListener("mousemove", mousemove, true);
      window.addEventListener("mouseup", mouseup, true);
      window.addEventListener("mousewheel", mousewheel, true);
      window.addEventListener("mouseout", mouseout, true);
    }
  } else {
    // Restore key_pressed if selection not allowed
    key_pressed = saved_key_pressed;
  }
}

function update_box(x, y) {
  // Use page coordinates for fixed positioning
  var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  var scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  // Convert page coordinates to fixed viewport coordinates
  var fixedX = x;
  var fixedY = y;

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

  // Use fixed positioning (already set via CSS class)
  box.style.left = box.x1 + "px";
  box.style.width = box.x2 - box.x1 + "px";
  box.style.top = box.y1 + "px";
  box.style.height = box.y2 - box.y1 + "px";

  // Update tooltip position (offset by 12px as per spec)
  count_label.style.left = (x + 12) + "px";
  count_label.style.top = (y + 12) + "px";
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
  var re2 = new RegExp(settings[setting].options.ignore.slice(1).join("|"), "i");
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
    if (settings[setting].options.ignore.length > 1) {
      if (re2.test(page_links[i].href) || re2.test(page_links[i].innerHTML)) {
        if (settings[setting].options.ignore[0] === EXCLUDE_LINKS) {
          continue;
        }
      } else if (settings[setting].options.ignore[0] === INCLUDE_LINKS) {
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
    page_links[i].important = (settings[setting].options.smart === 0 &&
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
  if (os === OS_LINUX && settings[setting].key != key_pressed) {
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

  for (var i = 0; i < links.length; i++) {
    var overlaps = !(links[i].x1 > box.x2 || links[i].x2 < box.x1 || links[i].y1 > box.y2 || links[i].y2 < box.y1);
    if (overlaps) {
      if (open) {
        open_tabs.push({
          "url": links[i].href,
          "title": links[i].innerText
        });
      }

      if (links[i].box === null) {
        var link_box = document.createElement("span");
        link_box.style.id = "linkslinger-link";
        link_box.style.margin = "0px auto";
        link_box.style.border = "1px solid red";
        link_box.style.position = "absolute";
        link_box.style.width = links[i].width + "px";
        link_box.style.height = links[i].height + "px";
        link_box.style.top = links[i].y1 + "px";
        link_box.style.left = links[i].x1 + "px";
        link_box.style.zIndex = Z_INDEX;

        document.body.appendChild(link_box);
        links[i].box = link_box;
      } else {
        links[i].box.style.visibility = "visible";
      }

      count_tabs.add(links[i].href);
    } else {
      if (links[i].box !== null) {
        links[i].box.style.visibility = "hidden";
      }
    }
  }

  const link_count = count_tabs.size;
  count_label.innerText = link_count + (link_count === 1 ? ' link selected' : ' links selected');

  if (open_tabs.length > 0) {
    // Changed from chrome.extension.sendMessage to chrome.runtime.sendMessage
    chrome.runtime.sendMessage({
      message: "activate",
      urls: open_tabs,
      setting: settings[setting]
    });
  }

  return true;
}

function allow_key(keyCode) {
  for (var i in settings) {
    if (settings[i].key === keyCode) {
      return true;
    }
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
    // Debug: log key press for troubleshooting
    console.log("LinkSlinger: Key pressed:", event.keyCode, "Key:", event.key, "key_pressed set to:", key_pressed);
    // turn menu off for linux
    if (os === OS_LINUX && allow_key(key_pressed)) {
      stop_menu = true;
    }
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
    remove_key();
  }
}

function remove_key() {
  // turn menu on for linux
  if (os === OS_LINUX) {
    stop_menu = false;
  }
  key_pressed = 0;
}

function allow_selection() {
  if (!settings) {
    console.log("LinkSlinger: allow_selection - no settings");
    return false;
  }
  
  for (var i in settings) {
    // Check if mouse button matches (0 = left button)
    if (settings[i].mouse !== mouse_button) {
      continue;
    }
    
    // Check if key matches - expecting 90 (Z key)
    console.log("LinkSlinger: Checking - mouse:", mouse_button, "key_pressed:", key_pressed, "setting key:", settings[i].key);
    if (settings[i].key === key_pressed) {
      setting = i;
      console.log("LinkSlinger: ✓ Selection allowed - mouse:", mouse_button, "key:", key_pressed, "setting:", i);
      // Border color is now handled by CSS class
      return true;
    }
  }
  
  console.log("LinkSlinger: ✗ Selection not allowed - mouse:", mouse_button, "key_pressed:", key_pressed, "settings:", settings);
  return false;
}

function contextmenu(event) {
  if (stop_menu) {
    event.preventDefault();
  }
}
