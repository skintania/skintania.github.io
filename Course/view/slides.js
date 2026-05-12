import { apiFetch, token, API_URL } from '/shared/api.js';
import { formatSize, fileIcon } from '/shared/utils.js';
import { state } from './state.js';

export async function loadSlides(clipKey) {
  const list  = document.getElementById('slideList');
  const badge = document.getElementById('filesBadge');
  if (!list) return;

  const clipSlidesHeader = document.getElementById('clipSlidesHeader');
  if (clipSlidesHeader) clipSlidesHeader.hidden = false;

  list.innerHTML = Array.from({ length: 3 }, () => `
    <div class="slide-item" style="pointer-events:none">
      <span class="skeleton" style="width:22px;height:22px;flex-shrink:0;border-radius:4px"></span>
      <span class="sk-line sk-line--lg skeleton" style="flex:1;margin:0"></span>
    </div>`).join('');
  if (badge) badge.hidden = true;

  try {
    const data = await apiFetch(`/courses/${state.courseId}/slides?clip_key=${encodeURIComponent(clipKey)}`);
    list.innerHTML = '';

    if (!data.success || !data.slides?.length) {
      list.innerHTML = '<div class="tab-coming-soon"><p>ยังไม่มีเอกสารสำหรับคลิปนี้</p></div>';
      return;
    }

    if (badge) { badge.textContent = data.slides.length; badge.hidden = false; }

    for (const slide of data.slides) {
      if (slide.type === 'file') {
        const name     = slide.skdrive_path.split('/').pop();
        const safePath = slide.skdrive_path.split('/').map(encodeURIComponent).join('/');
        const item = document.createElement('div');
        item.className = 'slide-item';
        item.innerHTML = `
          <span class="slide-icon">${fileIcon(slide.skdrive_path)}</span>
          <span class="slide-label">${slide.label}</span>
        `;
        const prevBtn = document.createElement('button');
        prevBtn.className = 'file-prev-btn';
        prevBtn.textContent = 'ดูตัวอย่าง';
        prevBtn.addEventListener('click', () => previewFile(`/skdrive/${safePath}`, name));
        item.appendChild(prevBtn);
        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn file-dl-btn';
        dlBtn.textContent = 'ดาวน์โหลด';
        dlBtn.addEventListener('click', () => downloadFile(`/skdrive/${safePath}`, name, dlBtn));
        item.appendChild(dlBtn);
        list.appendChild(item);
      } else if (slide.type === 'folder') {
        const folderId = `folder-${slide.id}`;
        const folderEl = document.createElement('div');
        folderEl.innerHTML = `
          <div class="slide-folder-header">
            <p class="slide-folder-label">📁 ${slide.label}</p>
            <button class="folder-zip-btn">⬇ ZIP</button>
          </div>
          <div class="slide-folder-files" id="${folderId}">
            <div class="slide-item skeleton-row" style="pointer-events:none">
              <span class="skeleton" style="width:22px;height:22px;flex-shrink:0;border-radius:4px"></span>
              <span class="sk-line sk-line--md skeleton" style="flex:1;margin:0"></span>
            </div>
          </div>
        `;
        list.appendChild(folderEl);
        const zipBtn = folderEl.querySelector('.folder-zip-btn');
        zipBtn.addEventListener('click', () => downloadFolderAsZip(slide.skdrive_path, zipBtn));

        const skData  = await apiFetch(`/skdrive?prefix=${encodeURIComponent(slide.skdrive_path)}`);
        const filesEl = document.getElementById(folderId);
        filesEl.innerHTML = '';

        if (skData.files?.length) {
          skData.files.forEach(f => {
            const safePath = f.key.split('/').map(encodeURIComponent).join('/');
            const item = document.createElement('div');
            item.className = 'slide-item nested';
            item.innerHTML = `
              <span class="slide-icon">${fileIcon(f.contentType || f.key)}</span>
              <span class="slide-label">${f.name}</span>
              <span class="file-size">${formatSize(f.size || 0)}</span>
            `;
            const prevBtn = document.createElement('button');
            prevBtn.className = 'file-prev-btn';
            prevBtn.textContent = 'ดูตัวอย่าง';
            prevBtn.addEventListener('click', () => previewFile(`/skdrive/${safePath}`, f.name));
            item.appendChild(prevBtn);
            const dlBtn = document.createElement('button');
            dlBtn.className = 'btn file-dl-btn';
            dlBtn.textContent = 'ดาวน์โหลด';
            dlBtn.addEventListener('click', () => downloadFile(`/skdrive/${safePath}`, f.name, dlBtn));
            filesEl.appendChild(item);
          });
        } else {
          filesEl.innerHTML = '<p class="comment-empty">โฟลเดอร์ว่าง</p>';
        }
      }
    }
  } catch {
    list.innerHTML = '<p class="comment-empty">ไม่สามารถโหลดเอกสารได้</p>';
  }
}

