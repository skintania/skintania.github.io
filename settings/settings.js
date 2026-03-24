import { CONFIG } from '/config.js';

document.addEventListener('DOMContentLoaded', () => {
    loadUserData();

    const editBtn = document.getElementById('editProfileBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const profileForm = document.getElementById('profileForm');

    if (editBtn) editBtn.addEventListener('click', () => toggleEditMode(true));
    
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        toggleEditMode(false);
        loadUserData(); 
    });

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateUserData();
        });
    }
});

// --- ฟังก์ชันโหลดข้อมูล ---
async function loadUserData() {
    try {
        const token = localStorage.getItem("authToken");
        if (!token) return;

        const response = await fetch(`${CONFIG.API_URL}/user/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        // 1. แสดงข้อมูลใน Input
        setInputValue('firstName', data.firstName);
        setInputValue('lastName', data.lastName);
        setInputValue('username', data.username);
        setInputValue('email', data.email);
        setInputValue('oskGen', data.oskGen);
        setInputValue('oskNum', data.oskNum);
        setInputValue('cuId', data.cuId);

        // 2. จัดการรูปโปรไฟล์ (เพิ่มส่วนนี้)
        const profileUrl = data.profileUrl || "";
        updateAvatarDisplay('sidebarAvatar', 'sidebarIcon', profileUrl);
        updateAvatarDisplay('imagePreview', 'mainIcon', profileUrl);

        // 3. อัปเดต Sidebar Username
        const sidebarName = document.getElementById('sidebarUsername');
        if (sidebarName) sidebarName.innerText = data.username || 'User';

        const unverifiedWarning = document.getElementById('unverifiedWarning');
        if (unverifiedWarning) {
            unverifiedWarning.style.display = data.isEmailVerified ? 'none' : 'flex';
        }

        toggleEditMode(false);

    } catch (error) {
        console.error("Load Error:", error);
    }
}

// --- ฟังก์ชันอัปเดตข้อมูล (เหมือนเดิมที่คุณแก้) ---
async function updateUserData() {
    const saveBtn = document.getElementById('saveProfileBtn');
    if (!saveBtn) return;
    const originalBtnText = saveBtn.innerHTML;

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';

        const token = localStorage.getItem("authToken");
        const updatedData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            oskGen: parseInt(document.getElementById('oskGen').value) || 0,
            oskNum: document.getElementById('oskNum').value,
            cuId: document.getElementById('cuId').value
        };

        const response = await fetch(`${CONFIG.API_URL}/user/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();

        if (response.ok) {
            alert("บันทึกข้อมูลสำเร็จ!");
            toggleEditMode(false);
            loadUserData();
        } else {
            throw new Error(result.error || "บันทึกล้มเหลว");
        }
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

// --- Helpers ---

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

function toggleEditMode(isEditing) {
    const ids = ['firstName', 'lastName', 'username', 'email', 'oskGen', 'oskNum', 'cuId'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = !isEditing;
            el.style.backgroundColor = isEditing ? 'rgba(255,255,255,0.05)' : 'transparent';
        }
    });

    const editBtn = document.getElementById('editProfileBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const saveBtn = document.getElementById('saveProfileBtn');

    if (editBtn) editBtn.style.display = isEditing ? 'none' : 'inline-flex';
    if (cancelBtn) cancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
    if (saveBtn) saveBtn.style.display = isEditing ? 'inline-flex' : 'none';
}

// --- ฟังก์ชันจัดการรูปภาพ (เพิ่มตัวช่วยสลับโหมด) ---
function updateAvatarDisplay(imgId, iconId, url) {
    const imgEl = document.getElementById(imgId);
    const iconEl = document.getElementById(iconId);
    if (!imgEl || !iconEl) return;

    if (url && url.trim() !== "") {
        imgEl.src = url;
        imgEl.style.display = 'block';
        iconEl.style.display = 'none';
    } else {
        imgEl.style.display = 'none';
        iconEl.style.display = 'flex';
    }
}