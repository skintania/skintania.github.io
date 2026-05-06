import { CONFIG } from '/config.js';

const GRADIENTS = [
  ['#1a3a6b', '#3b82f6'], ['#1a4a3a', '#10b981'],
  ['#3b1a6b', '#8b5cf6'], ['#6b3a1a', '#f59e0b'],
  ['#1a3a6b', '#06b6d4'], ['#6b1a3a', '#ec4899'],
  ['#2d4a1a', '#84cc16'], ['#1a2a6b', '#6366f1'],
];

const params   = new URLSearchParams(location.search);
const courseId = params.get('id');
const token    = () => localStorage.getItem('authToken') || '';

const TYPE_LABELS = {
  multiple_choice: 'ปรนัย',
  fill_blank:      'เติมคำ',
  free_response:   'อัตนัย',
};

const TYPE_ICONS = {
  multiple_choice: '🔘',
  fill_blank:      '✏️',
  free_response:   '📝',
};

// ── State ───────────────────────────────────────────────
let exercises    = [];
let currentIndex = 0;
const answers    = {};    // id → string answer
const checked    = new Set();
const results    = {};    // id → true | false | null (free_response)

function gradientFor(n) {
  const [a, b] = GRADIENTS[n % GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

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

// ── KaTeX helper ────────────────────────────────────────
function renderMath(latex, displayMode = true) {
  if (!latex || !window.katex) return null;
  const el = document.createElement(displayMode ? 'div' : 'span');
  el.className = displayMode ? 'math-block' : 'math-inline';
  try {
    el.innerHTML = katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    el.textContent = latex;
  }
  return el;
}

// ── Helpers ──────────────────────────────────────────────
function hasAnswer(ex) {
  const a = answers[ex.id];
  if (ex.type === 'fill_blank') return !!(a?.trim());
  if (ex.type === 'multiple_choice') return a !== undefined;
  return true;
}

// ── Render exercise card ─────────────────────────────────
function renderExercise(index) {
  const ex = exercises[index];
  currentIndex = index;

  document.getElementById('exerciseNum').textContent       = `ข้อ ${index + 1} / ${exercises.length}`;
  document.getElementById('exerciseTypeBadge').textContent = TYPE_LABELS[ex.type] ?? ex.type;

  // Question text
  document.getElementById('exerciseQuestion').textContent = ex.question;

  // Question math (LaTeX)
  const qMathWrap = document.getElementById('questionMathWrap');
  qMathWrap.innerHTML = '';
  if (ex.question_math) {
    const mathEl = renderMath(ex.question_math, true);
    if (mathEl) qMathWrap.appendChild(mathEl);
  }

  renderBody(ex);

  // Feedback
  const feedbackEl = document.getElementById('exerciseFeedback');
  feedbackEl.hidden = !checked.has(ex.id);
  if (checked.has(ex.id)) showFeedback(ex);

  // Check button
  const checkBtn = document.getElementById('checkBtn');
  checkBtn.hidden      = checked.has(ex.id);
  checkBtn.disabled    = false;
  checkBtn.textContent = ex.type === 'free_response' ? 'ดูเฉลย' : 'ตรวจคำตอบ';

  // Nav
  document.getElementById('prevBtn').disabled    = index === 0;
  const isLast = index === exercises.length - 1;
  document.getElementById('nextBtn').textContent = isLast ? 'ดูผลลัพธ์ →' : 'ถัดไป →';

  // Sidebar active
  document.querySelectorAll('.ex-list-item').forEach(li => li.classList.remove('active'));
  const activeEl = document.querySelector(`.ex-list-item[data-index="${index}"]`);
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  if (activeEl) activeEl.classList.add('active');

  updateScoreDisplay();
}

function renderBody(ex) {
  const body = document.getElementById('exerciseBody');
  body.innerHTML = '';

  if (ex.type === 'multiple_choice') {
    const ul = document.createElement('ul');
    ul.className = 'choice-list';

    (ex.choices || []).forEach((choice, i) => {
      const li    = document.createElement('li');
      li.className = 'choice-item';
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type     = 'radio';
      radio.name     = `ex-${ex.id}`;
      radio.value    = String(i);
      radio.disabled = checked.has(ex.id);
      if (answers[ex.id] === String(i)) radio.checked = true;
      radio.addEventListener('change', () => { answers[ex.id] = String(i); });

      label.appendChild(radio);
      label.appendChild(document.createTextNode(' ' + choice.text));

      if (choice.latex && window.katex) {
        const m = renderMath(choice.latex, false);
        if (m) { label.appendChild(document.createTextNode(' ')); label.appendChild(m); }
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
    input.addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });
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

// ── Feedback ─────────────────────────────────────────────
function showFeedback(ex) {
  const resultEl = document.getElementById('feedbackResult');
  const expl     = document.getElementById('feedbackExplanation');
  expl.innerHTML = '';

  const r = results[ex.id];
  if (ex.type === 'free_response') {
    resultEl.className   = 'feedback-result pending';
    resultEl.textContent = '📖 เฉลย';
  } else if (r) {
    resultEl.className   = 'feedback-result correct';
    resultEl.textContent = '✅ ถูกต้อง!';
  } else {
    resultEl.className   = 'feedback-result wrong';
    resultEl.textContent = '❌ ไม่ถูกต้อง';
  }

  if (ex._solution) {
    const p = document.createElement('p');
    p.textContent = ex._solution;
    expl.appendChild(p);
  }
  const mathEl = renderMath(ex._solution_math ?? null, true);
  if (mathEl) expl.appendChild(mathEl);
}

// ── Check / Submit ────────────────────────────────────────
async function checkAnswer() {
  const ex = exercises[currentIndex];
  if (checked.has(ex.id)) return;

  if (!hasAnswer(ex)) {
    alert('กรุณาเลือกหรือพิมพ์คำตอบก่อน');
    return;
  }

  const checkBtn = document.getElementById('checkBtn');
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
  results[ex.id]   = ex.type === 'free_response' ? null : (data.correct ?? false);
  ex._solution      = data.solution      ?? null;
  ex._solution_math = data.solution_math ?? null;

  renderBody(ex);
  document.getElementById('exerciseFeedback').hidden = false;
  showFeedback(ex);
  checkBtn.hidden = true;

  updateSidebarItem(currentIndex);
  updateScoreDisplay();
}

// ── Navigate ──────────────────────────────────────────────
function navigate(delta) {
  const next = currentIndex + delta;
  if (next < 0) return;
  if (next >= exercises.length) { showSummary(); return; }
  renderExercise(next);
}

// ── Score ─────────────────────────────────────────────────
function updateScoreDisplay() {
  const correct = Object.values(results).filter(r => r === true).length;
  const el      = document.getElementById('scoreDisplay');
  el.textContent = checked.size > 0 ? `${correct} / ${exercises.length} คะแนน` : '';
}

// ── Summary ───────────────────────────────────────────────
function showSummary() {
  const total   = exercises.length;
  const correct = Object.values(results).filter(r => r === true).length;
  const wrong   = Object.values(results).filter(r => r === false).length;
  const pending = Object.values(results).filter(r => r === null).length;
  const skipped = total - checked.size;
  const pct     = (total - pending) > 0 ? Math.round((correct / (total - pending)) * 100) : 0;

  document.getElementById('exerciseCard').hidden    = true;
  document.getElementById('exerciseNav').hidden     = true;
  document.getElementById('exerciseSummary').hidden = false;

  document.getElementById('summaryIcon').textContent = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚';
  document.getElementById('summaryScore').innerHTML  =
    `<span class="summary-num">${correct}</span><span class="summary-denom">/ ${total} ข้อ</span>`;

  const parts = [`ถูก ${correct}`, `ผิด ${wrong}`];
  if (pending > 0) parts.push(`อัตนัย ${pending} ข้อ`);
  if (skipped > 0) parts.push(`ยังไม่ตอบ ${skipped} ข้อ`);
  document.getElementById('summaryDesc').textContent = parts.join(' · ');
}

function retry() {
  Object.keys(answers).forEach(k => delete answers[k]);
  checked.clear();
  Object.keys(results).forEach(k => delete results[k]);
  exercises.forEach(ex => { delete ex._solution; delete ex._solution_math; });

  document.getElementById('exerciseSummary').hidden = true;
  document.getElementById('exerciseCard').hidden    = false;
  document.getElementById('exerciseNav').hidden     = false;

  exercises.forEach((_, i) => updateSidebarItem(i));
  renderExercise(0);
}

// ── Sidebar ───────────────────────────────────────────────
function buildSidebar() {
  const list = document.getElementById('exerciseList');
  list.innerHTML = '';

  exercises.forEach((ex, i) => {
    const li         = document.createElement('li');
    li.className     = 'clip-item ex-list-item';
    li.dataset.index = i;

    li.innerHTML = `
      <span class="clip-num">${i + 1}</span>
      <div class="ex-type-icon">${TYPE_ICONS[ex.type] ?? '❓'}</div>
      <div class="clip-text">
        <span class="clip-name">${ex.title}</span>
        <span class="clip-channel">${TYPE_LABELS[ex.type] ?? ex.type}</span>
      </div>
      <span class="ex-status">⬜</span>
    `;

    li.addEventListener('click', () => renderExercise(i));
    list.appendChild(li);
  });
}

function updateSidebarItem(index) {
  const ex = exercises[index];
  const li = document.querySelector(`.ex-list-item[data-index="${index}"]`);
  if (!li) return;
  const st = li.querySelector('.ex-status');

  if (!checked.has(ex.id))      st.textContent = '⬜';
  else if (results[ex.id] === null) st.textContent = '📝';
  else if (results[ex.id])      st.textContent = '✅';
  else                           st.textContent = '❌';
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  if (!courseId) { window.location.href = '/Course/'; return; }

  // Load course info + check admin in parallel
  const [courseRes, meRes] = await Promise.all([
    apiFetch(`/courses/${courseId}`),
    apiFetch('/auth/me'),
  ]);
  if (!courseRes.success) {
    document.getElementById('exerciseQuestion').textContent = 'ไม่พบคอร์ส';
    return;
  }

  const course = courseRes.course;
  document.title = `${course.title} — Skintania`;

  const header = document.querySelector('site-header');
  if (header) {
    header.setAttribute('page-title', course.title);
    header.setAttribute('page-desc', course.description || 'แบบฝึกหัด');
  }

  document.getElementById('playlistTitle').textContent = course.title;
  document.getElementById('courseTitle').textContent   = course.title;
  document.getElementById('courseNameSub').textContent = course.title;
  document.getElementById('courseDesc').textContent    = course.description || '';
  document.getElementById('courseMeta').textContent    = 'แบบฝึกหัด';

  document.getElementById('playlistHeader').style.background =
    `linear-gradient(160deg, ${GRADIENTS[course.id % GRADIENTS.length][0]}cc 0%, #071029 100%)`;

  if (meRes.success && meRes.user?.role === 'admin') {
    const manageLink = document.getElementById('manageExerciseLink');
    manageLink.href   = `/Course/exercise/manage/?id=${courseId}`;
    manageLink.hidden = false;
  }

  // Load exercises
  const exRes = await apiFetch(`/courses/${courseId}/exercises`);
  if (!exRes.success || !exRes.exercises?.length) {
    document.getElementById('exerciseList').innerHTML = '';
    document.getElementById('exerciseCard').innerHTML =
      '<p style="text-align:center;color:var(--muted);padding:40px">ยังไม่มีแบบฝึกหัดในคอร์สนี้</p>';
    document.getElementById('exerciseNav').hidden = true;
    document.getElementById('playlistSub').textContent = '0 ข้อ';
    return;
  }

  exercises = exRes.exercises;
  document.getElementById('playlistSub').textContent = `${exercises.length} ข้อ`;

  buildSidebar();

  document.getElementById('checkBtn').addEventListener('click', checkAnswer);
  document.getElementById('prevBtn').addEventListener('click', () => navigate(-1));
  document.getElementById('nextBtn').addEventListener('click', () => navigate(1));
  document.getElementById('retryBtn').addEventListener('click', retry);

  renderExercise(0);
}

document.addEventListener('DOMContentLoaded', init);
