// API Configuration
const API_KEY = '84549ba3644ea15176802ec153bd9442';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const BACKDROP_SIZE = '/original';
const POSTER_SIZE = '/w500';

// Global variables
let popularBannerCartoons = [];
let currentBannerCartoonIndex = 0;
let bannerRotationIntervalIdCartoon;
const BANNER_ROTATION_DELAY_CARTOON = 7000; // 7 seconds
let currentMediaType = 'tv';
let currentMediaId = null;
let searchTimeout = null;

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchModal = document.getElementById('search-modal');
const modal = document.getElementById('modal');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializePage();
});

// Initialize the page with Cartoon content
async function initializePage() {
  if (window.showLoader) window.showLoader('Loading Cartoons');
  try {
    // Show loading indicators
    document.querySelectorAll('.list').forEach(list => {
      list.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Loading content...</p></div>';
    });
    
    // Initialize banner with a featured cartoon
    await initializeBanner();
    
    // Load Cartoon lists
    await Promise.all([
      loadCartoonMovies(),
      loadPopularCartoons(),
      loadTopRatedCartoons(),
      loadRecentCartoons(),
      loadAiringCartoons()
    ]);
  } catch (error) {
    console.error('Error initializing page:', error);
    document.querySelectorAll('.list').forEach(list => {
      list.innerHTML = '<div class="error-message">Failed to load content. Please try again later.</div>';
    });
  } finally {
    if (window.hideLoader) window.hideLoader();
    if (window.injectFooter) window.injectFooter();
  }
}

// Function to display a specific cartoon in the banner
function displayBannerCartoon(cartoonIndex) {
  if (!popularBannerCartoons || popularBannerCartoons.length === 0) return;

  const cartoon = popularBannerCartoons[cartoonIndex];
  const bannerElement = document.getElementById('banner');
  
  if (cartoon && cartoon.backdrop_path) {
    bannerElement.style.backgroundImage = `url('${IMAGE_BASE_URL}${BACKDROP_SIZE}${cartoon.backdrop_path}')`;
  } else {
    // Fallback for missing backdrop
    bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))'; 
  }
  bannerElement.dataset.id = cartoon.id;
  bannerElement.dataset.type = 'tv'; // We are focusing on TV series for the banner
  
  document.getElementById('banner-title').textContent = cartoon.name || 'Cartoon Title Unavailable';
  document.getElementById('banner-overview').textContent = cartoon.overview ? (cartoon.overview.length > 200 ? cartoon.overview.substring(0, 200) + '...' : cartoon.overview) : 'Overview not available.';
}

// Function to rotate to the next banner cartoon
function rotateBannerCartoon() {
  currentBannerCartoonIndex++;
  if (currentBannerCartoonIndex >= popularBannerCartoons.length) {
    currentBannerCartoonIndex = 0;
  }
  displayBannerCartoon(currentBannerCartoonIndex);
}

// Initialize the banner with a rotating display of popular cartoon TV series
async function initializeBanner() {
  try {
    // Fetch popular cartoon TV series for the banner
    const data = await fetchFromTMDB('discover/tv', { 
      with_genres: 16, // Animation
      sort_by: 'popularity.desc',
      'vote_count.gte': 100, // Ensure some level of established popularity
      page: 1
    });

    if (!data.results || data.results.length === 0) {
      console.error('No popular cartoon TV series found for banner');
      // Fallback display
      const bannerElement = document.getElementById('banner');
      if (bannerElement) {
        bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
        document.getElementById('banner-title').textContent = 'Explore Awesome Cartoons!';
        document.getElementById('banner-overview').textContent = 'Discover a world of animated adventures.';
      }
      return;
    }

    popularBannerCartoons = data.results.slice(0, 10); // Take top 10 for rotation

    if (popularBannerCartoons.length > 0) {
      currentBannerCartoonIndex = 0;
      displayBannerCartoon(currentBannerCartoonIndex);
      
      if (bannerRotationIntervalIdCartoon) {
        clearInterval(bannerRotationIntervalIdCartoon);
      }
      bannerRotationIntervalIdCartoon = setInterval(rotateBannerCartoon, BANNER_ROTATION_DELAY_CARTOON);
    } else {
      // Fallback if, after slicing, no cartoons are available
      const bannerElement = document.getElementById('banner');
      if (bannerElement) {
        bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
        document.getElementById('banner-title').textContent = 'Explore Awesome Cartoons!';
        document.getElementById('banner-overview').textContent = 'Discover a world of animated adventures.';
      }
    }
  } catch (error) {
    console.error('Error initializing banner:', error);
    const bannerElement = document.getElementById('banner');
    if (bannerElement) {
      bannerElement.style.backgroundImage = 'url("images/default-banner.jpg")';
    }
  }
}

