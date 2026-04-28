import { CONFIG } from '/config.js';

const getToken = () => localStorage.getItem('authToken') || '';

async function uploadImage(url, file) {
    await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'Authorization': `Bearer ${getToken()}` },
        body: file,
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const UI = {
        form: document.getElementById('createPostForm'),
        typeSelect: document.getElementById('typeSelect'),
        standardArea: document.getElementById('standardArea'),
        pollArea: document.getElementById('pollArea'),
        pollCountSelect: document.getElementById('pollCountSelect'),
        pollChoicesContainer: document.getElementById('pollChoicesContainer'),
        submitBtn: document.getElementById('submitBtn'),
    };

    document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.style.display = 'none'; }, true);

    const toggleFormType = type => {
        const isPoll = type === 'Poll';
        UI.pollArea.style.display = isPoll ? 'block' : 'none';
        UI.standardArea.style.display = isPoll ? 'none' : 'block';
        if (isPoll) renderPollChoices(UI.pollCountSelect.value);
    };

    const renderPollChoices = count => {
        UI.pollChoicesContainer.innerHTML = '';
        for (let i = 1; i <= count; i++) {
            const div = document.createElement('div');
            div.className = 'choice-item';
            div.innerHTML = `
                <label style="color:#3b82f6;font-size:.85rem;font-weight:500;margin-bottom:8px;display:block;">ตัวเลือกที่ ${i}</label>
                <input type="text" name="choiceText_${i}" placeholder="ระบุข้อความ..." required>
                <div class="file-upload-wrapper">
                    <label style="font-size:.75rem;color:#9aa4b2;">รูปภาพสำหรับตัวเลือกนี้ (ถ้ามี)</label>
                    <input type="file" name="choiceImage_${i}" accept="image/*">
                </div>
            `;
            UI.pollChoicesContainer.appendChild(div);
        }
    };

    UI.typeSelect.onchange = e => toggleFormType(e.target.value);
    UI.pollCountSelect.onchange = e => renderPollChoices(e.target.value);

    UI.form.onsubmit = async e => {
        e.preventDefault();
        UI.submitBtn.disabled = true;
        const isEdit = !!window.editingEventId;
        UI.submitBtn.innerText = isEdit ? 'กำลังบันทึก...' : 'กำลังส่ง...';

        const token = getToken();
        const type = UI.typeSelect.value;
        const header = UI.form.querySelector('input[name="header"]').value.trim();
        const description = UI.form.querySelector('textarea[name="description"]')?.value.trim() ?? '';
        const singleImageFile = UI.form.querySelector('#singleImageInput')?.files?.[0] ?? null;

        try {
            let eventId;

            if (isEdit) {
                const res = await fetch(`${CONFIG.API_URL}/events/${window.editingEventId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ header, description }),
                });
                const result = await res.json();
                if (!result.success) throw result;
                eventId = window.editingEventId;
            } else {
                let body, endpoint;
                if (type === 'Poll') {
                    const count = parseInt(UI.pollCountSelect.value);
                    const choices = [];
                    for (let i = 1; i <= count; i++) {
                        const text = UI.form.querySelector(`input[name="choiceText_${i}"]`)?.value.trim();
                        if (text) choices.push({ choiceText: text, imgLink: null });
                    }
                    body = { header, choices };
                    endpoint = 'poll';
                } else if (type === 'Activity') {
                    body = { header, description };
                    endpoint = 'activity';
                } else {
                    body = { header, description };
                    endpoint = 'announcement';
                }

                const res = await fetch(`${CONFIG.API_URL}/events/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body),
                });
                const result = await res.json();
                if (!result.success) throw result;
                eventId = result.id;
            }

            // Upload main image if provided
            if (singleImageFile && eventId) {
                await uploadImage(`${CONFIG.API_URL}/events/${eventId}/image`, singleImageFile);
            }

            // Upload poll choice images (new events only — edit doesn't re-upload choices)
            if (!isEdit && type === 'Poll') {
                const count = parseInt(UI.pollCountSelect.value);
                const choiceFiles = Array.from({ length: count }, (_, i) =>
                    UI.form.querySelector(`input[name="choiceImage_${i + 1}"]`)?.files?.[0] ?? null
                );
                if (choiceFiles.some(Boolean)) {
                    const detailRes = await fetch(`${CONFIG.API_URL}/events/${eventId}`, {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    if (detailRes.ok) {
                        const detail = await detailRes.json();
                        const serverChoices = detail.event?.choices ?? [];
                        for (let i = 0; i < serverChoices.length; i++) {
                            if (choiceFiles[i] && serverChoices[i]) {
                                await uploadImage(
                                    `${CONFIG.API_URL}/events/${eventId}/choices/${serverChoices[i].id}/image`,
                                    choiceFiles[i]
                                );
                            }
                        }
                    }
                }
            }

            alert(isEdit ? 'อัปเดตสำเร็จ!' : 'สร้างสำเร็จ!');
            location.reload();
        } catch (err) {
            alert('Error: ' + (err?.error || 'เกิดข้อผิดพลาด'));
            UI.submitBtn.disabled = false;
            UI.submitBtn.innerText = isEdit ? 'บันทึกการแก้ไข' : 'โพสต์กิจกรรมเลย';
        }
    };

    toggleFormType(UI.typeSelect.value);
});
