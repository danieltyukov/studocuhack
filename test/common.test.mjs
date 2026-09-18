import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindow, loadScripts } from './helpers/dom.mjs';
import { documentFixture, OBJECT_KEY, ASSETS } from './fixtures/documents.mjs';

function sh(html = documentFixture({ shape: 'text-with-gaps' })) {
    const ctx = createWindow(html);
    const SH = loadScripts(ctx.window, ['content/common.js']);
    return { ...ctx, SH };
}

test('pickParam returns the first string key and never the pages array', () => {
    const { SH } = sh();
    const sp = { pages: [{ pageNumber: 1, signedQueryParams: '?p1' }], png: '?png', global: '?global' };
    assert.equal(SH.pickParam(sp, ['png', 'global']), '?png');
    assert.equal(SH.pickParam(sp, ['pages', 'global']), '?global');
    assert.equal(SH.pickParam({ pages: [] }, ['pages']), '');
    assert.equal(SH.pickParam(null, ['png']), '');
});

test('parseDocumentAccess: native text document with gated pages', () => {
    const { SH } = sh();
    const a = SH.parseDocumentAccess({
        objectKey: OBJECT_KEY,
        hasBlurredPages: true,
        signedQueryParams: {
            png: '?png=1', blurredPage: '?blur=1',
            pages: [{ pageNumber: 1, signedQueryParams: '?p1=1' }, { pageNumber: 3, signedQueryParams: '?p3=1' }],
        },
    }, { numberOfPages: 4 });
    assert.equal(a.objectKey, OBJECT_KEY);
    assert.equal(a.bgParams, '?png=1');
    assert.equal(a.blurredParams, '?blur=1');
    assert.equal(a.hasTextLayer, true);
    assert.equal(a.pageCount, 4);
    assert.deepEqual(Object.keys(a.pageParams), ['1', '3']);
    assert.equal(SH.isTextGated(a, 1), false);
    assert.equal(SH.isTextGated(a, 2), true);
    assert.equal(SH.isTextGated(a, 3), false);
    assert.equal(SH.isTextGated(a, 4), true);
});

test('parseDocumentAccess: pages: [] means every page is gated, not a scanned document', () => {
    const { SH } = sh();
    const a = SH.parseDocumentAccess({
        objectKey: OBJECT_KEY,
        signedQueryParams: { png: '?png=1', blurredPage: '?blur=1', pages: [] },
    });
    assert.equal(a.hasTextLayer, true);
    assert.equal(SH.isTextGated(a, 1), true);
});

test('parseDocumentAccess: scanned document signed with a single global wildcard', () => {
    const { SH } = sh();
    const a = SH.parseDocumentAccess({
        objectKey: OBJECT_KEY,
        signedQueryParams: { global: '?global=1' },
    });
    assert.equal(a.hasTextLayer, false);
    assert.equal(a.bgParams, '?global=1');
    assert.equal(a.blurredParams, '?global=1');
    assert.equal(SH.isTextGated(a, 1), false, 'scanned pages are never text-gated');
});

test('parseDocumentAccess rejects incomplete input', () => {
    const { SH } = sh();
    assert.equal(SH.parseDocumentAccess(null), null);
    assert.equal(SH.parseDocumentAccess({ objectKey: 'x' }), null);
    assert.equal(SH.parseDocumentAccess({ signedQueryParams: {} }), null);
});

test('URL builders: bg and .page are hex-numbered, blurred previews are decimal', () => {
    const { SH } = sh();
    const a = SH.parseDocumentAccess({
        objectKey: OBJECT_KEY,
        signedQueryParams: {
            png: '?png=1', blurredPage: '?blur=1',
            pages: [{ pageNumber: 18, signedQueryParams: '?p18=1' }],
        },
    });
    assert.equal(SH.bgImageUrl(a, 18), ASSETS + 'bg12.png?png=1');
    assert.equal(SH.bgImageUrl(a, 10), ASSETS + 'bga.png?png=1');
    assert.equal(SH.pageTextUrl(a, 18), ASSETS + OBJECT_KEY + '12.page?p18=1');
    assert.equal(SH.pageTextUrl(a, 17), '', 'no signed entry, no URL');
    assert.equal(SH.blurredPageUrl(a, 18), ASSETS + 'pages/blurred/page18.webp?blur=1');
    assert.equal(SH.bgImageUrl({ objectKey: OBJECT_KEY, bgParams: '' }, 1), '');
});

