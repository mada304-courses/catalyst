/**
 * admin.js
 * ------------------------------------------------------------------
 * Everything specific to the Admin Dashboard (admin.html).
 *
 * CLIENT-SIDE GUARD vs. REAL SECURITY — read this first:
 * `guardAdminAccess()` below hides the dashboard UI from anyone who
 * isn't an admin. That is done purely for a clean user experience
 * (no flash of admin content, a friendly "access denied" screen).
 * It is NOT what actually stops a non-admin from managing events.
 *
 * The real enforcement is server-side: every query in this file goes
 * straight to Supabase, and Supabase checks the Row Level Security
 * policies on `events` / `site_settings` / `profiles` (see
 * sql/schema.sql) for every single request. A non-admin who opens
 * devtools and calls these same functions directly will have every
 * write rejected by Postgres — this file merely doesn't offer them
 * the buttons.
 * ------------------------------------------------------------------
 */

const U = window.CatalystUtils;
let allAdminEvents = []; // cache for client-side filtering of the events table

/* ============================== Guard ============================== */

async function guardAdminAccess() {
    await window.CatalystAuth.init();
    const profile = window.CatalystAuth.getProfile();
    const session = window.CatalystAuth.getSession();

    const guardScreen = document.getElementById('adminGuardScreen');
    const shell = document.getElementById('adminShell');

    if (!session?.user) {
        guardScreen.innerHTML = `
          <div class="guard-box">
            <h1>Admins Only</h1>
            <p>Please log in with an administrator account to view this page.</p>
            <a class="btn-solid" href="index.html" style="text-decoration:none; display:inline-block;">Go to homepage</a>
          </div>`;
        guardScreen.style.display = 'flex';
        shell.style.display = 'none';
        return false;
    }

    if (profile?.role !== 'admin') {
        guardScreen.innerHTML = `
          <div class="guard-box">
            <h1>Access Denied</h1>
            <p>Your account does not have administrator privileges. If you believe this is a mistake, contact a site administrator.</p>
            <a class="btn-solid" href="index.html" style="text-decoration:none; display:inline-block;">Back to Catalyst</a>
          </div>`;
        guardScreen.style.display = 'flex';
        shell.style.display = 'none';
        return false;
    }

    guardScreen.style.display = 'none';
    shell.style.display = 'flex';
    document.getElementById('adminUserName').textContent = profile.full_name || profile.email;
    return true;
}

async function handleAdminLogout() {
    await window.CatalystAuth.signOut();
    window.location.href = 'index.html';
}

/* ============================== Sidebar nav ============================== */

function adminGoTo(page) {
    document.querySelectorAll('.admin-page').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach((b) => b.classList.remove('active'));
    document.getElementById(`admin-${page}`).classList.add('active');
    document.querySelector(`.admin-nav-item[data-page="${page}"]`).classList.add('active');

    if (page === 'overview') loadOverviewStats();
    if (page === 'events') loadEventsTable();
    if (page === 'content') loadContentForm();
}

/* ============================== Overview ============================== */

async function loadOverviewStats() {
    const grid = document.getElementById('statGrid');
    grid.innerHTML = `<div class="loading-state">Loading stats…</div>`;

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
        grid.innerHTML = `<div class="error-state">Couldn't load dashboard stats: ${U.escapeHtml(errored.error.message)}</div>`;
        return;
    }

    const stats = [
        ['Total events', totalRes.count],
        ['Upcoming (published)', upcomingRes.count],
        ['Past events', pastRes.count],
        ['Unpublished drafts', draftRes.count],
        ['Registered users', usersRes.count],
    ];

    grid.innerHTML = stats.map(([label, value]) => `
        <div class="stat-card">
          <div class="stat-label">${U.escapeHtml(label)}</div>
          <div class="stat-value">${value ?? 0}</div>
        </div>`).join('');
}

/* ============================== Events management ============================== */

function eventRowHtml(ev) {
    const statusPill = ev.status === 'upcoming'
        ? '<span class="pill pill-upcoming">Upcoming</span>'
        : '<span class="pill pill-past">Past</span>';
    const publishedPill = ev.published
        ? '<span class="pill pill-published">Published</span>'
        : '<span class="pill pill-draft">Draft</span>';

    return `
      <tr data-id="${ev.id}">
        <td>${U.escapeHtml(ev.title)}</td>
        <td>${U.escapeHtml(ev.category)}</td>
        <td>${U.formatDate(ev.event_date)}</td>
        <td>${statusPill}</td>
        <td>${publishedPill}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="edit">Edit</button>
            <button type="button" data-action="toggle-publish">${ev.published ? 'Unpublish' : 'Publish'}</button>
            <button type="button" data-action="duplicate">Duplicate</button>
            <button type="button" class="danger" data-action="delete">Delete</button>
          </div>
        </td>
      </tr>`;
}

