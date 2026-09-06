// Anilist API Configuration
const ANILIST_API = 'https://graphql.anilist.co';

// Rate limiting queue to prevent 429 errors
const requestQueue = [];
let isProcessing = false;
const REQUEST_DELAY = 500; // 500ms between requests

async function rateLimitedFetch(url, options) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, options, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  const { url, options, resolve, reject } = requestQueue.shift();
  
  try {
    await new Promise(r => setTimeout(r, REQUEST_DELAY));
    const response = await fetch(url, options);
    resolve(response);
  } catch (error) {
    reject(error);
  } finally {
    isProcessing = false;
    processQueue();
  }
}

const ANIME_DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      title { romaji english native }
      coverImage { large extraLarge }
      bannerImage
      episodes
      status
      genres
      averageScore
      format
      description
      seasonYear
      season
      nextAiringEpisode { episode }
      relations {
        edges {
          node {
            id
            title { romaji english }
            format
            season
            seasonYear
            episodes
            coverImage { large }
            status
          }
          relationType
        }
      }
    }
  }
`;

// Fetch data from Anilist API
async function fetchAnilist(query, variables = {}) {
  try {
    const response = await rateLimitedFetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching from Anilist:', error);
    return null;
  }
}

// Get watch params from URL
function getWatchParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get('id'),
    episode: params.get('ep') || null,
    type: params.get('type') || 'sub'
  };
}

// Compute available (released) episodes
function getAvailableEpisodes(anime) {
  if (anime.status === 'NOT_YET_RELEASED') return 0;
  if (anime.status === 'RELEASING' && anime.nextAiringEpisode) {
    return anime.nextAiringEpisode.episode - 1;
  }
  return anime.episodes || 0;
}

// Extract and sort connected seasons only (no movies)
function getSeasons(anime) {
  if (!anime.relations || !anime.relations.edges) return [];

  const TV_FORMATS = ['TV', 'TV_SHORT', 'ONA', 'OVA', 'SPECIAL'];

  const seasons = anime.relations.edges
    .filter(edge =>
      (edge.relationType === 'PREQUEL' || edge.relationType === 'SEQUEL') &&
      TV_FORMATS.includes(edge.node.format)
    )
    .map(edge => ({
      id: edge.node.id,
      title: edge.node.title.english || edge.node.title.romaji,
      season: edge.node.season,
      seasonYear: edge.node.seasonYear,
      episodes: edge.node.episodes,
      coverImage: edge.node.coverImage.large,
      status: edge.node.status,
      relationType: edge.relationType
    }));

  seasons.push({
    id: anime.id,
    title: anime.title.english || anime.title.romaji,
    season: anime.season,
    seasonYear: anime.seasonYear,
    episodes: anime.episodes,
    coverImage: anime.coverImage.large,
    status: anime.status,
    relationType: 'CURRENT',
    isCurrent: true
  });

  return seasons.sort((a, b) => {
    if (a.seasonYear !== b.seasonYear) return (a.seasonYear || 0) - (b.seasonYear || 0);
    const seasonOrder = { WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 };
    return (seasonOrder[a.season] || 0) - (seasonOrder[b.season] || 0);
  });
}

// Detect if device is mobile
// Uses UA + touch capability + screen width for maximum accuracy
function isMobile() {
  const uaMatch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const touchAndNarrow = ('ontouchstart' in window) && navigator.maxTouchPoints > 0 && window.innerWidth <= 768;
  return uaMatch || touchAndNarrow;
}

// Screen wake lock — keeps the display on while watching (mirrors player.js).
// No-op where unsupported (e.g. iOS Safari/WKWebView); the native iOS shell
// holds the idle timer instead.
let wakeLock = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (err) { /* unsupported or denied — fail silently */ }
}
function releaseWakeLock() {
  if (wakeLock) {
    try { wakeLock.release(); } catch (err) { /* ignore */ }
    wakeLock = null;
  }
}

// Get URL for a specific server number (1 = default, 2 = alternate, 3 = vidsrc)
// Desktop  S1: animepahe  |  S2: anime  |  S3: vidsrc (MAL preferred, AniList fallback)
// Mobile   S1: anime      |  S2: animepahe  |  S3: vidsrc (MAL preferred, AniList fallback)
// Returns null only if no usable id exists at all.
function getServerUrl(animeId, episode, type, serverNum) {
  if (serverNum === 3) {
    const subDub = type === 'dub' ? 'dub' : 'sub';
    // vidsrc ids: plain MAL number, or AniList id with "ani" prefix
    const vidId = currentMalId ? String(currentMalId) : ('ani' + animeId);
    if (!animeId && !currentMalId) return null;
    return `https://vidsrc.cc/v2/embed/anime/${vidId}/${episode}/${subDub}`;
  }
  const mobile = isMobile();
  const useAnimePahe = mobile ? (serverNum === 2) : (serverNum === 1);
  if (useAnimePahe) {
    return `https://vidnest.fun/animepahe/${animeId}/${episode}/${type}`;
  } else {
    return `https://vidnest.fun/anime/${animeId}/${episode}/${type}`;
  }
}

