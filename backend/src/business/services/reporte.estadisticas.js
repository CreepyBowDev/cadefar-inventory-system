import { contarIntervalosEstadisticos } from '../validators/reporte.validator.js';
import { obtenerFechaEtiquetaNormalizada } from '../../shared/utils/vencimiento.js';
import { decimalAEntero, enteroADecimal } from '../../shared/utils/decimal.js';
import { AppError } from '../../shared/errors/app-error.js';
import { materializarResumenVentas, materializarResumenCompras, materializarResumenPerdidas } from './reporte.materializacion.js';

export const comprobarLimiteIntervalos = (periodo, granularidad) => {
    const cantidad = contarIntervalosEstadisticos(periodo, granularidad);
    if (cantidad > 1200) throw new AppError(
        'La consulta supera 1200 intervalos; elija otra granularidad o un período menor', 400);
    return cantidad;
};

export const construirIntervalos = (periodo, granularidad) => {
    const cantidad = comprobarLimiteIntervalos(periodo, granularidad);
    const intervalos = [];
    let fecha = periodo.desde;
    for (let i = 0; i < cantidad; i++) {
        const etiqueta = fecha.slice(0, { DIA: 10, MES: 7, ANIO: 4 }[granularidad]);
        const inicio = granularidad === 'DIA' ? fecha : granularidad === 'MES' ? `${etiqueta}-01` : `${etiqueta}-01-01`;
        const fin = granularidad === 'DIA' ? fecha : granularidad === 'MES'
            ? obtenerFechaEtiquetaNormalizada(inicio, 'MES') : `${etiqueta}-12-31`;
        const desde = inicio < periodo.desde ? periodo.desde : inicio;
        const hasta = fin > periodo.hasta ? periodo.hasta : fin;
        intervalos.push({ etiqueta, desde, hasta, parcial: desde !== inicio || hasta !== fin });
        // No avanzar después del último intervalo, en particular año 9999.
        if (i + 1 < cantidad) {
            const [anio, mes, dia] = fin.split('-').map(Number);
            fecha = new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);
        }
    }
    return intervalos;
};

const categoriasVentas = { CONFIRMADA: 'confirmadas', PENDIENTE: 'pendientes',
    ANULADA_CONFIRMADA: 'anuladasConfirmadas', ANULADA_SIN_CONFIRMAR: 'anuladasSinConfirmar' };
const categoriasCompras = { CONFIRMADA: 'confirmadas', ANULADA: 'anuladas' };
const categoriasPerdidas = { VENCIMIENTO: 'vencimiento', 'DAÑO': 'dano' };
const entero = valor => {
    if (typeof valor !== 'string' || !/^(0|[1-9]\d*)$/.test(valor)) throw new TypeError('Conteo inválido');
    return BigInt(valor);
};

