import { apiFetch, token, API_URL } from '/shared/api.js';

const params   = new URLSearchParams(location.search);
const courseId = params.get('id');

let currentCourse  = null;
let currentUser    = null;
let exercises      = [];
let activeFilename = null;
let _pdfJsLoading  = null;
let _exPdfReady    = Promise.resolve();

// ── Helpers ───────────────────────────────────────────────
const encFile = f => encodeURIComponent(f);
const esc     = s => (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
}

function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!_pdfJsLoading) {
    _pdfJsLoading = new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return _pdfJsLoading;
}


async function fetchPdfBlob(path) {
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

// ── Avatar loader (auth-required, cached) ─────────────────
const _avatarCache = {};
async function loadAvatar(userId) {
  if (userId in _avatarCache) return _avatarCache[userId];
  _avatarCache[userId] = null;
  try {
    const res = await fetch(`${API_URL}/users/${userId}/avatar`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) _avatarCache[userId] = URL.createObjectURL(await res.blob());
  } catch { /* no avatar */ }
  return _avatarCache[userId];
}

// ── Solution PDF Modal ────────────────────────────────────
function initSolModal() {
  const modal    = document.getElementById('solPdfModal');
  const backdrop = modal.querySelector('.sol-modal-backdrop');
  const closeBtn = document.getElementById('solModalClose');

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    const pc = document.getElementById('solModalPdfContent');
    const ov = document.getElementById('solModalCmtOverlay');
    const ft = document.getElementById('solModalFooter');
    if (pc) pc.innerHTML = '';
    if (ov) ov.innerHTML = '';
    if (ft) ft.innerHTML = '';
  };
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
}

async function openSolPdf(sol, filename) {
  try {
    const modal      = document.getElementById('solPdfModal');
    const nameEl     = document.getElementById('solModalName');
    const dateEl     = document.getElementById('solModalDate');
    const extBtn     = document.getElementById('solModalExtBtn');
    const dlBtn      = document.getElementById('solModalDlBtn');
    const avatarWrap = document.getElementById('solModalAvatarWrap');
    const pdfContent = document.getElementById('solModalPdfContent');
    const overlay    = document.getElementById('solModalCmtOverlay');
    const footer     = document.getElementById('solModalFooter');

    if (!modal || !nameEl || !dateEl || !extBtn || !dlBtn || !avatarWrap || !pdfContent || !overlay || !footer) {
      console.error('solPdfModal: missing DOM elements');
      return;
    }

    const name = [sol.firstname, sol.lastname].filter(Boolean).join(' ') || sol.username || '?';
    nameEl.textContent = name;
    dateEl.textContent = sol.created_at ? fmtDate(sol.created_at) : '';

    avatarWrap.innerHTML = `<div class="sol-avatar sol-avatar-fb">${(name[0] || '?').toUpperCase()}</div>`;
    loadAvatar(sol.user_id).then(url => {
      if (!url) return;
      const img = document.createElement('img');
      img.className = 'sol-avatar'; img.alt = ''; img.src = url;
      avatarWrap.innerHTML = '';
      avatarWrap.appendChild(img);
    });

    // Direct iframe — streams immediately without JS buffering
    const solPdfSrc = `${API_URL}/courses/${courseId}/exercises/${encFile(filename)}/solutions/${sol.id}/pdf?token=${token()}`;
    pdfContent.innerHTML = `<iframe class="sol-modal-iframe" src="${solPdfSrc}#toolbar=0"></iframe>`;
    overlay.innerHTML = '';
    footer.innerHTML = '';

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    extBtn.onclick = () => window.open(solPdfSrc, '_blank');

    const dlIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    dlBtn.disabled = false;
    dlBtn.innerHTML = `${dlIcon} ดาวน์โหลด`;
    dlBtn.onclick = async () => {
      const orig = dlBtn.innerHTML;
      dlBtn.disabled = true; dlBtn.textContent = '...';
      const blobUrl = await fetchPdfBlob(`/courses/${courseId}/exercises/${encFile(filename)}/solutions/${sol.id}/pdf`);
      if (blobUrl) { const a = document.createElement('a'); a.href = blobUrl; a.download = `sol_${sol.id}.pdf`; a.click(); }
      dlBtn.disabled = false; dlBtn.innerHTML = orig;
    };

    await loadModalComments(sol.id, sol.user_id, filename, overlay, footer);
  } catch (err) {
    console.error('openSolPdf error:', err);
    document.body.style.overflow = '';
  }
}

