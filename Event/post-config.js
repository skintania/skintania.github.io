import { CONFIG } from '/config.js';

document.addEventListener('DOMContentLoaded', () => {

    document.addEventListener('click', e => {
        if (!e.target.matches('.menu-dot-btn')) {
            document.querySelectorAll('.menu-dropdown-content').forEach(m => m.classList.remove('show'));
        }
    });

    document.body.addEventListener('click', async e => {

        if (e.target.classList.contains('delete-post-btn')) {
            const eventId = e.target.getAttribute('data-id');
            if (!confirm('ยืนยันการลบ?')) return;
            try {
                const res = await fetch(`${CONFIG.API_URL}/events/${eventId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
                });
                if (res.ok) location.reload();
                else alert('ลบไม่สำเร็จ');
            } catch { alert('ลบไม่สำเร็จ'); }
        }

        if (e.target.classList.contains('edit-post-btn')) {
            const eventId = e.target.getAttribute('data-id');
            window.editingEventId = eventId;

            const data = (window.eventList ?? []).find(ev => String(ev.id) === String(eventId));
            if (!data) return;

            document.querySelector('input[name="header"]').value = data.header || '';

            const typeSelect = document.getElementById('typeSelect');
            typeSelect.value = data.type;
            typeSelect.dispatchEvent(new Event('change'));

            if (data.type === 'Poll' && Array.isArray(data.choices)) {
                const pollCountSelect = document.getElementById('pollCountSelect');
                const count = Math.min(Math.max(data.choices.length, 2), 5);
                pollCountSelect.value = count.toString();
                pollCountSelect.dispatchEvent(new Event('change'));
                setTimeout(() => {
                    data.choices.forEach((choice, i) => {
                        const input = document.querySelector(`input[name="choiceText_${i + 1}"]`);
                        if (input) input.value = choice.choiceText ?? '';
                    });
                }, 50);
            } else {
                const descInput = document.querySelector('textarea[name="description"]');
                if (descInput) descInput.value = data.description || '';
            }

            document.querySelector('.modal-header h2').innerText = '✏️ แก้ไขโพสต์';
            document.getElementById('submitBtn').innerText = 'บันทึกการแก้ไข';
            document.getElementById('postModal').style.display = 'flex';
        }
    });
});
