import { apiFetch, token, API_URL } from '/shared/api.js';
import { renderLatexText, renderMathBlock } from '/shared/latex.js';
import { downloadFile, previewFile, closePreview } from '/shared/file-preview.js';

const params   = new URLSearchParams(location.search);
const courseId = params.get('id');

const TYPE_LABELS = {
  multiple_choice: 'ปรนัย',
  fill_blank:      'เติมคำ',
  free_response:   'อัตนัย',
};

// ── State ────────────────────────────────────────────────
let problemSets   = [];
let allExercises  = [];
let activePsId    = null;
let currentCourse = null;
let currentUser   = null;
const answers = {};
const checked = new Set();
const results = {};

// ── Build question card ───────────────────────────────────
function buildQuestionCard(ex, num) {
  const card = document.createElement('div');
  card.className = 'q-card';
  card.id        = `qcard-${ex.id}`;

  const header = document.createElement('div');
  header.className = 'q-card-header';
  header.innerHTML = `
    <span class="q-num-badge"><span class="q-num-prefix">ข้อ </span>${num}</span>
    <span class="q-type-badge">${TYPE_LABELS[ex.type] ?? ex.type}</span>
  `;
  card.appendChild(header);

  const qText = document.createElement('p');
  qText.className = 'q-question';
  renderLatexText(ex.question, qText);
  card.appendChild(qText);

  if (ex.question_math) {
    const mathEl = renderMathBlock(ex.question_math, true);
    if (mathEl) card.appendChild(mathEl);
  }

  if (ex.image_key) {
    const img = document.createElement('img');
    img.className = 'q-image';
    img.alt       = '';
    loadExerciseImage(ex.image_key).then(src => { if (src) img.src = src; });
    card.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'q-body';
  card.appendChild(body);

  const feedback = document.createElement('div');
  feedback.className = 'q-feedback';
  feedback.hidden    = true;
  card.appendChild(feedback);

  const actions  = document.createElement('div');
  actions.className = 'q-actions';
  const checkBtn = document.createElement('button');
  checkBtn.className   = 'btn check-btn';
  checkBtn.textContent = ex.type === 'free_response' ? 'ดูเฉลย' : 'ตรวจคำตอบ';
  actions.appendChild(checkBtn);
  card.appendChild(actions);

  renderCardBody(ex, body);

  if (checked.has(ex.id)) {
    applyAnsweredState(card, ex, body, feedback, checkBtn);
  }

  checkBtn.addEventListener('click', async () => {
    await submitAnswer(ex, card, body, feedback, checkBtn);
    updateSidebarProgress(activePsId);
    updateScoreBadge();
  });

  return card;
}

function renderCardBody(ex, body) {
  body.innerHTML = '';

  if (ex.type === 'multiple_choice') {
    const ul = document.createElement('ul');
    ul.className = 'choice-list';

    (ex.choices || []).forEach((choice, i) => {
      const li    = document.createElement('li');
      li.className = 'choice-item';
      const label = document.createElement('label');

      const radio    = document.createElement('input');
      radio.type     = 'radio';
      radio.name     = `ex-${ex.id}`;
      radio.value    = String(i);
      radio.disabled = checked.has(ex.id);
      if (answers[ex.id] === String(i)) radio.checked = true;
      radio.addEventListener('change', () => { answers[ex.id] = String(i); });
      label.appendChild(radio);

      const choiceText  = typeof choice === 'string' ? choice : (choice.text ?? '');
      const choiceLatex = typeof choice === 'string' ? null   : (choice.latex ?? null);

      const choiceSpan = document.createElement('span');
      renderLatexText(choiceText, choiceSpan);
      label.appendChild(choiceSpan);

      if (choiceLatex) {
        const m = renderMathBlock(choiceLatex, false);
        if (m) label.appendChild(m);
      }

      li.appendChild(label);
      ul.appendChild(li);
    });
    body.appendChild(ul);

  } else if (ex.type === 'fill_blank') {
    const input       = document.createElement('input');
    input.type        = 'text';
    input.className   = 'fill-input';
    input.placeholder = 'พิมพ์คำตอบ...';
    input.value       = answers[ex.id] || '';
    input.disabled    = checked.has(ex.id);
    input.addEventListener('input', () => { answers[ex.id] = input.value; });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const btn = input.closest('.q-card')?.querySelector('.check-btn');
        if (btn && !btn.hidden) btn.click();
      }
    });
    body.appendChild(input);

  } else if (ex.type === 'free_response') {
    if (!checked.has(ex.id)) {
      const hint = document.createElement('p');
      hint.className   = 'free-response-hint';
      hint.textContent = 'กดดูเฉลยเพื่อดูแนวทางการตอบ';
      body.appendChild(hint);
    }
  }
}

