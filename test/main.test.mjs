// End-to-end: all five content scripts, in manifest order, against a fixture.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindow, loadScripts, tick, CONTENT_SCRIPTS } from './helpers/dom.mjs';
import { documentFixture } from './fixtures/documents.mjs';
import { readFileSync } from 'node:fs';

const MANIFEST = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8'));

test('manifest lists the content scripts in dependency order', () => {
    assert.deepEqual(CONTENT_SCRIPTS, [
        'content/common.js',
        'content/cleanup.js',
        'content/pages.js',
        'content/download.js',
        'content/main.js',
    ]);
});

test('manifest targets the same sites for content scripts and web accessible resources', () => {
    const sites = MANIFEST.content_scripts[0].matches;
    assert.ok(sites.length >= 4, 'expected every supported Studocu site');
    for (const pattern of sites) assert.match(pattern, /^https:\/\/www\.[a-z.]+\/\*$/);
    assert.deepEqual(MANIFEST.web_accessible_resources[0].matches, sites);
});

test('boot on a premium document: banners gone, gated pages labelled, settings applied', async () => {
    const ctx = createWindow(documentFixture({
        shape: 'text-with-gaps', pageCount: 3, freePages: [1],
        states: { 1: 'text', 2: 'blurred', 3: 'empty' },
        extraBody: '<div class="PremiumBannerBlobWrapper_x">upsell</div><div class="AdsContainer_x">ad</div>',
    }));
    const SH = loadScripts(ctx.window);
    await tick(20);

    const { document } = ctx;
    assert.equal(document.documentElement.getAttribute('data-sh-ads'), 'hide');
    assert.equal(document.documentElement.getAttribute('data-sh-ai'), 'hide');
    assert.equal(document.documentElement.getAttribute('data-sh-download'), 'on');
    assert.equal(document.querySelector('[class*="PremiumBannerBlobWrapper"]'), null);
    assert.ok(document.querySelector('.AdsContainer_x'), 'ads are hidden by CSS, not removed');
    assert.ok(document.querySelector('#viewer-wrapper .download-button-1'), 'download button injected');
    assert.ok(document.querySelector('.studocuhack-logo-replaced'), 'logo replaced');

    const pfs = document.querySelectorAll('#viewer-wrapper .pf');
    assert.equal(pfs[0].querySelector('[data-sh-gated-note]'), null);
    assert.ok(pfs[1].querySelector('[data-sh-gated-note]'));
    assert.ok(pfs[2].querySelector('[data-sh-gated-note]'));

    const patched = JSON.parse(document.querySelector('#__NEXT_DATA__').textContent);
    assert.equal(patched.props.pageProps.documentAccess.hasBlurredPages, false, 'NEXT_DATA patched');
    assert.equal(SH.getDocumentAccessData().hasBlurredPages, true, 'model read before the patch');

    const errors = ctx.logs.filter((l) => l.startsWith('ERROR') || l.startsWith('JSDOM'));
    assert.deepEqual(errors, [], 'no runtime errors');
    ctx.window.close();
});

test('stored settings switch features off', async () => {
    const ctx = createWindow(documentFixture({ shape: 'all-free', pageCount: 1, states: { 1: 'text' } }), {
        storage: { hideAds: false, hideAiToolbar: false, replaceLogo: false, showDownloadButton: false, autoLoadPages: false },
    });
    loadScripts(ctx.window);
    await tick(20);
    const { document } = ctx;
    assert.equal(document.documentElement.getAttribute('data-sh-ads'), 'show');
    assert.equal(document.documentElement.getAttribute('data-sh-ai'), 'show');
    assert.equal(document.documentElement.getAttribute('data-sh-download'), 'off');
    assert.equal(document.querySelector('.download-button-1'), null);
    assert.equal(document.querySelector('.studocuhack-logo-replaced'), null);
    assert.ok(document.querySelector('[aria-label="Studocu Logo"]'));
    ctx.window.close();
});

test('boots without errors on a page that is not a document', async () => {
    const ctx = createWindow('<!doctype html><html><body><main><h1>Search</h1></main></body></html>');
    loadScripts(ctx.window);
    await tick(20);
    const errors = ctx.logs.filter((l) => l.startsWith('ERROR') || l.startsWith('JSDOM'));
    assert.deepEqual(errors, []);
    ctx.window.close();
});

test('the popup renders the version and persists toggles', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { SRC } = await import('./helpers/dom.mjs');
    const html = fs.readFileSync(path.join(SRC, 'popup', 'popup.html'), 'utf8')
        .replace('<script src="popup.js"></script>', '');
    const ctx = createWindow(html, { storage: { hideAds: false }, url: 'chrome-extension://abc/popup/popup.html' });
    ctx.window.eval(fs.readFileSync(path.join(SRC, 'popup', 'popup.js'), 'utf8'));
    await tick(0);
    const { document } = ctx;
    assert.match(document.getElementById('version').textContent, /^v\d+\.\d+\.\d+$/);
    const ads = document.querySelector('input[data-setting="hideAds"]');
    const logo = document.querySelector('input[data-setting="replaceLogo"]');
    assert.equal(ads.checked, false, 'stored value shown');
    assert.equal(logo.checked, true, 'default shown');

    ads.checked = true;
    ads.dispatchEvent(new ctx.window.Event('change', { bubbles: true }));
    assert.equal(JSON.stringify(ctx.storageWrites), JSON.stringify([{ hideAds: true }]));
    assert.match(document.getElementById('status').textContent, /Saved/);
    ctx.window.close();
});
