import db from '../models/index.js';

const { PagoCompra, Usuario, Sequelize } = db;
const { fn, col, Op } = Sequelize;
const fechaSql = valor => fn('STR_TO_DATE', valor, '%Y-%m-%d %H:%i:%s');
const fechas = ['fecha_registro', 'fecha_verificacion', 'fecha_confirmacion'];
const atributos = () => [...Object.keys(PagoCompra.rawAttributes).filter(campo => !fechas.includes(campo)),
    ...fechas.map(campo => [fn('DATE_FORMAT', col(`PagoCompra.${campo}`), '%Y-%m-%d %H:%i:%s'), campo])];

export class pagoCompraRepository {
    static async findAll({ idCompra, transaction, lock = false }) {
        return PagoCompra.findAll({ attributes: atributos(), where: { id_compra: idCompra }, transaction,
            ...(lock ? { lock: transaction.LOCK.UPDATE } : {}), order: [['id_pago', 'ASC']] });
    }
    static async findHistorial({ idCompra, transaction }) {
        return PagoCompra.findAll({ where: { id_compra: idCompra }, transaction,
            attributes: atributos(),
            include: [{ model: Usuario, as: 'administrador', attributes: ['id_usuario', 'nombre_usuario'] }],
            order: [['id_pago', 'DESC']] });
    }
    static async findByClave({ claveOperacion, transaction }) {
        return PagoCompra.findOne({ attributes: atributos(), where: { clave_operacion: claveOperacion }, transaction,
            lock: transaction.LOCK.UPDATE });
    }
    static async findById({ idPago, idCompra, transaction }) {
        return PagoCompra.findOne({ attributes: atributos(), where: { id_pago: idPago, id_compra: idCompra }, transaction,
            lock: transaction.LOCK.UPDATE });
    }
    static async findComprometido({ idCompra, transaction }) {
        return PagoCompra.findOne({ attributes: ['id_pago'], where: { id_compra: idCompra,
            estado: { [Op.in]: ['PENDIENTE', 'PROCESANDO', 'CONFIRMADO'] } }, transaction,
            lock: transaction.LOCK.UPDATE });
    }
    static async create({ data, transaction }) {
        return PagoCompra.create({ ...data, fecha_registro: fechaSql(data.fecha_registro) }, { transaction });
    }
    static async update({ idPago, data, transaction }) {
        const valores = { ...data };
        for (const campo of ['fecha_verificacion', 'fecha_confirmacion']) {
            if (valores[campo]) valores[campo] = fechaSql(valores[campo]);
        }
        return PagoCompra.update(valores, { where: { id_pago: idPago }, transaction });
    }
}
