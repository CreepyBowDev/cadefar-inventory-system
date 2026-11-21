import { z } from 'zod';
import { esFechaCivilValida, obtenerFechaEtiquetaNormalizada,
    ZONA_HORARIA_COMERCIAL } from '../../shared/utils/vencimiento.js';
import { MOTIVOS_MOVIMIENTO } from '../../shared/constants/motivos-movimiento.js';
import { filtrosMovimientosSchema } from './inventario.validator.js';

const enteroQuery = (maximo) => z.string().regex(/^[1-9]\d*$/)
    .transform(Number).pipe(z.number().int().positive().max(maximo));
const fechaSchema = z.string().length(10)
    .refine(esFechaCivilValida, 'Debe indicar una fecha válida YYYY-MM-DD');
const mesSchema = z.string().regex(/^\d{4}-\d{2}$/)
    .refine(valor => esFechaCivilValida(`${valor}-01`), 'Debe indicar un mes válido YYYY-MM');

const paginacion = {
    pagina: enteroQuery(2147483647).default(1),
    limite: enteroQuery(100).default(25)
};
const crearFiltrosSchema = (filtros, adicionales = paginacion) => z.object({
    dia: fechaSchema.optional(),
    mes: mesSchema.optional(),
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
    ...adicionales,
    ...filtros
}).strict().superRefine((data, contexto) => {
    const modalidades = Number(data.dia !== undefined) + Number(data.mes !== undefined) +
        Number(data.desde !== undefined || data.hasta !== undefined);
    if (modalidades !== 1) {
        contexto.addIssue({ code: 'custom', message: 'Debe indicar solo dia, mes o desde y hasta', path: ['dia'] });
    }
    if ((data.desde === undefined) !== (data.hasta === undefined)) {
        contexto.addIssue({ code: 'custom', message: 'Debe indicar desde y hasta juntos',
            path: [data.desde === undefined ? 'desde' : 'hasta'] });
    }
    if (data.desde !== undefined && data.hasta !== undefined && data.desde > data.hasta) {
        contexto.addIssue({ code: 'custom', message: 'La fecha desde no puede ser posterior a hasta', path: ['hasta'] });
    }
}).transform(({ dia, mes, desde, hasta, ...filtros }) => {
    const modalidad = dia !== undefined ? 'DIA' : mes !== undefined ? 'MES' : 'PERIODO';
    if (dia !== undefined) {
        desde = dia;
        hasta = dia;
    } else if (mes !== undefined) {
        desde = `${mes}-01`;
        hasta = obtenerFechaEtiquetaNormalizada(desde, 'MES');
    }
    return {
        periodo: { modalidad, desde, hasta, zonaHoraria: ZONA_HORARIA_COMERCIAL },
        // Literales civiles inclusivos para DATETIME; no convertir a instantes UTC
        // ni calcular el día siguiente (9999-12-31 también es válido).
        desdeFechaHora: `${desde} 00:00:00`,
        hastaFechaHora: `${hasta} 23:59:59.999999`,
        ...filtros
    };
});

const filtrosVentas = {
    estadoOperacion: z.enum(['CONFIRMADA', 'PENDIENTE', 'ANULADA']).optional()
};
const filtrosCompras = {
    estadoOperacion: z.enum(['CONFIRMADA', 'ANULADA']).optional()
};
const filtrosPerdidas = {
    motivo: z.enum([MOTIVOS_MOVIMIENTO.VENCIMIENTO, MOTIVOS_MOVIMIENTO.DANO]).optional()
};
const ventasSchema = crearFiltrosSchema(filtrosVentas);
const comprasSchema = crearFiltrosSchema(filtrosCompras);
const perdidasSchema = crearFiltrosSchema(filtrosPerdidas);

const granularidadSchema = z.enum(['DIA', 'MES', 'ANIO']);
const formatoSchema = z.enum(['PDF', 'XLSX', 'CSV']);

