const U = window.CatalystUtils;
let allAdminEvents = []; 
let allAdminUsers = []; 

async function guardAdminAccess() {
    await window.CatalystAuth.init();
    const profile = window.CatalystAuth.getProfile();
    const session = window.CatalystAuth.getSession();

    const guardScreen = document.getElementById('adminGuardScreen');
    const shell = document.getElementById('adminShell');

    if (!session?.user) {
        guardScreen.innerHTML = `
          <div class="guard-box glass-panel reveal">
            <h1><i class="ph ph-lock-key"></i> Restricted Access</h1>
            <p>Authentication required. Sysadmins only.</p>
            <a class="btn-glow" href="index.html" style="text-decoration:none; display:inline-flex; margin-top:20px;">Return to Hub</a>
          </div>`;
        guardScreen.style.display = 'flex';
        shell.style.display = 'none';
        return false;
    }

    if (profile?.role !== 'admin') {
        guardScreen.innerHTML = `
          <div class="guard-box glass-panel reveal">
            <h1><i class="ph ph-prohibit"></i> Clearance Denied</h1>
            <p>Your current pilot identity lacks command privileges.</p>
            <a class="btn-glow" href="index.html" style="text-decoration:none; display:inline-flex; margin-top:20px;">Return to Hub</a>
          </div>`;
        guardScreen.style.display = 'flex';
        shell.style.display = 'none';
        return false;
    }

    guardScreen.style.display = 'none';
    shell.style.display = 'flex';
    document.getElementById('adminUserName').textContent = profile.full_name || profile.email;
    U.applyEffectiveTheme(profile); 
    return true;
}

async function handleAdminLogout() {
    await window.CatalystAuth.signOut();
    window.location.href = 'index.html';
}

function adminGoTo(page) {
    document.querySelectorAll('.admin-page').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach((b) => b.classList.remove('active'));
    document.getElementById(`admin-${page}`).classList.add('active');
    document.querySelector(`.admin-nav-item[data-page="${page}"]`).classList.add('active');

    if (page === 'overview') loadOverviewStats();
    if (page === 'events') loadEventsTable();
    if (page === 'users') loadUsersTable();
    if (page === 'content') loadContentForm();
    setTimeout(() => U.initScrollReveals(), 50);
}

