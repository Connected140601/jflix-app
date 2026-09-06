/**
 * Smart Link Handler for JFlix
 * Detects in-app browsers (Messenger, Facebook) and provides better user experience
 */

class SmartLinkHandler {
    constructor() {
        // Silently skip for JFlix Android native app
        const IS_ANDROID_NATIVE = /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(navigator.userAgent) ||
                                /JFlix-Android/i.test(navigator.userAgent);
        if (IS_ANDROID_NATIVE) {
            console.log('[Smart Link Handler] JFlix Android app detected — modal disabled');
            return;
        }

        this.isInAppBrowser = this.detectInAppBrowser();
        this.isMobile = this.detectMobile();
        this.osType = this.detectOS();
        this.pwaInstalled = this.isPWAInstalled();
        
        this.init();
    }

    detectInAppBrowser() {
        const userAgent = navigator.userAgent.toLowerCase();
        const inAppBrowsers = [
            'fb_iab',           // Facebook In-App Browser
            'messenger',        // Messenger
            'instagram',        // Instagram
            'whatsapp',         // WhatsApp
            'line',            // Line
            'telegram',        // Telegram
            'weibo',           // Weibo
            'twitter',         // Twitter
            'snapchat',        // Snapchat
            'vkapp',           // VK App
            'fban',            // Facebook App
            'fbav',            // Facebook App Variant
            'opera mini',      // Opera Mini (often used in apps)
            'ucbrowser'        // UC Browser (often used in apps)
        ];

        return inAppBrowsers.some(browser => userAgent.includes(browser));
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    detectOS() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')) {
            return 'ios';
        } else if (userAgent.includes('android')) {
            return 'android';
        }
        
        return 'desktop';
    }

    isPWAInstalled() {
        // Check if running in standalone mode (PWA)
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone === true ||
               document.referrer.includes('android-app://');
    }

    init() {
        // Only proceed if we're in an in-app browser on mobile
        if (this.isInAppBrowser && this.isMobile) {
            this.createModal();
            this.setupEventListeners();
            this.showModal();
        }
    }

    createModal() {
        // Create modal HTML
        const modalHTML = `
            <div id="smart-link-modal" class="smart-link-modal">
                <div class="smart-link-content">
                    <div class="smart-link-header">
                        <div class="smart-link-icon">
                            <i class="fas fa-external-link-alt"></i>
                        </div>
                        <h2>Open in Better Browser</h2>
                        <p>This app works best in Chrome, Safari, or our standalone app</p>
                    </div>
                    
                    <div class="smart-link-instructions">
                        <div class="instruction-step">
                            <div class="step-number">1</div>
                            <div class="step-text">
                                <strong>Copy the link below</strong>
                                <p>Tap the copy button to save the URL</p>
                            </div>
                        </div>
                        
                        <div class="instruction-step">
                            <div class="step-number">2</div>
                            <div class="step-text">
                                <strong>Open ${this.getRecommendedBrowser()}</strong>
                                <p>Launch Chrome, Safari, or your preferred browser</p>
                            </div>
                        </div>
                        
                        <div class="instruction-step">
                            <div class="step-number">3</div>
                            <div class="step-text">
                                <strong>Paste and visit</strong>
                                <p>Paste the link in the address bar</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="link-display">
                        <input type="text" id="link-to-copy" readonly value="${window.location.href}">
                        <button id="copy-link-btn" class="copy-btn">
                            <i class="fas fa-copy"></i>
                            <span>Copy Link</span>
                        </button>
                    </div>
                    
                    <div class="smart-link-actions">
                        ${this.pwaInstalled ? this.createOpenAppButton() : ''}
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    getRecommendedBrowser() {
        if (this.osType === 'ios') {
            return 'Safari';
        } else if (this.osType === 'android') {
            return 'Chrome';
        }
        return 'Chrome or Safari';
    }

    createOpenAppButton() {
        return `
            <button id="open-app-btn" class="open-app-btn">
                <i class="fas fa-rocket"></i>
                <span>Open in App</span>
            </button>
        `;
    }

    setupEventListeners() {
        const modal = document.getElementById('smart-link-modal');
        const copyBtn = document.getElementById('copy-link-btn');
        const openAppBtn = document.getElementById('open-app-btn');

        // Copy link functionality
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.preventDefault();
                this.copyLinkClean();
            };
        }

        // Open app functionality
        if (openAppBtn) {
            openAppBtn.onclick = (e) => {
                e.preventDefault();
                this.openPWA();
            };
        }
    }

    copyLinkClean() {
        const linkInput = document.getElementById('link-to-copy');
        const copyBtn = document.getElementById('copy-link-btn');
        
        if (!linkInput || !copyBtn) return;

        const url = linkInput.value;

        // Method 1: Modern clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                this.showCopySuccess(copyBtn);
            }).catch(() => {
                this.fallbackCopy(url, copyBtn);
            });
        } else {
            this.fallbackCopy(url, copyBtn);
        }
    }

    fallbackCopy(text, copyBtn) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(textarea);
        
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showCopySuccess(copyBtn);
            }
        } catch (err) {}
        
        document.body.removeChild(textarea);
    }

    showCopySuccess(copyBtn) {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i><span>Copied! Open your browser</span>';
        copyBtn.style.background = '#28a745';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.background = '';
        }, 3000);
    }

    openPWA() {
        // Try to open the PWA
        const currentUrl = window.location.href;
        
        // Create a custom scheme URL for PWA if possible
        if (this.osType === 'android') {
            // Android PWA
            window.location.href = `intent:${currentUrl}#Intent;scheme=https;package=com.jflix.app;end`;
        } else if (this.osType === 'ios') {
            // iOS PWA - try to open in Safari first
            window.location.href = `x-safari-${currentUrl}`;
        }
        
        // Fallback: try to open in a new window
        setTimeout(() => {
            if (typeof window.allowPopup === 'function') window.allowPopup();
            window.open(currentUrl, '_blank');
        }, 1000);
    }

    showModal() {
        const modal = document.getElementById('smart-link-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Add entrance animation
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        }
    }

    // No closeModal method - modal cannot be closed by user

    // Public method to manually trigger the modal
    show() {
        if (this.isInAppBrowser && this.isMobile) {
            this.showModal();
        }
    }

    // Public method to check if in in-app browser
    isInApp() {
        return this.isInAppBrowser;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.smartLinkHandler = new SmartLinkHandler();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.smartLinkHandler = new SmartLinkHandler();
    });
} else {
    window.smartLinkHandler = new SmartLinkHandler();
}
