import db from '../models/index.js';

const { RecuperacionPassword, LimiteRecuperacionIp } = db;
const { Op, QueryTypes } = db.Sequelize;

export class recuperacionPasswordRepository {
    static async findByIdForUpdate({ idRecuperacion, idUsuario, transaction }) {
        return RecuperacionPassword.findOne({
            where: { id_recuperacion: idRecuperacion, id_usuario: idUsuario },
            transaction, lock: transaction.LOCK.UPDATE, logging: false
        });
    }
    static async getCurrentDate({ transaction } = {}) {
        const [row] = await db.sequelize.query('SELECT CURRENT_TIMESTAMP(3) AS ahora', { type: QueryTypes.SELECT, transaction, logging: false });
        return row.ahora;
    }
    static async incrementIpQuota({ ambito, claveIpHmac, ahora, ventanaHasta, transaction }) {
        await db.sequelize.query(`INSERT INTO limite_recuperacion_ip (ambito, clave_ip_hmac, ventana_hasta, cantidad)
            VALUES (:ambito, :claveIpHmac, :ventanaHasta, 1)
            ON DUPLICATE KEY UPDATE
                cantidad = IF(ventana_hasta <= :ahora, 1, LEAST(cantidad + 1, 4294967295)),
                ventana_hasta = IF(ventana_hasta <= :ahora, :ventanaHasta, ventana_hasta)`, {
            replacements: { ambito, claveIpHmac, ahora, ventanaHasta }, transaction, logging: false
        });
        return LimiteRecuperacionIp.findOne({ where: { ambito, clave_ip_hmac: claveIpHmac }, transaction, lock: transaction.LOCK.UPDATE, logging: false });
    }
    static async findHistoryByUsuario({ idUsuario, desde, transaction }) {
        return RecuperacionPassword.findAll({
            where: { id_usuario: idUsuario, fecha_solicitud: { [Op.gt]: desde } },
            order: [['fecha_solicitud', 'DESC'], ['id_recuperacion', 'DESC']],
            transaction, lock: transaction.LOCK.UPDATE, logging: false
        });
    }
    static async findLatestByUsuario({ idUsuario, transaction }) {
        return RecuperacionPassword.findOne({ where: { id_usuario: idUsuario },
            order: [['fecha_solicitud', 'DESC'], ['id_recuperacion', 'DESC']],
            transaction, lock: transaction.LOCK.UPDATE, logging: false });
    }
    static async create({ values, transaction }) {
        return RecuperacionPassword.create(values, { transaction, logging: false });
    }
    static async updateById({ idRecuperacion, values, transaction }) {
        return RecuperacionPassword.update(values, { where: { id_recuperacion: idRecuperacion }, transaction, logging: false });
    }
    static async invalidatePendingByUsuario({ idUsuario, invalidadaEn, transaction }) {
        return RecuperacionPassword.update({ invalidada_en: invalidadaEn }, {
            where: { id_usuario: idUsuario, consumida_en: null, invalidada_en: null }, transaction, logging: false
        });
    }
}
