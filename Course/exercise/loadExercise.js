import { CONFIG } from '/config.js';

const params   = new URLSearchParams(location.search);
const courseId = params.get('id');
const token    = () => localStorage.getItem('authToken') || '';

const TYPE_LABELS = {
  multiple_choice: 'ปรนัย',
  fill_blank:      'เติมคำ',
  free_response:   'อัตนัย',
};

// ── State ────────────────────────────────────────────────
let problemSets  = [];
let allExercises = [];
let activePsId   = null;
let currentCourse = null;
let currentUser   = null;
const answers    = {};   // exerciseId → string
const checked    = new Set();
const results    = {};   // exerciseId → true | false | null (free_response)

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

// ── LaTeX parser ─────────────────────────────────────────
// Handles $...$, $$...$$, \begin{env}...\end{env},
// \textbf, \textit, \emph, \label, \eqref, \hfill, spacing cmds, etc.

function _katex(latex, displayMode, el) {
  try {
    if (window.katex) el.innerHTML = katex.renderToString(latex, { displayMode, throwOnError: false });
    else el.textContent = latex;
  } catch { el.textContent = latex; }
}

function _matchBraces(text, start) {
  // Returns index of closing '}' matching the '{' at start, or -1
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { if (--depth === 0) return i; }
  }
  return -1;
}

function _matchEnv(text, start) {
  const m = text.slice(start).match(/^\\begin\{(\w+\*?)\}/);
  if (!m) return null;
  const env = m[1];
  let pos = start + m[0].length;
  // Skip optional [...]
  if (text[pos] === '[') {
    const close = text.indexOf(']', pos);
    if (close !== -1) pos = close + 1;
  }
  const endStr = `\\end{${env}}`;
  const endIdx = text.indexOf(endStr, pos);
  if (endIdx === -1) return null;
  return { env, content: text.slice(pos, endIdx), end: endIdx + endStr.length };
}

function _matchTextCmd(text, i) {
  const m = text.slice(i).match(/^\\(textbf|textit|emph|underline|texttt|textsf|textrm)\{/);
  if (!m) return null;
  const braceStart = i + m[0].length - 1;
  const braceEnd   = _matchBraces(text, braceStart);
  if (braceEnd === -1) return null;
  return { cmd: m[1], content: text.slice(braceStart + 1, braceEnd), end: braceEnd + 1 };
}

function _renderEnv(env, content, container) {
  const name = env.replace('*', '');
  const MATH_ENVS = ['equation', 'align', 'eqnarray', 'gather', 'multline', 'flalign', 'alignat'];

  if (MATH_ENVS.includes(name)) {
    const latex = content.replace(/\\label\{[^}]*\}/g, '').trim();
    const el = document.createElement('div');
    el.className = 'math-block';
    _katex(latex, true, el);
    container.appendChild(el);

  } else if (name === 'description') {
    const dl  = document.createElement('dl');
    dl.className = 'latex-dl';
    const re = /\\item\[([^\]]*)\]([\s\S]*?)(?=\\item\[|$)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const item = document.createElement('div');
      item.className = 'latex-dl-item';
      const dt = document.createElement('dt');
      dt.className = 'latex-dt';
      _processLatex(m[1], dt);
      const dd = document.createElement('dd');
      dd.className = 'latex-dd';
      _processLatex(m[2].trim(), dd);
      item.appendChild(dt);
      item.appendChild(dd);
      dl.appendChild(item);
    }
    container.appendChild(dl);

  } else if (name === 'itemize' || name === 'enumerate') {
    const list = document.createElement(name === 'enumerate' ? 'ol' : 'ul');
    list.className = 'latex-list';
    const re = /\\item([\s\S]*?)(?=\\item|$)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const li = document.createElement('li');
      _processLatex(m[1].trim(), li);
      list.appendChild(li);
    }
    container.appendChild(list);

  } else {
    // Unknown: try rendering as display math, fall back to text
    const el = document.createElement('div');
    el.className = 'math-block';
    _katex(`\\begin{${env}}${content}\\end{${env}}`, true, el);
    container.appendChild(el);
  }
}

