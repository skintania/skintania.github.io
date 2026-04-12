import { CONFIG } from '/config.js';

document.addEventListener('DOMContentLoaded', async () => {

    const isAdmin = await checkAdminAccess();

    if (!isAdmin) return; 

    document.body.style.display = ''; 

    setupNavigation();
    setupR2Manager();
    setupD1Manager();

    loadAdminStats();
    loadUsersList();
    loadSystemLogs();

    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', loadSystemLogs);
    }
});

// ==========================================
// 🛡️ ฟังก์ชันเช็คสิทธิ์แอดมิน (Gatekeeper)
// ==========================================
async function checkAdminAccess() {
    const token = localStorage.getItem("authToken");

    // 1. ถ้าไม่มี Token เลย แปลว่ายังไม่ได้ Login ให้เตะไปหน้า Login
    if (!token) {
        window.location.href = '/login/'; // เปลี่ยนเป็นหน้า Login ของคุณ
        return false;
    }

    try {
        // 2. ลองยิงไปที่ API ของ Admin (ใช้ /admin/stats เป็นตัวทดสอบ)
        const response = await fetch(`${CONFIG.API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // 3. ถ้า Backend ตอบกลับมาเป็น 403 Forbidden (ไม่ใช่ Admin)
        if (response.status === 403) {
            window.location.href = '/'; // เตะกลับไปหน้า Homepage
            return false;
        }

        // ถ้า Token หมดอายุ หรือพัง (401 Unauthorized)
        if (response.status === 401) {
            localStorage.removeItem("authToken");
            window.location.href = '/login/';
            return false;
        }

        return true;

    } catch (error) {
        console.error("Auth Check Error:", error);
        alert("❌ เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์");
        window.location.href = '/';
        return false;
    }
}
/* ==========================================
   1. NAVIGATION SYSTEM (ระบบสลับหน้าต่าง)
   ========================================== */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');

    navItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const targetSectionId = 'section-' + this.getAttribute('data-section');
            const targetSection = document.getElementById(targetSectionId);

            if (targetSection) {
                // Clear active class from all menu items
                navItems.forEach(nav => nav.classList.remove('active'));

                // Add active class to clicked item
                this.classList.add('active');

                // Smooth scroll to the target section
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add scroll spy to highlight active section
    setupScrollSpy();

    // Trigger initial scroll spy to highlight the current section
    window.dispatchEvent(new Event('scroll'));
}

function setupScrollSpy() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const sections = document.querySelectorAll('.content-section');

    window.addEventListener('scroll', () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= sectionTop - sectionHeight / 3) {
                current = section.getAttribute('id').replace('section-', '');
            }
        });

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-section') === current) {
                item.classList.add('active');
            }
        });
    });
}

/* ==========================================
   2. DASHBOARD STATS (ภาพรวมระบบ)
   ========================================== */
async function loadAdminStats() {
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${CONFIG.API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Failed to load stats");
        const data = await response.json();

        // อัปเดตตัวเลขหน้า Dashboard
        document.getElementById('stat-total-users').innerText = data.total_users || '0';
        document.getElementById('stat-verified-users').innerText = data.verified_users || '0';
        document.getElementById('stat-storage').innerText = data.storage_used || '0 MB';

    } catch (error) {
        console.error("Stats Error:", error);
        document.getElementById('stat-total-users').innerText = 'N/A';
        document.getElementById('stat-verified-users').innerText = 'N/A';
        document.getElementById('stat-storage').innerText = 'N/A';
    }
}

/* ==========================================
   3. USER MANAGEMENT (จัดการผู้ใช้)
   ========================================== */
async function loadUsersList() {
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${CONFIG.API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const tbody = document.getElementById('usersTableBody');
            if (!tbody) return; 
            
            tbody.innerHTML = ''; // เคลียร์ของเก่า

            data.users.forEach(user => {
                const tr = document.createElement('tr');
                
                // 1. แถวหลัก (ใช้โค้ดและสีที่คุณกำหนดมาเป๊ะๆ 🎨)
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.email}</td>
                    <td>${user.osk_gen || '-'}</td>
                    <td>
                        <span class="role-badge ${user.role === 'admin' ? 'admin' : 'user'}">
                            ${user.role === 'admin' ? '👑 Admin' : '👤 User'}
                        </span>
                        
                        ${user.is_banned === 1 ? `
                        <span class="ban-status">🚫 Banned</span>
                        ` : ''}
                    </td>
                    <td>
                        <button class="btn-toggle-detail" onclick="toggleUserDetails(${user.id}, this)">
                            ▼ ข้อมูล
                        </button>
                    </td>
                `;

                // 2. แถวรายละเอียด (โชว์ตอนกดปุ่ม ▼ ข้อมูล)
                const detailTr = document.createElement('tr');
                detailTr.id = `user-detail-${user.id}`;
                detailTr.className = 'user-detail-row';
                detailTr.style.display = 'none'; 

                const defaultAvatar = `https://ui-avatars.com/api/?name=${user.username || 'U'}&background=random&color=fff&size=128`; 

                let profileImg = defaultAvatar;

                // เช็คการโหลดรูป Profile (ถ้าไม่มีให้ใช้ Default)
                profileImg = '/Assest/default-avatar.png'; 
                if (user.profile_url) {
                    profileImg = user.profile_url.startsWith('http') 
                        ? user.profile_url 
                        : `${CONFIG.API_URL}/${user.profile_url}`;
                }

                detailTr.innerHTML = `
                    <td colspan="6" style="padding: 0; border: none; background: transparent;">
                        <div class="user-detail-card">
                            <div>
                                <img src="${profileImg}" alt="Avatar" class="user-detail-avatar" onerror="this.src='${defaultAvatar}'">
                            </div>
                            <div class="user-info-group">
                                <p><strong>ชื่อ-นามสกุล:</strong> ${user.firstname || '-'} ${user.lastname || '-'}</p>
                                <p><strong>OSK Gen:</strong> ${user.osk_gen || '-'}</p>
                                <p><strong>OSK ID:</strong> ${user.osk_id || '-'}</p>
                            </div>
                            <div class="user-info-group">
                                <p><strong>รหัสนิสิต:</strong> ${user.student_id || '-'}</p>
                                <p><strong>สถานะการยืนยัน:</strong> 
                                    ${user.is_verified 
                                        ? '<span style="color:#34d399;">ยืนยันอีเมลแล้ว</span>' 
                                        : '<span style="color:#fbbf24;">รอการยืนยัน</span>'}
                                </p>
                                <p><strong>วันที่สมัคร:</strong> ${user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH') : '-'}</p>
                            </div>
                            
                            <div class="user-detail-footer">
                                ${user.is_banned === 1 ? `
                                    <button class="btn-ban unban" onclick="unbanUser(${user.id}, '${user.username}')">
                                        <i class="fa-solid fa-check"></i> ปลดแบน
                                    </button>
                                ` : `
                                    <button class="btn-ban" onclick="banUser(${user.id}, '${user.username}')">
                                        <i class="fa-solid fa-ban"></i> แบนผู้ใช้
                                    </button>
                                `}
                            </div>

                        </div>
                    </td>
                `;

                tbody.appendChild(tr);
                tbody.appendChild(detailTr);
            });
        }
    } catch (error) {
        console.error("Load users error:", error);
    }
}

