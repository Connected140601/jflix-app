// API Configuration
const API_KEY = '84549ba3644ea15176802ec153bd9442';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const BACKDROP_SIZE = '/original';
const POSTER_SIZE = '/w500';

// Genre IDs for filtering
const GENRES = {
  action: 28,
  comedy: 35,
  drama: 18,
  horror: 27,
  scifi: 878,
  romance: 10749
};

// Global variables
let popularBannerMovies = [];
let currentBannerMovieIndex = 0;
let bannerRotationIntervalId;
const BANNER_ROTATION_DELAY = 7000; // 7 seconds
let currentMediaType = 'movie';
let currentMediaId = null;
let searchTimeout = null;
let currentCategory = 'all';

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchModal = document.getElementById('search-modal');
const modal = document.getElementById('modal');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializePage();
  initializeFilters();
});

// Initialize the page with content
async function initializePage() {
  if (window.showLoader) window.showLoader('Loading Movies');
  try {
    // Show loading indicators
    document.querySelectorAll('.list').forEach(list => {
      list.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Loading content...</p></div>';
    });
    
    // Initialize banner with a featured movie
    await initializeBanner();
    
    // Load movie lists
    await Promise.all([
      loadPopularMovies(),
      loadTopRatedMovies(),
      loadUpcomingMovies(),
      loadNowPlayingMovies(),
      loadOscarWinners()
    ]);
    
    // Add event listeners to card buttons
    addCardEventListeners();
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

// Initialize category filter buttons
function initializeFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn[data-category]');
  
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      showLoader();
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Get category
      const category = button.dataset.category;
      currentCategory = category;
      
      // Filter content
      filterMoviesByCategory(category);
    });
  });
}

// Filter movies by category
async function filterMoviesByCategory(category) {
  try {
    // Show loading indicators
    document.querySelectorAll('.list').forEach(list => {
      list.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Loading content...</p></div>';
    });
    
    if (category === 'all') {
      // Load all categories
      await Promise.all([
        loadPopularMovies(),
        loadTopRatedMovies(),
        loadUpcomingMovies(),
        loadNowPlayingMovies(),
        loadOscarWinners()
      ]);
    } else {
      // Load movies by genre
      const genreId = GENRES[category];
      
      if (genreId) {
        const data = await fetchFromTMDB('discover/movie', { 
          with_genres: genreId,
          sort_by: 'popularity.desc'
        });
        
        // Display in all lists for better UX
        displayList(data.results, 'popular-list');
        displayList(data.results.slice(5, 10), 'top-rated-list');
        displayList(data.results.slice(10, 15), 'upcoming-list');
        displayList(data.results.slice(15, 20), 'now-playing-list');
        displayList(data.results.slice(20, 25), 'oscar-list');
      }
    }
    
    // Add event listeners to card buttons
    addCardEventListeners();
  } catch (error) {
    console.error('Error filtering movies:', error);
    document.querySelectorAll('.list').forEach(list => {
      list.innerHTML = '<div class="error-message">Failed to load content. Please try again later.</div>';
    });
  }
}

// Function to display a specific movie in the banner
function displayBannerMovie(movieIndex) {
  if (!popularBannerMovies || popularBannerMovies.length === 0) return;

  const movie = popularBannerMovies[movieIndex];
  const bannerElement = document.getElementById('banner');
  
  if (movie && movie.backdrop_path) {
    bannerElement.style.backgroundImage = `url('${IMAGE_BASE_URL}${BACKDROP_SIZE}${movie.backdrop_path}')`;
  } else {
    // Fallback if no backdrop path, or handle differently
    bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))'; 
  }
  bannerElement.dataset.id = movie.id;
  bannerElement.dataset.type = 'movie';
  
  document.getElementById('banner-title').textContent = movie.title || 'Movie Title Unavailable';
  document.getElementById('banner-overview').textContent = movie.overview || 'Overview not available.';
}

// Function to rotate to the next banner movie
function rotateBanner() {
  currentBannerMovieIndex++;
  if (currentBannerMovieIndex >= popularBannerMovies.length) {
    currentBannerMovieIndex = 0;
  }
  displayBannerMovie(currentBannerMovieIndex);
}

