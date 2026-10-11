import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { getMedicamentos } from '../../medicamentos/services/medicamento.service.js';
import { getProveedoresLaboratorios } from '../../proveedores/services/proveedor-laboratorio.service.js';
import { CompraError } from '../components/CompraError.jsx';
import { CompraForm } from '../components/CompraForm.jsx';
import { createCompra, getCompras } from '../services/compra.service.js';
import '../styles/compras.css';

const consultarOpciones = async () => {
  const [medicamentos, proveedores] = await Promise.all([getMedicamentos(), getProveedoresLaboratorios()]);
  return { data: { medicamentos, proveedores } };
};
const mensajeError = (error) => error.response?.status === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.'
  : error.response?.status === 403 ? 'No tienes autorización para registrar compras.'
    : error.response?.status >= 500 ? 'No fue posible confirmar el registro. Consulta tu compra por clave antes de reintentar.' : getApiErrorMessage(error);

export const CompraFormPage = () => {
  const navigate = useNavigate();
  const opciones = useConsulta(consultarOpciones, 'catalogo-compras');
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState();
  const [lookup, setLookup] = useState({});
  // El ref evita dos envíos antes de que React pinte el estado busy.
  const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const guardar = async (data) => {
    if (!data || inFlight.current) return;
    inFlight.current = true; setSubmitting(true); setAttempted(true); setError(''); setStatus(undefined); setLookup({});
    try {
      const response = await createCompra(data);
      if (!active.current) return;
      navigate(`/compras/${response.data.idCompra}`, { replace: true, state: { compraRegistrada: true } });
    } catch (failure) { if (active.current) { setError(mensajeError(failure)); setStatus(failure.response?.status); } }
    finally { inFlight.current = false; if (active.current) setSubmitting(false); }
  };
  const consultarClave = async (claveOperacion) => {
    if (inFlight.current) return;
    inFlight.current = true; setLookup({ loading: true });
    try { const response = await getCompras({ claveOperacion }); if (active.current) setLookup({ data: response.data }); }
    catch (failure) { if (active.current) setLookup({ error: mensajeError(failure), status: failure.response?.status }); }
    finally { inFlight.current = false; }
  };
  const elegibles = opciones.data?.medicamentos.some((m) => m.estado && opciones.data.proveedores.some((p) => p.estado && p.idProveedorLaboratorio === m.idProveedorLaboratorio));
  return <div className="catalogo-page compras-page compra-nueva-page">
    <Link className="back-link" to="/compras"><AppIcon name="arrowLeft" size={17} />Volver a Compras</Link>
    <header className="page-heading"><div><h2>Registrar compra</h2><p>Registra una adquisición y las unidades recibidas de un único proveedor o laboratorio.</p></div></header>
    <section className="catalogo-panel" aria-label="Registro de compra" aria-busy={opciones.loading}>
      {opciones.loading ? <CatalogoState loading message="Cargando medicamentos y proveedores…" /> : opciones.error ? <CompraError consulta={opciones} /> : !elegibles ? <CatalogoState title="No hay medicamentos disponibles para recepción" message="Necesitas medicamentos activos relacionados con un proveedor o laboratorio activo." onRetry={opciones.retry} /> : <CompraForm medicamentos={opciones.data.medicamentos} proveedores={opciones.data.proveedores} submitting={submitting} attempted={attempted} apiError={error} status={status} lookup={lookup} onLookup={consultarClave} onSubmit={guardar} onCancel={() => navigate('/compras')} />}
    </section>
  </div>;
};
