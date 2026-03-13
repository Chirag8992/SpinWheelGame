import api from './axios';

export const authApi = {
  register: (data) =>
    api.post('/api/auth/register', data),

  registerAdmin: (data) =>
    api.post('/api/auth/register-admin', data),

  login: (data) =>
    api.post('/api/auth/login', data),

  getMe: () =>
    api.get('/api/auth/me'),
};
