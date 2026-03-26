import { CONFIG } from '/config.js';

document.addEventListener('DOMContentLoaded', () => {

  // 1. ปิดเมนูเมื่อคลิกที่อื่น
  document.addEventListener('click', (e) => {
    if (!e.target.matches('.menu-dot-btn')) {
        document.querySelectorAll('.menu-dropdown-content').forEach(m => m.classList.remove('show'));
    }
  });

  // 2. ดักจับปุ่ม ลบ/แก้ไข (Event Delegation)
  document.body.addEventListener('click', async (e) => {
    
    // --- 🔴 ลบโพสต์ ---
    if (e.target.classList.contains('delete-post-btn')) {
      const eventId = e.target.getAttribute('data-id');
      if (!confirm('ยืนยันการลบ?')) return;

      try {
        const response = await fetch(`${CONFIG.API_URL}/event/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ eventId })
        });
        if (response.ok) location.reload();
      } catch (err) { alert('ลบไม่สำเร็จ'); }
    }

    // --- 🔵 แก้ไขโพสต์ ---
    if (e.target.classList.contains('edit-post-btn')) {
      const eventId = e.target.getAttribute('data-id');
      window.editingEventId = eventId;

      if (window.eventList) {
        const data = window.eventList.find(ev => Number(ev.id) === Number(eventId));
        if (data) {
          // 1. หยอด Header
          document.querySelector('input[name="header"]').value = data.header || '';
          
          // 2. หยอด Type และสั่งเปลี่ยนหน้าฟอร์ม
          const typeSelect = document.getElementById('typeSelect');
          typeSelect.value = data.type;
          typeSelect.dispatchEvent(new Event('change'));

          // 3. หยอดข้อมูลตามประเภท
          if (data.type === 'Poll') {
              const pollCountSelect = document.getElementById('pollCountSelect');
              if (data.choice && pollCountSelect) {
                  pollCountSelect.value = data.choice.length.toString();
                  pollCountSelect.dispatchEvent(new Event('change'));

                  // ต้องรอให้ RenderPollChoices สร้าง Input เสร็จก่อน (ใช้ setTimeout)
                  setTimeout(() => {
                      data.choice.forEach((txt, i) => {
                          const input = document.querySelector(`input[name="choiceText_${i+1}"]`);
                          if (input) input.value = txt;
                      });
                  }, 50);
              }
          } else {
              const descInput = document.querySelector('textarea[name="description"]');
              if (descInput) descInput.value = data.description || '';
          }

          // 4. เปลี่ยน UI Modal
          document.querySelector('.modal-header h2').innerText = '✏️ แก้ไขโพสต์';
          document.getElementById('submitBtn').innerText = 'บันทึกการแก้ไข';
          document.getElementById('postModal').style.display = 'flex';
        }
      }
    }
  });
});