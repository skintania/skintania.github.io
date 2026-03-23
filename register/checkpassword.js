const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirm_password');
const form = document.querySelector('form');

function validatePassword() {
  // 1. เช็คความยาวรหัสผ่าน (ต้อง 8 ตัวขึ้นไป)
  if (password.value.length < 8) {
    password.setCustomValidity("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษรครับ");
  } else {
    password.setCustomValidity(""); // ผ่านเงื่อนไขความยาว
  }

  // 2. เช็คว่ารหัสผ่านและการยืนยันรหัสผ่านตรงกันไหม
  if (confirmPassword.value !== password.value) {
    confirmPassword.setCustomValidity("รหัสผ่านไม่ตรงกันครับ กรุณาตรวจสอบอีกครั้ง");
  } else {
    confirmPassword.setCustomValidity(""); // ผ่านเงื่อนไขรหัสตรงกัน
  }
}

// ให้ระบบเช็คทุกครั้งที่มีการพิมพ์
password.addEventListener('input', validatePassword);
confirmPassword.addEventListener('input', validatePassword);

// เช็คอีกรอบตอนกดปุ่ม Submit เพื่อป้องกันการลักไก่
form.addEventListener('submit', function(e) {
  // ตรวจสอบว่ามีช่องไหนว่างไหม (เผื่อเบราว์เซอร์บางตัวข้าม required)
  const inputs = form.querySelectorAll('input[required]');
  let isValid = true;

  inputs.forEach(input => {
    if (!input.value.trim()) {
      isValid = false;
    }
  });

  if (!isValid) {
    e.preventDefault();
    alert('กรุณากรอกข้อมูลให้ครบทุกช่องครับ');
    return;
  }

  if (password.value.length < 8) {
    e.preventDefault();
    alert('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษรครับ');
    return;
  }

  if (password.value !== confirmPassword.value) {
    e.preventDefault();
    alert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกันครับ');
    return;
  }
  
  // ถ้าผ่านทั้งหมด ฟอร์มจะถูกส่งไปที่ action="/register-endpoint" 
  // จากนั้นคุณค่อยสั่ง redirect ไปหน้ายืนยันอีเมลจากฝั่ง Backend ครับ
});