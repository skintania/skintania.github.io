import { apiFetch, token, API_URL } from '/shared/api.js';
import { gradientFor } from '/shared/utils.js';
import { state } from './state.js';

let nextCursor = null;
let isLoading  = false;
let _onClipChange = null;

// Sequential thumbnail queue — one request at a time so thumbnails don't
// compete with each other or with the main player.
let _thumbQueue  = [];
let _thumbActive = false;

function enqueueThumb(key, thumbEl) {
  _thumbQueue.push({ key, thumbEl });
  if (!_thumbActive) drainThumbQueue();
}

async function drainThumbQueue() {
  _thumbActive = true;
  const CONCURRENCY = 3;
  const worker = async () => {
    while (_thumbQueue.length > 0) {
      const { key, thumbEl } = _thumbQueue.shift();
      if (thumbEl.isConnected && !thumbEl.querySelector('img')) {
        await loadThumbFromVideo(key, thumbEl);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  _thumbActive = false;
}

function loadThumbFromVideo(key, thumbEl) {
  const savedBg = thumbEl.style.background;
  thumbEl.style.background = '';
  thumbEl.classList.add('skeleton');

  return new Promise(resolve => {
    const url = `${API_URL}/courses/${state.courseId}/clips/${encodeURIComponent(key)}?token=${encodeURIComponent(token())}`;
    const vid = document.createElement('video');
    vid.muted       = true;
    vid.preload     = 'metadata';
    vid.crossOrigin = 'anonymous';
    vid.setAttribute('playsinline', '');
    vid.setAttribute('disablepictureinpicture', '');

    const cleanup = (restoreBg = false) => {
      vid.src = '';
      vid.load();
      thumbEl.classList.remove('skeleton');
      if (restoreBg) thumbEl.style.background = savedBg;
      resolve();
    };

    const tid = setTimeout(() => cleanup(true), 12000);

    vid.addEventListener('loadedmetadata', () => {
      // Seek to 0.01s — hits the first keyframe with the smallest possible
      // range request, vs seeking to 5s which downloads several seconds of data.
      vid.currentTime = 0.01;
    }, { once: true });

    vid.addEventListener('seeked', () => {
      clearTimeout(tid);
      if (!vid.videoWidth) { cleanup(true); return; }
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = vid.videoWidth;
        canvas.height = vid.videoHeight;
        canvas.getContext('2d').drawImage(vid, 0, 0);
        canvas.toBlob(blob => {
          if (!blob || !thumbEl.isConnected) { cleanup(true); return; }
          thumbEl.innerHTML = '';
          const img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;display:block;';
          thumbEl.appendChild(img);
          if (isFinite(vid.duration) && vid.duration > 0) {
            const m = Math.floor(vid.duration / 60);
            const s = String(Math.floor(vid.duration % 60)).padStart(2, '0');
            const badge = document.createElement('span');
            badge.className = 'clip-duration';
            badge.textContent = `${m}:${s}`;
            thumbEl.appendChild(badge);
          }
          cleanup(false);
        }, 'image/jpeg', 0.7);
      } catch {
        cleanup(true);
      }
    }, { once: true });

    vid.addEventListener('error', () => { clearTimeout(tid); cleanup(true); }, { once: true });
    vid.src = url;
  });
}

export function setOnClipChange(cb) {
  _onClipChange = cb;
}

function captureThumbFromPlayer(player, thumbEl, savedBg, captureKey) {
  player.addEventListener('timeupdate', function grab() {
    if (state.activeClipKey !== captureKey) {
      player.removeEventListener('timeupdate', grab);
      return;
    }
    if (player.currentTime > 0.5 && player.videoWidth > 0) {
      player.removeEventListener('timeupdate', grab);
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = player.videoWidth;
        canvas.height = player.videoHeight;
        canvas.getContext('2d').drawImage(player, 0, 0);
        canvas.toBlob(blob => {
          if (!blob || !thumbEl.isConnected) {
            thumbEl.classList.remove('skeleton');
            thumbEl.style.background = savedBg;
            return;
          }
          thumbEl.classList.remove('skeleton');
          thumbEl.style.background = '';
          thumbEl.innerHTML = '';
          const img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;display:block;';
          thumbEl.appendChild(img);
          if (isFinite(player.duration) && player.duration > 0) {
            const m = Math.floor(player.duration / 60);
            const s = String(Math.floor(player.duration % 60)).padStart(2, '0');
            const badge = document.createElement('span');
            badge.className = 'clip-duration';
            badge.textContent = `${m}:${s}`;
            thumbEl.appendChild(badge);
          }
        }, 'image/jpeg', 0.7);
      } catch {
        thumbEl.classList.remove('skeleton');
        thumbEl.style.background = savedBg;
      }
    }
  });
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
  player.crossOrigin = 'anonymous';
  player.src         = url;
  // Lazy-load previewVideo on first seek-bar hover (player.js reads lazySrc)
  previewVideo.dataset.lazySrc = url;
  previewVideo.removeAttribute('src');
  previewVideo.load();

  player.play().catch(() => {
    player.muted = true;
    player.play().catch(() => {});
    document.addEventListener('click', () => { player.muted = false; }, { once: true });
  });

  // Capture this clip's thumbnail from the already-loading main player — free.
  const thumbEl = liEl.querySelector('.clip-thumb-mini');
  if (thumbEl && !thumbEl.querySelector('img')) {
    const savedBg = thumbEl.style.background;
    thumbEl.style.background = '';
    thumbEl.classList.add('skeleton');
    captureThumbFromPlayer(player, thumbEl, savedBg, key);
  }

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

  if (!cursor) {
    clipList.innerHTML = Array.from({ length: 6 }, () => `
      <li class="clip-item" style="pointer-events:none">
        <span class="clip-num skeleton" style="width:18px;height:14px;display:inline-block;border-radius:3px"></span>
        <div class="clip-thumb-mini skeleton"></div>
        <div class="clip-text">
          <span class="sk-line sk-line--lg skeleton"></span>
          <span class="sk-line sk-line--sm skeleton" style="margin-bottom:0"></span>
        </div>
      </li>`).join('');
  }

  const url  = `/courses/${state.courseId}/clips${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`;
  const data = await apiFetch(url);

  isLoading  = false;
  if (!cursor) clipList.innerHTML = '';
  const clips = data.clips || data.files || [];
  nextCursor  = data.nextCursor || data.cursor || null;

  if (!data.success || clips.length === 0) {
    if (!cursor) emptyEl.hidden = false;
    return;
  }

  const offset = clipList.children.length;
  document.getElementById('playlistSub').textContent =
    `Skintania · ${offset + clips.length}${nextCursor ? '+' : ''} คลิป`;

  const thumbsToQueue = [];

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

    // First clip's thumbnail comes from the player canvas capture (free).
    // All others go into the sequential queue after the player has had time to buffer.
    if (idx > 0 || cursor) {
      thumbsToQueue.push({ key, thumbEl: li.querySelector('.clip-thumb-mini') });
    }
  });

  loadMoreBtn.hidden  = !nextCursor;
  loadMoreBtn.onclick = () => loadClips(nextCursor);

  if (!cursor) {
    const first = clipList.querySelector('.clip-item');
    if (first) first.click();
  }

  // Give the main player a 500 ms head-start, then load thumbnails 3 at a time.
  setTimeout(() => {
    thumbsToQueue.forEach(({ key, thumbEl }) => enqueueThumb(key, thumbEl));
  }, 500);
}