async function loadModalComments(solId, solOwnerId, filename, overlayDiv, footerDiv) {
  const isAdmin    = currentUser?.role === 'admin';
  const myUsername = currentUser?.username;
  const isSolOwner = String(currentUser?.id) === String(solOwnerId);
  const data = await apiFetch(`/courses/${courseId}/exercises/${encFile(filename)}/solutions/${solId}/comments`);
  overlayDiv.innerHTML = '';
  const comments = data.success ? (data.comments || []) : [];
  if (!comments.length) {
    overlayDiv.innerHTML = '<p class="sol-overlay-hint">ยังไม่มีความคิดเห็น<br>เขียนด้านล่างได้เลย</p>';
  } else {
    comments.forEach(c => overlayDiv.appendChild(buildOverlayCard(c, solId, filename, overlayDiv, isAdmin, myUsername, isSolOwner)));
  }
  buildFooterForm(solId, filename, footerDiv, overlayDiv, isAdmin, myUsername, isSolOwner);
}

function buildOverlayCard(c, solId, filename, overlayDiv, isAdmin, myUsername, isSolOwner) {
  const canDel     = isAdmin || isSolOwner || c.username === myUsername;
  const canResolve = isSolOwner && c.is_wrong; // solution owner clears wrong-flag comments
  const displayName = [c.firstname, c.lastname].filter(Boolean).join(' ') || c.username;
  let badges = '';
  if (c.is_wrong)    badges += '<span class="cmt-badge cmt-wrong">⚠ Incorrect</span>';
  if (c.page_number) badges += `<span class="cmt-badge cmt-page">หน้า ${c.page_number}</span>`;
  const el = document.createElement('div');
  el.className = 'sol-overlay-card';
  el.innerHTML = `
    <div class="sol-overlay-meta">
      <span class="cmt-author">${esc(displayName)}</span>
      <div class="sol-overlay-btns">
        ${canResolve ? '<button class="sol-resolve-btn">✓ แก้แล้ว</button>' : ''}
        ${canDel     ? '<button class="cmt-del">✕</button>' : ''}
      </div>
    </div>
    ${badges ? `<div class="cmt-badges">${badges}</div>` : ''}
    <p class="sol-overlay-content">${esc(c.content)}</p>
  `;
  const doDelete = async (btn) => {
    btn.disabled = true;
    const r = await apiFetch(`/courses/${courseId}/exercises/${encFile(filename)}/solutions/${solId}/comments/${c.id}`, 'DELETE');
    if (r.success) el.remove(); else { btn.disabled = false; alert(r.error || 'เกิดข้อผิดพลาด'); }
  };
  if (canResolve) el.querySelector('.sol-resolve-btn').addEventListener('click', function() { doDelete(this); });
  if (canDel)     el.querySelector('.cmt-del').addEventListener('click', function() { doDelete(this); });
  return el;
}

