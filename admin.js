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
    const sessionEmail = window.CatalystAuth.getSession()?.user?.email;
    document.getElementById('adminUserName').textContent = profile.full_name || profile.email || sessionEmail || 'Administrator';
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
    if (page === 'learn') loadLearningHubAdmin();
    if (page === 'partners') loadPartnersAdmin();
    if (page === 'team') loadTeamTable();
    if (page === 'leaderboard') loadLeaderboardTable();
    if (page === 'users') loadUsersTable();
    if (page === 'content') loadContentForm();
    setTimeout(() => U.initScrollReveals(), 50);
}

async function loadOverviewStats() {
    const grid = document.getElementById('statGrid');
    grid.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Reading telemetry…</div>`;

    const db = window.CatalystDB;
    const [totalRes, upcomingRes, pastRes, draftRes, usersRes, teamRes, pointsRes] = await Promise.all([
        db.from('events').select('id', { count: 'exact', head: true }),
        db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'upcoming').eq('published', true),
        db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'past'),
        db.from('events').select('id', { count: 'exact', head: true }).eq('published', false),
        db.from('profiles').select('id', { count: 'exact', head: true }),
        db.from('team_members').select('id', { count: 'exact', head: true }),
        db.from('profiles').select('points'),
    ]);

    const errored = [totalRes, upcomingRes, pastRes, draftRes, usersRes, teamRes, pointsRes].find((r) => r.error);
    if (errored) {
        grid.innerHTML = `<div class="error-state"><i class="ph ph-warning"></i> Telemetry error: ${U.escapeHtml(errored.error.message)}</div>`;
        return;
    }

    const totalPoints = (pointsRes.data || []).reduce((sum, p) => sum + (p.points || 0), 0);

    const stats = [
        ['<i class="ph ph-database"></i> Total Operations', totalRes.count],
        ['<i class="ph ph-broadcast"></i> Live / Upcoming', upcomingRes.count],
        ['<i class="ph ph-archive"></i> Archived', pastRes.count],
        ['<i class="ph ph-file-dashed"></i> Offline Drafts', draftRes.count],
        ['<i class="ph ph-users-three"></i> Registered Pilots', usersRes.count],
        ['<i class="ph ph-identification-badge"></i> Team Roster', teamRes.count],
        ['<i class="ph ph-trophy"></i> Points Awarded', totalPoints],
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
            <button type="button" data-action="manage-media"><i class="ph ph-image"></i> Media</button>
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
        row.querySelector('[data-action="manage-media"]').addEventListener('click', () => openEventMedia(ev));
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

/* ============================== Team Members ============================== */

let allAdminMembers = [];

function memberRowHtml(m) {
    const publishedPill = m.published
        ? '<span class="pill pill-published"><i class="ph ph-wifi-high"></i> Live</span>'
        : '<span class="pill pill-draft"><i class="ph ph-wifi-slash"></i> Offline</span>';
    const avatar = m.image_url
        ? `<img src="${U.escapeHtml(m.image_url)}" alt="" style="width:28px; height:28px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:8px;">`
        : '<i class="ph ph-user-circle"></i> ';

    return `
      <tr data-id="${m.id}">
        <td style="font-weight:600;">${avatar}${U.escapeHtml(m.name)}</td>
        <td>${U.escapeHtml(m.role || '—')}</td>
        <td>${m.sort_order}</td>
        <td>${publishedPill}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit"><i class="ph ph-pencil-simple"></i> Edit</button>
            <button type="button" data-action="toggle-publish"><i class="ph ph-power"></i> ${m.published ? 'Offline' : 'Deploy'}</button>
            <button type="button" class="danger" data-action="delete"><i class="ph ph-trash"></i> Drop</button>
          </div>
        </td>
      </tr>`;
}

function renderTeamTable(members) {
    const wrap = document.getElementById('teamTableWrap');
    if (members.length === 0) {
        wrap.innerHTML = `<div class="empty-state"><i class="ph ph-identification-badge"></i> No team members yet. Use "Add Team Member" to add one.</div>`;
        return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Name</th><th>Role</th><th>Order</th><th>Uplink</th><th>Actions</th></tr>
          </thead>
          <tbody>${members.map(memberRowHtml).join('')}</tbody>
        </table>
      </div>`;

    wrap.querySelectorAll('tr[data-id]').forEach((row) => {
        const id = row.dataset.id;
        const m = allAdminMembers.find((x) => x.id === id);
        row.querySelector('[data-action="edit"]').addEventListener('click', () => openMemberForm(m));
        row.querySelector('[data-action="toggle-publish"]').addEventListener('click', () => toggleMemberPublish(m));
        row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteMember(m));
    });
}

