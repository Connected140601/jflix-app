/**
 * JFlix Watch Later (My List) Controller
 * - Responsive rendering of saved titles across all platforms
 * - Live category filtering, search, and sorting
 * - Seamless synchronization with localStorage ('jflix_watchlist')
 */

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('watchlist-grid');
  const emptyState = document.getElementById('watchlist-empty');
  const countBadge = document.getElementById('watchlist-count-badge');
  const filterChips = document.querySelectorAll('.filter-chip');
  const searchInput = document.getElementById('watchlist-search');
  const sortSelect = document.getElementById('watchlist-sort');
  const clearBtn = document.getElementById('watchlist-clear-btn');
  const modal = document.getElementById('clear-confirm-modal');
  const modalCancel = document.getElementById('modal-cancel-btn');
  const modalConfirm = document.getElementById('modal-confirm-btn');

  let currentCategory = 'all';
  let searchQuery = '';
  let currentSort = 'recent';

  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
  const POSTER_SIZE = 'w500';

  // 1. Get items from storage
  function getWatchlist() {
    try {
      const data = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('Error parsing watchlist:', e);
      return [];
    }
  }

  // 2. Save items to storage
  function saveWatchlist(list) {
    localStorage.setItem('jflix_watchlist', JSON.stringify(list));
    if (window.updateWatchlistBadgeCount) {
      window.updateWatchlistBadgeCount();
    }
  }

  // 3. Filter and sort items
  function getFilteredItems() {
    const list = getWatchlist();

    return list.filter(item => {
      // Category filter
      if (currentCategory !== 'all') {
        const itemType = (item.media_type || '').toLowerCase();
        if (currentCategory === 'movie' && itemType !== 'movie') return false;
        if (currentCategory === 'tv' && itemType !== 'tv' && itemType !== 'tvshows') return false;
        if (currentCategory === 'anime' && itemType !== 'anime') return false;
        if (currentCategory === 'korean' && itemType !== 'korean') return false;
        if (currentCategory === 'cartoon' && itemType !== 'cartoon') return false;
      }

      // Search query filter
      if (searchQuery) {
        const title = (item.title || item.name || '').toLowerCase();
        if (!title.includes(searchQuery.toLowerCase())) return false;
      }

      return true;
    }).sort((a, b) => {
      if (currentSort === 'rating') {
        return (b.vote_average || 0) - (a.vote_average || 0);
      }
      if (currentSort === 'title') {
        const titleA = (a.title || a.name || '').toLowerCase();
        const titleB = (b.title || b.name || '').toLowerCase();
        return titleA.localeCompare(titleB);
      }
      // 'recent' (default - by saved_at date or index)
      const dateA = a.saved_at ? new Date(a.saved_at).getTime() : 0;
      const dateB = b.saved_at ? new Date(b.saved_at).getTime() : 0;
      return dateB - dateA;
    });
  }

  // 4. Update Header Count and Chip Counts
  function updateCounts() {
    const allItems = getWatchlist();
    const total = allItems.length;

    if (countBadge) {
      countBadge.textContent = total === 1 ? '1 Title' : `${total} Titles`;
    }

    if (clearBtn) {
      clearBtn.style.display = total > 0 ? 'inline-flex' : 'none';
    }

    // Update counts on filter chips
    const counts = {
      all: total,
      movie: allItems.filter(i => (i.media_type || '').toLowerCase() === 'movie').length,
      tv: allItems.filter(i => ['tv', 'tvshows'].includes((i.media_type || '').toLowerCase())).length,
      anime: allItems.filter(i => (i.media_type || '').toLowerCase() === 'anime').length,
      korean: allItems.filter(i => (i.media_type || '').toLowerCase() === 'korean').length,
      cartoon: allItems.filter(i => (i.media_type || '').toLowerCase() === 'cartoon').length
    };

    filterChips.forEach(chip => {
      const cat = chip.dataset.category;
      const countSpan = chip.querySelector('.chip-count');
      if (countSpan && counts[cat] !== undefined) {
        countSpan.textContent = `(${counts[cat]})`;
      }
    });
  }

  // 5. Render Grid
  function renderWatchlist() {
    updateCounts();
    const items = getFilteredItems();

    if (!grid || !emptyState) return;

    if (items.length === 0) {
      grid.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = '';

    items.forEach(item => {
      const title = item.title || item.name || 'Untitled';
      let posterSrc = 'images/no-poster.jpg';
      if (item.poster_path) {
        posterSrc = item.poster_path.startsWith('http')
          ? item.poster_path
          : `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}`;
      }

      const matchScore = Math.min(99, Math.max(84, Math.round((item.vote_average || 7) * 10 + 12)));
      const rating = typeof item.vote_average === 'number' ? item.vote_average.toFixed(1) : '7.0';
      const type = item.media_type || 'movie';

      let typeLabel = 'Movie';
      let typeClass = 'movies';
      if (type === 'tv' || type === 'tvshows') {
        typeLabel = 'TV';
        typeClass = 'tvshows';
      } else if (type === 'anime') {
        typeLabel = 'Anime';
        typeClass = 'anime';
      } else if (type === 'korean') {
        typeLabel = 'K-Drama';
        typeClass = 'korean';
      } else if (type === 'cartoon') {
        typeLabel = 'Cartoon';
        typeClass = 'tvshows';
      }

      const card = document.createElement('div');
      card.className = 'watchlist-card';
      card.dataset.id = item.id;

      card.innerHTML = `
        <div class="watchlist-card-poster-wrap">
          <img class="watchlist-card-poster" src="${posterSrc}" alt="${title}" loading="lazy" onerror="this.src='images/no-poster.jpg'">
          <div class="card-top-badges">
            <span class="card-match-badge">${matchScore}% Match</span>
            <div class="card-top-badges-right">
              <span class="trending-badge ${typeClass}">${typeLabel}</span>
              <span class="card-hd-badge">HD</span>
            </div>
          </div>
          <div class="watchlist-card-overlay">
            <div class="watchlist-card-buttons">
              <button class="btn play-btn" title="Play Now"><i class="fas fa-play"></i> Watch</button>
              <button class="btn details-btn" title="View Details"><i class="fas fa-info-circle"></i> Info</button>
            </div>
          </div>
        </div>
        <div class="watchlist-card-info">
          <h3 class="watchlist-card-title" title="${title}">${title}</h3>
          <div class="watchlist-card-meta">
            <span class="rating"><i class="fas fa-star"></i> ${rating}</span>
            <span class="category-tag">${typeLabel}</span>
          </div>
          <button class="btn remove-btn" title="Remove from Watch Later">
            <i class="fas fa-bookmark-slash"></i> Remove
          </button>
        </div>
      `;

      // Button actions
      const playBtn = card.querySelector('.play-btn');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.showLoader) window.showLoader();
        window.location.href = `player.html?id=${item.id}&type=${type}`;
      });

      const detailsBtn = card.querySelector('.details-btn');
      detailsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.showLoader) window.showLoader();
        window.location.href = `details.html?id=${item.id}&type=${type}`;
      });

      const removeBtn = card.querySelector('.remove-btn');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeItem(item.id, title, card);
      });

      // Clicking card navigates to details
      card.addEventListener('click', () => {
        if (window.showLoader) window.showLoader();
        window.location.href = `details.html?id=${item.id}&type=${type}`;
      });

      grid.appendChild(card);
    });
  }

  // 6. Remove Single Item with Smooth Fade Out
  function removeItem(id, title, cardElement) {
    if (cardElement) {
      cardElement.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      cardElement.style.opacity = '0';
      cardElement.style.transform = 'scale(0.85)';
    }

    setTimeout(() => {
      const list = getWatchlist();
      const updated = list.filter(i => String(i.id) !== String(id));
      saveWatchlist(updated);
      renderWatchlist();

      if (window.showToast) {
        window.showToast(`Removed "${title}" from Watch Later`, 'info', 'fa-minus');
      }
    }, 280);
  }

  // 7. Clear All with Confirmation
  if (clearBtn && modal) {
    clearBtn.addEventListener('click', () => {
      modal.classList.add('show');
    });

    if (modalCancel) {
      modalCancel.addEventListener('click', () => {
        modal.classList.remove('show');
      });
    }

    if (modalConfirm) {
      modalConfirm.addEventListener('click', () => {
        saveWatchlist([]);
        modal.classList.remove('show');
        renderWatchlist();
        if (window.showToast) {
          window.showToast('Cleared all titles from Watch Later', 'info', 'fa-trash');
        }
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
  }

  // 8. Event Listeners for Filters, Search, and Sort
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category || 'all';
      renderWatchlist();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderWatchlist();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderWatchlist();
    });
  }

  // Listen for storage changes from other tabs/pages
  window.addEventListener('storage', (e) => {
    if (e.key === 'jflix_watchlist') {
      renderWatchlist();
    }
  });

  // Initial render
  renderWatchlist();
  if (window.hideLoader) window.hideLoader();
});