window.toggleUserDetails = function(userId, btnElement) {
    const detailRow = document.getElementById(`user-detail-${userId}`);

    if (detailRow.style.display === 'none') {
        detailRow.style.display = 'table-row';
        btnElement.innerHTML = '▲ ปิด';
        btnElement.classList.add('active');
    } else {
        detailRow.style.display = 'none';
        btnElement.innerHTML = '▼ ข้อมูล';
        btnElement.classList.remove('active');
    }
}

// ฟังก์ชันเปิดหน้าต่างแก้ไข/แบนผู้ใช้ (แปะไว้ที่ Window Object เพื่อให้เรียกจาก HTML ได้)
window.editUser = function(id) {
    alert(`เตรียมเปิดหน้าแก้ไขข้อมูล User ID: ${id}`);
    // TODO: ใส่ Logic ดึงข้อมูล User นี้มาแสดงใน Modal
};

window.banUser = async function(userId, username) {
    // 1. ถามเพื่อความชัวร์ ป้องกันการมือลั่น
    const confirmBan = confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการแบนผู้ใช้งาน: ${username} ?\nการกระทำนี้อาจทำให้ผู้ใช้ไม่สามารถเข้าสู่ระบบได้อีก`);
    
    if (!confirmBan) return; // ถ้ายกเลิก ก็จบการทำงาน

    try {
        const token = localStorage.getItem("authToken");
        
        // 2. ยิง API ไปที่ Backend ของคุณ (ปรับ URL ให้ตรงกับที่คุณออกแบบไว้นะครับ)
        const response = await fetch(`${CONFIG.API_URL}/admin/users/${userId}/ban`, {
            method: 'POST', // หรือ PUT, DELETE ตามที่คุณเขียนไว้ใน Backend
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(`✅ ทำการแบนผู้ใช้งาน ${username} เรียบร้อยแล้ว`);
            // โหลดตารางใหม่เพื่ออัปเดตข้อมูลล่าสุด
            loadUsersList(); 
        } else {
            alert(`❌ เกิดข้อผิดพลาด: ${data.message || 'ไม่สามารถแบนผู้ใช้ได้'}`);
        }
    } catch (error) {
        console.error("Ban User Error:", error);
        alert("❌ ไม่สามารถติดต่อเซิร์ฟเวอร์ได้");
    }
}

window.unbanUser = async function(userId, username) {
    // 1. ถามเพื่อความชัวร์
    const confirmUnban = confirm(`✅ คุณแน่ใจหรือไม่ว่าต้องการ "ปลดแบน" ผู้ใช้งาน: ${username} ?\nผู้ใช้จะสามารถกลับมาเข้าสู่ระบบได้ตามปกติ`);
    
    if (!confirmUnban) return; 

    try {
        const token = localStorage.getItem("authToken");
        
        // 2. ยิง API ไปที่ Backend เพื่อปลดแบน
        const response = await fetch(`${CONFIG.API_URL}/admin/users/${userId}/unban`, {
            method: 'POST', 
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(`✅ ทำการปลดแบนผู้ใช้งาน ${username} เรียบร้อยแล้ว`);
            // โหลดตารางใหม่เพื่อให้ปุ่มสลับกลับเป็นปุ่มแบนสีแดง
            loadUsersList(); 
        } else {
            alert(`❌ เกิดข้อผิดพลาด: ${data.message || 'ไม่สามารถปลดแบนผู้ใช้ได้'}`);
        }
    } catch (error) {
        console.error("Unban User Error:", error);
        alert("❌ ไม่สามารถติดต่อเซิร์ฟเวอร์ได้");
    }
}
/* ==========================================
   4. SYSTEM LOGS (บันทึกการทำงาน)
   ========================================== */
async function loadSystemLogs() {
    const terminal = document.getElementById('logTerminal');
    if (!terminal) return;

    terminal.innerHTML = '<div class="log-line info">Fetching latest logs...</div>';

    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${CONFIG.API_URL}/admin/logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Failed to load logs");
        const data = await response.json();
        const logs = data.logs || []; 

        terminal.innerHTML = ''; // ล้างของเก่า

        if (logs.length === 0) {
            terminal.innerHTML = '<div class="log-line success">✅ No recent error or warning logs found.</div>';
            return;
        }

        logs.forEach(log => {
            const type = log.type || 'info'; 
            const div = document.createElement('div');
            div.className = `log-line ${type}`;
            div.innerHTML = `[${log.timestamp || new Date().toISOString()}] <strong>${type.toUpperCase()}:</strong> ${log.message}`;
            terminal.appendChild(div);
        });

        // เลื่อน Scroll ไปล่างสุดของหน้าต่าง Terminal
        terminal.scrollTop = terminal.scrollHeight;

    } catch (error) {
        terminal.innerHTML += `<div class="log-line error">[System Error] ❌ ${error.message}</div>`;
    }
}

/* ==========================================
   5. R2 STORAGE MANAGER (อัปโหลดไฟล์ลง Cloudflare)
   ========================================== */
function setupR2Manager() {
    const uploadZone = document.getElementById('r2UploadZone');
    const fileInput = document.getElementById('r2FileInput');

    if (!uploadZone || !fileInput) return;

    // กดที่กล่องเพื่อเลือกไฟล์
    uploadZone.addEventListener('click', () => fileInput.click());

    // เมื่อเลือกไฟล์เสร็จ -> ทำการอัปโหลด
    fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length === 0) return;

        await uploadToR2(files[0]);
        fileInput.value = ''; // รีเซ็ตค่า Input
    });

    // โหลดรายการไฟล์เมื่อเปิดหน้า
    loadR2Files();
}

async function uploadToR2(file) {
    try {
        const token = localStorage.getItem("authToken");
        const formData = new FormData();
        formData.append('file', file);

        // เปลี่ยนไอคอนให้หมุนติ้วๆ
        const uploadIcon = document.querySelector('#r2UploadZone i');
        if (uploadIcon) uploadIcon.className = "fa-solid fa-spinner fa-spin text-pink";

        const response = await fetch(`${CONFIG.API_URL}/admin/r2/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed");

        alert(`✅ อัปโหลดไฟล์ ${file.name} สำเร็จ!`);
        loadR2Files(); // รีเฟรชรายการไฟล์หลังอัปโหลด

    } catch (error) {
        alert("❌ อัปโหลดล้มเหลว: " + error.message);
    } finally {
        // คืนค่าไอคอนเดิม
        const uploadIcon = document.querySelector('#r2UploadZone i');
        if (uploadIcon) uploadIcon.className = "fa-solid fa-file-arrow-up";
    }
}

