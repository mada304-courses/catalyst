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

  let revealObserver = null;

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
      btn.innerHTML = isLight
        ? '<i class="ph ph-sun" aria-hidden="true"></i>'
        : '<i class="ph ph-moon-stars" aria-hidden="true"></i>';
      btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');

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
    }
    updateThemeButtonUI(normalized);
  }

  function initLocalTheme() {
    const globalTheme = localStorage.getItem('catalyst-global-theme');

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
            localStorage.removeItem('catalyst-global-theme');
            initLocalTheme();
          }
        }).catch(() => {});
    }

    const effective = globalTheme || localStorage.getItem('catalyst-theme') || '';
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

  /* Interactions (Subtle Cursor Glow, Scroll Progress, Scroll Reveal, Modal Keys) */
  function initInteractions() {
    const cursor = document.getElementById('cursor-glow');
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (cursor && !prefersReducedMotion) {
      let rafPending = false;
      let latestX = 0;
      let latestY = 0;
      document.addEventListener('mousemove', (e) => {
        latestX = e.clientX;
        latestY = e.clientY;
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => {
            cursor.style.left = latestX + 'px';
            cursor.style.top = latestY + 'px';
            rafPending = false;
          });
        }
      }, { passive: true });
    }

    initScrollProgress();
    initScrollReveals();

    // Close open modal on Escape key or backdrop click
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal-overlay.modal-open');
        if (openModals.length > 0) {
          const topModal = openModals[openModals.length - 1];
          if (topModal.id) closeModal(topModal.id);
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('modal-overlay') && e.target.classList.contains('modal-open')) {
        if (e.target.id) closeModal(e.target.id);
      }
    });
  }

  function initScrollReveals() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      reveals.forEach((r) => r.classList.add('active'));
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((ent) => {
          if (ent.isIntersecting) {
            ent.target.classList.add('active');
            revealObserver.unobserve(ent.target);
          }
        });
      }, { threshold: 0.01, rootMargin: '0px 0px 40px 0px' });
    }

    reveals.forEach((r) => {
      if (r.classList.contains('active')) return;
      const rect = r.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight * 0.96) {
        r.classList.add('active');
      } else {
        revealObserver.observe(r);
      }
    });
  }

  function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;
    const updateBar = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const ratio = height > 0 ? Math.min(1, Math.max(0, winScroll / height)) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    };
    window.addEventListener('scroll', updateBar, { passive: true });
    updateBar();
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
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isValidHttpUrl(value) {
    if (!value || typeof value !== 'string') return false;
    try {
      const parsed = new URL(value.trim(), window.location.origin);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  function formatDate(isoStr) {
    if (!isoStr) return 'TBA';
    // Parse YYYY-MM-DD safely without timezone off-by-one shift
    const match = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(isoStr);
    if (Number.isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function getToastContainer() {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function toast(msg, type = 'info') {
    const container = getToastContainer();
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const iconClass = type === 'success'
      ? 'ph-check-circle'
      : type === 'error'
        ? 'ph-warning-circle'
        : type === 'warning'
          ? 'ph-warning'
          : 'ph-info';
    t.innerHTML = `<i class="ph ${iconClass}" aria-hidden="true"></i><span>${escapeHtml(msg)}</span>`;
    container.appendChild(t);

    requestAnimationFrame(() => {
      t.classList.add('toast-visible');
    });

    setTimeout(() => {
      t.classList.remove('toast-visible');
      setTimeout(() => t.remove(), 320);
    }, 3400);
  }

  function syncModalLock() {
    const anyOpen = document.querySelector('.modal-overlay.modal-open');
    document.body.classList.toggle('modal-lock', !!anyOpen);
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('modal-open');
    syncModalLock();
    const firstInput = m.querySelector('input:not([type="hidden"]), button:not(.modal-close), textarea, select');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 60);
    }
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('modal-open');
    syncModalLock();
  }

  async function confirmAction(msg, btnText = 'Confirm') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay modal-open';
      overlay.innerHTML = `
        <div class="modal-box modal-box-sm glass-panel" style="max-width:420px; text-align:center;">
          <h3 style="margin-top:0;"><i class="ph ph-warning-circle" style="color:var(--accent-color);"></i> Confirm</h3>
          <p>${escapeHtml(msg)}</p>
          <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
            <button type="button" class="btn-outline" id="confirmCancel">Cancel</button>
            <button type="button" class="btn-danger" id="confirmOk">${escapeHtml(btnText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      syncModalLock();

      const cleanup = (result) => {
        overlay.remove();
        syncModalLock();
        resolve(result);
      };

      overlay.querySelector('#confirmCancel').onclick = () => cleanup(false);
      overlay.querySelector('#confirmOk').onclick = () => cleanup(true);
    });
  }

  function setLoading(btn, isLoading, loadingText = 'Processing...') {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="ph ph-spinner-gap ph-spin" aria-hidden="true"></i> ${escapeHtml(loadingText)}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.original) {
        btn.innerHTML = btn.dataset.original;
      }
    }
  }

  return {
    SPECIAL_THEMES,
    THEME_LABELS,
    initLocalTheme,
    applyEffectiveTheme,
    initInteractions,
    initScrollReveals,
    initScrollProgress,
    debounce,
    escapeHtml,
    isValidHttpUrl,
    formatDate,
    toast,
    openModal,
    closeModal,
    confirmAction,
    setLoading
  };
})();
