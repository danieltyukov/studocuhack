// Remove "This is preview" banner
window.addEventListener("load", () => {
  const specificDiv = document.querySelector('._95f5f1767857');
  if (specificDiv) {
      specificDiv.remove();
  }
});

// Remove additional specific undesired div
window.addEventListener("load", () => {
  const additionalDiv = document.querySelector('._3273140306b6');
  if (additionalDiv) {
      additionalDiv.remove();
  }
});
