import { CONFIG } from '/config.js';

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. การตั้งค่าตัวแปร (Configuration & Elements) ---
  const UI = {
    modal: document.getElementById('postModal'),
    form: document.getElementById('createPostForm'),
    typeSelect: document.getElementById('typeSelect'),
    standardArea: document.getElementById('standardArea'),
    pollArea: document.getElementById('pollArea'),
    pollCountSelect: document.getElementById('pollCountSelect'),
    pollChoicesContainer: document.getElementById('pollChoicesContainer'),
    submitBtn: document.getElementById('submitBtn'),
    openBtn: document.getElementById('openModalBtn'),
    closeBtn: document.getElementById('closeModalBtn')
  };

  // ดักจับ Error ของรูปภาพ
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
      e.target.style.display = 'none';
    }
  }, true);

  // --- 2. ฟังก์ชันหลักสำหรับจัดการ UI ---
  const toggleFormType = (type) => {
    const isPoll = type === 'Poll';
    UI.pollArea.style.display = isPoll ? 'block' : 'none';
    UI.standardArea.style.display = isPoll ? 'none' : 'block';
    
    if (isPoll) renderPollChoices(UI.pollCountSelect.value);
  };

  const renderPollChoices = (count) => {
    UI.pollChoicesContainer.innerHTML = '';
    for (let i = 1; i <= count; i++) {
      const div = document.createElement('div');
      div.className = 'choice-item';
      div.innerHTML = `
                <label style="color: #3b82f6; font-size: 0.85rem; font-weight: 500; margin-bottom: 8px; display: block;">ตัวเลือกที่ ${i}</label>
                <input type="text" name="choiceText_${i}" placeholder="ระบุข้อความ..." required>
                <div class="file-upload-wrapper">
                    <label style="font-size: 0.75rem; color: #9aa4b2;">รูปภาพสำหรับตัวเลือกนี้ (ถ้ามี)</label>
                    <input type="file" name="choiceImage_${i}" accept="image/*">
                </div>
            `;
      UI.pollChoicesContainer.appendChild(div);
    }
  };

  // --- 3. ฟังก์ชันจัดการข้อมูล (Data Handling) ---
  const getFormData = () => {
    const formData = new FormData(UI.form); // ใช้ FormData ตัวตั้งต้น
    const type = UI.typeSelect.value;

    if (type === 'Poll') {
      const count = UI.pollCountSelect.value;
      let texts = [];
      for (let i = 1; i <= count; i++) {
        const val = UI.form[`choiceText_${i}`].value;
        texts.push(val);
      }
      formData.set('choices', texts.join(',')); // ใช้ .set เพื่อทับค่าเดิม
    }
    
    // แนบ eventId ถ้าอยู่ในโหมดแก้ไข
    if (window.editingEventId) {
        formData.append('eventId', window.editingEventId);
    }

    return formData;
  };

  // --- 4. การเชื่อมต่อ Event Listeners ---
  UI.openBtn.onclick = () => {
    window.editingEventId = null; // ล้างค่าเผื่อค้างจากครั้งก่อน
    UI.form.reset();
    UI.modal.style.display = 'flex';
    document.querySelector('.modal-header h2').innerText = 'สร้างกิจกรรมใหม่';
    UI.submitBtn.innerText = 'โพสต์กิจกรรมเลย';
  };

  UI.closeBtn.onclick = () => {
    UI.modal.style.display = 'none';
    window.editingEventId = null;
  };

  UI.typeSelect.onchange = (e) => toggleFormType(e.target.value);
  UI.pollCountSelect.onchange = (e) => renderPollChoices(e.target.value);

  UI.form.onsubmit = async (e) => {
    e.preventDefault();
    UI.submitBtn.disabled = true;
    
    const isEdit = !!window.editingEventId;
    UI.submitBtn.innerText = isEdit ? 'กำลังบันทึก...' : 'กำลังส่ง...';

    const token = localStorage.getItem('authToken');
    const data = getFormData();
    const apiUrl = isEdit ? `${CONFIG.API_URL}/event/edit` : `${CONFIG.API_URL}/event/create`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: data // ส่งเป็น FormData เสมอ
      });

      if (response.ok) {
        alert(isEdit ? 'อัปเดตสำเร็จ! 🎉' : 'สร้างสำเร็จ! 🎉');
        location.reload();
      } else {
        const err = await response.json();
        alert('Error: ' + (err.error || 'เกิดข้อผิดพลาด'));
      }
    } catch (err) {
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      UI.submitBtn.disabled = false;
    }
  };

  toggleFormType(UI.typeSelect.value);
});