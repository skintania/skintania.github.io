import { token as getToken, API_URL } from '/shared/api.js';

async function fetchAndSetAvatar(imgEl, iconEl, userId) {
    if (!userId || !imgEl || !iconEl) return;
    const tok = getToken();
    if (!tok) {
        console.warn("fetchAndSetAvatar: no authToken in localStorage");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/${userId}/avatar`, {
            headers: { 'Authorization': `Bearer ${tok}` }
        });
        if (!response.ok) {
            console.warn(`Avatar fetch failed: ${response.status}`, await response.text());
            iconEl.style.display = 'flex';
            return;
        }
        const blob = await response.blob();
        imgEl.src = URL.createObjectURL(blob);
        imgEl.style.display = 'block';
        iconEl.style.display = 'none';
    } catch (e) {
        console.error("fetchAndSetAvatar error:", e);
        iconEl.style.display = 'flex';
    }
}

class SiteHeader extends HTMLElement {
    async connectedCallback() {
        const pageTitle = this.getAttribute('page-title') || 'StudyKits';
        const pageDesc = this.getAttribute('page-desc') || 'เลือกคอร์สที่ต้องการเรียน';

        try {
            const response = await fetch('/Template/header.html');
            const html = await response.text();
            this.innerHTML = html;

            this.querySelector('#dynamic-title').textContent = pageTitle;
            this.querySelector('#dynamic-desc').textContent = pageDesc;

            const btn = this.querySelector('#menu-toggle');
            const nav = this.querySelector('.navbar');
            if (btn && nav) {
                btn.onclick = () => {
                    nav.classList.toggle('active');
                    btn.innerHTML = nav.classList.contains('active') ? '✕' : '☰';
                };
            }

            const profileBtn = this.querySelector('#profileBtn');
            const dropdown = this.querySelector('#profileDropdown');
            if (profileBtn && dropdown) {
                profileBtn.onclick = (e) => {
                    e.stopPropagation();
                    const isVisible = dropdown.style.display === 'block';
                    dropdown.style.display = isVisible ? 'none' : 'block';
                    dropdown.style.opacity = isVisible ? '0' : '1';
                    dropdown.style.visibility = isVisible ? 'hidden' : 'visible';
                };
                window.addEventListener('click', (e) => {
                    if (!e.target.closest('.profile-dropdown')) {
                        dropdown.style.display = 'none';
                        dropdown.style.opacity = '0';
                        dropdown.style.visibility = 'hidden';
                    }
                });
            }

            const logoutBtn = this.querySelector('#logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = (e) => {
                    e.preventDefault();
                    console.log("Logging out...");
                    localStorage.removeItem('authToken');
                    window.location.href = '/login/';
                };
            }

            this.initProfile();

        } catch (e) {
            console.error("Error loading header:", e);
        }
    }

    async initProfile() {
        const tok = getToken();
        if (!tok) return;

        try {
            const response = await fetch(`${API_URL}/users/me`, {
                headers: { 'Authorization': `Bearer ${tok}` }
            });
            if (!response.ok) return;
            const data = await response.json();

            if (data.success && data.user) {
                const user = data.user;
                localStorage.setItem('userId', user.id ?? '');
                const imgEl = this.querySelector('#headerAvatarImg');
                const iconEl = this.querySelector('#headerDefaultIcon');

                if (user.profile_url && imgEl && iconEl) {
                    await fetchAndSetAvatar(imgEl, iconEl, user.id);
                }

                if (user.role === 'admin' || user.role === 'OSK') {
                    const menuCard = this.querySelector('.dropdown-menu-card');
                    if (menuCard) {
                        const adminLink = document.createElement('a');
                        adminLink.href = '/admin/';
                        adminLink.innerHTML = 'Admin Panel';
                        adminLink.style.color = '#2d79cf';
                        adminLink.style.fontWeight = 'bold';

                        const hrElement = menuCard.querySelector('hr');
                        if (hrElement) {
                            menuCard.insertBefore(adminLink, hrElement);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Profile init failed", e);
        }
    }
}
customElements.define('site-header', SiteHeader);
