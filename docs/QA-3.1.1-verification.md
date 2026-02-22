# QA verification for LinkSlinger 3.1.1 (Z-trigger fix)

## 1. Reload the extension

- Open `chrome://extensions`
- Find LinkSlinger → turn **Off** then **On**, then click **Reload**
- Or remove and re-add the unpacked extension

(MV3 can cache old service worker state; reload matters.)

---

## 2. Verify stored profiles (optional – in extension service worker)

1. Open LinkSlinger’s **service worker** (click “service worker” link on `chrome://extensions` for LinkSlinger).
2. In the console, run:

```js
chrome.storage.local.get("settings").then(r => console.log(r.settings?.profiles))
```

**Expected:** Default profile has `trigger.kind === "key"` and `trigger.key === "z"` (lowercase). No `"Z"` anywhere.

---

## 3. Verify content script received normalized settings (optional)

1. Reload any **normal web page** (e.g. https://example.com).
2. Open **DevTools** (F12) → **Console** on that page.
3. Look for: `LinkSlinger settings.profiles` with an array of profiles.

**Expected:** Each key-trigger profile has `trigger.key === "z"` (lowercase).

---

## 4. Test selection start (required)

Test **both** patterns:

| # | What to do | Expected |
|---|------------|----------|
| **1** | **Hold Z first** → then click and drag on the page | Selection box appears and links are selected. |
| **2** | Click and start dragging → **then** press Z while still dragging | Currently: selection does **not** start (known limitation). If (1) works, the 3.1.1 fix is good. |

- If **(1) works** and **(2) fails:** the normalization fix is confirmed; “late-arm” (supporting Z after mousedown) would be a follow-up (3.1.2).
- If **(1) still doesn’t work:** report back (extension reload + storage check above).

---

## 5. After QA

- Remove the temporary `console.log("LinkSlinger settings.profiles", ...)` from the content script before release, or ship as-is for one QA build only.
