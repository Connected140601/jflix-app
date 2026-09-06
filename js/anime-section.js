document.addEventListener('DOMContentLoaded', () => {
    const combinedAnimeGrid = document.getElementById('combined-anime-grid');
    const apiKey = '84549ba3644ea15176802ec153bd9442';
    const updateInterval = 30 * 60 * 1000; // 30 minutes in milliseconds

    if (combinedAnimeGrid) {
        // Initial fetch on page load
        fetchAndDisplayAiringAnimeByLastEpisode(combinedAnimeGrid);

        // Set up periodic updates to refresh the list
        setInterval(() => {
            console.log('Checking for new anime episode releases...');
            fetchAndDisplayAiringAnimeByLastEpisode(combinedAnimeGrid);
        }, updateInterval);
    }

    async function fetchAiringAnimeCandidates() {
        const today = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        const formatDate = (date) => date.toISOString().split('T')[0];
        
        const baseUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=16&language=en-US&sort_by=popularity.desc&air_date.gte=${formatDate(threeMonthsAgo)}&air_date.lte=${formatDate(today)}&with_original_language=ja`;
        
        const fetchPage = (page) => fetch(`${baseUrl}&page=${page}`);

        const promises = [fetchPage(1), fetchPage(2), fetchPage(3)];
        const responses = await Promise.all(promises);

        for (const response of responses) {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await Promise.all(responses.map(res => res.json()));
        
        const combined = new Map();
        data.forEach(pageData => {
            pageData.results.forEach(anime => {
                combined.set(anime.id, anime);
            });
        });

        return Array.from(combined.values());
    }

    async function fetchAnimeDetails(animeId) {
        const url = `https://api.themoviedb.org/3/tv/${animeId}?api_key=${apiKey}&language=en-US`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch details for anime ID ${animeId}`);
            return null;
        }
        return response.json();
    }

    async function fetchAndDisplayAiringAnimeByLastEpisode(gridElement) {
        try {
            const candidates = await fetchAiringAnimeCandidates();
            
            const detailedAnimePromises = candidates.map(anime => fetchAnimeDetails(anime.id));
            const detailedAnimeList = (await Promise.all(detailedAnimePromises)).filter(Boolean);

            const today = new Date().toISOString().split('T')[0];

            const sortedAnime = detailedAnimeList
                .filter(anime => {
                    const lastEpisode = anime.last_episode_to_air;
                    // Keep anime that is a returning series or has a last episode that aired today or earlier.
                    return anime.status === 'Returning Series' || (lastEpisode && lastEpisode.air_date && lastEpisode.air_date <= today);
                })
                .sort((a, b) => {
                    const dateA = a.last_episode_to_air ? new Date(a.last_episode_to_air.air_date) : new Date(a.last_air_date);
                    const dateB = b.last_episode_to_air ? new Date(b.last_episode_to_air.air_date) : new Date(b.last_air_date);
                    return dateB - dateA;
                });

            displayAnime(sortedAnime, gridElement);
        } catch (error) {
            handleFetchError(error, gridElement, 'airing anime');
        }
    }

    function displayAnime(animeList, gridElement) {
        gridElement.innerHTML = '';
        if (animeList.length === 0) {
            gridElement.innerHTML = '<p>No recently aired anime found. Check back soon for new episodes!</p>';
            return;
        }
        animeList.forEach(anime => {
            const animeItem = document.createElement('div');
            animeItem.className = 'trending-item';

            const posterPath = anime.poster_path ? `https://image.tmdb.org/t/p/w500${anime.poster_path}` : 'images/default-poster.png';

            const posterContainer = document.createElement('div');
            posterContainer.className = 'trending-poster-container';

            const seasonBadge = document.createElement('div');
            seasonBadge.classList.add('season-badge');

            if (anime.status === 'Ended' || anime.status === 'Canceled') {
                seasonBadge.textContent = 'COMPLETED';
                seasonBadge.classList.add('completed');
            } else if (anime.last_episode_to_air) {
                const s = anime.last_episode_to_air.season_number.toString().padStart(2, '0');
                const e = anime.last_episode_to_air.episode_number.toString().padStart(2, '0');
                seasonBadge.textContent = `S${s}, E${e}`;
            } else if (anime.number_of_seasons) {
                const lastSeason = anime.seasons[anime.seasons.length - 1];
                if (lastSeason) {
                    const s = lastSeason.season_number.toString().padStart(2, '0');
                    seasonBadge.textContent = `S${s}`;
                }
            }

            if (seasonBadge.textContent) {
                posterContainer.appendChild(seasonBadge);
            }

            const matchScore = Math.min(99, Math.max(84, Math.round((anime.vote_average || 7) * 10 + 12)));
            let animeWl = [];
            try { animeWl = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]'); } catch (e) {}
            const isAnimeWatchlisted = animeWl.some(w => String(w.id) === String(anime.id));

            posterContainer.innerHTML += `
                <img class="trending-poster" src="${posterPath}" alt="${anime.name}">
                <div class="card-top-badges">
                    <span class="card-match-badge">${matchScore}% Match</span>
                    <div class="card-top-badges-right">
                        <span class="trending-badge anime">Anime</span>
                        <span class="card-hd-badge">HD</span>
                    </div>
                </div>
                <div class="trending-overlay">
                    <div class="trending-buttons">
                        <button class="btn watch-btn" onclick="showLoader(); location.href='player.html?id=${anime.id}&type=tv'" title="Watch Now"><i class="fas fa-play"></i> Watch</button>
                        <button class="btn details-btn" onclick="showLoader(); location.href='details.html?id=${anime.id}&type=tv'" title="View Details"><i class="fas fa-info-circle"></i> Details</button>
                        <button class="btn watchlist-btn ${isAnimeWatchlisted ? 'in-watchlist' : ''}" title="Add to Watchlist" onclick="event.stopPropagation(); toggleAnimeWatchlist(this, ${anime.id}, '${(anime.name || '').replace(/'/g, "\\'")}', '${anime.poster_path}', ${anime.vote_average || 0})">${isAnimeWatchlisted ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}</button>
                    </div>
                </div>
            `;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'trending-info';
            infoDiv.innerHTML = `
                <h3 class="trending-title">${anime.name}</h3>
                <div class="trending-meta">
                    <span class="trending-year">${anime.first_air_date ? anime.first_air_date.substring(0, 4) : 'N/A'}</span>
                    <span class="trending-rating">${anime.vote_average ? anime.vote_average.toFixed(1) : 'N/A'}/10</span>
                </div>
            `;

            animeItem.appendChild(posterContainer);
            animeItem.appendChild(infoDiv);
            gridElement.appendChild(animeItem);
        });
    }

    function handleFetchError(error, gridElement, type) {
        console.error(`Failed to fetch ${type}. Error:`, error);
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error('This looks like a network error. Please check your internet connection and if the API endpoint is accessible.');
            gridElement.innerHTML = `<p>Could not connect to the server to load ${type}. Please check your network connection.</p>`;
        } else {
            console.error('An unexpected error occurred:', error.message);
            gridElement.innerHTML = `<p>Could not load ${type} due to an unexpected error.</p>`;
        }
    }
});

window.toggleAnimeWatchlist = function(btn, id, title, posterPath, voteAverage) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]'); } catch (e) {}
    const idx = list.findIndex(w => String(w.id) === String(id));
    if (idx > -1) {
        list.splice(idx, 1);
        btn.innerHTML = '<i class="fas fa-plus"></i>';
        btn.classList.remove('in-watchlist');
        if (window.showToast) window.showToast(`Removed "${title}" from Watchlist`, 'info', 'fa-minus');
    } else {
        list.unshift({
            id: id,
            title: title,
            poster_path: posterPath,
            media_type: 'anime',
            vote_average: voteAverage,
            saved_at: new Date().toISOString()
        });
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.classList.add('in-watchlist');
        if (window.showToast) window.showToast(`Added "${title}" to Watchlist`, 'success', 'fa-bookmark');
    }
    localStorage.setItem('jflix_watchlist', JSON.stringify(list));
    if (window.updateWatchlistBadgeCount) window.updateWatchlistBadgeCount();
};
