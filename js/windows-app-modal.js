// JFlix Windows App Download Modal - Device Detection
// Version 2.1

(function() {
  'use strict';

  // Check if user is on Windows desktop
  function isWindows() {
    return navigator.userAgent.includes('Windows');
  }

  // Check if already inside Electron app
  function isElectron() {
    return navigator.userAgent.includes('Electron');
  }

  // Detect architecture hint
  function detectArch() {
    const ua = navigator.userAgent;
    // Windows on ARM
    if (/ARM/i.test(ua)) return 'arm64';
    // 64-bit Windows
    if (/Win64|x64|WOW64/i.test(ua)) return 'x64';
    // 32-bit
    return 'ia32';
  }

  // Create modal HTML
  function createModal(arch) {
    if (document.getElementById('windows-app-modal')) return;

    const is64 = arch !== 'ia32';
    const archLabel = arch === 'arm64' ? 'ARM64' : arch === 'x64' ? '64-bit (x64)' : '32-bit (x86)';

    // Use global variables from download-app-modal.js (single source of truth)
    const latestVersion = window.JFLIX_LATEST_APP_VERSION || '1.4.1';
    const downloadUrls = window.JFLIX_DOWNLOAD_URLS || {};
    const r2Base = downloadUrls.windowsSetup?.split('/').slice(0, -1).join('/') || 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev';
    const setupUrl    = `${r2Base}/JFlix-Setup-${latestVersion}.exe`;
    const portableUrl = `${r2Base}/JFlix-${latestVersion}-Portable.exe`;

    const modalHTML = `
      <div id="windows-app-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%); border-radius:24px; max-width:1000px; width:95%; max-height:90vh; overflow-y:auto; padding:0; box-shadow:0 30px 100px rgba(0,0,0,0.6); border:2px solid rgba(229,9,20,0.3); display:flex; flex-direction:row;">

          <!-- Left Panel - Branding -->
          <div style="flex:0 0 280px; background:linear-gradient(180deg,rgba(229,9,20,0.1) 0%,rgba(229,9,20,0.05) 100%); padding:40px 30px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-right:1px solid rgba(229,9,20,0.2);">
            <div style="margin-bottom:24px;">
              <img src="https://jflix.uk/images/icon-512x512.png" alt="JFlix" style="width:120px; height:120px; border-radius:24px; box-shadow:0 15px 40px rgba(229,9,20,0.4);">
            </div>
            <h2 style="color:#fff; margin:0 0 8px 0; font-size:32px; font-weight:bold; text-align:center;">JFlix</h2>
            <p style="color:#e50914; margin:0 0 28px 0; font-size:18px; font-weight:600; text-align:center;">Desktop App</p>

            <div style="margin-bottom:24px; text-align:center;">
              <p style="color:#aaa; margin:0; font-size:14px; line-height:1.6;">The ultimate streaming experience for your Windows PC</p>
            </div>

            <!-- Features -->
            <div style="display:flex; flex-direction:column; gap:12px; width:100%;">
              <div style="display:flex; align-items:center; gap:12px; background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.2); border-radius:10px; padding:10px 14px;">
                <i class="fas fa-ban" style="color:#4ecdc4; font-size:18px; width:22px; text-align:center;"></i>
                <span style="color:#4ecdc4; font-size:13px; font-weight:600;">No Ads</span>
              </div>
              <div style="display:flex; align-items:center; gap:12px; background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.2); border-radius:10px; padding:10px 14px;">
                <i class="fas fa-infinity" style="color:#4ecdc4; font-size:18px; width:22px; text-align:center;"></i>
                <span style="color:#4ecdc4; font-size:13px; font-weight:600;">Unlimited Streaming</span>
              </div>
              <div style="display:flex; align-items:center; gap:12px; background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.2); border-radius:10px; padding:10px 14px;">
                <i class="fas fa-gift" style="color:#4ecdc4; font-size:18px; width:22px; text-align:center;"></i>
                <span style="color:#4ecdc4; font-size:13px; font-weight:600;">100% Free</span>
              </div>
              <div style="display:flex; align-items:center; gap:12px; background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.2); border-radius:10px; padding:10px 14px;">
                <i class="fab fa-windows" style="color:#4ecdc4; font-size:18px; width:22px; text-align:center;"></i>
                <span style="color:#4ecdc4; font-size:13px; font-weight:600;">Windows 10 / 11</span>
              </div>
            </div>
          </div>

          <!-- Right Panel - Content -->
          <div style="flex:1; padding:40px; display:flex; flex-direction:column;">

            <!-- Header -->
            <div style="margin-bottom:28px;">
              <h3 style="color:#fff; margin:0 0 12px 0; font-size:24px; font-weight:bold;">
                <i class="fab fa-windows" style="color:#00adef; margin-right:10px;"></i>Download for Windows
              </h3>
              <div style="background:rgba(229,9,20,0.12); border:1px solid rgba(229,9,20,0.4); border-radius:12px; padding:10px 18px; display:inline-flex; align-items:center; gap:10px;">
                <i class="fas fa-microchip" style="color:#e50914;"></i>
                <p style="color:#e50914; margin:0; font-size:14px; font-weight:600;">Detected: Windows ${archLabel}</p>
              </div>
            </div>

            <!-- Features Grid -->
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:28px;">
              <div style="background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.25); border-radius:12px; padding:18px; text-align:center;">
                <i class="fas fa-shield-alt" style="color:#4ecdc4; font-size:26px; margin-bottom:8px; display:block;"></i>
                <p style="color:#4ecdc4; margin:0; font-size:13px; font-weight:bold;">Safe & Secure</p>
              </div>
              <div style="background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.25); border-radius:12px; padding:18px; text-align:center;">
                <i class="fas fa-bolt" style="color:#4ecdc4; font-size:26px; margin-bottom:8px; display:block;"></i>
                <p style="color:#4ecdc4; margin:0; font-size:13px; font-weight:bold;">Fast & Lightweight</p>
              </div>
              <div style="background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.25); border-radius:12px; padding:18px; text-align:center;">
                <i class="fas fa-film" style="color:#4ecdc4; font-size:26px; margin-bottom:8px; display:block;"></i>
                <p style="color:#4ecdc4; margin:0; font-size:13px; font-weight:bold;">HD Streaming</p>
              </div>
            </div>

            <!-- Download Buttons -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:28px;">
              <!-- Setup Installer -->
              <button id="win-setup-btn"
                style="background:linear-gradient(135deg,#e50914 0%,#b20710 100%);
                       color:#fff; padding:20px 24px; border-radius:16px;
                       font-weight:bold; font-size:15px; cursor:pointer;
                       border:none; display:flex; flex-direction:column; align-items:center; gap:8px;
                       box-shadow:0 10px 30px rgba(229,9,20,0.4); transition:all 0.3s;"
                onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 15px 40px rgba(229,9,20,0.5)';"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 30px rgba(229,9,20,0.4)';">
                <i class="fas fa-download" style="font-size:22px;"></i>
                <span>Setup Installer</span>
                <span style="font-size:11px; opacity:0.8; font-weight:normal;">${is64 ? 'x64' : 'x86'} • v1.4.1 • Recommended</span>
              </button>

              <!-- Portable -->
              <button id="win-portable-btn"
                style="background:linear-gradient(135deg,#4a90e2 0%,#357abd 100%);
                       color:#fff; padding:20px 24px; border-radius:16px;
                       font-weight:bold; font-size:15px; cursor:pointer;
                       border:none; display:flex; flex-direction:column; align-items:center; gap:8px;
                       box-shadow:0 10px 30px rgba(74,144,226,0.4); transition:all 0.3s;"
                onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 15px 40px rgba(74,144,226,0.5)';"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 30px rgba(74,144,226,0.4)';">
                <i class="fas fa-box-open" style="font-size:22px;"></i>
                <span>Portable</span>
                <span style="font-size:11px; opacity:0.8; font-weight:normal;">x64 • v1.4.1 • No Install Needed</span>
              </button>
            </div>

            <!-- Installation Instructions -->
            <div style="background:rgba(255,255,255,0.04); border-radius:16px; padding:22px; border:1px solid rgba(255,255,255,0.08); margin-bottom:24px;">
              <h4 style="color:#fff; margin:0 0 14px 0; font-size:15px; font-weight:bold; display:flex; align-items:center; gap:10px;">
                <i class="fas fa-info-circle" style="color:#4ecdc4; font-size:18px;"></i>Installation Instructions
              </h4>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                  <p style="color:#e50914; margin:0 0 8px 0; font-size:13px; font-weight:bold;"><i class="fas fa-download" style="margin-right:6px;"></i>Setup Installer</p>
                  <ol style="color:#aaa; margin:0; padding-left:18px; font-size:12px; line-height:1.8;">
                    <li>Download the Setup .exe file</li>
                    <li>Run the installer</li>
                    <li>Choose install location</li>
                    <li>Click Install &amp; finish</li>
                    <li>Launch from Desktop shortcut</li>
                  </ol>
                </div>
                <div>
                  <p style="color:#4a90e2; margin:0 0 8px 0; font-size:13px; font-weight:bold;"><i class="fas fa-box-open" style="margin-right:6px;"></i>Portable</p>
                  <ol style="color:#aaa; margin:0; padding-left:18px; font-size:12px; line-height:1.8;">
                    <li>Download the Portable .exe</li>
                    <li>Place it anywhere you want</li>
                    <li>Double-click to run</li>
                    <li>No installation needed</li>
                    <li>Works from USB drive too!</li>
                  </ol>
                </div>
              </div>
            </div>

            <!-- Windows Defender Warning Section -->
            <div style="background:rgba(247,151,30,0.08); border:1px solid rgba(247,151,30,0.25); border-radius:12px; padding:18px; margin-bottom:20px;">
              <h4 style="color:#fff; margin:0 0 12px 0; font-size:14px; font-weight:bold; display:flex; align-items:center; gap:10px;">
                <i class="fas fa-shield-alt" style="color:#f7971e; font-size:18px;"></i>Windows Defender Protection Notice
              </h4>
              
              <p style="color:#ccc; margin:0 0 14px 0; font-size:12.5px; line-height:1.6;">
                <strong style="color:#fff;">Important:</strong> When installing JFlix, Windows Defender may show "Windows protected your PC" warning. This is <strong style="color:#4ecdc4;">100% normal and safe</strong>. Windows Defender detects the file because it's a third-party application not from the Microsoft Store.
              </p>

              <!-- Warning Images -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                <div style="background:rgba(0,0,0,0.3); border-radius:8px; overflow:hidden; border:1px solid rgba(247,151,30,0.2);">
                  <img src="/images/att._YE-1OkWDBKXtndxHnSp_ENIgFxPwPRAecj2E6bDnr8.jpg" alt="Windows Defender Warning 1" style="width:100%; height:auto; display:block;">
                </div>
                <div style="background:rgba(0,0,0,0.3); border-radius:8px; overflow:hidden; border:1px solid rgba(247,151,30,0.2);">
                  <img src="/images/att.dV7Ez4ysONQEiQhpFWPPPjog-1h30N6P-N2kFJvNGvo.jpg" alt="Windows Defender Warning 2" style="width:100%; height:auto; display:block;">
                </div>
              </div>

              <!-- Instructions -->
              <div style="background:rgba(78,205,196,0.1); border:1px solid rgba(78,205,196,0.3); border-radius:10px; padding:14px;">
                <p style="color:#4ecdc4; margin:0 0 10px 0; font-size:13px; font-weight:bold;">
                  <i class="fas fa-check-circle" style="margin-right:6px;"></i>How to bypass Windows Defender warning:
                </p>
                <ol style="color:#ccc; margin:0; padding-left:20px; font-size:12px; line-height:1.8;">
                  <li>Click <strong style="color:#f7971e;">"More info"</strong> button</li>
                  <li>Click <strong style="color:#f7971e;">"Run anyway"</strong> or <strong style="color:#f7971e;">"Install anyway"</strong></li>
                  <li>The installation will proceed normally</li>
                </ol>
                <p style="color:#4ecdc4; margin:10px 0 0 0; font-size:12px; font-weight:bold;">
                  <i class="fas fa-lock" style="margin-right:6px;"></i>JFlix is 100% safe • No virus • Verified
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="margin-top:20px; text-align:center;">
              <p style="color:#555; margin:0; font-size:12px;">
                <i class="fas fa-lock" style="margin-right:6px;"></i>Secure download • Optimized for Windows 10 &amp; 11
              </p>
            </div>

          </div>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = modalHTML;
    document.body.appendChild(container);

    // Setup button
    const setupBtn = document.getElementById('win-setup-btn');
    if (setupBtn) {
      setupBtn.addEventListener('click', async function() {
        // Track download
        try {
          await fetch('https://jflix-api.junrel-sapantaicloud.workers.dev/api/downloads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadType: 'windows_setup' })
          });
        } catch (e) {
          console.log('Download tracking failed:', e);
        }
        window.open(setupUrl, '_blank');
      });
    }

    // Portable button
    const portableBtn = document.getElementById('win-portable-btn');
    if (portableBtn) {
      portableBtn.addEventListener('click', async function() {
        // Track download
        try {
          await fetch('https://jflix-api.junrel-sapantaicloud.workers.dev/api/downloads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadType: 'windows_portable' })
          });
        } catch (e) {
          console.log('Download tracking failed:', e);
        }
        window.open(portableUrl, '_blank');
      });
    }

    // Prevent escape key from closing modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Prevent right-click
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  // Initialize
  async function init() {
    if (isElectron()) return;
    if (!isWindows()) return;

    const arch = detectArch();

    const run = () => setTimeout(() => createModal(arch), 1000);
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', run)
      : run();
  }

  init();

})();
