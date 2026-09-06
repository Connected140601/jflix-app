// API Configuration
const API_KEY = '84549ba3644ea15176802ec153bd9442';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const BACKDROP_SIZE = '/original';
const POSTER_SIZE = '/w500';

// Global variables
let bannerAnime = []; // Changed from topRatedBannerAnime
let currentBannerAnimeIndex = 0;
let bannerRotationIntervalIdAnime;
const BANNER_ROTATION_DELAY_ANIME = 7000; // 7 seconds
let currentMediaType = 'tv';
let currentMediaId = null;
let searchTimeout = null;

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializePage();
});

// Fallback anime data
const fallbackAnimeData = {
  movies: [
    { id: 1, title: "Demon Slayer: Mugen Train", poster_path: "/images/demon-slayer.jpg", vote_average: 8.5, release_date: "2020-10-16", mediaType: "movie", isAnimeMovie: true },
    { id: 2, title: "Your Name", poster_path: "/images/your-name.jpg", vote_average: 8.4, release_date: "2016-08-26", mediaType: "movie", isAnimeMovie: true },
    { id: 3, title: "Spirited Away", poster_path: "/images/spirited-away.jpg", vote_average: 8.6, release_date: "2001-07-20", mediaType: "movie", isAnimeMovie: true },
    { id: 4, title: "Princess Mononoke", poster_path: "/images/princess-mononoke.jpg", vote_average: 8.4, release_date: "1997-07-12", mediaType: "movie", isAnimeMovie: true },
    { id: 5, title: "Weathering with You", poster_path: "/images/weathering-with-you.jpg", vote_average: 7.5, release_date: "2019-07-19", mediaType: "movie", isAnimeMovie: true }
  ],
  series: [
    { id: 6, name: "Attack on Titan", poster_path: "/images/aot.jpg", vote_average: 9.0, first_air_date: "2013-04-07", mediaType: "tv" },
    { id: 7, name: "Death Note", poster_path: "/images/death-note.jpg", vote_average: 9.0, first_air_date: "2006-10-04", mediaType: "tv" },
    { id: 8, name: "Naruto", poster_path: "/images/naruto.jpg", vote_average: 8.3, first_air_date: "2002-10-03", mediaType: "tv" },
    { id: 9, name: "One Piece", poster_path: "/images/one-piece.jpg", vote_average: 8.7, first_air_date: "1999-10-20", mediaType: "tv" },
    { id: 10, name: "My Hero Academia", poster_path: "/images/mha.jpg", vote_average: 8.5, first_air_date: "2016-04-03", mediaType: "tv" }
  ]
};

// Initialize the page with Anime content
async function initializePage() {
  console.log('Initializing anime page...');
  if (window.showLoader) window.showLoader('Loading Anime');
  try {
    // Show loading indicators
    document.querySelectorAll('.list').forEach(list => {
      list.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Loading content...</p></div>';
    });
    
    console.log('Loading banner...');
    // Initialize banner with a featured anime
    await initializeBanner();
    
    console.log('Loading anime lists...');
    // Load Anime lists
    await Promise.all([
      loadAnimeMovies(),
      loadTopRatedAnime(),
      loadAiringAnime()
    ]);
    console.log('Anime page initialization complete!');
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

// Function to display a specific anime in the banner
function displayBannerAnime(animeIndex) {
  if (!bannerAnime || bannerAnime.length === 0) return;

  const anime = bannerAnime[animeIndex];
  const bannerElement = document.getElementById('banner');
  
  if (anime && anime.backdrop_path) {
    bannerElement.style.backgroundImage = `url('${IMAGE_BASE_URL}${BACKDROP_SIZE}${anime.backdrop_path}')`;
  } else {
    bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))'; 
  }
  bannerElement.dataset.id = anime.id;
  bannerElement.dataset.type = 'tv'; // Anime series are 'tv' type
  
  document.getElementById('banner-title').textContent = anime.name || 'Anime Title Unavailable';
  document.getElementById('banner-overview').textContent = anime.overview ? (anime.overview.length > 200 ? anime.overview.substring(0, 200) + '...' : anime.overview) : 'Overview not available.';
}

