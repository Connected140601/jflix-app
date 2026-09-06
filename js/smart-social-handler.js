// Smart Social Media Link Handler for Mobile/Tablet
class SmartSocialHandler {
    constructor() {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
        this.isTablet = /iPad|Android(?!.*Mobile)|Tablet|Kindle|Silk|PlayBook/i.test(navigator.userAgent);
    }
    
    detectDevice() {
        if (this.isMobile) return 'mobile';
        if (this.isTablet) return 'tablet';
        return 'desktop';
    }
    
    getInstructions(device, platform) {
        const instructions = {
            mobile: {
                messenger: {
                    title: 'Open in Messenger',
                    steps: [
                        '1. Copy the JFlix link below',
                        '2. Open Messenger app',
                        '3. Paste the link in chat',
                        '4. Tap the link to open in browser'
                    ]
                },
                facebook: {
                    title: 'Open in Facebook App',
                    steps: [
                        '1. Copy the JFlix link below',
                        '2. Open Facebook app',
                        '3. Paste the link in your browser',
                        '4. The link will open in Facebook app'
                    ]
                }
            },
            tablet: {
                messenger: {
                    title: 'Open in Browser',
                    steps: [
                        '1. Copy the JFlix link below',
                        '2. Open your web browser (Safari, Chrome, etc.)',
                        '3. Paste the link in the address bar',
                        '4. Press Enter to visit JFlix'
                    ]
                },
                facebook: {
                    title: 'Open in Browser',
                    steps: [
                        '1. Copy the JFlix link below',
                        '2. Open your web browser',
                        '3. Paste the link in the address bar',
                        '4. Press Enter to visit JFlix on Facebook'
                    ]
                }
            }
        };
        
        return instructions[device]?.[platform] || null;
    }
    
    createModal(platform, url) {
        const device = this.detectDevice();
        const instructions = this.getInstructions(device, platform);
        
        if (!instructions) return;
        
        const modal = document.createElement('div');
        modal.className = 'smart-social-modal';
        modal.innerHTML = `
            <div class="smart-social-content">
                <div class="smart-social-header">
                    <h3>${instructions.title}</h3>
                    <button class="smart-social-close" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="smart-social-body">
                    <div class="smart-social-link">
                        <strong>Link to copy:</strong>
                        <div class="link-display">
                            <code id="link-to-copy">${url}</code>
                            <button class="copy-btn" onclick="copySocialLink()">
                                <i class="fas fa-copy"></i>
                                Copy
                            </button>
                        </div>
                    </div>
                    <div class="smart-social-steps">
                        <h4>Instructions:</h4>
                        <ol>
                            ${instructions.steps.map(step => `<li>${step}</li>`).join('')}
                        </ol>
                    </div>
                    <div class="smart-social-device-info">
                        <p><strong>Device detected:</strong> ${device.charAt(0).toUpperCase() + device.slice(1)}</p>
                        <p><strong>Platform:</strong> ${platform.charAt(0).toUpperCase() + platform.slice(1)}</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add styles if not already present
        if (!document.getElementById('smart-social-styles')) {
            const style = document.createElement('style');
            style.id = 'smart-social-styles';
            style.textContent = `
                .smart-social-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s ease;
                }
                
                .smart-social-content {
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    border-radius: 16px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                }
                
                .smart-social-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 20px 15px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .smart-social-header h3 {
                    margin: 0;
                    color: white;
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .smart-social-close {
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .smart-social-close:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: scale(1.1);
                }
                
                .smart-social-body {
                    padding: 20px;
                }
                
                .smart-social-link {
                    margin-bottom: 20px;
                }
                
                .smart-social-link strong {
                    display: block;
                    margin-bottom: 10px;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 14px;
                }
                
                .link-display {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(0, 0, 0, 0.3);
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .link-display code {
                    background: rgba(255, 255, 255, 0.1);
                    color: #00ff88;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    word-break: break-all;
                    flex: 1;
                    min-width: 0;
                }
                
                .copy-btn {
                    background: linear-gradient(135deg, #e50914 0%, #ff0a16 100%);
                    border: none;
                    border-radius: 6px;
                    padding: 8px 12px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-size: 12px;
                    font-weight: 500;
                }
                
                .copy-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 4px 15px rgba(229, 9, 20, 0.3);
                }
                
                .copy-btn i {
                    margin-right: 5px;
                }
                
                .smart-social-steps {
                    margin-bottom: 20px;
                }
                
                .smart-social-steps h4 {
                    margin: 0 0 15px;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 16px;
                }
                
                .smart-social-steps ol {
                    margin: 0;
                    padding-left: 20px;
                    color: rgba(255, 255, 255, 0.8);
                    line-height: 1.6;
                }
                
                .smart-social-steps li {
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                
                .smart-social-device-info {
                    background: rgba(255, 255, 255, 0.05);
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .smart-social-device-info p {
                    margin: 5px 0;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.7);
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @media (max-width: 600px) {
                    .smart-social-content {
                        width: 95%;
                        max-height: 90vh;
                    }
                    
                    .smart-social-header {
                        padding: 15px 15px 10px;
                    }
                    
                    .smart-social-header h3 {
                        font-size: 16px;
                    }
                    
                    .smart-social-body {
                        padding: 15px;
                    }
                    
                    .link-display {
                        flex-direction: column;
                        gap: 8px;
                    }
                    
                    .link-display code {
                        font-size: 11px;
                        padding: 6px 8px;
                    }
                    
                    .copy-btn {
                        padding: 6px 10px;
                        font-size: 11px;
                    }
                    
                    .smart-social-steps h4 {
                        font-size: 14px;
                    }
                    
                    .smart-social-steps ol {
                        padding-left: 15px;
                    }
                    
                    .smart-social-steps li {
                        font-size: 13px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.remove();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const existingModal = document.querySelector('.smart-social-modal');
                if (existingModal) {
                    existingModal.remove();
                }
            }
        });
    }
    
    copyLink() {
        const linkElement = document.getElementById('link-to-copy');
        if (linkElement) {
            const text = linkElement.textContent;
            navigator.clipboard.writeText(text).then(() => {
                // Show success feedback
                const copyBtn = document.querySelector('.copy-btn');
                if (copyBtn) {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    copyBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20bf6b 100%)';
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.style.background = '';
                    }, 2000);
                }
            }).catch(err => {
                console.error('Failed to copy link: ', err);
                // Fallback for older browsers
                this.fallbackCopyToClipboard(text);
            });
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                const copyBtn = document.querySelector('.copy-btn');
                if (copyBtn) {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    copyBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20bf6b 100%)';
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.style.background = '';
                    }, 2000);
                }
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }
        
        document.body.removeChild(textArea);
    }
}

// Initialize the smart social handler
const smartSocialHandler = new SmartSocialHandler();

// Make it globally available
window.smartSocialHandler = smartSocialHandler;

// Global copy function for onclick handlers
function copySocialLink() {
    smartSocialHandler.copyLink();
}
