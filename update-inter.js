(function() {
    'use strict';

    // ========== Banner & Premium Element Selectors ==========
    const BANNER_SELECTORS = [
        '.banner-wrapper',
        '[class*="InlineBanner_inline-banner"]',
        '[class*="PremiumBannerBlobWrapper"]',
        '[class*="PremiumPageClarificationBanner"]',
        '[class*="PremiumBannerHeader"]',
        '[class*="PremiumBannerBenefitsList"]',
        '[class*="PremiumBannerButtons"]',
        '[data-test-selector="modal-document-viewer-preview-message"]',
        '[data-test-selector="preview-banner-upgrade-first-cta"]',
        '[data-test-selector="preview-banner-upload-second-cta"]',
        '._95f5f1767857',
        '._3273140306b6',
        '._8690b6fc16a3',
        '._4d5ecd011027',
        '[class*="premium-banner-wrapper"]',
        '[class*="ViewerContainer_premium"]',
    ];

    // ========== Premium Badge Selectors ==========
    const PREMIUM_BADGE_SELECTORS = [
        '[class*="PremiumBadge"]',
        '[class*="premium-badge"]',
        '[class*="premiumBadge"]',
        '[class*="PremiumLabel"]',
        '[class*="premiumLabel"]',
        '[class*="premium-label"]',
        '[class*="PremiumTag"]',
        '[class*="premiumTag"]',
        '[class*="premium-tag"]',
        '[class*="premium_tag"]',
        '[class*="premium_badge"]',
        '[class*="PremiumIcon"]',
        '[class*="premiumIcon"]',
        '[class*="premium-icon"]',
        '[data-test-selector*="premium-badge"]',
        '[data-test-selector*="premium-tag"]',
        '[data-test-selector*="premium-label"]',
    ];

    // ========== Ad & AI-Toolbar Selectors ==========
    // Ads on Studeersnel/Studocu are served via Refinery89 (r89) wrappers,
    // Google Publisher Tag (GPT) iframes, and Adagio. The "Ask a question
    // about this document" box + Mock exam/Summary/Quiz pills are the AIToolbar.
    const AD_SELECTORS = [
        '[class*="AdsContainer"]',
        'r89-standalone',
        '[id^="r89-"]',
        '[id*="r89-"]',
        'iframe[id^="google_ads_iframe"]',
        'div[id^="google_ads_iframe"]',
        '[id^="div-gpt-ad"]',
        '[id*="gpt-ad"]',
        '[id*="adagio"]',
        '[class*="adagio"]',
        '[class*="Advertisement"]',
        '[class*="advertisement"]',
    ];

    const AI_TOOLBAR_SELECTORS = [
        '[class*="AIToolbar"]',
    ];

    function removeAdsAndAI() {
        AD_SELECTORS.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                });
            } catch(e) {}
        });
        AI_TOOLBAR_SELECTORS.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                });
            } catch(e) {}
        });
    }

    // ========== Document Access Data (cached) ==========
    let _docAccessData = null;

    const DOC_ASSETS = 'https://doc-assets.studocu.com/';

    // Studocu signs asset URLs with a query string held in
    // documentAccess.signedQueryParams. The KEY it lives under varies per
    // document, and the value is not always a plain string:
    //   - scanned/image docs:    { global }                         (one wildcard string)
    //   - native pdf2htmlEX docs: { html, css, png, blurredPage, pages }
    // `png`/`global` are wildcard strings authorizing /html/bg{hex}.png. `pages`
    // is an ARRAY of { pageNumber, signedQueryParams } (one signed param per
    // text-bearing page), so it must never be concatenated into a URL as-is - that
    // is what produced the "bg8.png[object Object]" 403s. pickParam therefore only
    // ever returns a string.
    //
    // HOW A PAGE IS BUILT (this is the crux of issue #58). Studocu renders native
    // PDFs with pdf2htmlEX in split-page mode, so every page is TWO layers:
    //   - /html/bg{hex}.png            the FIGURE layer: rules, table borders,
    //                                  bullet glyphs, coloured boxes. No text.
    //   - /html/{objectKey}{hex}.page  the TEXT layer: positioned <span>s.
    // The `png` param is a wildcard over *.png, so the figure layer of EVERY page
    // is fetchable. The text layer is signed per page, and `pages` only ever
    // contains entries for the non-premium pages.
    //
    // Verified live against a 19-page premium doc (2026-08). For a gated page:
    //   /html/{objectKey}{hex}.page   403 with every param the client holds
    //                                 (its own key is simply absent from `pages`)
    //   /html/pages/page{n}.webp      403 (clear raster)
    //   /html/pages/page{n}.png       404
    //   /html/{objectKey}.html        200 but an empty 1 KB skeleton of <div class="pf">
    //   previewTextData.text          covers only the non-premium pages
    //   /html/pages/blurred/page{n}.webp  200, but a 140x198 thumbnail
    //   /html/bg{hex}.png             200, ~9 KB of figure art and zero text
    // So a gated page's text is not served to the client in any form. Falling back
    // to bg{hex}.png therefore does NOT "recover" the page: it replaces Studocu's
    // blurred preview with a crisp but completely empty one, which is exactly the
    // "rebuilt without text" report. isTextGated() below detects those pages so we
    // present them honestly instead of blanking them.
    function pickParam(sp, keys) {
        if (!sp) return '';
        for (const k of keys) { if (typeof sp[k] === 'string' && sp[k]) return sp[k]; }
        return '';
    }

    function getDocumentAccessData() {
        if (_docAccessData) return _docAccessData;
        try {
            const nextDataEl = document.querySelector('#__NEXT_DATA__');
            if (!nextDataEl) return null;
            const data = JSON.parse(nextDataEl.textContent);
            const da = data.props?.pageProps?.documentAccess;
            if (da && da.objectKey && da.signedQueryParams) {
                const doc = data.props?.pageProps?.document;
                const sp = da.signedQueryParams;

                // Map each text-bearing page number to its own signed param.
                const pageParams = {};
                if (Array.isArray(sp.pages)) {
                    sp.pages.forEach(p => {
                        if (p && p.pageNumber && typeof p.signedQueryParams === 'string') {
                            pageParams[p.pageNumber] = p.signedQueryParams;
                        }
                    });
                }

                _docAccessData = {
                    objectKey: da.objectKey,
                    bgParams: pickParam(sp, ['png', 'global']),
                    pageParams: pageParams,
                    blurredParams: pickParam(sp, ['blurredPage', 'global']),
                    hasBlurredPages: da.hasBlurredPages || false,
                    pageCount: doc ? (doc.numberOfPages || doc.pageCount || 0) : 0,
                    // True when this document keeps its text in separate .page
                    // fragments, i.e. it is native pdf2htmlEX output and bg{hex}.png
                    // is only a figure layer. Keyed off the PRESENCE of the `pages`
                    // key, not its length: a document with every page gated ships
                    // `pages: []`, and treating that as a scanned document would
                    // blank the whole thing. Scanned/image documents sign with a
                    // single `global` wildcard and have no `pages` key at all, and
                    // there the background image IS the page content.
                    hasTextLayer: Array.isArray(sp.pages),
                };
                return _docAccessData;
            }
        } catch(e) {}
        return null;
    }

    // pdf2htmlEX figure-layer background. HEX page number, png/global param.
    function bgImageUrl(a, pageNum) {
        if (!a.bgParams) return '';
        return DOC_ASSETS + a.objectKey + '/html/bg' + pageNum.toString(16) + '.png' + a.bgParams;
    }

    // pdf2htmlEX per-page text fragment: /html/{objectKey}{hex}.page, signed per
    // page. Returns '' when this page has no signed text entry (e.g. image docs, or
    // an image-only page). HEX page number.
    function pageTextUrl(a, pageNum) {
        const param = a.pageParams[pageNum];
        if (!param) return '';
        return DOC_ASSETS + a.objectKey + '/html/' + a.objectKey + pageNum.toString(16) + '.page' + param;
    }

    // Studocu's own blurred preview raster. NOTE the numbering: backgrounds are
    // HEX (bg12.png is page 18) but these are DECIMAL (page18.webp).
    function blurredPageUrl(a, pageNum) {
        if (!a.blurredParams) return '';
        return DOC_ASSETS + a.objectKey + '/html/pages/blurred/page' + pageNum + '.webp' + a.blurredParams;
    }

    // A page is "text-gated" when the document has text layers but this page has no
    // signed entry for its own. Studocu serves no text for such a page in any form
    // (see the asset table above), so the figure-only bg{hex}.png must never be
    // presented as if it were the recovered page.
    //
    // Deliberately NOT keyed off hasBlurredPages: patchNextData() rewrites that
    // flag to false in #__NEXT_DATA__ to stop React re-blurring, which would leave
    // this predicate depending on whichever of the two ran first. `pages` is never
    // rewritten, so it is the stable signal.
    function isTextGated(a, pageNum) {
        return !!(a.hasTextLayer && !a.pageParams[pageNum]);
    }

    // Render a gated page honestly: keep Studocu's blurred preview as the page
    // image (it is the only rendering of the actual text that exists client-side)
    // and label the page, so a reader is never shown a blank sheet and left
    // guessing whether the extension failed. Idempotent.
    function markGatedPage(a, pf, pageNum) {
        if (pf.querySelector('[data-sh-gated-note]')) return;
        const blurUrl = blurredPageUrl(a, pageNum);
        let img = pf.querySelector('img');
        // The virtual scroller unmounts far-off pages, so a gated page may have no
        // image at all. Give it Studocu's preview rather than leaving a blank sheet.
        if (!img && blurUrl) {
            img = document.createElement('img');
            img.className = 'bi x0 y0 w1 h1';
            img.alt = '';
            img.dataset.shInjectedImg = '1';
            img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
            pf.appendChild(img);
        }
        // Restore the blurred raster if an earlier pass swapped it for a gated
        // (403) or textless URL.
        if (img && blurUrl) {
            const cur = img.getAttribute('src') || '';
            if (cur.indexOf('/pages/blurred/') === -1) {
                img.removeAttribute('srcset');
                img.setAttribute('src', blurUrl);
            }
            img.loading = 'eager';
            img.style.filter = 'none';
            img.style.opacity = '1';
            img.style.visibility = 'visible';
        }
        const note = document.createElement('div');
        note.setAttribute('data-sh-gated-note', String(pageNum));
        note.className = 'sh-gated-note';
        note.textContent = 'Page ' + pageNum + ' is premium-locked. Studocu does not send ' +
            'the text of this page to non-subscribers, so it cannot be unblurred.';
        pf.appendChild(note);
    }

    // Report once, so a reader knows exactly which pages could not be recovered
    // and why, instead of assuming the extension silently broke them.
    let _gatedReported = false;
    function reportGatedPages(gated, total) {
        if (_gatedReported || !gated.length) return;
        _gatedReported = true;
        console.log('StudocuHack: ' + (total - gated.length) + ' of ' + total +
            ' pages fully recovered. Pages ' + gated.join(', ') + ' are premium-locked: ' +
            'Studocu never sends their text layer to a non-subscriber, so no extension ' +
            'can un-blur them. See https://github.com/danieltyukov/studocuhack/issues/58');
    }

    // ========== Lazy Load & Image Fix ==========
    // Studocu's React viewer lazy-loads page backgrounds and UNMOUNTS pages that
    // scroll far out of view. So a premium page usually sits in the DOM either as
    // an empty `.pf` (no <img> at all) or as an <img loading="lazy"> that never
    // fetched because it is offscreen. Both render as the "blank page" users
    // report (issues #56/#57). We repair every page by pointing it at the
    // reconstructed full-resolution hex URL and forcing an eager fetch. Pages the
    // server refuses (403) are left untouched and retried later.

    // Convert a blurred asset URL to its clear sibling, keeping the same signed
    // param (already authorized for /html/pages/*). Returns null if not blurred.
    function deblurUrl(url) {
        if (!url || url.indexOf('/blurred/') === -1) return null;
        return url.replace('/pages/blurred/', '/pages/').replace('/blurred/', '/');
    }

    // Point an <img> at the first candidate URL that successfully loads.
    function setSrcFromCandidates(img, candidates) {
        let i = 0;
        (function tryNext() {
            if (i >= candidates.length) return;
            const url = candidates[i++];
            if (!url) return tryNext();
            img.onerror = tryNext;
            img.onload = function() { img.onerror = null; };
            img.src = url;
        })();
    }

    // Make an existing background <img> show clear, full content now.
    function forceEagerImg(img, candidates) {
        img.loading = 'eager';
        img.style.filter = 'none';
        img.style.opacity = '1';
        img.style.visibility = 'visible';
        // Case 1: a baked-in-blur raster -> swap to its clear sibling first,
        // then fall back to reconstructed candidates. A blurred image loads fine
        // (naturalWidth > 0), so this must run regardless of load state. The
        // original blurred URL is kept as the LAST candidate: when the clear
        // sibling is access-gated (403) we must land back on Studocu's preview
        // rather than on a broken or textless image.
        const cur = img.getAttribute('src') || '';
        const clear = deblurUrl(cur);
        if (clear && !img.dataset.shUnblurred) {
            img.dataset.shUnblurred = '1';
            img.removeAttribute('srcset');
            setSrcFromCandidates(img, [clear].concat(candidates).concat([cur]));
            return;
        }
        // Case 2: already showing a real image -> nothing to do.
        if (img.complete && img.naturalWidth > 0) return;
        // Case 3: a lazy/placeholder image that hasn't fetched (naturalWidth 0).
        // Force a fresh, high-priority load - clearing src first guarantees a
        // refetch even when the URL is unchanged. Prefer the img's own page asset,
        // else our reconstructed canonical URL. Bounded so the periodic re-runs
        // can't thrash a genuinely gated page (which 403s every time).
        const attempts = +(img.dataset.shForced || 0);
        if (attempts >= 3) return;
        img.dataset.shForced = attempts + 1;
        const target = (cur && cur.indexOf('/html/bg') !== -1) ? cur : (candidates[0] || cur);
        if (target) {
            img.removeAttribute('srcset');
            img.removeAttribute('data-src');
            img.src = '';
            img.src = target;
        }
    }

    // Inject a background into a `.pf` the virtual scroller has not mounted. We
    // test-load candidates via a detached Image so access-gated pages never
    // leave a broken <img> behind; we give up after a few misses.
    function injectPageImage(pf, candidates) {
        if (pf.querySelector('img')) return;               // already has an image
        if (pf.dataset.shInjecting) return;                // fetch already in flight
        if ((+(pf.dataset.shFail || 0)) >= 3) return;      // repeatedly gated - stop
        pf.dataset.shInjecting = '1';
        let i = 0;
        (function tryNext() {
            if (i >= candidates.length) {
                pf.dataset.shInjecting = '';
                pf.dataset.shFail = (+(pf.dataset.shFail || 0)) + 1;
                return;
            }
            const url = candidates[i++];
            const img = new Image();
            img.loading = 'eager';
            img.onload = function() {
                pf.dataset.shInjecting = '';
                if (!pf.querySelector('img')) {
                    img.className = 'bi x0 y0 w1 h1';
                    img.alt = '';
                    img.dataset.shInjectedImg = '1';
                    img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;' +
                        'opacity:1;filter:none;visibility:visible;';
                    pf.style.filter = 'none';
                    pf.style.opacity = '1';
                    pf.appendChild(img);
                }
            };
            img.onerror = tryNext;
            img.src = url;
        })();
    }

    // A pdf2htmlEX .page fragment is positioned text with inline styles only. Strip
    // active content (scripts, frames, event handlers, javascript: URLs) before we
    // insert it, so a tampered CDN response can't run code in the studocu.com origin.
    function sanitizePageHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script, iframe, object, embed, link').forEach(el => el.remove());
        doc.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                if (name.startsWith('on')) el.removeAttribute(attr.name);
                else if ((name === 'src' || name === 'href') && /^\s*javascript:/i.test(attr.value)) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return doc.body.innerHTML;
    }

    // Recover the real text layer for a blank page by fetching its .page fragment
    // and rendering it in place (the pdf2htmlEX stylesheet is already on the page,
    // so fonts/positioning apply automatically). Only accessible pages return 200;
    // gated premium pages 403 and are left for the background-image fallback.
    function injectPageText(a, pf, pageNum) {
        const url = pageTextUrl(a, pageNum);
        if (!url) return;
        if (pf.dataset.shTextTried) return;
        pf.dataset.shTextTried = '1';
        fetch(url, { credentials: 'omit' })
            .then(r => (r.ok ? r.text() : null))
            .then(html => {
                if (html && html.indexOf('<span') !== -1 && pf.querySelectorAll('span').length <= 3) {
                    pf.innerHTML = sanitizePageHtml(html);
                    pf.style.filter = 'none';
                    pf.style.opacity = '1';
                    pf.classList.add('nofilter');
                }
            })
            .catch(() => {});
    }

    // The pages of the live viewer, excluding the clones our own download overlay
    // renders (it reuses the `.p2hv` class so the pdf2htmlEX CSS applies). Without
    // this the page numbering would shift while the overlay is open.
    function viewerPages() {
        const all = document.querySelectorAll('.pf');
        return Array.prototype.filter.call(all, function(pf) {
            return !pf.closest('#sh-dl-overlay');
        });
    }

    // Repair every page on the live site. Mounted pages get their background
    // force-loaded/unblurred; pages the virtual scroller left blank get their real
    // text layer fetched (when the server serves it) plus the reconstructed
    // background image (full content on scanned docs, harmless blank on text docs).
    // Premium-locked pages are exempt: nothing we can fetch contains their text, so
    // they are labelled rather than overwritten with an empty figure layer.
    function ensureAllPagesLoaded() {
        const a = getDocumentAccessData();
        if (!a) return;
        const pages = viewerPages();
        const gated = [];
        pages.forEach(function(pf, idx) {
            const pageNum = idx + 1;
            const bgUrl = bgImageUrl(a, pageNum);
            const candidates = bgUrl ? [bgUrl] : [];

            // Reconcile duplicates: if the viewer has since mounted its own loaded
            // image beside the fallback we injected earlier, drop ours. This runs
            // before the gated branch below, which injects a fallback of its own.
            const imgs = pf.querySelectorAll('img');
            if (imgs.length > 1) {
                const ours = pf.querySelector('img[data-sh-injected-img]');
                const real = Array.prototype.find.call(imgs, function(im) {
                    return !im.dataset.shInjectedImg && im.complete && im.naturalWidth > 0;
                });
                if (ours && real) ours.remove();
            }

            // Premium-locked page: its text layer does not exist client-side, so
            // swapping in the figure-only background would blank the page (#58).
            // Keep Studocu's blurred preview and label it instead.
            if (isTextGated(a, pageNum)) {
                gated.push(pageNum);
                markGatedPage(a, pf, pageNum);
                return;
            }
            const img = pf.querySelector('img');
            if (img) { forceEagerImg(img, candidates); return; }
            // No image mounted. If the page already shows real text, leave it.
            if (pf.querySelectorAll('span').length > 3) return;
            injectPageText(a, pf, pageNum);
            if (candidates.length) injectPageImage(pf, candidates);
        });
        reportGatedPages(gated, pages.length);
    }

    // One-time pass that scrolls the whole document so the viewer lazily fetches
    // and renders EVERY page. The viewer only requests a page's assets once it is
    // scrolled into view, so this is what turns a document full of unmounted
    // placeholders into a fully readable one without any manual scrolling.
    // Premium-locked pages stay blurred: scrolling to them makes the viewer fetch
    // their preview raster, which is all the server will ever hand out.
    let _primed = false;
    function primeAllPages() {
        if (_primed) return;
        const pfs = viewerPages();
        if (pfs.length === 0) return;
        // Only prime when there is something to reveal: a premium doc, or pages
        // that are still blank placeholders (no text and no loaded image).
        const a = getDocumentAccessData();
        const hasBlank = Array.prototype.some.call(pfs, function(pf) {
            const img = pf.querySelector('img');
            return pf.querySelectorAll('span').length <= 3 && !(img && img.complete && img.naturalWidth > 0);
        });
        if (!(a && a.hasBlurredPages) && !hasBlank) return;
        _primed = true;

        const scroller = document.getElementById('viewer-wrapper') ||
                         document.getElementById('document-wrapper') ||
                         document.scrollingElement || document.documentElement;
        const savedTop = scroller ? scroller.scrollTop : 0;
        // Cap the auto-scroll so we never hijack the viewport for too long on very
        // large documents; the rest load as the reader scrolls, and the Download
        // button captures every page regardless.
        const limit = Math.min(pfs.length, 50);
        if (pfs.length > limit) {
            console.log('StudocuHack: priming first ' + limit + ' of ' + pfs.length +
                ' pages; the rest load on scroll (Download still captures all).');
        }
        let i = 0;
        (function step() {
            if (i >= limit) {
                if (scroller) scroller.scrollTop = savedTop;
                // Final sweep once everything has had a chance to render.
                setTimeout(function() { removeBlur(); ensureAllPagesLoaded(); }, 400);
                return;
            }
            try { pfs[i].scrollIntoView({ block: 'center' }); } catch (e) {}
            i++;
            setTimeout(step, 140);
        })();
    }

    // ========== Core Functions ==========

    function removeBanners() {
        BANNER_SELECTORS.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => el.remove());
            } catch(e) {}
        });

        // Hide modal overlay
        const modal = document.querySelector('#modal-overlay');
        if (modal) modal.style.display = 'none';
    }

    function unblurImages() {
        // Swap every baked-in-blur raster for its clear sibling, reusing the
        // signed param already on the blurred URL. On some documents that param
        // authorizes /html/pages/* and the swap simply works; on premium documents
        // it only covers /html/pages/blurred/*, so the clear sibling 403s. We
        // therefore probe the swap through setSrcFromCandidates with the ORIGINAL
        // blurred URL as the final fallback, instead of assigning the clear URL
        // outright and leaving a broken image behind (#58).
        document.querySelectorAll('.pf img').forEach(img => {
            if (img.dataset.shUnblurred) return;
            const curSrc = img.getAttribute('src');
            const clearSrc = deblurUrl(curSrc);
            if (clearSrc) {
                img.dataset.shUnblurred = '1';
                img.removeAttribute('srcset');
                img.loading = 'eager';
                img.style.filter = 'none';
                img.style.opacity = '1';
                img.style.visibility = 'visible';
                setSrcFromCandidates(img, [clearSrc, curSrc]);
            }
            const clearData = deblurUrl(img.getAttribute('data-src'));
            if (clearData) {
                img.setAttribute('data-src', clearData);
                img.dataset.shUnblurred = '1';
            }
            // A srcset can also carry the blurred URL.
            const ss = img.getAttribute('srcset');
            if (ss && ss.indexOf('/blurred/') !== -1) {
                img.setAttribute('srcset', ss.replace(/\/pages\/blurred\//g, '/pages/').replace(/\/blurred\//g, '/'));
                img.dataset.shUnblurred = '1';
            }
        });
    }

    function removeBlur() {
        // Remove blur from page wrapper elements (.pf) which may carry the filter
        document.querySelectorAll('.pf').forEach(pf => {
            pf.style.filter = 'none';
            pf.style.webkitFilter = 'none';
            pf.style.opacity = '1';
            pf.style.userSelect = 'auto';
            pf.style.pointerEvents = 'auto';
            pf.style.clipPath = 'none';
            pf.style.webkitClipPath = 'none';
            pf.classList.add('nofilter');
            Array.from(pf.classList).forEach(cls => {
                if (cls.includes('blurred') || cls.includes('Blurred')) {
                    pf.classList.remove(cls);
                }
            });
        });

        document.querySelectorAll('.page-content').forEach(page => {
            // Remove inline filter unconditionally
            page.style.filter = 'none';
            page.style.webkitFilter = 'none';
            page.style.opacity = '1';
            page.style.userSelect = 'auto';
            page.style.pointerEvents = 'auto';
            page.style.visibility = 'visible';
            page.style.clipPath = 'none';
            page.style.webkitClipPath = 'none';
            page.style.maskImage = 'none';
            page.style.webkitMaskImage = 'none';
            page.style.color = '';

            // Add nofilter class for CSS override
            page.classList.add('nofilter');

            // Remove any blurred-related CSS module classes
            Array.from(page.classList).forEach(cls => {
                if (cls.includes('blurred') || cls.includes('Blurred')) {
                    page.classList.remove(cls);
                }
            });

            // Also remove blur from ancestor elements up to #page-container
            let ancestor = page.parentElement;
            let depth = 0;
            while (ancestor && ancestor.id !== 'page-container' && ancestor !== document.body && depth < 10) {
                const cs = getComputedStyle(ancestor);
                if (cs.filter !== 'none' || cs.opacity !== '1') {
                    ancestor.style.filter = 'none';
                    ancestor.style.webkitFilter = 'none';
                    ancestor.style.opacity = '1';
                }
                Array.from(ancestor.classList).forEach(cls => {
                    if (cls.includes('blurred') || cls.includes('Blurred')) {
                        ancestor.classList.remove(cls);
                    }
                });
                ancestor = ancestor.parentElement;
                depth++;
            }

            // Make blurred images fill the page container properly
            page.querySelectorAll('img').forEach(img => {
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.opacity = '1';
                img.style.filter = 'none';
                img.style.visibility = 'visible';
            });

            // Remove premium clarification banner siblings
            if (page.parentNode) {
                Array.from(page.parentNode.children).forEach(sibling => {
                    if (sibling !== page && sibling.className) {
                        const cn = typeof sibling.className === 'string' ? sibling.className : '';
                        if (cn.includes('PremiumPageClarification') ||
                            cn.includes('blurred') ||
                            cn.includes('Blurred') ||
                            cn.includes('premium-banner') ||
                            cn.includes('BlurredPage')) {
                            sibling.remove();
                        }
                    }
                });
            }
        });

        // Remove blurred-image-wrapper class effects (Studocu uses this for blurred pages)
        document.querySelectorAll('[class*="blurred-image-wrapper"], [class*="BlurredImage"], [class*="blurred-page"]').forEach(el => {
            el.style.filter = 'none';
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            Array.from(el.classList).forEach(cls => {
                if (cls.includes('blurred') || cls.includes('Blurred')) {
                    el.classList.remove(cls);
                }
            });
        });

        // Legacy: handle old blurred-container elements
        document.querySelectorAll('.blurred-container').forEach(container => {
            container.classList.remove('blurred-container');
        });

        // Remove premium overlay divs (but NOT page content)
        document.querySelectorAll('#modal-overlay, [class*="PremiumOverlay"], [class*="premium-overlay"]').forEach(el => {
            el.style.display = 'none';
        });

        // Swap blurred images for clear versions
        unblurImages();
    }

    function removeStudocuDownloadButtons() {
        // Remove Studocu's native download button by data-test-selector
        document.querySelectorAll('[data-test-selector="document-viewer-download-button-topbar"]').forEach(el => {
            // Don't remove our own download button
            if (!el.classList.contains('download-button-1') && !el.querySelector('.download-button-1')) {
                el.remove();
            }
        });

        // Remove buttons with class pattern Button_button that contain "Scarica" or "Download" text
        document.querySelectorAll('button[class*="Button_button"], a[class*="Button_button"]').forEach(el => {
            // Don't remove our own button
            if (el.classList.contains('download-button-1')) return;
            const text = el.textContent.trim().toLowerCase();
            if (text === 'scarica' || text === 'download') {
                el.remove();
            }
        });

        // Remove download buttons inside hidden-on-mobile / hidden-from-tablet containers
        document.querySelectorAll('div.hidden-on-mobile, div.hidden-from-tablet').forEach(container => {
            container.querySelectorAll('button, a').forEach(el => {
                if (el.classList.contains('download-button-1')) return;
                const text = el.textContent.trim().toLowerCase();
                if (text === 'scarica' || text === 'download') {
                    el.remove();
                }
            });
        });
    }

    function removePremiumButton() {
        try {
            const premiumButton = document.querySelector('#header-position-handle')?.childNodes[0]?.childNodes[1]?.childNodes[0]?.childNodes[1];
            if (premiumButton) premiumButton.remove();
        } catch(e) {}

        // Also try removing upgrade buttons by text content
        document.querySelectorAll('a, button').forEach(el => {
            const text = el.textContent.trim().toLowerCase();
            if (text === 'upgrade' || text === 'get premium' || text === 'go premium') {
                const parent = el.closest('[class*="header"], [class*="Header"], #header-position-handle');
                if (parent) el.remove();
            }
        });
    }

    function removeRecommendations() {
        try {
            const recommendations = document.querySelector('#viewer-recommendations');
            if (recommendations && recommendations.parentNode) {
                recommendations.parentNode.remove();
            }
        } catch(e) {}
    }

    function removePremiumBadges() {
        // Remove elements matching premium badge selectors
        PREMIUM_BADGE_SELECTORS.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => el.remove());
            } catch(e) {}
        });

        // Remove small badge/pill elements near h1/title that contain the text "Premium"
        document.querySelectorAll('h1, [class*="Title"], [class*="title"], [class*="DocumentTitle"], [class*="documentTitle"]').forEach(titleEl => {
            const parent = titleEl.parentElement;
            if (!parent) return;
            parent.querySelectorAll('span, div, a, badge, label').forEach(el => {
                const text = el.textContent.trim();
                if (text === 'Premium' || text === 'PREMIUM') {
                    // Only remove small badge-like elements, not large containers
                    if (el.offsetHeight < 60 || el.getBoundingClientRect().width < 200) {
                        el.remove();
                    }
                }
            });
        });

        // Also find any standalone small elements with exact "Premium" text across the page
        document.querySelectorAll('span, div').forEach(el => {
            if (el.children.length <= 1 && el.textContent.trim() === 'Premium') {
                // Check if this looks like a badge (small element, not a large section)
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.width < 200 && rect.height > 0 && rect.height < 50) {
                    // Avoid removing elements that are part of the already-handled banner selectors
                    const isInBanner = el.closest('[class*="PremiumBanner"], [class*="PremiumPageClarification"], [class*="InlineBanner"]');
                    if (!isInBanner) {
                        el.remove();
                    }
                }
            }
        });
    }

    // ========== React State Patching ==========

    function patchReactBlurState() {
        // Patch React component props to mark all pages as not blurred
        // This prevents React from re-rendering pages with blur on updates
        document.querySelectorAll('.pf').forEach(pf => {
            try {
                const fiberKey = Object.keys(pf).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance'));
                if (!fiberKey) return;
                let fiber = pf[fiberKey];
                let depth = 0;
                while (fiber && depth < 10) {
                    if (fiber.memoizedProps && 'isBlurred' in fiber.memoizedProps) {
                        // Patch the props to mark as not blurred
                        fiber.memoizedProps.isBlurred = false;
                        fiber.memoizedProps.hasBlurredImage = false;
                        break;
                    }
                    fiber = fiber.return;
                    depth++;
                }
            } catch(e) {}
        });
    }

    function patchNextData() {
        // Patch __NEXT_DATA__ to remove blur flags so any client-side
        // navigation or hydration doesn't re-apply blur.
        try {
            const nextDataEl = document.querySelector('#__NEXT_DATA__');
            if (!nextDataEl) return;
            // Read (and cache) the access data from the PRISTINE JSON first: the
            // patch below clears hasBlurredPages, and reading it back afterwards
            // would report a premium document as a free one.
            getDocumentAccessData();
            const data = JSON.parse(nextDataEl.textContent);
            if (data.props?.pageProps?.documentAccess) {
                data.props.pageProps.documentAccess.hasBlurredPages = false;
            }
            nextDataEl.textContent = JSON.stringify(data);
        } catch(e) {}
    }

    // ========== Logo & Branding ==========

    function updateLogos() {
        const logoSelectors = [
            '[aria-label="StudeerSnel Logo"]',
            '[aria-label="StuDocu Logo"]',
            '[aria-label="Studocu Logo"]',
        ];

        logoSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(logo => {
                if (logo.closest('.studocuhack-logo-replaced')) return;
                const wrapper = document.createElement('div');
                wrapper.classList.add('studocuhack-logo-replaced');
                wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:0;cursor:pointer;';
                wrapper.innerHTML = '<svg width="24" height="24" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0"><rect width="32" height="32" rx="6" fill="#4D8BF5"/><text x="16" y="23" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="20" fill="white">S</text></svg>'
                    + '<span style="margin-left:6px;font-weight:800;font-size:15px;white-space:nowrap;"><span style="color:inherit">STUDOCU</span><span style="color:#4D8BF5">HACK</span></span>';
                wrapper.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open('https://github.com/danieltyukov/studocuhack', '_blank');
                });
                const parent = logo.parentElement;
                if (parent) parent.replaceChild(wrapper, logo);
            });
        });
    }

    function addVersionButton() {
        if (document.querySelector('.github-button')) return;

        const browser = window.msBrowser || window.browser || window.chrome;
        if (!browser || !browser.runtime || !browser.runtime.getManifest) return;

        const version = browser.runtime.getManifest().version;
        const btn = document.createElement('button');
        btn.classList.add('github-button', 'tooltip-bottom');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60" aria-labelledby="title" class="svg-inline--fa"><path data-name="layer" d="M32 0a32.021 32.021 0 0 0-10.1 62.4c1.6.3 2.2-.7 2.2-1.5v-6c-8.9 1.9-10.8-3.8-10.8-3.8-1.5-3.7-3.6-4.7-3.6-4.7-2.9-2 .2-1.9 .2-1.9 3.2.2 4.9 3.3 4.9 3.3 2.9 4.9 7.5 3.5 9.3 2.7a6.93 6.93 0 0 1 2-4.3c-7.1-.8-14.6-3.6-14.6-15.8a12.27 12.27 0 0 1 3.3-8.6 11.965 11.965 0 0 1 .3-8.5s2.7-.9 8.8 3.3a30.873 30.873 0 0 1 8-1.1 30.292 30.292 0 0 1 8 1.1c6.1-4.1 8.8-3.3 8.8-3.3a11.965 11.965 0 0 1 .3 8.5 12.1 12.1 0 0 1 3.3 8.6c0 12.3-7.5 15-14.6 15.8a7.746 7.746 0 0 1 2.2 5.9v8.8c0 .9.6 1.8 2.2 1.5A32.021 32.021 0 0 0 32 0z" fill="#fff"></path></svg><span>v.${version}</span><span class="tooltiptext-bottom">Check for newer releases</span>`;
        btn.addEventListener('click', () => {
            window.location.href = "https://github.com/danieltyukov/studocuhack/releases/";
        });

        const upButtons = document.querySelectorAll('.fa-cloud-arrow-up');
        if (upButtons.length > 0 && upButtons[0].parentNode && upButtons[0].parentNode.parentElement) {
            try {
                upButtons[0].parentNode.parentNode.insertBefore(btn, upButtons[0].parentNode.parentElement.children[3]);
            } catch(e) {}
        }
    }

    // ========== Main Execution ==========

    let debounceTimer = null;
    function debouncedCleanup() {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            removeBanners();
            removeBlur();
            ensureAllPagesLoaded();
            removePremiumBadges();
            removeStudocuDownloadButtons();
            removeAdsAndAI();
        }, 50);
    }

    function runAll() {
        removeBanners();
        removeBlur();
        ensureAllPagesLoaded();
        removePremiumButton();
        removePremiumBadges();
        removeStudocuDownloadButtons();
        removeRecommendations();
        removeAdsAndAI();
        updateLogos();
        addVersionButton();
        patchReactBlurState();
    }

    // Run immediately
    runAll();

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            patchNextData();
            runAll();
        });
    } else {
        patchNextData();
    }

    // Run on load
    window.addEventListener('load', runAll);

    // Prime the whole document once the viewer has settled, so every page (incl.
    // premium ones the viewer only fetches on scroll) loads and is revealed.
    setTimeout(primeAllPages, 1800);
    window.addEventListener('load', () => setTimeout(primeAllPages, 1800));

    // Observe DOM changes for dynamically loaded content
    const observer = new MutationObserver(mutations => {
        // Check if any new images with blurred URLs were added
        let hasNewBlurredContent = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for blurred images in added nodes
                        if (node.tagName === 'IMG' && (node.src || '').includes('blurred')) {
                            hasNewBlurredContent = true;
                            break;
                        }
                        if (node.querySelector && node.querySelector('img[src*="blurred"]')) {
                            hasNewBlurredContent = true;
                            break;
                        }
                        // Check for blurred class names
                        const cn = node.className?.toString?.() || '';
                        if (cn.includes('blurred') || cn.includes('Blurred') || cn.includes('PremiumBanner') || cn.includes('premium-banner')) {
                            hasNewBlurredContent = true;
                            break;
                        }
                    }
                }
            }
            // Also watch for attribute changes (e.g., src attribute being set to blurred URL)
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                const target = mutation.target;
                if (target.tagName === 'IMG' && (target.src || '').includes('blurred')) {
                    hasNewBlurredContent = true;
                }
            }
            if (hasNewBlurredContent) break;
        }

        if (hasNewBlurredContent) {
            // Run immediately for blurred content, then debounce the rest
            removeBlur();
            patchReactBlurState();
        }
        debouncedCleanup();
    });

    const observeTarget = document.body || document.documentElement;
    if (observeTarget) {
        observer.observe(observeTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'class', 'style'],
        });
    }

    // Handle scroll events for lazy-loaded pages
    let scrollDebounce = null;
    const scrollHandler = () => {
        if (scrollDebounce) return;
        scrollDebounce = setTimeout(() => {
            scrollDebounce = null;
            removeBlur();
            ensureAllPagesLoaded();
            patchReactBlurState();
        }, 100);
    };

    const viewerWrapper = document.getElementById('viewer-wrapper');
    const documentWrapper = document.getElementById('document-wrapper');

    if (viewerWrapper) viewerWrapper.addEventListener('scroll', scrollHandler, { passive: true });
    if (documentWrapper) documentWrapper.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('scroll', scrollHandler, { passive: true });

    // Re-attach scroll listeners after DOM is ready (elements may not exist yet)
    document.addEventListener('DOMContentLoaded', () => {
        const vw = document.getElementById('viewer-wrapper');
        const dw = document.getElementById('document-wrapper');
        if (vw) vw.addEventListener('scroll', scrollHandler, { passive: true });
        if (dw) dw.addEventListener('scroll', scrollHandler, { passive: true });
    });

    // Sidebar toggle - re-apply logos
    const toggleButton = document.querySelector('[data-test-selector="content-sidebar-toggle"]');
    if (toggleButton) {
        toggleButton.addEventListener('click', updateLogos);
    }

    // Periodic check for React re-renders that might re-blur content
    // Runs every 2 seconds for the first 30 seconds, then every 5 seconds
    let periodicCount = 0;
    const periodicCheck = setInterval(() => {
        removeBlur();
        ensureAllPagesLoaded();
        patchReactBlurState();
        periodicCount++;
        if (periodicCount >= 15) {
            clearInterval(periodicCheck);
            // Switch to slower interval
            setInterval(() => {
                removeBlur();
                ensureAllPagesLoaded();
                patchReactBlurState();
            }, 5000);
        }
    }, 2000);
})();