async function loadOverviewStats() {
    const grid = document.getElementById('statGrid');
    grid.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Reading telemetry…</div>`;

    const db = window.CatalystDB;
    const [totalRes, upcomingRes, pastRes, draftRes, usersRes] = await Promise.all([
        db.from('events').select('id', { count: 'exact', head: true }),
        db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'upcoming').eq('published', true),
        db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'past'),
        db.from('events').select('id', { count: 'exact', head: true }).eq('published', false),
        db.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    const errored = [totalRes, upcomingRes, pastRes, draftRes, usersRes].find((r) => r.error);
    if (errored) {
        grid.innerHTML = `<div class="error-state"><i class="ph ph-warning"></i> Telemetry error: ${U.escapeHtml(errored.error.message)}</div>`;
        return;
    }

    const stats = [
        ['<i class="ph ph-database"></i> Total Operations', totalRes.count],
        ['<i class="ph ph-broadcast"></i> Live / Upcoming', upcomingRes.count],
        ['<i class="ph ph-archive"></i> Archived', pastRes.count],
        ['<i class="ph ph-file-dashed"></i> Offline Drafts', draftRes.count],
        ['<i class="ph ph-users-three"></i> Registered Pilots', usersRes.count],
    ];

    grid.innerHTML = stats.map(([label, value]) => `
        <div class="stat-card reveal">
          <div class="stat-label">${label}</div>
          <div class="stat-value">${value ?? 0}</div>
        </div>`).join('');
    setTimeout(() => U.initScrollReveals(), 50);
}

function eventRowHtml(ev) {
    const statusPill = ev.status === 'upcoming'
        ? '<span class="pill pill-upcoming"><i class="ph ph-clock"></i> Upcoming</span>'
        : '<span class="pill pill-past"><i class="ph ph-archive"></i> Past</span>';
    const publishedPill = ev.published
        ? '<span class="pill pill-published"><i class="ph ph-wifi-high"></i> Live</span>'
        : '<span class="pill pill-draft"><i class="ph ph-wifi-slash"></i> Offline</span>';

    return `
      <tr data-id="${ev.id}">
        <td style="font-weight:600;">${U.escapeHtml(ev.title)}</td>
        <td><span class="tag">${U.escapeHtml(ev.category)}</span></td>
        <td>${U.formatDate(ev.event_date)}</td>
        <td>${statusPill}</td>
        <td>${publishedPill}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit"><i class="ph ph-pencil-simple"></i> Edit</button>
            <button type="button" data-action="toggle-publish"><i class="ph ph-power"></i> ${ev.published ? 'Offline' : 'Deploy'}</button>
            <button type="button" data-action="duplicate"><i class="ph ph-copy"></i> Clone</button>
            <button type="button" class="danger" data-action="delete"><i class="ph ph-trash"></i> Drop</button>
          </div>
        </td>
      </tr>`;
}

function renderEventsTable(events) {
    const wrap = document.getElementById('eventsTableWrap');
    if (events.length === 0) {
        wrap.innerHTML = `<div class="empty-state"><i class="ph ph-database"></i> No operations match query.</div>`;
        return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Designation</th><th>Class</th><th>Date</th><th>Status</th><th>Uplink</th><th>Actions</th></tr>
          </thead>
          <tbody>${events.map(eventRowHtml).join('')}</tbody>
        </table>
      </div>`;

    wrap.querySelectorAll('tr[data-id]').forEach((row) => {
        const id = row.dataset.id;
        const ev = allAdminEvents.find((e) => e.id === id);
        row.querySelector('[data-action="edit"]').addEventListener('click', () => openEventForm(ev));
        row.querySelector('[data-action="duplicate"]').addEventListener('click', () => duplicateEvent(ev));
        row.querySelector('[data-action="toggle-publish"]').addEventListener('click', () => togglePublish(ev));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteEvent(ev));
    });
}

