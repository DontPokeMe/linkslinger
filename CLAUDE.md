# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Install dependencies:**
```bash
npm install
```

**Run E2E tests (Puppeteer):**
```bash
npm run test:e2e
```

**Load the extension in Chrome:**
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" and select the `src/` directory

There is no build step. The extension runs directly from `src/`.

**Cut a release:**
```bash
npm version patch   # or: minor / major
```
This is the only version decision. `npm version` bumps `package.json` +
`package-lock.json`, then the `version` hook (`scripts/prepare-release.js`)
syncs `src/manifest.json` and rolls `CHANGELOG.md` (`## [Unreleased]` becomes
`## [x.y.z] - <date>`, with a fresh empty `[Unreleased]` added). Everything
lands in one `Release x.y.z` commit and a `vx.y.z` tag, which `postversion`
pushes. The tag push then drives CI: `release.yml` (GitHub release + Chrome
Web Store publish) and `blog-announce.yml` (draft blog post from the changelog
section). Default to `patch`; use `minor`/`major` only for a notably larger
release.

Before running it: keep the working tree clean (npm version refuses a dirty
tree) and record what changed under `## [Unreleased]` in `CHANGELOG.md` — that
text becomes the release's changelog and blog announcement. If left empty, a
generic "Maintenance and internal improvements." entry is used.

## Architecture

This is a **Manifest V3 Chrome extension**. The source lives entirely in `src/`.

### Core files

- **`src/background.js`** — Service worker. Contains both `SettingsManager` (the settings class) and all action handlers. Listens for `"init"` (returns settings to content scripts), `"activate"` (executes a link action), and `"update"` (saves new settings and broadcasts to all tabs). Clipboard writes go through an offscreen document because service workers have no DOM.

- **`src/content.js`** — Injected into every page. Handles mouse/keyboard event capture, draws the selection overlay box, detects which links fall within the drag rectangle, and fires `"activate"` to the background when the mouse is released.

- **`src/offscreen.js`** — Offscreen document used exclusively for `navigator.clipboard.writeText`. The background creates this document on demand and messages it to perform clipboard operations.

- **`src/ui/options/options.js`** — Options page logic. Manages the full settings UI including profiles, actions, blocked-site patterns, and filter rules.

- **`src/ui/popup/popup.js`** — Toolbar popup. Quick-enable/disable and status display.

### Settings schema

Settings are stored in `chrome.storage.local` under the key `"settings"`. The schema has two top-level concerns:

- **`actions`** — keyed by numeric string IDs (e.g. `"101"`). Each action has `action` (one of `"tabs"`, `"win"`, `"copy"`, `"bm"`, `"export"`), a `color`, and an `options` object.
- **`profiles`** — array of trigger→action mappings. A profile binds a `trigger` (key + modifiers, or modifier-only) to an `actionId` referencing an entry in `actions`.

`SettingsManager.normalizeSettings()` is the canonical normalizer — pure and idempotent. Always pass settings through it before saving or broadcasting. When adding new fields to the schema, bump `CURRENT_VERSION` in `background.js` and add migration logic to `SettingsManager.update()`.

### Message passing

| Sender | Recipient | Message | Purpose |
|--------|-----------|---------|---------|
| `content.js` | `background.js` | `"init"` | Load settings on page load |
| `content.js` | `background.js` | `"activate"` | Execute action for selected links |
| `options.js` | `background.js` | `"update"` | Persist new settings |
| `background.js` | all tabs | `"update"` | Broadcast after settings change |
| `background.js` | `offscreen.js` | `"copy-to-clipboard"` | Clipboard write |

### Trigger resolution

`triggerSig()` / `triggerSigContent()` produce a canonical string like `key:z|mods:0000|btn:0` used to match a mousedown event against the profile list. Both background and content script have identical implementations (different scope, no shared module). Keep them in sync if modifying trigger logic.

### Settings schema constraints

- Avoid breaking the existing `actions` object shape; existing user data is normalized on load.
- If adding or renaming fields, update `normalizeSettings()` to fill defaults for old data.
- Action IDs start at `101` by convention; `104` (Bookmark) is always ensured present.
