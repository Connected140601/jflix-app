// Nickname Manager for JFlix
// Handles user nickname creation and storage using localStorage and Cloudflare API

class NicknameManager {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || 'https://jflix-api.junrel-sapantaicloud.workers.dev/api';
    this.googleUser = this.getGoogleUser();
    this.userId = this.getUserId();
    this.nickname = this.getNickname();
  }

  // Get Google user from auth.js login if available
  getGoogleUser() {
    const userData = localStorage.getItem('jflix_user');
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // Check if user is logged in via Google
  isGoogleLoggedIn() {
    return !!this.googleUser && !!localStorage.getItem('jflix_auth_token');
  }

  // Get user ID - from Google account if logged in, otherwise from localStorage
  getUserId() {
    if (this.isGoogleLoggedIn()) {
      return this.googleUser.user_id;
    }
    let userId = localStorage.getItem('jflix_user_id');
    if (!userId) {
      userId = this.generateUUID();
      localStorage.setItem('jflix_user_id', userId);
    }
    return userId;
  }

  // Generate a UUID
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Check if user has a nickname - Google users always have one, others need localStorage
  hasNickname() {
    if (this.isGoogleLoggedIn()) return true;
    return this.nickname !== null;
  }

  // Get current nickname - from Google account if logged in, otherwise from localStorage
  getNickname() {
    if (this.isGoogleLoggedIn()) {
      return this.googleUser.nickname || this.googleUser.name || 'User';
    }
    return localStorage.getItem('jflix_nickname') || null;
  }

  // Set nickname locally (only for non-Google users)
  setNickname(nickname) {
    this.nickname = nickname;
    localStorage.setItem('jflix_nickname', nickname);
  }

  // Refresh Google user state (call after login/logout)
  refresh() {
    this.googleUser = this.getGoogleUser();
    this.userId = this.getUserId();
    this.nickname = this.getNickname();
  }

  // Save nickname to Cloudflare
  async saveNickname(nickname) {
    try {
      const response = await fetch(`${this.apiUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userId,
          nickname: nickname
        })
      });

      const data = await response.json();
      if (data.success) {
        this.setNickname(nickname);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error saving nickname:', error);
      return { success: false, error: error.message };
    }
  }

  // Fetch nickname from Cloudflare
  async fetchNickname() {
    try {
      const response = await fetch(`${this.apiUrl}/users?userId=${this.userId}`);
      const data = await response.json();
      
      if (data.success && data.nickname) {
        this.setNickname(data.nickname);
        return { success: true, nickname: data.nickname };
      } else {
        return { success: false, error: 'Nickname not found' };
      }
    } catch (error) {
      console.error('Error fetching nickname:', error);
      return { success: false, error: error.message };
    }
  }

  // Show nickname modal if user doesn't have one
  showNicknameModal() {
    if (!this.hasNickname()) {
      this.createNicknameModal();
    }
  }

  // Create nickname modal
  createNicknameModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('nickname-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'nickname-modal';
    modal.className = 'nickname-modal-overlay';
    modal.innerHTML = `
      <div class="nickname-modal-content">
        <div class="nickname-modal-header">
          <h3>👋 Welcome to JFlix!</h3>
          <p>Choose a nickname to comment and react to content</p>
          <button class="nickname-modal-close" id="close-nickname-modal">&times;</button>
        </div>
        <div class="nickname-modal-body">
          <input 
            type="text" 
            id="nickname-input" 
            placeholder="Enter your nickname" 
            maxlength="20"
            autocomplete="off"
          />
          <div class="nickname-error" id="nickname-error"></div>
          <button id="save-nickname-btn" class="btn-primary">
            Save Nickname
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add styles
    this.addNicknameStyles();

    // Add event listeners
    const input = document.getElementById('nickname-input');
    const saveBtn = document.getElementById('save-nickname-btn');
    const errorDiv = document.getElementById('nickname-error');
    const closeBtn = document.getElementById('close-nickname-modal');

    // Close button handler
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });

    saveBtn.addEventListener('click', async () => {
      const nickname = input.value.trim();
      
      if (nickname.length < 3) {
        errorDiv.textContent = 'Nickname must be at least 3 characters';
        return;
      }

      if (nickname.length > 20) {
        errorDiv.textContent = 'Nickname must be less than 20 characters';
        return;
      }

      if (nickname.toLowerCase().includes('admin')) {
        errorDiv.textContent = 'Nickname cannot contain "admin"';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const result = await this.saveNickname(nickname);

      if (result.success) {
        modal.remove();
        // Update playerAPI user context immediately so commenting works without reload
        if (window.playerAPI) {
          window.playerAPI.setUserContext(this.getUserId(), this.getNickname());
        }
        // Update nickname display in comment section
        if (typeof updateNicknameDisplay === 'function') {
          updateNicknameDisplay();
        }
      } else {
        errorDiv.textContent = result.error || 'Failed to save nickname';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Nickname';
      }
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });

    // Focus input
    setTimeout(() => input.focus(), 100);
  }

  // Add nickname modal styles
  addNicknameStyles() {
    if (!document.getElementById('nickname-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'nickname-modal-styles';
      style.textContent = `
        .nickname-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        .nickname-modal-content {
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          border-radius: 16px;
          max-width: 400px;
          width: 90%;
          padding: 30px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .nickname-modal-header {
          text-align: center;
          margin-bottom: 25px;
          position: relative;
        }

        .nickname-modal-close {
          position: absolute;
          top: -10px;
          right: 0;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 32px;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .nickname-modal-close:hover {
          color: white;
          transform: rotate(90deg);
        }

        .nickname-modal-header h3 {
          margin: 0 0 10px;
          color: white;
          font-size: 24px;
          font-weight: 600;
        }

        .nickname-modal-header p {
          margin: 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .nickname-modal-body {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        #nickname-input {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 15px;
          color: white;
          font-size: 16px;
          outline: none;
          transition: all 0.3s ease;
        }

        #nickname-input:focus {
          border-color: #e50914;
          box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.2);
        }

        #nickname-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .nickname-error {
          color: #ff4747;
          font-size: 14px;
          min-height: 20px;
          text-align: center;
        }

        .btn-primary {
          background: linear-gradient(135deg, #e50914 0%, #ff0a16 100%);
          border: none;
          border-radius: 8px;
          padding: 15px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(229, 9, 20, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (max-width: 600px) {
          .nickname-modal-content {
            padding: 20px;
          }

          .nickname-modal-header h3 {
            font-size: 20px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// Initialize nickname manager
const nicknameManager = new NicknameManager();

// Make it globally available
window.nicknameManager = nicknameManager;
