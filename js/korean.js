// API Configuration
const API_KEY = '84549ba3644ea15176802ec153bd9442';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const BACKDROP_SIZE = '/original';
const POSTER_SIZE = '/w500';

// Global variables
let topRatedOngoingKoreanDramas = [];
let currentBannerKoreanDramaIndex = 0;
let bannerRotationIntervalIdKorean;
const BANNER_ROTATION_DELAY_KOREAN = 7000; // 7 seconds
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

// Initialize the page with Korean TV content
async function initializePage() {
  if (window.showLoader) window.showLoader('Loading Korean TV');
  try {
    // Show loading indicators
    document.querySelectorAll('.list').forEach(list => {
      list.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Loading content...</p></div>';
    });
    
    // Fetch currently airing shows first
    const airingShows = await loadRecentKoreanTV();

    // Initialize banner with the airing shows
    await initializeBanner(airingShows);
    
    // Load other Korean TV lists
    await Promise.all([
      loadPopularKoreanTV(),
      loadTopRatedKoreanTV()
    ]);

    // Set up periodic refresh for the airing list and banner
    setInterval(async () => {
        const freshAiringShows = await loadRecentKoreanTV();
        // Update banner data source without re-initializing the whole banner
        topRatedOngoingKoreanDramas = freshAiringShows
            .filter(show => show.backdrop_path)
            .slice(0, 10);
    }, 1800000); // Refresh every 30 minutes

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

// Function to display a specific Korean drama in the banner
function displayBannerKoreanDrama(dramaIndex) {
  if (!topRatedOngoingKoreanDramas || topRatedOngoingKoreanDramas.length === 0) return;

  const drama = topRatedOngoingKoreanDramas[dramaIndex];
  const bannerElement = document.getElementById('banner');
  
  if (drama && drama.backdrop_path) {
    bannerElement.style.backgroundImage = `url('${IMAGE_BASE_URL}${BACKDROP_SIZE}${drama.backdrop_path}')`;
  } else {
    bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))'; 
  }
  bannerElement.dataset.id = drama.id;
  bannerElement.dataset.type = 'tv'; // Korean dramas are 'tv' type
  
  document.getElementById('banner-title').textContent = drama.name || 'Korean Drama Title Unavailable';
  document.getElementById('banner-overview').textContent = drama.overview ? (drama.overview.length > 200 ? drama.overview.substring(0, 200) + '...' : drama.overview) : 'Overview not available.';
}

// Function to rotate to the next banner Korean drama
function rotateBannerKoreanDrama() {
  currentBannerKoreanDramaIndex++;
  if (currentBannerKoreanDramaIndex >= topRatedOngoingKoreanDramas.length) {
    currentBannerKoreanDramaIndex = 0;
  }
  displayBannerKoreanDrama(currentBannerKoreanDramaIndex);
}

// Initialize the banner with a rotating display of currently airing Korean dramas
async function initializeBanner(airingShows) {
  try {
    if (!airingShows || airingShows.length === 0) {
      console.error('No currently airing Korean dramas found for banner');
      // Fallback display
      const bannerElement = document.getElementById('banner');
      bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
      document.getElementById('banner-title').textContent = 'Welcome to JFlix Korean TV';
      document.getElementById('banner-overview').textContent = 'Explore the best Korean dramas and TV shows.';
      return;
    }

    // Use the provided airing shows, filter for ones with backdrops, and take the top 10
    topRatedOngoingKoreanDramas = airingShows
        .filter(show => show.backdrop_path)
        .slice(0, 10); 

    if (topRatedOngoingKoreanDramas.length > 0) {
      currentBannerKoreanDramaIndex = 0;
      displayBannerKoreanDrama(currentBannerKoreanDramaIndex);
      
      if (bannerRotationIntervalIdKorean) {
        clearInterval(bannerRotationIntervalIdKorean);
      }
      bannerRotationIntervalIdKorean = setInterval(rotateBannerKoreanDrama, BANNER_ROTATION_DELAY_KOREAN);
    } else {
      // Fallback if no airing dramas have backdrops
      const bannerElement = document.getElementById('banner');
      bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
      document.getElementById('banner-title').textContent = 'Welcome to JFlix Korean TV';
      document.getElementById('banner-overview').textContent = 'Explore the best Korean dramas and TV shows.';
    }
  } catch (error) {
    console.error('Error initializing banner:', error);
    const bannerElement = document.getElementById('banner');
    bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
    document.getElementById('banner-title').textContent = 'Welcome to JFlix Korean TV';
    document.getElementById('banner-overview').textContent = 'Explore the best Korean dramas and TV shows.';
  }
}