// Load cartoon movies
async function loadCartoonMovies() {
  try {
    const data = await fetchFromTMDB('discover/movie', { 
      with_genres: 16,
      without_genres: '12,14', // Exclude adventure and fantasy to focus more on cartoons
      sort_by: 'popularity.desc'
    });
    displayList(data.results.map(item => ({ ...item, mediaType: 'movie' })), 'cartoon-movies-list');
  } catch (error) {
    console.error('Error loading cartoon movies:', error);
    document.getElementById('cartoon-movies-list').innerHTML = '<div class="error-message">Failed to load cartoon movies.</div>';
  }
}

// Load popular cartoons
async function loadPopularCartoons() {
  try {
    const data = await fetchFromTMDB('discover/tv', { 
      with_genres: 16,
      without_genres: '12,14', // Exclude adventure and fantasy to focus more on cartoons
      sort_by: 'popularity.desc'
    });
    displayList(data.results, 'popular-list');
  } catch (error) {
    console.error('Error loading popular cartoons:', error);
    document.getElementById('popular-list').innerHTML = '<div class="error-message">Failed to load popular cartoons.</div>';
  }
}

// Load top rated cartoons
async function loadTopRatedCartoons() {
  try {
    const data = await fetchFromTMDB('discover/tv', {
      with_genres: 16,
      without_genres: '12,14', // Exclude adventure and fantasy to focus more on cartoons
      sort_by: 'vote_average.desc',
      'vote_count.gte': 100
    });
    displayList(data.results, 'top-rated-list');
  } catch (error) {
    console.error('Error loading top rated cartoons:', error.message || error);
    document.getElementById('top-rated-list').innerHTML = '<div class="error-message">Failed to load top rated cartoons.</div>';
  }
}

// Load recent cartoons
async function loadRecentCartoons() {
  try {
    const data = await fetchFromTMDB('discover/tv', { 
      with_genres: 16,
      without_genres: '12,14', // Exclude adventure and fantasy to focus more on cartoons
      sort_by: 'first_air_date.desc'
    });
    displayList(data.results, 'recent-list');
  } catch (error) {
    console.error('Error loading recent cartoons:', error);
    document.getElementById('recent-list').innerHTML = '<div class="error-message">Failed to load recent cartoons.</div>';
  }
}

// Load airing cartoons
async function loadAiringCartoons() {
  try {
    // Get current date
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    // Format dates for API
    const todayStr = today.toISOString().split('T')[0];
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];

    const data = await fetchFromTMDB('discover/tv', {
      with_genres: 16,
      without_genres: '12,14', // Exclude adventure and fantasy to focus more on cartoons
      'air_date.gte': oneMonthAgoStr,
      'air_date.lte': todayStr
    });
    displayList(data.results, 'airing-list');
  } catch (error) {
    console.error('Error loading airing cartoons:', error.message || error);
    document.getElementById('airing-list').innerHTML = '<div class="error-message">Failed to load airing cartoons.</div>';
  }
}

// Fetch data from TMDB API
async function fetchFromTMDB(endpoint, params = {}) {
  // Convert params with dots in keys to proper format
  const formattedParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.includes('.')) {
      const [mainKey, subKey] = key.split('.');
      formattedParams[mainKey + '[' + subKey + ']'] = value;
    } else {
      formattedParams[key] = value;
    }
  }
  
  // Add API key
  formattedParams.api_key = API_KEY;
  
  // Build URL
  const queryString = new URLSearchParams(formattedParams).toString();
  const url = `${BASE_URL}/${endpoint}?${queryString}`;
  
  // Fetch data
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Display a list of media items
async function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Clear loading indicator
  container.innerHTML = '';
  
  // Filter out items without poster
  const validItems = items.filter(item => item.poster_path);
  
  if (validItems.length === 0) {
    container.innerHTML = '<div class="empty-message">No content available.</div>';
    return;
  }
  
  // Create and append media cards
  for (const item of validItems) {
    const card = await createMediaCard(item);
    if (card) {
      container.appendChild(card);
    }
  }
  
  // Add scroll buttons if items overflow
  if (container.scrollWidth > container.clientWidth) {
    const scrollLeftBtn = document.createElement('button');
    scrollLeftBtn.className = 'scroll-btn scroll-left';
    scrollLeftBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    scrollLeftBtn.addEventListener('click', () => {
      container.scrollBy({ left: -300, behavior: 'smooth' });
    });
    
    const scrollRightBtn = document.createElement('button');
    scrollRightBtn.className = 'scroll-btn scroll-right';
    scrollRightBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    scrollRightBtn.addEventListener('click', () => {
      container.scrollBy({ left: 300, behavior: 'smooth' });
    });
    
    container.parentNode.appendChild(scrollLeftBtn);
    container.parentNode.appendChild(scrollRightBtn);
  }
}