async function loadTeamTable() {
    const wrap = document.getElementById('teamTableWrap');
    wrap.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Loading roster…</div>`;

    const { data, error } = await window.CatalystDB
        .from('team_members')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        wrap.innerHTML = `<div class="error-state"><i class="ph ph-warning"></i> Error: ${U.escapeHtml(error.message)}</div>`;
        return;
    }

    allAdminMembers = data || [];
    renderTeamTable(allAdminMembers);
}

function filterTeamTable() {
    const query = document.getElementById('adminTeamSearch').value.toLowerCase();
    if (!query) return renderTeamTable(allAdminMembers);
    const filtered = allAdminMembers.filter((m) =>
        [m.name, m.role].join(' ').toLowerCase().includes(query)
    );
    renderTeamTable(filtered);
}

function openMemberForm(m) {
    const form = document.getElementById('memberForm');
    form.reset();
    document.getElementById('memberFormTitle').innerHTML = m ? '<i class="ph ph-pencil-simple"></i> Edit Team Member' : '<i class="ph ph-plus-circle"></i> Add Team Member';
    document.getElementById('memberId').value = m ? m.id : '';

    document.getElementById('memberName').value = m?.name || '';
    document.getElementById('memberRole').value = m?.role || '';
    document.getElementById('memberBio').value = m?.bio || '';
    document.getElementById('memberImageUrl').value = m?.image_url || '';
    document.getElementById('memberSortOrder').value = m?.sort_order ?? 0;
    document.getElementById('memberPublished').checked = m ? !!m.published : true;

    document.getElementById('memberFormError').classList.remove('visible');
    U.openModal('memberModal');
}

async function handleMemberFormSubmit(e) {
    e.preventDefault();
    const errorBox = document.getElementById('memberFormError');
    errorBox.classList.remove('visible');

    const id = document.getElementById('memberId').value || null;
    const name = document.getElementById('memberName').value.trim();

    if (!name) { errorBox.innerHTML = '<i class="ph ph-warning"></i> Name is required.'; errorBox.classList.add('visible'); return; }

    const sortOrderRaw = document.getElementById('memberSortOrder').value;

    const payload = {
        name,
        role: document.getElementById('memberRole').value.trim(),
        bio: document.getElementById('memberBio').value.trim(),
        image_url: document.getElementById('memberImageUrl').value.trim() || null,
        sort_order: sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0,
        published: document.getElementById('memberPublished').checked,
    };

    const submitBtn = document.getElementById('memberSubmitBtn');
    U.setLoading(submitBtn, true, 'Saving…');

    try {
        if (id) {
            const { error } = await window.CatalystDB.from('team_members').update(payload).eq('id', id);
            if (error) throw error;
            U.toast('Team member updated.', 'success');
        } else {
            const session = window.CatalystAuth.getSession();
            payload.created_by = session?.user?.id || null;
            const { error } = await window.CatalystDB.from('team_members').insert(payload);
            if (error) throw error;
            U.toast('Team member added.', 'success');
        }
        U.closeModal('memberModal');
        loadTeamTable();
    } catch (err) {
        errorBox.innerHTML = `<i class="ph ph-warning"></i> ${err.message || 'Save failed.'}`;
        errorBox.classList.add('visible');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

async function toggleMemberPublish(m) {
    const { error } = await window.CatalystDB
        .from('team_members')
        .update({ published: !m.published })
        .eq('id', m.id);
    if (error) { U.toast(`Update failed: ${error.message}`, 'error'); return; }
    U.toast(m.published ? 'Member hidden from public site.' : 'Member is now live.', 'success');
    loadTeamTable();
}

async function deleteMember(m) {
    const confirmed = await U.confirmAction(`Remove "${m.name}" from the team roster? This cannot be reversed.`, 'Remove');
    if (!confirmed) return;

    const { error } = await window.CatalystDB.from('team_members').delete().eq('id', m.id);
    if (error) { U.toast(`Delete failed: ${error.message}`, 'error'); return; }
    U.toast('Team member removed.', 'success');
    loadTeamTable();
}

const THEME_OPTIONS = [
    { value: '', label: 'Default (Free Toggle)' },
    { value: 'gamedev', label: 'Retro Arcade 🕹️' },
    { value: 'robotic', label: 'Embedded Robotics 🤖' },
    { value: 'biological', label: 'Biological Lab 🧬' },
    { value: 'space', label: 'Deep Space 🚀' },
    { value: 'ai', label: 'AI Frontier 🧠' },
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

/* ============================== LEADERBOARD ============================== */
let allAdminLeaderboard = [];

function leaderboardRowHtml(u, rank) {
    const rankClass = rank <= 3 ? ` top-${rank}` : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    return `
      <tr data-id="${u.id}">
        <td class="leaderboard-rank${rankClass}">${medal}</td>
        <td style="font-weight:500;"><i class="ph ph-user"></i> ${U.escapeHtml(u.full_name || '—')}</td>
        <td>${U.escapeHtml(u.email)}</td>
        <td><i class="ph ph-play-circle"></i> ${u.lessons_watched ?? 0}</td>
        <td><i class="ph ph-books"></i> ${u.modules_completed ?? 0}</td>
        <td><span class="points-pill"><i class="ph ph-trophy"></i> ${u.points ?? 0} pts</span></td>
        <td>
          <div class="points-editor">
            <button type="button" class="btn-outline" style="padding:4px 10px;" data-action="subtract" title="Subtract 10"><i class="ph ph-minus"></i> 10</button>
            <button type="button" class="btn-outline" style="padding:4px 10px;" data-action="add" title="Add 10"><i class="ph ph-plus"></i> 10</button>
            <input type="number" class="points-set-input" placeholder="Set total…" style="padding:4px 8px;">
            <button type="button" class="btn-glow" style="padding:4px 10px; font-size:0.75rem;" data-action="set"><i class="ph ph-floppy-disk"></i> Save</button>
          </div>
        </td>
      </tr>`;
}

function renderLeaderboardTable(users) {
    const wrap = document.getElementById('leaderboardTableWrap');
    if (!wrap) return;
    if (users.length === 0) {
        wrap.innerHTML = `<div class="empty-state"><i class="ph ph-trophy"></i> No personnel found.</div>`;
        return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Rank</th><th>Name</th><th>Email</th><th>Watched</th><th>Modules</th><th>Points</th><th>Adjust</th></tr>
          </thead>
          <tbody>${users.map((u, i) => leaderboardRowHtml(u, i + 1)).join('')}</tbody>
        </table>
      </div>`;

    wrap.querySelectorAll('tr[data-id]').forEach((row) => {
        const id = row.dataset.id;
        const u = allAdminLeaderboard.find((x) => x.id === id);
        const setInput = row.querySelector('.points-set-input');

        row.querySelector('[data-action="add"]').addEventListener('click', (e) => quickAdjustPoints(u, 10, e.currentTarget));
        row.querySelector('[data-action="subtract"]').addEventListener('click', (e) => quickAdjustPoints(u, -10, e.currentTarget));
        row.querySelector('[data-action="set"]').addEventListener('click', (e) => {
            const val = parseInt(setInput.value, 10);
            if (Number.isNaN(val)) { U.toast('Enter a number to set the total.', 'error'); return; }
            setTotalPoints(u, val, e.currentTarget);
        });
    });
}