// Load popular Korean TV shows
async function loadPopularKoreanTV() {
  try {
    const data = await fetchFromTMDB('discover/tv', { 
      with_original_language: 'ko',
      sort_by: 'popularity.desc'
    });
    displayList(data.results, 'popular-list');
  } catch (error) {
    console.error('Error loading popular Korean TV shows:', error);
    document.getElementById('popular-list').innerHTML = '<div class="error-message">Failed to load popular Korean TV shows.</div>';
  }
}

// Load top rated Korean TV shows
async function loadTopRatedKoreanTV() {
  try {
    const data = await fetchFromTMDB('discover/tv', { 
      with_original_language: 'ko',
      sort_by: 'vote_average.desc',
      vote_count_gte: 100
    });
    displayList(data.results, 'top-rated-list');
  } catch (error) {
    console.error('Error loading top rated Korean TV shows:', error);
    document.getElementById('top-rated-list').innerHTML = '<div class="error-message">Failed to load top rated Korean TV shows.</div>';
  }
}

// Load recently aired Korean TV shows, sorted by last episode air date
async function loadRecentKoreanTV() {
  try {
    // Fetch a broad range of candidates
    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    const formatDate = (date) => date.toISOString().split('T')[0];

    const params = {
        with_original_language: 'ko',
        'air_date.gte': formatDate(twoMonthsAgo),
        'air_date.lte': formatDate(today),
        sort_by: 'popularity.desc',
        without_genres: '10764' // Exclude Reality TV
    };

    const [page1, page2] = await Promise.all([
        fetchFromTMDB('discover/tv', { ...params, page: 1 }),
        fetchFromTMDB('discover/tv', { ...params, page: 2 })
    ]);

    const candidates = new Map();
    [...page1.results, ...page2.results].forEach(show => {
        candidates.set(show.id, show);
    });
    
    const candidateList = Array.from(candidates.values());

    // Fetch full details for each candidate to get last_episode_to_air
    const detailedShowPromises = candidateList.map(show => fetchFromTMDB(`tv/${show.id}`));
    const detailedShowList = (await Promise.all(detailedShowPromises)).filter(Boolean);

    // Filter for shows that have aired and sort by the last episode's air date
    const todayStr = new Date().toISOString().split('T')[0];
    const sortedShows = detailedShowList
        .filter(show => 
            show.first_air_date && show.first_air_date <= todayStr && // Ensure the show has started airing
            show.last_episode_to_air && 
            show.last_episode_to_air.air_date &&
            show.last_episode_to_air.air_date <= todayStr &&
            show.number_of_episodes <= 100 // Exclude shows with more than 100 episodes
        )
        .sort((a, b) => {
            const dateA = new Date(a.last_episode_to_air.air_date);
            const dateB = new Date(b.last_episode_to_air.air_date);

            // Handle cases with invalid dates to prevent unpredictable sorting
            const aIsInvalid = isNaN(dateA.getTime());
            const bIsInvalid = isNaN(dateB.getTime());

            if (aIsInvalid && bIsInvalid) return 0; // Both invalid, treat as equal
            if (aIsInvalid) return 1;  // Invalid dates go to the end
            if (bIsInvalid) return -1; // Invalid dates go to the end

            return dateB - dateA; // Sort by most recent date
        });

    displayList(sortedShows, 'recent-list');
    
    return sortedShows;

  } catch (error) {
    console.error('Error loading recently aired Korean TV shows:', error);
    document.getElementById('recent-list').innerHTML = '<div class="error-message">Failed to load recently aired Korean TV shows.</div>';
    return []; // Return empty array on error
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
  card.querySelector('.media-card').dataset.type = 'tv';
  
  let posterPath = item.poster_path;
  const mediaType = 'tv'; // Korean dramas are always TV series
  const title = item.name; // Use item.name for title

  // Try to get the latest season's poster and add season badge for TV shows
  try {
    const seriesDetails = await fetchFromTMDB(`tv/${item.id}`);
    if (seriesDetails) {
      // Season badge logic
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

      // Latest season poster logic
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

  // Set poster image
  const posterUrl = `${IMAGE_BASE_URL}${POSTER_SIZE}${posterPath}`;
  card.querySelector('.card-poster').src = posterUrl;
  card.querySelector('.card-poster').alt = title;
  
  // Set title
  card.querySelector('.card-title').textContent = title;
  
  // Set year
  const firstAirDate = item.first_air_date;
  if (firstAirDate) {
    const year = new Date(firstAirDate).getFullYear();
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
  card.querySelector('.watch-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showLoader();
    watchMedia(item.id, mediaType);
  });
  
  card.querySelector('.details-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showLoader();
    viewMediaDetails(item.id, mediaType);
  });
  
  card.querySelector('.media-card').addEventListener('click', () => {
    showQuickView(item.id, mediaType);
  });
  
  return card;
}

// Watch a Korean TV show
function watchMedia(id, type) {
  showLoader();
  window.location.href = `player.html?id=${id}&type=${type}`;
}

// View Korean TV show details
function viewMediaDetails(id, type) {
  showLoader();
  window.location.href = `details.html?id=${id}&type=${type}`;
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
    
    // Fetch Korean TV show details
    const kdrama = await fetchFromTMDB(`tv/${id}`);
    
    // Set modal content
    document.getElementById('modal-image').src = `${IMAGE_BASE_URL}${POSTER_SIZE}${kdrama.poster_path}`;
    document.getElementById('modal-title').textContent = kdrama.name;
    
    // Set year
    if (kdrama.first_air_date) {
      const year = new Date(kdrama.first_air_date).getFullYear();
      document.getElementById('modal-year').textContent = year;
    } else {
      document.getElementById('modal-year').textContent = 'Unknown';
    }
    
    // Set runtime
    if (kdrama.episode_run_time && kdrama.episode_run_time.length > 0) {
      document.getElementById('modal-runtime').textContent = `${kdrama.episode_run_time[0]} min`;
    } else {
      document.getElementById('modal-runtime').textContent = 'Unknown';
    }
    
    // Set rating
    const rating = Math.round(kdrama.vote_average * 10) / 10;
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
    if (kdrama.genres && kdrama.genres.length > 0) {
      kdrama.genres.forEach(genre => {
        const genreTag = document.createElement('span');
        genreTag.className = 'genre-tag';
        genreTag.textContent = genre.name;
        genresElement.appendChild(genreTag);
      });
    } else {
      genresElement.innerHTML = '<span class="no-genres">No genres available</span>';
    }
    
    // Set description
    document.getElementById('modal-description').textContent = kdrama.overview || 'No description available';
  } catch (error) {
    console.error('Error showing quick view:', error);
    document.getElementById('modal-description').textContent = 'Failed to load details. Please try again later.';
  }
}

// Close modal
function closeModal() {
  modal.classList.remove('show');
}

// Watch featured Korean TV show
function watchFeatured() {
  const banner = document.getElementById('banner');
  const id = banner.dataset.id;
  const type = banner.dataset.type;
  if (id && type) {
    watchMedia(id, type);
  }
}

// Show featured Korean TV show details
function showFeaturedDetails() {
  const banner = document.getElementById('banner');
  const id = banner.dataset.id;
  const type = banner.dataset.type;
  if (id && type) {
    viewMediaDetails(id, type);
  }
}

// Watch Korean TV show from modal
function watchMovie() {
  if (currentMediaId && currentMediaType) {
    watchMedia(currentMediaId, currentMediaType);
  }
}

// View Korean TV show details from modal
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

// Close modals when pressing Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});
