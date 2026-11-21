// Etiquetas de documentos: no transforman la proyección ni los valores exportados.
export const TITULOS_REPORTE = Object.freeze({ VENTAS: 'Reporte de ventas', COMPRAS: 'Reporte de compras',
    PERDIDAS: 'Reporte de pérdidas brutas', MOVIMIENTOS: 'Historial de movimientos de inventario' });
const etiquetas = {
    idVenta: 'ID de venta', idCompra: 'ID de compra', idMovimiento: 'ID de movimiento',
    idExistencia: 'ID de existencia', idMedicamento: 'ID de medicamento', idUsuario: 'ID de usuario responsable',
    idProveedorLaboratorio: 'ID de proveedor / laboratorio', estadoOperacion: 'Estado de la operación', categoria: 'Categoría',
    fechaReferencia: 'Fecha utilizada para seleccionar el período', fechaRegistro: 'Fecha de registro',
    fechaVenta: 'Fecha de confirmación de venta', fechaCompra: 'Fecha de adquisición', fechaAnulacion: 'Fecha de anulación',
    total: 'Importe histórico de la operación', codigoExistencia: 'Código de existencia', codigoMedicamento: 'Código de medicamento',
    nombreComercial: 'Nombre comercial', nombreUsuario: 'Nombre de usuario responsable', motivo: 'Motivo', direccion: 'Entrada o salida',
    fechaMovimiento: 'Fecha del movimiento', cantidad: 'Cantidad de operaciones', costoUnitarioAplicado: 'Costo unitario histórico (6 decimales)',
    perdida: 'Pérdida bruta (2 decimales)', idDetalleCompra: 'ID de detalle de compra', idDetalleVenta: 'ID de detalle de venta',
    idMovimientoOriginal: 'ID del movimiento original', idMovimientoReversion: 'ID del movimiento de reversión',
    intervalo: 'Intervalo temporal', desde: 'Desde (inclusive)', hasta: 'Hasta (inclusive)', parcial: 'Intervalo parcial (true / false)',
    metrica: 'Métrica', unidad: 'Unidad de medida', valor: 'Valor exacto', importe: 'Importe histórico (2 decimales)',
    confirmadas: 'Confirmadas', pendientes: 'Pendientes', anuladas: 'Anuladas', anuladasConfirmadas: 'Anuladas después de confirmar',
    anuladasSinConfirmar: 'Anuladas sin confirmar', vencimiento: 'Por vencimiento', dano: 'Por daño',
    cantidadRetiros: 'Número de retiros', cantidadRetirada: 'Unidades retiradas (productos distintos)',
    perdidaTotal: 'Pérdida bruta total', totalVentasRealizadas: 'Total de ventas realizadas (solo confirmadas)',
    totalComprasRealizadas: 'Total de compras realizadas (solo confirmadas)',
    CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente', ANULADA: 'Anulada', ANULADA_CONFIRMADA: 'Anulada después de confirmar',
    ANULADA_SIN_CONFIRMAR: 'Anulada sin confirmar', VENCIMIENTO: 'Vencimiento', DAÑO: 'Daño',
    ENTRADA: 'Entrada', SALIDA: 'Salida', DIA: 'Día', MES: 'Mes', ANIO: 'Año', PERIODO: 'Período cerrado',
    BARRAS: 'Barras', LINEAS: 'Líneas', SECTORES: 'Sectores', CANTIDAD: 'Número de operaciones', IMPORTE: 'Importe histórico',
    CANTIDAD_RETIROS: 'Número de retiros', CANTIDAD_RETIRADA: 'Unidades retiradas', PERDIDA: 'Pérdida bruta',
    OPERACIONES: 'Operaciones', RETIROS: 'Retiros', IMPORTE_MONETARIO: 'Importe monetario (sin moneda especificada)',
    UNIDADES_INVENTARIO_HETEROGENEAS: 'Unidades de productos distintos; sin equivalencia farmacéutica'
};
export const etiquetaReporte = (clave, fuente) => clave === 'cantidad' && ['PERDIDAS', 'MOVIMIENTOS'].includes(fuente)
    ? 'Unidades de inventario' : Object.hasOwn(etiquetas, clave) ? etiquetas[clave] : clave;
export const explicarCodigo = valor => Object.hasOwn(etiquetas, valor) ? `${etiquetas[valor]} (${valor})` : String(valor);
export const etiquetaRuta = ruta => ruta.split('.').filter(c => !['resumen', 'distribuciones', 'categorias'].includes(c))
    .map(c => etiquetaReporte(c)).join(' / ');
export const alcanceGrafica = (metadata, filtros, panel) => filtros.grafico === 'SECTORES'
    ? `Período completo: ${filtros.periodo.desde} a ${filtros.periodo.hasta}; todas las categorías.`
    : `Intervalos ${panel * 60 + 1} a ${Math.min((panel + 1) * 60, metadata.intervalos.length)} de ${metadata.intervalos.length}; todas las categorías.`;
export const notasFuente = fuente => fuente === 'VENTAS'
    ? ['Ventas realizadas: solo confirmadas. Los demás importes son informativos, no ingresos adicionales.',
        'Fecha de referencia: confirmación para confirmadas/anuladas confirmadas; registro para las demás.']
    : fuente === 'COMPRAS' ? ['Compras realizadas: solo confirmadas. Anuladas: importe informativo, sin descontarlo de nuevo.',
        'Fecha de referencia: adquisición, no registro ni anulación.']
        : fuente === 'PERDIDAS' ? ['Pérdidas brutas: retiros originales; reversiones no descontadas.',
            'Costo histórico con 6 decimales; pérdida redondeada por movimiento a 2 decimales antes de sumar.',
            'Unidades de productos distintos: no representan equivalencia farmacéutica.'] : [];

export const leyendaCodigos = fuente => (fuente === 'VENTAS'
    ? ['CONFIRMADA', 'PENDIENTE', 'ANULADA_CONFIRMADA', 'ANULADA_SIN_CONFIRMAR']
    : fuente === 'COMPRAS' ? ['CONFIRMADA', 'ANULADA']
        : fuente === 'PERDIDAS' ? ['VENCIMIENTO', 'DAÑO'] : ['ENTRADA', 'SALIDA']).map(explicarCodigo).join('; ');

export const ESTILO_CABECERA_XLSX = { numFmt: '@', font: { name: 'Noto Sans', bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126782' } },
    alignment: { vertical: 'top', wrapText: true } };
// Altura limitada por Excel; el valor íntegro siempre permanece en la celda.
export const alturaFilaXlsx = (hoja, valores) => Math.min(409, 16 * Math.max(1, ...valores.map((v, i) => {
    const ancho = Math.max(8, (hoja.getColumn(i + 1).width ?? 24) - 3);
    return String(v ?? '').split(/\r\n|\r|\n/u).reduce((n, s) => n + Math.max(1, Math.ceil(Array.from(s).length / ancho)), 0);
})));
