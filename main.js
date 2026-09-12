const U = window.CatalystUtils;
let allEvents = []; 

function openTab(event, tabName) {
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Re-trigger scroll reveals
    setTimeout(() => U.initScrollReveals(), 50);
}

function toggleTheme() {
    const btn = document.getElementById('themeBtn');
    
    // Only operate if the effective theme is monochrome
    const isSpecialTheme = U.SPECIAL_THEMES.some(t => document.body.classList.contains(`theme-${t}`));
    if (isSpecialTheme) return;

    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('catalyst-theme', isLight ? 'light' : 'dark');
    
    // Update button icon dynamically
    if(btn) {
        btn.innerHTML = isLight ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon-stars"></i>';
    }
}

function initTheme() {
    U.initLocalTheme();
    const isLight = document.body.classList.contains('light-mode');
    const btn = document.getElementById('themeBtn');
    if(btn) {
        btn.innerHTML = isLight ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon-stars"></i>';
    }
}

function applyThemeUI(profile) {
    const result = U.applyEffectiveTheme(profile);
    const badge = document.getElementById('accountThemeBadge');

    if (result.forced && badge) {
        badge.innerHTML = `<i class="ph ph-swatches"></i> ${U.THEME_LABELS[result.theme] || result.theme} (SYSADM)`;
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '6px';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.event-card');

    if (query.length > 0) {
        document.querySelector("button[onclick*='events']").click();
    }

    cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? 'flex' : 'none';
    });
}

function eventCardHtml(ev) {
    
    let mediaHtml = '';
    let logoHtml = '';
    if (ev.event_media && Array.isArray(ev.event_media)) {
        const publishedMedia = ev.event_media.filter(m => m.published).sort((a,b) => a.sort_order - b.sort_order);
        const logos = publishedMedia.filter(m => m.media_type === 'logo');
        const photos = publishedMedia.filter(m => m.media_type === 'photo');
        
        if (logos.length > 0) {
            logoHtml = `<div style="margin-bottom:15px; text-align:center;"><img src="${U.escapeHtml(logos[0].media_url)}" alt="${U.escapeHtml(logos[0].alt_text || ev.title)}" style="max-height:80px; max-width:100%; object-fit:contain;" loading="lazy"></div>`;
        }
        if (photos.length > 0) {
            mediaHtml = `<div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px; margin-top:15px;">` + 
                photos.map(p => `<img src="${U.escapeHtml(p.media_url)}" alt="${U.escapeHtml(p.alt_text || 'Activity')}" style="height:120px; border-radius:var(--radius-sm); object-fit:cover;" loading="lazy">`).join('') +
                `</div>`;
        }
    }

    const tags = (ev.tags || []).map((t) => `<span class="tag">${U.escapeHtml(t)}</span>`).join('');
    const capacity = ev.capacity ? `<p><i class="ph ph-users"></i> <strong>Capacity:</strong> ${U.escapeHtml(String(ev.capacity))}</p>` : '';
    const organizer = ev.organizer ? `<p><i class="ph ph-user-circle"></i> <strong>Organizer:</strong> ${U.escapeHtml(ev.organizer)}</p>` : '';
    const description = ev.description ? `<p style="margin-top: 8px; opacity:0.8;">${U.escapeHtml(ev.description)}</p>` : '';
    const registration = ev.registration_url
        ? `<a class="register-link" href="${U.escapeHtml(ev.registration_url)}" target="_blank" rel="noopener">Access Portal <i class="ph ph-arrow-up-right"></i></a>`
        : '';
    const statusPill = ev.status === 'past' ? ' <span class="badge" style="background:transparent; border-color:var(--text-muted); color:var(--text-muted); margin-left:auto;">ARCHIVED</span>' : '';

    return `
      <div class="card event-card reveal">
        <h3 style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <i class="ph ph-terminal"></i> ${U.escapeHtml(ev.category || 'EVENT')} ${statusPill}
        </h3>
        ${logoHtml}
        <p style="margin-top:12px;"><i class="ph ph-bookmark"></i> <strong>Topic:</strong> ${U.escapeHtml(ev.topic || ev.title)}</p>
        <p><i class="ph ph-calendar-blank"></i> <strong>Date:</strong> ${U.formatDate(ev.event_date)}${ev.event_time ? ' · ' + U.escapeHtml(ev.event_time) : ''}</p>
        ${ev.location ? `<p><i class="ph ph-map-pin"></i> <strong>Location:</strong> ${U.escapeHtml(ev.location)}</p>` : ''}
        ${capacity}
        ${organizer}
        ${description}
        ${mediaHtml}
        ${tags ? `<div class="event-tags">${tags}</div>` : ''}
        ${registration}
      </div>`;
}

