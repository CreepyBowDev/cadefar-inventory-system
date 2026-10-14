import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { idValido } from '../../../utils/presentacion.js';
import { BitacoraResultado } from '../components/BitacoraResultado.jsx';
import { BitacoraDetalleDatos } from '../components/BitacoraDetalleDatos.jsx';
import { BitacoraCambios } from '../components/BitacoraCambios.jsx';
import { BitacoraDatosAdicionales } from '../components/BitacoraDatosAdicionales.jsx';
import { nombreEventoBitacora } from '../utils/presentacionBitacora.js';
import { getEventoBitacora } from '../services/bitacora.service.js';
import '../styles/bitacora.css';

export const BitacoraDetailPage = () => {
  const { idEvento } = useParams();
  const { search } = useLocation();
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [idEvento]);
  const valido = idValido(idEvento);
  const consulta = useConsulta(getEventoBitacora, idEvento, idEvento, valido);
  const evento = consulta.data;
  const restringida = consulta.status === 401 || consulta.status === 403;
  const tituloError = consulta.status === 404 ? 'Evento no encontrado' : consulta.status === 401 ? 'Sesión no válida'
    : consulta.status === 403 ? 'Acceso no autorizado' : 'No fue posible consultar el evento';
  return <div className="catalogo-page bitacora-page bitacora-detail-page">
    <Link className="back-link" to={`/bitacora${search}`}><AppIcon name="arrowLeft" size={17} />Volver a Bitácora</Link>
    <header className="page-heading"><div><h2 ref={heading} tabIndex={-1}>{evento ? `Evento #${evento.idEvento}` : 'Detalle de Bitácora'}</h2>
      <p>{evento ? nombreEventoBitacora(evento.tipoEvento) : 'Información histórica capturada por el sistema.'}</p></div>
      {evento && <BitacoraResultado resultado={evento.resultado} />}
    </header>
    <section className="catalogo-panel" aria-labelledby="bitacora-datos-title">
      <div className="catalogo-toolbar"><h3 id="bitacora-datos-title">Datos del evento</h3>
        <button className="button button--secondary" type="button" onClick={consulta.retry} disabled={!valido || consulta.loading || restringida}><AppIcon name="retry" size={17} />Actualizar</button>
      </div>
      <div aria-busy={consulta.loading}>
        {!valido ? <CatalogoState icon="audit" title="Identificador de evento no válido" message="El identificador debe ser un entero positivo, sin ceros iniciales, hasta 2147483647. Vuelve al listado y selecciona un evento." />
          : consulta.loading ? <CatalogoState loading message="Cargando evento…" />
            : consulta.error ? <CatalogoState icon="audit" title={tituloError} message={consulta.status === 404 ? 'No se encontró un evento con este identificador. Vuelve al listado para seleccionar otro.' : consulta.error} onRetry={restringida || consulta.status === 404 ? undefined : consulta.retry}>
              {consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
            </CatalogoState>
              : evento && <BitacoraDetalleDatos evento={evento} search={search} />}
      </div>
    </section>
    {evento && (evento.versionFormato === 1 ? <><BitacoraCambios evento={evento} /><BitacoraDatosAdicionales evento={evento} /></>
      : <section className="catalogo-panel"><CatalogoState icon="audit" title="Formato de detalle no compatible" message={`Los datos adicionales usan la versión ${evento.versionFormato}. Esta interfaz presenta los datos generales, pero necesita actualizarse para interpretar ese formato.`} /></section>)}
  </div>;
};
