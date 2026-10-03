import db from '../models/index.js';

const { Medicamento, ProveedorLaboratorio, ComposicionMedicamento,
    PrincipioActivo, ExistenciaMedicamento, MovimientoInventario, Sequelize } = db;
const { Op, fn, col, where } = Sequelize;

const relaciones = [
    {
        model: ProveedorLaboratorio,
        as: 'proveedorLaboratorio',
        attributes: ['id_proveedor_laboratorio', 'nombre']
    },
    {
        model: ComposicionMedicamento,
        as: 'composiciones',
        include: [{ model: PrincipioActivo, as: 'principioActivo',
            attributes: ['id_principio_activo', 'nombre'] }]
    }
];

// Tratar %, _ y la barra como texto de búsqueda, no como comodines del cliente.
const contiene = (texto) => `%${texto.replace(/[\\%_]/g, '\\$&')}%`;

export class medicamentoRepository {
    static async findAll({ codigoMedicamento, nombreComercial, idPrincipioActivo } = {}) {
        const filtros = {};
        if (codigoMedicamento !== undefined) filtros.codigo_medicamento = { [Op.like]: contiene(codigoMedicamento) };
        if (nombreComercial !== undefined) filtros.nombre_comercial = { [Op.like]: contiene(nombreComercial) };

        if (idPrincipioActivo?.length) {
            const coincidencias = await ComposicionMedicamento.findAll({
                attributes: ['id_medicamento'],
                where: { id_principio_activo: { [Op.in]: idPrincipioActivo } },
                group: ['id_medicamento'],
                having: where(fn('COUNT', fn('DISTINCT', col('id_principio_activo'))),
                    Op.eq, idPrincipioActivo.length),
                raw: true
            });
            if (!coincidencias.length) return [];
            filtros.id_medicamento = { [Op.in]: coincidencias.map((fila) => fila.id_medicamento) };
        }

        // Cargar toda la composición, incluyendo ingredientes adicionales al filtro.
        return Medicamento.findAll({
            where: filtros,
            include: relaciones,
            order: [['id_medicamento', 'ASC'], ['composiciones', 'id_composicion', 'ASC']]
        });
    }

    static async findById({ idMedicamento, transaction, lock = false }) {
        return Medicamento.findByPk(idMedicamento, {
            transaction,
            ...(lock ? { lock: transaction.LOCK.UPDATE } : { include: relaciones,
                order: [['composiciones', 'id_composicion', 'ASC']] })
        });
    }

    static async findByCodigo({ codigoMedicamento, transaction }) {
        return Medicamento.findOne({ where: { codigo_medicamento: codigoMedicamento }, transaction });
    }

    static async findProveedorById({ idProveedorLaboratorio, transaction }) {
        return ProveedorLaboratorio.findByPk(idProveedorLaboratorio, {
            attributes: ['id_proveedor_laboratorio', 'estado'],
            transaction,
            ...(transaction ? { lock: transaction.LOCK.SHARE } : {})
        });
    }

    static async hasMovimientos({ idMedicamento, transaction }) {
        // El Service bloquea primero Medicamento. Las FK impiden incorporar
        // nuevas existencias mientras se realiza esta comprobación.
        const existencias = await ExistenciaMedicamento.findAll({
            attributes: ['id_existencia'],
            where: { id_medicamento: idMedicamento },
            transaction,
            order: [['id_existencia', 'ASC']],
            lock: transaction.LOCK.UPDATE
        });
        if (!existencias.length) return false;

        // Bloquear las existencias también impide insertar su primer movimiento
        // concurrentemente, por la comprobación de FK de InnoDB.
        const movimiento = await MovimientoInventario.findOne({
            attributes: ['id_movimiento'],
            where: { id_existencia: { [Op.in]: existencias.map((fila) => fila.id_existencia) } },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        return Boolean(movimiento);
    }

    static async create({ data, transaction }) {
        return Medicamento.create(data, { transaction });
    }

    static async update({ idMedicamento, data, transaction }) {
        return Medicamento.update(data, { where: { id_medicamento: idMedicamento }, transaction });
    }

    static async updateEstado({ idMedicamento, estado, transaction }) {
        return this.update({ idMedicamento, data: { estado }, transaction });
    }
}