// Function to rotate to the next banner anime
function rotateBannerAnime() {
  currentBannerAnimeIndex++;
  if (currentBannerAnimeIndex >= bannerAnime.length) {
    currentBannerAnimeIndex = 0;
  }
  displayBannerAnime(currentBannerAnimeIndex);
}

// Initialize the banner with a rotating display of currently airing anime series
async function initializeBanner() {
  try {
    let airingAnime = [];
    let page = 1;
    const maxPages = 5; // Limit to prevent infinite loops

    while (airingAnime.length < 10 && page <= maxPages) {
        const data = await fetchFromTMDB('tv/on_the_air', { page });
        
        if (!data.results || data.results.length === 0) {
            break; // No more results
        }

                const animeInPage = data.results.filter(show => show.genre_ids.includes(16) && show.original_language === 'ja');
        airingAnime.push(...animeInPage);
        
        page++;
    }

    // Sort by popularity
    airingAnime.sort((a, b) => b.popularity - a.popularity);

    if (airingAnime.length === 0) {
      console.error('No currently airing anime series found for banner');
      // Fallback display
      const bannerElement = document.getElementById('banner');
      bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
      document.getElementById('banner-title').textContent = 'Welcome to JFlix Anime';
      document.getElementById('banner-overview').textContent = 'Explore the best anime from Japan and around the world.';
      return;
    }

    bannerAnime = airingAnime.slice(0, 10); // Take top 10 for rotation

    if (bannerAnime.length > 0) {
      currentBannerAnimeIndex = 0;
      displayBannerAnime(currentBannerAnimeIndex);
      
      if (bannerRotationIntervalIdAnime) {
        clearInterval(bannerRotationIntervalIdAnime);
      }
      bannerRotationIntervalIdAnime = setInterval(rotateBannerAnime, BANNER_ROTATION_DELAY_ANIME);
    } else {
      // Fallback if, after slicing, no anime are available
      const bannerElement = document.getElementById('banner');
      bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
      document.getElementById('banner-title').textContent = 'Welcome to JFlix Anime';
      document.getElementById('banner-overview').textContent = 'Explore the best anime from Japan and around the world.';
    }
  } catch (error) {
    console.error('Error initializing banner:', error);
    const bannerElement = document.getElementById('banner');
    bannerElement.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6))';
    document.getElementById('banner-title').textContent = 'Welcome to JFlix Anime';
    document.getElementById('banner-overview').textContent = 'Explore the best anime from Japan and around the world.';
  }
}

// Load anime movies
async function loadAnimeMovies() {
  console.log('Loading anime movies...');
  try {
    const data = await fetchFromTMDB('discover/movie', { 
      with_genres: 16,
      with_original_language: 'ja', // Japanese language
      sort_by: 'primary_release_date.desc',
      'primary_release_date.lte': new Date().toISOString().split('T')[0],
      page: 1,
      'vote_count.gte': 20 // Lowered vote count to include newer releases
    });
    console.log('Anime movies data:', data.results);
    // Clearly mark these as movies for display purposes
    displayList(data.results.map(item => ({ ...item, mediaType: 'movie', isAnimeMovie: true })), 'anime-movies-list');
  } catch (error) {
    console.error('Error loading anime movies:', error);
    console.log('Using fallback anime movies data...');
    // Use fallback data
    displayList(fallbackAnimeData.movies, 'anime-movies-list');
  }
}

