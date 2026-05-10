import { CONFIG } from '/config.js';

function showLoader() {
  const loader = document.createElement('div');
  loader.id = 'page-loader';
  loader.innerHTML = '<div class="loader-spinner"></div>';
  document.body.appendChild(loader);
  document.body.style.display = 'block';
  return loader;
}

function removeLoader(loader) {
  loader.classList.add('fade-out');
  setTimeout(() => loader.remove(), 300);
}

async function checkAuth() {
  const token = localStorage.getItem("authToken");

  if (!token) {
    window.location.replace("/login/");
    return;
  }

  // Token exists — reveal body with loader covering content while we verify
  const loader = showLoader();

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

    if (!data.success || data.user?.role === 'banned') {
      localStorage.removeItem("authToken");
      window.location.replace("/login/");
      return;
    }

    removeLoader(loader);

  } catch {
    // Network error — allow through rather than locking the user out
    removeLoader(loader);
  }
}

checkAuth();
