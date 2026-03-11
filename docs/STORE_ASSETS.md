# Chrome Web Store Assets

Use this checklist when preparing a release for the Chrome Web Store. Required and optional assets are defined by [Supplying Images](https://developer.chrome.com/docs/webstore/images) and [Creating a great listing page](https://developer.chrome.com/docs/webstore/best_listing).

## Extension icon (in ZIP)

The packaged extension ZIP must include icon files referenced in `manifest.json`:

| File | Size | Notes |
|------|------|--------|
| `src/assets/icons/icon-16.png` | 16×16 | Action icon |
| `src/assets/icons/icon-32.png` | 32×32 | Action icon |
| `src/assets/icons/icon-48.png` | 48×48 | Options, store small |
| `src/assets/icons/icon-128.png` | 128×128 | **Required** for store; use 96×96 artwork + 16px transparent padding |

- Format: PNG.
- 128×128: Should work on light and dark backgrounds; front-facing, simple design.
- Ensure `src/assets/icons/` exists and contains these files before running the package step (e.g. `zip` from `src/`).

## Promotional images (upload in Developer Dashboard)

| Asset | Size | Required | Notes |
|-------|------|----------|--------|
| **Small promo tile** | 440×280 px | **Yes** | Homepage, category, search. Full bleed, clear edges, saturated colors; avoid excessive text. |
| **Marquee** | 1400×560 px | No | Only needed if you want eligibility for the homepage marquee carousel. |

Upload under your item’s **Promotional images** in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Screenshots (upload in Developer Dashboard)

| Requirement | Details |
|-------------|---------|
| **Minimum** | 1 screenshot |
| **Recommended** | 3–5 screenshots |
| **Dimensions** | 1280×800 or 640×400 px |
| **Style** | Full bleed, square corners, no padding |

Suggested content:

1. Link selection in action (drag box, highlighted links).
2. Popup UI (tabs: Select, Analyze if applicable).
3. Options page (profiles / settings).
4. Copy or bookmark result (optional).
5. Context menu or keyboard trigger (optional).

Screenshots should show the current version of the extension and match the description.

## Summary

- **In the repo / package:** Provide `src/assets/icons/icon-{16,32,48,128}.png` and include them in the ZIP.
- **In the dashboard:** Upload at least one small promo tile (440×280), one screenshot (1280×800 or 640×400), and optionally a marquee (1400×560) and more screenshots.
