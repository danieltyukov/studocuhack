// Fixture generator: a minimal Studocu document page.
//
// Reproduces the four document shapes the extension has to tell apart (see
// docs/ARCHITECTURE.md):
//   text-with-gaps  native PDF, some pages premium-locked
//   all-free        native PDF, every page readable
//   all-gated       native PDF, every page premium-locked (pages: [])
//   scanned         image document, signed with a single `global` wildcard
//
// Each page can start in one of the states the live viewer leaves it in:
//   'text'      rendered text layer (many spans)
//   'blurred'   an <img> pointing at Studocu's blurred preview
//   'empty'     an unmounted placeholder (nothing inside)

export const OBJECT_KEY = 'abc123def456';
export const ASSETS = 'https://doc-assets.studocu.com/' + OBJECT_KEY + '/html/';

export function blurredUrl(n) {
    return ASSETS + 'pages/blurred/page' + n + '.webp?blur=1';
}

function signedParams(shape, pageCount, freePages) {
    if (shape === 'scanned') {
        return { global: '?global=1' };
    }
    const pages = [];
    if (shape !== 'all-gated') {
        const free = shape === 'all-free'
            ? Array.from({ length: pageCount }, (_, i) => i + 1)
            : freePages;
        free.forEach((n) => pages.push({ pageNumber: n, signedQueryParams: '?p' + n + '=1' }));
    }
    return { html: '?html=1', css: '?css=1', png: '?png=1', blurredPage: '?blur=1', pages };
}

function pageHtml(n, state) {
    let inner = '';
    if (state === 'text') {
        // Real text pages are many KB; the download code treats anything under
        // ~500 chars as an unrendered placeholder, so give it a realistic size.
        const spans = Array.from({ length: 40 }, (_, i) => '<span class="t m0 ff1">word' + i + '</span>').join('');
        inner = '<div class="pc"><img class="bi" src="' + ASSETS + 'bg' + n.toString(16) + '.png?png=1"/>' + spans + '</div>';
    } else if (state === 'blurred') {
        inner = '<div class="pc"><img class="bi" src="' + blurredUrl(n) + '"/></div>';
    }
    return '<div class="pf w0 h0" data-page-no="' + n + '">' + inner + '</div>';
}

/**
 * @param {object} o
 * @param {'text-with-gaps'|'all-free'|'all-gated'|'scanned'} o.shape
 * @param {number} [o.pageCount]
 * @param {number[]} [o.freePages]   for text-with-gaps: pages that ship a text layer
 * @param {Record<number,'text'|'blurred'|'empty'>} [o.states]   initial DOM state per page
 * @param {boolean} [o.nextData]     include #__NEXT_DATA__ (default true)
 * @param {string} [o.extraBody]     extra markup appended to <body>
 */
export function documentFixture(o) {
    const pageCount = o.pageCount || 6;
    const freePages = o.freePages || [1, 2, 3];
    const shape = o.shape || 'text-with-gaps';
    const states = o.states || {};
    const nextData = {
        props: {
            pageProps: {
                document: { numberOfPages: pageCount, title: 'Fixture document' },
                documentAccess: {
                    objectKey: OBJECT_KEY,
                    hasBlurredPages: shape !== 'scanned' && shape !== 'all-free',
                    preview: shape !== 'scanned',
                    signedQueryParams: signedParams(shape, pageCount, freePages),
                },
            },
        },
    };
    const pages = [];
    for (let n = 1; n <= pageCount; n++) {
        pages.push(pageHtml(n, states[n] || 'empty'));
    }
    return '<!doctype html><html><head><title>Fixture document - Studocu</title>' +
        (o.nextData === false ? '' : '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify(nextData) + '</script>') +
        '</head><body>' +
        '<header><a aria-label="Studocu Logo" href="/">Studocu</a></header>' +
        '<h1>Fixture document</h1>' +
        '<div id="viewer-wrapper"><div class="p2hv Viewer_page-container__abc">' + pages.join('') + '</div></div>' +
        (o.extraBody || '') +
        '</body></html>';
}
