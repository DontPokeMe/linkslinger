# QA verification for LinkSlinger 3.2.0 (Bookmarks + selection fallback)

Use this checklist to verify bookmark behavior and selection for store review. Capture at least one screenshot (Options → Profiles) for reviewers if requested.

---

## A) UI proof

1. Open **Options** → **Profiles**.
2. Confirm a profile exists with:
   - **Trigger:** Ctrl  
   - **Action:** Bookmark (or "104 (Bookmark)")
3. Confirm **Default (Shift)** profile exists (Shift + drag → Open in tabs) as fallback if Z does not work.

**Screenshot:** Options → Profiles showing the Bookmark profile and Default (Shift).

---

## B) Behavior proof (use a normal HTTPS page)

Selection does **not** work on:

- `chrome://` pages  
- Chrome Web Store pages  
- Other restricted contexts  

Use **https://example.com** (or any normal HTTPS page with links).

### B1) Bookmark action

1. Go to **https://example.com**.
2. Hold **Ctrl** and click-drag to select 2 links (or any page with multiple links).
3. Release; bookmarks should be created at:
   - **Bookmarks Bar → LinkSlinger → YYYY-MM-DD**
4. Repeat selection of the **same** links and release again.
5. **Expected:** Second run does not add duplicates; in service worker console you should see **skipped** increase, **added** does not (dedupe works).

### B2) Selection fallback (for reviewers)

- **Z** + drag → selection starts (Default profile, open in tabs).
- **Shift** + drag → selection starts (Default (Shift) profile, open in tabs).  
  If Z does not work on the reviewer machine, Shift + drag must work.

---

## C) Service worker log (optional but strong)

1. Open LinkSlinger’s **service worker** (chrome://extensions → LinkSlinger → “service worker”).
2. After running the Bookmark action, confirm a console line like:
   - `LinkSlinger: Bookmark action — added: X, skipped: Y, total: Z`  
   - or `LinkSlinger: Bookmark — X added, Y skipped`

---

## D) QA debug (if selection still fails)

In `src/content.js`, set:

```js
var DEBUG_ACTIVATION = true;
```

Reload the extension and the page. On mousedown, the **page** DevTools console will log:

- `heldKey`, `event.key`, `activeActionId`, `profileName`

Use this to see whether key capture or profile resolution is failing. Set back to `false` before release.
