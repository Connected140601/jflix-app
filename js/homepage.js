// API Configuration
const API_KEY = '84549ba3644ea15176802ec153bd9442';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const BACKDROP_SIZE = '/original';
const POSTER_SIZE = '/w500';

// Native app detection (Electron and Android with unique user agent)
// Check if already defined by other scripts to avoid duplicate declaration
// This matches the detection logic in auth.js and monetization.js
if (typeof window.IS_ELECTRON === 'undefined') {
  window.IS_ELECTRON = navigator.userAgent.includes('Electron');
}
if (typeof window.IS_ANDROID_WEBVIEW === 'undefined') {
  window.IS_ANDROID_WEBVIEW = (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID) ||
                               /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(navigator.userAgent) ||
                               /JFlix-Android/i.test(navigator.userAgent) ||
                               localStorage.getItem('jflix_is_android') === 'true';
}
if (typeof window.IS_IOS_NATIVE === 'undefined') {
  window.IS_IOS_NATIVE = (typeof window.IS_IOS_APP !== 'undefined' && window.IS_IOS_APP === true) ||
                         (typeof window.IS_IOS_NATIVE !== 'undefined' && window.IS_IOS_NATIVE === true) ||
                         /JFlix-iOS/i.test(navigator.userAgent) ||
                         (/JFlixNativeApp/i.test(navigator.userAgent) && /iPhone|iPad|iPod/i.test(navigator.userAgent)) ||
                         (document.documentElement && document.documentElement.classList.contains('is-ios-app'));
}
window.IS_NATIVE_APP = window.IS_ELECTRON || window.IS_ANDROID_WEBVIEW || window.IS_IOS_NATIVE;

// Debug logging for watch history detection
console.log('[Watch History Detection - Homepage] IS_ELECTRON:', window.IS_ELECTRON);
console.log('[Watch History Detection - Homepage] IS_ANDROID_WEBVIEW:', window.IS_ANDROID_WEBVIEW);
console.log('[Watch History Detection - Homepage] IS_NATIVE_APP:', window.IS_NATIVE_APP);
console.log('[Watch History Detection - Homepage] User Agent:', navigator.userAgent);
console.log('[Watch History Detection - Homepage] window.IS_ANDROID:', typeof window.IS_ANDROID !== 'undefined' ? window.IS_ANDROID : 'undefined');
console.log('[Watch History Detection - Homepage] localStorage jflix_is_android:', localStorage.getItem('jflix_is_android'));

// Global variables
let currentMediaType = '';
let currentMediaId = null;
let searchTimeout = null;

// Global variables for banner rotation
let bannerItems = [];
let currentBannerIndex = 0;
let bannerIntervalId = null;
const BANNER_ROTATION_INTERVAL = 7000; // 7 seconds

// Global flag for adult content tag
let includeAdultFilter = false;

// DOM Elements (will be initialized after DOM loads)
let modal;
let trendingGrid;
let homepageBanner;
let homepageBannerTitle;
let homepageBannerOverview;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializePage();
});

// Initialize the page with content
async function initializePage() {
  if (window.showLoader) window.showLoader('Loading JFlix');
  try {
    // Initialize DOM elements
    modal = document.getElementById('modal');
    trendingGrid = document.getElementById('trending-grid');
    homepageBanner = document.getElementById('homepage-banner');
    homepageBannerTitle = document.getElementById('homepage-banner-title');
    homepageBannerOverview = document.getElementById('homepage-banner-overview');

    // Parallelize content loading for ultra-fast render
    await Promise.allSettled([
      loadTop10Content(),
      loadTrendingContent(),
      loadHomepageBannerContent(),
      loadWatchHistory()
    ]);

    // Add event listeners
    addEventListeners();
  } catch (error) {
    console.error('Error initializing page. Message:', error.message, 'Full error:', error);
  } finally {
    if (window.hideLoader) window.hideLoader();
    if (window.injectFooter) window.injectFooter();
  }
}

// Global Carousel Smooth Scroller
window.scrollCarousel = function(containerId, direction) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const scrollAmount = Math.max(300, Math.floor(container.clientWidth * 0.75));
  container.scrollBy({
    left: direction === 'left' ? -scrollAmount : scrollAmount,
    behavior: 'smooth'
  });
};

