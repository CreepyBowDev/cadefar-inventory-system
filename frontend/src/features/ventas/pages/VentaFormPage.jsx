import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { ROLES } from '../../../constants/roles.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { getMedicamentos } from '../../medicamentos/services/medicamento.service.js';
import { VentaForm } from '../components/VentaForm.jsx';
import { VentaError } from '../components/VentaError.jsx';
import { createVenta } from '../services/venta.service.js';
import '../styles/ventas.css';

const consultarMedicamentos = async () => ({ data: await getMedicamentos() });

export const VentaFormPage = () => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const opciones = useConsulta(consultarMedicamentos, 'catalogo-ventas');
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState();
  const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const guardar = async (data) => {
    if (!data || inFlight.current || usuario?.idRol !== ROLES.VENDEDOR || status === 401 || status === 403) return;
    inFlight.current = true; setSubmitting(true); setAttempted(true); setError(''); setStatus(undefined);
    try {
      const response = await createVenta(data);
      if (!active.current) return;
      if (!response.data?.idVenta || response.data.estadoOperacion !== 'PENDIENTE') throw new Error('Respuesta de registro no verificable');
      navigate(`/ventas/${response.data.idVenta}`, { replace: true, state: { ventaRegistrada: true } });
    } catch (failure) {
      if (!active.current) return;
      const codigo = failure.response?.status;
      setStatus(codigo);
      setError(codigo === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.' : codigo === 403 ? 'No tienes autorización para registrar ventas.'
        : !codigo || codigo >= 500 ? 'No fue posible comprobar el resultado del registro. Consulta tus ventas y compara la clave antes de reintentar con la misma clave.' : getApiErrorMessage(failure));
    } finally { inFlight.current = false; if (active.current) setSubmitting(false); }
  };
  return <div className="catalogo-page ventas-page venta-nueva-page">
    <Link className="back-link" to="/ventas"><AppIcon name="arrowLeft" size={17} />Volver a Ventas</Link>
    <header className="page-heading"><div><h2>Registrar venta</h2><p>Prepara y guarda una venta pendiente. Su confirmación posterior es la que afecta al inventario.</p></div></header>
    <section className="catalogo-panel" aria-label="Registro de venta pendiente" aria-busy={opciones.loading}>
      {opciones.loading ? <CatalogoState loading message="Cargando medicamentos…" /> : opciones.error ? <VentaError consulta={opciones} /> : !opciones.data?.some(m => m.estado) ? <CatalogoState icon="sales" title="No hay medicamentos activos" message="Se necesita al menos un medicamento activo con una existencia real para preparar una venta." onRetry={opciones.retry} />
        : <VentaForm medicamentos={opciones.data} submitting={submitting} attempted={attempted} apiError={error} status={status} idUsuario={usuario.idUsuario} onSubmit={guardar} onCancel={() => navigate('/ventas')} />}
    </section>
  </div>;
};
