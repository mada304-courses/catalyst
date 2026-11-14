const U = window.CatalystUtils;
let allEvents = [];

const LEGACY_CMS_DEFAULTS = {
    homeHeadings: ['Building The Future'],
    homeIntros: [
        'We organize workshops, hackathons, and real-world tech events. Our main portal is currently being upgraded to bring you a better experience.',
        'Catalyst is built for young people who are curious, motivated, and ready to contribute. No single discipline defines our community; shared purpose does.'
    ],
    homeCtaHeadings: ['Stay Updated'],
    homeCtaTexts: ['Get notified when we launch our next hackathon:'],
    aboutHeadings: ['About Our Team'],
    moreSponsorship: ['Want to partner with us for upcoming events? Reach out via email.'],
    moreVolunteer: ['Join our core team and help organize our next big hackathon.']
};

/* ============================== Navigation & Layout ============================== */

function navigateToTab(tabName, options = {}) {
    const targetPanel = document.getElementById(tabName);
    if (!targetPanel) return;

    const learnPanel = document.getElementById('learn');
    if (learnPanel && learnPanel.classList.contains('active') && tabName !== 'learn') {
        if (hubState.ytPlayer && typeof hubState.ytPlayer.pauseVideo === 'function') {
            try {
                hubState.ytPlayer.pauseVideo();
            } catch (e) {
                // Ignore if player is not yet ready
            }
        }
    }

    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    document.querySelectorAll('.nav-tab[data-tab]').forEach((t) => {
        const isTarget = t.dataset.tab === tabName;
        t.classList.toggle('active', isTarget);
        if (isTarget) {
            t.setAttribute('aria-current', 'page');
        } else {
            t.removeAttribute('aria-current');
        }
    });

    targetPanel.classList.add('active');
    closeMobileNav();

    if (tabName === 'about') {
        loadTeamMembers();
    }

    if (options.scrollToTop !== false) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => U.initScrollReveals(), 50);
}

function openTab(event, tabName) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    navigateToTab(tabName);
    if (event && event.currentTarget && event.currentTarget.classList) {
        event.currentTarget.classList.add('active');
    }
}

function toggleMobileNav() {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('mobileMenuBtn');
    if (!nav || !btn) return;
    const isOpen = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    btn.innerHTML = isOpen
        ? '<i class="ph ph-x" aria-hidden="true"></i>'
        : '<i class="ph ph-list" aria-hidden="true"></i>';
}

function closeMobileNav() {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('mobileMenuBtn');
    if (nav && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
    }
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<i class="ph ph-list" aria-hidden="true"></i>';
    }
}

function scrollToHomeSection(sectionId) {
    const homeTab = document.getElementById('home');
    if (homeTab && !homeTab.classList.contains('active')) {
        navigateToTab('home', { scrollToTop: false });
    }
    const target = document.getElementById(sectionId);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function openJoinCatalyst() {
    if (window.CatalystAuth && window.CatalystAuth.isLoggedIn()) {
        U.toast('You are signed in to Catalyst. Explore upcoming events and learning modules.', 'info');
        navigateToTab('events');
        return;
    }
    showAuthPanel('signup');
    U.openModal('authModal');
}

/* ============================== Theme Controls ============================== */

function toggleTheme() {
    const btn = document.getElementById('themeBtn');

    // Only operate if the effective theme is the standard dark/light theme
    const isSpecialTheme = U.SPECIAL_THEMES.some((t) => document.body.classList.contains(`theme-${t}`));
    if (isSpecialTheme) return;

    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('catalyst-theme', isLight ? 'light' : 'dark');

    if (btn) {
        btn.innerHTML = isLight
            ? '<i class="ph ph-sun" aria-hidden="true"></i>'
            : '<i class="ph ph-moon-stars" aria-hidden="true"></i>';
        btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    }
}

function initTheme() {
    U.initLocalTheme();
    const isLight = document.body.classList.contains('light-mode');
    const btn = document.getElementById('themeBtn');
    if (btn) {
        btn.innerHTML = isLight
            ? '<i class="ph ph-sun" aria-hidden="true"></i>'
            : '<i class="ph ph-moon-stars" aria-hidden="true"></i>';
        btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    }
}

function applyThemeUI(profile) {
    const result = U.applyEffectiveTheme(profile);
    const badge = document.getElementById('accountThemeBadge');

    if (result.forced && badge) {
        badge.innerHTML = `<i class="ph ph-swatches" aria-hidden="true"></i> ${U.escapeHtml(U.THEME_LABELS[result.theme] || result.theme)}`;
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '6px';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

/* ============================== Events & Homepage Preview ============================== */

function handleSearch(sourceValue) {
    const headerInput = document.getElementById('searchInput');
    const inlineInput = document.getElementById('eventsSearchInput');
    const grid = document.getElementById('eventsGrid');
    if (!grid) return;

    const rawQuery = typeof sourceValue === 'string'
        ? sourceValue
        : (headerInput ? headerInput.value : (inlineInput ? inlineInput.value : ''));

    if (headerInput && headerInput.value !== rawQuery) headerInput.value = rawQuery;
    if (inlineInput && inlineInput.value !== rawQuery) inlineInput.value = rawQuery;

    const query = rawQuery.trim().toLowerCase();
    const cards = grid.querySelectorAll('.event-card');

    if (query.length > 0 && typeof sourceValue !== 'string') {
        navigateToTab('events', { scrollToTop: false });
    }

    let visibleCount = 0;
    cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        const match = !query || text.includes(query);
        card.style.display = match ? 'flex' : 'none';
        if (match) visibleCount += 1;
    });

    const existingEmpty = document.getElementById('eventsSearchEmpty');
    if (cards.length > 0 && visibleCount === 0 && query.length > 0) {
        if (!existingEmpty) {
            const msg = document.createElement('div');
            msg.id = 'eventsSearchEmpty';
            msg.className = 'empty-state';
            msg.style.gridColumn = '1 / -1';
            msg.innerHTML = `<i class="ph ph-magnifying-glass" aria-hidden="true"></i><span>No events match &ldquo;${U.escapeHtml(rawQuery.trim())}&rdquo;.</span>`;
            grid.appendChild(msg);
        } else {
            existingEmpty.innerHTML = `<i class="ph ph-magnifying-glass" aria-hidden="true"></i><span>No events match &ldquo;${U.escapeHtml(rawQuery.trim())}&rdquo;.</span>`;
        }
    } else if (existingEmpty) {
        existingEmpty.remove();
    }
}

function isUpcomingEvent(ev) {
    if (!ev || ev.status === 'past') return false;
    if (ev.event_date) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayIso = `${y}-${m}-${d}`;
        if (String(ev.event_date) < todayIso) return false;
    }
    return true;
}

