import test from 'node:test';
import assert from 'node:assert/strict';
import crypto, { randomBytes } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const testDatabase = process.env.DB_NAME_TEST;
const protectedDatabases = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.equal(Boolean(testDatabase), true, 'Configurar DB_NAME_TEST');
assert.equal(protectedDatabases.some(name => name.toLowerCase() === testDatabase.toLowerCase()), false, 'Usar una base aislada');
assert.equal(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), true, 'Usar MySQL local');
const temporaryDatabase = `${testDatabase.slice(0, 35)}_cu09_${randomBytes(6).toString('hex')}`;
assert.equal([testDatabase, ...protectedDatabases].some(name => name.toLowerCase() === temporaryDatabase.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporaryDatabase;
Object.assign(process.env, {
    RECOVERY_ENABLED: 'true', MAIL_PROVIDER: 'mock', MAIL_FROM: 'farmacia@example.test', MAIL_FROM_NAME: 'CADEFAR',
    RECOVERY_CLIENT_IP_SOURCE: 'socket', RECOVERY_HMAC_SECRET: randomBytes(32).toString('hex')
});
const executeFile = promisify(execFile);
const cliPath = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
const runCli = async (...args) => {
    try {
        await executeFile(process.execPath, [cliPath, ...args, '--env', 'test'], {
            cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env }, timeout: 60000
        });
    } catch { throw new Error(`Sequelize CLI: ${args[0]} falló en la base temporal`); }
};

test('CU09: emisión/consumo atómicos, cuotas persistentes y concurrencia MySQL', { timeout: 180000 }, async t => {
    let databaseCreated = false, db, originalClock, originalWait;
    const originalHash = bcrypt.hash;
    const originalRandomInt = crypto.randomInt;
    try {
        await runCli('db:create');
        databaseCreated = true;
        await runCli('db:migrate');
        await runCli('db:seed', '--seed', '20260914181926-seed-rol.js');
        ({ default: db } = await import('../src/data/models/index.js'));
        db.sequelize.options.logging = false;
        const { recuperacionPasswordService: service } = await import('../src/business/services/recuperacion-password.service.js');
        const { recuperacionPasswordRepository: repository } = await import('../src/data/repositories/recuperacion-password.repository.js');
        const { usuarioRepository } = await import('../src/data/repositories/usuario.repository.js');
        const { usuarioService } = await import('../src/business/services/usuario.service.js');
        const { authService } = await import('../src/business/services/auth.service.js');
        const { calcularCodigoHmac } = await import('../src/shared/utils/recuperacion-crypto.js');
        const { AppError } = await import('../src/shared/errors/app-error.js');
        const { RECOVERY_SECURITY: SECURITY, RECOVERY_MAIL_RESULT: MAIL_RESULT } = await import('../src/shared/constants/recuperacion-password.js');
        let ahora = new Date(), fixture = 0;
        originalClock = repository.getCurrentDate;
        repository.getCurrentDate = async () => new Date(ahora);
        originalWait = service.esperarRespuesta;
        // La espera pública real se comprueba por HTTP; las carreras de negocio
        // usan esta sustitución para no demorar cada fixture cinco segundos.
        service.esperarRespuesta = async () => {};
        const ip = '192.0.2.1';
        const messages = new Map();
        const resetIpQuota = () => db.LimiteRecuperacionIp.destroy({ where: {}, logging: false });
        const advance = milliseconds => { ahora = new Date(ahora.getTime() + milliseconds); };
        const initialPassword = 'Inicial-123!', newPassword = 'Nueva-456!';
        const makeUsuario = async (extra = {}) => {
            const index = ++fixture;
            return db.Usuario.create({ id_rol: 3, nombre_usuario: `cu09_fixture_${index}`,
                password_hash: await originalHash(initialPassword, 4), correo: `persona.nombre+${index}@example.test`, ...extra });
        };
        const rowsFor = usuario => db.RecuperacionPassword.findAll({ where: { id_usuario: usuario.id_usuario }, order: [['id_recuperacion', 'ASC']] });
        const latest = async usuario => (await rowsFor(usuario)).at(-1);
        const context = (usuario, row) => ({ idUsuario: usuario.id_usuario, correo: usuario.correo, nonce: row.nonce, expiraEn: row.expira_en });
        // Referencia privada al mensaje mock; el código nunca se almacena en DB.
        const readCode = (usuario, row) => {
            return messages.get(row.id_recuperacion);
        };
        const issue = (usuario, resolver) => service.solicitarRecuperacion({ correo: usuario.correo }, ip, { resolverMock: async message => {
            const row = await latest(usuario);
            messages.set(row.id_recuperacion, /\b\d{6}\b/.exec(message.text)[0]);
            return resolver ? resolver(message, row) : { estado: MAIL_RESULT.ACCEPTED };
        } });
        const prepare = async (extra = {}) => {
            const usuario = await makeUsuario(extra);
            const response = await issue(usuario);
            const row = await latest(usuario);
            return { usuario, row, codigo: readCode(usuario, row), response };
        };
        const reset = (fixture, extra = {}) => service.restablecerPassword({ correo: fixture.usuario.correo, codigo: fixture.codigo, passwordNueva: newPassword, ...extra }, ip);
        const expectError = async (operation, statusCode = 400, message = 'El código de recuperación no es válido o ha vencido') => {
            let caught;
            try { await operation(); } catch (error) { caught = error; }
            assert.equal(caught instanceof AppError, true, 'Error esperado de aplicación');
            assert.equal(caught?.statusCode, statusCode);
            assert.equal(caught?.message, message);
            assert.equal(caught?.details, undefined);
        };
        const assertCleared = row => assert.equal(row.invalidada_en instanceof Date || row.consumida_en instanceof Date, true);
        t.beforeEach(resetIpQuota);
        const snapshot = async usuario => ({ usuario: (await db.Usuario.findByPk(usuario.id_usuario)).get({ plain: true }), rows: (await rowsFor(usuario)).map(row => row.get({ plain: true })) });
        const assertPreserved = async (usuario, before) => {
            assert.equal(JSON.stringify(await snapshot(usuario)) === JSON.stringify(before), true, 'Rollback/conservación integral sin imprimir datos privados');
        };
        const wrongCode = codigo => codigo === '000000' ? '000001' : '000000';
        const withBcryptPaused = async (fixture, operation, expectedStatus = 400) => {
            let reached, release;
            const waiting = new Promise(resolve => { reached = resolve; });
            const gate = new Promise(resolve => { release = resolve; });
            bcrypt.hash = async (...args) => { reached(); await gate; return originalHash(...args); };
            const pending = reset(fixture);
            // Marcar rechazo como manejado durante la operación concurrente.
            pending.catch(() => {});
            try {
                await waiting;
                await operation();
                release();
                if (expectedStatus === 200) await pending;
                else await expectError(() => pending, expectedStatus);
            } finally { release(); bcrypt.hash = originalHash; await pending.catch(() => {}); }
        };
        const runRace = async (usuario, operations, rounds = 1) => {
            const original = usuarioRepository.findByIdForRecovery;
            const size = operations.length, connections = Array.from({ length: rounds }, () => new Set());
            const releases = [], gates = Array.from({ length: rounds }, () => new Promise(resolve => releases.push(resolve)));
            let calls = 0;
            usuarioRepository.findByIdForRecovery = async options => {
                if (options.idUsuario === usuario.id_usuario) {
                    const round = Math.floor(calls++ / size);
                    const [connection] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { type: db.Sequelize.QueryTypes.SELECT, transaction: options.transaction, logging: false });
                    connections[round].add(connection.id);
                    if (connections[round].size === size) releases[round]();
                    await gates[round];
                }
                return original.call(usuarioRepository, options);
            };
            try {
                const results = await Promise.allSettled(operations.map(operation => operation()));
                for (const group of connections) assert.equal(group.size, size, 'Conexiones independientes sin transacción exterior compartida');
                return results;
            } finally { releases.forEach(release => release()); usuarioRepository.findByIdForRecovery = original; }
        };

        await t.test('Reloj de vencimiento proviene de MySQL con precisión de milisegundos', async () => {
            const date = await db.sequelize.transaction(transaction => originalClock.call(repository, { transaction }));
            assert.equal(date instanceof Date && Math.abs(date.getTime() - Date.now()) < 10000, true);
        });

        await t.test('Emisión normaliza correo y persiste solo nueve atributos con diez minutos absolutos', async () => {
            const usuario = await makeUsuario();
            const response = await service.solicitarRecuperacion({ correo: ` ${usuario.correo.toUpperCase()} ` }, ip, { resolverMock: async message => {
                messages.set((await latest(usuario)).id_recuperacion, /\b\d{6}\b/.exec(message.text)[0]);
                return { estado: MAIL_RESULT.ACCEPTED };
            } });
            assert.deepEqual(Object.keys(response), ['message']);
            const row = await latest(usuario);
            assert.equal(row.fecha_solicitud.getTime(), ahora.getTime());
            assert.equal(row.expira_en - row.fecha_solicitud, SECURITY.CODE_TTL_MS);
            assert.equal(row.intentos_fallidos, 0);
            assert.equal(row.consumida_en, null);
            assert.equal(row.invalidada_en, null);
            assert.equal(/^[a-f0-9]{64}$/.test(row.codigo_hmac), true);
            assert.equal(Object.keys(row.get({ plain: true })).length, 9);
            const codigo = readCode(usuario, row);
            assert.equal(calcularCodigoHmac({ ...context(usuario, row), codigo }) === row.codigo_hmac, true);
            for (const privateValue of [codigo, row.nonce, row.codigo_hmac]) assert.equal(JSON.stringify(response).includes(privateValue), false);
        });

        await t.test('Desconocidos, inactivos y solicitudes suprimidas tienen la misma respuesta y no crean emisiones', async () => {
            const f = await prepare();
            const before = await snapshot(f.usuario);
            const inactive = await makeUsuario({ estado: false });
            for (const response of [await issue(f.usuario), await issue(inactive), await service.solicitarRecuperacion({ correo: 'desconocido@example.test' }, ip)]) {
                assert.deepEqual(response, f.response);
            }
            assert.equal((await rowsFor(inactive)).length, 0);
            await assertPreserved(f.usuario, before);
        });

        await t.test('Sesenta segundos exactos permiten nueva emisión; la anterior se invalida y limpia', async () => {
            const f = await prepare();
            await f.row.update({ intentos_fallidos: 2 });
            advance(59999);
            await issue(f.usuario);
            assert.equal((await rowsFor(f.usuario)).length, 1);
            advance(1);
            await issue(f.usuario);
            const rows = await rowsFor(f.usuario);
            assert.equal(rows.length, 2);
            assert.equal(rows[0].invalidada_en.getTime(), ahora.getTime());
            assertCleared(rows[0]);
            assert.equal(rows[0].intentos_fallidos, 2);
            assert.equal(readCode(f.usuario, rows[1]) === f.codigo, false);
            assert.equal(rows[0].expira_en.getTime(), f.row.expira_en.getTime());
        });

        await t.test('No repite un código reciente invalidado: descarta colisión antes de emitir', async () => {
            const f = await prepare();
            advance(60000);
            const candidate = Number(f.codigo), different = (candidate + 1) % 1000000;
            let calls = 0;
            crypto.randomInt = () => (++calls === 1 ? candidate : different);
            syncBuiltinESMExports();
            try {
                await issue(f.usuario);
                assert.equal(calls, 2);
                assert.equal(readCode(f.usuario, await latest(f.usuario)) === String(different).padStart(6, '0'), true);
            } finally { crypto.randomInt = originalRandomInt; syncBuiltinESMExports(); }
        });

        await t.test('Colisiones reiteradas abortan emisión y conservan el código anterior sin gastar cuota', async () => {
            const f = await prepare(); advance(60000);
            const before = await snapshot(f.usuario);
            crypto.randomInt = () => Number(f.codigo);
            syncBuiltinESMExports();
            try { await expectError(() => issue(f.usuario), 500, 'No se pudo procesar la recuperación de contraseña'); }
            finally { crypto.randomInt = originalRandomInt; syncBuiltinESMExports(); }
            await assertPreserved(f.usuario, before);
        });

        await t.test('Tres emisiones por ventana móvil; estados terminales y fallo de envío no liberan cuota', async () => {
            const f = await prepare();
            await reset(f);
            advance(60000);
            await issue(f.usuario, () => ({ estado: MAIL_RESULT.REJECTED }));
            advance(60000);
            await issue(f.usuario);
            const before = await snapshot(f.usuario);
            advance(60000);
            await issue(f.usuario);
            assert.equal((await rowsFor(f.usuario)).length, 3);
            await assertPreserved(f.usuario, before);
            advance(720000); // Primera emisión exactamente fuera de la ventana de 15 min.
            await issue(f.usuario);
            assert.equal((await rowsFor(f.usuario)).length, 4);
        });

        await t.test('Cambio/retirada de correo no reinicia cuota de cuenta y el código anterior no puede consumir', async () => {
            const f = await prepare();
            await usuarioService.updateUsuario(f.usuario.id_usuario, { correo: 'nuevo.correo@example.test' });
            await f.usuario.reload();
            await issue(f.usuario);
            assert.equal((await rowsFor(f.usuario)).length, 1);
            await expectError(() => reset(f));
            advance(60000);
            await issue(f.usuario);
            assert.equal((await rowsFor(f.usuario)).length, 2);
            await usuarioService.updateUsuario(f.usuario.id_usuario, { correo: null });
            await expectError(() => service.restablecerPassword({ correo: 'nuevo.correo@example.test', codigo: f.codigo, passwordNueva: newPassword }, ip));
            assert.equal((await rowsFor(f.usuario)).length, 2);
        });

        await t.test('Consumo exitoso guarda bcrypt, incrementa versión, revoca sesión y limpia bloqueo sin modificar rol/estado', async () => {
            for (const id_rol of [1, 2, 3]) {
                const f = await prepare({ id_rol, intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000) });
                const result = await reset(f, { correo: ` ${f.usuario.correo.toUpperCase()} ` });
                assert.deepEqual(result, { message: 'Contraseña restablecida exitosamente' });
                await f.usuario.reload(); await f.row.reload();
                assert.equal(await bcrypt.compare(newPassword, f.usuario.password_hash), true);
                assert.equal(f.usuario.version_credenciales, 1);
                assert.equal(f.usuario.intentos_fallidos_login, 0);
                assert.equal(f.usuario.bloqueado_hasta, null);
                assert.equal(Boolean(f.usuario.estado), true);
                assert.equal(f.usuario.id_rol, id_rol);
                assert.equal(f.row.consumida_en.getTime(), ahora.getTime());
                assert.equal(f.row.invalidada_en, null);
                assertCleared(f.row);
                await expectError(() => authService.getSessionUsuario(f.usuario.id_usuario, 0), 401, 'Sesión no válida');
                const login = await authService.login({ nombreUsuario: f.usuario.nombre_usuario, password: newPassword });
                assert.equal(login.usuario.idUsuario, f.usuario.id_usuario);
                const before = await snapshot(f.usuario);
                await expectError(() => reset(f));
                await assertPreserved(f.usuario, before);
            }
        });

        await t.test('El mensaje mock no se guarda: el HMAC basta para consumir el código', async () => {
            const f = await prepare();
            assert.equal(Object.keys(f.row.get({ plain: true })).length, 9);
            await reset(f);
            await f.row.reload();
            assert.equal(f.row.consumida_en instanceof Date, true);
        });

        await t.test('Cinco fallos quedan confirmados; el quinto invalida y limpia sin bloquear login', async () => {
            const f = await prepare();
            const beforeUsuario = (await snapshot(f.usuario)).usuario;
            let hashes = 0;
            bcrypt.hash = async (...args) => { hashes++; return originalHash(...args); };
            try {
                for (let attempt = 1; attempt <= 5; attempt++) {
                    await expectError(() => reset(f, { codigo: wrongCode(f.codigo) }));
                    await f.row.reload();
                    assert.equal(f.row.intentos_fallidos, attempt);
                    if (attempt < 5) assert.equal(f.row.invalidada_en, null);
                }
                assert.equal(f.row.invalidada_en instanceof Date, true);
                assertCleared(f.row);
                await expectError(() => reset(f));
                await f.row.reload();
                assert.equal(f.row.intentos_fallidos, 5);
                assert.equal(hashes, 0, 'No ejecutar bcrypt con códigos incorrectos/agotados');
                await f.usuario.reload();
                assert.equal(JSON.stringify(f.usuario.get({ plain: true })) === JSON.stringify(beforeUsuario), true);
            } finally { bcrypt.hash = originalHash; }
        });

        await t.test('Código correcto después de cuatro fallos conserva contador histórico y consume', async () => {
            const f = await prepare();
            for (let index = 0; index < 4; index++) await expectError(() => reset(f, { codigo: wrongCode(f.codigo) }));
            await reset(f);
            await f.row.reload();
            assert.equal(f.row.intentos_fallidos, 4);
            assert.equal(f.row.consumida_en instanceof Date, true);
        });

        await t.test('Vencimiento exacto a diez minutos rechaza, limpia y no extiende ni modifica contraseña', async () => {
            const f = await prepare();
            const before = (await snapshot(f.usuario)).usuario;
            advance(SECURITY.CODE_TTL_MS);
            await expectError(() => reset(f));
            await f.row.reload(); await f.usuario.reload();
            assert.equal(f.row.invalidada_en.getTime(), ahora.getTime());
            assert.equal(f.row.expira_en.getTime(), ahora.getTime());
            assertCleared(f.row);
            assert.equal(JSON.stringify(f.usuario.get({ plain: true })) === JSON.stringify(before), true);
        });

        await t.test('Un milisegundo antes del vencimiento todavía permite consumir', async () => {
            const f = await prepare();
            advance(SECURITY.CODE_TTL_MS - 1);
            await reset(f);
            await f.row.reload();
            assert.equal(f.row.expira_en - f.row.consumida_en, 1);
        });

        await t.test('Desconocido/inactivo/invalidado/consumido/vencido/incorrecto/agotado devuelven el mismo error', async () => {
            const unknown = { usuario: { correo: 'sin_cuenta@example.test' }, codigo: '123456' };
            await expectError(() => reset(unknown));
            for (const mode of ['inactive', 'invalidated', 'consumed', 'expired', 'wrong', 'exhausted']) {
                const f = await prepare();
                if (mode === 'inactive') await f.usuario.update({ estado: false });
                if (mode === 'invalidated') await f.row.update({ invalidada_en: ahora });
                if (mode === 'consumed') await f.row.update({ consumida_en: ahora });
                if (mode === 'expired') advance(SECURITY.CODE_TTL_MS);
                if (mode === 'exhausted') await f.row.update({ intentos_fallidos: 5 });
                await expectError(() => reset(f, mode === 'wrong' ? { codigo: wrongCode(f.codigo) } : {}));
                await f.usuario.reload();
                assert.equal(f.usuario.version_credenciales, 0);
                assert.equal(await bcrypt.compare(initialPassword, f.usuario.password_hash), true);
            }
        });

        await t.test('CU09 aplica política nueva incluyendo 72 bytes UTF-8 sin normalizar/truncar contraseñas', async () => {
            const f = await prepare();
            const before = await snapshot(f.usuario);
            for (const passwordNueva of ['corta', 'sinmayuscula-123!', `Aa1!${'á'.repeat(35)}`]) {
                await expectError(() => reset(f, { passwordNueva }), 400, 'Datos de recuperación inválidos');
                await assertPreserved(f.usuario, before);
            }
            const passwordNueva = ` Aa1!${'á'.repeat(33)} `; // 72 bytes exactos, espacios conservados.
            await reset(f, { passwordNueva });
            await f.usuario.reload();
            assert.equal(await bcrypt.compare(passwordNueva, f.usuario.password_hash), true);
            assert.equal(await bcrypt.compare(passwordNueva.trim(), f.usuario.password_hash), false);
        });

        await t.test('Entradas estructurales inválidas no cambian recuperaciones ni ejecutan bcrypt', async () => {
            const f = await prepare(), before = await snapshot(f.usuario);
            for (const data of [null, {}, { correo: '' }, { correo: 'mal' }, { correo: f.usuario.correo, idUsuario: 1 }]) {
                await expectError(() => service.solicitarRecuperacion(data, ip), 400, 'Datos de recuperación inválidos');
            }
            for (const changes of [{ codigo: 123456 }, { codigo: '12345' }, { codigo: ' 123456' }, { nonce: f.row.nonce }, { passwordNueva: null }]) {
                await expectError(() => reset(f, changes), 400, 'Datos de recuperación inválidos');
            }
            await assertPreserved(f.usuario, before);
        });

        await t.test('Rollback de emisión conserva recuperación anterior ante fallo después de insertar', async () => {
            const f = await prepare(); advance(60000);
            const before = await snapshot(f.usuario), original = repository.create;
            repository.create = async options => { await original.call(repository, options); throw new AppError('Fallo controlado', 500); };
            try { await expectError(() => issue(f.usuario), 500, 'Fallo controlado'); }
            finally { repository.create = original; }
            await assertPreserved(f.usuario, before);
        });

        await t.test('Rollback de consumo revierte contraseña, versión, consumo e invalidación si falla al finalizar', async () => {
            const f = await prepare(), before = await snapshot(f.usuario), original = repository.invalidatePendingByUsuario;
            repository.invalidatePendingByUsuario = async options => { await original.call(repository, options); throw new AppError('Fallo controlado', 500); };
            try { await expectError(() => reset(f), 500, 'Fallo controlado'); }
            finally { repository.invalidatePendingByUsuario = original; }
            await assertPreserved(f.usuario, before);
            await reset(f);
        });

        await t.test('Fallo técnico al guardar intento incorrecto hace rollback del contador y limpieza', async () => {
            const f = await prepare();
            await f.row.update({ intentos_fallidos: 4 });
            const before = await snapshot(f.usuario), original = repository.updateById;
            repository.updateById = async options => { await original.call(repository, options); throw new AppError('Fallo controlado', 500); };
            try { await expectError(() => reset(f, { codigo: wrongCode(f.codigo) }), 500, 'Fallo controlado'); }
            finally { repository.updateById = original; }
            await assertPreserved(f.usuario, before);
        });

        await t.test('Bcrypt falla fuera de transacción y no consume código ni cambia credenciales', async () => {
            const f = await prepare(), before = await snapshot(f.usuario);
            bcrypt.hash = async () => { throw new AppError('Fallo controlado', 500); };
            try { await expectError(() => reset(f), 500, 'Fallo controlado'); }
            finally { bcrypt.hash = originalHash; }
            await assertPreserved(f.usuario, before);
        });

        await t.test('Overflow de versión revierte todo y conserva el código válido', async () => {
            const f = await prepare({ version_credenciales: 4294967295 }), before = await snapshot(f.usuario);
            await expectError(() => reset(f), 500, 'No se pudo actualizar la contraseña');
            await assertPreserved(f.usuario, before);
        });

        await t.test('Dos emisiones simultáneas: una sola emisión con conexiones independientes', async () => {
            const usuario = await makeUsuario();
            const results = await runRace(usuario, [() => issue(usuario), () => issue(usuario)]);
            assert.equal(results.every(result => result.status === 'fulfilled'), true);
            assert.deepEqual(results[0].value, results[1].value);
            assert.equal((await rowsFor(usuario)).length, 1);
        });

        await t.test('Emisiones concurrentes junto al límite de tres no exceden cuota persistente', async () => {
            const f = await prepare();
            advance(60000); await issue(f.usuario); advance(60000);
            const results = await runRace(f.usuario, [() => issue(f.usuario), () => issue(f.usuario)]);
            assert.equal(results.every(result => result.status === 'fulfilled'), true);
            assert.equal((await rowsFor(f.usuario)).length, 3);
            const rows = await rowsFor(f.usuario);
            assert.equal(rows.filter(row => !row.invalidada_en && !row.consumida_en).length, 1);
        });

        await t.test('Cinco fallos simultáneos serializados no pierden incrementos y agotan exactamente en cinco', async () => {
            const f = await prepare();
            const results = await runRace(f.usuario, Array.from({ length: 5 }, () => () => reset(f, { codigo: wrongCode(f.codigo) })));
            assert.equal(results.every(result => result.status === 'rejected' && result.reason instanceof AppError && result.reason.statusCode === 400), true);
            await f.row.reload();
            assert.equal(f.row.intentos_fallidos, 5);
            assert.equal(f.row.invalidada_en instanceof Date, true);
            assertCleared(f.row);
        });

        await t.test('Dos consumos correctos: uno exitoso y otro genérico, sin doble incremento', async () => {
            const f = await prepare();
            const results = await runRace(f.usuario, [() => reset(f, { passwordNueva: 'Carrera-A-123!' }), () => reset(f, { passwordNueva: 'Carrera-B-123!' })], 2);
            assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
            assert.equal(results.filter(result => result.status === 'rejected' && result.reason.statusCode === 400).length, 1);
            await f.usuario.reload(); await f.row.reload();
            assert.equal(f.usuario.version_credenciales, 1);
            assert.equal(f.row.consumida_en instanceof Date, true);
            assertCleared(f.row);
            const winningPassword = results[0].status === 'fulfilled' ? 'Carrera-A-123!' : 'Carrera-B-123!';
            assert.equal(await bcrypt.compare(winningPassword, f.usuario.password_hash), true);
        });

        await t.test('CU08 administrativo entre preverificación y consumo no puede ser sobrescrito por CU09', async () => {
            const f = await prepare();
            await withBcryptPaused(f, async () => {
                // Usa bcrypt original durante la operación concurrente para evitar el gate del CU09.
                bcrypt.hash = originalHash;
                await usuarioService.updatePassword(f.usuario.id_usuario, { password: 'Administrativa-789!' });
            });
            await f.usuario.reload(); await f.row.reload();
            assert.equal(await bcrypt.compare('Administrativa-789!', f.usuario.password_hash), true);
            assert.equal(f.usuario.version_credenciales, 1);
            assert.equal(f.row.consumida_en, null);
            assert.equal(f.row.invalidada_en instanceof Date, true);
        });

        await t.test('CU08 propio durante bcrypt invalida recuperación y conserva su sesión renovada', async () => {
            const f = await prepare();
            let ownResult;
            await withBcryptPaused(f, async () => {
                bcrypt.hash = originalHash;
                ownResult = await usuarioService.updateOwnPassword(f.usuario.id_usuario, {
                    passwordActual: initialPassword, passwordNueva: 'Propia-789!'
                }, 0);
            });
            const { verificarToken } = await import('../src/shared/utils/jwt.js');
            const session = verificarToken(ownResult.token);
            await authService.getSessionUsuario(f.usuario.id_usuario, session.versionCredenciales);
            await f.usuario.reload(); await f.row.reload();
            assert.equal(await bcrypt.compare('Propia-789!', f.usuario.password_hash), true);
            assert.equal(f.usuario.version_credenciales, 1);
            assert.equal(f.row.consumida_en, null);
            assertCleared(f.row);
        });

        await t.test('Nueva emisión durante bcrypt invalida el código preverificado y conserva el nuevo', async () => {
            const f = await prepare();
            await withBcryptPaused(f, async () => { advance(60000); await issue(f.usuario); });
            const next = await latest(f.usuario);
            await f.usuario.reload();
            assert.equal(f.usuario.version_credenciales, 0);
            assert.equal(next.invalidada_en, null);
            assert.equal(next.consumida_en, null);
            await reset({ usuario: f.usuario, codigo: readCode(f.usuario, next) });
        });

        await t.test('Cambio de correo durante bcrypt impide consumo y no retiene bloqueo de Usuario', async () => {
            const f = await prepare();
            await withBcryptPaused(f, () => usuarioService.updateUsuario(f.usuario.id_usuario, { correo: 'cambio.concurrente@example.test' }));
            await f.usuario.reload(); await f.row.reload();
            assert.equal(f.usuario.version_credenciales, 0);
            assert.equal(f.row.invalidada_en instanceof Date, true);
            assertCleared(f.row);
        });

        await t.test('Desactivación, expiración y quinto fallo entre las dos transacciones impiden consumir', async () => {
            for (const mode of ['inactive', 'expired', 'fifth-failure']) {
                const f = await prepare();
                if (mode === 'fifth-failure') await f.row.update({ intentos_fallidos: 4 });
                await withBcryptPaused(f, async () => {
                    if (mode === 'inactive') await usuarioService.updateEstado(f.usuario.id_usuario, { estado: false });
                    if (mode === 'expired') advance(SECURITY.CODE_TTL_MS);
                    if (mode === 'fifth-failure') await expectError(() => reset(f, { codigo: wrongCode(f.codigo) }));
                });
                await f.usuario.reload(); await f.row.reload();
                assert.equal(f.usuario.version_credenciales, 0);
                assert.equal(f.row.consumida_en, null);
                assert.equal(await bcrypt.compare(initialPassword, f.usuario.password_hash), true);
                if (mode === 'inactive') assert.equal(Boolean(f.usuario.estado), false);
                else assertCleared(f.row);
            }
        });

        await t.test('Revalidación de versión vigente impide consumo incluso sin invalidación previa', async () => {
            const f = await prepare();
            await withBcryptPaused(f, () => db.Usuario.update({ version_credenciales: 1 }, { where: { id_usuario: f.usuario.id_usuario } }));
            await f.usuario.reload(); await f.row.reload();
            assert.equal(f.usuario.version_credenciales, 1);
            assert.equal(f.row.consumida_en, null);
            assert.equal(await bcrypt.compare(initialPassword, f.usuario.password_hash), true);
        });

        await t.test('Carrera de reasignación del correo después de búsqueda no opera sobre otra cuenta', async () => {
            const usuario = await makeUsuario(), original = usuarioRepository.findByCorreo;
            let first = true;
            usuarioRepository.findByCorreo = async options => {
                const found = await original.call(usuarioRepository, options);
                if (first) {
                    first = false;
                    await usuarioService.updateUsuario(usuario.id_usuario, { correo: 'reasignacion@example.test' });
                }
                return found;
            };
            try { await issue(usuario); }
            finally { usuarioRepository.findByCorreo = original; }
            assert.equal((await rowsFor(usuario)).length, 0);
        });

        await t.test('Consumo invalida otras pendientes de la cuenta sin eliminar el historial', async () => {
            const f = await prepare();
            const other = await db.RecuperacionPassword.create({
                id_usuario: f.usuario.id_usuario, codigo_hmac: 'b'.repeat(64), nonce: crypto.randomUUID(),
                fecha_solicitud: new Date(ahora.getTime() - 1000), expira_en: new Date(ahora.getTime() + 600000)
            });
            await reset(f);
            await other.reload();
            assert.equal(other.invalidada_en instanceof Date, true);
            assertCleared(other);
            assert.equal((await rowsFor(f.usuario)).length, 2);
        });

        await t.test('Configuración inválida devuelve 503 antes de DB y deja todo intacto', async () => {
            const f = await prepare(), before = await snapshot(f.usuario), key = process.env.RECOVERY_HMAC_SECRET;
            delete process.env.RECOVERY_HMAC_SECRET;
            try {
                for (const operation of [() => issue(f.usuario), () => reset(f), () => service.solicitarRecuperacion(null)]) {
                    await expectError(operation, 503, 'La recuperación de contraseña no está disponible');
                }
            } finally { process.env.RECOVERY_HMAC_SECRET = key; }
            await assertPreserved(f.usuario, before);
        });

        await t.test('Operaciones SQL sensibles no registran HMAC, payload, código ni contraseñas', async () => {
            const usuario = await makeUsuario();
            const logs = [], previous = db.sequelize.options.logging;
            db.sequelize.options.logging = value => logs.push(value);
            try {
                await issue(usuario);
                const row = await latest(usuario);
                const f = { usuario, row, codigo: readCode(usuario, row) };
                const hash = f.usuario.password_hash;
                await expectError(() => reset(f, { codigo: wrongCode(f.codigo) }));
                await reset(f);
                const logged = logs.join('\n');
                for (const privateValue of [f.codigo, f.row.codigo_hmac, hash, initialPassword, newPassword,
                    process.env.RECOVERY_HMAC_SECRET]) {
                    assert.equal(logged.includes(privateValue), false, 'Sin valores sensibles en SQL logs');
                }
            } finally { db.sequelize.options.logging = previous; }
        });

        await t.test('Envío único ocurre tras commit, sin locks y permite completar CU09', async () => {
            const usuario = await makeUsuario();
            const attempts = [];
            const response = await issue(usuario, async (message, row) => {
                attempts.push(message);
                assert.equal(row.invalidada_en, null);
                // Otra transacción puede bloquear/actualizar Usuario durante HTTPS.
                await db.sequelize.transaction(async transaction => {
                    await usuarioRepository.findByIdForRecovery({ idUsuario: usuario.id_usuario, transaction });
                });
                return { estado: MAIL_RESULT.ACCEPTED };
            });
            const row = await latest(usuario);
            assert.equal(attempts.length, 1);
            assert.equal(attempts[0].to === usuario.correo, true);
            const codigo = /\b\d{6}\b/.exec(attempts[0].text)[0];
            assert.equal(JSON.stringify(response).includes(codigo), false);
            await reset({ usuario, codigo });
            await row.reload(); await usuario.reload();
            assert.equal(row.consumida_en instanceof Date, true);
            assertCleared(row);
            assert.equal(usuario.version_credenciales, 1);
            assert.equal(await bcrypt.compare(newPassword, usuario.password_hash), true);
            await expectError(() => authService.getSessionUsuario(usuario.id_usuario, 0), 401, 'Sesión no válida');
        });

        await t.test('Rechazo invalida solo la emisión; aceptación/ambigüedad conservan código y cuota', async () => {
            for (const estado of Object.values(MAIL_RESULT)) {
                const usuario = await makeUsuario(); let calls = 0;
                await issue(usuario, () => { calls++; return { estado }; });
                const row = await latest(usuario);
                assert.equal(calls, 1);
                assert.equal(row.expira_en - row.fecha_solicitud, SECURITY.CODE_TTL_MS);
                assert.equal(row.invalidada_en instanceof Date, estado === MAIL_RESULT.REJECTED);
                await issue(usuario);
                assert.equal((await rowsFor(usuario)).length, 1);
                if (estado !== MAIL_RESULT.REJECTED) await reset({ usuario, codigo: readCode(usuario, row) });
                else await expectError(() => reset({ usuario, codigo: readCode(usuario, row) }));
            }
        });

        await t.test('Rechazo tardío no invalida una nueva emisión concurrente', async () => {
            const usuario = await makeUsuario();
            await issue(usuario, async () => {
                advance(60000);
                await issue(usuario);
                return { estado: MAIL_RESULT.REJECTED };
            });
            const rows = await rowsFor(usuario);
            assert.equal(rows.length, 2);
            assert.equal(rows[0].invalidada_en instanceof Date, true);
            assert.equal(rows[1].invalidada_en, null);
            await reset({ usuario, codigo: readCode(usuario, rows[1]) });
        });

        await t.test('Timeout real conserva código hasta vencimiento y nunca reenvía', { timeout: 10000 }, async () => {
            const usuario = await makeUsuario(); let calls = 0;
            await issue(usuario, () => { calls++; return new Promise(() => {}); });
            const row = await latest(usuario);
            assert.equal(row.invalidada_en, null); assert.equal(calls, 1);
            await reset({ usuario, codigo: readCode(usuario, row) });
            assert.equal(calls, 1);
        });

        await t.test('Cuotas IP persistentes: 20 solicitudes, 30 restablecimientos y ventanas independientes', async () => {
            for (const [ambito, maximo] of [['solicitud', 20], ['restablecimiento', 30]]) {
                for (let i = 0; i < maximo; i++) await service.verificarLimiteIp(ambito, ip);
                await expectError(() => service.verificarLimiteIp(ambito, ip), 429, 'Demasiadas solicitudes. Intenta nuevamente más tarde');
                await service.verificarLimiteIp(ambito, '192.0.2.2');
            }
            assert.equal(await db.LimiteRecuperacionIp.count(), 4);
            advance(SECURITY.IP_WINDOW_MS);
            await service.verificarLimiteIp('solicitud', ip);
            await service.verificarLimiteIp('restablecimiento', ip);
            const rows = await db.LimiteRecuperacionIp.findAll();
            assert.equal(rows.every(row => row.cantidad === 1), true);
        });

        await t.test('Solicitudes desconocidas consumen cuota IP y sobreviven a errores de negocio', async () => {
            for (let i = 0; i < 20; i++) await service.solicitarRecuperacion({ correo: 'sin_cuenta@example.test' }, ip);
            await expectError(() => service.solicitarRecuperacion({ correo: 'sin_cuenta@example.test' }, ip), 429, 'Demasiadas solicitudes. Intenta nuevamente más tarde');
        });

        await t.test('Concurrencia IP no pierde incrementos ni supera la cuota', async () => {
            const results = await Promise.allSettled(Array.from({ length: 25 }, () => service.verificarLimiteIp('solicitud', ip)));
            assert.equal(results.filter(r => r.status === 'fulfilled').length, 20);
            assert.equal(results.filter(r => r.status === 'rejected' && r.reason.statusCode === 429).length, 5);
            const row = await db.LimiteRecuperacionIp.findOne();
            assert.equal(row.cantidad, 25);
        });

        await t.test('HTTP público: respuesta genérica, espera mínima, IP socket, validación y sin cookie', { timeout: 20000 }, async () => {
            const { app } = await import('../src/app.js');
            const server = app.listen(0, '127.0.0.1');
            await new Promise(resolve => server.once('listening', resolve));
            const base = `http://127.0.0.1:${server.address().port}/api/auth/recuperacion`;
            service.esperarRespuesta = originalWait;
            try {
                const usuario = await makeUsuario();
                const started = performance.now();
                const responses = await Promise.all([usuario.correo, 'desconocido@example.test'].map(correo => fetch(`${base}/solicitar`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.80' }, body: JSON.stringify({ correo })
                })));
                assert.equal(performance.now() - started >= SECURITY.PUBLIC_RESPONSE_MIN_MS - 50, true);
                assert.equal(responses.every(r => r.status === 200 && !r.headers.has('set-cookie')), true);
                assert.deepEqual(await responses[0].json(), await responses[1].json());
                const { calcularClaveIpHmac } = await import('../src/shared/utils/recuperacion-crypto.js');
                const quota = await db.LimiteRecuperacionIp.findOne();
                assert.equal(quota.clave_ip_hmac === calcularClaveIpHmac({ ambito: 'solicitud', ipNormalizada: '127.0.0.1' }), true);
                const f = await prepare();
                const response = await fetch(`${base}/restablecer`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo: f.usuario.correo, codigo: f.codigo, passwordNueva: newPassword }) });
                assert.equal(response.status, 200); assert.equal(response.headers.has('set-cookie'), false);
                assert.deepEqual(await response.json(), { message: 'Contraseña restablecida exitosamente' });
                const invalid = await fetch(`${base}/solicitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                assert.equal(invalid.status, 400);
            } finally {
                service.esperarRespuesta = async () => {};
                await new Promise(resolve => server.close(resolve));
            }
        });

        t.diagnostic('Base temporal migrada y eliminada; emisión, fallos, consumo y transporte mock sin correos reales, con transacciones y conexiones independientes.');
    } finally {
        bcrypt.hash = originalHash;
        crypto.randomInt = originalRandomInt;
        syncBuiltinESMExports();
        if (originalClock) {
            const { recuperacionPasswordRepository } = await import('../src/data/repositories/recuperacion-password.repository.js');
            recuperacionPasswordRepository.getCurrentDate = originalClock;
        }
        if (originalWait) {
            const { recuperacionPasswordService } = await import('../src/business/services/recuperacion-password.service.js');
            recuperacionPasswordService.esperarRespuesta = originalWait;
        }
        try { if (db) await db.sequelize.close(); }
        finally { if (databaseCreated) await runCli('db:drop'); }
    }
});
