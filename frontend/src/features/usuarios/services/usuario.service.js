import { api } from '../../../api/api.js';

export const getUsuarios = async () => {
  const response = await api.get('/usuarios');
  return response.data.data;
};

export const getUsuario = async (idUsuario) => {
  const response = await api.get(`/usuarios/${idUsuario}`);
  return response.data.data;
};

export const createUsuario = async (data) => {
  const response = await api.post('/usuarios', data);
  return response.data.data;
};

export const updateUsuario = async (idUsuario, data) => {
  const response = await api.patch(`/usuarios/${idUsuario}`, data);
  return response.data.data;
};

export const updateEstadoUsuario = async (idUsuario, estado) => {
  const response = await api.patch(`/usuarios/${idUsuario}/estado`, { estado });
  return response.data.data;
};

export const resetPasswordUsuario = async (idUsuario, password) => {
  await api.patch(`/usuarios/${idUsuario}/password`, { password });
};

export const updateOwnPassword = async (data) => {
  await api.patch('/usuarios/me/password', data);
};