function eventCardHtml(ev, options = {}) {
    const compact = !!options.compact;
    let mediaHtml = '';
    let logoHtml = '';
    let coverHtml = '';

    if (ev.image_url && U.isValidHttpUrl(ev.image_url)) {
        coverHtml = `
          <div class="event-card-cover">
            <img src="${U.escapeHtml(ev.image_url)}" alt="${U.escapeHtml(ev.title || 'Catalyst event')}" loading="lazy">
          </div>`;
    }

    if (ev.event_media && Array.isArray(ev.event_media)) {
        const publishedMedia = ev.event_media
            .filter((m) => m.published && U.isValidHttpUrl(m.media_url))
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const logos = publishedMedia.filter((m) => m.media_type === 'logo');
        const photos = publishedMedia.filter((m) => m.media_type === 'photo');

        if (logos.length > 0) {
            logoHtml = `<div class="event-logo-wrap"><img src="${U.escapeHtml(logos[0].media_url)}" alt="${U.escapeHtml(logos[0].alt_text || ev.title)}" loading="lazy"></div>`;
        }
        if (!coverHtml && photos.length > 0) {
            coverHtml = `
              <div class="event-card-cover">
                <img src="${U.escapeHtml(photos[0].media_url)}" alt="${U.escapeHtml(photos[0].alt_text || ev.title || 'Catalyst event')}" loading="lazy">
              </div>`;
        }
        if (!compact && photos.length > 1) {
            mediaHtml = `<div class="event-gallery-strip">` +
                photos.slice(coverHtml ? 1 : 0).map((p) => `<img src="${U.escapeHtml(p.media_url)}" alt="${U.escapeHtml(p.alt_text || 'Event activity')}" loading="lazy">`).join('') +
                `</div>`;
        }
    }

    const tags = (ev.tags || []).map((t) => `<span class="tag">${U.escapeHtml(t)}</span>`).join('');
    const isPast = !isUpcomingEvent(ev);
    const statusPill = isPast
        ? '<span class="pill pill-past">Past Event</span>'
        : '<span class="pill pill-upcoming">Upcoming</span>';

    const dateLabel = ev.event_date ? U.formatDate(ev.event_date) : 'Date TBA';
    let metadataHtml = `<div class="event-meta-list">`;
    metadataHtml += `<div><i class="ph ph-calendar-blank" aria-hidden="true"></i> <strong>${U.escapeHtml(dateLabel)}</strong>${ev.event_time ? ' &middot; ' + U.escapeHtml(ev.event_time) : ''}</div>`;
    if (ev.location) metadataHtml += `<div><i class="ph ph-map-pin" aria-hidden="true"></i> <span>${U.escapeHtml(ev.location)}</span></div>`;
    if (!compact && ev.capacity) metadataHtml += `<div><i class="ph ph-users" aria-hidden="true"></i> <span>Capacity: ${U.escapeHtml(String(ev.capacity))}</span></div>`;
    if (!compact && ev.organizer) metadataHtml += `<div><i class="ph ph-user-circle" aria-hidden="true"></i> <span>Hosted by ${U.escapeHtml(ev.organizer)}</span></div>`;
    metadataHtml += `</div>`;

    const descriptionText = ev.description || '';
    const truncatedDesc = compact && descriptionText.length > 150
        ? descriptionText.slice(0, 147).trimEnd() + '…'
        : descriptionText;
    const description = truncatedDesc
        ? `<p class="event-card-desc">${U.escapeHtml(truncatedDesc)}</p>`
        : '';

    const hasValidRegUrl = ev.registration_url && U.isValidHttpUrl(ev.registration_url);
    const registration = hasValidRegUrl
        ? `<a class="btn-primary event-register-btn" href="${U.escapeHtml(ev.registration_url)}" target="_blank" rel="noopener noreferrer"><span>Register</span> <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>`
        : '';

    return `
      <article class="card event-card reveal">
        ${coverHtml}
        <div class="event-card-body">
          <div class="event-card-header">
            <span class="event-category-badge">${U.escapeHtml(ev.category || 'EVENT')}</span>
            ${statusPill}
          </div>
          ${logoHtml}
          <h3 class="event-card-title">${U.escapeHtml(ev.topic || ev.title)}</h3>
          ${metadataHtml}
          ${description}
          ${mediaHtml}
          ${tags ? `<div class="event-tags">${tags}</div>` : ''}
          ${registration}
        </div>
      </article>`;
}

function renderHomeEventsPreview(events, hasError = false) {
    const container = document.getElementById('homeEventsPreview');
    if (!container) return;

    if (hasError) {
        container.innerHTML = `
          <div class="home-events-empty glass-panel">
            <div class="home-events-empty-icon" aria-hidden="true"><i class="ph ph-cloud-slash"></i></div>
            <div class="home-events-empty-copy">
              <h3>Events are temporarily unavailable</h3>
              <p>We could not connect to the events schedule right now. You can still explore our Learning Hub or try refreshing.</p>
            </div>
            <div class="home-events-empty-actions">
              <button type="button" class="btn-outline" onclick="loadPublicEvents()">Try Again</button>
              <button type="button" class="btn-primary" onclick="navigateToTab('learn')">Open Learning Hub</button>
            </div>
          </div>`;
        return;
    }

    const upcoming = (events || []).filter(isUpcomingEvent).slice(0, 3);

    if (upcoming.length === 0) {
        container.innerHTML = `
          <div class="home-events-empty glass-panel">
            <div class="home-events-empty-icon" aria-hidden="true"><i class="ph ph-calendar-plus"></i></div>
            <div class="home-events-empty-copy">
              <h3>New Catalyst experiences are being scheduled</h3>
              <p>Upcoming workshops, speaker sessions, and innovation challenges will appear here as soon as they are published. Join Catalyst or explore the Learning Hub in the meantime.</p>
            </div>
            <div class="home-events-empty-actions">
              <button type="button" class="btn-primary" onclick="openJoinCatalyst()">
                <span>Join Catalyst</span>
                <i class="ph ph-arrow-right" aria-hidden="true"></i>
              </button>
              <button type="button" class="btn-outline" onclick="navigateToTab('learn')">Explore Learning Hub</button>
            </div>
          </div>`;
        return;
    }

    container.innerHTML = upcoming.map((ev) => eventCardHtml(ev, { compact: true })).join('');
}

async function loadPublicEvents() {
    const grid = document.getElementById('eventsGrid');
    const preview = document.getElementById('homeEventsPreview');

    if (grid) {
        grid.innerHTML = `<div class="loading-state reveal"><i class="ph ph-spinner-gap ph-spin" aria-hidden="true"></i> Loading events…</div>`;
    }
    if (preview) {
        preview.innerHTML = `<div class="loading-state"><i class="ph ph-spinner-gap ph-spin" aria-hidden="true"></i> Loading upcoming events…</div>`;
    }

    try {
        const { data, error } = await window.CatalystDB
            .from('events')
            .select('*, event_media(*)')
            .eq('published', true)
            .order('event_date', { ascending: true, nullsFirst: false });

        if (error) throw error;

        allEvents = data || [];
        renderHomeEventsPreview(allEvents, false);

        if (grid) {
            if (allEvents.length === 0) {
                grid.innerHTML = `
                  <div class="empty-state glass-panel" style="grid-column: 1 / -1;">
                    <i class="ph ph-calendar-blank" aria-hidden="true"></i>
                    <h3>No published events yet</h3>
                    <p style="max-width: 480px; margin: 0 auto 8px;">New workshops, hackathons, and speaker sessions will appear here once announced.</p>
                    <button type="button" class="btn-primary" onclick="openJoinCatalyst()">Join Catalyst for Updates</button>
                  </div>`;
            } else {
                grid.innerHTML = allEvents.map((ev) => eventCardHtml(ev)).join('');
            }
        }
    } catch (err) {
        console.error('[Catalyst] Events load error:', err.message || err);
        renderHomeEventsPreview([], true);
        if (grid) {
            grid.innerHTML = `
              <div class="error-state glass-panel" style="grid-column: 1 / -1;">
                <i class="ph ph-warning" aria-hidden="true"></i>
                <span>Unable to load events right now. Please try again shortly.</span>
                <button type="button" class="btn-outline" onclick="loadPublicEvents()">Retry</button>
              </div>`;
        }
    }

    setTimeout(() => U.initScrollReveals(), 50);
}

/* ============================== Team (public) ============================== */

const TEAM_PLACEHOLDER_PHOTO = 'img/team-placeholder.svg';

let teamState = {
    loaded: false,
    loadingPromise: null,
    imageObserver: null
};

function sanitizeUrlForDiagnostic(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '[empty URL]';
    try {
        const parsed = new URL(rawUrl.trim(), window.location.origin);
        const safeSegments = parsed.pathname.split('/').map((seg) => (
            seg.length > 48 ? `${seg.slice(0, 16)}…` : seg
        ));
        return `${parsed.origin}${safeSegments.join('/')}`;
    } catch {
        return '[invalid URL]';
    }
}

window.handleTeamImageLoad = function (imgEl) {
    if (!imgEl) return;
    const wrap = imgEl.closest('.member-photo-wrap');
    if (wrap) {
        wrap.classList.remove('is-loading');
        wrap.classList.add('is-loaded');
    }
};

window.handleTeamImageError = function (imgEl) {
    if (!imgEl) return;
    const wrap = imgEl.closest('.member-photo-wrap');

    // Guard against infinite error loops if the placeholder itself fails
    if (imgEl.dataset.fallbackApplied === 'true') {
        imgEl.onerror = null;
        if (wrap) wrap.classList.remove('is-loading');
        return;
    }

    imgEl.dataset.fallbackApplied = 'true';
    imgEl.onerror = null;

    const memberName = imgEl.dataset.memberName || imgEl.alt || 'Team member';
    const originalSrc = imgEl.dataset.originalSrc || imgEl.getAttribute('src') || '';
    console.warn(`[Catalyst Team] Image failed to load for member "${memberName}" (${sanitizeUrlForDiagnostic(originalSrc)}). Displaying placeholder.`);

    if (wrap) {
        wrap.classList.remove('is-loading');
        wrap.classList.add('is-fallback');
    }
    imgEl.src = TEAM_PLACEHOLDER_PHOTO;
};

