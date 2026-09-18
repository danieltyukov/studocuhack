import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindow, loadModules, tick } from './helpers/dom.mjs';
import { documentFixture, blurredUrl, ASSETS } from './fixtures/documents.mjs';

function setup(fixtureOpts, windowOpts) {
    const ctx = createWindow(documentFixture(fixtureOpts), windowOpts);
    const SH = loadModules(ctx.window);
    const pfs = () => Array.from(ctx.document.querySelectorAll('#viewer-wrapper .pf'));
    return { ...ctx, SH, pfs };
}

const note = (pf) => pf.querySelector('[data-sh-gated-note]');

test('text document with gaps: gated pages are labelled, free pages are repaired', () => {
    const { SH, pfs, logs } = setup({
        shape: 'text-with-gaps',
        pageCount: 6,
        freePages: [1, 2, 3],
        states: { 1: 'text', 2: 'empty', 3: 'blurred', 4: 'blurred', 5: 'empty', 6: 'text' },
    });
    SH.pages.ensureAllPagesLoaded();
    const p = pfs();

    // Free pages: never labelled.
    [0, 1, 2].forEach((i) => assert.equal(note(p[i]), null, 'page ' + (i + 1) + ' must not be labelled'));
    // Page 2 is an empty placeholder with a signed text layer: the fetch is attempted.
    assert.equal(p[1].dataset.shTextTried, '1');
    // Page 3 shows a blurred raster: the clear sibling is tried first.
    assert.equal(p[2].dataset.shUnblurred, undefined, 'unblur flag lives on the img');
    assert.equal(p[2].querySelector('img').dataset.shUnblurred, '1');

    // Gated pages: labelled, keep (or get) the blurred preview, no text fetch.
    [3, 4, 5].forEach((i) => {
        const n = i + 1;
        const el = note(p[i]);
        assert.ok(el, 'page ' + n + ' must carry the premium-locked label');
        assert.equal(el.getAttribute('data-sh-gated-note'), String(n));
        assert.match(el.textContent, new RegExp('Page ' + n + ' is premium-locked'));
        assert.equal(p[i].dataset.shTextTried, undefined, 'no text fetch for a gated page');
        const img = p[i].querySelector('img');
        assert.ok(img, 'gated page keeps an image');
        assert.equal(img.getAttribute('src'), blurredUrl(n));
    });
    // Page 6 was rendered as text although it is gated in the access model:
    // the label is still applied (the model, not the DOM, decides).
    assert.ok(note(p[5]));

    // The console report names exactly the gated pages, once.
    const report = logs.filter((l) => l.includes('premium-locked'));
    assert.equal(report.length, 1);
    assert.match(report[0], /3 of 6 pages fully recovered\. Pages 4, 5, 6 are premium-locked/);
    SH.pages.ensureAllPagesLoaded();
    assert.equal(logs.filter((l) => l.includes('premium-locked')).length, 1, 'reported once');
});

test('gated page is never overwritten with the figure-only bg image', () => {
    const { SH, pfs } = setup({
        shape: 'text-with-gaps', pageCount: 2, freePages: [1],
        states: { 1: 'empty', 2: 'empty' },
    });
    SH.pages.ensureAllPagesLoaded();
    const [free, gated] = pfs();
    assert.equal(free.dataset.shInjecting, '1', 'free empty page: bg injection started');
    assert.equal(gated.dataset.shInjecting, undefined, 'gated page: no bg injection');
    const img = gated.querySelector('img');
    assert.ok(img.getAttribute('src').includes('/pages/blurred/'));
    assert.ok(!img.getAttribute('src').includes('/bg'));
});

test('marking a gated page is idempotent', () => {
    const { SH, pfs } = setup({ shape: 'all-gated', pageCount: 1, states: { 1: 'blurred' } });
    SH.pages.ensureAllPagesLoaded();
    SH.pages.ensureAllPagesLoaded();
    SH.pages.ensureAllPagesLoaded();
    const pf = pfs()[0];
    assert.equal(pf.querySelectorAll('[data-sh-gated-note]').length, 1);
    assert.equal(pf.querySelectorAll('img').length, 1);
});

test('pages: [] (every page gated) labels every page instead of blanking the document', () => {
    const { SH, pfs } = setup({ shape: 'all-gated', pageCount: 4, states: { 1: 'blurred', 2: 'empty', 3: 'empty', 4: 'blurred' } });
    SH.pages.ensureAllPagesLoaded();
    pfs().forEach((pf, i) => {
        assert.ok(note(pf), 'page ' + (i + 1) + ' labelled');
        assert.equal(pf.dataset.shInjecting, undefined);
    });
});