function showCardFeedback(ex, feedbackEl) {
  feedbackEl.innerHTML = '';
  const r = results[ex.id];

  const line = document.createElement('div');
  line.className = 'feedback-result';
  if (ex.type === 'free_response') {
    line.classList.add('pending'); line.textContent = '📖 เฉลย';
  } else if (r) {
    line.classList.add('correct'); line.textContent = '✅ ถูกต้อง!';
  } else {
    line.classList.add('wrong');   line.textContent = '❌ ไม่ถูกต้อง';
  }
  feedbackEl.appendChild(line);

  if (ex._solution) {
    const p = document.createElement('p');
    p.className = 'feedback-explanation';
    renderLatexText(ex._solution, p);
    feedbackEl.appendChild(p);
  }
  if (ex._solution_math) {
    const mathEl = renderMathBlock(ex._solution_math, true);
    if (mathEl) { mathEl.classList.add('feedback-explanation'); feedbackEl.appendChild(mathEl); }
  }
}

function applyAnsweredState(card, ex, body, feedbackEl, checkBtn) {
  renderCardBody(ex, body);
  feedbackEl.hidden = false;
  showCardFeedback(ex, feedbackEl);
  checkBtn.hidden = true;

  const r = results[ex.id];
  card.classList.remove('answered-correct', 'answered-wrong', 'answered-pending');
  if (ex.type === 'free_response') card.classList.add('answered-pending');
  else if (r) card.classList.add('answered-correct');
  else         card.classList.add('answered-wrong');
}

async function submitAnswer(ex, card, body, feedbackEl, checkBtn) {
  if (checked.has(ex.id)) return;

  const hasAnswer = ex.type === 'fill_blank'
    ? !!(answers[ex.id]?.trim())
    : ex.type === 'multiple_choice'
    ? answers[ex.id] !== undefined
    : true;

  if (!hasAnswer) { alert('กรุณาเลือกหรือพิมพ์คำตอบก่อน'); return; }

  checkBtn.disabled    = true;
  checkBtn.textContent = 'กำลังตรวจ...';

  const payload = ex.type === 'free_response' ? {} : { answer: answers[ex.id] ?? '' };
  const data    = await apiFetch(`/courses/${courseId}/exercises/${ex.id}/submit`, 'POST', payload);

  if (!data.success) {
    checkBtn.disabled    = false;
    checkBtn.textContent = ex.type === 'free_response' ? 'ดูเฉลย' : 'ตรวจคำตอบ';
    alert(data.error || 'เกิดข้อผิดพลาด');
    return;
  }

  checked.add(ex.id);
  results[ex.id]    = ex.type === 'free_response' ? null : (data.correct ?? false);
  ex._solution      = data.solution      ?? null;
  ex._solution_math = data.solution_math ?? null;

  applyAnsweredState(card, ex, body, feedbackEl, checkBtn);
}

// ── Score badge ───────────────────────────────────────────
function updateScoreBadge() {
  const psExercises = allExercises.filter(ex => ex.problem_set_id === activePsId);
  const correct     = psExercises.filter(ex => results[ex.id] === true).length;
  const done        = psExercises.filter(ex => checked.has(ex.id)).length;
  const badge       = document.getElementById('qsScoreBadge');
  if (!badge) return;
  badge.textContent = done > 0 ? `✅ ${correct} / ${psExercises.length}` : '';
}