// Initialize the banner with a rotating display of featured movies
async function initializeBanner() {
  try {
    const data = await fetchFromTMDB('movie/popular');
    if (!data.results || data.results.length === 0) {
      console.error('No movies found for banner');
      return;
    }
    
    popularBannerMovies = data.results.slice(0, 10); // Take top 10 for rotation

    if (popularBannerMovies.length > 0) {
      currentBannerMovieIndex = 0;
      displayBannerMovie(currentBannerMovieIndex);
      
      // Clear any existing interval before starting a new one
      if (bannerRotationIntervalId) {
        clearInterval(bannerRotationIntervalId);
      }
      bannerRotationIntervalId = setInterval(rotateBanner, BANNER_ROTATION_DELAY);
    } else {
      // Fallback if no movies are fetched
      const bannerElement = document.getElementById('banner');
      bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
      document.getElementById('banner-title').textContent = 'Welcome to JFlix Movies';
      document.getElementById('banner-overview').textContent = 'Explore the best movies from around the world.';
    }
  } catch (error) {
    console.error('Error initializing banner:', error);
    const bannerElement = document.getElementById('banner');
    bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
    document.getElementById('banner-title').textContent = 'Welcome to JFlix Movies';
    document.getElementById('banner-overview').textContent = 'Explore the best movies from around the world.';
  }
}

// Load popular movies
async function loadPopularMovies() {
  try {
    const data = await fetchFromTMDB('movie/popular');
    displayList(data.results, 'popular-list');
  } catch (error) {
    console.error('Error loading popular movies:', error);
    document.getElementById('popular-list').innerHTML = '<div class="error-message">Failed to load popular movies.</div>';
  }
}

// Load top rated movies
async function loadTopRatedMovies() {
  try {
    const data = await fetchFromTMDB('movie/top_rated');
    displayList(data.results, 'top-rated-list');
  } catch (error) {
    console.error('Error loading top rated movies:', error);
    document.getElementById('top-rated-list').innerHTML = '<div class="error-message">Failed to load top rated movies.</div>';
  }
}

// Load upcoming movies
async function loadUpcomingMovies() {
  try {
    const data = await fetchFromTMDB('movie/upcoming');
    displayList(data.results, 'upcoming-list');
  } catch (error) {
    console.error('Error loading upcoming movies:', error);
    document.getElementById('upcoming-list').innerHTML = '<div class="error-message">Failed to load upcoming movies.</div>';
  }
}

// Load now playing movies
async function loadNowPlayingMovies() {
  try {
    const data = await fetchFromTMDB('movie/now_playing');
    displayList(data.results, 'now-playing-list');
  } catch (error) {
    console.error('Error loading now playing movies:', error);
    document.getElementById('now-playing-list').innerHTML = '<div class="error-message">Failed to load now playing movies.</div>';
  }
}

// Load Oscar winners (using a collection or keywords)
async function loadOscarWinners() {
  try {
    // Using a keyword for "Oscar Winner" (1701) as an example
    // In a real app, you might want to use a curated collection or a more specific approach
    const data = await fetchFromTMDB('discover/movie', {
      with_keywords: '1701',
      sort_by: 'vote_average.desc',
      'vote_count.gte': 100
    });
    displayList(data.results, 'oscar-list');
  } catch (error) {
    console.error('Error loading Oscar winners:', error);
    document.getElementById('oscar-list').innerHTML = '<div class="error-message">Failed to load Oscar winners.</div>';
  }
}

