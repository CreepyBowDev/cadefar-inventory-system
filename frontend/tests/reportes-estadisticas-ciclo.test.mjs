import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';

const slots = []; let cursor = 0;
const react = {
  useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
  useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
  useLayoutEffect(effect, deps) { const i = cursor++, previo = slots[i]; if (!previo || deps.some((v, n) => v !== previo.deps[n])) { previo?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; } }
};
globalThis.__reactEstadisticas = react;
const loader = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: 'data:text/javascript,export const {useRef,useState,useLayoutEffect}=globalThis.__reactEstadisticas', shortCircuit: true };
  return next(specifier, context);
} });
const { useReporteEstadisticas } = await import('../src/features/reportes/hooks/useReporteEstadisticas.js');
loader.deregister(); delete globalThis.__reactEstadisticas;
const desmontar = () => { for (const slot of slots) slot?.cleanup?.(); slots.length = 0; };
const render = (consultar, clave, sesion, restringir) => { cursor = 0; return useReporteEstadisticas(consultar, clave, sesion, restringir); };
const diferida = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

test('Respuestas no cooperativas: filtros, sesión/rol, salida de vista y desmontaje', async () => {
  for (const cambio of ['filtros', 'granularidad', 'sesion', 'rol', 'vista', 'desmontaje']) {
    desmontar(); const d = diferida(), nuevo = diferida(), usuario = { idRol: 1 }; let signal, llamadas = 0;
    const consultar = (_, opciones) => { if (!llamadas) signal = opciones.signal; return (++llamadas === 1 ? d : nuevo).promise; };
    render(consultar, 'dia=2026-11-20&granularidad=DIA', usuario);
    const clave = cambio === 'vista' ? '' : cambio === 'filtros' ? 'dia=2026-11-21&granularidad=DIA' : cambio === 'granularidad' ? 'dia=2026-11-20&granularidad=MES' : 'dia=2026-11-20&granularidad=DIA';
    const sesion = ['sesion', 'rol'].includes(cambio) ? { idRol: cambio === 'rol' ? 2 : 1 } : usuario;
    if (cambio === 'desmontaje') desmontar();
    else render(consultar, clave, sesion);
    assert.ok(signal.aborted);
    d.resolve({ data: { secreto: 'obsoleto' } }); await tick();
    if (cambio !== 'desmontaje') assert.equal(render(consultar, clave, sesion).data, undefined);
    desmontar();
  }
});
test('Cambio de fuente invalida promesa no cooperativa incluso con misma query; error tardío no restringe el contexto nuevo', async () => {
  for (const tipo of ['compras', 'perdidas']) {
    desmontar(); const anterior = diferida(), actual = diferida(), sesion = { idRol: tipo === 'perdidas' ? 2 : 1 };
    let signal, restricciones = 0;
    const uno = (_, opciones) => { signal = opciones.signal; return anterior.promise; };
    const dos = () => actual.promise;
    const clave = 'dia=2026-11-20&granularidad=MES';
    render(uno, clave, sesion, () => restricciones++);
    render(dos, clave, sesion, () => restricciones++);
    assert.ok(signal.aborted);
    actual.resolve({ data: { fuente: tipo.toUpperCase() } }); await tick();
    anterior.reject({ response: { status: 403 } }); await tick();
    assert.deepEqual(render(dos, clave, sesion).data, { fuente: tipo.toUpperCase() });
    assert.equal(restricciones, 0);
  }
  desmontar();
});
test('Respuesta antigua no sustituye la nueva; página/representación sin GET; 401/403 retiran datos', async () => {
  desmontar(); const uno = diferida(), dos = diferida(); let n = 0, signal;
  const consultar = (_, opciones) => { signal = opciones.signal; return (++n === 1 ? uno : dos).promise; };
  const usuario = {};
  render(consultar, 'dia=2026-11-20&granularidad=DIA', usuario); const vieja = signal;
  render(consultar, 'dia=2026-11-21&granularidad=DIA', usuario); assert.ok(vieja.aborted);
  dos.resolve({ data: { actual: true } }); await tick();
  uno.resolve({ data: { obsoleto: true } }); await tick();
  assert.deepEqual(render(consultar, 'dia=2026-11-21&granularidad=DIA', usuario).data, { actual: true });
  assert.equal(n, 2);
  desmontar();
  for (const status of [401, 403]) {
    const fallo = diferida(); let restringida;
    const get = () => fallo.promise;
    render(get, 'dia=x', usuario, s => { restringida = s; });
    fallo.reject({ response: { status } }); await tick();
    const estado = render(get, 'dia=x', usuario);
    assert.equal(estado.data, undefined); assert.equal(estado.status, status); assert.equal(restringida, status);
    desmontar();
  }
});
