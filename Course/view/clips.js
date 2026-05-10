import { apiFetch, token, API_URL } from '/shared/api.js';
import { gradientFor } from '/shared/utils.js';
import { state } from './state.js';

let nextCursor = null;
let isLoading  = false;
let _onClipChange = null;

export function setOnClipChange(cb) {
  _onClipChange = cb;
}

export function loadClipThumbnail(key, thumbEl) {
  const url = `${API_URL}/courses/${state.courseId}/clips/${encodeURIComponent(key)}?token=${encodeURIComponent(token())}`;
  const vid = document.createElement('video');
  vid.muted   = true;
  vid.preload = 'metadata';
  vid.setAttribute('playsinline', '');
  vid.setAttribute('disablepictureinpicture', '');

  let clipDuration = NaN;

  vid.addEventListener('loadedmetadata', () => {
    clipDuration = vid.duration;
    vid.currentTime = Math.min(5, vid.duration * 0.05 || 0);
  }, { once: true });

  vid.addEventListener('seeked', () => {
    vid.pause();
    thumbEl.innerHTML = '';
    vid.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;display:block;';
    thumbEl.appendChild(vid);

    if (isFinite(clipDuration) && clipDuration > 0) {
      const m = Math.floor(clipDuration / 60);
      const s = String(Math.floor(clipDuration % 60)).padStart(2, '0');
      const badge = document.createElement('span');
      badge.className = 'clip-duration';
      badge.textContent = `${m}:${s}`;
      thumbEl.appendChild(badge);
    }
  }, { once: true });

  vid.addEventListener('error', () => {}, { once: true });
  vid.src = url;
}

export function playClip(key, name, liEl) {
  if (state.activeClipKey === key) return;
  state.activeClipKey = key;

  document.querySelectorAll('.clip-item').forEach(el => el.classList.remove('active'));
  liEl.classList.add('active');

  const player       = document.getElementById('videoPlayer');
  const previewVideo = document.getElementById('previewVideo');
  const placeholder  = document.getElementById('playerPlaceholder');
  const url = `${API_URL}/courses/${state.courseId}/clips/${encodeURIComponent(key)}?token=${encodeURIComponent(token())}`;

  placeholder.style.display = 'none';
  player.crossOrigin       = 'anonymous';
  player.src               = url;
  previewVideo.crossOrigin = 'anonymous';
  previewVideo.src         = url;
  previewVideo.load();

  player.play().catch(() => {
    player.muted = true;
    player.play().catch(() => {});
    document.addEventListener('click', () => { player.muted = false; }, { once: true });
  });

  document.getElementById('nowPlayingTitle').textContent = name;
  document.title = `${name} — Skintania`;

  if (_onClipChange) _onClipChange(key);
}

export async function loadClips(cursor = null) {
  if (isLoading) return;
  isLoading = true;

  const clipList    = document.getElementById('clipList');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const emptyEl     = document.getElementById('clipEmpty');

  if (!cursor) clipList.innerHTML = '';

  const url  = `/courses/${state.courseId}/clips${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`;
  const data = await apiFetch(url);

  isLoading  = false;
  const clips = data.clips || data.files || [];
  nextCursor  = data.nextCursor || data.cursor || null;

  if (!data.success || clips.length === 0) {
    if (!cursor) emptyEl.hidden = false;
    return;
  }

  const offset = clipList.children.length;
  document.getElementById('playlistSub').textContent =
    `Skintania · ${offset + clips.length}${nextCursor ? '+' : ''} คลิป`;

  clips.forEach((clip, idx) => {
    const li   = document.createElement('li');
    li.className = 'clip-item';
    const key  = clip.key ?? clip.id ?? String(offset + idx + 1);
    const name = key.split('/').pop().replace(/\.[^.]+$/, '');
    const num  = offset + idx + 1;
    li.dataset.key  = key;
    li.dataset.name = name;

    li.innerHTML = `
      <span class="clip-num">${num}</span>
      <div class="clip-thumb-mini" style="background:${gradientFor(num)}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" opacity="0.75">
          <polygon points="5,3 19,12 5,21"></polygon>
        </svg>
      </div>
      <div class="clip-text">
        <span class="clip-name">${name}</span>
        <span class="clip-channel">Skintania</span>
      </div>
    `;

    li.addEventListener('click', () => playClip(key, name, li));
    clipList.appendChild(li);
    loadClipThumbnail(key, li.querySelector('.clip-thumb-mini'));
  });

  loadMoreBtn.hidden  = !nextCursor;
  loadMoreBtn.onclick = () => loadClips(nextCursor);

  if (!cursor) {
    const first = clipList.querySelector('.clip-item');
    if (first) first.click();
  }
}
