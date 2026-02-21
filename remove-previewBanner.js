(function() {
    'use strict';

    const SELECTORS = [
        '[class*="PremiumBannerBlobWrapper"]',
        '[class*="InlineBanner_inline-banner"]',
        '[class*="PremiumPageClarificationBanner"]',
        '[class*="PremiumBannerHeader"]',
        '[class*="PremiumBannerBenefitsList"]',
        '[class*="PremiumBannerButtons"]',
        '[data-test-selector="modal-document-viewer-preview-message"]',
        '[data-test-selector="preview-banner-upgrade-first-cta"]',
        '[data-test-selector="preview-banner-upload-second-cta"]',
        '.banner-wrapper',
        '._95f5f1767857',
        '._3273140306b6',
    ];

    function removeAll() {
        SELECTORS.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => el.remove());
            } catch(e) {}
        });
    }

    // Run immediately
    removeAll();

    // Poll every 500ms for 10 seconds to catch late-loading banners
    let attempts = 0;
    const interval = setInterval(() => {
        removeAll();
        if (++attempts >= 20) clearInterval(interval);
    }, 500);

    // Run on page load events
    window.addEventListener('load', removeAll);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', removeAll);
    } else {
        removeAll();
    }

    // Watch for dynamically added banners
    const observer = new MutationObserver(mutations => {
        let shouldRemove = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const isRelevant = SELECTORS.some(sel => {
                            try {
                                return node.matches(sel) || node.querySelector(sel);
                            } catch(e) { return false; }
                        });
                        if (isRelevant) {
                            shouldRemove = true;
                            break;
                        }
                    }
                }
            }
            if (shouldRemove) break;
        }
        if (shouldRemove) {
            setTimeout(removeAll, 50);
        }
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
