/* Global theme engine. The admin-selected database theme is authoritative. */
(function () {
    const MONO = {
        dark: { bg:'#000000', text:'#ffffff', border:'#333333', accent:'#ffffff', hover:'#222222', card:'#111111' },
        light: { bg:'#ffffff', text:'#000000', border:'#e0e0e0', accent:'#000000', hover:'#f0f0f0', card:'#f9f9f9' }
    };
    const PRESETS = {
        monochrome: 'theme-mono-dark',
        gamedev: 'theme-gamedev',
        robotic: 'theme-robotic',
        biological: 'theme-biological',
        space: 'theme-space',
        custom: 'theme-custom'
    };
    let currentTheme = { preset:'monochrome', mode:'monochrome', allow_user_toggle:true };
    let currentMode = localStorage.getItem('catalyst-theme') === 'light' ? 'light' : 'dark';

    function safeColor(value, fallback) {
        return typeof value === 'string' && (/^#[0-9a-fA-F]{3}$/.test(value.trim()) || /^#[0-9a-fA-F]{6}$/.test(value.trim())) ? value.trim() : fallback;
    }
    function applyColors(colors) {
        const root = document.documentElement;
        root.style.setProperty('--bg-color', safeColor(colors?.bg, '#000000'));
        root.style.setProperty('--text-color', safeColor(colors?.text, '#ffffff'));
        root.style.setProperty('--border-color', safeColor(colors?.border, '#333333'));
        root.style.setProperty('--accent-color', safeColor(colors?.accent, '#ffffff'));
        root.style.setProperty('--hover-bg', safeColor(colors?.hover, '#222222'));
        root.style.setProperty('--card-bg', safeColor(colors?.card, '#111111'));
    }
    function clearPresetClasses() {
        Object.values(PRESETS).forEach(c => document.body.classList.remove(c));
        document.body.classList.remove('light-mode');
    }
    function applyTheme(theme) {
        currentTheme = theme || currentTheme;
        const preset = PRESETS[currentTheme.preset] ? currentTheme.preset : (currentTheme.mode === 'custom' ? 'custom' : 'monochrome');
        clearPresetClasses();
        document.body.classList.add(PRESETS[preset]);

        if (preset === 'monochrome') {
            document.body.classList.toggle('light-mode', currentMode === 'light');
            applyColors(currentMode === 'light' ? MONO.light : MONO.dark);
        } else if (preset === 'custom' || currentTheme.mode === 'custom') {
            applyColors(currentTheme.colors?.custom || {});
        } else {
            // Preset colors are defined in css/themes.css; remove inline overrides
            // so the complete preset palette/effects remain intact.
            ['--bg-color','--text-color','--border-color','--accent-color','--hover-bg','--card-bg'].forEach(p => document.documentElement.style.removeProperty(p));
        }

        const btn = document.getElementById('themeBtn');
        if (btn) {
            const mono = preset === 'monochrome';
            btn.style.display = mono ? '' : 'none';
            btn.disabled = !mono || currentTheme.allow_user_toggle === false;
            btn.textContent = mono ? (currentMode === 'light' ? 'DARK MODE' : 'LIGHT MODE') : 'THEME LOCKED';
            btn.title = mono ? 'Switch black/white mode' : 'Theme controlled by administrator';
        }
    }
    window.CatalystTheme = {
        get: () => currentTheme,
        apply: applyTheme,
        toggle: function () {
            if (currentTheme.preset !== 'monochrome' || currentTheme.allow_user_toggle === false) return;
            currentMode = currentMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('catalyst-theme', currentMode);
            applyTheme(currentTheme);
        }
    };
    window.toggleTheme = () => window.CatalystTheme.toggle();

    document.addEventListener('DOMContentLoaded', async () => {
        applyTheme(currentTheme);
        if (!window.CatalystDB) return;
        const { data, error } = await window.CatalystDB.from('site_settings').select('value').eq('key','theme').maybeSingle();
        if (!error && data?.value) applyTheme(data.value);
    });
})();