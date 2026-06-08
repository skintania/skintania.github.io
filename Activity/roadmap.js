const TYPE_LABELS = { activity: 'กิจกรรม', exam: 'สอบ', event: 'อีเวนต์' };
const PIN_COLORS  = { activity: '#3b82f6', exam: '#ef4444', event: '#10b981' };

const BADGE_STYLES = {
  activity: 'background:rgba(59,130,246,0.18);color:#60a5fa',
  exam:     'background:rgba(239,68,68,0.18);color:#f87171',
  event:    'background:rgba(16,185,129,0.18);color:#34d399',
};

let roadItems = [];

async function init() {
  try {
    roadItems = await fetch('roadmap.json').then(r => r.json());
    buildRoadmap();
    window.addEventListener('resize', debounce(buildRoadmap, 250));
  } catch {
    document.getElementById('rmScene').innerHTML =
      '<p style="color:#ef4444;text-align:center;padding:80px 0">ไม่สามารถโหลดข้อมูลได้</p>';
  }
}

function buildRoadmap() {
  const scene = document.getElementById('rmScene');
  scene.innerHTML = '';

  const N      = roadItems.length;
  const W      = Math.min(scene.clientWidth || scene.parentElement?.clientWidth || 1100, 1100);
  const mobile = W < 600;
  const perRow = mobile ? 3 : 4;
  const margin = mobile ? 52 : 120;   // left/right road margin
  const rowH   = mobile ? 185 : 260;  // height per snake row
  const co     = mobile ? 48 : 100;   // bezier curve control offset
  const topPad = mobile ? 80 : 130;   // space above road for first-row labels
  const botPad = mobile ? 80 : 130;   // space below road for last-row labels
  const rows   = Math.ceil(N / perRow);
  const svgH   = rows * rowH + topPad + botPad;

  const x1   = margin;
  const x2   = W - margin;
  const yRow = r => r * rowH + rowH / 2 + topPad;

  // ── Build SVG path ──────────────────────────────────────────────
  let d = `M ${x1} ${yRow(0)}`;
  for (let r = 0; r < rows; r++) {
    const goRight = r % 2 === 0;
    const y       = yRow(r);
    const yn      = yRow(r + 1);

    if (goRight) {
      d += ` L ${x2} ${y}`;
      if (r < rows - 1) d += ` C ${x2 + co},${y} ${x2 + co},${yn} ${x2},${yn}`;
    } else {
      d += ` L ${x1} ${y}`;
      if (r < rows - 1) d += ` C ${x1 - co},${y} ${x1 - co},${yn} ${x1},${yn}`;
    }
  }

  // ── Create SVG ───────────────────────────────────────────────────
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width',   W);
  svg.setAttribute('height',  svgH);
  svg.setAttribute('viewBox', `0 0 ${W} ${svgH}`);
  svg.style.cssText = 'display:block;overflow:visible';

  // ── Defs: patterns, filters, gradients ──
  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = `
<filter id="rmGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="rmGlowSm" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="rmBlobBlue" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="rmBlobPurple" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="rmBlobCyan" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>
    </radialGradient>
  `;
  svg.appendChild(defs);

  const el = (tag, attrs) => {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  };

  // Glow blobs
  svg.appendChild(el('ellipse', { cx: W * 0.78, cy: svgH * 0.12, rx: 220, ry: 180, fill: 'url(#rmBlobBlue)' }));
  svg.appendChild(el('ellipse', { cx: W * 0.18, cy: svgH * 0.45, rx: 180, ry: 160, fill: 'url(#rmBlobPurple)' }));
  svg.appendChild(el('ellipse', { cx: W * 0.82, cy: svgH * 0.72, rx: 200, ry: 170, fill: 'url(#rmBlobCyan)' }));
  svg.appendChild(el('ellipse', { cx: W * 0.1,  cy: svgH * 0.88, rx: 140, ry: 130, fill: 'url(#rmBlobBlue)' }));

  // Decorative sparkles (4-point stars)
  const sparkle = (cx, cy, r, opacity) => {
    const s = r * 0.35;
    const p = el('path', {
      d: `M${cx},${cy-r} L${cx+s},${cy-s} L${cx+r},${cy} L${cx+s},${cy+s} L${cx},${cy+r} L${cx-s},${cy+s} L${cx-r},${cy} L${cx-s},${cy-s}Z`,
      fill: `rgba(99,155,255,${opacity})`,
      filter: 'url(#rmGlowSm)',
    });
    return p;
  };
  svg.appendChild(sparkle(W * 0.05, svgH * 0.08, 8, 0.5));
  svg.appendChild(sparkle(W * 0.93, svgH * 0.22, 6, 0.45));
  svg.appendChild(sparkle(W * 0.08, svgH * 0.52, 5, 0.4));
  svg.appendChild(sparkle(W * 0.95, svgH * 0.6,  7, 0.5));
  svg.appendChild(sparkle(W * 0.04, svgH * 0.82, 6, 0.4));
  svg.appendChild(sparkle(W * 0.92, svgH * 0.9,  5, 0.35));
  // Small secondary sparkles
  svg.appendChild(sparkle(W * 0.15, svgH * 0.18, 4, 0.3));
  svg.appendChild(sparkle(W * 0.85, svgH * 0.42, 4, 0.3));
  svg.appendChild(sparkle(W * 0.2,  svgH * 0.75, 3, 0.3));
  svg.appendChild(sparkle(W * 0.78, svgH * 0.95, 3, 0.3));

  const mkPath = (stroke, width, extra) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', String(width));
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    if (extra) Object.entries(extra).forEach(([k, v]) => p.setAttribute(k, v));
    return p;
  };

  // Glowing track + dashed line
  svg.appendChild(mkPath('rgba(59,130,246,0.2)', 14, { filter: 'url(#rmGlow)' }));
  svg.appendChild(mkPath('rgba(59,130,246,0.12)', 10));
  svg.appendChild(mkPath('rgba(59,130,246,0.62)', 2.5, { 'stroke-dasharray': '12 9' }));

  // invisible path used only for measurement
  const mp = document.createElementNS(ns, 'path');
  mp.setAttribute('d', d);
  mp.setAttribute('fill', 'none');
  mp.setAttribute('stroke', 'none');
  svg.appendChild(mp);
  scene.appendChild(svg);

  // ── Milestone labels (Freshy / Sophomore) ───────────────────────
  // "Freshy" — vertical card in left margin, at road start
  {
    const ly  = yRow(0);
    const cw  = mobile ? 48 : 72, ch = mobile ? 58 : 86;
    const lx  = x1 / 2;
    const iR  = mobile ? 11 : 17;
    const iy  = ly - ch / 2 + iR + (mobile ? 9 : 13);
    const t1y = iy + iR + (mobile ? 11 : 16);
    const t2y = t1y + (mobile ? 10 : 14);
    const g = document.createElementNS(ns, 'g');
    g.innerHTML = `
      <line x1="${lx + cw / 2}" y1="${ly}" x2="${x1}" y2="${ly}"
        stroke="rgba(96,165,250,0.55)" stroke-width="2" stroke-dasharray="5 3"/>
      <rect x="${lx - cw / 2}" y="${ly - ch / 2}" width="${cw}" height="${ch}" rx="14"
        fill="rgba(23,52,140,0.45)" stroke="rgba(96,165,250,0.85)" stroke-width="2"
        filter="url(#rmGlow)"/>
      <circle cx="${lx}" cy="${iy}" r="${iR}"
        fill="rgba(59,130,246,0.55)" stroke="rgba(147,197,253,0.9)" stroke-width="1.5"
        filter="url(#rmGlowSm)"/>
      <text x="${lx}" y="${iy + (mobile ? 4.5 : 6)}" text-anchor="middle"
        fill="#fff" font-size="${mobile ? 11 : 16}"
        font-family="Kanit,sans-serif" font-weight="700">★</text>
      <text x="${lx}" y="${t1y}" text-anchor="middle"
        fill="#bfdbfe" font-size="${mobile ? 7 : 9.5}"
        font-family="Kanit,sans-serif" font-weight="700" letter-spacing="0.1em">YEAR 1</text>
      <text x="${lx}" y="${t2y}" text-anchor="middle"
        fill="#93c5fd" font-size="${mobile ? 7.5 : 10}"
        font-family="Kanit,sans-serif" font-weight="700" letter-spacing="0.06em">FRESHY</text>`;
    svg.appendChild(g);
  }

  // "Sophomore" — vertical card on whichever side the road ends
  {
    const lastRow  = rows - 1;
    const goRight  = lastRow % 2 === 0;
    const roadEndX = goRight ? x2 : x1;
    const ly  = yRow(lastRow);
    const cw  = mobile ? 54 : 80, ch = mobile ? 58 : 86;
    const lx  = goRight ? roadEndX + margin / 2 : roadEndX - margin / 2;
    const connX = goRight ? lx - cw / 2 : lx + cw / 2;
    const iR  = mobile ? 11 : 17;
    const iy  = ly - ch / 2 + iR + (mobile ? 9 : 13);
    const t1y = iy + iR + (mobile ? 11 : 16);
    const t2y = t1y + (mobile ? 10 : 14);
    const g = document.createElementNS(ns, 'g');
    g.innerHTML = `
      <line x1="${roadEndX}" y1="${ly}" x2="${connX}" y2="${ly}"
        stroke="rgba(52,211,153,0.55)" stroke-width="2" stroke-dasharray="5 3"/>
      <rect x="${lx - cw / 2}" y="${ly - ch / 2}" width="${cw}" height="${ch}" rx="14"
        fill="rgba(5,60,45,0.5)" stroke="rgba(52,211,153,0.85)" stroke-width="2"
        filter="url(#rmGlow)"/>
      <circle cx="${lx}" cy="${iy}" r="${iR}"
        fill="rgba(16,185,129,0.55)" stroke="rgba(52,211,153,0.9)" stroke-width="1.5"
        filter="url(#rmGlowSm)"/>
      <text x="${lx}" y="${iy + (mobile ? 4.5 : 6)}" text-anchor="middle"
        fill="#fff" font-size="${mobile ? 11 : 16}"
        font-family="Kanit,sans-serif" font-weight="700">★</text>
      <text x="${lx}" y="${t1y}" text-anchor="middle"
        fill="#a7f3d0" font-size="${mobile ? 7 : 9.5}"
        font-family="Kanit,sans-serif" font-weight="700" letter-spacing="0.1em">YEAR 2</text>
      <text x="${lx}" y="${t2y}" text-anchor="middle"
        fill="#34d399" font-size="${mobile ? 7 : 9.5}"
        font-family="Kanit,sans-serif" font-weight="700" letter-spacing="0.04em">SOPHOMORE</text>`;
    svg.appendChild(g);
  }

  // ── Place pins ──────────────────────────────────────────────────
  const total = mp.getTotalLength();
  const now   = new Date();
  let prevMonth = '';

  roadItems.forEach((item, i) => {
    const t   = total * (i + 0.5) / N;
    const pt  = mp.getPointAtLength(t);

    // Month badge when month changes
    if (item.dateShort && item.dateShort !== prevMonth) {
      prevMonth = item.dateShort;
      const above = i % 2 === 0;
      const bx = pt.x;
      const by = above ? pt.y + 20 : pt.y - 20;
      const bw = 38; const bh = 18; const br = 9;
      const g = document.createElementNS(ns, 'g');
      g.innerHTML = `
        <rect x="${bx - bw/2}" y="${by - bh/2}" width="${bw}" height="${bh}" rx="${br}"
          fill="rgba(59,130,246,0.18)" stroke="rgba(59,130,246,0.35)" stroke-width="1"/>
        <text x="${bx}" y="${by + 4}" text-anchor="middle"
          fill="#93c5fd" font-size="10" font-family="Kanit,sans-serif" font-weight="500">${item.dateShort}</text>
      `;
      svg.appendChild(g);
    }
    const clr = PIN_COLORS[item.type] || '#3b82f6';

    // status
    let status = 'future';
    if (item.compareDate) {
      const d2 = new Date(item.compareDate);
      const py = d2.getFullYear() < now.getFullYear();
      const pm = d2.getFullYear() === now.getFullYear() && d2.getMonth() < now.getMonth();
      const cm = d2.getFullYear() === now.getFullYear() && d2.getMonth() === now.getMonth();
      if (py || pm) status = 'past';
      else if (cm)  status = 'current';
    }

    const above = i % 2 === 0;
    const pin   = document.createElement('button');
    pin.className = `rm-pin type-${item.type} status-${status} ${above ? 'pin-above' : 'pin-below'}`;
    pin.style.cssText = `left:${pt.x}px;top:${pt.y}px;--pin-clr:${clr}`;
    pin.setAttribute('aria-label', item.title);
    pin.type = 'button';

    const labelHTML = `
      <div class="rm-pin-label">
        <span class="rm-pin-month">${item.dateShort ?? ''}</span>
        <span class="rm-pin-title">${item.title}</span>
      </div>`;

    const circleHTML = `<div class="rm-pin-circle">${i + 1}</div>`;
    const pointHTML  = `<div class="rm-pin-point"></div>`;

    pin.innerHTML = above
      ? labelHTML + circleHTML + pointHTML
      : pointHTML + circleHTML + labelHTML;

    pin.addEventListener('click', () => openRmModal(item, i + 1, clr));
    scene.appendChild(pin);
  });

  scene.style.height = svgH + 'px';
}

