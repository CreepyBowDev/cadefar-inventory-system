import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leerConsultaReporte, validarFiltrosReporte, serializarConsultaReporte } from '../src/features/reportes/utils/consultaReporte.js';

const tipos = ['ventas', 'compras', 'perdidas'];
const validarURL = (query, tipo = 'ventas') => {
  const consulta = leerConsultaReporte(query, tipo);
  assert.equal(consulta.estado, 'valida', `${query}: ${consulta.error}`);
  assert.equal(consulta.habilitada, true);
  assert.equal(consulta.error, '');
  assert.equal(validarFiltrosReporte(consulta.filtros, tipo), '');
  assert.deepEqual(leerConsultaReporte(serializarConsultaReporte(consulta.filtros, tipo), tipo), consulta);
  return consulta;
};
const rechazarURL = (query, tipo = 'ventas') => {
  const consulta = leerConsultaReporte(query, tipo);
  assert.equal(consulta.estado, 'invalida', String(query));
  assert.equal(consulta.habilitada, false);
  assert.equal(consulta.filtros, null);
  assert.ok(consulta.error);
};

test('Entrada sin período no habilita consulta; Buscar y serializar exigen selección explícita', () => {
  for (const tipo of tipos) {
    for (const query of ['', '?', 'pagina=1&limite=25', 'pagina=2&limite=7']) {
      const consulta = leerConsultaReporte(query, tipo);
      assert.equal(consulta.estado, 'sinPeriodo');
      assert.equal(consulta.habilitada, false);
      assert.equal(consulta.error, '');
      assert.ok(validarFiltrosReporte(consulta.filtros, tipo));
      assert.throws(() => serializarConsultaReporte(consulta.filtros, tipo), /período/);
      assert.ok(!Object.keys(consulta.filtros).some(campo => ['dia', 'mes', 'desde', 'hasta'].includes(campo)));
    }
    assert.deepEqual(leerConsultaReporte('', tipo).filtros, { pagina: '1', limite: '25' });
    rechazarURL('limite=0', tipo);
    rechazarURL('desconocido=x', tipo);
  }
  assert.equal(leerConsultaReporte('estadoOperacion=PENDIENTE', 'ventas').estado, 'sinPeriodo');
  assert.equal(leerConsultaReporte('motivo=DA%C3%91O', 'perdidas').estado, 'sinPeriodo');
});

test('Día, mes y período cerrado conservan fechas civiles, futuros y extremos sin máximo artificial', () => {
  for (const tipo of tipos) {
    for (const query of ['dia=1000-01-01', 'dia=9999-12-31', 'dia=2000-02-29', 'dia=2024-02-29',
      'dia=1900-02-28', 'dia=2400-02-29', 'dia=2099-12-31', 'mes=1000-01', 'mes=9999-12',
      'mes=1900-02', 'mes=2000-02', 'mes=2099-12', 'desde=1000-01-01&hasta=9999-12-31',
      'desde=2000-02-29&hasta=2000-02-29', 'desde=2099-01-01&hasta=2099-12-31']) validarURL(query, tipo);
  }
});

test('Fechas imposibles, formatos alternativos, rango incompleto/invertido y modalidades mezcladas son inválidos', () => {
  const fechas = ['1900-02-29', '2100-02-29', '2026-02-29', '2026-02-30', '2026-04-31',
    '0999-12-31', '0000-01-01', '10000-01-01', '2026-00-01', '2026-13-01', '2026-01-00',
    '2026-01-32', '2026-1-01', '26-01-01', '2026/01/01', '2026-01-01T00:00:00Z', ' 2026-01-01', '2026-01-01\n'];
  for (const fecha of fechas) {
    rechazarURL(new URLSearchParams({ dia: fecha }));
    rechazarURL(new URLSearchParams({ desde: fecha, hasta: '9999-12-31' }));
    rechazarURL(new URLSearchParams({ desde: '1000-01-01', hasta: fecha }));
  }
  for (const mes of ['0999-12', '10000-01', '2026-00', '2026-13', '2026-1', '2026-01-01', ' 2026-01']) {
    rechazarURL(new URLSearchParams({ mes }));
  }
  for (const query of ['desde=2026-01-01', 'hasta=2026-01-01', 'desde=2026-01-02&hasta=2026-01-01',
    'dia=2026-01-01&mes=2026-01', 'dia=2026-01-01&desde=2026-01-01',
    'mes=2026-01&hasta=2026-01-31', 'dia=2026-01-01&desde=2026-01-01&hasta=2026-01-01',
    'mes=2026-01&desde=2026-01-01&hasta=2026-01-31']) rechazarURL(query);
});

