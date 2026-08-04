/**
 * main.js
 * ------------------------------------------------------------------
 * Public-site logic: tab switching, theme toggle, loading events +
 * site content from Supabase, event search, and wiring the auth
 * modals (login / sign up / forgot password / set new password).
 *
 * Admin-only logic lives in admin.js / admin.html — this file never
 * writes to the database, it only reads published content.
 * ------------------------------------------------------------------
 */

const U = window.CatalystUtils;
let allEvents = []; // cache of currently-loaded published events, used by search

/* ============================== Tabs ============================== */

function openTab(event, tabName) {
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

/* ============================== Theme ============================== */
/**
 * There are 6 themes total. The 2 MAIN ones (monochrome dark / light) are
 * free for anyone to toggle — that's what toggleTheme()/initTheme() below
 * handle, exactly as before. The 4 SPECIAL ones (Retro Arcade, Embedded
 * Robotics, Biological Lab, Deep Space) can only be turned on by an admin,
 * per account, from the admin dashboard's Users page — see
 * applyThemeUI()/U.applyEffectiveTheme(), which are re-run every time the
 * auth state changes (login, logout, profile refresh).
 */

function toggleTheme() {
    const btn = document.getElementById('themeBtn');
    if (btn?.disabled) return; // this account's theme was set by an admin
    document.body.classList.toggle('light-mode');
    localStorage.setItem('catalyst-theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
}

function initTheme() {
    U.initLocalTheme();
}

/** Applies the effective theme for the given profile and updates the
 *  header toggle button / badge to reflect whether it's admin-locked. */
function applyThemeUI(profile) {
    const result = U.applyEffectiveTheme(profile);
    const btn = document.getElementById('themeBtn');
    const badge = document.getElementById('accountThemeBadge');

    if (!btn) return;

    if (result.forced) {
        btn.disabled = true;
        btn.title = 'Your theme has been set by an admin for this account.';
        if (badge) {
            badge.textContent = `THEME: ${U.THEME_LABELS[result.theme]} · SET BY ADMIN`;
            badge.style.display = '';
        }
    } else {
        btn.disabled = false;
        btn.title = '';
        if (badge) badge.style.display = 'none';
    }
}

/* ============================== Search ============================== */

function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.event-card');

    if (query.length > 0) {
        document.querySelector("button[onclick*='events']").click();
    }

    cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? 'block' : 'none';
    });
}

/* ============================== Events (public) ============================== */

function eventCardHtml(ev) {
    const tags = (ev.tags || []).map((t) => `<span class="tag">${U.escapeHtml(t)}</span>`).join('');
    const capacity = ev.capacity ? `<p><strong>Capacity:</strong> ${U.escapeHtml(String(ev.capacity))}</p>` : '';
    const organizer = ev.organizer ? `<p><strong>Organizer:</strong> ${U.escapeHtml(ev.organizer)}</p>` : '';
    const description = ev.description ? `<p>${U.escapeHtml(ev.description)}</p>` : '';
    const registration = ev.registration_url
        ? `<a class="register-link" href="${U.escapeHtml(ev.registration_url)}" target="_blank" rel="noopener">Register &rarr;</a>`
        : '';
    const statusPill = ev.status === 'past' ? ' <span class="badge">PAST</span>' : '';

    return `
      <div class="card event-card">
        <h3>[${U.escapeHtml(ev.category || 'EVENT')}]${statusPill}</h3>
        <p><strong>Topic:</strong> ${U.escapeHtml(ev.topic || ev.title)}</p>
        <p><strong>Date:</strong> ${U.formatDate(ev.event_date)}${ev.event_time ? ' · ' + U.escapeHtml(ev.event_time) : ''}</p>
        ${ev.location ? `<p><strong>Location:</strong> ${U.escapeHtml(ev.location)}</p>` : ''}
        ${description}
        ${capacity}
        ${organizer}
        ${tags ? `<div class="event-tags">${tags}</div>` : ''}
        ${registration}
      </div>`;
}

async function loadPublicEvents() {
    const grid = document.getElementById('eventsGrid');
    if (!grid) return;
    grid.innerHTML = `<div class="loading-state">Loading events…</div>`;

    const { data, error } = await window.CatalystDB
        .from('events')
        .select('*')
        .eq('published', true)
        .order('event_date', { ascending: true, nullsFirst: false });

    if (error) {
        console.error('[Catalyst] Failed to load events:', error.message);
        grid.innerHTML = `<div class="error-state">Couldn't load events right now. Please refresh to try again.</div>`;
        return;
    }

    allEvents = data || [];

    if (allEvents.length === 0) {
        grid.innerHTML = `<div class="empty-state">No events are live yet. Check back soon.</div>`;
        return;
    }

    grid.innerHTML = allEvents.map(eventCardHtml).join('');
}

/* ============================== Site content (CMS) ============================== */

