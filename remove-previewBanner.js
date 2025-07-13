(function() {
  'use strict';

  // Remove premium banner and preview restrictions
  function removePremiumBanner() {
    // Target the main premium banner wrapper
    const premiumBanner = document.querySelector('[class*="PremiumBannerBlobWrapper_preview-banner"]');
    if (premiumBanner) {
      premiumBanner.remove();
      console.log('Premium banner removed');
    }

    // Target by data-test-selector
    const modalPreview = document.querySelector('[data-test-selector="modal-document-viewer-preview-message"]');
    if (modalPreview) {
      modalPreview.remove();
      console.log('Modal preview message removed');
    }

    // Remove any elements containing "preview" or "premium" text
    const previewElements = document.querySelectorAll('[class*="preview"], [class*="Premium"], [class*="premium"]');
    previewElements.forEach(element => {
      if (element.textContent.toLowerCase().includes('preview') || 
          element.textContent.toLowerCase().includes('premium') ||
          element.textContent.toLowerCase().includes('dit is een preview')) {
        element.remove();
        console.log('Preview/Premium element removed');
      }
    });

    // Legacy selectors for older versions
    const legacyBanner1 = document.querySelector('._95f5f1767857');
    if (legacyBanner1) {
      legacyBanner1.remove();
    }

    const legacyBanner2 = document.querySelector('._3273140306b6');
    if (legacyBanner2) {
      legacyBanner2.remove();
    }
  }

  // Immediate removal function
  function immediateRemoval() {
    const selectors = [
      '[class*="PremiumBannerBlobWrapper"]',
      '[data-test-selector="modal-document-viewer-preview-message"]',
      '._95f5f1767857',
      '._3273140306b6'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.remove();
      });
    });
  }

  // Run immediately
  immediateRemoval();
  
  // Run every 500ms for the first 10 seconds to catch late-loading banners
  let attempts = 0;
  const maxAttempts = 20;
  const interval = setInterval(() => {
    immediateRemoval();
    attempts++;
    if (attempts >= maxAttempts) {
      clearInterval(interval);
    }
  }, 500);

  // Run on page load
  window.addEventListener("load", removePremiumBanner);

  // Run when DOM content is loaded (in case load event already fired)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removePremiumBanner);
  } else {
    removePremiumBanner();
  }

  // Use MutationObserver to catch dynamically added banners
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a premium banner
            if (node.matches && (
              node.matches('[class*="PremiumBannerBlobWrapper"]') ||
              node.matches('[data-test-selector="modal-document-viewer-preview-message"]') ||
              node.querySelector('[class*="PremiumBannerBlobWrapper"]') ||
              node.querySelector('[data-test-selector="modal-document-viewer-preview-message"]')
            )) {
              setTimeout(removePremiumBanner, 100);
            }
          }
        });
      }
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
