window.CatalystUtils = (function () {
  const SPECIAL_THEMES = ['gamedev', 'robotic', 'biological', 'space', 'ai'];
  const THEME_LABELS = {
    light: 'Light',
    gamedev: 'Game Development',
    robotic: 'Robotics',
    biological: 'Biological',
    space: 'Space Exploration',
    ai: 'AI Frontier'
  };

  // Sync across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'catalyst-global-theme' || e.key === 'catalyst-theme') {
      initLocalTheme();
    }
  });

  function normalizeTheme(theme) {
    if (!theme || theme === 'dark' || theme === 'default') return '';
    if (theme === 'light') return 'light';
    if (SPECIAL_THEMES.includes(theme)) return theme;
    return '';
  }

  function updateThemeButtonUI(effectiveTheme) {
    const isLight = document.body.classList.contains('light-mode');
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.innerHTML = isLight ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon-stars"></i>';
      
      const normalized = normalizeTheme(effectiveTheme);
      if (normalized === '' || normalized === 'light') {
        btn.style.display = '';
      } else {
        btn.style.display = 'none';
      }
    }
  }

  function applyThemeUI(effectiveTheme) {
    const body = document.body;
    SPECIAL_THEMES.forEach((t) => body.classList.remove(`theme-${t}`));
    body.classList.remove('light-mode');

    const normalized = normalizeTheme(effectiveTheme);

    if (normalized) {
      if (SPECIAL_THEMES.includes(normalized)) {
        body.classList.add(`theme-${normalized}`);
      } else if (normalized === 'light') {
        body.classList.add('light-mode');
      }
    } else {
      // default/empty is dark mode implicitly in this project (no class added).
    }
    updateThemeButtonUI(normalized);
  }

  function initLocalTheme() {
    let globalTheme = localStorage.getItem('catalyst-global-theme');
    
    // Asynchronously fetch to ensure localStorage is accurate
    if (window.CatalystDB) {
        window.CatalystDB.from('site_settings').select('value').eq('key', 'global_theme').single()
        .then(({ data }) => {
            if (data && data.value) {
                const dbTheme = data.value.theme || '';
                if (dbTheme !== globalTheme) {
                    localStorage.setItem('catalyst-global-theme', dbTheme);
                    initLocalTheme();
                }
            } else if (globalTheme) {
                // If it was cleared in DB
                localStorage.removeItem('catalyst-global-theme');
                initLocalTheme();
            }
        }).catch(e => {});
    }

    // Determine what to apply for unauthenticated guests, or before auth loads
    let effective = globalTheme || localStorage.getItem('catalyst-theme') || '';
    
    // However, if we have a user profile loaded, its theme might take precedence.
    // That's handled by applyEffectiveTheme. This is just the early/base load.
    // But since applyEffectiveTheme is called explicitly in main.js/admin.js when profile loads,
    // we just apply `effective` here for now.
    applyThemeUI(effective);
  }

  function applyEffectiveTheme(profile) {
    const globalTheme = localStorage.getItem('catalyst-global-theme');
    let effectiveTheme = '';

    if (globalTheme) {
        effectiveTheme = globalTheme;
    } else if (profile && profile.theme) {
        effectiveTheme = profile.theme;
    } else {
        effectiveTheme = localStorage.getItem('catalyst-theme') || '';
    }

    const normalized = normalizeTheme(effectiveTheme);
    applyThemeUI(normalized);
    return { forced: !!globalTheme, theme: normalized };
  }

  /* Interactions (Cursor Glow & Scroll Reveal) */
  function initInteractions() {
    const cursor = document.getElementById('cursor-glow');
    if (cursor) {
      document.addEventListener('mousemove', (e) => {
        requestAnimationFrame(() => {
          cursor.style.left = e.clientX + 'px';
          cursor.style.top = e.clientY + 'px';
        });
      });
    }
  }

  function initScrollReveals() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(ent => {
        if (ent.isIntersecting) {
          ent.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });
    reveals.forEach(r => observer.observe(r));
  }

  function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;
    window.addEventListener('scroll', () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      bar.style.width = scrolled + '%';
    });
  }

  /* UI Helpers */
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.classList.add('fade-out');
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('modal-open');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('modal-open');
  }

  async function confirmAction(msg, btnText = 'Confirm') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay modal-open';
      overlay.innerHTML = `
        <div class="modal-box glass-panel" style="max-width:400px; text-align:center;">
          <h3 style="margin-top:0;"><i class="ph ph-warning-circle" style="color:var(--accent);"></i> Confirm</h3>
          <p>${escapeHtml(msg)}</p>
          <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
            <button class="secondary" id="confirmCancel">Cancel</button>
            <button class="danger" id="confirmOk">${escapeHtml(btnText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('confirmCancel').onclick = () => { overlay.remove(); resolve(false); };
      document.getElementById('confirmOk').onclick = () => { overlay.remove(); resolve(true); };
    });
  }

  function setLoading(btn, isLoading, loadingText = 'Processing...') {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="ph ph-spinner-gap ph-spin"></i> ${loadingText}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.original) {
        btn.innerHTML = btn.dataset.original;
      }
    }
  }

  return {
    SPECIAL_THEMES, THEME_LABELS, initLocalTheme, applyEffectiveTheme, initInteractions, initScrollReveals, initScrollProgress,
    debounce, escapeHtml, formatDate, toast, openModal, closeModal, confirmAction, setLoading
  };
})();