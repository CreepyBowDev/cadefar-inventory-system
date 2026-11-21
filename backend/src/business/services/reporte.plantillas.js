import { materializarVenta, materializarCompra, materializarPerdida,
    materializarResumenVentas, materializarResumenCompras, materializarResumenPerdidas } from './reporte.materializacion.js';
import { decimalAEntero, enteroADecimal } from '../../shared/utils/decimal.js';

export const COLUMNAS_REPORTE = Object.freeze({
    VENTAS: 'idVenta estadoOperacion categoria fechaReferencia fechaRegistro fechaVenta fechaAnulacion total'.split(' '),
    COMPRAS: 'idCompra idProveedorLaboratorio estadoOperacion fechaReferencia fechaCompra fechaRegistro fechaAnulacion total'.split(' '),
    PERDIDAS: 'idMovimiento idExistencia idMedicamento codigoExistencia codigoMedicamento nombreComercial idUsuario motivo fechaReferencia fechaMovimiento cantidad costoUnitarioAplicado perdida idMovimientoReversion'.split(' '),
    MOVIMIENTOS: 'idMovimiento idExistencia idMedicamento codigoExistencia codigoMedicamento nombreComercial idUsuario nombreUsuario fechaMovimiento direccion motivo cantidad costoUnitarioAplicado idDetalleCompra idCompra idDetalleVenta idVenta idMovimientoOriginal idMovimientoReversion'.split(' '),
    ESTADISTICA: 'intervalo desde hasta parcial categoria metrica unidad valor'.split(' ')
});
const materializadores = { VENTAS: materializarVenta, COMPRAS: materializarCompra, PERDIDAS: materializarPerdida };
const resumenes = { VENTAS: materializarResumenVentas, COMPRAS: materializarResumenCompras, PERDIDAS: materializarResumenPerdidas };
export const proyectarFila = (fuente, row) => {
    if (fuente !== 'MOVIMIENTOS') return materializadores[fuente](row);
    return { idMovimiento: row.id_movimiento, idExistencia: row.id_existencia, idMedicamento: row.id_medicamento,
        codigoExistencia: row.codigo_existencia, codigoMedicamento: row.codigo_medicamento,
        nombreComercial: row.nombre_comercial, idUsuario: row.id_usuario, nombreUsuario: row.nombre_usuario ?? null,
        fechaMovimiento: row.fecha_movimiento, direccion: row.direccion, motivo: row.motivo,
        cantidad: BigInt(row.cantidad).toString(), costoUnitarioAplicado: enteroADecimal(decimalAEntero(row.costo_unitario_aplicado, 6), 6),
        idDetalleCompra: row.id_detalle_compra ?? null, idCompra: row.id_compra ?? null,
        idDetalleVenta: row.id_detalle_venta ?? null, idVenta: row.id_venta ?? null,
        idMovimientoOriginal: row.id_movimiento_original ?? null, idMovimientoReversion: row.id_movimiento_reversion ?? null };
};
export function* filasEstadisticas(data) {
    for (const [i, intervalo] of data.intervalos.entries()) {
        for (const serie of data.series) yield { intervalo: intervalo.etiqueta, desde: intervalo.desde,
            hasta: intervalo.hasta, parcial: intervalo.parcial, categoria: serie.categoria,
            metrica: serie.metrica, unidad: serie.unidad, valor: serie.valores[i] };
    }
}

// Acumuladores de tamaño constante. Comparar todas las categorías, no solo total global.
export const crearConciliacion = (fuente, grupos) => {
    const esperado = fuente === 'MOVIMIENTOS' ? { total: BigInt(grupos[0]?.cantidad ?? '0') }
        : resumenes[fuente](grupos);
    const acumulados = new Map();
    let total = 0n;
    return {
        total: BigInt(esperado.total), resumen: esperado.resumen ?? null,
        agregar(fila) {
            total++;
            if (fuente === 'MOVIMIENTOS') return;
            const categoria = fuente === 'VENTAS' ? fila.categoria : fuente === 'COMPRAS' ? fila.estadoOperacion : fila.motivo;
            const permitidas = fuente === 'VENTAS' ? ['CONFIRMADA', 'PENDIENTE', 'ANULADA_CONFIRMADA', 'ANULADA_SIN_CONFIRMAR']
                : fuente === 'COMPRAS' ? ['CONFIRMADA', 'ANULADA'] : ['VENCIMIENTO', 'DAÑO'];
            if (!permitidas.includes(categoria)) throw new Error('Categoría inconsistente');
            const g = acumulados.get(categoria) ?? { cantidad: 0n, importe: 0n, retirada: 0n };
            g.cantidad++;
            g.importe += decimalAEntero(fuente === 'PERDIDAS' ? fila.perdida : fila.total, 2);
            if (fuente === 'PERDIDAS') g.retirada += BigInt(fila.cantidad);
            acumulados.set(categoria, g);
        },
        comprobar() {
            if (total !== BigInt(esperado.total)) throw new Error('Conteo inconsistente');
            if (fuente === 'MOVIMIENTOS') return;
            const gruposLeidos = [...acumulados].map(([categoria, g]) => fuente === 'PERDIDAS'
                ? { motivo: categoria, cantidad_retiros: g.cantidad.toString(), cantidad_retirada: g.retirada.toString(), perdida: enteroADecimal(g.importe, 2) }
                : { categoria, estado_operacion: categoria, cantidad: g.cantidad.toString(), importe: enteroADecimal(g.importe, 2) });
            if (JSON.stringify(resumenes[fuente](gruposLeidos)) !== JSON.stringify(esperado)) throw new Error('Resumen inconsistente');
        }
    };
};