// Load Top 10 Ranked content (Netflix Signature Row)
async function loadTop10Content() {
  try {
    const top10Grid = document.getElementById('top-10-grid');
    if (!top10Grid) return;

    top10Grid.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Loading Top 10...</p></div>';

    // Fetch daily trending items
    const trendingData = await fetchFromTMDB('trending/all/day');
    top10Grid.innerHTML = '';

    if (trendingData.results && trendingData.results.length > 0) {
      const topItems = trendingData.results.filter(i => i.poster_path).slice(0, 10);
      topItems.forEach((item, index) => {
        const rank = index + 1;
        const type = item.media_type || (item.title ? 'movie' : 'tv');
        const title = type === 'movie' ? item.title : item.name;
        const posterUrl = `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}`;
        
        let typeBadge = 'Movie';
        let badgeType = 'movie';
        if (type === 'tv') {
          if (item.original_language === 'ja') { typeBadge = 'Anime'; badgeType = 'anime'; }
          else if (item.original_language === 'ko') { typeBadge = 'K-Drama'; badgeType = 'korean'; }
          else { typeBadge = 'TV Series'; badgeType = 'tv'; }
        }

        const matchPercent = Math.min(99, Math.max(82, Math.round(item.vote_average * 10 + 12)));
        const safeTitle = escapeHtml(title);
        const isSaved = isInWatchlist(item.id);

        const el = document.createElement('div');
        el.className = 'top-10-item';
        el.setAttribute('data-id', item.id);
        el.setAttribute('data-type', badgeType);
        el.innerHTML = `
          <div class="top-10-rank">${rank}</div>
          <div class="top-10-poster-wrap">
            <img class="top-10-poster" src="${posterUrl}" alt="${safeTitle}" loading="lazy" onerror="this.onerror=null;this.src='images/no-poster.jpg';">
            <div class="top-10-overlay">
              <div class="top-10-title">${safeTitle}</div>
              <div class="top-10-meta">
                <span class="top-10-match">${matchPercent}% Match</span>
                <span class="top-10-type">${typeBadge}</span>
              </div>
              <div class="top-10-buttons">
                <button class="btn watch-btn" title="Watch Now" aria-label="Watch Now"><i class="fas fa-play"></i></button>
                <button class="btn details-btn" title="View Details" aria-label="View Details"><i class="fas fa-info-circle"></i></button>
                <button class="btn watchlist-btn${isSaved ? ' in-watchlist' : ''}" title="Add to Watch Later" aria-label="Add to Watch Later">${isSaved ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}</button>
              </div>
            </div>
          </div>
        `;

        el.querySelector('.watch-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.showLoader) window.showLoader();
          window.location.href = `player.html?id=${item.id}&type=${badgeType}&source=homepage`;
        });

        el.querySelector('.details-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.showLoader) window.showLoader();
          window.location.href = `details.html?id=${item.id}&type=${badgeType}&source=homepage`;
        });

        el.querySelector('.watchlist-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          toggleTop10Watchlist(e.currentTarget, item, badgeType, title);
        });

        el.addEventListener('click', () => {
          showQuickView(item.id, badgeType);
        });

        top10Grid.appendChild(el);
      });
    } else {
      top10Grid.innerHTML = '<div class="no-content">Top 10 is currently updating...</div>';
    }
  } catch (error) {
    console.error('[Top 10] Error loading top 10 content:', error);
    const top10Grid = document.getElementById('top-10-grid');
    if (top10Grid) top10Grid.innerHTML = '<div class="error-message">Could not load Top 10 right now.</div>';
  }
}

// Escape HTML special chars so titles with quotes/angle brackets can't break card markup
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Check if a TMDB id is already saved in Watch Later (same store as trending cards)
function isInWatchlist(id) {
  try {
    const watchlist = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]');
    return watchlist.some(w => String(w.id) === String(id));
  } catch (err) {
    return false;
  }
}

