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

const TAB_LABELS = { comments: 'ความคิดเห็น', files: 'สไลด์ / เอกสาร', qa: 'ถามตอบ' };

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const panel = document.getElementById(`tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');
  const titleEl = document.getElementById('drawerTitle');
  if (titleEl && TAB_LABELS[tabName]) titleEl.textContent = TAB_LABELS[tabName];
}

function initMobileSettings() {
  const btn      = document.getElementById('videoSettingsBtn');
  const sheet    = document.getElementById('settingsSheet');
  const backdrop = document.getElementById('settingsBackdrop');
  if (!btn || !sheet) return;

  const open  = () => { sheet.classList.add('active');    backdrop.classList.add('active'); };
  const close = () => { sheet.classList.remove('active'); backdrop.classList.remove('active'); };

  btn.addEventListener('click', e => { e.stopPropagation(); sheet.classList.contains('active') ? close() : open(); });
  backdrop.addEventListener('click', close);

  // Speed chips
  const player      = document.getElementById('videoPlayer');
  const speedToggle = document.getElementById('speedToggle');
  document.querySelectorAll('#settingsSpeedChips .settings-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const speed = parseFloat(chip.dataset.speed);
      if (player) player.playbackRate = speed;
      if (speedToggle) speedToggle.textContent = `${speed}×`;
      document.querySelectorAll('#settingsSpeedChips .settings-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      close();
    });
  });

  // Quality chips — proxy clicks to the hidden quality-opt buttons in player.js
  document.querySelectorAll('#settingsQualityChips .settings-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.quality;
      const target = document.querySelector(`.quality-opt[data-quality="${q}"]`);
      if (target) target.click();
      document.querySelectorAll('#settingsQualityChips .settings-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      close();
    });
  });

  // Show quality section only if quality options are available
  const qualityWrap = document.getElementById('qualityWrap');
  if (qualityWrap && !qualityWrap.hidden) {
    document.getElementById('settingsQualitySection').hidden = false;
  }
  // Re-check once clips load (quality may become available later)
  const observer = new MutationObserver(() => {
    if (qualityWrap && !qualityWrap.hidden) {
      document.getElementById('settingsQualitySection').hidden = false;
    }
  });
  if (qualityWrap) observer.observe(qualityWrap, { attributes: true, attributeFilter: ['hidden'] });
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function initMobileDrawer() {
  const tabsDrawer     = document.querySelector('.tabs-section');
  const playlistDrawer = document.querySelector('.playlist-col');
  const tabsClose      = document.getElementById('drawerCloseBtn');
  const playlistClose  = document.getElementById('playlistDrawerClose');
  const trigger        = document.getElementById('mobileTabsTrigger');
  if (!trigger) return;

  let activeType = null;

  const getOverlayTop = () => {
    const wrap = document.getElementById('playerWrap');
    if (!wrap) return 200;
    const rect = wrap.getBoundingClientRect();
    // If the video bottom is still in the viewport, anchor there; otherwise scroll to top first
    if (rect.bottom > 56) return rect.bottom;
    window.scrollTo(0, 0);
    return wrap.getBoundingClientRect().bottom;
  };

  const closeAll = () => {
    tabsDrawer?.classList.remove('overlay-active');
    playlistDrawer?.classList.remove('overlay-active');
    trigger.querySelectorAll('.mtab-btn').forEach(b => b.classList.remove('active'));
    document.body.classList.remove('overlay-lock');
    activeType = null;
  };

  const openOverlay = (type, tab, btn) => {
    closeAll();
    const top = getOverlayTop();
    activeType = type;
    btn.classList.add('active');

    if (type === 'playlist') {
      playlistDrawer.style.top = top + 'px';
      playlistDrawer.classList.add('overlay-active');
    } else {
      if (tab) switchTab(tab);
      tabsDrawer.style.top = top + 'px';
      tabsDrawer.classList.add('overlay-active');
    }
    document.body.classList.add('overlay-lock');
  };

  trigger.querySelectorAll('.mtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.playlist ? 'playlist' : btn.dataset.tab;
      if (activeType === type) { closeAll(); return; }
      openOverlay(btn.dataset.playlist ? 'playlist' : 'tabs', btn.dataset.tab, btn);
    });
  });

  tabsClose?.addEventListener('click', closeAll);
  playlistClose?.addEventListener('click', closeAll);
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
  initMobileDrawer();
  initMobileSettings();
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
