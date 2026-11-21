// Valores HTTP únicos: no coercionar objetos/arrays ni ocultar claves inválidas.
export const leerParametrosUnicos = entrada => {
  if (typeof entrada === 'string' || entrada instanceof URLSearchParams) {
    const params = new URLSearchParams(entrada);
    if ([...params.keys()].some(campo => params.getAll(campo).length !== 1)) {
      throw new Error('La consulta contiene parámetros repetidos.');
    }
    return Object.fromEntries(params);
  }
  if (!entrada || ![Object.prototype, null].includes(Object.getPrototypeOf(entrada))) {
    throw new Error('Los parámetros deben ser un objeto de valores textuales o una query.');
  }
  return { ...entrada };
};

export const exigirCamposTextuales = (params, campos) => {
  for (const [campo, valor] of Object.entries(params)) {
    if (!campos.includes(campo)) throw new Error('La consulta contiene parámetros no admitidos.');
    if (typeof valor !== 'string' || !valor || valor !== valor.trim()) {
      throw new Error('La consulta contiene valores vacíos, no textuales o con espacios exteriores.');
    }
  }
};

// Calendario gregoriano civil, sin convertir a instantes UTC.
export const fechaCivilValida = valor => {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1];
};