async function loadLeaderboardTable() {
    const wrap = document.getElementById('leaderboardTableWrap');
    wrap.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Fetching leaderboard...</div>`;

    // Pull emails from profiles (the public `leaderboard` view intentionally omits them)
    // and join in points / lessons_watched / modules_completed from the view.
    const [{ data: profiles, error: err1 }, { data: board, error: err2 }] = await Promise.all([
        window.CatalystDB.from('profiles').select('id, full_name, email'),
        window.CatalystDB.from('leaderboard').select('*'),
    ]);

    if (err1 || err2) {
        wrap.innerHTML = `<div class="error-state"><i class="ph ph-warning"></i> Error: ${U.escapeHtml((err1 || err2).message)}</div>`;
        return;
    }

    const emailById = {};
    (profiles || []).forEach((p) => { emailById[p.id] = p.email; });

    allAdminLeaderboard = (board || []).map((u) => ({ ...u, email: emailById[u.id] || '' }));
    renderLeaderboardTable(allAdminLeaderboard);
}

function filterLeaderboardTable() {
    const query = document.getElementById('adminLeaderboardSearch').value.toLowerCase();
    if (!query) return renderLeaderboardTable(allAdminLeaderboard);
    const filtered = allAdminLeaderboard.filter((u) =>
        [u.full_name, u.email].join(' ').toLowerCase().includes(query)
    );
    renderLeaderboardTable(filtered);
}

async function quickAdjustPoints(u, delta, btn) {
    U.setLoading(btn, true, '...');
    try {
        const { error } = await window.CatalystDB.rpc('adjust_user_points', {
            p_user_id: u.id,
            p_delta: delta,
            p_reason: `Manual ${delta > 0 ? 'bonus' : 'penalty'} from admin panel`,
        });
        if (error) throw error;
        u.points = (u.points || 0) + delta;
        U.toast(`${delta > 0 ? 'Added' : 'Subtracted'} ${Math.abs(delta)} points ${delta > 0 ? 'to' : 'from'} ${u.full_name || u.email}.`, 'success');
        renderLeaderboardTable(allAdminLeaderboard);
    } catch (err) {
        U.toast(`Failed: ${err.message}`, 'error');
    } finally {
        U.setLoading(btn, false);
    }
}

async function setTotalPoints(u, newTotal, btn) {
    U.setLoading(btn, true, '...');
    try {
        const { error } = await window.CatalystDB.rpc('set_user_points', {
            p_user_id: u.id,
            p_new_total: newTotal,
            p_reason: 'Manual leaderboard edit from admin panel',
        });
        if (error) throw error;
        u.points = newTotal;
        U.toast(`${u.full_name || u.email}'s total set to ${newTotal} points.`, 'success');
        renderLeaderboardTable(allAdminLeaderboard);
    } catch (err) {
        U.toast(`Failed: ${err.message}`, 'error');
    } finally {
        U.setLoading(btn, false);
    }
}