async function loadPublicEvents() {
    const grid = document.getElementById('eventsGrid');
    if (!grid) return;
    grid.innerHTML = `<div class="loading-state reveal"><i class="ph ph-spinner-gap ph-spin"></i> Initializing events...</div>`;

    const { data, error } = await window.CatalystDB
        .from('events')
        .select('*, event_media(*)')
        .eq('published', true)
        .order('event_date', { ascending: true, nullsFirst: false });

    if (error) {
        console.error('[Catalyst] DB Error:', error.message);
        grid.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning"></i> Error loading grid payload.</div>`;
        return;
    }

    allEvents = data || [];

    if (allEvents.length === 0) {
        grid.innerHTML = `<div class="empty-state reveal"><i class="ph ph-empty"></i> No active events in the network.</div>`;
        return;
    }

    grid.innerHTML = allEvents.map(eventCardHtml).join('');
    setTimeout(() => U.initScrollReveals(), 50);
}

/* ============================== Team (public) ============================== */

// Used for members with no image_url in the database — a neutral silhouette
// so the grid never shows an empty card (this is NOT a real member's photo).
const TEAM_PLACEHOLDER_PHOTO = 'img/team-placeholder.svg';

function memberCardHtml(m, index) {
    const src = m.image_url || TEAM_PLACEHOLDER_PHOTO;
    const photo = `<div class="member-photo-wrap"><img src="${U.escapeHtml(src)}" alt="${U.escapeHtml(m.name)}" loading="lazy"></div>`;
    const role = m.role ? `<p style="margin-bottom:8px; color:var(--accent-color); font-weight:600; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;">${U.escapeHtml(m.role)}</p>` : '';
    const bio = m.bio ? `<p style="opacity:0.85;">${U.escapeHtml(m.bio)}</p>` : '';

    return `
      <div class="card reveal" style="align-items:center; text-align:center;">
        ${photo}
        <h3 style="border:none; margin-bottom:2px; justify-content:center;">${U.escapeHtml(m.name)}</h3>
        ${role}
        ${bio}
      </div>`;
}

async function loadTeamMembers() {
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    grid.innerHTML = `<div class="loading-state reveal"><i class="ph ph-spinner-gap ph-spin"></i> Loading team…</div>`;

    const { data, error } = await window.CatalystDB
        .from('team_members')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('[Catalyst] DB Error:', error.message);
        grid.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning"></i> Error loading team roster.</div>`;
        return;
    }

    const members = data || [];

    if (members.length === 0) {
        grid.innerHTML = `<div class="empty-state reveal"><i class="ph ph-identification-badge"></i> Team information not available yet.</div>`;
        return;
    }

    grid.innerHTML = members.map((m, i) => memberCardHtml(m, i)).join('');
    setTimeout(() => U.initScrollReveals(), 50);
}

async function loadSiteContent() {
    const { data, error } = await window.CatalystDB.from('site_settings').select('key, value');
    if (error) return;
    const settings = {};
    (data || []).forEach((row) => { settings[row.key] = row.value; });

    if (settings.banner) {
        const banner = document.getElementById('constructionBanner');
        if (banner) {
            banner.innerHTML = `<i class="ph ph-warning-circle"></i> ${U.escapeHtml(settings.banner.text || banner.textContent)}`;
            banner.style.display = settings.banner.enabled === false ? 'none' : 'flex';
        }
    }
    if (settings.home) {
        setText('homeHeading', settings.home.heading);
        setText('homeIntro', settings.home.intro);
        setText('homeCtaHeading', settings.home.cta_heading, '<i class="ph ph-bell-ringing"></i> ');
        setText('homeCtaText', settings.home.cta_text);
    }
    
    if (settings.community) {
        const wrapper = document.getElementById('communityCtaWrapper');
        const textEl = document.getElementById('communityCtaText');
        const linkEl = document.getElementById('communitySlackLink');
        if (wrapper && textEl && linkEl) {
            textEl.textContent = settings.community.text || 'Connect with peers and mentors';
            linkEl.href = settings.community.url || '#';
            wrapper.style.display = settings.community.enabled === false ? 'none' : 'block';
        }
    }

    if (settings.about) {
        setText('aboutHeading', settings.about.heading);
        const paragraphs = Array.isArray(settings.about.paragraphs) && settings.about.paragraphs.length
            ? settings.about.paragraphs
            : [settings.about.paragraph1, settings.about.paragraph2].filter(Boolean);
        const wrap = document.getElementById('aboutParagraphs');
        if (wrap && paragraphs.length) {
            wrap.innerHTML = paragraphs.map((p) => `<p>${U.escapeHtml(p)}</p>`).join('');
        }
    }
    if (settings.more) {
        setText('moreSponsorship', settings.more.sponsorship_text);
        setText('moreVolunteer', settings.more.volunteer_text);
    }
    if (settings.footer) {
        setText('footerText', settings.footer.text);
    }
}

