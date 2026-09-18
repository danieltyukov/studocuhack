// StudocuHack - page cleanup.
//
// Removes the premium upsell chrome around a document: banners, badges, the
// "Upgrade" header button, recommendations, and Studocu's own download button
// (which leads to the paywall). Also swaps the site logo for ours.
//
// Ads and the AI toolbar are hidden purely by style.css; the user's settings are
// expressed as attributes on <html> (see SH.applySettingsToDocument) so the CSS
// can be switched off without touching the stylesheet.

(function () {
    'use strict';

    const SH = globalThis.StudocuHack;
    const cleanup = {};
    SH.cleanup = cleanup;

    cleanup.removeBanners = function () {
        SH.removeMatching(SH.SELECTORS.banners);
        const modal = document.querySelector('#modal-overlay');
        if (modal) modal.style.display = 'none';
    };

    cleanup.removePremiumBadges = function () {
        SH.removeMatching(SH.SELECTORS.premiumBadges);

        // Small badge/pill elements near the title that just say "Premium".
        document.querySelectorAll('h1, [class*="Title"], [class*="title"], [class*="DocumentTitle"], [class*="documentTitle"]').forEach(function (titleEl) {
            const parent = titleEl.parentElement;
            if (!parent) return;
            parent.querySelectorAll('span, div, a, badge, label').forEach(function (el) {
                const text = el.textContent.trim();
                if (text === 'Premium' || text === 'PREMIUM') {
                    if (el.offsetHeight < 60 || el.getBoundingClientRect().width < 200) {
                        el.remove();
                    }
                }
            });
        });

        // Any other standalone small element whose whole text is "Premium".
        document.querySelectorAll('span, div').forEach(function (el) {
            if (el.children.length <= 1 && el.textContent.trim() === 'Premium') {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.width < 200 && rect.height > 0 && rect.height < 50) {
                    const inBanner = el.closest('[class*="PremiumBanner"], [class*="PremiumPageClarification"], [class*="InlineBanner"]');
                    if (!inBanner) el.remove();
                }
            }
        });
    };

    cleanup.removePremiumButton = function () {
        document.querySelectorAll('a, button').forEach(function (el) {
            const text = el.textContent.trim().toLowerCase();
            if (text === 'upgrade' || text === 'get premium' || text === 'go premium') {
                const parent = el.closest('[class*="header"], [class*="Header"], #header-position-handle');
                if (parent) el.remove();
            }
        });
    };

    cleanup.removeRecommendations = function () {
        const recommendations = document.querySelector('#viewer-recommendations');
        if (recommendations && recommendations.parentNode) {
            recommendations.parentNode.remove();
        }
    };

    // Studocu's native download button opens the paywall. It is only removed
    // when our own download button is enabled, so a user who turns ours off
    // still has one.
    cleanup.removeStudocuDownloadButtons = function () {
        if (!SH.settings.showDownloadButton) return;

        document.querySelectorAll(SH.SELECTORS.nativeDownloadButton).forEach(function (el) {
            if (!el.classList.contains('download-button-1') && !el.querySelector('.download-button-1')) {
                el.remove();
            }
        });

        // The button's class hash changes between deployments (Button_button,
        // Button-module-scss-module__…), so it is matched by its localized
        // label instead; see SELECTORS.nativeDownloadWords.
        const isNativeDownload = function (el) {
            if (el.closest('.download-button-1')) return false;
            return SH.SELECTORS.nativeDownloadWords.test(el.textContent.trim());
        };
        document.querySelectorAll(
            'button[class*="Button"], a[class*="Button"], ' +
            '.hidden-on-mobile button, .hidden-on-mobile a, .hidden-from-tablet button, .hidden-from-tablet a'
        ).forEach(function (el) {
            if (isNativeDownload(el)) el.remove();
        });
    };

    // The blue "S" tile used in place of the site logo. Built with DOM calls
    // rather than innerHTML so the markup is obviously static.
    function buildLogoIcon() {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 32 32');
        svg.setAttribute('aria-hidden', 'true');
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('width', '32');
        rect.setAttribute('height', '32');
        rect.setAttribute('rx', '6');
        rect.setAttribute('fill', '#4D8BF5');
        const letter = document.createElementNS(NS, 'text');
        letter.setAttribute('x', '16');
        letter.setAttribute('y', '23');
        letter.setAttribute('text-anchor', 'middle');
        letter.setAttribute('font-family', 'Arial Black,Arial,sans-serif');
        letter.setAttribute('font-weight', '900');
        letter.setAttribute('font-size', '20');
        letter.setAttribute('fill', '#fff');
        letter.textContent = 'S';
        svg.appendChild(rect);
        svg.appendChild(letter);
        return svg;
    }

    cleanup.replaceLogos = function () {
        if (!SH.settings.replaceLogo) return;
        SH.SELECTORS.logos.forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (logo) {
                if (logo.closest('.studocuhack-logo-replaced')) return;
                const wrapper = document.createElement('a');
                wrapper.className = 'studocuhack-logo-replaced';
                wrapper.href = 'https://github.com/danieltyukov/studocuhack';
                wrapper.target = '_blank';
                wrapper.rel = 'noopener';
                wrapper.title = 'StudocuHack on GitHub';
                wrapper.appendChild(buildLogoIcon());
                const text = document.createElement('span');
                text.className = 'studocuhack-logo-text';
                const brand = document.createElement('span');
                brand.textContent = 'STUDOCU';
                const accent = document.createElement('span');
                accent.className = 'studocuhack-logo-accent';
                accent.textContent = 'HACK';
                text.appendChild(brand);
                text.appendChild(accent);
                wrapper.appendChild(text);
                wrapper.addEventListener('click', function (e) { e.stopPropagation(); });
                const parent = logo.parentElement;
                if (parent) parent.replaceChild(wrapper, logo);
            });
        });
    };

    // Everything that should run on each DOM change.
    cleanup.runAll = function () {
        cleanup.removeBanners();
        cleanup.removePremiumButton();
        cleanup.removePremiumBadges();
        cleanup.removeStudocuDownloadButtons();
        cleanup.removeRecommendations();
        cleanup.replaceLogos();
    };
})();