// Toggle Watch Later for a Top 10 card (mirrors trending-card behavior)
function toggleTop10Watchlist(btn, item, mediaType, title) {
  let currentList = [];
  try { currentList = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]'); } catch (err) {}
  const existsIndex = currentList.findIndex(w => String(w.id) === String(item.id));
  if (existsIndex > -1) {
    currentList.splice(existsIndex, 1);
    btn.innerHTML = '<i class="fas fa-plus"></i>';
    btn.classList.remove('in-watchlist');
    if (window.showToast) window.showToast(`Removed "${title}" from Watch Later`, 'info', 'fa-minus');
  } else {
    currentList.unshift({
      id: item.id,
      title: title,
      poster_path: item.poster_path,
      media_type: mediaType,
      vote_average: item.vote_average,
      saved_at: new Date().toISOString()
    });
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.classList.add('in-watchlist');
    if (window.showToast) window.showToast(`Added "${title}" to Watch Later — <a href="watchlist.html" style="color:#46d369;text-decoration:underline;margin-left:4px;font-weight:700;">View List</a>`, 'success', 'fa-bookmark');
  }
  localStorage.setItem('jflix_watchlist', JSON.stringify(currentList));
  if (window.updateWatchlistBadgeCount) window.updateWatchlistBadgeCount();
}

// Load trending content
async function loadTrendingContent() {
  try {
    if (!trendingGrid) {
      console.error('[Trending] trendingGrid element not found');
      return;
    }

    trendingGrid.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Loading trending content...</p></div>';

    // Get trending content
    const trendingData = await fetchFromTMDB('trending/all/week');

    // Clear loading indicator
    trendingGrid.innerHTML = '';

    // Display trending items in parallel
    if (trendingData.results && trendingData.results.length > 0) {
      const items = trendingData.results.filter(i => i.poster_path).slice(0, 14);
      const elements = await Promise.all(items.map(item => createTrendingItem(item)));
      elements.forEach(el => trendingGrid.appendChild(el));
    } else {
      trendingGrid.innerHTML = '<div class="no-content">No trending content available</div>';
    }
  } catch (error) {
    console.error('[Trending] Error loading trending content:', error);
    if (trendingGrid) {
      trendingGrid.innerHTML = '<div class="error-message">Failed to load trending content. Please try again later.</div>';
    }
  }
}


