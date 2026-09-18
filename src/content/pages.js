// StudocuHack - page loading and blur removal.
//
// Studocu's React viewer lazy-loads page backgrounds and UNMOUNTS pages that
// scroll far out of view, so a page usually sits in the DOM either as an empty
// `.pf` (no <img> at all) or as an <img loading="lazy"> that never fetched.
// Both render as the blank pages users report (issues #56/#57). This module
// repairs every page it can and labels the ones it cannot.
//
// What it can and cannot do is decided by the access model in common.js:
//   - a page listed in signedQueryParams.pages is fully recoverable (text layer
//     plus figure layer);
//   - a page missing from that list on a text document is premium-locked. Its
//     text never reaches the browser, so the page keeps Studocu's blurred
//     preview and gets a label (issue #58). Replacing it with the figure-only
//     bg{hex}.png would print a crisp but completely empty sheet.

(function () {
    'use strict';

    const SH = globalThis.StudocuHack;
    const pages = {};
    SH.pages = pages;

    // ------------------------------------------------------------------
    // Image helpers
    // ------------------------------------------------------------------

    // Point an <img> at the first candidate URL that successfully loads.
    function setSrcFromCandidates(img, candidates) {
        let i = 0;
        (function tryNext() {
            if (i >= candidates.length) return;
            const url = candidates[i++];
            if (!url) return tryNext();
            img.onerror = tryNext;
            img.onload = function () { img.onerror = null; };
            img.src = url;
        })();
    }

    function showImg(img) {
        img.loading = 'eager';
        img.style.filter = 'none';
        img.style.opacity = '1';
        img.style.visibility = 'visible';
    }

    // Make an existing background <img> show clear, full content now.
    function forceEagerImg(img, candidates) {
        showImg(img);
        // Case 1: a baked-in-blur raster -> try its clear sibling, then the
        // reconstructed candidates, and finally the original blurred URL, so a
        // gated (403) clear sibling lands back on Studocu's preview rather than
        // on a broken image.
        const cur = img.getAttribute('src') || '';
        const clear = SH.deblurUrl(cur);
        if (clear && !img.dataset.shUnblurred) {
            img.dataset.shUnblurred = '1';
            img.removeAttribute('srcset');
            setSrcFromCandidates(img, [clear].concat(candidates).concat([cur]));
            return;
        }
        // Case 2: already showing a real image.
        if (SH.imgLoaded(img)) return;
        // Case 3: a lazy/placeholder image that has not fetched. Clearing src
        // first guarantees a refetch even when the URL is unchanged. Bounded so
        // the periodic re-runs cannot thrash a genuinely gated page.
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

    // Inject a background into a `.pf` the virtual scroller has not mounted.
    // Candidates are test-loaded through a detached Image so a gated page never
    // leaves a broken <img> behind; gives up after a few misses.
    function injectPageImage(pf, candidates) {
        if (pf.querySelector('img')) return;
        if (pf.dataset.shInjecting) return;
        if ((+(pf.dataset.shFail || 0)) >= 3) return;
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
            img.onload = function () {
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

    // A pdf2htmlEX .page fragment is positioned text with inline styles only.
    // Parse it in an inert document and strip active content before any of it
    // touches the page, so a tampered CDN response cannot run code in the
    // studocu.com origin. Returns the sanitised <body>; callers adopt its
    // children rather than re-serialising to HTML.
    pages.sanitizePageHtml = function (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script, iframe, object, embed, link, style').forEach(function (el) { el.remove(); });
        doc.querySelectorAll('*').forEach(function (el) {
            Array.from(el.attributes).forEach(function (attr) {
                const name = attr.name.toLowerCase();
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                } else if ((name === 'src' || name === 'href') && /^\s*javascript:/i.test(attr.value)) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return doc.body;
    };

    // Recover the real text layer for a blank page by fetching its .page
    // fragment and rendering it in place. Only pages listed in `pages` have a
    // URL at all; the pdf2htmlEX stylesheet is already on the page so fonts and
    // positioning apply automatically.
    function injectPageText(a, pf, pageNum) {
        const url = SH.pageTextUrl(a, pageNum);
        if (!url) return;
        if (pf.dataset.shTextTried) return;
        pf.dataset.shTextTried = '1';
        let request;
        try {
            request = fetch(url, { credentials: 'omit' });
        } catch (e) {
            return;
        }
        request
            .then(function (r) { return r.ok ? r.text() : null; })
            .then(function (html) {
                if (html && html.indexOf('<span') !== -1 && !SH.hasTextSpans(pf)) {
                    const body = pages.sanitizePageHtml(html);
                    // The fragment references its figure layer relatively
                    // (src="bga.png"), which would resolve against the site URL
                    // and 403. Point it at the signed CDN URL up front.
                    const bg = SH.bgImageUrl(a, pageNum);
                    body.querySelectorAll('img').forEach(function (img) {
                        const s = img.getAttribute('src') || '';
                        if (bg && /^bg[0-9a-f]+\.png$/i.test(s)) {
                            img.setAttribute('src', bg);
                            img.loading = 'eager';
                        }
                    });
                    pf.replaceChildren.apply(pf, Array.from(body.childNodes));
                    pf.style.filter = 'none';
                    pf.style.opacity = '1';
                    pf.classList.add('nofilter');
                }
            })
            .catch(function () {});
    }

    // ------------------------------------------------------------------
    // Premium-locked pages
    // ------------------------------------------------------------------

    // Render a gated page honestly: keep Studocu's blurred preview as the page
    // image (the only rendering of that text that exists client-side) and label
    // it, so a reader never sees a blank sheet and wonders whether the
    // extension failed. Idempotent.
    pages.markGatedPage = function (a, pf, pageNum) {
        if (pf.querySelector('[data-sh-gated-note]')) return;
        const blurUrl = SH.blurredPageUrl(a, pageNum);
        let img = pf.querySelector('img');
        if (!img && blurUrl) {
            img = document.createElement('img');
            img.className = 'bi x0 y0 w1 h1';
            img.alt = '';
            img.dataset.shInjectedImg = '1';
            img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
            pf.appendChild(img);
        }
        if (img && blurUrl) {
            const cur = img.getAttribute('src') || '';
            if (cur.indexOf('/pages/blurred/') === -1) {
                img.removeAttribute('srcset');
                img.setAttribute('src', blurUrl);
            }
            showImg(img);
        }
        pf.appendChild(SH.createGatedNote(pageNum));
    };

    let _gatedReported = false;
    function reportGatedPages(gated, total) {
        if (_gatedReported || !gated.length) return;
        _gatedReported = true;
        SH.log((total - gated.length) + ' of ' + total + ' pages fully recovered. Pages ' +
            gated.join(', ') + ' are premium-locked: Studocu never sends their text layer ' +
            'to a non-subscriber, so no extension can un-blur them. ' +
            'See https://github.com/danieltyukov/studocuhack/issues/58');
    }

    // ------------------------------------------------------------------
    // Main repair pass
    // ------------------------------------------------------------------

    // Repair every page on the live site. Mounted pages get their background
    // force-loaded/unblurred; pages the virtual scroller left blank get their
    // text layer fetched (when the server serves it) plus the reconstructed
    // background image. Premium-locked pages are labelled instead.
    pages.ensureAllPagesLoaded = function () {
        const a = SH.getDocumentAccessData();
        if (!a) return;
        const pfs = SH.viewerPages();
        const gated = [];
        pfs.forEach(function (pf, idx) {
            const pageNum = idx + 1;
            const bgUrl = SH.bgImageUrl(a, pageNum);
            const candidates = bgUrl ? [bgUrl] : [];

            // If the viewer has since mounted its own loaded image beside the
            // fallback we injected earlier, drop ours.
            const imgs = pf.querySelectorAll('img');
            if (imgs.length > 1) {
                const ours = pf.querySelector('img[data-sh-injected-img]');
                const real = Array.prototype.find.call(imgs, function (im) {
                    return !im.dataset.shInjectedImg && SH.imgLoaded(im);
                });
                if (ours && real) ours.remove();
            }

            if (SH.isTextGated(a, pageNum)) {
                gated.push(pageNum);
                pages.markGatedPage(a, pf, pageNum);
                return;
            }
            const img = pf.querySelector('img');
            if (img) { forceEagerImg(img, candidates); return; }
            if (SH.hasTextSpans(pf)) return;
            injectPageText(a, pf, pageNum);
            if (candidates.length) injectPageImage(pf, candidates);
        });
        reportGatedPages(gated, pfs.length);
    };

    // One-time pass that scrolls the whole document so the viewer lazily
    // fetches and renders EVERY page without the reader scrolling by hand.
    // Capped so it never hijacks the viewport for long on very large
    // documents; the rest load on scroll, and the download captures all pages
    // regardless.
    let _primed = false;
    pages.PRIME_LIMIT = 50;
    pages.primeAllPages = function () {
        if (_primed) return;
        if (!SH.settings.autoLoadPages) return;
        const pfs = SH.viewerPages();
        if (pfs.length === 0) return;
        const a = SH.getDocumentAccessData();
        const hasBlank = pfs.some(function (pf) {
            return !SH.hasTextSpans(pf) && !SH.imgLoaded(pf.querySelector('img'));
        });
        if (!(a && a.hasBlurredPages) && !hasBlank) return;
        _primed = true;

        const saved = SH.saveScroll();
        const limit = Math.min(pfs.length, pages.PRIME_LIMIT);
        if (pfs.length > limit) {
            SH.log('priming first ' + limit + ' of ' + pfs.length +
                ' pages; the rest load on scroll (Download still captures all).');
        }
        let i = 0;
        (function step() {
            if (i >= limit) {
                SH.restoreScroll(saved);
                setTimeout(function () { pages.removeBlur(); pages.ensureAllPagesLoaded(); }, 400);
                return;
            }
            try { pfs[i].scrollIntoView({ block: 'center' }); } catch (e) { /* detached */ }
            i++;
            setTimeout(step, 140);
        })();
    };

    // ------------------------------------------------------------------
    // Blur removal
    // ------------------------------------------------------------------

    function stripBlurClasses(el) {
        Array.from(el.classList).forEach(function (cls) {
            if (cls.indexOf('blurred') !== -1 || cls.indexOf('Blurred') !== -1) {
                el.classList.remove(cls);
            }
        });
    }

    // Swap every baked-in-blur raster for its clear sibling, reusing the signed
    // param already on the blurred URL. On premium documents that param only
    // covers /html/pages/blurred/*, so the clear sibling 403s; the swap is
    // therefore probed with the original URL as the final fallback.
    pages.unblurImages = function () {
        document.querySelectorAll('.pf img').forEach(function (img) {
            if (img.dataset.shUnblurred) return;
            const curSrc = img.getAttribute('src');
            const clearSrc = SH.deblurUrl(curSrc);
            if (clearSrc) {
                img.dataset.shUnblurred = '1';
                img.removeAttribute('srcset');
                showImg(img);
                setSrcFromCandidates(img, [clearSrc, curSrc]);
            }
            const clearData = SH.deblurUrl(img.getAttribute('data-src'));
            if (clearData) {
                img.setAttribute('data-src', clearData);
                img.dataset.shUnblurred = '1';
            }
            const ss = img.getAttribute('srcset');
            if (ss && ss.indexOf('/blurred/') !== -1) {
                img.setAttribute('srcset', ss.replace(/\/pages\/blurred\//g, '/pages/').replace(/\/blurred\//g, '/'));
                img.dataset.shUnblurred = '1';
            }
        });
    };

    pages.removeBlur = function () {
        document.querySelectorAll('.pf').forEach(function (pf) {
            pf.style.filter = 'none';
            pf.style.webkitFilter = 'none';
            pf.style.opacity = '1';
            pf.style.userSelect = 'auto';
            pf.style.pointerEvents = 'auto';
            pf.style.clipPath = 'none';
            pf.style.webkitClipPath = 'none';
            pf.classList.add('nofilter');
            stripBlurClasses(pf);
        });

        document.querySelectorAll('.page-content').forEach(function (page) {
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
            page.classList.add('nofilter');
            stripBlurClasses(page);

            // Ancestors up to #page-container may carry the filter too.
            let ancestor = page.parentElement;
            let depth = 0;
            while (ancestor && ancestor.id !== 'page-container' && ancestor !== document.body && depth < 10) {
                const cs = getComputedStyle(ancestor);
                if (cs.filter !== 'none' || cs.opacity !== '1') {
                    ancestor.style.filter = 'none';
                    ancestor.style.webkitFilter = 'none';
                    ancestor.style.opacity = '1';
                }
                stripBlurClasses(ancestor);
                ancestor = ancestor.parentElement;
                depth++;
            }

            page.querySelectorAll('img').forEach(function (img) {
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.opacity = '1';
                img.style.filter = 'none';
                img.style.visibility = 'visible';
            });

            // Premium clarification banners sit as siblings of the page.
            if (page.parentNode) {
                Array.from(page.parentNode.children).forEach(function (sibling) {
                    if (sibling === page) return;
                    const cn = typeof sibling.className === 'string' ? sibling.className : '';
                    if (cn.indexOf('PremiumPageClarification') !== -1 ||
                        cn.indexOf('blurred') !== -1 ||
                        cn.indexOf('Blurred') !== -1 ||
                        cn.indexOf('premium-banner') !== -1) {
                        sibling.remove();
                    }
                });
            }
        });

        document.querySelectorAll('[class*="blurred-image-wrapper"], [class*="BlurredImage"], [class*="blurred-page"]').forEach(function (el) {
            el.style.filter = 'none';
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            stripBlurClasses(el);
        });

        document.querySelectorAll('.blurred-container').forEach(function (el) {
            el.classList.remove('blurred-container');
        });

        document.querySelectorAll('#modal-overlay, [class*="PremiumOverlay"], [class*="premium-overlay"]').forEach(function (el) {
            el.style.display = 'none';
        });

        pages.unblurImages();
    };

    // ------------------------------------------------------------------
    // React state patching
    // ------------------------------------------------------------------

    // Mark every page as not blurred in the React fiber props so a re-render
    // does not put the blur back.
    pages.patchReactBlurState = function () {
        document.querySelectorAll('.pf').forEach(function (pf) {
            try {
                const fiberKey = Object.keys(pf).find(function (k) {
                    return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance');
                });
                if (!fiberKey) return;
                let fiber = pf[fiberKey];
                let depth = 0;
                while (fiber && depth < 10) {
                    if (fiber.memoizedProps && 'isBlurred' in fiber.memoizedProps) {
                        fiber.memoizedProps.isBlurred = false;
                        fiber.memoizedProps.hasBlurredImage = false;
                        break;
                    }
                    fiber = fiber.return;
                    depth++;
                }
            } catch (e) { /* not a React node */ }
        });
    };

    // Clear the blur flag in #__NEXT_DATA__ so client-side navigation or
    // hydration does not re-apply it. The access data is read from the
    // PRISTINE JSON first, otherwise a premium document would look free.
    pages.patchNextData = function () {
        try {
            const el = document.querySelector('#__NEXT_DATA__');
            if (!el) return;
            SH.getDocumentAccessData();
            const data = JSON.parse(el.textContent);
            if (data.props && data.props.pageProps && data.props.pageProps.documentAccess) {
                data.props.pageProps.documentAccess.hasBlurredPages = false;
            }
            el.textContent = JSON.stringify(data);
        } catch (e) { /* no or malformed NEXT_DATA */ }
    };
})();
