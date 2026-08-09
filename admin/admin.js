import { token as getToken, API_URL } from '/shared/api.js';

const AUDIT_PER_PAGE = 30;
let allAuditLogs = [];
let auditPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return;
    document.body.style.display = 'block';

    setupNavigation();
    loadAdminStats();
    loadWorkerStats();
    loadConfig();
    loadAuditLog();

    document.getElementById('workerStatsDate')?.addEventListener('change', e => loadWorkerStats(e.target.value));
    document.getElementById('saveConfigBtn')?.addEventListener('click', saveConfig);
    document.getElementById('reloadConfigBtn')?.addEventListener('click', loadConfig);
    document.getElementById('refreshLogsBtn')?.addEventListener('click', () => loadServerLogs());
    document.getElementById('autoRefreshBtn')?.addEventListener('click', toggleAutoRefresh);

    // Level pill filter
    document.querySelectorAll('.log-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.log-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            serverLogCursorMap = { 1: null };
            loadServerLogs();
        });
    });

    // Live search (debounced)
    let searchTimer;
    document.getElementById('logSearch')?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => renderServerLogs(), 200);
    });
});

async function checkAdminAccess() {
    if (!getToken()) { window.location.href = '/login/'; return false; }
    try {
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 403) { window.location.href = '/'; return false; }
        if (res.status === 401) { localStorage.removeItem("authToken"); window.location.href = '/login/'; return false; }
        return true;
    } catch {
        window.location.href = '/';
        return false;
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.admin-nav-item[data-section]');
    const sections = document.querySelectorAll('.admin-section');

    function showSection(id) {
        sections.forEach(s => { s.hidden = s.id !== 'section-' + id; });
        navItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-section') === id));
        sessionStorage.setItem('adminSection', id);
        // Load log data on first visit to the logs section
        if (id === 'logs' && allServerLogs.length === 0) loadServerLogs();
        // Stop auto-refresh when leaving logs
        if (id !== 'logs' && autoRefreshInterval) toggleAutoRefresh();
        window.scrollTo({ top: 0 });
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => showSection(item.getAttribute('data-section')));
    });

    const saved = sessionStorage.getItem('adminSection') || 'overview';
    showSection(saved);
}

// ─── OVERVIEW STATS ───────────────────────────────────────────────────────────
async function loadAdminStats() {
    try {
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();

        const s = data.stats;
        document.getElementById('stat-total-users').textContent = s.totalUsers         ?? '0';
        document.getElementById('stat-verified').textContent    = s.verifiedUsers      ?? '0';
        document.getElementById('stat-banned').textContent      = s.bannedUsers        ?? '0';
        document.getElementById('stat-osk').textContent         = s.oskCount           ?? '0';
        document.getElementById('stat-events').textContent      = s.totalEvents        ?? '0';
        document.getElementById('stat-joins').textContent       = s.totalActivityJoins ?? '0';
    } catch {
        ['stat-total-users','stat-verified','stat-banned','stat-osk','stat-events','stat-joins']
            .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'N/A'; });
    }
}