test('all-free document: nothing is labelled', () => {
    const { SH, pfs, logs } = setup({ shape: 'all-free', pageCount: 4, states: { 1: 'text', 2: 'empty', 3: 'blurred', 4: 'empty' } });
    SH.pages.ensureAllPagesLoaded();
    pfs().forEach((pf) => assert.equal(note(pf), null));
    assert.equal(logs.filter((l) => l.includes('premium-locked')).length, 0);
});

test('scanned document: no labels, blank pages get the bg image injected', () => {
    const { SH, pfs } = setup({ shape: 'scanned', pageCount: 3, states: { 1: 'empty', 2: 'empty', 3: 'empty' } });
    SH.pages.ensureAllPagesLoaded();
    pfs().forEach((pf) => {
        assert.equal(note(pf), null);
        assert.equal(pf.dataset.shInjecting, '1');
        assert.equal(pf.dataset.shTextTried, undefined, 'scanned docs have no text layer to fetch');
    });
});

test('gating still works after patchNextData cleared hasBlurredPages (2.10.0 regression)', () => {
    const { SH, pfs, document } = setup({
        shape: 'text-with-gaps', pageCount: 2, freePages: [1], states: { 1: 'empty', 2: 'empty' },
    });
    SH.pages.patchNextData();
    const patched = JSON.parse(document.querySelector('#__NEXT_DATA__').textContent);
    assert.equal(patched.props.pageProps.documentAccess.hasBlurredPages, false, 'flag was cleared in the DOM');
    SH.pages.ensureAllPagesLoaded();
    assert.equal(note(pfs()[0]), null);
    assert.ok(note(pfs()[1]), 'page 2 still detected as gated');
    assert.equal(SH.getDocumentAccessData().hasBlurredPages, true, 'cached model is the pristine one');
});

test('the download overlay clones do not shift the page numbering', () => {
    const { SH, pfs, document } = setup({
        shape: 'text-with-gaps', pageCount: 2, freePages: [1], states: { 1: 'empty', 2: 'empty' },
        extraBody: '<div id="sh-dl-overlay"><div class="p2hv"><div class="pf"></div><div class="pf"></div><div class="pf"></div></div></div>',
    });
    SH.pages.ensureAllPagesLoaded();
    assert.equal(note(pfs()[0]), null);
    assert.ok(note(pfs()[1]));
    assert.equal(document.querySelectorAll('#sh-dl-overlay [data-sh-gated-note]').length, 0);
});

test('injectPageText points the fragment\'s relative figure image at the signed CDN URL', async () => {
    // Real fragments look like this: the bg reference is relative and hex.
    const fragment = '<div class="pc pc10 w0 h0"><img class="bi x0 y0 w1 h1" alt="" src="bga.png"/>' +
        '<span>a</span><span>b</span><span>c</span><span>d</span></div>';
    const { SH, pfs } = setup(
        { shape: 'all-free', pageCount: 10, states: { 10: 'empty' } },
        { fetch: (url) => Promise.resolve({ ok: url.endsWith('10.page?p10=1'), text: () => Promise.resolve(fragment) }) },
    );
    SH.pages.ensureAllPagesLoaded();
    await tick(10);
    const img = pfs()[9].querySelector('img.bi');
    assert.ok(img);
    assert.equal(img.getAttribute('src'), ASSETS + 'bga.png?png=1', 'relative bga.png rewritten to the signed URL');
    assert.equal(pfs()[9].querySelectorAll('span').length, 4);
});

test('injectPageText renders a sanitised .page fragment into an empty page', async () => {
    const fragment =
        '<div class="pc"><span>a</span><span>b</span><span>c</span><span>d</span>' +
        '<script>window.pwned = 1</script><iframe src="https://evil.example"></iframe>' +
        '<img src="javascript:alert(1)" onerror="window.pwned = 2"><a href=" javascript:void(0)">x</a></div>';
    const fetched = [];
    const { SH, pfs, window } = setup(
        { shape: 'all-free', pageCount: 1, states: { 1: 'empty' } },
        {
            fetch(url) {
                fetched.push(url);
                return Promise.resolve({ ok: true, text: () => Promise.resolve(fragment) });
            },
        },
    );
    SH.pages.ensureAllPagesLoaded();
    assert.deepEqual(fetched, [ASSETS + 'abc123def4561.page?p1=1']);
    await tick(10);
    const pf = pfs()[0];
    assert.equal(pf.querySelectorAll('span').length, 4);
    assert.equal(pf.querySelector('script'), null);
    assert.equal(pf.querySelector('iframe'), null);
    assert.equal(pf.querySelector('img').getAttribute('src'), null);
    assert.equal(pf.querySelector('img').getAttribute('onerror'), null);
    assert.equal(pf.querySelector('a').getAttribute('href'), null);
    assert.equal(window.pwned, undefined);
    assert.ok(pf.classList.contains('nofilter'));
});

