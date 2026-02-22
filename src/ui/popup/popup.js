/**
 * LinkSlinger popup — link analysis UI
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

let scanPhaseIndex = 0;
let scanInterval = null;
let lastAnalyzedUrl = null;

/** Set popup to default state: input visible, no results, no scanning */
function setStateDefault() {
  el.scanningArea.hidden = true;
  el.resultsArea.hidden = true;
  el.urlInput.classList.remove("scanning");
  el.analyzeBtn.disabled = false;
  el.analyzeBtn.textContent = "Analyze Link";
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
}

/** Show terminal-style scanning state */
function setStateScanning() {
  el.resultsArea.hidden = true;
  el.scanningArea.hidden = false;
  el.urlInput.classList.add("scanning");
  el.analyzeBtn.disabled = true;
  el.analyzeBtn.textContent = "Analyzing…";
  scanPhaseIndex = 0;
  el.scanningLine.textContent = SCAN_PHASES[0];
  scanInterval = setInterval(() => {
    scanPhaseIndex = (scanPhaseIndex + 1) % SCAN_PHASES.length;
    el.scanningLine.textContent = SCAN_PHASES[scanPhaseIndex];
  }, 600);
}

/** Show result state (clean or threat). Stub data for Phase 1. */
function setStateResult(verdict, options = {}) {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  el.scanningArea.hidden = true;
  el.urlInput.classList.remove("scanning");
  el.analyzeBtn.disabled = false;
  el.analyzeBtn.textContent = "Analyze Link";

  const isClean = verdict === "clean";
  el.verdictBanner.className = "verdict-banner glass " + (isClean ? "clean" : "threat");
  el.verdictText.textContent = isClean ? "No threats detected." : (options.verdictText || "Malicious Redirect Detected.");

  const hops = options.redirects || [el.urlInput.value.trim()];
  el.redirectCard.hidden = false;
  el.redirectList.innerHTML = "";
  hops.forEach((url) => {
    const li = document.createElement("li");
    li.textContent = truncateUrl(url);
    el.redirectList.appendChild(li);
  });

  const pills = options.threatPills || [];
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
  lastAnalyzedUrl = el.urlInput.value.trim();
  updateFullReportLink();
}

/** Truncate URL in the middle to fit ~400px with monospace 12px */
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

/** Stub: simulate analysis. In Phase 1 we don't call a real API. */
function runAnalysis() {
  const url = el.urlInput.value.trim();
  if (!url) return;

  setStateScanning();
  lastAnalyzedUrl = url;

  // Simulate OSINT delay (2.5s) then show a stub result
  setTimeout(() => {
    const looksSuspicious = /evil|malware|phish|\.tk\b|\.ml\b/i.test(url) || url.length > 80;
    if (looksSuspicious) {
      setStateResult("threat", {
        verdictText: "Suspicious or high-risk indicators detected.",
        redirects: [url, "https://example.com/landing"],
        threatPills: [{ label: "URLhaus", level: "danger" }, { label: "OTX", level: "warning" }]
      });
    } else {
      setStateResult("clean", {
        redirects: [url]
      });
    }
  }, 2500);
}

/** On load: get active tab URL and fill input */
async function initWithTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))) {
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
    setStateDefault();
    el.urlInput.value = "";
    lastAnalyzedUrl = null;
    updateFullReportLink();
  });

  if (el.openSettings) {
    el.openSettings.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initWithTabUrl();
  bindEvents();
});
