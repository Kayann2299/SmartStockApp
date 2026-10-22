/**
 * Cliente Axios compartilhado para requisições de API do frontend.
 * @module services/api
 */
import axios from 'axios';

// Prefer explicit VITE_API_URL, otherwise default to the active local backend port.
const rawBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const normalizedBaseURL = rawBaseURL.replace(/\/$/, '').replace(/\/api$/, '');
const api = axios.create({
  baseURL: `${normalizedBaseURL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
