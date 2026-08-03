/*
 * theme.js
 * ------------------------------------------------------------------
 * Global theme engine.
 *
 * The admin controls whether the public site is in:
 *   1. monochrome mode: visitors may toggle black/white;
 *   2. custom mode: visitors see the admin-selected palette and cannot
 *      change it.
 *
 * The database is the source of truth. localStorage only remembers the
 * visitor's black/white choice while monochrome mode is active.
 * ------------------------------------------------------------------
 */

(function () {
    const DEFAULT_THEME = {
        mode: 'monochrome',
        allow_user_toggle: true,
        colors: {
            dark: { bg: '#000000', text: '#ffffff', border: '#333333', accent: '#ffffff', hover: '#222222', card: '#111111' },
            light: { bg: '#ffffff', text: '#000000', border: '#e0e0e0', accent: '#000000', hover: '#f0f0f0', card: '#f9f9f9' }
        }
    };

    let currentTheme = DEFAULT_THEME;
    let currentMode = localStorage.getItem('catalyst-theme') === 'light' ? 'light' : 'dark';

    function safeColor(value, fallback) {
        if (typeof value !== 'string') return fallback;
        const v = value.trim();
        return /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v) ? v : fallback;
    }

    function applyColors(colors) {
        const root = document.documentElement;
        root.style.setProperty('--bg-color', safeColor(colors.bg, '#000000'));
        root.style.setProperty('--text-color', safeColor(colors.text, '#ffffff'));
        root.style.setProperty('--border-color', safeColor(colors.border, '#333333'));
        root.style.setProperty('--accent-color', safeColor(colors.accent, '#ffffff'));
        root.style.setProperty('--hover-bg', safeColor(colors.hover, '#222222'));
        root.style.setProperty('--card-bg', safeColor(colors.card, '#111111'));
    }

    function applyTheme(theme) {
        currentTheme = theme || DEFAULT_THEME;
        const mode = currentTheme.mode === 'custom' ? 'custom' : 'monochrome';

        document.body.classList.toggle('light-mode', mode === 'monochrome' && currentMode === 'light');

        if (mode === 'custom') {
            applyColors(currentTheme.colors?.custom || DEFAULT_THEME.colors.dark);
        } else {
            applyColors(currentMode === 'light' ? DEFAULT_THEME.colors.light : DEFAULT_THEME.colors.dark);
        }

        const btn = document.getElementById('themeBtn');
        if (btn) {
            btn.textContent = mode === 'monochrome' ? (currentMode === 'light' ? 'DARK MODE' : 'LIGHT MODE') : 'THEME LOCKED';
            btn.disabled = mode === 'custom' || currentTheme.allow_user_toggle === false;
            btn.title = mode === 'custom' ? 'Theme controlled by administrator' : 'Switch black/white mode';
        }
    }

    window.CatalystTheme = {
        get: () => currentTheme,
        apply: applyTheme,
        isMonochrome: () => currentTheme.mode !== 'custom',
        toggle: function () {
            if (currentTheme.mode === 'custom' || currentTheme.allow_user_toggle === false) return;
            currentMode = currentMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('catalyst-theme', currentMode);
            applyTheme(currentTheme);
        }
    };

    // Override the existing public toggle without requiring a risky rewrite of main.js.
    window.toggleTheme = () => window.CatalystTheme.toggle();

    document.addEventListener('DOMContentLoaded', async () => {
        applyTheme(DEFAULT_THEME);

        if (!window.CatalystDB) return;
        const { data, error } = await window.CatalystDB
            .from('site_settings')
            .select('value')
            .eq('key', 'theme')
            .maybeSingle();

        if (!error && data?.value) {
            applyTheme(data.value);
        }
    });
})();
