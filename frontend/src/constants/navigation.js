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
    path: '/proveedores',
    icon: 'truck',
    roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE],
    available: true
  },
  {
    key: 'medicamentos',
    label: 'Medicamentos',
    description: 'Catálogo y control de medicamentos',
    icon: 'pill',
    path: '/medicamentos',
    roles: ALL_ROLES,
    available: true
  },
  {
    key: 'principios-activos',
    label: 'Principios activos',
    description: 'Ingredientes de la composición de medicamentos',
    path: '/principios-activos',
    icon: 'prescription',
    roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE],
    available: true
  },
  {
    key: 'compras',
    label: 'Compras',
    description: 'Adquisiciones y recepción de productos',
    icon: 'cart',
    path: '/compras',
    roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE],
    available: true
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
    path: '/inventario',
    roles: ALL_ROLES,
    available: true
  },
  {
    key: 'vencimientos',
    label: 'Vencimientos',
    description: 'Próximos a vencer y vencidos pendientes de retiro',
    icon: 'calendar',
    path: '/vencimientos',
    roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE],
    available: true
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
  if (pathname.startsWith('/inventario/medicamentos/') && pathname.endsWith('/retiro-vencimiento')) return 'Retirar por vencimiento';
  if (pathname.startsWith('/inventario/medicamentos/') && pathname.endsWith('/retiro-dano')) return 'Retirar por daño';
  if (pathname.startsWith('/inventario/medicamentos/') && pathname.endsWith('/ajuste')) return 'Conciliar conteo físico';
  if (pathname === '/compras/nueva') return 'Registrar compra';
  if (pathname.startsWith('/compras/')) return 'Detalle de la compra';
  if (pathname === '/inventario/movimientos') return 'Movimientos de inventario';
  if (pathname === '/inventario/stock-bajo') return 'Stock bajo';
  if (pathname.startsWith('/inventario/medicamentos/')) return 'Existencias del medicamento';
  if (pathname === '/vencimientos') return 'Próximos a vencer';
  if (pathname === '/vencimientos/vencidos') return 'Vencidos pendientes de retiro';
  if (pathname.startsWith('/medicamentos/')) {
    if (pathname === '/medicamentos/nuevo') return 'Nuevo medicamento';
    if (pathname.endsWith('/editar')) return 'Editar medicamento';
    if (pathname.endsWith('/composicion')) return 'Composición del medicamento';
    return 'Detalle del medicamento';
  }

  if (pathname.startsWith('/principios-activos/')) {
    return pathname === '/principios-activos/nuevo' ? 'Nuevo principio activo' : 'Editar principio activo';
  }

  if (pathname.startsWith('/proveedores/')) {
    return 'Proveedores / Laboratorios';
  }

  if (pathname.startsWith('/usuarios/nuevo')) {
    return 'Nuevo usuario';
  }

  if (pathname.includes('/usuarios/') && pathname.endsWith('/editar')) {
    return 'Editar usuario';
  }

  return NAVIGATION_ITEMS.find((item) => item.path === pathname)?.label || 'CADEFAR';
};
