import { matchPath } from 'react-router-dom';
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
    children: [
      { key: 'crear-usuario', label: 'Crear usuario', path: '/usuarios/nuevo', roles: [ROLES.ADMINISTRADOR] },
      { key: 'consultar-usuarios', label: 'Consultar usuarios', path: '/usuarios', roles: [ROLES.ADMINISTRADOR] },
      { key: 'consultar-usuario-id', label: 'Consultar usuario por ID', path: '/usuarios', roles: [ROLES.ADMINISTRADOR] },
      { key: 'modificar-usuario', label: 'Modificar usuario', path: '/usuarios', matchPaths: ['/usuarios/:idUsuario/editar'], roles: [ROLES.ADMINISTRADOR] },
      { key: 'estado-usuario', label: 'Activar o desactivar usuario', path: '/usuarios', roles: [ROLES.ADMINISTRADOR] },
      { key: 'restablecer-password', label: 'Restablecer contraseña', path: '/usuarios', roles: [ROLES.ADMINISTRADOR] }
    ],
    available: true
  },
  {
    key: 'proveedores',
    label: 'Proveedores / Laboratorios',
    description: 'Directorio de proveedores y laboratorios',
    path: '/proveedores',
    icon: 'truck',
    roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE],
    children: [
      { key: 'registrar-proveedor', label: 'Registrar proveedor o laboratorio', path: '/proveedores/nuevo', roles: [ROLES.ADMINISTRADOR] },
      { key: 'consultar-proveedores', label: 'Consultar proveedores o laboratorios', path: '/proveedores', roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE] },
      { key: 'modificar-proveedor', label: 'Modificar proveedor o laboratorio', path: '/proveedores', matchPaths: ['/proveedores/:idProveedorLaboratorio/editar'], roles: [ROLES.ADMINISTRADOR] },
      { key: 'estado-proveedor', label: 'Activar o desactivar proveedor o laboratorio', path: '/proveedores', roles: [ROLES.ADMINISTRADOR] }
    ],
    available: true
  },
  {
    key: 'medicamentos',
    label: 'Medicamentos',
    description: 'Catálogo y control de medicamentos',
    icon: 'pill',
    path: '/medicamentos',
    roles: ALL_ROLES,
    children: [
      { key: 'registrar-medicamento', label: 'Registrar medicamento', path: '/medicamentos/nuevo', roles: [ROLES.REGENTE] },
      { key: 'consultar-medicamentos', label: 'Consultar o buscar medicamento', path: '/medicamentos', roles: ALL_ROLES },
      { key: 'modificar-medicamento', label: 'Modificar medicamento', path: '/medicamentos', matchPaths: ['/medicamentos/:idMedicamento/editar'], roles: [ROLES.REGENTE] },
      { key: 'estado-medicamento', label: 'Activar o desactivar medicamento', path: '/medicamentos', roles: [ROLES.REGENTE] },
      { key: 'composicion-medicamento', label: 'Gestionar composición', path: '/medicamentos', matchPaths: ['/medicamentos/:idMedicamento/composicion'], roles: [ROLES.REGENTE] },
      { key: 'consultar-composicion', label: 'Consultar medicamentos por composición', path: '/medicamentos', roles: ALL_ROLES }
    ],
    available: true
  },
  {
    key: 'principios-activos',
    label: 'Principios activos',
    description: 'Ingredientes de la composición de medicamentos',
    path: '/principios-activos',
    icon: 'prescription',
    roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE],
    children: [
      { key: 'registrar-principio', label: 'Registrar principio activo', path: '/principios-activos/nuevo', roles: [ROLES.REGENTE] },
      { key: 'consultar-principios', label: 'Consultar principios activos', path: '/principios-activos', roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE] },
      { key: 'modificar-principio', label: 'Modificar principio activo', path: '/principios-activos', matchPaths: ['/principios-activos/:idPrincipioActivo/editar'], roles: [ROLES.REGENTE] },
      { key: 'estado-principio', label: 'Activar o desactivar principio activo', path: '/principios-activos', roles: [ROLES.REGENTE] }
    ],
    available: true
  },
  {
    key: 'compras',
    label: 'Compras',
    description: 'Adquisiciones y recepción de productos',
    icon: 'cart',
    path: '/compras',
    roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE],
    children: [
      { key: 'registrar-compra', label: 'Registrar compra', path: '/compras/nueva', roles: [ROLES.ADMINISTRADOR] },
      { key: 'consultar-compras', label: 'Consultar compras', path: '/compras', roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE] },
      { key: 'anular-compra', label: 'Anular compra', path: '/compras', roles: [ROLES.ADMINISTRADOR] }
    ],
    available: true
  },
  {
    key: 'ventas',
    label: 'Ventas',
    description: 'Registro de ventas de medicamentos',
    icon: 'sales',
    path: '/ventas',
    roles: ALL_ROLES,
    children: [
      { key: 'registrar-venta', label: 'Registrar venta', path: '/ventas/nueva', roles: [ROLES.VENDEDOR] },
      { key: 'consultar-ventas', label: 'Consultar ventas', path: '/ventas', roles: ALL_ROLES },
      { key: 'anular-venta', label: 'Anular venta', path: '/ventas', roles: [ROLES.ADMINISTRADOR] }
    ],
    available: true
  },
  {
    key: 'inventario',
    label: 'Inventario',
    description: 'Existencias y movimientos',
    icon: 'inventory',
    path: '/inventario',
    roles: ALL_ROLES,
    children: [
      { key: 'consultar-inventario', label: 'Consultar inventario', path: '/inventario', roles: ALL_ROLES },
      { key: 'consultar-existencias', label: 'Consultar existencias de un medicamento', path: '/inventario', matchPaths: ['/inventario/medicamentos/:idMedicamento/existencias'], roles: ALL_ROLES },
      { key: 'registrar-ajuste', label: 'Registrar ajuste de inventario', path: '/inventario', matchPaths: ['/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/ajuste'], roles: [ROLES.REGENTE] },
      { key: 'consultar-movimientos', label: 'Consultar movimientos de inventario', path: '/inventario/movimientos', roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE] },
      { key: 'consultar-stock-bajo', label: 'Consultar medicamentos con stock bajo', path: '/inventario/stock-bajo', roles: ALL_ROLES }
    ],
    available: true
  },
  {
    key: 'vencimientos',
    label: 'Vencimientos',
    description: 'Próximos a vencer y vencidos pendientes de retiro',
    icon: 'calendar',
    path: '/vencimientos',
    roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE],
    children: [
      { key: 'consultar-proximos', label: 'Consultar productos próximos a vencer', path: '/vencimientos', roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE] },
      { key: 'consultar-vencidos', label: 'Consultar productos vencidos', path: '/vencimientos/vencidos', roles: [ROLES.ADMINISTRADOR, ROLES.REGENTE] },
      { key: 'retiro-vencimiento', label: 'Registrar retiro por vencimiento', path: '/vencimientos/vencidos', matchPaths: ['/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/retiro-vencimiento'], roles: [ROLES.REGENTE] },
      { key: 'retiro-dano', label: 'Registrar retiro por daño', path: '/inventario', matchPaths: ['/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/retiro-dano'], roles: [ROLES.REGENTE] }
    ],
    available: true
  },
  {
    key: 'recetas',
    label: 'Recetas',
    description: 'Revisión y control de recetas',
    icon: 'prescription',
    path: '/recetas',
    roles: [ROLES.REGENTE, ROLES.VENDEDOR],
    children: [
      { key: 'registrar-receta', label: 'Registrar receta', path: '/recetas/registrar', matchPaths: ['/ventas/:idVenta/recetas/nueva'], roles: [ROLES.REGENTE, ROLES.VENDEDOR] },
      { key: 'revisar-receta', label: 'Revisar receta', path: '/recetas', matchPaths: ['/ventas/:idVenta/recetas', '/ventas/:idVenta/recetas/:idReceta'], roles: [ROLES.REGENTE] }
    ],
    available: true
  },
  {
    key: 'reportes',
    label: 'Reportes',
    description: 'Consultas operativas y trazabilidad',
    icon: 'report',
    roles: [],
    available: false
  },
  {
    key: 'bitacora',
    label: 'Bitácora',
    description: 'Eventos, responsables y resultados del sistema',
    path: '/bitacora',
    icon: 'audit',
    roles: [ROLES.ADMINISTRADOR],
    available: true
  }
]);

