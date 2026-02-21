function generatePDF() {
    // Force all pages visible and unblurred
    document.querySelectorAll('.page-content').forEach(page => {
        page.style.display = 'block';
        page.style.filter = 'none';
        page.style.userSelect = 'auto';
        page.classList.add('nofilter');
        Array.from(page.classList).forEach(cls => {
            if (cls.includes('blurred')) page.classList.remove(cls);
        });
    });

    var docTitle = document.querySelector('h1') ? document.querySelector('h1').textContent : document.title;

    // Get the p2hv wrapper which contains all pdf2htmlEX content
    var wrapper = document.querySelector('#page-container-wrapper');
    if (!wrapper) wrapper = document.querySelector('#page-container').parentElement;
    if (!wrapper) return;

    // Determine page orientation from first page
    var firstPf = wrapper.querySelector('.pf');
    var pageWidth = firstPf ? firstPf.offsetWidth : 595;
    var pageHeight = firstPf ? firstPf.offsetHeight : 842;
    var printSettings = pageWidth > pageHeight
        ? '@page {size: A5 landscape;} body {zoom: 90%;}'
        : '@page {size: A5 portrait;}';

    // Clone the wrapper to avoid modifying the original page
    var clone = wrapper.cloneNode(true);

    // Remove banners and premium elements from clone
    clone.querySelectorAll('.banner-wrapper, [class*="InlineBanner"], [class*="PremiumBanner"], [class*="PremiumPageClarification"]').forEach(function(el) { el.remove(); });

    // Force all pages visible in clone
    clone.querySelectorAll('.page-content').forEach(function(page) {
        page.style.display = 'block';
        page.style.filter = 'none';
        page.style.userSelect = 'auto';
        page.classList.add('nofilter');
        Array.from(page.classList).forEach(function(cls) {
            if (cls.includes('blurred')) page.classList.remove(cls);
        });
    });

    // Open popup window
    var pdfWindow = window.open('', 'Document', 'height=865,width=625,status=yes,toolbar=no,menubar=no');
    if (!pdfWindow) return;

    // Copy all stylesheets from the page head
    var headContent = document.querySelector('head').innerHTML;

    // Set up the popup document
    pdfWindow.document.querySelector('head').innerHTML = headContent +
        '<style>.nofilter, .page-content { filter: none !important; display: block !important; user-select: auto !important; }' +
        ' [class*="banner"], [class*="Banner"], [class*="Premium"], [class*="InlineBanner"], [class*="PremiumPageClarification"] { display: none !important; }' +
        ' @media print { ' + printSettings + ' }</style>';
    pdfWindow.document.title = docTitle;

    // Clear body and insert cloned content
    pdfWindow.document.body.innerHTML = '';
    pdfWindow.document.body.style.margin = '0';
    pdfWindow.document.body.style.padding = '0';
    pdfWindow.document.body.appendChild(clone);
}

function createDownloadButton() {
    var downloadBtn = document.createElement('button');
    downloadBtn.classList.add('download-button-1');
    downloadBtn.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" class="svg-inline--fa" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M432 288h-80v-192h-64v192h-80l112 128 112-128zM0 400v48c0 35.346 28.654 64 64 64h512c35.346 0 64-28.654 64-64v-48h-640z"></path></svg><span class="download-text">Download</span>';
    downloadBtn.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        generatePDF();
    });
    return downloadBtn;
}

function refreshButtons() {
    var originalButtons = document.querySelectorAll('[data-test-selector="document-viewer-download-button-topbar"]');

    originalButtons.forEach(function(button) {
        if (!button.querySelector('.download-button-1')) {
            button.remove();
        }
    });

    var container = document.querySelector('#viewer-wrapper');
    if (container && !container.querySelector('.download-button-1')) {
        var newButton = createDownloadButton();
        container.prepend(newButton);
    }

    var dialog = document.querySelector('#modal-overlay');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

var mutationObserver = new MutationObserver(function() {
    refreshButtons();
});

window.addEventListener('load', function() {
    var monitorElement = document.querySelector('#viewer-wrapper');
    if (monitorElement) {
        mutationObserver.observe(monitorElement, { attributes: true, childList: true, subtree: true });
    }
    refreshButtons();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        var monitorElement = document.querySelector('#viewer-wrapper');
        if (monitorElement) {
            mutationObserver.observe(monitorElement, { attributes: true, childList: true, subtree: true });
        }
        refreshButtons();
    });
} else {
    refreshButtons();
}