function observeTeamImages(grid) {
    if (!grid) return;
    if (teamState.imageObserver) {
        teamState.imageObserver.disconnect();
        teamState.imageObserver = null;
    }

    const images = Array.from(grid.querySelectorAll('img'));
    images.forEach((img) => {
        if (img.complete) {
            if (img.naturalWidth > 0) {
                window.handleTeamImageLoad(img);
            } else if (img.dataset.fallbackApplied !== 'true') {
                window.handleTeamImageError(img);
            }
        }
    });

    if (typeof IntersectionObserver !== 'undefined') {
        teamState.imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const img = entry.target;
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
                observer.unobserve(img);
            });
        }, { rootMargin: '600px 0px' });

        images.forEach((img) => {
            if (!img.complete && img.dataset.fallbackApplied !== 'true') {
                teamState.imageObserver.observe(img);
            }
        });
    }
}

function memberCardHtml(m, index = 0) {
    const memberName = m.name || 'Team Member';
    const rawUrl = typeof m.image_url === 'string' ? m.image_url.trim() : '';
    const hasValidUrl = Boolean(rawUrl && U.isValidHttpUrl(rawUrl));

    if (rawUrl && !hasValidUrl) {
        console.warn(`[Catalyst Team] Invalid image URL for member "${memberName}" (${sanitizeUrlForDiagnostic(rawUrl)}). Displaying placeholder.`);
    }

    let photo;
    if (hasValidUrl) {
        const isPriority = index < 3;
        const loadingAttr = isPriority ? 'eager' : 'lazy';
        const priorityAttr = isPriority ? ' fetchpriority="high"' : '';
        photo = `<div class="member-photo-wrap is-loading"><img src="${U.escapeHtml(rawUrl)}" alt="${U.escapeHtml(memberName)}" width="320" height="270" loading="${loadingAttr}"${priorityAttr} decoding="async" referrerpolicy="no-referrer" data-member-name="${U.escapeHtml(memberName)}" data-original-src="${U.escapeHtml(rawUrl)}" onload="handleTeamImageLoad(this)" onerror="handleTeamImageError(this)"></div>`;
    } else {
        photo = `<div class="member-photo-wrap is-fallback"><img src="${TEAM_PLACEHOLDER_PHOTO}" alt="${U.escapeHtml(memberName)}" width="320" height="270" decoding="async" data-fallback-applied="true"></div>`;
    }

    const role = m.role ? `<p class="member-role">${U.escapeHtml(m.role)}</p>` : '';
    const bio = m.bio ? `<p class="member-bio">${U.escapeHtml(m.bio)}</p>` : '';

    return `
      <article class="card member-card reveal">
        ${photo}
        <h3 class="member-name">${U.escapeHtml(memberName)}</h3>
        ${role}
        ${bio}
      </article>`;
}

async function loadTeamMembers(options = {}) {
    const grid = document.getElementById('teamGrid');
    if (!grid) return;

    if (teamState.loadingPromise) {
        return teamState.loadingPromise;
    }

    if (teamState.loaded && !options.force) {
        observeTeamImages(grid);
        return;
    }

    grid.innerHTML = `<div class="loading-state reveal active"><i class="ph ph-spinner-gap ph-spin" aria-hidden="true"></i> Loading team…</div>`;

    teamState.loadingPromise = (async () => {
        try {
            const { data, error } = await window.CatalystDB
                .from('team_members')
                .select('*')
                .eq('published', true)
                .order('sort_order', { ascending: true });

            if (error) throw error;

            const members = data || [];
            teamState.loaded = true;

            if (members.length === 0) {
                grid.innerHTML = `<div class="empty-state reveal active"><i class="ph ph-identification-badge" aria-hidden="true"></i> Team information is being updated.</div>`;
                return;
            }

            grid.innerHTML = members.map((m, idx) => memberCardHtml(m, idx)).join('');
            observeTeamImages(grid);
            setTimeout(() => U.initScrollReveals(), 50);
        } catch (err) {
            teamState.loaded = false;
            console.error('[Catalyst] Team load error:', err.message || err);
            grid.innerHTML = `
              <div class="error-state reveal active">
                <i class="ph ph-warning" aria-hidden="true"></i>
                <span>Unable to load team members right now.</span>
                <button type="button" class="btn-outline" onclick="loadTeamMembers({ force: true })">Retry</button>
              </div>`;
        } finally {
            teamState.loadingPromise = null;
        }
    })();

    return teamState.loadingPromise;
}

/* ============================== Site Settings / CMS ============================== */

function shouldApplyCmsField(value, legacyList, isV2) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (isV2) return true;
    return !legacyList.includes(trimmed);
}

async function loadSiteContent() {
    try {
        const { data, error } = await window.CatalystDB.from('site_settings').select('key, value');
        if (error) return;
        const settings = {};
        (data || []).forEach((row) => { settings[row.key] = row.value; });

        // Announcement banner: only show when explicitly enabled and non-empty
        if (settings.banner) {
            const banner = document.getElementById('constructionBanner');
            if (banner) {
                const bannerText = (settings.banner.text || '').trim();
                const shouldShow = settings.banner.enabled === true && bannerText.length > 0;
                if (shouldShow) {
                    banner.innerHTML = `<i class="ph ph-megaphone" aria-hidden="true"></i> <span>${U.escapeHtml(bannerText)}</span>`;
                    banner.style.display = 'flex';
                } else {
                    banner.style.display = 'none';
                }
            }
        }

        // Homepage CMS fields (guard against legacy pre-redesign placeholder strings)
        if (settings.home) {
            const isV2 = settings.home.cms_v2 === true;
            if (shouldApplyCmsField(settings.home.heading, LEGACY_CMS_DEFAULTS.homeHeadings, isV2)) {
                setText('homeHeading', settings.home.heading);
            }
            if (shouldApplyCmsField(settings.home.intro, LEGACY_CMS_DEFAULTS.homeIntros, isV2)) {
                setText('homeIntro', settings.home.intro);
            }
            if (shouldApplyCmsField(settings.home.cta_heading, LEGACY_CMS_DEFAULTS.homeCtaHeadings, isV2)) {
                setText('homeCtaHeading', settings.home.cta_heading);
            }
            if (shouldApplyCmsField(settings.home.cta_text, LEGACY_CMS_DEFAULTS.homeCtaTexts, isV2)) {
                setText('homeCtaText', settings.home.cta_text);
            }
            if (typeof settings.home.primary_cta === 'string' && settings.home.primary_cta.trim()) {
                const primaryBtnSpan = document.querySelector('#homePrimaryCta span');
                if (primaryBtnSpan) primaryBtnSpan.textContent = settings.home.primary_cta.trim();
            }
            if (typeof settings.home.secondary_cta === 'string' && settings.home.secondary_cta.trim()) {
                const secondaryBtnSpan = document.querySelector('#homeSecondaryCta span');
                if (secondaryBtnSpan) secondaryBtnSpan.textContent = settings.home.secondary_cta.trim();
            }
        }

        // Community CTA: only display if enabled AND a valid HTTP/HTTPS URL is configured
        if (settings.community) {
            const wrapper = document.getElementById('communityCtaWrapper');
            const textEl = document.getElementById('communityCtaText');
            const linkEl = document.getElementById('communitySlackLink');
            if (wrapper && textEl && linkEl) {
                const validUrl = U.isValidHttpUrl(settings.community.url);
                if (settings.community.enabled === true && validUrl) {
                    textEl.textContent = settings.community.text || 'Connect with peers and mentors across Catalyst';
                    linkEl.href = settings.community.url.trim();
                    linkEl.setAttribute('rel', 'noopener noreferrer');
                    wrapper.style.display = 'block';
                } else {
                    wrapper.style.display = 'none';
                }
            }
        }

        // About section CMS
        if (settings.about) {
            const aboutV2 = settings.about.cms_v2 === true;
            if (shouldApplyCmsField(settings.about.heading, LEGACY_CMS_DEFAULTS.aboutHeadings, aboutV2)) {
                setText('aboutHeading', settings.about.heading);
            }
            const paragraphs = Array.isArray(settings.about.paragraphs) && settings.about.paragraphs.length
                ? settings.about.paragraphs
                : [settings.about.paragraph1, settings.about.paragraph2].filter(Boolean);
            const wrap = document.getElementById('aboutParagraphs');
            if (wrap && paragraphs.length) {
                wrap.innerHTML = paragraphs.map((p) => `<p>${U.escapeHtml(p)}</p>`).join('');
            }
        }

        // More / Get Involved CMS
        if (settings.more) {
            const moreV2 = settings.more.cms_v2 === true;
            if (shouldApplyCmsField(settings.more.sponsorship_text, LEGACY_CMS_DEFAULTS.moreSponsorship, moreV2)) {
                setText('moreSponsorship', settings.more.sponsorship_text);
            }
            if (shouldApplyCmsField(settings.more.volunteer_text, LEGACY_CMS_DEFAULTS.moreVolunteer, moreV2)) {
                setText('moreVolunteer', settings.more.volunteer_text);
            }
        }

        // Footer CMS
        if (settings.footer && settings.footer.text) {
            setText('footerText', settings.footer.text);
        }
    } catch (err) {
        console.error('[Catalyst] Site content load error:', err.message || err);
    }
}

