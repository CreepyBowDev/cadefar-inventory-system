// Validación de formato exclusivamente local. Ningún dato determina el resultado
// ni se transmite al servidor, a almacenamiento o a servicios bancarios.
export const formatearNumeroPrueba = valor => valor.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') || '';
export const admiteNumeroPrueba = valor => /^[\d\s]*$/.test(valor) && valor.replace(/\s/g, '').length <= 19;
export const formatearVencimientoPrueba = valor => {
  const digitos = valor.replace(/\D/g, '').slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
};
export const validarTarjetaPrueba = datos => {
  const errores = {};
  if (!datos.titular.trim() || datos.titular.length > 100) errores.titular = 'Ingresa el nombre del titular (máximo 100 caracteres).';
  if (!/^[\d\s]+$/.test(datos.numero) || !/^\d{13,19}$/.test(datos.numero.replace(/\s/g, ''))) errores.numero = 'Ingresa entre 13 y 19 dígitos.';
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(datos.vencimiento)) errores.vencimiento = 'Usa una fecha válida en formato MM/AA.';
  if (!/^\d{3,4}$/.test(datos.cvv)) errores.cvv = 'Ingresa 3 o 4 dígitos.';
  return errores;
};