// Load top rated anime
async function loadTopRatedAnime() {
  console.log('Loading top rated anime...');
  try {
    // Fetch top-rated anime series from TMDB
    const data = await fetchFromTMDB('discover/tv', {
      with_genres: 16, // Animation genre
      with_original_language: 'ja', // Japanese language
      sort_by: 'vote_average.desc',
      'vote_count.gte': 1000, // High vote count for quality
      page: 1
    });

    // Filter out any results that are not anime (e.g., if API returns other genres)
    const animeResults = data.results.filter(item => item.genre_ids.includes(16));

    // Sort by rating in descending order
    const sortedResults = animeResults.sort((a, b) => b.vote_average - a.vote_average);

    // Take the top 10
    const top10 = sortedResults.slice(0, 10);

    displayList(top10, 'top-rated-list');
  } catch (error) {
    console.error('Error loading top rated anime:', error);
    console.log('Using fallback top rated anime data...');
    // Use fallback data
    displayList(fallbackAnimeData.series, 'top-rated-list');
  }
}

// Load airing anime
async function loadAiringAnime() {
  console.log('Loading airing anime...');
  try {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    const formatDate = (date) => date.toISOString().split('T')[0];

    const data = await fetchFromTMDB('discover/tv', {
      with_genres: 16, // Animation
      with_original_language: 'ja',
      'first_air_date.gte': formatDate(oneYearAgo),
      'first_air_date.lte': formatDate(today),
      sort_by: 'popularity.desc',
    });

    displayList(data.results, 'airing-list');
  } catch (error) {
    console.error('Error loading airing anime:', error);
    console.log('Using fallback airing anime data...');
    // Use fallback data
    displayList(fallbackAnimeData.series, 'airing-list');
  }
}

// Fetch data from TMDB API
async function fetchFromTMDB(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.append('api_key', API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value) { // Ensure value is not null or undefined
      url.searchParams.append(key, value);
    }
  });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = { status_message: await response.text() };
      }
      const errorMessage = `API request to ${endpoint} failed with status ${response.status}: ${errorBody.status_message || 'No error message from API.'}`;
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    // Re-throw the error to be caught by the calling function, which will now have more details.
    throw error;
  }
}

