// ไฟล์: components.js
class SiteHeader extends HTMLElement {
    // ใส่คำว่า async เพื่อให้สามารถรอโหลดไฟล์ได้
    async connectedCallback() {
        // 1. ดึงค่าจากที่ส่งมาใน HTML
        const pageTitle = this.getAttribute('page-title') || 'StudyKits';
        const pageDesc = this.getAttribute('page-desc') || 'เลือกคอร์สที่ต้องการเรียน';

        try {
            // 2. ดึงโค้ดจากไฟล์ header.html
            const response = await fetch('/Template/header.html');
            const htmlText = await response.text();

            // 3. เอาโค้ด HTML ที่โหลดมา ยัดลงไปใน Tag ของเรา
            this.innerHTML = htmlText;

            // 4. สั่งเปลี่ยนข้อความตาม id ที่เราเตรียมไว้ใน header.html
            this.querySelector('#dynamic-title').textContent = pageTitle;
            this.querySelector('#dynamic-desc').textContent = pageDesc;

        } catch (error) {
            console.error('ไม่สามารถโหลด Header ได้:', error);
        }
    }
}

customElements.define('site-header', SiteHeader);

// ไฟล์: components.js (ส่วนของ Comment Widget)

class CommentWidget extends HTMLElement {
    async connectedCallback() {
        try {
            // 1. โหลด HTML มาแสดงผล
            const response = await fetch('/Template/commentBtn.html');
            this.innerHTML = await response.text();

            // ==========================================
            // 2. ใส่ Script การทำงานของคุณตรงนี้
            // ==========================================
            const webhookURL = "https://discord.com/api/webhooks/1483172061303148717/8e1m1YP5g8i5J_YCIOU77w4dGCui1L2FCakqz7cJWHvmsIAio9m5Y1alTIiWmAh7bmx_";

            // ใช้ this.querySelector แทน document.getElementById เพื่อหา Element เฉพาะใน Component นี้
            const btn = this.querySelector("#commentBtn");
            const popup = this.querySelector("#commentPopup");
            const textBox = this.querySelector("#commentText");
            const submitBtn = this.querySelector("#submitCommentBtn");
            const closeBtn = this.querySelector("#closeCommentBtn");

            // ฟังก์ชันเปิด-ปิด
            const togglePopup = () => {
                popup.classList.toggle("hidden");
            };

            // ฟังก์ชันส่งคอมเมนต์
            // ฟังก์ชันส่งคอมเมนต์ (ส่วนที่แก้ไข)
            const sendComment = async () => {
                const text = textBox.value;

                if (!text) {
                    alert("Leave the comment here");
                    return;
                }

                try {
                    const res = await fetch("/Assest/emb.json");
                    const data = await res.json();

                    // 1. ใส่ข้อความคอมเมนต์ (ของเดิมที่คุณทำไว้)
                    data.embeds[0].fields[0].value = text;

                    // ==========================================
                    // 2. เพิ่มส่วนนี้เข้าไป! ดึงชื่อหน้าและ URL ปัจจุบัน
                    // ==========================================
                    const pageName = document.title || "Skintania Page"; // ดึงชื่อหน้าจากแท็ก <title>
                    const pageUrl = window.location.href; // ดึงลิงก์ปัจจุบัน (เช่น https://skintania.github.io/Event/)

                    // 3. เอามาประกอบร่างใส่ใน description ของ Discord Embed
                    data.embeds[0].description = `Alert from : [${pageName}](${pageUrl})`;
                    // ==========================================

                    // ส่งข้อมูลไปที่ Discord Webhook
                    await fetch(webhookURL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(data)
                    });

                    alert("Comment Sending successfully");
                    textBox.value = "";
                    togglePopup();
                } catch (error) {
                    console.error(error);
                    alert("Message Error");
                }
            };

            // 3. ผูกคำสั่งให้ปุ่มต่างๆ ทำงานเมื่อถูกคลิก
            btn.addEventListener("click", togglePopup);
            closeBtn.addEventListener("click", togglePopup);
            submitBtn.addEventListener("click", sendComment);

        } catch (error) {
            console.error('ไม่สามารถโหลด Comment Popup ได้:', error);
        }
    }
}

customElements.define('comment-widget', CommentWidget);