test('deblurUrl swaps the blurred path for its clear sibling and keeps the param', () => {
    const { SH } = sh();
    assert.equal(SH.deblurUrl(ASSETS + 'pages/blurred/page3.webp?x=1'), ASSETS + 'pages/page3.webp?x=1');
    assert.equal(SH.deblurUrl(ASSETS + 'bg3.png?x=1'), null);
    assert.equal(SH.deblurUrl(''), null);
    assert.equal(SH.deblurUrl(null), null);
});

test('getDocumentAccessData reads and caches #__NEXT_DATA__', () => {
    const { SH, document } = sh(documentFixture({ shape: 'text-with-gaps', freePages: [2] }));
    const a = SH.getDocumentAccessData();
    assert.ok(a);
    assert.equal(a.objectKey, OBJECT_KEY);
    assert.equal(SH.isTextGated(a, 1), true);
    assert.equal(SH.isTextGated(a, 2), false);
    document.querySelector('#__NEXT_DATA__').remove();
    assert.equal(SH.getDocumentAccessData(), a, 'cached after the first read');
});

test('getDocumentAccessData returns null without #__NEXT_DATA__', () => {
    const { SH } = sh(documentFixture({ shape: 'text-with-gaps', nextData: false }));
    assert.equal(SH.getDocumentAccessData(), null);
});

test('loadSettings merges stored booleans over the defaults', async () => {
    const ctx = createWindow(documentFixture({}), { storage: { hideAds: false, replaceLogo: 'nope' } });
    const SH = loadScripts(ctx.window, ['content/common.js']);
    const s = await SH.loadSettings();
    assert.equal(s.hideAds, false);
    assert.equal(s.replaceLogo, true, 'non-boolean stored values are ignored');
    assert.equal(s.showDownloadButton, true);
});

test('loadSettings falls back to defaults when the storage API is missing', async () => {
    const ctx = createWindow(documentFixture({}));
    delete ctx.window.chrome;
    const SH = loadScripts(ctx.window, ['content/common.js']);
    const s = await SH.loadSettings();
    assert.deepEqual(s, SH.DEFAULT_SETTINGS);
});

test('applySettingsToDocument expresses toggles as attributes on <html>', () => {
    const { SH, document } = sh();
    SH.applySettingsToDocument();
    const root = document.documentElement;
    assert.equal(root.getAttribute('data-sh-ads'), 'hide');
    assert.equal(root.getAttribute('data-sh-ai'), 'hide');
    assert.equal(root.getAttribute('data-sh-download'), 'on');
    SH.settings.hideAds = false;
    SH.settings.showDownloadButton = false;
    SH.applySettingsToDocument();
    assert.equal(root.getAttribute('data-sh-ads'), 'show');
    assert.equal(root.getAttribute('data-sh-download'), 'off');
});

test('viewerPages excludes the download overlay clones', () => {
    const { SH, document } = sh(documentFixture({
        pageCount: 3,
        extraBody: '<div id="sh-dl-overlay"><div class="p2hv"><div class="pf"></div><div class="pf"></div></div></div>',
    }));
    assert.equal(document.querySelectorAll('.pf').length, 5);
    assert.equal(SH.viewerPages().length, 3);
});

test('notify shows an in-page notice instead of alert()', () => {
    const { SH, document } = sh();
    SH.notify('hello', 10);
    const el = document.getElementById('sh-notice');
    assert.ok(el);
    assert.equal(el.textContent, 'hello');
    assert.ok(el.classList.contains('sh-notice-visible'));
});
