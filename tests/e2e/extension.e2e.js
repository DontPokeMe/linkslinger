/**
 * E2E tests for LinkSlinger Chrome extension.
 * Loads the extension, verifies options, then drives real modifier+drag actions.
 */

const http = require("http");
const path = require("path");
const puppeteer = require("puppeteer");

const EXTENSION_PATH = path.join(__dirname, "..", "..", "src");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startTestServer() {
  const html = `<!doctype html>
    <html>
      <head>
        <title>LinkSlinger fixture</title>
        <style>
          body { margin: 0; font-family: sans-serif; }
          header { position: sticky; top: 0; height: 56px; background: #111; z-index: 10; }
          header a { color: white; margin: 16px; display: inline-block; }
          main { padding: 80px 40px 1600px; }
          .link-grid { display: grid; grid-template-columns: repeat(2, 180px); gap: 18px; }
          .link-grid a { display: block; padding: 14px; border: 1px solid #999; border-radius: 4px; }
        </style>
      </head>
      <body>
        <header><a href="/header-link">Header link should not be selected</a></header>
        <main>
          <div class="link-grid">
            <a id="alpha" href="/alpha">Alpha</a>
            <a id="bravo" href="/bravo">Bravo</a>
            <a id="charlie" href="/charlie">Charlie</a>
            <a id="delta" href="/delta">Delta</a>
          </div>
        </main>
      </body>
    </html>`;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(req.url === "/" ? html : `ok ${req.url}`);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

function stage(name) {
  console.error(`[e2e] -> ${name}`);
}

function dumpTargets(browser, label) {
  const rows = browser
    .targets()
    .map((t) => `    ${t.type()} ${t.url()}`)
    .join("\n");
  console.error(`[e2e] targets (${label}):\n${rows || "    <none>"}`);
}

const isBackgroundWorker = (target) =>
  target.type() === "service_worker" && target.url().includes("background.js");

async function getExtensionWorker(browser) {
  stage("waiting for extension service worker");
  // The MV3 service worker can register lazily, so check what already exists
  // before falling back to a bounded wait.
  let target = browser.targets().find(isBackgroundWorker);
  if (!target) {
    try {
      target = await browser.waitForTarget(isBackgroundWorker, { timeout: 30000 });
    } catch (err) {
      dumpTargets(browser, "service-worker timeout");
      throw err;
    }
  }
  const worker = await target.worker();
  assert(worker, "Could not get extension service worker");
  stage("service worker ready");
  return worker;
}

async function setExtensionSettings(worker) {
  await worker.evaluate(async () => {
    const actionOptions = {
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
    };
    const settings = {
      version: 1,
      bookmarkFolderName: "Saved from LinkSlinger",
      blocked: [],
      debugMode: false,
      actions: {
        "101": { mouse: 0, key: 90, action: "tabs", color: "#FFA500", options: { ...actionOptions } },
        "102": { mouse: 0, key: 90, action: "copy", color: "#3b82f6", options: { ...actionOptions, copy: 1 } },
        "104": { mouse: 0, key: 90, action: "bm", color: "#8b5cf6", options: { ...actionOptions } }
      },
      profiles: [
        { id: "p1", name: "Open", trigger: { kind: "mods", key: "", mods: { shift: true, alt: false, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "101" },
        { id: "p2", name: "Copy", trigger: { kind: "mods", key: "", mods: { shift: false, alt: true, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "102" },
        { id: "p3", name: "Bookmark", trigger: { kind: "mods", key: "", mods: { shift: false, alt: false, ctrl: true, meta: false }, mouseButton: 0 }, actionId: "104" }
      ]
    };
    await chrome.storage.local.set({ settings, version: "5" });
  });
}

async function setDefaultKeySettings(worker) {
  await worker.evaluate(async () => {
    const actionOptions = {
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
    };
    const settings = {
      version: 1,
      bookmarkFolderName: "Saved from LinkSlinger",
      blocked: [],
      debugMode: false,
      actions: {
        "101": { mouse: 0, key: 90, action: "tabs", color: "#FFA500", options: { ...actionOptions } }
      },
      profiles: [
        { id: "p1", name: "Default", trigger: { kind: "key", key: "z", mods: { shift: false, alt: false, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "101" }
      ]
    };
    await chrome.storage.local.set({ settings, version: "5" });
  });
}

async function resetBookmarks(worker) {
  await worker.evaluate(async () => {
    const matches = await chrome.bookmarks.search({ title: "Saved from LinkSlinger" });
    await Promise.all(matches.filter((node) => !node.url).map((node) => chrome.bookmarks.removeTree(node.id)));
  });
}

async function dragSelect(page, modifier) {
  await page.keyboard.down(modifier);
  await page.mouse.move(30, 120);
  await page.mouse.down();
  await page.mouse.move(430, 250, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up(modifier);
  await sleep(600);
}

async function dragSelectWithKey(page, key) {
  await page.keyboard.down(key);
  await page.mouse.move(30, 120);
  await page.mouse.down();
  await page.mouse.move(430, 250, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up(key);
  await sleep(600);
}

async function openFixturePage(browser, origin) {
  const page = await browser.newPage();
  await page.goto(origin + "/", { waitUntil: "networkidle0", timeout: 10000 });
  await page.waitForSelector("#alpha");
  await sleep(500);
  return page;
}

async function testOptionsPage(worker, browser) {
  const optionsUrl = await worker.evaluate(() => chrome.runtime.getURL("ui/options/options.html"));
  const page = await browser.newPage();
  await page.goto(optionsUrl, { waitUntil: "networkidle0", timeout: 10000 });
  await page.waitForSelector(".sidebar-header h1, #versionDisplay", { timeout: 5000 });
  await page.waitForFunction(
    () => document.body.innerText.toLowerCase().includes("activator shortcut"),
    { timeout: 5000 }
  );
  const titleText = await page.$eval(".sidebar-header h1", (el) => el.textContent.trim());
  assert(titleText === "LinkSlinger", `Expected options title LinkSlinger, got ${titleText}`);

  await page.evaluate(async () => {
    const data = await chrome.storage.local.get(["settings"]);
    const settings = data.settings;
    settings.profiles = [
      { id: "p1", name: "One", trigger: { kind: "mods", key: "", mods: { shift: true, alt: false, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "101" },
      { id: "p2", name: "Two", trigger: { kind: "mods", key: "", mods: { shift: true, alt: false, ctrl: false, meta: false }, mouseButton: 0 }, actionId: "102" }
    ];
    await chrome.storage.local.set({ settings });
    location.reload();
  });
  await page.waitForSelector(".profile-card:nth-of-type(2)");
  await page.click("#saveProfilesBtn");
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll(".duplicate-trigger-error")).some((el) => !el.hidden),
    { timeout: 5000 }
  );
  await page.close();
}

async function testOpenTabs(browser, origin) {
  const page = await openFixturePage(browser, origin);
  const existingTargets = new Set(browser.targets());
  await dragSelect(page, "Shift");
  try {
    await browser.waitForTarget(
      (target) => !existingTargets.has(target) && target.url().includes("/alpha"),
      { timeout: 30000 }
    );
  } catch (err) {
    dumpTargets(browser, "shift open-tabs timeout");
    throw err;
  }
  const urls = browser.targets().map((target) => target.url());
  assert(urls.some((url) => url.includes("/alpha")), "Expected selected Alpha link to open in a tab");
  assert(!urls.some((url) => url.includes("/header-link")), "Sticky header link should not open");
  await page.close();
}

async function testDefaultKeyOpenTabs(browser, origin) {
  const page = await openFixturePage(browser, origin);
  const existingTargets = new Set(browser.targets());
  await dragSelectWithKey(page, "z");
  try {
    await browser.waitForTarget(
      (target) => !existingTargets.has(target) && target.url().includes("/alpha"),
      { timeout: 30000 }
    );
  } catch (err) {
    dumpTargets(browser, "default-key open-tabs timeout");
    throw err;
  }
  const urls = browser.targets().map((target) => target.url());
  assert(urls.some((url) => url.includes("/alpha")), "Expected default Z-selected Alpha link to open in a tab");
  assert(!urls.some((url) => url.includes("/header-link")), "Sticky header link should not open for default key selection");
  await page.close();
}

async function testCopy(browser, origin) {
  const page = await openFixturePage(browser, origin);
  await browser.defaultBrowserContext().overridePermissions(origin, ["clipboard-read"]);
  await dragSelect(page, "Alt");
  await page.waitForFunction(
    async (expected) => {
      const text = await navigator.clipboard.readText();
      return text.includes(expected);
    },
    { timeout: 5000 },
    origin + "/alpha"
  );
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert(clipboardText.includes(origin + "/alpha"), "Expected copied links to include Alpha");
  assert(!clipboardText.includes("/header-link"), "Copied links should not include sticky header link");
  await page.close();
}

async function testBookmarks(worker, browser, origin) {
  await resetBookmarks(worker);
  const page = await openFixturePage(browser, origin);
  await dragSelect(page, "Control");
  await sleep(1000);
  const bookmarks = await worker.evaluate(async () => {
    const folders = await chrome.bookmarks.search({ title: "Saved from LinkSlinger" });
    const folder = folders.find((node) => !node.url);
    if (!folder) return [];
    return chrome.bookmarks.getChildren(folder.id);
  });
  const urls = bookmarks.map((bookmark) => bookmark.url || "");
  const alphaBookmark = bookmarks.find((bookmark) => (bookmark.url || "").includes("/alpha"));
  assert(alphaBookmark, "Expected Alpha to be bookmarked");
  assert(alphaBookmark.title === "Alpha", `Expected Alpha bookmark title, got ${alphaBookmark.title}`);
  assert(!urls.some((url) => url.includes("/header-link")), "Bookmark folder should not include sticky header link");
  await page.close();
}

async function runE2E() {
  const { server, origin } = await startTestServer();
  let browser;
  try {
    // Chrome's new headless mode does not reliably load extensions on Linux,
    // so CI runs headed under xvfb (PUPPETEER_HEADLESS=false). Other platforms
    // keep new-headless, which loads extensions fine.
    const headless = process.env.PUPPETEER_HEADLESS === "false" ? false : "new";
    browser = await puppeteer.launch({
      headless,
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
      // The DevTools pipe transport hangs with headed Chrome under xvfb, so use
      // the default WebSocket transport there and keep the pipe for headless.
      pipe: headless !== false,
      // Surface the browser's stdout/stderr in CI so launch failures are visible.
      dumpio: headless === false,
      ignoreDefaultArgs: ["--disable-extensions"],
    });

    const worker = await getExtensionWorker(browser);
    await setExtensionSettings(worker);
    stage("options page");
    await testOptionsPage(worker, browser);
    await setDefaultKeySettings(worker);
    stage("default-key open tabs");
    await testDefaultKeyOpenTabs(browser, origin);
    await setExtensionSettings(worker);
    stage("modifier open tabs");
    await testOpenTabs(browser, origin);
    stage("copy");
    await testCopy(browser, origin);
    stage("bookmarks");
    await testBookmarks(worker, browser, origin);

    const version = await worker.evaluate(() => chrome.runtime.getManifest().version);
    console.log("E2E OK: default key selection, modifier actions, options validation, and bookmarks verified.", "v" + version);
  } catch (err) {
    console.error("E2E failed:", err.message);
    throw err;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

runE2E()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
