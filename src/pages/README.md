# Legacy Pages Directory

This directory contains legacy UI files from the original LinkClump extension.

## Current Status

- **`options.html`** - ❌ **DEPRECATED** - Old options page (replaced by `ui/options/options.html`)
- **`options.js`** - ❌ **DEPRECATED** - Old options JavaScript (replaced by `ui/options/options.js`)
- **`style.css`** - ❌ **DEPRECATED** - Old styles (replaced by `ui/options/options.css`)
- **`test_area.html`** - ✅ **KEPT** - Test area for link selection (still useful for testing)
- **`test.css`** - ✅ **KEPT** - Styles for test area

## Migration Notes

The extension now uses the new UI located in `ui/`:
- Options page: `ui/options/options.html` (referenced in manifest.json)
- Popup: `ui/popup/popup.html` (referenced in manifest.json)

## Cleanup

These legacy files can be removed in a future version:
- `pages/options.html`
- `pages/options.js`
- `pages/style.css`

The test area files (`test_area.html`, `test.css`) should be kept for testing purposes.
