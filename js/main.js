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
    
    // Metadata grouped nicely
    let metadataHtml = `<div style="display:flex; flex-direction:column; gap:8px; margin: 16px 0; font-size: 0.9rem; color:var(--text-muted);">`;
    metadataHtml += `<div><i class="ph ph-calendar-blank" style="color:var(--accent-color);"></i> <strong>${U.formatDate(ev.event_date)}</strong>${ev.event_time ? ' · ' + U.escapeHtml(ev.event_time) : ''}</div>`;
    if (ev.location) metadataHtml += `<div><i class="ph ph-map-pin"></i> ${U.escapeHtml(ev.location)}</div>`;
    if (ev.capacity) metadataHtml += `<div><i class="ph ph-users"></i> Capacity: ${U.escapeHtml(String(ev.capacity))}</div>`;
    if (ev.organizer) metadataHtml += `<div><i class="ph ph-user-circle"></i> Organizer: ${U.escapeHtml(ev.organizer)}</div>`;
    metadataHtml += `</div>`;

    const description = ev.description ? `<p style="margin-top: 16px; opacity:0.9; font-size:1.05rem; line-height:1.6;">${U.escapeHtml(ev.description)}</p>` : '';
    const registration = ev.registration_url
        ? `<a class="btn-glow" href="${U.escapeHtml(ev.registration_url)}" target="_blank" rel="noopener" style="margin-top:24px; text-decoration:none; display:flex; justify-content:center;">Access Portal <i class="ph ph-arrow-up-right"></i></a>`
        : '';
    const statusPill = ev.status === 'past' ? '<span class="badge" style="background:transparent; border-color:var(--text-muted); color:var(--text-muted);">ARCHIVED</span>' : '';

    return `
      <div class="card event-card reveal" style="padding: 32px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
            <div style="font-family:var(--font-mono); font-size:0.75rem; color:var(--accent-color); font-weight:600; letter-spacing:0.05em;">
                <i class="ph ph-terminal"></i> ${U.escapeHtml(ev.category || 'EVENT')}
            </div>
            ${statusPill}
        </div>
        ${logoHtml}
        <h3 style="font-size: 1.5rem; margin-bottom: 8px; line-height:1.2;">${U.escapeHtml(ev.topic || ev.title)}</h3>
        ${metadataHtml}
        ${description}
        ${mediaHtml}
        ${tags ? `<div class="event-tags" style="margin-top:20px;">${tags}</div>` : ''}
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


let hubState = {
    modules: [],
    lessons: [],
    watchedLessonIds: new Set(),
    completedModuleIds: new Set(),
    activeModuleId: null,
    activeLessonId: null,
    videoStarted: false,
    ytPlayer: null
};

window.onYouTubeIframeAPIReady = function() {
    window.ytApiReady = true;
};

async function loadLearningHub() {
    const container = document.getElementById("learningModulesContainer");
    if (!container) return;
    const { data: modules, error: modErr } = await window.CatalystDB.from("learning_modules").select("*").eq("published", true).order("sort_order", { ascending: true });
    if (modErr) { container.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning"></i> Error loading modules.</div>`; return; }
    if (!modules || modules.length === 0) { container.innerHTML = `<div class="empty-state reveal"><i class="ph ph-books"></i> Learning modules are being prepared.</div>`; return; }
    const { data: lessons, error: lesErr } = await window.CatalystDB.from("learning_lessons").select("*").eq("published", true).order("sort_order", { ascending: true });
    if (lesErr) console.error("Error loading learning_lessons:", lesErr);
    hubState.modules = modules || [];
    hubState.lessons = lessons || [];
    hubState.lessonsError = lesErr;
    await refreshHubProgress();
    renderHubLevel1();
}

async function refreshHubProgress() {
    const myId = window.CatalystAuth?.getSession()?.user?.id;
    hubState.watchedLessonIds.clear();
    hubState.completedModuleIds.clear();
    if (myId) {
        const [{ data: lp }, { data: mp }] = await Promise.all([
            window.CatalystDB.from("user_lesson_progress").select("lesson_id, completed_at, video_started_at, watched_at").eq("user_id", myId),
            window.CatalystDB.from("user_module_progress").select("module_id").eq("user_id", myId),
        ]);
        
        (lp || []).forEach(r => {
            if (r.completed_at) {
                hubState.watchedLessonIds.add(r.lesson_id);
            } else if (r.watched_at && !r.video_started_at) {
                // Legacy completion (before video_started_at was introduced)
                hubState.watchedLessonIds.add(r.lesson_id);
            }
        });
        
        hubState.completedModuleIds = new Set((mp || []).map(r => r.module_id));
    }
}