// ── PS Sidebar ────────────────────────────────────────────
function buildPsSidebar() {
  const list = document.getElementById('psList');
  list.innerHTML = '';

  if (!problemSets.length) {
    const li = document.createElement('li');
    li.className   = 'ps-empty';
    li.textContent = 'ยังไม่มีชุดโจทย์';
    list.appendChild(li);
    return;
  }

  problemSets.forEach(ps => {
    const total = ps.exercise_count;
    const done  = allExercises.filter(ex => ex.problem_set_id === ps.id && checked.has(ex.id)).length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

    const li = document.createElement('li');
    li.className    = 'ps-item';
    li.dataset.psId = ps.id;
    li.innerHTML = `
      <div class="ps-item-inner">
        <span class="ps-item-name">${ps.title}</span>
        <span class="ps-item-count">${total} ข้อ</span>
      </div>
      <div class="ps-item-progress">
        <div class="ps-progress-bar" style="width:${pct}%"></div>
      </div>
    `;
    li.addEventListener('click', () => loadPsQuestions(ps.id));
    list.appendChild(li);
  });
}

function updateSidebarProgress(psId) {
  const ps   = problemSets.find(p => p.id === psId);
  if (!ps) return;
  const done = allExercises.filter(ex => ex.problem_set_id === psId && checked.has(ex.id)).length;
  const pct  = ps.exercise_count > 0 ? Math.round((done / ps.exercise_count) * 100) : 0;
  const bar  = document.querySelector(`.ps-item[data-ps-id="${psId}"] .ps-progress-bar`);
  if (bar) bar.style.width = `${pct}%`;
}

