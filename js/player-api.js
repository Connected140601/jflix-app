// JFlix Player API v9.0 - Modern Design
// Integration for comments, reactions, and view counts for the player page

class PlayerAPI {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || 'https://jflix-api.junrel-sapantaicloud.workers.dev/api';
    this.mediaType = null;
    this.mediaId = null;
    this.seasonNumber = null;
    this.episodeNumber = null;
    this.userId = null;
    this.nickname = null;
  }

  // Set current media context
  setMediaContext(mediaType, mediaId, seasonNumber = null, episodeNumber = null) {
    this.mediaType = mediaType;
    this.mediaId = mediaId;
    this.seasonNumber = seasonNumber;
    this.episodeNumber = episodeNumber;
  }

  // Set user context
  setUserContext(userId, nickname) {
    this.userId = userId;
    this.nickname = nickname;
  }

  // Get view count
  async getViewCount() {
    try {
      let url = `${this.apiUrl}/views?mediaType=${this.mediaType}&mediaId=${this.mediaId}&aggregate=true`;
      if (this.seasonNumber !== null) url += `&seasonNumber=${this.seasonNumber}`;
      if (this.episodeNumber !== null) url += `&episodeNumber=${this.episodeNumber}`;

      console.log('Fetching view count from:', url);
      const response = await fetch(url);
      console.log('View count response status:', response.status);
      const data = await response.json();
      console.log('View count response data:', data);
      return data.success ? data.viewCount : 0;
    } catch (error) {
      console.error('Error fetching view count:', error);
      return 0;
    }
  }

  // Increment view count
  async incrementViewCount() {
    try {
      const body = {
        mediaType: this.mediaType,
        mediaId: this.mediaId,
        seasonNumber: this.seasonNumber,
        episodeNumber: this.episodeNumber
      };
      console.log('Incrementing view count with body:', body);
      const response = await fetch(`${this.apiUrl}/views`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
      console.log('Increment response status:', response.status);
      const data = await response.json();
      console.log('Increment response data:', data);
      return data.success;
    } catch (error) {
      console.error('Error incrementing view count:', error);
      return false;
    }
  }

  // Get reactions
  async getReactions() {
    try {
      let url = `${this.apiUrl}/reactions?mediaType=${this.mediaType}&mediaId=${this.mediaId}`;
      if (this.seasonNumber !== null) url += `&seasonNumber=${this.seasonNumber}`;
      if (this.episodeNumber !== null) url += `&episodeNumber=${this.episodeNumber}`;
      if (this.userId) url += `&userId=${this.userId}`;

      const response = await fetch(url);
      const data = await response.json();
      return data.success ? data : { reactionCounts: [], userReactions: [] };
    } catch (error) {
      console.error('Error fetching reactions:', error);
      return { reactionCounts: [], userReactions: [] };
    }
  }

  // Toggle reaction
  async toggleReaction(reactionType) {
    if (!this.userId || !this.nickname) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const response = await fetch(`${this.apiUrl}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaType: this.mediaType,
          mediaId: this.mediaId,
          seasonNumber: this.seasonNumber,
          episodeNumber: this.episodeNumber,
          userId: this.userId,
          reactionType: reactionType
        })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error toggling reaction:', error);
      return { success: false, error: error.message };
    }
  }

  // Get comments
  async getComments(limit = 50) {
    try {
      let url = `${this.apiUrl}/comments?mediaType=${this.mediaType}&mediaId=${this.mediaId}&limit=${limit}`;
      if (this.seasonNumber !== null) url += `&seasonNumber=${this.seasonNumber}`;
      if (this.episodeNumber !== null) url += `&episodeNumber=${this.episodeNumber}`;

      const response = await fetch(url);
      const data = await response.json();
      return data.success ? data.comments : [];
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  // Post comment (supports optional parentCommentId for replies)
  async postComment(commentText, parentCommentId = null) {
    if (!this.userId || !this.nickname) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!commentText || commentText.trim().length === 0) {
      return { success: false, error: 'Comment cannot be empty' };
    }

    if (commentText.length > 500) {
      return { success: false, error: 'Comment too long (max 500 characters)' };
    }

    try {
      const body = {
        mediaType: this.mediaType,
        mediaId: this.mediaId,
        seasonNumber: this.seasonNumber,
        episodeNumber: this.episodeNumber,
        userId: this.userId,
        nickname: this.nickname,
        commentText: commentText.trim()
      };
      if (parentCommentId) {
        body.parentCommentId = parentCommentId;
      }
      const response = await fetch(`${this.apiUrl}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error posting comment:', error);
      return { success: false, error: error.message };
    }
  }

  // Toggle emoji reaction on a comment
  async toggleCommentReaction(commentId, emoji) {
    if (!this.userId || !this.nickname) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const response = await fetch(`${this.apiUrl}/comment-reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId: commentId,
          userId: this.userId,
          emoji: emoji
        })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error toggling comment reaction:', error);
      return { success: false, error: error.message };
    }
  }

  // Get emoji reactions for comments
  async getCommentReactions(commentIds) {
    if (!commentIds || commentIds.length === 0) return {};
    try {
      const response = await fetch(`${this.apiUrl}/comment-reactions?commentIds=${commentIds.join(',')}&userId=${this.userId || ''}`);
      const data = await response.json();
      return data.success ? data.reactions : {};
    } catch (error) {
      console.error('Error fetching comment reactions:', error);
      return {};
    }
  }

  // Delete comment
  async deleteComment(commentId) {
    if (!this.userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const response = await fetch(`${this.apiUrl}/comments?id=${commentId}&userId=${this.userId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting comment:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize PlayerAPI when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Wait for nickname manager to be available
  const checkNicknameManager = setInterval(() => {
    if (window.nicknameManager) {
      clearInterval(checkNicknameManager);
      initializePlayerFeatures();
    }
  }, 100);

  // Timeout after 5 seconds
  setTimeout(() => clearInterval(checkNicknameManager), 5000);
});

// Initialize player features
function initializePlayerFeatures() {
  const playerAPI = new PlayerAPI();
  window.playerAPI = playerAPI;

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const mediaType = urlParams.get('type') || 'movie';
  const mediaId = urlParams.get('id');
  const seasonNumber = urlParams.get('season');
  const episodeNumber = urlParams.get('episode');

  if (mediaId) {
    playerAPI.setMediaContext(mediaType, mediaId, seasonNumber, episodeNumber);
    playerAPI.setUserContext(nicknameManager.getUserId(), nicknameManager.getNickname());

    // Update nickname display if user has one
    if (nicknameManager.hasNickname()) {
      updateNicknameDisplay();
    }

    // Load features
    loadViewCount();
    loadReactions();
    loadComments();
    incrementViewCount();
  }

  // Event listeners
  setupEventListeners();
}

// Update nickname display
function updateNicknameDisplay() {
  const nicknameDisplay = document.getElementById('current-nickname');
  if (nicknameDisplay && nicknameManager.hasNickname()) {
    nicknameDisplay.textContent = nicknameManager.getNickname();
  }
}

// Load view count
async function loadViewCount() {
  const viewCountElement = document.getElementById('view-count');
  if (!viewCountElement) return;

  try {
    const count = await window.playerAPI.getViewCount();
    console.log('View count loaded:', count);
    if (count !== null && count !== undefined) {
      viewCountElement.textContent = formatNumber(count);
    } else {
      viewCountElement.textContent = '0';
    }
  } catch (error) {
    console.error('Error loading view count:', error.message || error);
    viewCountElement.textContent = '0';
  }
}

// Increment view count
async function incrementViewCount() {
  try {
    console.log('Incrementing view count...');
    const result = await window.playerAPI.incrementViewCount();
    console.log('View count increment result:', result);
    // JFlix Homepage v9.0 - Modern Design - view count after incrementing to show updated value
    await loadViewCount();
  } catch (error) {
    console.error('Error incrementing view count:', error);
  }
}

// Load reactions
async function loadReactions() {
  const data = await window.playerAPI.getReactions();
  
  // Update reaction counts
  const reactionCounts = {};
  data.reactionCounts.forEach(rc => {
    reactionCounts[rc.reaction_type] = rc.count;
  });

  // Update UI
  document.querySelectorAll('.reaction-count').forEach(el => {
    const type = el.dataset.type;
    el.textContent = reactionCounts[type] || 0;
  });

  // Highlight user's reactions
  data.userReactions.forEach(reaction => {
    const btn = document.querySelector(`.reaction-btn[data-reaction="${reaction}"]`);
    if (btn) {
      btn.classList.add('active');
    }
  });
}

// Load comments
async function loadComments() {
  const comments = await window.playerAPI.getComments();
  renderComments(comments);
}

// Emoji options for comment reactions
const COMMENT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// Track reply state
let replyState = { commentId: null, nickname: null };

// Render comments
function renderComments(comments) {
  const commentsList = document.getElementById('comments-list');
  const noComments = document.getElementById('no-comments');
  const commentCount = document.getElementById('comment-count');

  if (!commentsList) return;

  if (comments.length === 0) {
    if (noComments) noComments.style.display = 'block';
    if (commentCount) commentCount.textContent = '(0)';
    return;
  }

  if (noComments) noComments.style.display = 'none';
  if (commentCount) commentCount.textContent = `(${comments.length})`;

  commentsList.innerHTML = comments.map(comment => `
    <div class="comment-item" data-comment-id="${comment.id}" style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #e50914 0%, #ff0a16 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; font-size: 16px;">
          ${comment.nickname.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight: 600; color: #fff; font-size: 14px;">${escapeHtml(comment.nickname)}</div>
          <div style="color: #a0a0a0; font-size: 12px;">${formatRelativeDate(comment.created_at)}</div>
        </div>
        ${comment.user_id === nicknameManager.getUserId() ? `
          <button class="delete-comment-btn" data-comment-id="${comment.id}" style="margin-left: auto; background: none; border: none; color: #ff4747; cursor: pointer; font-size: 12px;">
            Delete
          </button>
        ` : ''}
      </div>
      <div style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">${escapeHtml(comment.comment_text)}</div>
      <!-- Action buttons: Reply + Emoji reactions -->
      <div class="comment-actions-row" style="display: flex; align-items: center; gap: 6px; margin-top: 10px; flex-wrap: wrap;">
        <button class="reply-btn" data-comment-id="${comment.id}" data-nickname="${escapeHtml(comment.nickname)}" style="background: none; border: 1px solid rgba(255,255,255,0.2); border-radius: 15px; padding: 4px 12px; color: #4a90e2; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: all 0.2s;">
          <i class="fas fa-reply" style="font-size: 10px;"></i> Reply
        </button>
        <div class="comment-emoji-bar" data-comment-id="${comment.id}" style="display: flex; gap: 2px; margin-left: 4px;">
          ${COMMENT_EMOJIS.map(emoji => `
            <button class="comment-emoji-btn" data-comment-id="${comment.id}" data-emoji="${emoji}" style="background: none; border: 1px solid transparent; border-radius: 12px; padding: 2px 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; line-height: 1;" title="React with ${emoji}">
              ${emoji}<span class="emoji-count" style="font-size: 10px; color: #888; margin-left: 2px;">0</span>
            </button>
          `).join('')}
        </div>
      </div>
      ${comment.replies && comment.replies.length > 0 ? `
        <div class="replies-container" style="margin-top: 15px; padding-left: 20px; border-left: 3px solid #e50914;">
          ${comment.replies.map(reply => renderReply(reply, comment.id)).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Add shimmer animation for admin nickname
  if (!document.getElementById('admin-shimmer-styles')) {
    const style = document.createElement('style');
    style.id = 'admin-shimmer-styles';
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
      .reply-btn:hover { border-color: #4a90e2 !important; background: rgba(74,144,226,0.1) !important; }
      .comment-emoji-btn:hover { border-color: rgba(255,255,255,0.3) !important; background: rgba(255,255,255,0.05) !important; transform: scale(1.15); }
      .comment-emoji-btn.active-emoji { border-color: #e50914 !important; background: rgba(229,9,20,0.15) !important; }
      .reply-emoji-btn:hover { border-color: rgba(255,255,255,0.3) !important; background: rgba(255,255,255,0.05) !important; transform: scale(1.15); }
      .reply-emoji-btn.active-emoji { border-color: #e50914 !important; background: rgba(229,9,20,0.15) !important; }
      .reply-reply-btn:hover { border-color: #4a90e2 !important; background: rgba(74,144,226,0.1) !important; }
    `;
    document.head.appendChild(style);
  }

  // Add delete button listeners
  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const commentId = this.dataset.commentId;
      if (confirm('Are you sure you want to delete this comment?')) {
        const result = await window.playerAPI.deleteComment(commentId);
        if (result.success) {
          loadComments();
        } else {
          alert('Failed to delete comment: ' + result.error);
        }
      }
    });
  });

  // Add reply button listeners
  document.querySelectorAll('.reply-btn, .reply-reply-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (!nicknameManager.hasNickname()) {
        nicknameManager.showNicknameModal();
        return;
      }
      const nickname = this.dataset.nickname;
      const commentId = this.dataset.commentId;
      replyState = { commentId: commentId, nickname: nickname };
      const commentInput = document.getElementById('comment-input');
      if (commentInput) {
        commentInput.value = `@${nickname} `;
        commentInput.focus();
        commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  // Add emoji reaction listeners on comments
  document.querySelectorAll('.comment-emoji-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      if (!nicknameManager.hasNickname()) {
        nicknameManager.showNicknameModal();
        return;
      }
      const commentId = this.dataset.commentId;
      const emoji = this.dataset.emoji;
      const result = await window.playerAPI.toggleCommentReaction(commentId, emoji);
      if (result.success) {
        if (result.action === 'added') {
          this.classList.add('active-emoji');
        } else {
          this.classList.remove('active-emoji');
        }
        loadComments();
      }
    });
  });

  // Add emoji reaction listeners on replies
  document.querySelectorAll('.reply-emoji-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      if (!nicknameManager.hasNickname()) {
        nicknameManager.showNicknameModal();
        return;
      }
      const replyId = this.dataset.replyId;
      const emoji = this.dataset.emoji;
      // Use reply ID as comment ID for reaction
      const result = await window.playerAPI.toggleCommentReaction(replyId, emoji);
      if (result.success) {
        if (result.action === 'added') {
          this.classList.add('active-emoji');
        } else {
          this.classList.remove('active-emoji');
        }
        loadComments();
      }
    });
  });

  // Load emoji reaction counts from API
  loadCommentEmojiReactions(comments);
}

// Render a single reply (recursive-friendly)
function renderReply(reply, parentCommentId) {
  const replyNickname = reply.is_admin_reply ? 'Admin' : (reply.nickname || 'Reply');
  const initial = reply.is_admin_reply ? 'A' : (replyNickname.charAt(0).toUpperCase());
  const avatarBg = reply.is_admin_reply
    ? 'background: linear-gradient(135deg, #ffd700 0%, #ffed4a 100%);'
    : 'background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);';
  const nameStyle = reply.is_admin_reply
    ? 'background: linear-gradient(90deg, #ffd700, #ffed4a, #ffd700); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: shimmer 2s linear infinite; font-weight: 700; font-size: 13px;'
    : 'font-weight: 600; color: #4a90e2; font-size: 12px;';

  return `
    <div class="reply-item" data-reply-id="${reply.id || ''}" style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 10px; margin-bottom: 10px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
        <div style="width: 30px; height: 30px; ${avatarBg} border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: ${reply.is_admin_reply ? '#000' : 'white'}; font-size: 12px;">
          ${initial}
        </div>
        <div>
          <div style="${nameStyle}">${reply.is_admin_reply ? '⭐ Admin ⭐' : escapeHtml(replyNickname)}</div>
          <div style="color: #888; font-size: 11px;">${formatRelativeDate(reply.created_at)}</div>
        </div>
      </div>
      <div style="color: #ccc; font-size: 13px; line-height: 1.5;">${escapeHtml(reply.reply_text || reply.comment_text || '')}</div>
      <!-- Reply action buttons -->
      <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
        <button class="reply-reply-btn" data-comment-id="${parentCommentId}" data-nickname="${escapeHtml(replyNickname)}" style="background: none; border: 1px solid rgba(255,255,255,0.2); border-radius: 15px; padding: 3px 10px; color: #4a90e2; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 4px; transition: all 0.2s;">
          <i class="fas fa-reply" style="font-size: 9px;"></i> Reply
        </button>
        <div class="reply-emoji-bar" style="display: flex; gap: 2px;">
          ${COMMENT_EMOJIS.map(emoji => `
            <button class="reply-emoji-btn" data-reply-id="${reply.id || ''}" data-emoji="${emoji}" style="background: none; border: 1px solid transparent; border-radius: 10px; padding: 1px 5px; cursor: pointer; font-size: 12px; transition: all 0.2s; line-height: 1;" title="React with ${emoji}">
              ${emoji}<span class="emoji-count" style="font-size: 9px; color: #888; margin-left: 1px;">0</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Load emoji reaction counts for comments
async function loadCommentEmojiReactions(comments) {
  if (!comments || comments.length === 0) return;
  const commentIds = comments.map(c => c.id).filter(Boolean);
  if (commentIds.length === 0) return;

  try {
    const reactions = await window.playerAPI.getCommentReactions(commentIds);
    // reactions format: { commentId: { emoji: count, ... }, ... }
    if (!reactions || Object.keys(reactions).length === 0) return;

    // Update emoji counts in the DOM
    for (const [commentId, emojiMap] of Object.entries(reactions)) {
      const emojiBar = document.querySelector(`.comment-emoji-bar[data-comment-id="${commentId}"]`);
      if (emojiBar) {
        for (const [emoji, count] of Object.entries(emojiMap)) {
          if (typeof count === 'object' && count.count !== undefined) {
            const btn = emojiBar.querySelector(`.comment-emoji-btn[data-emoji="${emoji}"]`);
            if (btn) {
              const countSpan = btn.querySelector('.emoji-count');
              if (countSpan) countSpan.textContent = count.count > 0 ? count.count : '';
              if (count.userReacted) btn.classList.add('active-emoji');
            }
          } else if (typeof count === 'number') {
            const btn = emojiBar.querySelector(`.comment-emoji-btn[data-emoji="${emoji}"]`);
            if (btn) {
              const countSpan = btn.querySelector('.emoji-count');
              if (countSpan) countSpan.textContent = count > 0 ? count : '';
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('Comment emoji reactions not available from API yet');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Reaction buttons
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      if (!nicknameManager.hasNickname()) {
        nicknameManager.showNicknameModal();
        return;
      }

      const reactionType = this.dataset.reaction;
      const result = await window.playerAPI.toggleReaction(reactionType);

      if (result.success) {
        // Remove active class from all reaction buttons first
        document.querySelectorAll('.reaction-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to the clicked button if action was added
        if (result.action === 'added') {
          this.classList.add('active');
        }
        
        loadReactions();
      }
    });
  });

  // Submit comment
  const submitCommentBtn = document.getElementById('submit-comment');
  if (submitCommentBtn) {
    submitCommentBtn.addEventListener('click', async function() {
      if (!nicknameManager.hasNickname()) {
        nicknameManager.showNicknameModal();
        return;
      }

      const commentInput = document.getElementById('comment-input');
      const commentText = commentInput.value;

      this.disabled = true;
      this.textContent = 'Posting...';

      // Check if this is a reply
      const parentCommentId = replyState.commentId || null;
      const result = await window.playerAPI.postComment(commentText, parentCommentId);

      if (result.success) {
        commentInput.value = '';
        replyState = { commentId: null, nickname: null };
        loadComments();
      } else {
        alert('Failed to post comment: ' + result.error);
      }

      this.disabled = false;
      this.textContent = 'Post Comment';
    });
  }

  // Change nickname button
  const changeNicknameBtn = document.getElementById('change-nickname');
  if (changeNicknameBtn) {
    changeNicknameBtn.addEventListener('click', function() {
      nicknameManager.createNicknameModal();
    });
  }
}

// Format number with K, M, B suffixes
function formatNumber(num) {
  if (num === null || num === undefined) {
    return '0';
  }
  if (typeof num !== 'number') {
    return '0';
  }
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Parse a UTC timestamp from SQLite correctly (handles missing Z suffix)
function parseTimestamp(str) {
  if (!str) return new Date();
  if (typeof str === 'string' && !str.endsWith('Z') && !/[+\-]\d{2}:?\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  return new Date(str);
}

// Format relative date — always in the user's local timezone.
// Named formatRelativeDate (not formatDate) to avoid clobbering the
// absolute date formatter used by player.js for release/first-air dates.
function formatRelativeDate(dateString) {
  const date = parseTimestamp(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
