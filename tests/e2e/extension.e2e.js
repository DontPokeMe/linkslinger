/**
 * E2E test for LinkSlinger Chrome extension.
 * Loads the extension and verifies the options page UI loads.
 * Run: npm run test:e2e (from repo root)
 * Requires: npm install first.
 *
 * @see https://pptr.dev/guides/chrome-extensions
 * @see https://developer.chrome.com/docs/extensions/how-to/test/puppeteer
 */

const path = require("path");
const puppeteer = require("puppeteer");

const EXTENSION_PATH = path.join(__dirname, "..", "..", "src");

async function runE2E() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
      pipe: true,
      ignoreDefaultArgs: ["--disable-extensions"],
    });

    // Wait for the extension's service worker (MV3)
    const workerTarget = await browser.waitForTarget(
      (target) =>
        target.type() === "service_worker" &&
        target.url().includes("background.js"),
      { timeout: 10000 }
    );
    const worker = await workerTarget.worker();
    if (!worker) {
      throw new Error("Could not get service worker");
    }

    // Open options page (reliable in headless; openPopup can be flaky)
    const optionsUrl = await worker.evaluate(
      () => chrome.runtime.getURL("ui/options/options.html")
    );
    const page = await browser.newPage();
    await page.goto(optionsUrl, { waitUntil: "networkidle0", timeout: 10000 });

    await page.waitForSelector(".sidebar-header h1, #versionDisplay", {
      timeout: 5000,
    });
    // Wait until options.js has set version from manifest
    await page.waitForFunction(
      () => {
        const el = document.getElementById("versionDisplay");
        return el && /^v[\d.]+$/.test(el.textContent.trim());
      },
      { timeout: 5000 }
    );
    const titleText = await page.evaluate(() => {
      const el = document.querySelector(".sidebar-header h1");
      return el ? el.textContent.trim() : "";
    });
    if (titleText !== "LinkSlinger") {
      throw new Error(
        `Expected options title "LinkSlinger", got "${titleText}"`
      );
    }
    const versionText = await page.evaluate(() => {
      const el = document.getElementById("versionDisplay");
      return el ? el.textContent.trim() : "";
    });
    if (!versionText || !/^v[\d.]+$/.test(versionText)) {
      throw new Error(`Expected version like v1.0.0, got "${versionText}"`);
    }

    console.log("E2E OK: Extension loaded, options page verified.", versionText);
    return true;
  } catch (err) {
    console.error("E2E failed:", err.message);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

runE2E()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
