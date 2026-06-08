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
    a.href = `/profile/?id=${ev.creatorId}`;
    a.className = 'creator-header';
    a.title = `ดูโปรไฟล์ @${username}`;

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
    const editBtn   = canEdit   ? `<button class="edit-post-btn"   data-id="${id}">✏️ แก้ไข</button>` : '';
    const deleteBtn = canDelete ? `<button class="delete-post-btn" data-id="${id}" style="color:#ef4444">🗑️ ลบ</button>` : '';
    wrapper.innerHTML = `
        <button class="menu-dot-btn">⋮</button>
        <div class="menu-dropdown-content">${editBtn}${deleteBtn}</div>
    `;
    const dot  = wrapper.querySelector('.menu-dot-btn');
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
    const rawVote = ev.userVote;
    let votedId = null;
    if (rawVote != null) {
        const vid = typeof rawVote === 'object' ? rawVote.choiceId : rawVote;
        votedId = vid != null ? String(vid) : null;
    }

    const container = document.createElement('div');
    container.className = 'ev-poll';

    const refs = [];

    for (const choice of choices) {
        const row = document.createElement('div');
        row.className = 'ev-poll-choice';

        if (choice.imgLink) {
            const img = document.createElement('img');
            img.src = await loadImageWithAuth(choice.imgLink) ?? '';
            img.className = 'ev-poll-choice-img';
            row.appendChild(img);
        }

        const top = document.createElement('div');
        top.className = 'ev-poll-choice-top';

        const label = document.createElement('span');
        label.className = 'ev-poll-choice-text';
        label.textContent = choice.choiceText;

        const voteText = document.createElement('span');
        voteText.className = 'ev-poll-choice-count';

        top.appendChild(label);
        top.appendChild(voteText);

        const barOuter = document.createElement('div');
        barOuter.className = 'ev-poll-bar-track';
        const bar = document.createElement('div');
        bar.className = 'ev-poll-bar-fill';
        barOuter.appendChild(bar);

        row.appendChild(top);
        row.appendChild(barOuter);

        refs.push({ choice: { ...choice, voteCount: choice.voteCount ?? 0 }, voteText, bar, row });
        container.appendChild(row);
    }

    function updateUI() {
        const total = refs.reduce((s, r) => s + r.choice.voteCount, 0);
        for (const r of refs) {
            const pct = total > 0 ? r.choice.voteCount / total * 100 : 0;
            r.voteText.textContent = `${r.choice.voteCount} โหวต (${pct.toFixed(0)}%)`;
            r.bar.style.width = `${pct}%`;
            // eslint-disable-next-line eqeqeq
            r.row.classList.toggle('voted', votedId != null && r.choice.id == votedId);
        }
    }

    updateUI();

    for (const ref of refs) {
        ref.row.addEventListener('click', async () => {
            const isVoted = votedId != null && String(ref.choice.id) === votedId;
            const prevRef = refs.find(r => String(r.choice.id) === votedId);

            if (isVoted) {
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
    container.className = 'ev-activity';

    if (ev.imgLink) {
        const img = document.createElement('img');
        img.src = await loadImageWithAuth(ev.imgLink) ?? '';
        img.className = 'ev-activity-img';
        container.appendChild(img);
    }

    if (ev.description) {
        const desc = document.createElement('p');
        desc.className = 'ev-activity-desc';
        desc.textContent = ev.description;
        container.appendChild(desc);
    }

    let count = ev.participantCount ?? 0;
    let joined = ev.isJoined ?? false;

    const footer = document.createElement('div');
    footer.className = 'ev-activity-footer';

    const partText = document.createElement('span');
    partText.className = 'ev-participant-count';
    partText.textContent = `👥 ผู้เข้าร่วม: ${count} คน`;

    const joinBtn = document.createElement('button');
    joinBtn.className = `ev-join-btn${joined ? ' joined' : ''}`;
    joinBtn.textContent = joined ? '✓ เข้าร่วมแล้ว' : 'เข้าร่วม';

    joinBtn.addEventListener('click', async () => {
        joined = !joined;
        count += joined ? 1 : -1;
        joinBtn.className = `ev-join-btn${joined ? ' joined' : ''}`;
        joinBtn.textContent = joined ? '✓ เข้าร่วมแล้ว' : 'เข้าร่วม';
        partText.textContent = `👥 ผู้เข้าร่วม: ${count} คน`;
        try {
            const res = await apiFetch(`/events/${ev.id}/join`, { method: 'POST' });
            const result = await res.json();
            if (result.isJoined !== undefined) {
                joined = result.isJoined;
                joinBtn.className = `ev-join-btn${joined ? ' joined' : ''}`;
                joinBtn.textContent = joined ? '✓ เข้าร่วมแล้ว' : 'เข้าร่วม';
            }
            if (result.participantCount !== undefined) {
                count = result.participantCount;
                partText.textContent = `👥 ผู้เข้าร่วม: ${count} คน`;
            }
        } catch { /* silent */ }
    });

    footer.appendChild(partText);
    footer.appendChild(joinBtn);
    container.appendChild(footer);
    return container;
}

async function renderAnnouncement(ev) {
    const container = document.createElement('div');
    container.className = 'ev-announcement';

    if (ev.imgLink) {
        const img = document.createElement('img');
        img.src = await loadImageWithAuth(ev.imgLink) ?? '';
        img.className = 'ev-announcement-img';
        container.appendChild(img);
    }

    if (ev.description) {
        const p = document.createElement('p');
        p.className = 'ev-announcement-text';
        p.textContent = ev.description;
        container.appendChild(p);
    }

    return container;
}

async function renderEvents(events, feed) {
    feed.innerHTML = '';
    if (!events.length) {
        feed.innerHTML = '<p class="ev-empty">ยังไม่มีกิจกรรมในขณะนี้</p>';
        return;
    }

    const isAdmin = currentUser?.role === 'admin';
    const typeMap = { Poll: 'poll', Activity: 'activity', Announcement: 'announcement' };
    const typeLabel = { Poll: '📊 โพล', Activity: '🏃 กิจกรรม', Announcement: '📢 ประกาศ' };

    for (const ev of events) {
        const card = document.createElement('article');
        card.className = 'ev-card';

        const isCreator = currentUser?.id === ev.creatorId;
        const canEdit   = isCreator;
        const canDelete = isCreator || isAdmin;
        if (canEdit || canDelete) card.appendChild(createOptionsMenu(ev.id, { canEdit, canDelete }));

        card.appendChild(await createCreatorHeader(ev));

        const badge = document.createElement('span');
        badge.className = `ev-badge ev-badge--${typeMap[ev.type] ?? 'announcement'}`;
        badge.textContent = typeLabel[ev.type] ?? ev.type;
        card.appendChild(badge);

        const title = document.createElement('h2');
        title.className = 'ev-card-title';
        title.textContent = ev.header || `กิจกรรม ${ev.id}`;
        card.appendChild(title);

        if (ev.type === 'Poll')          card.appendChild(await renderPoll(ev));
        else if (ev.type === 'Activity') card.appendChild(await renderActivity(ev));
        else                             card.appendChild(await renderAnnouncement(ev));

        feed.appendChild(card);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const feed = document.getElementById('evFeed');
    if (feed) {
        feed.innerHTML = Array.from({ length: 3 }, () => `
            <article class="ev-card" style="pointer-events:none">
              <div class="creator-header" style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div class="creator-avatar-wrap skeleton" style="background:none;flex-shrink:0"></div>
                <span class="sk-line sk-line--md skeleton" style="height:11px;flex:1;margin:0"></span>
              </div>
              <span class="sk-line skeleton" style="width:68px;height:20px;border-radius:10px;margin-bottom:10px"></span>
              <span class="sk-line sk-line--lg skeleton" style="height:17px;margin-bottom:14px"></span>
              <span class="sk-line sk-line--lg skeleton"></span>
              <span class="sk-line sk-line--md skeleton"></span>
              <span class="sk-line sk-line--sm skeleton" style="margin-bottom:0"></span>
            </article>`).join('');

        [currentUser, window.eventList] = await Promise.all([fetchCurrentUser(), fetchEvents()]);
        if (currentUser?.role === 'admin') {
            document.getElementById('openModalBtn').hidden = false;
        }
        await renderEvents(window.eventList, feed);
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