async function loadEventsTable() {
    const wrap = document.getElementById('eventsTableWrap');
    wrap.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Fetching operations...</div>`;

    const { data, error } = await window.CatalystDB
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        wrap.innerHTML = `<div class="error-state"><i class="ph ph-warning"></i> Error: ${U.escapeHtml(error.message)}</div>`;
        return;
    }

    allAdminEvents = data || [];
    renderEventsTable(allAdminEvents);
}

function filterEventsTable() {
    const query = document.getElementById('adminEventSearch').value.toLowerCase();
    if (!query) return renderEventsTable(allAdminEvents);
    const filtered = allAdminEvents.filter((ev) =>
        [ev.title, ev.category, ev.topic, ev.location].join(' ').toLowerCase().includes(query)
    );
    renderEventsTable(filtered);
}

function openEventForm(ev) {
    const form = document.getElementById('eventForm');
    form.reset();
    document.getElementById('eventFormTitle').innerHTML = ev ? '<i class="ph ph-pencil-simple"></i> Modify Operation' : '<i class="ph ph-plus-circle"></i> Initialize Operation';
    document.getElementById('eventId').value = ev ? ev.id : '';

    document.getElementById('eventTitle').value = ev?.title || '';
    document.getElementById('eventCategory').value = ev?.category || 'WORKSHOP';
    document.getElementById('eventTopic').value = ev?.topic || '';
    document.getElementById('eventDescription').value = ev?.description || '';
    document.getElementById('eventDate').value = ev?.event_date || '';
    document.getElementById('eventTime').value = ev?.event_time || '';
    document.getElementById('eventLocation').value = ev?.location || '';
    document.getElementById('eventImageUrl').value = ev?.image_url || '';
    document.getElementById('eventRegistrationUrl').value = ev?.registration_url || '';
    document.getElementById('eventCapacity').value = ev?.capacity ?? '';
    document.getElementById('eventOrganizer').value = ev?.organizer || '';
    document.getElementById('eventTags').value = (ev?.tags || []).join(', ');
    document.getElementById('eventStatus').value = ev?.status || 'upcoming';
    document.getElementById('eventPublished').checked = ev ? !!ev.published : false;

    document.getElementById('eventFormError').classList.remove('visible');
    U.openModal('eventModal');
}

async function handleEventFormSubmit(e) {
    e.preventDefault();
    const errorBox = document.getElementById('eventFormError');
    errorBox.classList.remove('visible');

    const id = document.getElementById('eventId').value || null;
    const title = document.getElementById('eventTitle').value.trim();
    const eventDate = document.getElementById('eventDate').value || null;

    if (!title) { errorBox.innerHTML = '<i class="ph ph-warning"></i> Designation is required.'; errorBox.classList.add('visible'); return; }

    const tags = document.getElementById('eventTags').value
        .split(',').map((t) => t.trim()).filter(Boolean);

    const capacityRaw = document.getElementById('eventCapacity').value;

    const payload = {
        title,
        category: document.getElementById('eventCategory').value.trim() || 'WORKSHOP',
        topic: document.getElementById('eventTopic').value.trim(),
        description: document.getElementById('eventDescription').value.trim(),
        event_date: eventDate,
        event_time: document.getElementById('eventTime').value.trim() || 'TBA',
        location: document.getElementById('eventLocation').value.trim() || 'TBA',
        image_url: document.getElementById('eventImageUrl').value.trim() || null,
        registration_url: document.getElementById('eventRegistrationUrl').value.trim() || null,
        capacity: capacityRaw ? parseInt(capacityRaw, 10) : null,
        organizer: document.getElementById('eventOrganizer').value.trim(),
        tags,
        status: document.getElementById('eventStatus').value,
        published: document.getElementById('eventPublished').checked,
    };

    const submitBtn = document.getElementById('eventSubmitBtn');
    U.setLoading(submitBtn, true, 'Transmitting…');

    try {
        if (id) {
            const { error } = await window.CatalystDB.from('events').update(payload).eq('id', id);
            if (error) throw error;
            U.toast('Operation modified.', 'success');
        } else {
            const session = window.CatalystAuth.getSession();
            payload.created_by = session?.user?.id || null;
            const { error } = await window.CatalystDB.from('events').insert(payload);
            if (error) throw error;
            U.toast('Operation initialized.', 'success');
        }
        U.closeModal('eventModal');
        loadEventsTable();
        loadOverviewStats();
    } catch (err) {
        errorBox.innerHTML = `<i class="ph ph-warning"></i> ${err.message || 'Transmission failed.'}`;
        errorBox.classList.add('visible');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

async function duplicateEvent(ev) {
    const copy = { ...ev };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    copy.title = `${ev.title} (Clone)`;
    copy.published = false;

    const session = window.CatalystAuth.getSession();
    copy.created_by = session?.user?.id || null;

    const { error } = await window.CatalystDB.from('events').insert(copy);
    if (error) { U.toast(`Clone failed: ${error.message}`, 'error'); return; }
    U.toast('Operation cloned offline.', 'success');
    loadEventsTable();
    loadOverviewStats();
}

async function togglePublish(ev) {
    const { error } = await window.CatalystDB
        .from('events')
        .update({ published: !ev.published })
        .eq('id', ev.id);
    if (error) { U.toast(`Uplink error: ${error.message}`, 'error'); return; }
    U.toast(ev.published ? 'Operation offline.' : 'Operation live.', 'success');
    loadEventsTable();
    loadOverviewStats();
}

async function deleteEvent(ev) {
    const confirmed = await U.confirmAction(`Terminate operation "${ev.title}"? This cannot be reversed.`, 'Terminate');
    if (!confirmed) return;

    const { error } = await window.CatalystDB.from('events').delete().eq('id', ev.id);
    if (error) { U.toast(`Drop failed: ${error.message}`, 'error'); return; }
    U.toast('Operation terminated.', 'success');
    loadEventsTable();
    loadOverviewStats();
}

const THEME_OPTIONS = [
    { value: '', label: 'Default (Free Toggle)' },
    { value: 'gamedev', label: 'Retro Arcade 🕹️' },
    { value: 'robotic', label: 'Embedded Robotics 🤖' },
    { value: 'biological', label: 'Biological Lab 🧬' },
    { value: 'space', label: 'Deep Space 🚀' },
];

function userRowHtml(u) {
    const roleBadge = u.role === 'admin'
        ? '<span class="badge badge-admin">SYSADM</span>'
        : '<span class="badge" style="border-color:var(--text-muted); color:var(--text-muted)">Pilot</span>';

    const currentTheme = u.theme || '';
    const options = THEME_OPTIONS.map((opt) =>
        `<option value="${opt.value}" ${opt.value === currentTheme ? 'selected' : ''}>${U.escapeHtml(opt.label)}</option>`
    ).join('');

    return `
      <tr data-id="${u.id}">
        <td style="font-weight:500;"><i class="ph ph-user"></i> ${U.escapeHtml(u.full_name || '—')}</td>
        <td>${U.escapeHtml(u.email)}</td>
        <td>${roleBadge}</td>
        <td>${U.formatDate((u.created_at || '').slice(0, 10))}</td>
        <td><select class="theme-select" style="padding:4px;" data-id="${u.id}">${options}</select></td>
        <td><button type="button" class="btn-outline" style="padding:4px 8px; font-size:0.75rem;" data-action="save-theme"><i class="ph ph-floppy-disk"></i> Save</button></td>
      </tr>`;
}

function renderUsersTable(users) {
    const wrap = document.getElementById('usersTableWrap');
    if (users.length === 0) {
        wrap.innerHTML = `<div class="empty-state"><i class="ph ph-users"></i> No personnel found.</div>`;
        return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Designation</th><th>Address</th><th>Access</th><th>Registered</th><th>Environment</th><th></th></tr>
          </thead>
          <tbody>${users.map(userRowHtml).join('')}</tbody>
        </table>
      </div>`;

    wrap.querySelectorAll('tr[data-id]').forEach((row) => {
        const id = row.dataset.id;
        const select = row.querySelector('.theme-select');
        const saveBtn = row.querySelector('[data-action="save-theme"]');
        saveBtn.addEventListener('click', () => saveUserTheme(id, select.value, saveBtn));
    });
}

