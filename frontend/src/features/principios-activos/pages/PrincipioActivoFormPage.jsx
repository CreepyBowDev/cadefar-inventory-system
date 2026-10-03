import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { PrincipioActivoForm } from '../components/PrincipioActivoForm.jsx';
import { createPrincipioActivo, getPrincipioActivo, updatePrincipioActivo } from '../services/principio-activo.service.js';
import '../styles/principios-activos.css';

export const PrincipioActivoFormPage = ({ mode }) => {
  const isCreate = mode === 'create';
  const { idPrincipioActivo } = useParams();
  const navigate = useNavigate();
  const [principio, setPrincipio] = useState(null);
  const [loading, setLoading] = useState(!isCreate);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setPrincipio(null); setError(''); setLoading(!isCreate);
    if (isCreate) return;
    const id = Number(idPrincipioActivo);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) { setError('El identificador del principio activo no es válido.'); setLoading(false); return; }
    getPrincipioActivo(id).then((data) => { if (active) setPrincipio(data); })
      .catch((error) => { if (active) setError(getApiErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idPrincipioActivo, isCreate, revision]);
  const submit = async (data) => {
    if (submitting) return;
    setSubmitting(true); setError('');
    try {
      const saved = isCreate ? await createPrincipioActivo(data) : await updatePrincipioActivo(Number(idPrincipioActivo), data);
      navigate('/principios-activos', { replace: true, state: { message: `${saved.nombre} fue ${isCreate ? 'creado' : 'actualizado'} correctamente.` } });
    } catch (error) { setError(getApiErrorMessage(error)); }
    finally { setSubmitting(false); }
  };
  return <div className="catalogo-page">
    <Link className="back-link" to="/principios-activos"><AppIcon name="arrowLeft" size={17} />Volver a Principios activos</Link>
    {loading ? <CatalogoState loading message="Cargando principio activo…" /> : !isCreate && !principio ? <CatalogoState title="No se pudo abrir el principio activo" message={error} onRetry={() => setRevision((current) => current + 1)} /> : <>
      <header className="page-heading"><div><h2>{isCreate ? 'Crear principio activo' : 'Editar principio activo'}</h2><p>El estado se administra mediante una acción separada desde el listado.</p></div></header>
      <section className="catalogo-panel catalogo-form-panel"><div className="catalogo-form-intro"><span>{isCreate ? 'Nuevo ingrediente' : principio.nombre}</span><h3>Principio activo</h3><p>{isCreate ? 'Se registra activo por defecto. Luego podrás relacionarlo con medicamentos.' : 'Modifica el nombre y la descripción del ingrediente.'}</p></div>
        <PrincipioActivoForm key={`${mode}-${idPrincipioActivo || 'nuevo'}-${revision}`} initialData={principio} submitting={submitting} apiError={error} onSubmit={submit} onCancel={() => navigate('/principios-activos')} />
      </section>
    </>}
  </div>;
};
