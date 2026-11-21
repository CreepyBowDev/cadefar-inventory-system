import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { leerConsultaReporte, leerConsultaReporteAmpliada, serializarConsultaReporte, validarFiltrosReporte } from '../utils/consultaReporte.js';

const crearBorrador = filtros => ({ ...filtros, modalidad: filtros?.dia ? 'dia' : filtros?.mes ? 'mes' : filtros?.desde ? 'periodo' : '' });

// Solo interacción URL/borrador de Reportes; no define resultados ni reglas de negocio.
export const useReporteConsulta = (tipo, consultar, ampliada = false) => {
  const sidebarItemKey = `reporte-${tipo}`;
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const leer = ampliada ? leerConsultaReporteAmpliada : leerConsultaReporte;
  const aplicada = leer(query, tipo);
  const clave = aplicada.habilitada ? serializarConsultaReporte(aplicada.filtros, tipo) : query;
  const lectura = useConsulta(consultar, clave, aplicada.filtros, aplicada.habilitada);
  const [restriccion, setRestriccion] = useState(null);
  const contextoRestriccion = ampliada ? clave : location.key;
  const restringir = status => { lectura.invalidate(); setRestriccion({ key: contextoRestriccion, status }); };
  const consulta = restriccion?.key === contextoRestriccion ? {
    ...lectura, data: undefined, paginacion: undefined, loading: false,
    status: restriccion.status, error: restriccion.status === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.' : 'No tienes autorización para consultar esta información.'
  } : lectura;
  const [borrador, setBorrador] = useState(() => crearBorrador(aplicada.filtros));
  const [errorLocal, setErrorLocal] = useState('');
  const interna = useRef(null);
  useEffect(() => {
    if (interna.current !== query) { setBorrador(crearBorrador(leer(query, tipo).filtros)); setErrorLocal(''); }
    interna.current = null;
  }, [location.key, query, tipo, leer]);
  const cambiarConsulta = nuevos => {
    const http = serializarConsultaReporte(nuevos, tipo);
    const params = new URLSearchParams(http);
    if (ampliada && aplicada.ui?.vista === 'ESTADISTICAS') {
      params.set('vista', 'ESTADISTICAS'); params.set('uiGranularidad', aplicada.ui.uiGranularidad);
    }
    const siguiente = params.toString();
    if (siguiente === query) consulta.retry();
    else {
      interna.current = siguiente; consulta.invalidate();
      // Canonizar defaults/orden puede cambiar la URL sin cambiar la clave del
      // efecto. Buscar los mismos criterios debe iniciar una consulta igualmente.
      if (http === clave) consulta.retry();
      setParams(siguiente, { state: { sidebarItemKey } });
    }
  };
  const buscar = () => {
    const nuevos = { pagina: '1', limite: aplicada.filtros?.limite || '25' };
    for (const campo of borrador.modalidad === 'periodo' ? ['desde', 'hasta'] : borrador.modalidad ? [borrador.modalidad] : []) nuevos[campo] = borrador[campo] || '';
    const opcional = tipo === 'perdidas' ? 'motivo' : 'estadoOperacion';
    if (borrador[opcional]) nuevos[opcional] = borrador[opcional];
    const error = validarFiltrosReporte(nuevos, tipo);
    setErrorLocal(error);
    if (!error) cambiarConsulta(nuevos);
  };
  const limpiar = () => {
    consulta.invalidate(); setErrorLocal(''); setBorrador(crearBorrador());
    interna.current = ''; setParams('', { state: { sidebarItemKey } });
  };
  const cambiarBorrador = nuevo => { setBorrador(nuevo); setErrorLocal(''); };
  const cambiarVista = (vista, granularidad) => {
    if (aplicada.estado === 'invalida') return;
    const params = new URLSearchParams(query);
    params.delete('vista'); params.delete('uiGranularidad');
    if (vista === 'ESTADISTICAS') { params.set('vista', vista); params.set('uiGranularidad', granularidad); }
    const siguiente = leerConsultaReporteAmpliada(params, tipo);
    if (siguiente.estado !== 'invalida') { interna.current = params.toString(); setParams(params, { state: { sidebarItemKey } }); }
  };
  return { query, aplicada, consulta, borrador, errorLocal, cambiarBorrador, cambiarConsulta, buscar, limpiar, restringir, cambiarVista };
};