test('injectPageText leaves a page alone when the fetch fails, and does not retry', async () => {
    let calls = 0;
    const { SH, pfs } = setup(
        { shape: 'all-free', pageCount: 1, states: { 1: 'empty' } },
        { fetch() { calls++; return Promise.resolve({ ok: false }); } },
    );
    SH.pages.ensureAllPagesLoaded();
    SH.pages.ensureAllPagesLoaded();
    await tick(10);
    assert.equal(calls, 1);
    assert.equal(pfs()[0].querySelectorAll('span').length, 0);
});

test('removeBlur strips blur classes and inline filters from pages', () => {
    const { SH, document } = setup({ shape: 'all-free', pageCount: 1, states: { 1: 'text' } });
    const pf = document.querySelector('.pf');
    pf.classList.add('Viewer_blurred__x1');
    pf.style.filter = 'blur(6px)';
    const content = document.createElement('div');
    content.className = 'page-content BlurredPage_abc';
    content.style.filter = 'blur(6px)';
    pf.appendChild(content);
    const banner = document.createElement('div');
    banner.className = 'PremiumPageClarificationBanner_x';
    pf.appendChild(banner);

    SH.pages.removeBlur();

    assert.equal(pf.style.filter, 'none');
    assert.ok(!pf.className.includes('blurred'));
    assert.ok(pf.classList.contains('nofilter'));
    assert.equal(content.style.filter, 'none');
    assert.ok(!content.className.includes('Blurred'));
    assert.equal(document.querySelector('[class*="PremiumPageClarificationBanner"]'), null, 'sibling banner removed');
});

test('unblurImages rewrites blurred src, data-src and srcset', () => {
    const { SH, document } = setup({ shape: 'all-free', pageCount: 1, states: { 1: 'blurred' } });
    const img = document.querySelector('.pf img');
    img.setAttribute('data-src', blurredUrl(1));
    img.setAttribute('srcset', blurredUrl(1) + ' 1x, ' + blurredUrl(1) + ' 2x');
    SH.pages.unblurImages();
    assert.equal(img.dataset.shUnblurred, '1');
    assert.equal(img.getAttribute('src'), ASSETS + 'pages/page1.webp?blur=1', 'clear sibling tried first');
    assert.equal(img.getAttribute('data-src'), ASSETS + 'pages/page1.webp?blur=1');
    // srcset is dropped outright when src was blurred (the candidate probe
    // owns src from here on); it is only rewritten when src was already clear.
    assert.equal(img.getAttribute('srcset'), null);
});

test('unblurImages rewrites a blurred srcset on an otherwise clear image', () => {
    const { SH, document } = setup({ shape: 'all-free', pageCount: 1, states: { 1: 'text' } });
    const img = document.querySelector('.pf img');
    img.setAttribute('srcset', blurredUrl(1) + ' 1x');
    SH.pages.unblurImages();
    assert.equal(img.getAttribute('srcset'), ASSETS + 'pages/page1.webp?blur=1 1x');
    assert.equal(img.dataset.shUnblurred, '1');
});

test('primeAllPages respects the autoLoadPages setting and runs once', async () => {
    const { SH, document } = setup({ shape: 'text-with-gaps', pageCount: 3, states: { 1: 'empty', 2: 'empty', 3: 'empty' } });
    let scrolled = 0;
    document.querySelectorAll('.pf').forEach((pf) => { pf.scrollIntoView = () => { scrolled++; }; });

    SH.settings.autoLoadPages = false;
    SH.pages.primeAllPages();
    await tick(50);
    assert.equal(scrolled, 0, 'disabled: no scrolling');

    SH.settings.autoLoadPages = true;
    SH.pages.primeAllPages();
    SH.pages.primeAllPages();
    await tick(140 * 4 + 50);
    assert.equal(scrolled, 3, 'each page scrolled into view exactly once');
});

test('sanitizePageHtml keeps positioned text and drops active content', () => {
    const { SH } = setup({ shape: 'all-free', pageCount: 1 });
    const out = SH.pages.sanitizePageHtml('<div class="pc"><span style="left:1px">t</span><style>body{}</style><object data="x"></object><embed src="y"><link rel="stylesheet" href="z"></div>').innerHTML;
    assert.ok(out.includes('<span style="left:1px">t</span>'));
    for (const tag of ['<style', '<object', '<embed', '<link']) assert.ok(!out.includes(tag), tag + ' removed');
});