async function loadR2Files() {
    const container = document.querySelector('.file-list-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; color: var(--accent-blue);">กำลังโหลดไฟล์...</div>';

    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${CONFIG.API_URL}/admin/r2/files`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Failed to load files");
        const data = await response.json();
        const files = data.files || [];

        container.innerHTML = ''; // ล้างของเก่า

        if (files.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px 20px; background: var(--glass-bg); border-radius: 12px; border: 1px dashed var(--border);"><i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;"></i><p>ยังไม่มีไฟล์ใน Storage</p></div>';
            return;
        }

        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            // กำหนดไอคอนตามประเภทไฟล์
            let iconClass = 'fa-regular fa-file';
            if (file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                iconClass = 'fa-regular fa-image';
            } else if (file.name.match(/\.(pdf)$/i)) {
                iconClass = 'fa-solid fa-file-pdf';
            } else if (file.name.match(/\.(mp4|avi|mkv)$/i)) {
                iconClass = 'fa-solid fa-file-video';
            }

            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="${iconClass}" style="color: var(--accent-blue);"></i>
                    <div class="file-details">
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${file.size || 'Unknown size'}</span>
                    </div>
                </div>
                <button class="btn-action delete-btn" onclick="deleteR2File('${file.name}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            container.appendChild(fileItem);
        });

    } catch (error) {
        container.innerHTML = `<div style="color: #ef4444; text-align: center;">❌ เกิดข้อผิดพลาด: ${error.message}</div>`;
    }
}

async function deleteR2File(filename) {
    if (!confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์: ${filename} ?`)) return;

    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${CONFIG.API_URL}/admin/r2/delete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename: filename })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Delete failed");

        alert(`✅ ลบไฟล์ ${filename} สำเร็จ!`);
        loadR2Files(); // รีเฟรชรายการไฟล์หลังลบ

    } catch (error) {
        alert("❌ ลบไฟล์ล้มเหลว: " + error.message);
    }
}

