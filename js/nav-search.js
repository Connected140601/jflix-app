// Self-invoking function to avoid polluting the global scope,
// but attaches necessary functions to the window object.
(function() {
    // API Configuration
    const API_KEY = '84549ba3644ea15176802ec153bd9442';
    const BASE_URL = 'https://api.themoviedb.org/3/'; // Ensuring trailing slash
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
    const POSTER_SIZE = '/w500';

    // Global variables
    let searchTimeout = null;
    const includeAdultFilter = false; 

    // DOM Elements (initialized on DOMContentLoaded)
    let searchInput, searchResults, searchModal, filterGenre, filterCountry, filterYear;

    async function fetchFromTMDB(endpoint, params = {}) {
        const url = new URL(endpoint, BASE_URL);
        url.searchParams.append('api_key', API_KEY);
        Object.keys(params).forEach(key => {
            if (params[key]) url.searchParams.append(key, params[key]);
        });

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch from TMDB: ${error.message}. URL: ${url.href}`);
            throw error;
        }
    }

    async function displaySearchResults(items) {
        if (!searchResults) return;
        searchResults.innerHTML = ''; // Clear previous results

        if (!items || items.length === 0) {
            searchResults.innerHTML = '<div class="no-results">No results found.</div>';
            return;
        }

        const resultsCount = document.createElement('div');
        resultsCount.className = 'results-count';
        resultsCount.textContent = `${items.length} results found.`;
        searchResults.appendChild(resultsCount);

        for (const item of items) {
            if (!item.poster_path) continue;

            const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
            const title = item.title || item.name;
            const releaseDate = item.release_date || item.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
            const posterUrl = `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}`;
            const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';

            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';

            let typeClass = mediaType;
            let typeLabel = mediaType;

            if (mediaType === 'tv') {
                if (item.original_language === 'ja') {
                    typeClass = 'anime';
                    typeLabel = 'anime';
                } else if (item.original_language === 'ko') {
                    typeClass = 'korean';
                    typeLabel = 'k-drama';
                } else {
                    typeClass = 'tv';
                    typeLabel = 'tv show';
                }
            } else {
                typeLabel = 'movie';
            }

            resultItem.innerHTML = `
                <div class="result-poster-container">
                    <img src="${posterUrl}" alt="${title}" class="result-poster" loading="lazy">
                </div>
                <div class="result-info">
                    <h3 class="result-title">${title}</h3>
                    <p class="result-year">${year}</p>
                    <div class="result-meta">
                        <span class="result-rating"><i class="fas fa-star"></i> ${rating}</span>
                        <span class="result-type ${typeClass}">${typeLabel}</span>
                    </div>
                    <div class="result-buttons">
                        <a href="player.html?id=${item.id}&type=${mediaType}" class="btn watch-btn" onclick="showLoader()"><i class="fas fa-play"></i> Watch</a>
                        <a href="details.html?id=${item.id}&type=${mediaType}" class="btn details-btn"><i class="fas fa-info-circle"></i> Details</a>
                    </div>
                </div>
            `;

            if (mediaType === 'tv') {
                try {
                    const seriesDetails = await fetchFromTMDB(`tv/${item.id}`);
                    if (seriesDetails) {
                        const badge = document.createElement('div');
                        badge.className = 'season-badge';
                        let badgeAdded = false;

                        if (seriesDetails.status === 'Ended' || seriesDetails.status === 'Canceled') {
                            badge.classList.add('completed');
                            badge.textContent = 'COMPLETED';
                            badgeAdded = true;
                        } else if (seriesDetails.last_episode_to_air) {
                            const lastEpisode = seriesDetails.last_episode_to_air;
                            const seasonNumber = String(lastEpisode.season_number).padStart(2, '0');
                            const episodeNumber = String(lastEpisode.episode_number).padStart(2, '0');
                            badge.textContent = `S${seasonNumber}, E${episodeNumber}`;
                            badgeAdded = true;
                        }

                        if (badgeAdded) {
                            resultItem.querySelector('.result-poster-container').prepend(badge);
                        }
                    }
                } catch (error) {
                    console.warn(`Could not fetch badge details for TV show ${item.id}:`, error);
                }
            }

            searchResults.appendChild(resultItem);
        }
    }
    
    // Make searchTMDB global
    window.searchTMDB = function(skipLengthCheck = false) {
        if (!searchInput || !searchResults) return;
        const query = searchInput.value.trim();
        clearTimeout(searchTimeout);

        if (!skipLengthCheck && query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }

        searchResults.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>Searching...</p></div>';

        searchTimeout = setTimeout(async () => {
            try {
                const activeFilterBtn = document.querySelector('.search-filters .filter-btn.active');
                const activeFilter = activeFilterBtn ? activeFilterBtn.dataset.type : 'all';

                let params = { query, include_adult: includeAdultFilter };
                let mediaType = activeFilter;
                let endpoint;
                
                const isSearch = query.length >= 2;

                // Determine endpoint first, as it dictates parameter names
                if (isSearch) {
                    endpoint = activeFilter === 'all' ? 'search/multi' : `search/${mediaType}`;
                } else if (skipLengthCheck) {
                    // When no search query, 'all' defaults to discovering movies.
                    endpoint = activeFilter === 'all' ? 'discover/movie' : `discover/${mediaType}`;
                    if (activeFilter === 'all') mediaType = 'movie'; // Explicitly set for discover
                    params.sort_by = 'popularity.desc';
                    delete params.query;
                } else {
                    searchResults.innerHTML = '';
                    return;
                }

                // Handle special filters which override mediaType and add specific params
                if (activeFilter === 'anime') {
                    mediaType = 'tv';
                    endpoint = endpoint.replace(/search\/.*/, 'search/tv').replace(/discover\/.*/, 'discover/tv');
                    params.with_genres = '16';
                    params.with_original_language = 'ja';
                } else if (activeFilter === 'korean') {
                    mediaType = 'tv';
                    endpoint = endpoint.replace(/search\/.*/, 'search/tv').replace(/discover\/.*/, 'discover/tv');
                    if (isSearch) params.region = 'KR';
                    else params.with_origin_country = 'KR';
                } else if (activeFilter === 'cartoon') {
                    mediaType = 'tv';
                    endpoint = endpoint.replace(/search\/.*/, 'search/tv').replace(/discover\/.*/, 'discover/tv');
                    params.with_genres = '16';
                }

                // Handle advanced dropdown filters
                if (filterGenre && filterGenre.value && !params.with_genres) {
                    params.with_genres = filterGenre.value;
                }

                if (filterYear && filterYear.value) {
                    if (isSearch) {
                        params.year = filterYear.value;
                    } else { // discover
                        if (mediaType === 'movie') {
                            params.primary_release_year = filterYear.value;
                        } else if (mediaType === 'tv') {
                            params.first_air_date_year = filterYear.value;
                        }
                    }
                }

                if (filterCountry && filterCountry.value) {
                    if (isSearch && !params.region) {
                        params.region = filterCountry.value;
                    } else if (!isSearch && !params.with_origin_country) { // discover
                        params.with_origin_country = filterCountry.value;
                    }
                }

                const data = await fetchFromTMDB(endpoint, params);
                displaySearchResults(data.results);
            } catch (error) {
                // Error is already logged by fetchFromTMDB
                searchResults.innerHTML = '<div class="error-message">Error fetching search results.</div>';
            }
        }, 300);
    }

    // Make openSearchModal global
    window.openSearchModal = function() {
        if (!searchModal) return;
        searchModal.style.display = 'block';
        setTimeout(() => searchModal.classList.add('show'), 10);
        if (searchInput) {
            searchInput.focus();
            window.searchTMDB(true);
        }
    }

    // Make closeSearchModal global
    window.closeSearchModal = function() {
        if (!searchModal) return;
        searchModal.classList.remove('show');
        setTimeout(() => searchModal.style.display = 'none', 300);
    }

    async function initializeAdvancedFilters() {
        // This function can remain local as it's only called once.
        try {
            if (filterGenre) {
                const data = await fetchFromTMDB('genre/movie/list');
                if (data.genres) {
                    data.genres.forEach(genre => {
                        const opt = document.createElement('option');
                        opt.value = genre.id;
                        opt.textContent = genre.name;
                        filterGenre.appendChild(opt);
                    });
                }
            }
            if (filterCountry) {
                const data = await fetchFromTMDB('configuration/countries');
                if (Array.isArray(data)) {
                    data.forEach(country => {
                        const opt = document.createElement('option');
                        opt.value = country.iso_3166_1;
                        opt.textContent = country.english_name;
                        filterCountry.appendChild(opt);
                    });
                }
            }
            if (filterYear) {
                const currentYear = new Date().getFullYear();
                for (let y = currentYear; y >= currentYear - 100; y--) {
                    const opt = document.createElement('option');
                    opt.value = y;
                    opt.textContent = y;
                    filterYear.appendChild(opt);
                }
            }
        } catch (error) {
            // Error is already logged by fetchFromTMDB, no need to log again.
        }
    }
    
    function initializeEventListeners() {
        // Event listeners for filter buttons
        const filterButtons = document.querySelectorAll('.search-filters .filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
            showLoader();
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                window.searchTMDB(true);
            });
        });

        // Event listeners for advanced filters
        [filterGenre, filterCountry, filterYear].forEach(el => {
            if (el) {
                el.addEventListener('change', () => window.searchTMDB(true));
            }
        });

        // Add event listener for the search input to trigger search on type
        if (searchInput) {
            searchInput.addEventListener('input', () => window.searchTMDB());
        }

        // Centralized event listeners for closing the modal
        if (searchModal) {
            const closeButton = searchModal.querySelector('.close');
            const searchExitBtn = searchModal.querySelector('#search-exit-btn');

            if (closeButton) {
                closeButton.addEventListener('click', window.closeSearchModal);
            }
            if (searchExitBtn) {
                searchExitBtn.addEventListener('click', window.closeSearchModal);
            }

            // Close when clicking the backdrop
            searchModal.addEventListener('click', (event) => {
                if (event.target === searchModal) {
                    window.closeSearchModal();
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Initialize DOM elements
        searchInput = document.getElementById('search-input');
        searchResults = document.getElementById('search-results');
        searchModal = document.getElementById('search-modal');
        filterGenre = document.getElementById('filter-genre');
        filterCountry = document.getElementById('filter-country');
        filterYear = document.getElementById('filter-year');
        
        initializeEventListeners();
        initializeAdvancedFilters();

        // Check for URL param to open search modal
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('open_search') === 'true') {
            window.openSearchModal();
        }
    });
})();
