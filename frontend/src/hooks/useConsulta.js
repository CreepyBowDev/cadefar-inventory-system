import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../utils/apiError.js';

// Compartido por las consultas de lectura: ignorar respuestas anteriores
// al cambiar filtros/ruta y retirar datos anteriores durante una nueva carga.
export const useConsulta = (consultar, clave, filtros) => {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({});
  useEffect(() => {
    let active = true;
    setResult({ clave, revision, loading: true });
    consultar(filtros).then((response) => {
      if (active) setResult({ clave, revision, ...response, loading: false });
    }).catch((error) => {
      if (!active) return;
      const status = error.response?.status;
      const message = status >= 500
        ? 'No fue posible cargar la consulta. Inténtalo nuevamente.'
        : status === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.'
          : status === 403 ? 'No tienes autorización para consultar esta información.'
            : getApiErrorMessage(error);
      setResult({ clave, revision, loading: false, error: message, status });
    });
    return () => { active = false; };
    // La clave identifica todos los filtros; no depender del objeto recreado.
  }, [consultar, clave, revision]);
  const current = result.clave === clave && result.revision === revision;
  return {
    data: current ? result.data : undefined,
    meta: current ? result.meta : undefined,
    loading: !current || Boolean(result.loading),
    error: current ? result.error : '',
    status: current ? result.status : undefined,
    retry: () => setRevision((value) => value + 1)
  };
};