// Generate default streaming URL (server 1)
function generateStreamUrl(animeId, episode, type) {
  return getServerUrl(animeId, episode, type, 1);
}

// Switch active server without page reload
window.switchServer = function(serverNum) {
  if (currentServer === serverNum) return;
  const { id, episode, type } = getWatchParams();
  const curEp = parseInt(episode) || 1;
  const url = getServerUrl(id, curEp, type, serverNum);
  if (!url) return; // no usable id for this server/title combo
  currentServer = serverNum;
  const iframe = document.querySelector('#videoPlayer iframe');
  if (iframe) iframe.src = url;
  document.querySelectorAll('.wp-server-btns .wp-server-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i + 1 === serverNum);
  });
};

// Build server bar HTML (Server 3 works for every title: MAL id preferred,
// AniList "ani" id fallback — so the button is never disabled)
function generateServerBarHTML() {
  return `
    <div class="wp-server-bar">
      <span class="wp-server-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
          <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
          <circle cx="12" cy="20" r="1" fill="currentColor"/>
        </svg>
        Servers
      </span>
      <div class="wp-server-btns">
        <button class="wp-server-btn active" onclick="switchServer(1)">
          <span class="srv-num">1</span>
          Server 1
          <span class="srv-status">&#9654; Playing</span>
          <span class="srv-hd">HD</span>
        </button>
        <button class="wp-server-btn" onclick="switchServer(2)">
          <span class="srv-num">2</span>
          Server 2
          <span class="srv-status">&#9654; Playing</span>
          <span class="srv-hd">HD</span>
        </button>
        <button class="wp-server-btn" onclick="switchServer(3)">
          <span class="srv-num">3</span>
          Server 3
          <span class="srv-status">&#9654; Playing</span>
          <span class="srv-hd">HD</span>
        </button>
      </div>
    </div>
  `;
}

// Continue Watching tracker
function saveContinueWatching(id, title, coverImage, ep, totalEps) {
  let list = JSON.parse(localStorage.getItem('aniu_continue_watching') || '[]');
  list = list.filter(item => parseInt(item.id) !== parseInt(id));
  list.unshift({
    id: parseInt(id),
    title: title,
    coverImage: coverImage,
    episode: parseInt(ep),
    totalEpisodes: parseInt(totalEps),
    updatedAt: Date.now()
  });
  if (list.length > 12) list.pop();
  localStorage.setItem('aniu_continue_watching', JSON.stringify(list));
}

// Watchlist tracker
function toggleWatchlist(anime) {
  let list = JSON.parse(localStorage.getItem('aniu_watchlist') || '[]');
  const index = list.findIndex(item => parseInt(item.id) === parseInt(anime.id));
  const btn = document.getElementById('watchlistBtn');
  
  if (index > -1) {
    list.splice(index, 1);
    if (btn) {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add Watchlist`;
      btn.classList.remove('active');
    }
  } else {
    list.unshift({
      id: anime.id,
      title: anime.title.english || anime.title.romaji,
      coverImage: anime.coverImage.large || anime.coverImage.extraLarge,
      status: anime.status,
      score: anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A',
      format: anime.format || 'TV',
      addedAt: Date.now()
    });
    if (btn) {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> Watchlisted`;
      btn.classList.add('active');
    }
  }
  localStorage.setItem('aniu_watchlist', JSON.stringify(list));
}