// Display a list of media items
async function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Container with ID '${containerId}' not found.`);
    return;
  }

  if (items.length === 0) {
    container.innerHTML = '<p>No items to display.</p>';
    return;
  }

  container.innerHTML = ''; // Clear previous content
  for (const item of items) {
    const card = await createMediaCard(item);
    container.appendChild(card);
  }
}

// Create a media card
async function createMediaCard(item) {
  const isAnimeMovie = item.isAnimeMovie || false;
  const title = isAnimeMovie ? item.title : item.name;
  const year = isAnimeMovie 
    ? (item.release_date ? item.release_date.substring(0, 4) : 'N/A') 
    : (item.first_air_date ? item.first_air_date.substring(0, 4) : 'N/A');
  const rating = item.vote_average ? (item.vote_average / 2).toFixed(1) : 'N/A'; // Convert to 5-star rating
  let posterPath = item.poster_path ? `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}` : 'images/poster-placeholder.png';
  const mediaType = isAnimeMovie ? 'movie' : 'tv';

  // If it's a TV show, try to get the latest season's poster
  if (mediaType === 'tv') {
    try {
      const seriesDetails = await fetchFromTMDB(`tv/${item.id}`);
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
          posterPath = `${IMAGE_BASE_URL}${POSTER_SIZE}${latestAiredSeason.poster_path}`;
        }
      }
    } catch (error) {
      console.warn(`Could not fetch latest season poster for TV series ${item.id}:`, error);
    }
  }

  const matchScore = Math.min(99, Math.max(84, Math.round((item.vote_average || 7) * 10 + 12)));
  let watchlist = [];
  try { watchlist = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]'); } catch (err) {}
  const isWatchlisted = watchlist.some(w => String(w.id) === String(item.id));

  const card = document.createElement('div');
  card.className = 'media-card';
  card.innerHTML = `
    <div class="card-poster-container">
      <img class="card-poster" src="${posterPath}" alt="${title}" loading="lazy">
      <div class="card-top-badges">
        <span class="card-match-badge">${matchScore}% Match</span>
        <span class="card-hd-badge">HD</span>
      </div>
      <div class="card-overlay">
        <div class="card-buttons">
          <button class="btn watch-btn" onclick="window.showLoader(); watchMedia(${item.id}, '${mediaType}')" title="Watch Now"><i class="fas fa-play"></i> Watch</button>
          <button class="btn details-btn" onclick="window.showLoader(); viewMediaDetails(${item.id}, '${mediaType}')" title="View Details"><i class="fas fa-info-circle"></i> Details</button>
          <button class="btn watchlist-btn ${isWatchlisted ? 'in-watchlist' : ''}" title="Add to Watchlist">${isWatchlisted ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}</button>
        </div>
      </div>
    </div>
    <div class="card-info">
      <h3 class="card-title">${title}</h3>
      <div class="card-rating">${'★'.repeat(Math.round(rating / 2))}${'☆'.repeat(5 - Math.round(rating / 2))}</div>
      <p class="card-year">${year}</p>
      ${isAnimeMovie 
        ? '<span class="series-badge anime-badge">ANIME MOVIE</span>' 
        : '<span class="series-badge anime-badge">ANIME SERIES</span>'}
    </div>
  `;

  const wlBtn = card.querySelector('.watchlist-btn');
  if (wlBtn) {
    wlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let currentList = [];
      try { currentList = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]'); } catch (err) {}
      const existsIndex = currentList.findIndex(w => String(w.id) === String(item.id));
      if (existsIndex > -1) {
        currentList.splice(existsIndex, 1);
        wlBtn.innerHTML = '<i class="fas fa-plus"></i>';
        wlBtn.classList.remove('in-watchlist');
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
        wlBtn.innerHTML = '<i class="fas fa-check"></i>';
        wlBtn.classList.add('in-watchlist');
        if (window.showToast) window.showToast(`Added "${title}" to Watchlist`, 'success', 'fa-bookmark');
      }
      localStorage.setItem('jflix_watchlist', JSON.stringify(currentList));
    });
  }

  if (mediaType === 'tv') {
    try {
      const seriesDetails = await fetchFromTMDB(`tv/${item.id}`);
      if (seriesDetails) {
        const badge = document.createElement('div');
        badge.className = 'season-badge';

        if (seriesDetails.status === 'Ended' || seriesDetails.status === 'Canceled') {
          badge.classList.add('completed');
          badge.textContent = 'COMPLETED';
          card.querySelector('.card-poster-container').prepend(badge);
        } else if (seriesDetails.last_episode_to_air) {
          const lastEpisode = seriesDetails.last_episode_to_air;
          const seasonNumber = String(lastEpisode.season_number).padStart(2, '0');
          const episodeNumber = String(lastEpisode.episode_number).padStart(2, '0');
          badge.textContent = `S${seasonNumber}, E${episodeNumber}`;
          card.querySelector('.card-poster-container').prepend(badge);
        }
      }
    } catch (error) {
      console.warn(`Could not fetch series details for badge on anime ${item.id}:`, error);
    }
  }

  return card;
}

// Watch an anime
function watchMedia(id, type) {
  window.showLoader();
  window.location.href = `player.html?id=${id}&type=${type}`;
}

// View anime details
function viewMediaDetails(id, type) {
  window.showLoader();
  window.location.href = `details.html?id=${id}&type=${type}`;
}

// Watch featured anime
function watchFeatured() {
  const bannerElement = document.getElementById('banner');
  const id = bannerElement.dataset.id;
  const type = bannerElement.dataset.type;
  if (id && type) {
    watchMedia(id, type);
  }
}

// Show featured anime details
function showFeaturedDetails() {
  const bannerElement = document.getElementById('banner');
  const id = bannerElement.dataset.id;
  const type = bannerElement.dataset.type;
  if (id && type) {
    viewMediaDetails(id, type);
  }
}




