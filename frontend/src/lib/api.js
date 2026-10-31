// Central auth + fetch layer.
// Components keep calling bare fetch(); this installs a one-time interceptor that
// attaches the Bearer JWT to every backend call, so no component needs to know about auth.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.talentops.ai.id';

const TOKEN_KEY = 'talentops_token';
const USER_KEY = 'talentops_user';
const LOGIN_PATH = '/admin/login';

export { API_BASE_URL };

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};

export const setSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user || null));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = () => Boolean(getToken());

export async function login(username, password) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail === 'INVALID_CREDENTIALS' ? 'Username atau password salah.' : (data.detail || `Login gagal (${res.status})`));
  }
  setSession(data.access_token, data.user);
  return data.user;
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`);
  if (!res.ok) return null;
  return res.json();
}

export async function logout() {
  clearSession();
  window.location.assign(LOGIN_PATH);
}

// Single-use ticket: EventSource cannot send an Authorization header, so the
// authenticated POST below exchanges the JWT for a 60s burn-on-read ticket.
export async function issueSseTicket(candidateId) {
  const res = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/sse-ticket`, { method: 'POST' });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Gagal memperoleh tiket stream (${res.status})`);
  }
  const data = await res.json();
  return data.ticket;
}

const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const isBackend = url.startsWith(API_BASE_URL);
  const isLoginCall = url.includes('/api/auth/login');
  const token = getToken();

  let nextInit = init;
  if (isBackend && token && !isLoginCall) {
    nextInit = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } };
  }

  return nativeFetch(input, nextInit).then((res) => {
    // Expired/revoked token anywhere => drop the session and force re-login.
    if (res.status === 401 && isBackend && !isLoginCall && !window.location.pathname.startsWith(LOGIN_PATH)) {
      clearSession();
      window.location.assign(LOGIN_PATH);
    }
    return res;
  });
};
