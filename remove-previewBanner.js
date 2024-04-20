// Remove "This is preview" banner
window.addEventListener("load", () => {
  const specificDiv = document.querySelector('._95f5f1767857');
  if (specificDiv) {
      specificDiv.remove();
  }
});