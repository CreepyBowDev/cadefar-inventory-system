import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { ROLES } from '../../../constants/roles.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { fechaCivil, horaCivil, costoDecimal, idValido } from '../../../utils/presentacion.js';
import { CompraError } from '../components/CompraError.jsx';
import { CompraEstado } from '../components/CompraEstado.jsx';
import { CompraDetallesTable } from '../components/CompraDetallesTable.jsx';
import { CompraAnularForm } from '../components/CompraAnularForm.jsx';
import { getCompra, anularCompra } from '../services/compra.service.js';
import '../styles/compras.css';

const consultarCompra = (id) => idValido(id) ? getCompra(id) : Promise.reject({ response: { status: 400, data: { message: 'El identificador de la compra no es válido.' } } });

const CompraDetalle = ({ idCompra }) => {
  const { usuario } = useAuth();
  const location = useLocation();
  const consulta = useConsulta(consultarCompra, idCompra, idCompra);
  const [motivo, setMotivo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState();
  const [requiereConsulta, setRequiereConsulta] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const compra = consulta.loading || consulta.error ? undefined : resultado || consulta.data;
  const actualizar = () => {
    if (inFlight.current) return;
    setResultado(null); setError(''); setStatus(undefined); setRequiereConsulta(false); consulta.retry();
  };
  const guardar = async (data) => {
    if (!data || inFlight.current || requiereConsulta || status === 401 || status === 403 || usuario.idRol !== ROLES.ADMINISTRADOR || compra?.estadoOperacion !== 'CONFIRMADA') return;
    inFlight.current = true; setSubmitting(true); setError(''); setStatus(undefined);
    try {
      const response = await anularCompra(idCompra, data);
      if (active.current) setResultado(response.data);
    } catch (failure) {
      if (!active.current) return;
      const codigo = failure.response?.status;
      const message = codigo === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.' : codigo === 403 ? 'No tienes autorización para anular compras.'
        : !codigo || codigo >= 500 ? 'No fue posible confirmar el resultado de la anulación. Actualiza la compra para consultar su estado antes de otro envío.' : getApiErrorMessage(failure);
      setError(message); setStatus(codigo); setRequiereConsulta(!codigo || codigo === 404 || codigo === 409 || codigo >= 500);
    } finally { inFlight.current = false; if (active.current) setSubmitting(false); }
  };
  const query = location.state?.comprasQuery;
  const back = `/compras${typeof query === 'string' && query ? `?${query}` : ''}`;
  return <div className="catalogo-page compras-page">
    <Link className="back-link" to={back}><AppIcon name="arrowLeft" size={17} />Volver a Compras</Link>
    {location.state?.compraRegistrada && <FeedbackMessage tone="success" message="Compra registrada. Sus entradas de inventario se confirmaron conjuntamente." />}
    {resultado && <FeedbackMessage tone="success" message="Compra anulada. El estado y las reversiones de inventario se confirmaron conjuntamente." />}
    <header className="page-heading"><div><h2>{compra ? `Compra #${compra.idCompra}` : 'Detalle de la compra'}</h2><p>Información registrada de la adquisición y sus existencias recibidas.</p></div>{compra && <CompraEstado estado={compra.estadoOperacion} />}</header>
    <section className="catalogo-panel" aria-label="Datos de la compra">
      <div className="catalogo-toolbar"><h3>Datos de la adquisición</h3><button className="button button--secondary" type="button" onClick={actualizar} disabled={consulta.loading || submitting || status === 401 || status === 403}>Actualizar</button></div>
      <div aria-busy={consulta.loading}>
        {consulta.loading ? <CatalogoState loading message="Cargando compra…" /> : consulta.error ? <CompraError consulta={{ ...consulta, retry: actualizar }} /> : compra && <>
          <dl className="catalogo-detail compra-detail">
            <div><dt>Fecha de adquisición</dt><dd>{fechaCivil(compra.fechaCompra)}</dd></div><div><dt>Fecha y hora de registro</dt><dd>{horaCivil(compra.fechaRegistro)}</dd></div>
            <div><dt>Proveedor / Laboratorio registrado</dt><dd>{compra.proveedorLaboratorio?.nombre || `Proveedor #${compra.idProveedorLaboratorio}`}{compra.proveedorLaboratorio?.estado === false && <small>Actualmente inactivo</small>}</dd></div>
            <div><dt>Registrada por</dt><dd>{compra.usuarioRegistrador?.nombreUsuario || `Usuario #${compra.idUsuario}`}</dd></div>
            <div><dt>Clave de operación</dt><dd className="compra-clave">{compra.claveOperacion ?? 'Sin clave registrada'}</dd></div><div><dt>Total registrado</dt><dd className="compra-total">{costoDecimal(compra.total)}</dd></div>
          </dl>
          {compra.estadoOperacion === 'ANULADA' && <section className="compra-anulacion" aria-label="Información de anulación"><h3>Compra anulada</h3><dl>
            <div><dt>Fecha y hora</dt><dd>{horaCivil(compra.fechaAnulacion)}</dd></div><div><dt>Responsable</dt><dd>{compra.usuarioAnulador?.nombreUsuario || (compra.idUsuarioAnulador ? `Usuario #${compra.idUsuarioAnulador}` : '—')}</dd></div><div className="compra-anulacion__motivo"><dt>Motivo</dt><dd>{compra.motivoAnulacion || 'Sin motivo registrado'}</dd></div>
          </dl><p>Los originales y sus costos se conservan. Consulta las existencias y su historial para ver los saldos actuales y los movimientos de reversión. Esta compra no puede anularse nuevamente.</p></section>}
        </>}
      </div>
    </section>
    {compra && <section className="catalogo-panel" aria-label="Detalles de la compra"><div className="catalogo-toolbar"><div><h3>Existencias recibidas</h3><p>{compra.detalles.length} detalles registrados</p></div></div>
      <p className="catalogo-note">Cantidades, costos e importes corresponden a la compra registrada. Los datos y estados del catálogo son los actuales. Las fechas históricas se conservan sin conversión horaria.</p>
      {compra.detalles.length ? <CompraDetallesTable detalles={compra.detalles} /> : <CatalogoState title="Sin detalles registrados" message="La consulta no contiene detalles para esta compra." />}
    </section>}
    {compra?.estadoOperacion === 'CONFIRMADA' && usuario.idRol === ROLES.ADMINISTRADOR && <CompraAnularForm compra={compra} motivo={motivo} onChange={setMotivo} onSubmit={guardar} submitting={submitting} error={error} status={status} requiereConsulta={requiereConsulta} />}
  </div>;
};

export const CompraDetailPage = () => {
  const { idCompra } = useParams();
  return <CompraDetalle key={idCompra} idCompra={idCompra} />;
};