function setText(id, value, prefix = '') {
    if (value === undefined || value === null) return;
    const el = document.getElementById(id);
    if (el) el.innerHTML = prefix + U.escapeHtml(value);
}

/* Replaced fake newsletter form with genuine account registration CTA */
function handleSubscribe(event) {
    if (event) event.preventDefault();
    openJoinCatalyst();
}

/* ============================== Authentication UI ============================== */

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
              <span class="avatar" aria-hidden="true">${U.escapeHtml(initials)}</span>
              <span class="truncate">${U.escapeHtml(state.profile.full_name || state.profile.email || window.CatalystAuth.getSession()?.user?.email || 'Member')}</span>
              ${state.profile.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : ''}
            </div>
            <span class="points-pill" id="myPointsBadge" style="display:none;"><i class="ph ph-trophy" aria-hidden="true"></i> 0 pts</span>
            <button type="button" class="btn-outline btn-logout" id="logoutBtn" title="Log out" aria-label="Log out"><i class="ph ph-sign-out" aria-hidden="true"></i></button>
          </div>`;
        document.getElementById('logoutBtn').addEventListener('click', handleLogoutClick);

        if (adminNavItem) adminNavItem.style.display = state.profile.role === 'admin' ? 'inline-flex' : 'none';
        refreshMyPoints();
    } else {
        area.innerHTML = `
          <div class="auth-controls">
            <button type="button" class="btn-outline" onclick="showAuthPanel('login'); U.openModal('authModal');">Log In</button>
            <button type="button" class="btn-primary" onclick="showAuthPanel('signup'); U.openModal('authModal');">Join Catalyst</button>
          </div>`;
        if (adminNavItem) adminNavItem.style.display = 'none';
    }
    applyThemeUI(state.profile);
}

async function handleLogoutClick() {
    try {
        await window.CatalystAuth.signOut();
        U.toast('Signed out successfully.', 'success');
        if (hubState.modules.length) {
            await refreshHubProgress();
            renderHubLevel1();
        }
        renderLeaderboard(allLeaderboardRows);
    } catch (err) {
        U.toast(err.message || 'Sign out failed.', 'error');
    }
}

function showAuthPanel(panel) {
    ['login', 'signup', 'forgot'].forEach((p) => {
        const el = document.getElementById(`authPanel-${p}`);
        if (el) el.style.display = p === panel ? 'block' : 'none';
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
    if (!box) return;
    box.innerHTML = `<i class="ph ph-warning" aria-hidden="true"></i> ${U.escapeHtml(message)}`;
    box.classList.add('visible');
}

function showAuthSuccess(panel, message) {
    const box = document.getElementById(`authSuccess-${panel}`);
    if (!box) return;
    box.innerHTML = `<i class="ph ph-check-circle" aria-hidden="true"></i> ${U.escapeHtml(message)}`;
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

    if (fullName.length < 2) return showAuthError('signup', 'Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showAuthError('signup', 'Please enter a valid email address.');
    if (password.length < 8) return showAuthError('signup', 'Password must be at least 8 characters.');
    if (password !== confirm) return showAuthError('signup', 'Passwords do not match.');

    U.setLoading(submitBtn, true, 'Creating account…');
    try {
        const data = await window.CatalystAuth.signUp({ fullName, email, password });
        if (!data.session) {
            showAuthSuccess('signup', 'Account created! Please check your email to confirm your registration.');
            event.target.reset();
        } else {
            U.toast('Welcome to Catalyst!', 'success');
            U.closeModal('authModal');
            event.target.reset();
        }
    } catch (err) {
        showAuthError('signup', err.message || 'Could not create account.');
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

    if (!email || !password) return showAuthError('login', 'Please enter your email and password.');

    U.setLoading(submitBtn, true, 'Signing in…');
    try {
        await window.CatalystAuth.signIn({ email, password });
        U.toast('Welcome back to Catalyst.', 'success');
        U.closeModal('authModal');
        event.target.reset();
        if (hubState.modules.length) {
            await refreshHubProgress();
            renderHubLevel1();
        }
        renderLeaderboard(allLeaderboardRows);
    } catch (err) {
        showAuthError('login', err.message || 'Invalid email or password.');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

async function handleForgotSubmit(event) {
    event.preventDefault();
    clearAuthMessages();

    const email = document.getElementById('forgotEmail').value.trim();
    const submitBtn = document.getElementById('forgotSubmitBtn');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showAuthError('forgot', 'Please enter a valid email address.');

    U.setLoading(submitBtn, true, 'Sending…');
    try {
        await window.CatalystAuth.sendPasswordReset(email);
        showAuthSuccess('forgot', 'If an account exists for that email, a password reset link has been sent.');
        event.target.reset();
    } catch (err) {
        showAuthError('forgot', err.message || 'Could not send reset link.');
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

    if (pw1.length < 8) {
        box.innerHTML = '<i class="ph ph-warning" aria-hidden="true"></i> Password must be at least 8 characters.';
        box.classList.add('visible');
        return;
    }
    if (pw1 !== pw2) {
        box.innerHTML = '<i class="ph ph-warning" aria-hidden="true"></i> Passwords do not match.';
        box.classList.add('visible');
        return;
    }

    U.setLoading(submitBtn, true, 'Saving…');
    try {
        await window.CatalystAuth.updatePassword(pw1);
        await window.CatalystAuth.refreshProfile();
        U.toast('Password updated successfully.', 'success');
        U.closeModal('resetPasswordModal');
        event.target.reset();
    } catch (err) {
        box.innerHTML = `<i class="ph ph-warning" aria-hidden="true"></i> ${U.escapeHtml(err.message)}`;
        box.classList.add('visible');
    } finally {
        U.setLoading(submitBtn, false);
    }
}

function initHeaderEffects() {
    const header = document.querySelector('.glass-header');
    if (!header) return;
    const updateHeader = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 16);
    };
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initHeaderEffects();
    U.initInteractions();

    loadPublicEvents();
    const aboutTab = document.getElementById('about');
    if (aboutTab && aboutTab.classList.contains('active')) {
        loadTeamMembers();
    }
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

/* ============================== Learning Hub ============================== */

let hubState = {
    modules: [],
    lessons: [],
    watchedLessonIds: new Set(),
    completedModuleIds: new Set(),
    activeModuleId: null,
    activeLessonId: null,
    videoStarted: false,
    ytPlayer: null,
    ytInitTimer: null,
    renderToken: 0
};

let ytApiLoadPromise = null;

function extractYouTubeVideoId(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    const isValidId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
    const candidate = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : (/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\//i.test(trimmed) ? `https://${trimmed}` : '');

    if (candidate) {
        try {
            const parsed = new URL(candidate);
            const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
            const segments = parsed.pathname.split('/').filter(Boolean);

            if (host === 'youtu.be') {
                return isValidId(segments[0]) ? segments[0] : null;
            }

            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
                if (segments[0] === 'watch' || parsed.pathname === '/watch') {
                    const vParam = parsed.searchParams.get('v');
                    return isValidId(vParam) ? vParam : null;
                }
                if (['embed', 'shorts', 'v', 'live'].includes(segments[0])) {
                    return isValidId(segments[1]) ? segments[1] : null;
                }
                const vParam = parsed.searchParams.get('v');
                return isValidId(vParam) ? vParam : null;
            }
        } catch {
            // Fall through to regex check
        }
    }

    const fallbackMatch = trimmed.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|live\/|v\/|watch\?(?:.*&)?v=))([A-Za-z0-9_-]{11})(?:[?&#/]|$)/);
    return fallbackMatch && isValidId(fallbackMatch[1]) ? fallbackMatch[1] : null;
}

function loadYouTubeIframeAPI(timeoutMs = 12000) {
    if (window.YT && typeof window.YT.Player === 'function') {
        window.ytApiReady = true;
        return Promise.resolve(window.YT);
    }

    if (ytApiLoadPromise) {
        return ytApiLoadPromise;
    }

    ytApiLoadPromise = new Promise((resolve, reject) => {
        let settled = false;
        let pollId = null;
        let timeoutId = null;
        let scriptEl = null;
        const previousReady = typeof window.onYouTubeIframeAPIReady === 'function'
            ? window.onYouTubeIframeAPIReady
            : null;

        const cleanup = () => {
            if (pollId) {
                clearInterval(pollId);
                pollId = null;
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        const succeed = () => {
            if (settled) return;
            settled = true;
            cleanup();
            window.ytApiReady = true;
            resolve(window.YT);
        };

        const fail = (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            window.ytApiReady = false;
            if (scriptEl && scriptEl.dataset.catalystYtApi === 'true' && scriptEl.parentNode) {
                scriptEl.parentNode.removeChild(scriptEl);
            }
            ytApiLoadPromise = null;
            reject(err);
        };

        // Register callback before inserting the YouTube API script
        window.onYouTubeIframeAPIReady = function () {
            if (previousReady) {
                try {
                    previousReady();
                } catch (e) {
                    console.error('[Catalyst Learning Hub] Previous YouTube ready handler error:', e);
                }
            }
            if (window.YT && typeof window.YT.Player === 'function') {
                succeed();
            }
        };

        const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
        if (existingScript) {
            scriptEl = existingScript;
            existingScript.addEventListener('error', () => {
                fail(new Error('Failed to load YouTube IFrame API script.'));
            }, { once: true });
        } else {
            scriptEl = document.createElement('script');
            scriptEl.src = 'https://www.youtube.com/iframe_api';
            scriptEl.async = true;
            scriptEl.dataset.catalystYtApi = 'true';
            scriptEl.onerror = () => {
                fail(new Error('Failed to load YouTube IFrame API script.'));
            };
            (document.head || document.body || document.documentElement).appendChild(scriptEl);
        }

        pollId = setInterval(() => {
            if (window.YT && typeof window.YT.Player === 'function') {
                succeed();
            }
        }, 100);

        timeoutId = setTimeout(() => {
            fail(new Error('YouTube IFrame API initialization timed out.'));
        }, timeoutMs);
    });

    return ytApiLoadPromise;
}

function destroyActiveYouTubePlayer() {
    if (hubState.ytInitTimer) {
        clearTimeout(hubState.ytInitTimer);
        hubState.ytInitTimer = null;
    }
    if (hubState.ytPlayer) {
        try {
            if (typeof hubState.ytPlayer.destroy === 'function') {
                hubState.ytPlayer.destroy();
            }
        } catch (e) {
            // Ignore cleanup errors if DOM element was already detached
        }
        hubState.ytPlayer = null;
    }
}

function getYouTubeErrorMessage(errorCode) {
    switch (errorCode) {
        case 2:
            return 'This video URL has invalid parameters and cannot be played here.';
        case 5:
            return 'This browser cannot play the requested YouTube HTML5 video.';
        case 100:
            return 'This video is unavailable, private, or has been removed.';
        case 101:
        case 150:
            return 'The video owner has disabled embedded playback on external sites.';
        default:
            return 'The video player could not be loaded right now.';
    }
}

function showLessonVideoFallback(lesson, ytId, message, options = {}) {
    const statusEl = document.getElementById(`yt-status-${lesson.id}`);
    if (!statusEl) return;

    statusEl.classList.remove('is-hidden');
    statusEl.classList.add('is-error');

    const watchUrl = ytId
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}`
        : (U.isValidHttpUrl(lesson.youtube_url) ? lesson.youtube_url.trim() : '');

    const watchBtnHtml = watchUrl
        ? `<a class="btn-primary" href="${U.escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer"><i class="ph ph-youtube-logo" aria-hidden="true"></i> Watch on YouTube</a>`
        : '';
    const retryBtnHtml = options.allowRetry !== false && ytId
        ? `<button type="button" class="btn-outline" onclick="retryLessonVideo('${U.escapeHtml(lesson.id)}')"><i class="ph ph-arrow-clockwise" aria-hidden="true"></i> Retry</button>`
        : '';

    statusEl.innerHTML = `
        <i class="ph ph-warning-circle" aria-hidden="true"></i>
        <span>${U.escapeHtml(message)}</span>
        ${(watchBtnHtml || retryBtnHtml) ? `<div class="lesson-video-error-actions">${watchBtnHtml}${retryBtnHtml}</div>` : ''}
    `;
}

window.retryLessonVideo = function (lessonId) {
    const lesson = hubState.lessons.find((l) => l.id === lessonId);
    if (lesson) {
        renderActiveLesson(lesson);
    }
};

async function initLessonYouTubePlayer(lesson, ytId, renderToken) {
    try {
        await loadYouTubeIframeAPI();
    } catch (apiErr) {
        if (renderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;
        console.warn(`[Catalyst Learning Hub] YouTube API load error for lesson "${lesson.title}":`, apiErr.message || apiErr);
        showLessonVideoFallback(
            lesson,
            ytId,
            'Unable to initialize the YouTube player right now. You can retry or watch the video directly on YouTube.'
        );
        return;
    }

    if (renderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;

    const playerMount = document.getElementById(`yt-player-${lesson.id}`);
    if (!playerMount) return;

    destroyActiveYouTubePlayer();

    hubState.ytInitTimer = setTimeout(() => {
        if (renderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;
        console.warn(`[Catalyst Learning Hub] YouTube player readiness timed out for lesson "${lesson.title}" (video ${ytId}).`);
        showLessonVideoFallback(
            lesson,
            ytId,
            'The video player is taking too long to respond. You can retry or open the video on YouTube.'
        );
    }, 12000);

    try {
        hubState.ytPlayer = new window.YT.Player(`yt-player-${lesson.id}`, {
            height: '100%',
            width: '100%',
            videoId: ytId,
            playerVars: { playsinline: 1, rel: 0 },
            events: {
                onReady: () => {
                    if (renderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;
                    if (hubState.ytInitTimer) {
                        clearTimeout(hubState.ytInitTimer);
                        hubState.ytInitTimer = null;
                    }
                    const statusEl = document.getElementById(`yt-status-${lesson.id}`);
                    if (statusEl) {
                        statusEl.classList.add('is-hidden');
                        statusEl.classList.remove('is-error');
                    }
                },
                onStateChange: async (event) => {
                    if (renderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;
                    if (event.data === window.YT.PlayerState.PLAYING && !hubState.videoStarted) {
                        hubState.videoStarted = true;
                        const btn = document.getElementById(`finishLessonBtn_${lesson.id}`);
                        if (btn) { btn.disabled = false; btn.title = ''; }
                        try {
                            await window.CatalystDB.rpc('record_lesson_video_start', { p_lesson_id: lesson.id });
                        } catch (e) {
                            console.error('Failed to record video start on server:', e);
                        }
                    }
                },
                onError: (event) => {
                    if (renderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;
                    if (hubState.ytInitTimer) {
                        clearTimeout(hubState.ytInitTimer);
                        hubState.ytInitTimer = null;
                    }
                    const code = event ? event.data : 'unknown';
                    const message = getYouTubeErrorMessage(code);
                    console.warn(`[Catalyst Learning Hub] YouTube player error (${code}) for lesson "${lesson.title}" (video ${ytId}).`);
                    showLessonVideoFallback(lesson, ytId, message);
                }
            }
        });
    } catch (ytErr) {
        if (hubState.ytInitTimer) {
            clearTimeout(hubState.ytInitTimer);
            hubState.ytInitTimer = null;
        }
        console.error('[Catalyst Learning Hub] YouTube player creation failed:', ytErr);
        showLessonVideoFallback(
            lesson,
            ytId,
            'Could not create the video player. You can retry or watch directly on YouTube.'
        );
    }
}

async function loadLearningHub() {
    const container = document.getElementById('learningModulesContainer');
    if (!container) return;

    try {
        const { data: modules, error: modErr } = await window.CatalystDB
            .from('learning_modules')
            .select('*')
            .eq('published', true)
            .order('sort_order', { ascending: true });

        if (modErr) throw modErr;
        if (!modules || modules.length === 0) {
            container.innerHTML = `<div class="empty-state reveal"><i class="ph ph-books" aria-hidden="true"></i> Learning modules are being prepared.</div>`;
            return;
        }

        const { data: lessons, error: lesErr } = await window.CatalystDB
            .from('learning_lessons')
            .select('*')
            .eq('published', true)
            .order('sort_order', { ascending: true });

        if (lesErr) console.error('Error loading learning_lessons:', lesErr);
        hubState.modules = modules || [];
        hubState.lessons = lessons || [];
        hubState.lessonsError = lesErr;
        await refreshHubProgress();
        renderHubLevel1();
    } catch (err) {
        console.error('[Catalyst] Learning Hub error:', err.message || err);
        container.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning" aria-hidden="true"></i> Error loading learning modules.</div>`;
    }
}

async function refreshHubProgress() {
    const myId = window.CatalystAuth?.getSession()?.user?.id;
    hubState.watchedLessonIds.clear();
    hubState.completedModuleIds.clear();
    if (myId) {
        const [{ data: lp }, { data: mp }] = await Promise.all([
            window.CatalystDB.from('user_lesson_progress').select('lesson_id, completed_at, video_started_at, watched_at').eq('user_id', myId),
            window.CatalystDB.from('user_module_progress').select('module_id').eq('user_id', myId)
        ]);

        (lp || []).forEach((r) => {
            if (r.completed_at) {
                hubState.watchedLessonIds.add(r.lesson_id);
            } else if (r.watched_at && !r.video_started_at) {
                hubState.watchedLessonIds.add(r.lesson_id);
            }
        });

        hubState.completedModuleIds = new Set((mp || []).map((r) => r.module_id));
    }
}

window.renderHubLevel1 = function () {
    destroyActiveYouTubePlayer();
    hubState.renderToken += 1;
    const container = document.getElementById('learningModulesContainer');
    if (!container) return;
    const totalLessons = hubState.lessons.length;
    let completedLessons = 0;
    hubState.lessons.forEach((l) => { if (hubState.watchedLessonIds.has(l.id)) completedLessons++; });
    const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const session = window.CatalystAuth?.getSession();
    let progressHtml = '';

    if (session) {
        progressHtml = `
        <div style="margin-bottom: 32px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                <span style="font-size:0.8rem; font-weight:600; letter-spacing:0.05em; color:var(--text-muted); text-transform:uppercase;">Overall Learning Progress</span>
                <span style="font-family:var(--font-heading); font-size:1.1rem; font-weight:700; color:var(--accent-color);">${progressPct}%</span>
            </div>
            <div class="hub-progress-bar" style="margin:0;"><div class="hub-progress-fill" style="width: ${progressPct}%;"></div></div>
        </div>`;
    } else {
        progressHtml = `
        <div class="hub-guest-banner">
            <span><i class="ph ph-info" aria-hidden="true"></i> Sign in to save your learning progress and earn points.</span>
            <button type="button" class="btn-outline" onclick="showAuthPanel('login'); U.openModal('authModal');">Log In</button>
        </div>`;
    }

    let cardsHtml = '<div class="module-cards-grid">';
    hubState.modules.forEach((mod, idx) => {
        const modLessons = hubState.lessons.filter((l) => l.module_id === mod.id);
        const modLessonCount = modLessons.length;
        let modCompletedLessons = 0;
        modLessons.forEach((l) => { if (hubState.watchedLessonIds.has(l.id)) modCompletedLessons++; });
        const isComplete = hubState.completedModuleIds.has(mod.id) || (modLessonCount > 0 && modCompletedLessons === modLessonCount);
        const coverHtml = (mod.cover_image_url && U.isValidHttpUrl(mod.cover_image_url))
            ? `<img src="${U.escapeHtml(mod.cover_image_url)}" class="module-card-img" alt="${U.escapeHtml(mod.title)} cover" loading="lazy">`
            : `<div class="module-card-img fallback"><i class="ph ph-books" aria-hidden="true"></i></div>`;

        cardsHtml += `<div class="module-card reveal" tabindex="0" role="button" onclick="openModule('${mod.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openModule('${mod.id}');}">
            <div class="module-cover-area">
                ${coverHtml}
                <div class="module-card-overlay">
                    <div class="module-card-desc">${U.escapeHtml(mod.description || '')}</div>
                </div>
            </div>
            <div class="module-card-content">
                <div class="module-card-eyebrow">MODULE ${(idx + 1).toString().padStart(2, '0')}</div>
                <h3 class="module-card-title">${U.escapeHtml(mod.title)}</h3>
                <div class="module-card-footer">
                    <div class="module-progress-text">
                        ${session && isComplete ? `<span style="color:var(--success-color);"><i class="ph ph-check-circle" aria-hidden="true"></i> Completed</span>` : `<span>${modCompletedLessons} / ${modLessonCount} LESSONS</span>`}
                        ${session && !isComplete && modLessonCount > 0 ? `<span>${Math.round((modCompletedLessons / modLessonCount) * 100)}%</span>` : ''}
                    </div>
                    ${session && !isComplete && modLessonCount > 0 ? `
                    <div class="module-mini-progress">
                        <div class="module-mini-progress-fill" style="width: ${Math.round((modCompletedLessons / modLessonCount) * 100)}%;"></div>
                    </div>` : ''}
                </div>
            </div>
        </div>`;
    });
    cardsHtml += '</div>';

    let errorHtml = '';
    if (hubState.lessonsError) {
        errorHtml = `<div class="error-state" style="margin-bottom: 20px;"><i class="ph ph-warning" aria-hidden="true"></i> Error loading lessons. Some content may be missing.</div>`;
    }

    container.innerHTML = errorHtml + progressHtml + cardsHtml;
    setTimeout(() => U.initScrollReveals(), 50);
};

window.openModule = function (moduleId) {
    hubState.activeModuleId = moduleId;
    const modLessons = hubState.lessons.filter((l) => l.module_id === moduleId);
    if (modLessons.length > 0) {
        const firstUnwatched = modLessons.find((l) => !hubState.watchedLessonIds.has(l.id));
        hubState.activeLessonId = (firstUnwatched || modLessons[0]).id;
    } else {
        hubState.activeLessonId = null;
    }
    renderHubLevel2();
};

window.openLesson = function (lessonId) {
    hubState.activeLessonId = lessonId;
    renderHubLevel2();
};

window.toggleMobileSidebar = function () {
    const sidebar = document.getElementById('hubSidebar');
    if (sidebar) sidebar.classList.toggle('open');
};

function renderMarkdownSafe(text) {
    if (!text) return '';
    try {
        if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(marked.parse(text));
        }
    } catch (e) {
        console.error('Markdown parsing failed:', e);
    }
    return U.escapeHtml(text).replace(/\n/g, '<br>');
}

