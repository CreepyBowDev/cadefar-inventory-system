import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { ConfirmDialog } from '../../../components/ConfirmDialog.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { ROLES } from '../../../constants/roles.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { horaCivil, costoDecimal, idValido } from '../../../utils/presentacion.js';
import { RecetaEstado } from '../../recetas/components/RecetaEstado.jsx';
import { VentaEstado } from '../components/VentaEstado.jsx';
import { VentaError } from '../components/VentaError.jsx';
import { VentaDetallesTable } from '../components/VentaDetallesTable.jsx';
import { VentaAnularForm } from '../components/VentaAnularForm.jsx';
import { getVenta, confirmarVenta, anularVenta } from '../services/venta.service.js';
import { advertenciasRecetasVenta } from '../utils/ventaForm.js';
import { leerConsultaVenta, serializarConsultaVenta } from '../utils/consultaVenta.js';
import '../styles/ventas.css';

const consultarVenta = (id) => idValido(id) ? getVenta(id) : Promise.reject({ response: { status: 400, data: { message: 'El identificador de la venta no es válido.' } } });

const VentaDetalle = ({ idVenta }) => {
  const { usuario } = useAuth();
  const location = useLocation();
  const consulta = useConsulta(consultarVenta, idVenta, idVenta);
  const [resultado, setResultado] = useState(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState();
  const [requiereConsulta, setRequiereConsulta] = useState(false);
  const [motivo, setMotivo] = useState('');
  const inFlight = useRef(false);
  const confirmButton = useRef(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const venta = consulta.loading || consulta.error ? undefined : resultado || consulta.data;
  const restringida = [consulta.status, status].some(codigo => codigo === 401 || codigo === 403);
  const actualizar = () => {
    if (inFlight.current || restringida) return;
    setResultado(null); setError(''); setStatus(undefined); setRequiereConsulta(false); setOpen(false); consulta.retry();
  };
  const confirmar = async () => {
    if (!open || inFlight.current || requiereConsulta || restringida || consulta.loading || usuario?.idRol !== ROLES.VENDEDOR || venta?.estadoOperacion !== 'PENDIENTE') return;
    inFlight.current = true; setSubmitting(true); setError(''); setStatus(undefined);
    try {
      const response = await confirmarVenta(venta.idVenta);
      if (!active.current) return;
      if (response.data?.idVenta !== venta.idVenta || response.data.estadoOperacion !== 'CONFIRMADA') throw new Error('Respuesta de confirmación no verificable');
      setResultado(response.data);
    } catch (failure) {
      if (!active.current) return;
      const codigo = failure.response?.status;
      setStatus(codigo);
      setRequiereConsulta(!codigo || codigo === 404 || codigo === 409 || codigo >= 500);
      setError(codigo === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.' : codigo === 403 ? 'No tienes autorización para confirmar ventas.'
        : !codigo || codigo >= 500 ? 'No fue posible comprobar el resultado de la confirmación. Actualiza la venta para consultar su estado antes de otro envío.' : getApiErrorMessage(failure));
    } finally { inFlight.current = false; if (active.current) { setSubmitting(false); setOpen(false); } }
  };
  const anterior = typeof location.state?.ventasQuery === 'string' ? leerConsultaVenta(location.state.ventasQuery) : null;
  const sidebarItemKey = usuario?.idRol === ROLES.ADMINISTRADOR && location.state?.sidebarItemKey === 'anular-venta' ? 'anular-venta' : undefined;
  const anular = async (data) => {
    if (!data || inFlight.current || requiereConsulta || restringida || consulta.loading || usuario?.idRol !== ROLES.ADMINISTRADOR || !['PENDIENTE', 'CONFIRMADA'].includes(venta?.estadoOperacion)) return;
    inFlight.current = true; setSubmitting(true); setError(''); setStatus(undefined);
    try {
      const response = await anularVenta(venta.idVenta, data);
      if (!active.current) return;
      const anulada = response.data;
      if (!anulada || anulada.idVenta !== venta.idVenta || anulada.estadoOperacion !== 'ANULADA' || !anulada.fechaAnulacion || !idValido(String(anulada.idUsuarioAnulador)) || !anulada.motivoAnulacion) throw new Error('Respuesta de anulación no verificable');
      setResultado(anulada); setMotivo('');
    } catch (failure) {
      if (!active.current) return;
      const codigo = failure.response?.status;
      setStatus(codigo); setRequiereConsulta(!codigo || codigo === 404 || codigo === 409 || codigo >= 500);
      setError(codigo === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.' : codigo === 403 ? 'No tienes autorización para anular ventas.'
        : !codigo || codigo >= 500 ? 'No fue posible comprobar el resultado de la anulación. Actualiza la venta para consultar su estado antes de otro envío.' : getApiErrorMessage(failure));
    } finally { inFlight.current = false; if (active.current) setSubmitting(false); }
  };
  const query = anterior && !anterior.error ? serializarConsultaVenta(anterior.filtros) : '';
  const definitiva = !!venta?.fechaVenta;
  return <div className="catalogo-page ventas-page">
    <Link className="back-link" to={`/ventas${query ? `?${query}` : ''}`} state={{ sidebarItemKey }}><AppIcon name="arrowLeft" size={17} />Volver a Ventas</Link>
    {location.state?.ventaRegistrada && venta?.estadoOperacion === 'PENDIENTE' && <FeedbackMessage tone="success" message="Venta pendiente registrada. El registro no descuenta ni reserva inventario." />}
    {resultado?.estadoOperacion === 'CONFIRMADA' && <FeedbackMessage tone="success" message="Venta confirmada. El backend confirmó el estado, las existencias y las salidas de inventario." />}
    {resultado?.estadoOperacion === 'ANULADA' && <FeedbackMessage tone="success" message={resultado.fechaVenta ? 'Venta anulada. El backend confirmó la anulación y las reversiones de sus salidas de inventario, conservando el historial.' : 'Venta pendiente anulada. Se conserva el historial, sin reversiones ni cambios de saldo.'} />}
    {location.state?.recetaRegistrada && <FeedbackMessage tone="success" message={`Receta #${location.state.recetaRegistrada} registrada. El registro no implica aprobación ni confirma la venta. Consulta su estado en las recetas de esta venta.`} />}
    <header className="page-heading"><div><h2>{venta ? `Venta #${venta.idVenta}` : 'Detalle de la venta'}</h2><p>Información registrada, productos y recetas vinculadas.</p></div>{venta && <VentaEstado estado={venta.estadoOperacion} />}</header>
    <section className="catalogo-panel" aria-label="Datos de la venta">
      <div className="catalogo-toolbar"><h3>Datos de la operación</h3><button className="button button--secondary" type="button" onClick={actualizar} disabled={consulta.loading || submitting || restringida}>Actualizar</button></div>
      <div aria-busy={consulta.loading}>
        {consulta.loading ? <CatalogoState loading message="Cargando venta…" /> : consulta.error ? <VentaError consulta={consulta} /> : venta && <>
          {venta.estadoOperacion === 'PENDIENTE' && <p className="venta-aviso">Esta venta está pendiente: todavía no ha descontado ni reservado inventario. Sus existencias son provisionales.</p>}
          <dl className="catalogo-detail venta-detail">
            <div><dt>Fecha y hora de registro</dt><dd>{horaCivil(venta.fechaRegistro)}</dd></div>
            <div><dt>Fecha efectiva de venta</dt><dd>{venta.fechaVenta ? horaCivil(venta.fechaVenta) : 'Sin confirmación registrada'}</dd></div>
            <div><dt>Responsable del registro</dt><dd>{venta.usuarioRegistrador?.nombreUsuario || `Usuario #${venta.idUsuario}`}</dd></div>
            <div><dt>Clave de operación</dt><dd className="venta-clave">{venta.claveOperacion ?? 'Sin clave registrada'}</dd></div>
            <div><dt>Total registrado</dt><dd className="venta-total">{costoDecimal(venta.total)}</dd></div>
          </dl>
          {venta.estadoOperacion === 'ANULADA' && <section className="venta-anulacion" aria-label="Información de anulación"><h3>Venta anulada</h3><dl>
            <div><dt>Fecha y hora de anulación</dt><dd>{horaCivil(venta.fechaAnulacion)}</dd></div><div><dt>Responsable de anulación</dt><dd>{venta.usuarioAnulador?.nombreUsuario || (venta.idUsuarioAnulador ? `Usuario #${venta.idUsuarioAnulador}` : '—')}</dd></div>
            <div className="venta-anulacion__motivo"><dt>Motivo</dt><dd>{venta.motivoAnulacion || 'Sin motivo registrado'}</dd></div>
          </dl><p>{definitiva ? 'Se conserva la información de la venta confirmada y su anulación. Las salidas se compensan en el backend mediante reversiones.' : 'La venta se anuló sin confirmación registrada y sin salidas de inventario que revertir.'} Esta venta no puede anularse nuevamente.</p></section>}
        </>}
      </div>
    </section>
    {venta && <>
      <section className="catalogo-panel" aria-label="Detalles de la venta"><div className="catalogo-toolbar"><div><h3>Productos registrados</h3><p>{venta.detalles.length} detalles registrados</p></div></div>
        <p className="catalogo-note">{definitiva ? 'Se muestra la asignación definitiva de existencias entregada por el backend.' : 'Las existencias son referencias provisionales reales, sin reserva ni garantía de disponibilidad. El backend realiza la asignación definitiva al confirmar.'} Los datos del catálogo son los actuales.</p>
        {venta.detalles.length ? <VentaDetallesTable detalles={venta.detalles} definitiva={definitiva} /> : <CatalogoState icon="sales" title="Sin detalles registrados" message="La consulta no contiene productos para esta venta." />}
      </section>
      <section className="catalogo-panel" aria-label="Recetas vinculadas"><div className="catalogo-toolbar"><div><h3>Recetas de la venta</h3><p>Estado de revisión, sin datos personales del paciente.</p></div><div className="venta-recetas__acciones">
        {usuario?.idRol === ROLES.REGENTE && <Link className="button button--secondary" to={`/ventas/${venta.idVenta}/recetas`}>Consultar recetas</Link>}
        {venta.estadoOperacion === 'PENDIENTE' && [ROLES.REGENTE, ROLES.VENDEDOR].includes(usuario?.idRol) && <Link className="button button--primary" to={`/ventas/${venta.idVenta}/recetas/nueva`}>Registrar receta</Link>}
      </div></div>
        {venta.recetas.length ? <ul className="venta-recetas">{venta.recetas.map(receta => <li key={receta.idReceta}>{usuario?.idRol === ROLES.REGENTE ? <Link className="venta-link" to={`/ventas/${venta.idVenta}/recetas/${receta.idReceta}`}>Receta #{receta.idReceta}</Link> : <strong>Receta #{receta.idReceta}</strong>}<RecetaEstado resultado={receta.resultadoRevision} /></li>)}</ul> : <CatalogoState icon="prescription" title="Sin recetas registradas" message="Esta venta todavía no tiene recetas asociadas." />}
        <p className="catalogo-note">Registrar o revisar una receta no confirma automáticamente la venta.</p>
      </section>
      {venta.estadoOperacion === 'PENDIENTE' && usuario?.idRol === ROLES.VENDEDOR && <section className="catalogo-panel venta-confirmacion" aria-label="Confirmación de venta">
        <h3>Confirmar venta pendiente</h3><p>Venta #{venta.idVenta} · {venta.detalles.length} detalles · Total registrado: <strong>{costoDecimal(venta.total)}</strong></p>
        {advertenciasRecetasVenta(venta).length > 0 && <p className="venta-aviso">Hay productos con una receta vinculada que no figura aprobada. El backend rechazará la confirmación si no cumplen los requisitos.</p>}
        <p className="form-field__help">El backend comprobará si faltan recetas requeridas, su aprobación, la condición de venta y el stock. Aplicará FEFO y podrá dividir los productos entre varias existencias. Revisar recetas no confirma esta venta.</p>
        <FeedbackMessage message={error} />
        {requiereConsulta && <p role="status">Actualiza la venta y revisa el resultado antes de solicitar otra confirmación.</p>}
        {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
        <button ref={confirmButton} className="button button--primary" type="button" disabled={submitting || requiereConsulta || restringida || !venta.detalles.length} onClick={() => setOpen(true)}>Confirmar venta</button>
      </section>}
      {['PENDIENTE', 'CONFIRMADA'].includes(venta.estadoOperacion) && usuario?.idRol === ROLES.ADMINISTRADOR && <VentaAnularForm venta={venta} motivo={motivo} onChange={setMotivo} onSubmit={anular} submitting={submitting} error={error} status={status} requiereConsulta={requiereConsulta} />}
    </>}
    <ConfirmDialog manageFocus returnFocusRef={confirmButton} open={open && !!venta && venta.estadoOperacion === 'PENDIENTE'} title="Confirmar venta" description={venta ? `Venta #${venta.idVenta}: ${venta.detalles.length} detalles, total registrado ${costoDecimal(venta.total)}. Se revalidarán recetas, stock y vencimientos. Si todo es válido, se confirmará la venta y se descontará inventario de forma conjunta.` : ''}
      confirmLabel="Confirmar venta y descontar inventario" tone="primary" busy={submitting} onConfirm={confirmar} onClose={() => { if (!submitting) setOpen(false); }} />
  </div>;
};

export const VentaDetailPage = () => {
  const { idVenta } = useParams();
  return <VentaDetalle key={idVenta} idVenta={idVenta} />;
};
