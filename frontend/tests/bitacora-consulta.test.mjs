import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leerConsultaBitacora, aplicarBorradorBitacora, borradorBitacora, serializarConsultaBitacora, ACCIONES_BITACORA } from '../src/features/bitacora/utils/consultaBitacora.js';
import { MODULOS_BITACORA, TIPOS_EVENTO_BITACORA, REGISTROS_BITACORA } from '../src/features/bitacora/utils/presentacionBitacora.js';
import { CATALOGO_AUDITORIA, TIPOS_REGISTRO_AUDITORIA, AUDITORIA } from '../../backend/src/shared/constants/auditoria.js';

test('Los filtros de la UI cubren el catálogo vigente de API sin inventar códigos', () => {
  assert.deepEqual(Object.keys(TIPOS_EVENTO_BITACORA).sort(), Object.keys(CATALOGO_AUDITORIA).sort());
  assert.deepEqual(Object.keys(MODULOS_BITACORA).sort(), [...new Set(Object.values(CATALOGO_AUDITORIA).map(e => e.modulo))].sort());
  assert.deepEqual(Object.keys(ACCIONES_BITACORA).sort(), [...new Set(Object.values(CATALOGO_AUDITORIA).map(e => e.accion))].sort());
  assert.deepEqual(Object.keys(REGISTROS_BITACORA).sort(), [...TIPOS_REGISTRO_AUDITORIA].sort());
  assert.equal(AUDITORIA.PAGINA_PREDETERMINADA, 25); assert.equal(AUDITORIA.PAGINA_MAXIMA, 100);
});
test('Fecha civil Bolivia conserva instante, milisegundos y cambio de día al recuperar URL UTC', () => {
  const filtros = { desde: '2026-10-13T03:04:05.678Z', hasta: '2026-10-13T12:00:00+02:00', pagina: '2', limite: '50' };
  const borrador = borradorBitacora(filtros);
  assert.equal(borrador.desde, '2026-10-12T23:04:05.678');
  assert.equal(borrador.hasta, '2026-10-13T06:00:00.000');
  const aplicada = aplicarBorradorBitacora(borrador, filtros.limite);
  assert.equal(aplicada.error, ''); assert.equal(aplicada.filtros.pagina, '1');
  assert.equal(Date.parse(aplicada.filtros.desde), Date.parse(filtros.desde));
  assert.equal(Date.parse(aplicada.filtros.hasta), Date.parse(filtros.hasta));
  assert.equal(leerConsultaBitacora(serializarConsultaBitacora(aplicada.filtros)).error, '');
});
test('Validación de fechas evita normalizaciones imposibles, años fuera de DATETIME y rangos invertidos', () => {
  for (const desde of ['2026-02-30T00:00:00Z', '2026-01-01T25:00:00Z', '2026-01-01T00:00:00', '0999-12-31T00:00:00Z', '9999-12-31T23:00:00-04:00']) {
    assert.ok(leerConsultaBitacora(new URLSearchParams({ desde }).toString()).error, desde);
  }
  assert.ok(aplicarBorradorBitacora({ desde: '2026-02-30T00:00' }, '25').error);
  assert.ok(aplicarBorradorBitacora({ desde: '2026-01-02T00:00', hasta: '2026-01-01T00:00' }, '25').error);
  assert.equal(aplicarBorradorBitacora({ desde: '2024-02-29T00:00', hasta: '2024-02-29T00:00' }, '25').error, '');
  const limite = { desde: '1000-01-01T00:00:00.000Z', pagina: '1', limite: '25' };
  assert.equal(borradorBitacora(limite).desde, '0999-12-31T20:00:00.000');
  assert.equal(aplicarBorradorBitacora(borradorBitacora(limite), '25').error, '');
});
test('URLs rechazan filtros duplicados, códigos inválidos y coerciones de ID antes de consultar', () => {
  for (const query of ['pagina=0', 'pagina=01', 'pagina=1e2', 'pagina=2147483648', 'idUsuarioObjetivo=-1', 'idUsuarioResponsable=1.5',
    'idRegistro=1', 'limite=1', 'limite=025', 'pagina=1&pagina=2', 'resultado=FUTURO', 'desconocido=x']) assert.ok(leerConsultaBitacora(query).error, query);
  assert.equal(leerConsultaBitacora('idRegistro=2147483647&tipoRegistro=COMPRA&limite=100').error, '');
});
test('IPv4/IPv6 y nombre ingresado mantienen límites de contrato', () => {
  for (const direccionIp of ['192.0.2.1', '::1', '2001:db8::1', '::ffff:192.0.2.1']) assert.equal(leerConsultaBitacora(new URLSearchParams({ direccionIp }).toString()).error, '');
  for (const direccionIp of ['256.1.1.1', '01.1.1.1', '192.0.2.1:80', 'fe80::1%eth0', '2001:db8:::1']) assert.ok(leerConsultaBitacora(new URLSearchParams({ direccionIp }).toString()).error);
  assert.equal(leerConsultaBitacora(new URLSearchParams({ nombreIngresado: 'x'.repeat(60) }).toString()).error, '');
  assert.ok(leerConsultaBitacora(new URLSearchParams({ nombreIngresado: 'x'.repeat(61) }).toString()).error);
});