// Create a media card
async function createMediaCard(item) {
  // Clone the template
  const template = document.getElementById('media-card-template');
  const card = template.content.cloneNode(true);
  
  // Determine media type and title
  const mediaType = item.mediaType || (item.first_air_date ? 'tv' : 'movie');
  const title = item.name || item.title;
  const yearText = (item.first_air_date || item.release_date) ? new Date(item.first_air_date || item.release_date).getFullYear() : 'Unknown';

  let posterPath = item.poster_path;

  // If it's a TV show, try to get the latest season's poster and add badge
  if (mediaType === 'tv') {
    try {
      const seriesDetails = await fetchFromTMDB(`tv/${item.id}`);
      if (seriesDetails) {
        // Add badge logic
        if (seriesDetails.status === 'Ended' || seriesDetails.status === 'Canceled') {
          const badge = document.createElement('div');
          badge.className = 'season-badge completed';
          badge.textContent = 'COMPLETED';
          card.querySelector('.card-poster-container').prepend(badge);
        } else if (seriesDetails.last_episode_to_air) {
          const lastEpisode = seriesDetails.last_episode_to_air;
          const seasonNumber = String(lastEpisode.season_number).padStart(2, '0');
          const episodeNumber = String(lastEpisode.episode_number).padStart(2, '0');
          const badge = document.createElement('div');
          badge.className = 'season-badge';
          badge.textContent = `S${seasonNumber}, E${episodeNumber}`;
          card.querySelector('.card-poster-container').prepend(badge);
        }

        // Existing poster logic
        if (seriesDetails.seasons && seriesDetails.seasons.length > 0) {
          const today = new Date();
          let latestAiredSeason = null;

          const sortedSeasons = [...seriesDetails.seasons].sort((a, b) => new Date(b.air_date) - new Date(a.air_date));

          for (const season of sortedSeasons) {
            if (season.air_date && new Date(season.air_date) <= today && season.poster_path) {
              latestAiredSeason = season;
              break;
            }
          }

          if (latestAiredSeason) {
            posterPath = latestAiredSeason.poster_path;
          }
        }
      }
    } catch (error) {
      console.warn(`Could not fetch series details for TV series ${item.id}:`, error);
    }
  }

  // Set poster image
  const poster = card.querySelector('.card-poster');
  if (posterPath) {
    poster.src = `${IMAGE_BASE_URL}${POSTER_SIZE}${posterPath}`;
    poster.alt = title;
  } else {
    poster.src = 'images/no-poster.png';
    poster.alt = 'No poster available';
  }
  
  // Set title
  const titleElement = card.querySelector('.card-title');
  titleElement.textContent = title;
  
  // Set rating
  const ratingElement = card.querySelector('.card-rating');
  const voteAverage = item.vote_average || 0;
  const stars = Math.round(voteAverage / 2);
  ratingElement.innerHTML = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  
  // Set year
  const yearElement = card.querySelector('.card-year');
  yearElement.textContent = yearText;
  
  // Set Match Badge
  const matchScore = Math.min(99, Math.max(84, Math.round((item.vote_average || 7) * 10 + 12)));
  const matchEl = card.querySelector('.card-match-badge');
  if (matchEl) matchEl.textContent = `${matchScore}% Match`;

  // Watchlist button
  const watchlistBtn = card.querySelector('.watchlist-btn');
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
      if (existsIndex > -1) {
        currentList.splice(existsIndex, 1);
        watchlistBtn.innerHTML = '<i class="fas fa-plus"></i>';
        watchlistBtn.classList.remove('in-watchlist');
        if (window.showToast) window.showToast(`Removed "${title}" from Watchlist`, 'info', 'fa-minus');
      } else {
        currentList.unshift({
          id: item.id,
          title: title,
          poster_path: item.poster_path,
          media_type: mediaType,
          vote_average: item.vote_average,
          saved_at: new Date().toISOString()
        });
        watchlistBtn.innerHTML = '<i class="fas fa-check"></i>';
        watchlistBtn.classList.add('in-watchlist');
        if (window.showToast) window.showToast(`Added "${title}" to Watchlist`, 'success', 'fa-bookmark');
      }
      localStorage.setItem('jflix_watchlist', JSON.stringify(currentList));
    });
  }

  // Add event listeners
  const watchBtn = card.querySelector('.watch-btn');
  watchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.showLoader();
    watchMedia(item.id, mediaType);
  });
  
  const detailsBtn = card.querySelector('.details-btn');
  detailsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.showLoader();
    viewMediaDetails(item.id, mediaType);
  });
  
  // Add click event for quick view
  const cardElement = card.querySelector('.media-card');
  cardElement.addEventListener('click', () => {
    showQuickView(item.id, mediaType);
  });
  
  // Add a movie badge if it's a movie
  if (mediaType === 'movie') {
    const cardInfo = card.querySelector('.card-info');
    const movieBadge = document.createElement('span');
    movieBadge.className = 'movie-badge';
    movieBadge.textContent = 'MOVIE';
    cardInfo.appendChild(movieBadge);
  }
  
  return card;
}

