function generatePDF() {
    const docHead = document.querySelector("head").innerHTML;
    const docTitle = document.querySelector("h1").innerHTML;
    const pageNodes = document.querySelector('#page-container').childNodes;
    let pageWidth = pageNodes[0].offsetWidth;
    let pageHeight = pageNodes[0].offsetHeight;
    let printSettings;

    if (pageWidth > pageHeight){
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
    pdfWindow.document.querySelector("body").childNodes[0].style = "";
}

function createDownloadButton() {
    let downloadBtn = document.createElement("button");
    downloadBtn.classList.add("download-button-1");
    downloadBtn.innerHTML = '<svg aria-hidden="true" focusable="false" data-prefix="fas" class="svg-inline--fa" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M537.6 226.6c4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32c-88.4 0-160 71.6-160 160 0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4zm-132.9 88.7L299.3 420.7c-6.2 6.2-16.4 6.2-22.6 0L171.3 315.3c-10.1-10.1-2.9-27.3 11.3-27.3H248V176c0-8.8 7.2-16 16-16h48c8.8 0 16 7.2 16 16v112h65.4c14.2 0 21.4 17.2 11.3 27.3z"></path></svg><span class="download-text">Download</span>';
    downloadBtn.addEventListener('click', generatePDF);
    return downloadBtn;
}

function refreshButtons(){
    let oldButtons = document.querySelectorAll(".fa-cloud-arrow-down");
    oldButtons.forEach(oldButton => {
        if(!oldButton.parentNode.parentNode.firstChild.classList.contains("download-button-1")){
            let newButton = createDownloadButton();
            oldButton.parentNode.parentNode.prepend(newButton);
        }
        oldButton.parentNode.remove();
    });
}

const mutationObserver = new MutationObserver(refreshButtons);

let oldButtons = document.querySelectorAll(".fa-cloud-arrow-down");
if(oldButtons.length > 0) {
    try{
        refreshButtons();
    }catch(err){
        console.log(err);
    }finally{
        let monitorElement = document.querySelector("#viewer-wrapper");
        mutationObserver.observe(monitorElement, { attributes: true, childList: true, subtree: true});
    }
}