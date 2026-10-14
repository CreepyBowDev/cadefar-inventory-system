import db from '../../data/models/index.js';
import { medicamentoRepository } from '../../data/repositories/medicamento.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { decimalAEntero } from '../../shared/utils/decimal.js';

// Unidades y textos se comparan en MySQL con la colación de cada columna.
// Canonizar números y ordenar ingredientes no introduce conversiones farmacéuticas.
export const composicionCanonica = componentes => componentes.map(c => ({
    idPrincipioActivo: c.idPrincipioActivo ?? c.id_principio_activo,
    cantidadPrincipioActivo: decimalAEntero(String(c.cantidadPrincipioActivo ?? c.cantidad_principio_activo), 4),
    unidadPrincipioActivo: c.unidadPrincipioActivo ?? c.unidad_principio_activo,
    cantidadReferencia: decimalAEntero(String(c.cantidadReferencia ?? c.cantidad_referencia), 4),
    unidadReferencia: c.unidadReferencia ?? c.unidad_referencia
})).sort((a, b) => a.idPrincipioActivo - b.idPrincipioActivo);

export const transaccionCatalogo = async callback => {
    try {
        return await db.sequelize.transaction({
            isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, callback);
    } catch (error) {
        // Traducir contención solo después de terminar el rollback gestionado.
        throw convertirErrorContencionCatalogo(error);
    }
};

export const bloquearProveedoresIdentidad = async (ids, transaction) => {
    const proveedores = new Map();
    for (const idProveedorLaboratorio of [...new Set(ids)].sort((a, b) => a - b)) {
        const proveedor = await medicamentoRepository.findProveedorById({
            idProveedorLaboratorio, transaction, exclusivo: true
        });
        if (!proveedor) throw anotarErrorAuditoria(new AppError('Proveedor o laboratorio no encontrado', 404), { causa: 'NO_ENCONTRADO' });
        proveedores.set(idProveedorLaboratorio, proveedor);
    }
    return proveedores;
};

export const validarIdentidadDisponible = async (medicamento, composicion, transaction, idMedicamento) => {
    const coincidencias = await medicamentoRepository.findDuplicadosIdentidad({
        medicamento, composicion: composicionCanonica(composicion), transaction, idMedicamento
    });
    if (coincidencias.length) {
        throw anotarErrorAuditoria(new AppError('Ya existe un medicamento registrado con estas características y composición.', 409,
            { medicamentosExistentes: coincidencias.map(c => ({
                idMedicamento: c.id_medicamento, codigoMedicamento: c.codigo_medicamento,
                nombreComercial: c.nombre_comercial, estado: Boolean(c.estado)
            })) }), { causa: 'CONFLICTO' });
    }
};

export const convertirErrorContencionCatalogo = error => {
    const codigo = error.parent?.code || error.original?.code;
    if (codigo === 'ER_LOCK_DEADLOCK') {
        return anotarErrorAuditoria(new AppError('Conflicto temporal del catálogo: se detectó un bloqueo mutuo. Intente nuevamente', 409), { causa: 'CONFLICTO' });
    }
    if (codigo === 'ER_LOCK_WAIT_TIMEOUT') {
        return anotarErrorAuditoria(new AppError('Se agotó la espera de bloqueo del catálogo. Intente nuevamente', 409), { causa: 'CONFLICTO' });
    }
    return error;
};
