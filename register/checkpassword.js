const form = document.getElementById('registerForm');
const username = document.getElementById('username');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirm_password');

// 1. ฟังก์ชันเช็คการพิมพ์รหัสผ่านแบบ Real-time
function validatePassword() {
  if (confirmPassword.value !== password.value) {
    confirmPassword.setCustomValidity("รหัสผ่านไม่ตรงกันครับ");
  } else {
    confirmPassword.setCustomValidity(""); 
  }
}

password.addEventListener('input', validatePassword);
confirmPassword.addEventListener('input', validatePassword);

// 2. ดักจับตอนกดปุ่ม Submit
form.addEventListener('submit', function(e) {
  // หยุดการส่งฟอร์มแบบปกติไว้ก่อน เพื่อให้ JS ตรวจสอบให้เสร็จ
  e.preventDefault(); 

  // --- A. เช็คว่าทุกช่องต้องกรอกข้อมูล (ห้ามมีแต่ช่องว่าง) ---
  const inputs = form.querySelectorAll('input[required]'); // ดึงช่องที่บังคับกรอกมาทั้งหมด
  let isAllFilled = true;

  inputs.forEach(input => {
    // .trim() จะตัดช่องว่าง (Space) ออก ถ้าตัดแล้วเหลือความยาวเป็น 0 แปลว่าไม่ได้พิมพ์ตัวอักษรเลย
    if (input.value.trim() === '') {
      isAllFilled = false;
      // สั่งให้โฟกัสไปที่ช่องที่ยังไม่ได้กรอก
      input.focus(); 
    }
  });

  if (!isAllFilled) {
    alert('กรุณากรอกข้อมูลให้ครบทุกช่อง (ห้ามพิมพ์แค่ช่องว่าง) ครับ');
    return; // หยุดการทำงาน ไม่ให้ไปหน้าอื่น
  }

  // --- B. เช็ค Username ว่าถูกต้องไหม (อังกฤษ/ตัวเลข เท่านั้น) ---
  const usernameRegex = /^[a-zA-Z0-9]+$/;
  if (!usernameRegex.test(username.value)) {
    alert('ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลขเท่านั้นครับ');
    username.focus();
    return;
  }

  // --- C. เช็ครหัสผ่านว่าตรงกันไหม ---
  if (password.value !== confirmPassword.value) {
    alert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกันครับ');
    confirmPassword.focus();
    return;
  }

  // --- D. ถ้าผ่านด่านทั้งหมดมาได้ ให้เปลี่ยนหน้าไปยืนยันอีเมล ---
  // (สมมติว่าคุณเซฟข้อมูล หรือจะทำอะไรต่อ ก็เขียนโค้ดเพิ่มตรงนี้ได้ครับ)
  window.location.replace("verify-email.html"); 
});