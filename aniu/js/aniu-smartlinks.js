(function () {
  'use strict';

  if (window.JFLIX_HIDE_ADS === true) return;

  var SMARTLINK = 'https://heavinessslight.com/b8efvmfmh?key=c2d33d16418844aad26060fef0ceb707';

  function addStyles() {
    if (document.getElementById('aniu-smartlinks-styles')) return;
    var style = document.createElement('style');
    style.id = 'aniu-smartlinks-styles';
    style.textContent = [
      '.aniu-smartlink {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  background: linear-gradient(135deg, #4ecdc4 0%, #2d8a82 100%);',
      '  color: #fff;',
      '  text-decoration: none;',
      '  font-weight: 600;',
      '  border: none;',
      '  border-radius: 8px;',
      '  cursor: pointer;',
      '  transition: transform 0.15s ease, box-shadow 0.15s ease;',
      '  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.25);',
      '}',
      '.aniu-smartlink:hover {',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 6px 16px rgba(78, 205, 196, 0.35);',
      '}',
      '.aniu-smartlink-nav {',
      '  padding: 8px 12px;',
      '  font-size: 0.78rem;',
      '  margin-left: 8px;',
      '  white-space: nowrap;',
      '}',
      '.aniu-smartlink-nav .aniu-smartlink-text { display: inline; }',
      '.aniu-smartlink-nav .aniu-smartlink-icon { display: none; }',
      '@media (max-width: 768px) {',
      '  .aniu-smartlink-nav { padding: 8px; margin-left: 4px; }',
      '  .aniu-smartlink-nav .aniu-smartlink-text { display: none; }',
      '  .aniu-smartlink-nav .aniu-smartlink-icon { display: inline; }',
      '}',
      '.aniu-smartlink-footer {',
      '  padding: 10px 18px;',
      '  font-size: 0.9rem;',
      '  margin-top: 12px;',
      '}',
      '.footer-smartlink-wrap {',
      '  display: flex;',
      '  justify-content: center;',
      '  padding: 16px 0 8px;',
      '  border-top: 1px solid rgba(255,255,255,0.05);',
      '  margin-top: 16px;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function createSmartlinkButton(text, icon, extraClass) {
    var a = document.createElement('a');
    a.href = SMARTLINK;
    a.target = '_blank';
    a.rel = 'noopener sponsored';
    a.className = 'aniu-smartlink ' + extraClass;
    a.setAttribute('data-campaign', 'aniu-smartlink');
    a.innerHTML = '<span class="aniu-smartlink-icon">' + icon + '</span><span class="aniu-smartlink-text">' + text + '</span>';
    return a;
  }

  function addNavbarButton() {
    var navRight = document.querySelector('.nav-right');
    if (!navRight || document.getElementById('aniu-nav-smartlink')) return;

    var btn = createSmartlinkButton('Special Offers', '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v13M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0z"/><path d="M12 2v6"/></svg>', 'aniu-smartlink-nav');
    btn.id = 'aniu-nav-smartlink';
    navRight.appendChild(btn);
  }

  function addFooterButton() {
    var footer = document.querySelector('.footer');
    if (!footer || document.getElementById('aniu-footer-smartlink-wrap')) return;

    var wrap = document.createElement('div');
    wrap.id = 'aniu-footer-smartlink-wrap';
    wrap.className = 'footer-smartlink-wrap';

    var btn = createSmartlinkButton('Support JFlix', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', 'aniu-smartlink-footer');
    btn.id = 'aniu-footer-smartlink';
    wrap.appendChild(btn);

    var footerBottom = footer.querySelector('.footer-bottom');
    if (footerBottom) {
      footer.insertBefore(wrap, footerBottom);
    } else {
      footer.appendChild(wrap);
    }
  }

  function init() {
    addStyles();
    addNavbarButton();
    addFooterButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
