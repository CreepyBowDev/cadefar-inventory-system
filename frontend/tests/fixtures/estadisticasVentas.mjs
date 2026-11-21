// Datos sintéticos contractuales; nunca se consulta un backend ni una DB.
export const categoriasVentas = ['CONFIRMADA', 'PENDIENTE', 'ANULADA_CONFIRMADA', 'ANULADA_SIN_CONFIRMAR'];
export const estadisticasVentas = (params = new URLSearchParams(), { cero = false, vacio = false, intervalos1200 = false } = {}) => {
  const granularidad = params.get('granularidad') || 'MES';
  const intervalos = intervalos1200 ? Array.from({ length: 1200 }, (_, i) => ({ etiqueta: String(1000 + i), desde: `${1000 + i}-01-01`, hasta: `${1000 + i}-12-31`, parcial: false }))
    : params.has('dia') ? [{ etiqueta: params.get('dia'), desde: params.get('dia'), hasta: params.get('dia'), parcial: false }]
      : [{ etiqueta: '2026-11', desde: '2026-11-15', hasta: '2026-11-30', parcial: true }, { etiqueta: '2026-12', desde: '2026-12-01', hasta: '2026-12-05', parcial: true }];
  const filtro = params.get('estadoOperacion');
  const series = categoriasVentas.flatMap((categoria, i) => {
    const excluida = vacio || (filtro && (filtro === 'ANULADA' ? !categoria.startsWith('ANULADA') : filtro !== categoria));
    return ['CANTIDAD', 'IMPORTE'].map(metrica => {
      const valor = excluida ? (metrica === 'IMPORTE' ? '0.00' : '0') : metrica === 'CANTIDAD' ? '1' : cero ? '0.00' : i === 0 ? '900719925474099312345.01' : i === 1 ? '0.01' : '0.00';
      return { categoria, metrica, unidad: metrica === 'CANTIDAD' ? 'OPERACIONES' : 'IMPORTE_MONETARIO', valores: intervalos.map((_, j) => j === intervalos.length - 1 ? valor : metrica === 'CANTIDAD' ? '0' : '0.00'), total: valor };
    });
  });
  const distribuciones = ['CANTIDAD', 'IMPORTE'].map(metrica => {
    const filas = series.filter(s => s.metrica === metrica);
    const n = filas.reduce((sum, s) => sum + BigInt(s.total.replace('.', '')), 0n);
    const total = metrica === 'IMPORTE' ? `${n / 100n}.${String(n % 100n).padStart(2, '0')}` : String(n);
    return { metrica, unidad: filas[0].unidad, total, categorias: filas.map(s => ({ categoria: s.categoria, valor: s.total })) };
  });
  const resumen = Object.fromEntries(['confirmadas', 'pendientes', 'anuladasConfirmadas', 'anuladasSinConfirmar'].map((key, i) => [key, { cantidad: Number(series[i * 2].total), importe: series[i * 2 + 1].total }]));
  resumen.totalVentasRealizadas = resumen.confirmadas.importe;
  return { data: { fuente: 'VENTAS', periodo: { modalidad: params.has('dia') ? 'DIA' : 'PERIODO', desde: intervalos[0].desde, hasta: intervalos.at(-1).hasta, zonaHoraria: 'America/La_Paz' }, filtros: { estadoOperacion: filtro }, granularidad, sinDatos: vacio, resumen, intervalos, series, distribuciones } };
};
