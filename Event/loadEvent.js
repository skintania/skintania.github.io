import { CONFIG } from '/config.js';

const getToken = () => localStorage.getItem('authToken') || '';

async function apiFetch(path, options = {}) {
    return fetch(`${CONFIG.API_URL}${path}`, {
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
        return result.event ?? null;
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

function createOptionsMenu(id) {
    const wrapper = document.createElement('div');
    wrapper.className = 'post-options-menu';
    wrapper.innerHTML = `
        <button class="menu-dot-btn">⋮</button>
        <div class="menu-dropdown-content">
            <button class="edit-post-btn" data-id="${id}">✏️ แก้ไข</button>
            <button class="delete-post-btn" data-id="${id}" style="color:#ef4444">🗑️ ลบ</button>
        </div>
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
    const totalVotes = choices.reduce((s, c) => s + (c.voteCount ?? 0), 0);
    let votedId = ev.userVote ?? null;

    const container = document.createElement('div');
    container.style.cssText = 'margin-top:15px;display:flex;flex-direction:column;gap:15px;';

    for (const choice of choices) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:15px;';

        if (choice.imgLink) {
            const img = document.createElement('img');
            img.src = await loadImageWithAuth(choice.imgLink) ?? '';
            img.style.cssText = 'width:200px;max-height:300px;border-radius:8px;object-fit:contain;flex-shrink:0;background:rgba(0,0,0,.1);';
            row.appendChild(img);
        }

        const pct = totalVotes > 0 ? (choice.voteCount ?? 0) / totalVotes * 100 : 0;
        const content = document.createElement('div');
        content.style.flexGrow = '1';
        content.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <strong>${choice.choiceText}</strong>
                <span class="vote-text" style="color:#60a5fa">${choice.voteCount ?? 0} โหวต (${pct.toFixed(0)}%)</span>
            </div>
            <div style="height:20px;background:rgba(255,255,255,.1);border-radius:10px;overflow:hidden;">
                <div class="progress-bar" style="width:${pct}%;height:100%;background:linear-gradient(90deg,#3b82f6,#60a5fa);transition:width .3s ease;"></div>
            </div>
        `;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'width:20px;height:20px;cursor:pointer;flex-shrink:0;';
        checkbox.checked = choice.id === votedId;

        checkbox.addEventListener('change', async e => {
            if (!e.target.checked) { e.target.checked = true; return; } // no unvote
            container.querySelectorAll('input[type=checkbox]').forEach(cb => { if (cb !== e.target) cb.checked = false; });
            votedId = choice.id;
            try {
                await apiFetch(`/events/${ev.id}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ choiceId: choice.id }),
                });
            } catch { /* silent */ }
        });

        row.appendChild(content);
        row.appendChild(checkbox);
        container.appendChild(row);
    }
    return container;
}

async function renderActivity(ev) {
    const container = document.createElement('div');
    container.style.cssText = 'margin-top:15px;display:flex;align-items:center;gap:15px;';

    if (ev.imgLink) {
        const img = document.createElement('img');
        img.src = await loadImageWithAuth(ev.imgLink) ?? '';
        img.style.cssText = 'max-height:300px;width:30%;border-radius:10px;object-fit:cover;background:#222;flex-shrink:0;';
        container.appendChild(img);
    }

    let count = ev.participantCount ?? 0;
    let joined = ev.isJoined ?? false;

    const textDiv = document.createElement('div');
    textDiv.style.flexGrow = '1';
    textDiv.innerHTML = `
        <p style="margin:0 0 5px">${ev.description || ''}</p>
        <div class="participant-count" style="font-size:13px;color:#10b981">👥 ผู้เข้าร่วม: ${count} คน</div>
    `;

    const joinBox = document.createElement('div');
    joinBox.style.textAlign = 'center';
    joinBox.innerHTML = `
        <input type="checkbox" id="chk-${ev.id}" style="width:20px;height:20px;cursor:pointer;display:block;margin:0 auto;">
        <label for="chk-${ev.id}" style="font-size:12px;cursor:pointer;color:#94a3b8;">เข้าร่วม</label>
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
        } catch { /* silent */ }
    });

    container.appendChild(textDiv);
    container.appendChild(joinBox);
    return container;
}

async function renderAnnouncement(ev) {
    const container = document.createElement('div');
    container.style.marginTop = '15px';
    if (ev.imgLink) {
        const img = document.createElement('img');
        img.src = await loadImageWithAuth(ev.imgLink) ?? '';
        img.style.cssText = 'width:100%;max-height:250px;border-radius:8px;object-fit:cover;margin-bottom:10px;background:#222;';
        container.appendChild(img);
    }
    if (ev.description) {
        const p = document.createElement('p');
        p.style.lineHeight = '1.5';
        p.innerText = ev.description;
        container.appendChild(p);
    }
    return container;
}

async function renderEvents(events, grid) {
    grid.innerHTML = '';
    if (!events.length) {
        grid.innerHTML = '<p style="color:#94a3b8;text-align:center;grid-column:1/-1">ยังไม่มีกิจกรรมในขณะนี้</p>';
        return;
    }

    for (const ev of events) {
        const card = document.createElement('article');
        card.className = 'card';
        card.style.position = 'relative';

        if (ev.canManage) card.appendChild(createOptionsMenu(ev.id));

        const title = document.createElement('h2');
        title.innerText = ev.header || `กิจกรรม ${ev.id}`;
        card.appendChild(title);

        const tag = document.createElement('span');
        tag.innerText = ev.type;
        tag.style.cssText = 'font-size:12px;padding:2px 8px;border-radius:4px;background:rgba(59,130,246,.2);color:#3b82f6;';
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
        const events = await fetchEvents();
        window.eventList = events;
        await renderEvents(events, grid);
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