function buildFooterForm(solId, filename, footerDiv, overlayDiv, isAdmin, myUsername, isSolOwner) {
  const form = document.createElement('div');
  form.className = 'sol-footer-form';
  form.innerHTML = `
    <textarea class="cmt-input sol-footer-textarea" placeholder="เขียนความคิดเห็น..." rows="2"></textarea>
    <div class="cmt-form-opts">
      <label class="cmt-opt-label">หน้า <input class="cmt-page-in" type="number" min="1" placeholder="—"></label>
      <label class="cmt-opt-label"><input class="cmt-wrong-in" type="checkbox"> ไม่ถูกต้อง</label>
      <button class="cmt-submit">ส่ง</button>
    </div>
  `;
  form.querySelector('.cmt-submit').addEventListener('click', async function() {
    const content = form.querySelector('.cmt-input').value.trim();
    if (!content) return;
    this.disabled = true; this.textContent = '...';
    const page  = parseInt(form.querySelector('.cmt-page-in').value) || null;
    const wrong = form.querySelector('.cmt-wrong-in').checked;
    const body  = { content, ...(page && { page_number: page }), ...(wrong && { is_wrong: true }) };
    const r = await apiFetch(`/courses/${courseId}/exercises/${encFile(filename)}/solutions/${solId}/comments`, 'POST', body);
    if (r.success) {
      const hint = overlayDiv.querySelector('.sol-overlay-hint');
      if (hint) hint.remove();
      const newComment = {
        id: r.id, content, page_number: page, is_wrong: wrong ? 1 : 0,
        username: currentUser?.username, firstname: currentUser?.firstname,
        lastname: currentUser?.lastname, created_at: new Date().toISOString(),
      };
      overlayDiv.appendChild(buildOverlayCard(newComment, solId, filename, overlayDiv, isAdmin, myUsername, isSolOwner));
      overlayDiv.scrollTop = overlayDiv.scrollHeight;
      form.querySelector('.cmt-input').value = '';
      form.querySelector('.cmt-page-in').value = '';
      form.querySelector('.cmt-wrong-in').checked = false;
    } else alert(r.error || 'เกิดข้อผิดพลาด');
    this.disabled = false; this.textContent = 'ส่ง';
  });
  footerDiv.appendChild(form);
}

// ── Exercise Sidebar ──────────────────────────────────────
function buildSidebar() {
  const list = document.getElementById('exList');
  list.innerHTML = '';

  if (!exercises.length) {
    list.innerHTML = '<li class="ps-empty">ยังไม่มีแบบฝึกหัด</li>';
    return;
  }

  const isAdmin = currentUser?.role === 'admin';

  exercises.forEach(ex => {
    const li = document.createElement('li');
    li.className = 'ps-item ex-file-item';
    li.dataset.filename = ex.filename;
    li.innerHTML = `
      <div class="ps-item-inner">
        <span class="ps-item-name">📄 ${esc(ex.name)}</span>
      </div>
      <div class="ex-file-meta">
        <span class="ex-file-size">${fmtSize(ex.size)}</span>
        <span class="ex-file-date">${fmtDate(ex.uploaded)}</span>
      </div>
    `;
    li.addEventListener('click', () => loadExercise(ex));

    if (isAdmin) {
      const adminRow = document.createElement('div');
      adminRow.className = 'ex-admin-row';
      adminRow.innerHTML = `
        <button class="ex-clear-btn">✓ ล้าง Incorrect</button>
        <button class="ex-del-btn">ลบ</button>
      `;
      adminRow.querySelector('.ex-del-btn').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`ลบแบบฝึกหัด "${ex.name}"?`)) return;
        const r = await apiFetch(`/courses/${courseId}/exercises/${encFile(ex.filename)}`, 'DELETE');
        if (r.success) {
          exercises = exercises.filter(x => x.filename !== ex.filename);
          buildSidebar();
          if (activeFilename === ex.filename) clearMainPanel();
        } else alert(r.error || 'เกิดข้อผิดพลาด');
      });
      adminRow.querySelector('.ex-clear-btn').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('ล้าง Incorrect flags ทั้งหมดในแบบฝึกหัดนี้?')) return;
        const r = await apiFetch(`/courses/${courseId}/exercises/${encFile(ex.filename)}?solved=true`, 'DELETE');
        if (r.success) {
          if (activeFilename === ex.filename) loadSolutions(ex.filename);
        } else alert(r.error || 'เกิดข้อผิดพลาด');
      });
      li.appendChild(adminRow);
    }

    list.appendChild(li);
  });
}

