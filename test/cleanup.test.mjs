import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindow, loadModules } from './helpers/dom.mjs';
import { documentFixture } from './fixtures/documents.mjs';

function setup(extraBody, windowOpts) {
    const ctx = createWindow(documentFixture({ shape: 'all-free', pageCount: 1, extraBody }), windowOpts);
    const SH = loadModules(ctx.window);
    return { ...ctx, SH };
}

test('removeBanners removes every premium banner selector and hides the modal overlay', () => {
    const { SH, document } = setup(
        '<div class="PremiumBannerBlobWrapper_x">upsell</div>' +
        '<div class="InlineBanner_inline-banner__y">upsell</div>' +
        '<div data-test-selector="preview-banner-upgrade-first-cta">Upgrade</div>' +
        '<div class="banner-wrapper">x</div>' +
        '<div id="modal-overlay">modal</div>' +
        '<div class="keep-me">content</div>',
    );
    SH.cleanup.removeBanners();
    for (const sel of SH.SELECTORS.banners) {
        assert.equal(document.querySelector(sel), null, sel + ' should be gone');
    }
    assert.equal(document.querySelector('#modal-overlay').style.display, 'none');
    assert.ok(document.querySelector('.keep-me'), 'unrelated content untouched');
});

test('every selector in SELECTORS is valid CSS', () => {
    const { SH, document } = setup('');
    const all = [
        ...SH.SELECTORS.banners, ...SH.SELECTORS.premiumBadges, ...SH.SELECTORS.ads,
        ...SH.SELECTORS.aiToolbar, ...SH.SELECTORS.logos, SH.SELECTORS.nativeDownloadButton,
    ];
    for (const sel of all) {
        assert.doesNotThrow(() => document.querySelectorAll(sel), sel);
    }
});

test('removePremiumBadges removes badge elements and small "Premium" pills', () => {
    const { SH, document } = setup(
        '<span class="PremiumBadge_abc">Premium</span>' +
        '<div class="DocumentTitle_x"><h1>Doc</h1><span class="pill">Premium</span></div>' +
        '<p class="body">This is a Premium document with text</p>',
    );
    SH.cleanup.removePremiumBadges();
    assert.equal(document.querySelector('[class*="PremiumBadge"]'), null);
    assert.equal(document.querySelector('.pill'), null);
    assert.ok(document.querySelector('.body'), 'longer text is not a badge');
});

test('removeStudocuDownloadButtons matches localized labels and current class hashes, keeps other links', () => {
    const { SH, document } = setup(
        '<div class="hidden-on-mobile"><button class="Button-module-scss-module__UoECUq__button Button-module-scss-module__UoECUq__pill">Downloaden</button></div>' +
        '<div class="hidden-from-tablet"><button class="Button-module-scss-module__UoECUq__button">Herunterladen</button></div>' +
        '<button class="Button-module-scss-module__x">Télécharger</button>' +
        '<footer><a class="FooterLink-module__link">Download de app</a></footer>' +
        '<button class="Button-module-scss-module__y">Save</button>',
    );
    SH.cleanup.removeStudocuDownloadButtons();
    assert.equal(document.querySelector('.hidden-on-mobile button'), null, 'Dutch label removed');
    assert.equal(document.querySelector('.hidden-from-tablet button'), null, 'German label removed');
    assert.equal(document.querySelector('.Button-module-scss-module__x'), null, 'French label removed');
    assert.ok(document.querySelector('footer a'), 'footer "Download de app" link is kept');
    assert.ok(document.querySelector('.Button-module-scss-module__y'), 'unrelated button kept');
});

test('removeStudocuDownloadButtons only runs when our download button is enabled', () => {
    const markup =
        '<div data-test-selector="document-viewer-download-button-topbar"><button>Download</button></div>' +
        '<button class="Button_button__x">Scarica</button>' +
        '<div class="hidden-on-mobile"><a class="l">download</a></div>';
    {
        const { SH, document } = setup(markup);
        SH.settings.showDownloadButton = false;
        SH.cleanup.removeStudocuDownloadButtons();
        assert.ok(document.querySelector('[data-test-selector="document-viewer-download-button-topbar"]'));
        assert.ok(document.querySelector('.Button_button__x'));
    }
    {
        const { SH, document } = setup(markup);
        SH.cleanup.removeStudocuDownloadButtons();
        assert.equal(document.querySelector('[data-test-selector="document-viewer-download-button-topbar"]'), null);
        assert.equal(document.querySelector('.Button_button__x'), null);
        assert.equal(document.querySelector('.hidden-on-mobile a'), null);
    }
});

test('replaceLogos swaps the site logo for a link to the project, once, when enabled', () => {
    const { SH, document } = setup('');
    SH.cleanup.replaceLogos();
    SH.cleanup.replaceLogos();
    const logos = document.querySelectorAll('.studocuhack-logo-replaced');
    assert.equal(logos.length, 1);
    assert.equal(logos[0].tagName, 'A');
    assert.equal(logos[0].getAttribute('href'), 'https://github.com/danieltyukov/studocuhack');
    assert.equal(logos[0].getAttribute('rel'), 'noopener');
    assert.ok(logos[0].querySelector('svg'));
    assert.equal(logos[0].querySelector('.studocuhack-logo-text').textContent, 'STUDOCUHACK');
    assert.equal(document.querySelector('[aria-label="Studocu Logo"]'), null);
});

test('replaceLogos does nothing when disabled', () => {
    const { SH, document } = setup('');
    SH.settings.replaceLogo = false;
    SH.cleanup.replaceLogos();
    assert.ok(document.querySelector('[aria-label="Studocu Logo"]'));
    assert.equal(document.querySelector('.studocuhack-logo-replaced'), null);
});

test('removePremiumButton removes upgrade links inside the header only', () => {
    const { SH, document } = setup(
        '<div class="Header_top"><a class="up">Upgrade</a></div>' +
        '<article><a class="body-link">Upgrade</a></article>',
    );
    SH.cleanup.removePremiumButton();
    assert.equal(document.querySelector('.up'), null);
    assert.ok(document.querySelector('.body-link'), 'links outside the header are kept');
});

test('removeRecommendations drops the recommendations block with its wrapper', () => {
    const { SH, document } = setup('<section class="wrap"><div id="viewer-recommendations"></div></section>');
    SH.cleanup.removeRecommendations();
    assert.equal(document.querySelector('.wrap'), null);
});
