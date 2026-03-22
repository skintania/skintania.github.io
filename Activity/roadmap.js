const roadmapContainer = document.getElementById('roadmapContainer');

async function fetchRoadmap() {
  try {
    const response = await fetch('roadmap.json'); 
    const data = await response.json();
    renderRoadmap(data);
  } catch (error) {
    console.error('Error:', error);
    roadmapContainer.innerHTML = '<p style="color: #ef4444;">ไม่สามารถโหลดข้อมูลได้</p>';
  }
}

function renderRoadmap(data) {
  const currentDate = new Date(); 
  let previousDateShort = ''; // ตัวแปรคอยจำเดือนของการ์ดใบก่อนหน้า

  data.forEach(item => {
    let tabButtonsHTML = '';
    let tabContentsHTML = '';
    let isFirstTab = true; 

    if (item.details) {
      const details = item.details;
      const tabConfig = [
        { key: 'info', label: 'ข้อมูลพื้นฐาน' },
        { key: 'duration', label: 'ระยะเวลา' },
        { key: 'roles', label: 'การเข้าฝ่าย' },
        { key: 'tips', label: 'คำแนะนำ/ทริค' }
      ];

      tabConfig.forEach(tab => {
        if (details[tab.key]) { 
          const activeClassBtn = isFirstTab ? 'active' : '';
          const activeClassContent = isFirstTab ? 'active' : '';
          
          tabButtonsHTML += `<button class="tab-btn ${activeClassBtn}" onclick="switchRoadmapTab(event, '${item.id}-${tab.key}')">${tab.label}</button>`;
          tabContentsHTML += `<div class="tab-content ${activeClassContent}" id="${item.id}-${tab.key}">${details[tab.key]}</div>`;
          
          isFirstTab = false; 
        }
      });
    }

    let statusClass = '';
    if (item.compareDate) {
      const itemDate = new Date(item.compareDate);
      const isPastYear = itemDate.getFullYear() < currentDate.getFullYear();
      const isPastMonth = itemDate.getFullYear() === currentDate.getFullYear() && itemDate.getMonth() < currentDate.getMonth();
      const isCurrentMonth = itemDate.getFullYear() === currentDate.getFullYear() && itemDate.getMonth() === currentDate.getMonth();

      if (isPastYear || isPastMonth) {
        statusClass = 'past';
      } else if (isCurrentMonth) {
        statusClass = 'current';
      } else {
        statusClass = 'future';
      }
    }

    // --- ตรวจสอบว่าเวลาซ้ำกับกิจกรรมก่อนหน้าหรือไม่ ---
    let isSameTime = false;
    if (item.dateShort === previousDateShort) {
      isSameTime = true; // ถ้าซ้ำ ให้เป็น true
    }
    previousDateShort = item.dateShort; // อัปเดตค่าไว้เช็กกับรอบถัดไป

    // ใส่คลาส same-time ถ้าเวลาซ้ำ
    const timeClass = isSameTime ? 'same-time' : '';

    const cardHTML = `
      <div class="card roadmap-card type-${item.type} ${statusClass} ${timeClass}">
        <div class="timeline-date-left">${isSameTime ? '' : (item.dateShort || '')}</div>
        
        ${item.imageUrl ? `<img src="${item.imageUrl}" class="roadmap-card-image" alt="${item.title}">` : ''}
        
        <h2>${item.title}</h2>
        <p>${item.shortDesc}</p>
        
        ${tabButtonsHTML ? `<button class="btn-expand" onclick="toggleRoadmapDetails(this, '${item.id}')">อ่านรายละเอียดกิจกรรม ▼</button>` : ''}
        
        <div id="roadmap-${item.id}-details" class="details-container">
          <div class="tab-header">
            ${tabButtonsHTML}
          </div>
          <div class="tab-content-container">
            ${tabContentsHTML}
          </div>
        </div>
      </div>
    `;
    roadmapContainer.insertAdjacentHTML('beforeend', cardHTML);
  });
}

function toggleRoadmapDetails(btn, itemId) {
  const container = document.getElementById(`roadmap-${itemId}-details`);
  
  // สลับคลาส show (เหมือนหน้า Course)
  container.classList.toggle('show');
  
  // เปลี่ยนข้อความปุ่ม
  if (container.classList.contains('show')) {
    btn.innerHTML = "ย่อเนื้อหา ▲";
  } else {
    btn.innerHTML = "อ่านรายละเอียดกิจกรรม ▼";
  }
}

function switchRoadmapTab(event, targetId) {
  // หา container หลักของการ์ดนั้นๆ (Roadmap ใช้ .details-container)
  const container = event.target.closest('.details-container');
  
  if (!container) return; // ป้องกัน Error ถ้าหาไม่เจอ

  // ลบ class active ออกจากปุ่มและเนื้อหาแท็บทั้งหมดในแถวนี้
  container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  container.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // เพิ่ม class active ให้ปุ่มที่เพิ่งกด และเนื้อหาที่ตรงกัน
  event.target.classList.add('active');
  container.querySelector(`#${targetId}`).classList.add('active');
}

fetchRoadmap();