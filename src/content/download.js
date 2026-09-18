// StudocuHack - document download.
//
// The viewer lazy-loads page text and unmounts pages that scroll out of view,
// so a faithful copy is built incrementally:
//   1. Scroll to each page, wait until it has rendered, clone it at once.
//   2. Assemble the clones in a fresh `.p2hv` container (the pdf2htmlEX
//      stylesheet already on the page scopes its rules under that class).
//   3. Point each page's background at its full-resolution figure layer, and
//      keep Studocu's blurred preview (plus a label) on premium-locked pages.
//   4. Embed every image as a data URI.
// The result is shown in a same-tab overlay (a backgrounded tab throttles
// timers and pauses lazy-loading) and printed to PDF with the browser.

(function () {
    'use strict';

    const SH = globalThis.StudocuHack;
    const download = {};
    SH.download = download;

    function getTitle() {
        const h1 = document.querySelector('h1');
        return h1 ? h1.textContent.trim() : (document.title || 'document');
    }

    // Where each page's assets come from. Prefers the access model from
    // #__NEXT_DATA__; falls back to deriving the bg pattern from a
    // full-resolution image already in the DOM (no gating info in that case).
    function resolvePageAssets() {
        const a = SH.getDocumentAccessData();
        if (a && a.bgParams) {
            return {
                bgUrl: function (n) { return SH.bgImageUrl(a, n); },
                blurUrl: function (n) { return SH.blurredPageUrl(a, n); },
                isGated: function (n) { return SH.isTextGated(a, n); },
            };
        }
        const imgs = document.querySelectorAll('.pf img');
        for (let i = 0; i < imgs.length; i++) {
            const s = imgs[i].src || '';
            if (s.indexOf('/bg') !== -1 && s.indexOf('doc-assets') !== -1 && imgs[i].naturalWidth > 600) {
                const m = s.match(/(.*?\/bg)[0-9a-f]+(\.png\?.*)/i);
                if (m) {
                    return {
                        bgUrl: function (n) { return m[1] + n.toString(16) + m[2]; },
                        blurUrl: function () { return ''; },
                        isGated: function () { return false; },
                    };
                }
            }
        }
        return null;
    }

    // A page is "rendered" once it leaves the empty lazy placeholder state.
    function pageRendered(pf) {
        return pf.innerHTML.length > 500 && (SH.hasTextSpans(pf) || SH.imgLoaded(pf.querySelector('img')));
    }

    // Wait until a page has rendered and its content size has stabilised.
    function waitForPageReady(pf) {
        return new Promise(function (resolve) {
            let lastLen = -1, stable = 0, tries = 0;
            (function check() {
                const len = pf.innerHTML.length;
                if (pageRendered(pf)) {
                    if (len === lastLen) { stable++; } else { stable = 0; lastLen = len; }
                    if (stable >= 2) { resolve(); return; }
                }
                if (tries++ > 30) { resolve(); return; } // ~4.5s cap per page
                setTimeout(check, 150);
            })();
        });
    }

    // Scroll to each page, wait for it, clone it. Resolves with the clones in
    // page order and restores the scroll position.
    function captureAllPages(onProgress) {
        const pfs = SH.viewerPages();
        const scroller = SH.getScroller();
        const savedTop = scroller ? scroller.scrollTop : 0;
        const captured = [];
        return new Promise(function (resolve) {
            let i = 0;
            (function next() {
                if (i >= pfs.length) {
                    if (scroller) scroller.scrollTop = savedTop;
                    resolve(captured);
                    return;
                }
                const pf = pfs[i];
                try { pf.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) { /* detached */ }
                waitForPageReady(pf).then(function () {
                    captured.push(pf.cloneNode(true));
                    i++;
                    if (onProgress) onProgress(i, pfs.length);
                    next();
                });
            })();
        });
    }

    function fetchDataUri(url) {
        return fetch(url, { credentials: 'omit' })
            .then(function (r) { return r.ok ? r.blob() : null; })
            .then(function (blob) {
                if (!blob || blob.size === 0) return null;
                return new Promise(function (resolve) {
                    const fr = new FileReader();
                    fr.onload = function () { resolve(fr.result); };
                    fr.onerror = function () { resolve(null); };
                    fr.readAsDataURL(blob);
                });
            })
            .catch(function () { return null; });
    }

    // Replace every doc-assets image src inside `root` with a data URI.
    function embedImages(root, onProgress) {
        const targets = Array.prototype.filter.call(root.querySelectorAll('img'), function (img) {
            const s = img.getAttribute('src') || '';
            return s.indexOf('doc-assets') !== -1 || s.indexOf('/bg') !== -1;
        });
        const urls = Array.from(new Set(targets.map(function (img) { return img.getAttribute('src'); })));
        const map = {};
        let next = 0, done = 0;
        const CONCURRENCY = 6;

        return new Promise(function (resolve) {
            if (urls.length === 0) { resolve(); return; }
            function worker() {
                if (next >= urls.length) return Promise.resolve();
                const url = urls[next++];
                return fetchDataUri(url).then(function (dataUri) {
                    if (dataUri) map[url] = dataUri;
                    done++;
                    if (onProgress) onProgress(done, urls.length);
                    return worker();
                });
            }
            const starters = [];
            for (let c = 0; c < Math.min(CONCURRENCY, urls.length); c++) starters.push(worker());
            Promise.all(starters).then(function () {
                targets.forEach(function (img) {
                    const s = img.getAttribute('src');
                    if (map[s]) {
                        img.setAttribute('src', map[s]);
                        img.removeAttribute('srcset');
                    }
                });
                resolve();
            });
        });
    }

    // Assemble the clones into a fresh `.p2hv` container. Only that class is
    // kept: the live viewer's other classes carry virtual-scroller layout that
    // breaks pages cloned out of it.
    download.assembleContainer = function (capturedPages, assets) {
        const container = document.createElement('div');
        container.className = 'p2hv';

        capturedPages.forEach(function (pf, idx) {
            const pageNum = idx + 1;
            pf.removeAttribute('style');
            pf.querySelectorAll('.download-button-1, [data-studocuhack]').forEach(function (e) { e.remove(); });
            pf.querySelectorAll('[style]').forEach(function (e) {
                const st = e.getAttribute('style') || '';
                if (/display:\s*none/i.test(st)) {
                    e.setAttribute('style', st.replace(/display:\s*none/ig, 'display:block'));
                }
            });

            if (assets) {
                let img = pf.querySelector('img.bi') || pf.querySelector('img');
                const cur = img ? (img.getAttribute('src') || '') : '';
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'bi x0 y0 w1 h1';
                    (pf.querySelector('.pc') || pf).appendChild(img);
                }
                if (assets.isGated(pageNum)) {
                    // Premium-locked: print Studocu's blurred preview, the only
                    // rendering of this page that exists, and label it.
                    const blur = assets.blurUrl(pageNum);
                    if (cur.indexOf('/pages/blurred/') === -1 && blur) img.setAttribute('src', blur);
                    if (!pf.querySelector('[data-sh-gated-note]')) pf.appendChild(SH.createGatedNote(pageNum));
                } else {
                    const clear = SH.deblurUrl(cur);
                    img.setAttribute('src', clear || assets.bgUrl(pageNum));
                }
                img.removeAttribute('srcset');
                img.removeAttribute('data-src');
            }

            // The viewer hides `.page-content` while scrolled out of view.
            pf.querySelectorAll('.page-content').forEach(function (pc) {
                pc.style.setProperty('display', 'block', 'important');
                pc.style.setProperty('filter', 'none', 'important');
                pc.style.setProperty('visibility', 'visible', 'important');
                pc.style.setProperty('opacity', '1', 'important');
            });
            container.appendChild(pf);
        });
        return container;
    };

    // ------------------------------------------------------------------
    // Overlay UI
    // ------------------------------------------------------------------

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function createOverlay(title, pageCount) {
        const overlay = el('div');
        overlay.id = 'sh-dl-overlay';

        const bar = el('div', 'sh-dl-bar');
        const titleEl = el('div', 'sh-dl-title', title);
        const meta = el('div', 'sh-dl-meta', pageCount + (pageCount === 1 ? ' page' : ' pages'));
        const actions = el('div', 'sh-dl-actions');
        const hint = el('span', 'sh-dl-hint', 'Choose "Save as PDF" in the print dialog');
        const printBtn = el('button', 'sh-dl-print', 'Print / Save as PDF');
        printBtn.disabled = true;
        printBtn.addEventListener('click', function () { window.print(); });
        const closeBtn = el('button', 'sh-dl-close', 'Close');
        closeBtn.title = 'Close (Esc)';
        actions.appendChild(hint);
        actions.appendChild(printBtn);
        actions.appendChild(closeBtn);
        const left = el('div', 'sh-dl-left');
        left.appendChild(titleEl);
        left.appendChild(meta);
        bar.appendChild(left);
        bar.appendChild(actions);

        const loading = el('div', 'sh-dl-loading');
        const msg = el('div', 'sh-dl-msg', 'Loading all pages');
        const barWrap = el('div', 'sh-dl-progress');
        const fill = el('div', 'sh-dl-fill');
        barWrap.appendChild(fill);
        const sub = el('div', 'sh-dl-sub');
        loading.appendChild(msg);
        loading.appendChild(barWrap);
        loading.appendChild(sub);

        const pagesEl = el('div', 'sh-dl-pages');

        overlay.appendChild(bar);
        overlay.appendChild(loading);
        overlay.appendChild(pagesEl);

        function close() {
            overlay.remove();
            document.body.classList.remove('sh-dl-open');
            document.documentElement.classList.remove('sh-dl-open');
            document.removeEventListener('keydown', onKey, true);
        }
        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); close(); }
        }
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', onKey, true);

        return { overlay: overlay, fill: fill, sub: sub, loading: loading, pages: pagesEl, printBtn: printBtn, close: close };
    }

    download.generatePDF = function () {
        if (document.getElementById('sh-dl-overlay')) return;
        const pfs = SH.viewerPages();
        if (!document.querySelector('.p2hv') || pfs.length === 0) {
            SH.notify('StudocuHack: could not find the document pages. Scroll the document a little, then click Download again.');
            return;
        }

        const ui = createOverlay(getTitle(), pfs.length);
        document.body.appendChild(ui.overlay);
        // The print rules in style.css only isolate the overlay while this
        // class is present.
        document.body.classList.add('sh-dl-open');
        document.documentElement.classList.add('sh-dl-open');
        const assets = resolvePageAssets();

        captureAllPages(function (done, total) {
            ui.fill.style.width = Math.round(done / total * 70) + '%';
            ui.sub.textContent = 'Capturing pages ' + done + ' / ' + total;
        }).then(function (capturedPages) {
            if (!capturedPages.length) throw new Error('no pages');
            const container = download.assembleContainer(capturedPages, assets);
            return embedImages(container, function (done, total) {
                ui.fill.style.width = (70 + Math.round((total ? done / total : 1) * 30)) + '%';
                ui.sub.textContent = 'Embedding images ' + done + ' / ' + total;
            }).then(function () { return container; });
        }).then(function (container) {
            ui.loading.remove();
            ui.pages.appendChild(container);
            ui.printBtn.disabled = false;
            ui.printBtn.focus();
        }).catch(function () {
            ui.sub.textContent = 'Could not build the document. Refresh the page and try again.';
        });
    };

    // ------------------------------------------------------------------
    // Download button
    // ------------------------------------------------------------------

    function createButton() {
        const btn = el('button', 'download-button-1');
        btn.type = 'button';
        btn.setAttribute('data-studocuhack', 'download');
        btn.title = 'Download the full document as PDF (StudocuHack)';
        const icon = el('span', 'download-icon', '⤓'); // downwards arrow to bar
        icon.setAttribute('aria-hidden', 'true');
        const label = el('span', 'download-text', 'Download');
        btn.appendChild(icon);
        btn.appendChild(label);
        return btn;
    }

    download.refreshButton = function () {
        if (!SH.settings.showDownloadButton) return;
        const c = document.querySelector('#viewer-wrapper');
        if (c && !c.querySelector('.download-button-1')) c.prepend(createButton());
        const d = document.querySelector('#modal-overlay');
        if (d) d.style.display = 'none';
    };

    download.init = function () {
        if (!SH.settings.showDownloadButton) return;

        // Capture-phase delegation fires before React's own handlers.
        document.addEventListener('click', function (e) {
            const btn = e.target.closest && e.target.closest('[data-studocuhack="download"]');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                download.generatePDF();
            }
        }, true);
        document.addEventListener('mousedown', function (e) {
            if (e.target.closest && e.target.closest('[data-studocuhack="download"]')) e.stopPropagation();
        }, true);

        const obs = new MutationObserver(download.refreshButton);
        function attach() {
            const wrapper = document.querySelector('#viewer-wrapper');
            if (wrapper) obs.observe(wrapper, { childList: true, subtree: true });
            download.refreshButton();
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
        else attach();
        window.addEventListener('load', attach);
    };
})();