window.renderHubLevel1 = function() {
    const container = document.getElementById("learningModulesContainer");
    const totalLessons = hubState.lessons.length;
    let completedLessons = 0;
    hubState.lessons.forEach(l => { if(hubState.watchedLessonIds.has(l.id)) completedLessons++; });
    let progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const session = window.CatalystAuth?.getSession();
    let progressHtml = "";
    if (session) {
        progressHtml = `
        <div style="margin-bottom: 32px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                <span style="font-family:var(--font-mono); font-size:0.75rem; font-weight:600; letter-spacing:0.05em; color:var(--text-muted); text-transform:uppercase;">Overall Learning Progress</span>
                <span style="font-family:var(--font-heading); font-size:1.1rem; font-weight:700; color:var(--accent-color);">${progressPct}%</span>
            </div>
            <div class="hub-progress-bar" style="margin:0;"><div class="hub-progress-fill" style="width: ${progressPct}%;"></div></div>
        </div>`;
    } else {
        progressHtml = `<div style="margin-bottom:32px; opacity:0.8; font-size:0.9rem; padding:12px 16px; background:rgba(255,255,255,0.05); border-radius:var(--radius-sm); border:1px solid var(--border-color);"><i class="ph ph-info"></i> Sign in to save your learning progress.</div>`;
    }
    let cardsHtml = `<div class="module-cards-grid">`;
    hubState.modules.forEach((mod, idx) => {
        const modLessons = hubState.lessons.filter(l => l.module_id === mod.id);
        const modLessonCount = modLessons.length;
        let modCompletedLessons = 0;
        modLessons.forEach(l => { if (hubState.watchedLessonIds.has(l.id)) modCompletedLessons++; });
        const isComplete = hubState.completedModuleIds.has(mod.id) || (modLessonCount > 0 && modCompletedLessons === modLessonCount);
        let coverHtml = mod.cover_image_url ? `<img src="${U.escapeHtml(mod.cover_image_url)}" class="module-card-img" alt="Module Cover" loading="lazy">` : `<div class="module-card-img fallback"><i class="ph ph-books"></i></div>`;
        cardsHtml += `<div class="module-card reveal" tabindex="0" onclick="openModule('${mod.id}')">
            <div class="module-cover-area">
                ${coverHtml}
                <div class="module-card-overlay">
                    <div class="module-card-desc">${U.escapeHtml(mod.description || '')}</div>
                </div>
            </div>
            <div class="module-card-content">
                <div class="module-card-eyebrow">MODULE ${(idx+1).toString().padStart(2, '0')}</div>
                <h3 class="module-card-title">${U.escapeHtml(mod.title)}</h3>
                <div class="module-card-footer">
                    <div class="module-progress-text">
                        ${session && isComplete ? `<span style="color:var(--success-color);"><i class="ph ph-check-circle"></i> Completed</span>` : `<span>${modCompletedLessons} / ${modLessonCount} LESSONS</span>`}
                        ${session && !isComplete && modLessonCount > 0 ? `<span>${Math.round((modCompletedLessons/modLessonCount)*100)}%</span>` : ''}
                    </div>
                    ${session && !isComplete && modLessonCount > 0 ? `
                    <div class="module-mini-progress">
                        <div class="module-mini-progress-fill" style="width: ${Math.round((modCompletedLessons/modLessonCount)*100)}%;"></div>
                    </div>` : ''}
                </div>
            </div>
        </div>`;
    });
    cardsHtml += '</div>';
    
    let errorHtml = "";
    if (hubState.lessonsError) {
        errorHtml = `<div class="error-state" style="margin-bottom: 20px;"><i class="ph ph-warning"></i> Error loading lessons. Some content may be missing.</div>`;
    }
    
    container.innerHTML = errorHtml + progressHtml + cardsHtml;
    setTimeout(() => U.initScrollReveals(), 50);
}

window.openModule = function(moduleId) {
    hubState.activeModuleId = moduleId;
    const modLessons = hubState.lessons.filter(l => l.module_id === moduleId);
    if (modLessons.length > 0) {
        let firstUnwatched = modLessons.find(l => !hubState.watchedLessonIds.has(l.id));
        hubState.activeLessonId = (firstUnwatched || modLessons[0]).id;
    } else {
        hubState.activeLessonId = null;
    }
    renderHubLevel2();
}

