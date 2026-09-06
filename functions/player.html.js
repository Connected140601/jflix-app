// Cloudflare Pages Function — injects dynamic OG tags for /player.html
// Same approach as details.html.js — fetches movie data from TMDB server-side.

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
    if (context.env && context.env.ASSETS) {
      try {
        const assetUrl = new URL(url.pathname, url.origin).toString();
        const res = await context.env.ASSETS.fetch(new Request(assetUrl));
        if (res.ok) return await res.text();
      } catch (e) {}
    }
    const cleanUrl = new URL(url.pathname, url.origin).toString();
    const res = await fetch(cleanUrl);
    return await res.text();
  }

  if (!id) {
    const html = await getStaticHTML();
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  }

  try {
    const tmdbUrl = `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_API_KEY}`;
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
    const overview = data.overview || `Watch ${title} for free on JFlix.`;
    // Use branded OG image endpoint (backdrop + JFlix watermark) to avoid copyright issues
    const ogImageUrl = `${url.origin}/og-image?id=${id}&type=${type}`;

    const seoTitle = `Watch ${title}${year ? ' (' + year + ')' : ''} Free on JFlix`;
    const seoDesc = overview.length > 160 ? overview.substring(0, 157) + '...' : overview;
    const pageUrl = url.toString();

    let html = await getStaticHTML();

    const ogTags = [
      `<meta property="og:title" content="${escapeHtml(seoTitle)}">`,
      `<meta property="og:description" content="${escapeHtml(seoDesc)}">`,
      `<meta property="og:image" content="${ogImageUrl}">`,
      `<meta property="og:image:secure_url" content="${ogImageUrl}">`,
      `<meta property="og:image:type" content="image/jpeg">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
      `<meta property="og:type" content="video.other">`,
      `<meta property="og:site_name" content="${SITE_NAME}">`,
      `<meta property="twitter:card" content="summary_large_image">`,
      `<meta property="twitter:title" content="${escapeHtml(seoTitle)}">`,
      `<meta property="twitter:description" content="${escapeHtml(seoDesc)}">`,
      `<meta property="twitter:image" content="${ogImageUrl}">`,
      `<meta property="twitter:url" content="${escapeHtml(pageUrl)}">`,
      `<meta name="description" content="${escapeHtml(seoDesc)}">`,
      `<title>${escapeHtml(seoTitle)}</title>`,
    ];

    // Remove existing tags
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

    html = html.replace(/<head>/, '<head>\n    ' + ogTags.join('\n    ') + '\n');
    html = html.replace(/\n\s*\n\s*\n/g, '\n\n');

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
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
