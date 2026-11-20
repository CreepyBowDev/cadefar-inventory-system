import { z } from 'zod';
import { esFechaCivilValida, obtenerFechaEtiquetaNormalizada,
    ZONA_HORARIA_COMERCIAL } from '../../shared/utils/vencimiento.js';
import { MOTIVOS_MOVIMIENTO } from '../../shared/constants/motivos-movimiento.js';

const enteroQuery = (maximo) => z.string().regex(/^[1-9]\d*$/)
    .transform(Number).pipe(z.number().int().positive().max(maximo));
const fechaSchema = z.string().length(10)
    .refine(esFechaCivilValida, 'Debe indicar una fecha válida YYYY-MM-DD');
const mesSchema = z.string().regex(/^\d{4}-\d{2}$/)
    .refine(valor => esFechaCivilValida(`${valor}-01`), 'Debe indicar un mes válido YYYY-MM');

const crearFiltrosSchema = (filtros) => z.object({
    dia: fechaSchema.optional(),
    mes: mesSchema.optional(),
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
    pagina: enteroQuery(2147483647).default(1),
    limite: enteroQuery(100).default(25),
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
}).transform(({ dia, mes, desde, hasta, pagina, limite, ...filtros }) => {
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
        pagina,
        limite,
        ...filtros
    };
});

const ventasSchema = crearFiltrosSchema({
    estadoOperacion: z.enum(['CONFIRMADA', 'PENDIENTE', 'ANULADA']).optional()
});
const comprasSchema = crearFiltrosSchema({
    estadoOperacion: z.enum(['CONFIRMADA', 'ANULADA']).optional()
});
const perdidasSchema = crearFiltrosSchema({
    motivo: z.enum([MOTIVOS_MOVIMIENTO.VENCIMIENTO, MOTIVOS_MOVIMIENTO.DANO]).optional()
});

export class reporteValidator {
    static validateVentas(data) { return ventasSchema.safeParse(data); }
    static validateCompras(data) { return comprasSchema.safeParse(data); }
    static validatePerdidas(data) { return perdidasSchema.safeParse(data); }
}
