import api from './axios';

export const publicApi = {
  getLeaderboard: (limit = 10) => api.get(`/api/public/leaderboard?limit=${limit}`)
};