export const getNavigationForRole = (idRol) =>
  NAVIGATION_ITEMS
    .filter((item) => item.roles.includes(idRol))
    .map((item) => {
      if (!item.children) return item;
      const children = item.children.filter((child) => child.roles.includes(idRol));
      // El acceso del dashboard también debe apuntar a una opción permitida.
      const path = children.some(child => child.path === item.path) ? item.path : children[0]?.path || item.path;
      return { ...item, path, children };
    });

export const getActiveSidebarItem = (items, pathname, selectedKey) => {
  const options = items.filter((item) => item.available).flatMap((item) =>
    (item.children || []).map((child) => ({ moduleKey: item.key, child }))
  );
  const matchesInternalRoute = ({ child }) =>
    child.matchPaths?.some((path) => matchPath({ path, end: true }, pathname));

  // La intención solo se conserva si corresponde a la ruta y al rol actuales.
  const selected = options.find((option) => option.child.key === selectedKey &&
    (option.child.path === pathname || matchesInternalRoute(option) || pathname.startsWith(`${option.child.path}/`)));
  const matched = selected || options.find(matchesInternalRoute) ||
    options.find(({ child }) => child.path === pathname);

  if (matched) return { moduleKey: matched.moduleKey, childKey: matched.child.key };

  const parent = items.find((item) => item.available && item.path &&
    (pathname === item.path || pathname.startsWith(`${item.path}/`)));
  return parent
    ? { moduleKey: parent.key, childKey: parent.children?.find((child) => child.path === parent.path)?.key }
    : null;
};

export const getPageTitle = (pathname) => {
  if (pathname === '/recetas/registrar' || /^\/ventas\/[^/]+\/recetas\/nueva$/.test(pathname)) return 'Registrar receta';
  if (pathname === '/recetas') return 'Revisar recetas';
  if (/^\/ventas\/[^/]+\/recetas\/[^/]+$/.test(pathname)) return 'Detalle de receta';
  if (/^\/ventas\/[^/]+\/recetas$/.test(pathname)) return 'Recetas de la venta';
  if (pathname === '/ventas/nueva') return 'Registrar venta';
  if (pathname.startsWith('/ventas/')) return 'Detalle de la venta';
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

  if (pathname.startsWith('/bitacora/')) return 'Detalle de Bitácora';
  return NAVIGATION_ITEMS.find((item) => item.path === pathname)?.label || 'CADEFAR';
};
