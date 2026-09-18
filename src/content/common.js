// StudocuHack - shared namespace.
//
// Every content script listed in manifest.json runs in the same isolated world,
// in manifest order. This file runs first and publishes `globalThis.StudocuHack`
// (aliased `SH` in the other scripts). It holds the things more than one script
// needs: the selector lists, the document access model, URL builders, the
// premium-locked detection, and the user settings.
//
// Keep this file free of side effects on the page. It only defines things.

(function () {
    'use strict';

    const SH = {};
    globalThis.StudocuHack = SH;

    SH.LOG_PREFIX = 'StudocuHack:';
    SH.log = function () {
        const args = Array.prototype.slice.call(arguments);
        args.unshift(SH.LOG_PREFIX);
        console.log.apply(console, args);
    };

    // ---------------------------------------------------------------------
    // Selectors
    //
    // The CSS in style.css hides most of these statically so nothing flashes
    // before the scripts run; the JS removal below is the second line of defence
    // for elements React re-mounts. When you add a selector here, add it to
    // style.css too (and vice versa).
    // ---------------------------------------------------------------------

    SH.SELECTORS = {
        banners: [
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
        ],
        premiumBadges: [
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
        ],
        // Ads are served through Refinery89 (r89) wrappers, Google Publisher Tag
        // iframes and Adagio. Hidden by style.css; listed here for reference and
        // for the tests.
        ads: [
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
        ],
        // "Ask a question about this document" plus the Mock exam / Summary /
        // Quiz pills, which live in the same wrapper.
        aiToolbar: [
            '[class*="AIToolbar"]',
        ],
        nativeDownloadButton: '[data-test-selector="document-viewer-download-button-topbar"]',
        logos: [
            '[aria-label="StudeerSnel Logo"]',
            '[aria-label="StuDocu Logo"]',
            '[aria-label="Studocu Logo"]',
        ],
    };

    // Remove every element matching any selector in `list`. Invalid selectors
    // are skipped so one bad entry cannot disable the whole pass.
    SH.removeMatching = function (list, root) {
        const scope = root || document;
        list.forEach(function (selector) {
            try {
                scope.querySelectorAll(selector).forEach(function (el) { el.remove(); });
            } catch (e) { /* invalid selector */ }
        });
    };

    // ---------------------------------------------------------------------
    // Settings
    //
    // Stored in chrome.storage.sync and edited from the toolbar popup. Every
    // feature defaults to on. The `chrome` namespace is used on purpose: Firefox
    // exposes it too, and the callback form works identically in both.
    // ---------------------------------------------------------------------

    SH.DEFAULT_SETTINGS = {
        hideAds: true,
        hideAiToolbar: true,
        replaceLogo: true,
        showDownloadButton: true,
        autoLoadPages: true,
    };

    SH.settings = Object.assign({}, SH.DEFAULT_SETTINGS);

    SH.loadSettings = function () {
        return new Promise(function (resolve) {
            const api = globalThis.chrome;
            if (!api || !api.storage || !api.storage.sync) {
                resolve(SH.settings);
                return;
            }
            try {
                api.storage.sync.get(SH.DEFAULT_SETTINGS, function (stored) {
                    if (stored && typeof stored === 'object') {
                        Object.keys(SH.DEFAULT_SETTINGS).forEach(function (key) {
                            if (typeof stored[key] === 'boolean') SH.settings[key] = stored[key];
                        });
                    }
                    resolve(SH.settings);
                });
            } catch (e) {
                resolve(SH.settings);
            }
        });
    };

    // style.css hides ads, the AI toolbar and Studocu's own download button by
    // default. A disabled feature is expressed as an attribute on <html> that the
    // CSS rules exclude, so turning a feature off needs no stylesheet juggling.
    SH.applySettingsToDocument = function () {
        const root = document.documentElement;
        if (!root) return;
        root.setAttribute('data-sh-ads', SH.settings.hideAds ? 'hide' : 'show');
        root.setAttribute('data-sh-ai', SH.settings.hideAiToolbar ? 'hide' : 'show');
        root.setAttribute('data-sh-download', SH.settings.showDownloadButton ? 'on' : 'off');
    };

    // ---------------------------------------------------------------------
    // Document access model
    //
    // Studocu renders native PDFs with pdf2htmlEX in split-page mode, so every
    // page is TWO separately signed layers under
    // https://doc-assets.studocu.com/{objectKey}/html/ :
    //
    //   bg{hex}.png               the FIGURE layer: rules, table borders, bullet
    //                             glyphs, coloured boxes. No text.
    //   {objectKey}{hex}.page     the TEXT layer: positioned <span>s.
    //   pages/blurred/page{n}.webp  Studocu's blurred preview thumbnail.
    //
    // Page numbers in bg/.page filenames are HEX (page 18 -> bg12.png); the
    // blurred previews are DECIMAL (page18.webp).
    //
    // The signing key lives in __NEXT_DATA__ under
    // props.pageProps.documentAccess.signedQueryParams, and its shape varies:
    //   scanned/image docs:    { global }
    //   native pdf2htmlEX docs: { html, css, png, blurredPage, pages }
    // `png`/`global` are wildcard strings for /html/*.png. `pages` is an ARRAY
    // of { pageNumber, signedQueryParams }, one per text-bearing page the reader
    // is allowed to see. A page missing from `pages` on a document that has the
    // key is premium-locked: its text is never sent to the browser in any form
    // (verified live, issue #58), so nothing client-side can un-blur it.
    // ---------------------------------------------------------------------

    SH.DOC_ASSETS = 'https://doc-assets.studocu.com/';

    // First string-valued key out of `keys`, or ''. Never returns the `pages`
    // array (concatenating it into a URL produced "bg8.png[object Object]").
    SH.pickParam = function (sp, keys) {
        if (!sp) return '';
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (typeof sp[k] === 'string' && sp[k]) return sp[k];
        }
        return '';
    };

    // Parse a documentAccess object (plus the optional document object) into the
    // normalised shape the rest of the extension works with. Pure; used by the
    // tests directly.
    SH.parseDocumentAccess = function (da, doc) {
        if (!da || !da.objectKey || !da.signedQueryParams) return null;
        const sp = da.signedQueryParams;
        const pageParams = {};
        if (Array.isArray(sp.pages)) {
            sp.pages.forEach(function (p) {
                if (p && p.pageNumber && typeof p.signedQueryParams === 'string') {
                    pageParams[p.pageNumber] = p.signedQueryParams;
                }
            });
        }
        return {
            objectKey: da.objectKey,
            bgParams: SH.pickParam(sp, ['png', 'global']),
            pageParams: pageParams,
            blurredParams: SH.pickParam(sp, ['blurredPage', 'global']),
            hasBlurredPages: !!da.hasBlurredPages,
            pageCount: doc ? (doc.numberOfPages || doc.pageCount || 0) : 0,
            // True when the document keeps its text in separate .page fragments,
            // i.e. bg{hex}.png is only a figure layer. Keyed off the PRESENCE of
            // `pages`, not its length: `pages: []` means every page is gated, not
            // that the document is a scanned one.
            hasTextLayer: Array.isArray(sp.pages),
        };
    };

    let _docAccess = null;

    // Read (and cache) the access data from #__NEXT_DATA__. Must be called
    // before patchNextData() rewrites hasBlurredPages in that JSON.
    SH.getDocumentAccessData = function () {
        if (_docAccess) return _docAccess;
        try {
            const el = document.querySelector('#__NEXT_DATA__');
            if (!el) return null;
            const data = JSON.parse(el.textContent);
            const props = data && data.props && data.props.pageProps;
            _docAccess = SH.parseDocumentAccess(props && props.documentAccess, props && props.document);
        } catch (e) {
            _docAccess = null;
        }
        return _docAccess;
    };

    // Figure-layer background: HEX page number, png/global param.
    SH.bgImageUrl = function (a, pageNum) {
        if (!a || !a.bgParams) return '';
        return SH.DOC_ASSETS + a.objectKey + '/html/bg' + pageNum.toString(16) + '.png' + a.bgParams;
    };

    // Per-page text fragment, signed per page. '' when this page has no entry.
    SH.pageTextUrl = function (a, pageNum) {
        if (!a) return '';
        const param = a.pageParams[pageNum];
        if (!param) return '';
        return SH.DOC_ASSETS + a.objectKey + '/html/' + a.objectKey + pageNum.toString(16) + '.page' + param;
    };

    // Studocu's own blurred preview raster. DECIMAL page number.
    SH.blurredPageUrl = function (a, pageNum) {
        if (!a || !a.blurredParams) return '';
        return SH.DOC_ASSETS + a.objectKey + '/html/pages/blurred/page' + pageNum + '.webp' + a.blurredParams;
    };

    // A page is premium-locked when the document has text layers but this page
    // has no signed entry for its own. Deliberately NOT keyed off hasBlurredPages,
    // which patchNextData() rewrites; `pages` is never rewritten.
    SH.isTextGated = function (a, pageNum) {
        return !!(a && a.hasTextLayer && !a.pageParams[pageNum]);
    };

    // Convert a baked-in-blur raster URL to its clear sibling, keeping the signed
    // param. Returns null when the URL is not a blurred one.
    SH.deblurUrl = function (url) {
        if (!url || url.indexOf('/blurred/') === -1) return null;
        return url.replace('/pages/blurred/', '/pages/').replace('/blurred/', '/');
    };

    SH.gatedNoteText = function (pageNum) {
        return 'Page ' + pageNum + ' is premium-locked. Studocu does not send the text ' +
            'of this page to non-subscribers, so it cannot be unblurred.';
    };

    // The label placed on a premium-locked page, in the viewer and in the
    // download. Idempotent per page via the data attribute.
    SH.createGatedNote = function (pageNum) {
        const note = document.createElement('div');
        note.setAttribute('data-sh-gated-note', String(pageNum));
        note.className = 'sh-gated-note';
        note.textContent = SH.gatedNoteText(pageNum);
        return note;
    };

    // ---------------------------------------------------------------------
    // Viewer DOM helpers
    // ---------------------------------------------------------------------

    // The pages of the live viewer, excluding the clones the download overlay
    // renders (it reuses the `.p2hv` class so the pdf2htmlEX CSS applies).
    SH.viewerPages = function () {
        const all = document.querySelectorAll('.pf');
        return Array.prototype.filter.call(all, function (pf) {
            return !pf.closest('#sh-dl-overlay');
        });
    };

    // The element that scrolls the document.
    SH.getScroller = function () {
        return document.getElementById('viewer-wrapper') ||
            document.getElementById('document-wrapper') ||
            document.scrollingElement || document.documentElement;
    };

    // A page shows real text once it has more than a handful of spans; empty
    // lazy placeholders have none.
    SH.hasTextSpans = function (pf) {
        return pf.querySelectorAll('span').length > 3;
    };

    SH.imgLoaded = function (img) {
        return !!(img && img.complete && img.naturalWidth > 0);
    };

    // Small in-page notice used instead of alert(), which blocks the tab.
    SH.notify = function (message, ms) {
        let el = document.getElementById('sh-notice');
        if (!el) {
            el = document.createElement('div');
            el.id = 'sh-notice';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.add('sh-notice-visible');
        clearTimeout(el._shTimer);
        el._shTimer = setTimeout(function () {
            el.classList.remove('sh-notice-visible');
        }, ms || 5000);
    };
})();
