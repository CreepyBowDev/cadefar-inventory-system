import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'auditoria_cobertura_sin_conexion';
const { app } = await import('../src/app.js');
const { default: db } = await import('../src/data/models/index.js');
const { OPERACIONES_HTTP_AUDITORIA: contratos, identificarOperacionAuditoria } = await import('../src/shared/constants/auditoria-operaciones.js');
const rutas = [
    ['auth', 'authRouter', '/api/auth'], ['usuario', 'usuarioRouter', '/api/usuarios'],
    ['proveedor-laboratorio', 'proveedorLaboratorioRouter', '/api/proveedores-laboratorios'],
    ['principio-activo', 'principioActivoRouter', '/api/principios-activos'],
    ['medicamento', 'medicamentoRouter', '/api/medicamentos'],
    ['composicion-medicamento', 'composicionMedicamentoRouter', '/:idMedicamento/composicion'],
    ['compra', 'compraRouter', '/api/compras'], ['inventario', 'inventarioRouter', '/api/inventario'],
    ['bitacora-auditoria', 'bitacoraAuditoriaRouter', '/api/bitacora']
];
const montajes = new Map(await Promise.all(rutas.map(async ([archivo, nombre, prefijo]) => {
    const router = await import(`../src/presentation/routes/${archivo}.router.js`);
    return [router[nombre], prefijo];
})));
const normalizar = ruta => ruta.replace(/:[^/]+/g, ':id').replace(/\/$/, '');
const clave = (metodo, ruta) => `${metodo.toUpperCase()} ${normalizar(ruta)}`;
const actuales = [];
const recorrer = (stack, prefijo = '') => {
    for (const layer of stack) {
        if (layer.route) {
            for (const metodo of Object.keys(layer.route.methods)) actuales.push(clave(metodo, `${prefijo}${layer.route.path}`));
        } else if (layer.name === 'router') {
            assert.ok(montajes.has(layer.handle), 'Una ruta nueva requiere clasificación de auditoría');
            recorrer(layer.handle.stack, prefijo + montajes.get(layer.handle));
        }
    }
};
recorrer(app.router.stack);

test('Fase 7: los 46 endpoints Express, clasificador y matriz documental tienen cobertura idéntica', async () => {
    const esperados = contratos.map(e => clave(e.metodo, e.ruta));
    assert.equal(actuales.length, 46); assert.equal(new Set(actuales).size, 46);
    assert.deepEqual(actuales.sort(), esperados.sort());
    assert.equal(contratos.filter(e => e.metodo === 'GET').length, 20);
    const documento = await readFile(new URL('../../docs/ai/bitacora-auditoria.md', import.meta.url), 'utf8');
    const matriz = [...documento.matchAll(/^\| (GET|POST|PATCH|DELETE) \| `([^`]+)` \|/gm)].map(([, metodo, ruta]) => clave(metodo, ruta));
    assert.deepEqual(matriz.sort(), esperados.sort());
});

test('Fase 7: todos los endpoints clasifican caja/slash/HEAD sin conservar parámetros arbitrarios', () => {
    for (const e of contratos) {
        const path = e.ruta.replaceAll(':id', 'dato_privado');
        assert.equal(identificarOperacionAuditoria(e.metodo, path), e.operacion);
        assert.equal(identificarOperacionAuditoria(e.metodo, `${path.toUpperCase()}/`), e.operacion);
        if (e.metodo === 'GET') assert.equal(identificarOperacionAuditoria('HEAD', path), e.operacion);
    }
    assert.equal(identificarOperacionAuditoria('POST', '/api/bitacora'), undefined);
    assert.equal(identificarOperacionAuditoria('GET', '/api/ventas'), undefined);
});

test('Fase 7: SQL logging predeterminado desactivado para no exponer valores del negocio/auditoría', () => {
    const require = createRequire(import.meta.url);
    const config = require('../src/data/database/config/config.cjs');
    for (const env of ['test', 'development', 'production']) assert.equal(config[env].logging, false);
    assert.equal(db.sequelize.options.logging, false);
});