function renderEventsTable(events) {
    const wrap = document.getElementById('eventsTableWrap');
    if (events.length === 0) {
        wrap.innerHTML = `<div class="empty-state">No events match. Try a different search, or add a new event.</div>`;
        return;
    }
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Date</th><th>Status</th><th>Visibility</th><th>Actions</th></tr>
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
    wrap.innerHTML = `<div class="loading-state">Loading events…</div>`;

    const { data, error } = await window.CatalystDB
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        wrap.innerHTML = `<div class="error-state">Couldn't load events: ${U.escapeHtml(error.message)}</div>`;
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

/* ---- Add / Edit form ---- */

function openEventForm(ev) {
    const form = document.getElementById('eventForm');
    form.reset();
    document.getElementById('eventFormTitle').textContent = ev ? 'Edit Event' : 'Add Event';
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

    if (!title) { errorBox.textContent = 'Title is required.'; errorBox.classList.add('visible'); return; }

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
    U.setLoading(submitBtn, true, 'Saving…');

    try {
        if (id) {
            const { error } = await window.CatalystDB.from('events').update(payload).eq('id', id);
            if (error) throw error;
            U.toast('Event updated.', 'success');
        } else {
            const session = window.CatalystAuth.getSession();
            payload.created_by = session?.user?.id || null;
            const { error } = await window.CatalystDB.from('events').insert(payload);
            if (error) throw error;
            U.toast('Event created.', 'success');
        }
        U.closeModal('eventModal');
        loadEventsTable();
        loadOverviewStats();
    } catch (err) {
        errorBox.textContent = err.message || 'Could not save this event.';
        errorBox.classList.add('visible');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

/* ---- Row actions ---- */

async function duplicateEvent(ev) {
    const copy = { ...ev };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    copy.title = `${ev.title} (Copy)`;
    copy.published = false;

    const session = window.CatalystAuth.getSession();
    copy.created_by = session?.user?.id || null;

    const { error } = await window.CatalystDB.from('events').insert(copy);
    if (error) { U.toast(`Could not duplicate event: ${error.message}`, 'error'); return; }
    U.toast('Event duplicated as a draft.', 'success');
    loadEventsTable();
    loadOverviewStats();
}

async function togglePublish(ev) {
    const { error } = await window.CatalystDB
        .from('events')
        .update({ published: !ev.published })
        .eq('id', ev.id);
    if (error) { U.toast(`Could not update event: ${error.message}`, 'error'); return; }
    U.toast(ev.published ? 'Event unpublished.' : 'Event published.', 'success');
    loadEventsTable();
    loadOverviewStats();
}

async function deleteEvent(ev) {
    const confirmed = await U.confirmAction(`Delete "${ev.title}"? This cannot be undone.`, 'Delete');
    if (!confirmed) return;

    const { error } = await window.CatalystDB.from('events').delete().eq('id', ev.id);
    if (error) { U.toast(`Could not delete event: ${error.message}`, 'error'); return; }
    U.toast('Event deleted.', 'success');
    loadEventsTable();
    loadOverviewStats();
}

/* ============================== Site content (CMS) ============================== */

async function loadContentForm() {
    const { data, error } = await window.CatalystDB.from('site_settings').select('key, value');
    if (error) { U.toast(`Could not load site content: ${error.message}`, 'error'); return; }

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
    U.setLoading(btn, true, 'Saving…');
    try {
        const { error } = await window.CatalystDB.from('site_settings').upsert({ key, value });
        if (error) throw error;
        U.toast('Content updated — changes are live on the public site.', 'success');
    } catch (err) {
        U.toast(`Could not save: ${err.message}`, 'error');
    } finally {
        U.setLoading(btn, false);
    }
}

function saveBannerContent() {
    saveContentSection('banner', { enabled: 'cmsBannerEnabled', text: 'cmsBannerText' }, 'cmsBannerSaveBtn');
}
function saveHomeContent() {
    saveContentSection('home', {
        heading: 'cmsHomeHeading', intro: 'cmsHomeIntro',
        cta_heading: 'cmsHomeCtaHeading', cta_text: 'cmsHomeCtaText',
    }, 'cmsHomeSaveBtn');
}
function saveAboutContent() {
    saveContentSection('about', {
        heading: 'cmsAboutHeading', paragraph1: 'cmsAboutParagraph1', paragraph2: 'cmsAboutParagraph2',
    }, 'cmsAboutSaveBtn');
}
function saveMoreContent() {
    saveContentSection('more', {
        sponsorship_text: 'cmsMoreSponsorship', volunteer_text: 'cmsMoreVolunteer',
    }, 'cmsMoreSaveBtn');
}
function saveFooterContent() {
    saveContentSection('footer', { text: 'cmsFooterText' }, 'cmsFooterSaveBtn');
}

/* ============================== Init ============================== */

document.addEventListener('DOMContentLoaded', async () => {
    const ok = await guardAdminAccess();
    if (!ok) return;

    document.getElementById('adminEventSearch').addEventListener('keyup', U.debounce(filterEventsTable, 150));
    document.getElementById('eventForm').addEventListener('submit', handleEventFormSubmit);

    loadOverviewStats();
});
