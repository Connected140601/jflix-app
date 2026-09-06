// Social Media Link Interceptor for Mobile/Tablet
class SocialLinkInterceptor {
    constructor() {
        // Silently skip for JFlix Android native app
        const IS_ANDROID_NATIVE = /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(navigator.userAgent) ||
                                /JFlix-Android/i.test(navigator.userAgent);
        if (IS_ANDROID_NATIVE) {
            console.log('[Social Link Interceptor] JFlix Android app detected — modal disabled');
            return;
        }

        this.init();
    }
    
    init() {
        // Check if user is coming from Facebook or Messenger
        this.checkReferrer();
        
        // Intercept all external links
        this.interceptLinks();
        
        // Add click handlers for social sharing buttons
        this.addSocialHandlers();
    }
    
    checkReferrer() {
        const referrer = document.referrer.toLowerCase();
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Detect if coming from Facebook/Messenger apps
        if (referrer.includes('facebook.com') || 
            referrer.includes('messenger.com') ||
            userAgent.includes('fb_iab') ||
            userAgent.includes('fb4a') ||
            userAgent.includes('messenger')) {
            
            // Show modal after page loads
            setTimeout(() => {
                this.showSocialModal();
            }, 1000);
        }
    }
    
    interceptLinks() {
        // Intercept all links that might be social media related
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a');
            if (!link) return;
            
            const href = link.href;
            const target = link.target;
            
            // Check if link is external and might be opened in social media
            if (href && href.includes('jflix.uk') && 
                (target === '_blank' || href.includes('facebook.com') || href.includes('messenger.com'))) {
                
                // Check if on mobile/tablet
                if (this.isMobileOrTablet()) {
                    event.preventDefault();
                    this.handleSocialLink(href, this.detectPlatform());
                }
            }
        });
    }
    
    addSocialHandlers() {
        // Add handlers to existing share buttons
        const shareButtons = document.querySelectorAll('[data-share], .share-btn, .facebook-share, .messenger-share');
        shareButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                if (this.isMobileOrTablet()) {
                    event.preventDefault();
                    const url = button.dataset.url || window.location.href;
                    const platform = this.detectPlatform();
                    this.handleSocialLink(url, platform);
                }
            });
        });
    }
    
    isMobileOrTablet() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Kindle/i.test(navigator.userAgent);
    }
    
    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('messenger') || userAgent.includes('fb_iab')) {
            return 'messenger';
        } else if (userAgent.includes('fb4a') || userAgent.includes('facebook')) {
            return 'facebook';
        } else {
            // Default to facebook for general mobile/tablet
            return 'facebook';
        }
    }
    
    handleSocialLink(url, platform) {
        if (window.smartSocialHandler) {
            window.smartSocialHandler.createModal(platform, url);
        }
    }
    
    showSocialModal() {
        const currentUrl = window.location.href;
        const platform = this.detectPlatform();
        
        if (window.smartSocialHandler) {
            window.smartSocialHandler.createModal(platform, currentUrl);
        }
    }
    
    // Auto-detect and handle social media browsers
    detectSocialBrowser() {
        const userAgent = navigator.userAgent;
        
        // Facebook in-app browser
        if (userAgent.includes('FB_IAB') || userAgent.includes('FB4A')) {
            return 'facebook';
        }
        
        // Messenger in-app browser
        if (userAgent.includes('Messenger') || userAgent.includes('FBAV')) {
            return 'messenger';
        }
        
        // Instagram in-app browser
        if (userAgent.includes('Instagram')) {
            return 'instagram';
        }
        
        return null;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    new SocialLinkInterceptor();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        new SocialLinkInterceptor();
    });
} else {
    new SocialLinkInterceptor();
}
