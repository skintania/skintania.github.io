import { CONFIG } from '/config.js';

document.addEventListener('DOMContentLoaded', () => {
    loadUserData();

    const editBtn = document.getElementById('editProfileBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const profileForm = document.getElementById('profileForm');
    const imageUpload = document.getElementById('imageUpload');
    const settingsLogoutBtn = document.getElementById('settingsContentLogoutBtn');
    const notiForm = document.getElementById('notificationForm');

    const startDeleteBtn = document.getElementById('startDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteArea = document.getElementById('confirmDeleteArea');
    const initialDeleteArea = document.getElementById('initialDeleteArea');
    const finalDeleteBtn = document.getElementById('finalDeleteBtn');

    if (editBtn) editBtn.addEventListener('click', () => toggleEditMode(true));
    
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        toggleEditMode(false);
        loadUserData(); 
    });

    // 📸 Preview รูปภาพเมื่อเลือกไฟล์
    if (imageUpload) {
        imageUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert("❌ ไฟล์ใหญ่เกินไป! กรุณาเลือกไฟล์ขนาดไม่เกิน 5MB");
                    this.value = "";
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(event) {
                    const imgPreview = document.getElementById('imagePreview');
                    const iconEl = document.getElementById('mainIcon');
                    imgPreview.src = event.target.result;
                    imgPreview.style.display = 'block';
                    iconEl.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateUserData();
        });
    }

    if (settingsLogoutBtn) {
        settingsLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Settings Logout Clicked!"); // เช็คใน Console ว่าขึ้นไหม
            if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
                handleLogout();
            }
        });
    }

    if (notiForm) {
        notiForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // ดึงค่ามาเตรียมส่ง API
            const settings = {
                loginNotify: document.getElementById('notifyLogin').checked,
                newsNotify: document.getElementById('notifyNews').checked
            };
            
            console.log("Saving settings:", settings);
            alert("✅ บันทึกการตั้งค่าการแจ้งเตือนแล้ว (จำลอง)");
        });
    }

    if (startDeleteBtn) {
        startDeleteBtn.onclick = () => {
            confirmDeleteArea.classList.remove('hidden');
            initialDeleteArea.classList.add('hidden');
        };
    }

    // 2. กดยกเลิก กลับไปที่เดิม
    if (cancelDeleteBtn) {
        cancelDeleteBtn.onclick = () => {
            confirmDeleteArea.classList.add('hidden');
            initialDeleteArea.classList.remove('hidden');
            document.getElementById('deleteConfirmPassword').value = ''; // ล้างรหัส
        };
    }

    // 3. กดยืนยันการลบจริงๆ
    if (finalDeleteBtn) {
        finalDeleteBtn.onclick = async () => {
            const password = document.getElementById('deleteConfirmPassword').value;
            if (!password) {
                alert("กรุณากรอกรหัสผ่านเพื่อยืนยัน");
                return;
            }

            if (confirm("🚨 คำเตือนสุดท้าย: บัญชีและข้อมูลทั้งหมดจะถูกลบถาวร ยืนยันใช่หรือไม่?")) {
                await processDeleteAccount(password);
            }
        };
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

        const resData = await response.json(); // รับก้อน JSON ทั้งหมด
        if (!response.ok) throw new Error(resData.error);

        // 🌟 1. ดึง Object "user" ออกมาตามโครงสร้างใหม่
        const user = resData.user; 
        if (!user) return;

        // 🌟 2. อัปเดตการ Map ค่าให้ตรงกับชื่อ Key ใน JSON (ตัวพิมพ์เล็กหมด)
        setInputValue('firstName', user.firstname); // เปลี่ยนจาก firstName -> firstname
        setInputValue('lastName', user.lastname);   // เปลี่ยนจาก lastName -> lastname
        setInputValue('username', user.username);
        setInputValue('email', user.email);
        setInputValue('oskGen', user.osk_gen);      // เปลี่ยนจาก oskGen -> osk_gen
        setInputValue('oskNum', user.osk_id);       // เปลี่ยนจาก oskNum -> osk_id
        setInputValue('cuId', user.student_id);    // เปลี่ยนจาก cuId -> student_id

        // 🎯 3. จัดการรูปโปรไฟล์
        const profilePath = user.profile_url || ""; // เปลี่ยนจาก profileUrl -> profile_url
        updateAvatarDisplay('sidebarAvatar', 'sidebarIcon', profilePath);
        updateAvatarDisplay('imagePreview', 'mainIcon', profilePath);

        // อัปเดตชื่อที่ Sidebar
        const sidebarName = document.getElementById('sidebarUsername');
        if (sidebarName) sidebarName.innerText = user.username || 'User';

        // ตรวจสอบสถานะ Verification (is_verified)
        const unverifiedWarning = document.getElementById('unverifiedWarning');
        if (unverifiedWarning) {
            // ใน JSON คือ is_verified: 1 แปลว่า verified แล้ว
            unverifiedWarning.style.display = user.is_verified ? 'none' : 'flex';
        }

        toggleEditMode(false);
    } catch (error) {
        console.error("Load Error:", error);
    }
}

