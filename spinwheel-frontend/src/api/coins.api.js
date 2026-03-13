import api from './axios';

export const coinsApi = {
  getBalance:           ()              => api.get('/api/coins/balance'),
  getUserBalance:       (userId)        => api.get(`/api/coins/balance/${userId}`),
  getTransactions:      (page = 1, limit = 20) =>
                          api.get(`/api/coins/transactions?page=${page}&limit=${limit}`),
  getUserTransactions:  (userId, page = 1) =>
                          api.get(`/api/coins/transactions/${userId}?page=${page}`),
  credit:               (data)          => api.post('/api/coins/credit', data),
  debit:                (data)          => api.post('/api/coins/debit',  data),
};
