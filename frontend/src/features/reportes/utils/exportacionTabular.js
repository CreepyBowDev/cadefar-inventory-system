import { leerConsultaReporteAmpliada, serializarExportacionReporte } from './consultaReporte.js';
import { serializarExportacionMovimientos } from '../../inventario/utils/consultaExportacionMovimientos.js';
import { exigirCamposTextuales, leerParametrosUnicos } from '../../../utils/parametrosHttp.js';

// Validar TODA la consulta antes de separar la paginación legítima de Reportes.
// CU40 recibe la URL original: no pierde repetidos/desconocidos ni exige período.
export const prepararTabular = (query, fuente, formato) => {
  if (fuente === 'movimientos') {
    const params = new URLSearchParams(query);
    // Las selecciones pertenecen al control, nunca a la URL de consulta.
    if (params.has('formato') || params.has('presentacion')) throw new Error('La URL contiene parámetros de exportación no admitidos.');
    params.append('presentacion', 'TABULAR');
    params.append('formato', formato);
    return Object.fromEntries(new URLSearchParams(serializarExportacionMovimientos(params)));
  }
  const aplicada = leerConsultaReporteAmpliada(query, fuente);
  if (aplicada.ui?.vista === 'ESTADISTICAS') throw new Error('La exportación TABULAR está disponible desde Consulta.');
  if (!aplicada.habilitada) throw new Error(aplicada.error || 'Selecciona un período y pulsa Buscar antes de exportar.');
  const { pagina, limite, ...filtros } = aplicada.filtros;
  return Object.fromEntries(new URLSearchParams(serializarExportacionReporte({ ...filtros, presentacion: 'TABULAR', formato }, fuente)));
};

// El contexto estadístico procede de la URL aplicada completa, nunca del
// borrador ni del JSON/gráfico visible. El serializador exige la combinación.
export const prepararEstadistica = (query, fuente, formato, seleccion) => {
  const aplicada = leerConsultaReporteAmpliada(query, fuente);
  if (!aplicada.habilitada) throw new Error(aplicada.error || 'Aplica un período antes de exportar.');
  if (aplicada.ui?.vista !== 'ESTADISTICAS') throw new Error('La exportación ESTADISTICA está disponible desde Estadísticas con granularidad aplicada.');
  const grafica = leerParametrosUnicos(seleccion ?? {});
  exigirCamposTextuales(grafica, ['grafico', 'metrica']);
  return Object.fromEntries(new URLSearchParams(serializarExportacionReporte({
    ...aplicada.filtrosAplicados, presentacion: 'ESTADISTICA', formato,
    granularidad: aplicada.ui.uiGranularidad, ...grafica
  }, fuente)));
};
