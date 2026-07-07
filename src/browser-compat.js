(function(global) {
  if (global.chrome || !global.browser) return;

  function withLastError(promise, callback) {
    return Promise.resolve(promise)
      .then((value) => {
        global.chrome.runtime.lastError = null;
        if (typeof callback === "function") callback(value);
        return value;
      })
      .catch((error) => {
        global.chrome.runtime.lastError = error;
        if (typeof callback === "function") callback();
        if (!callback) throw error;
        return undefined;
      });
  }

  function wrapPromiseMethod(target, name) {
    return function(...args) {
      const callback = typeof args[args.length - 1] === "function" ? args.pop() : null;
      const promise = target && typeof target[name] === "function"
        ? target[name](...args)
        : Promise.reject(new Error(`Unsupported extension API: ${name}`));
      return callback ? withLastError(promise, callback) : promise;
    };
  }

  const browser = global.browser;

  global.chrome = {
    action: browser.action,
    bookmarks: browser.bookmarks && {
      create: wrapPromiseMethod(browser.bookmarks, "create"),
      getChildren: wrapPromiseMethod(browser.bookmarks, "getChildren"),
      getTree: wrapPromiseMethod(browser.bookmarks, "getTree"),
      removeTree: wrapPromiseMethod(browser.bookmarks, "removeTree"),
      search: wrapPromiseMethod(browser.bookmarks, "search")
    },
    runtime: {
      getManifest: browser.runtime.getManifest.bind(browser.runtime),
      getURL: browser.runtime.getURL.bind(browser.runtime),
      lastError: null,
      onMessage: browser.runtime.onMessage,
      openOptionsPage: browser.runtime.openOptionsPage
        ? browser.runtime.openOptionsPage.bind(browser.runtime)
        : undefined,
      sendMessage: wrapPromiseMethod(browser.runtime, "sendMessage")
    },
    scripting: browser.scripting && {
      executeScript: wrapPromiseMethod(browser.scripting, "executeScript")
    },
    storage: browser.storage && {
      local: {
        get: wrapPromiseMethod(browser.storage.local, "get"),
        set: wrapPromiseMethod(browser.storage.local, "set")
      }
    },
    tabs: browser.tabs && {
      create: wrapPromiseMethod(browser.tabs, "create"),
      get: wrapPromiseMethod(browser.tabs, "get"),
      remove: wrapPromiseMethod(browser.tabs, "remove"),
      sendMessage: wrapPromiseMethod(browser.tabs, "sendMessage")
    },
    windows: browser.windows && {
      create: wrapPromiseMethod(browser.windows, "create"),
      getAll: wrapPromiseMethod(browser.windows, "getAll"),
      getCurrent: wrapPromiseMethod(browser.windows, "getCurrent"),
      update: wrapPromiseMethod(browser.windows, "update")
    }
  };
})(globalThis);