// Watch a cartoon
function watchMedia(id, type) {
  window.showLoader();
  window.location.href = `player.html?id=${id}&type=${type}`;
}

// View cartoon details
function viewMediaDetails(id, type) {
  window.showLoader();
  window.location.href = `details.html?id=${id}&type=${type}`;
}

// Show quick view modal
async function showQuickView(id, type) {
  try {
    // Show loading state
    modal.style.display = 'block';
    document.getElementById('modal-image').src = 'images/loading.gif';
    document.getElementById('modal-title').textContent = 'Loading...';
    document.getElementById('modal-overview').textContent = 'Loading details...';
    document.getElementById('modal-year').textContent = '';
    document.getElementById('modal-runtime').textContent = '';
    document.getElementById('modal-rating').innerHTML = '';
    document.getElementById('modal-genres').innerHTML = '';
    
    // Store current media for modal buttons
    currentMediaId = id;
    currentMediaType = type;
    
    // Fetch details
    let endpoint;
    if (type === 'movie') {
      endpoint = `movie/${id}`;
    } else {
      endpoint = `tv/${id}`;
    }
    
    const details = await fetchFromTMDB(endpoint);
    
    // Set modal image
    if (details.poster_path) {
      document.getElementById('modal-image').src = `${IMAGE_BASE_URL}${POSTER_SIZE}${details.poster_path}`;
    } else {
      document.getElementById('modal-image').src = 'images/no-poster.png';
    }
    
    // Set modal title
    document.getElementById('modal-title').textContent = details.title || details.name;
    
    // Set modal year
    const releaseDate = details.release_date || details.first_air_date;
    if (releaseDate) {
      document.getElementById('modal-year').textContent = new Date(releaseDate).getFullYear();
    } else {
      document.getElementById('modal-year').textContent = 'Unknown';
    }
    
    // Set modal runtime
    if (type === 'movie') {
      document.getElementById('modal-runtime').textContent = details.runtime ? `${details.runtime} min` : 'Unknown';
    } else {
      document.getElementById('modal-runtime').textContent = details.number_of_seasons ? 
        `${details.number_of_seasons} season${details.number_of_seasons !== 1 ? 's' : ''}, ${details.number_of_episodes} episode${details.number_of_episodes !== 1 ? 's' : ''}` : 
        'Unknown';
    }
    
    // Set modal rating
    const voteAverage = details.vote_average || 0;
    const stars = Math.round(voteAverage / 2);
    document.getElementById('modal-rating').innerHTML = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    
    // Set modal genres
    const genresContainer = document.getElementById('modal-genres');
    genresContainer.innerHTML = '';
    if (details.genres && details.genres.length > 0) {
      details.genres.forEach(genre => {
        const genreTag = document.createElement('span');
        genreTag.className = 'genre-tag cartoon';
        genreTag.textContent = genre.name;
        genresContainer.appendChild(genreTag);
      });
    }
    
    // Set modal overview
    document.getElementById('modal-overview').textContent = details.overview || 'No overview available.';
    
  } catch (error) {
    console.error('Error showing quick view:', error);
    closeModal();
  }
}

// Close modal
function closeModal() {
  modal.style.display = 'none';
}

// Watch featured cartoon
function watchFeatured() {
  const banner = document.getElementById('banner');
  const id = banner.getAttribute('data-id');
  const type = banner.getAttribute('data-type');
  if (id && type) {
    watchMedia(id, type);
  }
}

// Show featured cartoon details
function showFeaturedDetails() {
  const banner = document.getElementById('banner');
  const id = banner.getAttribute('data-id');
  const type = banner.getAttribute('data-type');
  if (id && type) {
    viewMediaDetails(id, type);
  }
}

// Watch cartoon from modal
function watchMovie() {
  if (currentMediaId && currentMediaType) {
    watchMedia(currentMediaId, currentMediaType);
  }
}

// View cartoon details from modal
function viewDetails() {
  if (currentMediaId && currentMediaType) {
    viewMediaDetails(currentMediaId, currentMediaType);
  }
}



// Close modals when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Close modals with Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});
