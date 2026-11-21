import { useLayoutEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../../utils/apiError.js';

// Clave sin paginación ni representación. La identidad de sesión también invalida
// transportes no cooperativos; cleanup retira datos antes de pintar otro contexto.
export const useReporteEstadisticas = (consultar, clave, sesion, onRestringida) => {
  const [revision, setRevision] = useState(0);
  const [resultado, setResultado] = useState({});
  const contexto = useRef(null);
  const restringir = useRef(onRestringida);
  restringir.current = onRestringida;
  useLayoutEffect(() => {
    if (!clave) { contexto.current = null; setResultado({}); return; }
    const controller = new AbortController();
    contexto.current = controller;
    const vigente = () => contexto.current === controller && !controller.signal.aborted;
    setResultado({ clave, sesion, revision, loading: true });
    consultar(Object.fromEntries(new URLSearchParams(clave)), { signal: controller.signal }).then(response => {
      if (vigente()) setResultado({ clave, sesion, revision, data: response.data });
    }).catch(error => {
      if (!vigente()) return;
      const status = error.response?.status;
      const message = status === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.'
        : status === 403 ? 'No tienes autorización para consultar esta información.'
          : status >= 500 ? 'No fue posible cargar las estadísticas. Reintenta manualmente.'
            : status === 400 ? 'Revisa los filtros y la granularidad. El máximo es 1200 intervalos; elige otra granularidad o un período menor.'
              : getApiErrorMessage(error);
      setResultado({ clave, sesion, revision, status, error: message });
      if ([401, 403].includes(status)) restringir.current?.(status);
    });
    return () => { contexto.current = null; controller.abort(); };
  }, [consultar, clave, sesion, revision]);
  const actual = clave && resultado.clave === clave && resultado.sesion === sesion && resultado.revision === revision;
  return { ...(actual ? resultado : {}), loading: !!clave && (!actual || !!resultado.loading), retry: () => setRevision(value => value + 1) };
};
