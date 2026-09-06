// Universal Live Search Dropdown
const _SEARCH_API = 'https://graphql.anilist.co';

// Rate limiting queue to prevent 429 errors
const _requestQueue = [];
let _isProcessing = false;
const _REQUEST_DELAY = 500; // 500ms between requests

async function _rateLimitedFetch(url, options) {
  return new Promise((resolve, reject) => {
    _requestQueue.push({ url, options, resolve, reject });
    _processQueue();
  });
}

async function _processQueue() {
  if (_isProcessing || _requestQueue.length === 0) return;
  
  _isProcessing = true;
  const { url, options, resolve, reject } = _requestQueue.shift();
  
  try {
    await new Promise(r => setTimeout(r, _REQUEST_DELAY));
    const response = await fetch(url, options);
    resolve(response);
  } catch (error) {
    reject(error);
  } finally {
    _isProcessing = false;
    _processQueue();
  }
}

const _LIVE_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 12) {
      media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
        id
        title { romaji english }
        coverImage { medium large }
        format
        status
        averageScore
        episodes
        nextAiringEpisode { episode }
      }
    }
  }
`;

let _searchTimer = null;
let _lastQuery = '';

async function _fetchLiveSearch(query) {
  try {
    const res = await _rateLimitedFetch(_SEARCH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: _LIVE_QUERY, variables: { search: query } })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data?.Page?.media || [];
  } catch { return []; }
}

function _renderDropdown(results, container) {
  if (results.length === 0) {
    container.innerHTML = `<div class="sdrop-empty">No results found</div>`;
    return;
  }

  container.innerHTML = results.map(anime => {
    const title = anime.title.english || anime.title.romaji;
    const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : '?';
    const type = anime.format || 'TV';
    const statusLabel = anime.status === 'RELEASING' ? 'Airing' : (anime.status === 'FINISHED' ? 'Finished' : anime.status || '');
    let eps = anime.episodes || '';
    if (anime.status === 'RELEASING' && anime.nextAiringEpisode) {
      eps = `${anime.nextAiringEpisode.episode - 1} eps`;
    } else if (eps) {
      eps = `${eps} eps`;
    }
    const poster = anime.coverImage.medium || anime.coverImage.large;

    return `
      <a class="sdrop-item" href="anime.html?id=${anime.id}">
        <img class="sdrop-poster" src="${poster}" alt="${title}" loading="lazy">
        <div class="sdrop-info">
          <div class="sdrop-title">${title}</div>
          <div class="sdrop-meta">
            <span class="sdrop-type">${type}</span>
            ${statusLabel ? `<span class="sdrop-status ${anime.status === 'RELEASING' ? 'airing' : ''}">${statusLabel}</span>` : ''}
            ${eps ? `<span>${eps}</span>` : ''}
            <span class="sdrop-score">★ ${score}</span>
          </div>
        </div>
        <div class="sdrop-btns">
          <button class="sdrop-watch" onclick="event.preventDefault();event.stopPropagation();window.location.href='watch.html?id=${anime.id}&type=sub'">▶ Watch</button>
        </div>
      </a>
    `;
  }).join('');
}

function initLiveSearch(inputEl, dropdownEl) {
  if (!inputEl || !dropdownEl) return;

  let activeIndex = -1;

  // Clicking search wrapper focuses search input
  const parent = inputEl.parentElement;
  if (parent) {
    parent.addEventListener('click', (e) => {
      if (e.target !== inputEl) {
        inputEl.focus();
      }
    });
  }

  function closeDropdown() {
    dropdownEl.classList.remove('active');
    dropdownEl.innerHTML = '';
    _lastQuery = '';
    activeIndex = -1;
  }

  function updateActiveItem(items) {
    items.forEach((item, index) => {
      item.classList.toggle('active-sitem', index === activeIndex);
      if (index === activeIndex) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  inputEl.addEventListener('input', () => {
    const query = inputEl.value.trim();
    clearTimeout(_searchTimer);

    if (query.length < 3) {
      closeDropdown();
      return;
    }

    if (query === _lastQuery) return;

    dropdownEl.classList.add('active');
    dropdownEl.innerHTML = `
      <div class="sdrop-loading">
        <span class="sdrop-spinner"></span> Searching…
      </div>`;

    activeIndex = -1;

    _searchTimer = setTimeout(async () => {
      const currentQuery = inputEl.value.trim();
      if (currentQuery.length < 3) { closeDropdown(); return; }
      _lastQuery = currentQuery;
      const results = await _fetchLiveSearch(currentQuery);
      if (inputEl.value.trim() === currentQuery) {
        _renderDropdown(results, dropdownEl);
        activeIndex = -1;
      }
    }, 320);
  });

  inputEl.addEventListener('keydown', (e) => {
    const items = dropdownEl.querySelectorAll('.sdrop-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      if (activeIndex > -1 && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
      inputEl.blur();
    }
  });

  document.addEventListener('click', (e) => {
    const wrap = inputEl.closest('.sdrop-wrap') || inputEl.closest('.search-overlay-header') || inputEl.parentElement;
    if (!wrap.contains(e.target) && !dropdownEl.contains(e.target)) {
      closeDropdown();
    }
  });
}