// ─── WORKER STATS ────────────────────────────────────────────────────────────
async function loadWorkerStats(date = null) {
    const wsIds = ['ws-requests', 'ws-errors', 'ws-subrequests'];

    const dateInput = document.getElementById('workerStatsDate');
    if (!date) {
        date = new Date().toISOString().split('T')[0];
        if (dateInput) dateInput.value = date;
    }

    wsIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '...'; });

    try {
        const res = await fetch(`${API_URL}/admin/stats/worker?date=${date}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        document.getElementById('ws-requests').textContent    = data.requests    != null ? data.requests.toLocaleString()    : '—';
        document.getElementById('ws-errors').textContent      = data.errors      != null ? data.errors.toLocaleString()      : '—';
        document.getElementById('ws-subrequests').textContent = data.subrequests != null ? data.subrequests.toLocaleString() : '—';
    } catch (err) {
        console.error('Worker stats error:', err.message);
        wsIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'N/A'; });
    }
}

// ─── SERVER CONFIG ────────────────────────────────────────────────────────────
const TOGGLE_FIELDS = [
    { id: 'cfg-server-close', key: 'SERVER_CLOSE' },
    { id: 'cfg-registration',  key: 'REGISTRATION_OPEN' },
    { id: 'cfg-token-check',   key: 'ENABLE_TOKEN_CHECK' },
    { id: 'cfg-rate-limit',    key: 'RATE_LIMIT_ENABLED' },
    { id: 'cfg-bypass-otp',   key: 'BYPASS_OTP' },
];
const NUMBER_FIELDS = [
    { id: 'cfg-max-reg',        key: 'MAX_REGISTRATIONS' },
    { id: 'cfg-otp-exp',        key: 'OTP_EXPIRES_MINUTES' },
    { id: 'cfg-otp-cooldown',   key: 'OTP_RESEND_COOLDOWN_SECONDS' },
    { id: 'cfg-jwt-days',       key: 'JWT_EXPIRES_DAYS' },
    { id: 'cfg-rl-requests',    key: 'RATE_LIMIT_REQUESTS' },
    { id: 'cfg-rl-window',      key: 'RATE_LIMIT_WINDOW_SECONDS' },
    { id: 'cfg-skdrive-max-dl', key: 'SKDRIVE_MAX_DOWNLOAD_MB' },
    { id: 'cfg-req-limit-day',  key: 'REQUEST_LIMIT_PERDAY' },
];

const CONFIG_LABELS = {
    SERVER_CLOSE:                'Server Close',
    REGISTRATION_OPEN:           'Registration Open',
    ENABLE_TOKEN_CHECK:          'Token Check',
    RATE_LIMIT_ENABLED:          'Rate Limiting',
    BYPASS_OTP:                  'Bypass OTP',
    MAX_REGISTRATIONS:           'Max Registrations',
    OTP_EXPIRES_MINUTES:         'OTP Expiry',
    OTP_RESEND_COOLDOWN_SECONDS: 'OTP Resend Cooldown',
    JWT_EXPIRES_DAYS:            'JWT Expiry',
    RATE_LIMIT_REQUESTS:         'Rate Limit Requests',
    RATE_LIMIT_WINDOW_SECONDS:   'Rate Limit Window',
    SKDRIVE_MAX_DOWNLOAD_MB:     'SKDrive Max Download',
    REQUEST_LIMIT_PERDAY:        'Request Limit Per Day',
};

let lastSavedConfig = {};

async function loadConfig() {
    try {
        const res = await fetch(`${API_URL}/admin/config`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const cfg = data.config || data;

        lastSavedConfig = { ...cfg };

        TOGGLE_FIELDS.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!cfg[key];
        });
        NUMBER_FIELDS.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (el && cfg[key] !== undefined) el.value = cfg[key];
        });
    } catch {
        console.error("Failed to load config");
    }
}

function buildPayload() {
    const payload = {};
    TOGGLE_FIELDS.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) payload[key] = el.checked;
    });
    NUMBER_FIELDS.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) payload[key] = Number(el.value);
    });
    return payload;
}

function buildDiff(payload) {
    return Object.entries(payload).filter(([key, newVal]) => {
        const oldVal = lastSavedConfig[key];
        return oldVal !== undefined && String(oldVal) !== String(newVal);
    }).map(([key, newVal]) => ({
        key,
        label: CONFIG_LABELS[key] || key,
        from: lastSavedConfig[key],
        to: newVal,
    }));
}

function formatVal(key, val) {
    const isToggle = TOGGLE_FIELDS.some(f => f.key === key);
    if (isToggle) return val ? 'ON' : 'OFF';
    const units = {
        OTP_EXPIRES_MINUTES: 'min', OTP_RESEND_COOLDOWN_SECONDS: 's',
        JWT_EXPIRES_DAYS: 'days', RATE_LIMIT_WINDOW_SECONDS: 's',
        SKDRIVE_MAX_DOWNLOAD_MB: 'MB',
        REQUEST_LIMIT_PERDAY:    'req/day',
    };
    return units[key] ? `${val} ${units[key]}` : String(val);
}

function saveConfig() {
    const payload = buildPayload();
    const diff    = buildDiff(payload);

    if (diff.length === 0) {
        const btn = document.getElementById('saveConfigBtn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> No Changes';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes'; }, 1500);
        }
        return;
    }

    const serverCloseOn = diff.some(d => d.key === 'SERVER_CLOSE' && d.to === true);

    const list = document.getElementById('cfgDiffList');
    list.innerHTML = diff.map(d => `
        <li class="cfg-diff-item${d.key === 'SERVER_CLOSE' && d.to ? ' danger' : ''}">
            <span class="cfg-diff-label">${d.label}</span>
            <span class="cfg-diff-arrow">
                <span class="cfg-diff-from">${formatVal(d.key, d.from)}</span>
                <i class="fa-solid fa-arrow-right"></i>
                <span class="cfg-diff-to${d.to === false || d.to === 0 ? ' off' : ' on'}">${formatVal(d.key, d.to)}</span>
            </span>
        </li>`).join('');

    const banner = document.getElementById('cfgDangerBanner');
    const icon   = document.getElementById('cfgModalIcon');
    banner.style.display = serverCloseOn ? 'flex' : 'none';
    icon.className = serverCloseOn ? 'cfg-modal-icon danger' : 'cfg-modal-icon warning';

    const modal = document.getElementById('configConfirmModal');
    modal.style.display = 'flex';

    const confirmBtn = document.getElementById('cfgConfirmBtn');
    const cancelBtn  = document.getElementById('cfgCancelBtn');
    const backdrop   = document.getElementById('cfgModalBackdrop');

    const close = () => { modal.style.display = 'none'; };

    cancelBtn.onclick  = close;
    backdrop.onclick   = close;
    confirmBtn.onclick = () => { close(); applyConfigSave(payload); };
}

async function applyConfigSave(payload) {
    const btn = document.getElementById('saveConfigBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

    try {
        const res = await fetch(`${API_URL}/admin/config`, {
            method:  'PATCH',
            headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            lastSavedConfig = { ...(data.config || payload) };
            if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            setTimeout(() => {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes'; }
            }, 2000);
        } else {
            alert(`❌ ${data.error || 'Save failed'}`);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes'; }
        }
    } catch {
        alert("❌ ไม่สามารถติดต่อเซิร์ฟเวอร์ได้");
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes'; }
    }
}

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
let auditCursorMap = { 1: null };
let auditNextCursor = null;

async function loadAuditLog(cursor = null, targetPage = 1) {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';
    try {
        let url = `${API_URL}/admin/audit?limit=${AUDIT_PER_PAGE}`;
        if (cursor) url += `&cursor=${cursor}`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        if (!res.ok) throw new Error();
        const data = await res.json();

        allAuditLogs = data.logs || [];
        auditNextCursor = data.nextCursor ?? null;
        auditPage = targetPage;
        if (auditNextCursor) auditCursorMap[auditPage + 1] = auditNextCursor;

        renderAuditTable();
    } catch {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">ไม่สามารถโหลด Audit Log ได้</td></tr>';
    }
}

function formatAuditTarget(log) {
    const type = log.target_type;
    const id   = log.target_id ?? '';
    if (!type) return '-';
    if (type === 'user')    return `<a class="audit-detail-link" href="/profile/?id=${id}" target="_blank">User #${id}</a>`;
    if (type === 'event')   return `Event #${id}`;
    if (type === 'config')  return 'Config';
    if (type === 'skdrive') return `<span title="${escapeHtml(id)}">SKDrive</span>`;
    return `${type} #${id}`;
}

function renderAuditTable() {
    const tbody      = document.getElementById('auditTableBody');
    const pagination = document.getElementById('auditPagination');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (allAuditLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">ไม่มีข้อมูล</td></tr>';
    } else {
        allAuditLogs.forEach(log => {
            const actionKey = (log.action || '').split('_')[0];
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.innerHTML = `
                <td class="audit-id-cell">#${log.id ?? '-'}</td>
                <td>${log.created_at ? new Date(log.created_at).toLocaleString('th-TH') : '-'}</td>
                <td>@${log.actor_username ?? log.actor_id ?? '-'}</td>
                <td><span class="audit-action-badge audit-action-${actionKey}">${log.action || '-'}</span></td>
                <td>${formatAuditTarget(log)}</td>
                <td class="audit-view-cell"><i class="fa-solid fa-eye"></i></td>
            `;
            tr.addEventListener('click', () => openAuditDetail(log));
            tbody.appendChild(tr);
        });
    }

    if (!pagination) return;
    const hasPages = auditPage > 1 || auditNextCursor;
    if (!hasPages) { pagination.innerHTML = ''; return; }

    let html = '';
    Object.keys(auditCursorMap).sort((a, b) => a - b).forEach(p => {
        const n = Number(p);
        html += `<button class="page-btn${n === auditPage ? ' active' : ''}" onclick="goAuditPage(${n})">${n}</button>`;
    });
    if (auditNextCursor) {
        html += `<button class="page-btn" onclick="goAuditPage(${auditPage + 1})">›</button>`;
    }
    pagination.innerHTML = html;
}

window.goAuditPage = function(page) {
    loadAuditLog(auditCursorMap[page] ?? null, page);
};

function auditFormatKey(k) {
    return k.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function auditFormatVal(v) {
    if (typeof v === 'boolean') return v ? 'ON' : 'OFF';
    if (v === null || v === '') return '—';
    return String(v);
}

function auditRenderRow(label, value, rawHtml = null) {
    if (rawHtml !== null) return `
        <div class="audit-detail-row">
            <span class="audit-detail-label">${escapeHtml(label)}</span>
            <span class="audit-detail-value">${rawHtml}</span>
        </div>`;
    if (Array.isArray(value)) {
        const chips = value.length
            ? value.map(item => `<span class="audit-detail-chip">${escapeHtml(auditFormatKey(String(item)))}</span>`).join('')
            : '<span class="audit-detail-chip">—</span>';
        return `
        <div class="audit-detail-row audit-detail-row-stack">
            <span class="audit-detail-label">${escapeHtml(label)}</span>
            <div class="audit-detail-chips">${chips}</div>
        </div>`;
    }
    return `
        <div class="audit-detail-row">
            <span class="audit-detail-label">${escapeHtml(label)}</span>
            <span class="audit-detail-value">${escapeHtml(auditFormatVal(value))}</span>
        </div>`;
}

function renderModalTarget(log) {
    const type = log.target_type;
    const id   = log.target_id ?? '';
    if (!type) return auditRenderRow('Target', '-');

    if (type === 'user') {
        const link = id
            ? `<a class="audit-detail-link" href="/profile/?id=${id}" target="_blank">User #${escapeHtml(id)}</a>`
            : 'User';
        return auditRenderRow('Target', null, link);
    }
    if (type === 'config') return auditRenderRow('Target', 'Config');
    if (type === 'event')  return auditRenderRow('Target', `Event #${id}`);
    if (type === 'skdrive') {
        const paths = id.split(',').map(p => p.trim()).filter(Boolean);
        const chips = paths.length
            ? paths.map(p => `<span class="audit-detail-chip audit-detail-chip-path" title="${escapeHtml(p)}">${escapeHtml(p)}</span>`).join('')
            : '<span class="audit-detail-chip">—</span>';
        return `
        <div class="audit-detail-row audit-detail-row-stack">
            <span class="audit-detail-label">Target</span>
            <div class="audit-detail-chips">${chips}</div>
        </div>`;
    }
    return auditRenderRow('Target', `${type} #${id}`);
}

function openAuditDetail(log) {
    const ACTION_LABELS = {
        ban_user:       'Ban User',
        unban_user:     'Unban User',
        delete_user:    'Delete User',
        change_role:    'Change Role',
        delete_event:   'Delete Event',
        config_update:  'Config Update',
        skdrive_upload: 'SKDrive Upload',
        skdrive_delete: 'SKDrive Delete',
    };
    const ACTION_ICONS = {
        ban_user:       'fa-ban',
        unban_user:     'fa-circle-check',
        delete_user:    'fa-user-minus',
        change_role:    'fa-user-gear',
        delete_event:   'fa-calendar-xmark',
        config_update:  'fa-sliders',
        skdrive_upload: 'fa-upload',
        skdrive_delete: 'fa-trash',
    };

    const action    = log.action || '';
    const actionKey = action.split('_')[0];

    const iconEl = document.getElementById('auditModalIcon');
    iconEl.className = `audit-modal-icon audit-action-${actionKey}`;
    iconEl.innerHTML = `<i class="fa-solid ${ACTION_ICONS[action] || 'fa-clock-rotate-left'}"></i>`;

    document.getElementById('auditModalTitle').textContent = ACTION_LABELS[action] || action || '-';
    document.getElementById('auditModalTime').textContent  = log.created_at
        ? new Date(log.created_at).toLocaleString('th-TH') : '-';

    const adminLink = log.actor_id
        ? `<a class="audit-detail-link" href="/profile/?id=${log.actor_id}" target="_blank">@${escapeHtml(log.actor_username ?? String(log.actor_id))}</a>`
        : '—';

    const detailRows = log.detail && typeof log.detail === 'object'
        ? Object.entries(log.detail).map(([k, v]) => [auditFormatKey(k), v])
        : [];

    document.getElementById('auditDetailRows').innerHTML = [
        auditRenderRow('Admin',  null, adminLink),
        renderModalTarget(log),
        ...detailRows.map(([k, v]) => auditRenderRow(k, v)),
    ].join('');

    const modal = document.getElementById('auditDetailModal');
    modal.style.display = 'flex';

    const close = () => { modal.style.display = 'none'; };
    document.getElementById('auditModalBackdrop').onclick = close;
    document.getElementById('auditModalCloseBtn').onclick = close;
}

// ─── SERVER LOG ───────────────────────────────────────────────────────────────
const LOG_PER_PAGE = 50;
let allServerLogs = [];
let serverLogPage = 1;
let serverLogCursorMap = { 1: null };
let serverLogNextCursor = null;
let autoRefreshInterval = null;

function getActiveLogLevel() {
    return document.querySelector('.log-pill.active')?.getAttribute('data-level') || '';
}

function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');
    if (!btn) return;
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        btn.classList.remove('btn-active-refresh');
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Auto';
    } else {
        loadServerLogs();
        autoRefreshInterval = setInterval(() => loadServerLogs(), 10000);
        btn.classList.add('btn-active-refresh');
        btn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Stop (10s)';
    }
}

