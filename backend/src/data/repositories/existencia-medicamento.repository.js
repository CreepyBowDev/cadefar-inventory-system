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
        return Medicamento.findByPk(idMedicamento, {
            attributes: medicamentoAttributes,
            include: [existenciasInclude],
            order: [['existencias', 'id_existencia', 'ASC']]
        });
    }
}
