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
      studios { nodes { name } }
      source
      duration
      nextAiringEpisode { episode }
    }
  }
`;

// Fetch data from Anilist API
async function fetchAnilist(query, variables = {}) {
  try {
    const response = await rateLimitedFetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching from Anilist:', error);
    return null;
  }
}

// Get anime ID from URL
function getAnimeId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// Watchlist tracker
function toggleWatchlist(anime) {
  let list = JSON.parse(localStorage.getItem('aniu_watchlist') || '[]');
  const index = list.findIndex(item => parseInt(item.id) === parseInt(anime.id));
  const btn = document.getElementById('watchlistBtn');
  
  if (index > -1) {
    list.splice(index, 1);
    if (btn) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add Watchlist`;
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
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> Watchlisted`;
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
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> Watchlisted`;
      btn.classList.add('active');
    } else {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add Watchlist`;
      btn.classList.remove('active');
    }
  }
}

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
function generateStructuredData(anime) {
  const title = anime.title.english || anime.title.romaji;
  const description = anime.description ? anime.description.replace(/<[^>]*>/g, '').substring(0, 150) + (anime.description.length > 150 ? '...' : '') : `Watch ${title} on ANIU by JFlix.`;
  const image = anime.coverImage.extraLarge || anime.coverImage.large || 'https://jflix.uk/images/logo.svg';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
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
function generateBreadcrumbList(title, url) {
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
        'item': url
      }
    ]
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(breadcrumb);
  document.head.appendChild(script);
}

// Load anime details
async function loadAnimeDetails() {
  const animeId = getAnimeId();
  const detailContainer = document.getElementById('animeDetail');
  
  if (!animeId) {
    detailContainer.innerHTML = '<p class="loading">Anime ID not found.</p>';
    return;
  }

  const data = await fetchAnilist(ANIME_DETAIL_QUERY, { id: parseInt(animeId) });
  
  if (data && data.Media) {
    const anime = data.Media;
    const title = anime.title.english || anime.title.romaji;
    const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
    const studio = anime.studios.nodes.length > 0 ? anime.studios.nodes[0].name : 'Unknown';
    const genres = anime.genres.join(', ');
    const episodes = anime.episodes || '?';

    const isReleased = anime.status !== 'NOT_YET_RELEASED';
    const watchBtnHTML = isReleased ? `
      <button class="hero-btn hero-btn-primary watch-now-btn" onclick="window.location.href='watch.html?id=${animeId}&ep=1&type=sub'">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Watch Now
      </button>
    ` : `
      <button class="hero-btn hero-btn-secondary" disabled>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        Not Yet Released
      </button>
    `;
    
    detailContainer.innerHTML = `
      <div class="anime-detail-poster-wrapper">
        <img src="${anime.coverImage.extraLarge || anime.coverImage.large}" alt="${title}" class="anime-detail-poster">
        <div class="detail-watch-btn">
          ${watchBtnHTML}
        </div>
      </div>
      <div class="anime-detail-content">
        <h1>${title}</h1>
        <div class="anime-detail-meta">
          <span class="meta-tag">${anime.format || 'TV'}</span>
          <span class="meta-tag ${anime.status === 'RELEASING' ? 'accent' : ''}">${anime.status === 'RELEASING' ? 'Airing' : anime.status}</span>
          ${anime.season ? `<span class="meta-tag">${anime.season} ${anime.seasonYear}</span>` : ''}
          <span class="meta-tag">${studio}</span>
        </div>
        <div class="anime-stats">
          <div class="stat-item">
            <div class="stat-label">Score</div>
            <div class="stat-value">⭐ ${score}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Episodes</div>
            <div class="stat-value">${episodes}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Duration</div>
            <div class="stat-value">${anime.duration || '?'} min</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Source</div>
            <div class="stat-value">${anime.source || 'N/A'}</div>
          </div>
        </div>
        <div class="anime-description">
          <h3>Synopsis</h3>
          <p>${anime.description ? anime.description.replace(/<[^>]*>/g, '') : 'No description available.'}</p>
        </div>
        <div class="anime-genres">
          <h3>Genres</h3>
          <p>${genres}</p>
        </div>
        ${isReleased ? `
        <div class="detail-action-row">
          <button class="hero-btn hero-btn-secondary" onclick="window.location.href='watch.html?id=${animeId}&ep=1&type=dub'">
            Switch to Dub
          </button>
          <button id="watchlistBtn" class="hero-btn hero-btn-secondary">
            <!-- Dynamically populated -->
          </button>
        </div>
        <div class="third-party-disclaimer">
          <i class="fas fa-info-circle"></i> ANIU does not host, upload, or store any video files. All anime streams are embedded from publicly available third-party sources.
        </div>` : ''}
      </div>
    `;

    // Update SEO for this anime
    const cleanDescription = anime.description ? anime.description.replace(/<[^>]*>/g, '').substring(0, 150) + (anime.description.length > 150 ? '...' : '') : `Watch ${title} on ANIU by JFlix.`;
    const seoTitle = `${title}${anime.seasonYear ? ' (' + anime.seasonYear + ')' : ''} | Watch on ANIU by JFlix - Free Anime Streaming`;
    const seoDescription = `Watch ${title} for free on ANIU by JFlix. ${cleanDescription}`;
    const seoImage = anime.coverImage.extraLarge || anime.coverImage.large || 'https://jflix.uk/images/logo.svg';
    updateSEOMetaTags(seoTitle, seoDescription, seoImage, window.location.href);
    generateStructuredData(anime);
    generateBreadcrumbList(title, window.location.href);

    // Handle watchlist button binding
    updateWatchlistBtnState(animeId);
    const wlBtn = document.getElementById('watchlistBtn');
    if (wlBtn) {
      wlBtn.addEventListener('click', () => toggleWatchlist(anime));
    }
  } else {
    detailContainer.innerHTML = '<p class="loading">Failed to load anime details. Please try again later.</p>';
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadAnimeDetails();

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
});
