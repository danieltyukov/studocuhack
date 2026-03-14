// ============================================================
// StudocuHack - Document Download
// Combines CDN images (hex URLs) + DOM text overlays
// ============================================================

(function() {
    'use strict';

    function generatePDF() {
        var docTitle = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : document.title;

        // Get total pages and URL pattern
        var totalPages = document.querySelectorAll('.pf').length || document.querySelectorAll('div[data-page-index]').length;
        var basePrefix = '', baseSuffix = '';

        // Extract URL pattern from first loaded image
        var allImgs = document.querySelectorAll('.pf img, div[data-page-index] img');
        for (var i = 0; i < allImgs.length; i++) {
            if (allImgs[i].src && allImgs[i].src.includes('/bg')) {
                var m = allImgs[i].src.match(/(.*?\/bg)[0-9a-f]+(\.png\?.*)/i);
                if (m) { basePrefix = m[1]; baseSuffix = m[2]; break; }
            }
        }
        if (!basePrefix) {
            try {
                var nd = JSON.parse(document.querySelector('#__NEXT_DATA__').textContent);
                var da = nd.props.pageProps.documentAccess;
                if (da && da.objectKey && da.signedQueryParams && da.signedQueryParams.png) {
                    basePrefix = 'https://doc-assets.studocu.com/' + da.objectKey + '/html/bg';
                    baseSuffix = '.png' + da.signedQueryParams.png;
                }
                if (!totalPages) totalPages = nd.props.pageProps.document.numberOfPages || 0;
            } catch(e) {}
        }

        if (!basePrefix || !totalPages) {
            alert('StudocuHack: Could not find page data. Try refreshing.');
            return;
        }

        // Collect all stylesheets for text overlay positioning
        var styles = '';
        document.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
            styles += '<link rel="stylesheet" href="' + link.href + '">';
        });

        // For each page, extract the text overlay HTML (if any)
        var pfs = document.querySelectorAll('.pf');
        var pageOverlays = [];
        for (var p = 0; p < totalPages; p++) {
            var pf = pfs[p];
            if (pf) {
                // Get the text div (usually the first child div that's not the image container)
                var textDiv = pf.querySelector('[class^="pc"] > div, .page-content > div');
                var spans = pf.querySelectorAll('span');
                if (spans.length > 3 && textDiv) {
                    // Clone the text overlay
                    pageOverlays.push(textDiv.outerHTML);
                } else {
                    pageOverlays.push('');
                }
            } else {
                pageOverlays.push('');
            }
        }

        // Build HTML with image + text overlay for each page
        var html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
        html += '<title>' + docTitle + '</title>';
        html += styles;
        html += '<style>';
        html += '* { margin: 0; padding: 0; box-sizing: border-box; }';
        html += 'body { background: #525659; }';
        html += '.sh-header { position: sticky; top: 0; background: #1a1a2e; color: white; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; z-index: 9999; font-family: Arial, sans-serif; }';
        html += '.sh-header h1 { font-size: 14px; font-weight: 600; margin: 0; }';
        html += '.sh-header span { font-size: 13px; opacity: 0.8; }';
        html += '.sh-header button { background: #4D8BF5; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }';
        html += '.sh-page { position: relative; background: white; margin: 10px auto; max-width: 900px; overflow: hidden; }';
        html += '.sh-page img { display: block; width: 100%; height: auto; }';
        html += '.sh-page .text-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }';
        html += '.sh-pn { position: absolute; top: 8px; right: 8px; background: #4D8BF5; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-family: Arial; z-index: 10; }';
        html += '#sh-loading { position: fixed; bottom: 20px; right: 20px; background: #4D8BF5; color: white; padding: 10px 16px; border-radius: 8px; font-family: Arial; font-size: 13px; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }';
        html += '.nofilter, .page-content, .pf { filter: none !important; opacity: 1 !important; visibility: visible !important; }';
        html += '[class*="blurred"] { filter: none !important; opacity: 1 !important; }';
        html += '[class*="Banner"], [class*="Premium"], [class*="banner"] { display: none !important; }';
        html += '@media print { body { background: white; } .sh-header, #sh-loading, .sh-pn { display: none; } .sh-page { margin: 0; max-width: none; page-break-inside: avoid; page-break-after: always; } .sh-page:last-child { page-break-after: auto; } @page { margin: 0; } }';
        html += '</style></head><body>';
        html += '<div class="sh-header"><h1>' + docTitle + '</h1><span>' + totalPages + ' pages</span><button onclick="window.print()">Print / Save PDF</button></div>';
        html += '<div id="sh-loading">Loading: <span id="sh-p">0</span>/' + totalPages + '</div>';

        for (var j = 0; j < totalPages; j++) {
            var hex = (j + 1).toString(16);
            var imgUrl = basePrefix + hex + baseSuffix;
            var overlay = pageOverlays[j] || '';

            html += '<div class="sh-page">';
            html += '<img src="' + imgUrl + '" alt="Page ' + (j+1) + '" ';
            html += 'onload="window._c=(window._c||0)+1;document.getElementById(\'sh-p\').textContent=window._c;if(window._c>=' + totalPages + ')document.getElementById(\'sh-loading\').textContent=\'All ' + totalPages + ' pages loaded!\';" ';
            html += 'onerror="window._c=(window._c||0)+1;document.getElementById(\'sh-p\').textContent=window._c;">';
            if (overlay) {
                html += '<div class="text-overlay">' + overlay + '</div>';
            }
            html += '<div class="sh-pn">' + (j+1) + '</div>';
            html += '</div>';
        }

        html += '</body></html>';

        // Open as blob URL on studocu.com origin
        var blob = new Blob([html], { type: 'text/html' });
        var blobUrl = URL.createObjectURL(blob);
        var w = window.open(blobUrl, '_blank');
        if (!w) {
            URL.revokeObjectURL(blobUrl);
            alert('StudocuHack: Popup blocked! Allow popups for studocu.com.');
        }
    }

    // Button + event delegation
    function createButton() {
        var btn = document.createElement('button');
        btn.classList.add('download-button-1');
        btn.setAttribute('data-studocuhack', 'download');
        btn.innerHTML = '<svg aria-hidden="true" focusable="false" class="svg-inline--fa" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M432 288h-80v-192h-64v192h-80l112 128 112-128zM0 400v48c0 35.346 28.654 64 64 64h512c35.346 0 64-28.654 64-64v-48h-640z"></path></svg><span class="download-text">Download</span>';
        return btn;
    }

    function refreshButtons() {
        document.querySelectorAll('[data-test-selector="document-viewer-download-button-topbar"]').forEach(function(el) {
            if (!el.querySelector('.download-button-1')) el.remove();
        });
        var c = document.querySelector('#viewer-wrapper');
        if (c && !c.querySelector('.download-button-1')) c.prepend(createButton());
        var d = document.querySelector('#modal-overlay');
        if (d) d.style.display = 'none';
    }

    // Capture-phase delegation - fires before React
    document.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-studocuhack="download"]');
        if (btn) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); generatePDF(); }
    }, true);
    document.addEventListener('mousedown', function(e) {
        if (e.target.closest('[data-studocuhack="download"]')) e.stopPropagation();
    }, true);

    var obs = new MutationObserver(refreshButtons);
    function init() {
        var el = document.querySelector('#viewer-wrapper');
        if (el) obs.observe(el, { childList: true, subtree: true });
        refreshButtons();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.addEventListener('load', init);
})();
