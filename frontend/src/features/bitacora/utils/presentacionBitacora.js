export const ZONA_HORARIA_BITACORA = 'America/La_Paz';

const fecha = new Intl.DateTimeFormat('es-BO', {
  timeZone: ZONA_HORARIA_BITACORA, day: '2-digit', month: '2-digit', year: 'numeric'
});
const hora = new Intl.DateTimeFormat('es-BO', {
  timeZone: ZONA_HORARIA_BITACORA, hour: '2-digit', minute: '2-digit', second: '2-digit',
  fractionalSecondDigits: 3, hourCycle: 'h23'
});

export const fechaRegistroBitacora = valor => {
  if (typeof valor !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(valor)) return null;
  const instante = new Date(valor);
  return Number.isFinite(instante.getTime()) ? { fecha: fecha.format(instante), hora: hora.format(instante) } : null;
};

export const TIPOS_EVENTO_BITACORA = Object.freeze({
  LOGIN_EXITO: 'Inicio de sesión correcto',
  LOGIN_PASSWORD_INCORRECTA: 'Contraseña incorrecta',
  LOGIN_USUARIO_INEXISTENTE: 'Usuario inexistente',
  LOGIN_USUARIO_INACTIVO: 'Acceso de cuenta desactivada',
  LOGIN_BLOQUEO_GENERADO: 'Bloqueo temporal generado',
  LOGIN_INTENTO_BLOQUEADO: 'Intento durante el bloqueo',
  LOGOUT: 'Cierre de sesión',
  SESION_AUSENTE: 'Solicitud sin sesión',
  TOKEN_INVALIDO: 'Token inválido',
  TOKEN_EXPIRADO: 'Token expirado',
  SESION_INVALIDA: 'Sesión inválida',
  ACCESO_DENEGADO: 'Acceso denegado',
  VALIDACION_RECHAZADA: 'Datos rechazados',
  ERROR_TECNICO: 'Fallo técnico',
  OPERACION_RECHAZADA: 'Operación rechazada',
  RECUPERACION_SOLICITAR: 'Solicitud de recuperación',
  RECUPERACION_EMITIR: 'Recuperación emitida',
  RECUPERACION_ENVIO: 'Resultado de envío de recuperación',
  PASSWORD_RESTABLECER_RECUPERACION: 'Contraseña restablecida por recuperación',
  PASSWORD_CAMBIAR_PROPIA: 'Cambio de contraseña propia',
  PASSWORD_RESTABLECER_ADMINISTRADOR: 'Restablecimiento de contraseña por Administrador',
  USUARIO_CREAR: 'Alta de usuario', USUARIO_MODIFICAR: 'Modificación de usuario',
  USUARIO_ESTADO: 'Cambio de estado de usuario',
  USUARIOS_CONSULTAR: 'Consulta de usuarios', USUARIO_CONSULTAR: 'Consulta de usuario',
  PROVEEDOR_LABORATORIO_CREAR: 'Alta de proveedor / laboratorio',
  PROVEEDOR_LABORATORIO_MODIFICAR: 'Modificación de proveedor / laboratorio',
  PROVEEDOR_LABORATORIO_ESTADO: 'Cambio de estado de proveedor / laboratorio',
  PRINCIPIO_ACTIVO_CREAR: 'Alta de principio activo',
  PRINCIPIO_ACTIVO_MODIFICAR: 'Modificación de principio activo',
  PRINCIPIO_ACTIVO_ESTADO: 'Cambio de estado de principio activo',
  MEDICAMENTO_CREAR: 'Alta de medicamento', MEDICAMENTO_MODIFICAR: 'Modificación de medicamento',
  MEDICAMENTO_ESTADO: 'Cambio de estado de medicamento',
  COMPOSICION_AGREGAR: 'Componente agregado', COMPOSICION_MODIFICAR: 'Componente modificado',
  COMPOSICION_RETIRAR: 'Componente retirado',
  COMPRA_REGISTRAR: 'Registro de compra', COMPRA_ANULAR: 'Anulación de compra',
  INVENTARIO_AJUSTAR: 'Ajuste de inventario', INVENTARIO_CONCILIAR: 'Conciliación sin diferencia',
  INVENTARIO_RETIRAR_VENCIMIENTO: 'Retiro por vencimiento', INVENTARIO_RETIRAR_DANO: 'Retiro por daño',
  BITACORA_CONSULTAR: 'Consulta de Bitácora', BITACORA_EVENTO_CONSULTAR: 'Consulta de evento de Bitácora'
});

export const MODULOS_BITACORA = Object.freeze({
  AUTENTICACION: 'Autenticación', SEGURIDAD: 'Seguridad', USUARIOS: 'Usuarios',
  PROVEEDORES_LABORATORIOS: 'Proveedores / Laboratorios', PRINCIPIOS_ACTIVOS: 'Principios activos',
  MEDICAMENTOS: 'Medicamentos', COMPOSICION: 'Composición', COMPRAS: 'Compras',
  INVENTARIO: 'Inventario', BITACORA: 'Bitácora'
});
export const REGISTROS_BITACORA = Object.freeze({
  USUARIO: 'Usuario', PROVEEDOR_LABORATORIO: 'Proveedor / Laboratorio', PRINCIPIO_ACTIVO: 'Principio activo',
  MEDICAMENTO: 'Medicamento', COMPOSICION: 'Componente', COMPRA: 'Compra', DETALLE_COMPRA: 'Detalle de compra',
  EXISTENCIA: 'Existencia', MOVIMIENTO: 'Movimiento', BITACORA: 'Evento de Bitácora'
});
const etiqueta = (catalogo, codigo) => Object.hasOwn(catalogo, codigo) ? catalogo[codigo] : codigo || 'No disponible';
export const nombreEventoBitacora = codigo => etiqueta(TIPOS_EVENTO_BITACORA, codigo);
export const nombreModuloBitacora = codigo => etiqueta(MODULOS_BITACORA, codigo);
export const nombreRegistroBitacora = codigo => etiqueta(REGISTROS_BITACORA, codigo);
