# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Toolbar popup with settings: the download button, automatic page loading, ad hiding, AI toolbar hiding and the logo replacement can each be switched off. Settings are stored in `chrome.storage.sync`.
- Esc closes the download preview; the preview shows the page count and a hint to choose "Save as PDF".
- Test suite (`npm test`) with jsdom fixtures for the four document shapes: native PDF with premium-locked pages, native PDF fully readable, native PDF fully locked, and scanned.
- Build script (`npm run build`) that packages `src/` into `dist/`, a CI workflow, and a release workflow that builds, signs and publishes on a `v*` tag.
- `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, issue and pull request templates.

### Changed

- The extension source moved into `src/`; content scripts are split into `common.js`, `cleanup.js`, `pages.js`, `download.js` and `main.js` and share one `StudocuHack` namespace instead of duplicating selectors and URL logic.
- Ads, the AI toolbar and Studocu's native download button are hidden by CSS gated on `html[data-sh-*]` attributes, so toggling a feature needs no stylesheet changes.
- The "could not find the document pages" alert is now an in-page notice.
- Fetched page text is inserted as sanitised DOM nodes rather than through `innerHTML`.
- The periodic re-check pauses while the tab is hidden.
- Manifest declares `data_collection_permissions: none` for Firefox.

### Removed

- The packaged `.xpi` and `.zip` files from the repository. They are attached to each GitHub release and produced by `npm run build`.
- `remove-previewBanner.js`, whose selectors and observer were a subset of the main script.
- The in-page version button, which targeted a header layout Studocu no longer uses. The version is shown in the popup.
- `firefox-add.txt`; the manifest has carried the Firefox settings since 2.7.0.

## [2.10.0] - 2026-08-14

### Fixed

- Premium-locked pages are no longer rebuilt without text (#58). Studocu signs the text layer only for the pages it lets you read; 2.9.0 fell back to the figure-only background for the others and printed empty pages. Locked pages now keep Studocu's blurred preview and carry a label, in the viewer and in the download.
- Documents where every page is locked (`pages: []`) are no longer mistaken for scanned documents and blanked.
- The blur-flag patch no longer clears the document metadata before the page loader reads it.
- The clear-image swap falls back to the original preview instead of leaving a broken image when the server refuses it.
- Page numbering no longer counts the download overlay's own clones.

## [2.9.0] - 2026-07-12

### Fixed

- Blank premium and blurred pages (#56, #57): the signed image parameter is resolved generically (`png` or `global`), so scanned documents load again; every page is force-loaded and backgrounds are injected for pages the viewer unmounted; hex page numbering and an invalid-URL bug are fixed.
- The document is primed on load so premium pages load and un-blur without manual scrolling.
- Page text is recovered where the server serves it; the download path matches.

## [2.8.0] - 2026-05-23

### Changed

- Document download rewritten (#53, #55). Pages are captured incrementally as they load, full-resolution images are reconstructed by page number, images are embedded as data URIs, and the result renders in a same-tab overlay with a Print / Save as PDF button.

### Added

- Ad removal (Refinery89, Google Publisher Tag, Adagio).
- Removal of the "Ask a question" AI toolbar and the Mock exam / Summary / Quiz pills.

## [2.7.0] - 2026-03-14

### Added

- Server-side blurred image swap using the signed CDN parameters; React fiber and `__NEXT_DATA__` patching so pages stay unblurred across re-renders; handling of `.pf` page frames (thanks to the mrtrkmn fork).
- Removal of premium badges, labels and Studocu's native download buttons.
- New logo and restyled download button.
- `browser_specific_settings` with a gecko id for Firefox Manifest V3.

## [2.6.0] - 2026-02-21

### Fixed

- Updated selectors and blur removal for the current Studocu and Studeersnel site structure; fixed the download popup; replaced the broken logo with inline SVG; added scroll-based blur removal for lazy-loaded pages.

## [2.5.0] - 2025-07-13

- Version bump with a refreshed package.

## Earlier releases

2.4.1 (2024-04-20), 2.4.0 (2024-03-10), 2.3.0 (2024-02-09), 2.2.0 (2023-08-05), 2.1.0 (2023-07-20), 2.0.0 (2023-07-20) and 1.0.0 (2023-07-19) are listed on the [Releases page](https://github.com/danieltyukov/studocuhack/releases).

[Unreleased]: https://github.com/danieltyukov/studocuhack/compare/v2.10.0...HEAD
[2.10.0]: https://github.com/danieltyukov/studocuhack/compare/v2.9.0...v2.10.0
[2.9.0]: https://github.com/danieltyukov/studocuhack/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/danieltyukov/studocuhack/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/danieltyukov/studocuhack/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/danieltyukov/studocuhack/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/danieltyukov/studocuhack/releases/tag/v2.5.0