async function loadSiteContent() {
    const { data, error } = await window.CatalystDB.from('site_settings').select('key, value');
    if (error) {
        console.error('[Catalyst] Failed to load site content, using defaults:', error.message);
        return;
    }
    const settings = {};
    (data || []).forEach((row) => { settings[row.key] = row.value; });

    if (settings.banner) {
        const banner = document.getElementById('constructionBanner');
        if (banner) {
            banner.textContent = settings.banner.text || banner.textContent;
            banner.style.display = settings.banner.enabled === false ? 'none' : '';
        }
    }
    if (settings.home) {
        setText('homeHeading', settings.home.heading);
        setText('homeIntro', settings.home.intro);
        setText('homeCtaHeading', settings.home.cta_heading);
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

function setText(id, value) {
    if (value === undefined || value === null) return;
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/* ============================== Newsletter (unchanged behavior) ============================== */

function handleSubscribe(event) {
    event.preventDefault();
    U.toast("Thank you! You've been added to our notification list.", 'success');
    event.target.reset();
}

/* ============================== Auth UI ============================== */

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
              ${state.profile.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : ''}
            </div>
            <button type="button" class="btn-outline" id="logoutBtn">Log out</button>
          </div>`;
        document.getElementById('logoutBtn').addEventListener('click', handleLogoutClick);

        if (adminNavItem) adminNavItem.style.display = state.profile.role === 'admin' ? '' : 'none';
    } else {
        area.innerHTML = `
          <div class="auth-controls">
            <button type="button" class="btn-outline" onclick="U.openModal('authModal'); showAuthPanel('login')">Log in</button>
            <button type="button" class="btn-solid" onclick="U.openModal('authModal'); showAuthPanel('signup')">Sign up</button>
          </div>`;
        if (adminNavItem) adminNavItem.style.display = 'none';
    }

    applyThemeUI(state.profile);
}

async function handleLogoutClick() {
    try {
        await window.CatalystAuth.signOut();
        U.toast('You have been logged out.', 'success');
    } catch (err) {
        U.toast(err.message || 'Failed to log out.', 'error');
    }
}

/* ---- Auth modal: panel switching ---- */

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
    box.textContent = message;
    box.classList.add('visible');
}

function showAuthSuccess(panel, message) {
    const box = document.getElementById(`authSuccess-${panel}`);
    box.textContent = message;
    box.classList.add('visible');
}

/* ---- Sign up ---- */

async function handleSignupSubmit(event) {
    event.preventDefault();
    clearAuthMessages();

    const fullName = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const submitBtn = document.getElementById('signupSubmitBtn');

    if (fullName.length < 2) return showAuthError('signup', 'Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showAuthError('signup', 'Please enter a valid email address.');
    if (password.length < 8) return showAuthError('signup', 'Password must be at least 8 characters.');
    if (password !== confirm) return showAuthError('signup', 'Passwords do not match.');

    U.setLoading(submitBtn, true, 'Creating account…');
    try {
        const data = await window.CatalystAuth.signUp({ fullName, email, password });
        if (!data.session) {
            // Email confirmation is enabled on this project
            showAuthSuccess('signup', 'Account created! Check your email to confirm your address before logging in.');
            event.target.reset();
        } else {
            U.toast('Account created — you are now logged in.', 'success');
            U.closeModal('authModal');
            event.target.reset();
        }
    } catch (err) {
        showAuthError('signup', err.message || 'Could not create your account.');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

/* ---- Login ---- */

async function handleLoginSubmit(event) {
    event.preventDefault();
    clearAuthMessages();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (!email || !password) return showAuthError('login', 'Please enter your email and password.');

    U.setLoading(submitBtn, true, 'Logging in…');
    try {
        await window.CatalystAuth.signIn({ email, password });
        U.toast('Welcome back!', 'success');
        U.closeModal('authModal');
        event.target.reset();
    } catch (err) {
        showAuthError('login', err.message || 'Invalid email or password.');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

/* ---- Forgot password ---- */

async function handleForgotSubmit(event) {
    event.preventDefault();
    clearAuthMessages();

    const email = document.getElementById('forgotEmail').value.trim();
    const submitBtn = document.getElementById('forgotSubmitBtn');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showAuthError('forgot', 'Please enter a valid email address.');

    U.setLoading(submitBtn, true, 'Sending…');
    try {
        await window.CatalystAuth.sendPasswordReset(email);
        showAuthSuccess('forgot', 'If an account exists for that email, a reset link is on its way.');
        event.target.reset();
    } catch (err) {
        showAuthError('forgot', err.message || 'Could not send the reset email.');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

/* ---- Set new password (arrived via reset-link) ---- */

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

    if (pw1.length < 8) { box.textContent = 'Password must be at least 8 characters.'; box.classList.add('visible'); return; }
    if (pw1 !== pw2) { box.textContent = 'Passwords do not match.'; box.classList.add('visible'); return; }

    U.setLoading(submitBtn, true, 'Saving…');
    try {
        await window.CatalystAuth.updatePassword(pw1);
        await window.CatalystAuth.refreshProfile();
        U.toast('Password updated. You are now logged in.', 'success');
        U.closeModal('resetPasswordModal');
        event.target.reset();
    } catch (err) {
        box.textContent = err.message || 'Could not update your password.';
        box.classList.add('visible');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

/* ============================== Init ============================== */

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    loadPublicEvents();
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
