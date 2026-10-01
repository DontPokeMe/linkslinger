/**
 * Test helpers: load extension scripts into a vm sandbox with minimal
 * chrome/DOM stubs so pure functions can be unit-tested without a browser.
 * Run: npm test
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "..", "..", "src");

function noop() {}

function makeChromeStub(overrides = {}) {
  const store = {};
  return {
    runtime: {
      lastError: undefined,
      onMessage: { addListener: noop },
      sendMessage: noop,
      getURL: (p) => "chrome-extension://test/" + p
    },
    storage: {
      local: {
        get: (keys, cb) => cb({ ...store }),
        set: (obj, cb) => { Object.assign(store, obj); if (cb) cb(); }
      }
    },
    windows: { getAll: (_opts, cb) => cb([]), getCurrent: (cb) => cb({ id: 1 }) },
    tabs: { create: noop, get: noop, sendMessage: () => Promise.resolve() },
    scripting: { executeScript: () => Promise.resolve() },
    offscreen: { hasDocument: () => Promise.resolve(true), createDocument: () => Promise.resolve() },
    ...overrides
  };
}

/** Load src/background.js into a fresh context; returns the vm context. */
function loadBackground(chromeOverrides) {
  const context = vm.createContext({
    chrome: makeChromeStub(chromeOverrides),
    console: { log: noop, warn: noop, error: noop },
    setTimeout,
    clearTimeout,
    URL
  });
  const code = fs.readFileSync(path.join(SRC, "background.js"), "utf8");
  vm.runInContext(code, context, { filename: "background.js" });
  return context;
}

/** Load src/content.js into a fresh context with a fake window/document. */
function loadContent({ href = "https://example.com/", chromeOverrides } = {}) {
  const listeners = { window: {}, document: {} };
  const target = (bucket) => ({
    addEventListener: (type, fn) => { (listeners[bucket][type] ||= []).push(fn); },
    removeEventListener: noop
  });
  const windowObj = { ...target("window"), location: { href }, pageXOffset: 0, pageYOffset: 0 };
  const documentObj = {
    ...target("document"),
    documentElement: { scrollLeft: 0, scrollTop: 0 },
    body: { appendChild: noop, removeChild: noop },
    createElement: () => ({ style: { setProperty: noop }, appendChild: noop })
  };
  const context = vm.createContext({
    chrome: makeChromeStub(chromeOverrides),
    console: { log: noop, warn: noop, error: noop },
    navigator: { appVersion: "5.0 (Macintosh)" },
    window: windowObj,
    document: documentObj,
    setTimeout,
    clearTimeout
  });
  const code = fs.readFileSync(path.join(SRC, "content.js"), "utf8");
  vm.runInContext(code, context, { filename: "content.js" });
  return { context, listeners, window: windowObj };
}

/** Evaluate an expression inside a loaded context (reaches top-level const/let/class). */
function get(context, expr) {
  return vm.runInContext(expr, context);
}

/** Round-trip through JSON so objects from another realm compare with deepStrictEqual. */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { loadBackground, loadContent, get, plain };
