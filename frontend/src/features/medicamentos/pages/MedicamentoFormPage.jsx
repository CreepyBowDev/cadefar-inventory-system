import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { getProveedoresLaboratorios } from '../../proveedores/services/proveedor-laboratorio.service.js';
import { MedicamentoForm } from '../components/MedicamentoForm.jsx';
import { createMedicamento, getMedicamento, updateMedicamento } from '../services/medicamento.service.js';
import '../styles/medicamentos.css';

export const MedicamentoFormPage = ({ mode }) => {
  const isCreate = mode === 'create';
  const { idMedicamento } = useParams();
  const navigate = useNavigate();
  const [medicamento, setMedicamento] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoaded(false); setError(''); setMedicamento(null);
    const id = Number(idMedicamento);
    if (!isCreate && (!Number.isInteger(id) || id <= 0 || id > 2147483647)) {
      setError('El identificador del medicamento no es válido.'); setLoading(false); return;
    }
    Promise.all([getProveedoresLaboratorios(), isCreate ? Promise.resolve(null) : getMedicamento(id)])
      .then(([options, data]) => { if (active) { setProveedores(options); setMedicamento(data); setLoaded(true); } })
      .catch((error) => { if (active) setError(getApiErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idMedicamento, isCreate, revision]);

  const submit = async (data) => {
    if (submitting) return;
    setSubmitting(true); setError('');
    try {
      const saved = isCreate ? await createMedicamento(data) : await updateMedicamento(Number(idMedicamento), data);
      navigate(`/medicamentos/${saved.idMedicamento}`, { replace: true, state: { message: `${saved.nombreComercial} fue ${isCreate ? 'creado' : 'actualizado'} correctamente.` } });
    } catch (error) { setError(getApiErrorMessage(error)); }
    finally { setSubmitting(false); }
  };

  return <div className="catalogo-page">
    <Link className="back-link" to="/medicamentos"><AppIcon name="arrowLeft" size={17} />Volver a Medicamentos</Link>
    {loading ? <CatalogoState loading message="Cargando datos del formulario…" /> : !loaded ? <CatalogoState title="No se pudo abrir el formulario" message={error} onRetry={() => setRevision((current) => current + 1)} /> : <>
      <header className="page-heading"><div><h2>{isCreate ? 'Crear medicamento' : 'Editar medicamento'}</h2><p>{isCreate ? 'Registra el producto y después agrega su composición.' : 'Modifica sus datos. El estado se administra mediante una acción separada.'}</p></div></header>
      <section className="catalogo-panel catalogo-form-panel">
        <div className="catalogo-form-intro"><span>{isCreate ? 'Nuevo producto' : medicamento.codigoMedicamento}</span><h3>Datos del medicamento</h3><p>{isCreate ? 'El medicamento se registra activo por defecto.' : 'Si el medicamento tiene historial, el backend protege su identidad. Un cambio de producto requiere un nuevo registro.'}</p></div>
        <MedicamentoForm key={`${mode}-${idMedicamento || 'nuevo'}-${revision}`} initialData={medicamento} proveedores={proveedores} submitting={submitting} apiError={error} onSubmit={submit} onCancel={() => navigate('/medicamentos')} />
      </section>
    </>}
  </div>;
};