function _processLatex(text, container) {
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) { container.appendChild(document.createTextNode(buf)); buf = ''; }
  };

  while (i < text.length) {

    // \begin{...}...\end{...}
    if (text.startsWith('\\begin{', i)) {
      const env = _matchEnv(text, i);
      if (env) { flush(); _renderEnv(env.env, env.content, container); i = env.end; continue; }
    }

    // $$...$$
    if (text.startsWith('$$', i)) {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        flush();
        const el = document.createElement('div'); el.className = 'math-block';
        _katex(text.slice(i + 2, end), true, el);
        container.appendChild(el); i = end + 2; continue;
      }
    }

    // \[...\]
    if (text.startsWith('\\[', i)) {
      const end = text.indexOf('\\]', i + 2);
      if (end !== -1) {
        flush();
        const el = document.createElement('div'); el.className = 'math-block';
        _katex(text.slice(i + 2, end), true, el);
        container.appendChild(el); i = end + 2; continue;
      }
    }

    // $...$
    if (text[i] === '$' && text[i + 1] !== '$') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '$') break;
        j++;
      }
      if (j < text.length && j > i + 1) {
        flush();
        const inner = text.slice(i + 1, j);
        if (inner.includes('&') || inner.includes('\\\\')) {
          const el = document.createElement('div'); el.className = 'math-block';
          _katex(`\\begin{aligned}${inner}\\end{aligned}`, true, el);
          container.appendChild(el);
        } else {
          const el = document.createElement('span'); el.className = 'math-inline';
          _katex(inner, false, el);
          container.appendChild(el);
        }
        i = j + 1; continue;
      }
    }

    // \textbf, \textit, \emph, …
    const cmd = _matchTextCmd(text, i);
    if (cmd) {
      flush();
      const el = document.createElement('span');
      if (cmd.cmd === 'textbf')                     el.style.fontWeight = '600';
      else if (cmd.cmd === 'textit' || cmd.cmd === 'emph') el.style.fontStyle = 'italic';
      else if (cmd.cmd === 'underline')              el.style.textDecoration = 'underline';
      else if (cmd.cmd === 'texttt')                 el.style.fontFamily = 'monospace';
      _processLatex(cmd.content, el);
      container.appendChild(el); i = cmd.end; continue;
    }

    // \label{...}, \ref{...}, \nonumber, \begin/end{document} → strip
    const stripM = text.slice(i).match(/^\\(?:label|ref|nonumber)\{[^}]*\}|^\\(?:begin|end)\{document\}/);
    if (stripM) { i += stripM[0].length; continue; }

    // \eqref{...} → "(label)"
    const eqM = text.slice(i).match(/^\\eqref\{([^}]*)\}/);
    if (eqM) { flush(); container.appendChild(document.createTextNode(`(${eqM[1]})`)); i += eqM[0].length; continue; }

    // \hfill → flex spacer
    if (text.startsWith('\\hfill', i)) {
      flush();
      const sp = document.createElement('span'); sp.className = 'latex-hfill';
      container.appendChild(sp); i += 6; continue;
    }

    // \smallskip, \medskip, \bigskip, \par → <br>
    const skipM = text.slice(i).match(/^\\(?:smallskip|medskip|bigskip|par|vspace\{[^}]*\})/);
    if (skipM) { flush(); container.appendChild(document.createElement('br')); i += skipM[0].length; continue; }

    // \noindent → ignore
    if (text.startsWith('\\noindent', i)) { i += 9; continue; }

    // \\ or \newline → <br>
    if (text.startsWith('\\\\', i)) { flush(); container.appendChild(document.createElement('br')); i += 2; continue; }
    if (text.startsWith('\\newline', i)) { flush(); container.appendChild(document.createElement('br')); i += 8; continue; }

    buf += text[i++];
  }
  flush();
}

function renderLatexText(text, container) {
  container.innerHTML = '';
  if (!text) return;
  _processLatex(text, container);
}

// Render a standalone LaTeX block (for question_math / solution_math fields)
function renderMathBlock(latex, displayMode = true) {
  if (!latex || !window.katex) return null;
  const el = document.createElement(displayMode ? 'div' : 'span');
  el.className = displayMode ? 'math-block' : 'math-inline';
  try { el.innerHTML = katex.renderToString(latex, { displayMode, throwOnError: false }); }
  catch { el.textContent = latex; }
  return el;
}