// Create a trending item
async function createTrendingItem(item) {
  // Clone the template
  const template = document.getElementById('trending-item-template');
  const trendingItem = template.content.cloneNode(true);
  
  // Determine type and title
  const type = item.media_type || (item.title ? 'movie' : 'tv');
  const title = type === 'movie' ? item.title : item.name;
  
  let posterPath = item.poster_path;

  // If it's a TV show, try to get the latest season's poster
  if (type === 'tv') {
    try {
      const seriesDetails = await fetchFromTMDB(`tv/${item.id}`);
      if (seriesDetails.seasons && seriesDetails.seasons.length > 0) {
        // Find the latest aired season with a poster
        const today = new Date();
        let latestAiredSeason = null;

        // Sort seasons by air_date in descending order
        const sortedSeasons = [...seriesDetails.seasons].sort((a, b) => new Date(b.air_date) - new Date(a.air_date));

        for (const season of sortedSeasons) {
          if (season.air_date && new Date(season.air_date) <= today && season.poster_path) {
            latestAiredSeason = season;
            break; // Found the latest aired season with a poster
          }
        }

        if (latestAiredSeason) {
          posterPath = latestAiredSeason.poster_path;
        }
      }

      // Add season/episode badge
      const posterContainer = trendingItem.querySelector('.trending-poster-container');
      const seasonBadge = document.createElement('div');
      seasonBadge.classList.add('season-badge');

      if (seriesDetails.status === 'Ended' || seriesDetails.status === 'Canceled') {
        seasonBadge.textContent = 'COMPLETED';
        seasonBadge.classList.add('completed');
      } else if (seriesDetails.last_episode_to_air) {
        const s = seriesDetails.last_episode_to_air.season_number.toString().padStart(2, '0');
        const e = seriesDetails.last_episode_to_air.episode_number.toString().padStart(2, '0');
        seasonBadge.textContent = `S${s}, E${e}`;
      } else if (seriesDetails.number_of_seasons) {
        // Fallback for shows where last_episode_to_air is null but has seasons
        const lastSeason = seriesDetails.seasons[seriesDetails.seasons.length - 1];
        if (lastSeason) {
            const s = lastSeason.season_number.toString().padStart(2, '0');
            seasonBadge.textContent = `S${s}`;
        }
      }

      if (seasonBadge.textContent) {
        posterContainer.insertBefore(seasonBadge, posterContainer.firstChild);
      }

    } catch (error) {
      console.warn(`Could not fetch latest season poster or details for TV series ${item.id}:`, error);
      // Fallback to original poster_path if fetching season details fails
    }
  }
  
  // Set poster image
  const posterUrl = `${IMAGE_BASE_URL}${POSTER_SIZE}${posterPath}`;
  trendingItem.querySelector('.trending-poster').src = posterUrl;
  trendingItem.querySelector('.trending-poster').alt = title;
  
  // Set badge
  const badge = trendingItem.querySelector('.trending-badge');
  let badgeText = '';
  
  if (type === 'movie') {
    badgeText = 'Movie';
    badge.classList.add('movies');
  } else if (type === 'tv') {
    // Check if it's anime or Korean
    if (item.original_language === 'ja') {
      badgeText = 'Anime';
      badge.classList.add('anime');
    } else if (item.original_language === 'ko') {
      badgeText = 'K-Drama';
      badge.classList.add('korean');
    } else {
      badgeText = 'TV';
      badge.classList.add('tvshows');
    }
  }
  
  badge.textContent = badgeText;
  
  // Set title
  trendingItem.querySelector('.trending-title').textContent = title;
  
  // Set year
  const releaseDate = type === 'movie' ? item.release_date : item.first_air_date;
  if (releaseDate) {
    const year = new Date(releaseDate).getFullYear();
    trendingItem.querySelector('.trending-year').textContent = year;
  } else {
    trendingItem.querySelector('.trending-year').textContent = 'Unknown';
  }
  
  // Set rating
  const rating = Math.round(item.vote_average * 10) / 10;
  trendingItem.querySelector('.trending-rating').textContent = `${rating}/10`;
  
  // Set Match Badge
  const matchScore = Math.min(99, Math.max(84, Math.round((item.vote_average || 7) * 10 + 12)));
  const matchBadge = trendingItem.querySelector('.card-match-badge');
  if (matchBadge) matchBadge.textContent = `${matchScore}% Match`;

  // Watchlist button
  const watchlistBtn = trendingItem.querySelector('.watchlist-btn');
  if (watchlistBtn) {
    let watchlist = [];
    try { watchlist = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]'); } catch (err) {}
    const isWatchlisted = watchlist.some(w => String(w.id) === String(item.id));
    watchlistBtn.innerHTML = isWatchlisted ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>';
    if (isWatchlisted) watchlistBtn.classList.add('in-watchlist');

    watchlistBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let currentList = [];
      try { currentList = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]'); } catch (err) {}
      const existsIndex = currentList.findIndex(w => String(w.id) === String(item.id));
      const badgeText = badge.textContent;
      const actualType = getActualMediaType(type, badgeText);
      if (existsIndex > -1) {
        currentList.splice(existsIndex, 1);
        watchlistBtn.innerHTML = '<i class="fas fa-plus"></i>';
        watchlistBtn.classList.remove('in-watchlist');
        if (window.showToast) window.showToast(`Removed "${title}" from Watch Later`, 'info', 'fa-minus');
      } else {
        currentList.unshift({
          id: item.id,
          title: title,
          poster_path: item.poster_path,
          media_type: actualType,
          vote_average: item.vote_average,
          saved_at: new Date().toISOString()
        });
        watchlistBtn.innerHTML = '<i class="fas fa-check"></i>';
        watchlistBtn.classList.add('in-watchlist');
        if (window.showToast) window.showToast(`Added "${title}" to Watch Later — <a href="watchlist.html" style="color:#46d369;text-decoration:underline;margin-left:4px;font-weight:700;">View List</a>`, 'success', 'fa-bookmark');
      }
      localStorage.setItem('jflix_watchlist', JSON.stringify(currentList));
      if (window.updateWatchlistBadgeCount) window.updateWatchlistBadgeCount();
    });
  }

  // Add event listeners
  const watchBtn = trendingItem.querySelector('.watch-btn');
  watchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.showLoader();
    const badgeText = badge.textContent;
    const actualType = getActualMediaType(type, badgeText);
    window.location.href = `player.html?id=${item.id}&type=${actualType}&source=homepage`;
  });
  
  const detailsBtn = trendingItem.querySelector('.details-btn');
  detailsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.showLoader();
    const badgeText = badge.textContent;
    const actualType = getActualMediaType(type, badgeText);
    const detailsUrl = `details.html?id=${item.id}&type=${actualType}&source=homepage`;
    window.location.href = detailsUrl;
  });
  
  // Make the entire item clickable to show quick view
  const trendingElement = trendingItem.querySelector('.trending-item');
  trendingElement.addEventListener('click', () => {
    const badgeText = badge.textContent;
    const actualType = getActualMediaType(type, badgeText);
    showQuickView(item.id, actualType);
  });
  
  return trendingItem;
}

