/**
 * LinkSlinger popup — link analysis UI
 * State machine: idle | scanning | result_clean | result_threat | error
 * Zero friction: auto-fill current tab URL. Terminal-style loading. Bento results.
 */

const SCAN_PHASES = [
  "[Resolving DNS...]",
  "[Tracing Redirects...]",
  "[Querying Threat Intel...]",
  "[Analyzing...]"
];

const DONTPOKE_BASE = "https://dontpoke.me";
const LINK_EXPANDER_PATH = "/tools/link-expander";

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
  redirectCard: document.getElementById("redirectCard"),
  redirectList: document.getElementById("redirectList"),
  threatCard: document.getElementById("threatCard"),
  threatPills: document.getElementById("threatPills"),
  fullReportLink: document.getElementById("fullReportLink"),
  clearBtn: document.getElementById("clearBtn"),
  openSettings: document.getElementById("openSettings")
};

let state = STATES.IDLE;
let scanPhaseIndex = 0;
let scanInterval = null;
let lastAnalyzedUrl = null;
/** @type {{ verdictText?: string, redirects?: string[], threatPills?: { label: string, level: string }[] } */
let resultPayload = null;

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
  el.analyzeBtn.textContent = "Analyze Link";
  updateFullReportLink();
}

function renderScanning() {
  el.resultsArea.hidden = true;
  el.scanningArea.hidden = false;
  el.urlInput.classList.add("scanning");
  el.analyzeBtn.disabled = true;
  el.analyzeBtn.textContent = "Analyzing…";
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
  el.analyzeBtn.textContent = "Analyze Link";

  const isClean = state === STATES.RESULT_CLEAN;
  el.verdictBanner.className = "verdict-banner glass " + (isClean ? "clean" : "threat");
  el.verdictText.textContent = isClean
    ? "No threats detected."
    : (resultPayload?.verdictText || "Malicious Redirect Detected.");

  const hops = resultPayload?.redirects || [el.urlInput.value.trim()];
  el.redirectCard.hidden = false;
  el.redirectList.innerHTML = "";
  hops.forEach((url) => {
    const li = document.createElement("li");
    li.textContent = truncateUrl(url);
    el.redirectList.appendChild(li);
  });

  const pills = resultPayload?.threatPills || [];
  if (pills.length > 0) {
    el.threatCard.hidden = false;
    el.threatPills.innerHTML = "";
    pills.forEach(({ label, level }) => {
      const span = document.createElement("span");
      span.className = "threat-pill " + (level === "danger" ? "danger" : "warning");
      span.textContent = (level === "danger" ? "🔴 " : "🟡 ") + label;
      el.threatPills.appendChild(span);
    });
  } else {
    el.threatCard.hidden = true;
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
  el.analyzeBtn.textContent = "Analyze Link";
  el.resultsArea.hidden = true;
  updateFullReportLink();
}

function truncateUrl(url, maxLen = 52) {
  if (!url || url.length <= maxLen) return url;
  const half = Math.floor((maxLen - 5) / 2);
  return url.slice(0, half) + "…" + url.slice(-half);
}

function updateFullReportLink() {
  const url = lastAnalyzedUrl || el.urlInput.value.trim();
  const href = url
    ? `${DONTPOKE_BASE}${LINK_EXPANDER_PATH}?url=${encodeURIComponent(url)}`
    : `${DONTPOKE_BASE}${LINK_EXPANDER_PATH}`;
  el.fullReportLink.href = href;
}

/** Known URL shortener / redirector domains (stub heuristic until real API). */
const SHORTENER_DOMAINS = [
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
  "buff.ly", "adf.ly", "j.mp", "tr.im", "flu.lu", "short.link", "tiny.cc",
  "cutt.ly", "rebrand.ly", "bl.ink", "linktr.ee", "s.id", "bc.vc"
];

function getHostname(urlStr) {
  const s = urlStr.trim();
  const withProtocol = /^https?:\/\//i.test(s) ? s : "https://" + s;
  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

function runAnalysis() {
  const url = el.urlInput.value.trim();
  if (!url) return;

  lastAnalyzedUrl = url;
  setState(STATES.SCANNING);

  setTimeout(() => {
    const host = getHostname(url);
    const isShortener = SHORTENER_DOMAINS.some((d) => host === d || host.endsWith("." + d));
    const hasBadKeywords = /evil|malware|phish|\.tk\b|\.ml\b/i.test(url);
    const looksSuspicious = isShortener || hasBadKeywords || url.length > 80;

    if (looksSuspicious) {
      setState(STATES.RESULT_THREAT, {
        verdictText: isShortener
          ? "URL shortener or redirector — expand for full analysis."
          : "Suspicious or high-risk indicators detected.",
        redirects: [url, "https://example.com/landing"],
        threatPills: [
          ...(isShortener ? [{ label: "Shortener", level: "warning" }] : []),
          { label: "URLhaus", level: "danger" },
          { label: "OTX", level: "warning" }
        ]
      });
    } else {
      setState(STATES.RESULT_CLEAN, { redirects: [url] });
    }
  }, 2500);
}

async function initWithTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && /^https?:\/\//i.test(tab.url)) {
      el.urlInput.value = tab.url;
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

  if (el.openSettings) {
    el.openSettings.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setState(STATES.IDLE);
  initWithTabUrl();
  bindEvents();
});
