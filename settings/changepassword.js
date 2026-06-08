import { CONFIG } from '/config.js';

function showToast(message, type = 'success') {
    const existing = document.getElementById('cp-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'cp-toast';
    toast.className = `settings-toast settings-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    const passwordForm = document.getElementById('changePasswordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async e => {
            e.preventDefault();
            await handleChangePassword();
        });
    }
});

async function handleChangePassword() {
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmNewPassword');
    const saveBtn = document.getElementById('savePasswordBtn');

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword !== confirmPassword) {
        showToast('รหัสผ่านใหม่ไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง', 'error');
        confirmPasswordInput.focus();
        return;
    }

    if (newPassword.length < 8) {
        showToast('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร', 'error');
        newPasswordInput.focus();
        return;
    }

    if (newPassword === currentPassword) {
        showToast('รหัสผ่านใหม่ห้ามซ้ำกับรหัสผ่านเดิม', 'warning');
        newPasswordInput.focus();
        return;
    }

    try {
        setLoading(true, saveBtn);

        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        if (!token || !userId) {
            showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
            window.location.href = '/login/';
            return;
        }

        const response = await fetch(`${CONFIG.API_URL}/users/${userId}/password`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        const result = await response.json();

        if (response.ok) {
            showToast('เปลี่ยนรหัสผ่านสำเร็จ');
            document.getElementById('changePasswordForm').reset();
        } else {
            throw new Error(result.error || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        setLoading(false, saveBtn);
    }
}

function setLoading(isLoading, btn) {
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปเดต…';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalHtml || '<i class="fa-solid fa-key"></i> อัปเดตรหัสผ่าน';
    }
}
