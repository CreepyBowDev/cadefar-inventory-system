import { createHash } from 'node:crypto';

// Solo lectura; devuelve huellas, nunca filas, hashes de contraseñas ni importes.
export async function huellaBase(connection, database) {
    if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Nombre de base inválido');
    await connection.query('START TRANSACTION READ ONLY');
    try {
        const [tables] = await connection.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE=? ORDER BY TABLE_NAME', [database, 'BASE TABLE']);
        const hash = createHash('sha256');
        for (const { TABLE_NAME: table } of tables) {
            if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error('Tabla inválida');
            const name = `\`${database}\`.\`${table}\``;
            const [definition] = await connection.query(`SHOW CREATE TABLE ${name}`);
            const [rows] = await connection.query(`SELECT * FROM ${name}`);
            hash.update(JSON.stringify([table, definition[0]['Create Table'], rows.map(row => JSON.stringify(row)).sort()]));
        }
        return hash.digest('hex');
    } finally { await connection.rollback(); }
}
