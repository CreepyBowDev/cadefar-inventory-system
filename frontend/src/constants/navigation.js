import { ROLES } from './roles.js';

const ALL_ROLES = [
  ROLES.ADMINISTRADOR,
  ROLES.REGENTE,
  ROLES.VENDEDOR
];

export const NAVIGATION_ITEMS = Object.freeze([
  {
    key: 'dashboard',
    label: 'Inicio',
    description: 'Resumen de tu espacio de trabajo',
    path: '/dashboard',
    icon: 'home',
    roles: ALL_ROLES,
    available: true
  },
  {
    key: 'usuarios',
    label: 'Usuarios',
    description: 'Cuentas, roles y acceso al sistema',
    path: '/usuarios',
    icon: 'users',
    roles: [ROLES.ADMINISTRADOR],
    available: true
  },
  {
    key: 'proveedores',
    label: 'Proveedores / Laboratorios',
    description: 'Directorio de proveedores y laboratorios',
    icon: 'truck',
    roles: [],
    available: false
  },
  {
    key: 'medicamentos',
    label: 'Medicamentos',
    description: 'Catálogo y control de medicamentos',
    icon: 'pill',
    roles: [ROLES.REGENTE],
    available: false
  },
  {
    key: 'compras',
    label: 'Compras',
    description: 'Adquisiciones y recepción de productos',
    icon: 'cart',
    roles: [ROLES.ADMINISTRADOR],
    available: false
  },
  {
    key: 'ventas',
    label: 'Ventas',
    description: 'Registro de ventas de medicamentos',
    icon: 'sales',
    roles: [ROLES.VENDEDOR],
    available: false
  },
  {
    key: 'inventario',
    label: 'Inventario',
    description: 'Existencias y movimientos',
    icon: 'inventory',
    roles: [ROLES.REGENTE],
    available: false
  },
  {
    key: 'vencimientos',
    label: 'Vencimientos',
    description: 'Próximos a vencer y retiros',
    icon: 'calendar',
    roles: [ROLES.REGENTE],
    available: false
  },
  {
    key: 'recetas',
    label: 'Recetas',
    description: 'Revisión y control de recetas',
    icon: 'prescription',
    roles: [ROLES.REGENTE],
    available: false
  },
  {
    key: 'reportes',
    label: 'Reportes',
    description: 'Consultas operativas y trazabilidad',
    icon: 'report',
    roles: [],
    available: false
  }
]);

export const getNavigationForRole = (idRol) =>
  NAVIGATION_ITEMS.filter((item) => item.roles.includes(idRol));

export const getPageTitle = (pathname) => {
  if (pathname.startsWith('/usuarios/nuevo')) {
    return 'Nuevo usuario';
  }

  if (pathname.includes('/usuarios/') && pathname.endsWith('/editar')) {
    return 'Editar usuario';
  }

  return NAVIGATION_ITEMS.find((item) => item.path === pathname)?.label || 'CADEFAR';
};
