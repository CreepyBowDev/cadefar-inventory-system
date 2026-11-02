export const prepararAnulacionVenta = (motivo) => {
  const valor = motivo.trim();
  if (!valor || valor.length > 255) throw new Error('El motivo es obligatorio y admite hasta 255 caracteres.');
  if (/[\u0000-\u001f\u007f]/.test(valor)) throw new Error('El motivo debe escribirse en una sola línea, sin caracteres de control.');
  return { motivo: valor };
};
