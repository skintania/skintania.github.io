import { token as getToken, API_URL } from '/shared/api.js';

async function apiFetch(path, options = {}) {
    return fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Authorization': `Bearer ${getToken()}`, ...options.headers },
    });
}

async function fetchEvents() {
    try {
        const res = await apiFetch('/events');
        if (!res.ok) throw new Error();
        const { events = [] } = await res.json();
        const details = await Promise.all(events.map(e => fetchEventDetail(e.id)));
        return details.filter(Boolean);
    } catch {
        return [];
    }
}

async function fetchEventDetail(id) {
    try {
        const res = await apiFetch(`/events/${id}`);
        if (!res.ok) return null;
        const result = await res.json();
        const ev = result.event ?? null;
        if (!ev) return null;
        // Merge top-level fields that the API may return outside the event object
        const { userVote, choices, isJoined, participantCount } = result;
        if (userVote !== undefined) ev.userVote = userVote;
        if (choices !== undefined) ev.choices = choices;
        if (isJoined !== undefined) ev.isJoined = isJoined;
        if (participantCount !== undefined) ev.participantCount = participantCount;
        return ev;
    } catch {
        return null;
    }
}

async function loadImageWithAuth(imgLink) {
    if (!imgLink) return null;
    if (imgLink.startsWith('http')) return imgLink;
    try {
        const res = await apiFetch(`/assets/${imgLink}`);
        if (!res.ok) return null;
        return URL.createObjectURL(await res.blob());
    } catch {
        return null;
    }
}

window.editingEventId = null;
let currentUser = null;
const creatorCache = {};

async function fetchCreator(userId) {
    if (userId == null) return null;
    if (creatorCache[userId] !== undefined) return creatorCache[userId];
    try {
        const res = await apiFetch(`/users/${userId}`);
        if (!res.ok) { creatorCache[userId] = null; return null; }
        const { user } = await res.json();
        creatorCache[userId] = user ?? null;
        return creatorCache[userId];
    } catch {
        creatorCache[userId] = null;
        return null;
    }
}

async function fetchAvatarUrl(userId) {
    try {
        const res = await apiFetch(`/users/${userId}/avatar`);
        if (!res.ok) return null;
        return URL.createObjectURL(await res.blob());
    } catch {
        return null;
    }
}

async function createCreatorHeader(ev) {
    const creator = await fetchCreator(ev.creatorId);
    const username = creator?.username || `user#${ev.creatorId}`;
    const initial = username[0].toUpperCase();

    const a = document.createElement('a');
    a.href = '#'; // future: /profile/?id=${ev.creatorId}
    a.className = 'creator-header';
    a.title = 'ดูโปรไฟล์ (เร็วๆ นี้)';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'creator-avatar-wrap';
    avatarWrap.textContent = initial;

    if (creator?.profile_url) {
        const avatarUrl = await fetchAvatarUrl(ev.creatorId);
        if (avatarUrl) {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = username;
            avatarWrap.textContent = '';
            avatarWrap.appendChild(img);
        }
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'creator-name';
    nameSpan.textContent = `@${username}`;

    const role = creator?.role || 'member';
    const roleLabel = role === 'admin' ? 'Admin' : role === 'OSK' ? 'OSK' : 'Member';
    const roleBadge = document.createElement('span');
    roleBadge.className = `creator-role-badge creator-role-badge--${role.toLowerCase()}`;
    roleBadge.textContent = roleLabel;

    a.appendChild(avatarWrap);
    a.appendChild(nameSpan);
    a.appendChild(roleBadge);
    return a;
}

async function fetchCurrentUser() {
    try {
        const res = await apiFetch('/auth/me');
        if (!res.ok) return null;
        const { user } = await res.json();
        return user ?? null;
    } catch {
        return null;
    }
}

function createOptionsMenu(id, { canEdit, canDelete }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'post-options-menu';
    const editBtn  = canEdit  ? `<button class="edit-post-btn"   data-id="${id}">✏️ แก้ไข</button>` : '';
    const deleteBtn = canDelete ? `<button class="delete-post-btn" data-id="${id}" style="color:#ef4444">🗑️ ลบ</button>` : '';
    wrapper.innerHTML = `
        <button class="menu-dot-btn">⋮</button>
        <div class="menu-dropdown-content">${editBtn}${deleteBtn}</div>
    `;
    const dot = wrapper.querySelector('.menu-dot-btn');
    const drop = wrapper.querySelector('.menu-dropdown-content');
    dot.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.menu-dropdown-content').forEach(m => { if (m !== drop) m.classList.remove('show'); });
        drop.classList.toggle('show');
    });
    return wrapper;
}

