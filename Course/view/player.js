import { state } from './state.js';

export function initControls() {
  const player        = document.getElementById('videoPlayer');
  const playBtn       = document.getElementById('playBtn');
  const playIcon      = document.getElementById('playIcon');
  const pauseIcon     = document.getElementById('pauseIcon');
  const muteBtn       = document.getElementById('muteBtn');
  const volOnIcon     = document.getElementById('volOnIcon');
  const volOffIcon    = document.getElementById('volOffIcon');
  const seekBar       = document.getElementById('seekBar');
  const seekWrap      = document.getElementById('seekWrap');
  const volumeBar     = document.getElementById('volumeBar');
  const timeDisplay   = document.getElementById('timeDisplay');
  const speedToggle   = document.getElementById('speedToggle');
  const speedMenu     = document.getElementById('speedMenu');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const fsEnterIcon   = document.getElementById('fsEnterIcon');
  const fsExitIcon    = document.getElementById('fsExitIcon');
  const playerWrap    = document.getElementById('playerWrap');
  const skipBackBtn   = document.getElementById('skipBackBtn');
  const skipFwdBtn    = document.getElementById('skipFwdBtn');
  const previewVideo  = document.getElementById('previewVideo');
  const seekPreview   = document.getElementById('seekPreview');
  const previewTimeEl = document.getElementById('previewTime');
  const dblLeft       = document.getElementById('dblLeft');
  const dblRight      = document.getElementById('dblRight');

  function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  function syncPlay() {
    playIcon.style.display  = player.paused ? '' : 'none';
    pauseIcon.style.display = player.paused ? 'none' : '';
  }

  function syncVol() {
    const muted = player.muted || player.volume === 0;
    volOnIcon.style.display  = muted ? 'none' : '';
    volOffIcon.style.display = muted ? '' : 'none';
    volumeBar.style.setProperty('--pct', `${muted ? 0 : player.volume * 100}%`);
  }

  playBtn.addEventListener('click', () => player.paused ? player.play() : player.pause());
  player.addEventListener('click',  () => player.paused ? player.play() : player.pause());
  player.addEventListener('play',   syncPlay);
  player.addEventListener('pause',  syncPlay);

  player.addEventListener('timeupdate', () => {
    if (!player.duration) return;
    const pct = (player.currentTime / player.duration) * 100;
    seekBar.value = pct;
    seekBar.style.setProperty('--pct', `${pct}%`);
    timeDisplay.textContent = `${fmt(player.currentTime)} / ${fmt(player.duration)}`;
  });
  player.addEventListener('loadedmetadata', () => {
    timeDisplay.textContent = `0:00 / ${fmt(player.duration)}`;
  });
  seekBar.addEventListener('input', () => {
    if (player.duration) player.currentTime = (seekBar.value / 100) * player.duration;
    seekBar.style.setProperty('--pct', `${seekBar.value}%`);
  });

  volumeBar.addEventListener('input', () => {
    player.volume = parseFloat(volumeBar.value);
    player.muted  = player.volume === 0;
    syncVol();
  });
  muteBtn.addEventListener('click', () => {
    player.muted = !player.muted;
    if (!player.muted && player.volume === 0) player.volume = 0.5;
    volumeBar.value = player.muted ? 0 : player.volume;
    syncVol();
  });
  player.addEventListener('volumechange', syncVol);

  speedToggle.addEventListener('click', e => { e.stopPropagation(); speedMenu.classList.toggle('open'); });
  document.addEventListener('click', () => speedMenu.classList.remove('open'));
  speedMenu.querySelectorAll('.speed-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      player.playbackRate = parseFloat(opt.dataset.speed);
      speedToggle.textContent = opt.textContent;
      speedMenu.querySelectorAll('.speed-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      speedMenu.classList.remove('open');
    });
  });

  const enterFs = el => el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.();
  const exitFs  = () => document.exitFullscreen?.() ?? document.webkitExitFullscreen?.();
  const getFs   = () => document.fullscreenElement ?? document.webkitFullscreenElement;

  fullscreenBtn.addEventListener('click', () => getFs() ? exitFs() : enterFs(playerWrap));
  const onFsChange = () => {
    const fs = !!getFs();
    fsEnterIcon.style.display = fs ? 'none' : '';
    fsExitIcon.style.display  = fs ? '' : 'none';
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  skipBackBtn.addEventListener('click', () => {
    player.currentTime = Math.max(0, player.currentTime - 10);
  });
  skipFwdBtn.addEventListener('click', () => {
    player.currentTime = Math.min(player.duration || 0, player.currentTime + 10);
  });

  const PREVIEW_W = 160;
  let previewSeeking = false;

  function showSeekPreview() {
    if (!player.src || !isFinite(player.duration)) return;
    // Lazy-load previewVideo on first hover — avoids competing with main player on clip start
    const pending = previewVideo.dataset.lazySrc;
    if (pending && previewVideo.dataset.loadedSrc !== pending) {
      previewVideo.dataset.loadedSrc = pending;
      previewVideo.crossOrigin = 'anonymous';
      previewVideo.src = pending;
    }
    seekPreview.style.display = 'flex';
  }
  function hideSeekPreview() {
    seekPreview.style.display = 'none';
    previewSeeking = false;
  }
  function updatePreview(clientX, time) {
    if (!isFinite(player.duration) || !previewVideo.src) return;
    const wrapRect = seekWrap.getBoundingClientRect();
    const raw  = clientX - wrapRect.left - PREVIEW_W / 2;
    const left = Math.max(0, Math.min(wrapRect.width - PREVIEW_W, raw));
    seekPreview.style.left = `${left}px`;
    previewTimeEl.textContent = fmt(time);
    if (!previewSeeking) {
      previewSeeking = true;
      previewVideo.currentTime = time;
    }
  }

  seekBar.addEventListener('mouseenter', showSeekPreview);
  seekBar.addEventListener('mouseleave', hideSeekPreview);
  seekBar.addEventListener('mousemove', e => {
    const rect = seekBar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    updatePreview(e.clientX, pct * player.duration);
  });
  seekBar.addEventListener('touchstart', showSeekPreview, { passive: true });
  seekBar.addEventListener('touchend', () => setTimeout(hideSeekPreview, 400), { passive: true });
  seekBar.addEventListener('touchmove', e => {
    const touch = e.touches[0];
    const rect  = seekBar.getBoundingClientRect();
    const pct   = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    updatePreview(touch.clientX, pct * player.duration);
  }, { passive: true });
  previewVideo.addEventListener('seeked', () => { previewSeeking = false; });

  function showTapIndicator(side) {
    const el = side === 'left' ? dblLeft : dblRight;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
  }

  let lastTapTime   = 0;
  let tapTimeoutId  = null;
  let controlsTimer = null;

  const videoControls = playerWrap.querySelector('.video-controls');

  function showControls() {
    playerWrap.classList.add('touch-active');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => playerWrap.classList.remove('touch-active'), 3000);
  }

  // Show controls immediately on any touch within the player
  playerWrap.addEventListener('touchstart', showControls, { passive: true });
  if (videoControls) {
    videoControls.addEventListener('touchstart', showControls, { passive: true });
  }

  playerWrap.addEventListener('touchend', e => {
    if (e.target.closest('.video-controls')) return;
    e.preventDefault();
    showControls();
    const now = Date.now();
    const gap = now - lastTapTime;
    if (gap < 300 && gap > 0) {
      clearTimeout(tapTimeoutId);
      lastTapTime = 0;
      const { left, width } = playerWrap.getBoundingClientRect();
      if (e.changedTouches[0].clientX < left + width / 2) {
        player.currentTime = Math.max(0, player.currentTime - 10);
        showTapIndicator('left');
      } else {
        player.currentTime = Math.min(player.duration || 0, player.currentTime + 10);
        showTapIndicator('right');
      }
    } else {
      lastTapTime = now;
      tapTimeoutId = setTimeout(() => {
        player.paused ? player.play() : player.pause();
      }, 300);
    }
  }, { passive: false });

  syncPlay();
  syncVol();
  return player;
}

function loadYTApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise(resolve => {
    window.onYouTubeIframeAPIReady = resolve;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
}

let _collectionStateResolve = null;
let _userQuality = 'auto';

async function getPlaylistVideoIds(ytPlayer, playlistId) {
  ytPlayer.mute();
  // Force player to -1 (unstarted) so the -1 → 5 transition always fires onStateChange
  ytPlayer.stopVideo();
  await new Promise(r => setTimeout(r, 300));

  const cued = new Promise(resolve => { _collectionStateResolve = resolve; });
  ytPlayer.cuePlaylist({ list: playlistId, listType: 'playlist' });

  await Promise.race([cued, new Promise(r => setTimeout(r, 8000))]);
  _collectionStateResolve = null;

  await new Promise(r => setTimeout(r, 100)); // brief settle before reading
  const ids = ytPlayer.getPlaylist?.() || [];
  console.log('[YT] got', ids.length, 'ids for', playlistId);
  return ids;
}

async function fetchVideoTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return null;
    const d = await res.json();
    return d.title || null;
  } catch { return null; }
}

function initYouTubeControls(ytPlayer) {
  const playBtn       = document.getElementById('playBtn');
  const playIcon      = document.getElementById('playIcon');
  const pauseIcon     = document.getElementById('pauseIcon');
  const muteBtn       = document.getElementById('muteBtn');
  const volOnIcon     = document.getElementById('volOnIcon');
  const volOffIcon    = document.getElementById('volOffIcon');
  const seekBar       = document.getElementById('seekBar');
  const volumeBar     = document.getElementById('volumeBar');
  const timeDisplay   = document.getElementById('timeDisplay');
  const speedToggle   = document.getElementById('speedToggle');
  const speedMenu     = document.getElementById('speedMenu');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const fsEnterIcon   = document.getElementById('fsEnterIcon');
  const fsExitIcon    = document.getElementById('fsExitIcon');
  const playerWrap    = document.getElementById('playerWrap');
  const skipBackBtn   = document.getElementById('skipBackBtn');
  const skipFwdBtn    = document.getElementById('skipFwdBtn');
  const qualityWrap   = document.getElementById('qualityWrap');
  const qualityToggle = document.getElementById('qualityToggle');
  const qualityMenu   = document.getElementById('qualityMenu');

  const QUALITY_LABELS = {
    hd1080: '1080p', hd720: '720p', large: '480p',
    medium: '360p',  small: '240p', tiny: '144p', auto: 'Auto',
  };

  function syncQuality() {
    qualityToggle.textContent = QUALITY_LABELS[_userQuality] || 'Auto';
    qualityMenu.querySelectorAll('.quality-opt').forEach(o =>
      o.classList.toggle('active', o.dataset.quality === _userQuality));
  }

  function applyQuality() {
    if (_userQuality !== 'auto') ytPlayer.setPlaybackQuality(_userQuality);
  }

  qualityWrap.hidden = false;
  qualityToggle.addEventListener('click', e => { e.stopPropagation(); qualityMenu.classList.toggle('open'); });
  qualityMenu.querySelectorAll('.quality-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      _userQuality = opt.dataset.quality;
      applyQuality();
      syncQuality();
      qualityMenu.classList.remove('open');
    });
  });

  function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  function syncPlay(playerState) {
    const playing = (playerState ?? ytPlayer.getPlayerState()) === 1;
    playIcon.style.display  = playing ? 'none' : '';
    pauseIcon.style.display = playing ? '' : 'none';
  }

  function syncVol() {
    const muted = ytPlayer.isMuted();
    const vol   = ytPlayer.getVolume();
    volOnIcon.style.display  = muted || vol === 0 ? 'none' : '';
    volOffIcon.style.display = muted || vol === 0 ? '' : 'none';
    volumeBar.value = (muted ? 0 : vol) / 100;
    volumeBar.style.setProperty('--pct', `${muted ? 0 : vol}%`);
  }

  playBtn.addEventListener('click', () =>
    ytPlayer.getPlayerState() === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo());

  muteBtn.addEventListener('click', () => {
    ytPlayer.isMuted() ? ytPlayer.unMute() : ytPlayer.mute();
    syncVol();
  });

  volumeBar.addEventListener('input', () => {
    const vol = Math.round(parseFloat(volumeBar.value) * 100);
    ytPlayer.setVolume(vol);
    vol === 0 ? ytPlayer.mute() : ytPlayer.unMute();
    syncVol();
  });

  seekBar.addEventListener('input', () => {
    const dur = ytPlayer.getDuration();
    if (dur) ytPlayer.seekTo((seekBar.value / 100) * dur, true);
    seekBar.style.setProperty('--pct', `${seekBar.value}%`);
  });

  skipBackBtn.addEventListener('click', () => ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() - 10), true));
  skipFwdBtn.addEventListener('click',  () => ytPlayer.seekTo(Math.min(ytPlayer.getDuration() || 0, ytPlayer.getCurrentTime() + 10), true));

  speedToggle.addEventListener('click', e => { e.stopPropagation(); speedMenu.classList.toggle('open'); });
  document.addEventListener('click', () => { speedMenu.classList.remove('open'); qualityMenu.classList.remove('open'); });
  speedMenu.querySelectorAll('.speed-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      ytPlayer.setPlaybackRate(parseFloat(opt.dataset.speed));
      speedToggle.textContent = opt.textContent;
      speedMenu.querySelectorAll('.speed-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      speedMenu.classList.remove('open');
    });
  });

  const enterFs = el => el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.();
  const exitFs  = () => document.exitFullscreen?.() ?? document.webkitExitFullscreen?.();
  const getFs   = () => document.fullscreenElement ?? document.webkitFullscreenElement;
  fullscreenBtn.addEventListener('click', () => getFs() ? exitFs() : enterFs(playerWrap));
  const onFsChange = () => {
    const fs = !!getFs();
    fsEnterIcon.style.display = fs ? 'none' : '';
    fsExitIcon.style.display  = fs ? '' : 'none';
  };
  document.addEventListener('fullscreenchange',       onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  const pollId = setInterval(() => {
    try {
      const cur = ytPlayer.getCurrentTime();
      const dur = ytPlayer.getDuration();
      if (dur) {
        const pct = (cur / dur) * 100;
        seekBar.value = pct;
        seekBar.style.setProperty('--pct', `${pct}%`);
        timeDisplay.textContent = `${fmt(cur)} / ${fmt(dur)}`;
      }
    } catch {}
  }, 500);

  syncPlay();
  syncVol();
  syncQuality();

  // Transparent overlay to capture touch events (iframe swallows them otherwise)
  const dblLeft  = document.getElementById('dblLeft');
  const dblRight = document.getElementById('dblRight');
  const overlay  = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;z-index:5;touch-action:none;';
  playerWrap.appendChild(overlay);

  let ytCtTimer  = null;
  let ytLastTap  = 0;
  let ytTapTimer = null;

  function showYTControls() {
    playerWrap.classList.add('touch-active');
    clearTimeout(ytCtTimer);
    ytCtTimer = setTimeout(() => playerWrap.classList.remove('touch-active'), 3000);
  }

  function showYTTapIndicator(side) {
    const el = side === 'left' ? dblLeft : dblRight;
    if (!el) return;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
  }

  overlay.addEventListener('touchstart', showYTControls, { passive: true });
  overlay.addEventListener('touchend', e => {
    e.preventDefault();
    const now = Date.now();
    const gap = now - ytLastTap;
    if (gap < 300 && gap > 0) {
      clearTimeout(ytTapTimer);
      ytLastTap = 0;
      const { left, width } = playerWrap.getBoundingClientRect();
      if (e.changedTouches[0].clientX < left + width / 2) {
        ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() - 10), true);
        showYTTapIndicator('left');
      } else {
        ytPlayer.seekTo(Math.min(ytPlayer.getDuration() || 0, ytPlayer.getCurrentTime() + 10), true);
        showYTTapIndicator('right');
      }
    } else {
      ytLastTap = now;
      ytTapTimer = setTimeout(() => {
        ytPlayer.getPlayerState() === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
      }, 300);
    }
  }, { passive: false });

  const videoControls = playerWrap.querySelector('.video-controls');
  if (videoControls) {
    videoControls.addEventListener('touchstart', showYTControls, { passive: true });
  }

  return {
    onStateChange:           playerState => { syncPlay(playerState); if (playerState === 1) applyQuality(); },
    onPlaybackQualityChange: ()          => applyQuality(),
    destroy:                 ()          => { clearInterval(pollId); overlay.remove(); },
  };
}