function setText(id, value, prefix = '') {
    if (value === undefined || value === null) return;
    const el = document.getElementById(id);
    if (el) el.innerHTML = prefix + U.escapeHtml(value);
}

function handleSubscribe(event) {
    event.preventDefault();
    U.toast("Connection established. Added to telemetry list.", 'success');
    event.target.reset();
}

function renderAuthArea(state) {
    const area = document.getElementById('authArea');
    if (!area) return;
    const adminNavItem = document.getElementById('adminNavTab');

    if (state.session?.user && state.profile) {
        const displayString = state.profile.full_name || state.profile.email || window.CatalystAuth.getSession()?.user?.email || '?';
        const initials = displayString.trim().charAt(0).toUpperCase();
        area.innerHTML = `
          <div class="auth-controls">
            <div class="user-chip">
              <span class="avatar">${U.escapeHtml(initials)}</span>
              <span>${U.escapeHtml(state.profile.full_name || state.profile.email || window.CatalystAuth.getSession()?.user?.email || 'User')}</span>
              ${state.profile.role === 'admin' ? '<span class="badge badge-admin">SYSADM</span>' : ''}
            </div>
            <span class="points-pill" id="myPointsBadge" style="display:none;"><i class="ph ph-trophy"></i> 0 pts</span>
            <button type="button" class="btn-outline" id="logoutBtn"><i class="ph ph-sign-out"></i></button>
          </div>`;
        document.getElementById('logoutBtn').addEventListener('click', handleLogoutClick);

        if (adminNavItem) adminNavItem.style.display = state.profile.role === 'admin' ? 'block' : 'none';
        refreshMyPoints();
    } else {
        area.innerHTML = `
          <div class="auth-controls">
            <button type="button" class="btn-outline" onclick="U.openModal('authModal'); showAuthPanel('login')">Log In</button>
            <button type="button" class="btn-glow" onclick="U.openModal('authModal'); showAuthPanel('signup')">Sign Up</button>
          </div>`;
        if (adminNavItem) adminNavItem.style.display = 'none';
    }
    applyThemeUI(state.profile);
}

async function handleLogoutClick() {
    try {
        await window.CatalystAuth.signOut();
        U.toast('Disconnected successfully.', 'success');
    } catch (err) {
        U.toast(err.message || 'Disconnection failed.', 'error');
    }
}

function showAuthPanel(panel) {
    ['login', 'signup', 'forgot'].forEach((p) => {
        document.getElementById(`authPanel-${p}`).style.display = p === panel ? 'block' : 'none';
    });
    clearAuthMessages();
}

function clearAuthMessages() {
    document.querySelectorAll('#authModal .form-error-box, #authModal .form-success-box').forEach((el) => {
        el.classList.remove('visible');
        el.textContent = '';
    });
}

function showAuthError(panel, message) {
    const box = document.getElementById(`authError-${panel}`);
    box.innerHTML = `<i class="ph ph-warning"></i> ${U.escapeHtml(message)}`;
    box.classList.add('visible');
}

function showAuthSuccess(panel, message) {
    const box = document.getElementById(`authSuccess-${panel}`);
    box.innerHTML = `<i class="ph ph-check-circle"></i> ${U.escapeHtml(message)}`;
    box.classList.add('visible');
}

