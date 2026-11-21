// Agregados sintéticos recibidos del servidor. RN91 no se implementa en React.
const diasMes = (a, m) => [31, a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const civil = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const periodoFixture = (params, intervalos1200) => {
  const granularidad = params.get('granularidad') || (intervalos1200 ? 'ANIO' : 'MES');
  const desde = params.get('dia') || (params.has('mes') ? `${params.get('mes')}-01` : params.get('desde')) || (intervalos1200 ? '1000-01-01' : '2026-11-15');
  const hasta = params.get('dia') || (params.has('mes') ? `${params.get('mes')}-${diasMes(...params.get('mes').split('-').map(Number))}` : params.get('hasta')) || (intervalos1200 ? '2199-12-31' : '2026-12-05');
  const intervalos = [];
  let [a, m, d] = desde.split('-').map(Number);
  while (civil(a, m, d) <= hasta) {
    const inicio = granularidad === 'ANIO' ? `${a}-01-01` : granularidad === 'MES' ? civil(a, m, 1) : civil(a, m, d);
    const fin = granularidad === 'ANIO' ? `${a}-12-31` : granularidad === 'MES' ? civil(a, m, diasMes(a, m)) : inicio;
    intervalos.push({ etiqueta: granularidad === 'ANIO' ? String(a) : granularidad === 'MES' ? inicio.slice(0, 7) : inicio, desde: inicio < desde ? desde : inicio, hasta: fin > hasta ? hasta : fin, parcial: inicio < desde || fin > hasta });
    if (granularidad === 'ANIO') { a++; m = 1; d = 1; }
    else if (granularidad === 'MES') { m++; d = 1; if (m > 12) { a++; m = 1; } }
    else { d++; if (d > diasMes(a, m)) { d = 1; m++; if (m > 12) { a++; m = 1; } } }
  }
  return { granularidad, intervalos, periodo: { modalidad: params.has('dia') ? 'DIA' : params.has('mes') ? 'MES' : 'PERIODO', desde, hasta, zonaHoraria: 'America/La_Paz' } };
};

export const estadisticasFuente = (tipo, params = new URLSearchParams(), opciones = {}) => {
  const { cero = false, vacio = false, grande = false } = opciones;
  const base = periodoFixture(params, opciones.intervalos1200);
  const perdidas = tipo === 'perdidas';
  const categorias = perdidas ? ['VENCIMIENTO', 'DAÑO'] : ['CONFIRMADA', 'ANULADA'];
  const metricas = perdidas ? ['CANTIDAD_RETIROS', 'CANTIDAD_RETIRADA', 'PERDIDA'] : ['CANTIDAD', 'IMPORTE'];
  const unidades = perdidas ? ['RETIROS', 'UNIDADES_INVENTARIO_HETEROGENEAS', 'IMPORTE_MONETARIO'] : ['OPERACIONES', 'IMPORTE_MONETARIO'];
  const filtro = params.get(perdidas ? 'motivo' : 'estadoOperacion');
  const series = categorias.flatMap((categoria, i) => metricas.map((metrica, j) => {
    const dinero = unidades[j] === 'IMPORTE_MONETARIO';
    const excluida = vacio || (filtro && filtro !== categoria);
    const total = excluida || (cero && dinero) ? dinero ? '0.00' : '0'
      : perdidas ? j === 0 ? i ? '2' : '1' : j === 1 ? i ? '2' : '900719925474099312345' : i ? '0.02' : grande ? '900719925474099312345.01' : '0.00'
        : dinero ? i ? '0.01' : '900719925474099312345.01' : '1';
    return { categoria, metrica, unidad: unidades[j], valores: base.intervalos.map((_, k) => k === base.intervalos.length - 1 ? total : dinero ? '0.00' : '0'), total };
  }));
  // Aritmética únicamente de fixture para simular distribución ya materializada.
  const distribuciones = metricas.map((metrica, j) => {
    const filas = series.filter(s => s.metrica === metrica);
    const n = filas.reduce((sum, s) => sum + BigInt(s.total.replace('.', '')), 0n);
    return { metrica, unidad: unidades[j], total: unidades[j] === 'IMPORTE_MONETARIO' ? `${n / 100n}.${String(n % 100n).padStart(2, '0')}` : String(n), categorias: filas.map(s => ({ categoria: s.categoria, valor: s.total })) };
  });
  const resumen = Object.fromEntries((perdidas ? ['vencimiento', 'dano'] : ['confirmadas', 'anuladas']).map((key, i) => {
    const filas = series.filter(s => s.categoria === categorias[i]);
    return [key, perdidas ? { cantidadRetiros: Number(filas[0].total), cantidadRetirada: filas[1].total, perdida: filas[2].total } : { cantidad: Number(filas[0].total), importe: filas[1].total }];
  }));
  if (perdidas) Object.assign(resumen, { cantidadRetiros: Number(distribuciones[0].total), cantidadRetirada: distribuciones[1].total, perdidaTotal: distribuciones[2].total });
  else resumen.totalComprasRealizadas = resumen.confirmadas.importe;
  return { data: { ...base, fuente: perdidas ? 'PERDIDAS' : 'COMPRAS', filtros: { [perdidas ? 'motivo' : 'estadoOperacion']: filtro }, sinDatos: distribuciones[0].total === '0', resumen, series, distribuciones } };
};

// Dos retiros redondeados individualmente y un retiro a costo cero. Referencia
// de reversión informativa y null conservados; no se agregan en el frontend.
export const detallePerdidas = [
  { idMovimiento: 31, idExistencia: 41, idMedicamento: 51, codigoExistencia: 'HIST-001', codigoMedicamento: 'HIST1', nombreComercial: 'Producto histórico', idUsuario: 7, motivo: 'VENCIMIENTO', fechaReferencia: '2026-11-15 23:15:00', fechaMovimiento: '2026-11-15 23:15:00', cantidad: 1, costoUnitarioAplicado: '0.000000', perdida: '0.00', idMovimientoReversion: 90 },
  ...[32, 33].map(idMovimiento => ({ idMovimiento, idExistencia: 42, idMedicamento: 52, codigoExistencia: 'HIST-002', codigoMedicamento: 'HIST2', nombreComercial: 'Otro producto histórico', idUsuario: 7, motivo: 'DAÑO', fechaReferencia: '2026-12-05 23:15:00', fechaMovimiento: '2026-12-05 23:15:00', cantidad: 1, costoUnitarioAplicado: '0.005000', perdida: '0.01', idMovimientoReversion: null }))
];
