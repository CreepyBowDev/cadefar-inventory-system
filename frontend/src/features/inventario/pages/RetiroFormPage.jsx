import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { StatusBadge } from '../../../components/StatusBadge.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { idValido } from '../../../utils/presentacion.js';
import { ConsultaMeta } from '../components/ConsultaMeta.jsx';
import { ExistenciaObservada } from '../components/ExistenciaObservada.jsx';
import { RetiroForm } from '../components/RetiroForm.jsx';
import { RetiroResultado } from '../components/RetiroResultado.jsx';
import { registrarRetiroVencimiento, registrarRetiroDano } from '../services/inventario.service.js';
import { consultarExistencia } from '../utils/consultaExistencia.js';
import '../styles/inventario.css';

const borradorVacio = () => ({ cantidad: '', observacion: '' });
const RetiroExistencia = ({ idMedicamento, idExistencia, tipo }) => {
  const consulta = useConsulta(consultarExistencia, `${idMedicamento}/${idExistencia}`, { idMedicamento, idExistencia });
  const [form, setForm] = useState(borradorVacio);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState();
  const [requiereConsulta, setRequiereConsulta] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [reconsultado, setReconsultado] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const porDano = tipo === 'dano';
  const motivo = porDano ? 'daño' : 'vencimiento';
  const actualizar = () => {
    if (inFlight.current) return;
    setError(''); setStatus(undefined); setRequiereConsulta(false); setReconsultado(true); consulta.retry();
  };
  const guardar = async (data) => {
    if (!data || inFlight.current || requiereConsulta || resultado) return;
    inFlight.current = true; setSubmitting(true); setError(''); setStatus(undefined); setReconsultado(false);
    try {
      const response = await (porDano ? registrarRetiroDano(data) : registrarRetiroVencimiento(data));
      if (active.current) setResultado(response.data);
    } catch (failure) {
      if (!active.current) return;
      const codigo = failure.response?.status;
      const mensaje = codigo === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.' : codigo === 403 ? 'No tienes autorización para registrar retiros.'
        : codigo >= 500 ? 'No fue posible confirmar el resultado. Vuelve a consultar la existencia y revisa su historial antes de preparar otro envío.' : getApiErrorMessage(failure);
      setError(mensaje); setStatus(codigo); setRequiereConsulta(!codigo || codigo === 404 || codigo === 409 || codigo >= 500);
    } finally { inFlight.current = false; if (active.current) setSubmitting(false); }
  };
  const med = consulta.data?.medicamento;
  const existencia = consulta.data?.existencia;
  const sinSaldo = existencia?.stockFisico === 0;
  const noVencida = !porDano && existencia && !existencia.vencida;
  return <div className="catalogo-page inventario-page retiro-page">
    <Link className="back-link" to={idValido(idMedicamento) ? `/inventario/medicamentos/${idMedicamento}/existencias` : '/inventario'}><AppIcon name="arrowLeft" size={17} />Volver a existencias</Link>
    <header className="page-heading"><div><h2>Retirar por {motivo}</h2><p>{med ? `${med.nombreComercial} · ${med.codigoMedicamento} · ${med.presentacion}` : 'Consulta una existencia y registra las unidades que se retirarán físicamente.'}</p></div>{med && <StatusBadge active={med.estado} />}</header>
    {resultado ? <RetiroResultado resultado={resultado} idMedicamento={idMedicamento} onNuevoRetiro={() => { setResultado(null); setForm(borradorVacio()); actualizar(); }} /> : <section className="catalogo-panel" aria-label={`Retiro por ${motivo}`}>
      <div className="catalogo-toolbar"><div><h3>{existencia?.codigoExistencia || 'Estado de la existencia'}</h3><p>El saldo y el último movimiento se consultan conjuntamente.</p></div><button className="button button--secondary" type="button" onClick={actualizar} disabled={submitting || consulta.loading || status === 401 || status === 403}>Volver a consultar la existencia</button></div>
      <div aria-busy={consulta.loading}>
        {consulta.loading ? <CatalogoState loading message="Consultando saldo e historial observados…" /> : consulta.error ? <CatalogoState title={consulta.status === 404 ? 'Existencia no encontrada' : 'No fue posible preparar el retiro'} message={consulta.error} onRetry={consulta.status === 401 || consulta.status === 403 ? undefined : actualizar}>{consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}</CatalogoState> : existencia && <>
          <ConsultaMeta meta={consulta.meta} />
          <ExistenciaObservada existencia={existencia} className="retiro-observado" />
          <p className="catalogo-note">{porDano ? 'Registra unidades con daño identificado, aunque estén vencidas o el medicamento inactivo. No se requiere vencimiento.' : 'Solo se retiran por vencimiento unidades vencidas. El estado DIA/MES y el corte comercial de Bolivia los comprueba el backend al registrar.'}</p>
          {sinSaldo || noVencida ? <CatalogoState title={sinSaldo ? 'Sin saldo físico para retirar' : 'La existencia todavía no está vencida'} message={sinSaldo ? 'La cantidad retirada debe ser positiva. Vuelve a consultar si el saldo cambió.' : 'El estado consultado no habilita un retiro por vencimiento. Puedes volver a consultar la existencia.'} /> : <>
            {reconsultado && <div className="retiro-aviso"><FeedbackMessage tone="success" message="Saldo e historial consultados nuevamente. Revisa la cantidad y la observación antes de confirmar." /></div>}
            <RetiroForm tipo={tipo} existencia={existencia} medicamento={med} form={form} onChange={setForm} onSubmit={guardar} submitting={submitting} blocked={requiereConsulta || status === 401 || status === 403} error={error} status={status} requiereConsulta={requiereConsulta} />
          </>}
        </>}
      </div>
    </section>}
  </div>;
};

export const RetiroFormPage = ({ tipo }) => {
  const { idMedicamento, idExistencia } = useParams();
  return <RetiroExistencia key={`${tipo}/${idMedicamento}/${idExistencia}`} idMedicamento={idMedicamento} idExistencia={idExistencia} tipo={tipo} />;
};
