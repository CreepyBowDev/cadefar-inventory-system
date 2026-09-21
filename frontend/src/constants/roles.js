export const ROLES = Object.freeze({
  ADMINISTRADOR: 1,
  REGENTE: 2,
  VENDEDOR: 3
});

export const ROLE_NAMES = Object.freeze({
  [ROLES.ADMINISTRADOR]: 'Administrador',
  [ROLES.REGENTE]: 'Regente',
  [ROLES.VENDEDOR]: 'Vendedor'
});

export const ROLE_OPTIONS = Object.freeze([
  { idRol: ROLES.ADMINISTRADOR, nombre: ROLE_NAMES[ROLES.ADMINISTRADOR] },
  { idRol: ROLES.REGENTE, nombre: ROLE_NAMES[ROLES.REGENTE] },
  { idRol: ROLES.VENDEDOR, nombre: ROLE_NAMES[ROLES.VENDEDOR] }
]);

export const getRoleName = (idRol) => ROLE_NAMES[idRol] || 'Rol no identificado';
