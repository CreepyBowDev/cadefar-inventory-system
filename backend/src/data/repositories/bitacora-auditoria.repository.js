import db from '../models/index.js';
import { fechaAuditoriaSql, fechaAuditoriaIso } from '../../shared/utils/auditoria-contexto.js';

const { BitacoraAuditoria, Sequelize } = db;
const { Op, fn, col, where } = Sequelize;

const atributosResumen = ['id_evento', 'tipo_evento', 'modulo', 'accion', 'resultado', 'causa',
    'id_usuario_responsable', 'nombre_usuario_responsable', 'id_rol_responsable',
    'id_usuario_objetivo', 'nombre_usuario_objetivo', 'id_rol_objetivo', 'nombre_ingresado',
    'direccion_ip', 'procedencia_ip', 'tipo_registro', 'id_registro', 'correlacion',
    'id_evento_relacionado', 'version_formato',
    ...['fecha_registro', 'fecha_evento'].map(campo =>
        [fn('DATE_FORMAT', col(campo), '%Y-%m-%d %H:%i:%s.%f'), campo])];

const fechasIso = data => data && ({ ...data,
    fecha_registro: fechaAuditoriaIso(data.fecha_registro),
    fecha_evento: fechaAuditoriaIso(data.fecha_evento)
});

const construirWhere = filtros => {
    const condiciones = {};
    const campos = { idUsuarioResponsable: 'id_usuario_responsable', idUsuarioObjetivo: 'id_usuario_objetivo',
        nombreIngresado: 'nombre_ingresado', direccionIp: 'direccion_ip', modulo: 'modulo', accion: 'accion',
        tipoEvento: 'tipo_evento', resultado: 'resultado', tipoRegistro: 'tipo_registro', idRegistro: 'id_registro' };
    for (const [entrada, columna] of Object.entries(campos)) {
        if (filtros[entrada] !== undefined) condiciones[columna] = filtros[entrada];
    }
    const fechas = [];
    // Comparar texto UTC no crea un Date que Sequelize pueda desplazar según
    // su timezone global. Los extremos del intervalo son inclusivos.
    if (filtros.desde) fechas.push(where(col('fecha_registro'), Op.gte, fechaAuditoriaSql(new Date(filtros.desde))));
    if (filtros.hasta) fechas.push(where(col('fecha_registro'), Op.lte, fechaAuditoriaSql(new Date(filtros.hasta))));
    if (fechas.length) condiciones[Op.and] = fechas;
    return condiciones;
};

export class bitacoraAuditoriaRepository {
    static async create({ data, transaction }) {
        if (!transaction || transaction.finished) throw new TypeError('Auditoría requiere una transacción activa');
        const evento = await BitacoraAuditoria.create({ ...data,
            fecha_registro: fn('STR_TO_DATE', data.fecha_registro, '%Y-%m-%d %H:%i:%s.%f'),
            fecha_evento: fn('STR_TO_DATE', data.fecha_evento, '%Y-%m-%d %H:%i:%s.%f')
        }, { transaction });
        // Un ID obtenido dentro de una transacción no acredita todavía commit.
        return evento.id_evento;
    }

    // Recibe filtros ya validados por negocio. No ofrece DML de modificación.
    static async findAll(filtros, { transaction } = {}) {
        const condiciones = construirWhere(filtros);
        const rows = await BitacoraAuditoria.findAll({ attributes: atributosResumen, where: condiciones,
            order: [['fecha_registro', 'DESC'], ['id_evento', 'DESC']],
            limit: filtros.limite, offset: (filtros.pagina - 1) * filtros.limite,
            raw: true, transaction });
        const total = await BitacoraAuditoria.count({ where: condiciones, transaction });
        return { rows: rows.map(fechasIso), total };
    }

    static async findById({ idEvento, transaction }) {
        const data = await BitacoraAuditoria.findByPk(idEvento, {
            attributes: [...atributosResumen, 'antes', 'despues', 'metadatos', 'referencias'], raw: true, transaction
        });
        return fechasIso(data);
    }
}
