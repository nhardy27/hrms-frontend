import config from '../config/global.json';

export const refreshToken = async () => {
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
      return data.access;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
  return null;
};

export const getToken = async () => {
  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');
  
  if (!username || !password) {
    console.error('No login credentials found. Please login first.');
    return null;
  }

  try {
    const response = await fetch(`${config.api.host}${config.api.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.access);
      if (data.refresh) {
        localStorage.setItem('refreshToken', data.refresh);
      }
      return data.access;
    }
  } catch (error) {
    console.error('Error getting token:', error);
  }
  return null;
};

export const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  let token = localStorage.getItem('token');
  if (!token) {
    token = await refreshToken() || await getToken();
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  let response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    token = await refreshToken() || await getToken();
    if (token) {
      response = await fetch(url, {
        ...options,
        headers: { ...headers, 'Authorization': `Bearer ${token}` }
      });
    }
  }
  
  return response;
};

export const fetchAllPages = async (baseUrl: string) => {
  let allData: any[] = [];
  let nextUrl = baseUrl;
  
  while (nextUrl) {
    const response = await makeAuthenticatedRequest(nextUrl);
    
    if (response.ok) {
      const data = await response.json();
      allData = [...allData, ...(data.results || [])];
      nextUrl = data.next;
    } else {
      console.error('Failed to fetch data:', response.status);
      break;
    }
  }
  
  return allData;
};