import config from '../config/global.json';

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now() + 30000; // refresh 30s before expiry
  } catch {
    return true;
  }
};

export const refreshToken = async (): Promise<string | null> => {
  const refresh = localStorage.getItem('refreshToken');
  if (!refresh) return null;

  try {
    const response = await fetch(`${config.api.host}${config.api.refreshToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.access);
      if (data.refresh) localStorage.setItem('refreshToken', data.refresh);
      return data.access;
    }
    // Refresh token itself expired — clear storage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
  return null;
};

let refreshPromise: Promise<string | null> | null = null;

const getValidToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('token');

  if (token && !isTokenExpired(token)) return token;

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = refreshToken().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const fetchWithTimeout = (url: string, options: RequestInit, ms = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  let token = await getValidToken();

  const buildHeaders = (t: string | null) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${t}`,
    ...options.headers
  });

  let response = await fetchWithTimeout(url, { ...options, headers: buildHeaders(token) });

  if (response.status === 401) {
    token = await refreshToken();
    if (token) {
      response = await fetchWithTimeout(url, { ...options, headers: buildHeaders(token) });
    }
  }

  return response;
};

export const fetchAllPages = async (baseUrl: string) => {
  let allData: any[] = [];
  let page = 1;

  while (true) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const response = await makeAuthenticatedRequest(`${baseUrl}${sep}page=${page}&page_size=100`);
    if (!response.ok) break;
    const data = await response.json();
    allData = [...allData, ...(data.results || [])];
    if (!data.next) break;
    page++;
  }

  return allData;
};