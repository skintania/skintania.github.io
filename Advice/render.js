const coursesGrid = document.getElementById('coursesGrid');
let allCourses = [];

async function fetchCourses() {
  try {
    const response = await fetch('tips.json');
    const coursesData = await response.json();
    allCourses = coursesData;
    renderCourses(coursesData);
  } catch (error) {
    console.error('Error loading courses:', error);
    coursesGrid.innerHTML = '<p style="color: #ef4444; text-align: center; width: 100%;">ไม่สามารถโหลดข้อมูลรายวิชาได้ (ต้องรันบน Web Server)</p>';
  }
}

function renderCourses(coursesData) {
  coursesGrid.innerHTML = '';

  if (coursesData.length === 0) {
    coursesGrid.innerHTML = '<p class="adv-empty">ไม่พบวิชาที่ค้นหา</p>';
    document.getElementById('advCount').textContent = '0 วิชา';
    return;
  }

  coursesData.forEach(course => {
    const cardHTML = `
      <div class="adv-card">
        <div class="adv-card-main">
          <div class="adv-card-img">
            <img src="${course.imageUrl}" alt="${course.title}">
          </div>
          <div class="adv-card-body">
            <h2 class="adv-card-title">${course.title}</h2>
            <p class="adv-card-desc">${course.shortDesc}</p>
            <button class="adv-expand-btn" onclick="toggleDetails(this, '${course.id}')">อ่านเพิ่มเติม ▼</button>
          </div>
        </div>

        <div id="${course.id}-details" class="adv-details">
          <div class="adv-details-inner">
            <div class="adv-tabs">
              <button class="adv-tab-btn active" onclick="switchTab(event, '${course.id}-info')">ข้อมูลเบื้องต้น</button>
              <button class="adv-tab-btn" onclick="switchTab(event, '${course.id}-warning')">จุดที่ควรระวัง</button>
              <button class="adv-tab-btn" onclick="switchTab(event, '${course.id}-prof')">อาจารย์</button>
              <button class="adv-tab-btn" onclick="switchTab(event, '${course.id}-tips')">ทริคเก็บ A</button>
            </div>
            <div class="adv-tab-content active" id="${course.id}-info">${formatText(course.info)}</div>
            <div class="adv-tab-content" id="${course.id}-warning">⚠️ ${formatText(course.warning)}</div>
            <div class="adv-tab-content" id="${course.id}-prof">👨‍🏫 ${formatText(course.instructor)}</div>
            <div class="adv-tab-content" id="${course.id}-tips">🎯 ${formatText(course.tips)}</div>
          </div>
        </div>
      </div>
    `;
    coursesGrid.insertAdjacentHTML('beforeend', cardHTML);
  });

  document.getElementById('advCount').textContent = coursesData.length + ' วิชา';
}

function toggleDetails(btn, courseId) {
  const container = document.getElementById(`${courseId}-details`);
  container.classList.toggle('show');

  if (container.classList.contains('show')) {
    btn.textContent = 'ย่อเนื้อหา ▲';
    btn.classList.add('open');
  } else {
    btn.textContent = 'อ่านเพิ่มเติม ▼';
    btn.classList.remove('open');
  }
}

function switchTab(event, targetId) {
  const inner = event.target.closest('.adv-details-inner');
  inner.querySelectorAll('.adv-tab-btn').forEach(b => b.classList.remove('active'));
  inner.querySelectorAll('.adv-tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  inner.querySelector(`#${targetId}`).classList.add('active');
}

function formatText(text) {
  if (!text) return '';
  return text.trim().replace(/\n/g, '<br>');
}

document.getElementById('advSearch').addEventListener('input', function () {
  if (!allCourses.length) return;
  const q = this.value.trim().toLowerCase();
  const filtered = q
    ? allCourses.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.shortDesc.toLowerCase().includes(q)
      )
    : allCourses;
  renderCourses(filtered);
});

fetchCourses();
