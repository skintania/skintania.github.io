import { CONFIG } from '/config.js';

const GRADIENTS = [
  ['#1a3a6b', '#3b82f6'],
  ['#1a4a3a', '#10b981'],
  ['#3b1a6b', '#8b5cf6'],
  ['#6b3a1a', '#f59e0b'],
  ['#1a3a6b', '#06b6d4'],
  ['#6b1a3a', '#ec4899'],
  ['#2d4a1a', '#84cc16'],
  ['#1a2a6b', '#6366f1'],
];

let activeTag = 'all';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} เดือนที่แล้ว`;
  return `${Math.floor(months / 12)} ปีที่แล้ว`;
}

function gradientFor(id) {
  const [a, b] = GRADIENTS[id % GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function renderCard(course) {
  const a = document.createElement('a');
  a.className = 'yt-card';
  a.href = course.type === 'exercise'
    ? `/Course/exercise/?id=${course.id}`
    : `/Course/view/?id=${course.id}`;
  a.dataset.title = course.title.toLowerCase();
  a.dataset.tag   = (course.description || '').trim().toLowerCase();

  const initials = course.title.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const typeBadge = course.type === 'exercise'
    ? `<span class="yt-type-badge">แบบฝึกหัด</span>`
    : '';

  a.innerHTML = `
    <div class="yt-thumb" style="background:${gradientFor(course.id)}">
      <span class="yt-thumb-initials">${initials}</span>
      ${typeBadge}
      <div class="yt-play-overlay">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
          fill="white" opacity="0.9">
          <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/>
          <polygon points="10,8 18,12 10,16" fill="white"/>
        </svg>
      </div>
    </div>
    <div class="yt-info">
      <div class="yt-avatar" style="background:${gradientFor(course.id + 3)}">${(course.title[0] || 'S').toUpperCase()}</div>
      <div class="yt-meta">
        <h3 class="yt-title">${course.title}</h3>
        <p class="yt-channel">Skintania</p>
        <p class="yt-date">${course.description ? course.description + ' · ' : ''}${timeAgo(course.createdAt)}</p>
      </div>
    </div>
  `;
  return a;
}

function filterCards() {
  const grid    = document.getElementById('coursesGrid');
  const countEl = document.getElementById('courseCount');
  const emptyEl = document.getElementById('emptyState');
  const q       = document.getElementById('courseSearch').value.toLowerCase().trim();

  let visible = 0;
  grid.querySelectorAll('.yt-card').forEach(card => {
    const matchSearch = !q || card.dataset.title.includes(q);
    const matchTag    = activeTag === 'all' || card.dataset.tag === activeTag;
    const show        = matchSearch && matchTag;
    card.hidden       = !show;
    if (show) visible++;
  });
  countEl.textContent = `${visible} คอร์ส`;
  emptyEl.hidden      = visible > 0;
}

function buildTags(courses) {
  const tagList  = document.getElementById('tagList');
  const tagCounts = new Map();
  courses.forEach(c => {
    const tag = (c.description || '').trim();
    if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  });

  tagCounts.forEach((_, tag) => {
    const btn         = document.createElement('button');
    btn.className     = 'tag-btn';
    btn.dataset.tag   = tag.toLowerCase();
    btn.textContent   = tag;
    tagList.appendChild(btn);
  });

  tagList.addEventListener('click', e => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;
    activeTag = btn.dataset.tag;
    tagList.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('active', b === btn));
    filterCards();
  });
}

// ── Create course modal ──────────────────────────────────
function initCreateModal() {
  const overlay   = document.getElementById('createModal');
  const openBtn   = document.getElementById('createCourseBtn');
  const closeBtn  = document.getElementById('createModalClose');
  const cancelBtn = document.getElementById('ccCancel');
  const form      = document.getElementById('createCourseForm');
  const errorEl   = document.getElementById('ccError');
  const submitBtn = document.getElementById('ccSubmit');

  function openModal() {
    form.reset();
    errorEl.hidden = true;
    overlay.hidden = false;
  }
  function closeModal() { overlay.hidden = true; }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const title  = document.getElementById('ccTitle').value.trim();
    const folder = document.getElementById('ccFolder').value.trim();
    const desc   = document.getElementById('ccDesc').value.trim();
    const type   = document.getElementById('ccType').value;

    if (!title || !folder) return;

    submitBtn.disabled    = true;
    submitBtn.textContent = 'กำลังสร้าง...';
    errorEl.hidden        = true;

    const token = localStorage.getItem('authToken');
    try {
      const res  = await fetch(`${CONFIG.API_URL}/courses`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, folder, description: desc || undefined, type }),
      });
      const data = await res.json();

      if (!data.success) {
        errorEl.textContent = data.error || 'เกิดข้อผิดพลาด';
        errorEl.hidden      = false;
        return;
      }

      closeModal();
      // Redirect to the new course
      const dest = type === 'exercise'
        ? `/Course/exercise/?id=${data.id}`
        : `/Course/view/?id=${data.id}`;
      window.location.href = dest;
    } catch {
      errorEl.textContent = 'ไม่สามารถเชื่อมต่อได้';
      errorEl.hidden      = false;
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'สร้างคอร์ส';
    }
  });
}

async function loadCourses() {
  const token   = localStorage.getItem('authToken');
  const grid    = document.getElementById('coursesGrid');
  const emptyEl = document.getElementById('emptyState');

  try {
    // Load user role + courses in parallel
    const [meRes, coursesRes] = await Promise.all([
      fetch(`${CONFIG.API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${CONFIG.API_URL}/courses`,  { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const [meData, data] = await Promise.all([meRes.json(), coursesRes.json()]);

    // Show create button for admins
    if (meData.success && meData.user?.role === 'admin') {
      document.getElementById('createCourseBtn').hidden = false;
      initCreateModal();
    }

    if (!data.success) throw new Error(data.error || 'Failed to load');

    const courses = data.courses;
    grid.innerHTML = '';

    if (courses.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    courses.forEach(c => grid.appendChild(renderCard(c)));
    buildTags(courses);
    filterCards();

    document.getElementById('courseSearch').addEventListener('input', filterCards);

  } catch (err) {
    console.error('Error loading courses:', err);
    grid.innerHTML = '<p class="load-error">ไม่สามารถโหลดคอร์สได้ กรุณาลองใหม่</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadCourses);
