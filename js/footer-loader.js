document.addEventListener("DOMContentLoaded", function() {
  fetch('/templates/footer.html')
    .then(response => response.text())
    .then(data => {
      // Replace hardcoded year with current year
      const currentYear = new Date().getFullYear();
      const updatedFooter = data.replace('2025', currentYear);
      document.getElementById('footer-placeholder').innerHTML = updatedFooter;
    });
});
