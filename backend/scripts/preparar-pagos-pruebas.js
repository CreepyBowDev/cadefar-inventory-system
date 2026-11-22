import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import entorno from '../src/shared/utils/pagos-entorno.cjs';

dotenv.config({ quiet: true });
if (!entorno.esPruebaLocal() || !process.argv.includes('--autorizar-crear') ||
    execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() !== 'feature/pagos-proveedores') {
    throw new Error('Falta autorización local o la rama no corresponde');
}
let admin, db;
try {
    admin = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER,
        password: process.env.PASSWORD_DB, connectTimeout: 10000 });
    const [originales] = await admin.query("SELECT id_usuario,id_rol,nombre_usuario,estado,version_credenciales FROM cadefarexamen.usuario WHERE nombre_usuario='admin_demo'");
    const usuario = originales[0];
    if (originales.length !== 1 || usuario.id_rol !== 1 || !usuario.estado) throw new Error('Administrador original no disponible');
    const [bases] = await admin.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [entorno.BASE_PRUEBAS]);
    if (bases.length) {
        if (!process.argv.includes('--autorizar-recrear')) throw new Error('Recrear la base exige autorización separada');
        const [[reales]] = await admin.query("SELECT COUNT(*) AS cantidad FROM cadefar_pagos_pruebas.pago_compra WHERE cuenta_destino NOT LIKE 'PRUEBA_LOCAL_LAB_%'");
        if (Number(reales.cantidad) !== 0) throw new Error('La base contiene pagos ajenos al procesador local');
        // Nombre fijo, operación extraordinaria autorizada. Nunca DROP de la
        // fuente de identidad ni de una base derivada de una entrada del cliente.
        await admin.query('DROP DATABASE `cadefar_pagos_pruebas`');
    }
    await admin.query(`CREATE DATABASE \`${entorno.BASE_PRUEBAS}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    const cli = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
    execFileSync(process.execPath, [cli, 'db:migrate', '--env', 'development'], {
        env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' }, stdio: 'pipe', timeout: 90000
    });
    // Conservar integridad referencial sin crear ni copiar usuarios. Cambiar
    // exclusivamente las FK de la base ficticia; los padres son solo leídos.
    const [keys] = await admin.query("SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='cadefar_pagos_pruebas' AND REFERENCED_TABLE_NAME='usuario'");
    for (const key of keys) {
        for (const name of Object.values(key)) if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Referencia inválida');
        const nombre = `prueba_${key.TABLE_NAME}_${key.COLUMN_NAME}`;
        await admin.query(`ALTER TABLE \`cadefar_pagos_pruebas\`.\`${key.TABLE_NAME}\` DROP FOREIGN KEY \`${key.CONSTRAINT_NAME}\`, ADD CONSTRAINT \`${nombre}\` FOREIGN KEY (\`${key.COLUMN_NAME}\`) REFERENCES \`cadefarexamen\`.\`usuario\` (\`${key.REFERENCED_COLUMN_NAME}\`) ON DELETE RESTRICT ON UPDATE RESTRICT`);
    }
    // TEMPTABLE hace que la vista sea NO actualizable incluso ante un UPDATE
    // accidental del ORM. Solo cinco campos públicos: no password_hash/correo.
    await admin.query(`CREATE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW \`cadefar_pagos_pruebas\`.\`usuario_sesion_local\` AS
        SELECT u.id_usuario,u.id_rol,u.nombre_usuario,u.estado,u.version_credenciales
        FROM \`cadefarexamen\`.\`usuario\` u JOIN \`cadefarexamen\`.\`rol\` r ON r.id_rol=u.id_rol WHERE r.estado=1`);
    db = (await import('../src/data/models/index.js')).default;
    if (db.sequelize.config.database !== entorno.BASE_PRUEBAS) throw new Error('Destino incorrecto');
    await db.sequelize.transaction(async transaction => {
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Laboratorio ficticio CADEFAR · PRUEBA_LOCAL' }, { transaction });
        const principio = await db.PrincipioActivo.create({ nombre: 'Ingrediente ficticio · PRUEBA_LOCAL' }, { transaction });
        const medicamento = await db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: 'PRU001', nombre_comercial: 'Producto ficticio de pruebas', forma_farmaceutica: 'TABLETA',
            presentacion: 'Unidad ficticia', unidad_inventario: 'TABLETA', condicion_venta: 'LIBRE',
            via_administracion: 'ORAL', tipo_liberacion: 'INMEDIATA', stock_minimo: 0 }, { transaction });
        await db.ComposicionMedicamento.create({ id_medicamento: medicamento.id_medicamento,
            id_principio_activo: principio.id_principio_activo, cantidad_principio_activo: '1.0000',
            unidad_principio_activo: 'mg', cantidad_referencia: '1.0000', unidad_referencia: 'tableta' }, { transaction });
    });
    const { compraService } = await import('../src/business/services/compra.service.js');
    const { obtenerFechaOperacion } = await import('../src/shared/utils/fecha-operacion.js');
    const { crearContextoAuditoriaConexion } = await import('../src/shared/utils/auditoria-contexto.js');
    const medicamento = await db.Medicamento.findOne({ where: { codigo_medicamento: 'PRU001' } });
    for (let i = 1; i <= 6; i++) {
        await compraService.createCompra({ claveOperacion: `prueba-local-compra-${String(i).padStart(3, '0')}`,
            fechaCompra: obtenerFechaOperacion().fechaComercial,
            detalles: [{ idMedicamento: medicamento.id_medicamento, cantidad: 10, costoUnitario: '50.000000',
                precisionVencimiento: 'DIA', fechaVencimiento: '2099-12-31' }] }, usuario.id_usuario, {
            contexto: crearContextoAuditoriaConexion(), responsable: { idUsuario: usuario.id_usuario, idRol: 1, nombreUsuario: usuario.nombre_usuario }
        });
    }
    console.log('Base cadefar_pagos_pruebas preparada. Seis compras ficticias de BOB 500.00; sin pagos ni cuentas financieras.');
    console.log('Sin cuentas ni contraseñas adicionales. Inicia el servidor local e ingresa con tus credenciales existentes.');
} catch (error) {
    console.error({ message: 'Preparación interrumpida; no se borrará ni reintentará ninguna base automáticamente.',
        code: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'PREPARACION_NO_CONFIRMADA' });
    process.exitCode = 1;
} finally {
    if (db) await db.sequelize.close();
    if (admin) await admin.end();
}