function updateWatchlistBtnState(animeId) {
  const list = JSON.parse(localStorage.getItem('aniu_watchlist') || '[]');
  const exists = list.some(item => parseInt(item.id) === parseInt(animeId));
  const btn = document.getElementById('watchlistBtn');
  if (btn) {
    if (exists) {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> Watchlisted`;
      btn.classList.add('active');
    } else {
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add Watchlist`;
      btn.classList.remove('active');
    }
  }
}

// Active server (1 = default for platform, 2 = alternate, 3 = vidlink)
let currentServer = 1;

// MyAnimeList ID of the loaded title — preferred by Server 3 (vidsrc).
// Falls back to the AniList id ("ani" prefix) when AniList has no mapping.
let currentMalId = null;

// Seasons state
let _seasons = [];
let _seasonCurrentId = null;
let _seasonOffset = 0;
const SEASONS_PER_PAGE = 4;

// Generate episode batch tabs + grid
function generateEpisodesHTML(availableEpisodes, currentEpisode, animeId, type) {
  if (availableEpisodes === 0) {
    return `<div class="wp-eps-empty">No episodes available yet. Check back soon!</div>`;
  }

  const BATCH = 100;
  const totalBatches = Math.ceil(availableEpisodes / BATCH);
  const activeBatch = Math.ceil(currentEpisode / BATCH);

  let batchDropdown = '';
  if (totalBatches > 1) {
    batchDropdown = `<select class="ep-batch-select" id="epBatchSelect" onchange="switchBatch(this.value, ${availableEpisodes}, ${currentEpisode}, '${animeId}', '${type}')">`;
    for (let b = 1; b <= totalBatches; b++) {
      const from = (b - 1) * BATCH + 1;
      const to = Math.min(b * BATCH, availableEpisodes);
      batchDropdown += `<option value="${b}" ${b === activeBatch ? 'selected' : ''}>Episodes ${from}–${to}</option>`;
    }
    batchDropdown += `</select>`;
  }

  const batchFrom = (activeBatch - 1) * BATCH + 1;
  const batchTo = Math.min(activeBatch * BATCH, availableEpisodes);

  let buttons = '';
  for (let i = batchFrom; i <= batchTo; i++) {
    const isCurrent = i === currentEpisode;
    buttons += `<button class="episode-btn ${isCurrent ? 'active' : ''}" onclick="changeEpisode(${i})" ${isCurrent ? 'disabled' : ''}>EP ${i}</button>`;
  }

  return `
    ${totalBatches > 1 ? `<div class="ep-batch-tabs" id="epBatchTabs">${batchDropdown}</div>` : ''}
    <div class="watch-episodes-grid" id="epGrid">
      ${buttons}
    </div>
  `;
}

// Switch episode batch (client-side, no reload)
window.switchBatch = function(batchNumStr, availableEpisodes, currentEpisode, animeId, type) {
  const batchNum = parseInt(batchNumStr);
  const BATCH = 100;
  const from = (batchNum - 1) * BATCH + 1;
  const to = Math.min(batchNum * BATCH, availableEpisodes);

  const select = document.getElementById('epBatchSelect');
  if (select) {
    select.value = batchNum;
  }

  let buttons = '';
  for (let i = from; i <= to; i++) {
    const isCurrent = i === currentEpisode;
    buttons += `<button class="episode-btn ${isCurrent ? 'active' : ''}" onclick="changeEpisode(${i})" ${isCurrent ? 'disabled' : ''}>EP ${i}</button>`;
  }

  const grid = document.getElementById('epGrid');
  if (grid) {
    grid.innerHTML = buttons;
    grid.scrollTop = 0;
  }
};