async function handleSignupSubmit(event) {
    event.preventDefault();
    clearAuthMessages();

    const fullName = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const submitBtn = document.getElementById('signupSubmitBtn');

    if (fullName.length < 2) return showAuthError('signup', 'Pilot designation required.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showAuthError('signup', 'Invalid protocol address.');
    if (password.length < 8) return showAuthError('signup', 'Security key must be 8+ characters.');
    if (password !== confirm) return showAuthError('signup', 'Keys do not match.');

    U.setLoading(submitBtn, true, 'Creating identity…');
    try {
        const data = await window.CatalystAuth.signUp({ fullName, email, password });
        if (!data.session) {
            showAuthSuccess('signup', 'Identity registered. Awaiting protocol confirmation (check email).');
            event.target.reset();
        } else {
            U.toast('Identity confirmed. Welcome to the grid.', 'success');
            U.closeModal('authModal');
            event.target.reset();
        }
    } catch (err) {
        showAuthError('signup', err.message || 'Identity creation failed.');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    clearAuthMessages();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (!email || !password) return showAuthError('login', 'Credentials required.');

    U.setLoading(submitBtn, true, 'Authenticating…');
    try {
        await window.CatalystAuth.signIn({ email, password });
        U.toast('Authentication successful.', 'success');
        U.closeModal('authModal');
        event.target.reset();
    } catch (err) {
        showAuthError('login', err.message || 'Invalid credentials.');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

async function handleForgotSubmit(event) {
    event.preventDefault();
    clearAuthMessages();

    const email = document.getElementById('forgotEmail').value.trim();
    const submitBtn = document.getElementById('forgotSubmitBtn');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showAuthError('forgot', 'Invalid address.');

    U.setLoading(submitBtn, true, 'Transmitting…');
    try {
        await window.CatalystAuth.sendPasswordReset(email);
        showAuthSuccess('forgot', 'Reset packet transmitted if identity exists.');
        event.target.reset();
    } catch (err) {
        showAuthError('forgot', err.message || 'Transmission failed.');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

function openResetPasswordModal() {
    U.openModal('resetPasswordModal');
}

async function handleResetPasswordSubmit(event) {
    event.preventDefault();
    const box = document.getElementById('resetError');
    box.classList.remove('visible');

    const pw1 = document.getElementById('resetPassword1').value;
    const pw2 = document.getElementById('resetPassword2').value;
    const submitBtn = document.getElementById('resetSubmitBtn');

    if (pw1.length < 8) { box.innerHTML = '<i class="ph ph-warning"></i> Key too short.'; box.classList.add('visible'); return; }
    if (pw1 !== pw2) { box.innerHTML = '<i class="ph ph-warning"></i> Keys mismatch.'; box.classList.add('visible'); return; }

    U.setLoading(submitBtn, true, 'Encrypting…');
    try {
        await window.CatalystAuth.updatePassword(pw1);
        await window.CatalystAuth.refreshProfile();
        U.toast('Security updated. Connection secure.', 'success');
        U.closeModal('resetPasswordModal');
        event.target.reset();
    } catch (err) {
        box.innerHTML = `<i class="ph ph-warning"></i> ${U.escapeHtml(err.message)}`;
        box.classList.add('visible');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

function initBootLoader() {
    const loader = document.getElementById('bootLoader');
    const status = document.getElementById('bootStatus');
    if (!loader) return;
    const messages = ['Loading interface...', 'Connecting modules...', 'System ready.'];
    let i = 0;
    const interval = setInterval(() => {
        if (status) status.textContent = messages[i++ % messages.length];
    }, 350);
    window.addEventListener('load', () => {
        clearInterval(interval);
        setTimeout(() => loader.classList.add('boot-hide'), 500);
    });
}

function initHeaderEffects() {
    const header = document.querySelector('.glass-header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        header.classList.toggle('is-scrolled', window.scrollY > 20);
    }, {passive:true});
}

function initKonamiEgg() {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'];
    let input=[];
    window.addEventListener('keydown', e => {
        input.push(e.key);
        input=input.slice(-code.length);
        if(input.join('|')===code.join('|')) {
            const layer=document.createElement('div');
            layer.className='easter-egg-layer';
            for(let i=0;i<35;i++){
                const g=document.createElement('span');
                g.className='easter-egg-glyph';
                g.style.left=Math.random()*100+'%';
                g.textContent='01';
                layer.appendChild(g);
            }
            document.body.appendChild(layer);
            setTimeout(()=>layer.remove(),3000);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initBootLoader();
    initHeaderEffects();
    initKonamiEgg();
    U.initInteractions();
    loadPublicEvents();
    loadTeamMembers();
    loadLearningHub();
    loadLeaderboard();
    loadPartners();
    loadSiteContent();

    window.CatalystAuth.onChange((state) => {
        if (state.passwordRecovery) {
            openResetPasswordModal();
            return;
        }
        renderAuthArea(state);
    });
    await window.CatalystAuth.init();
});

async function loadLearningHub() {
    const container = document.getElementById('learningModulesContainer');
    if (!container) return;

    const { data: modules, error: modErr } = await window.CatalystDB
        .from('learning_modules')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true });

    if (modErr) {
        container.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning"></i> Error loading modules.</div>`;
        return;
    }

    if (!modules || modules.length === 0) {
        container.innerHTML = `<div class="empty-state reveal"><i class="ph ph-books"></i> Learning modules are being prepared.</div>`;
        return;
    }

    const { data: lessons, error: lesErr } = await window.CatalystDB
        .from('learning_lessons')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true });

    // If logged in, find out which lessons/modules this user already has credit for,
    // so the hub can show "Watched" instead of a button and skip re-awarding points.
    let watchedLessonIds = new Set();
    let completedModuleIds = new Set();
    const myId = window.CatalystAuth?.getSession()?.user?.id;
    if (myId) {
        const [{ data: lp }, { data: mp }] = await Promise.all([
            window.CatalystDB.from('user_lesson_progress').select('lesson_id').eq('user_id', myId),
            window.CatalystDB.from('user_module_progress').select('module_id').eq('user_id', myId),
        ]);
        watchedLessonIds = new Set((lp || []).map((r) => r.lesson_id));
        completedModuleIds = new Set((mp || []).map((r) => r.module_id));
    }

    // Build the tab bar
    let tabsHtml = `<div class="hub-tabs" role="tablist" style="display:flex; overflow-x:auto; white-space:nowrap; gap:10px; margin-bottom:25px; padding-bottom:10px; -webkit-overflow-scrolling: touch;">`;
    
    // Build the content panels
    let panelsHtml = `<div class="hub-panels">`;

    for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];
        const isActive = i === 0;
        
        tabsHtml += `
            <button class="hub-tab-btn ${isActive ? 'active' : ''}" role="tab" aria-selected="${isActive}" aria-controls="hub-panel-${mod.id}" data-mod="${mod.id}" tabindex="${isActive ? '0' : '-1'}">
                <i class="ph ph-book-open"></i> ${U.escapeHtml(mod.title)}
            </button>
        `;

        const modLessons = (lessons || []).filter(l => l.module_id === mod.id);
        
        let lessonsHtml = modLessons.map(l => {
            const ytMatch = l.youtube_url ? l.youtube_url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^"&?\/\s]{11})/) : null;
            const ytId = ytMatch ? ytMatch[1] : '';
            const embedHtml = ytId ? `<div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:var(--radius-md); margin-bottom:15px; border:1px solid var(--border-color);"><iframe src="https://www.youtube-nocookie.com/embed/${ytId}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allowfullscreen title="${U.escapeHtml(l.title)}" loading="lazy"></iframe></div>` : '';

            const isWatched = watchedLessonIds.has(l.id);
            let progressControl;
            if (isWatched) {
                progressControl = `<span class="lesson-watched-badge"><i class="ph ph-check-circle"></i> Watched</span>`;
            } else if (myId) {
                progressControl = `<button type="button" class="btn-outline" data-lesson-id="${l.id}" data-action="mark-watched"><i class="ph ph-check"></i> Mark as Watched</button>`;
            } else {
                progressControl = `<span style="font-size:0.85rem; opacity:0.7;"><i class="ph ph-lock-simple"></i> Log in to earn points</span>`;
            }

            return `
            <div class="card event-card learning-lesson-card" style="margin-bottom: 20px;">
                <div class="lesson-progress-row">
                    <h4 style="margin-bottom:0;"><i class="ph ph-play-circle"></i> ${U.escapeHtml(l.title)}</h4>
                    <span class="points-pill"><i class="ph ph-trophy"></i> ${l.points_value ?? 10} pts</span>
                </div>
                ${l.description ? `<p style="opacity:0.9; margin-bottom:15px;">${U.escapeHtml(l.description)}</p>` : ''}
                ${embedHtml}
                ${l.catalyst_summary ? `<div style="margin-bottom:10px;"><strong>Summary:</strong> <span style="opacity:0.8">${U.escapeHtml(l.catalyst_summary)}</span></div>` : ''}
                ${l.catalyst_analysis ? `<div style="margin-bottom:15px;"><strong>Catalyst Analysis:</strong> <span style="opacity:0.8">${U.escapeHtml(l.catalyst_analysis)}</span></div>` : ''}
                <div class="lesson-progress-row" style="margin-bottom:0;">${progressControl}</div>
            </div>`;
        }).join('');

        if(!lessonsHtml) lessonsHtml = '<p style="opacity:0.7; font-size:0.9rem;"><i class="ph ph-info"></i> No lessons available yet.</p>';

        const modComplete = completedModuleIds.has(mod.id)
            ? `<span class="lesson-watched-badge" style="margin-left:10px;"><i class="ph ph-trophy"></i> Module Complete (+${mod.points_value ?? 50} pts)</span>`
            : '';

        panelsHtml += `
        <div id="hub-panel-${mod.id}" class="hub-panel glass-panel reveal active" role="tabpanel" style="display:${isActive ? 'block' : 'none'};">
            <h2 style="margin-bottom: 10px; color:var(--accent-color);"><i class="ph ph-book-open"></i> ${U.escapeHtml(mod.title)}${modComplete}</h2>
            ${mod.description ? `<p style="margin-bottom: 20px; opacity: 0.9;">${U.escapeHtml(mod.description)}</p>` : ''}
            <div class="lessons-container">
                ${lessonsHtml}
            </div>
        </div>
        `;
    }
    
    tabsHtml += `</div>`;
    panelsHtml += `</div>`;

    container.innerHTML = tabsHtml + panelsHtml;
    
    // Attach tab logic
    const tabBtns = container.querySelectorAll('.hub-tab-btn');
    const panels = container.querySelectorAll('.hub-panel');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
                b.tabIndex = -1;
            });
            panels.forEach(p => p.style.display = 'none');
            
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            btn.tabIndex = 0;
            
            const target = document.getElementById(`hub-panel-${btn.dataset.mod}`);
            if (target) {
                target.style.display = 'block';
                // Trigger reveal if needed
                setTimeout(() => target.classList.add('active'), 50);
            }
        });
        
        btn.addEventListener('keydown', (e) => {
            const tabsArray = Array.from(tabBtns);
            const index = tabsArray.indexOf(e.target);
            let newIndex = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                newIndex = (index + 1) % tabsArray.length;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                newIndex = (index - 1 + tabsArray.length) % tabsArray.length;
            }
            if (newIndex !== null) {
                tabsArray[newIndex].click();
                tabsArray[newIndex].focus();
                e.preventDefault();
            }
        });
    });

    // Event delegation for "Mark as Watched" buttons (cards are re-rendered often,
    // so one listener on the container is simpler than re-binding per button).
    container.querySelectorAll('[data-action="mark-watched"]').forEach((btn) => {
        btn.addEventListener('click', () => handleMarkLessonWatched(btn.dataset.lessonId, btn));
    });
}