// ── Modal ────────────────────────────────────────────────────────────
const SECTION_META = [
  { key: 'info',     icon: '📋', label: 'ข้อมูล' },
  { key: 'duration', icon: '⏱',  label: 'ระยะเวลา' },
  { key: 'roles',    icon: '👥', label: 'บทบาท' },
  { key: 'tips',     icon: '💡', label: 'คำแนะนำ', tip: true },
];

function openRmModal(item, num, color) {
  const badge = BADGE_STYLES[item.type] ?? '';

  let sections = '';
  if (item.details) {
    SECTION_META.forEach(({ key, icon, label, tip }) => {
      if (!item.details[key]) return;
      sections += `
        <div class="rm-msec${tip ? ' rm-msec--tip' : ''}">
          <div class="rm-msec-label">${icon} ${label}</div>
          <div class="rm-msec-body">${fmt(item.details[key])}</div>
        </div>`;
    });
  }

  document.getElementById('rmModalContent').innerHTML = `
    <div class="rm-mhead" style="--pin-clr:${color};--pin-clr-a:${color}33">
      <div class="rm-mhead-accent"></div>
      <div class="rm-mnum">${num}</div>
      <div class="rm-minfo">
        <span class="rm-mbadge" style="${badge}">${TYPE_LABELS[item.type] ?? item.type}</span>
        <h2 class="rm-mtitle">${item.title}</h2>
        <span class="rm-mdate">${item.dateShort ?? ''}</span>
      </div>
    </div>
    <p class="rm-mdesc">${item.shortDesc}</p>
    ${sections ? `<div class="rm-msections">${sections}</div>` : ''}
  `;

  document.getElementById('rmModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeRmModal() {
  document.getElementById('rmModal').classList.remove('open');
  document.body.style.overflow = '';
}

function fmt(text) {
  return text ? text.trim().replace(/\n/g, '<br>') : '';
}

function debounce(fn, ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRmModal(); });
document.getElementById('rmModal').addEventListener('click', e => {
  if (e.target === document.getElementById('rmModal')) closeRmModal();
});

init();