test('URL estricta rechaza desconocidos, repetidos, vacíos y sintaxis de arrays/objetos sin sanearla', () => {
  for (const tipo of tipos) {
    const campos = ['dia', 'mes', 'desde', 'hasta', 'pagina', 'limite', tipo === 'perdidas' ? 'motivo' : 'estadoOperacion'];
    for (const campo of campos) {
      rechazarURL(`dia=2026-01-01&${campo}=`, tipo);
      rechazarURL(`dia=2026-01-01&${campo}=%20`, tipo);
      rechazarURL(`dia=2026-01-01&${campo}=1&${campo}=1`, tipo);
      rechazarURL(`dia=2026-01-01&${campo}[]=1`, tipo);
      rechazarURL(`dia=2026-01-01&${campo}[valor]=1`, tipo);
    }
    for (const campo of ['tipoPeriodo', 'idMedicamento', 'idUsuario', 'idProveedorLaboratorio', 'orden', 'clave', 'desconocido']) {
      rechazarURL(`dia=2026-01-01&${campo}=x`, tipo);
    }
    rechazarURL('dia=2026-01-01&%64ia=2026-01-01', tipo);
  }
});

test('Opcionales exactos por reporte, sin filtros cruzados ni TODOS y DAÑO codificado', () => {
  for (const estadoOperacion of ['CONFIRMADA', 'PENDIENTE', 'ANULADA']) validarURL(`mes=2026-01&estadoOperacion=${estadoOperacion}`);
  for (const estadoOperacion of ['CONFIRMADA', 'ANULADA']) validarURL(`mes=2026-01&estadoOperacion=${estadoOperacion}`, 'compras');
  for (const motivo of ['VENCIMIENTO', 'DAÑO']) validarURL(new URLSearchParams({ mes: '2026-01', motivo }), 'perdidas');
  for (const tipo of tipos) {
    for (const valor of ['TODOS', 'DANO', 'ANULADA_CONFIRMADA', 'ANULADA_SIN_CONFIRMAR', 'confirmada', ' CONFIRMADA']) {
      rechazarURL(new URLSearchParams({ mes: '2026-01', [tipo === 'perdidas' ? 'motivo' : 'estadoOperacion']: valor }), tipo);
    }
    rechazarURL(`mes=2026-01&${tipo === 'perdidas' ? 'estadoOperacion=CONFIRMADA' : 'motivo=DAÑO'}`, tipo);
    const serializada = serializarConsultaReporte({ dia: '2026-01-01' }, tipo);
    assert.equal(serializada, 'dia=2026-01-01&pagina=1&limite=25');
  }
  rechazarURL('mes=2026-01&estadoOperacion=PENDIENTE', 'compras');
  assert.equal(serializarConsultaReporte({ mes: '2026-01', motivo: 'DAÑO', limite: '7' }, 'perdidas'),
    'mes=2026-01&pagina=1&limite=7&motivo=DA%C3%91O');
});

test('Página y límite HTTP textuales, defaults y valores no habituales como 7', () => {
  for (const tipo of tipos) {
    for (const pagina of ['1', '2', '2147483647']) {
      for (const limite of ['1', '7', '25', '50', '100']) {
        const { filtros } = validarURL(`dia=2026-01-01&pagina=${pagina}&limite=${limite}`, tipo);
        assert.equal(filtros.pagina, pagina);
        assert.equal(filtros.limite, limite);
      }
    }
    for (const valor of ['0', '-1', '01', '1.0', '1.5', '1e1', '0x10', '+1', ' 1', '1 ', '1\n', 'Infinity', 'NaN', '99999999999999999999']) {
      for (const campo of ['pagina', 'limite']) rechazarURL(new URLSearchParams({ dia: '2026-01-01', [campo]: valor }), tipo);
    }
    rechazarURL('dia=2026-01-01&pagina=2147483648', tipo);
    rechazarURL('dia=2026-01-01&limite=101', tipo);
  }
});

test('Validación y serialización de objetos no coercionan arrays, objetos, null, números ni campos inválidos', () => {
  for (const tipo of tipos) {
    for (const entrada of [null, undefined, [], 'dia=2026-01-01', new URLSearchParams(),
      { dia: ['2026-01-01'] }, { dia: { valor: '2026-01-01' } }, { dia: null },
      { dia: '2026-01-01', pagina: 1 }, { dia: '2026-01-01', limite: undefined },
      { dia: '2026-01-01', desconocido: 'x' }, { dia: '2026-01-01', tipoPeriodo: 'DIA' },
      { dia: '2026-01-01', [tipo === 'perdidas' ? 'motivo' : 'estadoOperacion']: '' }]) {
      assert.ok(validarFiltrosReporte(entrada, tipo));
      assert.throws(() => serializarConsultaReporte(entrada, tipo));
    }
    for (const entrada of [null, undefined, [], {}, { dia: ['2026-01-01'] }]) rechazarURL(entrada, tipo);
  }
  rechazarURL('dia=2026-01-01', 'otro');
  assert.ok(validarFiltrosReporte({ dia: '2026-01-01' }, '__proto__'));
});

test('Lectura/serialización determinista sin mutar filtros o URL, apta para recarga y Atrás/Adelante', () => {
  const query = new URLSearchParams('limite=7&hasta=9999-12-31&pagina=2147483647&desde=1000-01-01&estadoOperacion=ANULADA');
  const original = query.toString();
  const consulta = validarURL(query);
  Object.freeze(consulta.filtros);
  assert.equal(serializarConsultaReporte(consulta.filtros, 'ventas'),
    'desde=1000-01-01&hasta=9999-12-31&pagina=2147483647&limite=7&estadoOperacion=ANULADA');
  assert.equal(query.toString(), original);
});
