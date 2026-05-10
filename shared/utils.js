export const GRADIENTS = [
  ['#1a3a6b', '#3b82f6'], ['#1a4a3a', '#10b981'],
  ['#3b1a6b', '#8b5cf6'], ['#6b3a1a', '#f59e0b'],
  ['#1a3a6b', '#06b6d4'], ['#6b1a3a', '#ec4899'],
  ['#2d4a1a', '#84cc16'], ['#1a2a6b', '#6366f1'],
];

export function gradientFor(n) {
  const [a, b] = GRADIENTS[n % GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'เมื่อกี้';
  if (m < 60)  return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} ชั่วโมงที่แล้ว`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d} วันที่แล้ว`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} เดือนที่แล้ว`;
  return `${Math.floor(mo / 12)} ปีที่แล้ว`;
}

export function formatSize(bytes) {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function fileIcon(t = '') {
  const s = t.toLowerCase();
  if (s.includes('pdf')  || s.endsWith('.pdf'))           return '📕';
  if (s.includes('zip')  || s.endsWith('.zip'))           return '🗜️';
  if (s.includes('presentation') || /\.pptx?$/.test(s))  return '📊';
  if (s.includes('spreadsheet')  || /\.xlsx?$/.test(s))  return '📗';
  if (s.includes('word')         || /\.docx?$/.test(s))  return '📘';
  if (s.startsWith('image/')     || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(s)) return '🖼️';
  return '📄';
}