// ── Build question card ───────────────────────────────────
function buildQuestionCard(ex, num) {
  const card = document.createElement('div');
  card.className = 'q-card';
  card.id        = `qcard-${ex.id}`;

  // Header
  const header = document.createElement('div');
  header.className = 'q-card-header';
  header.innerHTML = `
    <span class="q-num-badge"><span class="q-num-prefix">ข้อ </span>${num}</span>
    <span class="q-type-badge">${TYPE_LABELS[ex.type] ?? ex.type}</span>
  `;
  card.appendChild(header);

  // Question text — inline LaTeX rendered
  const qText = document.createElement('p');
  qText.className = 'q-question';
  renderLatexText(ex.question, qText);
  card.appendChild(qText);

  // Optional standalone display-math for question
  if (ex.question_math) {
    const mathEl = renderMathBlock(ex.question_math, true);
    if (mathEl) card.appendChild(mathEl);
  }

  // Question image
  if (ex.image_key) {
    const img = document.createElement('img');
    img.className = 'q-image';
    img.alt       = '';
    loadExerciseImage(ex.image_key).then(src => { if (src) img.src = src; });
    card.appendChild(img);
  }

  // Answer body
  const body = document.createElement('div');
  body.className = 'q-body';
  card.appendChild(body);

  // Feedback area
  const feedback = document.createElement('div');
  feedback.className = 'q-feedback';
  feedback.hidden    = true;
  card.appendChild(feedback);

  // Check button
  const actions  = document.createElement('div');
  actions.className = 'q-actions';
  const checkBtn = document.createElement('button');
  checkBtn.className   = 'btn check-btn';
  checkBtn.textContent = ex.type === 'free_response' ? 'ดูเฉลย' : 'ตรวจคำตอบ';
  actions.appendChild(checkBtn);
  card.appendChild(actions);

  // Render initial answer area
  renderCardBody(ex, body);

  // If already answered (e.g. PS switched and back), restore state
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

      // Choice text — support plain string or {text, latex} object
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
  const ps  = problemSets.find(p => p.id === psId);
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
    const res = await fetch(`${CONFIG.API_URL}/assets/${imageKey}`, {
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
  document.getElementById('phCourse').textContent = currentCourse?.title ?? '';
  document.getElementById('phPs').textContent     = ps?.title ?? '';
  document.getElementById('phAuthor').textContent = ps?.author ?? '';

  const name = currentUser
    ? `${currentUser.firstname ?? ''} ${currentUser.lastname ?? ''}`.trim()
    : '';
  document.getElementById('pfExportBy').textContent = name ? `Exported by ${name}` : 'Exported from Skintania';
  document.getElementById('pfDate').textContent = new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  window.print();
}

// ── File preview modal ───────────────────────────────────────
function closePreview() {
  document.getElementById('filePreviewModal').style.display = 'none';
  document.getElementById('previewModalBody').innerHTML = '';
}

async function previewFile(apiPath, filename) {
  const modal       = document.getElementById('filePreviewModal');
  const body        = document.getElementById('previewModalBody');
  const nameEl      = document.getElementById('previewFileName');
  const downloadBtn = document.getElementById('previewDownloadBtn');

  modal.style.display = 'flex';
  nameEl.textContent  = filename;
  body.innerHTML = '<div class="preview-loading"><p>กำลังโหลด...</p></div>';
  downloadBtn.onclick = null;

  try {
    const res = await fetch(`${CONFIG.API_URL}${apiPath}`, {
      headers: { 'Authorization': `Bearer ${token()}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob    = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    body.innerHTML = '';
    const ext = filename.split('.').pop().toLowerCase();

    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      const img = document.createElement('img');
      img.src = blobUrl; img.className = 'preview-image';
      body.appendChild(img);
    } else if (ext === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = blobUrl + '#toolbar=0'; iframe.className = 'preview-iframe';
      body.appendChild(iframe);
    } else {
      body.innerHTML = `<div class="preview-unsupported">
        <div style="font-size:3rem;margin-bottom:12px;">📄</div>
        <div>${filename}</div>
        <div style="margin-top:8px;font-size:0.85rem;opacity:0.6;">ไม่รองรับการดูตัวอย่าง — กดดาวน์โหลดเพื่อเปิด</div>
      </div>`;
    }
  } catch {
    body.innerHTML = `<div class="preview-unsupported">
      <div style="font-size:2rem;margin-bottom:8px;">⚠️</div>
      ไม่สามารถโหลดไฟล์ได้
    </div>`;
  }
}

// ── File download (Authorization header → blob → link) ───────
async function downloadFile(apiPath, filename, btn) {
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await fetch(`${CONFIG.API_URL}${apiPath}`, {
      headers: { 'Authorization': `Bearer ${token()}` },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'ไม่สามารถดาวน์โหลดได้');
      return;
    }
    const blob    = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href = blobUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    alert('ไม่สามารถดาวน์โหลดได้');
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
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
    const dlBtn = document.createElement('button');
    dlBtn.className = 'syllabus-dl-btn';
    dlBtn.textContent = 'ดาวน์โหลด';
    const sylSafePath = course.syllabus_key.split('/').map(encodeURIComponent).join('/');
    const sylFilename  = course.syllabus_key.split('/').pop() || 'syllabus';
    dlBtn.addEventListener('click', () => downloadFile(`/skdrive/${sylSafePath}`, sylFilename, dlBtn));
    const prevBtn = document.createElement('button');
    prevBtn.className = 'syllabus-prev-btn';
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
        const res = await fetch(`${CONFIG.API_URL}/courses/${courseId}/syllabus`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': file.type },
          body: file,
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

  // Update sidebar active state
  document.querySelectorAll('.ps-item').forEach(li => li.classList.remove('active'));
  const activeItem = document.querySelector(`.ps-item[data-ps-id="${psId}"]`);
  if (activeItem) activeItem.classList.add('active');

  // Show panel header
  const panelHeader = document.getElementById('qsPanelHeader');
  panelHeader.hidden = false;
  document.getElementById('qsPanelTitle').textContent = ps?.title ?? '';
  document.getElementById('qsPanelSub').textContent   = `${psExercises.length} ข้อ`;
  document.getElementById('qsEmpty').hidden = true;
  document.getElementById('printBtn').onclick = () => triggerPrint(ps);

  // Build stacked question cards
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

  // Auto-select first problem set
  if (problemSets.length > 0) {
    loadPsQuestions(problemSets[0].id);
  }
}

document.addEventListener('DOMContentLoaded', init);
