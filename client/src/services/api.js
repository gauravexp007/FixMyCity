import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ct_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const hasToken = localStorage.getItem('ct_token');
      if (hasToken) {
        localStorage.removeItem('ct_token');
        localStorage.removeItem('ct_user');
        if (!window.location.pathname.includes('/login')) window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
