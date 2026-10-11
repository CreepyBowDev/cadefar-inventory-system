import { useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../utils/apiError.js';

// Compartido por las consultas de lectura: ignorar respuestas anteriores
// al cambiar filtros/ruta y retirar datos anteriores durante una nueva carga.
export const useConsulta = (consultar, clave, filtros, habilitada = true) => {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({});
  const requestVersion = useRef(0);
  useEffect(() => {
    if (!habilitada) return;
    let active = true;
    const version = ++requestVersion.current;
    const isCurrent = () => active && version === requestVersion.current;
    setResult({ clave, revision, version, loading: true });
    consultar(filtros).then((response) => {
      if (isCurrent()) setResult({ clave, revision, version, ...response, loading: false });
    }).catch((error) => {
      if (!isCurrent()) return;
      const status = error.response?.status;
      const message = status >= 500
        ? 'No fue posible cargar la consulta. Inténtalo nuevamente.'
        : status === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.'
          : status === 403 ? 'No tienes autorización para consultar esta información.'
            : getApiErrorMessage(error);
      setResult({ clave, revision, version, loading: false, error: message, status });
    });
    return () => { active = false; };
    // La clave identifica todos los filtros; no depender del objeto recreado.
  }, [consultar, clave, revision, habilitada]);
  const current = habilitada && result.clave === clave && result.revision === revision && result.version === requestVersion.current;
  return {
    data: current ? result.data : undefined,
    meta: current ? result.meta : undefined,
    loading: habilitada && (!current || Boolean(result.loading)),
    error: current ? result.error : '',
    status: current ? result.status : undefined,
    retry: () => setRevision((value) => value + 1),
    // Invalidar desde el evento, antes del siguiente render o del debounce.
    invalidate: () => { requestVersion.current += 1; }
  };
};
