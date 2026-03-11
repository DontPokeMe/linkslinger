# Chrome Web Store Listing Copy

Use this text in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) for the LinkSlinger listing. Keep it accurate and aligned with [PRIVACY.md](../PRIVACY.md) and the in-app About copy.

## Item title

**LinkSlinger**

(Keep short and clear; avoid keyword stuffing.)

## Short description (summary, ≤132 characters)

**Suggested:**

Select multiple links with a drag, then open in tabs, copy, bookmark, or export. Part of the dontpoke.me toolkit.

(132 chars max. Adjust if the dashboard shows a different limit.)

## Detailed description

**Suggested (overview + features):**

LinkSlinger lets you select many links at once by dragging a box, then perform bulk actions in one go. Hold a key (e.g. Z), drag to select links on any page, and release to open them in new tabs, copy URLs to the clipboard, bookmark them, or export. It never tracks what you do, never collects your data, and never makes external network requests.

**Features:**
- **Bulk link selection:** Draw a selection box to include only the links you want.
- **Flexible actions:** Open in tabs, open in a new window, copy (multiple formats), or add to bookmarks (Bookmarks Bar → LinkSlinger → date).
- **Profiles and triggers:** Map different keys or modifiers to different actions (e.g. Z = tabs, Alt+C = copy, Ctrl+B = bookmark).
- **Filters:** Optional regex include/exclude filter and per-site blocklist.

LinkSlinger is open source and part of the dontpoke.me OSINT toolkit. Your settings stay on your device; no data is sent to any external service.

(No keyword spam; no unsubstantiated claims like "Editor's Choice" or "#1".)

## Category

Choose **one** that best fits:

- **Tools** – General-purpose utilities.
- **Workflow & Planning** – Efficiency and task management.

Recommendation: **Tools**.

## Single purpose (dashboard field)

**Suggested:**

Select multiple links on a page with a mouse drag and perform bulk actions (open in tabs, copy, bookmark, or export). All processing happens locally in your browser; no data is sent to any external service.

## Permission justification (dashboard)

Use when the dashboard asks why each permission is needed. Example wording:

- **Access to all sites (host permission):** Required so the extension can run the link-selection overlay on web pages the user visits. No data is sent to the developer; the extension never makes external requests.
- **Tabs:** To open selected links in new tabs or a new window and to communicate with the content script on open tabs for settings updates.
- **Bookmarks:** To add selected links to a folder under Bookmarks Bar (e.g. LinkSlinger → date) when the user chooses the bookmark action.
- **Storage:** To save user settings locally on the device.
- **Scripting:** To inject the content script into existing tabs on first install/update so selection works without reloading pages.
- **Clipboard write:** To copy selected links or formatted text to the clipboard when the user chooses the copy action.
- **Offscreen document:** Used to perform clipboard operations from the extension (Chrome MV3 requirement).
- **Context menus:** To support any in-page link selection shortcuts or context entries implemented entirely locally.

## Support URL

Set to one of (or a dedicated support page):

- GitHub Issues: `https://github.com/DontPokeMe/linkslinger/issues`
- Tool page: `https://dontpoke.me/tools/linkslinger`

## Privacy policy URL

**Required.** Use the URL where you host [PRIVACY.md](../PRIVACY.md), for example:

- `https://github.com/DontPokeMe/linkslinger/blob/main/PRIVACY.md` (GitHub raw or rendered), or
- A page on your site that contains the same content: `https://dontpoke.me/privacy` (or similar).

Ensure the Privacy tab certification in the dashboard matches this policy and the extension behavior.
