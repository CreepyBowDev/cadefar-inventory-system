// Presentación compartida: fechas civiles sin Date ni conversión horaria.
export const fechaCivil = (valor) => {
  if (!valor) return '—';
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};
export const fechaEtiqueta = (existencia) => existencia.precisionVencimiento === 'MES'
  ? `${existencia.fechaVencimiento.slice(5, 7)}/${existencia.fechaVencimiento.slice(0, 4)}`
  : fechaCivil(existencia.fechaVencimiento);
export const horaCivil = (valor) => valor ? `${fechaCivil(valor)} ${valor.slice(11, 19)}` : '—';
export const cantidad = (valor) => String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// Mantener todos los decimales recibidos, sin redondear ni usar Number.
export const costoDecimal = (valor) => {
  const [entero, decimales] = String(valor).split('.');
  return `${cantidad(entero)}${decimales === undefined ? '' : `,${decimales}`}`;
};
export const idValido = (valor) => /^[1-9]\d*$/.test(valor) && Number(valor) <= 2147483647;
