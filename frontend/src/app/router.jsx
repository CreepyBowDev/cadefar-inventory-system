import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/pages/LoginPage.jsx';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage.jsx';
import { ProveedoresPage } from '../features/proveedores/pages/ProveedoresPage.jsx';
import { ProveedorLaboratorioDetailPage } from '../features/proveedores/pages/ProveedorLaboratorioDetailPage.jsx';
import { ProveedorLaboratorioFormPage } from '../features/proveedores/pages/ProveedorLaboratorioFormPage.jsx';
import { UsuarioFormPage } from '../features/usuarios/pages/UsuarioFormPage.jsx';
import { UsuariosPage } from '../features/usuarios/pages/UsuariosPage.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { MainLayout } from '../layouts/MainLayout.jsx';
import { ROLES } from '../constants/roles.js';
import { ProtectedRoute } from '../routes/ProtectedRoute.jsx';
import { RoleRoute } from '../routes/RoleRoute.jsx';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />
      }
    ]
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />
          },
          {
            path: '/dashboard',
            element: <DashboardPage />
          },
          {
            element: <RoleRoute allowedRoles={[ROLES.ADMINISTRADOR, ROLES.REGENTE]} />,
            children: [
              {
                path: '/proveedores',
                element: <ProveedoresPage />
              },
              {
                path: '/proveedores/:idProveedorLaboratorio',
                element: <ProveedorLaboratorioDetailPage />
              }
            ]
          },
          {
            element: <RoleRoute allowedRoles={[ROLES.ADMINISTRADOR]} />,
            children: [
              {
                path: '/proveedores/nuevo',
                element: <ProveedorLaboratorioFormPage mode="create" />
              },
              {
                path: '/proveedores/:idProveedorLaboratorio/editar',
                element: <ProveedorLaboratorioFormPage mode="edit" />
              },
              {
                path: '/usuarios',
                element: <UsuariosPage />
              },
              {
                path: '/usuarios/nuevo',
                element: <UsuarioFormPage mode="create" />
              },
              {
                path: '/usuarios/:idUsuario/editar',
                element: <UsuarioFormPage mode="edit" />
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />
  }
]);
