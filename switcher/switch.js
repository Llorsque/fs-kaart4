
(() => {
  if (window.__mapDashSwitcherLoaded) return;
  window.__mapDashSwitcherLoaded = true;

  // Compute base (repo root) for GitHub Pages project sites
  const segs = location.pathname.split('/').filter(Boolean);
  const repoBase = segs.length ? `/${segs[0]}/` : '/';
  const inDashboard = segs.includes('dashboard');

  const targetHref = inDashboard ? repoBase : `${repoBase}dashboard/`;
  const label = inDashboard ? 'Naar kaart' : 'Naar dashboard';

  // Styles (embedded to avoid extra CSS file)
  const style = document.createElement('style');
  style.textContent = `
    .md-switcher {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 9999;
    }
    .md-switcher a {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      background: #111827;
      color: #fff;
      border: 1px solid rgba(0,0,0,.2);
      padding: .5rem .8rem;
      border-radius: 999px;
      text-decoration: none;
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,.12);
    }
    .md-switcher a:hover { opacity:.92 }
    .md-switcher .dot {
      width: 8px; height: 8px; border-radius: 50%; background:#22c55e;
      box-shadow: 0 0 0 2px rgba(255,255,255,.25) inset;
    }
    @media (max-width: 600px){
      .md-switcher { top: 10px; right: 10px; }
      .md-switcher a { padding:.45rem .7rem; font-size:13px; }
    }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'md-switcher';
  wrap.innerHTML = `<a href="${targetHref}" aria-label="${label}"><span class="dot"></span>${label}</a>`;
  document.body.appendChild(wrap);

  // Keyboard shortcut: press "d" to toggle
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      location.href = targetHref;
    }
  });
})();