// Render visible season cards
function _renderSeasonCards() {
  const visible = _seasons.slice(_seasonOffset, _seasonOffset + SEASONS_PER_PAGE);
  return visible.map(s => `
    <div class="wp-season-card ${s.id === parseInt(_seasonCurrentId) ? 'active' : ''}" onclick="switchSeason(${s.id})" title="${s.title}">
      ${s.id === parseInt(_seasonCurrentId) ? '<div class="wp-season-playing">▶ NOW</div>' : ''}
      <img src="${s.coverImage}" alt="${s.title}" loading="lazy">
      <div class="wp-season-info">
        <span class="wp-season-title">${s.title}</span>
        <span class="wp-season-meta">${s.seasonYear || 'TBA'} · ${s.episodes || '?'} eps</span>
      </div>
    </div>
  `).join('');
}

// Navigate seasons left/right
window.scrollSeasons = function(dir) {
  _seasonOffset = Math.max(0, Math.min(_seasonOffset + dir * SEASONS_PER_PAGE, _seasons.length - 1));
  const viewport = document.getElementById('seasonsViewport');
  if (viewport) viewport.innerHTML = _renderSeasonCards();
  const pager = document.getElementById('seasonsPager');
  if (pager) pager.textContent = `${_seasonOffset + 1}–${Math.min(_seasonOffset + SEASONS_PER_PAGE, _seasons.length)} of ${_seasons.length}`;
  const leftBtn = document.getElementById('snavLeft');
  const rightBtn = document.getElementById('snavRight');
  if (leftBtn) leftBtn.disabled = _seasonOffset === 0;
  if (rightBtn) rightBtn.disabled = _seasonOffset + SEASONS_PER_PAGE >= _seasons.length;
};

// Generate seasons row with arrow navigation
function generateSeasonsHTML(seasons, currentId) {
  if (seasons.length <= 1) return '';
  _seasons = seasons;
  _seasonCurrentId = currentId;
  const currentIdx = seasons.findIndex(s => s.id === parseInt(currentId));
  _seasonOffset = Math.max(0, Math.min(currentIdx, seasons.length - SEASONS_PER_PAGE));
  const canLeft = _seasonOffset > 0;
  const canRight = _seasonOffset + SEASONS_PER_PAGE < seasons.length;
  const pagerText = `${_seasonOffset + 1}–${Math.min(_seasonOffset + SEASONS_PER_PAGE, seasons.length)} of ${seasons.length}`;

  return `
    <div class="wp-seasons collapsed" id="seasonsContainer">
      <div class="wp-seasons-header" onclick="toggleSeasons()">
        <span class="wp-section-label">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/></svg>
          Seasons
        </span>
        <div class="wp-seasons-nav">
          <button class="wp-snav-btn" id="snavLeft" onclick="event.stopPropagation(); scrollSeasons(-1)" ${!canLeft ? 'disabled' : ''} aria-label="Previous seasons">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span class="wp-seasons-pager" id="seasonsPager">${pagerText}</span>
          <button class="wp-snav-btn" id="snavRight" onclick="event.stopPropagation(); scrollSeasons(1)" ${!canRight ? 'disabled' : ''} aria-label="Next seasons">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <svg class="wp-seasons-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      <div class="wp-seasons-viewport" id="seasonsViewport">
        ${_renderSeasonCards()}
      </div>
    </div>
  `;
}

// Custom fullscreen code removed — using native iframe fullscreen instead.
// The iframe has allowfullscreen so each server's built-in fullscreen button works.

// Toggle seasons expand/collapse
window.toggleSeasons = function() {
  const container = document.getElementById('seasonsContainer');
  if (container) {
    container.classList.toggle('collapsed');
    updateSeasonsToggleText();
  }
};

// Update seasons toggle text based on collapsed state
function updateSeasonsToggleText() {
  const container = document.getElementById('seasonsContainer');
  const label = container?.querySelector('.wp-section-label');
  if (!container || !label) return;

  const isCollapsed = container.classList.contains('collapsed');
  const baseText = 'Seasons';
  const hintText = isCollapsed ? ' (click to expand)' : '';

  // Keep the SVG and update text
  const svg = label.querySelector('svg');
  label.innerHTML = '';
  if (svg) label.appendChild(svg.cloneNode(true));
  label.appendChild(document.createTextNode(baseText + hintText));
}

