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

// GraphQL Queries
const TRENDING_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING_DESC) {
        id title { romaji english } coverImage { large }
        episodes status genres averageScore format seasonYear nextAiringEpisode { episode }
      }
    }
  }
`;

const POPULAR_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english } coverImage { large }
        episodes status genres averageScore format seasonYear nextAiringEpisode { episode }
      }
    }
  }
`;

const RECENT_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: START_DATE_DESC, format_not: MOVIE) {
        id title { romaji english } coverImage { large }
        episodes status genres averageScore format seasonYear nextAiringEpisode { episode }
      }
    }
  }
`;

const AIRING_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, status: RELEASING, sort: UPDATED_AT_DESC, format_not: MOVIE) {
        id title { romaji english } coverImage { large }
        episodes status genres averageScore format updatedAt nextAiringEpisode { episode airingAt timeUntilAiring }
      }
    }
  }
`;

const MOVIES_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC, format: MOVIE) {
        id title { romaji english } coverImage { large }
        episodes status genres averageScore format seasonYear nextAiringEpisode { episode }
      }
    }
  }
`;

const SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english } coverImage { large }
        episodes status genres averageScore format seasonYear
      }
    }
  }
`;

const FEATURED_QUERY = `
  query {
    Page(page: 1, perPage: 6) {
      media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING) {
        id title { romaji english } coverImage { extraLarge large }
        bannerImage description episodes genres averageScore format status
        nextAiringEpisode { episode }
      }
    }
  }
`;

const ANIME_DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id title { romaji english native } coverImage { large extraLarge }
      bannerImage episodes status genres averageScore format description
      seasonYear season studios { nodes { name } } source duration
      rankings { rank type context } nextAiringEpisode { episode }
    }
  }
`;

// Fetch
async function fetchAnilist(query, variables = {}) {
  try {
    const response = await rateLimitedFetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Anilist API error:', error);
    return null;
  }
}

// Skeleton Cards
function createSkeletonCards(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-card-img"></div>
      <div class="skeleton-card-info">
        <div class="skeleton-line w-full"></div>
        <div class="skeleton-line w-70"></div>
        <div class="skeleton-line w-50"></div>
      </div>
    </div>
  `).join('');
}