async function renderHubLevel2() {
    destroyActiveYouTubePlayer();
    const container = document.getElementById('learningModulesContainer');
    try {
        const mod = hubState.modules.find((m) => m.id === hubState.activeModuleId);
        if (!mod) {
            container.innerHTML = `<div class="error-state">Module not found.</div>`;
            return;
        }

        const modLessons = hubState.lessons.filter((l) => l.module_id === mod.id);
        const activeLesson = modLessons.find((l) => l.id === hubState.activeLessonId);
        let sidebarList = '';

        modLessons.forEach((l, idx) => {
            const isWatched = hubState.watchedLessonIds.has(l.id);
            const isActive = l.id === hubState.activeLessonId;
            const numStr = (idx + 1).toString().padStart(2, '0');
            let icon = '<i class="ph ph-circle" aria-hidden="true"></i>';
            if (isWatched) icon = '<i class="ph ph-check-circle" style="color:var(--success-color);" aria-hidden="true"></i>';
            else if (isActive) icon = '<i class="ph ph-play-circle" style="color:var(--accent-color);" aria-hidden="true"></i>';
            sidebarList += `<li class="lesson-nav-item ${isActive ? 'active' : ''}" onclick="openLesson('${l.id}')">${icon} <span>${numStr}. ${U.escapeHtml(l.title)}</span></li>`;
        });

        const modIndex = hubState.modules.findIndex((m) => m.id === mod.id);
        const modNumStr = (modIndex + 1).toString().padStart(2, '0');
        let modCompletedLessons = 0;
        modLessons.forEach((l) => { if (hubState.watchedLessonIds.has(l.id)) modCompletedLessons++; });
        const modLessonCount = modLessons.length;
        const progressPct = modLessonCount > 0 ? Math.round((modCompletedLessons / modLessonCount) * 100) : 0;
        const session = window.CatalystAuth?.getSession();

        let progressHtml = '';
        if (session && modLessonCount > 0) {
            progressHtml = `
            <div style="margin-top: 24px; max-width: 400px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                    <span style="font-size:0.75rem; font-weight:600; letter-spacing:0.05em; color:var(--text-muted); text-transform:uppercase;">Module Progress</span>
                    <span style="font-family:var(--font-heading); font-size:1rem; font-weight:700; color:var(--accent-color);">${progressPct}%</span>
                </div>
                <div class="module-mini-progress"><div class="module-mini-progress-fill" style="width: ${progressPct}%;"></div></div>
            </div>`;
        }

        const html = `
            <div class="module-view">
                <div class="module-view-header glass-panel" style="padding: 32px; border-radius: var(--radius-lg);">
                    <button type="button" class="btn-link" style="display:inline-flex; align-items:center; gap:8px; margin-bottom:20px; text-decoration:none;" onclick="renderHubLevel1()">
                        <i class="ph ph-arrow-left" aria-hidden="true"></i> Back to Learning Hub
                    </button>

                    <div style="margin-bottom: 8px; font-size:0.8rem; color:var(--accent-color); font-weight:600; letter-spacing:0.08em; text-transform:uppercase;">MODULE ${modNumStr}</div>
                    <h2 style="font-size: clamp(1.8rem, 3vw, 2.5rem); margin:0 0 16px 0; font-weight:700; line-height:1.2;">${U.escapeHtml(mod.title)}</h2>
                    <div id="moduleDescriptionArea" style="font-size: 1.05rem; opacity:0.9; max-width: 800px;"></div>
                    ${progressHtml}
                </div>

                <div class="module-view-body">
                    <div class="module-sidebar-mobile-toggle" onclick="toggleMobileSidebar()">
                        <span><i class="ph ph-list" aria-hidden="true"></i> Course Content</span>
                        <i class="ph ph-caret-down" aria-hidden="true"></i>
                    </div>

                    <aside class="module-sidebar" id="hubSidebar">
                        <h4 style="margin-top:0; margin-bottom:15px;">Lessons</h4>
                        <ul class="lesson-nav-list" id="sidebarListArea">${sidebarList}</ul>
                    </aside>

                    <main class="module-content-area" id="lessonContentArea">
                        <div class="loading-state"><i class="ph ph-spinner-gap ph-spin" aria-hidden="true"></i> Loading lesson…</div>
                    </main>
                </div>
            </div>
        `;

        container.innerHTML = html;

        if (mod.description) {
            document.getElementById('moduleDescriptionArea').innerHTML = renderMarkdownSafe(mod.description);
        }

        if (activeLesson) {
            await renderActiveLesson(activeLesson);
        } else {
            document.getElementById('lessonContentArea').innerHTML = `<div class="empty-state">No lessons are available in this module yet.</div>`;
        }
    } catch (err) {
        console.error('Error rendering module view:', err);
        container.innerHTML = `<div class="error-state">Module could not be loaded. Please try again.</div>`;
    }
}

