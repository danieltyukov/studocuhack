function generatePDF() {
    const docHead = document.querySelector("head").innerHTML;
    const docTitle = document.querySelector("h1").innerHTML;
    const pageNodes = document.querySelector('#page-container').childNodes;
    let pageWidth = pageNodes[0].offsetWidth;
    let pageHeight = pageNodes[0].offsetHeight;
    let printSettings;

    if (pageWidth > pageHeight) {
        printSettings = "{@page {size: A5 landscape;} body {zoom: 90%;}";
    } else {
        printSettings = "{@page {size: A5 portrait;}";
    }

    Array.from(pageNodes).forEach(node => {
        node.childNodes[0].style = "display: block;";
    });

    const pdfContent = pageNodes[0].parentNode.parentNode.parentNode.innerHTML;

    let pdfWindow = window.open("", "Document", "height=865,width=625,status=yes,toolbar=no,menubar=no");  
    pdfWindow.document.querySelector("head").innerHTML = `${docHead} <style>.nofilter{filter: none !important;}</style><style>@media print ${printSettings}</style>`;
    pdfWindow.document.title = docTitle;
    pdfWindow.document.querySelector("body").innerHTML = pdfContent;
    const PdfNodes = parseNodes(pdfWindow.document.body.firstChild.firstChild.childNodes)
    pdfWindow.document.querySelector("body").firstChild.firstChild.innerHTML = ''
    PdfNodes.forEach(child => pdfWindow.document.querySelector("body").firstChild.firstChild.appendChild(child))
    pdfWindow.document.querySelector("body").childNodes[0].style = "";
}

function createDownloadButton() {
    let downloadBtn = document.createElement("button");
    downloadBtn.classList.add("download-button-1");
    downloadBtn.style.borderRadius = '20px'
    downloadBtn.style.margin = 'auto';
    downloadBtn.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="cloud-arrow-down" class="svg-inline--fa fa-cloud-arrow-down fa-fw _db78be352894 _6d88284663af" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-167l80 80c9.4 9.4 24.6 9.4 33.9 0l80-80c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-39 39V184c0-13.3-10.7-24-24-24s-24 10.7-24 24V318.1l-39-39c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9z"></path></svg><span class="download-text">Download</span>';
    downloadBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        generatePDF();
    });
    return downloadBtn;
}

function refreshButtons() {
    let originalButtons = document.querySelectorAll('[data-test-selector="document-viewer-download-button-topbar"]');
    
    originalButtons.forEach(button => {
        if (!button.querySelector('.download-button-1')) {
            button.remove();
        }
    });

    let container = document.querySelector("#viewer-wrapper");
    if (container && !container.querySelector('.download-button-1')) {
        let newButton = createDownloadButton();
        container.prepend(newButton);
    }

    const dialog = document.querySelector('#modal-overlay');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

const mutationObserver = new MutationObserver(() => {
    refreshButtons();
});

window.addEventListener('load', () => {
    let monitorElement = document.querySelector("#viewer-wrapper");
    if (monitorElement) {
        mutationObserver.observe(monitorElement, { attributes: true, childList: true, subtree: true });
    }
    refreshButtons();
});


function parseNodes(nodes) {
    const blueprint = String(nodes[1].innerHTML);
    nodes = Array.from(nodes).filter(
      (node) => !node.classList.contains("banner-wrapper")
    );
  
    nodes.forEach((node) => {
      if (node?.firstChild?.firstChild?.classList.contains('blurred-container')) {
        console.log(node);
        const page = node.dataset.pageNo;
        node.innerHTML = blueprint.replace("bg2.png", `bg${page}.png`);
      }
    });

    return nodes;
  }