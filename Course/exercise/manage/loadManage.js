import { apiFetch, token, API_URL } from '/shared/api.js';
import { renderLatexText } from '/shared/latex.js';

const params   = new URLSearchParams(location.search);
const courseId = params.get('id');

let exercises   = [];
let problemSets = [];
let editingId   = null;
let editingPsId = null;

const TYPE_ICONS = { multiple_choice: '🔘', fill_blank: '✏️', free_response: '📝' };

function wireLatexPreview(inputId, renderId) {
  const input  = document.getElementById(inputId);
  const render = document.getElementById(renderId);
  if (!input || !render) return;
  input.addEventListener('input', () => renderLatexText(input.value, render));
}

// ── Choices ───────────────────────────────────────────────
let choiceSeq = 0;

function addChoiceRow(text = '') {
  const seq  = choiceSeq++;
  const list = document.getElementById('choicesList');
  const idx  = list.querySelectorAll('.choice-row').length;

  const row = document.createElement('div');
  row.className   = 'choice-row';
  row.dataset.seq = seq;

  const letter = String.fromCharCode(65 + idx);
  row.innerHTML = `
    <div class="choice-row-header">
      <span class="choice-index-badge">${letter}</span>
      <input class="form-input choice-text-input font-mono" type="text"
        placeholder="LaTeX เช่น $a = 6\\ \\text{ms}^{-2}$ หรือข้อความปกติ" data-choice-text>
      <button type="button" class="choice-remove-btn" title="ลบ">✕</button>
    </div>
    <div class="choice-preview" data-preview></div>
  `;

  const textInput = row.querySelector('[data-choice-text]');
  const preview   = row.querySelector('[data-preview]');

  textInput.value = text;
  if (text) renderLatexText(text, preview);
  textInput.addEventListener('input', () => renderLatexText(textInput.value, preview));

  row.querySelector('.choice-remove-btn').addEventListener('click', () => {
    row.remove();
    reindexChoices();
    rebuildAnswerRadios();
  });

  list.appendChild(row);
  rebuildAnswerRadios();
  reindexChoices();
}

function reindexChoices() {
  document.querySelectorAll('.choice-row').forEach((row, i) => {
    const badge = row.querySelector('.choice-index-badge');
    if (badge) badge.textContent = String.fromCharCode(65 + i);
  });
}

function rebuildAnswerRadios(selectedIndex = null) {
  const container = document.getElementById('answerRadios');
  const rows      = document.querySelectorAll('.choice-row');
  const prevVal   = selectedIndex !== null
    ? String(selectedIndex)
    : document.querySelector('input[name="answerRadio"]:checked')?.value;

  container.innerHTML = '';
  rows.forEach((row, i) => {
    const text  = row.querySelector('[data-choice-text]')?.value || `ตัวเลือก ${i + 1}`;
    const label = document.createElement('label');
    label.className = 'answer-radio-label';

    const radio = document.createElement('input');
    radio.type  = 'radio';
    radio.name  = 'answerRadio';
    radio.value = String(i);
    if (prevVal === String(i)) radio.checked = true;

    label.appendChild(radio);
    label.appendChild(document.createTextNode(` ${String.fromCharCode(65 + i)}. ${text.slice(0, 60)}`));
    container.appendChild(label);

    row.querySelector('[data-choice-text]').addEventListener('input', e => {
      const node = label.childNodes[1];
      if (node) node.textContent = ` ${String.fromCharCode(65 + i)}. ${e.target.value.slice(0, 60)}`;
    });
  });
}

function getChoices() {
  return Array.from(document.querySelectorAll('.choice-row'))
    .map(row => row.querySelector('[data-choice-text]').value.trim());
}

// ── Image upload ──────────────────────────────────────────
function showImgPreview(src) {
  const preview     = document.getElementById('imgPreview');
  const placeholder = document.getElementById('imgPlaceholder');
  const removeBtn   = document.getElementById('imgRemoveBtn');
  preview.src       = src;
  preview.hidden    = false;
  placeholder.hidden = true;
  removeBtn.hidden  = false;
}

function clearImgPreview() {
  const preview     = document.getElementById('imgPreview');
  const placeholder = document.getElementById('imgPlaceholder');
  const removeBtn   = document.getElementById('imgRemoveBtn');
  preview.src       = '';
  preview.hidden    = true;
  placeholder.hidden = false;
  removeBtn.hidden  = true;
}

