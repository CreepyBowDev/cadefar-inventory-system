import dotenv from 'dotenv';
import entorno from './shared/utils/pagos-entorno.cjs';

dotenv.config({ quiet: true });
if (!entorno.esPruebaLocal()) throw new Error('El modo local requiere configuración explícita');
// Login normal con credenciales originales en solo lectura y seguridad local.
// La cookie usa una firma separada; no se copian contraseñas/hashes.
const { default: db } = await import('./data/models/index.js');
const [rows] = await db.sequelize.query('SELECT DATABASE() AS nombre', { logging: false });
if (rows[0]?.nombre !== entorno.BASE_PRUEBAS) throw new Error('Base de pruebas incorrecta');
const { default: migracionAuth } = await import('./data/database/migrations-pagos-pruebas/20261122090000-create-seguridad-login-local.cjs');
await migracionAuth.up(db.sequelize.getQueryInterface());
const { iniciarServidor } = await import('./server.js');
await iniciarServidor();
console.log('Entorno de pruebas local: BOB, procesador PRUEBA_LOCAL, sin pasarelas financieras.');
