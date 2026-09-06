const POSTER_URL = 'https://image.tmdb.org/t/p/w500';
const API_KEY = '84549ba3644ea15176802ec153bd9442';

async function fetchFromTMDB(endpoint, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  url.searchParams.append('api_key', API_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  const response = await fetch(url);
  return response.json();
}

async function createMediaCard(item, mediaType) {
  const card = document.createElement('div');
  card.className = 'media-card';

  if (item.media_type === 'movie') {
    card.classList.add('movies');
  } else if (item.media_type === 'tv') {
    if (mediaType === 'anime') {
      card.classList.add('anime');
    } else if (mediaType === 'korean') {
        card.classList.add('korean');
    } else {
      card.classList.add('tvshows');
    }
  }

  const posterContainer = document.createElement('div');
  posterContainer.className = 'card-poster-container';

  const poster = document.createElement('img');
  poster.className = 'card-poster';
  poster.src = item.poster_path ? `${POSTER_URL}${item.poster_path}` : 'images/no-poster.jpg';
  poster.alt = item.title || item.name || 'Title';
  poster.loading = 'lazy';
  poster.onerror = () => { poster.src = 'images/no-poster.jpg'; };

  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';

  // Netflix/Prime Quick Match & Quality Badges
  const topBadges = document.createElement('div');
  topBadges.className = 'card-top-badges';

  const matchScore = Math.min(99, Math.max(84, Math.round((item.vote_average || 7) * 10 + 12)));
  const matchBadge = document.createElement('span');
  matchBadge.className = 'card-match-badge';
  matchBadge.textContent = `${matchScore}% Match`;

  const topBadgesRight = document.createElement('div');
  topBadgesRight.className = 'card-top-badges-right';

  const type = item.media_type || mediaType || 'movie';
  let typeLabel = '';
  let typeClass = '';
  if (type === 'movie') {
    typeLabel = 'Movie';
    typeClass = 'movies';
  } else if (item.original_language === 'ja' || mediaType === 'anime') {
    typeLabel = 'Anime';
    typeClass = 'anime';
  } else if (item.original_language === 'ko' || mediaType === 'korean') {
    typeLabel = 'K-Drama';
    typeClass = 'korean';
  } else {
    typeLabel = 'TV';
    typeClass = 'tvshows';
  }

  const typeBadge = document.createElement('span');
  typeBadge.className = `card-type-badge ${typeClass}`;
  typeBadge.textContent = typeLabel;

  const hdBadge = document.createElement('span');
  hdBadge.className = 'card-hd-badge';
  hdBadge.textContent = 'HD';

  topBadgesRight.appendChild(typeBadge);
  topBadgesRight.appendChild(hdBadge);

  topBadges.appendChild(matchBadge);
  topBadges.appendChild(topBadgesRight);

  const buttons = document.createElement('div');
  buttons.className = 'card-buttons';

  const watchBtn = document.createElement('button');
  watchBtn.className = 'btn watch-btn';
  watchBtn.innerHTML = '<i class="fas fa-play"></i> Watch';
  watchBtn.title = 'Watch Now';
  watchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `player.html?id=${item.id}&type=${item.media_type || mediaType || 'movie'}`;
  });

  const detailsBtn = document.createElement('button');
  detailsBtn.className = 'btn details-btn';
  detailsBtn.innerHTML = '<i class="fas fa-info-circle"></i> Info';
  detailsBtn.title = 'View Details';
  detailsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `details.html?id=${item.id}&type=${item.media_type || mediaType || 'movie'}`;
  });

  // Netflix/Prime Quick Watchlist toggle button
  const watchlistBtn = document.createElement('button');
  watchlistBtn.className = 'btn watchlist-btn';
  watchlistBtn.title = 'Add to Watchlist';
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
      if (window.showToast) window.showToast(`Removed "${item.title || item.name}" from Watch Later`, 'info', 'fa-minus');
    } else {
      currentList.unshift({
        id: item.id,
        title: item.title || item.name,
        poster_path: item.poster_path,
        media_type: item.media_type || mediaType || 'movie',
        vote_average: item.vote_average,
        saved_at: new Date().toISOString()
      });
      watchlistBtn.innerHTML = '<i class="fas fa-check"></i>';
      watchlistBtn.classList.add('in-watchlist');
      if (window.showToast) window.showToast(`Added "${item.title || item.name}" to Watch Later — <a href="watchlist.html" style="color:#46d369;text-decoration:underline;margin-left:4px;font-weight:700;">View List</a>`, 'success', 'fa-bookmark');
    }
    localStorage.setItem('jflix_watchlist', JSON.stringify(currentList));
    if (window.updateWatchlistBadgeCount) window.updateWatchlistBadgeCount();
  });

  buttons.appendChild(watchBtn);
  buttons.appendChild(detailsBtn);
  buttons.appendChild(watchlistBtn);
  overlay.appendChild(buttons);


  const info = document.createElement('div');
  info.className = 'card-info';

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = item.title || item.name || 'Untitled';

  const rating = document.createElement('div');
  rating.className = 'card-rating';
  const vote = typeof item.vote_average === 'number' ? item.vote_average : 0;
  const stars = Math.min(5, Math.max(0, Math.round(vote / 2)));
  rating.innerHTML = `<span class="stars-text">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span> <span class="rating-num">${vote > 0 ? vote.toFixed(1) : ''}</span>`;

  const year = document.createElement('p');
  year.className = 'card-year';
  const releaseDate = item.release_date || item.first_air_date;
  year.textContent = releaseDate ? releaseDate.split('-')[0] : '';

  info.appendChild(title);
  info.appendChild(rating);
  info.appendChild(year);

  posterContainer.appendChild(poster);
  posterContainer.appendChild(topBadges);
  posterContainer.appendChild(overlay);

  // Non-blocking season badge load for TV shows
  if (item.media_type === 'tv' || mediaType === 'tvshows' || mediaType === 'anime' || mediaType === 'korean') {
    fetchFromTMDB(`tv/${item.id}`)
      .then(seriesDetails => {
        if (seriesDetails && seriesDetails.last_episode_to_air) {
          const badge = document.createElement('div');
          badge.className = 'season-badge';
          if (seriesDetails.status === 'Ended' || seriesDetails.status === 'Canceled') {
            badge.textContent = 'COMPLETED';
            badge.classList.add('completed');
          } else {
            badge.textContent = `S${String(seriesDetails.last_episode_to_air.season_number).padStart(2, '0')}, E${String(seriesDetails.last_episode_to_air.episode_number).padStart(2, '0')}`;
          }
          posterContainer.appendChild(badge);
        }
      })
      .catch(() => {});
  }

  card.appendChild(posterContainer);
  card.appendChild(info);

  card.addEventListener('click', () => {
    window.location.href = `details.html?id=${item.id}&type=${item.media_type || mediaType || 'movie'}`;
  });

  return card;
}
