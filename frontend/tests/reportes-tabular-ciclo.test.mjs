// Ciclo del hook con promesas no cooperativas: incluso si el transporte ignora
// AbortSignal no puede activar un archivo de un contexto obsoleto.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';

const slots = []; let cursor = 0;
const react = {
  useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
  useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; },
  useLayoutEffect(effect, deps) {
    const i = cursor++, previo = slots[i];
    if (!previo || deps.some((value, n) => value !== previo.deps[n])) { previo?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; }
  }
};
globalThis.__reactTabular = react;
const loader = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: 'data:text/javascript,export const {useRef,useState,useLayoutEffect}=globalThis.__reactTabular', shortCircuit: true };
  return next(specifier, context);
} });
const { useExportacionTabular } = await import('../src/features/reportes/hooks/useExportacionTabular.js');
loader.deregister(); delete globalThis.__reactTabular;
const desmontar = () => { for (const slot of slots) slot?.cleanup?.(); slots.length = 0; };
const render = (clave, exportar, usuario, restringir) => { cursor = 0; return useExportacionTabular(clave, exportar, restringir, usuario); };
const diferida = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('Navegación, filtros, sesión/rol y desmontaje descartan respuesta tardía no cooperativa', async t => {
  const crear = t.mock.method(URL, 'createObjectURL', () => { throw new Error('No debe activarse'); });
  for (const cambio of ['navegación', 'filtros', 'granularidad aplicada', 'presentación', 'formato', 'gráfica/métrica', 'rol', 'sesión', 'desmontaje']) {
    desmontar(); const pendiente = diferida(), usuario = { idUsuario: 1 }; let signal;
    const exportar = (_, options) => { signal = options.signal; return pendiente.promise; };
    const hook = render('inicial', exportar, usuario);
    const trabajo = hook.iniciar({ formato: 'PDF' });
    if (cambio === 'desmontaje') desmontar();
    else render(cambio === 'sesión' ? 'inicial' : cambio, exportar, cambio === 'sesión' ? { idUsuario: 1 } : usuario);
    assert.equal(signal.aborted, true);
    pendiente.resolve({ blob: new Blob(['simulado']), nombre: 'archivo.pdf' }); await trabajo;
  }
  assert.equal(crear.mock.callCount(), 0); desmontar();
});

test('Doble click se bloquea sin render y cancelar permite otro trabajo sin mezclar respuestas', async t => {
  desmontar(); const primera = diferida(), segunda = diferida(); let peticiones = 0;
  const exportar = () => (++peticiones === 1 ? primera : segunda).promise;
  const crear = t.mock.method(URL, 'createObjectURL', () => { throw new Error('No debe activarse'); });
  const hook = render('contexto', exportar);
  const uno = hook.iniciar({}), duplicada = hook.iniciar({}); await duplicada; assert.equal(peticiones, 1);
  hook.cancelar(); const dos = hook.iniciar({}); assert.equal(peticiones, 2);
  primera.resolve({}); await uno;
  assert.equal(render('contexto', exportar).estado.ocupada, true);
  desmontar(); segunda.resolve({}); await dos;
  assert.equal(crear.mock.callCount(), 0);
});

test('Denegación tardía de descarga estadística no restringe otra presentación/sesión vigente', async () => {
  for (const status of [401, 403]) {
    desmontar(); let reject, signal, restricciones = 0;
    const promise = new Promise((_, r) => { reject = r; });
    const exportar = (_, opciones) => { signal = opciones.signal; return promise; };
    const usuario = { idUsuario: 1, idRol: 1 };
    const tarea = render('ESTADISTICA/MES/PDF', exportar, usuario, () => { restricciones++; }).iniciar({ presentacion: 'ESTADISTICA', granularidad: 'MES', formato: 'PDF' });
    render('TABULAR/CSV', exportar, { ...usuario }, () => { restricciones++; });
    assert.equal(signal.aborted, true);
    reject(Object.assign(new Error('Denegado'), { name: 'DescargaError', status })); await tarea;
    assert.equal(restricciones, 0); assert.deepEqual(render('TABULAR/CSV', exportar).estado, {});
  }
  desmontar();
});