// Fetch data from TMDB API
async function fetchFromTMDB(endpoint, params = {}) {
  const queryParams = new URLSearchParams({
    api_key: API_KEY,
    ...params
  }).toString();
  
  try {
    const response = await fetch(`${BASE_URL}/${endpoint}?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    return { results: [] };
  }
}

// Display a list of media items
async function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Clear the container
  container.innerHTML = '';
  
  // Check if items exist and have length
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="no-content">No content available</div>';
    return;
  }
  
  // Add class if few items
  if (items.length < 5) {
    container.classList.add('few-items');
  } else {
    container.classList.remove('few-items');
  }
  
  // Create and append cards
  let cardsAdded = 0;
  for (const item of items) {
    const card = await createMediaCard(item);
    if (card) {
      container.appendChild(card);
      cardsAdded++;
    }
  }
  
  // If no cards were added (e.g., all items had no poster), show message
  if (cardsAdded === 0) {
    container.innerHTML = '<div class="no-content">No content available</div>';
  }
}

// Create a media card
async function createMediaCard(item) {
  if (!item.poster_path) return null;
  
  // Clone the template
  const template = document.getElementById('media-card-template');
  const card = template.content.cloneNode(true);
  
  // Set card data
  card.querySelector('.media-card').dataset.id = item.id;
  
  // Determine type and title
  const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  card.querySelector('.media-card').dataset.type = type;
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
    } catch (error) {
      console.warn(`Could not fetch latest season poster for TV series ${item.id}:`, error);
      // Fallback to original poster_path if fetching season details fails
    }
  }
  
  // Set poster image
  const posterUrl = `${IMAGE_BASE_URL}${POSTER_SIZE}${posterPath}`;
  card.querySelector('.card-poster').src = posterUrl;
  card.querySelector('.card-poster').alt = title;
  
  // Set title
  card.querySelector('.card-title').textContent = title;
  
  // Set year
  const releaseDate = type === 'movie' ? item.release_date : item.first_air_date;
  if (releaseDate) {
    const year = new Date(releaseDate).getFullYear();
    card.querySelector('.card-year').textContent = year;
  } else {
    card.querySelector('.card-year').textContent = 'Unknown';
  }
  
  // Set rating
  const rating = Math.round(item.vote_average * 10) / 10;
  const ratingElement = card.querySelector('.card-rating');
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
          media_type: type,
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
  
  return card;
}

// Add event listeners to card buttons
function addCardEventListeners() {
  // Watch buttons
  document.querySelectorAll('.watch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.media-card');
      if (card) {
        const id = card.dataset.id;
        const type = card.dataset.type || 'movie';
        showLoader();
        window.location.href = `player.html?id=${id}&type=${type}`;
      }
    });
  });
  
  // Details buttons
  document.querySelectorAll('.details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.media-card');
      if (card) {
        const id = card.dataset.id;
        const type = card.dataset.type || 'movie';
        showLoader();
        window.location.href = `details.html?id=${id}&type=${type}`;
      }
    });
  });
  
  // Card click for quick view
  document.querySelectorAll('.media-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const type = card.dataset.type || 'movie';
      showQuickView(id, type);
    });
  });
}

// Watch featured movie
function watchFeatured() {
  const banner = document.getElementById('banner');
  const id = banner.dataset.id;
  const type = banner.dataset.type;
  if (id && type) {
    window.location.href = `player.html?id=${id}&type=${type}`;
  }
}

// Show featured movie details
function showFeaturedDetails() {
  const banner = document.getElementById('banner');
  const id = banner.dataset.id;
  const type = banner.dataset.type;
  if (id && type) {
    window.location.href = `details.html?id=${id}&type=${type}`;
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
    
    // Fetch movie details
    const movie = await fetchFromTMDB(`movie/${id}`);
    
    // Set modal content
    document.getElementById('modal-image').src = `${IMAGE_BASE_URL}${POSTER_SIZE}${movie.poster_path}`;
    document.getElementById('modal-title').textContent = movie.title;
    
    // Set year
    if (movie.release_date) {
      const year = new Date(movie.release_date).getFullYear();
      document.getElementById('modal-year').textContent = year;
    } else {
      document.getElementById('modal-year').textContent = 'Unknown';
    }
    
    // Set runtime
    if (movie.runtime) {
      document.getElementById('modal-runtime').textContent = `${movie.runtime} min`;
    } else {
      document.getElementById('modal-runtime').textContent = 'Unknown';
    }
    
    // Set rating
    const rating = Math.round(movie.vote_average * 10) / 10;
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
    if (movie.genres && movie.genres.length > 0) {
      movie.genres.forEach(genre => {
        const genreTag = document.createElement('span');
        genreTag.className = 'genre-tag';
        genreTag.textContent = genre.name;
        genresElement.appendChild(genreTag);
      });
    } else {
      genresElement.innerHTML = '<span class="no-genres">No genres available</span>';
    }
    
    // Set description
    document.getElementById('modal-description').textContent = movie.overview || 'No description available';
  } catch (error) {
    console.error('Error showing quick view:', error);
    document.getElementById('modal-description').textContent = 'Failed to load details. Please try again later.';
  }
}

// Close modal
function closeModal() {
  modal.classList.remove('show');
}

// Watch movie from modal
function watchMovie() {
  if (currentMediaId && currentMediaType) {
    window.location.href = `player.html?id=${currentMediaId}&type=${currentMediaType}`;
  }
}

// View movie details from modal
function viewDetails() {
  if (currentMediaId && currentMediaType) {
    window.location.href = `details.html?id=${currentMediaId}&type=${currentMediaType}`;
  }
}



// Helper function to open share modal for the currently featured banner item
// Assumes openShareModal, closeShareModal, copyShareLink are globally available from common.js
function openShareModalFeatured() {
  if (popularBannerMovies.length > 0) {
    const currentMovie = popularBannerMovies[currentBannerMovieIndex];
    if (currentMovie) {
      // Call the global openShareModal function
      if (typeof openShareModal === 'function') {
        openShareModal(currentMovie.id, 'movie', currentMovie.title, currentMovie.overview, currentMovie.poster_path);
      } else {
        console.error('openShareModal function not found. Ensure common.js is loaded.');
      }
    }
  }
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
