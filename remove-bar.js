window.addEventListener('load', function(){
    // Remove banner
    let bannerElement = document.querySelector('#document-wrapper');
    if(bannerElement){
        let banners = Array.from(bannerElement.childNodes);
        if (banners.length > 3){
            banners[0].remove();
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
            if(contentElement.className !== "page-content"){
                contentElement.remove();
            }
        });
        pageElement.classList.add("nofilter");
    });
});