async function handleImageUpload(file) {
  if (!editingId) return;
  if (file.size > 5 * 1024 * 1024) { showImgError('ไฟล์ต้องไม่เกิน 5 MB'); return; }

  const btn = document.getElementById('imgUploadBtn');
  btn.disabled = true; btn.textContent = 'กำลังอัปโหลด...';
  hideImgError();

  const res = await fetch(`${API_URL}/courses/${courseId}/exercises/${editingId}/image`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': file.type, 'Content-Length': file.size },
    body: file,
  });
  const data = await res.json();

  btn.disabled = false; btn.textContent = 'อัปโหลด';

  if (!data.success) { showImgError(data.error || 'อัปโหลดไม่สำเร็จ'); return; }

  const url = URL.createObjectURL(file);
  showImgPreview(url);
  await Promise.all([loadProblemSets(), loadExercises()]);
}

async function handleImageRemove() {
  if (!editingId) return;
  if (!confirm('ลบรูปภาพออกจากโจทย์นี้?')) return;

  const btn = document.getElementById('imgRemoveBtn');
  btn.disabled = true; btn.textContent = 'กำลังลบ...';

  const res  = await fetch(`${API_URL}/courses/${courseId}/exercises/${editingId}/image`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
  });
  const data = await res.json();

  btn.disabled = false; btn.textContent = 'ลบรูป';

  if (!data.success) { showImgError(data.error || 'ลบไม่สำเร็จ'); return; }
  clearImgPreview();
  await Promise.all([loadProblemSets(), loadExercises()]);
}

function showImgError(msg) {
  const el = document.getElementById('imgError');
  el.textContent = msg; el.hidden = false;
}
function hideImgError() {
  document.getElementById('imgError').hidden = true;
}

// ── Type change ───────────────────────────────────────────
function onTypeChange() {
  const type = document.getElementById('fType').value;
  document.getElementById('choicesSection').hidden    = type !== 'multiple_choice';
  document.getElementById('fillAnswerSection').hidden = type !== 'fill_blank';

  if (type === 'multiple_choice' && document.querySelectorAll('.choice-row').length === 0) {
    addChoiceRow(); addChoiceRow(); addChoiceRow(); addChoiceRow();
  }
}

