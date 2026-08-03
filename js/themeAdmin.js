/*
 * themeAdmin.js
 * ------------------------------------------------------------------
 * Admin-only theme controls.
 * Presets are based on the supplied Catalyst multi-theme design:
 * Monochrome, Retro Arcade, Embedded Robotics, Biological Lab, Deep Space.
 * ------------------------------------------------------------------
 */

(function () {
    const PRESETS = {
        monochrome: {
            label: 'Black / White (Monochrome)',
            mode: 'monochrome',
            allow_user_toggle: true,
            theme_class: 'theme-mono-dark',
            colors: {
                dark: { bg: '#000000', text: '#ffffff', border: '#333333', accent: '#ffffff', hover: '#222222', card: '#111111' },
                light: { bg: '#ffffff', text: '#000000', border: '#e0e0e0', accent: '#000000', hover: '#f0f0f0', card: '#f9f9f9' }
            }
        },
        gamedev: {
            label: 'Retro Arcade / Game Development',
            mode: 'preset', theme_class: 'theme-gamedev', allow_user_toggle: false,
            colors: { bg: '#0d0614', text: '#ffe600', border: '#ff007f', accent: '#ff007f', hover: 'rgba(255, 0, 127, 0.16)', card: 'rgba(28, 12, 54, 0.9)' }
        },
        robotic: {
            label: 'Embedded Robotics',
            mode: 'preset', theme_class: 'theme-robotic', allow_user_toggle: false,
            colors: { bg: '#0a0f0d', text: '#00ff66', border: '#1a382b', accent: '#00ff66', hover: 'rgba(0, 255, 102, 0.09)', card: 'rgba(12, 24, 18, 0.85)' }
        },
        biological: {
            label: 'Biological / Cellular',
            mode: 'preset', theme_class: 'theme-biological', allow_user_toggle: false,
            colors: { bg: '#031716', text: '#d1fae5', border: '#0d9488', accent: '#10b981', hover: 'rgba(16, 185, 129, 0.12)', card: 'rgba(6, 40, 38, 0.85)' }
        },
        space: {
            label: 'Deep Space',
            mode: 'preset', theme_class: 'theme-space', allow_user_toggle: false,
            colors: { bg: '#050714', text: '#e2e8f0', border: '#2a385c', accent: '#00f0ff', hover: 'rgba(0, 240, 255, 0.12)', card: 'rgba(14, 20, 42, 0.82)' }
        },
        custom: {
            label: 'Custom Theme',
            mode: 'custom', theme_class: 'theme-custom', allow_user_toggle: false,
            colors: { bg: '#101010', text: '#ffffff', border: '#333333', accent: '#00ff9d', hover: '#1d1d1d', card: '#151515' }
        }
    };

    const fields = [
        ['bg', 'Background'], ['text', 'Text'], ['border', 'Borders'],
        ['accent', 'Accent'], ['hover', 'Hover background'], ['card', 'Cards']
    ];

    function mount() {
        const mountEl = document.getElementById('themeAdminMount');
        if (!mountEl || mountEl.dataset.ready) return;
        mountEl.dataset.ready = 'true';
        mountEl.innerHTML = `
          <div class="content-section">
            <h3>Public Theme</h3>
            <p class="admin-page-subtitle">Choose one of the supplied Catalyst themes. Only Monochrome lets visitors switch between black and white.</p>
            <div class="form-group">
              <label for="themePreset">Theme</label>
              <select id="themePreset">
                ${Object.entries(PRESETS).map(([key, p]) => `<option value="${key}">${p.label}</option>`).join('')}
              </select>
            </div>
            <div class="checkbox-row" style="margin-bottom:12px;">
              <input type="checkbox" id="themeAllowToggle">
              <label for="themeAllowToggle">Allow visitors to switch black / white</label>
            </div>
            <p class="form-hint">This switch is available only when Monochrome is selected.</p>
          </div>
          <div class="content-section" id="customThemeEditor" style="display:none;">
            <h3>Customize Theme</h3>
            <p class="admin-page-subtitle">Customize the site's core colors. Custom themes are always admin-controlled.</p>
            <div class="form-row theme-color-grid">
              ${fields.map(([key, label]) => `<div class="form-group"><label for="themeColor-${key}">${label}</label><div style="display:flex;gap:8px;align-items:center;"><input type="color" id="themeColor-${key}" style="width:52px;height:40px;padding:2px;"><input type="text" id="themeHex-${key}" maxlength="7" placeholder="#000000" style="flex:1;"></div></div>`).join('')}
            </div>
            <div class="modal-actions" style="justify-content:flex-start;">
              <button type="button" class="btn-outline" id="themeResetBtn">Reset Custom Colors</button>
            </div>
          </div>
          <div class="modal-actions" style="justify-content:flex-start;"><button type="button" class="btn-solid" id="themeSaveBtn">Save Theme</button></div>
          <div class="form-error-box" id="themeError"></div>`;

        document.getElementById('themePreset').addEventListener('change', updateVisibility);
        document.getElementById('themeAllowToggle').addEventListener('change', updateVisibility);
        document.getElementById('themeResetBtn').addEventListener('click', () => setColors(PRESETS.custom.colors));
        document.getElementById('themeSaveBtn').addEventListener('click', saveTheme);
        fields.forEach(([key]) => {
            const color = document.getElementById(`themeColor-${key}`);
            const hex = document.getElementById(`themeHex-${key}`);
            color.addEventListener('input', () => hex.value = color.value);
            hex.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) color.value = hex.value; });
        });
    }

    function setColors(colors) {
        fields.forEach(([key]) => {
            const value = colors?.[key] || PRESETS.custom.colors[key];
            document.getElementById(`themeColor-${key}`).value = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
            document.getElementById(`themeHex-${key}`).value = value;
        });
    }

    function updateVisibility() {
        const preset = document.getElementById('themePreset').value;
        const isMono = preset === 'monochrome';
        const isCustom = preset === 'custom';
        const allow = document.getElementById('themeAllowToggle');
        const editor = document.getElementById('customThemeEditor');
        allow.disabled = !isMono;
        if (!isMono) allow.checked = false;
        editor.style.display = isCustom ? '' : 'none';
        if (!isCustom) setColors(PRESETS[preset].colors);
    }

    async function loadThemeSettings() {
        mount();
        const errorBox = document.getElementById('themeError');
        errorBox.classList.remove('visible');
        const { data, error } = await window.CatalystDB.from('site_settings').select('value').eq('key', 'theme').maybeSingle();
        if (error) { errorBox.textContent = `Could not load theme settings: ${error.message}`; errorBox.classList.add('visible'); return; }
        const theme = data?.value || {};
        let preset = theme.preset || (theme.mode === 'custom' ? 'custom' : 'monochrome');
        if (!PRESETS[preset]) preset = 'monochrome';
        document.getElementById('themePreset').value = preset;
        document.getElementById('themeAllowToggle').checked = preset === 'monochrome' && theme.allow_user_toggle !== false;
        setColors(theme.colors?.custom || PRESETS[preset].colors);
        updateVisibility();
    }

    async function saveTheme() {
        const btn = document.getElementById('themeSaveBtn');
        const errorBox = document.getElementById('themeError');
        errorBox.classList.remove('visible');
        const preset = document.getElementById('themePreset').value;
        const isCustom = preset === 'custom';
        const colors = {};
        if (isCustom) {
            for (const [key] of fields) {
                const value = document.getElementById(`themeHex-${key}`).value.trim();
                if (!/^#[0-9a-fA-F]{6}$/.test(value)) { errorBox.textContent = `Invalid ${key} color. Use a six-digit HEX value.`; errorBox.classList.add('visible'); return; }
                colors[key] = value;
            }
        }
        const selected = PRESETS[preset];
        const value = {
            preset,
            mode: selected.mode,
            theme_class: selected.theme_class,
            allow_user_toggle: preset === 'monochrome' && document.getElementById('themeAllowToggle').checked,
            colors: { ...selected.colors, ...(isCustom ? { custom: colors } : {}) }
        };
        window.CatalystUtils.setLoading(btn, true, 'Saving…');
        try {
            const { error } = await window.CatalystDB.from('site_settings').upsert({ key: 'theme', value });
            if (error) throw error;
            window.CatalystUtils.toast('Theme saved. Reload the public site to see it.', 'success');
        } catch (err) { errorBox.textContent = err.message || 'Could not save theme settings.'; errorBox.classList.add('visible'); }
        finally { window.CatalystUtils.setLoading(btn, false); }
    }

    document.addEventListener('DOMContentLoaded', () => {
        mount();
        const originalAdminGoTo = window.adminGoTo;
        if (typeof originalAdminGoTo === 'function') {
            window.adminGoTo = function (page) { originalAdminGoTo(page); if (page === 'theme') loadThemeSettings(); };
        }
        if (document.getElementById('admin-theme')?.classList.contains('active')) loadThemeSettings();
    });
    window.loadThemeSettings = loadThemeSettings;
})();