async function renderActiveLesson(lesson) {
    const area = document.getElementById('lessonContentArea');
    if (!area) return;

    const currentRenderToken = ++hubState.renderToken;

    try {
        hubState.videoStarted = false;
        destroyActiveYouTubePlayer();

        const isWatched = hubState.watchedLessonIds.has(lesson.id);
        let quizHtml = '';

        try {
            const { data: quizData } = await window.CatalystDB
                .from('lesson_quizzes')
                .select('*')
                .eq('lesson_id', lesson.id)
                .eq('enabled', true)
                .maybeSingle();

            if (currentRenderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;

            if (quizData) {
                const [{ data: qs }, { data: opts }] = await Promise.all([
                    window.CatalystDB.from('quiz_questions').select('*').eq('quiz_id', quizData.id).eq('published', true).order('sort_order'),
                    window.CatalystDB.from('public_quiz_options').select('id, question_id, option_text, sort_order').order('sort_order')
                ]);

                if (currentRenderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;

                let qHtml = '';
                (qs || []).forEach((q) => {
                    let oHtml = '';
                    const qOpts = (opts || []).filter((o) => o.question_id === q.id);
                    qOpts.forEach((o) => {
                        oHtml += `<label class="quiz-option"><input type="radio" name="q_${q.id}" value="${o.id}"><span>${U.escapeHtml(o.option_text)}</span></label>`;
                    });
                    qHtml += `<div class="quiz-question"><div style="font-weight:600; margin-bottom:10px;">${renderMarkdownSafe(q.question_text)}</div><div class="quiz-options">${oHtml}</div></div>`;
                });

                const instructionsHtml = quizData.instructions
                    ? `<div class="md-content" style="opacity:0.9; margin-bottom:24px; font-size:1.05rem;">${renderMarkdownSafe(quizData.instructions)}</div>`
                    : '';
                quizHtml = `<div style="margin: 64px 0 32px 0;">
                    <h3 style="font-family:var(--font-heading); font-size:1.6rem; color:var(--text-color); margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                        <i class="ph ph-exam" style="color:var(--accent-color);" aria-hidden="true"></i> ${U.escapeHtml(quizData.title)}
                    </h3>
                    ${instructionsHtml}
                    <form id="quizForm_${lesson.id}" onsubmit="handleQuizSubmit(event, '${quizData.id}', '${lesson.id}')">
                        ${qHtml}
                        <div id="quizResultArea_${lesson.id}"></div>
                        <button type="submit" class="btn-primary" style="margin-top:32px; font-size:1.05rem;"><i class="ph ph-check-circle" aria-hidden="true"></i> Submit Answers</button>
                    </form>
                </div>`;
            }
        } catch (quizErr) {
            if (currentRenderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;
            console.error('Error loading quiz:', quizErr);
            quizHtml = `<div class="error-state">Quiz could not be loaded. Please try again.</div>`;
        }

        if (currentRenderToken !== hubState.renderToken || hubState.activeLessonId !== lesson.id) return;

        const rawYoutubeUrl = typeof lesson.youtube_url === 'string' ? lesson.youtube_url.trim() : '';
        const ytId = extractYouTubeVideoId(rawYoutubeUrl);
        const hasVideoRequirement = Boolean(ytId || rawYoutubeUrl);

        let videoHtml = '';
        if (ytId) {
            videoHtml = `
              <div class="lesson-video-wrapper">
                <div class="lesson-video-status" id="yt-status-${lesson.id}">
                  <i class="ph ph-spinner-gap ph-spin" aria-hidden="true"></i>
                  <span>Loading video player…</span>
                </div>
                <div id="yt-player-${lesson.id}"></div>
              </div>`;
        } else if (rawYoutubeUrl) {
            console.warn(`[Catalyst Learning Hub] Invalid YouTube URL for lesson "${lesson.title}".`);
            const externalLink = U.isValidHttpUrl(rawYoutubeUrl)
                ? `<div class="lesson-video-error-actions"><a class="btn-outline" href="${U.escapeHtml(rawYoutubeUrl)}" target="_blank" rel="noopener noreferrer"><i class="ph ph-arrow-up-right" aria-hidden="true"></i> Open Video Link</a></div>`
                : '';
            videoHtml = `
              <div class="lesson-video-wrapper">
                <div class="lesson-video-status is-error" id="yt-status-${lesson.id}">
                  <i class="ph ph-warning-circle" aria-hidden="true"></i>
                  <span>This lesson's video link could not be embedded.</span>
                  ${externalLink}
                </div>
              </div>`;
        }

        const modLessons = hubState.lessons.filter((l) => l.module_id === lesson.module_id);
        const currentIndex = modLessons.findIndex((l) => l.id === lesson.id);
        const nextLesson = modLessons[currentIndex + 1];
        const prevLesson = modLessons[currentIndex - 1];
        let nextNavHtml = '';
        let prevNavHtml = '';

        if (prevLesson) {
            prevNavHtml = `<button type="button" class="btn-outline" onclick="openLesson('${prevLesson.id}')"><i class="ph ph-arrow-left" aria-hidden="true"></i> Previous Lesson</button>`;
        }

        if (nextLesson) {
            nextNavHtml = `<button type="button" class="btn-outline" onclick="openLesson('${nextLesson.id}')">Next Lesson <i class="ph ph-arrow-right" aria-hidden="true"></i></button>`;
        } else {
            const currentModIndex = hubState.modules.findIndex((m) => m.id === lesson.module_id);
            const nextMod = hubState.modules[currentModIndex + 1];
            if (nextMod) {
                nextNavHtml = `<button type="button" class="btn-outline" onclick="openModule('${nextMod.id}')">Next Module <i class="ph ph-arrow-right" aria-hidden="true"></i></button>`;
            } else {
                nextNavHtml = `<button type="button" class="btn-outline" onclick="renderHubLevel1()">Back to Learning Hub <i class="ph ph-arrow-up" aria-hidden="true"></i></button>`;
            }
        }

        const session = window.CatalystAuth?.getSession();
        let finishBtnHtml = '';
        if (isWatched) {
            finishBtnHtml = `<span style="color:var(--success-color); font-weight:600;"><i class="ph ph-check-circle" aria-hidden="true"></i> Completed</span>`;
        } else if (session) {
            const disableState = (hasVideoRequirement && !hubState.videoStarted) ? 'disabled' : '';
            const titleText = (hasVideoRequirement && !hubState.videoStarted) ? 'Watch video to complete' : '';
            finishBtnHtml = `<button type="button" class="btn-primary" id="finishLessonBtn_${lesson.id}" onclick="handleFinishLesson('${lesson.id}')" ${disableState} title="${titleText}"><i class="ph ph-check" aria-hidden="true"></i> Complete Lesson</button>`;
        } else {
            finishBtnHtml = `<span style="font-size:0.85rem; opacity:0.8;"><i class="ph ph-lock-simple" aria-hidden="true"></i> Log in to complete</span>`;
        }

        const contextHtml = `<div style="font-size:0.8rem; color:var(--accent-color); font-weight:600; letter-spacing:0.06em; margin-bottom:12px; text-transform:uppercase;">LESSON ${(currentIndex + 1).toString().padStart(2, '0')} OF ${modLessons.length.toString().padStart(2, '0')}</div>`;
        const descHtml = lesson.description ? `<div class="md-content" style="font-size:1.1rem; opacity:0.9; margin-top:16px;">${renderMarkdownSafe(lesson.description)}</div>` : '';
        const summaryHtml = lesson.catalyst_summary ? `<div style="margin: 48px 0;">
            <h3 style="font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:16px;">Catalyst Summary</h3>
            <div class="md-content" style="opacity:0.95; font-size:1.05rem;">${renderMarkdownSafe(lesson.catalyst_summary)}</div>
        </div>` : '';
        const analysisHtml = lesson.catalyst_analysis ? `<div style="margin: 48px 0;">
            <h3 style="font-size:0.9rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:16px;">Catalyst Analysis</h3>
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
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:12px;">
                    <div>${prevNavHtml}</div>
                    <div>${nextNavHtml}</div>
                </div>
            </div>`;

        if (ytId) {
            initLessonYouTubePlayer(lesson, ytId, currentRenderToken);
        }
    } catch (err) {
        if (currentRenderToken !== hubState.renderToken) return;
        console.error('Error rendering lesson:', err);
        area.innerHTML = `<div class="error-state">Lesson content could not be loaded. Please try again.</div>`;
    }
}

window.handleQuizSubmit = async function (e, quizId, lessonId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const answers = {};
    for (const [key, val] of formData.entries()) {
        if (key.startsWith('q_')) answers[key.replace('q_', '')] = val;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    U.setLoading(submitBtn, true, 'Grading…');
    try {
        const { data, error } = await window.CatalystDB.rpc('submit_quiz_attempt', { p_quiz_id: quizId, p_answers: answers });
        if (error) throw error;
        const resArea = document.getElementById(`quizResultArea_${lessonId}`);
        if (data.passed) {
            resArea.innerHTML = `<div class="quiz-result passed"><i class="ph ph-check-circle" aria-hidden="true"></i> Quiz Passed! Score: ${data.percentage}% (+${data.points_earned} pts)</div>`;
            submitBtn.style.display = 'none';
        } else {
            resArea.innerHTML = `<div class="quiz-result failed"><i class="ph ph-x-circle" aria-hidden="true"></i> Quiz not passed yet. Score: ${data.percentage}%. Please review and try again.</div>`;
            U.setLoading(submitBtn, false);
        }
        await refreshMyPoints();
        loadLeaderboard();
    } catch (err) {
        U.toast(`Error submitting quiz: ${err.message}`, 'error');
        U.setLoading(submitBtn, false);
    }
};

window.handleFinishLesson = async function (lessonId) {
    const btn = document.getElementById(`finishLessonBtn_${lessonId}`);
    if (!btn) return;
    U.setLoading(btn, true, 'Saving…');
    try {
        const { error } = await window.CatalystDB.rpc('complete_lesson', { p_lesson_id: lessonId });
        if (error) {
            if (error.message && error.message.includes('Quiz must be passed')) {
                U.toast('You must pass the quiz before finishing this lesson.', 'warning');
            } else if (error.message && error.message.includes('Video must be started')) {
                U.toast('Please play the video before finishing the lesson.', 'warning');
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
        const finishArea = document.getElementById(`finishLessonArea_${lessonId}`);
        if (finishArea) {
            finishArea.innerHTML = `<span style="color:var(--success-color); font-weight:600;"><i class="ph ph-check-circle" aria-hidden="true"></i> Completed</span>`;
        }
        renderHubLevel2();
    } catch (err) {
        U.toast(`Error completing lesson: ${err.message}`, 'error');
        U.setLoading(btn, false);
    }
};

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
        badge.innerHTML = `<i class="ph ph-trophy" aria-hidden="true"></i> ${data.points ?? 0} pts`;
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
        <td style="font-weight:500;"><i class="ph ph-user" aria-hidden="true"></i> ${U.escapeHtml(u.full_name || 'Community Member')} ${isMe ? '<span class="badge" style="border-color:var(--accent-color); color:var(--accent-color);">YOU</span>' : ''}</td>
        <td><i class="ph ph-play-circle" aria-hidden="true"></i> ${u.lessons_watched ?? 0} watched</td>
        <td><i class="ph ph-books" aria-hidden="true"></i> ${u.modules_completed ?? 0} completed</td>
        <td><span class="points-pill"><i class="ph ph-trophy" aria-hidden="true"></i> ${u.points ?? 0} pts</span></td>
      </tr>`;
}

function renderLeaderboard(rows) {
    const wrap = document.getElementById('leaderboardWrap');
    if (!wrap) return;

    if (!rows || rows.length === 0) {
        wrap.innerHTML = `<div class="empty-state reveal"><i class="ph ph-trophy" aria-hidden="true"></i> No entries yet — start watching lessons to earn points.</div>`;
        return;
    }

    const myId = window.CatalystAuth?.getSession()?.user?.id;

    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Rank</th><th>Member</th><th>Lessons</th><th>Modules</th><th>Points</th></tr></thead>
          <tbody>${rows.map((u, i) => leaderboardRowHtml(u, i + 1, myId)).join('')}</tbody>
        </table>
      </div>`;
}

async function loadLeaderboard() {
    const wrap = document.getElementById('leaderboardWrap');
    if (!wrap) return;
    wrap.innerHTML = `<div class="loading-state reveal"><i class="ph ph-spinner-gap ph-spin" aria-hidden="true"></i> Loading leaderboard…</div>`;

    try {
        const { data, error } = await window.CatalystDB
            .from('leaderboard')
            .select('*')
            .order('points', { ascending: false });

        if (error) throw error;

        allLeaderboardRows = data || [];
        renderLeaderboard(allLeaderboardRows);
    } catch (err) {
        console.error('[Catalyst] Leaderboard load error:', err.message || err);
        wrap.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning" aria-hidden="true"></i> Error loading leaderboard.</div>`;
    }
}

function filterLeaderboard() {
    const input = document.getElementById('leaderboardSearchInput');
    if (!input) return;
    const query = input.value.toLowerCase();
    if (!query) return renderLeaderboard(allLeaderboardRows);
    const filtered = allLeaderboardRows.filter((u) => (u.full_name || '').toLowerCase().includes(query));
    renderLeaderboard(filtered);
}

/* ============================== Partnerships (public) ============================== */

async function loadPartners() {
    const grid = document.getElementById('partnersGrid');
    if (!grid) return;

    try {
        const { data, error } = await window.CatalystDB
            .from('partnerships')
            .select('*')
            .eq('published', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `<div class="empty-state reveal"><i class="ph ph-handshake" aria-hidden="true"></i> Partner information will be added soon.</div>`;
            return;
        }

        grid.innerHTML = data.map((p) => {
            const hasLogo = p.logo_url && U.isValidHttpUrl(p.logo_url);
            const logo = hasLogo
                ? `<img src="${U.escapeHtml(p.logo_url)}" alt="${U.escapeHtml(p.name)}" class="partner-logo-img" loading="lazy">`
                : `<div class="partner-name-fallback">${U.escapeHtml(p.name)}</div>`;
            const hasUrl = p.website_url && U.isValidHttpUrl(p.website_url);
            const inner = hasUrl
                ? `<a href="${U.escapeHtml(p.website_url)}" target="_blank" rel="noopener noreferrer" class="partner-tile-link" aria-label="${U.escapeHtml(p.name)}">${logo}</a>`
                : logo;
            return `<div class="reveal partner-tile">${inner}</div>`;
        }).join('');
        setTimeout(() => U.initScrollReveals(), 50);
    } catch (err) {
        console.error('[Catalyst] Partners load error:', err.message || err);
        grid.innerHTML = `<div class="error-state reveal"><i class="ph ph-warning" aria-hidden="true"></i> Error loading partners.</div>`;
    }
}
