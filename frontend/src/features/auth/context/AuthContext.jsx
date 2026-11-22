import { createContext, useEffect, useMemo, useState } from 'react';
import {
  getSession,
  login as loginRequest,
  logout as logoutRequest
} from '../services/auth.service.js';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entornoPruebas, setEntornoPruebas] = useState(false);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const sessionUsuario = await getSession();

        if (active) {
          setUsuario(sessionUsuario);
          setEntornoPruebas(sessionUsuario.esPrueba === true);
        }
      } catch (error) {
        if (active) {
          setUsuario(null);
          setEntornoPruebas(error.response?.data?.esPrueba === true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const login = async (credentials) => {
    const authenticatedUsuario = await loginRequest(credentials);
    setEntornoPruebas(authenticatedUsuario.esPrueba === true);
    setUsuario(authenticatedUsuario);
    return authenticatedUsuario;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      setUsuario(null);
    }
  };

  const value = useMemo(
    () => ({
      usuario,
      isAuthenticated: Boolean(usuario),
      loading,
      entornoPruebas,
      login,
      logout
    }),
    [usuario, loading, entornoPruebas]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
