# Contributing

Thanks for helping keep StudocuHack working. Most contributions are one of three kinds: a selector that Studocu renamed, a page that renders blank or blurred when it should not, or a new feature. This file covers how to work on each.

## Setup

You need Node.js 20 or newer.

```
git clone https://github.com/danieltyukov/studocuhack.git
cd studocuhack
npm install
npm test
```

Load `src/` as an unpacked extension in Chrome (`chrome://extensions`, Developer mode, Load unpacked) to run your working copy. After editing a file, press the reload icon on the extension card and reload the Studocu tab. In Firefox, use `about:debugging`, This Firefox, Load Temporary Add-on, and pick `src/manifest.json`, or run `npm run start:firefox`.

## Where things live

| Path | What it is |
| --- | --- |
| `src/content/common.js` | The shared `StudocuHack` namespace: selector lists, the document access model (which pages the CDN will serve), URL builders, settings. |
| `src/content/cleanup.js` | Removes banners, badges, "Upgrade" buttons, recommendations, Studocu's own download button; replaces the logo. |
| `src/content/pages.js` | Blur removal, forcing lazy pages to load, fetching text layers, labelling premium-locked pages. |
| `src/content/download.js` | The Download button and the print overlay. |
| `src/content/main.js` | Wires everything to DOM mutations, scrolling and a periodic sweep. Nothing else runs on its own. |
| `src/content/style.css` | Applied before any script runs. Hides upsell chrome, ads and the AI toolbar statically. |
| `src/popup/` | The toolbar popup that edits the settings. |
| `test/` | `node --test` suites. `test/fixtures/documents.mjs` generates the four document shapes the extension has to tell apart. |
| `docs/ARCHITECTURE.md` | How Studocu serves pages and why some cannot be unblurred. Read this before touching `pages.js`. |
| `site/` | The project site, <https://danieltyukov.github.io/studocuhack/>. Plain HTML and CSS, published as it is by `.github/workflows/pages.yml` on every push to `master` that touches it. The fonts are committed subsets made by `scripts/fetch-fonts.sh`; `test/site.test.mjs` checks the page's local references and its dark-mode tokens. |

## Fixing a broken selector

Studocu uses CSS modules, so class names look like `PremiumBannerBlobWrapper_abc12` and the hash changes between deployments. The selectors therefore match on a stable substring with `[class*="..."]`.

1. Open the document page, right-click the element that came back, Inspect, and find a stable part of its class name or a `data-test-selector` attribute.
2. Add the selector in **both** places: the matching list in `SH.SELECTORS` in `src/content/common.js` (so the script removes it when React re-mounts it) and the matching rule in `src/content/style.css` (so it never flashes before the script runs). Ads and the AI toolbar are CSS-only; put those in the `html:not([data-sh-...])` blocks so the popup toggle keeps working.
3. Run `npm test`. There is a test that checks every selector is valid CSS.
4. In the pull request, say which site (studocu.com, studeersnel.nl, studocu.vn, studocu.id) and what kind of page you saw it on.

## Fixing a blank or blurred page

First read `docs/ARCHITECTURE.md`. The short version: a page is either recoverable (its text layer is listed in the signed parameters) or premium-locked (it is not, and nothing the browser can fetch contains its text). The extension must never replace a premium-locked page with the figure-only background image, because that prints as a crisp, empty sheet. Pull requests that "fix" blur on locked pages by swapping in that image will be closed; see issue #58 for the history.

When you report or fix a page problem, include the lines from the browser console that start with `StudocuHack:`. They list which pages were recovered and which were locked.

Add a fixture test in `test/pages.test.mjs` for the document shape you are fixing. The fixtures do not need network access; assert which branch ran (a label was added, a text fetch was attempted, an image injection started).

## Adding a feature

Open an issue first if it changes what the extension does on the page. Keep the extension dependency-free at runtime: content scripts are plain scripts loaded in manifest order, and everything shared goes through the `StudocuHack` namespace in `common.js`. New user-facing behaviour that some people may not want should get a toggle in the popup (see `DEFAULT_SETTINGS` in `common.js`, `applySettingsToDocument`, and `src/popup/`).

## Pull requests

- Run `npm run check` (lint, tests, build) before pushing.
- Keep the change focused. A selector fix and a feature belong in separate pull requests.
- Do not commit built archives. Releases are built by the release workflow from the tag.
- Describe how you tested it: browser, site, document type (native PDF or scanned), and whether the document had premium-locked pages.
- Add an entry under "Unreleased" in `CHANGELOG.md`.

## Code style

Plain ES2020 that runs unbundled in current Chrome and Firefox. Four-space indent (see `.editorconfig`). Prefer `textContent` and `createElement` over `innerHTML`; the only HTML the extension inserts from outside is a CDN page fragment, and that goes through `sanitizePageHtml` first. Every `console.log` goes through `SH.log` so users can filter on the `StudocuHack:` prefix.

## Releases (maintainers)

1. Bump `version` in `src/manifest.json` and `package.json`.
2. Move the "Unreleased" entries in `CHANGELOG.md` under a new `## [X.Y.Z] - YYYY-MM-DD` heading.
3. Commit, then tag and push:

   ```
   git tag vX.Y.Z
   git push origin master vX.Y.Z
   ```

4. The release workflow lints, tests, builds `dist/studocuhack-vX.Y.Z.{zip,xpi}`, signs the `.xpi` through Mozilla if the `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` repository secrets are set, and creates the GitHub release with the changelog section as its notes.
5. If the secrets are not set, sign locally with `npm run sign` (see `scripts/sign-firefox.sh`) and upload the signed `.xpi` to the release with `gh release upload vX.Y.Z web-ext-artifacts/*.xpi --clobber`.