// --- ฟังก์ชันอัปเดตข้อมูล (FormData เวอร์ชันที่ถูกต้อง) ---
async function updateUserData() {
    const saveBtn = document.getElementById('saveProfileBtn');
    if (!saveBtn) return;
    const originalBtnText = saveBtn.innerHTML;

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';

        const token = localStorage.getItem("authToken");
        const imageUpload = document.getElementById('imageUpload');

        // 📦 ใช้ FormData เพื่อรองรับไฟล์ภาพ
        const formData = new FormData();
        formData.append('firstName', document.getElementById('firstName').value);
        formData.append('lastName', document.getElementById('lastName').value);
        formData.append('username', document.getElementById('username').value);
        formData.append('email', document.getElementById('email').value);
        formData.append('oskGen', document.getElementById('oskGen').value);
        formData.append('oskNum', document.getElementById('oskNum').value);
        formData.append('cuId', document.getElementById('cuId').value);

        if (imageUpload.files[0]) {
            formData.append('profileImage', imageUpload.files[0]);
        }

        const response = await fetch(`${CONFIG.API_URL}/user/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
                // ห้ามใส่ Content-Type: application/json
            },
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            alert("✅ บันทึกข้อมูลสำเร็จ!");
            toggleEditMode(false);
            loadUserData();
        } else {
            throw new Error(result.error || "บันทึกล้มเหลว");
        }
    } catch (error) {
        alert("⚠️ " + error.message);
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

    // 📸 แสดง/ซ่อน ส่วนเลือกรูปภาพ
    const avatarActions = document.querySelector('.avatar-actions');
    if (avatarActions) {
        avatarActions.style.display = isEditing ? 'block' : 'none';
    }

    const editBtn = document.getElementById('editProfileBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const saveBtn = document.getElementById('saveProfileBtn');

    if (editBtn) editBtn.style.display = isEditing ? 'none' : 'inline-flex';
    if (cancelBtn) cancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
    if (saveBtn) saveBtn.style.display = isEditing ? 'inline-flex' : 'none';
}

async function updateAvatarDisplay(imgId, iconId, urlPath) {
    const imgEl = document.getElementById(imgId);
    const iconEl = document.getElementById(iconId);
    if (!imgEl || !iconEl) return;

    if (urlPath && urlPath.trim() !== "") {
        // ตรวจสอบว่ามี CONFIG.API_URL ซ้ำซ้อนไหม
        let finalUrl = urlPath;
        
        if (!urlPath.startsWith('http')) {
            finalUrl = `${CONFIG.API_URL}/${urlPath}`;
        }

        const token = localStorage.getItem("authToken");

        try {
            const response = await fetch(finalUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Fetch failed");

            const blob = await response.blob();
            const finalImageLink = URL.createObjectURL(blob);

            imgEl.src = finalImageLink;
            imgEl.onload = () => { // รอให้รูปโหลดเสร็จก่อนค่อยโชว์
                imgEl.style.display = 'block';
                iconEl.style.display = 'none';
            };
        } catch (error) {
            console.error("โหลดรูปพลาด:", error);
        }
    }
}

document.querySelectorAll('.nav-item[data-section]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const sectionId = 'section-' + this.getAttribute('data-section');
        const targetSection = document.getElementById(sectionId);

        if (targetSection) {
            // ลบ class active จากปุ่มเดิม และเพิ่มให้ปุ่มที่คลิก
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // เลื่อนหน้าจอไปที่ section นั้นๆ แบบนุ่มนวล
            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ตรวจสอบว่า Scroll ถึง section ไหนแล้วให้เปลี่ยน Active Menu ตาม (Optional)
window.addEventListener('scroll', () => {
    let current = "";
    const sections = document.querySelectorAll('.content-section');
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (pageYOffset >= sectionTop - 100) {
            current = section.getAttribute('id').replace('section-', '');
        }
    });

    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-section') === current) {
            nav.classList.add('active');
        }
    });
});

function handleLogout() {
    localStorage.removeItem('authToken');
    // ล้างข้อมูลอื่นๆ ถ้ามี เช่น userInfo
    // localStorage.removeItem('userInfo'); 
    window.location.href = '/login/';
}

async function processDeleteAccount(password) {
    try {
        const token = localStorage.getItem("authToken");
        
        // ส่งรหัสผ่านไปเช็คที่ Backend ก่อนลบ
        const response = await fetch(`${CONFIG.API_URL}/user/delete-account`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: password })
        });

        const result = await response.json();

        if (response.ok) {
            alert("บัญชีของคุณถูกลบเรียบร้อยแล้ว หวังว่าจะได้พบกันใหม่");
            localStorage.removeItem('authToken');
            window.location.href = '/';
        } else {
            alert("❌ " + (result.error || "รหัสผ่านไม่ถูกต้อง"));
        }
    } catch (e) {
        alert("⚠️ เกิดข้อผิดพลาด: " + e.message);
    }
}