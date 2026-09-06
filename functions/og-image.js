// Cloudflare Pages Function — generates branded OG images
// Fetches movie backdrop from TMDB, overlays JFlix branding
// This avoids copyright issues by adding heavy branding over the movie image

const TMDB_API_KEY = '84549ba3644ea15176802ec153bd9442';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w1280';
const WATERMARK_URL = 'https://jflix.uk/images/jflix-watermark.png';
const FALLBACK_IMAGE = 'https://jflix.uk/images/og-default.png';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type') || 'movie';

  // No ID — return the static branded fallback
  if (!id) {
    return fetch(FALLBACK_IMAGE);
  }

  try {
    // Fetch movie details from TMDB to get the backdrop
    const tmdbUrl = `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_API_KEY}`;
    const tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) return fetch(FALLBACK_IMAGE);
    const data = await tmdbRes.json();

    // Use backdrop_path (or poster_path as fallback)
    const imagePath = data.backdrop_path || data.poster_path;
    if (!imagePath) return fetch(FALLBACK_IMAGE);

    const backdropUrl = `${TMDB_BACKDROP}${imagePath}`;

    // Try Cloudflare Image Resizing (Pro plan feature)
    // This composites the backdrop + watermark in one step
    try {
      const brandedRes = await fetch(backdropUrl, {
        cf: {
          image: {
            width: 1200,
            height: 630,
            fit: 'cover',
            quality: 85,
            format: 'jpeg',
            draw: [
              {
                url: WATERMARK_URL,
                opacity: 0.95,
                top: 0,
                left: 0,
              },
            ],
          },
        },
      });

      if (brandedRes.ok) {
        const body = await brandedRes.blob();
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (cfErr) {
      // Image Resizing not available (free plan) — fall through to manual method
    }

    // Fallback: Fetch backdrop, fetch watermark, composite manually using ImageMagick-like approach
    // Since Workers can't do image manipulation without WASM, we'll use a different approach:
    // Return the backdrop with a redirect, and rely on the watermark being part of the page
    // For now, return the static branded fallback
    return fetch(FALLBACK_IMAGE);

  } catch (err) {
    return fetch(FALLBACK_IMAGE);
  }
}
