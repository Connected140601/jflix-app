// JFlix Mac App Download Modal - Device Detection
// Version 1.0

(function() {
  'use strict';

  // Check if user is on macOS desktop (not iOS)
  function isMacOS() {
    const platform = navigator.platform;
    const userAgent = navigator.userAgent;

    // Check for iOS devices (iPhone, iPad, iPod)
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || 
                  /iPhone|iPad|iPod/i.test(platform);

    // Check for macOS desktop
    const isMacDesktop = platform === 'MacIntel' || 
                         platform === 'MacPPC' || 
                         platform === 'MacARM' ||
                         userAgent.includes('Macintosh');

    // Return true only if it's a Mac desktop and NOT iOS
    return isMacDesktop && !isIOS;
  }

  // Detect Mac architecture (Silicon vs Intel)
  async function detectMacArchitecture() {
    // Check if running in a browser (not in Electron app)
    if (window.navigator.userAgent.includes('Electron')) {
      return null; // Already in the app, don't show modal
    }

    if (!isMacOS()) {
      return null; // Not a Mac, don't show modal
    }

    // Try to detect architecture using various methods
    try {
      // Method 1: Check platform
      if (navigator.platform === 'MacIntel') {
        // MacIntel could be either Intel or Silicon in newer browsers
        // Try to detect using WebGL
        const gl = document.createElement('canvas').getContext('webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            if (renderer.includes('Apple M') || renderer.includes('Apple GPU')) {
              return 'arm64'; // Silicon
            }
          }
        }
        // Fallback: assume Intel if we can't detect Silicon
        return 'x64';
      }
    } catch (e) {
      console.log('Architecture detection failed, defaulting to Intel');
    }

    return 'x64'; // Default to Intel
  }

  // Create modal HTML
  function createModal(architecture) {
    // Check if modal already exists
    if (document.getElementById('mac-app-modal')) {
      return;
    }

    const isSilicon = architecture === 'arm64';
    const chipName = isSilicon ? 'Apple Silicon (M1/M2/M3/M4/M5)' : 'Intel Chip';
    
    // Use global variables from download-app-modal.js (single source of truth)
    const latestVersion = window.JFLIX_LATEST_APP_VERSION || '1.4.1';
    const downloadUrls = window.JFLIX_DOWNLOAD_URLS || {};
    const r2Base = downloadUrls.macSilicon?.split('/').slice(0, -1).join('/') || 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev';
    const siliconDownloadFile = `JFlix-${latestVersion}-arm64.pkg`;
    const intelDownloadFile = `JFlix-${latestVersion}-x64.pkg`;
    const siliconDownloadUrl = `${r2Base}/${siliconDownloadFile}`;
    const intelDownloadUrl = `${r2Base}/${intelDownloadFile}`;

    const modalHTML = `
      <div id="mac-app-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); z-index: 999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 24px; max-width: 1000px; width: 95%; height: auto; max-height: 90vh; overflow-y: auto; padding: 0; box-shadow: 0 30px 100px rgba(0, 0, 0, 0.6); border: 2px solid rgba(229, 9, 20, 0.3); position: relative; display: flex; flex-direction: row;">
          
          <!-- Left Side - Logo and Branding -->
          <div style="flex: 1; background: linear-gradient(180deg, rgba(229, 9, 20, 0.1) 0%, rgba(229, 9, 20, 0.05) 100%); padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-right: 1px solid rgba(229, 9, 20, 0.2); min-width: 300px;">
            <div style="margin-bottom: 30px;">
              <img src="https://jflix.uk/images/icon-512x512.png" alt="JFlix" style="width: 120px; height: 120px; border-radius: 24px; box-shadow: 0 15px 40px rgba(229, 9, 20, 0.4);">
            </div>
            <h2 style="color: #fff; margin: 0 0 10px 0; font-size: 32px; font-weight: bold; text-align: center;">
              JFlix
            </h2>
            <p style="color: #e50914; margin: 0; font-size: 18px; font-weight: 600; text-align: center;">
              Desktop App
            </p>
            <div style="margin-top: 30px; text-align: center;">
              <p style="color: #aaa; margin: 0; font-size: 14px; line-height: 1.6;">
                The ultimate streaming experience for your Mac
              </p>
            </div>
          </div>

          <!-- Right Side - Content -->
          <div style="flex: 2; padding: 40px; display: flex; flex-direction: column;">
            
            <!-- Header -->
            <div style="margin-bottom: 30px;">
              <h3 style="color: #fff; margin: 0 0 10px 0; font-size: 24px; font-weight: bold;">
                🍎 Download for macOS
              </h3>
              <div style="background: rgba(229, 9, 20, 0.15); border: 1px solid rgba(229, 9, 20, 0.4); border-radius: 12px; padding: 12px 20px; display: inline-block;">
                <p style="color: #e50914; margin: 0; font-size: 15px; font-weight: 600;">
                  <i class="fas fa-microchip" style="margin-right: 8px;"></i>Detected: ${chipName}
                </p>
              </div>
            </div>

            <!-- Features Grid -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
              <div style="background: rgba(78, 205, 196, 0.1); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 12px; padding: 20px; text-align: center; transition: all 0.3s;">
                <i class="fas fa-ban" style="color: #4ecdc4; font-size: 28px; margin-bottom: 10px;"></i>
                <p style="color: #4ecdc4; margin: 0; font-size: 14px; font-weight: bold;">No Ads</p>
              </div>
              <div style="background: rgba(78, 205, 196, 0.1); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 12px; padding: 20px; text-align: center; transition: all 0.3s;">
                <i class="fas fa-infinity" style="color: #4ecdc4; font-size: 28px; margin-bottom: 10px;"></i>
                <p style="color: #4ecdc4; margin: 0; font-size: 14px; font-weight: bold;">Unlimited</p>
              </div>
              <div style="background: rgba(78, 205, 196, 0.1); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 12px; padding: 20px; text-align: center; transition: all 0.3s;">
                <i class="fas fa-gift" style="color: #4ecdc4; font-size: 28px; margin-bottom: 10px;"></i>
                <p style="color: #4ecdc4; margin: 0; font-size: 14px; font-weight: bold;">100% Free</p>
              </div>
            </div>

            <!-- Download Buttons -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
              <button id="mac-app-silicon-btn" 
                 style="background: linear-gradient(135deg, #e50914 0%, #b20710 100%); 
                        color: #fff; padding: 20px 30px; border-radius: 16px; text-decoration: none; 
                        font-weight: bold; font-size: 16px; transition: all 0.3s; 
                        box-shadow: 0 10px 30px rgba(229, 9, 20, 0.4); cursor: pointer;
                        border: none; display: flex; flex-direction: column; align-items: center; gap: 8px;"
                 onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 15px 40px rgba(229, 9, 20, 0.5)';"
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 30px rgba(229, 9, 20, 0.4)';">
                <i class="fas fa-download" style="font-size: 24px;"></i>
                <span>Apple Silicon</span>
                <span style="font-size: 12px; opacity: 0.8; font-weight: normal;">M1/M2/M3/M4/M5 • v1.4.1</span>
              </button>
              <button id="mac-app-intel-btn" 
                 style="background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%); 
                        color: #fff; padding: 20px 30px; border-radius: 16px; text-decoration: none; 
                        font-weight: bold; font-size: 16px; transition: all 0.3s; 
                        box-shadow: 0 10px 30px rgba(74, 144, 226, 0.4); cursor: pointer;
                        border: none; display: flex; flex-direction: column; align-items: center; gap: 8px;"
                 onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 15px 40px rgba(74, 144, 226, 0.5)';"
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 30px rgba(74, 144, 226, 0.4)';">
                <i class="fas fa-download" style="font-size: 24px;"></i>
                <span>Intel Chip</span>
                <span style="font-size: 12px; opacity: 0.8; font-weight: normal;">x64 • v1.4.1</span>
              </button>
            </div>

            <!-- Installation Instructions -->
            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 25px; border: 1px solid rgba(255, 255, 255, 0.1);">
              <h4 style="color: #fff; margin: 0 0 15px 0; font-size: 16px; font-weight: bold; display: flex; align-items: center;">
                <i class="fas fa-info-circle" style="color: #4ecdc4; margin-right: 10px; font-size: 20px;"></i>Installation Instructions
              </h4>
              <ol style="color: #aaa; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                <li>Click the download button for your chip type</li>
                <li>Wait for the DMG file to download</li>
                <li>Double-click the downloaded DMG file</li>
                <li>Drag JFlix to your Applications folder</li>
                <li>Open JFlix from Applications</li>
                <li>If you see a security warning, go to Settings → Privacy & Security → scroll down and select "Open Anyway"</li>
                <li>Enjoy streaming on JFlix!</li>
              </ol>
            </div>

            <!-- Password Bypass -->
            <div style="margin-top: 20px; text-align: center; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #888; margin: 0 0 10px 0; font-size: 12px;">
                <i class="fas fa-key" style="margin-right: 6px;"></i>Have a password? Enter it to continue to website
              </p>
              <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                <input type="password" id="mac-bypass-password" placeholder="Enter password" 
                  style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px 15px; border-radius: 8px; font-size: 14px; width: 150px; outline: none;">
                <button id="mac-bypass-btn" 
                  style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.3s;"
                  onmouseover="this.style.background='rgba(255,255,255,0.2)';"
                  onmouseout="this.style.background='rgba(255,255,255,0.1)';">
                  Continue
                </button>
              </div>
              <p id="mac-bypass-error" style="color: #e50914; margin: 8px 0 0 0; font-size: 12px; display: none;">
                <i class="fas fa-exclamation-circle" style="margin-right: 5px;"></i>Incorrect password
              </p>
            </div>

            <!-- Footer Note -->
            <div style="margin-top: 25px; text-align: center;">
              <p style="color: #666; margin: 0; font-size: 13px;">
                <i class="fas fa-lock" style="margin-right: 6px;"></i>Secure download • Optimized for your Mac
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert modal into DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    // Add click handler for Silicon download button
    const siliconBtn = document.getElementById('mac-app-silicon-btn');
    if (siliconBtn) {
      siliconBtn.addEventListener('click', async function() {
        // Track download
        try {
          await fetch('https://jflix-api.junrel-sapantaicloud.workers.dev/api/downloads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadType: 'macos_silicon' })
          });
        } catch (e) {
          console.log('Download tracking failed:', e);
        }
        window.open(siliconDownloadUrl, '_blank');
      });
    }

    // Add click handler for Intel download button
    const intelBtn = document.getElementById('mac-app-intel-btn');
    if (intelBtn) {
      intelBtn.addEventListener('click', async function() {
        // Track download
        try {
          await fetch('https://jflix-api.junrel-sapantaicloud.workers.dev/api/downloads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadType: 'macos_intel' })
          });
        } catch (e) {
          console.log('Download tracking failed:', e);
        }
        window.open(intelDownloadUrl, '_blank');
      });
    }

    // Prevent escape key from closing modal
    document.addEventListener('keydown', function preventEscape(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Prevent right-click context menu
    document.addEventListener('contextmenu', function preventContextMenu(e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // Add password bypass handler
    const bypassBtn = document.getElementById('mac-bypass-btn');
    const passwordInput = document.getElementById('mac-bypass-password');
    const errorMsg = document.getElementById('mac-bypass-error');
    const BYPASS_PASSWORD = '1406';

    function checkPassword() {
      if (passwordInput.value === BYPASS_PASSWORD) {
        // Close modal
        const modal = document.getElementById('mac-app-modal');
        if (modal) {
          modal.remove();
        }
        // Remove event listeners
        document.removeEventListener('keydown', preventEscape, true);
        document.removeEventListener('contextmenu', preventContextMenu, true);
        // Store in session to prevent re-showing
        sessionStorage.setItem('jflix-mac-modal-bypassed', 'true');
      } else {
        errorMsg.style.display = 'block';
        passwordInput.style.borderColor = '#e50914';
        setTimeout(() => {
          errorMsg.style.display = 'none';
          passwordInput.style.borderColor = 'rgba(255,255,255,0.2)';
        }, 3000);
      }
    }

    if (bypassBtn) {
      bypassBtn.addEventListener('click', checkPassword);
    }

    if (passwordInput) {
      passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          checkPassword();
        }
      });
    }
  }

  // Initialize detection
  async function init() {
    // Check if user already bypassed the modal this session
    if (sessionStorage.getItem('jflix-mac-modal-bypassed') === 'true') {
      return;
    }

    const architecture = await detectMacArchitecture();
    if (architecture) {
      // Small delay to ensure page is loaded
      setTimeout(() => {
        createModal(architecture);
      }, 1000);
    }
  }

  // Run on DOM content loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
