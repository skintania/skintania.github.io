import { CONFIG } from '/config.js';

async function checkAuth() {
  const token = localStorage.getItem("authToken");

  if (!token) {
    window.location.replace("/login/");
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("authToken");
      window.location.replace("/login/");
      return;
    }

    const data = await response.json();

    if (!data.success) {
      localStorage.removeItem("authToken");
      window.location.replace("/login/");
      return;
    }

    if (data.user?.role === 'banned') {
      localStorage.removeItem("authToken");
      window.location.replace("/login/");
      return;
    }

    document.body.style.display = "block";

  } catch {
    // Network error — allow through if a token exists rather than locking the user out
    document.body.style.display = "block";
  }
}

checkAuth();
