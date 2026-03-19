// ไฟล์: components.js
class SiteHeader extends HTMLElement {
    // ใส่คำว่า async เพื่อให้สามารถรอโหลดไฟล์ได้
    async connectedCallback() {
        // 1. ดึงค่าจากที่ส่งมาใน HTML
        const pageTitle = this.getAttribute('page-title') || 'StudyKits';
        const pageDesc = this.getAttribute('page-desc') || 'เลือกคอร์สที่ต้องการเรียน';

        try {
            // 2. ดึงโค้ดจากไฟล์ header.html
            const response = await fetch('/callHeader/header.html');
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