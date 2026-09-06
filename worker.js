// Cloudflare Worker for JFlix API
// Handles comments, reactions, and view counts

// Known AI scraper user agents to block
const BLOCKED_USER_AGENTS = [
  'ChatGPT',
  'GPTBot',
  'Claude',
  'ClaudeBot',
  'Anthropic',
  'Googlebot',
  'Bingbot',
  'Slurp',
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot',
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'Applebot',
  'PerplexityBot',
  'YouBot',
  'CCBot',
  'DataForSeoBot',
  'MJ12bot',
  'AhrefsBot',
  'SemrushBot'
];

// Rate limiting using Cloudflare KV (simple in-memory fallback)
const RATE_LIMIT = {
  requests: 100, // requests per minute
  window: 60 * 1000 // 1 minute in milliseconds
};

// Simple in-memory rate limiter (for development)
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(ip) || [];
  
  // Remove requests outside the time window
  const validRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT.window);
  
  if (validRequests.length >= RATE_LIMIT.requests) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitStore.set(ip, validRequests);
  
  return true; // Request allowed
}

function isBlockedUserAgent(userAgent) {
  if (!userAgent) return false;
  const lowerUA = userAgent.toLowerCase();
  return BLOCKED_USER_AGENTS.some(bot => lowerUA.includes(bot.toLowerCase()));
}