async function handleMarkLessonWatched(lessonId, btn) {
    if (!lessonId) return;
    U.setLoading(btn, true, 'Saving…');
    try {
        const { error } = await window.CatalystDB.rpc('mark_lesson_watched', { p_lesson_id: lessonId });
        if (error) throw error;

        U.toast('Lesson marked as watched. Points added!', 'success');

        // Refresh the header points pill and public leaderboard, then re-render the
        // hub so this lesson (and, if it finished the module, the module banner)
        // shows its updated state.
        await refreshMyPoints();
        loadLeaderboard();
        loadLearningHub();
    } catch (err) {
        U.toast(`Couldn't save progress: ${err.message || 'unknown error'}`, 'error');
        U.setLoading(btn, false);
    }
}

async function refreshMyPoints() {
    const session = window.CatalystAuth?.getSession();
    const badge = document.getElementById('myPointsBadge');
    if (!session?.user || !badge) return;

    const { data, error } = await window.CatalystDB
        .from('profiles')
        .select('points')
        .eq('id', session.user.id)
        .single();

    if (!error && data) {
        badge.innerHTML = `<i class="ph ph-trophy"></i> ${data.points ?? 0} pts`;
        badge.style.display = 'inline-flex';
    }
}

/* ============================== Leaderboard (public) ============================== */