export async function downloadFile(apiPath, filename, btn) {
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await fetch(`${API_URL}${apiPath}`, {
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

export function closePreview() {
  document.getElementById('filePreviewModal').style.display = 'none';
  document.getElementById('previewModalBody').innerHTML = '';
}

export async function previewFile(apiPath, filename) {
  const modal       = document.getElementById('filePreviewModal');
  const body        = document.getElementById('previewModalBody');
  const nameEl      = document.getElementById('previewFileName');
  const downloadBtn = document.getElementById('previewDownloadBtn');

  modal.style.display = 'flex';
  nameEl.textContent  = filename;
  body.innerHTML = '<div class="skeleton" style="height:220px;border-radius:8px;margin:16px"></div>';
  downloadBtn.onclick = null;

  try {
    const res = await fetch(`${API_URL}${apiPath}`, {
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

export async function downloadFolderAsZip(prefix, btn) {
  const orig = btn.textContent;
  btn.disabled    = true;
  btn.textContent = '...';
  try {
    const res = await fetch(`${API_URL}/skdrive/download?token=${encodeURIComponent(token())}`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prefix }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'ไม่สามารถดาวน์โหลดได้');
      return;
    }
    const blob    = await res.blob();
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    const zipName = prefix.split('/').filter(Boolean).pop() || 'slides';
    a.href         = url;
    a.download     = `${zipName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    alert('ไม่สามารถดาวน์โหลดได้');
  } finally {
    btn.disabled    = false;
    btn.textContent = orig;
  }
}

export function renderSkDriveFolder(prefix, folderName, container) {
  let loaded   = false;
  let expanded = false;

  const folderEl = document.createElement('div');
  folderEl.className = 'skdrive-folder';
  folderEl.innerHTML = `
    <div class="skdrive-folder-header">
      <button class="skdrive-folder-toggle">
        <span class="folder-arrow">▶</span>
        <span class="slide-icon">📁</span>
        <span class="folder-name">${folderName}</span>
      </button>
      <button class="folder-zip-btn">⬇ ZIP</button>
    </div>
    <div class="skdrive-folder-contents">
      <div class="skdrive-folder-inner"></div>
    </div>
  `;
  container.appendChild(folderEl);

  const toggleBtn = folderEl.querySelector('.skdrive-folder-toggle');
  const contents  = folderEl.querySelector('.skdrive-folder-contents');
  const inner     = folderEl.querySelector('.skdrive-folder-inner');
  const zipBtn    = folderEl.querySelector('.folder-zip-btn');

  zipBtn.addEventListener('click', () => downloadFolderAsZip(prefix, zipBtn));

  toggleBtn.addEventListener('click', async () => {
    if (!loaded) {
      loaded   = true;
      expanded = true;
      toggleBtn.classList.add('open');
      contents.classList.add('open');
      inner.innerHTML = `<div class="slide-item" style="pointer-events:none">
        <span class="skeleton" style="width:22px;height:22px;flex-shrink:0;border-radius:4px"></span>
        <span class="sk-line sk-line--md skeleton" style="flex:1;margin:0"></span>
      </div>`;

      const skData = await apiFetch(`/skdrive?prefix=${encodeURIComponent(prefix)}`);
      inner.innerHTML = '';

      let hasContent = false;

      if (skData.files?.length) {
        hasContent = true;
        skData.files.forEach(f => {
          const safePath = f.key.split('/').map(encodeURIComponent).join('/');
          const item = document.createElement('div');
          item.className = 'slide-item nested';
          item.innerHTML = `
            <span class="slide-icon">${fileIcon(f.contentType || f.key)}</span>
            <span class="slide-label">${f.name}</span>
            <span class="file-size">${formatSize(f.size || 0)}</span>
          `;
          const prevBtn = document.createElement('button');
          prevBtn.className = 'file-prev-btn';
          prevBtn.textContent = 'ดูตัวอย่าง';
          prevBtn.addEventListener('click', () => previewFile(`/skdrive/${safePath}`, f.name));
          item.appendChild(prevBtn);
          const dlBtn = document.createElement('button');
          dlBtn.className = 'btn file-dl-btn';
          dlBtn.textContent = 'ดาวน์โหลด';
          dlBtn.addEventListener('click', () => downloadFile(`/skdrive/${safePath}`, f.name, dlBtn));
          item.appendChild(dlBtn);
          inner.appendChild(item);
        });
      }

      if (skData.folders?.length) {
        hasContent = true;
        skData.folders.forEach(sub => {
          const subName = sub.name || sub.key.split('/').filter(Boolean).pop() || sub.key;
          renderSkDriveFolder(sub.key, subName, inner);
        });
      }

      if (!hasContent) {
        inner.innerHTML = '<p class="comment-empty">โฟลเดอร์ว่าง</p>';
      }
    } else {
      expanded = !expanded;
      toggleBtn.classList.toggle('open', expanded);
      contents.classList.toggle('open', expanded);
    }
  });
}

export async function initCourseDocs(course, isAdmin) {
  const section = document.getElementById('courseDocs');
  if (!section) return;
  section.innerHTML = '';

  // ── Syllabus ──
  if (course.syllabus_key) {
    const row = document.createElement('div');
    row.className = 'course-doc-row';
    row.innerHTML = `
      <span class="slide-icon">📋</span>
      <span class="slide-label">ซิลลาบัส</span>
      <div class="doc-row-actions">
        ${isAdmin ? '<button class="btn btn-danger-sm" id="syllabusDeleteBtn">ลบ</button>' : ''}
      </div>
    `;
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn file-dl-btn';
    dlBtn.textContent = 'ดาวน์โหลด';
    const sylSafePath = course.syllabus_key.split('/').map(encodeURIComponent).join('/');
    const sylFilename  = course.syllabus_key.split('/').pop() || 'syllabus';
    dlBtn.addEventListener('click', () => downloadFile(`/skdrive/${sylSafePath}`, sylFilename, dlBtn));
    const sylPrevBtn = document.createElement('button');
    sylPrevBtn.className = 'btn file-prev-btn';
    sylPrevBtn.textContent = 'ดูตัวอย่าง';
    sylPrevBtn.addEventListener('click', () => previewFile(`/skdrive/${sylSafePath}`, sylFilename));
    const actions = row.querySelector('.doc-row-actions');
    actions.prepend(dlBtn);
    actions.prepend(sylPrevBtn);
    section.appendChild(row);

    if (isAdmin) {
      document.getElementById('syllabusDeleteBtn').addEventListener('click', async () => {
        if (!confirm('ลบซิลลาบัสนี้?')) return;
        const res = await apiFetch(`/courses/${state.courseId}/syllabus`, 'DELETE');
        if (res.success) initCourseDocs({ ...course, syllabus_key: null }, isAdmin);
        else alert(res.error || 'เกิดข้อผิดพลาด');
      });
    }
  } else if (isAdmin) {
    const row = document.createElement('div');
    row.className = 'course-doc-row';
    row.innerHTML = `
      <span class="slide-icon">📋</span>
      <span class="slide-label">ซิลลาบัส</span>
      <label class="btn file-dl-btn syllabus-upload-label">
        อัปโหลด
        <input type="file" id="syllabusFileInput" accept=".pdf,.docx,.pptx">
      </label>
    `;
    section.appendChild(row);

    document.getElementById('syllabusFileInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const label = row.querySelector('label');
      label.textContent = 'กำลังอัปโหลด...';
      try {
        const res = await fetch(`${API_URL}/courses/${state.courseId}/syllabus`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': file.type },
          body: file,
        });
        const data = await res.json();
        if (data.success) initCourseDocs({ ...course, syllabus_key: data.syllabus_key }, isAdmin);
        else { alert(data.error || 'เกิดข้อผิดพลาด'); label.textContent = 'อัปโหลด'; }
      } catch {
        alert('ไม่สามารถอัปโหลดได้');
        label.textContent = 'อัปโหลด';
      }
    });
  }

  // ── Course slides_folder ──
  if (course.slides_folder) {
    const prefixes = course.slides_folder.split(',').map(s => s.trim()).filter(Boolean);
    prefixes.forEach(prefix => {
      const folderName = prefix.split('/').filter(Boolean).pop() || prefix;
      renderSkDriveFolder(prefix, folderName, section);
    });
  }
}

export function initAskAI(textOnly = false) {
  const captureBtn    = document.getElementById('captureFrameBtn');
  const frameSection  = captureBtn?.closest('.ask-ai-frame-section');
  const hintEl        = document.querySelector('.ask-ai-hint');
  const canvas        = document.getElementById('aiCanvas');
  const askBtn        = document.getElementById('askAiBtn');
  const questionEl    = document.getElementById('aiQuestion');
  const answerBox     = document.getElementById('aiAnswer');
  const usageEl       = document.getElementById('aiUsage');
  if (!askBtn) return;

  if (textOnly) {
    if (frameSection) frameSection.hidden = true;
    if (hintEl) hintEl.textContent = 'ถามคำถามเกี่ยวกับเนื้อหาในวิดีโอ';
    questionEl.placeholder = 'ถามอะไรก็ได้...';
  } else {
    captureBtn.addEventListener('click', () => {
      const player = document.getElementById('videoPlayer');
      if (!player.src || player.readyState === 0) {
        alert('กรุณาเลือกคลิปก่อน');
        return;
      }
      const ctx = canvas.getContext('2d');
      canvas.width  = player.videoWidth  || 640;
      canvas.height = player.videoHeight || 360;
      ctx.drawImage(player, 0, 0, canvas.width, canvas.height);
      canvas.hidden = false;
      captureBtn.textContent = '🔄 จับภาพใหม่';
    });
  }

  askBtn.addEventListener('click', async () => {
    if (!textOnly && canvas.hidden) { alert('กรุณาจับภาพจากวิดีโอก่อน'); return; }
    const question = questionEl.value.trim();
    if (!question) { questionEl.focus(); return; }

    const body = textOnly ? { question } : {
      image: canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
      question,
    };

    askBtn.disabled    = true;
    askBtn.textContent = 'กำลังถาม...';
    answerBox.hidden   = true;

    try {
      const data = await apiFetch(`/courses/${state.courseId}/ask-ai`, 'POST', body);
      answerBox.textContent = data.success ? data.answer : (data.error || 'เกิดข้อผิดพลาด');
      answerBox.hidden = false;
      if (data.usage) usageEl.textContent = `ใช้ไปแล้ว ${data.usage.used}/${data.usage.limit} ครั้งวันนี้`;
    } catch {
      answerBox.textContent = 'ไม่สามารถเชื่อมต่อได้';
      answerBox.hidden = false;
    } finally {
      askBtn.disabled    = false;
      askBtn.textContent = 'ถามเลย';
    }
  });
}
