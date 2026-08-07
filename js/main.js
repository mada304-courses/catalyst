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
    if (btn?.disabled) return; 
    
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
    const btn = document.getElementById('themeBtn');
    const badge = document.getElementById('accountThemeBadge');

    if (!btn) return;

    if (result.forced) {
        btn.disabled = true;
        btn.title = 'Environment set by sysadmin.';
        btn.innerHTML = '<i class="ph ph-lock-key"></i>';
        if (badge) {
            badge.innerHTML = `<i class="ph ph-swatches"></i> ${U.THEME_LABELS[result.theme]} (SYSADM)`;
            badge.style.display = 'inline-flex';
            badge.style.alignItems = 'center';
            badge.style.gap = '6px';
        }
    } else {
        btn.disabled = false;
        btn.title = 'Toggle Mode';
        const isLight = document.body.classList.contains('light-mode');
        btn.innerHTML = isLight ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon-stars"></i>';
        if (badge) badge.style.display = 'none';
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
        <p style="margin-top:12px;"><i class="ph ph-bookmark"></i> <strong>Topic:</strong> ${U.escapeHtml(ev.topic || ev.title)}</p>
        <p><i class="ph ph-calendar-blank"></i> <strong>Date:</strong> ${U.formatDate(ev.event_date)}${ev.event_time ? ' · ' + U.escapeHtml(ev.event_time) : ''}</p>
        ${ev.location ? `<p><i class="ph ph-map-pin"></i> <strong>Location:</strong> ${U.escapeHtml(ev.location)}</p>` : ''}
        ${capacity}
        ${organizer}
        ${description}
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
        .select('*')
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

function memberCardHtml(m) {
    const photo = m.image_url
        ? `<img src="${U.escapeHtml(m.image_url)}" alt="${U.escapeHtml(m.name)}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; margin-bottom:14px; border:2px solid var(--accent-color);">`
        : `<div style="width:72px; height:72px; border-radius:50%; margin-bottom:14px; background:var(--accent-color); color:var(--bg-color); display:flex; align-items:center; justify-content:center; font-size:1.6rem; font-weight:700;">${U.escapeHtml((m.name || '?').trim().charAt(0).toUpperCase())}</div>`;
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

    grid.innerHTML = members.map(memberCardHtml).join('');
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
    if (settings.about) {
        setText('aboutHeading', settings.about.heading);
        setText('aboutParagraph1', settings.about.paragraph1);
        setText('aboutParagraph2', settings.about.paragraph2);
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
        const initials = (state.profile.full_name || state.profile.email || '?').trim().charAt(0).toUpperCase();
        area.innerHTML = `
          <div class="auth-controls">
            <div class="user-chip">
              <span class="avatar">${U.escapeHtml(initials)}</span>
              <span>${U.escapeHtml(state.profile.full_name || state.profile.email)}</span>
              ${state.profile.role === 'admin' ? '<span class="badge badge-admin">SYSADM</span>' : ''}
            </div>
            <button type="button" class="btn-outline" id="logoutBtn"><i class="ph ph-sign-out"></i></button>
          </div>`;
        document.getElementById('logoutBtn').addEventListener('click', handleLogoutClick);

        if (adminNavItem) adminNavItem.style.display = state.profile.role === 'admin' ? 'block' : 'none';
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