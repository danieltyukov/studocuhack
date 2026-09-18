# How StudocuHack works

This is the reference for anyone changing `src/content/pages.js` or `download.js`. It records what was measured against the live site, because most of the historical bugs came from guessing at it.

## The viewer

Studocu renders a native PDF with [pdf2htmlEX](https://github.com/pdf2htmlEX/pdf2htmlEX) in split-page mode and shows it through a React virtual scroller:

- A `.p2hv` container (also carrying a `Viewer_page-container__*` class) holds one `.pf` element per page.
- Each `.pf` is a background image (`img.bi`, the figure layer) plus a positioned HTML text layer: real, selectable `<span>`s using `@font-face` fonts named `ff1`, `ff2` and so on.
- The pdf2htmlEX stylesheet (fonts and `.p2hv .pc { position: absolute; ... }` positioning) is a document-specific stylesheet on the CDN, loaded into `<head>`. Its rules are scoped under `.p2hv`, so anything that reuses the pages must keep that class on the wrapper.
- The scroller lazy-loads a page's assets when it comes into view and unmounts pages that scroll far away. An unmounted page is an empty `.pf`; a page that has not come into view yet may hold an `<img loading="lazy">` that never fetched, or a 140x198 thumbnail.

Those two behaviours are why users saw blank pages: nothing was wrong with the assets, the DOM simply did not contain them yet. The "Load every page on open" pass in `pages.js` scrolls through the document once so the viewer fetches everything, and the download captures each page while it is in view.

## The CDN and the signed parameters

Assets live at `https://doc-assets.studocu.com/{objectKey}/html/`. For each page:

| Asset | Path | Numbering | Notes |
| --- | --- | --- | --- |
| Figure layer | `bg{n}.png` | hex (`bg12.png` is page 18) | Rules, table borders, bullet glyphs, coloured boxes. No text. pdf2htmlEX writes these with `%x`. |
| Text layer | `{objectKey}{n}.page` | decimal (`{objectKey}18.page` is page 18) | Positioned `<span>`s. Signed per page. Verified against the viewer's own requests; before 2.11.0 the extension built these in hex, so text recovery for pages 10 and up silently 403'd. |
| Blurred preview | `pages/blurred/page{n}.webp` | decimal | A small thumbnail with the blur baked in. |
| Clear raster | `pages/page{n}.webp` | decimal | 403 on premium pages. |
| Stylesheet | `{objectKey}.css` | | Fonts and layout. |

The signing keys are in the page's `#__NEXT_DATA__` under `props.pageProps.documentAccess.signedQueryParams`, and the shape of that object varies:

- **Scanned / image documents**: `{ global }`. One wildcard string that authorises `/html/*.png`. The background image is the page content. `hasBlurredPages` is false.
- **Native text documents**: `{ html, css, png, blurredPage, pages }`. `png` is a wildcard for `/html/*.png`. `pages` is an **array** of `{ pageNumber, signedQueryParams }`, one entry per text-bearing page the reader is allowed to see. It is not a string; concatenating it into a URL once produced `bg8.png[object Object]` requests.

`SH.parseDocumentAccess` in `common.js` normalises both shapes. `SH.pickParam` only ever returns a string.

## Which pages can be recovered

Measured on a 19-page premium document in August 2026 (issue #58), for a page that is **not** listed in `pages`:

| Request | Result |
| --- | --- |
| `{objectKey}{n}.page` with every parameter the client holds | 403 |
| `pages/page{n}.webp` | 403 |
| `pages/page{n}.png` | 404 |
| `{objectKey}.html` | 200, but a 1 KB skeleton of empty `.pf` divs |
| `previewTextData.text` in `__NEXT_DATA__` | covers only the listed pages |
| `pages/blurred/page{n}.webp` | 200, a 140x198 thumbnail |
| `bg{n}.png` | 200, about 9 KB of figure art and no text |

A CDP recording of a full scroll through the document showed the viewer never requests a `.page` file for those pages; it only fetches the blurred thumbnail. The text of a premium-locked page is therefore not on the client in any form, and no extension can produce it.

The rule that follows:

> A page is **premium-locked** when `Array.isArray(signedQueryParams.pages)` and the page has no entry in it. It is keyed off the presence of `pages`, not its length: `pages: []` means every page is locked, not that the document is scanned.

`SH.isTextGated` implements this. It deliberately does not look at `hasBlurredPages`, because `pages.patchNextData` rewrites that flag to `false` in the DOM to stop React re-blurring, and reading it back afterwards would report a premium document as a free one. The access model is read once from the pristine JSON before the patch and cached.

For a locked page the extension keeps Studocu's blurred preview as the page image and adds a `.sh-gated-note` label. It must not swap in `bg{n}.png`: that image is only the figure layer, so the result is a clean, empty sheet, which is worse than the blur.

## Fetching

Image and text fetches use `credentials: 'omit'`. The asset host sends no `Access-Control-Allow-Origin` for credentialed requests, so `credentials: 'include'` fails CORS.

A fetched `.page` fragment goes through `pages.sanitizePageHtml` before insertion: it is parsed in an inert document, `script`, `iframe`, `object`, `embed`, `link` and `style` elements are dropped, `on*` attributes and `javascript:` URLs are removed, and the remaining nodes are adopted into the page. A fragment is plain positioned text, so nothing legitimate is lost.

## The update loop (`main.js`)

Studocu is a React app and re-renders pages as you scroll, which puts the blur back. `main.js` therefore runs the cleanup and page passes:

- once at start and on `DOMContentLoaded` and `load`;
- on DOM mutations (debounced 50 ms), immediately when a mutation adds a blurred image or class;
- on scroll (debounced 100 ms);
- every 2 s for the first 30 s, then every 5 s, skipped while the tab is hidden.

`patchReactBlurState` walks the React fiber of each `.pf` and sets `isBlurred` and `hasBlurredImage` to `false` in `memoizedProps`, so a re-render does not reapply the filter.

## Download (`download.js`)

1. For each `.pf` in order: scroll it into view, poll until it has rendered and its size has stabilised (or 4.5 s pass), clone it.
2. Put the clones in a new `.p2hv` div. Only that class is kept; the scroller's own classes carry layout that breaks outside the viewer.
3. Point each clone's background at the full-resolution `bg{n}.png` (or the clear sibling of a blurred URL). Locked pages keep the blurred preview and get the label.
4. Fetch every CDN image and replace its `src` with a data URI, six at a time.
5. Show the result in a fixed overlay in the same tab. The capture runs in the same tab on purpose: a background tab has throttled timers and paused lazy-loading.
6. `body.sh-dl-open` switches on print rules in `style.css` that hide everything except the overlay and break pages with `break-after: page`. `applyPageSizes` measures each page and emits a named `@page` rule per distinct size, so the printed sheets match the document's own page size instead of the browser's default paper. The user prints to PDF.

Both the capture and the auto-load pass save and restore the reader's position through `SH.saveScroll` / `SH.restoreScroll`. On the current site the viewer wrappers are as tall as their content and the window is what scrolls, so `SH.getScroller` only returns a wrapper that really overflows and falls back to `document.scrollingElement` otherwise.

## Settings

Five booleans in `chrome.storage.sync`, edited by the popup, read once by `common.js` when a page loads. CSS-only features are toggled through attributes on `<html>` (`data-sh-ads`, `data-sh-ai`, `data-sh-download`) that the rules in `style.css` exclude, so a disabled feature needs no stylesheet juggling and an enabled one never flashes.

## Testing

`npm test` runs `node --test` with jsdom. `test/fixtures/documents.mjs` builds a document page for each of the four shapes (text with gaps, all free, all locked, scanned) with pages in any of the states the live viewer leaves them in (rendered text, blurred image, empty placeholder). Nothing touches the network: images never load and `fetch` fails unless a test supplies one, so the assertions are about which branch ran.

Testing against the live site is possible but scarce. After a few automated loads Studocu serves an "Access Blocked" page with no `#__NEXT_DATA__`; clearing cookies and opening a fresh tab gets past it. A window that is not visible throttles `IntersectionObserver`, which makes the scroller hide every page, so bring the window to the front before scrolling or taking screenshots.

## Selectors live in two places

`style.css` hides upsell chrome, ads and the AI toolbar before any script runs, and `SH.SELECTORS` in `common.js` removes the same elements when React re-mounts them. When Studocu renames a class, update both. The test suite checks that every selector in `SH.SELECTORS` is valid CSS.
