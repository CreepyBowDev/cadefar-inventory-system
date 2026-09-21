import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { UsuarioForm } from '../components/UsuarioForm.jsx';
import {
  createUsuario,
  getUsuario,
  updateUsuario
} from '../services/usuario.service.js';
import '../styles/usuarios.css';

export const UsuarioFormPage = ({ mode }) => {
  const isCreate = mode === 'create';
  const { idUsuario } = useParams();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(!isCreate);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isCreate) {
      return;
    }

    const numericId = Number(idUsuario);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      setErrorMessage('El identificador del usuario no es válido.');
      setLoading(false);
      return;
    }

    let active = true;

    const loadUsuario = async () => {
      try {
        const data = await getUsuario(numericId);

        if (active) {
          setUsuario(data);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            getApiErrorMessage(error, 'No fue posible cargar el usuario.')
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadUsuario();

    return () => {
      active = false;
    };
  }, [idUsuario, isCreate]);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      if (isCreate) {
        const createdUsuario = await createUsuario(data);
        navigate('/usuarios', {
          replace: true,
          state: {
            message: `El usuario ${createdUsuario.nombreUsuario} fue creado correctamente.`
          }
        });
      } else {
        const updatedUsuario = await updateUsuario(Number(idUsuario), data);
        navigate('/usuarios', {
          replace: true,
          state: {
            message: `Los datos de ${updatedUsuario.nombreUsuario} fueron actualizados correctamente.`
          }
        });
      }
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          isCreate
            ? 'No fue posible crear el usuario.'
            : 'No fue posible modificar el usuario.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading" role="status">
        <span className="session-loader__mark" aria-hidden="true" />
        <span>Cargando usuario…</span>
      </div>
    );
  }

  if (!isCreate && !usuario) {
    return (
      <div className="usuario-form-state">
        <AppIcon name="alert" size={30} />
        <h2>No se pudo abrir el usuario</h2>
        <p>{errorMessage}</p>
        <Link className="button button--secondary" to="/usuarios">
          Volver a Usuarios
        </Link>
      </div>
    );
  }

  return (
    <div className="usuario-form-page">
      <Link className="back-link" to="/usuarios">
        <AppIcon name="arrowLeft" size={17} />
        Volver a Usuarios
      </Link>

      <header className="page-heading">
        <div>
          <h2>{isCreate ? 'Crear usuario' : 'Editar usuario'}</h2>
          <p>
            {isCreate
              ? 'Registra una cuenta y asígnale uno de los roles existentes.'
              : 'Modifica únicamente el nombre de usuario o su rol.'}
          </p>
        </div>
      </header>

      <section className="usuario-form-panel">
        <div className="usuario-form-panel__intro">
          <span>{isCreate ? 'Nueva cuenta' : `Usuario #${usuario.idUsuario}`}</span>
          <h3>Datos de acceso</h3>
          <p>
            {isCreate
              ? 'El estado inicial de la cuenta es gestionado automáticamente por el backend.'
              : 'El estado y la contraseña se administran mediante acciones separadas.'}
          </p>
        </div>
        <UsuarioForm
          mode={mode}
          initialData={usuario}
          submitting={submitting}
          apiError={errorMessage}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/usuarios')}
        />
      </section>
    </div>
  );
};
