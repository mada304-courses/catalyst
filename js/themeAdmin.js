/*
 * themeAdmin.js
 * ------------------------------------------------------------------
 * Admin-only theme controls. The admin page itself is already protected
 * by admin.js and the database write is protected by Supabase RLS.
 * ------------------------------------------------------------------
 */

(function () {
    const DEFAULTS = {
        mode: 'monochrome',
        allow_user_toggle: true,
        colors: {
            dark: { bg: '#000000', text: '#ffffff', border: '#333333', accent: '#ffffff', hover: '#222222', card: '#111111' },
            light: { bg: '#ffffff', text: '#000000', border: '#e0e0e0', accent: '#000000', hover: '#f0f0f0', card: '#f9f9f9' },
            custom: { bg: '#101010', text: '#ffffff', border: '#333333', accent: '#00ff9d', hover: '#1d1d1d', card: '#151515' }
        }
    };

    const fields = [
        ['bg', 'Background'],
        ['text', 'Text'],
        ['border', 'Borders'],
        ['accent', 'Accent'],
        ['hover', 'Hover background'],
        ['card', 'Cards']
    ];

    function esc(value) {
        return window.CatalystUtils.escapeHtml(value || '');
    }

    function mount() {
        const mountEl = document.getElementById('themeAdminMount');
        if (!mountEl || mountEl.dataset.ready) return;
        mountEl.dataset.ready = 'true';

        mountEl.innerHTML = `
          <div class="content-section">
            <h3>Public Theme Mode</h3>
            <p class="admin-page-subtitle">Monochrome keeps the existing black/white switch. Custom locks visitors to the palette you define below.</p>
            <div class="form-group">
              <label for="themeMode">Theme mode</label>
              <select id="themeMode">
                <option value="monochrome">Black / White (Monochrome)</option>
                <option value="custom">Custom Theme</option>
              </select>
            </div>
            <div class="checkbox-row" style="margin-bottom:12px;">
              <input type="checkbox" id="themeAllowToggle">
              <label for="themeAllowToggle">Allow visitors to switch black/white mode</label>
            </div>
            <p class="form-hint">This option only applies to Monochrome mode. Custom Theme is always admin-controlled.</p>
          </div>

          <div class="content-section" id="customThemeEditor">
            <h3>Customize Colors</h3>
            <p class="admin-page-subtitle">Choose the site's background, text, borders, accent, hover, and card colors.</p>
            <div class="form-row theme-color-grid">
              ${fields.map(([key, label]) => `
                <div class="form-group">
                  <label for="themeColor-${key}">${label}</label>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input type="color" id="themeColor-${key}" style="width:52px; height:40px; padding:2px;">
                    <input type="text" id="themeHex-${key}" maxlength="7" placeholder="#000000" style="flex:1;">
                  </div>
                </div>`).join('')}
            </div>
            <div class="modal-actions" style="justify-content:flex-start;">
              <button type="button" class="btn-outline" id="themeResetBtn">Reset Custom Colors</button>
              <button type="button" class="btn-solid" id="themeSaveBtn">Save Theme</button>
            </div>
            <div class="form-error-box" id="themeError"></div>
          </div>
        `;

        document.getElementById('themeMode').addEventListener('change', updateVisibility);
        document.getElementById('themeResetBtn').addEventListener('click', () => setColors(DEFAULTS.colors.custom));
        document.getElementById('themeSaveBtn').addEventListener('click', saveTheme);

        fields.forEach(([key]) => {
            const color = document.getElementById(`themeColor-${key}`);
            const hex = document.getElementById(`themeHex-${key}`);
            color.addEventListener('input', () => { hex.value = color.value; });
            hex.addEventListener('input', () => {
                if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) color.value = hex.value;
            });
        });
    }

    function setColors(colors) {
        fields.forEach(([key]) => {
            const value = /^#[0-9a-fA-F]{6}$/.test(colors?.[key] || '') ? colors[key] : DEFAULTS.colors.custom[key];
            document.getElementById(`themeColor-${key}`).value = value;
            document.getElementById(`themeHex-${key}`).value = value;
        });
    }

    function updateVisibility() {
        const mode = document.getElementById('themeMode').value;
        const customEditor = document.getElementById('customThemeEditor');
        const allow = document.getElementById('themeAllowToggle');
        const custom = mode === 'custom';
        customEditor.style.display = '';
        allow.disabled = custom;
        if (custom) allow.checked = false;
    }

    async function loadThemeSettings() {
        mount();
        const errorBox = document.getElementById('themeError');
        errorBox.classList.remove('visible');

        const { data, error } = await window.CatalystDB
            .from('site_settings')
            .select('value')
            .eq('key', 'theme')
            .maybeSingle();

        if (error) {
            errorBox.textContent = `Could not load theme settings: ${error.message}`;
            errorBox.classList.add('visible');
            return;
        }

        const theme = data?.value || DEFAULTS;
        document.getElementById('themeMode').value = theme.mode === 'custom' ? 'custom' : 'monochrome';
        document.getElementById('themeAllowToggle').checked = theme.mode === 'monochrome' && theme.allow_user_toggle !== false;
        setColors(theme.colors?.custom || DEFAULTS.colors.custom);
        updateVisibility();
    }

    async function saveTheme() {
        const btn = document.getElementById('themeSaveBtn');
        const errorBox = document.getElementById('themeError');
        errorBox.classList.remove('visible');

        const mode = document.getElementById('themeMode').value;
        const colors = {};
        for (const [key] of fields) {
            const value = document.getElementById(`themeHex-${key}`).value.trim();
            if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
                errorBox.textContent = `Invalid ${key} color. Use a six-digit HEX value such as #000000.`;
                errorBox.classList.add('visible');
                return;
            }
            colors[key] = value;
        }

        const value = {
            mode,
            allow_user_toggle: mode === 'monochrome' && document.getElementById('themeAllowToggle').checked,
            colors: {
                dark: DEFAULTS.colors.dark,
                light: DEFAULTS.colors.light,
                custom: colors
            }
        };

        window.CatalystUtils.setLoading(btn, true, 'Saving…');
        try {
            const { error } = await window.CatalystDB.from('site_settings').upsert({ key: 'theme', value });
            if (error) throw error;
            window.CatalystUtils.toast('Theme saved. Reload the public site to see the new theme.', 'success');
        } catch (err) {
            errorBox.textContent = err.message || 'Could not save theme settings.';
            errorBox.classList.add('visible');
        } finally {
            window.CatalystUtils.setLoading(btn, false);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        mount();

        const originalAdminGoTo = window.adminGoTo;
        if (typeof originalAdminGoTo === 'function') {
            window.adminGoTo = function (page) {
                originalAdminGoTo(page);
                if (page === 'theme') loadThemeSettings();
            };
        }

        // If the initial page is ever changed to Theme later, this remains safe.
        if (document.getElementById('admin-theme')?.classList.contains('active')) loadThemeSettings();
    });

    window.loadThemeSettings = loadThemeSettings;
})();
