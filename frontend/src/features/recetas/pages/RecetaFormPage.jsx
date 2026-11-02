import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { useAuth } from '../../../hooks/useAuth.js';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { ROLES } from '../../../constants/roles.js';
import { idValido } from '../../../utils/presentacion.js';
import { getVenta } from '../../ventas/services/venta.service.js';
import { createReceta } from '../services/receta.service.js';
import { RecetaForm } from '../components/RecetaForm.jsx';
import { RecetaError } from '../components/RecetaError.jsx';
import { formularioRecetaInicial } from '../utils/recetaForm.js';
import { mensajeErrorReceta } from '../utils/recetaError.js';
import '../styles/recetas.css';

const consultarVenta = id => idValido(id) ? getVenta(id) : Promise.reject({ response: { status: 400, data: { message: 'El identificador de la venta no es válido.' } } });

const RecetaRegistro = ({ idVenta }) => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const consulta = useConsulta(consultarVenta, idVenta, idVenta);
  const [form, setForm] = useState(formularioRecetaInicial);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState();
  const active = useRef(true), inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const venta = consulta.loading || consulta.error ? undefined : consulta.data;
  const guardar = async data => {
    if (inFlight.current || blocked || !venta || venta.estadoOperacion !== 'PENDIENTE' || ![ROLES.REGENTE, ROLES.VENDEDOR].includes(usuario?.idRol)) return;
    inFlight.current = true; setBusy(true); setError(''); setStatus(undefined);
    try {
      const response = await createReceta(venta.idVenta, data);
      if (!active.current) return;
      const receta = response.data;
      if (!receta || !idValido(String(receta.idReceta)) || receta.idVenta !== venta.idVenta || receta.resultadoRevision !== null || receta.idUsuarioValidador !== null || receta.fechaValidacion !== null) throw new Error('Registro no verificable');
      // Solo el identificador viaja en el estado de navegación, nunca datos personales.
      navigate(`/ventas/${venta.idVenta}`, { replace: true, state: { recetaRegistrada: receta.idReceta } });
    } catch (failure) {
      if (!active.current) return;
      const codigo = failure.response?.status;
      setStatus(codigo); setError(mensajeErrorReceta(failure, 'registro'));
      setBlocked(!codigo || codigo >= 500 || [401, 403, 404, 409].includes(codigo));
    } finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  return <div className="catalogo-page recetas-page">
    <Link className="back-link" to={`/ventas/${idVenta}`}><AppIcon name="arrowLeft" size={17} />Volver a la venta</Link>
    <header className="page-heading"><div><h2>Registrar receta</h2><p>Transcribe la receta física y vincula los productos de la venta #{idVenta}. Sin carga de archivos.</p></div></header>
    <section className="catalogo-panel" aria-label="Registro de receta" aria-busy={consulta.loading}>
      {consulta.loading ? <CatalogoState loading message="Cargando venta para registrar la receta…" /> : consulta.error ? <RecetaError consulta={consulta} />
        : venta?.estadoOperacion !== 'PENDIENTE' ? <CatalogoState icon="prescription" title="La venta no está pendiente" message="Solo se pueden registrar recetas en una venta pendiente. Consulta su estado actual desde el detalle." />
          : <RecetaForm venta={venta} form={form} onChange={setForm} onSubmit={guardar} busy={busy} blocked={blocked} apiError={error} status={status} />}
    </section>
  </div>;
};

export const RecetaFormPage = () => {
  const { idVenta } = useParams();
  return <RecetaRegistro key={idVenta} idVenta={idVenta} />;
};