window.openLesson = function(lessonId) {
    hubState.activeLessonId = lessonId;
    renderHubLevel2();
}

window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById("hubSidebar");
    if (sidebar) sidebar.classList.toggle("open");
}


function renderMarkdownSafe(text) {
    if (!text) return '';
    try {
        if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(marked.parse(text));
        }
    } catch (e) {
        console.error("Markdown parsing failed:", e);
    }
    // Fallback: escape HTML and replace newlines with <br>
    return U.escapeHtml(text).replace(/\n/g, '<br>');
}

async function renderHubLevel2() {
    const container = document.getElementById("learningModulesContainer");
    try {
        const mod = hubState.modules.find(m => m.id === hubState.activeModuleId);
        if (!mod) {
            container.innerHTML = `<div class="error-state">Module not found.</div>`;
            return;
        }

        const modLessons = hubState.lessons.filter(l => l.module_id === mod.id);
        const activeLesson = modLessons.find(l => l.id === hubState.activeLessonId);
        let sidebarList = "";
        
        modLessons.forEach((l, idx) => {
            const isWatched = hubState.watchedLessonIds.has(l.id);
            const isActive = l.id === hubState.activeLessonId;
            const numStr = (idx+1).toString().padStart(2, '0');
            let icon = '<i class="ph ph-circle"></i>';
            if (isWatched) icon = '<i class="ph ph-check-circle" style="color:var(--success-color);"></i>';
            else if (isActive) icon = '<i class="ph ph-play-circle" style="color:var(--accent-color);"></i>';
            sidebarList += `<li class="lesson-nav-item ${isActive ? 'active' : ''}" onclick="openLesson('${l.id}')">${icon} <span>${numStr}. ${U.escapeHtml(l.title)}</span></li>`;
        });
        
        const modIndex = hubState.modules.findIndex(m => m.id === mod.id);
        const modNumStr = (modIndex + 1).toString().padStart(2, '0');
        let modCompletedLessons = 0;
        modLessons.forEach(l => { if (hubState.watchedLessonIds.has(l.id)) modCompletedLessons++; });
        const modLessonCount = modLessons.length;
        const progressPct = modLessonCount > 0 ? Math.round((modCompletedLessons / modLessonCount) * 100) : 0;
        const session = window.CatalystAuth?.getSession();

        let progressHtml = '';
        if (session && modLessonCount > 0) {
            progressHtml = `
            <div style="margin-top: 24px; max-width: 400px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                    <span style="font-family:var(--font-mono); font-size:0.75rem; font-weight:600; letter-spacing:0.05em; color:var(--text-muted); text-transform:uppercase;">Module Progress</span>
                    <span style="font-family:var(--font-heading); font-size:1rem; font-weight:700; color:var(--accent-color);">${progressPct}%</span>
                </div>
                <div class="module-mini-progress"><div class="module-mini-progress-fill" style="width: ${progressPct}%;"></div></div>
            </div>`;
        }

        // 1. Render the structural module shell first
        let html = `
            <div class="module-view">
                <div class="module-view-header glass-panel" style="padding: 32px; border-radius: var(--radius-lg);">
                    <div style="display:inline-flex; align-items:center; gap:8px; margin-bottom:24px; cursor:pointer; color:var(--text-muted); font-size:0.9rem; transition: color 0.2s;" onclick="renderHubLevel1()" onmouseover="this.style.color='var(--accent-color)'" onmouseout="this.style.color='var(--text-muted)'">
                        <i class="ph ph-arrow-left"></i> Back to Hub
                    </div>
                    
                    <div style="margin-bottom: 8px; font-family:var(--font-mono); font-size:0.85rem; color:var(--accent-color); font-weight:600; letter-spacing:0.05em;">MODULE ${modNumStr}</div>
                    <h2 style="font-size: clamp(1.8rem, 3vw, 2.5rem); margin:0 0 16px 0; font-weight:700; line-height:1.2;">${U.escapeHtml(mod.title)}</h2>
                    <div id="moduleDescriptionArea" style="font-size: 1.05rem; opacity:0.9; max-width: 800px;"></div>
                    ${progressHtml}
                </div>
                
                <div class="module-view-body">
                    <div class="module-sidebar-mobile-toggle" onclick="toggleMobileSidebar()">
                        <span><i class="ph ph-list"></i> Course Content</span>
                        <i class="ph ph-caret-down"></i>
                    </div>
                    
                    <aside class="module-sidebar" id="hubSidebar">
                        <h4 style="margin-top:0; margin-bottom:15px;">Lessons</h4>
                        <ul class="lesson-nav-list" id="sidebarListArea">${sidebarList}</ul>
                    </aside>
                    
                    <main class="module-content-area" id="lessonContentArea">
                        <div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Loading lesson...</div>
                    </main>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // 2. Render Markdown safely after DOM exists
        if (mod.description) {
            document.getElementById("moduleDescriptionArea").innerHTML = renderMarkdownSafe(mod.description);
        }
        
        // 3. Render Lesson safely
        if (activeLesson) {
            await renderActiveLesson(activeLesson);
        } else {
            document.getElementById("lessonContentArea").innerHTML = `<div class="empty-state">No lessons are available in this module yet.</div>`;
        }
    } catch(err) {
        console.error("Error rendering module view:", err);
        container.innerHTML = `<div class="error-state">Module could not be loaded. Please try again.</div>`;
    }
}

async function renderActiveLesson(lesson) {
    const area = document.getElementById("lessonContentArea");
    if (!area) return;
    
    try {
        hubState.videoStarted = false;
        if (hubState.ytPlayer) {
            hubState.ytPlayer.destroy();
            hubState.ytPlayer = null;
        }
        
        const isWatched = hubState.watchedLessonIds.has(lesson.id);
        let quizHtml = "";
        
        try {
            const { data: quizData } = await window.CatalystDB.from("lesson_quizzes").select("*").eq("lesson_id", lesson.id).eq("enabled", true).maybeSingle();
            
            if (quizData) {
                const [{ data: qs }, { data: opts }] = await Promise.all([
                    window.CatalystDB.from("quiz_questions").select("*").eq("quiz_id", quizData.id).eq("published", true).order("sort_order"),
                    window.CatalystDB.from("public_quiz_options").select("id, question_id, option_text, sort_order").order("sort_order")
                ]);
                let qHtml = "";
                (qs || []).forEach(q => {
                    let oHtml = "";
                    const qOpts = (opts || []).filter(o => o.question_id === q.id);
                    qOpts.forEach(o => { oHtml += `<label class="quiz-option"><input type="radio" name="q_${q.id}" value="${o.id}"><span>${U.escapeHtml(o.option_text)}</span></label>`; });
                    qHtml += `<div class="quiz-question"><div style="font-weight:600; margin-bottom:10px;">${renderMarkdownSafe(q.question_text)}</div><div class="quiz-options">${oHtml}</div></div>`;
                });
                
                let instructionsHtml = quizData.instructions ? `<div class="md-content" style="opacity:0.9; margin-bottom:24px; font-size:1.05rem;">${renderMarkdownSafe(quizData.instructions)}</div>` : '';
                quizHtml = `<div style="margin: 64px 0 32px 0;">
                    <h3 style="font-family:var(--font-heading); font-size:1.6rem; color:var(--text-color); margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                        <i class="ph ph-exam" style="color:var(--accent-color);"></i> ${U.escapeHtml(quizData.title)}
                    </h3>
                    ${instructionsHtml}
                    <form id="quizForm_${lesson.id}" onsubmit="handleQuizSubmit(event, '${quizData.id}', '${lesson.id}')">
                        ${qHtml}
                        <div id="quizResultArea_${lesson.id}"></div>
                        <button type="submit" class="btn-glow" style="margin-top:32px; font-size:1.05rem;"><i class="ph ph-check-circle"></i> Submit Answers</button>
                    </form>
                </div>`;
            }
        } catch (quizErr) {
            console.error("Error loading quiz:", quizErr);
            quizHtml = `<div class="error-state">Quiz could not be loaded. Please try again.</div>`;
        }

        const ytMatch = lesson.youtube_url ? lesson.youtube_url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^"&?\/\s]{11})/) : null;
        const ytId = ytMatch ? ytMatch[1] : '';
        let videoHtml = ytId ? `<div class="lesson-video-wrapper"><div id="yt-player-${lesson.id}"></div></div>` : '';
        
        const modLessons = hubState.lessons.filter(l => l.module_id === lesson.module_id);
        const currentIndex = modLessons.findIndex(l => l.id === lesson.id);
        const nextLesson = modLessons[currentIndex + 1];
        const prevLesson = modLessons[currentIndex - 1];
        let nextNavHtml = "";
        let prevNavHtml = "";
        
        if (prevLesson) {
            prevNavHtml = `<button type="button" class="btn-outline" onclick="openLesson('${prevLesson.id}')"><i class="ph ph-arrow-left"></i> Previous Lesson</button>`;
        }
        
        if (nextLesson) {
            nextNavHtml = `<button type="button" class="btn-outline" onclick="openLesson('${nextLesson.id}')">Next Lesson <i class="ph ph-arrow-right"></i></button>`;
        } else {
            const currentModIndex = hubState.modules.findIndex(m => m.id === lesson.module_id);
            const nextMod = hubState.modules[currentModIndex + 1];
            if (nextMod) {
                nextNavHtml = `<button type="button" class="btn-outline" onclick="openModule('${nextMod.id}')">Next Module <i class="ph ph-arrow-right"></i></button>`;
            } else {
                nextNavHtml = `<button type="button" class="btn-outline" onclick="renderHubLevel1()">Back to Learning Hub <i class="ph ph-arrow-up"></i></button>`;
            }
        }
        
        const session = window.CatalystAuth?.getSession();
        let finishBtnHtml = "";
        if (isWatched) {
            finishBtnHtml = `<span style="color:var(--success-color); font-weight:600;"><i class="ph ph-check-circle"></i> Completed</span>`;
        } else if (session) {
            const disableState = (ytId && !hubState.videoStarted) ? "disabled" : "";
            const titleText = (ytId && !hubState.videoStarted) ? "Watch video to complete" : "";
            finishBtnHtml = `<button type="button" class="btn-glow" id="finishLessonBtn_${lesson.id}" onclick="handleFinishLesson('${lesson.id}')" ${disableState} title="${titleText}"><i class="ph ph-check"></i> Complete Lesson</button>`;
        } else {
            finishBtnHtml = `<span style="font-size:0.85rem; opacity:0.7;"><i class="ph ph-lock-simple"></i> Log in to complete</span>`;
        }
        
        let contextHtml = `<div style="font-family:var(--font-mono); font-size:0.8rem; color:var(--accent-color); font-weight:600; letter-spacing:0.05em; margin-bottom:12px; text-transform:uppercase;">LESSON ${(currentIndex+1).toString().padStart(2,'0')} OF ${modLessons.length.toString().padStart(2,'0')}</div>`;
        let descHtml = lesson.description ? `<div class="md-content" style="font-size:1.1rem; opacity:0.9; margin-top:16px;">${renderMarkdownSafe(lesson.description)}</div>` : '';
        let summaryHtml = lesson.catalyst_summary ? `<div style="margin: 48px 0;">
            <h3 style="font-family:var(--font-mono); font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:16px;">Catalyst Summary</h3>
            <div class="md-content" style="opacity:0.95; font-size:1.05rem;">${renderMarkdownSafe(lesson.catalyst_summary)}</div>
        </div>` : '';
        let analysisHtml = lesson.catalyst_analysis ? `<div style="margin: 48px 0;">
            <h3 style="font-family:var(--font-mono); font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:16px;">Catalyst Analysis</h3>
            <div class="md-content" style="opacity:0.95; font-size:1.05rem;">${renderMarkdownSafe(lesson.catalyst_analysis)}</div>
        </div>` : '';

        area.innerHTML = `
            <div class="lesson-header" style="margin-bottom: 32px;">
                ${contextHtml}
                <h2 style="margin:0; font-size: clamp(1.6rem, 2.5vw, 2.2rem); font-weight:700; line-height:1.2;">${U.escapeHtml(lesson.title)}</h2>
                ${descHtml}
            </div>
            ${videoHtml}
            ${summaryHtml}
            ${analysisHtml}
            ${quizHtml}
            
            <div class="lesson-footer" style="margin-top: 60px; padding-top: 32px; border-top: 1px solid var(--border-color); display:flex; flex-direction:column; gap:24px;">
                <div id="finishLessonArea_${lesson.id}" style="text-align:center;">${finishBtnHtml}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div>${prevNavHtml}</div>
                    <div>${nextNavHtml}</div>
                </div>
            </div>`;
        
        try {
            if (ytId && window.ytApiReady) {
                hubState.ytPlayer = new YT.Player(`yt-player-${lesson.id}`, {
                    height: '100%',
                    width: '100%',
                    videoId: ytId,
                    playerVars: { 'playsinline': 1 },
                    events: {
                        'onStateChange': async (event) => {
                            if (event.data === YT.PlayerState.PLAYING && !hubState.videoStarted) {
                                hubState.videoStarted = true;
                                const btn = document.getElementById(`finishLessonBtn_${lesson.id}`);
                                if (btn) { btn.disabled = false; btn.title = ""; }
                                // Notify server that video started
                                try {
                                    await window.CatalystDB.rpc('record_lesson_video_start', { p_lesson_id: lesson.id });
                                } catch (e) {
                                    console.error("Failed to record video start on server:", e);
                                }
                            }
                        }
                    }
                });
            } else if (ytId && !window.ytApiReady) {
                setTimeout(() => { if(window.ytApiReady) renderActiveLesson(lesson); }, 1000);
            }
        } catch (ytErr) {
            console.error("YouTube initialization error:", ytErr);
        }
    } catch (err) {
        console.error("Error rendering lesson:", err);
        area.innerHTML = `<div class="error-state">Lesson content could not be loaded. Please try again.</div>`;
    }
}

window.handleQuizSubmit = async function(e, quizId, lessonId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const answers = {};
    for (let [key, val] of formData.entries()) {
        if (key.startsWith('q_')) answers[key.replace('q_', '')] = val;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    U.setLoading(submitBtn, true, 'Grading...');
    try {
        const { data, error } = await window.CatalystDB.rpc('submit_quiz_attempt', { p_quiz_id: quizId, p_answers: answers });
        if (error) throw error;
        const resArea = document.getElementById(`quizResultArea_${lessonId}`);
        if (data.passed) {
            resArea.innerHTML = `<div class="quiz-result passed"><i class="ph ph-check-circle"></i> Quiz Passed! Score: ${data.percentage}% (+${data.points_earned} pts)</div>`;
            submitBtn.style.display = 'none';
        } else {
            resArea.innerHTML = `<div class="quiz-result failed"><i class="ph ph-x-circle"></i> Quiz Failed. Score: ${data.percentage}%. Please review and try again.</div>`;
            U.setLoading(submitBtn, false);
        }
        await refreshMyPoints();
        loadLeaderboard();
    } catch(err) {
        U.toast(`Error submitting quiz: ${err.message}`, 'error');
        U.setLoading(submitBtn, false);
    }
}

window.handleFinishLesson = async function(lessonId) {
    const btn = document.getElementById(`finishLessonBtn_${lessonId}`);
    if (!btn) return;
    U.setLoading(btn, true, 'Saving...');
    try {
        const { error } = await window.CatalystDB.rpc('complete_lesson', { p_lesson_id: lessonId });
        if (error) {
            if (error.message && error.message.includes('Quiz must be passed')) {
                U.toast('You must pass the quiz before finishing this lesson.', 'warning');
            } else if (error.message && error.message.includes('Video must be started')) {
                U.toast('You must play the video first before finishing the lesson.', 'warning');
            } else {
                throw error;
            }
            U.setLoading(btn, false);
            return;
        }
        U.toast('Lesson completed!', 'success');
        await refreshHubProgress();
        await refreshMyPoints();
        loadLeaderboard();
        document.getElementById(`finishLessonArea_${lessonId}`).innerHTML = `<span style="color:var(--success-color); font-weight:600;"><i class="ph ph-check-circle"></i> Completed</span>`;
        renderHubLevel2();
    } catch (err) {
        U.toast(`Error completing lesson: ${err.message}`, 'error');
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
        const logo = p.logo_url ? `<img src="${U.escapeHtml(p.logo_url)}" alt="${U.escapeHtml(p.name)}" style="max-width:100%; max-height:80px; object-fit:contain; display:block; margin:0 auto; filter: grayscale(100%) opacity(0.7); transition: filter 0.3s;" onmouseover="this.style.filter='grayscale(0) opacity(1)'" onmouseout="this.style.filter='grayscale(100%) opacity(0.7)'" loading="lazy">` : `<div style="font-weight:600; text-align:center; color:var(--text-muted);">${U.escapeHtml(p.name)}</div>`;
        const inner = p.website_url ? `<a href="${U.escapeHtml(p.website_url)}" target="_blank" rel="noopener" style="text-decoration:none; color:inherit; display:block; width:100%;">${logo}</a>` : logo;
        return `<div class="reveal partner-tile">${inner}</div>`;
    }).join('');
}