let allLeaderboardRows = [];

function leaderboardRowHtml(u, rank, myId) {
    const isMe = myId && u.id === myId;
    const rankClass = rank <= 3 ? ` top-${rank}` : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    return `
      <tr class="${isMe ? 'leaderboard-you' : ''}">
        <td class="leaderboard-rank${rankClass}">${medal}</td>
        <td style="font-weight:500;"><i class="ph ph-user"></i> ${U.escapeHtml(u.full_name || 'Anonymous Pilot')} ${isMe ? '<span class="badge" style="border-color:var(--accent-color); color:var(--accent-color);">YOU</span>' : ''}</td>
        <td><i class="ph ph-play-circle"></i> ${u.lessons_watched ?? 0} watched</td>
        <td><i class="ph ph-books"></i> ${u.modules_completed ?? 0} completed</td>
        <td><span class="points-pill"><i class="ph ph-trophy"></i> ${u.points ?? 0} pts</span></td>
      </tr>`;
}

function renderLeaderboard(rows) {
    const wrap = document.getElementById('leaderboardWrap');
    if (!wrap) return;

    if (rows.length === 0) {
        wrap.innerHTML = `<div class="empty-state reveal"><i class="ph ph-trophy"></i> No entries yet — start watching lessons to earn points.</div>`;
        return;
    }

    const myId = window.CatalystAuth?.getSession()?.user?.id;

    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Rank</th><th>Pilot</th><th>Lessons</th><th>Modules</th><th>Points</th></tr></thead>
          <tbody>${rows.map((u, i) => leaderboardRowHtml(u, i + 1, myId)).join('')}</tbody>
        </table>
      </div>`;
}

async function loadLeaderboard() {
    const wrap = document.getElementById('leaderboardWrap');
    if (!wrap) return;
    wrap.innerHTML = `<div class="loading-state reveal"><i class="ph ph-spinner-gap ph-spin"></i> Loading leaderboard...</div>`;

    const { data, error } = await window.CatalystDB
        .from('leaderboard')
        .select('*')
        .order('points', { ascending: false });

    if (error) {
        wrap.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning"></i> Error loading leaderboard.</div>`;
        return;
    }

    allLeaderboardRows = data || [];
    renderLeaderboard(allLeaderboardRows);
}

