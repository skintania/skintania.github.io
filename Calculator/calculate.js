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
    document.querySelectorAll('article.card').forEach(card => {
        const subject = card.querySelector('h2')?.innerText?.trim();
        const selectedEl = card.querySelector('.selected-option');
        if (!subject || !selectedEl) return;
        const val = selectedEl.getAttribute('data-value');
        if (val !== null && val !== '') {
            grades.push({ subject, grade: parseFloat(val) });
        }
    });
    return grades;
}

function setDropdownValue(card, gradeValue) {
    const displayBox = card.querySelector('.selected-option');
    if (!displayBox) return;
    const match = Array.from(card.querySelectorAll('.options-list li'))
        .find(li => parseFloat(li.getAttribute('data-value')) === gradeValue);
    if (match) {
        displayBox.innerText = match.innerText;
        displayBox.setAttribute('data-value', String(gradeValue));
    }
}

function updateResultUI({ gpax, admScore, admFullScore, chancePercent, allDepartments }) {
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
            const improved = improveLinearChance(chance);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${name ?? department} (${department})</td>
                <td>${minScore != null ? minScore : '-'}</td>
                <td>${maxScore != null ? maxScore : '-'}</td>
                <td class="chance">${improved != null ? improved.toFixed(1) + '%' : '-'}</td>
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
        document.querySelectorAll('article.card').forEach(card => {
            const subject = card.querySelector('h2')?.innerText?.trim();
            if (subject && gradeMap[subject] != null) {
                setDropdownValue(card, gradeMap[subject]);
            }
        });
    } catch { /* silent */ }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSavedGrades();
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

            updateResultUI(data);
        } catch (e) {
            alert('เกิดข้อผิดพลาด: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'คำนวณ';
        }
    });
});
