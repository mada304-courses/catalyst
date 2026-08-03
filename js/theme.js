// Themes Configuration
const themes = [
    { class: '', name: 'THEME 1/6: MONOCHROME DARK ⬛', transition: 'trans-center' },
    { class: 'theme-mono-light', name: 'THEME 2/6: MONOCHROME LIGHT ⬜', transition: 'trans-center' },
    { class: 'theme-gamedev', name: 'THEME 3/6: RETRO ARCADE 🕹️', transition: 'trans-pixel' },
    { class: 'theme-robotic', name: 'THEME 4/6: EMBEDDED ROBOTICS 🤖', transition: 'trans-robotic' },
    { class: 'theme-biological', name: 'THEME 5/6: BIOLOGICAL LAB 🧬', transition: 'trans-sinewave' },
    { class: 'theme-space', name: 'THEME 6/6: DEEP SPACE 🚀', transition: 'trans-hyperspace' }
];

let currentThemeIndex = 0;
let isTransitioning = false;

// DOM INITIALIZATION FOR TRANSITIONS
document.addEventListener('DOMContentLoaded', () => {
    const pixelGrid = document.getElementById('pixelGrid');
    const matrixContainer = document.getElementById('matrixContainer');

    // Initialize Pixel Block Overlay
    if (pixelGrid) {
        for (let i = 0; i < 25; i++) {
            const block = document.createElement('div');
            block.className = 'pixel-block';
            block.style.animationDelay = `${(i % 5) * 0.04 + Math.floor(i / 5) * 0.04}s`;
            pixelGrid.appendChild(block);
        }
    }

    // Initialize Matrix Columns Overlay
    if (matrixContainer) {
        for (let i = 0; i < 25; i++) {
            const col = document.createElement('div');
            col.className = 'matrix-column';
            col.style.left = `${i * 4}%`;
            col.style.animationDelay = `${Math.random() * 0.2}s`;
            matrixContainer.appendChild(col);
        }
    }

    // Restore saved theme on load across pages
    const savedTheme = localStorage.getItem('catalystTheme');
    if (savedTheme !== null) {
        currentThemeIndex = parseInt(savedTheme, 10);
        applyThemeState(currentThemeIndex);
    }
});

function cycleTheme() {
    if (isTransitioning) return;
    isTransitioning = true;

    const overlay = document.getElementById('transitionOverlay');
    if (!overlay) return; // Prevent crash if overlay is missing
    
    const nextThemeIndex = (currentThemeIndex + 1) % themes.length;
    const targetTheme = themes[nextThemeIndex];

    overlay.className = '';
    document.body.classList.remove('anim-hyperspace-active');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {

            if (targetTheme.transition === 'trans-hyperspace') {
                overlay.classList.add('trans-hyperspace');
                document.body.classList.add('anim-hyperspace-active');

                setTimeout(() => { applyThemeState(nextThemeIndex); }, 200);
                setTimeout(() => {
                    document.body.classList.remove('anim-hyperspace-active');
                    overlay.className = '';
                    isTransitioning = false;
                }, 1400);
            }
            else if (targetTheme.transition === 'trans-pixel') {
                overlay.classList.add('trans-pixel');

                setTimeout(() => {
                    applyThemeState(nextThemeIndex);
                    overlay.classList.add('trans-pixel-reveal');
                }, 400);

                setTimeout(() => {
                    overlay.className = '';
                    isTransitioning = false;
                }, 900);
            }
            else if (targetTheme.transition === 'trans-robotic') {
                overlay.classList.add('trans-robotic');
                setTimeout(() => { applyThemeState(nextThemeIndex); }, 350);
                setTimeout(() => { overlay.className = ''; isTransitioning = false; }, 750);
            }
            else if (targetTheme.transition === 'trans-sinewave') {
                overlay.classList.add('trans-sinewave');
                setTimeout(() => { applyThemeState(nextThemeIndex); }, 350);
                setTimeout(() => { overlay.className = ''; isTransitioning = false; }, 850);
            }
            else {
                overlay.classList.add('trans-center');
                setTimeout(() => { applyThemeState(nextThemeIndex); }, 300);
                setTimeout(() => { overlay.className = ''; isTransitioning = false; }, 650);
            }
        });
    });
}

function applyThemeState(nextIndex) {
    if (themes[currentThemeIndex].class) {
        document.body.classList.remove(themes[currentThemeIndex].class);
    }

    currentThemeIndex = nextIndex;

    if (themes[currentThemeIndex].class) {
        document.body.classList.add(themes[currentThemeIndex].class);
    }

    const indicator = document.getElementById('themeIndicator');
    if (indicator) {
        indicator.textContent = themes[currentThemeIndex].name;
    }
    
    // Save theme to localStorage so navigating pages doesn't reset it
    localStorage.setItem('catalystTheme', currentThemeIndex);
}