async function renderPoll(ev) {
    const choices = Array.isArray(ev.choices) ? ev.choices : [];
    // userVote can be a plain ID or an object {choiceId, ...}
    const rawVote = ev.userVote;
    let votedId = null;
    if (rawVote != null) {
        const vid = typeof rawVote === 'object' ? rawVote.choiceId : rawVote;
        votedId = vid != null ? String(vid) : null;
    }

    const container = document.createElement('div');
    container.className = 'poll-choices';

    // Build DOM refs so we can update counts later
    const refs = [];

    for (const choice of choices) {
        const row = document.createElement('div');
        row.className = 'poll-choice-row';

        if (choice.imgLink) {
            const img = document.createElement('img');
            img.src = await loadImageWithAuth(choice.imgLink) ?? '';
            img.className = 'poll-choice-img';
            row.appendChild(img);
        }

        const content = document.createElement('div');
        content.className = 'poll-choice-content';

        const header = document.createElement('div');
        header.className = 'poll-choice-header';
        const label = document.createElement('strong');
        label.textContent = choice.choiceText;
        const voteText = document.createElement('span');
        voteText.className = 'poll-vote-count';
        header.appendChild(label);
        header.appendChild(voteText);

        const barOuter = document.createElement('div');
        barOuter.className = 'poll-bar-track';
        const bar = document.createElement('div');
        bar.className = 'poll-bar-fill';
        barOuter.appendChild(bar);

        content.appendChild(header);
        content.appendChild(barOuter);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'poll-vote-checkbox';

        refs.push({ choice: { ...choice, voteCount: choice.voteCount ?? 0 }, voteText, bar, checkbox });

        row.appendChild(content);
        row.appendChild(checkbox);
        container.appendChild(row);
    }

    function updateUI() {
        const total = refs.reduce((s, r) => s + r.choice.voteCount, 0);
        for (const r of refs) {
            const pct = total > 0 ? r.choice.voteCount / total * 100 : 0;
            r.voteText.textContent = `${r.choice.voteCount} โหวต (${pct.toFixed(0)}%)`;
            r.bar.style.width = `${pct}%`;
            // eslint-disable-next-line eqeqeq
            r.checkbox.checked = votedId != null && r.choice.id == votedId;
        }
    }

    updateUI();

    for (const ref of refs) {
        ref.checkbox.addEventListener('change', async e => {
            const checking = e.target.checked;
            const prevRef = refs.find(r => String(r.choice.id) === votedId);

            if (!checking) {
                // Unvote: optimistic update
                if (prevRef) prevRef.choice.voteCount = Math.max(0, prevRef.choice.voteCount - 1);
                votedId = null;
                updateUI();
                try {
                    const res = await apiFetch(`/events/${ev.id}/vote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ choiceId: null }),
                    });
                    if (res.ok) {
                        const result = await res.json();
                        if (Array.isArray(result.choices)) {
                            result.choices.forEach(c => {
                                const r = refs.find(r => String(r.choice.id) === String(c.id));
                                if (r) r.choice.voteCount = c.voteCount ?? r.choice.voteCount;
                            });
                            updateUI();
                        }
                    }
                } catch { /* silent */ }
                return;
            }

            // Vote: uncheck others, optimistic update
            refs.forEach(r => { if (r.checkbox !== e.target) r.checkbox.checked = false; });
            if (prevRef) prevRef.choice.voteCount = Math.max(0, prevRef.choice.voteCount - 1);
            ref.choice.voteCount += 1;
            votedId = String(ref.choice.id);
            updateUI();

            try {
                const res = await apiFetch(`/events/${ev.id}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ choiceId: ref.choice.id }),
                });
                if (res.ok) {
                    const result = await res.json();
                    if (Array.isArray(result.choices)) {
                        result.choices.forEach(c => {
                            const r = refs.find(r => String(r.choice.id) === String(c.id));
                            if (r) r.choice.voteCount = c.voteCount ?? r.choice.voteCount;
                        });
                        updateUI();
                    }
                }
            } catch { /* silent */ }
        });
    }

    return container;
}