// Anime Card with rank + Watch/Details buttons
function createAnimeCard(anime, index) {
  const title = anime.title.english || anime.title.romaji;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
  const type = anime.format || 'TV';
  const rankNum = typeof index === 'number' ? index + 1 : null;
  const isReleased = anime.status !== 'NOT_YET_RELEASED';
  const isMovie = anime.format === 'MOVIE';
  const watchUrl = isMovie 
    ? `watch.html?id=${anime.id}&type=sub` 
    : `watch.html?id=${anime.id}&ep=1&type=sub`;

  return `
    <div class="anime-card" title="${title}">
      ${rankNum && rankNum <= 10 ? `<div class="anime-rank">#${rankNum}</div>` : ''}
      <img src="${anime.coverImage.large}" alt="${title}" class="anime-poster" loading="lazy">
      <div class="anime-info">
        <h3 class="anime-title">${title}</h3>
        <div class="anime-meta">
          <span class="anime-type">${type}</span>
          <span class="anime-score">★ ${score}</span>
        </div>
        <div class="card-action-btns">
          ${isReleased ? `
          <button class="card-btn card-btn-watch" onclick="event.stopPropagation(); window.location.href='${watchUrl}'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Watch
          </button>` : ''}
          <button class="card-btn card-btn-details" onclick="event.stopPropagation(); window.location.href='anime.html?id=${anime.id}'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            Details
          </button>
        </div>
      </div>
    </div>
  `;
}

// Load grid with skeleton
async function loadAnimeGrid(gridId, query, variables = {}) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = createSkeletonCards(10);
  const data = await fetchAnilist(query, variables);
  if (data && data.Page && data.Page.media) {
    grid.innerHTML = data.Page.media.map((a, i) => createAnimeCard(a, i)).join('');
  } else {
    grid.innerHTML = '<p class="loading">Failed to load. Please try again.</p>';
  }
}

// Hero Rotation
let heroAnimeList = [];
let heroIndex = 0;
let heroTimer = null;

function setHeroAnime(anime) {
  const title = anime.title.english || anime.title.romaji;
  const desc = anime.description ? anime.description.replace(/<[^>]*>/g, '').substring(0, 200) + '…' : 'No description.';
  const banner = anime.bannerImage || anime.coverImage.extraLarge || anime.coverImage.large;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

  const el = (id) => document.getElementById(id);
  if (el('heroBanner')) el('heroBanner').style.backgroundImage = `url('${banner}')`;
  if (el('heroTitle')) el('heroTitle').textContent = title;
  if (el('heroDescription')) el('heroDescription').textContent = desc;

  if (el('heroBadges')) {
    el('heroBadges').innerHTML = [
      anime.status === 'RELEASING' ? '<span class="badge badge-airing">Airing</span>' : '',
      score ? `<span class="badge badge-score">★ ${score}</span>` : '',
      anime.format ? `<span class="badge badge-format">${anime.format.replace('_', ' ')}</span>` : ''
    ].join('');
  }

  if (el('heroMeta')) {
    const epText = anime.nextAiringEpisode ? `EP ${anime.nextAiringEpisode.episode - 1} aired` : (anime.episodes ? `${anime.episodes} eps` : '');
    el('heroMeta').innerHTML = epText ? `<span>${epText}</span>` : '';
  }

  if (el('heroGenres') && anime.genres) {
    el('heroGenres').innerHTML = anime.genres.slice(0, 5).map(g => `<span class="genre-pill">${g}</span>`).join('');
  }

  if (el('heroPlayBtn')) {
    const isMovie = anime.format === 'MOVIE';
    const playUrl = isMovie 
      ? `watch.html?id=${anime.id}&type=sub` 
      : `watch.html?id=${anime.id}&ep=1&type=sub`;
    el('heroPlayBtn').setAttribute('onclick', `window.location.href='${playUrl}'`);
  }
  if (el('heroInfoBtn')) {
    el('heroInfoBtn').setAttribute('onclick', `window.location.href='anime.html?id=${anime.id}'`);
  }
}

function updateHeroDots() {
  const dotsEl = document.getElementById('heroDots');
  if (!dotsEl || heroAnimeList.length <= 1) return;
  dotsEl.innerHTML = heroAnimeList.map((_, i) =>
    `<button class="hero-dot${i === heroIndex ? ' active' : ''}" onclick="goToHeroSlide(${i})"></button>`
  ).join('');
}

function goToHeroSlide(index) {
  heroIndex = index;
  setHeroAnime(heroAnimeList[heroIndex]);
  updateHeroDots();
  resetHeroTimer();
}

function resetHeroTimer() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % heroAnimeList.length;
    setHeroAnime(heroAnimeList[heroIndex]);
    updateHeroDots();
  }, 7000);
}

async function loadFeaturedAnime() {
  const data = await fetchAnilist(FEATURED_QUERY);
  if (data?.Page?.media?.length > 0) {
    heroAnimeList = data.Page.media.filter(a => a.bannerImage || a.coverImage.extraLarge);
    if (heroAnimeList.length === 0) heroAnimeList = data.Page.media;
    setHeroAnime(heroAnimeList[0]);
    updateHeroDots();
    resetHeroTimer();
  }
}

// Render Continue Watching and My Watchlist sections from localStorage
function renderLocalSections() {
  const mainSections = document.querySelector('.main-sections');
  if (!mainSections) return;

  // 1. Continue Watching
  const cwList = JSON.parse(localStorage.getItem('aniu_continue_watching') || '[]');
  let cwSection = document.getElementById('continueWatchingSection');

  if (cwList.length > 0) {
    if (!cwSection) {
      cwSection = document.createElement('section');
      cwSection.id = 'continueWatchingSection';
      cwSection.className = 'section';
      mainSections.insertBefore(cwSection, document.getElementById('trending'));
    }
    
    cwSection.innerHTML = `
      <div class="section-header">
        <h2><span class="section-number">CW</span> Continue Watching</h2>
        <div class="section-controls">
          <button class="row-arrow row-arrow-left" onclick="scrollRow('continueWatchingGrid', -1)" aria-label="Scroll left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button class="row-arrow row-arrow-right" onclick="scrollRow('continueWatchingGrid', 1)" aria-label="Scroll right">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div class="row-wrapper">
        <div class="anime-grid" id="continueWatchingGrid">
          ${cwList.map(item => `
            <div class="anime-card" title="${item.title}">
              <div class="anime-card-progress-bar">
                <div class="anime-card-progress" style="width: ${(item.episode / (item.totalEpisodes || item.episode)) * 100}%"></div>
              </div>
              <img src="${item.coverImage}" alt="${item.title}" class="anime-poster" loading="lazy">
              <div class="anime-info">
                <h3 class="anime-title">${item.title}</h3>
                <div class="anime-meta">
                  <span class="anime-type">EP ${item.episode} / ${item.totalEpisodes || '?'}</span>
                </div>
                <div class="card-action-btns">
                  <button class="card-btn card-btn-watch" onclick="event.stopPropagation(); window.location.href='watch.html?id=${item.id}&ep=${item.episode}&type=sub'">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    Resume
                  </button>
                  <button class="card-btn card-btn-details" onclick="event.stopPropagation(); window.location.href='anime.html?id=${item.id}'">
                    Info
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    // Add scroll event listener to the new grid
    const grid = document.getElementById('continueWatchingGrid');
    if (grid) {
      grid.addEventListener('scroll', () => updateScrollIndicators(grid));
      updateScrollIndicators(grid);
    }
  } else if (cwSection) {
    cwSection.remove();
  }

  // 2. My Watchlist
  const wlList = JSON.parse(localStorage.getItem('aniu_watchlist') || '[]');
  let wlSection = document.getElementById('watchlistSection');

  if (wlList.length > 0) {
    if (!wlSection) {
      wlSection = document.createElement('section');
      wlSection.id = 'watchlistSection';
      wlSection.className = 'section';
      const refNode = document.getElementById('continueWatchingSection') || document.getElementById('trending');
      mainSections.insertBefore(wlSection, refNode.nextSibling);
    }

    wlSection.innerHTML = `
      <div class="section-header">
        <h2><span class="section-number">WL</span> My Watchlist</h2>
        <div class="section-controls">
          <button class="row-arrow row-arrow-left" onclick="scrollRow('watchlistGrid', -1)" aria-label="Scroll left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button class="row-arrow row-arrow-right" onclick="scrollRow('watchlistGrid', 1)" aria-label="Scroll right">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div class="row-wrapper">
        <div class="anime-grid" id="watchlistGrid">
          ${wlList.map(item => `
            <div class="anime-card" title="${item.title}">
              <img src="${item.coverImage}" alt="${item.title}" class="anime-poster" loading="lazy">
              <div class="anime-info">
                <h3 class="anime-title">${item.title}</h3>
                <div class="anime-meta">
                  <span class="anime-type">${item.format}</span>
                  <span class="anime-score">★ ${item.score}</span>
                </div>
                <div class="card-action-btns">
                  <button class="card-btn card-btn-watch" onclick="event.stopPropagation(); window.location.href='watch.html?id=${item.id}&ep=1&type=sub'">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    Watch
                  </button>
                  <button class="card-btn card-btn-details" onclick="event.stopPropagation(); window.location.href='anime.html?id=${item.id}'">
                    Info
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    const grid = document.getElementById('watchlistGrid');
    if (grid) {
      grid.addEventListener('scroll', () => updateScrollIndicators(grid));
      updateScrollIndicators(grid);
    }
  } else if (wlSection) {
    wlSection.remove();
  }
}

// Search functionality
async function searchAnime(query) {
  if (!query.trim()) return;

  const data = await fetchAnilist(SEARCH_QUERY, { search: query, page: 1, perPage: 20 });
  
  if (data && data.Page && data.Page.media) {
    const trendingGrid = document.getElementById('trendingGrid');
    const popularGrid = document.getElementById('popularGrid');
    const recentGrid = document.getElementById('recentGrid');
    
    if (trendingGrid) {
      trendingGrid.parentElement.style.display = 'none';
    }
    if (popularGrid) {
      popularGrid.parentElement.style.display = 'none';
    }
    if (recentGrid) {
      recentGrid.parentElement.style.display = 'none';
    }

    // Create search results section
    const mainContent = document.querySelector('.main-content');
    let searchSection = document.getElementById('searchResults');
    
    if (!searchSection) {
      searchSection = document.createElement('section');
      searchSection.id = 'searchResults';
      searchSection.className = 'section';
      searchSection.innerHTML = `
        <div class="section-header">
          <h2>Search Results</h2>
        </div>
        <div class="anime-grid" id="searchGrid"></div>
      `;
      mainContent.insertBefore(searchSection, mainContent.children[1]);
    }
    
    searchSection.style.display = 'block';
    document.getElementById('searchGrid').innerHTML = data.Page.media.map(createAnimeCard).join('');
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  // Load featured anime for hero banner
  loadFeaturedAnime();
  
  // Render local sections (Continue Watching and Watchlist)
  renderLocalSections();
  
  // Load trending anime (more items for horizontal scroll)
  loadAnimeGrid('trendingGrid', TRENDING_QUERY, { page: 1, perPage: 20 });
  
  // Load popular anime (more items for horizontal scroll)
  loadAnimeGrid('popularGrid', POPULAR_QUERY, { page: 1, perPage: 20 });
  
  // Load recent anime (more items for horizontal scroll)
  loadAnimeGrid('recentGrid', RECENT_QUERY, { page: 1, perPage: 20 });

  // Load movies
  loadAnimeGrid('moviesGrid', MOVIES_QUERY, { page: 1, perPage: 20 });

  // Search functionality
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  if (searchInput && searchBtn) {
    searchBtn.addEventListener('click', () => searchAnime(searchInput.value));
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchAnime(searchInput.value);
      }
    });
  }

  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // Mobile navigation toggle
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });
  }

  // Add scroll indicators to anime grids
  addScrollIndicators();

  // Load latest episodes for sidebar
  loadLatestEpisodes();

  // Touch device card tap behavior
  initTouchCardBehavior();
});

// Add scroll indicators to horizontal scroll containers
function addScrollIndicators() {
  const grids = document.querySelectorAll('.anime-grid');
  
  grids.forEach(grid => {
    // Add scroll event listener to show/hide indicators
    grid.addEventListener('scroll', () => {
      updateScrollIndicators(grid);
    });
    
    // Initial check
    updateScrollIndicators(grid);
  });
}

// Update scroll indicators visibility
function updateScrollIndicators(grid) {
  const scrollLeft = grid.scrollLeft;
  const scrollWidth = grid.scrollWidth;
  const clientWidth = grid.clientWidth;
  
  // Check if content is scrollable
  if (scrollWidth > clientWidth) {
    grid.classList.add('scrollable');
  } else {
    grid.classList.remove('scrollable');
  }
  
  // Check scroll position
  if (scrollLeft > 10) {
    grid.classList.add('scrolled-left');
  } else {
    grid.classList.remove('scrolled-left');
  }
  
  if (scrollLeft < scrollWidth - clientWidth - 10) {
    grid.classList.add('scrolled-right');
  } else {
    grid.classList.remove('scrolled-right');
  }
}

// Scroll row horizontally with arrow buttons
function scrollRow(gridId, direction) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const scrollAmount = grid.clientWidth * 0.8;
  grid.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Format relative time (e.g. "2h ago", "just now", "in 3h")
function formatRelativeTime(unixSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;
  const absDiff = Math.abs(diff);
  const isFuture = diff < 0;

  if (absDiff < 60) return isFuture ? 'in a moment' : 'just now';
  if (absDiff < 3600) {
    const m = Math.floor(absDiff / 60);
    return isFuture ? `in ${m}m` : `${m}m ago`;
  }
  if (absDiff < 86400) {
    const h = Math.floor(absDiff / 3600);
    return isFuture ? `in ${h}h` : `${h}h ago`;
  }
  const d = Math.floor(absDiff / 86400);
  return isFuture ? `in ${d}d` : `${d}d ago`;
}

// Load latest episodes for compact strip — auto-refreshes every 5 min
let _latestEpisodesTimer = null;

async function loadLatestEpisodes() {
  const container = document.getElementById('latestEpisodesList');
  if (!container) return;

  // Skeleton while loading
  if (!container.children.length) {
    container.innerHTML = Array.from({ length: 12 }, () =>
      `<div class="latest-episode-card" style="pointer-events:none;opacity:.5;">
        <div class="latest-episode-poster" style="background:#222;border-radius:8px;min-width:52px;height:72px;"></div>
        <div class="latest-episode-card-info">
          <div style="background:#222;border-radius:4px;height:11px;width:80%;margin-bottom:7px;"></div>
          <div style="background:#222;border-radius:4px;height:10px;width:50%;"></div>
        </div>
      </div>`
    ).join('');
  }

  const data = await fetchAnilist(AIRING_QUERY, { page: 1, perPage: 50 });

  if (data && data.Page && data.Page.media) {
    let animeList = data.Page.media;

    if (animeList.length === 0) {
      container.innerHTML = '<p class="loading">No currently airing anime.</p>';
      return;
    }

    // Sort newest released episode first:
    // Primary: latestAiredAt = nextAiringEpisode.airingAt - timeUntilAiring (i.e. when ep aired)
    // Fallback: updatedAt
    animeList = animeList.slice().sort((a, b) => {
      const getAiredAt = (anime) => {
        if (anime.nextAiringEpisode) {
          return anime.nextAiringEpisode.airingAt - anime.nextAiringEpisode.timeUntilAiring;
        }
        return anime.updatedAt || 0;
      };
      return getAiredAt(b) - getAiredAt(a);
    });

    container.innerHTML = animeList.map(anime => {
      const title = anime.title.english || anime.title.romaji;
      const coverImage = anime.coverImage.large;
      const nae = anime.nextAiringEpisode;

      // Latest released episode = nextAiring.episode - 1
      // If nextAiring hasn't aired yet (timeUntilAiring > 0), show episode - 1 as latest
      // If it has aired (timeUntilAiring <= 0), it IS the latest
      let latestEpisode, airedAt, isUpcoming;
      if (nae) {
        isUpcoming = nae.timeUntilAiring > 0;
        if (isUpcoming) {
          latestEpisode = nae.episode - 1;
          airedAt = nae.airingAt - nae.timeUntilAiring; // when prev ep aired
        } else {
          latestEpisode = nae.episode;
          airedAt = nae.airingAt;
        }
      } else {
        latestEpisode = anime.episodes || '?';
        airedAt = anime.updatedAt || 0;
        isUpcoming = false;
      }

      const epText = latestEpisode > 0 ? `EP ${latestEpisode}` : 'EP ?';
      const timeText = airedAt ? formatRelativeTime(airedAt) : 'Airing';
      const upcomingLabel = isUpcoming
        ? `<span class="latest-episode-card-upcoming">Next: EP${nae.episode} ${formatRelativeTime(nae.airingAt)}</span>`
        : '';

      return `
        <div class="latest-episode-card" onclick="window.location.href='anime.html?id=${anime.id}'">
          <img src="${coverImage}" alt="${title}" class="latest-episode-poster" loading="lazy">
          <div class="latest-episode-card-info">
            <div class="latest-episode-card-title">${title}</div>
            <div class="latest-episode-card-meta">
              <span class="latest-episode-card-ep">${epText}</span>
              <span class="latest-episode-card-time">${timeText}</span>
            </div>
            ${upcomingLabel}
          </div>
        </div>
      `;
    }).join('');

  } else {
    container.innerHTML = '<p class="loading">Failed to load latest episodes.</p>';
  }

  // Auto-refresh every 5 minutes
  clearTimeout(_latestEpisodesTimer);
  _latestEpisodesTimer = setTimeout(loadLatestEpisodes, 5 * 60 * 1000);
}

// Touch device card tap behavior
function initTouchCardBehavior() {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice) return;

  const cards = document.querySelectorAll('.anime-card');

  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking on buttons
      if (e.target.closest('.card-btn')) return;

      // Add click animation
      card.style.transform = 'scale(0.95)';
      card.style.transition = 'transform 0.15s ease';
      
      setTimeout(() => {
        card.style.transform = '';
      }, 150);

      // Get anime ID from onclick attribute or data attribute
      const watchBtn = card.querySelector('.card-btn-watch');
      if (watchBtn) {
        // Extract the URL from the watch button's onclick
        const onclickAttr = watchBtn.getAttribute('onclick');
        if (onclickAttr) {
          const urlMatch = onclickAttr.match(/window\.location\.href='([^']+)'/);
          if (urlMatch && urlMatch[1]) {
            // Navigate to watch page
            window.location.href = urlMatch[1];
          }
        }
      }
    });
  });
}