function getResendApiKey(env) {
  return (env && env.RESEND_API_KEY) || '';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Serve static assets for non-API routes
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    // Get client IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || '';

    // Block known AI scrapers
    if (isBlockedUserAgent(userAgent)) {
      console.log('Blocked AI scraper:', userAgent);
      return new Response(JSON.stringify({ 
        error: 'Access denied', 
        message: 'Automated scraping is not permitted' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting for API requests
    if (url.pathname.startsWith('/api/')) {
      if (!checkRateLimit(ip)) {
        console.log('Rate limit exceeded for IP:', ip);
        return new Response(JSON.stringify({ 
          error: 'Too many requests', 
          message: 'Please wait before making more requests' 
        }), {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          }
        });
      }
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Route handling
    console.log('Request pathname:', url.pathname);
    if (url.pathname.startsWith('/api/auth')) {
      console.log('Routing to handleAuth');
      return handleAuth(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/comments')) {
      console.log('Routing to handleComments');
      return handleComments(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/reactions')) {
      console.log('Routing to handleReactions');
      return handleReactions(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/views')) {
      console.log('Routing to handleViews');
      return handleViews(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/users')) {
      console.log('Routing to handleUsers');
      return handleUsers(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/downloads')) {
      console.log('Routing to handleDownloads');
      return handleDownloads(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/admin/vouchers')) {
      console.log('Routing to handleAdmin (vouchers)');
      return handleAdmin(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/admin/messages')) {
      console.log('Routing to handleMessages (admin)');
      return handleMessages(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/admin/invitations')) {
      console.log('Routing to handleInvitations (admin)');
      return handleInvitations(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/admin')) {
      console.log('Routing to handleAdmin');
      return handleAdmin(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/invitations')) {
      console.log('Routing to handleInvitations');
      return handleInvitations(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/vouchers')) {
      console.log('Routing to handleVouchers');
      return handleVouchers(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/images')) {
      console.log('Routing to handleImages');
      return handleImages(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/paypal')) {
      console.log('Routing to handlePayPal');
      return handlePayPal(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/messages')) {
      console.log('Routing to handleMessages');
      return handleMessages(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/upload')) {
      console.log('Routing to handleUpload');
      return handleUpload(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/push')) {
      console.log('Routing to handlePush');
      return handlePush(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/telegram')) {
      console.log('Routing to handleTelegram');
      return handleTelegram(request, env, corsHeaders);
    } else if (url.pathname.startsWith('/api/hls-stream')) {
      return handleHlsStream(request, url, corsHeaders);
    } else if (url.pathname.startsWith('/api/stream-proxy')) {
      return handleStreamProxy(request, url, corsHeaders);
    }

    // Return JSON error for 404
    return new Response(JSON.stringify({ success: false, error: 'Not Found' }), { 
      status: 404, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },

  // ─── Scheduled handler: auto-send newsletter (10 emails/day) ───
  async scheduled(event, env) {
    await processScheduledNewsletter(env);
    await checkNewContentAndNotify(env);
  }
};

// ═══════════════════════════════════════════════════════════════
// AUTO PUSH NOTIFICATIONS — Detect new movies/TV from TMDB
// Runs on cron, checks for new content, sends push to all subscribers
// Works on: Web Browser, Electron App, Android PWA/TWA
// ═══════════════════════════════════════════════════════════════
async function checkNewContentAndNotify(env) {
  const TMDB_API_KEY = '84549ba3644ea15176802ec153bd9442';
  const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

  try {
    // Ensure tables exist
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        endpoint TEXT NOT NULL,
        p256dh TEXT,
        auth TEXT,
        subscription_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(endpoint)
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS notified_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tmdb_id INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        title TEXT,
        notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tmdb_id, content_type)
      )
    `).run();

    // Check if we have any push subscribers
    const subCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM push_subscriptions`).first();
    if (!subCount || subCount.count === 0) {
      console.log('[Push] No subscribers, skipping content check');
      return;
    }

    // Fetch new content from TMDB — movies + TV
    const [nowPlayingRes, trendingMoviesRes, trendingTvRes, airingTodayRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&region=US`),
      fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`),
      fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`),
      fetch(`https://api.themoviedb.org/3/tv/airing_today?api_key=${TMDB_API_KEY}`)
    ]);

    const nowPlaying = await nowPlayingRes.json();
    const trendingMovies = await trendingMoviesRes.json();
    const trendingTv = await trendingTvRes.json();
    const airingToday = await airingTodayRes.json();

    // Collect all new content
    const newContent = [];
    const seenIds = new Set();

    // Now playing movies
    for (const m of (nowPlaying.results || [])) {
      const key = `movie_${m.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      newContent.push({
        tmdb_id: m.id,
        content_type: 'movie',
        title: m.title || m.name,
        poster: m.poster_path ? `${IMG_BASE}${m.poster_path}` : null,
        rating: m.vote_average ? m.vote_average.toFixed(1) : null,
        overview: m.overview ? m.overview.substring(0, 150) : '',
        watch_url: `https://jflix.uk/player.html?id=${m.id}&type=movie`
      });
    }

    // Trending movies
    for (const m of (trendingMovies.results || []).slice(0, 5)) {
      const key = `movie_${m.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      newContent.push({
        tmdb_id: m.id,
        content_type: 'movie',
        title: m.title || m.name,
        poster: m.poster_path ? `${IMG_BASE}${m.poster_path}` : null,
        rating: m.vote_average ? m.vote_average.toFixed(1) : null,
        overview: m.overview ? m.overview.substring(0, 150) : '',
        watch_url: `https://jflix.uk/player.html?id=${m.id}&type=movie`
      });
    }

    // Trending TV
    for (const t of (trendingTv.results || []).slice(0, 5)) {
      const key = `tv_${t.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      newContent.push({
        tmdb_id: t.id,
        content_type: 'tv',
        title: t.name || t.title,
        poster: t.poster_path ? `${IMG_BASE}${t.poster_path}` : null,
        rating: t.vote_average ? t.vote_average.toFixed(1) : null,
        overview: t.overview ? t.overview.substring(0, 150) : '',
        watch_url: `https://jflix.uk/player.html?id=${t.id}&type=tv`
      });
    }

    // Airing today TV
    for (const t of (airingToday.results || []).slice(0, 5)) {
      const key = `tv_${t.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      newContent.push({
        tmdb_id: t.id,
        content_type: 'tv',
        title: t.name || t.title,
        poster: t.poster_path ? `${IMG_BASE}${t.poster_path}` : null,
        rating: t.vote_average ? t.vote_average.toFixed(1) : null,
        overview: t.overview ? t.overview.substring(0, 150) : '',
        watch_url: `https://jflix.uk/player.html?id=${t.id}&type=tv`
      });
    }

    // Filter to only content we haven't notified about
    const trulyNew = [];
    for (const item of newContent) {
      const alreadyNotified = await env.DB.prepare(
        `SELECT id FROM notified_content WHERE tmdb_id = ? AND content_type = ?`
      ).bind(item.tmdb_id, item.content_type).first();

      if (!alreadyNotified) {
        trulyNew.push(item);
      }
    }

    if (trulyNew.length === 0) {
      console.log('[Push] No new content to notify');
      return;
    }

    console.log(`[Push] Found ${trulyNew.length} new items to notify`);

    // Get all push subscribers
    const subsResult = await env.DB.prepare(`SELECT * FROM push_subscriptions`).all();
    const subscriptions = subsResult.results || [];

    if (subscriptions.length === 0) {
      console.log('[Push] No subscribers');
      return;
    }

    // Send push for each new content item (limit to 3 to avoid spam)
    const itemsToNotify = trulyNew.slice(0, 3);
    let totalSent = 0;

    for (const item of itemsToNotify) {
      const title = item.content_type === 'movie'
        ? `🎬 New Movie: ${item.title}`
        : `📺 New TV Show: ${item.title}`;

      const body = item.rating
        ? `⭐ ${item.rating}/10 — ${item.overview}`
        : item.overview;

      const payload = JSON.stringify({
        title: title,
        body: body,
        icon: item.poster || '/images/icon-192x192.png',
        badge: '/images/icon-192x192.png',
        image: item.poster,
        url: item.watch_url,
        tag: `jflix_${item.content_type}_${item.tmdb_id}`,
        requireInteraction: false,
        silent: false,
        actions: [
          { action: 'watch', title: '▶ Watch Now' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      });

      // Send to all subscribers
      for (const sub of subscriptions) {
        try {
          const subscription = JSON.parse(sub.subscription_json);
          const pushResult = await sendWebPush(subscription, payload);
          if (pushResult) {
            totalSent++;
          } else {
            // Remove invalid subscription
            await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(sub.id).run();
          }
        } catch (e) {
          await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(sub.id).run();
        }
      }

      // Mark as notified
      await env.DB.prepare(
        `INSERT OR IGNORE INTO notified_content (tmdb_id, content_type, title) VALUES (?, ?, ?)`
      ).bind(item.tmdb_id, item.content_type, item.title).run();
    }

    // Clean old notified content (keep last 30 days)
    await env.DB.prepare(
      `DELETE FROM notified_content WHERE notified_at < datetime('now', '-30 days')`
    ).run();

    console.log(`[Push] Sent ${totalSent} push notifications for ${itemsToNotify.length} new items`);
  } catch (err) {
    console.error('[Push] Content check error:', err);
  }
}

// Handle comments API
async function handleComments(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'GET') {
    // Get comments for a specific media
    const mediaType = url.searchParams.get('mediaType');
    const mediaId = url.searchParams.get('mediaId');
    const seasonNumber = url.searchParams.get('seasonNumber');
    const episodeNumber = url.searchParams.get('episodeNumber');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let query = `
      SELECT c.id, c.media_type, c.media_id, c.season_number, c.episode_number,
             c.nickname, c.comment_text, c.created_at, c.updated_at
      FROM comments c
      WHERE c.media_type = ? AND c.media_id = ?
    `;
    const params = [mediaType, mediaId];

    if (seasonNumber !== null) {
      query += ' AND c.season_number = ?';
      params.push(seasonNumber);
    }
    if (episodeNumber !== null) {
      query += ' AND c.episode_number = ?';
      params.push(episodeNumber);
    }

    query += ' ORDER BY c.created_at DESC LIMIT ?';
    params.push(limit);

    try {
      const { results } = await env.DB.prepare(query).bind(...params).all();
      
      // Fetch replies for each comment
      const commentsWithReplies = await Promise.all(
        results.map(async (comment) => {
          const replies = await env.DB.prepare(`
            SELECT id, reply_text, is_admin_reply, created_at
            FROM comment_replies
            WHERE comment_id = ?
            ORDER BY created_at ASC
          `).bind(comment.id).all();
          
          return {
            ...comment,
            replies: replies.results || []
          };
        })
      );
      
      return new Response(JSON.stringify({ success: true, comments: commentsWithReplies }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (method === 'POST') {
    // Create a new comment
    const body = await request.json();
    const { mediaType, mediaId, seasonNumber, episodeNumber, userId, nickname, commentText } = body;

    try {
      // Check if user exists, if not create them
      await env.DB.prepare(`
        INSERT OR IGNORE INTO users (user_id, nickname)
        VALUES (?, ?)
      `).bind(userId, nickname).run();

      // Check if this is an admin comment - admin comments are not subject to the limit
      const isAdminComment = nickname.toLowerCase().includes('admin');

      if (!isAdminComment) {
        // Count current user comments (excluding admin comments) for this specific content
        let countQuery = `
          SELECT COUNT(*) as count
          FROM comments
          WHERE media_type = ? AND media_id = ?
          AND LOWER(nickname) NOT LIKE '%admin%'
        `;
        let countParams = [mediaType, mediaId];

        if (seasonNumber !== null) {
          countQuery += ' AND season_number = ?';
          countParams.push(seasonNumber);
        }
        if (episodeNumber !== null) {
          countQuery += ' AND episode_number = ?';
          countParams.push(episodeNumber);
        }

        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
        const currentCount = countResult ? countResult.count : 0;

        // If limit exceeded (200), delete oldest user comments
        if (currentCount >= 200) {
          const deleteCount = currentCount - 200 + 1; // Delete enough to make room for new comment

          let deleteQuery = `
            DELETE FROM comments
            WHERE id IN (
              SELECT id FROM comments
              WHERE media_type = ? AND media_id = ?
              AND LOWER(nickname) NOT LIKE '%admin%'
          `;
          let deleteParams = [mediaType, mediaId];

          if (seasonNumber !== null) {
            deleteQuery += ' AND season_number = ?';
            deleteParams.push(seasonNumber);
          }
          if (episodeNumber !== null) {
            deleteQuery += ' AND episode_number = ?';
            deleteParams.push(episodeNumber);
          }

          deleteQuery += ' ORDER BY created_at ASC LIMIT ?)';
          deleteParams.push(deleteCount);

          await env.DB.prepare(deleteQuery).bind(...deleteParams).run();
        }
      }

      // Insert the comment
      const result = await env.DB.prepare(`
        INSERT INTO comments (media_type, media_id, season_number, episode_number, user_id, nickname, comment_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, userId, nickname, commentText).run();

      return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (method === 'DELETE') {
    // Delete a comment
    const commentId = url.searchParams.get('id');
    const userId = url.searchParams.get('userId');

    try {
      // Only allow deletion by the comment owner
      const result = await env.DB.prepare(`
        DELETE FROM comments WHERE id = ? AND user_id = ?
      `).bind(commentId, userId).run();

      if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Comment not found or unauthorized' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

// Handle reactions API
async function handleReactions(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'GET') {
    // Get reactions for a specific media
    const mediaType = url.searchParams.get('mediaType');
    const mediaId = url.searchParams.get('mediaId');
    const seasonNumber = url.searchParams.get('seasonNumber');
    const episodeNumber = url.searchParams.get('episodeNumber');

    let query = `
      SELECT reaction_type, count
      FROM reaction_counts
      WHERE media_type = ? AND media_id = ?
    `;
    const params = [mediaType, mediaId];

    if (seasonNumber !== null) {
      query += ' AND season_number = ?';
      params.push(seasonNumber);
    }
    if (episodeNumber !== null) {
      query += ' AND episode_number = ?';
      params.push(episodeNumber);
    }

    try {
      const { results } = await env.DB.prepare(query).bind(...params).all();
      
      // Get user's reactions if userId is provided
      let userReactions = [];
      const userId = url.searchParams.get('userId');
      if (userId) {
        let userQuery = `
          SELECT reaction_type
          FROM reactions
          WHERE media_type = ? AND media_id = ? AND user_id = ?
        `;
        const userParams = [mediaType, mediaId, userId];
        if (seasonNumber !== null) {
          userQuery += ' AND season_number = ?';
          userParams.push(seasonNumber);
        }
        if (episodeNumber !== null) {
          userQuery += ' AND episode_number = ?';
          userParams.push(episodeNumber);
        }
        const { results: userResults } = await env.DB.prepare(userQuery).bind(...userParams).all();
        userReactions = userResults.map(r => r.reaction_type);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        reactionCounts: results,
        userReactions 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (method === 'POST') {
    // Add or update a reaction (toggle behavior - only one reaction per user)
    const body = await request.json();
    const { mediaType, mediaId, seasonNumber, episodeNumber, userId, reactionType } = body;

    try {
      // Check if user exists
      await env.DB.prepare(`
        INSERT OR IGNORE INTO users (user_id, nickname)
        VALUES (?, ?)
      `).bind(userId, 'User').run();

      // Check if user already has this specific reaction
      const existing = await env.DB.prepare(`
        SELECT id FROM reactions
        WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ? 
        AND user_id = ? AND reaction_type = ?
      `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, userId, reactionType).first();

      if (existing) {
        // Remove existing reaction (toggle off)
        await env.DB.prepare(`
          DELETE FROM reactions
          WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ?
          AND user_id = ? AND reaction_type = ?
        `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, userId, reactionType).run();

        // Decrement count using INSERT OR REPLACE
        const existingCount = await env.DB.prepare(`
          SELECT count FROM reaction_counts
          WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ? AND reaction_type = ?
        `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, reactionType).first();

        if (existingCount && existingCount.count > 0) {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO reaction_counts (media_type, media_id, season_number, episode_number, reaction_type, count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, reactionType, existingCount.count - 1).run();
        }

        return new Response(JSON.stringify({ success: true, action: 'removed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Remove all existing reactions for this user on this content (only one reaction allowed)
        const existingReactions = await env.DB.prepare(`
          SELECT reaction_type FROM reactions
          WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ? AND user_id = ?
        `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, userId).all();

        for (const reaction of existingReactions.results) {
          // Delete the old reaction
          await env.DB.prepare(`
            DELETE FROM reactions
            WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ?
            AND user_id = ? AND reaction_type = ?
          `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, userId, reaction.reaction_type).run();

          // Decrement the old reaction count using INSERT OR REPLACE
          const oldCount = await env.DB.prepare(`
            SELECT count FROM reaction_counts
            WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ? AND reaction_type = ?
          `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, reaction.reaction_type).first();

          if (oldCount && oldCount.count > 0) {
            await env.DB.prepare(`
              INSERT OR REPLACE INTO reaction_counts (media_type, media_id, season_number, episode_number, reaction_type, count, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, reaction.reaction_type, oldCount.count - 1).run();
          }
        }

        // Add new reaction using INSERT OR REPLACE to prevent duplicates
        await env.DB.prepare(`
          INSERT OR REPLACE INTO reactions (media_type, media_id, season_number, episode_number, user_id, reaction_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, userId, reactionType).run();

        // Increment or create count using INSERT OR REPLACE
        const existingCount = await env.DB.prepare(`
          SELECT count FROM reaction_counts
          WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ? AND reaction_type = ?
        `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, reactionType).first();

        if (existingCount) {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO reaction_counts (media_type, media_id, season_number, episode_number, reaction_type, count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, reactionType, existingCount.count + 1).run();
        } else {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO reaction_counts (media_type, media_id, season_number, episode_number, reaction_type, count, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
          `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null, reactionType).run();
        }

        return new Response(JSON.stringify({ success: true, action: 'added' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

// Handle views API
async function handleViews(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'GET') {
    // Get view count for a specific media
    const mediaType = url.searchParams.get('mediaType');
    const mediaId = url.searchParams.get('mediaId');
    const seasonNumber = url.searchParams.get('seasonNumber');
    const episodeNumber = url.searchParams.get('episodeNumber');
    const aggregate = url.searchParams.get('aggregate') === 'true';

    let query, params;

    if (aggregate) {
      // Return aggregated total views for the content
      query = `
        SELECT SUM(view_count) as view_count
        FROM view_counts
        WHERE media_type = ? AND media_id = ?
      `;
      params = [mediaType, mediaId];
    } else {
      // Return views for specific season/episode
      query = `
        SELECT view_count
        FROM view_counts
        WHERE media_type = ? AND media_id = ?
      `;
      params = [mediaType, mediaId];

      if (seasonNumber !== null) {
        query += ' AND season_number = ?';
        params.push(seasonNumber);
      }
      if (episodeNumber !== null) {
        query += ' AND episode_number = ?';
        params.push(episodeNumber);
      }
    }

    try {
      const result = await env.DB.prepare(query).bind(...params).first();
      const viewCount = result ? result.view_count : 0;
      
      return new Response(JSON.stringify({ success: true, viewCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (method === 'POST') {
    // Increment view count
    const body = await request.json();
    const { mediaType, mediaId, seasonNumber, episodeNumber } = body;

    try {
      const existing = await env.DB.prepare(`
        SELECT view_count FROM view_counts
        WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ?
      `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null).first();

      if (existing) {
        await env.DB.prepare(`
          UPDATE view_counts
          SET view_count = view_count + 1, updated_at = CURRENT_TIMESTAMP
          WHERE media_type = ? AND media_id = ? AND season_number = ? AND episode_number = ?
        `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO view_counts (media_type, media_id, season_number, episode_number, view_count)
          VALUES (?, ?, ?, ?, 1)
        `).bind(mediaType, mediaId, seasonNumber || null, episodeNumber || null).run();
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

// Handle users API
async function handleUsers(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'POST') {
    // Create or update user nickname
    const body = await request.json();
    const { userId, nickname } = body;

    // Validate nickname
    if (!nickname || nickname.trim().length < 3) {
      return new Response(JSON.stringify({ success: false, error: 'Nickname must be at least 3 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (nickname.trim().length > 20) {
      return new Response(JSON.stringify({ success: false, error: 'Nickname must be less than 20 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (nickname.toLowerCase().includes('admin')) {
      return new Response(JSON.stringify({ success: false, error: 'Nickname cannot contain "admin"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      await env.DB.prepare(`
        INSERT INTO users (user_id, nickname)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET nickname = ?
      `).bind(userId, nickname, nickname).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (method === 'GET') {
    // Get user by userId
    const userId = url.searchParams.get('userId');

    try {
      const result = await env.DB.prepare(`
        SELECT nickname FROM users WHERE user_id = ?
      `).bind(userId).first();

      if (result) {
        return new Response(JSON.stringify({ success: true, nickname: result.nickname }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

// Handle downloads API
async function handleDownloads(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'POST') {
    // Increment download count
    const body = await request.json();
    const { downloadType } = body;

    // Validate download type
    const validTypes = ['macos_silicon', 'macos_intel', 'windows_setup', 'windows_portable', 'android'];
    if (!validTypes.includes(downloadType)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid download type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const existing = await env.DB.prepare(`
        SELECT download_count FROM downloads WHERE download_type = ?
      `).bind(downloadType).first();

      if (existing) {
        await env.DB.prepare(`
          UPDATE downloads
          SET download_count = download_count + 1, updated_at = CURRENT_TIMESTAMP
          WHERE download_type = ?
        `).bind(downloadType).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO downloads (download_type, download_count)
          VALUES (?, 1)
        `).bind(downloadType).run();
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (method === 'GET') {
    // Get download stats (public endpoint for real-time tracking)
    try {
      const result = await env.DB.prepare(`
        SELECT download_type, download_count, updated_at
        FROM downloads
        ORDER BY download_type
      `).all();

      return new Response(JSON.stringify({ success: true, downloads: result.results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

// Admin credentials
const ADMIN_EMAIL = 'junrel.sapanta@icloud.com';
const ADMIN_PASSWORD = 'KcRel1406';

// Handle admin API
async function handleAdmin(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // Admin login
  if (path === '/api/admin/login' && method === 'POST') {
    const body = await request.json();
    const { email, password } = body;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Mark all comments as seen when admin logs in
      try {
        await env.DB.prepare('UPDATE comments SET admin_seen = 1').run();
      } catch (e) {
        console.error('Failed to mark comments as seen:', e);
      }

      // Generate a simple token (in production, use proper JWT)
      const token = btoa(`${email}:${Date.now()}`);
      return new Response(JSON.stringify({ success: true, token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Verify admin token for other endpoints
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.substring(7);
  let isValidAdmin = false;
  try {
    const decoded = atob(token);
    const [email, timestamp] = decoded.split(':');
    if (email === ADMIN_EMAIL && timestamp && !isNaN(Number(timestamp))) {
      isValidAdmin = true;
    }
  } catch {}

  if (!isValidAdmin) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid admin token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get all comments (new to old)
  if (path === '/api/admin/comments' && method === 'GET') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const result = await env.DB.prepare(`
        SELECT c.id, c.media_type, c.media_id, c.season_number, c.episode_number,
               c.nickname, c.comment_text, c.created_at, c.updated_at,
               (SELECT COUNT(*) FROM comment_replies WHERE comment_id = c.id) as reply_count
        FROM comments c
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset).all();

      // Fetch replies for each comment
      const commentsWithReplies = await Promise.all(result.results.map(async comment => {
        const replies = await env.DB.prepare(`
          SELECT id, reply_text, is_admin_reply, created_at
          FROM comment_replies
          WHERE comment_id = ?
          ORDER BY created_at ASC
        `).bind(comment.id).all();
        return { ...comment, replies: replies.results };
      }));

      return new Response(JSON.stringify({ success: true, comments: commentsWithReplies }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Delete comment
  if (path === '/api/admin/comments' && method === 'DELETE') {
    const body = await request.json();
    const { commentId } = body;

    try {
      await env.DB.prepare('DELETE FROM comment_replies WHERE comment_id = ?').bind(commentId).run();
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Reply to comment
  if (path === '/api/admin/comments/reply' && method === 'POST') {
    const body = await request.json();
    const { commentId, replyText } = body;

    try {
      // Mark the comment as seen when admin replies
      try {
        await env.DB.prepare('UPDATE comments SET admin_seen = 1 WHERE id = ?').bind(commentId).run();
      } catch (e) {
        console.error('Failed to mark comment as seen:', e);
      }

      await env.DB.prepare(`
        INSERT INTO comment_replies (comment_id, reply_text, is_admin_reply)
        VALUES (?, ?, 1)
      `).bind(commentId, replyText).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Delete admin reply
  if (path === '/api/admin/comments/reply' && method === 'DELETE') {
    const body = await request.json();
    const { replyId } = body;

    try {
      await env.DB.prepare('DELETE FROM comment_replies WHERE id = ?').bind(replyId).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Get most viewed content
  if (path === '/api/admin/stats/most-viewed' && method === 'GET') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const result = await env.DB.prepare(`
        SELECT media_type, media_id, SUM(view_count) as total_views
        FROM view_counts
        GROUP BY media_type, media_id
        ORDER BY total_views DESC
        LIMIT ?
      `).bind(limit).all();

      return new Response(JSON.stringify({ success: true, stats: result.results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Get most reacted content
  if (path === '/api/admin/stats/most-reacted' && method === 'GET') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const result = await env.DB.prepare(`
        SELECT media_type, media_id, SUM(count) as total_reactions
        FROM reaction_counts
        GROUP BY media_type, media_id
        ORDER BY total_reactions DESC
        LIMIT ?
      `).bind(limit).all();

      return new Response(JSON.stringify({ success: true, stats: result.results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ============================================
  // USER MANAGEMENT ENDPOINTS
  // ============================================

  // Get all users
  if (path === '/api/admin/users' && method === 'GET') {
    try {
      const users = await env.DB.prepare(`
        SELECT 
          u.user_id,
          u.google_id,
          u.email,
          u.nickname,
          u.avatar_url,
          u.auth_provider,
          u.is_active,
          u.created_at,
          u.last_login,
          u.subscription_type,
          u.subscription_expires_at,
          p.display_name,
          (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.user_id) as comment_count
        FROM users u
        LEFT JOIN user_profiles p ON u.user_id = p.user_id
        ORDER BY u.created_at DESC
      `).all();

      return new Response(JSON.stringify({ success: true, users: users.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /api/admin/online-users — returns all users with live session status
  if (path === '/api/admin/online-users' && method === 'GET') {
    try {
      const rows = await env.DB.prepare(`
        SELECT
          u.user_id, u.nickname, u.email, u.avatar_url, u.auth_provider, u.subscription_type, u.subscription_expires_at,
          MAX(s.last_active) AS last_active,
          CASE
            WHEN MAX(s.last_active) > datetime('now', '-5 minutes')  THEN 'online'
            WHEN MAX(s.last_active) > datetime('now', '-30 minutes') THEN 'away'
            ELSE 'offline'
          END AS status
        FROM users u
        LEFT JOIN user_sessions s ON s.user_id = u.user_id AND s.expires_at > datetime('now')
        GROUP BY u.user_id
        ORDER BY last_active DESC
      `).all();
      return new Response(JSON.stringify({ success: true, users: rows.results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Update user status (activate/deactivate)
  if (path.startsWith('/api/admin/users/') && path.endsWith('/status') && method === 'PUT') {
    try {
      const userId = path.split('/')[4];
      const body = await request.json();
      const { is_active } = body;

      if (typeof is_active !== 'boolean') {
        return new Response(JSON.stringify({ success: false, error: 'Invalid is_active value' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare(`
        UPDATE users SET is_active = ? WHERE user_id = ?
      `).bind(is_active ? 1 : 0, userId).run();

      return new Response(JSON.stringify({ success: true, message: `User ${is_active ? 'activated' : 'deactivated'} successfully` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Delete user
  if (path.startsWith('/api/admin/users/') && method === 'DELETE') {
    try {
      const userId = path.split('/')[4];

      // Delete user's data in correct order (respect foreign keys)
      await env.DB.prepare('DELETE FROM conversations WHERE user_id = ? OR admin_id = ?').bind(userId, userId).run();
      await env.DB.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').bind(userId, userId).run();
      await env.DB.prepare('DELETE FROM comment_replies WHERE comment_id IN (SELECT id FROM comments WHERE user_id = ?)').bind(userId).run();
      await env.DB.prepare('DELETE FROM image_uploads WHERE uploaded_by = ?').bind(userId).run();
      await env.DB.prepare('DELETE FROM user_activity_log WHERE user_id = ?').bind(userId).run();
      await env.DB.prepare('DELETE FROM user_profiles WHERE user_id = ?').bind(userId).run();
      await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(userId).run();
      await env.DB.prepare('DELETE FROM comments WHERE user_id = ?').bind(userId).run();
      await env.DB.prepare('DELETE FROM reactions WHERE user_id = ?').bind(userId).run();
      await env.DB.prepare('DELETE FROM users WHERE user_id = ?').bind(userId).run();

      return new Response(JSON.stringify({ success: true, message: 'User deleted successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ============================================
  // VOUCHER MANAGEMENT ENDPOINTS
  // ============================================

  // Get PayPal payment history
  if (path === '/api/admin/payments' && method === 'GET') {
    try {
      const payments = await env.DB.prepare(`
        SELECT
          a.*,
          u.nickname,
          u.email
        FROM user_activity_log a
        LEFT JOIN users u ON a.user_id = u.user_id
        WHERE a.action = 'paypal_premium'
        ORDER BY a.created_at DESC
        LIMIT 100
      `).all();

      const results = payments.results || [];

      // Calculate stats
      const totalPayments = results.length;
      const totalRevenue = results.reduce((sum, p) => {
        const details = typeof p.details === 'string' ? JSON.parse(p.details) : p.details;
        return sum + (details.amount || 0);
      }, 0);

      const now = new Date();
      const thisMonth = results.filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;

      const today = results.filter(p => {
        const d = new Date(p.created_at);
        return d.toDateString() === now.toDateString();
      }).length;

      return new Response(JSON.stringify({
        success: true,
        payments: results,
        stats: {
          totalPayments,
          totalRevenue,
          paymentsThisMonth: thisMonth,
          paymentsToday: today
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Get all vouchers
  if (path === '/api/admin/vouchers' && method === 'GET') {
    try {
      const vouchers = await env.DB.prepare(`
        SELECT 
          v.*,
          u.nickname as used_by_name,
          u.email as used_by_email
        FROM vouchers v
        LEFT JOIN users u ON v.used_by = u.user_id
        ORDER BY v.created_at DESC
      `).all();

      return new Response(JSON.stringify({ success: true, vouchers: vouchers.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Create new voucher
  // POST /api/admin/vouchers - Create voucher (admin dashboard)
  if (path === '/api/admin/vouchers' && method === 'POST') {
    try {
      console.log('POST /api/admin/vouchers called');
      const body = await request.json();
      const { code, duration_days, expires_at, type } = body;
      console.log('Voucher data:', { code, duration_days, expires_at, type });

      if (!code) {
        return new Response(JSON.stringify({ success: false, error: 'Code is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare(`
        INSERT INTO vouchers (code, duration_days, expires_at, created_by, is_active, type)
        VALUES (?, ?, ?, 'admin', 1, ?)
      `).bind(code, duration_days || null, expires_at || null, type || null).run();

      console.log('Voucher created successfully');
      return new Response(JSON.stringify({ success: true, message: 'Voucher created successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error creating voucher:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Bulk create vouchers
  // POST /api/admin/vouchers/bulk - Create multiple vouchers (auto-generated or manual custom codes)
  if (path === '/api/admin/vouchers/bulk' && method === 'POST') {
    try {
      console.log('POST /api/admin/vouchers/bulk called');
      const body = await request.json();
      const { count, codes, duration_days, prefix, expires_at, type } = body;

      const duration = parseInt(duration_days) || 30;
      const voucherPrefix = (prefix && typeof prefix === 'string') ? prefix.trim().toUpperCase() : 'JFLIX-';
      const expiry = expires_at || null;
      const voucherType = type || null;

      let targetCodes = [];

      if (Array.isArray(codes) && codes.length > 0) {
        // Manual custom codes mode
        targetCodes = codes
          .map(c => typeof c === 'string' ? c.trim().toUpperCase() : '')
          .filter(c => c.length > 0);
        // Deduplicate in-memory
        targetCodes = [...new Set(targetCodes)];
      } else if (count && parseInt(count) > 0) {
        // Auto-generated bulk codes mode
        const numToGenerate = Math.min(Math.max(1, parseInt(count)), 500); // 1 to 500 max per request
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const generatedSet = new Set();

        while (generatedSet.size < numToGenerate) {
          let randomPart = '';
          for (let i = 0; i < 10; i++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          generatedSet.add(voucherPrefix + randomPart);
        }
        targetCodes = Array.from(generatedSet);
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Either count or list of codes is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (targetCodes.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'No valid voucher codes to create' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const createdVouchers = [];
      const skippedCodes = [];

      for (const code of targetCodes) {
        try {
          await env.DB.prepare(`
            INSERT INTO vouchers (code, duration_days, expires_at, created_by, is_active, type)
            VALUES (?, ?, ?, 'admin', 1, ?)
          `).bind(code, duration, expiry, voucherType).run();

          createdVouchers.push({
            code,
            duration_days: duration,
            expires_at: expiry,
            type: voucherType,
            created_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn(`Skipping voucher code ${code}:`, err.message);
          skippedCodes.push(code);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        count: createdVouchers.length,
        vouchers: createdVouchers,
        skipped: skippedCodes.length,
        skippedCodes,
        message: `Successfully created ${createdVouchers.length} voucher(s)${skippedCodes.length > 0 ? ` (${skippedCodes.length} duplicate(s) skipped)` : ''}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error bulk creating vouchers:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Bulk delete vouchers
  // POST /api/admin/vouchers/bulk-delete
  if (path === '/api/admin/vouchers/bulk-delete' && method === 'POST') {
    try {
      const body = await request.json();
      const { codes } = body;

      if (!Array.isArray(codes) || codes.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Codes array is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let deletedCount = 0;
      for (const code of codes) {
        try {
          await env.DB.prepare('DELETE FROM vouchers WHERE code = ?').bind(code).run();
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete voucher ${code}:`, err);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        deleted: deletedCount,
        message: `Successfully deleted ${deletedCount} voucher(s)`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error bulk deleting vouchers:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Delete voucher
  if (path.startsWith('/api/admin/vouchers/') && method === 'DELETE') {
    try {
      const voucherCode = path.split('/')[4];
      if (!voucherCode || voucherCode === 'bulk' || voucherCode === 'bulk-delete') {
        return new Response(JSON.stringify({ success: false, error: 'Invalid voucher code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare('DELETE FROM vouchers WHERE code = ?').bind(voucherCode).run();

      return new Response(JSON.stringify({ success: true, message: 'Voucher deleted successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }


  // ============================================
  // SUBSCRIPTION MANAGEMENT ENDPOINTS
  // ============================================

  // Get users by subscription type
  if (path === '/api/admin/subscriptions' && method === 'GET') {
    try {
      const type = url.searchParams.get('type') || 'all';
      
      let query = `
        SELECT 
          u.user_id,
          u.google_id,
          u.email,
          u.nickname,
          u.avatar_url,
          u.subscription_type,
          u.subscription_expires_at,
          u.voucher_code,
          u.created_at,
          u.last_login,
          u.is_active,
          u.premium_source,
          u.is_premium_lifetime,
          v.type as voucher_type,
          v.used_at as voucher_used_at
        FROM users u
        LEFT JOIN vouchers v ON u.voucher_code = v.code
      `;
      
      const now = new Date();
      
      if (type === 'free') {
        // Free tab: Users with free subscription OR expired premium
        query += ` WHERE (
          u.subscription_type = 'free' OR 
          u.subscription_type IS NULL OR
          (u.subscription_type = 'premium' AND u.subscription_expires_at IS NOT NULL AND datetime(u.subscription_expires_at) < datetime('now'))
        )`;
      } else if (type === 'premium') {
        // Premium tab: Users with active premium
        query += ` WHERE (
          u.subscription_type = 'premium' AND (
            u.subscription_expires_at IS NULL OR 
            u.is_premium_lifetime = 1 OR
            datetime(u.subscription_expires_at) >= datetime('now')
          )
        )`;
      }
      
      query += ` ORDER BY u.created_at DESC`;

      const users = await env.DB.prepare(query).all();

      return new Response(JSON.stringify({ success: true, users: users.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Revoke subscription (set back to free)
  if (path.startsWith('/api/admin/users/') && path.endsWith('/subscription') && method === 'DELETE') {
    try {
      const userId = path.split('/')[4];

      await env.DB.prepare(`
        UPDATE users 
        SET subscription_type = 'free', 
            subscription_expires_at = NULL,
            voucher_code = NULL,
            premium_source = NULL,
            is_premium_lifetime = 0
        WHERE user_id = ?
      `).bind(userId).run();

      return new Response(JSON.stringify({ success: true, message: 'Subscription revoked successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Extend subscription
  if (path.startsWith('/api/admin/users/') && path.endsWith('/subscription/extend') && method === 'PUT') {
    try {
      const userId = path.split('/')[4];
      const body = await request.json();
      const { days } = body;

      if (!days || days < 1) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid days value' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const user = await env.DB.prepare('SELECT subscription_expires_at FROM users WHERE user_id = ?').bind(userId).first();
      
      let newExpiry = new Date();
      if (user && user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date()) {
        newExpiry = new Date(user.subscription_expires_at);
      }
      newExpiry.setDate(newExpiry.getDate() + days);

      await env.DB.prepare(`
        UPDATE users 
        SET subscription_type = 'premium',
            subscription_expires_at = ?
        WHERE user_id = ?
      `).bind(newExpiry.toISOString(), userId).run();

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Subscription extended by ${days} days`,
        newExpiry: newExpiry.toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── App Settings: GET ───
  if (path === '/api/admin/settings' && method === 'GET') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      const rows = await env.DB.prepare('SELECT key, value FROM app_settings').all();
      const settings = {};
      (rows.results || []).forEach(r => { settings[r.key] = r.value; });
      return new Response(JSON.stringify({ success: true, settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── App Settings: PUT ───
  if (path === '/api/admin/settings' && method === 'PUT') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      const body = await request.json();
      for (const [key, value] of Object.entries(body)) {
        await env.DB.prepare(`
          INSERT INTO app_settings (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).bind(key, String(value)).run();
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── Newsletter: GET subscribers (all users with email) ───
  if (path === '/api/admin/newsletter/subscribers' && method === 'GET') {
    try {
      const result = await env.DB.prepare(`
        SELECT u.user_id, u.email, u.nickname, u.created_at as subscribed_at,
               CASE WHEN ns.is_active = 0 THEN 0 ELSE 1 END as is_active
        FROM users u
        LEFT JOIN newsletter_subscribers ns ON u.user_id = ns.user_id
        WHERE u.email IS NOT NULL
          AND u.email != ''
          AND u.is_active = 1
        ORDER BY u.created_at DESC
      `).all();

      return new Response(JSON.stringify({ success: true, subscribers: result.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── Newsletter: GET subscriber count ───
  if (path === '/api/admin/newsletter/count' && method === 'GET') {
    try {
      const result = await env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email IS NOT NULL
          AND email != ''
          AND is_active = 1
          AND user_id NOT IN (
            SELECT user_id FROM newsletter_subscribers WHERE is_active = 0
          )
      `).first();

      return new Response(JSON.stringify({ success: true, count: result.count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── Newsletter: POST send newsletter to all subscribers ───
  if (path === '/api/admin/newsletter/send' && method === 'POST') {
    return handleSendNewsletter(request, env, corsHeaders);
  }

  // ─── Newsletter: GET auto-generate poster newsletter from TMDB ───
  if (path === '/api/admin/newsletter/generate-poster' && method === 'GET') {
    try {
      const TMDB_API_KEY = '84549ba3644ea15176802ec153bd9442';
      const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
      const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';

      // Fetch trending movies + now playing + upcoming in parallel
      const [trendingRes, nowPlayingRes, upcomingRes, trendingTvRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`),
        fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&region=US`),
        fetch(`https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&region=US`),
        fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`)
      ]);

      const trendingData = await trendingRes.json();
      const nowPlayingData = await nowPlayingRes.json();
      const upcomingData = await upcomingRes.json();
      const trendingTvData = await trendingTvRes.json();

      // Combine and deduplicate by ID
      const allMovies = [];
      const seenIds = new Set();

      // Now playing first (most relevant)
      for (const m of (nowPlayingData.results || [])) {
        if (!seenIds.has(m.id) && m.poster_path) {
          seenIds.add(m.id);
          allMovies.push({ ...m, category: 'Now Playing' });
        }
      }

      // Trending movies
      for (const m of (trendingData.results || [])) {
        if (!seenIds.has(m.id) && m.poster_path) {
          seenIds.add(m.id);
          allMovies.push({ ...m, category: 'Trending' });
        }
      }

      // Upcoming
      for (const m of (upcomingData.results || [])) {
        if (!seenIds.has(m.id) && m.poster_path) {
          seenIds.add(m.id);
          allMovies.push({ ...m, category: 'Upcoming' });
        }
      }

      // Trending TV shows
      const tvShows = (trendingTvData.results || []).filter(t => t.poster_path).slice(0, 4).map(t => ({
        ...t,
        category: 'Trending TV',
        title: t.name
      }));

      // Take top 12 movies
      const movies = allMovies.slice(0, 12);

      if (movies.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'No movies found from TMDB' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Build the HTML newsletter with posters
      let postersHtml = '';
      movies.forEach((m, i) => {
        const posterUrl = `${IMG_BASE}${m.poster_path}`;
        const title = m.title || m.name || 'Unknown';
        const rating = m.vote_average ? m.vote_average.toFixed(1) : 'N/A';
        const date = m.release_date ? new Date(m.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const overview = m.overview ? (m.overview.substring(0, 120) + (m.overview.length > 120 ? '...' : '')) : '';
        const watchUrl = `https://jflix.uk/player.html?id=${m.id}&type=movie`;
        const catColor = m.category === 'Now Playing' ? '#2ecc71' : m.category === 'Trending' ? '#e50914' : m.category === 'Upcoming' ? '#ffc107' : '#009cde';

        postersHtml += `
          <div style="display:inline-block;width:170px;vertical-align:top;margin:8px;background:#1a1a2e;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
            <a href="${watchUrl}" style="text-decoration:none;display:block;">
              <img src="${posterUrl}" alt="${title}" style="width:100%;height:255px;object-fit:cover;display:block;">
            </a>
            <div style="padding:10px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;background:${catColor};color:#fff;margin-bottom:6px;">${m.category}</span>
              <h3 style="color:#fff;font-size:13px;margin:0 0 4px;line-height:1.3;font-weight:600;">${title}</h3>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="color:#ffc107;font-size:11px;">★ ${rating}</span>
                ${date ? `<span style="color:#666;font-size:10px;">· ${date}</span>` : ''}
              </div>
              <p style="color:#888;font-size:10px;margin:0 0 8px;line-height:1.4;">${overview}</p>
              <a href="${watchUrl}" style="display:block;text-align:center;padding:6px;background:#e50914;color:#fff;text-decoration:none;border-radius:6px;font-size:11px;font-weight:600;">▶ Watch Now</a>
            </div>
          </div>`;
      });

      // TV Shows section
      let tvHtml = '';
      if (tvShows.length > 0) {
        tvShows.forEach(t => {
          const posterUrl = `${IMG_BASE}${t.poster_path}`;
          const title = t.name || 'Unknown';
          const rating = t.vote_average ? t.vote_average.toFixed(1) : 'N/A';
          const watchUrl = `https://jflix.uk/player.html?id=${t.id}&type=tv`;
          tvHtml += `
            <div style="display:inline-block;width:170px;vertical-align:top;margin:8px;background:#1a1a2e;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
              <a href="${watchUrl}" style="text-decoration:none;display:block;">
                <img src="${posterUrl}" alt="${title}" style="width:100%;height:255px;object-fit:cover;display:block;">
              </a>
              <div style="padding:10px;">
                <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;background:#9b59b6;color:#fff;margin-bottom:6px;">Trending TV</span>
                <h3 style="color:#fff;font-size:13px;margin:0 0 4px;line-height:1.3;font-weight:600;">${title}</h3>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                  <span style="color:#ffc107;font-size:11px;">★ ${rating}</span>
                </div>
                <a href="${watchUrl}" style="display:block;text-align:center;padding:6px;background:#9b59b6;color:#fff;text-decoration:none;border-radius:6px;font-size:11px;font-weight:600;">▶ Watch Now</a>
              </div>
            </div>`;
        });
      }

      // Full HTML body for the newsletter
      const htmlBody = `
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="color:#e50914;font-size:20px;margin:0 0 8px;">🎬 New Movies This Week</h2>
          <p style="color:#888;font-size:13px;margin:0;">${movies.length} new titles available to watch for free on JFlix</p>
        </div>
        <div style="text-align:center;">
          ${postersHtml}
        </div>
        ${tvShows.length > 0 ? `
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="color:#9b59b6;font-size:18px;margin:0 0 8px;">📺 Trending TV Shows</h2>
        </div>
        <div style="text-align:center;">
          ${tvHtml}
        </div>
        ` : ''}
        <div style="text-align:center;margin-top:24px;padding:16px;background:rgba(229,9,20,0.08);border-radius:10px;">
          <p style="color:#fff;font-size:14px;margin:0 0 10px;">Ready to watch? All free, no signup required.</p>
          <a href="https://jflix.uk" style="display:inline-block;padding:12px 32px;background:#e50914;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">Browse All on JFlix →</a>
        </div>`;

      // Plain text version
      const textBody = `New Movies This Week on JFlix!\n\n` +
        movies.map(m => `• ${m.title || m.name} (${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}★) - https://jflix.uk/player.html?id=${m.id}&type=movie`).join('\n') +
        `\n\nWatch free at jflix.uk`;

      // Generate subject
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const subject = `🎬 New on JFlix — ${movies.length} New Movies This Week (${today})`;

      return new Response(JSON.stringify({
        success: true,
        subject: subject,
        htmlBody: htmlBody,
        textBody: textBody,
        movieCount: movies.length,
        tvCount: tvShows.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── Newsletter: GET log of sent newsletters ───
  if (path === '/api/admin/newsletter/log' && method === 'GET') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS newsletter_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject TEXT NOT NULL,
          body_html TEXT,
          body_text TEXT,
          recipient_count INTEGER DEFAULT 0,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_by TEXT
        )
      `).run();

      const result = await env.DB.prepare(`
        SELECT id, subject, recipient_count, sent_at, sent_by
        FROM newsletter_log
        ORDER BY sent_at DESC
        LIMIT 50
      `).all();

      return new Response(JSON.stringify({ success: true, logs: result.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── Newsletter: GET active campaign status ───
  if (path === '/api/admin/newsletter/campaign' && method === 'GET') {
    try {
      const campaign = await env.DB.prepare(`
        SELECT * FROM newsletter_campaigns WHERE status = 'active' ORDER BY created_at DESC LIMIT 1
      `).first();

      if (!campaign) {
        return new Response(JSON.stringify({ success: true, campaign: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const stats = await env.DB.prepare(`
        SELECT
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
        FROM newsletter_campaign_recipients WHERE campaign_id = ?
      `).bind(campaign.id).first();

      return new Response(JSON.stringify({
        success: true,
        campaign: {
          ...campaign,
          sent: stats?.sent || 0,
          failed: stats?.failed || 0,
          pending: stats?.pending || 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── Newsletter: POST cancel active campaign ───
  if (path === '/api/admin/newsletter/cancel' && method === 'POST') {
    try {
      await env.DB.prepare(`
        UPDATE newsletter_campaigns SET status = 'cancelled' WHERE status = 'active'
      `).run();

      return new Response(JSON.stringify({ success: true, message: 'Campaign cancelled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── Newsletter: POST send to a single individual email ───
  if (path === '/api/admin/newsletter/send-individual' && method === 'POST') {
    try {
      const body = await request.json();
      const { email, subject, htmlBody, textBody, nickname } = body;

      if (!email || !subject || !htmlBody) {
        return new Response(JSON.stringify({ success: false, error: 'Email, subject, and HTML body are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate email format
      function isValidEmailIndividual(em) {
        if (!em || typeof em !== 'string') return false;
        em = em.trim().toLowerCase();
        if (em.length < 5) return false;
        if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(em)) return false;
        return true;
      }

      if (!isValidEmailIndividual(email)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid email address' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const brandedHtml = (nick) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#13131f;color:#fff;border-radius:16px;">
          <div style="text-align:center;padding:20px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
            <img src="https://jflix.uk/images/icon-512x512.png" alt="JFlix" style="width:50px;height:50px;border-radius:12px;">
            <h1 style="color:#e50914;font-size:22px;margin:12px 0 4px;">What's New on JFlix</h1>
            <p style="color:#888;font-size:12px;">Hi ${nick || 'there'}, here's your update</p>
          </div>
          <div style="padding:20px 0;">
            ${htmlBody}
          </div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;">
          <p style="color:#666;font-size:12px;text-align:center;">
            You're receiving this because you subscribed to the JFlix Newsletter.<br>
            <a href="https://jflix.uk/profile.html" style="color:#e50914;">Unsubscribe</a> · <a href="https://jflix.uk" style="color:#e50914;">Visit JFlix</a>
          </p>
        </div>
      `;

      const defaultText = textBody || `What's New on JFlix\n\n${subject}\n\nVisit jflix.uk to watch now.\n\nYou're receiving this because you have a JFlix account. Unsubscribe at jflix.uk/profile.html`;

      // Send via Resend API
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getResendApiKey(env)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'JFlix <noreply@jflix.uk>',
          to: email.trim(),
          subject: subject,
          html: brandedHtml(nickname),
          text: defaultText
        })
      });

      // Log the individual send
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS newsletter_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject TEXT NOT NULL,
          body_html TEXT,
          body_text TEXT,
          recipient_count INTEGER DEFAULT 0,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_by TEXT
        )
      `).run();

      if (resendResponse.ok) {
        const data = await resendResponse.json();
        await env.DB.prepare(`
          INSERT INTO newsletter_log (subject, body_html, body_text, recipient_count, sent_by)
          VALUES (?, ?, ?, 1, ?)
        `).bind(subject, htmlBody, defaultText, `individual:${email.trim()}`).run();

        return new Response(JSON.stringify({
          success: true,
          messageId: data.id || null,
          email: email.trim(),
          message: 'Newsletter sent successfully to ' + email.trim()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        const errText = await resendResponse.text();
        console.error('[Newsletter] Individual send failed:', errText);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to send email: ' + errText
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ─── Newsletter: POST send to multiple specific emails ───
  if (path === '/api/admin/newsletter/send-multiple' && method === 'POST') {
    try {
      const body = await request.json();
      const { emails, subject, htmlBody, textBody } = body;

      if (!emails || !Array.isArray(emails) || emails.length === 0 || !subject || !htmlBody) {
        return new Response(JSON.stringify({ success: false, error: 'Emails array, subject, and HTML body are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const brandedHtml = (nick) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#13131f;color:#fff;border-radius:16px;">
          <div style="text-align:center;padding:20px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
            <img src="https://jflix.uk/images/icon-512x512.png" alt="JFlix" style="width:50px;height:50px;border-radius:12px;">
            <h1 style="color:#e50914;font-size:22px;margin:12px 0 4px;">What's New on JFlix</h1>
            <p style="color:#888;font-size:12px;">Hi ${nick || 'there'}, here's your update</p>
          </div>
          <div style="padding:20px 0;">
            ${htmlBody}
          </div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;">
          <p style="color:#666;font-size:12px;text-align:center;">
            You're receiving this because you subscribed to the JFlix Newsletter.<br>
            <a href="https://jflix.uk/profile.html" style="color:#e50914;">Unsubscribe</a> · <a href="https://jflix.uk" style="color:#e50914;">Visit JFlix</a>
          </p>
        </div>
      `;

      const defaultText = textBody || `What's New on JFlix\n\n${subject}\n\nVisit jflix.uk to watch now.`;

      let sentCount = 0;
      let failedCount = 0;
      const failedEmails = [];

      for (const email of emails) {
        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${getResendApiKey(env)}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'JFlix <noreply@jflix.uk>',
              to: email.trim(),
              subject: subject,
              html: brandedHtml(null),
              text: defaultText
            })
          });

          if (resendResponse.ok) {
            sentCount++;
          } else {
            failedCount++;
            failedEmails.push(email);
          }
        } catch (e) {
          failedCount++;
          failedEmails.push(email);
        }
      }

      // Log
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS newsletter_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject TEXT NOT NULL,
          body_html TEXT,
          body_text TEXT,
          recipient_count INTEGER DEFAULT 0,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_by TEXT
        )
      `).run();

      await env.DB.prepare(`
        INSERT INTO newsletter_log (subject, body_html, body_text, recipient_count, sent_by)
        VALUES (?, ?, ?, ?, 'manual-multiple')
      `).bind(subject, htmlBody, defaultText, sentCount).run();

      return new Response(JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        failedEmails: failedEmails,
        total: emails.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Not Found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// JWT Secret for token generation/verification
const JWT_SECRET = 'U/z0oq6xCAVoDyxpIzuxMGdy6Nj1+ZOCNfiaZzrFefITDLyazaX9BeUDgJ9Y1+bqq79uStqM4TE4a+khz4s5hw==';

// Handle authentication routes
async function handleAuth(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Get current user profile
  if (path === '/api/auth/me' && method === 'GET') {
    return handleGetCurrentUser(request, env, corsHeaders);
  }

  // Check premium status (lightweight, for client gate verification)
  if (path === '/api/auth/check-premium' && method === 'GET') {
    try {
      const result = await getUserWithPremium(request, env);
      if (result.error) {
        return new Response(JSON.stringify({ success: false, error: result.error }), {
          status: result.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        isPremium: result.isPremium,
        subscriptionType: result.user.subscription_type || 'free',
        expiresAt: result.expiresAt
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Update user profile
  if (path === '/api/auth/profile' && method === 'PUT') {
    return handleUpdateProfile(request, env, corsHeaders);
  }

  // Upload profile avatar to R2
  if (path === '/api/auth/profile/avatar' && method === 'POST') {
    return handleUploadAvatar(request, env, corsHeaders);
  }

  // Logout
  if (path === '/api/auth/logout' && method === 'POST') {
    return handleLogout(request, env, corsHeaders);
  }

  // Check if email exists
  if (path === '/api/auth/check-email' && method === 'GET') {
    return handleCheckEmail(request, env, corsHeaders);
  }


  // Check if email exists and provider (for Supabase sign-up flow)
  if (path === '/api/auth/check-email' && method === 'POST') {
    return handleCheckEmail(request, env, corsHeaders);
  }

  // Create password for existing Google user (linking accounts)
  if (path === '/api/auth/link-password' && method === 'POST') {
    return handleLinkPassword(request, env, corsHeaders);
  }

  // Confirm password link (from email confirmation)
  if (path === '/api/auth/confirm-password-link' && method === 'POST') {
    return handleConfirmPasswordLink(request, env, corsHeaders);
  }

  // Password Reset - Send verification code
  if (path === '/api/auth/password-reset/send-code' && method === 'POST') {
    return handlePasswordResetSendCode(request, env, corsHeaders);
  }

  // Password Reset - Verify code
  if (path === '/api/auth/password-reset/verify-code' && method === 'POST') {
    return handlePasswordResetVerifyCode(request, env, corsHeaders);
  }

  // Password Reset - Reset password
  if (path === '/api/auth/password-reset/reset' && method === 'POST') {
    return handlePasswordReset(request, env, corsHeaders);
  }

  // Supabase Auth Sync - creates/finds JFlix user from Supabase session
  if (path === '/api/auth/supabase/sync' && method === 'POST') {
    return handleSupabaseSync(request, env, corsHeaders);
  }

  // Supabase Sign Up - creates Supabase user with email confirmation bypassed
  if (path === '/api/auth/supabase/signup' && method === 'POST') {
    return handleSupabaseSignUp(request, env, corsHeaders);
  }

  // Session heartbeat — keep last_active fresh so "active elsewhere" detection works
  if (path === '/api/auth/heartbeat' && method === 'POST') {
    return handleHeartbeat(request, env, corsHeaders);
  }

  // Send force-logout verification email when account is detected on another device
  if (path === '/api/auth/send-force-logout-email' && method === 'POST') {
    return handleSendForceLogoutEmail(request, env, corsHeaders);
  }

  // Execute force logout — invalidates all other sessions (called from email link)
  if (path === '/api/auth/execute-force-logout' && method === 'POST') {
    return handleExecuteForceLogout(request, env, corsHeaders);
  }

  // Newsletter — get subscription status
  if (path === '/api/auth/newsletter/status' && method === 'GET') {
    return handleNewsletterStatus(request, env, corsHeaders);
  }

  // Newsletter — subscribe
  if (path === '/api/auth/newsletter/subscribe' && method === 'POST') {
    return handleNewsletterSubscribe(request, env, corsHeaders);
  }

  // Newsletter — unsubscribe
  if (path === '/api/auth/newsletter/unsubscribe' && method === 'POST') {
    return handleNewsletterUnsubscribe(request, env, corsHeaders);
  }

  return new Response(JSON.stringify({ success: false, error: 'Auth endpoint not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handle Google OAuth Callback
async function handleGoogleAuthCallback(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { credential } = body; // Google ID token from frontend

    if (!credential) {
      return new Response(JSON.stringify({ success: false, error: 'No credential provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify Google ID token by calling Google's tokeninfo endpoint
    const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    
    if (!googleResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid Google token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const googleData = await googleResponse.json();
    
    // Verify the token is for our client
    if (googleData.aud !== GOOGLE_CLIENT_ID) {
      return new Response(JSON.stringify({ success: false, error: 'Token audience mismatch' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { sub: googleId, email, name: displayName, picture: avatarUrl } = googleData;

    // Check if user exists
    let user = await env.DB.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleId).first();
    
    let isNewUser = false;
    let userId;

    if (!user) {
      // Check if email already exists (could be Supabase or local user)
      const existingEmail = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

      if (existingEmail) {
        // Check if existing account has Supabase ID
        const hasSupabaseId = existingEmail.google_id && existingEmail.google_id.startsWith('supabase_');

        if (hasSupabaseId) {
          // Merge: Add Google ID to existing Supabase account, set auth_provider to 'both'
          await env.DB.prepare(`
            UPDATE users SET google_id = ?, auth_provider = 'both', avatar_url = ?,
              nickname = CASE WHEN (nickname IS NULL OR nickname = '') THEN ? ELSE nickname END,
              last_login = CURRENT_TIMESTAMP
            WHERE email = ?
          `).bind(googleId, avatarUrl, displayName || email.split('@')[0], email).run();
        } else {
          // Merge: Google account takes over (real Google ID overwrites any other ID)
          await env.DB.prepare(`
            UPDATE users SET google_id = ?, auth_provider = 'google', avatar_url = ?,
              nickname = CASE WHEN (nickname IS NULL OR nickname = '') THEN ? ELSE nickname END,
              last_login = CURRENT_TIMESTAMP
            WHERE email = ?
          `).bind(googleId, avatarUrl, displayName || email.split('@')[0], email).run();
        }
        // Upsert display_name in user_profiles
        await env.DB.prepare(`
          INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET display_name = CASE WHEN (display_name IS NULL OR display_name = '') THEN ? ELSE display_name END
        `).bind(existingEmail.user_id, displayName || email.split('@')[0], displayName || email.split('@')[0]).run();
        userId = existingEmail.user_id;
      } else {
        // Create new user
        isNewUser = true;
        userId = generateUUID();
        await env.DB.prepare(`
          INSERT INTO users (user_id, google_id, email, nickname, avatar_url, auth_provider, is_active, last_login)
          VALUES (?, ?, ?, ?, ?, 'google', 1, CURRENT_TIMESTAMP)
        `).bind(userId, googleId, email, displayName || email.split('@')[0], avatarUrl).run();
        
        // Create user profile
        await env.DB.prepare(`
          INSERT INTO user_profiles (user_id, display_name)
          VALUES (?, ?)
        `).bind(userId, displayName || email.split('@')[0]).run();
      }
    } else {
      userId = user.user_id;
      // Update last login
      await env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP, avatar_url = ? WHERE user_id = ?')
        .bind(avatarUrl, userId).run();
    }

    // Generate session token
    const sessionToken = generateJWT({ userId, email, googleId });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Store session with last_active timestamp
    await env.DB.prepare(`
      INSERT INTO user_sessions (user_id, session_token, expires_at, last_active, user_agent)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(userId, sessionToken, expiresAt.toISOString(), request.headers.get('User-Agent') || '').run();

    // Detect if account is actively used on another device (last heartbeat < 30 min ago)
    // Only count sessions from different devices (different user agent)
    const otherActive = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM user_sessions
      WHERE user_id = ? AND session_token != ? 
        AND last_active > datetime('now', '-30 minutes')
        AND user_agent != ?
    `).bind(userId, sessionToken, request.headers.get('User-Agent') || '').first();
    const activeElsewhere = (otherActive?.cnt || 0) > 0;

    // Log activity
    await logUserActivity(env, userId, 'login', { provider: 'google', isNewUser });

    // Get full user profile
    const profile = await env.DB.prepare(`
      SELECT u.*, p.bio, p.location, p.website, p.birth_date, p.preferences
      FROM users u
      LEFT JOIN user_profiles p ON u.user_id = p.user_id
      WHERE u.user_id = ?
    `).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      isNewUser,
      token: sessionToken,
      activeElsewhere,
      user: {
        id: profile.user_id,
        user_id: profile.user_id,
        email: profile.email,
        nickname: profile.nickname,
        avatarUrl: profile.avatar_url,
        authProvider: profile.auth_provider,
        bio: profile.bio,
        location: profile.location,
        website: profile.website,
        subscriptionType: profile.subscription_type || 'free',
        subscriptionExpiresAt: profile.subscription_expires_at
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Google auth error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get current authenticated user
async function handleGetCurrentUser(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'No token provided' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if session exists and not expired
    const session = await env.DB.prepare(`
      SELECT * FROM user_sessions WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(token).first();

    if (!session) {
      return new Response(JSON.stringify({ success: false, error: 'Session expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user with profile
    const user = await env.DB.prepare(`
      SELECT u.*, p.bio, p.location, p.website, p.birth_date, p.preferences, p.updated_at as profile_updated
      FROM users u
      LEFT JOIN user_profiles p ON u.user_id = p.user_id
      WHERE u.user_id = ? AND u.is_active = 1
    `).bind(payload.userId).first();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user has active premium
    const now = new Date();
    const expiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
    const isPremium = user.subscription_type === 'premium' && (!expiry || expiry > now);

    // Block access flag for native apps (Electron/Android) - client will enforce
    const userAgent = request.headers.get('User-Agent') || '';
    const isNativeApp = userAgent.includes('Electron') ||
                        /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(userAgent) ||
                        userAgent.includes('JFlix');
    const blockAccess = isNativeApp && !isPremium;

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        authProvider: user.auth_provider,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        bio: user.bio,
        location: user.location,
        website: user.website,
        birthDate: user.birth_date,
        preferences: user.preferences ? JSON.parse(user.preferences) : {},
        subscription_type: user.subscription_type || 'free',
        subscription_expires_at: user.subscription_expires_at,
        voucher_code: user.voucher_code
      },
      blockAccess: blockAccess,
      isPremium: isPremium
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Upload profile avatar image to R2
async function handleUploadAvatar(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'No token provided' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    if (!payload) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const formData = await request.formData();
    const file = formData.get('avatar');
    if (!file) {
      return new Response(JSON.stringify({ success: false, error: 'No file provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const MAX_BYTES = 3 * 1024 * 1024;
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return new Response(JSON.stringify({ success: false, error: 'Image exceeds 3 MB limit' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const mimeType = file.type || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      return new Response(JSON.stringify({ success: false, error: 'Only image files are allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ext = mimeType.split('/')[1]?.split('+')[0] || 'jpg';
    const r2Key = `avatars/${payload.userId}.${ext}`;

    if (!env.CHAT_IMAGES) {
      return new Response(JSON.stringify({ success: false, error: 'Storage not available' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await env.CHAT_IMAGES.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: mimeType },
      customMetadata: { userId: String(payload.userId) }
    });

    const r2PublicUrl = env.R2_PUBLIC_URL || '';
    const avatarUrl = r2PublicUrl ? `${r2PublicUrl}/${r2Key}?t=${Date.now()}` : null;

    if (avatarUrl) {
      await env.DB.prepare(
        `UPDATE users SET avatar_url = ? WHERE user_id = ?`
      ).bind(avatarUrl.split('?')[0], payload.userId).run();
    }

    return new Response(JSON.stringify({ success: true, avatarUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Update user profile
async function handleUpdateProfile(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'No token provided' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { nickname, bio, location, website, birthDate, preferences, avatarUrl } = body;

    // Validate nickname
    if (nickname) {
      if (nickname.length < 3 || nickname.length > 30) {
        return new Response(JSON.stringify({ success: false, error: 'Nickname must be 3-30 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Update users table
    if (nickname) {
      await env.DB.prepare('UPDATE users SET nickname = ? WHERE user_id = ?')
        .bind(nickname, payload.userId).run();
    }
    if (avatarUrl !== undefined) {
      await env.DB.prepare('UPDATE users SET avatar_url = ? WHERE user_id = ?')
        .bind(avatarUrl, payload.userId).run();
    }

    // Update or insert profile
    const profileFields = [];
    const profileValues = [];
    
    if (bio !== undefined) { profileFields.push('bio'); profileValues.push(bio); }
    if (location !== undefined) { profileFields.push('location'); profileValues.push(location); }
    if (website !== undefined) { profileFields.push('website'); profileValues.push(website); }
    if (birthDate !== undefined) { profileFields.push('birth_date'); profileValues.push(birthDate); }
    if (preferences !== undefined) { profileFields.push('preferences'); profileValues.push(JSON.stringify(preferences)); }

    if (profileFields.length > 0) {
      const setClause = profileFields.map(f => `${f} = ?`).join(', ');
      await env.DB.prepare(`
        INSERT INTO user_profiles (user_id, ${profileFields.join(', ')}, updated_at)
        VALUES (?, ${profileFields.map(() => '?').join(', ')}, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      `).bind(payload.userId, ...profileValues, ...profileValues).run();
    }

    await logUserActivity(env, payload.userId, 'profile_update', { fields: profileFields });

    return new Response(JSON.stringify({ success: true, message: 'Profile updated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle logout
async function handleLogout(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Get user from token before deleting
      const payload = verifyJWT(token);
      if (payload) {
        await logUserActivity(env, payload.userId, 'logout', {});
      }

      // Delete session
      await env.DB.prepare('DELETE FROM user_sessions WHERE session_token = ?').bind(token).run();
    }

    return new Response(JSON.stringify({ success: true, message: 'Logged out' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Check if email exists and return auth provider (handles both GET and POST)
async function handleCheckEmail(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;
  
  let email;
  
  if (method === 'GET') {
    email = (url.searchParams.get('email') || '').toLowerCase().trim();
  } else if (method === 'POST') {
    try {
      const body = await request.json();
      email = body.email;
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (!email) {
    return new Response(JSON.stringify({ success: false, error: 'Email is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const existingUser = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

    if (!existingUser) {
      return new Response(JSON.stringify({ 
        success: true, 
        exists: false,
        provider: null 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine provider
    let provider = 'unknown';
    if (existingUser.auth_provider) {
      provider = existingUser.auth_provider;
    } else if (existingUser.google_id && !existingUser.google_id.startsWith('supabase_')) {
      provider = 'google';
    } else if (existingUser.google_id && existingUser.google_id.startsWith('supabase_')) {
      provider = 'supabase';
    }

    return new Response(JSON.stringify({ 
      success: true, 
      exists: true,
      provider: provider,
      hasGoogleId: existingUser.google_id && !existingUser.google_id.startsWith('supabase_'),
      userId: existingUser.user_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}


// Handle Supabase Sign Up (bypasses email confirmation for Electron/Android)
async function handleSupabaseSignUp(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email, password, displayName } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, error: 'Email and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check email domain restriction setting
    try {
      const setting = await env.DB.prepare(
        "SELECT value FROM app_settings WHERE key = 'email_domain_restriction'"
      ).first();
      if (setting && setting.value === 'enabled') {
        const ALLOWED_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me', 'icloud.com', 'deped.gov.ph'];
        const domain = email.toLowerCase().split('@')[1] || '';
        if (!ALLOWED_DOMAINS.includes(domain)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only Gmail, Outlook, Yahoo, Proton, iCloud, and DepEd email addresses are accepted for sign up.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (_) {}

    // Check if email already exists in database
    const existingUser = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

    if (existingUser) {
      // Check if existing account has Google ID (not Supabase ID)
      const hasGoogleId = existingUser.google_id && !existingUser.google_id.startsWith('supabase_');

      if (hasGoogleId) {
        // Email exists with Google account - return special response to trigger password linking flow
        return new Response(JSON.stringify({
          success: false,
          error: 'Email already registered with Google account',
          requiresPasswordLink: true,
          existingProvider: 'google',
          message: 'This email is already registered with Google sign-in. Would you like to add a password to sign in with email?'
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Email exists with Supabase account
        return new Response(JSON.stringify({
          success: false,
          error: 'Email already registered',
          existingProvider: 'supabase'
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const serviceKey = env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      return new Response(JSON.stringify({ success: false, error: 'Supabase admin not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SUPABASE_URL = 'https://wqxnnplolrudxvaqfias.supabase.co';
    const adminHeaders = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json'
    };

    // Create user with email confirmation bypassed
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName || email.split('@')[0] }
      })
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      return new Response(JSON.stringify({ success: false, error: err.msg || 'Failed to create account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userData = await createRes.json();
    const supabaseUserId = userData.id;

    // Create JFlix user record
    const emailLower = email.toLowerCase().trim();
    const displayNameClean = displayName || emailLower.split('@')[0];
    const supabaseStorageId = 'supabase_' + supabaseUserId;

    // Create new user (we already checked for existing users above)
    const userId = generateUUID();
    const isNewUser = true;
    await env.DB.prepare(`
      INSERT INTO users (user_id, google_id, email, nickname, auth_provider, is_active, last_login)
      VALUES (?, ?, ?, ?, 'supabase', 1, CURRENT_TIMESTAMP)
    `).bind(userId, supabaseStorageId, emailLower, displayNameClean).run();
    await env.DB.prepare(`
      INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)
    `).bind(userId, displayNameClean).run();

    // Generate session token
    const sessionToken = generateJWT({ userId, email: emailLower, supabaseId: supabaseUserId });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await env.DB.prepare(`
      INSERT INTO user_sessions (user_id, session_token, expires_at, last_active, user_agent) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(userId, sessionToken, expiresAt.toISOString(), request.headers.get('User-Agent') || '').run();

    await logUserActivity(env, userId, 'signup', { provider: 'supabase', isNewUser });

    const profile = await env.DB.prepare(`
      SELECT u.*, p.bio, p.location, p.website, p.birth_date, p.preferences
      FROM users u LEFT JOIN user_profiles p ON u.user_id = p.user_id
      WHERE u.user_id = ?
    `).bind(userId).first();

    // Determine if user should be blocked (gate closed)
    const isPremium = profile.subscription_type === 'premium';
    const subscriptionExpiry = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const isSubscriptionExpired = subscriptionExpiry && subscriptionExpiry < new Date();
    const isLifetimePremium = profile.is_premium_lifetime === 1;
    
    // User has access if: lifetime premium OR (premium AND not expired)
    const hasAccess = isLifetimePremium || (isPremium && !isSubscriptionExpired);
    const blockAccess = !hasAccess;

    return new Response(JSON.stringify({
      success: true,
      isNewUser,
      token: sessionToken,
      blockAccess,
      user: {
        id: profile.user_id,
        user_id: profile.user_id,
        email: profile.email,
        nickname: profile.nickname,
        avatarUrl: profile.avatar_url,
        authProvider: profile.auth_provider,
        bio: profile.bio,
        location: profile.location,
        website: profile.website,
        subscriptionType: profile.subscription_type || 'free',
        subscriptionExpiresAt: profile.subscription_expires_at,
        isPremiumLifetime: profile.is_premium_lifetime === 1,
        premiumSource: profile.premium_source
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle Supabase Auth Sync
async function handleSupabaseSync(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { supabaseAccessToken, email, supabaseUserId } = body;

    if (!supabaseAccessToken || !email || !supabaseUserId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify Supabase token via Supabase REST API
    const supabaseVerify = await fetch('https://wqxnnplolrudxvaqfias.supabase.co/auth/v1/user', {
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeG5ucGxvbHJ1ZHh2YXFmaWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODM4MDUsImV4cCI6MjA5NTU1OTgwNX0.tgDgxBtQ2i9dD4E1dGppmWeGg00FMPY1Kw9lqK0cBbs'
      }
    });

    if (!supabaseVerify.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid Supabase token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUser = await supabaseVerify.json();
    if (supabaseUser.email !== email || supabaseUser.id !== supabaseUserId) {
      return new Response(JSON.stringify({ success: false, error: 'Token verification failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const displayName = (supabaseUser.user_metadata && supabaseUser.user_metadata.full_name) || email.split('@')[0];
    const emailVerified = !!supabaseUser.email_confirmed_at;
    const supabaseStorageId = 'supabase_' + supabaseUserId;
    const userAgent = request.headers.get('User-Agent') || '';

    // Detect platform from user agent
    let platform = 'web';
    if (userAgent.includes('Electron')) {
      platform = 'electron';
    } else if (userAgent.includes('Android')) {
      platform = 'android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod')) {
      platform = 'ios';
    }

    // Find user by supabase storage ID or email
    let user = await env.DB.prepare('SELECT * FROM users WHERE google_id = ?').bind(supabaseStorageId).first();

    let isNewUser = false;
    let userId;

    if (!user) {
      const existingEmail = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (existingEmail) {
        // Only store Supabase ID if no real Google ID already exists
        // (Google IDs never start with 'supabase_'; preserve them to keep both logins working)
        const hasGoogleId = existingEmail.google_id && !existingEmail.google_id.startsWith('supabase_');
        if (hasGoogleId) {
          // Linked to Google — just refresh last_login; keep Google ID intact, set auth_provider to 'both'
          await env.DB.prepare(`
            UPDATE users SET last_login = CURRENT_TIMESTAMP, auth_provider = 'both',
              nickname = CASE WHEN (nickname IS NULL OR nickname = '') THEN ? ELSE nickname END
            WHERE email = ?
          `).bind(displayName, email).run();
        } else {
          // No Google ID — safe to store Supabase ID
          await env.DB.prepare(`
            UPDATE users SET google_id = ?, auth_provider = 'supabase', last_login = CURRENT_TIMESTAMP,
              nickname = CASE WHEN (nickname IS NULL OR nickname = '') THEN ? ELSE nickname END
            WHERE email = ?
          `).bind(supabaseStorageId, displayName, email).run();
        }
        // Upsert display_name in user_profiles
        await env.DB.prepare(`
          INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET display_name = CASE WHEN (display_name IS NULL OR display_name = '') THEN ? ELSE display_name END
        `).bind(existingEmail.user_id, displayName, displayName).run();
        userId = existingEmail.user_id;
      } else {
        isNewUser = true;
        userId = generateUUID();
        await env.DB.prepare(`
          INSERT INTO users (user_id, google_id, email, nickname, auth_provider, is_active, last_login)
          VALUES (?, ?, ?, ?, 'supabase', 1, CURRENT_TIMESTAMP)
        `).bind(userId, supabaseStorageId, email, displayName).run();
        await env.DB.prepare(`
          INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)
        `).bind(userId, displayName).run();
      }
    } else {
      userId = user.user_id;
      await env.DB.prepare(`
        UPDATE users SET last_login = CURRENT_TIMESTAMP,
          nickname = CASE WHEN (nickname IS NULL OR nickname = '') THEN ? ELSE nickname END
        WHERE user_id = ?
      `).bind(displayName, userId).run();
      // Upsert display_name in user_profiles too
      await env.DB.prepare(`
        INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET display_name = CASE WHEN (display_name IS NULL OR display_name = '') THEN ? ELSE display_name END
      `).bind(userId, displayName, displayName).run();
    }

    const sessionToken = generateJWT({ userId, email, supabaseId: supabaseUserId });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await env.DB.prepare(`
      INSERT INTO user_sessions (user_id, session_token, expires_at, last_active, user_agent) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(userId, sessionToken, expiresAt.toISOString(), request.headers.get('User-Agent') || '').run();

    // Detect if account is actively used on another device
    // Only count sessions from different devices (different user agent)
    const otherActiveS = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM user_sessions
      WHERE user_id = ? AND session_token != ? 
        AND last_active > datetime('now', '-30 minutes')
        AND user_agent != ?
    `).bind(userId, sessionToken, request.headers.get('User-Agent') || '').first();
    const activeElsewhere = (otherActiveS?.cnt || 0) > 0;

    await logUserActivity(env, userId, 'login', { provider: 'supabase', isNewUser });

    const profile = await env.DB.prepare(`
      SELECT u.*, p.bio, p.location, p.website, p.birth_date, p.preferences
      FROM users u LEFT JOIN user_profiles p ON u.user_id = p.user_id
      WHERE u.user_id = ?
    `).bind(userId).first();

    // Determine if user should be blocked (gate closed)
    const isPremium = profile.subscription_type === 'premium';
    const subscriptionExpiry = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const isSubscriptionExpired = subscriptionExpiry && subscriptionExpiry < new Date();
    const isLifetimePremium = profile.is_premium_lifetime === 1;
    
    // User has access if: lifetime premium OR (premium AND not expired)
    const hasAccess = isLifetimePremium || (isPremium && !isSubscriptionExpired);
    const blockAccess = !hasAccess;

    return new Response(JSON.stringify({
      success: true,
      isNewUser,
      token: sessionToken,
      emailVerified,
      activeElsewhere,
      blockAccess,
      platform,
      user: {
        id: profile.user_id,
        user_id: profile.user_id,
        email: profile.email,
        nickname: profile.nickname,
        avatarUrl: profile.avatar_url || null,
        authProvider: profile.auth_provider,
        bio: profile.bio,
        location: profile.location,
        website: profile.website,
        subscriptionType: profile.subscription_type || 'free',
        subscriptionExpiresAt: profile.subscription_expires_at,
        isPremiumLifetime: profile.is_premium_lifetime === 1,
        premiumSource: profile.premium_source
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Supabase sync error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle Link Password - sends OTP for password creation
async function handleLinkPassword(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if email exists and has Google ID
    const existingUser = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

    if (!existingUser) {
      return new Response(JSON.stringify({ success: false, error: 'Email not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const hasGoogleId = existingUser.google_id && !existingUser.google_id.startsWith('supabase_');

    if (!hasGoogleId) {
      return new Response(JSON.stringify({ success: false, error: 'Account does not have Google authentication' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute expiry

    // Store OTP in password_link_requests table
    await env.DB.prepare(`
      INSERT INTO password_link_requests (email, otp_code, token, expires_at, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(email, otpCode, generateUUID(), expiresAt.toISOString(), existingUser.user_id).run();

    // Send OTP email using Resend
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getResendApiKey(env)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'JFlix <noreply@jflix.uk>',
          to: email,
          subject: 'Your Verification Code - JFlix',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #e50914;">Your Verification Code</h2>
              <p>You requested to add email/password login to your JFlix account.</p>
              <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 30px 0; color: #e50914;">${otpCode}</p>
              <p>Enter this code to proceed with creating your password.</p>
              <p style="color: #888; font-size: 12px; margin-top: 30px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
            </div>
          `
        })
      });

      if (!resendResponse.ok) {
        console.error('[Password Link] Failed to send email:', await resendResponse.text());
      }
    } catch (error) {
      console.error('[Password Link] Email sending error:', error);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Verification code sent to your email. Please enter the code to proceed.',
      requiresOTP: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Link password error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle Confirm Password Link - processes OTP verification for password creation
async function handleConfirmPasswordLink(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { otpCode, email, password } = body;

    if (!otpCode || !email || !password) {
      return new Response(JSON.stringify({ success: false, error: 'OTP code, email, and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up the password link request by OTP and email
    const linkRequest = await env.DB.prepare(`
      SELECT * FROM password_link_requests
      WHERE email = ? AND otp_code = ? AND expires_at > CURRENT_TIMESTAMP AND used = 0
      ORDER BY created_at DESC LIMIT 1
    `).bind(email, otpCode).first();

    if (!linkRequest) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired verification code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase user with password
    const supabaseCreate = await fetch('https://wqxnnplolrudxvaqfias.supabase.co/auth/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeG5ucGxvbHJ1ZHh2YXFmaWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODM4MDUsImV4cCI6MjA5NTU1OTgwNX0.tgDgxBtQ2i9dD4E1dGppmWeGg00FMPY1Kw9lqK0cBbs'
      },
      body: JSON.stringify({
        email: email,
        password: password,
        options: {
          data: {
            linked_from_google: true,
            original_user_id: linkRequest.user_id
          }
        }
      })
    });

    if (!supabaseCreate.ok) {
      const errorData = await supabaseCreate.json();
      return new Response(JSON.stringify({ success: false, error: 'Failed to create Supabase account', details: errorData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUser = await supabaseCreate.json();
    const supabaseStorageId = 'supabase_' + supabaseUser.id;

    // Update user record with Supabase ID (keeping Google ID intact)
    await env.DB.prepare(`
      UPDATE users SET google_id = CASE
        WHEN google_id LIKE 'supabase_%' THEN google_id
        ELSE google_id || ',' || ?
      END,
      auth_provider = 'both',
      last_login = CURRENT_TIMESTAMP
      WHERE email = ?
    `).bind(supabaseStorageId, email).run();

    // Mark the link request as used
    await env.DB.prepare(`
      UPDATE password_link_requests SET used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(linkRequest.id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Password created successfully. You can now sign in with email/password.',
      userId: linkRequest.user_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Confirm password link error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle Password Reset Send Code - sends OTP for password reset
async function handlePasswordResetSendCode(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if email exists
    const existingUser = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

    if (!existingUser) {
      // For security, don't reveal if email exists, but return success
      return new Response(JSON.stringify({ success: true, message: 'If the email exists, a verification code has been sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user has Supabase auth (google_id starts with supabase_)
    const hasSupabaseAuth = existingUser.google_id && existingUser.google_id.startsWith('supabase_');

    if (!hasSupabaseAuth) {
      return new Response(JSON.stringify({ success: false, error: 'This account does not use email/password authentication' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute expiry

    // Store OTP in password_reset_requests table
    await env.DB.prepare(`
      INSERT INTO password_reset_requests (email, otp_code, token, expires_at, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(email, otpCode, generateUUID(), expiresAt.toISOString(), existingUser.user_id).run();

    // Send OTP email using Resend
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getResendApiKey(env)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'JFlix <noreply@jflix.uk>',
          to: email,
          subject: 'Password Reset Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #e50914;">Password Reset</h2>
              <p>You requested to reset your password for your JFlix account.</p>
              <p>Your verification code is:</p>
              <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${otpCode}
              </div>
              <p>This code will expire in 15 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          `
        })
      });

      if (!resendResponse.ok) {
        console.error('Failed to send password reset email:', await resendResponse.text());
        return new Response(JSON.stringify({ success: false, error: 'Failed to send verification email' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to send verification email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Verification code sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Password reset send code error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle Password Reset Verify Code - verifies OTP for password reset
async function handlePasswordResetVerifyCode(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return new Response(JSON.stringify({ success: false, error: 'Email and code are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if OTP exists and is valid
    const otpRequest = await env.DB.prepare(`
      SELECT * FROM password_reset_requests
      WHERE email = ? AND otp_code = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(email, code).first();

    if (!otpRequest) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired verification code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Code verified successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Password reset verify code error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle Password Reset - resets the password
async function handlePasswordReset(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = body;

    if (!email || !code || !newPassword) {
      return new Response(JSON.stringify({ success: false, error: 'Email, code, and new password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ success: false, error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if OTP exists and is valid
    const otpRequest = await env.DB.prepare(`
      SELECT * FROM password_reset_requests
      WHERE email = ? AND otp_code = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(email, code).first();

    if (!otpRequest) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired verification code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the user
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update password in Supabase
    try {
      const serviceKey = env.SUPABASE_SERVICE_KEY;
      const SUPABASE_URL = 'https://wqxnnplolrudxvaqfias.supabase.co';

      if (!serviceKey) {
        console.error('SUPABASE_SERVICE_KEY not configured');
        return new Response(JSON.stringify({ success: false, error: 'Service not configured' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // First, get the Supabase user ID by querying Supabase users by email
      console.log('Finding Supabase user by email:', email);
      const listUsersResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json'
        }
      });

      const listUsersText = await listUsersResponse.text();
      console.log('Supabase list users response status:', listUsersResponse.status);
      console.log('Supabase list users response:', listUsersText);

      if (!listUsersResponse.ok) {
        console.error('Failed to list Supabase users:', listUsersText);
        return new Response(JSON.stringify({ success: false, error: `Failed to find user: ${listUsersText}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const usersData = JSON.parse(listUsersText);
      if (!usersData.users || usersData.users.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'User not found in Supabase' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const supabaseUserId = usersData.users[0].id;
      console.log('Found Supabase user ID:', supabaseUserId);

      // Now update the password using the correct UUID
      const updateResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${supabaseUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: newPassword
        })
      });

      const responseText = await updateResponse.text();
      console.log('Supabase password update response status:', updateResponse.status);
      console.log('Supabase password update response:', responseText);

      if (!updateResponse.ok) {
        console.error('Failed to update Supabase password:', responseText);
        return new Response(JSON.stringify({ success: false, error: `Failed to update password: ${responseText}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (supabaseError) {
      console.error('Error updating Supabase password:', supabaseError);
      return new Response(JSON.stringify({ success: false, error: `Failed to update password: ${supabaseError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark OTP as used
    await env.DB.prepare(`
      UPDATE password_reset_requests SET used = 1 WHERE id = ?
    `).bind(otpRequest.id).run();

    return new Response(JSON.stringify({ success: true, message: 'Password reset successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}


// Log user activity
async function logUserActivity(env, userId, action, details) {
  try {
    await env.DB.prepare(`
      INSERT INTO user_activity_log (user_id, action, details)
      VALUES (?, ?, ?)
    `).bind(userId, action, JSON.stringify(details)).run();
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}

// ============================================
// NEWSLETTER HANDLERS
// ============================================

// Get newsletter subscription status for the current user
async function handleNewsletterStatus(request, env, corsHeaders) {
  try {
    const userResult = await getUserFromRequest(request, env);
    if (userResult.error) {
      return new Response(JSON.stringify({ success: false, error: userResult.error }), {
        status: userResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user = userResult.user;

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        nickname TEXT,
        subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unsubscribed_at DATETIME,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `).run();

    const sub = await env.DB.prepare(`
      SELECT is_active, subscribed_at FROM newsletter_subscribers WHERE user_id = ?
    `).bind(user.user_id).first();

    return new Response(JSON.stringify({
      success: true,
      subscribed: sub ? sub.is_active === 1 : false,
      subscribedAt: sub ? sub.subscribed_at : null,
      email: user.email
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Subscribe the current user to the newsletter
async function handleNewsletterSubscribe(request, env, corsHeaders) {
  try {
    const userResult = await getUserFromRequest(request, env);
    if (userResult.error) {
      return new Response(JSON.stringify({ success: false, error: userResult.error }), {
        status: userResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user = userResult.user;

    if (!user.email) {
      return new Response(JSON.stringify({ success: false, error: 'No email on account' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        nickname TEXT,
        subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unsubscribed_at DATETIME,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `).run();

    // Upsert — if already exists, reactivate
    await env.DB.prepare(`
      INSERT INTO newsletter_subscribers (user_id, email, nickname, is_active, subscribed_at, unsubscribed_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, NULL)
      ON CONFLICT(user_id) DO UPDATE SET is_active = 1, subscribed_at = CURRENT_TIMESTAMP, unsubscribed_at = NULL, email = excluded.email, nickname = excluded.nickname
    `).bind(user.user_id, user.email, user.nickname || null).run();

    // Send welcome email
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getResendApiKey(env)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'JFlix <noreply@jflix.uk>',
          to: user.email,
          subject: 'Welcome to the JFlix Newsletter!',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#13131f;color:#fff;border-radius:16px;">
              <div style="text-align:center;padding:20px 0;">
                <img src="https://jflix.uk/images/icon-512x512.png" alt="JFlix" style="width:60px;height:60px;border-radius:14px;">
                <h1 style="color:#e50914;font-size:24px;margin:16px 0 8px;">Welcome to the JFlix Newsletter!</h1>
              </div>
              <p style="color:#ccc;font-size:15px;line-height:1.6;">Hi ${user.nickname || 'there'},</p>
              <p style="color:#ccc;font-size:15px;line-height:1.6;">You're now subscribed to receive weekly <strong style="color:#FFD700;">"What's New on JFlix"</strong> updates. Every week, we'll send you:</p>
              <ul style="color:#ccc;font-size:14px;line-height:1.8;">
                <li>New movies and TV shows added to JFlix</li>
                <li>Latest anime episodes and K-drama releases</li>
                <li>Trending content and editor's picks</li>
                <li>Exclusive premium offers and voucher codes</li>
              </ul>
              <p style="color:#ccc;font-size:15px;line-height:1.6;">Stay tuned for your first update!</p>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;">
              <p style="color:#666;font-size:12px;">You can unsubscribe anytime from your profile settings at <a href="https://jflix.uk/profile.html" style="color:#e50914;">jflix.uk/profile.html</a></p>
            </div>
          `,
          text: `Welcome to the JFlix Newsletter!\n\nHi ${user.nickname || 'there'},\n\nYou're now subscribed to receive weekly "What's New on JFlix" updates. Every week, we'll send you new content, trending picks, and exclusive offers.\n\nYou can unsubscribe anytime from your profile settings at jflix.uk/profile.html`
        })
      });
    } catch (e) {
      console.error('[Newsletter] Welcome email failed:', e);
    }

    return new Response(JSON.stringify({ success: true, message: 'Subscribed to newsletter' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Unsubscribe the current user from the newsletter
async function handleNewsletterUnsubscribe(request, env, corsHeaders) {
  try {
    const userResult = await getUserFromRequest(request, env);
    if (userResult.error) {
      return new Response(JSON.stringify({ success: false, error: userResult.error }), {
        status: userResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user = userResult.user;

    await env.DB.prepare(`
      UPDATE newsletter_subscribers SET is_active = 0, unsubscribed_at = CURRENT_TIMESTAMP WHERE user_id = ?
    `).bind(user.user_id).run();

    return new Response(JSON.stringify({ success: true, message: 'Unsubscribed from newsletter' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Send a newsletter to all active subscribers (admin)
async function handleSendNewsletter(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { subject, htmlBody, textBody } = body;

    if (!subject || !htmlBody) {
      return new Response(JSON.stringify({ success: false, error: 'Subject and HTML body are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Ensure newsletter_subscribers table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        nickname TEXT,
        subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unsubscribed_at DATETIME,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `).run();

    // Get ALL users with an email address (active accounts only)
    const result = await env.DB.prepare(`
      SELECT u.email, u.nickname, u.user_id
      FROM users u
      WHERE u.email IS NOT NULL
        AND u.email != ''
        AND u.is_active = 1
        AND u.user_id NOT IN (
          SELECT user_id FROM newsletter_subscribers WHERE is_active = 0
        )
      ORDER BY u.created_at DESC
    `).all();

    const subscribers = result.results || [];
    if (subscribers.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No users with email addresses found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    function isValidEmail(email) {
      if (!email || typeof email !== 'string') return false;
      email = email.trim().toLowerCase();
      if (email.length < 5) return false;
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return false;
      const fakeDomains = ['example.com', 'example.org', 'test.com', 'test.org', 'fake.com', 'gmail.con', 'gmai.com', 'gnail.com', 'yahoo.con'];
      const domain = email.split('@')[1];
      if (fakeDomains.includes(domain)) return false;
      return true;
    }

    const validSubscribers = subscribers.filter(s => isValidEmail(s.email));
    const skippedCount = subscribers.length - validSubscribers.length;

    // Create newsletter_campaigns table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS newsletter_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        body_text TEXT,
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `).run();

    // Create newsletter_campaign_recipients table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS newsletter_campaign_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        nickname TEXT,
        status TEXT DEFAULT 'pending',
        sent_at DATETIME,
        FOREIGN KEY (campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE
      )
    `).run();

    // Cancel any existing active campaigns
    await env.DB.prepare(`
      UPDATE newsletter_campaigns SET status = 'cancelled' WHERE status = 'active'
    `).run();

    const defaultText = textBody || `What's New on JFlix\n\n${subject}\n\nVisit jflix.uk to watch now.\n\nYou're receiving this because you have a JFlix account. Unsubscribe at jflix.uk/profile.html`;

    // Create the new campaign
    const campaignResult = await env.DB.prepare(`
      INSERT INTO newsletter_campaigns (subject, body_html, body_text, total_recipients, sent_count, status)
      VALUES (?, ?, ?, ?, 0, 'active')
    `).bind(subject, htmlBody, defaultText, validSubscribers.length).run();

    const campaignId = campaignResult.meta.last_row_id;

    // Insert all recipients as pending
    for (const s of validSubscribers) {
      await env.DB.prepare(`
        INSERT INTO newsletter_campaign_recipients (campaign_id, user_id, email, nickname, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).bind(campaignId, s.user_id, s.email.trim(), s.nickname || null).run();
    }

    // Immediately send the first batch of 10
    const firstBatch = await sendNewsletterBatch(env, campaignId, 20);

    return new Response(JSON.stringify({
      success: true,
      campaignId: campaignId,
      totalRecipients: validSubscribers.length,
      sentNow: firstBatch.sent,
      failedNow: firstBatch.failed,
      skipped: skippedCount,
      message: `Campaign created. ${firstBatch.sent} emails sent now. Remaining will auto-send 10/day.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Scheduled newsletter: send 10 emails per day from active campaign
async function processScheduledNewsletter(env) {
  try {
    const campaign = await env.DB.prepare(`
      SELECT * FROM newsletter_campaigns WHERE status = 'active'
    `).first();

    if (!campaign) {
      console.log('[Newsletter Cron] No active campaign found.');
      return;
    }

    const pendingCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM newsletter_campaign_recipients
      WHERE campaign_id = ? AND status = 'pending'
    `).bind(campaign.id).first();

    if (!pendingCount || pendingCount.count === 0) {
      await env.DB.prepare(`
        UPDATE newsletter_campaigns SET status = 'completed', completed_at = datetime('now')
        WHERE id = ?
      `).bind(campaign.id).run();
      console.log('[Newsletter Cron] Campaign completed:', campaign.id);
      return;
    }

    const result = await sendNewsletterBatch(env, campaign.id, 20);
    console.log(`[Newsletter Cron] Sent ${result.sent} emails, ${result.failed} failed for campaign ${campaign.id}`);

    const remainingCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM newsletter_campaign_recipients
      WHERE campaign_id = ? AND status = 'pending'
    `).bind(campaign.id).first();

    if (!remainingCount || remainingCount.count === 0) {
      await env.DB.prepare(`
        UPDATE newsletter_campaigns SET status = 'completed', completed_at = datetime('now')
        WHERE id = ?
      `).bind(campaign.id).run();
      console.log('[Newsletter Cron] Campaign completed:', campaign.id);
    }
  } catch (error) {
    console.error('[Newsletter Cron] Error:', error);
  }
}

// Send a batch of newsletter emails (up to batchSize) for a campaign
async function sendNewsletterBatch(env, campaignId, batchSize) {
  const batchResult = await env.DB.prepare(`
    SELECT * FROM newsletter_campaign_recipients
    WHERE campaign_id = ? AND status = 'pending'
    LIMIT ?
  `).bind(campaignId, batchSize).all();

  const batch = batchResult.results || [];
  if (batch.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const campaign = await env.DB.prepare(`
    SELECT * FROM newsletter_campaigns WHERE id = ?
  `).bind(campaignId).first();

  if (!campaign) {
    return { sent: 0, failed: 0 };
  }

  const brandedHtml = (nickname) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#13131f;color:#fff;border-radius:16px;">
      <div style="text-align:center;padding:20px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
        <img src="https://jflix.uk/images/icon-512x512.png" alt="JFlix" style="width:50px;height:50px;border-radius:12px;">
        <h1 style="color:#e50914;font-size:22px;margin:12px 0 4px;">What's New on JFlix</h1>
        <p style="color:#888;font-size:12px;">Hi ${nickname || 'there'}, here's your update</p>
      </div>
      <div style="padding:20px 0;">
        ${campaign.body_html}
      </div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0;">
      <p style="color:#666;font-size:12px;text-align:center;">
        You're receiving this because you subscribed to the JFlix Newsletter.<br>
        <a href="https://jflix.uk/profile.html" style="color:#e50914;">Unsubscribe</a> · <a href="https://jflix.uk" style="color:#e50914;">Visit JFlix</a>
      </p>
    </div>
  `;

  const defaultText = campaign.body_text || `What's New on JFlix\n\n${campaign.subject}\n\nVisit jflix.uk to watch now.`;

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of batch) {
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getResendApiKey(env)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'JFlix <noreply@jflix.uk>',
          to: recipient.email,
          subject: campaign.subject,
          html: brandedHtml(recipient.nickname),
          text: defaultText
        })
      });

      if (resendResponse.ok) {
        sentCount++;
        await env.DB.prepare(`
          UPDATE newsletter_campaign_recipients SET status = 'sent', sent_at = datetime('now')
          WHERE id = ?
        `).bind(recipient.id).run();
      } else {
        failedCount++;
        await env.DB.prepare(`
          UPDATE newsletter_campaign_recipients SET status = 'failed'
          WHERE id = ?
        `).bind(recipient.id).run();
      }
    } catch (e) {
      failedCount++;
      await env.DB.prepare(`
        UPDATE newsletter_campaign_recipients SET status = 'failed'
        WHERE id = ?
      `).bind(recipient.id).run();
    }
  }

  // Update campaign counts
  await env.DB.prepare(`
    UPDATE newsletter_campaigns
    SET sent_count = sent_count + ?, failed_count = failed_count + ?
    WHERE id = ?
  `).bind(sentCount, failedCount, campaignId).run();

  // Log the batch
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      body_html TEXT,
      body_text TEXT,
      recipient_count INTEGER DEFAULT 0,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_by TEXT
    )
  `).run();

  await env.DB.prepare(`
    INSERT INTO newsletter_log (subject, body_html, body_text, recipient_count, sent_by)
    VALUES (?, ?, ?, ?, 'cron-batch')
  `).bind(campaign.subject, campaign.body_html, defaultText, sentCount).run();

  return { sent: sentCount, failed: failedCount };
}

// Helper: extract user from request (JWT + session verification)
async function getUserFromRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'No authorization token', status: 401 };
  }
  const token = authHeader.substring(7);
  const payload = verifyJWT(token);
  if (!payload) return { error: 'Invalid token', status: 401 };

  // Verify session is still valid
  const session = await env.DB.prepare(`
    SELECT 1 FROM user_sessions WHERE session_token = ? AND expires_at > datetime('now')
  `).bind(token).first();
  if (!session) return { error: 'Session expired', status: 401 };

  const user = await env.DB.prepare(`
    SELECT * FROM users WHERE user_id = ?
  `).bind(payload.userId).first();
  if (!user) return { error: 'User not found', status: 404 };
  if (!user.is_active) return { error: 'Account inactive', status: 403 };

  return { user };
}

// Handle Vouchers (Redeem voucher)
async function handleVouchers(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  // POST /api/vouchers/redeem - Redeem a voucher
  if (url.pathname === '/api/vouchers/redeem' && method === 'POST') {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json();
      const { code } = body;

      if (!code) {
        return new Response(JSON.stringify({ success: false, error: 'Voucher code required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if voucher exists and is valid
      const voucher = await env.DB.prepare(`
        SELECT * FROM vouchers WHERE code = ? AND is_active = 1
      `).bind(code).first();

      if (!voucher) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid voucher code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if voucher is expired
      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        return new Response(JSON.stringify({ success: false, error: 'Voucher has expired' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if voucher is already used
      if (voucher.used_by) {
        return new Response(JSON.stringify({ success: false, error: 'Voucher has already been used' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate subscription expiry - extend if user already has premium
      let subscriptionExpiresAt = null;
      const now = new Date();
      
      // Get current user subscription
      const currentUser = await env.DB.prepare(`
        SELECT subscription_type, subscription_expires_at FROM users WHERE user_id = ?
      `).bind(payload.userId).first();
      
      const currentExpiry = currentUser?.subscription_expires_at ? new Date(currentUser.subscription_expires_at) : null;
      const isCurrentlyPremium = currentUser?.subscription_type === 'premium' && (!currentExpiry || currentExpiry > now);
      
      // Calculate new expiry date
      let baseDate = isCurrentlyPremium && currentExpiry && currentExpiry > now ? currentExpiry : now;
      
      // Use duration_days from voucher if available, otherwise fallback to type-based defaults
      if (voucher.duration_days) {
        subscriptionExpiresAt = new Date(baseDate.getTime() + voucher.duration_days * 24 * 60 * 60 * 1000);
      } else if (voucher.type === 'premium_month') {
        subscriptionExpiresAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (voucher.type === 'premium_year') {
        subscriptionExpiresAt = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else if (voucher.type === 'lifetime') {
        subscriptionExpiresAt = null; // Never expires
      }

      // Determine premium source
      let premiumSource = voucher.created_by || 'voucher';
      if (voucher.created_by === 'paypal') {
        premiumSource = 'paypal';
      } else if (voucher.created_by === 'admin') {
        premiumSource = 'admin';
      }

      // Update user subscription with premium source tracking
      await env.DB.prepare(`
        UPDATE users 
        SET subscription_type = 'premium', 
            subscription_expires_at = ?,
            voucher_code = ?,
            premium_source = ?,
            is_premium_lifetime = CASE WHEN ? IS NULL THEN 1 ELSE 0 END
        WHERE user_id = ?
      `).bind(subscriptionExpiresAt ? subscriptionExpiresAt.toISOString() : null, code, premiumSource, subscriptionExpiresAt ? subscriptionExpiresAt.toISOString() : null, payload.userId).run();

      // Mark voucher as used
      await env.DB.prepare(`
        UPDATE vouchers 
        SET used_by = ?, used_at = CURRENT_TIMESTAMP
        WHERE code = ?
      `).bind(payload.userId, code).run();

      // Log activity
      await logUserActivity(env, payload.userId, 'voucher_redeemed', { code, type: voucher.type, premiumSource });

      return new Response(JSON.stringify({
        success: true,
        message: 'Voucher redeemed successfully! You now have premium access.',
        subscriptionType: 'premium',
        subscriptionExpiresAt: subscriptionExpiresAt ? subscriptionExpiresAt.toISOString() : null,
        daysAdded: voucher.duration_days || 30,
        premiumSource
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Not Found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ─── PayPal Payment Handler ─────────────────────────────────────────────────
async function handlePayPal(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  const PAYPAL_CLIENT_ID = 'AfHlpJc89KYs0SmujFWihEgS-_V0FgZi7BvrNd9v_1dPPSODxpbqUoF-9vovBGNM0GoCX6Y2NLQq9tHP';
  const PAYPAL_SECRET    = 'EI4KODc8gyicuSBY-YL56oElnxy2fIADtHzXh4z0xeS269C5dEltCbp6FSbjeWOU5BsdlnP7InmOCZPA';
  const PAYPAL_BASE      = 'https://api-m.paypal.com';

  // POST /api/paypal/verify — capture order, generate & redeem voucher
  if (url.pathname === '/api/paypal/verify' && method === 'POST') {
    try {
      // Auth check
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const token = authHeader.replace('Bearer ', '');
      const jwtPayload = verifyJWT(token);
      if (!jwtPayload) return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { orderId, days, planId, amount } = await request.json();
      console.log('[PayPal Verify] Request data:', { orderId, days, planId, amount });
      if (!orderId || !days) return new Response(JSON.stringify({ success: false, error: 'Missing orderId or days' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // 1. Get PayPal access token
      const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) return new Response(JSON.stringify({ success: false, error: 'PayPal auth failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // 2. Capture the order
      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      const captureData = await captureRes.json();

      // Log capture response for debugging
      console.log('[PayPal Capture] Response:', JSON.stringify(captureData));
      console.log('[PayPal Capture] Status:', captureRes.status);

      if (captureData.status !== 'COMPLETED') {
        console.error('[PayPal Capture] Status not COMPLETED:', captureData);
        const errorDetails = {
          status: captureData.status,
          error: captureData.error,
          message: captureData.message,
          details: captureData.details,
          httpStatus: captureRes.status
        };
        return new Response(JSON.stringify({ success: false, error: 'Payment not completed', details: errorDetails }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 3. Generate unique voucher code
      const voucherCode = 'JFLIX-' + orderId.substring(0, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();

      // 4. Insert voucher into DB (not marked as used yet)
      const voucherExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Voucher expires in 30 days
      await env.DB.prepare(`
        INSERT INTO vouchers (code, duration_days, expires_at, created_by, is_active)
        VALUES (?, ?, ?, 'paypal', 1)
      `).bind(voucherCode, days, voucherExpiresAt.toISOString()).run();

      // 5. Log activity
      await logUserActivity(env, jwtPayload.userId, 'paypal_payment', {
        orderId, planId, days, amount, voucherCode
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Payment successful! Your voucher code: ${voucherCode}`,
        voucherCode,
        days,
        voucherExpiresAt: voucherExpiresAt.toISOString()
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Not Found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Messaging Handler ─────────────────────────────────────────────────
async function handleMessages(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // Auth helper - accepts both JWT (users) and simple admin tokens
  const getAuthUser = async () => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');

    // Try JWT first (for regular users)
    const jwtPayload = verifyJWT(token);
    if (jwtPayload) return jwtPayload;

    // Try simple admin token (for admin dashboard)
    // Admin token format: btoa('email:timestamp')
    try {
      const decoded = atob(token);
      const [email, timestamp] = decoded.split(':');
      if (email && timestamp) {
        // Admin token is valid, return a mock user object
        return { userId: 'admin', email: email, isAdmin: true };
      }
    } catch {}

    return null;
  };

  // POST /api/messages/send - Send message to admin
  if (path === '/api/messages/send' && method === 'POST') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { content, image_url } = await request.json();
      if (!content && !image_url) return new Response(JSON.stringify({ success: false, error: 'Message content or image required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Use dedicated admin user_id (completely separate from Google users)
      const ADMIN_USER_ID = 'jflix-admin-system';
      // Ensure admin user exists in DB
      const adminExists = await env.DB.prepare('SELECT user_id FROM users WHERE user_id = ? LIMIT 1').bind(ADMIN_USER_ID).first();
      if (!adminExists) {
        await env.DB.prepare(`INSERT INTO users (nickname, user_id) VALUES (?, ?)`).bind('Admin', ADMIN_USER_ID).run();
      }

      // Insert message
      const result = await env.DB.prepare(`
        INSERT INTO messages (sender_id, receiver_id, content, image_url, reactions, is_read)
        VALUES (?, ?, ?, ?, '[]', 0)
      `).bind(user.userId, ADMIN_USER_ID, content || null, image_url || null).run();

      // Fetch the newly created message with all details
      const newMessage = await env.DB.prepare(`
        SELECT m.*, u.avatar_url as sender_avatar
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.user_id
        WHERE m.id = ?
      `).bind(result.meta.last_row_id).first();

      // Update or create conversation
      const existingConv = await env.DB.prepare(`
        SELECT id FROM conversations WHERE user_id = ? AND admin_id = ?
      `).bind(user.userId, ADMIN_USER_ID).first();

      if (existingConv) {
        await env.DB.prepare(`
          UPDATE conversations SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, unread_count = unread_count + 1 WHERE id = ?
        `).bind(result.meta.last_row_id, existingConv.id).run();
      } else {
        try {
          await env.DB.prepare(`
            INSERT INTO conversations (user_id, admin_id, last_message_id, last_message_at, unread_count)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
          `).bind(user.userId, ADMIN_USER_ID, result.meta.last_row_id).run();
        } catch (insertErr) {
          // If unique constraint violated, update existing row
          await env.DB.prepare(`
            UPDATE conversations SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, unread_count = unread_count + 1
            WHERE user_id = ? AND admin_id = ?
          `).bind(result.meta.last_row_id, user.userId, ADMIN_USER_ID).run();
        }
      }

      return new Response(JSON.stringify({ success: true, message: newMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // GET /api/messages/conversation - Get conversation with admin
  if (path === '/api/messages/conversation' && method === 'GET') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Use dedicated admin user_id (completely separate from Google users)
      const ADMIN_USER_ID = 'jflix-admin-system';

      const messages = await env.DB.prepare(`
        SELECT m.*,
          u_sender.nickname as sender_name, u_sender.avatar_url as sender_avatar,
          u_receiver.nickname as receiver_name, u_receiver.avatar_url as receiver_avatar
        FROM messages m
        LEFT JOIN users u_sender ON m.sender_id = u_sender.user_id
        LEFT JOIN users u_receiver ON m.receiver_id = u_receiver.user_id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
        LIMIT 100
      `).bind(user.userId, ADMIN_USER_ID, ADMIN_USER_ID, user.userId).all();

      return new Response(JSON.stringify({ success: true, messages: messages.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/admin/messages/mark-read/:userId - Mark messages as read (admin)
  if (path.match(/^\/api\/admin\/messages\/mark-read\/[^/]+$/) && method === 'POST') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const targetUserId = path.split('/')[5];
      const ADMIN_USER_ID = 'jflix-admin-system';

      await env.DB.prepare(`
        UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
      `).bind(ADMIN_USER_ID, targetUserId).run();

      // Reset unread count in conversation
      await env.DB.prepare(`
        UPDATE conversations SET unread_count = 0 WHERE user_id = ? AND admin_id = ?
      `).bind(targetUserId, ADMIN_USER_ID).run();

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // GET /api/messages/unread-count - Get user's unread message count
  if (path === '/api/messages/unread-count' && method === 'GET') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const ADMIN_USER_ID = 'jflix-admin-system';

      // Calculate unread count dynamically by counting unread messages from admin
      const unreadResult = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      `).bind(ADMIN_USER_ID, user.userId).first();
      
      const unreadCount = unreadResult ? (unreadResult.count || 0) : 0;

      return new Response(JSON.stringify({ success: true, unreadCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/messages/mark-read - Mark messages as read
  if (path === '/api/messages/mark-read' && method === 'POST') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Use dedicated admin user_id
      const ADMIN_USER_ID = 'jflix-admin-system';

      await env.DB.prepare(`
        UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
      `).bind(user.userId, ADMIN_USER_ID).run();

      // Reset unread count in conversation
      await env.DB.prepare(`
        UPDATE conversations SET unread_count = 0 WHERE user_id = ? AND admin_id = ?
      `).bind(user.userId, ADMIN_USER_ID).run();

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // DELETE /api/messages/:messageId - Delete individual message (user)
  if (path.match(/^\/api\/messages\/[^/]+$/) && method === 'DELETE') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const messageId = path.split('/')[3];

      // Verify the message belongs to the user
      const message = await env.DB.prepare('SELECT sender_id FROM messages WHERE id = ?').bind(messageId).first();
      if (!message) return new Response(JSON.stringify({ success: false, error: 'Message not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (message.sender_id !== user.userId) return new Response(JSON.stringify({ success: false, error: 'You can only delete your own messages' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Delete the message
      await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(messageId).run();

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/messages/react - Add reaction to message
  if (path === '/api/messages/react' && method === 'POST') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { messageId, emoji } = await request.json();
      if (!messageId || !emoji) return new Response(JSON.stringify({ success: false, error: 'Message ID and emoji required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const message = await env.DB.prepare('SELECT reactions FROM messages WHERE id = ?').bind(messageId).first();
      if (!message) return new Response(JSON.stringify({ success: false, error: 'Message not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const reactions = typeof message.reactions === 'string' ? JSON.parse(message.reactions) : message.reactions;
      const existing = reactions.find(r => r.userId === user.userId);
      if (existing) {
        existing.emoji = emoji;
      } else {
        reactions.push({ userId: user.userId, emoji, createdAt: new Date().toISOString() });
      }

      await env.DB.prepare('UPDATE messages SET reactions = ? WHERE id = ?').bind(JSON.stringify(reactions), messageId).run();

      return new Response(JSON.stringify({ success: true, reactions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // GET /api/images/:key - Serve image from R2 with proper CORS
  if (path.match(/^\/api\/images\/[^/]+$/) && method === 'GET') {
    try {
      const key = path.split('/')[3];
      
      if (!env.CHAT_IMAGES) {
        return new Response('R2 not available', { status: 503, headers: { ...corsHeaders } });
      }

      const object = await env.CHAT_IMAGES.get(key);
      if (!object) {
        return new Response('Image not found', { status: 404, headers: { ...corsHeaders } });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'public, max-age=3600');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');

      return new Response(object.body, { headers });
    } catch (error) {
      return new Response('Error loading image', { status: 500, headers: { ...corsHeaders } });
    }
  }

  // POST /api/messages/upload - Upload image to R2 with 24h expiration
  if (path === '/api/messages/upload' && method === 'POST') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // --- Cleanup expired images (lazy cleanup) ---
      try {
        const expired = await env.DB.prepare(`
          SELECT r2_key FROM image_uploads WHERE expires_at < datetime('now')
        `).all();
        if (expired.results && expired.results.length > 0) {
          for (const row of expired.results) {
            try { await env.CHAT_IMAGES.delete(row.r2_key); } catch(e) {}
          }
          await env.DB.prepare(`
            DELETE FROM image_uploads WHERE expires_at < datetime('now')
          `).run();
        }
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }

      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return new Response(JSON.stringify({ success: false, error: 'No file provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Validate file type
      const mimeType = file.type || 'image/jpeg';
      if (!mimeType.startsWith('image/')) {
        return new Response(JSON.stringify({ success: false, error: 'Only image files allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate file size (max 5MB)
      const bytes = await file.arrayBuffer();
      if (bytes.byteLength > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ success: false, error: 'Image too large (max 5MB)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Generate unique key
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10);
      const ext = mimeType.split('/')[1] || 'jpg';
      const r2Key = `chat/${timestamp}-${random}.${ext}`;

      let imageUrl;

      // If R2 is available, upload to R2 bucket
      if (env.CHAT_IMAGES) {
        // Upload to R2
        await env.CHAT_IMAGES.put(r2Key, bytes, {
          httpMetadata: { contentType: mimeType },
          customMetadata: { uploadedBy: user.userId }
        });

        // Track in D1 with 48h expiration (ignore error if table missing)
        try {
          await env.DB.prepare(`
            INSERT INTO image_uploads (r2_key, uploaded_by, content_type, expires_at)
            VALUES (?, ?, ?, datetime('now', '+48 hours'))
          `).bind(r2Key, user.userId, mimeType).run();
        } catch (dbErr) {
          console.error('D1 tracking error (table may not exist):', dbErr.message);
        }

        // Build public URL for R2 - use direct R2 URL
        const r2PublicUrl = env.R2_PUBLIC_URL || '';
        if (r2PublicUrl) {
          imageUrl = `${r2PublicUrl}/${r2Key}`;
          console.log('Direct R2 URL:', imageUrl);
        } else {
          imageUrl = null;
        }
      } else {
        imageUrl = null;
      }

      // Fallback to base64 inline image if R2 not available or no public URL
      if (!imageUrl) {
        const uint8 = new Uint8Array(bytes);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);
        imageUrl = `data:${mimeType};base64,${base64}`;
      }

      return new Response(JSON.stringify({ success: true, imageUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // GET /api/images/:key - Proxy endpoint to serve R2 images with authentication
  if (path.match(/^\/api\/images\/[^/]+$/) && method === 'GET') {
    try {
      const key = path.split('/').pop();
      const object = await env.CHAT_IMAGES.get(key);
      
      if (!object) {
        return new Response('Image not found', { status: 404, headers: corsHeaders });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(object.body, { headers });
    } catch (error) {
      return new Response('Failed to fetch image', { status: 500, headers: corsHeaders });
    }
  }

  // Admin endpoints
  // GET /api/admin/messages - Get all conversations (admin inbox)
  if (path === '/api/admin/messages' && method === 'GET') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const ADMIN_USER_ID = 'jflix-admin-system';

      const conversations = await env.DB.prepare(`
        SELECT c.*, 
          u.nickname, u.email, u.avatar_url,
          m.content as last_message_content, m.image_url as last_message_image, m.created_at as last_message_time,
          (SELECT COUNT(*) FROM messages WHERE sender_id = c.user_id AND receiver_id = ? AND is_read = 0) as unread_count
        FROM conversations c
        LEFT JOIN users u ON c.user_id = u.user_id
        LEFT JOIN messages m ON c.last_message_id = m.id
        ORDER BY c.last_message_at DESC
      `).bind(ADMIN_USER_ID).all();

      return new Response(JSON.stringify({ success: true, conversations: conversations.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // GET /api/admin/messages/:userId - Get conversation with specific user
  if (path.match(/^\/api\/admin\/messages\/[^/]+$/) && method === 'GET') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const targetUserId = path.split('/')[4];

      // Admin uses a dedicated fixed user_id separate from any Google user
      const ADMIN_USER_ID = 'jflix-admin-system';
      // Ensure admin user exists in DB (create silently if not)
      const adminExists = await env.DB.prepare('SELECT user_id FROM users WHERE user_id = ? LIMIT 1').bind(ADMIN_USER_ID).first();
      if (!adminExists) {
        await env.DB.prepare(`INSERT INTO users (nickname, user_id) VALUES (?, ?)`).bind('Admin', ADMIN_USER_ID).run();
      }

      const messages = await env.DB.prepare(`
        SELECT m.*,
          u_sender.nickname as sender_name, u_sender.avatar_url as sender_avatar,
          u_receiver.nickname as receiver_name, u_receiver.avatar_url as receiver_avatar
        FROM messages m
        LEFT JOIN users u_sender ON m.sender_id = u_sender.user_id
        LEFT JOIN users u_receiver ON m.receiver_id = u_receiver.user_id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
        LIMIT 100
      `).bind(ADMIN_USER_ID, targetUserId, targetUserId, ADMIN_USER_ID).all();

      // Mark messages as read
      await env.DB.prepare(`
        UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
      `).bind(ADMIN_USER_ID, targetUserId).run();

      await env.DB.prepare(`
        UPDATE conversations SET unread_count = 0 WHERE user_id = ? AND admin_id = ?
      `).bind(targetUserId, ADMIN_USER_ID).run();

      return new Response(JSON.stringify({ success: true, messages: messages.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/admin/messages/:userId - Admin reply to user
  if (path.match(/^\/api\/admin\/messages\/[^/]+$/) && method === 'POST') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const targetUserId = path.split('/')[4];
      const { content, image_url } = await request.json();
      if (!content && !image_url) return new Response(JSON.stringify({ success: false, error: 'Message content or image required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Admin uses a dedicated fixed user_id separate from any Google user
      const ADMIN_USER_ID = 'jflix-admin-system';
      // Ensure admin user exists in DB (create silently if not)
      const adminExists = await env.DB.prepare('SELECT user_id FROM users WHERE user_id = ? LIMIT 1').bind(ADMIN_USER_ID).first();
      if (!adminExists) {
        await env.DB.prepare(`INSERT INTO users (nickname, user_id) VALUES (?, ?)`).bind('Admin', ADMIN_USER_ID).run();
      }

      const result = await env.DB.prepare(`
        INSERT INTO messages (sender_id, receiver_id, content, image_url, reactions, is_read)
        VALUES (?, ?, ?, ?, '[]', 0)
      `).bind(ADMIN_USER_ID, targetUserId, content || null, image_url || null).run();

      // Fetch the newly created message with all details
      const newMessage = await env.DB.prepare(`
        SELECT m.*, u.avatar_url as sender_avatar
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.user_id
        WHERE m.id = ?
      `).bind(result.meta.last_row_id).first();

      // Update conversation
      const existingConv = await env.DB.prepare(`
        SELECT id FROM conversations WHERE user_id = ? AND admin_id = ?
      `).bind(targetUserId, ADMIN_USER_ID).first();

      if (existingConv) {
        await env.DB.prepare(`
          UPDATE conversations SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(result.meta.last_row_id, existingConv.id).run();
      } else {
        try {
          await env.DB.prepare(`
            INSERT INTO conversations (user_id, admin_id, last_message_id, last_message_at, unread_count)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
          `).bind(targetUserId, ADMIN_USER_ID, result.meta.last_row_id).run();
        } catch (insertErr) {
          // If unique constraint violated, update existing row
          await env.DB.prepare(`
            UPDATE conversations SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND admin_id = ?
          `).bind(result.meta.last_row_id, targetUserId, ADMIN_USER_ID).run();
        }
      }

      return new Response(JSON.stringify({ success: true, message: newMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // DELETE /api/admin/messages/:userId - Delete conversation with specific user
  if (path.match(/^\/api\/admin\/messages\/[^/]+$/) && method === 'DELETE') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const targetUserId = path.split('/')[4];
      const ADMIN_USER_ID = 'jflix-admin-system';

      // Delete messages between user and admin
      await env.DB.prepare(`
        DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      `).bind(targetUserId, ADMIN_USER_ID, ADMIN_USER_ID, targetUserId).run();

      // Delete conversation record
      await env.DB.prepare(`
        DELETE FROM conversations WHERE user_id = ? AND admin_id = ?
      `).bind(targetUserId, ADMIN_USER_ID).run();

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // DELETE /api/admin/messages/message/:messageId - Delete individual message
  if (path.match(/^\/api\/admin\/messages\/message\/[^/]+$/) && method === 'DELETE') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const messageId = path.split('/')[5];

      // Delete the message (this will affect both user and admin since they share the same conversation)
      await env.DB.prepare(`
        DELETE FROM messages WHERE id = ?
      `).bind(messageId).run();

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/admin/messages/:messageId/react - Add reaction to message (admin)
  if (path.match(/^\/api\/admin\/messages\/[^/]+\/react$/) && method === 'POST') {
    try {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const messageId = path.split('/')[4];
      const { emoji } = await request.json();
      if (!emoji) return new Response(JSON.stringify({ success: false, error: 'Emoji required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const ADMIN_USER_ID = 'jflix-admin-system';

      const message = await env.DB.prepare('SELECT reactions FROM messages WHERE id = ?').bind(messageId).first();
      if (!message) return new Response(JSON.stringify({ success: false, error: 'Message not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const reactions = typeof message.reactions === 'string' ? JSON.parse(message.reactions) : message.reactions;
      const existing = reactions.find(r => r.userId === ADMIN_USER_ID);
      if (existing) {
        existing.emoji = emoji;
      } else {
        reactions.push({ userId: ADMIN_USER_ID, emoji, createdAt: new Date().toISOString() });
      }

      await env.DB.prepare('UPDATE messages SET reactions = ? WHERE id = ?').bind(JSON.stringify(reactions), messageId).run();

      return new Response(JSON.stringify({ success: true, reactions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/admin/vouchers/generate - Generate a voucher
  if (path === '/api/admin/vouchers/generate' && method === 'POST') {
    try {
      console.log('POST /api/admin/vouchers/generate called');
      const { type, durationDays } = await request.json();
      console.log('Generate voucher data:', { type, durationDays });
      
      if (!type) {
        return new Response(JSON.stringify({ success: false, error: 'Voucher type required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Generate random voucher code
      const code = 'JFLIX-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      console.log('Generated code:', code);
      
      // Calculate expiry date (default 30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Insert voucher into database
      await env.DB.prepare(`
        INSERT INTO vouchers (code, duration_days, is_active, expires_at, created_by)
        VALUES (?, ?, 1, ?, ?)
      `).bind(code, durationDays || 30, expiresAt.toISOString(), 'admin').run();

      console.log('Voucher inserted into DB');
      return new Response(JSON.stringify({ 
        success: true, 
        code,
        durationDays: durationDays || 30,
        expiresAt: expiresAt.toISOString()
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Error generating voucher:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // POST /api/admin/vouchers/send - Send voucher to user via chat
  if (path === '/api/admin/vouchers/send' && method === 'POST') {
    try {
      const { userId, code, durationDays } = await request.json();
      
      if (!userId || !code) {
        return new Response(JSON.stringify({ success: false, error: 'User ID and voucher code required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const ADMIN_USER_ID = 'jflix-admin-system';

      // Send voucher as a message
      const messageContent = `🎁 You've received a voucher! Code: ${code}. Click the Redeem button to apply ${durationDays || 30} days of premium access.`;
      
      await env.DB.prepare(`
        INSERT INTO messages (sender_id, receiver_id, content, image_url, is_read)
        VALUES (?, ?, ?, NULL, 0)
      `).bind(ADMIN_USER_ID, userId, messageContent).run();

      // Update conversation
      await env.DB.prepare(`
        INSERT INTO conversations (user_id, admin_id, last_message, last_message_time, unread_count)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
        ON CONFLICT(user_id, admin_id) DO UPDATE SET
          last_message = excluded.last_message,
          last_message_time = excluded.last_message_time,
          unread_count = unread_count + 1
      `).bind(userId, ADMIN_USER_ID, messageContent).run();

      return new Response(JSON.stringify({ success: true, message: 'Voucher sent successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Not Found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// JWT Helper Functions
function generateJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (7 * 24 * 60 * 60); // 7 days
  
  const tokenPayload = { ...payload, iat: now, exp };
  
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(tokenPayload)).replace(/=/g, '');
  const signature = btoa(headerB64 + '.' + payloadB64 + JWT_SECRET);
  
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) return null;
    
    // Verify signature
    const expectedSig = btoa(parts[0] + '.' + parts[1] + JWT_SECRET);
    if (parts[2] !== expectedSig) return null;
    
    return payload;
  } catch {
    return null;
  }
}

// ─── Premium Check Helper ─────────────────────────────────────────────────
// Verifies JWT and checks if user has active premium subscription in D1
async function getUserWithPremium(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { error: 'No token', status: 401 };

  const token = authHeader.substring(7);
  const payload = verifyJWT(token);
  if (!payload) return { error: 'Invalid token', status: 401 };

  // Verify session is still valid
  const session = await env.DB.prepare(`
    SELECT 1 FROM user_sessions WHERE session_token = ? AND expires_at > datetime('now')
  `).bind(token).first();
  if (!session) return { error: 'Session expired', status: 401 };

  const user = await env.DB.prepare(`
    SELECT user_id, email, subscription_type, subscription_expires_at, is_active
    FROM users WHERE user_id = ?
  `).bind(payload.userId).first();

  if (!user) return { error: 'User not found', status: 404 };
  if (!user.is_active) return { error: 'Account inactive', status: 403 };

  const now = new Date();
  const expiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
  const isPremium = user.subscription_type === 'premium' && (!expiry || expiry > now);

  return { user, isPremium, expiresAt: user.subscription_expires_at, status: 200 };
}

// Helper: block if not premium (returns Response or null)
async function requirePremium(request, env, corsHeaders) {
  const result = await getUserWithPremium(request, env);
  if (result.error) {
    return new Response(JSON.stringify({ success: false, error: result.error }), {
      status: result.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  if (!result.isPremium) {
    return new Response(JSON.stringify({ success: false, error: 'Premium subscription required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  return null; // all good
}

// Handle file uploads to R2
async function handleUpload(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  // POST /api/upload - Upload file to R2
  if (url.pathname === '/api/upload' && method === 'POST') {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token);
      if (!payload) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check content type
      const contentType = request.headers.get('Content-Type') || '';
      
      // Handle multipart/form-data
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const file = formData.get('file');
        const filename = formData.get('filename') || file?.name || 'upload';
        
        if (!file) {
          return new Response(JSON.stringify({ success: false, error: 'No file provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check file size (Cloudflare Workers limit is 100MB)
        const fileSize = file.size;
        if (fileSize > 100 * 1024 * 1024) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'File too large. Maximum size is 100MB for worker uploads. Please use Cloudflare Dashboard for larger files.' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Upload to R2
        const arrayBuffer = await file.arrayBuffer();
        await env.CHAT_IMAGES.put(filename, arrayBuffer, {
          httpMetadata: {
            contentType: file.type || 'application/octet-stream'
          }
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'File uploaded successfully',
          filename: filename,
          size: fileSize
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Handle raw binary upload
      else {
        const filename = url.searchParams.get('filename') || 'upload';
        const arrayBuffer = await request.arrayBuffer();
        const fileSize = arrayBuffer.byteLength;
        
        // Check file size
        if (fileSize > 100 * 1024 * 1024) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'File too large. Maximum size is 100MB for worker uploads. Please use Cloudflare Dashboard for larger files.' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Upload to R2
        await env.CHAT_IMAGES.put(filename, arrayBuffer, {
          httpMetadata: {
            contentType: request.headers.get('Content-Type') || 'application/octet-stream'
          }
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'File uploaded successfully',
          filename: filename,
          size: fileSize
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    } catch (error) {
      console.error('Upload error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


// ── Single Active Session handlers ───────────────────────────────────────────

// Heartbeat: keeps last_active fresh so the 30-min window is accurate and checks subscription expiry
async function handleHeartbeat(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.substring(7);
    
    // Update session last_active
    await env.DB.prepare(
      `UPDATE user_sessions SET last_active = CURRENT_TIMESTAMP WHERE session_token = ?`
    ).bind(token).run();
    
    // Get user ID from session
    const session = await env.DB.prepare(
      `SELECT user_id FROM user_sessions WHERE session_token = ?`
    ).bind(token).first();
    
    if (!session) {
      return new Response(JSON.stringify({ success: false }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check user subscription status
    const user = await env.DB.prepare(`
      SELECT user_id, subscription_type, subscription_expires_at, is_premium_lifetime
      FROM users WHERE user_id = ?
    `).bind(session.user_id).first();
    
    if (!user) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const now = new Date();
    const subscriptionExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
    const isLifetimePremium = user.is_premium_lifetime === 1;
    
    // Check if subscription has expired
    const isSubscriptionExpired = subscriptionExpiry && subscriptionExpiry < now;
    
    // Determine if user should have premium access
    const hasPremiumAccess = isLifetimePremium || 
                           (user.subscription_type === 'premium' && !isSubscriptionExpired);
    
    let blockAccess = !hasPremiumAccess;
    let needsUpdate = false;
    
    // Auto-downgrade expired subscriptions to free
    if (user.subscription_type === 'premium' && isSubscriptionExpired && !isLifetimePremium) {
      console.log(`[Heartbeat] Auto-downgrading user ${user.user_id} from premium to free (subscription expired)`);
      try {
        await env.DB.prepare(`
          UPDATE users 
          SET subscription_type = 'free',
              subscription_expires_at = NULL
          WHERE user_id = ?
        `).bind(user.user_id).run();
        needsUpdate = true;
      } catch (updateErr) {
        console.error('[Heartbeat] Error downgrading user:', updateErr);
      }
    }
    
    // If we updated the user, re-check their status
    if (needsUpdate) {
      try {
        const updatedUser = await env.DB.prepare(`
          SELECT subscription_type, subscription_expires_at, is_premium_lifetime
          FROM users WHERE user_id = ?
        `).bind(session.user_id).first();
        
        if (updatedUser) {
          const updatedSubscriptionExpiry = updatedUser.subscription_expires_at ? new Date(updatedUser.subscription_expires_at) : null;
          const updatedIsLifetimePremium = updatedUser.is_premium_lifetime === 1;
          
          blockAccess = !(updatedIsLifetimePremium || 
                         (updatedUser.subscription_type === 'premium' && (!updatedSubscriptionExpiry || updatedSubscriptionExpiry > now)));
        }
      } catch (recheckErr) {
        console.error('[Heartbeat] Error rechecking user status:', recheckErr);
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      blockAccess,
      needsUpdate
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[Heartbeat] Error:', err);
    // Return success even on error to avoid breaking the heartbeat
    return new Response(JSON.stringify({ 
      success: true, 
      blockAccess: false,
      needsUpdate: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Send a Supabase magic-link email whose redirect URL carries the force-logout token
async function handleSendForceLogoutEmail(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);
    if (!decoded || !decoded.email || !decoded.userId) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate a one-time force-logout token valid for 15 minutes
    const flToken = generateUUID().replace(/-/g, '') + generateUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await env.DB.prepare(`
      INSERT INTO force_logout_tokens (token, user_id, keep_session_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(flToken, decoded.userId, token, expiresAt).run();

    const redirectTo = `https://jflix.uk/?jflix_force_logout=${flToken}`;

    // Use Supabase Admin API to generate + send a magic-link email with our redirect URL
    const serviceKey = env.SUPABASE_SERVICE_KEY;
    const SUPABASE_URL = 'https://wqxnnplolrudxvaqfias.supabase.co';

    if (!serviceKey) {
      return new Response(JSON.stringify({ success: false, error: 'Email service not configured (SUPABASE_SERVICE_KEY missing)' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const emailRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: decoded.email,
        options: { redirect_to: redirectTo }
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: false, error: err.msg || 'Failed to send email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, email: decoded.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Validate the force-logout token from the email link and wipe all other sessions
async function handleExecuteForceLogout(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { token } = body;
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const record = await env.DB.prepare(`
      SELECT * FROM force_logout_tokens
      WHERE token = ? AND used = 0 AND expires_at > datetime('now')
    `).bind(token).first();

    if (!record) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete all sessions EXCEPT the new device's session
    await env.DB.prepare(`
      DELETE FROM user_sessions
      WHERE user_id = ? AND session_token != ?
    `).bind(record.user_id, record.keep_session_token).run();

    // Mark token as used
    await env.DB.prepare(`UPDATE force_logout_tokens SET used = 1 WHERE token = ?`).bind(token).run();

    await logUserActivity(env, record.user_id, 'force_logout', { token });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Create or update a Supabase account for a Google-authenticated JFlix user
// This enables cross-device login (Electron Google ↔ Android Supabase email/password)
async function handleSetSupabasePassword(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);
    if (!decoded || !decoded.email) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { password } = body;
    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: 'Password must be at least 6 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceKey = env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      return new Response(JSON.stringify({ success: false, error: 'Supabase admin not configured. Please set SUPABASE_SERVICE_KEY secret.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const email = decoded.email.toLowerCase().trim();
    const SUPABASE_URL = 'https://wqxnnplolrudxvaqfias.supabase.co';
    const adminHeaders = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json'
    };

    // Step 1: Try to create a new Supabase user (email_confirm: true skips verification)
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email, password, email_confirm: true })
    });

    if (createRes.ok) {
      return new Response(JSON.stringify({ success: true, action: 'created' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: User already exists — find their Supabase ID and update password
    const createErr = await createRes.json();
    const alreadyExists = createRes.status === 422 ||
      (createErr.msg && createErr.msg.toLowerCase().includes('already')) ||
      createErr.code === 'email_exists';

    if (alreadyExists) {
      // Search for user by email in admin users list
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: adminHeaders
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const users = listData.users || [];
        const found = users.find(u => u.email && u.email.toLowerCase() === email);
        if (found) {
          const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${found.id}`, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ password, email_confirm: true })
          });
          if (updateRes.ok) {
            return new Response(JSON.stringify({ success: true, action: 'updated' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const updateErr = await updateRes.json();
          return new Response(JSON.stringify({ success: false, error: updateErr.msg || 'Failed to update password' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: false, error: createErr.msg || 'Failed to set password' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}


// ============================================================
// INVITATION SYSTEM
// ============================================================
// Tables required (run once via D1 console):
//
// CREATE TABLE IF NOT EXISTS invitation_codes (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   code TEXT NOT NULL UNIQUE,
//   owner_user_id TEXT NOT NULL,
//   owner_email TEXT NOT NULL,
//   owner_name TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
// );
//
// CREATE TABLE IF NOT EXISTS invitation_uses (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   code TEXT NOT NULL,
//   inviter_user_id TEXT NOT NULL,
//   invited_user_id TEXT NOT NULL,
//   invited_email TEXT NOT NULL,
//   inviter_voucher TEXT,
//   invited_voucher TEXT,
//   used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   UNIQUE(invited_user_id)   -- each account can only be invited once
// );
// ============================================================

function generateInviteCode(userId) {
  // Short memorable code: 6 uppercase alphanum chars prefixed with first 2 of userId
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function ensureInvitationTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS invitation_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      owner_user_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      owner_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS invitation_uses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      inviter_user_id TEXT NOT NULL,
      invited_user_id TEXT NOT NULL,
      invited_email TEXT NOT NULL,
      inviter_voucher TEXT,
      invited_voucher TEXT,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(invited_user_id)
    )
  `).run();
}

async function handleInvitations(request, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Helper: auth
  function getPayload(req) {
    const auth = req.headers.get('Authorization');
    if (!auth) return null;
    return verifyJWT(auth.replace('Bearer ', ''));
  }

  // Ensure tables exist on every call (idempotent)
  try { await ensureInvitationTables(env); } catch (_) {}

  // ── GET /api/invitations/my-code  — get or create the caller's invitation code ──
  if (path === '/api/invitations/my-code' && method === 'GET') {
    const payload = getPayload(request);
    if (!payload) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
      // Check if user already has a code
      let existing = await env.DB.prepare(
        'SELECT code FROM invitation_codes WHERE owner_user_id = ?'
      ).bind(payload.userId).first();

      if (!existing) {
        // Generate unique code
        let code, attempts = 0;
        do {
          code = generateInviteCode(payload.userId);
          const conflict = await env.DB.prepare('SELECT id FROM invitation_codes WHERE code = ?').bind(code).first();
          if (!conflict) break;
          attempts++;
        } while (attempts < 10);

        // Get user info
        const user = await env.DB.prepare('SELECT email, nickname FROM users WHERE user_id = ?').bind(payload.userId).first();
        await env.DB.prepare(
          'INSERT INTO invitation_codes (code, owner_user_id, owner_email, owner_name) VALUES (?, ?, ?, ?)'
        ).bind(code, payload.userId, user?.email || '', user?.nickname || '').run();

        existing = { code };
      }

      // Count how many people used this code
      const usageCount = await env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM invitation_uses WHERE code = ?'
      ).bind(existing.code).first();

      return new Response(JSON.stringify({
        success: true,
        code: existing.code,
        timesUsed: usageCount?.cnt || 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // ── POST /api/invitations/apply  — invited user applies a code ──
  if (path === '/api/invitations/apply' && method === 'POST') {
    const payload = getPayload(request);
    if (!payload) return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
      const body = await request.json();
      const code = (body.code || '').trim().toUpperCase();

      if (!code) return new Response(JSON.stringify({ success: false, error: 'Invitation code required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // 1. Check code exists
      const inviteRow = await env.DB.prepare(
        'SELECT * FROM invitation_codes WHERE code = ?'
      ).bind(code).first();
      if (!inviteRow) return new Response(JSON.stringify({ success: false, error: 'Invalid invitation code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // 2. Cannot use your own code
      if (inviteRow.owner_user_id === payload.userId) {
        return new Response(JSON.stringify({ success: false, error: 'You cannot use your own invitation code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 3. Check if this invited user has already been invited by ANYONE
      const alreadyInvited = await env.DB.prepare(
        'SELECT id FROM invitation_uses WHERE invited_user_id = ?'
      ).bind(payload.userId).first();
      if (alreadyInvited) return new Response(JSON.stringify({ success: false, error: 'You have already used an invitation code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // 4. Cannot invite the person who invited you (no vice versa)
      //    i.e. the code owner cannot be someone who was already invited by the current user
      const reverseCheck = await env.DB.prepare(
        'SELECT id FROM invitation_uses WHERE code = (SELECT code FROM invitation_codes WHERE owner_user_id = ?) AND invited_user_id = ?'
      ).bind(payload.userId, inviteRow.owner_user_id).first();
      if (reverseCheck) {
        return new Response(JSON.stringify({ success: false, error: 'This invitation code belongs to someone you already invited — vice versa is not allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 5. Get invited user info
      const invitedUser = await env.DB.prepare('SELECT email, nickname FROM users WHERE user_id = ?').bind(payload.userId).first();

      // 6. Generate two 30-day premium vouchers
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      function mkVoucher(prefix) {
        let s = prefix;
        for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
      }
      const inviterVoucher = mkVoucher('INV-');
      const invitedVoucher = mkVoucher('INV-');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days to redeem

      // 7. Insert vouchers into vouchers table
      await env.DB.prepare(
        `INSERT INTO vouchers (code, duration_days, expires_at, created_by, is_active, type) VALUES (?, 30, ?, 'invitation', 1, 'invitation')`
      ).bind(inviterVoucher, expiresAt.toISOString()).run();

      await env.DB.prepare(
        `INSERT INTO vouchers (code, duration_days, expires_at, created_by, is_active, type) VALUES (?, 30, ?, 'invitation', 1, 'invitation')`
      ).bind(invitedVoucher, expiresAt.toISOString()).run();

      // 8. Record the use
      await env.DB.prepare(
        `INSERT INTO invitation_uses (code, inviter_user_id, invited_user_id, invited_email, inviter_voucher, invited_voucher)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(code, inviteRow.owner_user_id, payload.userId, invitedUser?.email || '', inviterVoucher, invitedVoucher).run();

      // 9. Auto-redeem both vouchers immediately
      const now = new Date();

      async function autoRedeem(userId, voucherCode) {
        const currentUser = await env.DB.prepare('SELECT subscription_type, subscription_expires_at FROM users WHERE user_id = ?').bind(userId).first();
        const currentExpiry = currentUser?.subscription_expires_at ? new Date(currentUser.subscription_expires_at) : null;
        const isCurrentlyPremium = currentUser?.subscription_type === 'premium' && currentExpiry && currentExpiry > now;
        const baseDate = isCurrentlyPremium ? currentExpiry : now;
        const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        await env.DB.prepare(
          `UPDATE users SET subscription_type = 'premium', subscription_expires_at = ?, voucher_code = ?, premium_source = 'invitation', is_premium_lifetime = 0 WHERE user_id = ?`
        ).bind(newExpiry.toISOString(), voucherCode, userId).run();

        await env.DB.prepare(
          `UPDATE vouchers SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?`
        ).bind(userId, voucherCode).run();

        return newExpiry.toISOString();
      }

      const invitedExpiry  = await autoRedeem(payload.userId, invitedVoucher);
      const inviterExpiry  = await autoRedeem(inviteRow.owner_user_id, inviterVoucher);

      // 10. Send notification message to inviter
      const ADMIN_USER_ID = 'jflix-admin-system';
      const invitedName = invitedUser?.nickname || invitedUser?.email || 'Someone';
      const inviterName = inviteRow.owner_name || inviteRow.owner_email || 'you';
      try {
        await env.DB.prepare(
          `INSERT INTO messages (sender_id, receiver_id, content, is_read) VALUES (?, ?, ?, 0)`
        ).bind(
          ADMIN_USER_ID,
          inviteRow.owner_user_id,
          `🎉 ${invitedName} just used your invitation code ${code}! You both received 30 days of JFlix Premium — automatically applied to your account.`
        ).run();
      } catch (_) {}

      return new Response(JSON.stringify({
        success: true,
        message: '🎉 Invitation accepted! 30 days of Premium has been applied to your account.',
        invitedExpiresAt: invitedExpiry,
        inviterName: inviteRow.owner_name || inviteRow.owner_email
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
      console.error('Invitation apply error:', err);
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // ── GET /api/admin/invitations  — admin: list all invitation uses ──
  if (path === '/api/admin/invitations' && method === 'GET') {
    try {
      const rows = await env.DB.prepare(`
        SELECT
          iu.*,
          ic.owner_email,
          ic.owner_name,
          inviter.nickname AS inviter_nickname,
          invited.nickname AS invited_nickname
        FROM invitation_uses iu
        JOIN invitation_codes ic ON iu.code = ic.code
        LEFT JOIN users inviter ON iu.inviter_user_id = inviter.user_id
        LEFT JOIN users invited ON iu.invited_user_id = invited.user_id
        ORDER BY iu.used_at DESC
      `).all();

      return new Response(JSON.stringify({ success: true, invitations: rows.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // ── GET /api/admin/invitations/codes  — admin: list all invitation codes ──
  if (path === '/api/admin/invitations/codes' && method === 'GET') {
    try {
      const rows = await env.DB.prepare(`
        SELECT
          ic.*,
          u.nickname,
          u.subscription_type,
          (SELECT COUNT(*) FROM invitation_uses iu WHERE iu.code = ic.code) as times_used
        FROM invitation_codes ic
        LEFT JOIN users u ON ic.owner_user_id = u.user_id
        ORDER BY ic.created_at DESC
      `).all();

      return new Response(JSON.stringify({ success: true, codes: rows.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Not Found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS HANDLER
// ═══════════════════════════════════════════════════════════════
const VAPID_PUBLIC_KEY = 'BM6-6vPV4aWNBZPr-g7wOqbmugSrktWjDaK1lYUU5PKX0K6cjC797YVRXrpG8FCwXVaY8sGLeto4VkGvrxyZ4AA';
const VAPID_PRIVATE_KEY = 'ST5F_Z6gpAhjES5WR7NBIwb5fbBRf889GAoVMITGWQw';
const VAPID_SUBJECT = 'mailto:noreply@jflix.uk';

async function handlePush(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // GET VAPID public key (for frontend subscription)
  if (path === '/api/push/vapid-key' && method === 'GET') {
    return new Response(JSON.stringify({ success: true, publicKey: VAPID_PUBLIC_KEY }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // POST subscribe to push notifications
  if (path === '/api/push/subscribe' && method === 'POST') {
    try {
      const body = await request.json();
      const { subscription, userId } = body;

      if (!subscription || !subscription.endpoint) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid subscription' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          endpoint TEXT NOT NULL,
          p256dh TEXT,
          auth TEXT,
          subscription_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(endpoint)
        )
      `).run();

      await env.DB.prepare(`
        INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth, subscription_json, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        userId || null,
        subscription.endpoint,
        subscription.keys?.p256dh || null,
        subscription.keys?.auth || null,
        JSON.stringify(subscription)
      ).run();

      return new Response(JSON.stringify({ success: true, message: 'Subscribed to push notifications' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST unsubscribe
  if (path === '/api/push/unsubscribe' && method === 'POST') {
    try {
      const body = await request.json();
      const { endpoint } = body;

      if (!endpoint) {
        return new Response(JSON.stringify({ success: false, error: 'Endpoint required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(endpoint).run();

      return new Response(JSON.stringify({ success: true, message: 'Unsubscribed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // GET push subscription count (admin)
  if (path === '/api/push/count' && method === 'GET') {
    try {
      // Ensure table exists
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          endpoint TEXT NOT NULL,
          p256dh TEXT,
          auth TEXT,
          subscription_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(endpoint)
        )
      `).run();

      const result = await env.DB.prepare(`SELECT COUNT(*) as count FROM push_subscriptions`).first();
      return new Response(JSON.stringify({ success: true, count: result?.count || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST send push notification to all subscribers (admin)
  if (path === '/api/push/send' && method === 'POST') {
    try {
      const body = await request.json();
      const { title, body: notifBody, url: notifUrl, icon } = body;

      if (!title || !notifBody) {
        return new Response(JSON.stringify({ success: false, error: 'Title and body are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Ensure table exists
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          endpoint TEXT NOT NULL,
          p256dh TEXT,
          auth TEXT,
          subscription_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(endpoint)
        )
      `).run();

      const result = await env.DB.prepare(`SELECT * FROM push_subscriptions`).all();
      const subscriptions = result.results || [];

      if (subscriptions.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'No push subscriptions found' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const payload = JSON.stringify({
        title: title,
        body: notifBody,
        icon: icon || '/images/icon-192x192.png',
        badge: '/images/icon-192x192.png',
        url: notifUrl || '/'
      });

      let sentCount = 0;
      let failedCount = 0;

      for (const sub of subscriptions) {
        try {
          const subscription = JSON.parse(sub.subscription_json);
          const pushResult = await sendWebPush(subscription, payload);
          if (pushResult) {
            sentCount++;
          } else {
            failedCount++;
            await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(sub.id).run();
          }
        } catch (e) {
          failedCount++;
          await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(sub.id).run();
        }
      }

      return new Response(JSON.stringify({
        success: true, sent: sentCount, failed: failedCount, total: subscriptions.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST manually trigger new content check (admin)
  if (path === '/api/push/check-new-content' && method === 'POST') {
    try {
      await checkNewContentAndNotify(env);
      return new Response(JSON.stringify({ success: true, message: 'Content check triggered' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // GET notified content history (admin)
  if (path === '/api/push/notified-history' && method === 'GET') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS notified_content (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tmdb_id INTEGER NOT NULL,
          content_type TEXT NOT NULL,
          title TEXT,
          notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tmdb_id, content_type)
        )
      `).run();

      const result = await env.DB.prepare(
        `SELECT * FROM notified_content ORDER BY notified_at DESC LIMIT 50`
      ).all();

      return new Response(JSON.stringify({ success: true, items: result.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Not Found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Simplified Web Push sender (uses fetch to FCM/Mozilla push endpoints)
async function sendWebPush(subscription, payload) {
  try {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Content-Length': new TextEncoder().encode(payload).length.toString()
      },
      body: new TextEncoder().encode(payload)
    });
    return response.ok || response.status === 201;
  } catch (e) {
    console.error('[Push] Send error:', e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// TELEGRAM BOT HANDLER
// ═══════════════════════════════════════════════════════════════
async function handleTelegram(request, env, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // GET Telegram config status (admin)
  if (path === '/api/telegram/status' && method === 'GET') {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS telegram_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          bot_token TEXT,
          channel_id TEXT,
          is_active INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      const row = await env.DB.prepare(`SELECT * FROM telegram_config WHERE id = 1`).first();
      return new Response(JSON.stringify({
        success: true,
        configured: !!(row && row.bot_token && row.channel_id),
        isActive: row?.is_active || 0,
        channelId: row?.channel_id || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST save Telegram config (admin)
  if (path === '/api/telegram/config' && method === 'POST') {
    try {
      const body = await request.json();
      const { botToken, channelId } = body;

      if (!botToken || !channelId) {
        return new Response(JSON.stringify({ success: false, error: 'Bot token and channel ID are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS telegram_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          bot_token TEXT,
          channel_id TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      await env.DB.prepare(`
        INSERT OR REPLACE INTO telegram_config (id, bot_token, channel_id, is_active, created_at)
        VALUES (1, ?, ?, 1, datetime('now'))
      `).bind(botToken, channelId).run();

      return new Response(JSON.stringify({ success: true, message: 'Telegram config saved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST send message to Telegram channel (admin)
  if (path === '/api/telegram/send' && method === 'POST') {
    try {
      const body = await request.json();
      const { message, imageUrl, buttonUrl, buttonText } = body;

      if (!message) {
        return new Response(JSON.stringify({ success: false, error: 'Message is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const config = await env.DB.prepare(`SELECT * FROM telegram_config WHERE id = 1 AND is_active = 1`).first();
      if (!config || !config.bot_token || !config.channel_id) {
        return new Response(JSON.stringify({ success: false, error: 'Telegram not configured' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let telegramResponse;

      if (imageUrl) {
        const keyboard = buttonUrl ? JSON.stringify({
          inline_keyboard: [[{ text: buttonText || 'Watch on JFlix', url: buttonUrl }]]
        }) : undefined;

        const formData = new FormData();
        formData.append('chat_id', config.channel_id);
        formData.append('photo', imageUrl);
        formData.append('caption', message);
        formData.append('parse_mode', 'HTML');
        if (keyboard) formData.append('reply_markup', keyboard);

        telegramResponse = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendPhoto`, {
          method: 'POST',
          body: formData
        });
      } else {
        const keyboard = buttonUrl ? JSON.stringify({
          inline_keyboard: [[{ text: buttonText || 'Watch on JFlix', url: buttonUrl }]]
        }) : undefined;

        const params = new URLSearchParams({
          chat_id: config.channel_id,
          text: message,
          parse_mode: 'HTML'
        });
        if (keyboard) params.append('reply_markup', keyboard);

        telegramResponse = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params
        });
      }

      const data = await telegramResponse.json();

      if (data.ok) {
        return new Response(JSON.stringify({ success: true, messageId: data.result?.message_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ success: false, error: data.description || 'Telegram API error' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST auto-post trending movies to Telegram (admin)
  if (path === '/api/telegram/post-movies' && method === 'POST') {
    try {
      const config = await env.DB.prepare(`SELECT * FROM telegram_config WHERE id = 1 AND is_active = 1`).first();
      if (!config || !config.bot_token || !config.channel_id) {
        return new Response(JSON.stringify({ success: false, error: 'Telegram not configured' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const TMDB_API_KEY = '84549ba3644ea15176802ec153bd9442';
      const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

      const [trendingRes, nowPlayingRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`),
        fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&region=US`)
      ]);

      const trendingData = await trendingRes.json();
      const nowPlayingData = await nowPlayingRes.json();

      const seenIds = new Set();
      const allMovies = [];

      for (const m of (nowPlayingData.results || [])) {
        if (!seenIds.has(m.id) && m.poster_path) { seenIds.add(m.id); allMovies.push(m); }
      }
      for (const m of (trendingData.results || [])) {
        if (!seenIds.has(m.id) && m.poster_path) { seenIds.add(m.id); allMovies.push(m); }
      }

      const movies = allMovies.slice(0, 10);
      let sentCount = 0;
      let failedCount = 0;

      for (const m of movies) {
        try {
          const title = m.title || m.name;
          const rating = m.vote_average ? m.vote_average.toFixed(1) : 'N/A';
          const year = m.release_date ? m.release_date.substring(0, 4) : '';
          const overview = m.overview ? m.overview.substring(0, 200) + '...' : '';
          const posterUrl = `${IMG_BASE}${m.poster_path}`;
          const watchUrl = `https://jflix.uk/player.html?id=${m.id}&type=movie`;

          const caption = `🎬 <b>${title}</b> (${year})\n⭐ Rating: ${rating}/10\n\n${overview}\n\n🎥 Watch free on JFlix!`;

          const keyboard = JSON.stringify({
            inline_keyboard: [[{ text: '▶ Watch Now on JFlix', url: watchUrl }]]
          });

          const formData = new FormData();
          formData.append('chat_id', config.channel_id);
          formData.append('photo', posterUrl);
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
          formData.append('reply_markup', keyboard);

          const tgRes = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendPhoto`, {
            method: 'POST',
            body: formData
          });

          const tgData = await tgRes.json();
          if (tgData.ok) sentCount++;
          else failedCount++;

          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          failedCount++;
        }
      }

      return new Response(JSON.stringify({
        success: true, sent: sentCount, failed: failedCount, total: movies.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Not Found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ═══════════════════════════════════════════════════════════════
// HLS STREAM EXTRACTOR — VidLink.pro
// ═══════════════════════════════════════════════════════════════

const VL_KEY_HEX = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';
const VL_NONCE = new Uint8Array(24);

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

function vlEncryptToken(mediaId, nacl) {
  const ts = Math.floor(Date.now() / 1000) + 480;
  const idBytes = new TextEncoder().encode(mediaId);
  const tsBuf = new Uint8Array(8);
  const dv = new DataView(tsBuf.buffer);
  dv.setUint32(0, Math.floor(ts / 0x100000000));
  dv.setUint32(4, ts >>> 0);
  const msg = new Uint8Array(idBytes.length + 8);
  msg.set(idBytes); msg.set(tsBuf, idBytes.length);
  const key = hexToBytes(VL_KEY_HEX);
  const enc = nacl.secretbox(msg, VL_NONCE, key);
  const payload = new Uint8Array(24 + enc.length);
  payload.set(VL_NONCE); payload.set(enc, 24);
  let bin = ''; for (let i = 0; i < payload.length; i++) bin += String.fromCharCode(payload[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const VL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://vidlink.pro', 'Referer': 'https://vidlink.pro/',
};

async function handleHlsStream(request, url, corsHeaders) {
  const tmdbId = url.searchParams.get('id');
  const type = url.searchParams.get('type') || 'movie';
  const season = url.searchParams.get('season') || '1';
  const episode = url.searchParams.get('episode') || '1';
  if (!tmdbId) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const naclMod = await import('tweetnacl');
    const nacl = naclMod.default || naclMod;
    const token = vlEncryptToken(tmdbId, nacl);
    const apiUrl = type === 'tv'
      ? `https://vidlink.pro/api/b/tv/${token}/${season}/${episode}?multiLang=1`
      : `https://vidlink.pro/api/b/movie/${token}?multiLang=1`;
    const resp = await fetch(apiUrl, { headers: VL_HEADERS });
    if (!resp.ok) return new Response(JSON.stringify({ error: `VidLink ${resp.status}` }), { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const data = await resp.json();
    if (!data) return new Response(JSON.stringify({ error: 'No stream' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const streams = [];
    const q = data?.stream?.qualities || {};
    for (const [qual, info] of Object.entries(q)) {
      if (info.url && info.url.startsWith('http')) {
        streams.push({ url: info.url, type: info.type === 'mp4' ? 'mp4' : 'hls', label: `${qual}p`, quality: qual, requiresProxy: info.requiresProxy || false });
      }
    }
    return new Response(JSON.stringify({ success: true, tmdbId, type, streams }, null, 2), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

const PROXY_ALLOWED = ['bcdn.hakunaymatata.com', 'cacdn.hakunaymatata.com', 'vidlink.pro'];

async function handleStreamProxy(request, url, corsHeaders) {
  const target = url.searchParams.get('url');
  if (!target) return new Response('Missing url', { status: 400 });
  let p; try { p = new URL(target); } catch { return new Response('Invalid URL', { status: 400 }); }
  if (!PROXY_ALLOWED.some(d => p.hostname === d || p.hostname.endsWith('.' + d))) return new Response('Forbidden', { status: 403 });
  const h = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidlink.pro/', 'Origin': 'https://vidlink.pro' };
  if (request.headers.get('Range')) h['Range'] = request.headers.get('Range');
  try {
    const r = await fetch(target, { headers: h });
    const rh = new Headers({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Expose-Headers': 'Content-Length, Content-Range' });
    for (const hh of ['content-type', 'content-length', 'content-range', 'accept-ranges']) { const v = r.headers.get(hh); if (v) rh.set(hh, v); }
    return new Response(r.body, { status: r.status, headers: rh });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