async function loadUsersTable() {
    const wrap = document.getElementById('usersTableWrap');
    wrap.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Fetching directory...</div>`;

    const { data, error } = await window.CatalystDB
        .from('profiles')
        .select('id, full_name, email, role, theme, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        wrap.innerHTML = `<div class="error-state"><i class="ph ph-warning"></i> Error: ${U.escapeHtml(error.message)}</div>`;
        return;
    }

    allAdminUsers = data || [];
    renderUsersTable(allAdminUsers);
}

function filterUsersTable() {
    const query = document.getElementById('adminUserSearch').value.toLowerCase();
    if (!query) return renderUsersTable(allAdminUsers);
    const filtered = allAdminUsers.filter((u) =>
        [u.full_name, u.email].join(' ').toLowerCase().includes(query)
    );
    renderUsersTable(filtered);
}

async function saveUserTheme(userId, theme, btn) {
    U.setLoading(btn, true, '...');
    try {
        const { error } = await window.CatalystDB
            .from('profiles')
            .update({ theme: theme || null })
            .eq('id', userId);
        if (error) throw error;

        const u = allAdminUsers.find((x) => x.id === userId);
        if (u) u.theme = theme || null;

        U.toast('Environment profile saved.', 'success');

        const session = window.CatalystAuth.getSession();
        if (session?.user?.id === userId) {
            await window.CatalystAuth.refreshProfile();
            U.applyEffectiveTheme(window.CatalystAuth.getProfile());
        }
    } catch (err) {
        U.toast(`Update failed: ${err.message}`, 'error');
    } finally {
        U.setLoading(btn, false);
    }
}

window.applyGlobalTheme = async function() {
    const globalThemeSelect = document.getElementById('global-theme-select');
    if (!globalThemeSelect) return;
    
    const selectedTheme = globalThemeSelect.value;
    const themeName = globalThemeSelect.options[globalThemeSelect.selectedIndex].text;
    
    const confirmUpdate = await U.confirmAction(`Force environment sync to "${themeName}" for ALL pilots?`, 'Execute Force Sync');
    if (!confirmUpdate) return;

    const btn = document.getElementById('btn-apply-global-theme');
    U.setLoading(btn, true, 'Executing...');

    try {
        const { error } = await window.CatalystDB
            .from('profiles')
            .update({ theme: selectedTheme || null })
            .not('id', 'is', null);

        if (error) throw error;

        allAdminUsers.forEach(u => u.theme = selectedTheme || null);
        renderUsersTable(allAdminUsers);

        const session = window.CatalystAuth.getSession();
        if (session?.user) {
            await window.CatalystAuth.refreshProfile();
            U.applyEffectiveTheme(window.CatalystAuth.getProfile());
        }

        U.toast(`Mass environment sync complete.`, 'success');
    } catch (error) {
        U.toast(`Sync failed: ${error.message}`, 'error');
    } finally {
        U.setLoading(btn, false);
    }
};

async function loadContentForm() {
    const { data, error } = await window.CatalystDB.from('site_settings').select('key, value');
    if (error) { U.toast(`CMS Error: ${error.message}`, 'error'); return; }

    const settings = {};
    (data || []).forEach((row) => { settings[row.key] = row.value; });

    setVal('cmsBannerEnabled', settings.banner?.enabled !== false, true);
    setVal('cmsBannerText', settings.banner?.text || '');
    setVal('cmsHomeHeading', settings.home?.heading || '');
    setVal('cmsHomeIntro', settings.home?.intro || '');
    setVal('cmsHomeCtaHeading', settings.home?.cta_heading || '');
    setVal('cmsHomeCtaText', settings.home?.cta_text || '');
    setVal('cmsAboutHeading', settings.about?.heading || '');
    setVal('cmsAboutParagraph1', settings.about?.paragraph1 || '');
    setVal('cmsAboutParagraph2', settings.about?.paragraph2 || '');
    setVal('cmsMoreSponsorship', settings.more?.sponsorship_text || '');
    setVal('cmsMoreVolunteer', settings.more?.volunteer_text || '');
    setVal('cmsFooterText', settings.footer?.text || '');
}

function setVal(id, value, isCheckbox) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isCheckbox) el.checked = !!value; else el.value = value;
}

async function saveContentSection(key, fieldsMap, buttonId) {
    const value = {};
    Object.entries(fieldsMap).forEach(([jsonKey, elId]) => {
        const el = document.getElementById(elId);
        value[jsonKey] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });

    const btn = document.getElementById(buttonId);
    U.setLoading(btn, true, 'Committing...');
    try {
        const { error } = await window.CatalystDB.from('site_settings').upsert({ key, value });
        if (error) throw error;
        U.toast('String update deployed to live environment.', 'success');
    } catch (err) {
        U.toast(`Deployment failed: ${err.message}`, 'error');
    } finally {
        U.setLoading(btn, false);
    }
}

function saveBannerContent() { saveContentSection('banner', { enabled: 'cmsBannerEnabled', text: 'cmsBannerText' }, 'cmsBannerSaveBtn'); }
function saveHomeContent() { saveContentSection('home', { heading: 'cmsHomeHeading', intro: 'cmsHomeIntro', cta_heading: 'cmsHomeCtaHeading', cta_text: 'cmsHomeCtaText' }, 'cmsHomeSaveBtn'); }
function saveAboutContent() { saveContentSection('about', { heading: 'cmsAboutHeading', paragraph1: 'cmsAboutParagraph1', paragraph2: 'cmsAboutParagraph2' }, 'cmsAboutSaveBtn'); }
function saveMoreContent() { saveContentSection('more', { sponsorship_text: 'cmsMoreSponsorship', volunteer_text: 'cmsMoreVolunteer' }, 'cmsMoreSaveBtn'); }
function saveFooterContent() { saveContentSection('footer', { text: 'cmsFooterText' }, 'cmsFooterSaveBtn'); }

document.addEventListener('DOMContentLoaded', async () => {
    U.initLocalTheme(); 
    U.initInteractions();

    const ok = await guardAdminAccess();
    if (!ok) return;

    document.getElementById('adminEventSearch').addEventListener('keyup', U.debounce(filterEventsTable, 150));
    document.getElementById('eventForm').addEventListener('submit', handleEventFormSubmit);
    document.getElementById('adminUserSearch').addEventListener('keyup', U.debounce(filterUsersTable, 150));

    loadOverviewStats();
});