// Get badge class based on type and badge text
function getBadgeClass(type, badge) {
  if (type === 'movie') return 'movies';
  if (badge === 'TV Shows') return 'tvshows';
  if (badge === 'Anime') return 'anime';
  if (badge === 'Korean TV') return 'korean';
  return '';
}

// Get actual media type for API calls
function getActualMediaType(type, badge) {
  if (type === 'movie') return 'movie';
  if (badge === 'Anime') return 'anime';
  if (badge === 'Korean TV') return 'korean';
  return 'tv';
}

// Get genre name from genre ID
function getGenreName(genreId, type) {
  const movieGenres = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Science Fiction',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western'
  };
  
  const tvGenres = {
    10759: 'Action & Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    10762: 'Kids',
    9648: 'Mystery',
    10763: 'News',
    10764: 'Reality',
    10765: 'Sci-Fi & Fantasy',
    10766: 'Soap',
    10767: 'Talk',
    10768: 'War & Politics',
    37: 'Western'
  };
  
  const genres = type === 'movie' ? movieGenres : tvGenres;
  return genres[genreId] || 'Unknown';
}

// Add event listeners
function addEventListeners() {
  // Newsletter form submission
  const newsletterForm = document.querySelector('.newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      if (emailInput && emailInput.value) {
        alert(`Thank you for subscribing with ${emailInput.value}!`);
        emailInput.value = '';
      }
    });
  }
  
  // Handle URL parameters for quick access links
  window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const openSearch = urlParams.get('open_search');

    if (category) {
      // Redirect to movies page with category parameter
      window.location.href = `movies.html?category=${category}`;
    }

    if (openSearch === 'true') {
      openSearchModal();
    }
  });
  
  document.querySelectorAll('.quick-access-item').forEach(item => {
    item.addEventListener('click', function(event) {
      event.preventDefault(); // Prevent default link behavior
      window.showLoader();
      const category = this.href.split('category=')[1] || 'all'; // Extract category or default to 'all'
      // Redirect to movies page with category query parameter
      window.location.href = `movies.html?category=${category}`;
    });
  });

  initializeCardTouchEvents();
}

// Initialize touch events for media cards
function initializeCardTouchEvents() {
  document.addEventListener('touchstart', (e) => {
    const targetCard = e.target.closest('.media-card');

    // Remove the hover effect from all other cards that have it
    document.querySelectorAll('.media-card.card-touch-hover').forEach(card => {
      if (card !== targetCard) {
        card.classList.remove('card-touch-hover');
      }
    });

    // Toggle the hover effect on the touched card
    if (targetCard) {
      targetCard.classList.toggle('card-touch-hover');
    }
  }, { passive: true });
}

