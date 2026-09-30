import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Authorization Bearer Token
API.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth APIs
export const loginApi = (credentials) => API.post('/auth/login', credentials);
export const registerApi = (userData) => API.post('/auth/register', userData);
export const getMeApi = () => API.get('/auth/me');

// Product APIs
export const fetchProductsApi = (params) => API.get('/products', { params });
export const fetchProductByIdApi = (id) => API.get(`/products/${id}`);
export const createProductApi = (data) => API.post('/products', data);
export const updateProductApi = (id, data) => API.put(`/products/${id}`, data);
export const deleteProductApi = (id) => API.delete(`/products/${id}`);

// Sales APIs
export const fetchSalesApi = () => API.get('/sales');
export const fetchSalesByProductApi = (productId) => API.get(`/sales/product/${productId}`);
export const createSaleApi = (data) => API.post('/sales', data);

// Forecast APIs
export const fetchForecastApi = (productId) => API.get(`/forecast/${productId}`);
export const generateForecastApi = (productId) => API.post(`/forecast/${productId}`);
export const generateAllForecastsApi = () => API.post('/forecast/generate-all');

// Dashboard API
export const fetchDashboardApi = () => API.get('/dashboard');

export default API;
