import { CONFIG } from '/config.js';

let _promise = null;

export function getHistory() {
    if (!_promise) {
        const token = localStorage.getItem('authToken');
        _promise = fetch(`${CONFIG.API_URL}/calculator/history`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        .then(r => {
            if (r.status === 401) { window.location.replace('/login/'); throw new Error('401'); }
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(d => d.history);
    }
    return _promise;
}
