window.CatalystUtils = (function () {

    const SPECIAL_THEMES = ['gamedev', 'robotic', 'biological', 'space'];
  
    const THEME_LABELS = {
      gamedev: 'Level Up',
      robotic: 'System Online',
      biological: 'Discover',
      space: 'Explore',
    };
  
    function initLocalTheme() {
      if (localStorage.getItem('catalyst-theme') === 'light') {
        document.body.classList.add('light-mode');
      }
    }
  
    function applyEffectiveTheme(profile) {
      const body = document.body;
      SPECIAL_THEMES.forEach((t) => body.classList.remove(`theme-${t}`));
  
      const accountTheme = profile?.theme;
      if (accountTheme && SPECIAL_THEMES.includes(accountTheme)) {
        body.classList.remove('light-mode');
        body.classList.add(`theme-${accountTheme}`);
        return { forced: true, theme: accountTheme };
      }
  
      if (localStorage.getItem('catalyst-theme') === 'light') {
        body.classList.add('light-mode');
      } else {
        body.classList.remove('light-mode');
      }
      return { forced: false, theme: null };
    }
  
    /* Interactions (Cursor Glow & Scroll Reveal) */
    function initInteractions() {
        const glow = document.getElementById('cursor-glow');
        if(glow) {
            window.addEventListener('mousemove', (e) => {
                requestAnimationFrame(() => {
                    glow.style.left = e.clientX + 'px';
                    glow.style.top = e.clientY + 'px';
                });
            });
        }
        initScrollReveals();
        initScrollProgress();
    }

    function initScrollProgress() {
        const bar = document.getElementById('scrollProgress');
        if (!bar) return;
        const update = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const progress = max > 0 ? window.scrollY / max : 0;
            bar.style.transform = `scaleX(${progress})`;
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    function initScrollReveals() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if(e.isIntersecting) {
                    e.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });
        
        document.querySelectorAll('.reveal:not(.active)').forEach(el => {
            observer.observe(el);
        });
    }
  
    function ensureToastContainer() {
      let container = document.getElementById('toastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      return container;
    }
  
    function toast(message, type = 'info') {
      const container = ensureToastContainer();
      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      
      const icon = type === 'success' ? '<i class="ph ph-check-circle"></i>' : (type === 'error' ? '<i class="ph ph-warning-circle"></i>' : '<i class="ph ph-info"></i>');
      el.innerHTML = `${icon} <span>${message}</span>`;
      container.appendChild(el);
  
      requestAnimationFrame(() => el.classList.add('toast-visible'));
  
      setTimeout(() => {
        el.classList.remove('toast-visible');
        setTimeout(() => el.remove(), 300);
      }, 4000);
    }
  
    function openModal(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.add('modal-open');
      document.body.classList.add('modal-lock');
      const firstField = modal.querySelector('input, textarea, select, button');
      if (firstField) setTimeout(() => firstField.focus(), 50);
    }
  
    function closeModal(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.remove('modal-open');
      document.body.classList.remove('modal-lock');
    }
  
    function confirmAction(message, confirmLabel = 'Confirm') {
      return new Promise((resolve) => {
        let overlay = document.getElementById('confirmDialog');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'confirmDialog';
          overlay.className = 'modal-overlay';
          overlay.innerHTML = `
            <div class="modal-box modal-box-sm glass-panel">
              <h2 style="font-size:1.2rem; margin-bottom:12px; color:var(--danger-color);"><i class="ph ph-warning"></i> Action Required</h2>
              <p class="confirm-message" style="margin-bottom:24px; color:var(--text-color);"></p>
              <div class="modal-actions">
                <button type="button" class="btn-outline" data-action="cancel">Cancel</button>
                <button type="button" class="btn-danger" data-action="confirm"></button>
              </div>
            </div>`;
          document.body.appendChild(overlay);
        }
  
        overlay.querySelector('.confirm-message').textContent = message;
        const confirmBtn = overlay.querySelector('[data-action="confirm"]');
        confirmBtn.innerHTML = `<i class="ph ph-check"></i> ${confirmLabel}`;
  
        overlay.classList.add('modal-open');
        document.body.classList.add('modal-lock');
  
        function cleanup(result) {
          overlay.classList.remove('modal-open');
          document.body.classList.remove('modal-lock');
          confirmBtn.removeEventListener('click', onConfirm);
          cancelBtn.removeEventListener('click', onCancel);
          overlay.removeEventListener('click', onOverlay);
          resolve(result);
        }
  
        const cancelBtn = overlay.querySelector('[data-action="cancel"]');
        function onConfirm() { cleanup(true); }
        function onCancel() { cleanup(false); }
        function onOverlay(e) { if (e.target === overlay) cleanup(false); }
  
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        overlay.addEventListener('click', onOverlay);
      });
    }
  
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function formatDate(dateStr) {
      if (!dateStr) return 'TBA';
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
  
    function debounce(fn, wait = 200) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
      };
    }
  
    function setLoading(button, isLoading, loadingText = 'Processing...') {
      if (!button) return;
      if (isLoading) {
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = `<i class="ph ph-spinner-gap ph-spin"></i> ${loadingText}`;
        button.disabled = true;
      } else {
        button.innerHTML = button.dataset.originalHtml || button.innerHTML;
        button.disabled = false;
      }
    }
  
    return {
      toast, openModal, closeModal, confirmAction, escapeHtml, formatDate, debounce, setLoading,
      SPECIAL_THEMES, THEME_LABELS, initLocalTheme, applyEffectiveTheme, initInteractions, initScrollReveals, initScrollProgress
    };
  })();