// js/common.js

// DOM Elements for Share Modal (ensure these IDs exist in your HTML where this script is used)
let shareModalElement, shareLinkInputElement, copyFeedbackElement;
let socialShareFacebook, socialShareTwitter, socialShareWhatsapp, socialShareTelegram, socialShareReddit, socialShareEmail;

function initializeShareModalDOM() {
    shareModalElement = document.getElementById('share-modal');
    shareLinkInputElement = document.getElementById('share-link-input');
    copyFeedbackElement = document.getElementById('copy-link-feedback');

    if (shareModalElement) { // Only get social icons if modal exists
        socialShareFacebook = document.getElementById('share-facebook');
        socialShareTwitter = document.getElementById('share-twitter');
        socialShareWhatsapp = document.getElementById('share-whatsapp');
        socialShareTelegram = document.getElementById('share-telegram');
        socialShareReddit = document.getElementById('share-reddit');
        socialShareEmail = document.getElementById('share-email');
    }
}

// Call initialization when the DOM is ready, or ensure it's called before use
// Adding a general DOMContentLoaded listener for this common script
document.addEventListener('DOMContentLoaded', () => {
    initializeShareModalDOM();

    // Event listener for closing share modal when clicking outside
    window.addEventListener('click', (e) => {
        if (shareModalElement && e.target === shareModalElement) {
            closeShareModal();
        }
    });

    // Attach event listener to the close button of the share modal if it exists
    if (shareModalElement) {
        const closeButton = shareModalElement.querySelector('.close');
        if (closeButton) {
            closeButton.addEventListener('click', closeShareModal);
        }
    }
     // Attach event listener to the copy button of the share modal if it exists
    if (shareModalElement) {
        const copyButton = shareModalElement.querySelector('.copy-link-btn');
        if (copyButton) {
            copyButton.addEventListener('click', copyShareLink);
        }
    }
});


function openShareModal(mediaId, mediaType, title, overview, posterPath) {
  if (!shareModalElement || !shareLinkInputElement) {
    console.warn('Share modal elements not found. Ensure initializeShareModalDOM() has run and HTML is correct.');
    return;
  }

  // Ensure DOM elements for social icons are available
  if (!socialShareFacebook) initializeShareModalDOM();


  // Construct the base URL for your site's detail page
  const siteBaseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  // Ensure details.html exists at the root or adjust path
  const detailsPage = 'details.html'; // Assuming details.html is in the same directory level as the current page or at root
  const contentUrl = `${siteBaseUrl}${detailsPage}?id=${mediaId}&type=${mediaType}`;
  
  shareLinkInputElement.value = contentUrl;

  // Social media share URLs
  const encodedUrl = encodeURIComponent(contentUrl);
  const encodedTitle = encodeURIComponent(title || 'Check this out!');
  const shortOverview = overview ? overview.substring(0, 100) + '...' : (title || 'Interesting content');
  const encodedOverview = encodeURIComponent(shortOverview);

  if(socialShareFacebook) socialShareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  if(socialShareTwitter) socialShareTwitter.href = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&via=JFlix`;
  if(socialShareWhatsapp) socialShareWhatsapp.href = `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`;
  if(socialShareTelegram) socialShareTelegram.href = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
  if(socialShareReddit) socialShareReddit.href = `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`;
  if(socialShareEmail) socialShareEmail.href = `mailto:?subject=${encodedTitle}&body=Check out this: ${contentUrl}`;

  shareModalElement.style.display = 'flex';
  setTimeout(() => { shareModalElement.classList.add('visible'); }, 10);
  if(copyFeedbackElement) {
    copyFeedbackElement.classList.remove('visible');
    copyFeedbackElement.textContent = '';
  }
}

function closeShareModal() {
  if (!shareModalElement) return;
  shareModalElement.classList.remove('visible');
  setTimeout(() => { shareModalElement.style.display = 'none'; }, 300); // Match CSS transition
}

function copyShareLink() {
  if (!shareLinkInputElement || !copyFeedbackElement) return;
  shareLinkInputElement.select();
  shareLinkInputElement.setSelectionRange(0, 99999); // For mobile devices

  navigator.clipboard.writeText(shareLinkInputElement.value).then(() => {
    copyFeedbackElement.textContent = 'Link copied to clipboard!';
    copyFeedbackElement.classList.add('visible');
    copyFeedbackElement.style.color = '#2ecc71'; // Green for success
    if (window.showToast) window.showToast('Link copied to clipboard!', 'success', 'fa-check');
    setTimeout(() => {
      copyFeedbackElement.classList.remove('visible');
      copyFeedbackElement.textContent = '';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy: ', err);
    copyFeedbackElement.textContent = 'Failed to copy. Try manually.';
    copyFeedbackElement.classList.add('visible');
    copyFeedbackElement.style.color = 'var(--primary-color)'; // Use red for error
    if (window.showToast) window.showToast('Failed to copy link. Try manually.', 'error', 'fa-times-circle');
     setTimeout(() => {
      copyFeedbackElement.classList.remove('visible');
      copyFeedbackElement.textContent = '';
      copyFeedbackElement.style.color = '#2ecc71'; // Reset color
    }, 3000);
  });
}

/**
 * Universal Global Toast Notification
 * Usage: showToast('Added to watchlist', 'success', 'fa-bookmark');
 */
window.showToast = function(message, type = 'info', icon = null, duration = 3200) {
  let container = document.querySelector('.jflix-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'jflix-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `jflix-toast ${type}`;

  let iconHtml = '';
  if (icon) {
    iconHtml = `<span class="jflix-toast-icon"><i class="fas ${icon}"></i></span>`;
  } else {
    if (type === 'success') iconHtml = '<span class="jflix-toast-icon"><i class="fas fa-check-circle"></i></span>';
    else if (type === 'error') iconHtml = '<span class="jflix-toast-icon"><i class="fas fa-exclamation-circle"></i></span>';
    else if (type === 'premium') iconHtml = '<span class="jflix-toast-icon"><i class="fas fa-crown"></i></span>';
    else iconHtml = '<span class="jflix-toast-icon"><i class="fas fa-info-circle"></i></span>';
  }

  toast.innerHTML = `${iconHtml}<span class="jflix-toast-msg">${message}</span>`;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, duration);
};

