import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { errorHandler } from '../src/presentation/middlewares/error.middleware.js';
import { AppError } from '../src/shared/errors/app-error.js';

test('HTTP: errores reales del parser conservan códigos y no exponen el body', async t => {
    const marker = 'dato_sintetico_privado_no_registrar';
    const logs = [];
    t.mock.method(console, 'error', value => logs.push(value));
    const app = express();
    app.use(express.json());
    app.post('/entrada', (req, res) => res.sendStatus(204));
    app.get('/conflicto', (req, res, next) => next(new AppError('Conflicto controlado', 409)));
    app.get('/interno', (req, res, next) => {
        const error = new Error(marker);
        error.status = 400; // Un status arbitrario no vuelve público un error técnico.
        error.sql = marker;
        next(error);
    });
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, body) => fetch(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body }),
        signal: AbortSignal.timeout(10000)
    });
    try {
        await t.test('JSON malformado y JSON escalar inválido reciben 400 sanitizado', async () => {
            for (const body of [`{"password":"${marker}"`, JSON.stringify(marker)]) {
                const response = await request('/entrada', body);
                assert.equal(response.status, 400);
                assert.deepEqual(await response.json(), { message: 'El cuerpo de la solicitud debe contener JSON válido' });
            }
        });
        await t.test('Body superior al límite real de express.json recibe 413', async () => {
            const response = await request('/entrada', JSON.stringify({ password: marker + 'x'.repeat(110 * 1024) }));
            assert.equal(response.status, 413);
            assert.deepEqual(await response.json(), { message: 'El cuerpo de la solicitud supera el tamaño permitido' });
        });
        await t.test('JSON válido sigue llegando al endpoint', async () => {
            assert.equal((await request('/entrada', '{}')).status, 204);
        });
        await t.test('AppError conserva su contrato; errores técnicos siguen siendo 500 genéricos', async () => {
            const conflict = await request('/conflicto');
            assert.equal(conflict.status, 409);
            assert.deepEqual(await conflict.json(), { message: 'Conflicto controlado' });
            const internal = await request('/interno');
            assert.equal(internal.status, 500);
            assert.deepEqual(await internal.json(), { message: 'Error interno del servidor' });
        });
        assert.equal(JSON.stringify(logs).includes(marker), false, 'No registrar body, SQL ni mensajes técnicos privados');
        assert.equal(logs.some(log => log.statusCode === 400), true);
        assert.equal(logs.some(log => log.statusCode === 413), true);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
