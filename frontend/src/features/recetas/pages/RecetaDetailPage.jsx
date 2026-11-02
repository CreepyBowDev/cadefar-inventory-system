import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { useAuth } from '../../../hooks/useAuth.js';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { ROLES } from '../../../constants/roles.js';
import { fechaCivil, horaCivil, idValido } from '../../../utils/presentacion.js';
import { getVenta } from '../../ventas/services/venta.service.js';
import { getReceta, revisarReceta } from '../services/receta.service.js';
import { RecetaEstado } from '../components/RecetaEstado.jsx';
import { RecetaError } from '../components/RecetaError.jsx';
import { RecetaRevisionForm } from '../components/RecetaRevisionForm.jsx';
import { revisionPendiente } from '../utils/recetaForm.js';
import { mensajeErrorReceta } from '../utils/recetaError.js';
import '../styles/recetas.css';

const consultarDetalle = async ({ idVenta, idReceta }) => {
  if (!idValido(idVenta) || !idValido(idReceta)) throw { response: { status: 400, data: { message: 'El identificador de venta o receta no es válido.' } } };
  const [venta, receta] = await Promise.all([getVenta(idVenta), getReceta(idVenta, idReceta)]);
  return { data: { venta: venta.data, receta: receta.data } };
};

const RecetaDetalle = ({ idVenta, idReceta }) => {
  const { usuario } = useAuth();
  const consulta = useConsulta(consultarDetalle, `${idVenta}/${idReceta}`, { idVenta, idReceta });
  const [resultado, setResultado] = useState(null);
  const [form, setForm] = useState({ resultadoRevision: '', observacion: '' });
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(''), [status, setStatus] = useState();
  const active = useRef(true), inFlight = useRef(false), inicializada = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (consulta.data && !inicializada.current) { inicializada.current = true; setForm(actual => ({ ...actual, observacion: consulta.data.receta.observacion || '' })); }
  }, [consulta.data]);
  const restringida = [status, consulta.status].some(codigo => codigo === 401 || codigo === 403);
  const contexto = consulta.loading || consulta.error || restringida ? undefined : consulta.data;
  const receta = contexto && (resultado || contexto.receta);
  const actualizar = () => {
    if (inFlight.current || restringida) return;
    setResultado(null); setError(''); setStatus(undefined); setBlocked(false); consulta.retry();
  };
  const guardar = async data => {
    if (inFlight.current || blocked || restringida || usuario?.idRol !== ROLES.REGENTE || !receta || !revisionPendiente(receta) || contexto.venta.estadoOperacion !== 'PENDIENTE') return;
    inFlight.current = true; setBusy(true); setError(''); setStatus(undefined);
    try {
      const response = await revisarReceta(Number(idVenta), Number(idReceta), data);
      if (!active.current) return;
      const revisada = response.data;
      if (!revisada || revisada.idReceta !== Number(idReceta) || revisada.idVenta !== Number(idVenta) || revisada.resultadoRevision !== data.resultadoRevision || !idValido(String(revisada.idUsuarioValidador)) || !revisada.fechaValidacion) throw new Error('Revisión no verificable');
      setResultado(revisada);
    } catch (failure) {
      if (!active.current) return;
      const codigo = failure.response?.status;
      if (codigo === 401 || codigo === 403) { setResultado(null); setForm({ resultadoRevision: '', observacion: '' }); }
      setStatus(codigo); setError(mensajeErrorReceta(failure, 'revision'));
      setBlocked(!codigo || codigo >= 500 || [401, 403, 404, 409].includes(codigo));
    } finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  return <div className="catalogo-page recetas-page">
    <Link className="back-link" to={`/ventas/${idVenta}/recetas`}><AppIcon name="arrowLeft" size={17} />Volver a las recetas de la venta</Link>
    <header className="page-heading"><div><h2>{receta ? `Receta #${receta.idReceta}` : 'Detalle de receta'}</h2><p>Datos de la receta física. Acceso reservado al Regente.</p></div>{receta && <RecetaEstado resultado={receta.resultadoRevision} inconsistente={receta.resultadoRevision === null && !revisionPendiente(receta)} />}</header>
    {(status === 401 || status === 403) && <><FeedbackMessage message={error} />{status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}</>}
    {resultado && <FeedbackMessage tone="success" message="Revisión registrada. La venta no se ha confirmado automáticamente ni se ha modificado el inventario." />}
    <section className="catalogo-panel" aria-label="Datos de la receta">
      <div className="catalogo-toolbar"><h3>Información registrada</h3><button className="button button--secondary" type="button" disabled={consulta.loading || busy || restringida} onClick={actualizar}>Actualizar receta</button></div>
      <div aria-busy={consulta.loading}>
        {consulta.loading ? <CatalogoState loading message="Cargando receta…" /> : consulta.error ? <RecetaError consulta={consulta} /> : receta && <>
          <dl className="catalogo-detail receta-detail">
            <div><dt>Venta vinculada</dt><dd><Link className="venta-link" to={`/ventas/${idVenta}`}>Venta #{receta.idVenta}</Link><small>Estado: {contexto.venta.estadoOperacion}</small></dd></div>
            <div><dt>Número de receta</dt><dd>{receta.numeroReceta || 'Sin número registrado'}</dd></div><div><dt>Fecha de receta</dt><dd>{fechaCivil(receta.fechaReceta)}</dd></div><div><dt>Fecha de registro</dt><dd>{horaCivil(receta.fechaRegistro)}</dd></div>
            <div><dt>Nombre del paciente</dt><dd>{receta.nombrePaciente}</dd></div><div><dt>Documento del paciente</dt><dd>{receta.documentoPaciente}</dd></div><div><dt>Nombre del médico</dt><dd>{receta.nombreMedico}</dd></div><div><dt>Modalidad</dt><dd>{receta.modalidad}</dd></div>
            <div><dt>Responsable de revisión</dt><dd>{receta.idUsuarioValidador ? `Usuario #${receta.idUsuarioValidador}` : 'Sin revisión registrada'}</dd></div><div><dt>Fecha de revisión</dt><dd>{horaCivil(receta.fechaValidacion)}</dd></div><div><dt>Observación registrada</dt><dd>{receta.observacion || 'Sin observación'}</dd></div>
          </dl>
          {!revisionPendiente(receta) && <p className="catalogo-note">Esta receta ya tiene datos de revisión. No puede modificarse la decisión ni registrarse una segunda revisión.</p>}
          {contexto.venta.estadoOperacion !== 'PENDIENTE' && <p className="catalogo-note">La venta no está pendiente. La receta se conserva como información histórica y no puede revisarse.</p>}
        </>}
      </div>
    </section>
    {receta && <section className="catalogo-panel" aria-label="Productos respaldados por la receta"><div className="catalogo-toolbar"><h3>Productos respaldados</h3></div>
      {contexto.venta.detalles.some(d => d.idReceta === receta.idReceta) ? <ul className="venta-recetas">{contexto.venta.detalles.filter(d => d.idReceta === receta.idReceta).map(d => <li key={d.idDetalleVenta}><strong>{d.existencia?.medicamento?.nombreComercial || 'Medicamento no disponible'}</strong><span>Detalle #{d.idDetalleVenta} · Cantidad: {d.cantidad}</span></li>)}</ul>
        : <p className="catalogo-note">Esta receta pertenece a la venta, pero no tiene detalles vinculados y no respalda por sí sola sus productos.</p>}
    </section>}
    {receta && contexto.venta.estadoOperacion === 'PENDIENTE' && revisionPendiente(receta) && usuario?.idRol === ROLES.REGENTE && <RecetaRevisionForm receta={receta} form={form} onChange={setForm} onSubmit={guardar} busy={busy} blocked={blocked || restringida} apiError={error} status={status} />}
  </div>;
};

export const RecetaDetailPage = () => {
  const { idVenta, idReceta } = useParams();
  return <RecetaDetalle key={`${idVenta}/${idReceta}`} idVenta={idVenta} idReceta={idReceta} />;
};