window.applyGlobalTheme = async function() {
    const globalThemeSelect = document.getElementById('global-theme-select');
    if (!globalThemeSelect) return;
    
    const selectedTheme = globalThemeSelect.value;
    const themeName = globalThemeSelect.options[globalThemeSelect.selectedIndex].text;
    
    const confirmUpdate = await U.confirmAction(`Force global theme to "${themeName}" for EVERYONE?`, 'Execute Force Sync');
    if (!confirmUpdate) return;

    const btn = document.getElementById('btn-apply-global-theme');
    U.setLoading(btn, true, 'Executing...');

    try {
        const { error } = await window.CatalystDB
            .from('site_settings')
            .upsert({ key: 'global_theme', value: { theme: selectedTheme || null } });

        if (error) throw error;

        localStorage.setItem('catalyst-global-theme', selectedTheme || '');
        U.initLocalTheme();

        U.toast(`Global environment sync complete.`, 'success');
    } catch (error) {
        U.toast(`Sync failed: ${error.message}`, 'error');
    } finally {
        U.setLoading(btn, false, 'Apply to All Users');
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
    const existingParagraphs = Array.isArray(settings.about?.paragraphs)
        ? settings.about.paragraphs
        : [settings.about?.paragraph1, settings.about?.paragraph2].filter(Boolean);
    renderAboutParagraphs(existingParagraphs.length ? existingParagraphs : ['']);
    setVal('cmsMoreSponsorship', settings.more?.sponsorship_text || '');
    setVal('cmsMoreVolunteer', settings.more?.volunteer_text || '');
    setVal('cmsFooterText', settings.footer?.text || '');
    
    // Community CTA restore
    setVal('cmsCommunityEnabled', settings.community?.enabled === true, true);
    setVal('cmsCommunityUrl', settings.community?.url || '');
    setVal('cmsCommunityText', settings.community?.text || '');
}

function setVal(id, value, isCheckbox) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isCheckbox) el.checked = !!value; else el.value = value;
}

function renderAboutParagraphs(values) {
    const container = document.getElementById('cmsAboutParagraphs');
    container.innerHTML = '';
    values.forEach((v) => addAboutParagraphField(v));
}

