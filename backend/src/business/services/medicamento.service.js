import db from '../../data/models/index.js';
import { medicamentoRepository } from '../../data/repositories/medicamento.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { obtenerPrefijoMedicamento } from '../../shared/utils/codigo-medicamento.js';
import { composicionMedicamentoRepository } from '../../data/repositories/composicion-medicamento.repository.js';
import { transaccionCatalogo, bloquearProveedoresIdentidad, validarIdentidadDisponible,
    convertirErrorContencionCatalogo } from './identidad-medicamento.js';

const campos = {
    idProveedorLaboratorio: 'id_proveedor_laboratorio',
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
    'id_proveedor_laboratorio', 'forma_farmaceutica',
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

const validateCodigoNoEnviado = (data) => {
    if (Object.hasOwn(data, 'codigoMedicamento')) {
        throw new AppError('El código del medicamento lo genera el sistema y no puede modificarse', 400);
    }
};

const esColisionCodigo = (error) => {
    const mensaje = error.parent?.sqlMessage || error.original?.sqlMessage || '';
    return error.name === 'SequelizeUniqueConstraintError' &&
        /for key ['`](?:[^'`]+\.)?uq_medicamento_codigo['`]/i.test(mensaje);
};

const generarCodigo = async (prefijo, transaction) => {
    const mayor = await medicamentoRepository.findMayorCorrelativo({ prefijo, transaction });
    for (let numero = mayor + 1; numero <= 999; numero++) {
        const codigoMedicamento = `${prefijo}${String(numero).padStart(3, '0')}`;
        // También proteger equivalencias de históricos irregulares según MySQL
        // (p. ej. letras Unicode equivalentes); jamás normalizar esas filas.
        if (!await medicamentoRepository.findByCodigo({ codigoMedicamento, transaction })) {
            return codigoMedicamento;
        }
    }
    throw new AppError(`Se agotaron los códigos del prefijo ${prefijo}: el correlativo máximo es 999`, 409);
};

const MAXIMOS_INTENTOS_CODIGO = 5;

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
        validateCodigoNoEnviado(data);
        const { composicion, ...datosMedicamento } = data;
        if (!Array.isArray(composicion) || !composicion.length) {
            throw new AppError('La composición debe contener al menos un principio activo', 400);
        }
        if (new Set(composicion.map(c => c.idPrincipioActivo)).size !== composicion.length) {
            throw new AppError('No se permite repetir un principio activo en la composición', 400);
        }
        const prefijo = obtenerPrefijoMedicamento(data.nombreComercial);
        for (let intento = 0; intento < MAXIMOS_INTENTOS_CODIGO; intento++) {
            try {
                return await transaccionCatalogo(async (transaction) => {
                    const proveedores = await bloquearProveedoresIdentidad([data.idProveedorLaboratorio], transaction);
                    if (!proveedores.get(data.idProveedorLaboratorio).estado) {
                        throw new AppError('El proveedor o laboratorio está inactivo', 409);
                    }
                    for (const componente of [...composicion].sort((a, b) => a.idPrincipioActivo - b.idPrincipioActivo)) {
                        const principio = await composicionMedicamentoRepository.findPrincipioById({
                            idPrincipioActivo: componente.idPrincipioActivo, transaction
                        });
                        if (!principio) throw new AppError('Principio activo no encontrado', 404);
                    }
                    const values = toModelData(datosMedicamento);
                    await validarIdentidadDisponible(values, composicion, transaction);
                    const codigo = await generarCodigo(prefijo, transaction);
                    const medicamento = await medicamentoRepository.create({
                        data: { ...values, codigo_medicamento: codigo }, transaction
                    });
                    for (const componente of composicion) {
                        await composicionMedicamentoRepository.create({ transaction, data: {
                            id_medicamento: medicamento.id_medicamento,
                            id_principio_activo: componente.idPrincipioActivo,
                            cantidad_principio_activo: componente.cantidadPrincipioActivo,
                            unidad_principio_activo: componente.unidadPrincipioActivo,
                            cantidad_referencia: componente.cantidadReferencia,
                            unidad_referencia: componente.unidadReferencia
                        } });
                    }
                    return this.getMedicamentoById(medicamento.id_medicamento, transaction);
                });
            } catch (error) {
                // La transacción gestionada ya terminó su rollback. Cada vuelta
                // abre otra transacción y otro snapshot; nunca repetir solo el INSERT.
                if (esColisionCodigo(error)) continue;
                throw convertirErrorContencionCatalogo(error);
            }
        }
        throw new AppError('No se pudo asignar un código por registros simultáneos. Intente nuevamente', 409);
    }

    static async updateMedicamento(idMedicamento, data) {
        validateCodigoNoEnviado(data);
        return transaccionCatalogo(async (transaction) => {
            const medicamento = await this.getMedicamentoForUpdate(idMedicamento, transaction);
            const actual = medicamento.get({ plain: true });
            const values = toModelData(data);
            const proveedores = await bloquearProveedoresIdentidad([
                actual.id_proveedor_laboratorio, values.id_proveedor_laboratorio ?? actual.id_proveedor_laboratorio
            ], transaction);
            const cambiaIdentidad = camposIdentidad.some((campo) =>
                values[campo] !== undefined && values[campo] !== medicamento.get(campo)
            );
            if (cambiaIdentidad) await this.validateSinHistorial(idMedicamento, transaction);
            if (data.idProveedorLaboratorio !== undefined) {
                if (!proveedores.get(data.idProveedorLaboratorio).estado) {
                    throw new AppError('El proveedor o laboratorio está inactivo', 409);
                }
            }
            if (['nombre_comercial', ...camposIdentidad].some(campo => values[campo] !== undefined && values[campo] !== actual[campo])) {
                const composicion = await composicionMedicamentoRepository.findAllForMedicamento({ idMedicamento, transaction });
                await validarIdentidadDisponible({ ...actual, ...values }, composicion, transaction, idMedicamento);
            }
            await medicamentoRepository.update({ idMedicamento, data: values, transaction });
            return this.getMedicamentoById(idMedicamento, transaction);
        });
    }

    static async updateEstado(idMedicamento, { estado }) {
        return db.sequelize.transaction(async (transaction) => {
            await this.getMedicamentoForUpdate(idMedicamento, transaction);
            await medicamentoRepository.updateEstado({ idMedicamento, estado, transaction });
            return this.getMedicamentoById(idMedicamento, transaction);
        });
    }
}
