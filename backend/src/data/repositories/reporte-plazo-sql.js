import db from '../models/index.js';

const plazos = new WeakMap();
const opciones = transaction => ({ transaction, type: db.Sequelize.QueryTypes.SELECT, retry: { max: 0 }, logging: false });
const numero = n => /^(0|[1-9]\d*)$/.test(String(n)) && Number.isSafeInteger(Number(n)) ? Number(n) : null;

// Solo exportaciones Railway, en SU conexión y snapshot. El resto de consultas
// no cambia. Cada SELECT recibe el presupuesto restante, no otros 60 segundos.
export async function antesSelectReporte(transaction) {
    const restante = plazos.get(transaction);
    if (!restante) return;
    const ms = Math.floor(restante());
    if (!Number.isSafeInteger(ms) || ms < 1 || ms > 60000) throw new Error('Plazo SQL agotado');
    await db.sequelize.query(`SET SESSION max_execution_time = ${ms}, lock_wait_timeout = ${Math.max(1, Math.ceil(ms / 1000))}`,
        { ...opciones(transaction), type: db.Sequelize.QueryTypes.RAW });
    restante();
}

export async function conPlazoSqlReporte(transaction, restante, leer) {
    const [anterior] = await db.sequelize.query('SELECT /*+ MAX_EXECUTION_TIME(1000) */ VERSION() AS motor, @@SESSION.max_execution_time AS ejecucion, @@SESSION.lock_wait_timeout AS espera', opciones(transaction));
    const ejecucion = numero(anterior?.ejecucion), espera = numero(anterior?.espera);
    if (!/^8\./.test(anterior?.motor || '') || /mariadb/i.test(anterior.motor) || ejecucion === null || espera === null) throw new Error('Control SQL no acreditado');
    plazos.set(transaction, restante);
    try { return await leer(); }
    finally {
        plazos.delete(transaction);
        try {
            await db.sequelize.query(`SET SESSION max_execution_time = ${ejecucion}, lock_wait_timeout = ${espera}`,
                { ...opciones(transaction), type: db.Sequelize.QueryTypes.RAW });
        } catch {
            // Ya terminó/rechazó el SELECT. Nunca devolver al pool una sesión
            // con configuración desconocida ni hacer Promise.race con SQL vivo.
            transaction.finished = 'rollback';
            const error = new Error('No se pudo restaurar la sesión de exportación');
            error.sesionExportacionInsegura = true;
            try { await transaction.forceCleanup(); }
            finally { throw error; }
        }
    }
}
