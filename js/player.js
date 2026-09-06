// JFlix Player v9.0 - Modern Design
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// Media types
const MEDIA_TYPES = {
  MOVIES: 'movie',
  TV: 'tv',
  ANIME: 'anime',
  KOREAN: 'korean',
  CARTOON: 'cartoon'
};

// Native app detection (Electron, Android, and iOS wrapper with unique user agent)
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
console.log('[Watch History Detection] IS_ELECTRON:', window.IS_ELECTRON);
console.log('[Watch History Detection] IS_ANDROID_WEBVIEW:', window.IS_ANDROID_WEBVIEW);
console.log('[Watch History Detection] IS_NATIVE_APP:', window.IS_NATIVE_APP);
console.log('[Watch History Detection] User Agent:', navigator.userAgent);
console.log('[Watch History Detection] window.IS_ANDROID:', typeof window.IS_ANDROID !== 'undefined' ? window.IS_ANDROID : 'undefined');
console.log('[Watch History Detection] localStorage jflix_is_android:', localStorage.getItem('jflix_is_android'));

// Watch history tracking (all platforms)
function saveToWatchHistory(id, type, title, poster, season = null, episode = null) {
  console.log('[Watch History] saveToWatchHistory called with:', { id, type, title, poster, season, episode });
  try {
    const historyItem = {
      id: id,
      type: type,
      title: title,
      poster: poster,
      season: season,
      episode: episode,
      timestamp: new Date().toISOString()
    };

    // Get existing history from localStorage
    let watchHistory = JSON.parse(localStorage.getItem('jflix_watch_history') || '[]');
    console.log('[Watch History] Existing history count:', watchHistory.length);

    // Remove duplicate entries for the same content
    watchHistory = watchHistory.filter(item => item.id !== id);

    // Add new entry at the beginning
    watchHistory.unshift(historyItem);

    // Keep only last 50 entries in localStorage
    if (watchHistory.length > 50) {
      watchHistory = watchHistory.slice(0, 50);
    }

    // Save to localStorage (all platforms)
    localStorage.setItem('jflix_watch_history', JSON.stringify(watchHistory));

    console.log('[Watch History] Saved to localStorage:', historyItem);
    console.log('[Watch History] Total items in localStorage:', watchHistory.length);
  } catch (error) {
    console.error('[Watch History] Error saving:', error);
  }
}

// Watch history is localStorage-only across all platforms (web, Electron, Android, PWA)

// Video server URLs
const SERVER_URLS = {
  '111movies': 'https://111movies.com/', // Server 1: 111Movies (vidlove player)
  videasy: 'https://vsembed.ru/embed/', // Server 2: Using VidSrc.xyz
  '2embed': 'https://player.videasy.net/', // Server 3: Using Videasy.to (player.videasy.net)
  vidlink: 'https://vidlink.pro/', // Server 4: VidLink.pro (jwplayer)
  multiembed: 'https://multiembed.mov/?video_id=', // Server 5: Multiembed
  zxcstream: 'https://v4.zxcstream.xyz/embed/' // Server 6: ZXCStream
};

// Server display names
const SERVER_NAMES = {
  '111movies': 'Server 1',
  videasy: 'Server 2',
  '2embed': 'Server 3',
  vidlink: 'Server 4',
  multiembed: 'Server 5',
  zxcstream: 'Server 6'
};

// Global variables
let mediaId;
let mediaType;
let mediaDetails;
let recommendedMedia;
// Set default server (Server 1 is accessible across all platforms)
let currentServer = '111movies';

// Player iframe load state
let videoLoadToken = 0;
let videoLoadTimeoutId = null;

// Screen wake lock
let wakeLock = null;

// Request screen wake lock to prevent screen from turning off
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[Wake Lock] Screen wake lock active');
      wakeLock.addEventListener('release', () => {
        console.log('[Wake Lock] Screen wake lock released');
        wakeLock = null;
      });
    } catch (err) {
      // Wake lock not supported or denied - fail silently
      console.log('[Wake Lock] Not available (this is normal on desktop or some browsers)');
    }
  }
}

// Release screen wake lock
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// Custom fullscreen code has been removed.
// The native fullscreen / built-in fullscreen of each video server's iframe
// player is used instead. The iframe has allowfullscreen and allow="fullscreen"
// attributes so the server's own fullscreen button works 100%.