async function loadServerLogs(cursor = null, targetPage = 1) {
    const terminal = document.getElementById('logTerminal');
    if (!terminal) return;
    terminal.innerHTML = `
        <div class="log-entry log-lv-info">
            <div class="log-entry-main">
                <span class="log-lv-badge">INFO</span>
                <span class="log-entry-msg"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</span>
            </div>
        </div>`;

    const level = getActiveLogLevel();

    try {
        let url = `${API_URL}/admin/server-logs?limit=${LOG_PER_PAGE}`;
        if (cursor) url += `&cursor=${cursor}`;
        if (level)  url += `&level=${level}`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        allServerLogs = data.logs || [];
        serverLogNextCursor = data.nextCursor ?? null;
        serverLogPage = targetPage;
        if (serverLogNextCursor) serverLogCursorMap[serverLogPage + 1] = serverLogNextCursor;

        renderServerLogs();
    } catch (err) {
        terminal.innerHTML = `
            <div class="log-entry log-lv-error">
                <div class="log-entry-main">
                    <span class="log-lv-badge">ERR</span>
                    <span class="log-entry-msg"><i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถโหลด Log ได้: ${escapeHtml(err.message)}</span>
                </div>
            </div>`;
    }
}

function renderServerLogs() {
    const terminal   = document.getElementById('logTerminal');
    const pagination = document.getElementById('logPagination');
    const statsBar   = document.getElementById('logStatsBar');
    if (!terminal) return;

    const searchVal = (document.getElementById('logSearch')?.value || '').toLowerCase().trim();
    const filtered = searchVal
        ? allServerLogs.filter(log =>
            (log.message || '').toLowerCase().includes(searchVal) ||
            JSON.stringify(log.detail || {}).toLowerCase().includes(searchVal))
        : allServerLogs;

    // Update stats bar
    if (statsBar) {
        const counts = { error: 0, warning: 0, info: 0, success: 0 };
        filtered.forEach(l => { const lv = (l.level || 'info').toLowerCase(); if (lv in counts) counts[lv]++; });
        statsBar.innerHTML = `
            <span class="lsb-total"><i class="fa-solid fa-list"></i> ${filtered.length} entries</span>
            ${counts.error   ? `<span class="lsb-error"><i class="fa-solid fa-circle-xmark"></i> ${counts.error} error</span>` : ''}
            ${counts.warning ? `<span class="lsb-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${counts.warning} warn</span>` : ''}
            ${counts.info    ? `<span class="lsb-info"><i class="fa-solid fa-circle-info"></i> ${counts.info} info</span>` : ''}
        `;
    }

    terminal.innerHTML = '';

    if (filtered.length === 0) {
        terminal.innerHTML = '<div class="log-empty">ไม่พบ Log ที่ตรงเงื่อนไข</div>';
    } else {
        filtered.forEach(log => {
            const level     = (log.level || 'info').toLowerCase();
            const time      = log.created_at ? new Date(log.created_at).toLocaleString('th-TH') : '';
            const msg       = log.message || '-';
            const hasDetail = log.detail && Object.keys(log.detail).length > 0;

            const row = document.createElement('div');
            row.className = `log-entry log-lv-${level}`;
            row.innerHTML = `
                <div class="log-entry-main">
                    <span class="log-lv-badge">${level.toUpperCase()}</span>
                    <span class="log-entry-time">${escapeHtml(time)}</span>
                    <span class="log-entry-msg">${escapeHtml(msg)}</span>
                    ${hasDetail ? '<span class="log-entry-toggle">▶</span>' : '<span class="log-entry-toggle-ph"></span>'}
                </div>
                ${hasDetail ? `<div class="log-entry-body" hidden><pre class="log-entry-pre">${escapeHtml(JSON.stringify(log.detail, null, 2))}</pre></div>` : ''}
            `;

            if (hasDetail) {
                const main   = row.querySelector('.log-entry-main');
                const body   = row.querySelector('.log-entry-body');
                const toggle = row.querySelector('.log-entry-toggle');
                main.style.cursor = 'pointer';
                main.addEventListener('click', () => {
                    const open   = !body.hidden;
                    body.hidden  = open;
                    toggle.textContent = open ? '▶' : '▼';
                    row.classList.toggle('log-entry-open', !open);
                });
            }

            terminal.appendChild(row);
        });
    }

    if (!pagination) return;
    const hasPages = serverLogPage > 1 || serverLogNextCursor;
    if (!hasPages) { pagination.innerHTML = ''; return; }

    let html = '';
    Object.keys(serverLogCursorMap).sort((a, b) => a - b).forEach(p => {
        const n = Number(p);
        html += `<button class="page-btn${n === serverLogPage ? ' active' : ''}" onclick="goLogPage(${n})">${n}</button>`;
    });
    if (serverLogNextCursor) {
        html += `<button class="page-btn" onclick="goLogPage(${serverLogPage + 1})">›</button>`;
    }
    pagination.innerHTML = html;
}

window.goLogPage = function(page) {
    loadServerLogs(serverLogCursorMap[page] ?? null, page);
};

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderPagination(totalPages, current, fnName, container) {
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn${i === current ? ' active' : ''}" onclick="${fnName}(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}