// Request landscape orientation on fullscreen (mobile)
function handleFullscreenChange() {
  const iframe = document.querySelector('.video-player iframe');
  if (!iframe) return;

  if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
    // Entering fullscreen - try to request landscape orientation
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {
        // Orientation lock failed (common on iOS), but fullscreen still works
        console.log('Orientation lock not supported or denied');
      });
    }
  } else {
    // Exiting fullscreen - unlock orientation
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock().catch(() => {});
    }
  }
}

// Add fullscreen event listeners
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);

// Switch to different season (always go to latest ep of that season)
window.switchSeason = function(seasonId) {
  const { type } = getWatchParams();
  window.location.href = `watch.html?id=${seasonId}&type=${type}`;
};

// Change episode
window.changeEpisode = function(newEpisode) {
  const { id, type } = getWatchParams();
  if (newEpisode >= 1) {
    window.location.href = `watch.html?id=${id}&ep=${newEpisode}&type=${type}`;
  }
};

// Change sub/dub type
window.changeType = function(newType) {
  const { id, episode } = getWatchParams();
  const epParam = episode ? `&ep=${episode}` : '';
  window.location.href = `watch.html?id=${id}${epParam}&type=${newType}`;
};

// Update SEO meta tags dynamically
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

// Generate JSON-LD structured data for SEO
function generateStructuredData(anime, currentEpisode, isMovie) {
  const title = anime.title.english || anime.title.romaji;
  const description = anime.description ? anime.description.replace(/<[^>]*>/g, '').substring(0, 150) + (anime.description.length > 150 ? '...' : '') : `Watch ${title} on ANIU by JFlix.`;
  const image = anime.coverImage.extraLarge || anime.coverImage.large || 'https://jflix.uk/images/logo.svg';
  const schema = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    'name': title,
    'description': description,
    'image': image,
    'url': window.location.href,
    'numberOfEpisodes': anime.episodes || undefined,
    'aggregateRating': anime.averageScore ? {
      '@type': 'AggregateRating',
      'ratingValue': (anime.averageScore / 10).toFixed(1),
      'bestRating': '10',
      'ratingCount': anime.popularity || 0
    } : undefined,
    'genre': anime.genres ? anime.genres.join(', ') : undefined
  };

  if (!isMovie) {
    schema.episode = {
      '@type': 'TVEpisode',
      'episodeNumber': currentEpisode,
      'name': `${title} Episode ${currentEpisode}`
    };
  }

  // Remove undefined values
  Object.keys(schema).forEach(key => {
    if (schema[key] === undefined) delete schema[key];
  });

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

// Generate breadcrumb structured data
function generateBreadcrumbList(title, episode, isMovie, url) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': 'https://jflix.uk/aniu/index.html'
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': title,
        'item': 'https://jflix.uk/aniu/anime.html?id=' + (url.match(/id=(\d+)/) ? url.match(/id=(\d+)/)[1] : '')
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': isMovie ? 'Watch Movie' : 'Episode ' + episode,
        'item': url
      }
    ]
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(breadcrumb);
  document.head.appendChild(script);
}

