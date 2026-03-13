import api from './axios';

export const wheelApi = {
  getActive:    ()         => api.get('/api/wheel/active'),
  getById:      (id)       => api.get(`/api/wheel/${id}`),
  getHistory:   (page = 1) => api.get(`/api/wheel/history?page=${page}`),
  create:       (data)     => api.post('/api/wheel/create', data),
  join:         (data)     => api.post('/api/wheel/join',   data),
  start:        (data)     => api.post('/api/wheel/start',  data),
  abort:        (data)     => api.post('/api/wheel/abort',  data),
};
