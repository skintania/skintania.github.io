import { API_URL, token } from '/shared/api.js';

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
