import { useId, useState } from 'react';
import { escalaSeries, magnitudExacta, panelesIntervalos, proporcionVisual } from '../utils/escalaEstadistica.js';

const etiquetas = { CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente', ANULADA: 'Anulada', ANULADA_CONFIRMADA: 'Anulada confirmada', ANULADA_SIN_CONFIRMAR: 'Anulada sin confirmar', VENCIMIENTO: 'Vencimiento', 'DAÑO': 'Daño' };
const metricasOperaciones = [['CANTIDAD', 'Cantidad de operaciones'], ['IMPORTE', 'Importe informativo']];
const fuentes = {
  VENTAS: { nombre: 'ventas', metricas: metricasOperaciones },
  COMPRAS: { nombre: 'compras', metricas: metricasOperaciones },
  PERDIDAS: { nombre: 'pérdidas', metricas: [['CANTIDAD_RETIROS', 'Cantidad de retiros'], ['PERDIDA', 'Pérdida bruta histórica']] }
};
const nombre = categoria => etiquetas[categoria] || categoria;
const rango = intervalo => `${intervalo.etiqueta}: ${intervalo.desde} al ${intervalo.hasta}${intervalo.parcial ? ' (intervalo parcial)' : ''}`;

export const ReporteEstadisticas = ({ data, seleccion, onSeleccion }) => {
  const id = useId();
  const fuente = fuentes[data.fuente];
  // Decisión UX local explícita: barras/cantidad iniciales; nunca parámetros HTTP.
  const [seleccionLocal, setSeleccionLocal] = useState({ grafico: 'BARRAS', metrica: fuente.metricas[0][0] });
  const { grafico, metrica } = seleccion || seleccionLocal;
  const cambiarSeleccion = cambio => (onSeleccion || setSeleccionLocal)({ grafico, metrica, ...cambio });
  const [ocultas, setOcultas] = useState([]);
  const [panel, setPanel] = useState(0);
  const [explorado, setExplorado] = useState('Selecciona un punto o una categoría para consultar su valor exacto.');
  const paneles = panelesIntervalos(data.intervalos);
  const actual = paneles[panel] || paneles[0];
  const series = data.series.filter(s => s.metrica === metrica);
  const escala = escalaSeries(series);
  const distribucion = data.distribuciones.find(d => d.metrica === metrica);
  const total = magnitudExacta(distribucion.total);
  const etiquetaMetrica = fuente.metricas.find(([valor]) => valor === metrica)[1];
  const ancho = Math.max(600, actual.intervalos.length * 96 + 64);
  const punto = (texto, contenido, key) => <g key={key} role="button" tabIndex={0} aria-label={texto} onFocus={() => setExplorado(texto)} onClick={() => setExplorado(texto)} onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); setExplorado(texto); } }}><title>{texto}</title>{contenido}</g>;
  let acumulado = 0n;
  return <section className="reporte-estadisticas" aria-label={`Estadísticas de ${fuente.nombre}`}>
    <h3>Gráfica y valores exactos</h3>
    <div className="reporte-exportacion__acciones reporte-estadisticas__seleccion">
      <div className="form-field"><label htmlFor={`${id}-grafico`}>Gráfica</label><select id={`${id}-grafico`} value={grafico} onChange={e => cambiarSeleccion({ grafico: e.target.value })}>{[['BARRAS', 'Barras'], ['LINEAS', 'Líneas'], ['SECTORES', 'Sectores']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
      <div className="form-field"><label htmlFor={`${id}-metrica`}>Métrica</label><select id={`${id}-metrica`} value={metrica} onChange={e => cambiarSeleccion({ metrica: e.target.value })}>{fuente.metricas.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></div>
    </div>
    <fieldset className="reporte-estadisticas__leyenda"><legend>Categorías visibles en la gráfica</legend>{distribucion.categorias.map(({ categoria }, i) => <label key={categoria}><input type="checkbox" checked={!ocultas.includes(categoria)} onChange={() => setOcultas(prev => prev.includes(categoria) ? prev.filter(c => c !== categoria) : [...prev, categoria])} /><svg className="reporte-estadisticas__muestra" viewBox="0 0 32 16" aria-hidden="true"><g className={`reporte-estadisticas__serie reporte-estadisticas__serie--${i}`}>{grafico === 'LINEAS' ? <line x1="1" y1="8" x2="31" y2="8" strokeDasharray={['', '8 4', '3 3', '10 3 2 3'][i]} /> : <rect x="2" y="3" width="28" height="10" />}</g></svg><span>{i + 1}. {nombre(categoria)}</span></label>)}</fieldset>
    <p>Ocultar categorías no cambia los totales del servidor ni la tabla. Total informativo del período ({etiquetaMetrica.toLowerCase()}): <strong>{distribucion.total}</strong>. {metrica === 'IMPORTE' && `No equivale al total de ${fuente.nombre} realizadas, que incluye solo confirmadas.`}</p>
    {data.fuente === 'PERDIDAS' && <p>Pérdidas brutas por costo histórico del servidor, sin descontar reversiones. CANTIDAD_RETIRADA permanece en la tabla exacta: son unidades de inventario heterogéneas, sin equivalencia farmacéutica común ni representación gráfica.</p>}
    {ocultas.length === distribucion.categorias.length && <p role="status">Todas las categorías están ocultas en la gráfica. Activa una categoría o consulta la tabla exacta.</p>}
    <p id={`${id}-precision`} className="reporte-estadisticas__precision">La geometría de la gráfica es aproximada. Valores positivos muy pequeños pueden quedar bajo resolución visual; consúltalos con teclado, toque o en la tabla exacta. Sin porcentajes ni moneda asumida.</p>
    <div className="form-field"><label htmlFor={`${id}-panel`}>Panel de intervalos (gráfica temporal y tabla)</label><select id={`${id}-panel`} value={paneles.indexOf(actual)} onChange={e => { setPanel(Number(e.target.value)); setExplorado('Panel cambiado. Selecciona un punto para explorar.'); }}>{paneles.map((p, i) => <option key={p.inicio} value={i}>{i + 1} de {paneles.length}: {p.intervalos[0].etiqueta} al {p.intervalos.at(-1).etiqueta}</option>)}</select></div>
    <p className="reporte-estadisticas__alcance">Panel {paneles.indexOf(actual) + 1} de {paneles.length}; intervalos {actual.inicio + 1}–{actual.inicio + actual.intervalos.length} de {data.intervalos.length}. No es el total del período. <strong>{grafico === 'SECTORES' ? 'Sectores representa el período completo; el panel seleccionado solo cambia la tabla exacta.' : 'Barras y Líneas muestran el panel seleccionado. Sectores representa el período completo.'}</strong></p>
    {data.sinDatos ? <p role="status">Sin operaciones</p> : (grafico === 'SECTORES' ? total === 0n : escala === 0n) ? <p role="status">Sin valor para graficar</p> : <div className="reporte-estadisticas__viewport" role="region" tabIndex={0} aria-label="Gráfica desplazable; todos los puntos del panel" aria-describedby={`${id}-precision`}>
      <svg width={grafico === 'SECTORES' ? undefined : ancho} viewBox={`0 0 ${grafico === 'SECTORES' ? 420 : ancho} 340`} className={grafico === 'SECTORES' ? 'reporte-estadisticas__sectores' : undefined} role="group" aria-label={`${grafico === 'BARRAS' ? 'Barras' : grafico === 'LINEAS' ? 'Líneas' : 'Sectores'} de ${etiquetaMetrica.toLowerCase()}`}>
        {grafico === 'SECTORES' ? distribucion.categorias.map(({ categoria, valor }, i) => {
          const inicio = proporcionVisual(acumulado.toString(), total) * Math.PI * 2;
          acumulado += magnitudExacta(valor);
          const fin = proporcionVisual(acumulado.toString(), total) * Math.PI * 2;
          if (ocultas.includes(categoria) || magnitudExacta(valor) === 0n) return null;
          const x = angle => 210 + 130 * Math.sin(angle), y = angle => 160 - 130 * Math.cos(angle);
          const texto = `${i + 1}. ${nombre(categoria)}: ${valor}; ${distribucion.unidad}; período ${data.periodo.desde} al ${data.periodo.hasta}`;
          return punto(texto, <g className={`reporte-estadisticas__serie reporte-estadisticas__serie--${i}`}>{magnitudExacta(valor) === total ? <circle cx="210" cy="160" r="130" /> : <path d={`M210,160 L${x(inicio)},${y(inicio)} A130,130 0 ${fin - inicio > Math.PI ? 1 : 0},1 ${x(fin)},${y(fin)} Z`} />}<text x={x((inicio + fin) / 2) * .7 + 63} y={y((inicio + fin) / 2) * .7 + 48}>{i + 1}</text></g>, categoria);
        }) : series.map((serie, i) => {
          if (ocultas.includes(serie.categoria)) return null;
          const puntos = actual.intervalos.map((intervalo, j) => ({ x: 48 + j * 96 + i * 16, y: 260 - proporcionVisual(serie.valores[actual.inicio + j], escala) * 220 }));
          return <g key={serie.categoria} className={`reporte-estadisticas__serie reporte-estadisticas__serie--${i}`}>
            {grafico === 'LINEAS' && <polyline points={puntos.map(p => `${p.x},${p.y}`).join(' ')} fill="none" strokeDasharray={['', '8 4', '3 3', '10 3 2 3'][i]} />}
            {puntos.map((p, j) => punto(`${rango(actual.intervalos[j])}; ${i + 1}. ${nombre(serie.categoria)}; ${serie.metrica}: ${serie.valores[actual.inicio + j]}; ${serie.unidad}`, <>
              <rect x={p.x - 7} y="25" width="15" height="245" fill="transparent" stroke="none" />
              {grafico === 'BARRAS' ? <rect x={p.x - 6} y={p.y} width="12" height={260 - p.y} /> : <circle cx={p.x} cy={p.y} r="5" />}
              <text x={p.x} y="285">{i + 1}</text>
            </>, j))}
          </g>;
        })}
        {grafico !== 'SECTORES' && actual.intervalos.map((intervalo, j) => <text key={j} x={48 + j * 96} y="315" className="reporte-estadisticas__eje">{intervalo.etiqueta}{intervalo.parcial ? '*' : ''}</text>)}
      </svg>
    </div>}
    <p role="status" aria-live="polite" className="reporte-estadisticas__valor"><strong>Valor explorado: </strong>{explorado}</p>
    <details className="reporte-estadisticas__exactos">
    <summary>Distribución exacta del período completo<span>Todas las métricas y categorías, incluidas las ocultas y los ceros.</span></summary>
    <div className="catalogo-table-wrap" role="region" tabIndex={0} aria-label="Distribuciones exactas"><table className="catalogo-table"><caption>Todas las categorías y métricas, incluidas las ocultas</caption><thead><tr>{['Categoría', 'Métrica', 'Unidad', 'Valor', 'Total informativo'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{data.distribuciones.flatMap(d => d.categorias.map(c => <tr key={`${d.metrica}-${c.categoria}`}><th scope="row">{nombre(c.categoria)}</th><td>{d.metrica}</td><td>{d.unidad}</td><td>{c.valor}</td><td>{d.total}</td></tr>))}</tbody></table></div>
    </details>
    <details className="reporte-estadisticas__exactos">
    <summary>Tabla exacta del panel {paneles.indexOf(actual) + 1} de {paneles.length}<span>Todos los intervalos del panel, métricas, categorías ocultas y ceros.</span></summary>
    <div className="catalogo-table-wrap" role="region" tabIndex={0} aria-label="Valores exactos de todos los intervalos del panel"><table className="catalogo-table"><caption>Panel {paneles.indexOf(actual) + 1}: todas las series, sin ocultar ceros ni categorías</caption><thead><tr>{['Intervalo', 'Desde', 'Hasta', 'Parcial', 'Categoría', 'Métrica', 'Unidad', 'Valor exacto', 'Total serie del período'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{actual.intervalos.flatMap((intervalo, j) => data.series.map(serie => <tr key={`${j}-${serie.categoria}-${serie.metrica}`}><th scope="row">{intervalo.etiqueta}</th><td>{intervalo.desde}</td><td>{intervalo.hasta}</td><td>{intervalo.parcial ? 'Sí' : 'No'}</td><td>{nombre(serie.categoria)}</td><td>{serie.metrica}</td><td>{serie.unidad}</td><td>{serie.valores[actual.inicio + j]}</td><td>{serie.total}</td></tr>))}</tbody></table></div>
    </details>
    <details className="reporte-estadisticas__ayuda"><summary>Precisión de la representación</summary><p>Escala relativa aproximada a millonésimas, solo para geometría. Los valores exactos del servidor se conservan en las tablas.</p></details>
  </section>;
};