// Fetch data from TMDB API
async function fetchFromTMDB(endpoint, params = {}) {
  const queryParams = new URLSearchParams({
    api_key: API_KEY,
    ...params
  }).toString();
  
  try {
    const response = await fetch(`${BASE_URL}/${endpoint}?${queryParams}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

// Get URL parameters
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  mediaId = params.get('id');
  mediaType = params.get('type');
  const source = params.get('source');

  // Read initial season/episode from URL (e.g. from details.html episode click)
  const urlSeason = params.get('season');
  const urlEpisode = params.get('episode');
  if (urlSeason) currentActiveSeason = parseInt(urlSeason, 10);
  if (urlEpisode) currentActiveEpisode = parseInt(urlEpisode, 10);
  
  // Default to movie if no type specified
  if (!mediaType) mediaType = 'movie';
  
  // Validate media type
  if (!['movie', 'tv', 'anime', 'korean', 'cartoon'].includes(mediaType)) {
    mediaType = 'movie';
  }
  
  // Ensure we're using the original player page styling for all content types
  document.querySelector('body').classList.add('original-style');
}

// Fetch media details
async function fetchMediaDetails() {
  // Determine the correct endpoint based on media type
  let endpoint;
  if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) {
    endpoint = `movie/${mediaId}`;
  } else {
    endpoint = `tv/${mediaId}`;
  }
  
  const details = await fetchFromTMDB(endpoint);

  // If it's a TV show, find the latest season's poster
  if (mediaType === 'tv' || mediaType === MEDIA_TYPES.TV_SHOWS) {
    const today = new Date();
    let latestSeason = null;

    // Filter out future seasons and find the latest aired season
    const airedSeasons = details.seasons.filter(season => new Date(season.air_date) <= today);

    if (airedSeasons.length > 0) {
      // Sort by air_date descending to find the latest aired season
      airedSeasons.sort((a, b) => new Date(b.air_date) - new Date(a.air_date));
      latestSeason = airedSeasons[0];
    } else if (details.seasons.length > 0) {
      // Fallback: if no seasons have aired, use the season with the highest season_number
      details.seasons.sort((a, b) => b.season_number - a.season_number);
      latestSeason = details.seasons[0];
    }

    if (latestSeason && latestSeason.poster_path) {
      // Fetch detailed season information to get its specific poster_path
      const seasonDetails = await fetchFromTMDB(`tv/${mediaId}/season/${latestSeason.season_number}`);
      if (seasonDetails && seasonDetails.poster_path) {
        details.poster_path = seasonDetails.poster_path;
      }
    }
  }

  return details;
}

// Fetch recommended media
async function fetchRecommendedMedia() {
  // Determine the correct endpoint based on media type
  let endpoint;
  if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) {
    endpoint = `movie/${mediaId}/recommendations`;
  } else {
    endpoint = `tv/${mediaId}/recommendations`;
  }
  
  const data = await fetchFromTMDB(endpoint);
  
  if (data && data.results) {
    // Add media type to each item
    return data.results.map(item => {
      // Determine the correct media type for recommended items
      let itemType;
      if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) {
        itemType = MEDIA_TYPES.MOVIES;
      } else if (mediaType === MEDIA_TYPES.ANIME) {
        itemType = MEDIA_TYPES.ANIME;
      } else if (mediaType === MEDIA_TYPES.KOREAN) {
        itemType = MEDIA_TYPES.KOREAN;
      } else {
        itemType = MEDIA_TYPES.TV;
      }
      
      return { ...item, mediaType: itemType };
    });
  }
  
  return [];
}

// Generate structured data for SEO
function generateStructuredData() {
  if (!mediaDetails) return;

  const schema = {
    '@context': 'https://schema.org',
    '@type': mediaType === 'movie' ? 'Movie' : 'TVSeries',
    'name': mediaDetails.title || mediaDetails.name,
    'description': mediaDetails.overview,
    'image': mediaDetails.poster_path ? `${IMG_URL}${mediaDetails.poster_path}` : 'https://jflix.uk/images/no-poster.jpg',
    'url': window.location.href,
    'datePublished': mediaType === 'movie' ? mediaDetails.release_date : mediaDetails.first_air_date,
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': mediaDetails.vote_average ? mediaDetails.vote_average.toFixed(1) : '0',
      'bestRating': '10',
      'ratingCount': mediaDetails.vote_count || 0
    },
    'genre': mediaDetails.genres ? mediaDetails.genres.map(g => g.name).join(', ') : '',
    'actor': mediaCredits && mediaCredits.cast ? mediaCredits.cast.slice(0, 5).map(p => ({
      '@type': 'Person',
      'name': p.name,
      'character': p.character
    })) : []
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

// Update SEO meta tags dynamically for social sharing and search suggestions
function updateSEOMetaTags(title, description, image, url) {
  document.title = title;

  var desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', description);

  var ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);

  var ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', description);

  var ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', image);

  var ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', url);

  var twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', title);

  var twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', description);

  var twImage = document.querySelector('meta[property="twitter:image"]');
  if (twImage) twImage.setAttribute('content', image);

  var canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', url);
}

// Display media details
function displayMediaDetails() {
  if (!mediaDetails) return;

  const mediaTitle = mediaDetails.title || mediaDetails.name;
  const mediaYear = mediaDetails.release_date || mediaDetails.first_air_date ?
    (mediaDetails.release_date || mediaDetails.first_air_date).split('-')[0] : '';
  const seoTitle = `Watch ${mediaTitle}${mediaYear ? ' (' + mediaYear + ')' : ''} on JFlix - Free Streaming`;
  const seoDescription = mediaDetails.overview ?
    `Stream ${mediaTitle} on JFlix for free. ${mediaDetails.overview.substring(0, 150)}${mediaDetails.overview.length > 150 ? '...' : ''}` :
    `Watch ${mediaTitle} on JFlix - free streaming of movies, TV shows, anime, and K-dramas.`;
  const seoImage = mediaDetails.poster_path ? `${IMG_URL}${mediaDetails.poster_path}` : 'https://jflix.uk/images/no-poster.jpg';

  updateSEOMetaTags(seoTitle, seoDescription, seoImage, window.location.href);
  
  // Set banner
  const banner = document.getElementById('movie-banner');
  if (banner && mediaDetails.backdrop_path) {
    banner.style.backgroundImage = `url(${IMG_URL}${mediaDetails.backdrop_path})`;
  }
  
  // Set title
  const title = document.getElementById('movie-title');
  if (title) title.textContent = mediaDetails.title || mediaDetails.name;
  
  // Set info year
  const infoYear = document.getElementById('info-year');
  if (infoYear) {
    const releaseDate = mediaDetails.release_date || mediaDetails.first_air_date;
    infoYear.textContent = releaseDate ? releaseDate.split('-')[0] : 'N/A';
  }
  
  // Set info runtime
  const infoRuntime = document.getElementById('info-runtime');
  if (infoRuntime) {
    if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) {
      infoRuntime.textContent = mediaDetails.runtime ? `${mediaDetails.runtime} min` : 'N/A';
    } else {
      const episodes = mediaDetails.number_of_episodes || 'N/A';
      const seasons = mediaDetails.number_of_seasons || 'N/A';
      infoRuntime.textContent = `${seasons} season${seasons !== 1 ? 's' : ''}, ${episodes} episode${episodes !== 1 ? 's' : ''}`;
    }
  }
  
  // Set info rating
  const infoRating = document.getElementById('info-rating');
  if (infoRating) {
    const stars = Math.round((mediaDetails.vote_average || 0) / 2);
    infoRating.innerHTML = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }
  
  // Set info genres
  const infoGenres = document.getElementById('info-genres');
  const infoGenresSidebar = document.getElementById('info-genres-sidebar');
  
  if ((infoGenres || infoGenresSidebar) && mediaDetails.genres) {
    // Add media type class to genre tags
    let genreClass = '';
    if (mediaType === MEDIA_TYPES.ANIME) {
      genreClass = 'anime';
    } else if (mediaType === MEDIA_TYPES.KOREAN) {
      genreClass = 'korean';
    } else if (mediaType === MEDIA_TYPES.CARTOON) {
      genreClass = 'cartoon';
    } else if (mediaType === 'tv' || mediaType === MEDIA_TYPES.TV) {
      genreClass = 'tvshows';
    } else if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) {
      genreClass = 'movies';
    }
    
    // Create genre tags
    const genreTags = mediaDetails.genres.map(genre => {
      const genreTag = document.createElement('span');
      genreTag.className = `genre-tag ${genreClass}`;
      genreTag.textContent = genre.name;
      return genreTag;
    });
    
    // Add to main info
    if (infoGenres) {
      infoGenres.innerHTML = '';
      genreTags.forEach(tag => infoGenres.appendChild(tag.cloneNode(true)));
    }
    
    // Add to sidebar
    if (infoGenresSidebar) {
      infoGenresSidebar.innerHTML = '';
      genreTags.forEach(tag => infoGenresSidebar.appendChild(tag.cloneNode(true)));
    }
  }
  
  // Set player type title
  const playerTypeTitle = document.getElementById('player-type-title');
  if (playerTypeTitle) {
    if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) {
      playerTypeTitle.textContent = 'Movie Player';
    } else if (mediaType === MEDIA_TYPES.ANIME) {
      playerTypeTitle.textContent = 'Anime Player';
    } else if (mediaType === MEDIA_TYPES.KOREAN) {
      playerTypeTitle.textContent = 'K-Drama Player';
    } else if (mediaType === MEDIA_TYPES.CARTOON) {
      playerTypeTitle.textContent = 'Cartoon Player';
    } else {
      playerTypeTitle.textContent = 'TV Show Player';
    }
  }
  
  // Set movie info title
  const movieInfoTitle = document.querySelector('.movie-info h4');
  if (movieInfoTitle) {
    movieInfoTitle.textContent = mediaDetails.title || mediaDetails.name;
  }
  
  // Set budget/revenue or seasons/episodes
  if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) {
    // Set labels for movies
    const budgetLabel = document.getElementById('info-budget-label');
    if (budgetLabel) budgetLabel.textContent = 'Budget:';
    
    const revenueLabel = document.getElementById('info-revenue-label');
    if (revenueLabel) revenueLabel.textContent = 'Box Office:';
    
    const releaseDateLabel = document.querySelector('.detail-item:nth-child(1) .detail-label');
    if (releaseDateLabel) releaseDateLabel.textContent = 'Release Date:';
    
    // Set values for movies
    const budget = document.getElementById('info-budget');
    if (budget) {
      budget.textContent = mediaDetails.budget ? `$${formatNumber(mediaDetails.budget)}` : 'N/A';
    }
    
    const revenue = document.getElementById('info-revenue');
    if (revenue) {
      revenue.textContent = mediaDetails.revenue ? `$${formatNumber(mediaDetails.revenue)}` : 'N/A';
    }
    
    const releaseDate = document.querySelector('.detail-item:nth-child(1) .detail-value');
    if (releaseDate) {
      releaseDate.textContent = mediaDetails.release_date ? formatDate(mediaDetails.release_date) : 'N/A';
    }
  } else {
    // Set labels for TV shows
    const budgetLabel = document.getElementById('info-budget-label');
    if (budgetLabel) budgetLabel.textContent = 'Seasons:';
    
    const revenueLabel = document.getElementById('info-revenue-label');
    if (revenueLabel) revenueLabel.textContent = 'Episodes:';
    
    const releaseDateLabel = document.querySelector('.detail-item:nth-child(1) .detail-label');
    if (releaseDateLabel) releaseDateLabel.textContent = 'First Air Date:';
    
    // Set values for TV shows
    const budget = document.getElementById('info-budget');
    if (budget) {
      budget.textContent = mediaDetails.number_of_seasons || 'N/A';
    }
    
    const revenue = document.getElementById('info-revenue');
    if (revenue) {
      revenue.textContent = mediaDetails.number_of_episodes || 'N/A';
    }
    
    const releaseDate = document.querySelector('.detail-item:nth-child(1) .detail-value');
    if (releaseDate) {
      releaseDate.textContent = mediaDetails.first_air_date ? formatDate(mediaDetails.first_air_date) : 'N/A';
    }
  }
  
  // Set overview
  const infoOverview = document.getElementById('info-overview');
  if (infoOverview) {
    infoOverview.textContent = mediaDetails.overview || 'No overview available.';
  }
  
  // Set runtime
  const runtimeValue = document.querySelector('.detail-item:nth-child(2) .detail-value');
  if (runtimeValue) {
    if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) {
      runtimeValue.textContent = mediaDetails.runtime ? `${mediaDetails.runtime} min` : 'N/A';
    } else {
      const episodes = mediaDetails.number_of_episodes || 'N/A';
      const seasons = mediaDetails.number_of_seasons || 'N/A';
      runtimeValue.textContent = `${seasons} season${seasons !== 1 ? 's' : ''}, ${episodes} episode${episodes !== 1 ? 's' : ''}`;
    }
  }
  
  // Set rating
  const ratingValue = document.querySelector('.detail-item:nth-child(3) .detail-value');
  if (ratingValue) {
    ratingValue.textContent = mediaDetails.vote_average ? `${mediaDetails.vote_average.toFixed(1)}/10` : 'N/A';
  }
  
  // Set language
  const languageValue = document.querySelector('.detail-item:nth-child(4) .detail-value');
  if (languageValue) {
    const languages = mediaDetails.spoken_languages || [];
    languageValue.textContent = languages.length > 0 ? languages[0].english_name : 'N/A';
  }
  
  // Add episode selector for TV shows
  if (mediaType !== 'movie' && mediaType !== MEDIA_TYPES.MOVIES) {
    addEpisodeSelector();
  }

  // Initialize download buttons
  initializeDownloadButtons();
}

// Add episode selector for TV shows
async function addEpisodeSelector() {
  if (!mediaDetails || !mediaDetails.seasons || mediaDetails.seasons.length === 0) return;

  // Create episode selector container
  const episodeSelector = document.createElement('div');
  episodeSelector.className = 'episode-selector';
  episodeSelector.id = 'episode-selector-container';

  // Create heading
  const heading = document.createElement('h4');
  heading.textContent = 'Episodes';
  episodeSelector.appendChild(heading);
  
  // Create season tabs
  const seasonTabs = document.createElement('div');
  seasonTabs.className = 'season-tabs';
  
  // Add media type class
  let seasonTabClass = '';
  if (mediaType === MEDIA_TYPES.ANIME) {
    seasonTabClass = 'anime';
  } else if (mediaType === MEDIA_TYPES.KOREAN) {
    seasonTabClass = 'korean';
  } else if (mediaType === MEDIA_TYPES.CARTOON) {
    seasonTabClass = 'cartoon';
  } else {
    seasonTabClass = 'tvshows';
  }
  
  // Filter out season 0, empty seasons, and seasons that have NOT been released yet.
  // Only seasons that have already started airing are shown (missing air date = assume released).
  const validSeasons = mediaDetails.seasons
    .filter(season => season.episode_count > 0 && season.season_number > 0)
    .filter(season => !season.air_date || new Date(season.air_date) <= new Date())
    .sort((a, b) => b.season_number - a.season_number);

  // Nothing has been released yet — do not show an empty episode section
  if (validSeasons.length === 0) return;

  // Latest released season (list is sorted newest-first and every season here has aired)
  const latestReleasedSeason = validSeasons[0];

  // Add season tabs
  for (const season of validSeasons) {
    const seasonTab = document.createElement('button');
    seasonTab.textContent = `Season ${season.season_number}`;
    seasonTab.setAttribute('data-season', season.season_number);
    seasonTab.className = 'season-tab';

    // Set the latest released season as default active
    if (season.season_number === latestReleasedSeason.season_number) {
      seasonTab.classList.add('active');
      seasonTab.classList.add(seasonTabClass);
    }

    seasonTab.addEventListener('click', async () => {
      // Remove active class from all tabs
      document.querySelectorAll('.season-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.classList.remove(seasonTabClass);
      });
      
      // Add active class to clicked tab
      seasonTab.classList.add('active');
      seasonTab.classList.add(seasonTabClass);
      
      // Fetch detailed season information
      const detailedSeason = await fetchDetailedSeason(mediaId, season.season_number);
      if (detailedSeason) {
        // Update episodes grid with detailed season info
        updateEpisodesGrid(detailedSeason);
      }
    });
    
    seasonTabs.appendChild(seasonTab);
  }

  episodeSelector.appendChild(seasonTabs);
  
  // Create episodes grid
  const episodesGrid = document.createElement('div');
  episodesGrid.className = 'episodes-grid';
  episodesGrid.id = 'episodes-grid';
  episodeSelector.appendChild(episodesGrid);
  
  // Add episode selector to player box
  const playerBox = document.querySelector('.player-box');
  const videoContainer = document.querySelector('.video-container');
  const recommendationsContainer = document.querySelector('.movie-recommendations-container');
  const viewsReactionsCommentsContainer = document.getElementById('views-reactions-comments-container');

  if (playerBox) {
    // First, remove the recommendations container if it exists
    if (recommendationsContainer && recommendationsContainer.parentNode) {
      recommendationsContainer.parentNode.removeChild(recommendationsContainer);
    }

    
    // Insert the episode selector directly after video container
    if (videoContainer && videoContainer.parentNode) {
      videoContainer.parentNode.insertBefore(episodeSelector, videoContainer.nextSibling);
    } else {
      // Fallback: just append to player box
      playerBox.appendChild(episodeSelector);
    }

    // Move views-reactions-comments container to be after episode selector
    if (viewsReactionsCommentsContainer && episodeSelector.parentNode) {
      episodeSelector.parentNode.insertBefore(viewsReactionsCommentsContainer, episodeSelector.nextSibling);
    }

    // Now add the recommendations container after the views-reactions-comments container
    if (recommendationsContainer && viewsReactionsCommentsContainer && viewsReactionsCommentsContainer.parentNode) {
      viewsReactionsCommentsContainer.parentNode.insertBefore(recommendationsContainer, viewsReactionsCommentsContainer.nextSibling);
    } else if (recommendationsContainer && episodeSelector.parentNode) {
      episodeSelector.parentNode.insertBefore(recommendationsContainer, episodeSelector.nextSibling);
    }

    // Initialize episodes grid:
    // Prefer URL-specified season (set in currentActiveSeason via getUrlParams),
    // otherwise fall back to the latest released season.
    const seasonToLoad = validSeasons.find(s => s.season_number === currentActiveSeason) || latestReleasedSeason;

    if (seasonToLoad) {
      // Mark the correct tab as active
      document.querySelectorAll('.season-tab').forEach(tab => {
        tab.classList.remove('active', seasonTabClass);
        if (parseInt(tab.getAttribute('data-season')) === seasonToLoad.season_number) {
          tab.classList.add('active', seasonTabClass);
          // Scroll tab into view on mobile
          tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      });

      fetchDetailedSeason(mediaId, seasonToLoad.season_number).then(detailedSeason => {
        if (detailedSeason) {
          updateEpisodesGrid(detailedSeason);
        }
      });
    }
  }
}

// New helper function to fetch detailed season information
async function fetchDetailedSeason(mediaId, seasonNumber) {
  const endpoint = `tv/${mediaId}/season/${seasonNumber}`;
  return await fetchFromTMDB(endpoint);
}
// Current episodes state for view switching & next episode playback
let currentSeasonData = null;
let currentActiveSeason = 1;
let currentActiveEpisode = 1;
let episodeViewMode = localStorage.getItem('jflix_ep_view_mode') || 'cards'; // 'cards' or 'grid'

// Cinema Controls: Ambient Glow, Theater Mode, Dim Lights, Next Episode
window.toggleAmbientGlow = function() {
  document.body.classList.toggle('ambient-off');
  const isOff = document.body.classList.contains('ambient-off');
  const statusEl = document.getElementById('ambient-status-text');
  const btn = document.getElementById('btn-ambient-glow');
  if (statusEl) statusEl.textContent = isOff ? 'OFF' : 'ON';
  if (btn) btn.classList.toggle('active', !isOff);
  localStorage.setItem('jflix_ambient_glow', isOff ? 'off' : 'on');
  if (window.showToast) window.showToast(isOff ? 'Ambient Backlight disabled' : 'Ambient Backlight enabled', 'info', 'fa-sun');
};

window.toggleTheaterMode = function() {
  document.body.classList.toggle('theater-mode-active');
  const isActive = document.body.classList.contains('theater-mode-active');
  const btn = document.getElementById('btn-theater-mode');
  if (btn) btn.classList.toggle('active', isActive);
  if (window.showToast) window.showToast(isActive ? 'Theater Mode enabled' : 'Theater Mode disabled', 'info', 'fa-expand-alt');
};

window.toggleDimLights = function() {
  document.body.classList.toggle('dim-lights-active');
  const isActive = document.body.classList.contains('dim-lights-active');
  const btn = document.getElementById('btn-dim-lights');
  if (btn) btn.classList.toggle('active', isActive);
  if (window.showToast) window.showToast(isActive ? 'Cinema Lights dimmed' : 'Cinema Lights restored', 'info', 'fa-lightbulb');
};

window.playNextEpisode = function() {
  if (window.nextEpisodeData) {
    loadEpisode(window.nextEpisodeData.season, window.nextEpisodeData.episode);
    if (window.showToast) {
      window.showToast(`Now Playing Episode ${window.nextEpisodeData.episode}`, 'info', 'fa-forward-step');
    }
  }
};

window.setEpisodeViewMode = function(mode) {
  episodeViewMode = mode;
  localStorage.setItem('jflix_ep_view_mode', mode);
  if (currentSeasonData) {
    updateEpisodesGrid(currentSeasonData);
  }
};

// Update episodes grid — Netflix / Prime Video premium style
function updateEpisodesGrid(detailedSeason) {
  currentSeasonData = detailedSeason;
  const episodesGrid = document.getElementById('episodes-grid');
  if (!episodesGrid) return;

  episodesGrid.innerHTML = '';
  // Reset grid to plain block (the CSS .episodes-grid sets grid which breaks the card list)
  episodesGrid.style.cssText = 'display: block; max-height: none; overflow: visible;';

  if (!detailedSeason || !detailedSeason.episodes || detailedSeason.episodes.length === 0) {
    episodesGrid.innerHTML = '<p class="ep-empty-msg">No episodes found for this season.</p>';
    return;
  }

  currentActiveSeason = detailedSeason.season_number;

  // Only show episodes that have already aired. Episodes with no air date are kept
  // (older shows often lack dates on TMDB). Unreleased episodes stay hidden until their air date.
  const allEpisodes = detailedSeason.episodes.filter(episode => {
    if (!episode.air_date) return true;
    return new Date(episode.air_date) <= new Date();
  });

  // Keep the stored season data in sync so the "Next Episode" button never points to an unreleased episode
  currentSeasonData = { ...detailedSeason, episodes: allEpisodes };

  // Nothing in this season has aired yet
  if (allEpisodes.length === 0) {
    episodesGrid.innerHTML = '<p class="ep-empty-msg">This season has not been released yet.</p>';
    return;
  }

  const showName = mediaDetails?.name || mediaDetails?.title || 'Show';
  const backdropFallback = mediaDetails?.backdrop_path
    ? `${IMAGE_BASE_URL}/w300${mediaDetails.backdrop_path}`
    : 'images/hero-background.jpg';

  // Build the premium Netflix-style list
  const list = document.createElement('div');
  list.className = 'nf-ep-list';

  allEpisodes.forEach(episode => {
    const isActive = episode.episode_number === currentActiveEpisode &&
                     detailedSeason.season_number === currentActiveSeason;
    const thumbUrl = episode.still_path
      ? `${IMAGE_BASE_URL}/w300${episode.still_path}`
      : backdropFallback;
    const epTitle  = episode.name || `Episode ${episode.episode_number}`;
    const runtime  = episode.runtime ? `${episode.runtime}m` : '';
    const overview = episode.overview || '';
    const displayTitle = `${showName} — S${detailedSeason.season_number}:E${episode.episode_number} — ${epTitle}`;

    const card = document.createElement('div');
    card.className = `nf-ep-card${isActive ? ' playing' : ''}`;
    card.setAttribute('data-season', detailedSeason.season_number);
    card.setAttribute('data-episode', episode.episode_number);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <div class="nf-ep-thumb-wrap">
        <img class="nf-ep-thumb" src="${thumbUrl}"
             alt="S${detailedSeason.season_number}E${episode.episode_number}"
             loading="lazy"
             onerror="this.onerror=null;this.src='${backdropFallback}';">
        <div class="nf-ep-play-overlay">
          <span class="nf-ep-play-icon"><i class="fas fa-play"></i></span>
        </div>
        <span class="nf-ep-num-badge">E${episode.episode_number}</span>
        ${isActive ? '<span class="nf-ep-playing-bar"></span>' : ''}
      </div>
      <div class="nf-ep-meta">
        <div class="nf-ep-top-row">
          <span class="nf-ep-title">${episode.episode_number}. ${epTitle}</span>
          <div class="nf-ep-badges">
            ${isActive ? '<span class="nf-ep-now-playing">▶ Now Playing</span>' : ''}
            ${runtime ? `<span class="nf-ep-runtime">${runtime}</span>` : ''}
          </div>
        </div>
        ${overview ? `<p class="nf-ep-overview">${overview}</p>` : ''}
      </div>
      <div class="nf-ep-actions">
        <button class="nf-ep-dl-btn" title="Download ${displayTitle}" aria-label="Download">
          <i class="fas fa-download"></i>
        </button>
      </div>
    `;

    // Play on click / keyboard
    const play = () => loadEpisode(detailedSeason.season_number, episode.episode_number);
    card.addEventListener('click', play);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') play(); });

    // Download button - opens VidVault download link modal with copy button
    const dlBtn = card.querySelector('.nf-ep-dl-btn');
    if (dlBtn) {
      dlBtn.addEventListener('click', e => {
        e.stopPropagation();
        openVidVaultDownloadModal(mediaId, detailedSeason.season_number, episode.episode_number, displayTitle);
      });
    }

    list.appendChild(card);
  });

  episodesGrid.appendChild(list);

  // Scroll active episode into view after paint
  requestAnimationFrame(() => {
    const active = episodesGrid.querySelector('.nf-ep-card.playing');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}


// Load episode and synchronize theater Next Episode bar
function loadEpisode(seasonNumber, episodeNumber) {
  currentActiveSeason = parseInt(seasonNumber);
  currentActiveEpisode = parseInt(episodeNumber);

  // Update video player
  loadVideo(mediaId, mediaType, seasonNumber, episodeNumber);
  
  // Update episode info in the UI
  const episodeInfo = document.getElementById('movie-info');
  if (episodeInfo) {
    let episodeTitle = `Season ${seasonNumber} Episode ${episodeNumber}`;
    if (mediaType === MEDIA_TYPES.ANIME) {
      episodeTitle = seasonNumber > 1 ? `Season ${seasonNumber} - Episode ${episodeNumber}` : `Episode ${episodeNumber}`;
    } else if (mediaType === MEDIA_TYPES.KOREAN) {
      episodeTitle = seasonNumber > 1 ? `Season ${seasonNumber} - Episode ${episodeNumber}` : `Episode ${episodeNumber}`;
    }
    
    episodeInfo.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <i class="fas fa-play-circle" style="font-size: 24px; color: #e50914;"></i>
        <div>
          <h4 class="movie-title" style="margin: 0; font-size: 18px; font-weight: 600; color: #fff; line-height: 1.4;">${episodeTitle}</h4>
          <span style="font-size: 12px; color: #a0a0a0; margin-top: 4px; display: block;">Now Playing</span>
        </div>
      </div>
    `;
  }
  
  // Update active episode in new nf-ep-card list
  document.querySelectorAll('.nf-ep-card').forEach(item => {
    const itemSeason  = parseInt(item.getAttribute('data-season'));
    const itemEpisode = parseInt(item.getAttribute('data-episode'));
    const isMatch = itemSeason === currentActiveSeason && itemEpisode === currentActiveEpisode;
    item.classList.toggle('playing', isMatch);

    // Update the Now Playing badge and playing bar dynamically
    const meta  = item.querySelector('.nf-ep-badges');
    const thumb = item.querySelector('.nf-ep-thumb-wrap');
    if (meta && thumb) {
      // Remove existing dynamic badges
      const old = meta.querySelector('.nf-ep-now-playing');
      if (old) old.remove();
      const oldBar = thumb.querySelector('.nf-ep-playing-bar');
      if (oldBar) oldBar.remove();

      if (isMatch) {
        const badge = document.createElement('span');
        badge.className = 'nf-ep-now-playing';
        badge.textContent = '▶ Now Playing';
        meta.prepend(badge);

        const bar = document.createElement('span');
        bar.className = 'nf-ep-playing-bar';
        thumb.appendChild(bar);

        // Scroll into view
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  });

  // Legacy: also update old-style cards if they exist
  document.querySelectorAll('.episode-card-netflix, .episode-item').forEach(item => {
    const itemSeason = parseInt(item.getAttribute('data-season'));
    const itemEpisode = parseInt(item.getAttribute('data-episode'));
    const isMatch = itemSeason === currentActiveSeason && itemEpisode === currentActiveEpisode;
    item.classList.toggle('active', isMatch);
  });

  // Check if next episode is available
  const nextEpBtn = document.getElementById('btn-quick-next-ep');
  if (nextEpBtn && currentSeasonData && currentSeasonData.episodes) {
    const nextEp = currentSeasonData.episodes.find(e => e.episode_number === currentActiveEpisode + 1);
    if (nextEp) {
      nextEpBtn.style.display = 'inline-flex';
      nextEpBtn.querySelector('span').textContent = `Next: Ep ${nextEp.episode_number}`;
      window.nextEpisodeData = { season: seasonNumber, episode: nextEp.episode_number };
    } else {
      nextEpBtn.style.display = 'none';
      window.nextEpisodeData = null;
    }
  }
  
  // Scroll to video player
  const videoContainer = document.querySelector('.video-container');
  if (videoContainer) {
    videoContainer.scrollIntoView({ behavior: 'smooth' });
  }
}

// Display recommended media
async function displayRecommendedMedia() {
  if (!recommendedMedia) return;

  const recommendedContainer = document.getElementById('recommended-movies');
  recommendedContainer.innerHTML = '';

  for (const item of recommendedMedia.slice(0, 10)) {
    if (!item.poster_path) continue;
    // Pass both item and its mediaType to createMediaCard
    const card = await createMediaCard(item, item.mediaType);
    recommendedContainer.appendChild(card);
  }

  if (recommendedContainer.children.length === 0) {
    recommendedContainer.innerHTML = '<p>No recommendations available.</p>';
  }
}

// If no recommended items with poster pictures, show message
function loadVideo(id, type, season = null, episode = null) {
  const videoPlayer = document.getElementById('video-player');
  const videoMessage = document.getElementById('video-message');
  
  if (!videoPlayer || !videoMessage) return;
  
  console.log('[loadVideo] Called. Initial currentServer:', currentServer, 'Season:', season, 'Episode:', episode);

  // Show cinematic stream loading animation
  const serverNames = {
    '111movies': 'Server 1',
    'videasy': 'Server 2',
    '2embed': 'Server 3',
    'vidlink': 'Server 4',
    'multiembed': 'Server 5',
    'zxcstream': 'Server 6'
  };
  const serverLabel = serverNames[currentServer] || 'Stream';
  videoMessage.innerHTML = `
    <div class="loader-spinner-box">
      <div class="loader"></div>
      <div class="loader-core"></div>
    </div>
    <p class="loader-text" style="font-size: 0.9rem; margin-top: 10px;">Connecting to ${serverLabel}...</p>
    <div class="loader-bar"><div class="loader-bar-fill"></div></div>
  `;
  videoMessage.style.display = 'flex';
  videoPlayer.style.display = 'none';
  
  // Get TMDB ID for the content
  const tmdbId = id;
  
  // Special handling for anime and cartoon content
  const isAnime = (type === MEDIA_TYPES.ANIME);
  const isCartoon = (type === MEDIA_TYPES.CARTOON);
  

  let effectiveServer = currentServer;

  let videoUrl = '';

  if (type === 'movie' || type === MEDIA_TYPES.MOVIES) {
    // Movie URL
    switch(effectiveServer) {
      case '111movies':
        // Server 1: 111Movies (uses TMDB ID for movies)
        videoUrl = `${SERVER_URLS[effectiveServer]}movie/${tmdbId}`;
        break;
      case 'videasy':
        // Server 2: VidSrc.xyz
        videoUrl = `${SERVER_URLS[effectiveServer]}movie?tmdb=${tmdbId}`;
        break;
      case '2embed':
        // Server 3: Videasy.to (player.videasy.net) - uses TMDB ID
        videoUrl = `${SERVER_URLS[effectiveServer]}movie/${tmdbId}`;
        break;
      case 'vidlink':
        // Server 4: VidLink.pro (uses TMDB ID)
        videoUrl = `${SERVER_URLS[effectiveServer]}movie/${tmdbId}`;
        break;
      case 'multiembed':
        videoUrl = `${SERVER_URLS[effectiveServer]}${tmdbId}&tmdb=1`;
        break;
      case 'zxcstream':
        videoUrl = `${SERVER_URLS[effectiveServer]}movie/${tmdbId}`;
        break;
      default:
        effectiveServer = '111movies';
        videoUrl = `${SERVER_URLS[effectiveServer]}movie/${tmdbId}`;
        break;
    }
  } else {
    // TV show URL (includes Korean TV, Cartoons - all use TMDB IDs)
    if (season !== null && episode !== null) {
      switch(effectiveServer) {
        case '111movies':
          // Server 1: 111Movies (uses TMDB ID for TV shows, Korean TV, Cartoons)
          // For anime, fallback to videasy for maximum compatibility
          if (isAnime) {
            console.warn('[loadVideo] Anime on 111movies, falling back to VidSrc.xyz');
            effectiveServer = 'videasy';
            videoUrl = `${SERVER_URLS.videasy}tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
          } else {
            videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/${season}/${episode}`;
          }
          break;
        case 'videasy':
          // Server 2: VidSrc.xyz
          videoUrl = `${SERVER_URLS[effectiveServer]}tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
          break;
        case '2embed':
          // Server 3: Videasy.to (player.videasy.net) - uses TMDB ID for TV shows, Korean TV, Cartoons
          videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/${season}/${episode}`;
          break;
        case 'vidlink':
          // Server 4: VidLink.pro (uses TMDB ID)
          videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/${season}/${episode}`;
          break;
        case 'multiembed':
          videoUrl = `${SERVER_URLS[effectiveServer]}${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
          break;
        case 'zxcstream':
          videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/${season}/${episode}`;
          break;
        default:
          console.warn('[loadVideo] Defaulting to 111movies for TV show episode.');
          effectiveServer = '111movies';
          videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/${season}/${episode}`;
          break;
      }
    } else {
      // Default to season 1, episode 1 if not specified
      switch(effectiveServer) {
        case '111movies':
          // Server 1: 111Movies (uses TMDB ID for TV shows, Korean TV, Cartoons)
          // For anime, fallback to videasy for maximum compatibility
          if (isAnime) {
            console.warn('[loadVideo] Anime on 111movies, falling back to VidSrc.xyz');
            effectiveServer = 'videasy';
            videoUrl = `${SERVER_URLS.videasy}tv?tmdb=${tmdbId}&season=1&episode=1`;
          } else {
            videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/1/1`;
          }
          break;
        case 'videasy':
          // Server 2: VidSrc.xyz
          videoUrl = `${SERVER_URLS[effectiveServer]}tv?tmdb=${tmdbId}&season=1&episode=1`;
          break;
        case '2embed':
          // Server 3: Videasy.to (player.videasy.net) - uses TMDB ID for TV shows, Korean TV, Cartoons
          videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/1/1`;
          break;
        case 'vidlink':
          // Server 4: VidLink.pro (uses TMDB ID)
          videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/1/1`;
          break;
        case 'multiembed':
          videoUrl = `${SERVER_URLS[effectiveServer]}${tmdbId}&tmdb=1&s=1&e=1`;
          break;
        case 'zxcstream':
          videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/1/1`;
          break;
        default:
          console.warn('[loadVideo] Defaulting to 111movies for TV show episode.');
          effectiveServer = '111movies';
          videoUrl = `${SERVER_URLS[effectiveServer]}tv/${tmdbId}/1/1`;
          break;
      }
    }
  }



  console.log(`[loadVideo] Setting video player src to: ${videoUrl} for server: ${effectiveServer}`);

  // Increment token so stale load/error events from previous server loads won't override UI
  const loadToken = ++videoLoadToken;

  // Clear any previous timeout
  if (videoLoadTimeoutId) {
    clearTimeout(videoLoadTimeoutId);
    videoLoadTimeoutId = null;
  }

  // Remember the embed URL so native-app downloads know which server stream to capture
  window.__currentVideoUrl = videoUrl;

  // Set src
  videoPlayer.src = videoUrl;

  // It's crucial that updateServerNoticesVisibility is called *after* any potential server changes (e.g., from fallbacks)
  // If there are onload/onerror handlers for videoPlayer that might change currentServer, 
  // this call should ideally be in those handlers or after them.
  // For now, calling it directly after setting src and after ensuring currentServer is set in defaults.
  updateServerNoticesVisibility(); 


  // Fallback: if the iframe takes too long, stop the endless spinner.
  // We still keep the message visible but show the iframe so users can interact (some servers load slowly).
  videoLoadTimeoutId = setTimeout(() => {
    if (loadToken !== videoLoadToken) return;
    console.warn('[loadVideo] Iframe load timeout reached. Showing player anyway.');
    videoPlayer.style.display = 'block';
    videoMessage.style.display = 'flex';
    videoMessage.innerHTML = `
      <i class="fas fa-circle-notch fa-spin"></i>
      <p>Server is taking too long to load. If it stays blank, try another server.</p>
    `;
  }, 8000);

  videoPlayer.onload = () => {
    if (loadToken !== videoLoadToken) return;
    if (videoLoadTimeoutId) {
      clearTimeout(videoLoadTimeoutId);
      videoLoadTimeoutId = null;
    }
    videoMessage.style.display = 'none';
    videoPlayer.style.display = 'block';
    console.log('[loadVideo] videoPlayer loaded successfully.');

    // Save to watch history (all platforms)
    if (mediaDetails) {
      saveToWatchHistory(
        mediaId,
        mediaType,
        mediaDetails.title || mediaDetails.name,
        mediaDetails.poster_path ? IMG_URL + mediaDetails.poster_path : null,
        season,
        episode
      );
    }
  };

  videoPlayer.onerror = () => {
    if (loadToken !== videoLoadToken) return;
    if (videoLoadTimeoutId) {
      clearTimeout(videoLoadTimeoutId);
      videoLoadTimeoutId = null;
    }
    console.error('[loadVideo] Error loading video player.');
    videoMessage.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <p>Error loading this server. Please try another server.</p>
    `;
    videoMessage.style.display = 'flex';
    videoPlayer.style.display = 'none';
  };
};

// Change server
function changeServer(server) {
  const mainLoader = document.getElementById('loader');
  if (mainLoader) {
    const serversToHideLoader = ['videasy', '2embed', 'vidlink', 'multiembed', '111movies', 'zxcstream'];
    if (serversToHideLoader.includes(server)) {
      mainLoader.style.display = 'none';
    } else {
      mainLoader.style.display = 'flex'; // Or 'block', depending on original style
    }
  }
  // Update current server
  currentServer = server;

  // Update active server button styling
  document.querySelectorAll('.server-button').forEach(button => {
    button.classList.remove('active');
    // Remove all potential media type classes to be safe
    button.classList.remove('anime', 'korean', 'movies', 'tvshows', 'cartoon'); 
  });
  
  const activeButton = document.querySelector(`.server-button[data-server="${server}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
    // Add specific media type class for styling
    if (mediaType === MEDIA_TYPES.ANIME) activeButton.classList.add('anime');
    else if (mediaType === MEDIA_TYPES.KOREAN) activeButton.classList.add('korean');
    else if (mediaType === MEDIA_TYPES.CARTOON) activeButton.classList.add('cartoon');
    else if (mediaType === 'tv' || mediaType === MEDIA_TYPES.TV) activeButton.classList.add('tvshows');
    else if (mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES) activeButton.classList.add('movies');
  }
  
  // Hide all server-specific feature sections (if any, e.g., server-features div)
  document.querySelectorAll('[id$="-features"]').forEach(element => {
    element.style.display = 'none';
  });
  
  // Show features for the current server if they exist
  const serverFeatures = document.getElementById(`${server}-features`);
  if (serverFeatures) {
    serverFeatures.style.display = 'block';
  }

  // Show general loading message and hide player
  const videoPlayer = document.getElementById('video-player');
  const generalLoadingMessage = document.getElementById('loading-message'); // General loading message
  const videoMessage = document.getElementById('video-message'); // Episode-specific loading message

  if (videoPlayer) videoPlayer.style.display = 'none'; // Hide player initially

  // Reload video with new server
  if (mediaType === 'tv' || mediaType === MEDIA_TYPES.TV || 
      mediaType === MEDIA_TYPES.ANIME || mediaType === MEDIA_TYPES.KOREAN || mediaType === MEDIA_TYPES.CARTOON) {
    const seasonSelector = document.getElementById('season-selector');
    const episodeSelector = document.getElementById('episode-selector');
    let seasonToLoad, episodeToLoad;

    if (seasonSelector && episodeSelector && seasonSelector.value && episodeSelector.value) {
        seasonToLoad = seasonSelector.value;
        episodeToLoad = episodeSelector.value;
    } else {
        const activeEpisodeElement = document.querySelector('.episode-item.active');
        if (activeEpisodeElement) {
            seasonToLoad = activeEpisodeElement.getAttribute('data-season');
            episodeToLoad = activeEpisodeElement.getAttribute('data-episode');
        } else {
            seasonToLoad = 1; // Default to S1
            episodeToLoad = 1; // Default to E1
        }
    }
    
    if (videoMessage) {
      videoMessage.style.display = 'flex'; // Show episode-specific loading
      if (generalLoadingMessage) generalLoadingMessage.style.display = 'none'; // Hide general if episode-specific is shown
      videoMessage.innerHTML = `
        <i class="fas fa-circle-notch fa-spin"></i>
        <p>Loading ${SERVER_NAMES[server] || server}...</p>
      `;
    }
    loadVideo(mediaId, mediaType, seasonToLoad, episodeToLoad);

  } else { // For movies
    if (videoMessage) videoMessage.style.display = 'none'; // Hide episode-specific loading
    if (generalLoadingMessage) {
      generalLoadingMessage.style.display = 'block'; // Show general loading for movies
      generalLoadingMessage.innerHTML = `
        <i class="fas fa-circle-notch fa-spin"></i>
        <p>Loading ${SERVER_NAMES[server] || server}...</p>
      `;
    }
    loadVideo(mediaId, mediaType);
  }
  
  // Update server-specific notices (like Server 1 or Server 2 instructions)
  updateServerNoticesVisibility();
}

// Helper function to get the color parameter for Videasy server based on content type
function getVideasyColorParam(type, isAnime, isCartoon) {
  if (isAnime) {
    return '&color=F43F5E'; // Red color for anime
  } else if (type === MEDIA_TYPES.KOREAN) {
    return '&color=10B981'; // Green color for Korean
  } else if (isCartoon) {
    return '&color=FF9900'; // Orange color for cartoons
  } else {
    return '&color=8B5CF6'; // Purple color for TV shows (default)
  }
}

// Function to update Server notices visibility (renamed and modified from updateServer1NoticeVisibility)
function updateServerNoticesVisibility() {
console.log('[updateServerNoticesVisibility] Called. currentServer:', currentServer);
const server1Notice = document.getElementById('server1-notice');
const server2Notice = document.getElementById('server2-notice');
const server3Notice = document.getElementById('server3-notice');

  // Feature descriptions
  const movies111Features = document.getElementById('111movies-features');
  const videasyFeatures = document.getElementById('videasy-features');
  const twoembedFeatures = document.getElementById('2embed-features');
  const vidlinkFeatures = document.getElementById('vidlink-features');
  const multiembedFeatures = document.getElementById('multiembed-features');

  if (server1Notice) server1Notice.style.display = 'none';
  if (server2Notice) server2Notice.style.display = 'none';
  if (server3Notice) server3Notice.style.display = 'none';

  if (movies111Features) movies111Features.style.display = 'none';
  if (videasyFeatures) videasyFeatures.style.display = 'none';
  if (twoembedFeatures) twoembedFeatures.style.display = 'none';
  if (vidlinkFeatures) vidlinkFeatures.style.display = 'none';
  if (multiembedFeatures) multiembedFeatures.style.display = 'none';

  switch (currentServer) {
    case '111movies':
      if (server1Notice) server1Notice.style.display = 'flex';
      if (movies111Features) movies111Features.style.display = 'block';
      break;
    case 'videasy':
      if (server2Notice) server2Notice.style.display = 'flex';
      if (videasyFeatures) videasyFeatures.style.display = 'block';
      break;
    case '2embed':
      if (server3Notice) server3Notice.style.display = 'flex';
      if (twoembedFeatures) twoembedFeatures.style.display = 'block';
      break;
    case 'vidlink':
      // No notice for Server 4, no style change needed here.
      if (vidlinkFeatures) vidlinkFeatures.style.display = 'block';
      break;
    case 'multiembed':
      if (multiembedFeatures) multiembedFeatures.style.display = 'block';
      break;
  }
}

// Update server button states based on platform (Server 1 is always available for all browsers & apps)
function updateServerButtonStates() {
  const server1Button = document.getElementById('server-111movies');
  if (server1Button) {
    server1Button.disabled = false;
    server1Button.style.opacity = '1';
    server1Button.style.cursor = 'pointer';
    server1Button.title = 'Server 1';
    server1Button.innerHTML = '<i class="fas fa-bolt"></i> Server 1';
  }
}

// Initialize the application
async function init() {
  // Get URL parameters
  getUrlParams();

  // Update server button states based on platform
  updateServerButtonStates();

  // Initialize server buttons
  initServerButtons();

  // Request screen wake lock to prevent screen from turning off on mobile
  requestWakeLock();

  // Custom fullscreen event listeners removed — using native iframe fullscreen instead

  // Release wake lock when page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  });

  if (window.showLoader) window.showLoader('Loading Player');

  // Fetch media data
  try {
    // Fetch details
    mediaDetails = await fetchMediaDetails();
    // Initial update for server notices after everything is set up
    if (typeof currentServer !== 'undefined') {
      updateServerNoticesVisibility(); // Ensures correct notice on load
    }
    displayMediaDetails();

    // Fetch recommended media
    recommendedMedia = await fetchRecommendedMedia();
    displayRecommendedMedia();
    
    // Force episode selector to be visible for TV shows
    if (mediaType === 'tv' || mediaType === MEDIA_TYPES.TV || 
        mediaType === MEDIA_TYPES.ANIME || mediaType === MEDIA_TYPES.KOREAN || mediaType === MEDIA_TYPES.CARTOON) {
      // Make sure episode selector is properly added
      const existingSelector = document.querySelector('.episode-selector');
      if (!existingSelector) {
        addEpisodeSelector();
      }
    }
    
    // Load video player — use URL-provided season/episode if available
    const isTVContent = mediaType !== 'movie' && mediaType !== MEDIA_TYPES.MOVIES;
    if (isTVContent && currentActiveSeason && currentActiveEpisode) {
      loadVideo(mediaId, mediaType, currentActiveSeason, currentActiveEpisode);
    } else {
      loadVideo(mediaId, mediaType);
    }
  } catch (error) {
    console.error('Error initializing app:', error);
  } finally {
    if (window.hideLoader) window.hideLoader();
    if (window.injectFooter) window.injectFooter();
  }

  // Setup instructional video modal listeners
  const videoThumb = document.getElementById('server2-instructional-video-thumb');
  if (videoThumb) {
    videoThumb.addEventListener('click', openInstructionalVideoModal);
  }

  const instructionalModal = document.getElementById('instructional-video-modal');
  if (instructionalModal) {
    instructionalModal.addEventListener('click', function(event) {
        if (event.target === this) { // Clicked on overlay itself
            closeInstructionalVideoModal();
        }
    });
  }

  // Setup Server 3 GIF modal listeners
  const gifThumb = document.getElementById('server3-instructional-gif-thumb');
  if (gifThumb) {
    gifThumb.addEventListener('click', openServer3GifModal);
  }

  const server3GifModalElement = document.getElementById('server3-gif-modal');
  if (server3GifModalElement) {
    server3GifModalElement.addEventListener('click', function(event) {
        if (event.target === this) { // Clicked on overlay itself
            closeServer3GifModal();
        }
    });
  }

  // Setup Server 1 GIF modal listeners
  const server1GifThumb = document.getElementById('server1-instructional-gif-thumb');
  if (server1GifThumb) {
    server1GifThumb.addEventListener('click', openServer1GifModal);
  }

  const server1GifModalElement = document.getElementById('server1-gif-modal');
  if (server1GifModalElement) {
    server1GifModalElement.addEventListener('click', function(event) {
        if (event.target === this) { // Clicked on overlay itself
            closeServer1GifModal();
        }
    });
  }
}

// Initialize server buttons
function initServerButtons() {
  const serverButtons = document.querySelectorAll('.server-button[data-server]');
  serverButtons.forEach(button => {
    button.addEventListener('click', () => {
      const server = button.getAttribute('data-server');
      changeServer(server);
    });
  });
  
  // Set initial active server
  changeServer(currentServer);
}

// Navigate to details page
function goToDetails() {
  window.showLoader();
  if (mediaId && mediaType) {
    window.location.href = `details.html?id=${mediaId}&type=${mediaType}`;
  } else {
    window.location.href = 'index.html';
  }
}

// Format number with commas
function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  // Never surface "Invalid Date" — fall back to the raw value when it can't be parsed
  if (isNaN(date.getTime())) {
    return dateString || 'N/A';
  }
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// Open search modal
function openSearchModal() {
  const searchModal = document.getElementById('search-modal');
  const searchInput = document.getElementById('search-input');
  
  if (searchModal) searchModal.style.display = 'block';
  if (searchInput) {
    searchInput.focus();
    searchInput.value = '';
  }
  
  // Clear previous results
  const searchResults = document.getElementById('search-results');
  if (searchResults) searchResults.innerHTML = '';
}

// Close search modal
function closeSearchModal() {
  const searchModal = document.getElementById('search-modal');
  if (searchModal) searchModal.style.display = 'none';
  
  // Clear search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Handle escape key to close modals
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSearchModal();
  }
});

// Function to trigger the share modal with current media details
function triggerSharePlayer() {
  if (mediaDetails && mediaId && mediaType) {
    const title = mediaDetails.title || mediaDetails.name;
    const overview = mediaDetails.overview;
    const posterPath = mediaDetails.poster_path;
    // As with details.js, ensure mediaType is compatible or handled by common.js
    openShareModal(mediaId, mediaType, title, overview, posterPath);
  } else {
    console.error('Share player: Media information not available.');
    // Optionally, display a user-friendly error message
    alert('Could not retrieve share information. Please try again later.');
  }
}

// Instructional Video Modal Functions
function openInstructionalVideoModal() {
  const modal = document.getElementById('instructional-video-modal');
  const videoPlayer = document.getElementById('instructional-video-modal-player');
  if (modal) modal.style.display = 'flex';
  if (videoPlayer) {
    videoPlayer.currentTime = 0; // Restart video from the beginning
    videoPlayer.play();
  }
}

function closeInstructionalVideoModal() {
  const modal = document.getElementById('instructional-video-modal');
  const videoPlayer = document.getElementById('instructional-video-modal-player');
  if (modal) modal.style.display = 'none';
  if (videoPlayer) videoPlayer.pause();
}

// Server 3 GIF Modal Functions
function openServer3GifModal() {
  const modal = document.getElementById('server3-gif-modal');
  if (modal) modal.style.display = 'flex';
}

function closeServer3GifModal() {
  const modal = document.getElementById('server3-gif-modal');
  if (modal) modal.style.display = 'none';
}

// Server 1 GIF Modal Functions
function openServer1GifModal() {
  const modal = document.getElementById('server1-gif-modal');
  if (modal) modal.style.display = 'flex';
}

function closeServer1GifModal() {
  const modal = document.getElementById('server1-gif-modal');
  if (modal) modal.style.display = 'none';
}
async function handleEpisodeChange(seasonIndex, episodeIndex) {
  if (mediaType === MEDIA_TYPES.MOVIE) return; // No episodes for movies

  currentSeason = seasonIndex;
  currentEpisode = episodeIndex;

  console.log(`[handleEpisodeChange] Changing to Season ${currentSeason + 1}, Episode ${currentEpisode + 1}. Initial currentServer: ${currentServer}`);

  // Update the episode selector UI if it exists
  const episodeSelector = document.getElementById('episode-selector');
  if (episodeSelector) {
    episodeSelector.value = `${currentSeason}-${currentEpisode}`;
  }

  // Update the displayed episode number
  const episodeNumberDisplay = document.getElementById('episode-number');
  if (episodeNumberDisplay) {
    episodeNumberDisplay.textContent = `Episode ${currentEpisode + 1}`;
  }

  // Update the displayed season number
  const seasonNumberDisplay = document.getElementById('season-number');
  if (seasonNumberDisplay) {
    seasonNumberDisplay.textContent = `Season ${currentSeason + 1}`;
  }

  // Load the selected video
  console.log(`[handleEpisodeChange] About to call loadVideo. currentServer: ${currentServer}`);
  await loadVideo(mediaId, mediaType, currentSeason, currentEpisode);
  console.log(`[handleEpisodeChange] After loadVideo call. currentServer: ${currentServer}`);
  
  // updateServerNoticesVisibility(); // MOVED into loadVideo for better timing

  // Update Previous/Next Episode buttons state
  updateEpisodeNavButtons();

  // Save current episode to localStorage
  saveLastWatchedEpisode(mediaId, currentSeason, currentEpisode);
  console.log(`[handleEpisodeChange] Finished. currentServer: ${currentServer}`);
}

// Function to handle previous episode navigation
function goToPreviousEpisode() {
  if (currentEpisode > 0) {
    handleEpisodeChange(currentSeason, currentEpisode - 1);
  } else if (currentSeason > 0) {
    // Go to previous season's last episode
    const prevSeason = mediaDetails.seasons.find(s => s.season_number === currentSeason);
    if (prevSeason) {
      handleEpisodeChange(currentSeason - 1, prevSeason.episode_count - 1);
    }
  }
}

// Function to handle next episode navigation
function goToNextEpisode() {
  const currentSeasonData = mediaDetails.seasons.find(s => s.season_number === currentSeason + 1);
  if (currentSeasonData && currentEpisode < currentSeasonData.episode_count - 1) {
    handleEpisodeChange(currentSeason, currentEpisode + 1);
  } else {
    // Try to go to next season's first episode
    const nextSeason = mediaDetails.seasons.find(s => s.season_number === currentSeason + 2);
    if (nextSeason) {
      handleEpisodeChange(currentSeason + 1, 0);
    }
  }
}

// Update episode navigation buttons state
function updateEpisodeNavButtons() {
  const prevBtn = document.getElementById('prev-episode-btn');
  const nextBtn = document.getElementById('next-episode-btn');
  
  if (prevBtn) {
    prevBtn.disabled = currentSeason === 0 && currentEpisode === 0;
  }
  
  if (nextBtn && mediaDetails && mediaDetails.seasons) {
    const currentSeasonData = mediaDetails.seasons.find(s => s.season_number === currentSeason + 1);
    const isLastEpisode = currentSeasonData && currentEpisode === currentSeasonData.episode_count - 1;
    const isLastSeason = currentSeason === mediaDetails.seasons.length - 1;
    nextBtn.disabled = isLastEpisode && isLastSeason;
  }
}

// Save last watched episode to localStorage
function saveLastWatchedEpisode(mediaId, season, episode) {
  const key = `lastWatched_${mediaId}`;
  const data = {
    season: season,
    episode: episode,
    timestamp: new Date().toISOString()
  };
  localStorage.setItem(key, JSON.stringify(data));
  console.log(`[saveLastWatchedEpisode] Saved: S${season + 1}:E${episode + 1} for media ${mediaId}`);
}

// Load last watched episode from localStorage
function loadLastWatchedEpisode(mediaId) {
  const key = `lastWatched_${mediaId}`;
  const data = localStorage.getItem(key);
  if (data) {
    const parsed = JSON.parse(data);
    console.log(`[loadLastWatchedEpisode] Loaded: S${parsed.season + 1}:E${parsed.episode + 1} for media ${mediaId}`);
    return parsed;
  }
  return null;
}

// ============================================
// DOWNLOAD SYSTEM
// Supports: Movies, TV Shows, Korean TV, Anime, Cartoons
// ============================================

let downloadCountdownInterval = null;
let downloadCountdownValue = 10;
let currentDownloadUrl = '';
let currentDownloadTitle = '';

// Initialize download buttons based on media type
// In Electron, Android, iOS, and Web browsers, downloads use the VidVault.ru copy link modal.
function nativeDownloadSupported() {
  return false;
}

// Legacy wrappers — directly open VidVault download modal
function startNativeDownload(title, season, episode) {
  openVidVaultDownloadModal(mediaId, season, episode, title);
  return false;
}

function startNativeDownloadWithUrl(title, embedUrl, season, episode) {
  openVidVaultDownloadModal(mediaId, season, episode, title);
  return 'unsupported';
}

function initializeDownloadButtons() {
  const downloadContainer = document.getElementById('download-buttons-container');
  const downloadSection = document.getElementById('download-section');

  console.log('[Download Buttons] initializeDownloadButtons called');

  if (!downloadContainer || !downloadSection) {
    console.error('[Download Buttons] Required elements not found');
    return;
  }

  downloadContainer.innerHTML = '';

  const isMovie = mediaType === 'movie' || mediaType === MEDIA_TYPES.MOVIES;

  if (isMovie) {
    downloadSection.style.display = 'block';
    const title = mediaDetails?.title || mediaDetails?.name || 'Movie';
    const btn = document.createElement('button');
    btn.className = 'download-btn';
    btn.innerHTML = `<i class="fas fa-download"></i> Download ${title}`;
    btn.onclick = () => {
      console.log('[Download Button] Clicked - mediaId:', mediaId);
      openVidVaultDownloadModal(mediaId, null, null, title);
    };
    downloadContainer.appendChild(btn);
    console.log('[Download Buttons] Movie download button created');
  } else {
    // TV/Korean/Anime/Cartoon — hide movie section; episodes have download buttons
    downloadSection.style.display = 'none';
  }
}

// Generate VidVault download URL
function generateVidVaultUrl(tmdbId, season, episode) {
  const baseUrl = 'https://vidvault.ru';
  if (season && episode) {
    return `${baseUrl}/tv/${tmdbId}/${season}/${episode}`;
  }
  return `${baseUrl}/movie/${tmdbId}`;
}

// Open VidVault download modal (consistent across Electron, Android, iOS, and Web)
function openVidVaultDownloadModal(tmdbId, season, episode, title) {
  const modal = document.getElementById('download-modal');
  const actionContainer = document.getElementById('download-action-container');
  const modalTitle = document.getElementById('download-modal-title');
  const modalSubtitle = document.getElementById('download-modal-subtitle');
  const countdownContainer = document.getElementById('countdown-container');

  if (!modal) {
    console.error('[VidVault Download Modal] Modal element not found');
    return;
  }

  // Clear any running countdown first
  if (downloadCountdownInterval) {
    clearInterval(downloadCountdownInterval);
    downloadCountdownInterval = null;
  }

  const targetId = tmdbId || mediaId;
  const targetTitle = title || (mediaDetails && (mediaDetails.title || mediaDetails.name)) || 'Media';

  // Reset state
  currentDownloadUrl = generateVidVaultUrl(targetId, season, episode);
  currentDownloadTitle = targetTitle;

  console.log('[VidVault Download Modal] Opening modal with URL:', currentDownloadUrl);

  // Update modal text
  if (modalTitle) modalTitle.textContent = `Download: ${targetTitle}`;
  const typeLabel = (season != null && episode != null)
    ? `Season ${season}, Episode ${episode}`
    : 'Movie';
  if (modalSubtitle) modalSubtitle.textContent = `${typeLabel} - Ready to download`;

  // Hide countdown container
  if (countdownContainer) countdownContainer.style.display = 'none';

  // Update copy link input field
  const downloadLinkInput = document.getElementById('download-link-input');
  if (downloadLinkInput) {
    downloadLinkInput.value = currentDownloadUrl;
    console.log('[VidVault Download Modal] Set input value to:', downloadLinkInput.value);
  } else {
    console.error('[VidVault Download Modal] download-link-input element not found');
  }

  // Show download action immediately
  if (actionContainer) {
    actionContainer.style.display = 'block';
    actionContainer.style.animation = 'modalFadeIn 0.5s ease';
  }

  // Show modal
  modal.style.display = 'flex';
}

// Open download modal (legacy alias)
function openDownloadModal(tmdbId, season, episode, title) {
  openVidVaultDownloadModal(tmdbId, season, episode, title);
}

// Copy download link to clipboard with cross-platform fallback
function copyDownloadLink() {
  const downloadLinkInput = document.getElementById('download-link-input');
  const copyFeedback = document.getElementById('copy-feedback');
  const copyBtn = document.getElementById('copy-download-link-btn') || document.querySelector('#download-action-container button');
  const textToCopy = (downloadLinkInput && downloadLinkInput.value) || currentDownloadUrl || '';

  if (!textToCopy) return;

  function onCopied() {
    if (copyFeedback) {
      copyFeedback.style.display = 'block';
      setTimeout(() => {
        copyFeedback.style.display = 'none';
      }, 3000);
    }
    if (copyBtn) {
      const origHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="fas fa-check" style="margin-right: 6px;"></i>Copied!';
      copyBtn.style.background = '#059669';
      setTimeout(() => {
        copyBtn.innerHTML = origHtml;
        copyBtn.style.background = '#10b981';
      }, 2500);
    }
    if (window.showToast) {
      window.showToast('Download link copied to clipboard!', 'success', 'fa-check');
    }
  }

  if (downloadLinkInput) {
    downloadLinkInput.focus();
    downloadLinkInput.select();
    downloadLinkInput.setSelectionRange(0, 99999);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy)
      .then(onCopied)
      .catch(err => {
        console.warn('[Copy] navigator.clipboard failed, using fallback:', err);
        fallbackExecCopy(textToCopy, onCopied);
      });
  } else {
    fallbackExecCopy(textToCopy, onCopied);
  }
}

function fallbackExecCopy(text, callback) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (successful) {
      if (callback) callback();
      return;
    }
  } catch (e) {
    console.error('[Copy] Fallback execCommand failed:', e);
  }
  if (callback) callback();
}

// Close download modal
function closeDownloadModal() {
  const modal = document.getElementById('download-modal');
  if (modal) modal.style.display = 'none';

  if (downloadCountdownInterval) {
    clearInterval(downloadCountdownInterval);
    downloadCountdownInterval = null;
  }
}

// Expose globally
window.openVidVaultDownloadModal = openVidVaultDownloadModal;
window.openDownloadModal = openDownloadModal;
window.copyDownloadLink = copyDownloadLink;
window.closeDownloadModal = closeDownloadModal;

// Start countdown
function startDownloadCountdown() {
  const timerDisplay = document.getElementById('countdown-timer');
  const actionContainer = document.getElementById('download-action-container');
  const countdownContainer = document.getElementById('countdown-container');

  if (downloadCountdownInterval) clearInterval(downloadCountdownInterval);

  downloadCountdownInterval = setInterval(() => {
    downloadCountdownValue--;
    if (timerDisplay) timerDisplay.textContent = downloadCountdownValue;

    if (downloadCountdownValue <= 0) {
      clearInterval(downloadCountdownInterval);
      downloadCountdownInterval = null;

      if (actionContainer) {
        actionContainer.style.display = 'block';
        actionContainer.style.animation = 'modalFadeIn 0.5s ease';
      }
      if (countdownContainer) countdownContainer.style.display = 'none';
    }
  }, 1000);
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
  const modal = document.getElementById('download-modal');
  if (event.target === modal) closeDownloadModal();
});

// Handle escape key
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDownloadModal();
});
