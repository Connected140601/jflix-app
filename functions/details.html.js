// Cloudflare Pages Function — injects dynamic OG tags for /details.html
// Social media crawlers (Facebook, Twitter, WhatsApp, Telegram) don't run JS,
// so we fetch movie data from TMDB server-side and rewrite the OG meta tags.

const TMDB_API_KEY = '84549ba3644ea15176802ec153bd9442';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780';
const DEFAULT_OG_IMAGE = 'https://jflix.uk/images/og-default.png';
const SITE_NAME = 'JFlix';

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);

  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type') || 'movie';

  // Helper: get the static HTML page
  async function getStaticHTML() {
    // Try env.ASSETS first (Pages binding)
    if (context.env && context.env.ASSETS) {
      try {
        const assetUrl = new URL(url.pathname, url.origin).toString();
        const res = await context.env.ASSETS.fetch(new Request(assetUrl));
        if (res.ok) return await res.text();
      } catch (e) {}
    }
    // Fallback: fetch the page without query params
    const cleanUrl = new URL(url.pathname, url.origin).toString();
    const res = await fetch(cleanUrl);
    return await res.text();
  }

  // If no id, just serve the static page as-is
  if (!id) {
    const html = await getStaticHTML();
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  }

  try {
    // Fetch movie/TV details from TMDB server-side
    const tmdbUrl = `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) {
      const html = await getStaticHTML();
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }
    const data = await tmdbRes.json();

    const title = data.title || data.name || 'Watch on JFlix';
    const year = (data.release_date || data.first_air_date || '').split('-')[0];
    const overview = data.overview || `Watch ${title} for free on JFlix — free streaming of movies, TV shows, anime, and K-dramas.`;
    // Use branded OG image endpoint (backdrop + JFlix watermark) to avoid copyright issues
    const ogImageUrl = `${url.origin}/og-image?id=${id}&type=${type}`;
    const rating = data.vote_average ? data.vote_average.toFixed(1) : null;
    const genres = data.genres ? data.genres.map(g => g.name).join(', ') : '';

    // Build SEO title and description
    const seoTitle = `${title}${year ? ' (' + year + ')' : ''} | Watch Free on JFlix`;
    const seoDesc = overview.length > 160 ? overview.substring(0, 157) + '...' : overview;
    const pageUrl = url.toString();

    // Get the static HTML
    let html = await getStaticHTML();

    // Build the new meta tags — use branded OG image to avoid copyright
    const ogTags = [
      `<meta property="og:title" content="${escapeHtml(seoTitle)}">`,
      `<meta property="og:description" content="${escapeHtml(seoDesc)}">`,
      `<meta property="og:image" content="${ogImageUrl}">`,
      `<meta property="og:image:secure_url" content="${ogImageUrl}">`,
      `<meta property="og:image:type" content="image/jpeg">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
      `<meta property="og:type" content="video.movie">`,
      `<meta property="og:site_name" content="${SITE_NAME}">`,
      `<meta property="twitter:card" content="summary_large_image">`,
      `<meta property="twitter:title" content="${escapeHtml(seoTitle)}">`,
      `<meta property="twitter:description" content="${escapeHtml(seoDesc)}">`,
      `<meta property="twitter:image" content="${ogImageUrl}">`,
      `<meta property="twitter:url" content="${escapeHtml(pageUrl)}">`,
      `<meta name="description" content="${escapeHtml(seoDesc)}">`,
      `<title>${escapeHtml(seoTitle)}</title>`,
    ];

    // Also inject JSON-LD structured data
    const actors = data.credits && data.credits.cast
      ? data.credits.cast.slice(0, 5).map(p => ({ '@type': 'Person', name: p.name, character: p.character }))
      : [];
    const schema = {
      '@context': 'https://schema.org',
      '@type': type === 'movie' ? 'Movie' : 'TVSeries',
      name: title,
      description: overview,
      image: ogImageUrl,
      url: pageUrl,
      datePublished: data.release_date || data.first_air_date,
      genre: genres,
      aggregateRating: data.vote_average ? {
        '@type': 'AggregateRating',
        ratingValue: rating,
        bestRating: '10',
        ratingCount: data.vote_count || 0,
      } : undefined,
      actor: actors,
    };
    const jsonLd = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;

    // Replace existing OG/Twitter meta tags in the HTML
    html = html.replace(/<meta property="og:title"[^>]*>/g, '');
    html = html.replace(/<meta property="og:description"[^>]*>/g, '');
    html = html.replace(/<meta property="og:image"[^>]*>/g, '');
    html = html.replace(/<meta property="og:image:secure_url"[^>]*>/g, '');
    html = html.replace(/<meta property="og:image:type"[^>]*>/g, '');
    html = html.replace(/<meta property="og:image:width"[^>]*>/g, '');
    html = html.replace(/<meta property="og:image:height"[^>]*>/g, '');
    html = html.replace(/<meta property="og:url"[^>]*>/g, '');
    html = html.replace(/<meta property="og:type"[^>]*>/g, '');
    html = html.replace(/<meta property="og:site_name"[^>]*>/g, '');
    html = html.replace(/<meta property="twitter:card"[^>]*>/g, '');
    html = html.replace(/<meta property="twitter:title"[^>]*>/g, '');
    html = html.replace(/<meta property="twitter:description"[^>]*>/g, '');
    html = html.replace(/<meta property="twitter:image"[^>]*>/g, '');
    html = html.replace(/<meta property="twitter:url"[^>]*>/g, '');
    html = html.replace(/<meta name="description"[^>]*>/g, '');
    html = html.replace(/<title>[^<]*<\/title>/g, '');

    // Insert all new tags right after <head>
    html = html.replace(/<head>/, '<head>\n    ' + ogTags.join('\n    ') + '\n    ' + jsonLd + '\n');

    // Clean up any empty lines from removed tags
    html = html.replace(/\n\s*\n\s*\n/g, '\n\n');

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    // On any error, serve the static page
    const html = await getStaticHTML();
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
