import db from '../models/index.js';
import { enteroADecimal } from '../../shared/utils/decimal.js';

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

    static async findMayorCorrelativo({ prefijo, transaction }) {
        // Comparar el prefijo con la colación real de la columna, sin filtrar estado
        // ni nombre actual. Solo interpretar códigos de tres caracteres + tres dígitos.
        const [fila] = await db.sequelize.query(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_medicamento, 4) AS UNSIGNED)), 0) AS mayor
            FROM medicamento
            WHERE CHAR_LENGTH(codigo_medicamento) = 6
              AND LEFT(codigo_medicamento, 3) = :prefijo
              AND REGEXP_LIKE(SUBSTRING(codigo_medicamento, 4), '^[0-9]{3}$', 'c')
        `, { replacements: { prefijo }, type: Sequelize.QueryTypes.SELECT, transaction });
        return Number(fila.mayor);
    }

    static async findProveedorById({ idProveedorLaboratorio, transaction, exclusivo = false }) {
        return ProveedorLaboratorio.findByPk(idProveedorLaboratorio, {
            attributes: ['id_proveedor_laboratorio', 'estado'],
            transaction,
            ...(transaction ? { lock: exclusivo ? transaction.LOCK.UPDATE : transaction.LOCK.SHARE } : {})
        });
    }

    static async findDuplicadosIdentidad({ medicamento, composicion, transaction, idMedicamento }) {
        // Lecturas sin FOR UPDATE: el mutex es ProveedorLaboratorio. READ COMMITTED
        // evita snapshots viejos después de esperar ese mutex y no bloquea candidatos
        // que otra operación puede tener bloqueados antes de solicitar el proveedor.
        if (transaction?.options?.isolationLevel !== Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED) {
            throw new Error('La comprobación de identidad requiere una transacción READ COMMITTED');
        }
        const normalizar = valor => `TRIM(REGEXP_REPLACE(${valor}, '[[:space:]]+', ' '))`;
        const replacements = { proveedor: medicamento.id_proveedor_laboratorio,
            total: composicion.length, excluido: idMedicamento ?? 0 };
        const filtros = ['m.id_proveedor_laboratorio = :proveedor', 'm.id_medicamento <> :excluido'];
        for (const campo of ['nombre_comercial', 'forma_farmaceutica', 'presentacion',
            'unidad_inventario', 'via_administracion', 'tipo_liberacion']) {
            replacements[campo] = medicamento[campo];
            filtros.push(`${normalizar(`m.${campo}`)} = ${normalizar(`:${campo}`)}`);
        }
        filtros.push('(SELECT COUNT(*) FROM composicion_medicamento c WHERE c.id_medicamento = m.id_medicamento) = :total');
        composicion.forEach((c, i) => {
            Object.assign(replacements, { [`principio${i}`]: c.idPrincipioActivo,
                [`cantidad${i}`]: enteroADecimal(c.cantidadPrincipioActivo, 4),
                [`unidad${i}`]: c.unidadPrincipioActivo,
                [`referencia${i}`]: enteroADecimal(c.cantidadReferencia, 4),
                [`unidadReferencia${i}`]: c.unidadReferencia });
            filtros.push(`EXISTS (SELECT 1 FROM composicion_medicamento c
                WHERE c.id_medicamento = m.id_medicamento AND c.id_principio_activo = :principio${i}
                  AND c.cantidad_principio_activo = CAST(:cantidad${i} AS DECIMAL(12,4))
                  AND c.cantidad_referencia = CAST(:referencia${i} AS DECIMAL(12,4))
                  AND ${normalizar('c.unidad_principio_activo')} = ${normalizar(`:unidad${i}`)}
                  AND ${normalizar('c.unidad_referencia')} = ${normalizar(`:unidadReferencia${i}`)})`);
        });
        return db.sequelize.query(`SELECT m.id_medicamento, m.codigo_medicamento, m.nombre_comercial, m.estado
            FROM medicamento m WHERE ${filtros.join(' AND ')} ORDER BY m.id_medicamento`, {
            replacements, transaction, type: Sequelize.QueryTypes.SELECT
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