// Fetch data from TMDB API
async function fetchFromTMDB(endpoint, params = {}, retries = 3, delay = 1000) {
  const [path, existingQuery] = endpoint.split('?');
  const queryParams = new URLSearchParams(existingQuery);
  queryParams.set('api_key', API_KEY);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      queryParams.set(key, value);
    }
  }

  const url = `${BASE_URL}/${path}?${queryParams.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (retries > 0 && response.status >= 500) { // Only retry on server errors
        console.warn(`Retrying API request to ${url}. Attempts left: ${retries - 1}`);
        await new Promise(res => setTimeout(res, delay));
        return fetchFromTMDB(endpoint, params, retries - 1, delay * 2); // Exponential backoff
      }
      const errorText = await response.text();
      console.error(`API request to ${url} failed with status ${response.status}: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch from ${endpoint}. URL: ${url}. Error:`, error);
    if (retries > 0) {
      console.warn(`Retrying API request to ${url} due to network error. Attempts left: ${retries - 1}`);
      await new Promise(res => setTimeout(res, delay));
      return fetchFromTMDB(endpoint, params, retries - 1, delay * 2);
    }

    // Return a default empty state to avoid breaking the UI after all retries fail
    if (path.includes('list') || path.includes('countries') || path.includes('languages')) {
      return { genres: [], results: [] };
    }
    return { results: [] };
  }
}

// Show quick view modal
async function showQuickView(id, type) {
  try {
    currentMediaId = id;
    currentMediaType = type;
    
    // Show loading state
    modal.classList.add('show');
    document.getElementById('modal-image').src = '';
    document.getElementById('modal-title').textContent = 'Loading...';
    document.getElementById('modal-year').textContent = '';
    document.getElementById('modal-runtime').textContent = '';
    document.getElementById('modal-rating').innerHTML = '';
    document.getElementById('modal-genres').innerHTML = '';
    document.getElementById('modal-description').textContent = 'Loading details...';
    
    // Fetch media details
    let media;
    if (type === 'movie') {
      media = await fetchFromTMDB(`movie/${id}`);
    } else {
      media = await fetchFromTMDB(`tv/${id}`);
    }
    
    // Set modal content
    document.getElementById('modal-image').src = `${IMAGE_BASE_URL}${POSTER_SIZE}${media.poster_path}`;
    document.getElementById('modal-title').textContent = type === 'movie' ? media.title : media.name;
    
    // Set year
    const releaseDate = type === 'movie' ? media.release_date : media.first_air_date;
    if (releaseDate) {
      const year = new Date(releaseDate).getFullYear();
      document.getElementById('modal-year').textContent = year;
    } else {
      document.getElementById('modal-year').textContent = 'Unknown';
    }
    
    // Set runtime
    if (type === 'movie') {
      if (media.runtime) {
        document.getElementById('modal-runtime').textContent = `${media.runtime} min`;
      } else {
        document.getElementById('modal-runtime').textContent = 'Unknown';
      }
    } else {
      if (media.episode_run_time && media.episode_run_time.length > 0) {
        document.getElementById('modal-runtime').textContent = `${media.episode_run_time[0]} min/ep`;
      } else {
        document.getElementById('modal-runtime').textContent = 'Unknown';
      }
    }
    
    // Set rating
    const rating = Math.round(media.vote_average * 10) / 10;
    const ratingElement = document.getElementById('modal-rating');
    if (rating > 0) {
      const stars = Math.round(rating / 2);
      ratingElement.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const starIcon = document.createElement('i');
        if (i < stars) {
          starIcon.className = 'fas fa-star';
        } else {
          starIcon.className = 'far fa-star';
        }
        ratingElement.appendChild(starIcon);
      }
      ratingElement.innerHTML += ` <span class="rating-number">${rating}</span>`;
    } else {
      ratingElement.innerHTML = '<span class="no-rating">Not rated</span>';
    }
    
    // Set genres
    const genresElement = document.getElementById('modal-genres');
    genresElement.innerHTML = '';
    if (media.genres && media.genres.length > 0) {
      media.genres.forEach(genre => {
        const genreTag = document.createElement('span');
        genreTag.className = 'genre-tag';
        genreTag.textContent = genre.name;
        genresElement.appendChild(genreTag);
      });
    } else {
      genresElement.innerHTML = '<span class="no-genres">No genres available</span>';
    }
    
    // Set description
    document.getElementById('modal-description').textContent = media.overview || 'No description available';
  } catch (error) {
    console.error('Error showing quick view:', error);
    document.getElementById('modal-description').textContent = 'Failed to load details. Please try again later.';
  }
}

// Close modal
function closeModal() {
  modal.classList.remove('show');
}

// Watch media from modal
function watchMedia() {
  if (currentMediaId && currentMediaType) {
    window.location.href = `player.html?id=${currentMediaId}&type=${currentMediaType}&source=homepage`;
  }
}

// View media details from modal
function viewDetails() {
  if (currentMediaId && currentMediaType) {
    window.location.href = `details.html?id=${currentMediaId}&type=${currentMediaType}&source=homepage`;
  }
}



// Utility function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Close modals when pressing Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// Add navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
});

// New function to load content for the homepage banner
async function loadHomepageBannerContent() {
  if (!homepageBanner || !homepageBannerTitle || !homepageBannerOverview) {
    console.log('Homepage banner elements not found, skipping banner load.');
    return;
  }
  console.log('Attempting to load homepage banner content for rotation...');

  try {
    const endpoints = [
      { name: 'Trending Movies', url: 'trending/movie/week', type: 'movie' },
      { name: 'Top Rated TV', url: 'tv/top_rated', type: 'tv' },
      { name: 'Korean TV', url: 'discover/tv?with_origin_country=KR&sort_by=vote_average.desc&vote_count.gte=100', type: 'tv' },
      { name: 'Anime Series', url: 'discover/tv?with_genres=16&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=100', type: 'tv' },
      { name: 'Cartoon Movies', url: 'discover/movie?with_genres=16&sort_by=vote_average.desc&vote_count.gte=100&without_original_language=ja', type: 'movie' }
    ];

    console.log('Fetching data from endpoints for banner rotation:', endpoints.map(ep => ep.name));

    const allPromises = endpoints.map(ep =>
      fetchFromTMDB(ep.url)
        .then(data => {
          if (!data || !Array.isArray(data.results)) {
            console.error(`Invalid data structure from ${ep.name} (${ep.url}):`, data);
            return [];
          }
          console.log(`Fetched ${data.results.length} items from ${ep.name}`);
          return data.results.map(item => ({ ...item, media_type_for_banner: ep.type }));
        })
        .catch(error => {
            console.error(`Error fetching or processing data from ${ep.name} (${ep.url}):`, error);
            return [];
        })
    );
    const resultsArrays = await Promise.all(allPromises);
    console.log('Raw results arrays from all endpoints for banner:', resultsArrays);

    let allItemsUnfiltered = resultsArrays.flat();
    console.log(`Total items after flattening for banner: ${allItemsUnfiltered.length}`);

    bannerItems = allItemsUnfiltered.filter(item => item && item.backdrop_path);
    console.log(`Total items after filtering for backdrop_path for banner: ${bannerItems.length}`);

    if (bannerItems.length === 0) {
      homepageBanner.style.display = 'none';
      console.warn('No suitable items found for homepage banner rotation. Banner will be hidden.');
      return;
    }

    currentBannerIndex = 0;
    updateBannerDisplay(bannerItems[currentBannerIndex]);

    // Clear any existing interval before starting a new one
    if (bannerIntervalId) {
      clearInterval(bannerIntervalId);
    }
    if (bannerItems.length > 1) { // Only rotate if there's more than one item
        bannerIntervalId = setInterval(rotateHomepageBanner, BANNER_ROTATION_INTERVAL);
        console.log(`Started banner rotation with interval ID: ${bannerIntervalId}`);
    }

  } catch (error) {
    console.error('Error loading homepage banner content. Message:', error.message, 'Full error:', error);
    if (homepageBanner) {
        homepageBanner.style.display = 'none';
        console.log('Homepage banner hidden due to critical error.');
    }
  }
}

function updateBannerDisplay(item) {
  if (!item || !homepageBanner || !homepageBannerTitle || !homepageBannerOverview) {
    console.error('Cannot update banner display: Invalid item or banner elements missing.');
    return;
  }

  const itemTitle = item.title || item.name;
  const itemOverview = item.overview;
  const backdropUrl = `${IMAGE_BASE_URL}${BACKDROP_SIZE}${item.backdrop_path}`;
  const itemType = item.media_type_for_banner || (item.title ? 'movie' : 'tv');

  console.log(`Updating banner display: Title='${itemTitle}', Type='${itemType}', ID='${item.id}'`);

  homepageBanner.style.backgroundImage = `url('${backdropUrl}')`;
  homepageBanner.dataset.id = item.id;
  homepageBanner.dataset.type = itemType;

  homepageBannerTitle.textContent = itemTitle;
  // Truncate overview if it's too long
  homepageBannerOverview.textContent = itemOverview.length > 200 ? itemOverview.substring(0, 200) + '...' : itemOverview;
  homepageBanner.style.display = 'flex';
}

function rotateHomepageBanner() {
  if (!bannerItems || bannerItems.length === 0) {
    console.log('No items to rotate in banner.');
    if (bannerIntervalId) clearInterval(bannerIntervalId); // Stop interval if no items
    return;
  }
  currentBannerIndex = (currentBannerIndex + 1) % bannerItems.length;
  console.log(`Rotating banner to index: ${currentBannerIndex}`);
  updateBannerDisplay(bannerItems[currentBannerIndex]);
}

// Watch button handler for homepage banner
function watchHomepageBannerItem() {
  window.showLoader();
  if (homepageBanner && homepageBanner.dataset.id && homepageBanner.dataset.type) {
    const id = homepageBanner.dataset.id;
    const type = homepageBanner.dataset.type;
    window.location.href = `player.html?id=${id}&type=${type}&source=homepage_banner`;
  }
}

// Load watch history (for all platforms)
async function loadWatchHistory() {
  try {
    const continueWatchingSection = document.getElementById('continue-watching-section');
    const continueWatchingGrid = document.getElementById('continue-watching-grid');

    if (!continueWatchingSection || !continueWatchingGrid) {
      console.log('[Watch History] Section elements not found');
      return;
    }

    // Get watch history from localStorage only (all platforms: web, Electron, Android, PWA)
    let watchHistory = JSON.parse(localStorage.getItem('jflix_watch_history') || '[]');
    console.log('[Watch History] Loaded from localStorage:', watchHistory.length, 'items');

    if (watchHistory.length === 0) {
      console.log('[Watch History] No history found');
      continueWatchingSection.style.display = 'none';
      return;
    }

    // Show section
    continueWatchingSection.style.display = 'block';

    // Display watch history items (limit to 20 for horizontal scroll)
    const displayItems = watchHistory.slice(0, 20);

    continueWatchingGrid.innerHTML = displayItems.map(item => {
      const posterUrl = item.poster || 'images/icon-192x192.png';
      const typeLabel = item.type === 'tv' || item.type === 'anime' || item.type === 'korean' || item.type === 'cartoon' ? 'TV' : 'Movie';
      const episodeInfo = item.season && item.episode ? `S${item.season} E${item.episode}` : '';

      // Determine the correct player URL based on media type
      let playerUrl;
      if (item.type === 'anime') {
        playerUrl = `player.html?id=${item.id}&type=anime`;
      } else if (item.type === 'korean') {
        playerUrl = `player.html?id=${item.id}&type=korean`;
      } else if (item.type === 'cartoon') {
        playerUrl = `player.html?id=${item.id}&type=cartoon`;
      } else if (item.type === 'tv') {
        playerUrl = `player.html?id=${item.id}&type=tv`;
      } else {
        playerUrl = `player.html?id=${item.id}&type=movie`;
      }

      // Add season/episode info to URL if available
      if (item.season !== null && item.episode !== null) {
        playerUrl += `&season=${item.season}&episode=${item.episode}`;
      }

      return `
        <div class="continue-watching-item" onclick="window.showLoader(); window.location.href='${playerUrl}'">
          <div class="continue-watching-poster-container">
            <img src="${posterUrl}" alt="${item.title}" class="continue-watching-poster" onerror="this.src='images/icon-192x192.png'">
            <div class="continue-watching-overlay">
              <div class="continue-watching-info">
                <div class="continue-watching-title">${item.title}</div>
                <div class="continue-watching-meta">
                  <span class="continue-watching-type">${typeLabel}</span>
                  ${episodeInfo ? `<span class="continue-watching-episode">${episodeInfo}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="continue-watching-progress">
              <div class="continue-watching-progress-bar"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    console.log('[Watch History] Loaded', displayItems.length, 'items');

    // Update navigation button states
    updateWatchHistoryNavButtons();
  } catch (error) {
    console.error('[Watch History] Error loading:', error);
  }
}

// Scroll watch history grid
function scrollWatchHistory(direction) {
  const grid = document.getElementById('continue-watching-grid');
  if (!grid) return;

  const scrollAmount = 300;
  if (direction === 'left') {
    grid.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  } else {
    grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }

  // Update button states after scroll
  setTimeout(updateWatchHistoryNavButtons, 300);
}

// Update navigation button states (enable/disable based on scroll position)
function updateWatchHistoryNavButtons() {
  const grid = document.getElementById('continue-watching-grid');
  const prevBtn = document.getElementById('continue-watching-prev');
  const nextBtn = document.getElementById('continue-watching-next');

  if (!grid || !prevBtn || !nextBtn) return;

  // Disable prev button if at start
  prevBtn.disabled = grid.scrollLeft <= 0;

  // Disable next button if at end
  const maxScroll = grid.scrollWidth - grid.clientWidth;
  nextBtn.disabled = grid.scrollLeft >= maxScroll - 10;
}

// Details button handler for homepage banner
function showHomepageBannerItemDetails() {
  window.showLoader();
  if (homepageBanner && homepageBanner.dataset.id && homepageBanner.dataset.type) {
    const id = homepageBanner.dataset.id;
    const type = homepageBanner.dataset.type;
    window.location.href = `details.html?id=${id}&type=${type}&source=homepage_banner`;
  }
}
