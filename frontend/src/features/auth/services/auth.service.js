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

export const solicitarRecuperacion = async ({ correo }) => {
  const response = await api.post('/auth/recuperacion/solicitar', { correo });
  return response.data;
};

export const restablecerPassword = async ({ correo, codigo, passwordNueva }) => {
  const response = await api.post('/auth/recuperacion/restablecer', {
    correo,
    codigo,
    passwordNueva
  });
  return response.data;
};
