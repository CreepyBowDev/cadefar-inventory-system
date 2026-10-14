import { getRoleName } from '../../../constants/roles.js';

export const CAMPOS_BITACORA = Object.freeze({
  nombreUsuario: 'Nombre de usuario', idRol: 'Rol', estado: 'Estado', correoAsignado: 'Correo asignado',
  nombre: 'Nombre', codigoMedicamento: 'Código de medicamento', nombreComercial: 'Nombre comercial',
  idProveedorLaboratorio: 'ID de proveedor / laboratorio', formaFarmaceutica: 'Forma farmacéutica',
  presentacion: 'Presentación', unidadInventario: 'Unidad de inventario', stockMinimo: 'Stock mínimo',
  condicionVenta: 'Condición de venta', viaAdministracion: 'Vía de administración', tipoLiberacion: 'Tipo de liberación',
  idMedicamento: 'ID de medicamento', idPrincipioActivo: 'ID de principio activo', cantidadPrincipioActivo: 'Cantidad de principio activo',
  unidadPrincipioActivo: 'Unidad del principio activo', cantidadReferencia: 'Cantidad de referencia', unidadReferencia: 'Unidad de referencia',
  estadoOperacion: 'Estado de la operación', total: 'Total', cantidadDetalles: 'Cantidad de detalles',
  codigoExistencia: 'Código de existencia', stockFisico: 'Stock físico', costoUnitarioPromedio: 'Costo unitario promedio'
});
const camposSinValor = { correo: 'Correo', telefono: 'Teléfono', direccion: 'Dirección', descripcion: 'Descripción' };
export const METADATOS_BITACORA = Object.freeze({
  intentosFallidos: 'Intentos de contraseña fallidos', intentosCodigoFallidos: 'Intentos de código fallidos',
  bloqueadoDesde: 'Inicio del bloqueo', bloqueadoHasta: 'Fin previsto del bloqueo', duracionMinutos: 'Duración del bloqueo (minutos)',
  efecto: 'Efecto de la operación', estadoEnvio: 'Estado técnico del envío', operacionOrigen: 'Operación de origen', etapa: 'Etapa',
  cantidadDetalles: 'Cantidad de detalles', cantidadMovimientos: 'Cantidad de movimientos', cantidadExistencias: 'Cantidad de existencias',
  cantidadComponentes: 'Cantidad de componentes', cantidadReferenciasOmitidas: 'Referencias omitidas',
  cantidadRetirada: 'Cantidad retirada', diferencia: 'Diferencia del conteo', ajusteRealizado: 'Ajuste realizado', perdida: 'Pérdida valorizada',
  modoAnulacion: 'Modo de anulación', cantidadResultados: 'Cantidad de resultados'
});
const causas = {
  PASSWORD_INCORRECTA: 'Contraseña incorrecta', USUARIO_INEXISTENTE: 'Usuario inexistente', USUARIO_INACTIVO: 'Usuario inactivo',
  BLOQUEO_GENERADO: 'Bloqueo generado', BLOQUEO_VIGENTE: 'Bloqueo vigente', SESION_AUSENTE: 'Sesión ausente', TOKEN_INVALIDO: 'Token inválido',
  TOKEN_EXPIRADO: 'Token expirado', SESION_INVALIDA: 'Sesión inválida', CREDENCIALES_DESACTUALIZADAS: 'Credenciales desactualizadas',
  ROL_NO_PERMITIDO: 'Rol no permitido', ENTRADA_INVALIDA: 'Entrada inválida', NO_ENCONTRADO: 'Recurso no encontrado', CONFLICTO: 'Conflicto',
  LIMITE_CUENTA: 'Límite de cuenta', LIMITE_IP: 'Límite de IP', RECUPERACION_NO_HABILITADA: 'Recuperación no habilitada',
  CODIGO_INVALIDO: 'Código inválido', CODIGO_VENCIDO: 'Código vencido', CODIGO_UTILIZADO: 'Código utilizado',
  CORREO_NO_DISPONIBLE: 'Correo no disponible', ENVIO_RECHAZADO: 'Envío rechazado', ENVIO_INCIERTO: 'Envío incierto',
  PRECONDICIONES_DESACTUALIZADAS: 'Precondiciones desactualizadas', STOCK_INSUFICIENTE: 'Stock insuficiente',
  ERROR_CONEXION: 'Error de conexión', ERROR_PERSISTENCIA: 'Error de persistencia', ERROR_ENVIO: 'Error de envío', ERROR_INTERNO: 'Error interno'
};
const codigos = { CONFIRMADO: 'Confirmado', NO_APLICA: 'No aplica', INCIERTO: 'Incierto', ACEPTADO: 'Aceptado', RECHAZADO: 'Rechazado',
  VERIFICACION: 'Verificación', FIRMA_TOKEN: 'Firma del token', SEGURIDAD: 'Seguridad', AUDITORIA: 'Auditoría', CONFIRMACION: 'Confirmación', COOKIE: 'Cookie', RESPUESTA: 'Respuesta' };
export const nombreCausaBitacora = causa => Object.hasOwn(causas, causa) ? causas[causa] : causa || 'Sin causa registrada';
export const valorBitacora = (valor, campo) => {
  if (valor === undefined) return 'No capturado';
  if (valor === null) return 'Sin valor';
  if (typeof valor === 'boolean') return campo === 'estado' ? valor ? 'Activo' : 'Inactivo' : valor ? 'Sí' : 'No';
  if (!['string', 'number'].includes(typeof valor)) return 'Valor no disponible';
  if (campo === 'idRol') return `${getRoleName(valor)} (#${valor})`;
  if (['efecto', 'estadoEnvio', 'etapa'].includes(campo) && Object.hasOwn(codigos, valor)) return codigos[valor];
  return valor === '' ? 'Texto vacío' : String(valor);
};
export const cambiosBitacora = evento => {
  const modificados = Array.isArray(evento.metadatos?.camposModificados) ? evento.metadatos.camposModificados : [];
  return Object.entries({ ...CAMPOS_BITACORA, ...camposSinValor }).filter(([campo]) =>
    Object.hasOwn(evento.antes || {}, campo) || Object.hasOwn(evento.despues || {}, campo) || modificados.includes(campo)
  ).map(([campo, nombre]) => ({ campo, nombre, sinValor: Object.hasOwn(camposSinValor, campo) }));
};
export const fechaMetadatoBitacora = valor => {
  // Estos dos metadatos se persistieron como texto SQL UTC dentro del JSON.
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(valor)
    ? `${valor.replace(' ', 'T')}Z` : valor;
};
