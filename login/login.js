import { CONFIG } from '../config.js';

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector('form');

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // ป้องกันการรีเฟรชหน้าเว็บ

    const emailOrUser = document.getElementById("student_id").value;
    const password = document.getElementById("password").value;

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;

    submitBtn.innerText = "กำลังเข้าสู่ระบบ...";
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailOrUser, // ใน Worker เราใช้ชื่อฟิลด์ email
          password: password
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // 1. เก็บ Token และข้อมูลผู้ใช้ลง localStorage
        localStorage.setItem("authToken", result.token);
        localStorage.setItem("username", result.username);
        localStorage.setItem("role", result.role);

        // 2. ส่งไปหน้า Dashboard หรือหน้าแรก (แก้ path ตามต้องการ)
        window.location.replace("/");
      } else {
        // 🚨 กรณีพิเศษ: ถ้ายังไม่ได้ยืนยัน OTP (Error 403 ที่เราเขียนไว้ใน Worker)
        if (response.status === 403) {
          alert(result.error);
          // ฝากอีเมลไว้ใน sessionStorage เพื่อให้หน้า verify-email ใช้งานได้
          sessionStorage.setItem("pendingVerificationEmail", emailOrUser);
          window.location.href = "/verify-email/"; // ส่งไปหน้ากรอก OTP
        } else {
          alert("ผิดพลาด: " + (result.error || "อีเมลหรือรหัสผ่านไม่ถูกต้อง"));
        }

        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    }
  });
});