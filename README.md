# LinkSlinger

A Chrome extension for selecting multiple links via click-and-drag and performing bulk actions.

---

## Built With

* Chrome Extension Manifest V3
* JavaScript
* Chrome Extension APIs

---

## Project Structure

```
src/
  background.js        # Service worker (MV3)
  content.js            # Page injection logic
  manifest.json         # Extension manifest
  offscreen.html        # Offscreen document (clipboard)
  offscreen.js
  styles/
    content.css         # Selection overlay styles
  ui/
    popup/
      popup.html
      popup.css
      popup.js
    options/
      options.html
      options.css
      options.js
  assets/
    icons/
    fonts/
```

---

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/DontPokeMe/linkslinger.git
cd linkslinger
```

### 2. Load Extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `src/` directory

---

## Build Process

No build step required.

The extension runs directly from source in `src/`.

---

## Configuration

User configuration is stored in:

```js
chrome.storage.local
```

Primary settings object:

```js
settings.actions[]
```

Each action defines:

* Activation key
* Mouse trigger
* Behavior (open tabs, new window, copy, etc.)
* Options (smart select, dedupe, filters)
* UI color

---

## Architecture Notes

* **Service worker** (`background.js`) handles action execution (open tabs, copy, bookmark, new window).
* **Content script** (`content.js`) handles DOM selection and overlay rendering only; it does not perform actions.
* **Communication** is via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` (content → background for "activate"; background broadcasts "update" to tabs when settings change).

---

## Permissions

Declared in `manifest.json`:

* `storage`
* `tabs`
* `bookmarks`
* `scripting`
* `clipboardWrite`
* `offscreen`
* `contextMenus`
* `host_permissions: <all_urls>`

Ensure permissions remain minimal and justified.

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Submit a pull request

All features should:

* Avoid breaking existing settings schema
* Include migration handling if settings structure changes
* Avoid introducing unnecessary permissions

---

## Roadmap

Active and requested features are tracked in GitHub Issues.

---

## Chrome Web Store

- **Privacy policy:** [PRIVACY.md](PRIVACY.md) — host this at a stable URL and set that URL in the store listing and Privacy tab.
- **Zero external calls:** LinkSlinger runs entirely locally in your browser. It never tracks what you do, never collects your data, and never makes external network requests.
- **Store assets and listing:** See [docs/STORE_ASSETS.md](docs/STORE_ASSETS.md) and [docs/STORE_LISTING.md](docs/STORE_LISTING.md) for required images and suggested dashboard copy.

---

## License

MIT License.
