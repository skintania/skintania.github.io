import { CONFIG } from '/config.js';

const params   = new URLSearchParams(location.search);
const courseId = params.get('id');
const token    = () => localStorage.getItem('authToken') || '';

let exercises = [];
let editingId = null; // null = new exercise

const TYPE_ICONS = { multiple_choice: '🔘', fill_blank: '✏️', free_response: '📝' };

// ── API ──────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: `Bearer ${token()}` } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${CONFIG.API_URL}${path}`, opts);
  if (res.status === 204) return { success: true };
  return res.json();
}

// ── KaTeX live preview ───────────────────────────────────
function renderPreview(latex, el) {
  if (!el) return;
  if (!latex?.trim()) { el.innerHTML = ''; return; }
  if (!window.katex)  { el.textContent = latex; return; }
  try {
    el.innerHTML = katex.renderToString(latex, { displayMode: true, throwOnError: false });
  } catch {
    el.textContent = latex;
  }
}

function wirePreview(inputId, renderId) {
  const input  = document.getElementById(inputId);
  const render = document.getElementById(renderId);
  if (input && render) input.addEventListener('input', () => renderPreview(input.value, render));
}

// ── Choices ───────────────────────────────────────────────
let choiceSeq = 0;

function addChoiceRow(text = '', latex = '') {
  const seq  = choiceSeq++;
  const list = document.getElementById('choicesList');
  const rows = list.querySelectorAll('.choice-row');
  const idx  = rows.length;

  const row = document.createElement('div');
  row.className    = 'choice-row';
  row.dataset.seq  = seq;

  row.innerHTML = `
    <div class="choice-row-header">
      <span class="choice-index-badge">${String.fromCharCode(65 + idx)}</span>
      <input class="form-input choice-text-input"  type="text" placeholder="ข้อความตัวเลือก" data-choice-text>
      <button type="button" class="choice-remove-btn" title="ลบ">✕</button>
    </div>
    <div class="choice-row-inputs">
      <input class="form-input choice-latex-input font-mono" type="text" placeholder="LaTeX (ไม่บังคับ)" data-choice-latex>
    </div>
    <div class="choice-latex-preview" data-preview></div>
  `;

  const textInput  = row.querySelector('[data-choice-text]');
  const latexInput = row.querySelector('[data-choice-latex]');
  const previewEl  = row.querySelector('[data-preview]');

  textInput.value  = text;
  latexInput.value = latex;

  latexInput.addEventListener('input', () => renderPreview(latexInput.value, previewEl));
  if (latex) renderPreview(latex, previewEl);

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
    label.appendChild(document.createTextNode(` ${String.fromCharCode(65 + i)}. ${text.slice(0, 50)}`));
    container.appendChild(label);

    // Keep radio label in sync with text input
    row.querySelector('[data-choice-text]').addEventListener('input', e => {
      const span = label.childNodes[1];
      if (span) span.textContent = ` ${String.fromCharCode(65 + i)}. ${e.target.value.slice(0, 50)}`;
    });
  });
}

function getChoices() {
  return Array.from(document.querySelectorAll('.choice-row')).map(row => {
    const latex = row.querySelector('[data-choice-latex]').value.trim();
    return {
      text:  row.querySelector('[data-choice-text]').value.trim(),
      ...(latex && { latex }),
    };
  });
}

// ── Type change ───────────────────────────────────────────
function onTypeChange() {
  const type = document.getElementById('fType').value;
  document.getElementById('choicesSection').hidden    = type !== 'multiple_choice';
  document.getElementById('fillAnswerSection').hidden = type !== 'fill_blank';

  // Default 4 choices when first switching to MC with empty list
  if (type === 'multiple_choice' && document.querySelectorAll('.choice-row').length === 0) {
    addChoiceRow(); addChoiceRow(); addChoiceRow(); addChoiceRow();
  }
}

