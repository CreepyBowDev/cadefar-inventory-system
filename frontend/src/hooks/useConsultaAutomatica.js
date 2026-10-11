import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useConsulta } from './useConsulta.js';

const SEARCH_DELAY = 300;
const sinTransformacion = (filtros) => filtros;
const normalizarTexto = (filtros) => Object.fromEntries(Object.entries(filtros)
  .map(([campo, valor]) => [campo, String(valor ?? '').trim()]).filter(([, valor]) => valor));
const serializar = (filtros) => {
  const params = new URLSearchParams(filtros);
  return params.toString();
};

// Mismo patrón de Medicamentos: borrador inmediato, URL aplicada y temporizador.
// useConsulta mantiene la lectura y los errores compartidos con otras pantallas.
export const useConsultaAutomatica = (consultar, validar, transformar = sinTransformacion) => {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [draft, setDraft] = useState(() => ({ origen: location.key, filtros: Object.fromEntries(params), pendiente: false }));
  const timer = useRef(null);
  const internalQuery = useRef(null);
  const externa = draft.origen !== location.key && internalQuery.current !== `${location.pathname}?${query}`;
  const filtros = externa ? Object.fromEntries(params) : draft.filtros;
  const pendiente = !externa && draft.pendiente;
  const latestFilters = useRef(filtros);
  latestFilters.current = filtros;
  const values = transformar(normalizarTexto(filtros));
  const appliedQuery = serializar(values);
  const errorFiltros = validar(values);

  useEffect(() => {
    if (externa) {
      clearTimeout(timer.current);
      timer.current = null;
      setDraft({ origen: location.key, filtros: Object.fromEntries(new URLSearchParams(query)), pendiente: false });
    } else {
      setDraft((current) => ({ ...current, origen: location.key }));
    }
    internalQuery.current = null;
    // Solo la navegación restaura el borrador; escribir no debe perder el foco
    // ni ser reemplazado por una actualización propia de la URL.
  }, [location.key, location.pathname, query]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const consulta = useConsulta(consultar, `${location.pathname}?${appliedQuery}`, values, !pendiente && !errorFiltros);
  const aplicar = (nextFilters) => {
    clearTimeout(timer.current);
    timer.current = null;
    const nextValues = transformar(normalizarTexto(nextFilters));
    const nextQuery = serializar(nextValues);
    setDraft({ origen: location.key, filtros: nextFilters, pendiente: false });
    if (!validar(nextValues) && nextQuery !== query) {
      internalQuery.current = `${location.pathname}?${nextQuery}`;
      setParams(nextQuery, { replace: true });
    }
  };
  const cambiar = (nextFilters, inmediato) => {
    const nextValues = transformar(normalizarTexto(nextFilters));
    const previousQuery = serializar(transformar(normalizarTexto(latestFilters.current)));
    latestFilters.current = nextFilters;
    if (serializar(nextValues) === previousQuery && !timer.current) {
      setDraft({ origen: location.key, filtros: nextFilters, pendiente: false });
      return;
    }
    clearTimeout(timer.current);
    consulta.invalidate();
    if (inmediato || validar(nextValues)) aplicar(nextFilters);
    else {
      setDraft({ origen: location.key, filtros: nextFilters, pendiente: true });
      timer.current = setTimeout(() => aplicar(latestFilters.current), SEARCH_DELAY);
    }
  };
  return {
    filtros,
    query: appliedQuery,
    errorFiltros,
    onChange: (campo, valor, inmediato = false) => cambiar({ ...latestFilters.current, [campo]: valor }, inmediato),
    onClear: () => cambiar({}, true),
    consulta: {
      ...consulta,
      loading: !errorFiltros && (pendiente || consulta.loading),
      error: errorFiltros || consulta.error,
      status: errorFiltros ? 400 : consulta.status,
      retry: errorFiltros ? undefined : consulta.retry
    }
  };
};