// Solo cuenta intervalos intersectados: no construye series/listas ni avanza
// al día siguiente de 9999-12-31. UTC aquí es aritmética del calendario civil.
export const contarIntervalosEstadisticos = ({ desde, hasta }, granularidad) => {
    if (!esFechaCivilValida(desde) || !esFechaCivilValida(hasta) || desde > hasta ||
        !['DIA', 'MES', 'ANIO'].includes(granularidad)) throw new RangeError('Período o granularidad inválidos');
    const [anioDesde, mesDesde, diaDesde] = desde.split('-').map(Number);
    const [anioHasta, mesHasta, diaHasta] = hasta.split('-').map(Number);
    if (granularidad === 'ANIO') return anioHasta - anioDesde + 1;
    if (granularidad === 'MES') return (anioHasta - anioDesde) * 12 + mesHasta - mesDesde + 1;
    return (Date.UTC(anioHasta, mesHasta - 1, diaHasta) -
        Date.UTC(anioDesde, mesDesde - 1, diaDesde)) / 86400000 + 1;
};

const validarIntervalos = (data, contexto) => {
    if (contarIntervalosEstadisticos(data.periodo, data.granularidad) > 1200) {
        contexto.addIssue({ code: 'custom', path: ['granularidad'],
            message: 'La consulta supera 1200 intervalos; elija otra granularidad o un período menor',
            params: { limiteIntervalos: true } });
    }
};
const crearEstadisticasSchema = filtros => crearFiltrosSchema(filtros, {
    granularidad: granularidadSchema
}).superRefine(validarIntervalos);

const crearExportacionSchema = (filtros, metricas) => z.union([
    crearFiltrosSchema(filtros, { formato: formatoSchema, presentacion: z.literal('TABULAR') }),
    crearFiltrosSchema(filtros, { formato: z.literal('CSV'), presentacion: z.literal('ESTADISTICA'),
        granularidad: granularidadSchema }).superRefine(validarIntervalos),
    crearFiltrosSchema(filtros, { formato: z.enum(['PDF', 'XLSX']), presentacion: z.literal('ESTADISTICA'),
        granularidad: granularidadSchema, grafico: z.enum(['BARRAS', 'LINEAS', 'SECTORES']),
        metrica: z.enum(metricas) }).superRefine(validarIntervalos)
]);

const estadisticasVentasSchema = crearEstadisticasSchema(filtrosVentas);
const estadisticasComprasSchema = crearEstadisticasSchema(filtrosCompras);
const estadisticasPerdidasSchema = crearEstadisticasSchema(filtrosPerdidas);
const exportacionVentasSchema = crearExportacionSchema(filtrosVentas, ['CANTIDAD', 'IMPORTE']);
const exportacionComprasSchema = crearExportacionSchema(filtrosCompras, ['CANTIDAD', 'IMPORTE']);
const exportacionPerdidasSchema = crearExportacionSchema(filtrosPerdidas, ['CANTIDAD_RETIROS', 'PERDIDA']);
// Reutiliza exactamente los filtros/refinamiento CU40, sin imponer modalidades.
const exportacionMovimientosSchema = filtrosMovimientosSchema.safeExtend({
    formato: formatoSchema, presentacion: z.literal('TABULAR')
});

export class reporteValidator {
    static validateVentas(data) { return ventasSchema.safeParse(data); }
    static validateCompras(data) { return comprasSchema.safeParse(data); }
    static validatePerdidas(data) { return perdidasSchema.safeParse(data); }
    static validateEstadisticasVentas(data) { return estadisticasVentasSchema.safeParse(data); }
    static validateEstadisticasCompras(data) { return estadisticasComprasSchema.safeParse(data); }
    static validateEstadisticasPerdidas(data) { return estadisticasPerdidasSchema.safeParse(data); }
    static validateExportacionVentas(data) { return exportacionVentasSchema.safeParse(data); }
    static validateExportacionCompras(data) { return exportacionComprasSchema.safeParse(data); }
    static validateExportacionPerdidas(data) { return exportacionPerdidasSchema.safeParse(data); }
    static validateExportacionMovimientos(data) { return exportacionMovimientosSchema.safeParse(data); }
}
