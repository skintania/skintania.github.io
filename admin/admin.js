import { CONFIG } from '/config.js';

const AUDIT_PER_PAGE = 30;
let allAuditLogs = [];
let auditPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return;
    document.body.style.display = 'block';

    setupNavigation();
    loadAdminStats();
    loadConfig();
    loadAuditLog();
    loadServerLogs();

    document.getElementById('saveConfigBtn')?.addEventListener('click', saveConfig);
    document.getElementById('reloadConfigBtn')?.addEventListener('click', loadConfig);
    document.getElementById('refreshLogsBtn')?.addEventListener('click', () => loadServerLogs());
    document.getElementById('logLevelFilter')?.addEventListener('change', () => loadServerLogs());
});

async function checkAdminAccess() {
    const token = localStorage.getItem("authToken");
    if (!token) { window.location.href = '/login/'; return false; }
    try {
        const res = await fetch(`${CONFIG.API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
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

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const id = 'section-' + item.getAttribute('data-section');
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(s => {
            if (pageYOffset >= s.offsetTop - s.clientHeight / 3)
                current = s.id.replace('section-', '');
        });
        navItems.forEach(n => n.classList.toggle('active', n.getAttribute('data-section') === current));
    });

    window.dispatchEvent(new Event('scroll'));
}

// ─── OVERVIEW STATS ───────────────────────────────────────────────────────────
async function loadAdminStats() {
    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${CONFIG.API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();

        const s = data.stats;
        document.getElementById('stat-total-users').textContent = s.totalUsers         ?? '0';
        document.getElementById('stat-verified').textContent    = s.verifiedUsers      ?? '0';
        document.getElementById('stat-banned').textContent      = s.bannedUsers        ?? '0';
        document.getElementById('stat-osk').textContent         = s.oskCount          ?? '0';
        document.getElementById('stat-events').textContent      = s.totalEvents        ?? '0';
        document.getElementById('stat-joins').textContent       = s.totalActivityJoins ?? '0';
    } catch {
        ['stat-total-users','stat-verified','stat-banned','stat-osk','stat-events','stat-joins']
            .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'N/A'; });
    }
}

// ─── SERVER CONFIG ────────────────────────────────────────────────────────────
const TOGGLE_FIELDS = [
    { id: 'cfg-server-close', key: 'SERVER_CLOSE' },
    { id: 'cfg-registration',  key: 'REGISTRATION_OPEN' },
    { id: 'cfg-token-check',   key: 'ENABLE_TOKEN_CHECK' },
    { id: 'cfg-rate-limit',    key: 'RATE_LIMIT_ENABLED' },
];
const NUMBER_FIELDS = [
    { id: 'cfg-max-reg',        key: 'MAX_REGISTRATIONS' },
    { id: 'cfg-otp-exp',        key: 'OTP_EXPIRES_MINUTES' },
    { id: 'cfg-otp-cooldown',   key: 'OTP_RESEND_COOLDOWN_SECONDS' },
    { id: 'cfg-jwt-days',       key: 'JWT_EXPIRES_DAYS' },
    { id: 'cfg-rl-requests',    key: 'RATE_LIMIT_REQUESTS' },
    { id: 'cfg-rl-window',      key: 'RATE_LIMIT_WINDOW_SECONDS' },
    { id: 'cfg-skdrive-max-dl', key: 'SKDRIVE_MAX_DOWNLOAD_MB' },
];

async function loadConfig() {
    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${CONFIG.API_URL}/admin/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const cfg = data.config || data;

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

async function saveConfig() {
    const btn = document.getElementById('saveConfigBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

    const payload = {};
    TOGGLE_FIELDS.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) payload[key] = el.checked;
    });
    NUMBER_FIELDS.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) payload[key] = Number(el.value);
    });

    try {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${CONFIG.API_URL}/admin/config`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
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
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';
    try {
        const token = localStorage.getItem("authToken");
        let url = `${CONFIG.API_URL}/admin/audit?limit=${AUDIT_PER_PAGE}`;
        if (cursor) url += `&cursor=${cursor}`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error();
        const data = await res.json();

        allAuditLogs = data.logs || [];
        auditNextCursor = data.nextCursor ?? null;
        auditPage = targetPage;
        if (auditNextCursor) auditCursorMap[auditPage + 1] = auditNextCursor;

        renderAuditTable();
    } catch {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="table-empty">ไม่สามารถโหลด Audit Log ได้</td></tr>';
    }
}

function renderAuditTable() {
    const tbody      = document.getElementById('auditTableBody');
    const pagination = document.getElementById('auditPagination');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (allAuditLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty">ไม่มีข้อมูล</td></tr>';
    } else {
        allAuditLogs.forEach(log => {
            const detail = log.detail ? JSON.stringify(log.detail) : '-';
            const target = log.target_type ? `${log.target_type} #${log.target_id ?? ''}` : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.created_at ? new Date(log.created_at).toLocaleString('th-TH') : '-'}</td>
                <td>Admin #${log.actor_id ?? '-'}</td>
                <td>${log.action || '-'}</td>
                <td>${target}</td>
                <td class="audit-detail">${detail}</td>
            `;
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

// ─── SERVER LOG ───────────────────────────────────────────────────────────────
const LOG_PER_PAGE = 50;
let allServerLogs = [];
let serverLogPage = 1;
let serverLogCursorMap = { 1: null };
let serverLogNextCursor = null;

async function loadServerLogs(cursor = null, targetPage = 1) {
    const terminal = document.getElementById('logTerminal');
    if (!terminal) return;
    terminal.innerHTML = '<div class="log-line info"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    const level = document.getElementById('logLevelFilter')?.value || '';

    try {
        const token = localStorage.getItem("authToken");
        let url = `${CONFIG.API_URL}/admin/logs?limit=${LOG_PER_PAGE}`;
        if (cursor) url += `&cursor=${cursor}`;
        if (level)  url += `&level=${level}`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        allServerLogs = data.logs || [];
        serverLogNextCursor = data.nextCursor ?? null;
        serverLogPage = targetPage;
        if (serverLogNextCursor) serverLogCursorMap[serverLogPage + 1] = serverLogNextCursor;

        renderServerLogs();
    } catch (err) {
        terminal.innerHTML = `<div class="log-line error"><i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถโหลด Log ได้: ${err.message}</div>`;
    }
}

function renderServerLogs() {
    const terminal   = document.getElementById('logTerminal');
    const pagination = document.getElementById('logPagination');
    if (!terminal) return;

    terminal.innerHTML = '';

    if (allServerLogs.length === 0) {
        terminal.innerHTML = '<div class="log-line info">ไม่มี Log ในช่วงเวลานี้</div>';
    } else {
        allServerLogs.forEach(log => {
            const level = (log.level || 'info').toLowerCase();
            const time  = log.created_at ? new Date(log.created_at).toLocaleString('th-TH') : '';
            const ip    = log.ip ? ` [${log.ip}]` : '';
            const msg   = log.message || '-';

            const div = document.createElement('div');
            div.className = `log-line ${level === 'warn' ? 'warning' : level}`;
            div.innerHTML = `<span class="log-time">${time}${ip}</span> <span class="log-level">${level.toUpperCase()}</span> ${escapeHtml(msg)}`;
            terminal.appendChild(div);
        });
        terminal.scrollTop = terminal.scrollHeight;
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

// ─── SHARED PAGINATION ────────────────────────────────────────────────────────
function renderPagination(totalPages, current, fnName, container) {
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn${i === current ? ' active' : ''}" onclick="${fnName}(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}