async function renderActivity(ev) {
    const container = document.createElement('div');
    container.className = 'activity-content';

    if (ev.imgLink) {
        const img = document.createElement('img');
        img.src = await loadImageWithAuth(ev.imgLink) ?? '';
        img.className = 'activity-img';
        container.appendChild(img);
    }

    let count = ev.participantCount ?? 0;
    let joined = ev.isJoined ?? false;

    const textDiv = document.createElement('div');
    textDiv.className = 'activity-text';
    textDiv.innerHTML = `
        <p style="margin:0 0 5px">${ev.description || ''}</p>
        <div class="participant-count">👥 ผู้เข้าร่วม: ${count} คน</div>
    `;

    const joinBox = document.createElement('div');
    joinBox.className = 'activity-join-box';
    joinBox.innerHTML = `
        <input type="checkbox" id="chk-${ev.id}" class="join-checkbox">
        <label for="chk-${ev.id}" class="join-label">เข้าร่วม</label>
    `;

    const chk = joinBox.querySelector('input');
    const lbl = joinBox.querySelector('label');
    const partText = textDiv.querySelector('.participant-count');
    chk.checked = joined;
    if (joined) lbl.style.color = '#10b981';

    chk.addEventListener('change', async () => {
        // Optimistic update
        joined = chk.checked;
        count += joined ? 1 : -1;
        lbl.style.color = joined ? '#10b981' : '#94a3b8';
        partText.innerText = `👥 ผู้เข้าร่วม: ${count} คน`;
        try {
            const res = await apiFetch(`/events/${ev.id}/join`, { method: 'POST' });
            const result = await res.json();
            if (result.isJoined !== undefined) {
                joined = result.isJoined;
                chk.checked = joined;
                lbl.style.color = joined ? '#10b981' : '#94a3b8';
            }
            if (result.participantCount !== undefined) {
                count = result.participantCount;
                partText.innerText = `👥 ผู้เข้าร่วม: ${count} คน`;
            }
        } catch { /* silent */ }
    });

    container.appendChild(textDiv);
    container.appendChild(joinBox);
    return container;
}

async function renderAnnouncement(ev) {
    const container = document.createElement('div');
    container.className = 'announcement-content';
    if (ev.imgLink) {
        const img = document.createElement('img');
        img.src = await loadImageWithAuth(ev.imgLink) ?? '';
        img.className = 'announcement-img';
        container.appendChild(img);
    }
    if (ev.description) {
        const p = document.createElement('p');
        p.className = 'announcement-text';
        p.innerText = ev.description;
        container.appendChild(p);
    }
    return container;
}

async function renderEvents(events, grid) {
    grid.innerHTML = '';
    if (!events.length) {
        grid.innerHTML = '<p class="events-empty">ยังไม่มีกิจกรรมในขณะนี้</p>';
        return;
    }

    const isAdmin = currentUser?.role === 'admin';

    for (const ev of events) {
        const card = document.createElement('article');
        card.className = 'card';

        const isCreator = currentUser?.id === ev.creatorId;
        const canEdit   = isCreator;
        const canDelete = isCreator || isAdmin;
        if (canEdit || canDelete) card.appendChild(createOptionsMenu(ev.id, { canEdit, canDelete }));

        card.appendChild(await createCreatorHeader(ev));

        const title = document.createElement('h2');
        title.innerText = ev.header || `กิจกรรม ${ev.id}`;
        card.appendChild(title);

        const tag = document.createElement('span');
        tag.innerText = ev.type;
        tag.className = 'event-type-tag';
        card.appendChild(tag);

        if (ev.type === 'Poll') card.appendChild(await renderPoll(ev));
        else if (ev.type === 'Activity') card.appendChild(await renderActivity(ev));
        else card.appendChild(await renderAnnouncement(ev));

        grid.appendChild(card);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('coursesGrid');
    if (grid) {
        grid.innerHTML = Array.from({ length: 3 }, () => `
            <article class="card" style="pointer-events:none">
              <div class="creator-header" style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                <div class="creator-avatar-wrap skeleton" style="background:none;flex-shrink:0"></div>
                <span class="sk-line sk-line--md skeleton" style="height:12px;flex:1;margin:0"></span>
              </div>
              <span class="sk-line sk-line--lg skeleton" style="height:18px;margin-bottom:10px"></span>
              <span class="sk-line skeleton" style="width:72px;height:22px;border-radius:12px;margin-bottom:16px"></span>
              <span class="sk-line sk-line--lg skeleton"></span>
              <span class="sk-line sk-line--md skeleton"></span>
              <span class="sk-line sk-line--sm skeleton" style="margin-bottom:0"></span>
            </article>`).join('');
        [currentUser, window.eventList] = await Promise.all([fetchCurrentUser(), fetchEvents()]);
        if (currentUser?.role === 'admin') {
            document.getElementById('openModalBtn').hidden = false;
        }
        await renderEvents(window.eventList, grid);
    }

    const modal = document.getElementById('postModal');

    const resetForm = () => {
        window.editingEventId = null;
        const title = document.querySelector('.modal-header h2');
        if (title) title.innerText = 'สร้างกิจกรรมใหม่';
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.innerText = 'โพสต์กิจกรรมเลย';
        document.getElementById('createPostForm')?.reset();
        const typeSelect = document.getElementById('typeSelect');
        if (typeSelect) { typeSelect.value = 'Announcement'; typeSelect.dispatchEvent(new Event('change')); }
    };

    document.getElementById('openModalBtn')?.addEventListener('click', () => { resetForm(); modal.style.display = 'flex'; });
    document.getElementById('closeModalBtn')?.addEventListener('click', () => { resetForm(); modal.style.display = 'none'; });
});
