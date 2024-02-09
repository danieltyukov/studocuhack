// Remove banner
let bannerElement = document.querySelector('#document-wrapper');
if(bannerElement){
    let banners = Array.from(bannerElement.childNodes);
    if (banners.length > 3){
        banners[0].remove();
    }
}

var banner_wrapper = document.querySelectorAll("_8690b6fc16a3,.banner-wrapper,_4d5ecd011027");
if (banner_wrapper != null) {
    for (i = 0; i < banner_wrapper.length; i++) {
        banner_wrapper[i].style.display = "none";
    }
}

// Remove premium button
let premiumButton = document.querySelector('#header-position-handle')?.childNodes[0]?.childNodes[1]?.childNodes[0]?.childNodes[1];
if(premiumButton){
    premiumButton.remove();
}

// Handle mobile interface
if (window.innerWidth <= 990){
    let container = document.querySelector('#page-container');
    if(container){
        let pages = Array.from(container.childNodes);
        pages.forEach(page => {
            if(page.id === ''){
                page.remove();
            }
        });
    }
}

// Remove recommendations
try {
    let recommendations = document.querySelector('#viewer-recommendations');
    if(recommendations){
        recommendations.parentNode.remove();
    }
} catch(err){
    console.log(err);
}

// Remove blur
let pageElements = document.querySelectorAll('.page-content');
pageElements.forEach(pageElement => {
    let pageContent = Array.from(pageElement.parentNode.childNodes);
    pageContent.forEach(contentElement => {
        if (contentElement.className !== "page-content") {
            contentElement.remove();
        }
    });
    pageElement.classList.add("nofilter");
});

// Update logo
let logos = document.querySelectorAll('[aria-label="StudeerSnel Logo"]' || '[aria-label="StuDocu Logo"]');
logos.forEach(logo => {
    let newLogo = document.createElement('img');
    newLogo.src = "https://github.com/danieltyukov/studocuhack/assets/60662998/841574e5-d6cf-4ea9-975a-bcda51bf9240";
    newLogo.width = '90';
    newLogo.height = '60';

    // Replace the old logo with the new logo in the parent container
    let parentContainer = logo.parentElement;
    parentContainer.replaceChild(newLogo, logo);
});

// Check Version
const browser = window.msBrowser || window.browser || window.chrome;

let version = browser.runtime.getManifest().version;

let checkVersionButton = document.createElement("button");
checkVersionButton.classList.add("github-button", "tooltip-bottom");

checkVersionButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60" aria-labelledby="title" aria-describedby="desc" role="img" class="svg-inline--fa" xmlns:xlink="http://www.w3.org/1999/xlink"><path data-name="layer" d="M32 0a32.021 32.021 0 0 0-10.1 62.4c1.6.3 2.2-.7 2.2-1.5v-6c-8.9 1.9-10.8-3.8-10.8-3.8-1.5-3.7-3.6-4.7-3.6-4.7-2.9-2 .2-1.9 .2-1.9 3.2.2 4.9 3.3 4.9 3.3 2.9 4.9 7.5 3.5 9.3 2.7a6.93 6.93 0 0 1 2-4.3c-7.1-.8-14.6-3.6-14.6-15.8a12.27 12.27 0 0 1 3.3-8.6 11.965 11.965 0 0 1 .3-8.5s2.7-.9 8.8 3.3a30.873 30.873 0 0 1 8-1.1 30.292 30.292 0 0 1 8 1.1c6.1-4.1 8.8-3.3 8.8-3.3a11.965 11.965 0 0 1 .3 8.5 12.1 12.1 0 0 1 3.3 8.6c0 12.3-7.5 15-14.6 15.8a7.746 7.746 0 0 1 2.2 5.9v8.8c0 .9.6 1.8 2.2 1.5A32.021 32.021 0 0 0 32 0z" fill="#fff"></path></svg><span>v.${version}</span><span class="tooltiptext-bottom">Check for newer releases</span>`;
checkVersionButton.addEventListener('click', function () {
    window.location.href = "https://github.com/danieltyukov/studocuhack/releases/"
});

let upButtons = document.querySelectorAll(".fa-cloud-arrow-up");
if(upButtons.length > 0 && upButtons[0].parentNode){
    upButtons[0].parentNode.parentNode.insertBefore(checkVersionButton, upButtons[0].parentNode.parentElement.children[3]);
}

// Toggle Sidebar
const toggleButton = document.querySelector('[data-test-selector="content-sidebar-toggle"]');
if(toggleButton){
    toggleButton.addEventListener('click', () => {
        let logos = document.querySelectorAll('[aria-label="StudeerSnel Logo"]' || '[aria-label="StuDocu Logo"]');
        logos.forEach(logo => {
            let newLogo = document.createElement('img');
            newLogo.src = "https://github.com/danieltyukov/studocuhack/assets/60662998/841574e5-d6cf-4ea9-975a-bcda51bf9240";
            newLogo.width = '90';
            newLogo.height = '60';

            // Replace the old logo with the new logo in the parent container
            let parentContainer = logo.parentElement;
            parentContainer.replaceChild(newLogo, logo);
        });
    });
}

// Enhanced focusImages function to remove blur from page content and update image paths
document.addEventListener('DOMContentLoaded', () => {
    focusContentAndImages();
    const viewerWrapper = document.getElementById('viewer-wrapper');
    const documentWrapper = document.getElementById('document-wrapper');

    if (viewerWrapper) {
        viewerWrapper.addEventListener('scroll', focusContentAndImages);
    }

    if (documentWrapper) {
        documentWrapper.addEventListener('scroll', focusContentAndImages);
    }
});

function focusContentAndImages() {
    document.querySelectorAll('.page-content').forEach((element) => {
        element.style.filter = 'none';
    });

    document.querySelectorAll('.blurred-container img').forEach((img) => {
        if (img.src.includes('/blurred/')) {
            img.src = img.src.replace('/blurred/', '/');
        }
        img.classList.add('bi', 'x0', 'y0', 'w1', 'h1');
    });

    document.querySelectorAll('.blurred-container').forEach((container) => {
        container.classList.remove('blurred-container');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    removeBlurFromPageContent();
    observeDOMChanges();
});

function removeBlurFromPageContent() {
    document.querySelectorAll('.page-content').forEach(page => {
        page.style.filter = 'none';
    });
}

function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length || mutation.removedNodes.length) {
                removeBlurFromPageContent();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}
