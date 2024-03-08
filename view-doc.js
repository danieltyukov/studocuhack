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
    downloadBtn.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" class="svg-inline--fa" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M432 288h-80v-192h-64v192h-80l112 128 112-128zM0 400v48c0 35.346 28.654 64 64 64h512c35.346 0 64-28.654 64-64v-48h-640z"></path></svg><span class="download-text">Download</span>';
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