// ── Open form ─────────────────────────────────────────────
function openForm(ex = null) {
  editingId = ex?.id ?? null;
  const isEdit = editingId !== null;

  document.getElementById('formEmptyState').hidden = true;
  document.getElementById('manageForm').hidden     = false;
  document.getElementById('formSectionHeader').textContent = isEdit
    ? `แก้ไข: ${ex.title}`
    : 'สร้างข้อใหม่';

  // Fill fields
  document.getElementById('fTitle').value        = ex?.title          ?? '';
  document.getElementById('fSortOrder').value    = ex?.sort_order     ?? exercises.length;
  document.getElementById('fType').value         = ex?.type           ?? 'multiple_choice';
  document.getElementById('fQuestion').value     = ex?.question       ?? '';
  document.getElementById('fQuestionMath').value = ex?.question_math  ?? '';
  document.getElementById('fSolution').value     = ex?.solution       ?? '';
  document.getElementById('fSolutionMath').value = ex?.solution_math  ?? '';
  document.getElementById('fFillAnswer').value   = '';

  // Hints for edit mode (answer not returned by API)
  document.getElementById('fillAnswerHint').textContent = isEdit
    ? 'เว้นว่างไว้เพื่อคงเฉลยเดิม'
    : '';
  document.getElementById('fillAnswerReq').hidden = isEdit;
  document.getElementById('answerHint').textContent = isEdit
    ? 'ไม่เลือกหมายถึงคงเฉลยเดิม'
    : '';

  // Reset choices
  document.getElementById('choicesList').innerHTML  = '';
  document.getElementById('answerRadios').innerHTML = '';
  choiceSeq = 0;

  if (ex?.type === 'multiple_choice' && ex.choices?.length) {
    ex.choices.forEach(c => addChoiceRow(c.text, c.latex ?? ''));
  } else if (!isEdit) {
    addChoiceRow(); addChoiceRow(); addChoiceRow(); addChoiceRow();
  }

  // LaTeX previews
  renderPreview(ex?.question_math ?? null, document.getElementById('renderQuestionMath'));
  renderPreview(ex?.solution_math ?? null, document.getElementById('renderSolutionMath'));

  onTypeChange();

  // Reset error + button
  document.getElementById('formError').hidden   = true;
  document.getElementById('saveBtn').disabled   = false;
  document.getElementById('saveBtn').textContent = 'บันทึก';

  // Sidebar highlight
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

// ── Save ──────────────────────────────────────────────────
async function saveExercise(e) {
  e.preventDefault();

  const type         = document.getElementById('fType').value;
  const title        = document.getElementById('fTitle').value.trim();
  const question     = document.getElementById('fQuestion').value.trim();
  const questionMath = document.getElementById('fQuestionMath').value.trim() || undefined;
  const solution     = document.getElementById('fSolution').value.trim()     || undefined;
  const solutionMath = document.getElementById('fSolutionMath').value.trim() || undefined;
  const sortOrder    = parseInt(document.getElementById('fSortOrder').value)  || 0;
  const isEdit       = editingId !== null;

  const errorEl  = document.getElementById('formError');
  const saveBtn  = document.getElementById('saveBtn');
  errorEl.hidden = true;

  // Build payload
  const payload = { title, type, question, sort_order: sortOrder };
  if (questionMath) payload.question_math = questionMath;
  if (solution)     payload.solution      = solution;
  if (solutionMath) payload.solution_math = solutionMath;

  // Type-specific validation + answer
  if (type === 'multiple_choice') {
    const choices = getChoices();
    const emptyChoice = choices.findIndex(c => !c.text);
    if (choices.length < 2) {
      showError('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ'); return;
    }
    if (emptyChoice !== -1) {
      showError(`ตัวเลือก ${String.fromCharCode(65 + emptyChoice)} ยังไม่มีข้อความ`); return;
    }
    const answerRadio = document.querySelector('input[name="answerRadio"]:checked');
    if (!isEdit && !answerRadio) {
      showError('กรุณาเลือกเฉลยที่ถูกต้อง'); return;
    }
    payload.choices = choices;
    if (answerRadio) payload.answer = answerRadio.value;

  } else if (type === 'fill_blank') {
    const answer = document.getElementById('fFillAnswer').value.trim();
    if (!isEdit && !answer) {
      showError('กรุณาระบุคำตอบสำหรับข้อเติมคำ'); return;
    }
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

  await loadExercises();
  closeForm();
}

function showError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.hidden = false;
}

// ── Delete ────────────────────────────────────────────────
async function deleteExercise(id, title) {
  if (!confirm(`ลบข้อ "${title}" ออกจากคอร์ส?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
  await apiFetch(`/courses/${courseId}/exercises/${id}`, 'DELETE');
  if (editingId === id) closeForm();
  await loadExercises();
}

// ── Render list ───────────────────────────────────────────
function renderList() {
  const list  = document.getElementById('manageList');
  const count = document.getElementById('exerciseCount');
  list.innerHTML       = '';
  count.textContent    = `${exercises.length} ข้อ`;

  if (!exercises.length) {
    const li = document.createElement('li');
    li.style.cssText = 'padding:20px;text-align:center;font-size:.85rem;color:var(--muted)';
    li.textContent = 'ยังไม่มีข้อ กด "+ เพิ่มข้อใหม่"';
    list.appendChild(li);
    return;
  }

  exercises.forEach((ex, i) => {
    const li         = document.createElement('li');
    li.className     = 'manage-list-item';
    li.dataset.id    = ex.id;

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

// ── Load exercises ────────────────────────────────────────
async function loadExercises() {
  const data = await apiFetch(`/courses/${courseId}/exercises`);
  exercises  = data.exercises || [];
  renderList();
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  if (!courseId) { window.location.href = '/Course/'; return; }

  // Verify admin
  const me = await apiFetch('/auth/me');
  if (!me.success || me.user?.role !== 'admin') {
    window.location.href = `/Course/exercise/?id=${courseId}`;
    return;
  }

  // Back link
  document.getElementById('backLink').href = `/Course/exercise/?id=${courseId}`;

  // Load course info
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

  await loadExercises();

  // Wire events
  document.getElementById('addExerciseBtn').addEventListener('click', () => openForm(null));
  document.getElementById('cancelFormBtn').addEventListener('click', closeForm);
  document.getElementById('manageForm').addEventListener('submit', saveExercise);
  document.getElementById('fType').addEventListener('change', onTypeChange);
  document.getElementById('addChoiceBtn').addEventListener('click', () => addChoiceRow());

  // Live LaTeX previews
  wirePreview('fQuestionMath', 'renderQuestionMath');
  wirePreview('fSolutionMath', 'renderSolutionMath');
}

document.addEventListener('DOMContentLoaded', init);