// ── Problem Set Dropdown ──────────────────────────────────
function populatePsDropdown(selectedId = null) {
  const sel = document.getElementById('fProblemSet');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- เลือกชุดโจทย์ --</option>';
  problemSets.forEach(ps => {
    const opt = document.createElement('option');
    opt.value = ps.id;
    opt.textContent = ps.title;
    if (selectedId !== null ? ps.id === selectedId : String(ps.id) === cur) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Problem Set List ──────────────────────────────────────
function renderPsList() {
  const list = document.getElementById('psList');
  list.innerHTML = '';

  if (!problemSets.length) {
    const li = document.createElement('li');
    li.className   = 'ps-empty-hint';
    li.textContent = 'ยังไม่มีชุดโจทย์ กด "+ เพิ่ม"';
    list.appendChild(li);
    return;
  }

  problemSets.forEach(ps => {
    const li = document.createElement('li');
    li.className = 'manage-ps-item';
    li.innerHTML = `
      <div class="manage-ps-info">
        <span class="manage-ps-title">${ps.title}</span>
        ${ps.author ? `<span class="manage-ps-author">${ps.author}</span>` : ''}
      </div>
      <span class="manage-ps-count">${ps.exercise_count} ข้อ</span>
      <div class="manage-item-actions">
        <button class="manage-item-btn" data-action="edit"   title="แก้ไข">✏️</button>
        <button class="manage-item-btn del" data-action="delete" title="ลบ">🗑️</button>
      </div>
    `;
    li.querySelector('[data-action="edit"]').addEventListener('click',   e => { e.stopPropagation(); openPsModal(ps); });
    li.querySelector('[data-action="delete"]').addEventListener('click', e => { e.stopPropagation(); deleteProblemSet(ps.id, ps.title); });
    list.appendChild(li);
  });
}

// ── Problem Set Modal ─────────────────────────────────────
function openPsModal(ps = null) {
  editingPsId = ps?.id ?? null;
  document.getElementById('psModalTitle').textContent  = ps ? `แก้ไข: ${ps.title}` : 'เพิ่มชุดโจทย์';
  document.getElementById('psTitle').value     = ps?.title       ?? '';
  document.getElementById('psDesc').value      = ps?.description ?? '';
  document.getElementById('psAuthor').value    = ps?.author      ?? '';
  document.getElementById('psSortOrder').value = ps?.sort_order  ?? problemSets.length;
  document.getElementById('psError').hidden    = true;
  document.getElementById('psSubmit').disabled    = false;
  document.getElementById('psSubmit').textContent = 'บันทึก';
  document.getElementById('psModal').hidden = false;
}

function closePsModal() {
  document.getElementById('psModal').hidden = true;
  editingPsId = null;
}

async function saveProblemSet(e) {
  e.preventDefault();
  const title     = document.getElementById('psTitle').value.trim();
  const desc      = document.getElementById('psDesc').value.trim();
  const author    = document.getElementById('psAuthor').value.trim();
  const sortOrder = parseInt(document.getElementById('psSortOrder').value) || 0;
  if (!title) return;

  const submitBtn = document.getElementById('psSubmit');
  submitBtn.disabled    = true;
  submitBtn.textContent = 'กำลังบันทึก...';
  document.getElementById('psError').hidden = true;

  const isEdit = editingPsId !== null;
  const path   = isEdit
    ? `/courses/${courseId}/problem-sets/${editingPsId}`
    : `/courses/${courseId}/problem-sets`;
  const method = isEdit ? 'PATCH' : 'POST';
  const data   = await apiFetch(path, method, {
    title,
    ...(desc   && { description: desc }),
    ...(author && { author }),
    sort_order: sortOrder,
  });

  if (!data.success) {
    const errEl = document.getElementById('psError');
    errEl.textContent = data.error || 'เกิดข้อผิดพลาด';
    errEl.hidden = false;
    submitBtn.disabled    = false;
    submitBtn.textContent = 'บันทึก';
    return;
  }

  closePsModal();
  await loadProblemSets();
  renderList();
}

async function deleteProblemSet(id, title) {
  if (!confirm(`ลบชุดโจทย์ "${title}"?\nโจทย์ทั้งหมดในชุดนี้จะถูกลบด้วย`)) return;
  await apiFetch(`/courses/${courseId}/problem-sets/${id}`, 'DELETE');
  await Promise.all([loadProblemSets(), loadExercises()]);
}

// ── Open exercise form ────────────────────────────────────
function openForm(ex = null) {
  editingId = ex?.id ?? null;
  const isEdit = editingId !== null;

  document.getElementById('formEmptyState').hidden = true;
  document.getElementById('manageForm').hidden     = false;
  document.getElementById('formSectionHeader').textContent = isEdit
    ? `แก้ไข: ${ex.title}`
    : 'สร้างข้อใหม่';

  populatePsDropdown(ex?.problem_set_id ?? null);
  document.getElementById('fTitle').value     = ex?.title      ?? '';
  document.getElementById('fSortOrder').value = ex?.sort_order ?? exercises.length;
  document.getElementById('fType').value      = ex?.type       ?? 'multiple_choice';
  document.getElementById('fQuestion').value  = ex?.question   ?? '';
  document.getElementById('fSolution').value  = ex?.solution   ?? '';
  document.getElementById('fFillAnswer').value = '';

  document.getElementById('fillAnswerHint').textContent = isEdit ? 'เว้นว่างไว้เพื่อคงเฉลยเดิม' : '';
  document.getElementById('fillAnswerReq').hidden       = isEdit;
  document.getElementById('answerHint').textContent     = isEdit ? 'ไม่เลือกหมายถึงคงเฉลยเดิม' : '';

  document.getElementById('choicesList').innerHTML  = '';
  document.getElementById('answerRadios').innerHTML = '';
  choiceSeq = 0;

  if (ex?.type === 'multiple_choice' && ex.choices?.length) {
    ex.choices.forEach(c => {
      const text = typeof c === 'string' ? c : (c.text ?? '');
      addChoiceRow(text);
    });
  } else if (!isEdit) {
    addChoiceRow(); addChoiceRow(); addChoiceRow(); addChoiceRow();
  }

  renderLatexText(ex?.question ?? '', document.getElementById('renderQuestion'));
  renderLatexText(ex?.solution ?? '', document.getElementById('renderSolution'));

  onTypeChange();

  clearImgPreview();
  if (ex?.image_key) {
    fetch(`${API_URL}/assets/${ex.image_key}`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.ok ? r.blob() : null)
      .then(blob => { if (blob) showImgPreview(URL.createObjectURL(blob)); })
      .catch(() => {});
  }

  document.getElementById('formError').hidden    = true;
  document.getElementById('saveBtn').disabled    = false;
  document.getElementById('saveBtn').textContent = 'บันทึก';

  document.querySelectorAll('.manage-list-item').forEach(li => li.classList.remove('active'));
  if (isEdit) {
    const li = document.querySelector(`.manage-list-item[data-id="${ex.id}"]`);
    if (li) li.classList.add('active');
  }

  document.getElementById('formPanel').scrollTop = 0;
}

function closeForm() {
  document.getElementById('formEmptyState').hidden = false;
  document.getElementById('manageForm').hidden     = true;
  document.querySelectorAll('.manage-list-item').forEach(li => li.classList.remove('active'));
  editingId = null;
}

// ── Save exercise ─────────────────────────────────────────
async function saveExercise(e) {
  e.preventDefault();

  const type      = document.getElementById('fType').value;
  const title     = document.getElementById('fTitle').value.trim();
  const question  = document.getElementById('fQuestion').value.trim();
  const solution  = document.getElementById('fSolution').value.trim() || undefined;
  const sortOrder = parseInt(document.getElementById('fSortOrder').value) || 0;
  const psId      = parseInt(document.getElementById('fProblemSet').value) || null;
  const isEdit    = editingId !== null;

  document.getElementById('formError').hidden = true;
  const saveBtn = document.getElementById('saveBtn');

  if (!isEdit && !psId) { showError('กรุณาเลือกชุดโจทย์'); return; }

  const payload = { title, type, question, sort_order: sortOrder };
  if (!isEdit && psId) payload.problem_set_id = psId;
  if (solution)        payload.solution        = solution;

  if (type === 'multiple_choice') {
    const choices     = getChoices();
    const emptyIdx    = choices.findIndex(c => !c);
    if (choices.length < 2) { showError('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ'); return; }
    if (emptyIdx !== -1)    { showError(`ตัวเลือก ${String.fromCharCode(65 + emptyIdx)} ยังไม่มีข้อความ`); return; }
    const radio = document.querySelector('input[name="answerRadio"]:checked');
    if (!isEdit && !radio) { showError('กรุณาเลือกเฉลยที่ถูกต้อง'); return; }
    payload.choices = choices;
    if (radio) payload.answer = radio.value;

  } else if (type === 'fill_blank') {
    const answer = document.getElementById('fFillAnswer').value.trim();
    if (!isEdit && !answer) { showError('กรุณาระบุคำตอบสำหรับข้อเติมคำ'); return; }
    if (answer) payload.answer = answer;
  }

  saveBtn.disabled    = true;
  saveBtn.textContent = 'กำลังบันทึก...';

  const path   = isEdit
    ? `/courses/${courseId}/exercises/${editingId}`
    : `/courses/${courseId}/exercises`;
  const method = isEdit ? 'PATCH' : 'POST';
  const data   = await apiFetch(path, method, payload);

  if (!data.success) {
    showError(data.error || 'เกิดข้อผิดพลาด');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'บันทึก';
    return;
  }

  await Promise.all([loadProblemSets(), loadExercises()]);
  closeForm();
}

function showError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.hidden = false;
}

// ── Delete exercise ───────────────────────────────────────
async function deleteExercise(id, title) {
  if (!confirm(`ลบข้อ "${title}" ออกจากคอร์ส?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
  await apiFetch(`/courses/${courseId}/exercises/${id}`, 'DELETE');
  if (editingId === id) closeForm();
  await Promise.all([loadProblemSets(), loadExercises()]);
}

// ── Render exercise list ──────────────────────────────────
function renderList() {
  const list  = document.getElementById('manageList');
  const count = document.getElementById('exerciseCount');
  list.innerHTML    = '';
  count.textContent = `${exercises.length} ข้อ`;

  if (!exercises.length) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:20px;text-align:center;font-size:.85rem;color:var(--muted)';
    li.textContent = 'ยังไม่มีข้อ กด "+ เพิ่มข้อใหม่"';
    list.appendChild(li);
    return;
  }

  const psById = {};
  problemSets.forEach(ps => { psById[ps.id] = ps; });
  let lastPsId = undefined;

  exercises.forEach((ex, i) => {
    if (ex.problem_set_id !== lastPsId) {
      lastPsId = ex.problem_set_id;
      const ps = psById[ex.problem_set_id];
      if (ps) {
        const header = document.createElement('li');
        header.className = 'manage-ps-group-header';
        header.textContent = ps.title;
        list.appendChild(header);
      }
    }

    const li      = document.createElement('li');
    li.className  = 'manage-list-item';
    li.dataset.id = ex.id;
    li.innerHTML = `
      <span class="manage-item-num">${i + 1}</span>
      <span class="manage-item-icon">${TYPE_ICONS[ex.type] ?? '❓'}</span>
      <span class="manage-item-title">${ex.title}</span>
      <div class="manage-item-actions">
        <button class="manage-item-btn"     data-action="edit"   title="แก้ไข">✏️</button>
        <button class="manage-item-btn del" data-action="delete" title="ลบ">🗑️</button>
      </div>
    `;
    li.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'delete') { e.stopPropagation(); deleteExercise(ex.id, ex.title); return; }
      openForm(ex);
    });
    list.appendChild(li);
  });
}

// ── Load data ─────────────────────────────────────────────
async function loadProblemSets() {
  const data = await apiFetch(`/courses/${courseId}/problem-sets`);
  problemSets = data.problemSets || [];
  renderPsList();
  populatePsDropdown(null);
}

async function loadExercises() {
  const data = await apiFetch(`/courses/${courseId}/exercises`);
  exercises  = data.exercises || [];
  renderList();
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  if (!courseId) { window.location.href = '/Course/'; return; }

  const me = await apiFetch('/auth/me');
  if (!me.success || me.user?.role !== 'admin') {
    window.location.href = `/Course/exercise/?id=${courseId}`;
    return;
  }

  document.getElementById('backLink').href = `/Course/exercise/?id=${courseId}`;

  const courseRes = await apiFetch(`/courses/${courseId}`);
  if (!courseRes.success) {
    document.querySelector('site-header')?.setAttribute('page-desc', 'ไม่พบคอร์ส');
    return;
  }

  const course = courseRes.course;
  document.title = `จัดการ — ${course.title} — Skintania`;
  const header = document.querySelector('site-header');
  if (header) {
    header.setAttribute('page-title', `จัดการ: ${course.title}`);
    header.setAttribute('page-desc', 'แบบฝึกหัด · Admin');
  }

  await Promise.all([loadProblemSets(), loadExercises()]);

  document.getElementById('addExerciseBtn').addEventListener('click', () => openForm(null));
  document.getElementById('cancelFormBtn').addEventListener('click', closeForm);
  document.getElementById('manageForm').addEventListener('submit', saveExercise);
  document.getElementById('fType').addEventListener('change', onTypeChange);
  document.getElementById('addChoiceBtn').addEventListener('click', () => addChoiceRow());

  document.getElementById('imgUploadBtn').addEventListener('click', () => document.getElementById('imgFileInput').click());
  document.getElementById('imgFileInput').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = '';
  });
  document.getElementById('imgRemoveBtn').addEventListener('click', handleImageRemove);

  wireLatexPreview('fQuestion', 'renderQuestion');
  wireLatexPreview('fSolution', 'renderSolution');

  document.getElementById('addPsBtn').addEventListener('click', () => openPsModal());
  document.getElementById('psModalClose').addEventListener('click', closePsModal);
  document.getElementById('psCancel').addEventListener('click', closePsModal);
  document.getElementById('psModal').addEventListener('click', e => {
    if (e.target === document.getElementById('psModal')) closePsModal();
  });
  document.getElementById('psForm').addEventListener('submit', saveProblemSet);
}

document.addEventListener('DOMContentLoaded', init);