// เปิดฟังก์ชัน deleteR2File ให้เรียกจาก HTML ได้
window.deleteR2File = deleteR2File;

/* ==========================================
   6. D1 DATABASE MANAGER (รันคำสั่ง SQL)
   ========================================== */
function setupD1Manager() {
    const runBtn = document.getElementById('runQueryBtn');
    const queryInput = document.getElementById('sqlQueryInput');
    const resultArea = document.querySelector('.query-result-area');

    if (!runBtn || !queryInput) return;

    runBtn.addEventListener('click', async () => {
        const query = queryInput.value.trim();
        if (!query) {
            alert("⚠️ กรุณาพิมพ์คำสั่ง SQL ก่อนรัน");
            return;
        }

        if (!confirm("🚨 คำเตือน: คุณกำลังรันคำสั่ง SQL ลงฐานข้อมูลหลัก ยืนยันใช่หรือไม่?")) return;

        try {
            runBtn.disabled = true;
            runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running...';
            resultArea.innerHTML = '<div style="text-align:center; color: var(--accent-blue);">กำลังดึงข้อมูล...</div>';

            const token = localStorage.getItem("authToken");
            const response = await fetch(`${CONFIG.API_URL}/admin/d1/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: query })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || "Query Execution Failed");

            // วาดตารางผลลัพธ์
            renderSQLResults(data.results, resultArea);

        } catch (error) {
            resultArea.innerHTML = `
                <div style="color: #ef4444; background: rgba(239,68,68,0.1); padding: 15px; border-radius: 8px;">
                    <i class="fa-solid fa-triangle-exclamation"></i> <strong>SQL Error:</strong> ${error.message}
                </div>`;
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Query';
        }
    });
}

function renderSQLResults(results, container) {
    if (!Array.isArray(results) || results.length === 0) {
        container.innerHTML = `
            <div style="color: #10b981; text-align: center; padding: 20px; border: 1px dashed var(--border); border-radius: 8px;">
                <i class="fa-solid fa-check-circle"></i> ทำงานสำเร็จ! (ไม่มีข้อมูลรีเทิร์นกลับมา หรือ 0 rows affected)
            </div>`;
        return;
    }

    const headers = Object.keys(results[0]);
    let tableHTML = `<div style="overflow-x: auto;"><table class="d1-result-table"><thead><tr>`;
    
    headers.forEach(h => { tableHTML += `<th>${h}</th>`; });
    tableHTML += `</tr></thead><tbody>`;

    results.forEach(row => {
        tableHTML += `<tr>`;
        headers.forEach(h => {
            const cellData = typeof row[h] === 'object' ? JSON.stringify(row[h]) : row[h];
            tableHTML += `<td>${cellData !== null ? cellData : '<i>NULL</i>'}</td>`;
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
}