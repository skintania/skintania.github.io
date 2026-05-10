import { apiFetch } from '/shared/api.js';
import { GRADIENTS, gradientFor } from '/shared/utils.js';
import { state } from './state.js';
import { initControls, initYouTubeMode } from './player.js';
import { setOnClipChange, loadClips } from './clips.js';
import { loadComments, initCommentForm } from './comments.js';
import { loadSlides, closePreview, initCourseDocs, initAskAI } from './slides.js';

async function loadCurrentUser() {
  try {
    const data = await apiFetch('/auth/me');
    if (data.success) {
      state.currentUser = data.user;
      const initials = ((state.currentUser.firstname?.[0] || '') + (state.currentUser.lastname?.[0] || '')).toUpperCase()
                    || state.currentUser.username?.[0]?.toUpperCase() || '?';
      const el = document.getElementById('myAvatar');
      if (el) el.textContent = initials;
    }
  } catch {}
}

function initTabs() {
  const btns   = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

async function loadOtherCourses(currentId) {
  const data = await apiFetch('/courses');
  if (!data.success) return;

  const others = data.courses.filter(c => c.id !== currentId);
  if (!others.length) {
    document.getElementById('otherCoursesCol').hidden = true;
    return;
  }

  const list = document.getElementById('otherCoursesList');
  others.forEach(course => {
    const initials = course.title.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
    const a = document.createElement('a');
    a.className = 'other-course-card';
    a.href      = `/Course/view/?id=${course.id}`;
    a.innerHTML = `
      <div class="other-course-thumb" style="background:${gradientFor(course.id)}">${initials}</div>
      <div class="other-course-info">
        <div class="other-course-title">${course.title}</div>
        <div class="other-course-sub">Skintania</div>
      </div>
    `;
    list.appendChild(a);
  });
}

async function init() {
  if (!state.courseId) { window.location.href = '/Course/'; return; }

  document.getElementById('previewCloseBtn').addEventListener('click', closePreview);
  document.getElementById('previewModalBackdrop').addEventListener('click', closePreview);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });

  initTabs();
  initCommentForm();

  setOnClipChange(key => {
    loadComments(key);
    loadSlides(key);
  });

  await loadCurrentUser();

  const courseRes = await apiFetch(`/courses/${state.courseId}`);
  if (!courseRes.success) {
    document.getElementById('nowPlayingTitle').textContent = 'ไม่พบคอร์ส';
    return;
  }

  const course = courseRes.course;
  document.title = `${course.title} — Skintania`;

  const header = document.querySelector('site-header');
  if (header) {
    header.setAttribute('page-title', course.title);
    header.setAttribute('page-desc', course.description || 'คอร์สเรียน');
  }

  document.getElementById('playlistTitle').textContent = course.title;
  document.getElementById('playlistHeader').style.background =
    `linear-gradient(160deg, ${GRADIENTS[course.id % GRADIENTS.length][0]}cc 0%, #071029 100%)`;

  document.getElementById('courseNameSub').textContent = course.title;
  document.getElementById('courseDesc').textContent    = course.description || '';
  const created = new Date(course.createdAt).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('courseMeta').textContent = `สร้างเมื่อ ${created}`;

  initCourseDocs(course, state.currentUser?.role === 'admin');

  if (course.youtube_url) {
    document.getElementById('videoPlayer').hidden = true;
    document.getElementById('seekPreview').hidden = true;
    document.getElementById('ytPlayer').hidden    = false;
    initAskAI(true);
    const playlistIds = course.youtube_url.split(',').map(s => {
      const v = s.trim();
      try { return new URL(v).searchParams.get('list') || v; } catch { return v; }
    }).filter(Boolean);
    await initYouTubeMode(playlistIds, key => {
      loadComments(key);
      loadSlides(key);
    });
  } else {
    initControls();
    initAskAI();
    await loadClips();
  }

  loadOtherCourses(course.id);
}

document.addEventListener('DOMContentLoaded', init);
