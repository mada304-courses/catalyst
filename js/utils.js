/**
 * utils.js
 * ------------------------------------------------------------------
 * Small, dependency-free helpers shared by main.js and admin.js:
 * toasts, a promise-based confirm dialog, modal open/close, and a
 * couple of formatting/escaping functions. Kept framework-free to
 * match the rest of the project.
 * ------------------------------------------------------------------
 */

window.CatalystUtils = (function () {

  /* ---------------------------- Theme ---------------------------- */
  /**
   * The site has 6 themes total:
   *  - 2 MAIN themes (monochrome dark / monochrome light) — free for any
   *    visitor to toggle via the header button. Stored in localStorage only.
   *  - 4 SPECIAL themes — can only be turned on by an admin, per account,
   *    from the admin dashboard's Users page (profiles.theme in the DB).
   *    When an account has one assigned, it always overrides the toggle.
   */
  const SPECIAL_THEMES = ['gamedev', 'robotic', 'biological', 'space'];

  const THEME_LABELS = {
    gamedev: 'Retro Arcade 🕹️',
    robotic: 'Embedded Robotics 🤖',
    biological: 'Biological Lab 🧬',
    space: 'Deep Space 🚀',
  };

  /** Applies the stored dark/light preference. Call this immediately on
   *  page load (before auth resolves) to avoid a flash of the wrong theme. */
  function initLocalTheme() {
    if (localStorage.getItem('catalyst-theme') === 'light') {
      document.body.classList.add('light-mode');
    }
  }

  /**
   * Reconciles <body>'s theme classes with the given profile (or null for
   * a signed-out visitor). If the profile has an admin-assigned special
   * theme, that always wins. Otherwise falls back to the visitor's own
   * dark/light choice from localStorage.
   * @returns {{forced: boolean, theme: string|null}}
   */
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

  /* ---------------------------- Toasts ---------------------------- */

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

  /**
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   */
  function toast(message, type = 'info') {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);

    // Trigger enter animation
    requestAnimationFrame(() => el.classList.add('toast-visible'));

    setTimeout(() => {
      el.classList.remove('toast-visible');
      setTimeout(() => el.remove(), 250);
    }, 3800);
  }

  /* ---------------------------- Modals ----------------------------- */

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

  /**
   * Promise-based confirm dialog styled to match the site, used in place
   * of window.confirm() for destructive actions (e.g. deleting an event).
   * @returns {Promise<boolean>}
   */
  function confirmAction(message, confirmLabel = 'Confirm') {
    return new Promise((resolve) => {
      let overlay = document.getElementById('confirmDialog');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'confirmDialog';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
          <div class="modal-box modal-box-sm">
            <p class="confirm-message"></p>
            <div class="modal-actions">
              <button type="button" class="btn-outline" data-action="cancel">Cancel</button>
              <button type="button" class="btn-danger" data-action="confirm">Confirm</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
      }

      overlay.querySelector('.confirm-message').textContent = message;
      const confirmBtn = overlay.querySelector('[data-action="confirm"]');
      confirmBtn.textContent = confirmLabel;

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

  /* ------------------------- Formatting ------------------------- */

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

  function setLoading(button, isLoading, loadingText = 'Please wait…') {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.textContent = loadingText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  return {
    toast, openModal, closeModal, confirmAction, escapeHtml, formatDate, debounce, setLoading,
    SPECIAL_THEMES, THEME_LABELS, initLocalTheme, applyEffectiveTheme,
  };
})();