// ── Image loader ─────────────────────────────────────────
const _imgCache = {};
async function loadExerciseImage(imageKey) {
  if (_imgCache[imageKey]) return _imgCache[imageKey];
  try {
    const res = await fetch(`${API_URL}/assets/${imageKey}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    _imgCache[imageKey] = url;
    return url;
  } catch { return null; }
}

// ── PDF export ────────────────────────────────────────────
function triggerPrint(ps) {
  document.getElementById('phCourse').textContent  = currentCourse?.title ?? '';
  document.getElementById('phPs').textContent      = ps?.title ?? '';
  document.getElementById('phAuthor').textContent  = ps?.author ?? '';

  const name = currentUser
    ? `${currentUser.firstname ?? ''} ${currentUser.lastname ?? ''}`.trim()
    : '';
  document.getElementById('pfExportBy').textContent = name ? `Exported by ${name}` : 'Exported from Skintania';
  document.getElementById('pfDate').textContent = new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  window.print();
}

// ── Syllabus ─────────────────────────────────────────────
async function initSyllabus(course, isAdmin) {
  const section = document.getElementById('syllabusSection');
  if (!section) return;
  section.innerHTML = '';

  if (course.syllabus_key) {
    section.innerHTML = `
      <div class="syllabus-row">
        <span>📋 ซิลลาบัส</span>
        <div class="syllabus-row-actions">
          ${isAdmin ? '<button class="syllabus-del-btn">ลบ</button>' : ''}
        </div>
      </div>
    `;
    const sylSafePath = course.syllabus_key.split('/').map(encodeURIComponent).join('/');
    const sylFilename  = course.syllabus_key.split('/').pop() || 'syllabus';
    const dlBtn = document.createElement('button');
    dlBtn.className   = 'syllabus-dl-btn';
    dlBtn.textContent = 'ดาวน์โหลด';
    dlBtn.addEventListener('click', () => downloadFile(`/skdrive/${sylSafePath}`, sylFilename, dlBtn));
    const prevBtn = document.createElement('button');
    prevBtn.className   = 'syllabus-prev-btn';
    prevBtn.textContent = 'ดูตัวอย่าง';
    prevBtn.addEventListener('click', () => previewFile(`/skdrive/${sylSafePath}`, sylFilename));
    const actions = section.querySelector('.syllabus-row-actions');
    actions.prepend(dlBtn);
    actions.prepend(prevBtn);
    section.hidden = false;

    if (isAdmin) {
      section.querySelector('.syllabus-del-btn').addEventListener('click', async () => {
        if (!confirm('ลบซิลลาบัสนี้?')) return;
        const res = await apiFetch(`/courses/${courseId}/syllabus`, 'DELETE');
        if (res.success) initSyllabus({ ...course, syllabus_key: null }, isAdmin);
        else alert(res.error || 'เกิดข้อผิดพลาด');
      });
    }
  } else if (isAdmin) {
    section.innerHTML = `
      <div class="syllabus-row">
        <span>📋 ซิลลาบัส</span>
        <label class="syllabus-upload-label">
          อัปโหลด
          <input type="file" accept=".pdf,.docx,.pptx">
        </label>
      </div>
    `;
    section.hidden = false;

    section.querySelector('input[type="file"]').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const label = section.querySelector('label');
      label.textContent = 'กำลังอัปโหลด...';
      try {
        const res = await fetch(`${API_URL}/courses/${courseId}/syllabus`, {
          method:  'PUT',
          headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': file.type },
          body:    file,
        });
        const data = await res.json();
        if (data.success) initSyllabus({ ...course, syllabus_key: data.syllabus_key }, isAdmin);
        else { alert(data.error || 'เกิดข้อผิดพลาด'); label.textContent = 'อัปโหลด'; }
      } catch {
        alert('ไม่สามารถอัปโหลดได้');
        label.textContent = 'อัปโหลด';
      }
    });
  }
}

// ── Load PS questions ─────────────────────────────────────
function loadPsQuestions(psId) {
  activePsId = psId;
  const ps          = problemSets.find(p => p.id === psId);
  const psExercises = allExercises.filter(ex => ex.problem_set_id === psId);

  document.querySelectorAll('.ps-item').forEach(li => li.classList.remove('active'));
  const activeItem = document.querySelector(`.ps-item[data-ps-id="${psId}"]`);
  if (activeItem) activeItem.classList.add('active');

  const panelHeader = document.getElementById('qsPanelHeader');
  panelHeader.hidden = false;
  document.getElementById('qsPanelTitle').textContent = ps?.title ?? '';
  document.getElementById('qsPanelSub').textContent   = `${psExercises.length} ข้อ`;
  document.getElementById('qsEmpty').hidden = true;
  document.getElementById('printBtn').onclick = () => triggerPrint(ps);

  const container = document.getElementById('questionsContainer');
  container.innerHTML = '';

  if (!psExercises.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px 0">ยังไม่มีโจทย์ในชุดนี้</p>';
  } else {
    psExercises.forEach((ex, i) => container.appendChild(buildQuestionCard(ex, i + 1)));
  }

  updateScoreBadge();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  if (!courseId) { window.location.href = '/Course/'; return; }

  document.getElementById('previewCloseBtn').addEventListener('click', closePreview);
  document.getElementById('previewModalBackdrop').addEventListener('click', closePreview);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });

  const [courseRes, meRes, psRes, exRes] = await Promise.all([
    apiFetch(`/courses/${courseId}`),
    apiFetch('/auth/me'),
    apiFetch(`/courses/${courseId}/problem-sets`),
    apiFetch(`/courses/${courseId}/exercises`),
  ]);

  if (!courseRes.success) return;

  const course = courseRes.course;
  currentCourse = course;
  if (meRes.success) currentUser = meRes.user ?? null;
  document.title = `${course.title} — Skintania`;

  const siteHeader = document.querySelector('site-header');
  if (siteHeader) {
    siteHeader.setAttribute('page-title', course.title);
    siteHeader.setAttribute('page-desc', course.description || 'แบบฝึกหัด');
  }

  document.getElementById('sidebarCourseName').textContent = course.title;

  problemSets  = psRes.problemSets || [];
  allExercises = exRes.exercises   || [];

  document.getElementById('sidebarCourseSub').textContent =
    `${problemSets.length} ชุด · ${allExercises.length} ข้อ`;

  if (meRes.success && meRes.user?.role === 'admin') {
    const manageLink = document.getElementById('manageExerciseLink');
    manageLink.href   = `/Course/exercise/manage/?id=${courseId}`;
    manageLink.hidden = false;
  }

  initSyllabus(course, currentUser?.role === 'admin');
  buildPsSidebar();

  if (problemSets.length > 0) {
    loadPsQuestions(problemSets[0].id);
  }
}

document.addEventListener('DOMContentLoaded', init);
