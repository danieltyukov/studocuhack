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
    ];

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

    function removeBlur() {
        document.querySelectorAll('.page-content').forEach(page => {
            // Remove inline blur styles
            if (page.style.filter && page.style.filter.includes('blur')) {
                page.style.filter = 'none';
            }
            if (page.style.userSelect === 'none') {
                page.style.userSelect = 'auto';
            }

            // Add nofilter class for CSS override
            page.classList.add('nofilter');

            // Remove any blurred-related CSS module classes
            Array.from(page.classList).forEach(cls => {
                if (cls.includes('blurred')) {
                    page.classList.remove(cls);
                }
            });

            // Make blurred images fill the page container properly
            page.querySelectorAll('img').forEach(img => {
                img.style.width = '100%';
                img.style.height = 'auto';
            });

            // Remove premium clarification banner siblings
            if (page.parentNode) {
                Array.from(page.parentNode.children).forEach(sibling => {
                    if (sibling !== page &&
                        sibling.className &&
                        (sibling.className.includes('PremiumPageClarification') ||
                         sibling.className.includes('blurred'))) {
                        sibling.remove();
                    }
                });
            }
        });

        // Legacy: handle old blurred-container elements
        document.querySelectorAll('.blurred-container').forEach(container => {
            container.classList.remove('blurred-container');
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
                wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
                wrapper.innerHTML = '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="15" fill="#2cc302"/><text x="16" y="21" text-anchor="middle" font-size="16" font-weight="bold" fill="white" font-family="Arial,sans-serif">S</text></svg><span style="font-weight:700;font-size:16px;color:inherit;">StudocuHack</span>';
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
        }, 50);
    }

    function runAll() {
        removeBanners();
        removeBlur();
        removePremiumButton();
        removeRecommendations();
        updateLogos();
        addVersionButton();
    }

    // Run immediately
    runAll();

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAll);
    }

    // Run on load
    window.addEventListener('load', runAll);

    // Observe DOM changes for dynamically loaded content
    const observer = new MutationObserver(debouncedCleanup);

    const observeTarget = document.body || document.documentElement;
    if (observeTarget) {
        observer.observe(observeTarget, {
            childList: true,
            subtree: true,
        });
    }

    // Handle scroll events for lazy-loaded pages
    const scrollHandler = () => {
        removeBlur();
    };

    const viewerWrapper = document.getElementById('viewer-wrapper');
    const documentWrapper = document.getElementById('document-wrapper');

    if (viewerWrapper) viewerWrapper.addEventListener('scroll', scrollHandler);
    if (documentWrapper) documentWrapper.addEventListener('scroll', scrollHandler);
    window.addEventListener('scroll', scrollHandler);

    // Re-attach scroll listeners after DOM is ready (elements may not exist yet)
    document.addEventListener('DOMContentLoaded', () => {
        const vw = document.getElementById('viewer-wrapper');
        const dw = document.getElementById('document-wrapper');
        if (vw) vw.addEventListener('scroll', scrollHandler);
        if (dw) dw.addEventListener('scroll', scrollHandler);
    });

    // Sidebar toggle - re-apply logos
    const toggleButton = document.querySelector('[data-test-selector="content-sidebar-toggle"]');
    if (toggleButton) {
        toggleButton.addEventListener('click', updateLogos);
    }
})();
