import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/pages/LoginPage.jsx';
import { RecuperacionPasswordPage } from '../features/auth/pages/RecuperacionPasswordPage.jsx';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage.jsx';
import { ProveedoresPage } from '../features/proveedores/pages/ProveedoresPage.jsx';
import { ProveedorLaboratorioDetailPage } from '../features/proveedores/pages/ProveedorLaboratorioDetailPage.jsx';
import { ProveedorLaboratorioFormPage } from '../features/proveedores/pages/ProveedorLaboratorioFormPage.jsx';
import { UsuarioFormPage } from '../features/usuarios/pages/UsuarioFormPage.jsx';
import { UsuariosPage } from '../features/usuarios/pages/UsuariosPage.jsx';
import { MedicamentosPage } from '../features/medicamentos/pages/MedicamentosPage.jsx';
import { MedicamentoFormPage } from '../features/medicamentos/pages/MedicamentoFormPage.jsx';
import { MedicamentoDetailPage } from '../features/medicamentos/pages/MedicamentoDetailPage.jsx';
import { MedicamentoComposicionPage } from '../features/medicamentos/pages/MedicamentoComposicionPage.jsx';
import { PrincipiosActivosPage } from '../features/principios-activos/pages/PrincipiosActivosPage.jsx';
import { PrincipioActivoFormPage } from '../features/principios-activos/pages/PrincipioActivoFormPage.jsx';
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
      },
      {
        path: '/recuperar-contrasena',
        element: <RecuperacionPasswordPage />
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
            element: <RoleRoute allowedRoles={[ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR]} />,
            children: [
              { path: '/medicamentos', element: <MedicamentosPage /> },
              { path: '/medicamentos/:idMedicamento', element: <MedicamentoDetailPage /> },
              { path: '/medicamentos/:idMedicamento/composicion', element: <MedicamentoComposicionPage /> }
            ]
          },
          {
            element: <RoleRoute allowedRoles={[ROLES.ADMINISTRADOR, ROLES.REGENTE]} />,
            children: [
              { path: '/principios-activos', element: <PrincipiosActivosPage /> }
            ]
          },
          {
            element: <RoleRoute allowedRoles={[ROLES.REGENTE]} />,
            children: [
              { path: '/medicamentos/nuevo', element: <MedicamentoFormPage mode="create" /> },
              { path: '/medicamentos/:idMedicamento/editar', element: <MedicamentoFormPage mode="edit" /> },
              { path: '/principios-activos/nuevo', element: <PrincipioActivoFormPage mode="create" /> },
              { path: '/principios-activos/:idPrincipioActivo/editar', element: <PrincipioActivoFormPage mode="edit" /> }
            ]
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