// Agregados raw acotados, no filas operativas. Conciliar antes de cerrar snapshot.
export const materializarEstadisticas = (fuente, filtros, { grupos, temporales }) => {
    const intervalos = construirIntervalos(filtros.periodo, filtros.granularidad);
    const perdidas = fuente === 'PERDIDAS';
    const categorias = perdidas ? categoriasPerdidas : fuente === 'VENTAS' ? categoriasVentas : categoriasCompras;
    const campo = perdidas ? 'motivo' : fuente === 'VENTAS' ? 'categoria' : 'estado_operacion';
    // [métrica, unidad, campo raw, campo del resumen, escala decimal].
    const metricas = perdidas ? [
        ['CANTIDAD_RETIROS', 'RETIROS', 'cantidad_retiros', 'cantidadRetiros', 0],
        ['CANTIDAD_RETIRADA', 'UNIDADES_INVENTARIO_HETEROGENEAS', 'cantidad_retirada', 'cantidadRetirada', 0],
        ['PERDIDA', 'IMPORTE_MONETARIO', 'perdida', 'perdida', 2]
    ] : [['CANTIDAD', 'OPERACIONES', 'cantidad', 'cantidad', 0],
        ['IMPORTE', 'IMPORTE_MONETARIO', 'importe', 'importe', 2]];
    const leer = (g, m) => m[4] === 0 ? entero(g[m[2]]) : decimalAEntero(g[m[2]], 2);
    const validar = g => {
        const valores = metricas.map(m => leer(g, m));
        if (valores.some(v => v < 0n) || (valores[0] === 0n && valores.some(v => v !== 0n))) {
            throw new Error('Agregado inválido');
        }
        if (perdidas && filtros.motivo && g.motivo !== filtros.motivo) throw new Error('Motivo excluido');
        return valores;
    };
    const vistosResumen = new Set();
    for (const g of grupos) {
        if (!Object.hasOwn(categorias, g[campo]) || vistosResumen.has(g[campo])) throw new Error('Categoría inválida');
        vistosResumen.add(g[campo]);
        validar(g);
    }
    const { resumen, total } = (perdidas ? materializarResumenPerdidas :
        fuente === 'VENTAS' ? materializarResumenVentas : materializarResumenCompras)(grupos);
    const indices = new Map(intervalos.map((v, i) => [v.etiqueta, i]));
    const celdas = new Map(Object.keys(categorias).map(c => [c, intervalos.map(() => metricas.map(() => 0n))]));
    const vistos = new Set();
    for (const g of temporales) {
        const categoria = g[campo], indice = indices.get(g.etiqueta), clave = `${categoria}/${g.etiqueta}`;
        if (!celdas.has(categoria) || indice === undefined || vistos.has(clave) ||
            (filtros.estadoOperacion && categoria !== filtros.estadoOperacion &&
                !(filtros.estadoOperacion === 'ANULADA' && categoria.startsWith('ANULADA_')))) {
            throw new Error('Agregado temporal inválido');
        }
        vistos.add(clave);
        celdas.get(categoria)[indice] = validar(g);
    }
    const texto = (v, m) => metricas[m][4] === 0 ? v.toString() : enteroADecimal(v, 2);
    const series = Object.entries(categorias).flatMap(([categoria, nombre]) => metricas.map(([metrica, unidad], m) => {
        const valores = celdas.get(categoria).map(celda => celda[m]);
        const suma = valores.reduce((a, b) => a + b, 0n);
        const valorResumen = resumen[nombre][metricas[m][3]];
        const esperado = metricas[m][4] === 0 ? BigInt(valorResumen) : decimalAEntero(valorResumen, 2);
        if (suma !== esperado) throw new Error('Estadísticas no conciliadas');
        return { categoria, metrica, unidad, valores: valores.map(v => texto(v, m)), total: texto(suma, m) };
    }));
    const distribuciones = metricas.map(([metrica, unidad], m) => {
        const seleccion = series.filter(s => s.metrica === metrica);
        const suma = seleccion.reduce((a, s) => a + (metricas[m][4] === 0 ? BigInt(s.total) : decimalAEntero(s.total, 2)), 0n);
        if (perdidas) {
            const valorResumen = resumen[['cantidadRetiros', 'cantidadRetirada', 'perdidaTotal'][m]];
            const esperado = metricas[m][4] === 0 ? BigInt(valorResumen) : decimalAEntero(valorResumen, 2);
            if (suma !== esperado) throw new Error('Distribución no conciliada');
        }
        return { metrica, unidad, total: texto(suma, m),
            categorias: seleccion.map(s => ({ categoria: s.categoria, valor: s.total })) };
    });
    return { fuente, periodo: filtros.periodo, filtros: perdidas ? { motivo: filtros.motivo ?? null }
        : { estadoOperacion: filtros.estadoOperacion ?? null },
        granularidad: filtros.granularidad, sinDatos: total === 0, resumen, intervalos, series, distribuciones };
};
