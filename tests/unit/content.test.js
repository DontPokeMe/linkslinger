const test = require("node:test");
const assert = require("node:assert/strict");
const { loadBackground, loadContent, get } = require("./helpers");

const defaults = get(loadBackground(), "settingsManager").initDefaults();

function contentWithSettings(href, blocked) {
  const settings = { ...defaults, blocked };
  return loadContent({
    href,
    chromeOverrides: {
      runtime: {
        lastError: undefined,
        onMessage: { addListener: () => {} },
        sendMessage: (_msg, cb) => cb && cb(settings),
        getURL: (p) => p
      }
    }
  });
}

function fire(listeners, type, event) {
  for (const fn of listeners.window[type] || []) fn(event);
}

const el = { tagName: "DIV", isContentEditable: false, closest: () => null };

function dragWithZ(listeners) {
  let prevented = false;
  fire(listeners, "keydown", { target: el, keyCode: 90, key: "z", repeat: false });
  fire(listeners, "mousedown", {
    target: el, button: 0, pageX: 10, pageY: 10,
    shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
    preventDefault: () => { prevented = true; }, stopPropagation: () => {}
  });
  return { prevented, selecting: (listeners.window.mousemove || []).length > 0 };
}

test("isUrlBlocked matches case-insensitive regexes and skips bad patterns", () => {
  const { context } = loadContent();
  const isUrlBlocked = get(context, "isUrlBlocked");
  assert.equal(isUrlBlocked("https://Mail.Google.com/x", ["mail\\.google\\.com"]), true);
  assert.equal(isUrlBlocked("https://example.com/", ["", "(", "google"]), false);
  assert.equal(isUrlBlocked("https://example.com/", ["(", "example"]), true);
  assert.equal(isUrlBlocked("https://example.com/", undefined), false);
  assert.equal(isUrlBlocked("https://example.com/", [null, 3]), false);
});

test("Z+drag starts a selection on a site that is not blocked", () => {
  const { listeners } = contentWithSettings("https://example.com/page", ["google\\.com"]);
  const r = dragWithZ(listeners);
  assert.equal(r.prevented, true);
  assert.equal(r.selecting, true);
});

test("Z+drag does nothing on a blocked site", () => {
  const { listeners, context } = contentWithSettings("https://example.com/page", ["example\\.com"]);
  assert.equal(get(context, "siteBlocked"), true);
  const r = dragWithZ(listeners);
  assert.equal(r.prevented, false);
  assert.equal(r.selecting, false);
});

test("blocked state is recomputed when settings are updated", () => {
  let onMessage;
  const { context } = loadContent({
    href: "https://example.com/",
    chromeOverrides: {
      runtime: {
        lastError: undefined,
        onMessage: { addListener: (fn) => { onMessage = fn; } },
        sendMessage: (_msg, cb) => cb && cb({ ...defaults, blocked: [] }),
        getURL: (p) => p
      }
    }
  });
  assert.equal(get(context, "siteBlocked"), false);
  onMessage({ message: "update", settings: { ...defaults, blocked: ["example"] } });
  assert.equal(get(context, "siteBlocked"), true);
  onMessage({ message: "update", settings: { ...defaults, blocked: [] } });
  assert.equal(get(context, "siteBlocked"), false);
});
