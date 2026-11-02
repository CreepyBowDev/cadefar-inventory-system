import { idValido } from '../../../utils/presentacion.js';

export const formularioRecetaInicial = () => ({ numeroReceta: '', fechaReceta: '', nombrePaciente: '', documentoPaciente: '', nombreMedico: '', modalidad: '', observacion: '', idsDetallesVenta: [] });
const texto = (valor, nombre, maximo, opcional = false) => {
  const limpio = String(valor ?? '').trim();
  if (!limpio && opcional) return null;
  if (!limpio || limpio.length > maximo || /[\u0000-\u001f\u007f]/.test(limpio)) throw new Error(`${nombre}: indica un texto de ${maximo} caracteres como máximo, sin saltos de línea ni caracteres de control.`);
  return limpio;
};
const fechaValida = valor => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  return anio >= 1000 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= new Date(Date.UTC(anio, mes, 0)).getUTCDate();
};

export const prepararReceta = (form, venta) => {
  if (venta.estadoOperacion !== 'PENDIENTE') throw new Error('Solo se pueden registrar recetas en una venta pendiente.');
  if (!fechaValida(form.fechaReceta)) throw new Error('Indica una fecha de receta válida entre los años 1000 y 9999.');
  const data = {
    numeroReceta: texto(form.numeroReceta, 'Número de receta', 80, true), fechaReceta: form.fechaReceta,
    nombrePaciente: texto(form.nombrePaciente, 'Nombre del paciente', 150), documentoPaciente: texto(form.documentoPaciente, 'Documento del paciente', 40),
    nombreMedico: texto(form.nombreMedico, 'Nombre del médico', 150), modalidad: texto(form.modalidad, 'Modalidad', 50), observacion: texto(form.observacion, 'Observación', 500, true)
  };
  const ids = form.idsDetallesVenta;
  if (new Set(ids).size !== ids.length || ids.some(id => !idValido(String(id)) || !venta.detalles.some(d => d.idDetalleVenta === id && d.idVenta === venta.idVenta && d.idReceta === null))) {
    throw new Error('Selecciona únicamente productos de esta venta que todavía no tengan una receta vinculada.');
  }
  if (ids.length) data.idsDetallesVenta = [...ids];
  return data;
};

export const prepararRevision = (form) => {
  if (!['APROBADA', 'RECHAZADA'].includes(form.resultadoRevision)) throw new Error('Selecciona aprobar o rechazar la receta.');
  return { resultadoRevision: form.resultadoRevision, observacion: texto(form.observacion, 'Observación de revisión', 500, true) };
};

export const revisionPendiente = receta => receta.resultadoRevision === null && receta.idUsuarioValidador === null && receta.fechaValidacion === null;

export const leerConsultaRecetas = query => {
  const params = new URLSearchParams(query);
  const filtros = { pagina: '1', limite: '25', ...Object.fromEntries(params) };
  const invalida = [...params.keys()].some(campo => !['pagina', 'limite'].includes(campo) || params.getAll(campo).length !== 1) ||
    !idValido(filtros.pagina) || !idValido(filtros.limite) || Number(filtros.limite) > 100;
  return { filtros, error: invalida ? 'La consulta solo admite una página positiva y un límite de 1 a 100. Limpia los criterios para continuar.' : '' };
};
