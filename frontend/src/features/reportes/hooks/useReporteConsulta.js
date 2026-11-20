import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { leerConsultaReporte, serializarConsultaReporte, validarFiltrosReporte } from '../utils/consultaReporte.js';

const crearBorrador = filtros => ({ ...filtros, modalidad: filtros?.dia ? 'dia' : filtros?.mes ? 'mes' : filtros?.desde ? 'periodo' : '' });

// Solo interacción URL/borrador de Reportes; no define resultados ni reglas de negocio.
export const useReporteConsulta = (tipo, consultar) => {
  const sidebarItemKey = `reporte-${tipo}`;
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const aplicada = leerConsultaReporte(query, tipo);
  const clave = aplicada.habilitada ? serializarConsultaReporte(aplicada.filtros, tipo) : query;
  const consulta = useConsulta(consultar, clave, aplicada.filtros, aplicada.habilitada);
  const [borrador, setBorrador] = useState(() => crearBorrador(aplicada.filtros));
  const [errorLocal, setErrorLocal] = useState('');
  const interna = useRef(null);
  useEffect(() => {
    if (interna.current !== query) { setBorrador(crearBorrador(leerConsultaReporte(query, tipo).filtros)); setErrorLocal(''); }
    interna.current = null;
  }, [location.key, query, tipo]);
  const cambiarConsulta = nuevos => {
    const siguiente = serializarConsultaReporte(nuevos, tipo);
    if (siguiente === query) consulta.retry();
    else {
      interna.current = siguiente; consulta.invalidate();
      // Canonizar defaults/orden puede cambiar la URL sin cambiar la clave del
      // efecto. Buscar los mismos criterios debe iniciar una consulta igualmente.
      if (siguiente === clave) consulta.retry();
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
  return { query, aplicada, consulta, borrador, errorLocal, cambiarBorrador, cambiarConsulta, buscar, limpiar };
};
