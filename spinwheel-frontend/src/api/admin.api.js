import api from './axios';

export const adminApi = {
  getDashboard:     ()           => api.get('/api/admin/dashboard'),
  getConfig:        ()           => api.get('/api/admin/config'),
  updateConfig:     (data)       => api.put('/api/admin/config',  data),
  getSettings:      ()           => api.get('/api/admin/settings'),
  updateSettings:   (data)       => api.put('/api/admin/settings', data),
  getUsers:         (page = 1, search = '') =>
                      api.get(`/api/admin/users?page=${page}&search=${search}`),
  toggleUser:       (userId)     => api.patch(`/api/admin/users/${userId}/toggle`),
  getAnalytics:     (days = 7)   => api.get(`/api/admin/analytics?days=${days}`),
};
