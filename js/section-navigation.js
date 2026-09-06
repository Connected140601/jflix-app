/**
 * Section Navigation Buttons - Scroll functionality for content sections
 * Allows users to scroll content lists left/right using navigation buttons
 */

(function() {
  'use strict';

  // Initialize navigation buttons when DOM is ready
  function initSectionNavigation() {
    const sections = document.querySelectorAll('.content-section');
    
    sections.forEach(section => {
      const list = section.querySelector('.content-list');
      const leftBtn = section.querySelector('.nav-btn.left');
      const rightBtn = section.querySelector('.nav-btn.right');
      
      if (!list || !leftBtn || !rightBtn) return;
      
      // Scroll amount (width of approximately 2-3 cards)
      const scrollAmount = 400;
      
      // Left button click
      leftBtn.addEventListener('click', () => {
        list.scrollBy({
          left: -scrollAmount,
          behavior: 'smooth'
        });
      });
      
      // Right button click
      rightBtn.addEventListener('click', () => {
        list.scrollBy({
          left: scrollAmount,
          behavior: 'smooth'
        });
      });
      
      // Update button states based on scroll position
      function updateButtonStates() {
        const isAtStart = list.scrollLeft <= 10;
        const isAtEnd = list.scrollLeft >= (list.scrollWidth - list.clientWidth - 10);
        
        leftBtn.classList.toggle('disabled', isAtStart);
        rightBtn.classList.toggle('disabled', isAtEnd);
      }
      
      // Listen for scroll events
      list.addEventListener('scroll', updateButtonStates, { passive: true });
      
      // Initial state check
      updateButtonStates();
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSectionNavigation);
  } else {
    initSectionNavigation();
  }
  
  // Re-initialize after dynamic content loads
  window.reinitSectionNavigation = initSectionNavigation;
})();