// Load watch page
async function loadWatchPage() {
  const { id, episode, type } = getWatchParams();
  const watchContainer = document.getElementById('watchContainer');

  if (!id) {
    watchContainer.innerHTML = '<p class="loading">Anime ID not found.</p>';
    return;
  }

  watchContainer.innerHTML = `
    <div class="wp-layout">
      <div class="wp-player-col">
        <div class="wp-player-skeleton"></div>
      </div>
      <div class="wp-sidebar-col">
        <div class="wp-sidebar-skeleton"></div>
      </div>
    </div>`;

  const data = await fetchAnilist(ANIME_DETAIL_QUERY, { id: parseInt(id) });

  if (!data || !data.Media) {
    watchContainer.innerHTML = '<p class="loading">Failed to load. Please try again later.</p>';
    return;
  }

  const anime = data.Media;
  const title = anime.title.english || anime.title.romaji;
  // Vidlink (Server 3) keys off MyAnimeList IDs — may be absent for some titles
  currentMalId = anime.idMal || null;
  const isMovie = anime.format === 'MOVIE';
  const availableEpisodes = getAvailableEpisodes(anime);

  // Always default to latest episode (default to 1 for movies)
  const currentEpisode = isMovie ? 1 : (episode ? parseInt(episode) : availableEpisodes || 1);

  // If URL has no ep param and it is NOT a movie, redirect to latest
  if (!episode && availableEpisodes > 0 && !isMovie) {
    window.history.replaceState(null, '', `watch.html?id=${id}&ep=${availableEpisodes}&type=${type}`);
  }

  const streamUrl = generateStreamUrl(id, currentEpisode, type);
  const seasons = getSeasons(anime);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
  const statusLabel = anime.status === 'RELEASING' ? 'Airing' : (anime.status || 'Unknown');

  // Update SEO for this anime
  const cleanDescription = anime.description ? anime.description.replace(/<[^>]*>/g, '').substring(0, 150) + (anime.description.length > 150 ? '...' : '') : `Watch ${title} on ANIU by JFlix.`;
  const episodeText = isMovie ? 'Full Movie' : `Episode ${currentEpisode}`;
  const seoTitle = `Watch ${title} ${episodeText} | ANIU by JFlix - Free Anime Streaming`;
  const seoDescription = `Watch ${title} ${episodeText} for free on ANIU by JFlix. ${cleanDescription}`;
  const seoImage = anime.coverImage.extraLarge || anime.coverImage.large || 'https://jflix.uk/images/logo.svg';
  updateSEOMetaTags(seoTitle, seoDescription, seoImage, window.location.href);
  generateStructuredData(anime, currentEpisode, isMovie);
  generateBreadcrumbList(title, currentEpisode, isMovie, window.location.href);

  watchContainer.innerHTML = `
    <div class="wp-breadcrumb">
      <a href="index.html" class="wp-breadcrumb-link">Home</a>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      <a href="anime.html?id=${id}" class="wp-breadcrumb-link">${title}</a>
      ${isMovie ? '' : `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      <span>Episode ${currentEpisode}</span>`}
    </div>

    <div class="wp-layout ${isMovie ? 'wp-layout-full' : ''}">
      <div class="wp-player-col">
        ${generateServerBarHTML()}
        <div class="video-player" id="videoPlayer">
          <iframe
            src="${streamUrl}"
            frameBorder="0"
            scrolling="no"
            allowfullscreen
            allow="fullscreen; fullscreen-allowed; encrypted-media; autoplay; picture-in-picture; clipboard-read; clipboard-write; web-share; screen-wake-lock; display-capture"
            webkitallowfullscreen="true"
            mozallowfullscreen="true"
            playsinline
            style="border:0;">
          </iframe>
        </div>

        <div class="wp-player-meta">
          <div class="wp-player-title-row">
            <div>
              <h2 class="wp-title">${title}</h2>
              <div class="wp-subtitle">${isMovie ? 'Full Movie' : `Episode ${currentEpisode} ${availableEpisodes ? `of ${availableEpisodes}` : ''}`}</div>
            </div>
            <div class="wp-player-meta-controls">
              ${isMovie ? '' : `
              <label class="autoplay-toggle">
                <input type="checkbox" id="autoplayToggle" ${localStorage.getItem('aniu_autoplay_next') === 'true' ? 'checked' : ''}>
                <span>Autoplay Next</span>
              </label>`}
              <div class="wp-type-toggle">
                <button class="wp-type-btn ${type === 'sub' ? 'active' : ''}" onclick="changeType('sub')">SUB</button>
                <button class="wp-type-btn ${type === 'dub' ? 'active' : ''}" onclick="changeType('dub')">DUB</button>
              </div>
            </div>
          </div>

          <div class="wp-tags">
            <span class="wp-tag">${anime.format || 'TV'}</span>
            <span class="wp-tag ${anime.status === 'RELEASING' ? 'wp-tag-airing' : ''}">${statusLabel}</span>
            <span class="wp-tag">★ ${score}</span>
            ${anime.genres ? anime.genres.slice(0, 3).map(g => `<span class="wp-tag wp-tag-genre">${g}</span>`).join('') : ''}
          </div>

          <div class="wp-actions">
            ${currentEpisode < availableEpisodes && !isMovie ? `
            <button class="wp-action-btn accent-action" onclick="changeEpisode(${currentEpisode + 1})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Next Episode
            </button>` : ''}
            <button id="watchlistBtn" class="wp-action-btn">
              <!-- Populated dynamically -->
            </button>
            <a href="anime.html?id=${id}" class="wp-action-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Details
            </a>
            <a href="index.html" class="wp-action-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              Home
            </a>
          </div>
        </div>

        ${generateSeasonsHTML(seasons, id)}
      </div>

      ${isMovie ? '' : `
      <div class="wp-sidebar-col">
        <div class="wp-sidebar-header">
          <span class="wp-section-label">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h5"/></svg>
            Episodes
          </span>
          <span class="wp-eps-count">${availableEpisodes} released</span>
        </div>
        <div class="wp-eps-wrap">
          ${generateEpisodesHTML(availableEpisodes, currentEpisode, id, type)}
        </div>
      </div>`}
    </div>
    <div class="third-party-disclaimer">
      <i class="fas fa-info-circle"></i> ANIU does not host, upload, or store any video files. All anime streams are embedded from publicly available third-party sources.
    </div>
  `;

  // Reset server to 1 on each page load
  currentServer = 1;

  // Save to Continue Watching
  saveContinueWatching(id, title, anime.coverImage.large || anime.coverImage.extraLarge, currentEpisode, availableEpisodes);

  // Watchlist button toggle handler
  updateWatchlistBtnState(id);
  const wlBtn = document.getElementById('watchlistBtn');
  if (wlBtn) {
    wlBtn.addEventListener('click', () => toggleWatchlist(anime));
  }

  // Initialize seasons toggle text
  updateSeasonsToggleText();

  // Autoplay toggle handler
  const apToggle = document.getElementById('autoplayToggle');
  if (apToggle) {
    apToggle.addEventListener('change', (e) => {
      localStorage.setItem('aniu_autoplay_next', e.target.checked ? 'true' : 'false');
    });
  }

  // Scroll active episode into view
  setTimeout(() => {
    const activeBtn = document.querySelector('.episode-btn.active');
    if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 100);
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadWatchPage();
  requestWakeLock();
  // Release when hidden, re-request when visible (mirrors main player.js)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  });

  // Keyboard Hotkeys / Navigation Shortcuts
  document.addEventListener('keydown', (e) => {
    // If typing in an input/textarea, ignore hotkeys
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    const { id, episode, type } = getWatchParams();
    const curEp = parseInt(episode) || 1;

    if (e.key === 'ArrowRight') {
      const epsCountEl = document.querySelector('.wp-eps-count');
      const maxEps = epsCountEl ? parseInt(epsCountEl.textContent) : 0;
      if (curEp < maxEps) {
        e.preventDefault();
        changeEpisode(curEp + 1);
      }
    } else if (e.key === 'ArrowLeft') {
      if (curEp > 1) {
        e.preventDefault();
        changeEpisode(curEp - 1);
      }
    } else if (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'd') {
      e.preventDefault();
      changeType(type === 'sub' ? 'dub' : 'sub');
    } else if (e.key.toLowerCase() === 'f') {
      const iframe = document.querySelector('.video-player iframe');
      if (iframe) {
        e.preventDefault();
        if (iframe.requestFullscreen) {
          iframe.requestFullscreen();
        } else if (iframe.webkitRequestFullscreen) {
          iframe.webkitRequestFullscreen();
        } else if (iframe.msRequestFullscreen) {
          iframe.msRequestFullscreen();
        }
      }
    } else if (e.key.toLowerCase() === 'Escape') {
      // Exit fullscreen on Escape
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (document.webkitFullscreenElement) {
        document.webkitExitFullscreen();
      } else if (document.mozFullScreenElement) {
        document.mozCancelFullScreen();
      }
    } else if (e.key === '/') {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
    document.addEventListener('click', (e) => {
      if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });
  }
});
