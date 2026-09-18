// StudocuHack - entry point.
//
// Loads the user's settings, then wires the cleanup and page modules to the
// events that matter on a Studocu document page: DOM mutations, scrolling, and
// a periodic sweep for React re-renders that put the blur back.

(function () {
    'use strict';

    const SH = globalThis.StudocuHack;
    const cleanup = SH.cleanup;
    const pages = SH.pages;

    function runAll() {
        cleanup.runAll();
        pages.removeBlur();
        pages.ensureAllPagesLoaded();
        pages.patchReactBlurState();
    }

    let debounceTimer = null;
    function debouncedCleanup() {
        if (debounceTimer) return;
        debounceTimer = setTimeout(function () {
            debounceTimer = null;
            cleanup.removeBanners();
            pages.removeBlur();
            pages.ensureAllPagesLoaded();
            cleanup.removePremiumBadges();
            cleanup.removeStudocuDownloadButtons();
        }, 50);
    }

    function looksBlurred(node) {
        if (node.tagName === 'IMG' && (node.src || '').indexOf('blurred') !== -1) return true;
        if (node.querySelector && node.querySelector('img[src*="blurred"]')) return true;
        const cn = (node.className && node.className.toString) ? node.className.toString() : '';
        return cn.indexOf('blurred') !== -1 || cn.indexOf('Blurred') !== -1 ||
            cn.indexOf('PremiumBanner') !== -1 || cn.indexOf('premium-banner') !== -1;
    }

    function observeMutations() {
        const observer = new MutationObserver(function (mutations) {
            let hasNewBlurredContent = false;
            for (let m = 0; m < mutations.length && !hasNewBlurredContent; m++) {
                const mutation = mutations[m];
                if (mutation.type === 'childList') {
                    for (let n = 0; n < mutation.addedNodes.length; n++) {
                        const node = mutation.addedNodes[n];
                        if (node.nodeType === Node.ELEMENT_NODE && looksBlurred(node)) {
                            hasNewBlurredContent = true;
                            break;
                        }
                    }
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                    const t = mutation.target;
                    if (t.tagName === 'IMG' && (t.src || '').indexOf('blurred') !== -1) hasNewBlurredContent = true;
                }
            }
            if (hasNewBlurredContent) {
                pages.removeBlur();
                pages.patchReactBlurState();
            }
            debouncedCleanup();
        });
        const target = document.body || document.documentElement;
        if (target) {
            observer.observe(target, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'class', 'style'],
            });
        }
    }

    function observeScroll() {
        let scrollDebounce = null;
        const onScroll = function () {
            if (scrollDebounce) return;
            scrollDebounce = setTimeout(function () {
                scrollDebounce = null;
                pages.removeBlur();
                pages.ensureAllPagesLoaded();
                pages.patchReactBlurState();
            }, 100);
        };
        const attach = function () {
            ['viewer-wrapper', 'document-wrapper'].forEach(function (id) {
                const node = document.getElementById(id);
                if (node && !node.dataset.shScroll) {
                    node.dataset.shScroll = '1';
                    node.addEventListener('scroll', onScroll, { passive: true });
                }
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        attach();
        document.addEventListener('DOMContentLoaded', attach);
        window.addEventListener('load', attach);
    }

    // Every 2 seconds for the first 30 seconds, then every 5 seconds. Skipped
    // while the tab is hidden: nothing can re-blur a page nobody is looking at,
    // and the sweep is not free on long documents.
    function startPeriodicSweep() {
        let count = 0;
        const sweep = function () {
            if (document.hidden) return;
            pages.removeBlur();
            pages.ensureAllPagesLoaded();
            pages.patchReactBlurState();
        };
        const fast = setInterval(function () {
            sweep();
            if (++count >= 15) {
                clearInterval(fast);
                setInterval(sweep, 5000);
            }
        }, 2000);
    }

    function start() {
        SH.applySettingsToDocument();
        runAll();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                pages.patchNextData();
                runAll();
            });
        } else {
            pages.patchNextData();
        }
        window.addEventListener('load', runAll);

        // Prime the whole document once the viewer has settled, so every page
        // the viewer only fetches on scroll loads without manual scrolling.
        setTimeout(pages.primeAllPages, 1800);
        window.addEventListener('load', function () { setTimeout(pages.primeAllPages, 1800); });

        observeMutations();
        observeScroll();
        startPeriodicSweep();

        const sidebarToggle = document.querySelector('[data-test-selector="content-sidebar-toggle"]');
        if (sidebarToggle) sidebarToggle.addEventListener('click', cleanup.replaceLogos);

        SH.download.init();
    }

    SH.loadSettings().then(start);
})();
