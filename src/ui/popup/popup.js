/**
 * LinkSlinger popup — link analysis UI
 * State machine: idle | scanning | result_clean | result_threat | error
 * Zero friction: auto-fill current tab URL. Terminal-style loading. Bento results.
 */

const SCAN_PHASES = [
  "[Checking WHOIS...]",
  "[Resolving DNS...]",
  "[Checking DNSBL...]",
  "[Analyzing...]"
];

const DONTPOKE_BASE = "https://dontpoke.me";
const DOMAIN_SCREENER_PATH = "/tools/domain-screener";

const STATES = Object.freeze({
  IDLE: "idle",
  SCANNING: "scanning",
  RESULT_CLEAN: "result_clean",
  RESULT_THREAT: "result_threat",
  ERROR: "error"
});

const el = {
  urlInput: document.getElementById("urlInput"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  scanningArea: document.getElementById("scanningArea"),
  scanningLine: document.getElementById("scanningLine"),
  resultsArea: document.getElementById("resultsArea"),
  verdictBanner: document.getElementById("verdictBanner"),
  verdictText: document.getElementById("verdictText"),
  messageCard: document.getElementById("messageCard"),
  messageText: document.getElementById("messageText"),
  detailsCard: document.getElementById("detailsCard"),
  detailsText: document.getElementById("detailsText"),
  fullReportLink: document.getElementById("fullReportLink"),
  clearBtn: document.getElementById("clearBtn"),
  tabAnalyze: document.getElementById("tabAnalyze"),
  tabSettings: document.getElementById("tabSettings"),
  panelAnalyze: document.getElementById("panelAnalyze"),
  panelSettings: document.getElementById("panelSettings"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  settingsVersion: document.getElementById("settingsVersion")
};

let state = STATES.IDLE;
let scanPhaseIndex = 0;
let scanInterval = null;
let lastAnalyzedUrl = null;
/** @type {{ domain?: string, summaryText?: string, signals?: Array<{key:string,status:string,detail?:string}>, pills?: Array<{label:string,severity:string,source?:string}> } */
let resultPayload = null;
/** Error message shown when state is ERROR (rate limit, network, etc.) */
let lastErrorMessage = "";

/** True if user has saved a non-empty dontpoke.me API key (Email Domain Screener). */
let hasApiKey = false;

function setState(newState, payload = null) {
  state = newState;
  resultPayload = payload ?? resultPayload;
  render();
}

function render() {
  switch (state) {
    case STATES.IDLE:
      renderIdle();
      break;
    case STATES.SCANNING:
      renderScanning();
      break;
    case STATES.RESULT_CLEAN:
    case STATES.RESULT_THREAT:
      renderResult();
      break;
    case STATES.ERROR:
      renderError();
      break;
    default:
      renderIdle();
  }
}

function renderIdle() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  el.scanningArea.hidden = true;
  el.resultsArea.hidden = true;
  el.urlInput.classList.remove("scanning");
  el.analyzeBtn.disabled = false;
  el.analyzeBtn.textContent = "Screen Domain";
  updateFullReportLink();
}

function renderScanning() {
  el.resultsArea.hidden = true;
  el.scanningArea.hidden = false;
  el.analyzeBtn.disabled = true;
  el.analyzeBtn.textContent = "Screening…";
  scanPhaseIndex = 0;
  el.scanningLine.textContent = SCAN_PHASES[0];
  if (scanInterval) clearInterval(scanInterval);
  scanInterval = setInterval(() => {
    scanPhaseIndex = (scanPhaseIndex + 1) % SCAN_PHASES.length;
    el.scanningLine.textContent = SCAN_PHASES[scanPhaseIndex];
  }, 600);
  updateFullReportLink();
}

function renderResult() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  el.scanningArea.hidden = true;
  el.urlInput.classList.remove("scanning");
  el.analyzeBtn.disabled = false;
  el.analyzeBtn.textContent = "Screen Domain";

  // Derive verdict from signals: any fail -> review, any warn -> review, else allow
  const signals = resultPayload?.signals || [];
  const hasFail = signals.some((s) => (s.status || "").toLowerCase() === "fail");
  const hasWarn = signals.some((s) => (s.status || "").toLowerCase() === "warn");
  const verdict = hasFail ? "REVIEW" : hasWarn ? "REVIEW" : "ALLOW";
  const verdictClass = verdict === "ALLOW" ? "allow" : "block";
  el.verdictBanner.className = "verdict-banner glass " + verdictClass;
  el.verdictText.textContent = resultPayload?.domain ? resultPayload.domain + " — " + verdict : verdict;

  if (el.messageCard && el.messageText) {
    const msg = resultPayload?.summaryText || resultPayload?.message || null;
    if (msg) {
      el.messageText.textContent = msg;
      el.messageCard.hidden = false;
    } else {
      el.messageCard.hidden = true;
    }
  }

  if (el.detailsCard && el.detailsText) {
    const parts = [];
    (resultPayload?.signals || []).forEach((s) => {
      parts.push("[" + (s.status || "").toUpperCase() + "] " + (s.key || "") + ": " + (s.detail || ""));
    });
    (resultPayload?.pills || []).forEach((p) => {
      parts.push("• " + (p.label || "") + " (" + (p.severity || "info") + ")");
    });
    if (parts.length) {
      el.detailsText.textContent = parts.join("\n");
      el.detailsCard.hidden = false;
    } else {
      el.detailsCard.hidden = true;
    }
  } else if (el.detailsCard) {
    el.detailsCard.hidden = true;
  }

  el.resultsArea.hidden = false;
  updateFullReportLink();
}

