export const getApiErrorMessage = (
  error,
  fallback = 'No fue posible completar la operación.'
) => {
  if (!error?.response) {
    return 'No se pudo conectar con el servidor. Verifica la conexión e inténtalo nuevamente.';
  }

  return error.response.data?.message || fallback;
};
