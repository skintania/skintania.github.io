import { CONFIG } from '/config.js';

// ==========================================
// 1. ฟังก์ชันสำหรับโหลดข้อมูลจาก API
// ==========================================
async function fetchEvents() {
    const token = localStorage.getItem('authToken') || '';

    try {
        const response = await fetch(`${CONFIG.API_URL}/event/all`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลจาก API ได้');

        return await response.json(); // คืนค่าข้อมูล JSON กลับไป
    } catch (err) {
        console.error('Error fetching data:', err);
        return null; // ถ้า Error คืนค่า null เพื่อให้ฟังก์ชันอื่นรู้
    }
}

// ==========================================
// 2. ฟังก์ชันสำหรับสร้างโพสต์ลงหน้าเว็บ (UI)
// ==========================================
function renderEvents(data, gridElement) {
    // ล้างข้อมูลเก่าก่อน (เผื่อกรณีเรียกใช้ฟังก์ชันนี้ซ้ำเพื่อรีเฟรชหน้า)
    gridElement.innerHTML = '';

    // ถ้าไม่มีข้อมูล หรือ API Error ให้แสดงข้อความแจ้งเตือน
    if (!data) {
        gridElement.innerHTML = '<p style="color:red; text-align:center;">ไม่สามารถโหลดข้อมูลกิจกรรมได้</p>';
        return;
    }

    // ลอจิกการสร้าง UI คงเดิมทั้งหมด
    Object.keys(data).forEach(eventKey => {
        const eventItem = data[eventKey];
        const card = document.createElement('article');
        card.className = 'card';

        // --- 1. หัวข้อและ Tag ประเภท ---
        const title = document.createElement('h2');
        title.innerText = eventItem.header || `กิจกรรม ${eventKey}`;
        card.appendChild(title);

        const typeTag = document.createElement('span');
        typeTag.innerText = eventItem.type;
        typeTag.style.fontSize = '12px';
        typeTag.style.padding = '2px 8px';
        typeTag.style.borderRadius = '4px';
        typeTag.style.background = 'rgba(59, 130, 246, 0.2)';
        typeTag.style.color = '#3b82f6';
        card.appendChild(typeTag);

        // --- 2. แยกการแสดงผลตามประเภท ---
        if (eventItem.type === 'Poll' && Array.isArray(eventItem.choice)) {
            // --- แบบ POLL ---
            const images = Array.isArray(eventItem.imgLink) ? eventItem.imgLink : [eventItem.imgLink];
            const voteScores = Array.isArray(eventItem.vote_score) ? eventItem.vote_score : [];
            const totalVotes = voteScores.reduce((acc, value) => acc + Number(value || 0), 0);

            const pollContainer = document.createElement('div');
            pollContainer.style.marginTop = '15px';
            pollContainer.style.display = 'flex';
            pollContainer.style.flexDirection = 'column';
            pollContainer.style.gap = '15px';

            eventItem.choice.forEach((choice, i) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '15px';
                row.style.marginBottom = '15px';

                const img = document.createElement('img');
                img.src = images[i] || images[0];
                img.style.width = '150px';
                img.style.borderRadius = '8px';
                img.style.objectFit = 'cover';
                img.style.flexShrink = '0';

                const pollContent = document.createElement('div');
                pollContent.style.flexGrow = '1';

                const votes = Number(eventItem.vote_score[i] || 0);
                const percent = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

                pollContent.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong class="event-description">${choice}</strong> 
                        <span class="vote-text" style="color: #60a5fa;">${votes} โหวต (${percent.toFixed(0)}%)</span>
                    </div>
                    <div style="height:20px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
                        <div class="progress-bar" style="width:${percent}%; height:100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); transition: width 0.3s ease;"></div>
                    </div>
                `;

                const checkContainer = document.createElement('div');
                checkContainer.style.flexShrink = '0';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.style.width = '20px';
                checkbox.style.height = '20px';
                checkbox.style.cursor = 'pointer';

                if (eventItem.lastVotedIndex === undefined) eventItem.lastVotedIndex = null;

                if (eventItem.userVotedIndex !== undefined && eventItem.userVotedIndex === i) {
                    checkbox.checked = true; // สั่งให้ติ๊กถูกทันที
                    eventItem.lastVotedIndex = i; // จำไว้ว่าเราติ๊กช่องนี้นะ
                }

                checkbox.addEventListener('change', async (e) => {
                    const allChecks = pollContainer.querySelectorAll('input[type="checkbox"]');
                    let action = 'unvote'; // กำหนดค่าเริ่มต้นเป็นยกเลิกโหวต

                    // 1. จัดการ UI เปลี่ยนตัวเลขโหวต (โค้ดเดิมของคุณ)
                    if (e.target.checked) {
                        action = 'vote'; // เปลี่ยนเป็นโหวต
                        if (eventItem.lastVotedIndex !== null && eventItem.lastVotedIndex !== i) {
                            eventItem.vote_score[eventItem.lastVotedIndex]--;
                            allChecks[eventItem.lastVotedIndex].checked = false;
                        }
                        eventItem.vote_score[i]++;
                        eventItem.lastVotedIndex = i;
                    } else {
                        eventItem.vote_score[i]--;
                        eventItem.lastVotedIndex = null;
                    }

                    // ==========================================
                    // 🌟 2. วางโค้ด fetch ยิง API ไป D1 ตรงนี้! 🌟
                    // ==========================================
                    try {
                        const token = localStorage.getItem('authToken') || '';

                        // ส่ง API ไปเงียบๆ เบื้องหลัง
                        const response = await fetch(`${CONFIG.API_URL}/event/vote`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                eventId: eventKey,  // รหัส Event
                                choiceName: choice, // ชื่อตัวเลือก (เช่น "เอิง")
                                action: action      // "vote" หรือ "unvote"
                            })
                        });

                        if (!response.ok) {
                            console.error("บันทึกโหวตไม่สำเร็จ");
                            // ถ้ายิง API ไม่ผ่าน อาจจะแจ้งเตือนผู้ใช้ตรงนี้
                        }
                    } catch (err) {
                        console.error("API Error:", err);
                    }
                    // ==========================================

                    // 3. --- RE-CALCULATE AND UPDATE UI --- (โค้ดอัปเดตหลอดเปอร์เซ็นต์เดิมของคุณ)
                    const newTotal = eventItem.vote_score.reduce((a, b) => a + Number(b), 0);
                    const allBars = pollContainer.querySelectorAll('.progress-bar');
                    const allTexts = pollContainer.querySelectorAll('.vote-text');

                    eventItem.choice.forEach((_, idx) => {
                        const v = Number(eventItem.vote_score[idx]);
                        const p = newTotal > 0 ? (v / newTotal) * 100 : 0;

                        allBars[idx].style.width = `${p}%`;
                        allTexts[idx].innerText = `${v} โหวต (${p.toFixed(0)}%)`;
                    });
                });

                checkContainer.appendChild(checkbox);
                row.appendChild(img);
                row.appendChild(pollContent);
                row.appendChild(checkContainer);
                pollContainer.appendChild(row);
            });

            card.appendChild(pollContainer);

        } else if (eventItem.type === 'Activity') {
            // --- แบบ ACTIVITY ---
            const activityContainer = document.createElement('div');
            activityContainer.style.marginTop = '15px';
            activityContainer.style.display = 'flex';
            activityContainer.style.alignItems = 'center';
            activityContainer.style.gap = '15px';

            if (eventItem.imgLink) {
                const sideImg = document.createElement('img');
                sideImg.src = Array.isArray(eventItem.imgLink) ? eventItem.imgLink[0] : eventItem.imgLink;
                sideImg.style.width = '30%';
                sideImg.style.borderRadius = '10px';
                sideImg.style.objectFit = 'cover';
                activityContainer.appendChild(sideImg);
            }

            const textContent = document.createElement('div');
            textContent.style.flexGrow = '1';

            if (eventItem.description) {
                const desc = document.createElement('p');
                desc.style.margin = '0 0 5px 0';
                desc.classList.add('event-description');
                desc.innerText = eventItem.description;
                textContent.appendChild(desc);
            }

            const partP = document.createElement('div');
            partP.style.fontSize = '13px';
            partP.style.color = '#10b981';
            partP.innerText = `👥 ผู้เข้าร่วม: ${eventItem.participants || 0} คน`;
            textContent.appendChild(partP);
            activityContainer.appendChild(textContent);

            const joinBox = document.createElement('div');
            joinBox.style.textAlign = 'center';
            joinBox.innerHTML = `
                <input type="checkbox" id="chk-${eventKey}" style="width:20px; height:20px; cursor:pointer; display:block; margin:0 auto;">
                <label for="chk-${eventKey}" style="font-size:12px; cursor:pointer; color:#94a3b8;">เข้าร่วม</label>
            `;

            joinBox.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    eventItem.participants++;
                    joinBox.querySelector('label').style.color = '#10b981';
                } else {
                    eventItem.participants--;
                    joinBox.querySelector('label').style.color = '#94a3b8';
                }
                partP.innerText = `👥 ผู้เข้าร่วม: ${eventItem.participants} คน`;
            });

            activityContainer.appendChild(joinBox);
            card.appendChild(activityContainer);

        } else {
            // --- แบบ ANNOUNCEMENT ---
            const announceContainer = document.createElement('div');
            announceContainer.style.marginTop = '15px';

            if (eventItem.imgLink) {
                const fullImg = document.createElement('img');
                fullImg.src = Array.isArray(eventItem.imgLink) ? eventItem.imgLink[0] : eventItem.imgLink;
                fullImg.style.width = '100%';
                fullImg.style.maxHeight = '200px';
                fullImg.style.borderRadius = '8px';
                fullImg.style.objectFit = 'cover';
                fullImg.style.marginBottom = '10px';
                announceContainer.appendChild(fullImg);
            }

            if (eventItem.description) {
                const desc = document.createElement('p');
                desc.classList.add('event-description');
                desc.style.lineHeight = '1.5';
                desc.innerText = eventItem.description;
                announceContainer.appendChild(desc);
            }

            card.appendChild(announceContainer);
        }

        gridElement.appendChild(card);
    });
}

// ==========================================
// 3. ควบคุมการทำงานหลักตอนเปิดหน้าเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    // 1. สั่งโหลดข้อมูล
    const eventData = await fetchEvents();

    // 2. นำข้อมูลไปสร้างหน้าเว็บ
    renderEvents(eventData, grid);
});