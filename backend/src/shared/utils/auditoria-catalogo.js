import { AUDITORIA } from '../constants/auditoria.js';

// Snapshots mínimos a partir de DTOs públicos, nunca de bodies/modelos completos.
export const snapshotUsuario = data => ({ nombreUsuario: data.nombreUsuario,
    idRol: data.rol.idRol, estado: data.estado, correoAsignado: Boolean(data.correo) });

export const cuentaAuditoriaUsuario = data => ({ idUsuario: data.idUsuario,
    nombreUsuario: data.nombreUsuario, idRol: data.rol.idRol });

export const snapshotProveedor = data => ({ nombre: data.nombre, estado: data.estado });
export const snapshotPrincipio = data => ({ nombre: data.nombre, estado: data.estado });

export const snapshotMedicamento = data => Object.fromEntries([
    'codigoMedicamento', 'nombreComercial', 'idProveedorLaboratorio', 'formaFarmaceutica',
    'presentacion', 'unidadInventario', 'stockMinimo', 'condicionVenta', 'viaAdministracion',
    'tipoLiberacion', 'estado'
].map(campo => [campo, data[campo]]));

export const snapshotComposicion = data => Object.fromEntries([
    'idMedicamento', 'idPrincipioActivo', 'cantidadPrincipioActivo', 'unidadPrincipioActivo',
    'cantidadReferencia', 'unidadReferencia'
].map(campo => [campo, data[campo]]));

export const camposModificadosAuditoria = (antes, despues, privados = []) => [
    ...Object.keys(despues).filter(campo => antes[campo] !== despues[campo]), ...privados
];

export const snapshotCompra = data => ({ estadoOperacion: data.estadoOperacion,
    total: data.total, idProveedorLaboratorio: data.idProveedorLaboratorio, cantidadDetalles: data.detalles.length });

export const snapshotExistencia = data => ({ codigoExistencia: data.codigo_existencia,
    stockFisico: data.cantidad_fisica, costoUnitarioPromedio: String(data.costo_unitario_promedio) });

// Una operación puede afectar más registros que el máximo de referencias del
// contrato. Conservar el total omitido y las referencias en orden determinista.
export const referenciasAuditoriaAcotadas = referencias => ({
    referencias: referencias.slice(0, AUDITORIA.MAX_REFERENCIAS),
    cantidadReferenciasOmitidas: Math.max(0, referencias.length - AUDITORIA.MAX_REFERENCIAS)
});
