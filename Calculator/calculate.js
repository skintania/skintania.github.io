import { CONFIG } from '/config.js';

const getToken = () => localStorage.getItem('authToken') || '';

function apiFetch(path, options = {}) {
    return fetch(`${CONFIG.API_URL}${path}`, {
        ...options,
        headers: { 'Authorization': `Bearer ${getToken()}`, ...options.headers },
    });
}

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

function updateResultUI({ gpax, weightedScore, fullScore, chancePercent, allDepartments }) {
    const percent = chancePercent ?? 0;

    const chanceTextEl = document.querySelector('.chance-text');
    const circleEl = document.querySelector('.chance-circle');
    const scoreTextEls = document.querySelectorAll('.score-text');
    const statusEl = document.querySelector('.status-message');
    const deptTableBody = document.querySelector('#deptChanceTable tbody');

    if (chanceTextEl) chanceTextEl.innerText = `${percent.toFixed(2)} %`;
    if (circleEl) circleEl.style.setProperty('--percentage', `${percent.toFixed(2)}%`);

    if (scoreTextEls[0]) scoreTextEls[0].innerText = `GPAX: ${Number(gpax).toFixed(2)}`;
    if (scoreTextEls[1]) scoreTextEls[1].innerText =
        `Score: ${Number(weightedScore).toFixed(1)} / ${Number(fullScore).toFixed(1)}`;

    if (statusEl) {
        let message, cls;
        if (chancePercent == null) { message = 'ไม่มีข้อมูล';          cls = 'error'; }
        else if (percent >= 100)   { message = 'Guaranteed!';            cls = 'success'; }
        else if (percent >= 80)    { message = 'Very high chance';       cls = 'success'; }
        else if (percent >= 60)    { message = 'High chance';            cls = 'warning'; }
        else if (percent >= 40)    { message = 'Could try';              cls = 'warning'; }
        else if (percent >= 20)    { message = 'Low chance';             cls = 'error'; }
        else if (percent > 0)      { message = 'Extremely low chance';   cls = 'error'; }
        else                       { message = 'No chance';              cls = 'error'; }
        statusEl.className = `status-message ${cls}`;
        statusEl.innerText = message;
    }

    if (deptTableBody && Array.isArray(allDepartments)) {
        deptTableBody.innerHTML = '';
        allDepartments.forEach(({ department, name, minScore, maxScore, chance }) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${name ?? department} (${department})</td>
                <td>${minScore != null ? minScore : '-'}</td>
                <td>${maxScore != null ? maxScore : '-'}</td>
                <td class="chance">${chance != null ? Number(chance).toFixed(1) + '%' : '-'}</td>
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
            const res = await apiFetch('/calculator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department, grades }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'คำนวณไม่สำเร็จ');
            }

            const data = await res.json();
            updateResultUI(data);
        } catch (e) {
            alert('เกิดข้อผิดพลาด: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'คำนวณ';
        }
    });
});
