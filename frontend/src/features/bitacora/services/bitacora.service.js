import { api } from '../../../api/api.js';

export const getEventosBitacora = async (filtros = { pagina: '1', limite: '25' }) => {
  const response = await api.get('/bitacora', { params: filtros });
  const { data, paginacion } = response.data || {};
  if (!Array.isArray(data) || !Number.isSafeInteger(paginacion?.total) || paginacion.total < data.length
    || paginacion.pagina !== Number(filtros.pagina) || paginacion.limite !== Number(filtros.limite)
    || paginacion.totalPaginas !== Math.ceil(paginacion.total / paginacion.limite) || data.length > paginacion.limite) {
    // Una respuesta incompleta no equivale a un historial vacío. Conservar el
    // status recibido y proporcionar solo un mensaje seguro para la pantalla.
    throw Object.assign(new Error('Respuesta de Bitácora incompleta'), { response: {
      status: response.status, data: { message: 'El servidor devolvió una respuesta incompleta. Vuelve a consultar la Bitácora.' }
    } });
  }
  return { data, meta: paginacion };
};

export const getEventoBitacora = async idEvento => {
  // Los criterios de retorno viven en la URL de React, no en esta petición.
  const response = await api.get(`/bitacora/${idEvento}`);
  const data = response.data?.data;
  const objeto = valor => valor === null || (typeof valor === 'object' && !Array.isArray(valor));
  const registro = valor => valor && typeof valor.tipo === 'string' && Number.isInteger(valor.id) && valor.id > 0;
  const identidad = valor => valor === null || (valor && Number.isInteger(valor.idUsuario)
    && typeof valor.nombreUsuario === 'string' && Number.isInteger(valor.idRol));
  if (!data || data.idEvento !== Number(idEvento) || typeof data.tipoEvento !== 'string'
    || !['modulo', 'accion', 'resultado', 'fechaRegistro', 'fechaEvento', 'correlacion'].every(campo => typeof data[campo] === 'string')
    || !identidad(data.responsable) || !identidad(data.cuentaObjetivo)
    || !(data.registro === null || registro(data.registro))
    || !Number.isInteger(data.versionFormato) || data.versionFormato < 1
    || !['antes', 'despues', 'metadatos'].every(campo => Object.hasOwn(data, campo) && objeto(data[campo]))
    || !(data.referencias === null || (Array.isArray(data.referencias) && data.referencias.every(registro)))) {
    throw Object.assign(new Error('Detalle de Bitácora incompleto'), { response: {
      status: response.status, data: { message: 'El servidor devolvió un detalle incompleto. Vuelve a consultar el evento.' }
    } });
  }
  return { data };
};