function renderError() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  el.scanningArea.hidden = true;
  el.urlInput.classList.remove("scanning");
  el.analyzeBtn.disabled = false;
  el.analyzeBtn.textContent = "Screen Domain";

  el.resultsArea.hidden = false;
  el.verdictBanner.className = "verdict-banner glass block";
  el.verdictText.textContent = lastErrorMessage || "Something went wrong.";
  if (el.messageCard) el.messageCard.hidden = true;
  if (el.detailsCard) el.detailsCard.hidden = true;
  updateFullReportLink();
}

function truncateUrl(url, maxLen = 52) {
  if (!url || url.length <= maxLen) return url;
  const half = Math.floor((maxLen - 5) / 2);
  return url.slice(0, half) + "…" + url.slice(-half);
}

function updateFullReportLink() {
  const domain = (resultPayload && resultPayload.domain) || lastAnalyzedUrl || el.urlInput.value.trim();
  const href = domain
    ? `${DONTPOKE_BASE}${DOMAIN_SCREENER_PATH}?domain=${encodeURIComponent(domain)}`
    : `${DONTPOKE_BASE}${DOMAIN_SCREENER_PATH}`;
  el.fullReportLink.href = href;
}

async function runAnalysis() {
  const input = el.urlInput.value.trim();
  if (!input) return;

  lastAnalyzedUrl = input;
  lastErrorMessage = "";
  setState(STATES.SCANNING);

  return new Promise(function (resolve) {
    chrome.runtime.sendMessage({ message: "domain_screener", input }, function (result) {
      if (chrome.runtime.lastError) {
        lastErrorMessage = chrome.runtime.lastError.message || "Extension error";
        setState(STATES.ERROR);
        resolve();
        return;
      }
      if (result && result.ok && result.payload) {
        setState(
          STATES.RESULT_CLEAN,
          result.payload
        );
      } else if (result && !result.ok && result.error) {
        lastErrorMessage = result.error;
        setState(STATES.ERROR);
      } else if (result && result.error) {
        lastErrorMessage = result.error;
        setState(STATES.ERROR);
      } else {
        lastErrorMessage = "Invalid response";
        setState(STATES.ERROR);
      }
      resolve();
    });
  });
}

async function initWithTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && /^https?:\/\//i.test(tab.url)) {
      try {
        const u = new URL(tab.url);
        el.urlInput.value = u.hostname.replace(/^www\./i, "") || tab.url;
      } catch (_) {
        el.urlInput.value = tab.url;
      }
    }
  } catch (_) {
    // Ignore (e.g. restricted page)
  }
  updateFullReportLink();
}

function bindEvents() {
  el.analyzeBtn.addEventListener("click", runAnalysis);
  el.urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runAnalysis();
  });

  el.clearBtn.addEventListener("click", () => {
    lastAnalyzedUrl = null;
    resultPayload = null;
    setState(STATES.IDLE);
    el.urlInput.value = "";
  });

  if (el.openSettingsBtn) {
    el.openSettingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (el.tabAnalyze && el.tabSettings && el.panelAnalyze && el.panelSettings) {
    el.tabAnalyze.addEventListener("click", () => switchTab("analyze"));
    el.tabSettings.addEventListener("click", () => switchTab("settings"));
  }
}

function switchTab(name) {
  const isAnalyze = name === "analyze";
  el.tabAnalyze.classList.toggle("active", isAnalyze);
  el.tabSettings.classList.toggle("active", !isAnalyze);
  el.tabAnalyze.setAttribute("aria-selected", isAnalyze ? "true" : "false");
  el.tabSettings.setAttribute("aria-selected", !isAnalyze ? "true" : "false");
  el.panelAnalyze.classList.toggle("hidden", !isAnalyze);
  el.panelSettings.classList.toggle("hidden", isAnalyze);
}

function initSettingsPanel() {
  if (el.settingsVersion && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    el.settingsVersion.textContent = "Version " + (manifest.version || "");
  }
}

/**
 * Show or hide API-key–dependent UI (Analyze tab, footer). Call after reading dontpokeApiKey.
 */
function applyApiKeyVisibility() {
  if (el.tabAnalyze) el.tabAnalyze.hidden = !hasApiKey;
  if (el.panelAnalyze) el.panelAnalyze.hidden = !hasApiKey;
  const footer = document.querySelector(".popup-footer");
  if (footer) footer.hidden = !hasApiKey;
  const apiKeyHint = document.getElementById("apiKeyHint");
  if (apiKeyHint) apiKeyHint.hidden = hasApiKey;
  if (hasApiKey) {
    switchTab("analyze");
  } else {
    switchTab("settings");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const { dontpokeApiKey } = await chrome.storage.local.get("dontpokeApiKey");
  hasApiKey = typeof dontpokeApiKey === "string" && dontpokeApiKey.trim().length > 0;
  applyApiKeyVisibility();
  setState(STATES.IDLE);
  initWithTabUrl();
  bindEvents();
  initSettingsPanel();
});