function filterLeaderboard() {
    const query = document.getElementById('leaderboardSearchInput').value.toLowerCase();
    if (!query) return renderLeaderboard(allLeaderboardRows);
    const filtered = allLeaderboardRows.filter((u) => (u.full_name || '').toLowerCase().includes(query));
    renderLeaderboard(filtered);
}

async function loadPartners() {
    const grid = document.getElementById('partnersGrid');
    if (!grid) return;

    const { data, error } = await window.CatalystDB
        .from('partnerships')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true });

    if (error) {
        grid.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning"></i> Error loading partners.</div>`;
        return;
    }

    if (!data || data.length === 0) {
        grid.innerHTML = `<div class="empty-state reveal"><i class="ph ph-handshake"></i> Partner information not available yet.</div>`;
        return;
    }

    grid.innerHTML = data.map(p => {
        const logo = p.logo_url ? `<img src="${U.escapeHtml(p.logo_url)}" alt="${U.escapeHtml(p.name)}" style="max-width:100%; max-height:80px; object-fit:contain; display:block; margin:0 auto;" loading="lazy">` : `<div style="font-weight:600; text-align:center;">${U.escapeHtml(p.name)}</div>`;
        const inner = p.website_url ? `<a href="${U.escapeHtml(p.website_url)}" target="_blank" rel="noopener" style="text-decoration:none; color:inherit; display:block;">${logo}</a>` : logo;
        return `<div class="card reveal" style="display:flex; align-items:center; justify-content:center; padding:20px; min-height:120px;">${inner}</div>`;
    }).join('');
}
