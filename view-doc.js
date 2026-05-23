// ============================================================
// StudocuHack - Document Download
// Studocu/Studeersnel renders documents as pdf2htmlEX pages:
// a `.p2hv` container holds one `.pf` per page, each combining
// a background image (figures) with a positioned HTML text layer
// (real selectable text + embedded @font-face fonts).
//
// To download a faithful copy we:
//   1. Force every page to lazy-load (scroll through the viewer).
//   2. Clone the `.p2hv` container (keeps the CSS scope).
//   3. Inline the document's pdf2htmlEX stylesheet (fonts + layout).
//   4. Embed every background image as a data URI.
// The result is a fully self-contained HTML document that prints
// to a complete PDF (all pages, text + figures, no blank pages).
// ============================================================

(function() {
    'use strict';

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function getTitle() {
        return document.querySelector('h1')
            ? document.querySelector('h1').textContent.trim()
            : (document.title || 'document');
    }

    // Resolve the full-resolution page-image URL pattern. Page images are
    // HEX-numbered: .../html/bg{hexPageNum}.png{signedParams}. We reconstruct
    // these ourselves so we never depend on the low-res thumbnail the viewer
    // may have lazy-loaded for a given page.
    function getImagePattern() {
        try {
            var nd = JSON.parse(document.querySelector('#__NEXT_DATA__').textContent);
            var da = nd.props.pageProps.documentAccess;
            if (da && da.objectKey && da.signedQueryParams && da.signedQueryParams.png) {
                return {
                    prefix: 'https://doc-assets.studocu.com/' + da.objectKey + '/html/bg',
                    suffix: '.png' + da.signedQueryParams.png
                };
            }
        } catch (e) {}
        // Fallback: derive from a full-resolution image already in the DOM.
        var imgs = document.querySelectorAll('.pf img');
        for (var i = 0; i < imgs.length; i++) {
            var s = imgs[i].src || '';
            if (s.indexOf('/bg') !== -1 && s.indexOf('doc-assets') !== -1 && imgs[i].naturalWidth > 600) {
                var m = s.match(/(.*?\/bg)[0-9a-f]+(\.png\?.*)/i);
                if (m) return { prefix: m[1], suffix: m[2] };
            }
        }
        return null;
    }

    // A page is "rendered" once it leaves the empty lazy placeholder state:
    // it gains its background image and/or text spans. Empty placeholders are
    // tiny (~200 chars); a loaded image-only page is ~1k; a text page is many k.
    function pageRendered(pf) {
        var hasSpans = pf.querySelectorAll('span').length > 3;
        var img = pf.querySelector('img');
        var imgLoaded = img && img.complete && img.naturalWidth > 0;
        return pf.innerHTML.length > 500 && (hasSpans || imgLoaded);
    }

    // Wait until a single page has finished rendering and its content size has
    // stabilised (so we don't clone a half-rendered text layer).
    function waitForPageReady(pf) {
        return new Promise(function(resolve) {
            var lastLen = -1, stable = 0, tries = 0;
            function check() {
                var len = pf.innerHTML.length;
                if (pageRendered(pf)) {
                    if (len === lastLen) { stable++; } else { stable = 0; lastLen = len; }
                    if (stable >= 2) { resolve(); return; }
                }
                if (tries++ > 30) { resolve(); return; } // ~4.5s safety cap per page
                setTimeout(check, 150);
            }
            check();
        });
    }

    // Studocu's React viewer lazy-loads page text AND unmounts pages that
    // scroll out of view. So we capture each page incrementally: scroll to it,
    // wait until it is fully rendered, then clone it immediately (before it can
    // unmount). Returns an array of cloned `.pf` elements in page order.
    function captureAllPages(onProgress) {
        var pfs = document.querySelectorAll('.pf');
        var container = document.getElementById('viewer-wrapper') ||
                        document.getElementById('document-wrapper') ||
                        document.scrollingElement || document.documentElement;
        var savedTop = container ? container.scrollTop : 0;
        var captured = [];

        return new Promise(function(resolve) {
            var i = 0;
            function next() {
                if (i >= pfs.length) {
                    if (container) container.scrollTop = savedTop;
                    resolve(captured);
                    return;
                }
                var pf = pfs[i];
                pf.scrollIntoView({ behavior: 'instant', block: 'center' });
                waitForPageReady(pf).then(function() {
                    captured.push(pf.cloneNode(true));
                    i++;
                    if (onProgress) onProgress(i, pfs.length);
                    next();
                });
            }
            next();
        });
    }

    // Fetch one image URL and return a data URI (or null on failure).
    function fetchDataUri(url) {
        return fetch(url, { credentials: 'omit' })
            .then(function(r) { return r.ok ? r.blob() : null; })
            .then(function(blob) {
                if (!blob || blob.size === 0) return null;
                return new Promise(function(resolve) {
                    var fr = new FileReader();
                    fr.onload = function() { resolve(fr.result); };
                    fr.onerror = function() { resolve(null); };
                    fr.readAsDataURL(blob);
                });
            })
            .catch(function() { return null; });
    }

    // Replace every doc-assets image src inside `root` with an embedded data URI.
    function embedImages(root, onProgress) {
        var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
        var targets = imgs.filter(function(img) {
            var s = img.getAttribute('src') || '';
            return s.indexOf('doc-assets') !== -1 || s.indexOf('/bg') !== -1;
        });
        // De-duplicate identical srcs so each image is fetched only once.
        var unique = {};
        targets.forEach(function(img) { unique[img.getAttribute('src')] = true; });
        var urls = Object.keys(unique);
        var map = {};
        var next = 0, done = 0;
        var CONCURRENCY = 6;

        return new Promise(function(resolve) {
            function worker() {
                if (next >= urls.length) return Promise.resolve();
                var url = urls[next++];
                return fetchDataUri(url).then(function(dataUri) {
                    if (dataUri) map[url] = dataUri;
                    done++;
                    if (onProgress) onProgress(done, urls.length);
                    return worker();
                });
            }
            if (urls.length === 0) { resolve(); return; }
            var starters = [];
            for (var c = 0; c < Math.min(CONCURRENCY, urls.length); c++) starters.push(worker());
            Promise.all(starters).then(function() {
                targets.forEach(function(img) {
                    var s = img.getAttribute('src');
                    if (map[s]) {
                        img.setAttribute('src', map[s]);
                        img.removeAttribute('srcset');
                    }
                });
                resolve();
            });
        });
    }

    // Assemble the captured page clones into a fresh `.p2hv` container. The
    // pdf2htmlEX stylesheet scopes its rules under `.p2hv`, so the wrapper must
    // keep that class for fonts/positioning to apply. We also point each page's
    // background image at its full-resolution URL (by page number) so low-res
    // lazy thumbnails are replaced with the real page image.
    function assembleContainer(capturedPages, pattern) {
        var container = document.createElement('div');
        // Keep ONLY the `p2hv` class: the pdf2htmlEX stylesheet scopes its
        // font/positioning rules under `.p2hv`, but the live viewer's other
        // classes (e.g. Viewer_page-container) carry virtual-scroller layout
        // that breaks the pages when cloned out of the viewer.
        container.className = 'p2hv';

        capturedPages.forEach(function(pf, idx) {
            // Drop any of our injected helpers and force-hidden content visible.
            pf.removeAttribute('style');
            pf.querySelectorAll('.download-button-1, .github-button, [data-studocuhack]').forEach(function(e) { e.remove(); });
            pf.querySelectorAll('[style]').forEach(function(e) {
                var st = e.getAttribute('style') || '';
                if (/display:\s*none/i.test(st)) {
                    e.setAttribute('style', st.replace(/display:\s*none/ig, 'display:block'));
                }
            });
            // Force the page background image to full resolution (page idx+1, hex).
            if (pattern) {
                var bg = pf.querySelector('img.bi') || pf.querySelector('img');
                if (bg) {
                    bg.setAttribute('src', pattern.prefix + (idx + 1).toString(16) + pattern.suffix);
                    bg.removeAttribute('srcset');
                    bg.removeAttribute('data-src');
                }
            }
            container.appendChild(pf);
        });
        return container;
    }

    // Inject the styles for the in-page download overlay + print isolation.
    // The pdf2htmlEX document stylesheet is already loaded on the live page
    // (it lives in <head>), so the cloned `.p2hv` pages are styled automatically;
    // we only add layout for the overlay and the print rules.
    function injectOverlayStyles() {
        if (document.getElementById('sh-dl-style')) return;
        var style = document.createElement('style');
        style.id = 'sh-dl-style';
        style.textContent =
            '#sh-dl-overlay{position:fixed;inset:0;z-index:2147483647;background:#525659;overflow:auto;}' +
            '#sh-dl-overlay .sh-dl-bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;' +
            'justify-content:space-between;gap:12px;background:#1a1a2e;color:#fff;padding:10px 20px;' +
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}" +
            '#sh-dl-overlay .sh-dl-bar .t{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
            '#sh-dl-overlay .sh-dl-bar .actions{display:flex;gap:8px;flex-shrink:0;}' +
            '#sh-dl-overlay .sh-dl-bar button{border:0;border-radius:6px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;}' +
            '#sh-dl-overlay .sh-dl-print{background:#4D8BF5;color:#fff;}' +
            '#sh-dl-overlay .sh-dl-close{background:#444;color:#fff;}' +
            '#sh-dl-overlay .sh-dl-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'gap:16px;height:78vh;color:#fff;font-family:sans-serif;}' +
            '#sh-dl-overlay .sh-dl-loading .bar{width:320px;height:10px;background:#33334d;border-radius:6px;overflow:hidden;}' +
            '#sh-dl-overlay .sh-dl-loading .fill{height:100%;width:0;background:#4D8BF5;transition:width .2s;}' +
            '#sh-dl-overlay .sh-dl-pages .p2hv{margin:0 auto;}' +
            '#sh-dl-overlay .sh-dl-pages .pf{margin:12px auto !important;background:#fff !important;' +
            'box-shadow:0 2px 8px rgba(0,0,0,.4);display:block !important;filter:none !important;opacity:1 !important;}' +
            '#sh-dl-overlay .sh-dl-pages .page-content,#sh-dl-overlay .sh-dl-pages .pc{' +
            'display:block !important;visibility:visible !important;filter:none !important;opacity:1 !important;}' +
            '#sh-dl-overlay .sh-dl-pages .pf img{filter:none !important;opacity:1 !important;visibility:visible !important;}' +
            '@media print{' +
            'body > *:not(#sh-dl-overlay){display:none !important;}' +
            'html,body{background:#fff !important;height:auto !important;overflow:visible !important;}' +
            '#sh-dl-overlay{position:static !important;inset:auto !important;overflow:visible !important;background:#fff !important;height:auto !important;}' +
            '#sh-dl-overlay .sh-dl-bar{display:none !important;}' +
            '#sh-dl-overlay .sh-dl-pages .pf{margin:0 !important;box-shadow:none !important;page-break-after:always;break-after:page;}' +
            '#sh-dl-overlay .sh-dl-pages .pf:last-child{page-break-after:auto;}' +
            '@page{margin:0;}' +
            '}';
        document.head.appendChild(style);
    }

    // Build the overlay DOM (loading state). Returns handles for updating it.
    function createOverlay(title) {
        var overlay = document.createElement('div');
        overlay.id = 'sh-dl-overlay';

        var bar = document.createElement('div');
        bar.className = 'sh-dl-bar';
        var titleEl = document.createElement('div');
        titleEl.className = 't';
        titleEl.textContent = title;
        var actions = document.createElement('div');
        actions.className = 'actions';
        var printBtn = document.createElement('button');
        printBtn.className = 'sh-dl-print';
        printBtn.textContent = 'Print / Save as PDF';
        printBtn.disabled = true;
        printBtn.style.opacity = '0.5';
        printBtn.addEventListener('click', function() { window.print(); });
        var closeBtn = document.createElement('button');
        closeBtn.className = 'sh-dl-close';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', function() { overlay.remove(); });
        actions.appendChild(printBtn);
        actions.appendChild(closeBtn);
        bar.appendChild(titleEl);
        bar.appendChild(actions);

        var loading = document.createElement('div');
        loading.className = 'sh-dl-loading';
        var msg = document.createElement('div');
        msg.textContent = 'Loading all pages…';
        var barWrap = document.createElement('div');
        barWrap.className = 'bar';
        var fill = document.createElement('div');
        fill.className = 'fill';
        barWrap.appendChild(fill);
        var sub = document.createElement('div');
        sub.style.cssText = 'font-size:13px;opacity:.7;';
        loading.appendChild(msg);
        loading.appendChild(barWrap);
        loading.appendChild(sub);

        var pages = document.createElement('div');
        pages.className = 'sh-dl-pages';

        overlay.appendChild(bar);
        overlay.appendChild(loading);
        overlay.appendChild(pages);

        return { overlay: overlay, fill: fill, sub: sub, loading: loading, pages: pages, printBtn: printBtn };
    }

    function generatePDF() {
        var title = getTitle();
        if (!document.querySelector('.p2hv') || document.querySelectorAll('.pf').length === 0) {
            alert('StudocuHack: Could not find the document pages. Try scrolling the document, then click Download again.');
            return;
        }

        injectOverlayStyles();
        var ui = createOverlay(title);
        document.body.appendChild(ui.overlay);

        var pattern = getImagePattern();

        // The capture must run while THIS tab is focused (a backgrounded tab
        // throttles timers and pauses lazy-loading), so we render the result in
        // the same tab rather than opening a new one.
        captureAllPages(function(done, total) {
            ui.fill.style.width = Math.round(done / total * 70) + '%';
            ui.sub.textContent = 'Capturing pages ' + done + ' / ' + total;
        }).then(function(capturedPages) {
            if (!capturedPages.length) { throw new Error('no pages'); }
            var container = assembleContainer(capturedPages, pattern);
            return embedImages(container, function(done, total) {
                ui.fill.style.width = (70 + Math.round((total ? done / total : 1) * 30)) + '%';
                ui.sub.textContent = 'Embedding images ' + done + ' / ' + total;
            }).then(function() { return container; });
        }).then(function(container) {
            ui.loading.remove();
            ui.pages.appendChild(container);
            ui.printBtn.disabled = false;
            ui.printBtn.style.opacity = '1';
        }).catch(function() {
            ui.sub.textContent = 'Could not build the document. Please refresh and try again.';
        });
    }

    // ---- Download button injection + click handling ----

    function createButton() {
        var btn = document.createElement('button');
        btn.classList.add('download-button-1');
        btn.setAttribute('data-studocuhack', 'download');
        var icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '⤓'; // downwards arrow to bar
        icon.style.cssText = 'font-size:16px;line-height:1;';
        var label = document.createElement('span');
        label.classList.add('download-text');
        label.textContent = 'Download';
        btn.appendChild(icon);
        btn.appendChild(label);
        return btn;
    }

    function refreshButtons() {
        document.querySelectorAll('[data-test-selector="document-viewer-download-button-topbar"]').forEach(function(el) {
            if (!el.querySelector('.download-button-1')) el.remove();
        });
        var c = document.querySelector('#viewer-wrapper');
        if (c && !c.querySelector('.download-button-1')) c.prepend(createButton());
        var d = document.querySelector('#modal-overlay');
        if (d) d.style.display = 'none';
    }

    // Capture-phase delegation - fires before React handlers.
    document.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-studocuhack="download"]');
        if (btn) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); generatePDF(); }
    }, true);
    document.addEventListener('mousedown', function(e) {
        if (e.target.closest('[data-studocuhack="download"]')) e.stopPropagation();
    }, true);

    var obs = new MutationObserver(refreshButtons);
    function init() {
        var el = document.querySelector('#viewer-wrapper');
        if (el) obs.observe(el, { childList: true, subtree: true });
        refreshButtons();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.addEventListener('load', init);
})();