// ── Admin: upload exercise PDF ────────────────────────────
function initUploadBtn() {
  const btn = document.getElementById('uploadExBtn');
  if (!btn) return;
  if (currentUser?.role !== 'admin') return;
  btn.hidden = false;
  btn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/pdf';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      btn.textContent = 'กำลังอัปโหลด...'; btn.disabled = true;
      try {
        const res = await fetch(`${API_URL}/courses/${courseId}/exercises/${encFile(file.name)}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/pdf' },
          body: file,
        });
        const data = await res.json();
        if (data.success) {
          const exRes = await apiFetch(`/courses/${courseId}/exercises`);
          exercises = exRes.exercises || [];
          buildSidebar();
        } else alert(data.error || 'เกิดข้อผิดพลาด');
      } catch { alert('อัปโหลดไม่สำเร็จ'); }
      btn.textContent = '+ อัปโหลด PDF'; btn.disabled = false;
    };
    input.click();
  });
}

// ── Load exercise into main panel ─────────────────────────
async function loadExercise(ex) {
  activeFilename = ex.filename;

  document.querySelectorAll('.ex-file-item').forEach(li => li.classList.remove('active'));
  const active = document.querySelector(`.ex-file-item[data-filename="${CSS.escape(ex.filename)}"]`);
  if (active) active.classList.add('active');

  document.getElementById('qsEmpty').hidden = true;
  document.getElementById('exPanel').hidden = false;
  document.getElementById('exPanelTitle').textContent = ex.name;
  document.getElementById('exPanelMeta').textContent = `${fmtSize(ex.size)} · อัปโหลด ${fmtDate(ex.uploaded)}`;

  const pdfWrap = document.getElementById('exPdfWrap');
  const extIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  pdfWrap.innerHTML = `
    <div class="ex-pdf-bar">
      <span class="ex-pdf-bar-name">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.5;vertical-align:-2px;margin-right:5px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${esc(ex.name)}
      </span>
      <button class="ex-pdf-bar-ext">${extIcon} เปิดหน้าต่างใหม่</button>
      <button class="ex-pdf-bar-dl" disabled>กำลังโหลด...</button>
    </div>
    <div class="ex-pdf-frame-wrap">
      <div class="pdf-loading"><div class="pdf-spinner"></div><span>กำลังโหลด PDF...</span></div>
    </div>
  `;
  const frameWrap = pdfWrap.querySelector('.ex-pdf-frame-wrap');
  const extBtn    = pdfWrap.querySelector('.ex-pdf-bar-ext');
  const dlBtn     = pdfWrap.querySelector('.ex-pdf-bar-dl');

  // Direct iframe — no blob buffering, browser streams the PDF natively
  _exPdfReady = Promise.resolve(); // thumbnails can load freely
  const dlIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  const pdfSrc = `${API_URL}/courses/${courseId}/exercises/${encFile(ex.filename)}/pdf?token=${token()}`;
  frameWrap.innerHTML = `<iframe class="ex-pdf-iframe" src="${pdfSrc}#toolbar=0" title="${esc(ex.name)}"></iframe>`;
  extBtn.addEventListener('click', () => window.open(pdfSrc, '_blank'));
  dlBtn.innerHTML = `${dlIcon} ดาวน์โหลด`;
  dlBtn.disabled = false;
  dlBtn.addEventListener('click', async () => {
    const orig = dlBtn.innerHTML;
    dlBtn.disabled = true; dlBtn.textContent = '...';
    const blobUrl = await fetchPdfBlob(`/courses/${courseId}/exercises/${encFile(ex.filename)}/pdf`);
    if (blobUrl) { const a = document.createElement('a'); a.href = blobUrl; a.download = ex.filename; a.click(); }
    dlBtn.disabled = false; dlBtn.innerHTML = orig;
  });

  loadSolutions(ex.filename);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearMainPanel() {
  activeFilename = null;
  document.getElementById('exPanel').hidden = true;
  document.getElementById('qsEmpty').hidden = false;
}

// ── Solutions ─────────────────────────────────────────────
async function loadSolutions(filename) {
  const container = document.getElementById('solutionsContainer');
  const uploadRow = document.getElementById('solutionUploadRow');

  // Always show upload button immediately — don't wait for fetch
  uploadRow.innerHTML = '';
  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'btn sol-upload-btn';
  uploadBtn.textContent = '+ อัปโหลดเฉลยของฉัน';
  uploadBtn.addEventListener('click', () => handleUploadSolution(filename, uploadBtn));
  uploadRow.appendChild(uploadBtn);

  container.innerHTML = '<div class="sol-loading"><div class="pdf-spinner"></div> กำลังโหลด...</div>';

  const data = await apiFetch(`/courses/${courseId}/exercises/${encFile(filename)}/solutions`);
  if (!data.success) { container.innerHTML = '<p class="ps-empty">โหลดไม่สำเร็จ</p>'; return; }

  const solutions = data.solutions || [];
  const userId    = currentUser?.id;
  const isAdmin   = currentUser?.role === 'admin';
  const mySol     = solutions.find(s => String(s.user_id) === String(userId));

  // Update upload button now that we know if user has a solution
  if (mySol) {
    uploadBtn.textContent = '🔄 แก้ไขเฉลยของฉัน';
    const delBtn = document.createElement('button');
    delBtn.className = 'sol-del-own-btn';
    delBtn.textContent = 'ลบเฉลยของฉัน';
    delBtn.addEventListener('click', async () => {
      if (!confirm('ลบเฉลยของคุณ?')) return;
      const r = await apiFetch(`/courses/${courseId}/exercises/${encFile(filename)}/solutions`, 'DELETE');
      if (r.success) loadSolutions(filename);
      else alert(r.error || 'เกิดข้อผิดพลาด');
    });
    uploadRow.appendChild(delBtn);
  }

  container.innerHTML = '';
  if (!solutions.length) {
    container.innerHTML = '<p class="ps-empty sol-empty">ยังไม่มีเฉลย — เป็นคนแรกที่อัปโหลด!</p>';
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);
      const solId = entry.target.id.replace('sol-', '');
      const thumb = entry.target.querySelector('.sol-thumb');
      if (thumb) loadSolThumbnail(solId, filename, thumb);
    });
  }, { threshold: 0.1 });

  solutions.forEach(sol => {
    const card = buildSolutionCard(sol, filename, userId, isAdmin);
    container.appendChild(card);
    observer.observe(card);
  });
}

async function handleUploadSolution(filename, btn) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/pdf';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const orig = btn.innerHTML;
    btn.textContent = 'กำลังอัปโหลด...'; btn.disabled = true;
    try {
      const res = await fetch(
        `${API_URL}/courses/${courseId}/exercises/${encFile(filename)}/solutions?filename=${encodeURIComponent(file.name)}`,
        { method:'PUT', headers:{ Authorization:`Bearer ${token()}`, 'Content-Type':'application/pdf' }, body:file }
      );
      const data = await res.json();
      if (data.success) loadSolutions(filename);
      else alert(data.error || 'เกิดข้อผิดพลาด');
    } catch { alert('อัปโหลดไม่สำเร็จ'); }
    btn.innerHTML = orig; btn.disabled = false;
  };
  input.click();
}

function buildSolutionCard(sol, filename, userId, isAdmin) {
  const isOwn   = String(sol.user_id) === String(userId);
  const name    = [sol.firstname, sol.lastname].filter(Boolean).join(' ') || sol.username;
  const initials = (name[0] || '?').toUpperCase();
  const voted   = sol.voted ?? false;

  const card = document.createElement('div');
  card.className = 'sol-card';
  card.id = `sol-${sol.id}`;

  card.innerHTML = `
    <div class="sol-vote-col">
      <button class="sol-vote-btn${voted ? ' voted' : ''}" ${isOwn ? 'disabled title="ไม่สามารถโหวตเฉลยตัวเองได้"' : ''}>
        <svg width="14" height="14" viewBox="0 0 10 10" fill="currentColor"><path d="M5 1 L9 8 L1 8 Z"/></svg>
      </button>
      <span class="sol-vote-count">${sol.votes}</span>
    </div>
    <button class="sol-thumb" title="ดู PDF เฉลย">
      <div class="sol-thumb-ph">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span class="sol-thumb-label">PDF</span>
      </div>
    </button>
    <div class="sol-card-body">
      <div class="sol-card-top">
        <a class="sol-meta sol-meta-link" href="/profile/?id=${sol.user_id}">
          <div class="sol-avatar sol-avatar-fb" data-av="${sol.user_id}">${initials}</div>
          <div>
            <div class="sol-name">${esc(name)}</div>
            <div class="sol-date">${fmtDate(sol.created_at)}</div>
          </div>
        </a>
        <div class="sol-right-actions">
          <button class="sol-view-btn">ดู PDF + ความคิดเห็น</button>
          ${isAdmin && !isOwn ? '<button class="sol-del-btn btn-danger">ลบ</button>' : ''}
        </div>
      </div>
    </div>
  `;

  // Async-load real avatar (auth-required endpoint → blob URL)
  loadAvatar(sol.user_id).then(url => {
    if (!url) return;
    const fb = card.querySelector(`[data-av="${sol.user_id}"]`);
    if (!fb) return;
    const img = document.createElement('img');
    img.className = 'sol-avatar'; img.alt = ''; img.src = url;
    fb.replaceWith(img);
  });

  const voteBtn = card.querySelector('.sol-vote-btn');
  voteBtn.addEventListener('click', async function() {
    this.disabled = true;
    const r = await apiFetch(`/courses/${courseId}/exercises/${encFile(filename)}/solutions/${sol.id}/vote`, 'POST');
    if (r.success) {
      sol.votes = r.votes; sol.voted = r.voted;
      this.className = `sol-vote-btn${r.voted ? ' voted' : ''}`;
      card.querySelector('.sol-vote-count').textContent = r.votes;
    }
    if (!isOwn) this.disabled = false;
  });

  card.querySelector('.sol-thumb').addEventListener('click', () => openSolPdf(sol, filename));

  const viewBtn = card.querySelector('.sol-view-btn');
  viewBtn.addEventListener('click', () => openSolPdf(sol, filename));

  const delBtn = card.querySelector('.sol-del-btn');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('ลบเฉลยนี้?')) return;
      const r = await apiFetch(`/courses/${courseId}/exercises/${encFile(filename)}/solutions/${sol.id}`, 'DELETE');
      if (r.success) card.remove(); else alert(r.error || 'เกิดข้อผิดพลาด');
    });
  }

  return card;
}

async function loadSolThumbnail(solId, filename, thumbBtn) {
  try {
    await _exPdfReady; // wait until exercise PDF is done before competing for bandwidth
    const pdfjs = await ensurePdfJs();
    if (!pdfjs) return;

    const res = await fetch(
      `${API_URL}/courses/${courseId}/exercises/${encFile(filename)}/solutions/${solId}/pdf`,
      { headers: { Authorization: `Bearer ${token()}` } }
    );
    if (!res.ok) return;

    const pdf  = await pdfjs.getDocument({ data: await res.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);
    const vp   = page.getViewport({ scale: 0.2 });

    const canvas = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

    const img = document.createElement('img');
    img.src       = canvas.toDataURL('image/jpeg', 0.88);
    img.className = 'sol-thumb-img';
    img.alt       = '';

    thumbBtn.innerHTML = '';
    thumbBtn.appendChild(img);
  } catch { /* thumbnail fails silently */ }
}

// ── Comments ──────────────────────────────────────────────
async function loadComments(solId, filename, wrap) {
  const data = await apiFetch(`/courses/${courseId}/exercises/${encFile(filename)}/solutions/${solId}/comments`);
  wrap.innerHTML = '';

  const isAdmin = currentUser?.role === 'admin';
  const myUsername = currentUser?.username;

  const list = document.createElement('div');
  list.className = 'cmt-list';

  if (data.success && data.comments?.length) {
    data.comments.forEach(c => list.appendChild(buildCommentEl(c, solId, filename, isAdmin, myUsername)));
  } else {
    list.innerHTML = '<p class="cmt-empty">ยังไม่มีความคิดเห็น</p>';
  }

  wrap.appendChild(list);
  wrap.appendChild(buildCommentForm(solId, filename, list, isAdmin, myUsername));
}

function buildCommentEl(c, solId, filename, isAdmin, myUsername) {
  const canDel = isAdmin || c.username === myUsername;
  const displayName = [c.firstname, c.lastname].filter(Boolean).join(' ') || c.username;

  const el = document.createElement('div');
  el.className = 'cmt-item';

  let badges = '';
  if (c.is_wrong)    badges += '<span class="cmt-badge cmt-wrong">⚠ Incorrect</span>';
  if (c.page_number) badges += `<span class="cmt-badge cmt-page">หน้า ${c.page_number}</span>`;

  el.innerHTML = `
    <div class="cmt-header">
      <span class="cmt-author">${esc(displayName)}</span>
      <span class="cmt-date">${fmtDate(c.created_at)}</span>
      ${canDel ? '<button class="cmt-del" aria-label="ลบ">✕</button>' : ''}
    </div>
    ${badges ? `<div class="cmt-badges">${badges}</div>` : ''}
    <p class="cmt-content">${esc(c.content)}</p>
  `;

  if (canDel) {
    el.querySelector('.cmt-del').addEventListener('click', async () => {
      const r = await apiFetch(
        `/courses/${courseId}/exercises/${encFile(filename)}/solutions/${solId}/comments/${c.id}`, 'DELETE'
      );
      if (r.success) el.remove(); else alert(r.error || 'เกิดข้อผิดพลาด');
    });
  }

  return el;
}

function buildCommentForm(solId, filename, list, isAdmin, myUsername) {
  const form = document.createElement('div');
  form.className = 'cmt-form';
  form.innerHTML = `
    <textarea class="cmt-input" placeholder="เขียนความคิดเห็น..." rows="2"></textarea>
    <div class="cmt-form-opts">
      <label class="cmt-opt-label">หน้า <input class="cmt-page-in" type="number" min="1" placeholder="—"></label>
      <label class="cmt-opt-label"><input class="cmt-wrong-in" type="checkbox"> ไม่ถูกต้อง</label>
      <button class="cmt-submit">ส่ง</button>
    </div>
  `;

  form.querySelector('.cmt-submit').addEventListener('click', async function() {
    const content = form.querySelector('.cmt-input').value.trim();
    if (!content) return;
    this.disabled = true; this.textContent = '...';

    const page  = parseInt(form.querySelector('.cmt-page-in').value) || null;
    const wrong = form.querySelector('.cmt-wrong-in').checked;
    const body  = { content, ...(page && { page_number: page }), ...(wrong && { is_wrong: true }) };

    const r = await apiFetch(
      `/courses/${courseId}/exercises/${encFile(filename)}/solutions/${solId}/comments`, 'POST', body
    );

    if (r.success) {
      const empty = list.querySelector('.cmt-empty');
      if (empty) empty.remove();
      // API returns { id } only — reconstruct comment from current user data
      const newComment = {
        id: r.id,
        content,
        page_number: page,
        is_wrong: wrong ? 1 : 0,
        username:   currentUser?.username,
        firstname:  currentUser?.firstname,
        lastname:   currentUser?.lastname,
        profile_url: currentUser?.profile_url ?? null,
        created_at: new Date().toISOString(),
      };
      list.appendChild(buildCommentEl(newComment, solId, filename, isAdmin, myUsername));
      form.querySelector('.cmt-input').value = '';
      form.querySelector('.cmt-page-in').value = '';
      form.querySelector('.cmt-wrong-in').checked = false;
    } else alert(r.error || 'เกิดข้อผิดพลาด');

    this.disabled = false; this.textContent = 'ส่ง';
  });

  return form;
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  if (!courseId) { window.location.href = '/Course/'; return; }

  const [courseRes, meRes, exRes] = await Promise.all([
    apiFetch(`/courses/${courseId}`),
    apiFetch('/auth/me'),
    apiFetch(`/courses/${courseId}/exercises`),
  ]);

  if (!courseRes.success) { window.location.href = '/Course/'; return; }

  currentCourse = courseRes.course;
  if (meRes.success) currentUser = meRes.user ?? null;
  exercises = exRes.exercises || [];

  document.title = `${currentCourse.title} — Skintania`;
  const header = document.querySelector('site-header');
  if (header) {
    header.setAttribute('page-title', currentCourse.title);
    header.setAttribute('page-desc', 'แบบฝึกหัด');
  }

  document.getElementById('sidebarCourseName').textContent = currentCourse.title;
  document.getElementById('sidebarCourseSub').textContent  = `${exercises.length} ชุดโจทย์`;

  const manageLink = document.getElementById('manageExerciseLink');
  if (manageLink && currentUser?.role === 'admin') {
    manageLink.href   = `/Course/exercise/manage/?id=${courseId}`;
    manageLink.hidden = false;
  }

  initSolModal();
  initUploadBtn();
  buildSidebar();
  if (exercises.length) loadExercise(exercises[0]);
}

document.addEventListener('DOMContentLoaded', init);