export async function initYouTubeMode(playlistIds, onClipChange) {
  await loadYTApi();
  _userQuality = 'auto';

  const clipList   = document.getElementById('clipList');
  const videoEls   = {};
  let currentVideoId = null;
  let ytControls     = null;
  let isCollecting   = true;

  function updateActiveYTClip(videoId, title) {
    document.querySelectorAll('.clip-item').forEach(el => el.classList.remove('active'));
    const li = videoEls[videoId];
    if (li) { li.classList.add('active'); li.scrollIntoView({ block: 'nearest' }); }
    const t = title || document.getElementById(`yt-title-${videoId}`)?.textContent || videoId;
    document.getElementById('nowPlayingTitle').textContent = t;
    document.title = `${t} — Skintania`;
    state.activeClipKey = videoId;
    onClipChange(videoId);
  }

  const ytPlayer = await new Promise(resolve => {
    new YT.Player('ytPlayer', {
      width: '100%',
      height: '100%',
      playerVars: {
        controls: 0, rel: 0, modestbranding: 1,
        enablejsapi: 1, iv_load_policy: 3,
      },
      events: {
        onReady: e => { console.log('[YT] Player ready'); resolve(e.target); },
        onError: e => console.error('[YT] Player error code:', e.data),
        onStateChange: e => {
          if (isCollecting) {
            if (e.data === 5 && _collectionStateResolve) {
              const r = _collectionStateResolve;
              _collectionStateResolve = null;
              r();
            }
            return;
          }
          if (ytControls) ytControls.onStateChange(e.data);
          if (e.data === 1 || e.data === 2) {  // PLAYING or PAUSED
            const vdata = e.target.getVideoData();
            const vid   = vdata?.video_id;
            if (vid && vid !== currentVideoId) {
              currentVideoId = vid;
              updateActiveYTClip(vid, vdata.title);
              if (vdata.title) {
                const el = document.getElementById(`yt-title-${vid}`);
                if (el) el.textContent = vdata.title;
              }
            }
          }
        },
        onPlaybackQualityChange: () => {
          if (!isCollecting && ytControls) ytControls.onPlaybackQualityChange();
        },
      },
    });
  });

  // Collect video IDs from all playlists
  clipList.innerHTML = '';
  const allVideoIds = [];
  let prevIds = [];

  for (let pi = 0; pi < playlistIds.length; pi++) {
    const ids = await getPlaylistVideoIds(ytPlayer, playlistIds[pi], prevIds);
    prevIds = ids;

    if (playlistIds.length > 1) {
      const header = document.createElement('li');
      header.className   = 'clip-playlist-section';
      header.textContent = `ชุดที่ ${pi + 1}`;
      clipList.appendChild(header);
    }

    ids.forEach(videoId => {
      const num = allVideoIds.length + 1;
      allVideoIds.push(videoId);

      const li = document.createElement('li');
      li.className = 'clip-item';
      li.dataset.videoId = videoId;
      li.innerHTML = `
        <span class="clip-num">${num}</span>
        <div class="clip-thumb-mini yt-thumb">
          <img src="https://i.ytimg.com/vi/${videoId}/mqdefault.jpg" alt="" loading="lazy">
        </div>
        <div class="clip-text">
          <span class="clip-name" id="yt-title-${videoId}">กำลังโหลด...</span>
          <span class="clip-channel">Skintania</span>
        </div>
      `;
      li.addEventListener('click', () => ytPlayer.loadVideoById(videoId));
      clipList.appendChild(li);
      videoEls[videoId] = li;
    });
  }

  // Done collecting — stop the muted pre-load and hand control back
  isCollecting = false;
  ytPlayer.stopVideo();
  ytPlayer.unMute();

  document.getElementById('loadMoreBtn').hidden = true;
  document.getElementById('playlistSub').textContent =
    `Skintania · ${allVideoIds.length} คลิป`;

  if (allVideoIds.length === 0) {
    clipList.innerHTML = '<li style="padding:16px;font-size:.85rem;color:var(--muted);text-align:center">ไม่พบวิดีโอในเพลย์ลิสต์</li>';
    return;
  }

  document.getElementById('playerPlaceholder').style.display = 'none';
  ytPlayer.loadVideoById(allVideoIds[0]);

  ytControls = initYouTubeControls(ytPlayer);

  // Fetch titles in background via oEmbed
  allVideoIds.forEach(videoId => {
    fetchVideoTitle(videoId).then(title => {
      if (!title) return;
      const el = document.getElementById(`yt-title-${videoId}`);
      if (el && el.textContent === 'กำลังโหลด...') el.textContent = title;
    });
  });
}
