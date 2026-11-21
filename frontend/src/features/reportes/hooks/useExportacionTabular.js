import { useLayoutEffect, useRef, useState } from 'react';
import { activarDescarga } from '../../../utils/activarDescarga.js';

// Trabajo local independiente de useConsulta. Una referencia bloquea el doble
// click antes del render; cada contexto tiene su propia vigencia y AbortSignal.
export const useExportacionTabular = (clave, exportar, onRestringida, sesion) => {
  const trabajo = useRef(null);
  const contexto = useRef(null);
  const [estado, setEstado] = useState({});
  useLayoutEffect(() => {
    contexto.current = clave;
    setEstado({});
    return () => {
      contexto.current = null;
      trabajo.current?.abort();
      trabajo.current = null;
    };
  }, [clave, sesion]);
  const iniciar = async params => {
    if (trabajo.current || contexto.current !== clave) return;
    const controller = new AbortController();
    trabajo.current = controller;
    const vigente = () => contexto.current === clave && trabajo.current === controller && !controller.signal.aborted;
    setEstado({ clave, ocupada: true, message: 'Generando y recibiendo archivo. Puedes cancelar la solicitud.' });
    try {
      const archivo = await exportar(params, { signal: controller.signal });
      if (!vigente()) return;
      activarDescarga(archivo);
      setEstado({ clave, message: `Archivo recibido; descarga iniciada. ${archivo.nombreServidor ? 'Nombre del servidor' : 'Nombre alternativo (cabecera ausente, inaccesible o no válida)'}: ${archivo.nombre}.` });
    } catch (error) {
      if (!vigente()) return;
      const message = error.name === 'DescargaError' ? error.message : 'No se pudo iniciar la descarga. Reintenta manualmente.';
      setEstado({ clave, error: true, status: error.status, message: message + (error.retryAfter ? ` Reintenta manualmente después de ${error.retryAfter} segundos.` : '') });
      if ([401, 403].includes(error.status)) onRestringida?.(error.status);
    } finally {
      if (trabajo.current === controller) trabajo.current = null;
    }
  };
  const cancelar = () => {
    trabajo.current?.abort();
    trabajo.current = null;
    setEstado({ clave, message: 'Solicitud cancelada. Esto no garantiza detener una generación ni deshacer una auditoría ya terminadas.' });
  };
  return { estado: estado.clave === clave ? estado : {}, iniciar, cancelar };
};
