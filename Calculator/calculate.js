import { CONFIG } from '/config.js';
import { getHistory } from '/Calculator/historyCache.js';

const getToken = () => localStorage.getItem('authToken') || '';

function apiFetch(path, options = {}) {
    return fetch(`${CONFIG.API_URL}${path}`, {
        ...options,
        headers: { 'Authorization': `Bearer ${getToken()}`, ...options.headers },
    });
}

// ── Normal distribution helpers ───────────────────────────
function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    const a = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * a);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return sign * y;
}

function normalCDF(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

function chanceFromNormal(score, min, max) {
    if (max <= min) return null;
    const mean = (max + min) / 2;
    const std  = (max - min) / 4;
    return Math.min(100, Math.max(0, normalCDF((score - mean) / std) * 100));
}

// ── Multi-year weighted chance (selected department) ──────
// Normalises scores by fullScore each year so different-scale
// years are comparable, then applies exponential recency weight.
function computeWeightedChance(admScore, admFullScore, department, history) {
    const years = Object.keys(history).map(Number).sort();
    const latestYear = years[years.length - 1];

    let weightedSum = 0;
    let totalWeight  = 0;

    for (const year of years) {
        const d = history[String(year)]?.[department];
        if (!d?.fullScore || d.minScore == null || d.maxScore == null) continue;

        const normScore = admScore   / admFullScore;
        const normMin   = d.minScore / d.fullScore;
        const normMax   = d.maxScore / d.fullScore;

        const chance = chanceFromNormal(normScore, normMin, normMax);
        if (chance === null) continue;

        const weight = Math.exp((year - latestYear) / 3);
        weightedSum += chance * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : null;
}

// ── Apply normal CDF to allDepartments linear chances ─────
// The API gives a linear-interpolation chance for each dept.
// We convert the linear position t ∈ [0,1] to a z-score
// (assuming std = 0.25 × range) and run it through normalCDF.
function improveLinearChance(linearPct) {
    if (linearPct == null) return null;
    const z = (linearPct / 100 - 0.5) * 4;
    return Number(Math.min(100, Math.max(0, normalCDF(z) * 100)).toFixed(2));
}

// ── DOM helpers ───────────────────────────────────────────
function getGradesFromDOM() {
    const grades = [];
    document.querySelectorAll('.grade-list-item').forEach(item => {
        const subject = item.querySelector('.grade-course-name')?.innerText?.trim();
        const activePill = item.querySelector('.grade-pill.active');
        if (!subject || !activePill) return;
        const val = activePill.getAttribute('data-value');
        if (val !== null && val !== '') {
            grades.push({ subject, grade: parseFloat(val) });
        }
    });
    return grades;
}

function setDropdownValue(item, gradeValue) {
    item.querySelectorAll('.grade-pill').forEach(pill => {
        pill.classList.toggle('active', parseFloat(pill.getAttribute('data-value')) === gradeValue);
    });
}

function updateResultUI({ gpax, admScore, admFullScore, chancePercent, allDepartments }, history) {
    const percent = chancePercent ?? 0;

    const chanceTextEl  = document.querySelector('.chance-text');
    const circleEl      = document.querySelector('.chance-circle');
    const scoreTextEls  = document.querySelectorAll('.score-text');
    const statusEl      = document.querySelector('.status-message');
    const deptTableBody = document.querySelector('#deptChanceTable tbody');

    if (chanceTextEl) chanceTextEl.innerText = `${percent.toFixed(2)} %`;
    if (circleEl) circleEl.style.setProperty('--percentage', `${percent.toFixed(2)}%`);

    if (scoreTextEls[0]) scoreTextEls[0].innerText = `GPAX: ${Number(gpax).toFixed(2)}`;
    if (scoreTextEls[1]) {
        const pct = admFullScore ? ((admScore / admFullScore) * 100).toFixed(2) : '0.00';
        scoreTextEls[1].innerText =
            `Score: ${Number(admScore).toFixed(1)} / ${Number(admFullScore).toFixed(1)} (${pct}%)`;
    }

    if (statusEl) {
        let message, cls;
        if (chancePercent == null) { message = 'ไม่มีข้อมูล';        cls = 'error'; }
        else if (percent >= 100)   { message = 'Guaranteed!';          cls = 'success'; }
        else if (percent >= 80)    { message = 'Very high chance';     cls = 'success'; }
        else if (percent >= 60)    { message = 'High chance';          cls = 'warning'; }
        else if (percent >= 40)    { message = 'Could try';            cls = 'warning'; }
        else if (percent >= 20)    { message = 'Low chance';           cls = 'error'; }
        else if (percent > 0)      { message = 'Extremely low chance'; cls = 'error'; }
        else                       { message = 'No chance';            cls = 'error'; }
        statusEl.className = `status-message ${cls}`;
        statusEl.innerText = message;
    }

    if (deptTableBody && Array.isArray(allDepartments)) {
        deptTableBody.innerHTML = '';
        allDepartments.forEach(({ department, name, minScore, maxScore, chance }) => {
            // Use API chance when it's a meaningful value; otherwise compute per-department
            let displayChance = (chance != null && chance < 100) ? improveLinearChance(chance) : null;
            if (displayChance == null && history && admScore != null && admFullScore && maxScore > minScore) {
                const years = Object.keys(history).sort();
                const latestYear = years[years.length - 1];
                const deptHist = history[latestYear]?.[department];
                if (deptHist?.fullScore) {
                    const approxScore = (admScore / admFullScore) * deptHist.fullScore;
                    const linear = Math.min(100, Math.max(0,
                        (approxScore - minScore) / (maxScore - minScore) * 100));
                    displayChance = improveLinearChance(linear);
                }
            }
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${name ?? department} (${department})</td>
                <td>${minScore != null ? minScore : '-'}</td>
                <td>${maxScore != null ? maxScore : '-'}</td>
                <td class="chance">${displayChance != null ? displayChance.toFixed(1) + '%' : '-'}</td>
            `;
            deptTableBody.appendChild(row);
        });
    }
}

async function loadSavedGrades() {
    try {
        const res = await apiFetch('/calculator/grades');
        if (!res.ok) return;
        const { grades } = await res.json();
        if (!Array.isArray(grades)) return;
        const gradeMap = Object.fromEntries(grades.map(g => [g.subject, g.grade]));
        document.querySelectorAll('.grade-list-item').forEach(item => {
            const subject = item.querySelector('.grade-course-name')?.innerText?.trim();
            if (subject && gradeMap[subject] != null) {
                setDropdownValue(item, gradeMap[subject]);
            }
        });
    } catch { /* silent */ }
}

// ── Predict Feature (ชั่วคราว 2568) ────────────────────────
const DEPARTMENTS = [
    { code: 'CE',  name: 'วิศวกรรมโยธา (CE)' },
    { code: 'EE',  name: 'วิศวกรรมไฟฟ้า (EE)' },
    { code: 'ME',  name: 'วิศวกรรมเครื่องกล (ME)' },
    { code: 'AE',  name: 'วิศวกรรมยานยนต์ (AE)' },
    { code: 'IE',  name: 'วิศวกรรมอุตสาหการ (IE)' },
    { code: 'CHE', name: 'วิศวกรรมเคมี (CHE)' },
    { code: 'PE',  name: 'วิศวกรรมปิโตรเลียม (PE)' },
    { code: 'GE',  name: 'วิศวกรรมเหมืองแร่ (GE)' },
    { code: 'ENV', name: 'วิศวกรรมสิ่งแวดล้อม (ENV)' },
    { code: 'SV',  name: 'วิศวกรรมสำรวจ (SV)' },
    { code: 'MT',  name: 'วิศวกรรมโลหะการและวัสดุ (MT)' },
    { code: 'CP',  name: 'วิศวกรรมคอมพิวเตอร์ (CP)' },
    { code: 'NT',  name: 'วิศวกรรมนิวเคลียร์ (NT)' },
];

let prefOrder = DEPARTMENTS.map(d => ({ ...d, excluded: false }));
let dragSrcIndex = null;

function buildPrefList() {
    const list = document.getElementById('prefList');
    list.innerHTML = '';

    prefOrder.forEach((dept, i) => {
        const li = document.createElement('li');
        li.className = 'pref-item' + (dept.excluded ? ' excluded' : '');
        li.draggable = true;

        li.innerHTML = `
            <span class="drag-handle">⠿</span>
            <span class="pref-rank">${i + 1}</span>
            <span class="pref-name">${dept.name}</span>
            <button class="pref-toggle" type="button">${dept.excluded ? '＋' : '✕'}</button>
        `;

        li.querySelector('.pref-toggle').addEventListener('click', () => {
            prefOrder[i].excluded = !prefOrder[i].excluded;
            buildPrefList();
        });

        li.addEventListener('dragstart', e => {
            dragSrcIndex = i;
            li.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(i));
        });

        li.addEventListener('dragover', e => { e.preventDefault(); });

        li.addEventListener('dragenter', () => {
            if (dragSrcIndex !== i) li.classList.add('drag-over');
        });

        li.addEventListener('dragleave', e => {
            if (!li.contains(e.relatedTarget)) li.classList.remove('drag-over');
        });

        li.addEventListener('drop', e => {
            e.preventDefault();
            if (dragSrcIndex !== null && dragSrcIndex !== i) {
                const [moved] = prefOrder.splice(dragSrcIndex, 1);
                prefOrder.splice(i, 0, moved);
                buildPrefList();
            }
        });

        li.addEventListener('dragend', () => {
            document.querySelectorAll('#prefList .pref-item').forEach(el => {
                el.classList.remove('dragging', 'drag-over');
            });
            dragSrcIndex = null;
        });

        list.appendChild(li);
    });
}

function showPredictResult(data) {
    const card = document.getElementById('predictResultCard');
    const content = document.getElementById('predictResultContent');
    card.hidden = false;
    document.getElementById('regularResultCard').hidden = true;
    content.innerHTML = '';

    const predicted = data.predictedDepartment;
    const preferredDepts = prefOrder
        .map(p => data.allDepartments?.find(d => d.department === p.code))
        .filter(d => d?.estimatedProbability != null);

    if (predicted) {
        const local = DEPARTMENTS.find(d => d.code === predicted);
        const banner = document.createElement('div');
        banner.className = 'predict-winner-banner';
        banner.innerHTML = `
            <p class="predict-winner-label">ภาคที่คาดว่าจะได้</p>
            <p class="predict-winner-dept">${local?.name ?? predicted}</p>
        `;
        content.appendChild(banner);
    }

    if (preferredDepts.length) {
        const wrap = document.createElement('div');
        wrap.style.overflowX = 'auto';
        const rows = preferredDepts.map((d, i) => {
            const isPredicted = d.department === predicted;
            const localName = DEPARTMENTS.find(x => x.code === d.department)?.name ?? d.department;
            return `<tr${isPredicted ? ' class="predicted-row"' : ''}>
                <td>${i + 1}</td>
                <td>${localName}</td>
                <td><strong>${d.estimatedProbability.toFixed(1)}%</strong></td>
                <td>${d.capacity ?? '-'}</td>
            </tr>`;
        }).join('');
        wrap.innerHTML = `
            <table id="predictDeptTable">
                <thead><tr>
                    <th>ลำดับ</th><th>ภาค</th><th>โอกาสได้จริง</th><th>ที่นั่ง</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        content.appendChild(wrap);

        const note = document.createElement('p');
        note.style.cssText = 'color:var(--muted,#9aa4b2);font-size:0.82rem;margin-top:12px;text-align:center;';
        note.textContent = '* โอกาสได้จริง = โอกาสหลังหักความเป็นไปได้ที่จะได้ภาคลำดับสูงกว่า';
        content.appendChild(note);
    }

    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Department Selection Countdown ──────────────────────────
const DEPT_EVENTS = [
    {
        label: 'ตรวจสอบรายชื่อและประกาศอันดับ (Ranking)',
        dateText: '22 มิ.ย. 2569',
        start: new Date('2026-06-22'),
        end:   new Date('2026-06-23'),
    },
    {
        label: 'แจ้งเปลี่ยนแปลงผลการศึกษา (นิสิต M|X)',
        dateText: '22–26 มิ.ย. 2569',
        start: new Date('2026-06-22'),
        end:   new Date('2026-06-27'),
    },
    {
        label: 'แสดงความจำนงเลือกลำดับสาขาวิชา',
        dateText: '29 มิ.ย. – 3 ก.ค. 2569',
        start: new Date('2026-06-29'),
        end:   new Date('2026-07-04'),
    },
    {
        label: 'นำผลเสนอคณะกรรมการบริหารคณะฯ',
        dateText: '15 ก.ค. 2569',
        start: new Date('2026-07-15'),
        end:   new Date('2026-07-16'),
    },
    {
        label: 'ประกาศผลการเลือกสาขาวิชา',
        dateText: '17 ก.ค. 2569',
        start: new Date('2026-07-17'),
        end:   new Date('2026-07-18'),
    },
];

function initCountdown() {
    const container = document.getElementById('countdownList');
    if (!container) return;

    const items = DEPT_EVENTS.map((ev, i) => {
        const el = document.createElement('div');
        el.className = 'countdown-item';
        el.innerHTML = `
            <div class="countdown-label">
                <div class="countdown-label-text">${ev.label}</div>
                <div class="countdown-date-text">${ev.dateText}</div>
            </div>
            <div class="countdown-digits" id="cd-${i}"></div>
        `;
        container.appendChild(el);
        return el;
    });

    function pad(n) { return String(n).padStart(2, '0'); }

    function tick() {
        const now = new Date();
        DEPT_EVENTS.forEach((ev, i) => {
            const item = items[i];
            const digits = document.getElementById(`cd-${i}`);
            if (!item || !digits) return;

            if (now >= ev.end) {
                item.className = 'countdown-item passed';
                digits.innerHTML = `<span class="countdown-status passed">ผ่านไปแล้ว</span>`;
            } else if (now >= ev.start) {
                item.className = 'countdown-item active';
                digits.innerHTML = `<span class="countdown-status active">กำลังดำเนินการ</span>`;
            } else {
                item.className = 'countdown-item';
                const days = Math.ceil((ev.start - now) / 86400000);
                digits.innerHTML = `
                    <div class="countdown-unit">
                        <span class="countdown-num">${days}</span>
                        <span class="countdown-unit-label">วัน</span>
                    </div>
                `;
            }
        });
    }

    tick();
    setInterval(tick, 60000);
}

async function loadSavedPreferences() {
    try {
        const res = await apiFetch('/calculator/preferences');
        if (!res.ok) return;
        const { success, preferences } = await res.json();
        if (!success || !Array.isArray(preferences) || !preferences.length) return;

        const savedItems = preferences
            .map(code => DEPARTMENTS.find(d => d.code === code))
            .filter(Boolean)
            .map(d => ({ ...d, excluded: false }));

        const rest = DEPARTMENTS
            .filter(d => !preferences.includes(d.code))
            .map(d => ({ ...d, excluded: true }));

        prefOrder = [...savedItems, ...rest];
    } catch { /* silent */ }
}

document.addEventListener('DOMContentLoaded', () => {
    // Grade pill selection
    document.querySelectorAll('.grade-pills').forEach(pills => {
        pills.querySelectorAll('.grade-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const wasActive = btn.classList.contains('active');
                pills.querySelectorAll('.grade-pill').forEach(b => b.classList.remove('active'));
                if (!wasActive) btn.classList.add('active');
            });
        });
    });

    loadSavedGrades();
    loadSavedPreferences();
    initCountdown();
    getHistory().catch(() => {}); // warm the cache early

    document.getElementById('calbutton').addEventListener('click', async () => {
        const departEl = document.getElementById('depart');
        const department = departEl?.getAttribute('data-value')?.trim();
        if (!department) {
            alert('กรุณาเลือกภาคก่อนคำนวณ');
            return;
        }

        const grades = getGradesFromDOM();
        const btn = document.getElementById('calbutton');
        btn.disabled = true;
        btn.textContent = 'กำลังคำนวณ...';

        try {
            const [res, history] = await Promise.all([
                apiFetch('/calculator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ department, grades }),
                }),
                getHistory().catch(() => null),
            ]);

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'คำนวณไม่สำเร็จ');
            }

            const data = await res.json();

            if (history) {
                const improved = computeWeightedChance(data.admScore, data.admFullScore, department, history);
                if (improved !== null) data.chancePercent = improved;
            }

            document.getElementById('regularResultCard').hidden = false;
            const prc = document.getElementById('predictResultCard');
            if (prc) prc.hidden = true;
            updateResultUI(data, history);
        } catch (e) {
            alert('เกิดข้อผิดพลาด: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'คำนวณ';
        }
    });

    // ── Predict handlers (remove predictModal + predictBtn + predictResultCard to disable) ──
    const predictModal = document.getElementById('predictModal');
    if (predictModal) {

    document.getElementById('predictBtn').addEventListener('click', () => {
        buildPrefList();
        predictModal.hidden = false;
    });

    document.getElementById('predictCancelBtn').addEventListener('click', () => {
        predictModal.hidden = true;
    });

    predictModal.addEventListener('click', e => {
        if (e.target === predictModal) predictModal.hidden = true;
    });

    document.getElementById('predictSubmitBtn').addEventListener('click', async () => {
        const grades = getGradesFromDOM();
        const department = document.getElementById('depart')?.getAttribute('data-value')?.trim() || undefined;
        const preferences = prefOrder.filter(d => !d.excluded).map(d => d.code);

        const btn = document.getElementById('predictSubmitBtn');
        btn.disabled = true;
        btn.textContent = 'กำลังคำนวณ...';

        try {
            const res = await apiFetch('/calculator/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grades,
                    preferences,
                    ...(department && { department }),
                    year: '2568',
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'คำนวณไม่สำเร็จ');
            }

            const data = await res.json();
            predictModal.hidden = true;
            showPredictResult(data);
        } catch (e) {
            alert('เกิดข้อผิดพลาด: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'คำนวณโอกาส';
        }
    });

    } // end if (predictModal)
});
