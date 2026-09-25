import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { ProveedorLaboratorioForm } from '../components/ProveedorLaboratorioForm.jsx';
import {
  createProveedorLaboratorio,
  getProveedorLaboratorio,
  updateProveedorLaboratorio
} from '../services/proveedor-laboratorio.service.js';
import '../styles/proveedores.css';

export const ProveedorLaboratorioFormPage = ({ mode }) => {
  const isCreate = mode === 'create';
  const { idProveedorLaboratorio } = useParams();
  const navigate = useNavigate();
  const [proveedor, setProveedor] = useState(null);
  const [loading, setLoading] = useState(!isCreate);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isCreate) return;

    const numericId = Number(idProveedorLaboratorio);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setErrorMessage('El identificador del proveedor o laboratorio no es válido.');
      setLoading(false);
      return;
    }

    let active = true;
    const loadProveedor = async () => {
      try {
        const data = await getProveedorLaboratorio(numericId);
        if (active) setProveedor(data);
      } catch (error) {
        if (active) setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar el registro.'));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProveedor();
    return () => { active = false; };
  }, [idProveedorLaboratorio, isCreate]);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      const saved = isCreate
        ? await createProveedorLaboratorio(data)
        : await updateProveedorLaboratorio(Number(idProveedorLaboratorio), data);
      navigate('/proveedores', {
        replace: true,
        state: {
          message: isCreate
            ? `${saved.nombre} fue creado correctamente.`
            : `Los datos de ${saved.nombre} fueron actualizados correctamente.`
        }
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(
        error,
        isCreate ? 'No fue posible crear el registro.' : 'No fue posible modificar el registro.'
      ));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading" role="status">
        <span className="session-loader__mark" aria-hidden="true" />
        <span>Cargando registro…</span>
      </div>
    );
  }

  if (!isCreate && !proveedor) {
    return (
      <div className="proveedor-page-state">
        <AppIcon name="alert" size={30} />
        <h2>No se pudo abrir el registro</h2>
        <p>{errorMessage}</p>
        <Link className="button button--secondary" to="/proveedores">Volver a Proveedores / Laboratorios</Link>
      </div>
    );
  }

  return (
    <div className="proveedor-form-page">
      <Link className="back-link" to="/proveedores">
        <AppIcon name="arrowLeft" size={17} />
        Volver a Proveedores / Laboratorios
      </Link>
      <header className="page-heading">
        <div>
          <h2>{isCreate ? 'Crear proveedor o laboratorio' : 'Editar proveedor o laboratorio'}</h2>
          <p>{isCreate
            ? 'Registra los datos de la entidad que suministra medicamentos.'
            : 'Modifica sus datos. El estado se administra desde el listado.'}</p>
        </div>
      </header>
      <section className="proveedor-form-panel">
        <div className="proveedor-form-panel__intro">
          <span>{isCreate ? 'Nuevo registro' : `Registro #${proveedor.idProveedorLaboratorio}`}</span>
          <h3>Datos del proveedor o laboratorio</h3>
          <p>Nombre, teléfono y dirección para identificar y contactar a la entidad.</p>
        </div>
        <ProveedorLaboratorioForm
          mode={mode}
          initialData={proveedor}
          submitting={submitting}
          apiError={errorMessage}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/proveedores')}
        />
      </section>
    </div>
  );
};
