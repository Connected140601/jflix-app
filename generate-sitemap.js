const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = '84549ba3644ea15176802ec153bd9442'; // Your TMDB API key
const BASE_URL = 'https://api.themoviedb.org/3';
const SITE_URL = 'https://jflix.uk';
const BATCH_SIZE = 20; // Number of concurrent requests
const TOTAL_PAGES_TO_FETCH_GENERIC = 25; // ~500 items for popular
const TOTAL_PAGES_TO_FETCH_SPECIFIC = 15; // ~300 items for specific genres

// Static pages to include in the sitemap
const staticPages = [
  'index.html',
  'movies.html',
  'tvshows.html',
  'anime.html',
  'korean.html',
  'cartoon.html',
  'terms.html',
  'privacy.html',
  'dmca.html',
  'disclaimer.html'
];

// Function to fetch paginated data from TMDB
async function fetchPaginatedData(endpoint, totalPages) {
  let results = [];
  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await axios.get(`${BASE_URL}/${endpoint}`,
        {
          params: {
            api_key: API_KEY,
            page: page
          }
        });
      if (response.data && response.data.results) {
        results = results.concat(response.data.results);
        console.log(`Fetched page ${page} from ${endpoint}`);
      } else {
        console.log(`No results on page ${page} for ${endpoint}`);
      }
    } catch (error) {
      console.error(`Error fetching page ${page} from ${endpoint}:`, error.message);
    }
    // Small delay to avoid hitting rate limits too hard
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return results;
}

// Validate date format (YYYY-MM-DD)
function isValidDate(dateString) {
  if (!dateString) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(dateString);
}

// Function to fetch paginated data from TMDB discover endpoint
async function fetchDiscoverData(endpoint, totalPages, params) {
  let results = [];
  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await axios.get(`${BASE_URL}/${endpoint}`, {
        params: {
          api_key: API_KEY,
          page: page,
          ...params
        }
      });
      if (response.data && response.data.results) {
        results = results.concat(response.data.results);
        console.log(`Fetched page ${page} from ${endpoint} with params ${JSON.stringify(params)}`);
      } else {
        console.log(`No results on page ${page} for ${endpoint}`);
      }
    } catch (error) {
      console.error(`Error fetching page ${page} from ${endpoint}:`, error.message);
    }
    // Small delay to avoid hitting rate limits too hard
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return results;
}

// Function to generate the sitemap content
async function generateSitemap() {
  console.log('Starting sitemap generation...');

  // Fetch all content types in parallel
  const [movies, popularTv, anime, koreanShows] = await Promise.all([
    fetchPaginatedData('movie/popular', TOTAL_PAGES_TO_FETCH_GENERIC),
    fetchPaginatedData('tv/popular', TOTAL_PAGES_TO_FETCH_GENERIC),
    fetchDiscoverData('discover/tv', TOTAL_PAGES_TO_FETCH_SPECIFIC, { with_genres: 16 }), // Genre ID for Animation
    fetchDiscoverData('discover/tv', TOTAL_PAGES_TO_FETCH_SPECIFIC, { with_origin_country: 'KR' }) // Korean shows
  ]);

  // Combine all TV show types and remove duplicates
  const allTvShows = [...popularTv, ...anime, ...koreanShows];
  const uniqueTvShowIds = new Set();
  const tvShows = allTvShows.filter(show => {
    if (uniqueTvShowIds.has(show.id)) {
      return false;
    }
    uniqueTvShowIds.add(show.id);
    return true;
  });

  console.log(`Fetched ${movies.length} movies and ${tvShows.length} unique TV shows (including popular, anime, and Korean).`);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Add static pages
  staticPages.forEach(page => {
    xml += `  <url>\n`;
    xml += `    <loc>${SITE_URL}/${page}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>${page === 'index.html' ? '1.0' : '0.8'}</priority>\n`;
    xml += `  </url>\n`;
  });



  xml += '</urlset>';

  // Write the sitemap to the main directory
  const mainSitemapPath = path.join(__dirname, 'sitemap.xml');

  fs.writeFileSync(mainSitemapPath, xml);
  console.log(`Sitemap written to ${mainSitemapPath}`);

  console.log('Sitemap generation complete!');
}

generateSitemap();
