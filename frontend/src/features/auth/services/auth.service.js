import { api } from '../../../api/api.js';

export const login = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data.data;
};

export const getSession = async () => {
  const response = await api.get('/auth/me');
  return response.data.data;
};

export const logout = async () => {
  await api.post('/auth/logout');
};
