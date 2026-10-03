import db from '../../data/models/index.js';
import { medicamentoRepository } from '../../data/repositories/medicamento.repository.js';
import { AppError } from '../../shared/errors/app-error.js';

const campos = {
    idProveedorLaboratorio: 'id_proveedor_laboratorio',
    codigoMedicamento: 'codigo_medicamento',
    nombreComercial: 'nombre_comercial',
    formaFarmaceutica: 'forma_farmaceutica',
    presentacion: 'presentacion',
    unidadInventario: 'unidad_inventario',
    stockMinimo: 'stock_minimo',
    condicionVenta: 'condicion_venta',
    viaAdministracion: 'via_administracion',
    tipoLiberacion: 'tipo_liberacion',
    estado: 'estado'
};
const camposIdentidad = [
    'codigo_medicamento', 'id_proveedor_laboratorio', 'forma_farmaceutica',
    'presentacion', 'unidad_inventario', 'via_administracion', 'tipo_liberacion'
];
const toModelData = (data) => Object.fromEntries(
    Object.entries(data).map(([campo, valor]) => [campos[campo], valor])
);

// Compartir la representación de la relación entre la consulta del catálogo
// y las operaciones de composición, sin dependencias circulares entre Services.
export const toPublicComposicion = (composicion) => {
    const data = composicion.get ? composicion.get({ plain: true }) : composicion;
    return {
        idComposicion: data.id_composicion,
        idMedicamento: data.id_medicamento,
        idPrincipioActivo: data.id_principio_activo,
        cantidadPrincipioActivo: String(data.cantidad_principio_activo),
        unidadPrincipioActivo: data.unidad_principio_activo,
        cantidadReferencia: String(data.cantidad_referencia),
        unidadReferencia: data.unidad_referencia,
        principioActivo: data.principioActivo ? {
            idPrincipioActivo: data.principioActivo.id_principio_activo,
            nombre: data.principioActivo.nombre
        } : undefined
    };
};

const toPublicMedicamento = (medicamento) => {
    const data = medicamento.get ? medicamento.get({ plain: true }) : medicamento;
    return {
        idMedicamento: data.id_medicamento,
        idProveedorLaboratorio: data.id_proveedor_laboratorio,
        codigoMedicamento: data.codigo_medicamento,
        nombreComercial: data.nombre_comercial,
        formaFarmaceutica: data.forma_farmaceutica,
        presentacion: data.presentacion,
        unidadInventario: data.unidad_inventario,
        stockMinimo: data.stock_minimo,
        condicionVenta: data.condicion_venta,
        viaAdministracion: data.via_administracion,
        tipoLiberacion: data.tipo_liberacion,
        estado: Boolean(data.estado),
        proveedorLaboratorio: data.proveedorLaboratorio ? {
            idProveedorLaboratorio: data.proveedorLaboratorio.id_proveedor_laboratorio,
            nombre: data.proveedorLaboratorio.nombre
        } : undefined,
        composicion: (data.composiciones || []).map(toPublicComposicion)
    };
};

const validateProveedorActivo = async (idProveedorLaboratorio, transaction) => {
    const proveedor = await medicamentoRepository.findProveedorById({ idProveedorLaboratorio, transaction });
    if (!proveedor) throw new AppError('Proveedor o laboratorio no encontrado', 404);
    if (!proveedor.estado) throw new AppError('El proveedor o laboratorio está inactivo', 409);
};

const validateCodigoDisponible = async (codigoMedicamento, transaction, idMedicamento) => {
    const existente = await medicamentoRepository.findByCodigo({ codigoMedicamento, transaction });
    if (existente && existente.id_medicamento !== idMedicamento) {
        throw new AppError('El código de medicamento ya está en uso', 409);
    }
};

const handleDuplicateDatabaseError = (error) => {
    if (error?.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('El código de medicamento ya está en uso', 409);
    }
    throw error;
};

export class medicamentoService {
    static async getMedicamentos(filtros) {
        const medicamentos = await medicamentoRepository.findAll(filtros);
        return medicamentos.map(toPublicMedicamento);
    }

    static async getMedicamentoById(idMedicamento, transaction = undefined) {
        const medicamento = await medicamentoRepository.findById({ idMedicamento, transaction });
        if (!medicamento) throw new AppError('Medicamento no encontrado', 404);
        return toPublicMedicamento(medicamento);
    }

    static async getMedicamentoForUpdate(idMedicamento, transaction) {
        const medicamento = await medicamentoRepository.findById({ idMedicamento, transaction, lock: true });
        if (!medicamento) throw new AppError('Medicamento no encontrado', 404);
        return medicamento;
    }

    static async validateSinHistorial(idMedicamento, transaction) {
        const tieneHistorial = await medicamentoRepository.hasMovimientos({ idMedicamento, transaction });
        if (tieneHistorial) {
            throw new AppError('El medicamento tiene historial: no se puede modificar su identidad ni su composición. Registre un nuevo medicamento si cambia el producto', 409);
        }
    }

    static async createMedicamento(data) {
        try {
            return await db.sequelize.transaction(async (transaction) => {
                await validateProveedorActivo(data.idProveedorLaboratorio, transaction);
                await validateCodigoDisponible(data.codigoMedicamento, transaction);
                const medicamento = await medicamentoRepository.create({ data: toModelData(data), transaction });
                return this.getMedicamentoById(medicamento.id_medicamento, transaction);
            });
        } catch (error) {
            handleDuplicateDatabaseError(error);
        }
    }

    static async updateMedicamento(idMedicamento, data) {
        try {
            return await db.sequelize.transaction(async (transaction) => {
                const medicamento = await this.getMedicamentoForUpdate(idMedicamento, transaction);
                const values = toModelData(data);
                const cambiaIdentidad = camposIdentidad.some((campo) =>
                    values[campo] !== undefined && values[campo] !== medicamento.get(campo)
                );
                if (cambiaIdentidad) await this.validateSinHistorial(idMedicamento, transaction);
                if (data.idProveedorLaboratorio !== undefined) {
                    await validateProveedorActivo(data.idProveedorLaboratorio, transaction);
                }
                if (data.codigoMedicamento !== undefined) {
                    await validateCodigoDisponible(data.codigoMedicamento, transaction, idMedicamento);
                }
                await medicamentoRepository.update({ idMedicamento, data: values, transaction });
                return this.getMedicamentoById(idMedicamento, transaction);
            });
        } catch (error) {
            handleDuplicateDatabaseError(error);
        }
    }

    static async updateEstado(idMedicamento, { estado }) {
        return db.sequelize.transaction(async (transaction) => {
            await this.getMedicamentoForUpdate(idMedicamento, transaction);
            await medicamentoRepository.updateEstado({ idMedicamento, estado, transaction });
            return this.getMedicamentoById(idMedicamento, transaction);
        });
    }
}
