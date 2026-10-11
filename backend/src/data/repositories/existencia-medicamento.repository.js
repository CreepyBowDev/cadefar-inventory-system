import db from '../models/index.js';

const { Medicamento, ExistenciaMedicamento, Sequelize } = db;
const { Op } = Sequelize;
const medicamentoAttributes = [
    'id_medicamento', 'codigo_medicamento', 'nombre_comercial', 'forma_farmaceutica',
    'presentacion', 'unidad_inventario', 'stock_minimo', 'estado'
];
const existenciasInclude = {
    model: ExistenciaMedicamento, as: 'existencias', required: false,
    attributes: ['id_existencia', 'id_medicamento', 'codigo_existencia', 'fecha_vencimiento',
        'precision_vencimiento', 'cantidad_fisica', 'costo_unitario_promedio']
};
const contiene = (texto) => `%${texto.replace(/[\\%_]/g, '\\$&')}%`;

export class existenciaMedicamentoRepository {
    static async findByIdParaMovimiento({ idExistencia, transaction }) {
        return ExistenciaMedicamento.findByPk(idExistencia, { transaction, lock: transaction.LOCK.UPDATE });
    }

    static async findByIdParaAnular({ idExistencia, transaction }) {
        return ExistenciaMedicamento.findByPk(idExistencia, { transaction, lock: transaction.LOCK.UPDATE });
    }

    static async findParaCompra({ idMedicamento, transaction }) {
        // El medicamento ya está bloqueado por el Service. Incluir agotadas y
        // todos los códigos conservados para reutilizar y obtener el correlativo.
        return ExistenciaMedicamento.findAll({
            where: { id_medicamento: idMedicamento },
            transaction, lock: transaction.LOCK.UPDATE,
            order: [['id_existencia', 'ASC']]
        });
    }

    static async create({ data, transaction }) {
        return ExistenciaMedicamento.create(data, { transaction });
    }

    static async updateSaldoYCosto({ idExistencia, cantidadFisica, costoUnitarioPromedio, transaction }) {
        return ExistenciaMedicamento.update({ cantidad_fisica: cantidadFisica,
            costo_unitario_promedio: costoUnitarioPromedio
        }, { where: { id_existencia: idExistencia }, transaction });
    }

    static async findInventario({ idMedicamento, codigoMedicamento, nombreComercial } = {}) {
        const filtros = {};
        if (idMedicamento !== undefined) filtros.id_medicamento = idMedicamento;
        if (codigoMedicamento !== undefined) filtros.codigo_medicamento = { [Op.like]: contiene(codigoMedicamento) };
        if (nombreComercial !== undefined) filtros.nombre_comercial = { [Op.like]: contiene(nombreComercial) };

        // Un único SELECT conserva medicamentos sin existencias, inactivos y
        // existencias agotadas; los totales se calculan sobre la misma lectura.
        return Medicamento.findAll({
            attributes: medicamentoAttributes,
            where: filtros,
            include: [existenciasInclude],
            order: [['id_medicamento', 'ASC'], ['existencias', 'id_existencia', 'ASC']]
        });
    }

    static async findMedicamentoConExistencias(idMedicamento) {
        // Saldo y marcador en el mismo SELECT; MAX es solo la proyección de
        // consulta, no la lectura actual bloqueante de las futuras escrituras.
        return Medicamento.findByPk(idMedicamento, {
            attributes: medicamentoAttributes,
            include: [{ ...existenciasInclude, attributes: [...existenciasInclude.attributes,
                [Sequelize.literal('(SELECT MAX(`ultimo_movimiento`.`id_movimiento`) ' +
                    'FROM `movimiento_inventario` AS `ultimo_movimiento` ' +
                    'WHERE `ultimo_movimiento`.`id_existencia` = `existencias`.`id_existencia`)'),
                'ultimo_movimiento']
            ] }],
            order: [['existencias', 'id_existencia', 'ASC']]
        });
    }
}