function addAboutParagraphField(value = '') {
    const container = document.getElementById('cmsAboutParagraphs');
    const row = document.createElement('div');
    row.className = 'about-paragraph-row';
    row.style.cssText = 'display:flex; gap:8px; align-items:flex-start; margin-bottom:10px;';
    row.innerHTML = `
        <textarea class="cms-about-paragraph" style="flex:1;">${U.escapeHtml ? U.escapeHtml(value) : value}</textarea>
        <button type="button" class="btn-danger" style="padding:8px 10px; flex-shrink:0;" onclick="this.parentElement.remove()" title="Remove paragraph"><i class="ph ph-trash"></i></button>
    `;
    container.appendChild(row);
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
function saveAboutContent() {
    const paragraphs = Array.from(document.querySelectorAll('#cmsAboutParagraphs .cms-about-paragraph'))
        .map((el) => el.value.trim())
        .filter((v) => v.length > 0);
    saveJsonSection('about', { heading: document.getElementById('cmsAboutHeading').value.trim(), paragraphs }, 'cmsAboutSaveBtn');
}

async function saveJsonSection(key, value, buttonId) {
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
function saveMoreContent() { saveContentSection('more', { sponsorship_text: 'cmsMoreSponsorship', volunteer_text: 'cmsMoreVolunteer' }, 'cmsMoreSaveBtn'); }
function saveFooterContent() { saveContentSection('footer', { text: 'cmsFooterText' }, 'cmsFooterSaveBtn'); }

document.addEventListener('DOMContentLoaded', async () => {
    U.initLocalTheme(); 
    U.initInteractions();

    const ok = await guardAdminAccess();
    if (!ok) return;

    document.getElementById('adminEventSearch').addEventListener('keyup', U.debounce(filterEventsTable, 150));
    document.getElementById('eventForm').addEventListener('submit', handleEventFormSubmit);
    document.getElementById('adminTeamSearch').addEventListener('keyup', U.debounce(filterTeamTable, 150));
    document.getElementById('memberForm').addEventListener('submit', handleMemberFormSubmit);
    document.getElementById('adminUserSearch').addEventListener('keyup', U.debounce(filterUsersTable, 150));
    document.getElementById('adminLeaderboardSearch').addEventListener('keyup', U.debounce(filterLeaderboardTable, 150));

    

    const mf = document.getElementById('moduleForm');
    if (mf) mf.addEventListener('submit', handleModuleSubmit);
    const lf = document.getElementById('lessonForm');
    if (lf) lf.addEventListener('submit', handleLessonSubmit);
    const pf = document.getElementById('partnerForm');
    if (pf) pf.addEventListener('submit', handlePartnerSubmit);
    const em = document.getElementById('mediaForm');
    if (em) em.addEventListener('submit', handleMediaSubmit);
    loadOverviewStats();
});


/* ============================== LEARNING HUB ============================== */
let allAdminModules = [];
let allAdminLessons = [];

async function loadLearningHubAdmin() {
    const modWrap = document.getElementById('modulesTableWrap');
    const lesWrap = document.getElementById('lessonsTableWrap');
    if (!modWrap || !lesWrap) return;

    modWrap.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Loading...</div>`;
    lesWrap.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Loading...</div>`;

    const { data: mods, error: err1 } = await window.CatalystDB.from('learning_modules').select('*').order('sort_order', { ascending: true });
    const { data: less, error: err2 } = await window.CatalystDB.from('learning_lessons').select('*').order('sort_order', { ascending: true });

    if (err1 || err2) {
        modWrap.innerHTML = `<div class="error-state">Error loading learning hub data</div>`;
        lesWrap.innerHTML = `<div class="error-state">Error loading learning hub data</div>`;
        return;
    }
    allAdminModules = mods || [];
    allAdminLessons = less || [];

    renderModulesTable();
    renderLessonsTable();
    
    const sel = document.getElementById('lessonModule');
    if (sel) {
        sel.innerHTML = '<option value="">Select Module...</option>' + allAdminModules.map(m => `<option value="${m.id}">${U.escapeHtml(m.title)}</option>`).join('');
    }
}

function renderModulesTable() {
    const wrap = document.getElementById('modulesTableWrap');
    if (allAdminModules.length === 0) {
        wrap.innerHTML = `<div class="empty-state">No modules found.</div>`;
        return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Order</th><th>Title</th><th>Points</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${allAdminModules.map(m => `
              <tr data-id="${m.id}">
                <td>${m.sort_order}</td>
                <td>${U.escapeHtml(m.title)}</td>
                <td><span class="points-pill"><i class="ph ph-trophy"></i> ${m.points_value ?? 50}</span></td>
                <td>${m.published ? '<span class="pill pill-published"><i class="ph ph-wifi-high"></i> Live</span>' : '<span class="pill pill-draft"><i class="ph ph-wifi-slash"></i> Offline</span>'}</td>
                <td>
                  <div class="row-actions">
                      <button type="button" onclick='openModuleForm(${JSON.stringify(m).replace(/'/g, "&#39;")})'><i class="ph ph-pencil-simple"></i> Edit</button>
                      <button type="button" class="danger" onclick="deleteModule('${m.id}')"><i class="ph ph-trash"></i> Drop</button>
                    </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
}

function renderLessonsTable() {
    const wrap = document.getElementById('lessonsTableWrap');
    if (allAdminLessons.length === 0) {
        wrap.innerHTML = `<div class="empty-state">No lessons found.</div>`;
        return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Order</th><th>Title</th><th>Module</th><th>Points</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${allAdminLessons.map(l => {
                const m = allAdminModules.find(x => x.id === l.module_id);
                return `
              <tr data-id="${l.id}">
                <td>${l.sort_order}</td>
                <td>${U.escapeHtml(l.title)}</td>
                <td>${U.escapeHtml(m ? m.title : 'Unknown')}</td>
                <td><span class="points-pill"><i class="ph ph-trophy"></i> ${l.points_value ?? 10}</span></td>
                <td>${l.published ? '<span class="pill pill-published"><i class="ph ph-wifi-high"></i> Live</span>' : '<span class="pill pill-draft"><i class="ph ph-wifi-slash"></i> Offline</span>'}</td>
                <td>
                  <div class="row-actions">
                      <button type="button" onclick='openLessonForm(${JSON.stringify(l).replace(/'/g, "&#39;")})'><i class="ph ph-pencil-simple"></i> Edit</button>
                      <button type="button" class="danger" onclick="deleteLesson('${l.id}')"><i class="ph ph-trash"></i> Drop</button>
                    </div>
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>`;
}

function openModuleForm(m) {
    document.getElementById('moduleForm').reset();
    document.getElementById('moduleId').value = m ? m.id : '';
    document.getElementById('moduleTitle').value = m?.title || '';
    document.getElementById('moduleDescription').value = m?.description || '';
    document.getElementById('moduleOrder').value = m?.sort_order || 0;
    document.getElementById('modulePoints').value = m?.points_value ?? 50;
    document.getElementById('modulePublished').checked = m ? !!m.published : false;
    document.getElementById('moduleFormTitle').textContent = m ? 'Edit Module' : 'New Module';
    document.getElementById('moduleFormError').classList.remove('visible');
    U.openModal('moduleModal');
}

async function handleModuleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('moduleId').value;
    const payload = {
        title: document.getElementById('moduleTitle').value,
        description: document.getElementById('moduleDescription').value,
        sort_order: parseInt(document.getElementById('moduleOrder').value) || 0,
        points_value: Math.max(0, parseInt(document.getElementById('modulePoints').value, 10) || 0),
        published: document.getElementById('modulePublished').checked
    };
    
    const errBox = document.getElementById('moduleFormError');
    errBox.classList.remove('visible');
    
    let res;
    if (id) {
        res = await window.CatalystDB.from('learning_modules').update(payload).eq('id', id);
    } else {
        res = await window.CatalystDB.from('learning_modules').insert([payload]);
    }
    if (!res.error) {
        U.closeModal('moduleModal');
        U.toast('Module saved successfully', 'success');
        loadLearningHubAdmin();
    } else {
        errBox.textContent = res.error.message;
        errBox.classList.add('visible');
    }
}

async function deleteModule(id) {
    if (!confirm('Drop this module and ALL its lessons?')) return;
    await window.CatalystDB.from('learning_modules').delete().eq('id', id);
    loadLearningHubAdmin();
}

function openLessonForm(l) {
    document.getElementById('lessonForm').reset();
    document.getElementById('lessonId').value = l ? l.id : '';
    document.getElementById('lessonModule').value = l?.module_id || '';
    document.getElementById('lessonTitle').value = l?.title || '';
    document.getElementById('lessonDescription').value = l?.description || '';
    document.getElementById('lessonYouTube').value = l?.youtube_url || '';
    document.getElementById('lessonSummary').value = l?.catalyst_summary || '';
    document.getElementById('lessonAnalysis').value = l?.catalyst_analysis || '';
    document.getElementById('lessonOrder').value = l?.sort_order || 0;
    document.getElementById('lessonPoints').value = l?.points_value ?? 10;
    document.getElementById('lessonPublished').checked = l ? !!l.published : false;
    document.getElementById('lessonFormTitle').textContent = l ? 'Edit Lesson' : 'New Lesson';
    document.getElementById('lessonFormError').classList.remove('visible');
    U.openModal('lessonModal');
}

async function handleLessonSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('lessonId').value;
    const payload = {
        module_id: document.getElementById('lessonModule').value,
        title: document.getElementById('lessonTitle').value,
        description: document.getElementById('lessonDescription').value,
        youtube_url: document.getElementById('lessonYouTube').value,
        catalyst_summary: document.getElementById('lessonSummary').value,
        catalyst_analysis: document.getElementById('lessonAnalysis').value,
        sort_order: parseInt(document.getElementById('lessonOrder').value) || 0,
        points_value: Math.max(0, parseInt(document.getElementById('lessonPoints').value, 10) || 0),
        published: document.getElementById('lessonPublished').checked
    };
    
    const errBox = document.getElementById('lessonFormError');
    errBox.classList.remove('visible');

    let res;
    if (id) {
        res = await window.CatalystDB.from('learning_lessons').update(payload).eq('id', id);
    } else {
        res = await window.CatalystDB.from('learning_lessons').insert([payload]);
    }
    if (!res.error) {
        U.closeModal('lessonModal');
        U.toast('Lesson saved successfully', 'success');
        loadLearningHubAdmin();
    } else {
        errBox.textContent = res.error.message;
        errBox.classList.add('visible');
    }
}

async function deleteLesson(id) {
    if (!confirm('Drop this lesson?')) return;
    await window.CatalystDB.from('learning_lessons').delete().eq('id', id);
    loadLearningHubAdmin();
}

/* ============================== PARTNERS ============================== */
let allAdminPartners = [];

async function loadPartnersAdmin() {
    const wrap = document.getElementById('partnersAdminTableWrap');
    if (!wrap) return;
    wrap.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin"></i> Loading...</div>`;
    const { data, error } = await window.CatalystDB.from('partnerships').select('*').order('sort_order', { ascending: true });
    if (error) {
        wrap.innerHTML = `<div class="error-state">Error loading partners</div>`;
        return;
    }
    allAdminPartners = data || [];
    renderPartnersTable();
}

function renderPartnersTable() {
    const wrap = document.getElementById('partnersAdminTableWrap');
    if (allAdminPartners.length === 0) {
        wrap.innerHTML = `<div class="empty-state">No partners found.</div>`;
        return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Order</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${allAdminPartners.map(p => `
              <tr data-id="${p.id}">
                <td>${p.sort_order}</td>
                <td>${U.escapeHtml(p.name)}</td>
                <td>${p.published ? '<span class="pill pill-published"><i class="ph ph-wifi-high"></i> Live</span>' : '<span class="pill pill-draft"><i class="ph ph-wifi-slash"></i> Offline</span>'}</td>
                <td>
                  <div class="row-actions">
                      <button type="button" onclick='openPartnerForm(${JSON.stringify(p).replace(/'/g, "&#39;")})'><i class="ph ph-pencil-simple"></i> Edit</button>
                      <button type="button" class="danger" onclick="deletePartner('${p.id}')"><i class="ph ph-trash"></i> Drop</button>
                    </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
}

function openPartnerForm(p) {
    document.getElementById('partnerForm').reset();
    document.getElementById('partnerId').value = p ? p.id : '';
    document.getElementById('partnerName').value = p?.name || '';
    document.getElementById('partnerLogo').value = p?.logo_url || '';
    document.getElementById('partnerUrl').value = p?.website_url || '';
    document.getElementById('partnerOrder').value = p?.sort_order || 0;
    document.getElementById('partnerPublished').checked = p ? !!p.published : false;
    document.getElementById('partnerFormTitle').textContent = p ? 'Edit Partner' : 'New Partner';
    document.getElementById('partnerFormError').classList.remove('visible');
    U.openModal('partnerModal');
}

async function handlePartnerSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('partnerId').value;
    const payload = {
        name: document.getElementById('partnerName').value,
        logo_url: document.getElementById('partnerLogo').value,
        website_url: document.getElementById('partnerUrl').value,
        sort_order: parseInt(document.getElementById('partnerOrder').value) || 0,
        published: document.getElementById('partnerPublished').checked
    };
    
    const errBox = document.getElementById('partnerFormError');
    errBox.classList.remove('visible');

    let res;
    if (id) {
        res = await window.CatalystDB.from('partnerships').update(payload).eq('id', id);
    } else {
        res = await window.CatalystDB.from('partnerships').insert([payload]);
    }
    if (!res.error) {
        U.closeModal('partnerModal');
        U.toast('Partner saved successfully', 'success');
        loadPartnersAdmin();
    } else {
        errBox.textContent = res.error.message;
        errBox.classList.add('visible');
    }
}

async function deletePartner(id) {
    if (!confirm('Drop this partner?')) return;
    await window.CatalystDB.from('partnerships').delete().eq('id', id);
    loadPartnersAdmin();
}

/* ============================== EVENT MEDIA ============================== */

async function openEventMedia(ev) {
    document.getElementById('mediaEventName').textContent = ev.title;
    document.getElementById('mediaEventId').value = ev.id;
    U.openModal('eventMediaModal');
    loadEventMedia(ev.id);
}

async function loadEventMedia(eventId) {
    const list = document.getElementById('mediaList');
    list.innerHTML = 'Loading media...';
    const { data, error } = await window.CatalystDB.from('event_media').select('*').eq('event_id', eventId).order('sort_order', { ascending: true });
    if (error) {
        list.innerHTML = 'Error loading media.';
        return;
    }
    if (!data || data.length === 0) {
        list.innerHTML = 'No media for this event.';
        return;
    }
    list.innerHTML = data.map(m => `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; padding:10px; background:var(--bg-color); border-radius:var(--radius-sm);">
            <img src="${U.escapeHtml(m.media_url)}" style="width:50px; height:50px; object-fit:cover;">
            <div style="flex:1;">
                <div><strong>${m.media_type.toUpperCase()}</strong> | ${m.published ? 'Live' : 'Offline'} | Order: ${m.sort_order}</div>
                <div style="font-size:0.85em; opacity:0.8;">${U.escapeHtml(m.alt_text || 'No alt text')}</div>
            </div>
            <div class="row-actions">
                      <button type="button" class="danger" onclick="deleteEventMedia('${m.id}', '${eventId}')"><i class="ph ph-trash"></i> Drop</button>
                    </div>
        </div>
    `).join('');
}

async function handleMediaSubmit(e) {
    e.preventDefault();
    const eventId = document.getElementById('mediaEventId').value;
    const payload = {
        event_id: eventId,
        media_type: document.getElementById('mediaType').value,
        media_url: document.getElementById('mediaUrl').value,
        alt_text: document.getElementById('mediaAlt').value,
        sort_order: parseInt(document.getElementById('mediaOrder').value) || 0,
        published: document.getElementById('mediaPublished').checked
    };
    const errBox = document.getElementById('mediaFormError');
    errBox.classList.remove('visible');

    const res = await window.CatalystDB.from('event_media').insert([payload]);
    if (!res.error) {
        // Reset only the dynamic fields, keep eventId
        document.getElementById('mediaUrl').value = '';
        document.getElementById('mediaAlt').value = '';
        document.getElementById('mediaOrder').value = 0;
        loadEventMedia(eventId);
        U.toast('Media added successfully', 'success');
    } else {
        errBox.textContent = res.error.message;
        errBox.classList.add('visible');
    }
}

async function deleteEventMedia(id, eventId) {
    if (!confirm('Drop this media?')) return;
    await window.CatalystDB.from('event_media').delete().eq('id', id);
    loadEventMedia(eventId);
}

/* ============================== COMMUNITY CMS ============================== */
window.saveCommunityContent = async function() {
    const btn = document.getElementById('cmsCommunitySaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Saving...';
    const payload = {
        enabled: document.getElementById('cmsCommunityEnabled').checked,
        url: document.getElementById('cmsCommunityUrl').value,
        text: document.getElementById('cmsCommunityText').value
    };
    await window.CatalystDB.from('site_settings').upsert({ key: 'community', value: payload });
    btn.disabled = false;
    btn.innerHTML = 'Commit Change';
}
