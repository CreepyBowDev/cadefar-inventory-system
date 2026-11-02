import { z } from 'zod';
import { esFechaCivilValida } from '../../shared/utils/vencimiento.js';

const idSchema = z.number().int().positive().max(2147483647);
const idParamSchema = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(idSchema);
const texto = maximo => z.string().trim().min(1).max(maximo)
    .refine(valor => !/[\u0000-\u001f\u007f]/.test(valor), 'El texto contiene caracteres de control');

// Formulario sin adjuntos. El campo legado archivo_receta no se recibe del
// cliente; las nuevas recetas lo conservan en NULL.
const createSchema = z.object({
    numeroReceta: texto(80).nullable().optional(),
    fechaReceta: z.string().length(10).refine(esFechaCivilValida, 'Debe indicar una fecha válida YYYY-MM-DD'),
    nombrePaciente: texto(150),
    documentoPaciente: texto(40),
    nombreMedico: texto(150),
    modalidad: texto(50),
    observacion: texto(500).nullable().optional(),
    idsDetallesVenta: z.array(idSchema).min(1)
        .refine(ids => new Set(ids).size === ids.length, 'Los detalles no pueden repetirse').optional()
}).strict();
const revisionSchema = z.object({
    resultadoRevision: z.enum(['APROBADA', 'RECHAZADA']),
    observacion: texto(500).nullable().optional()
}).strict();
const consultaSchema = z.object({
    pagina: idParamSchema.default(1),
    limite: idParamSchema.pipe(z.number().max(100)).default(25)
}).strict();

export class recetaValidator {
    static validateCreate(data) { return createSchema.safeParse(data); }
    static validateRevision(data) { return revisionSchema.safeParse(data); }
    static validateConsulta(data) { return consultaSchema.safeParse(data); }
    static validateRecetaId(data) {
        return z.object({ idVenta: idParamSchema, idReceta: idParamSchema }).strict().safeParse(data);
    }
    static validateVentaId(data) { return z.object({ idVenta: idParamSchema }).strict().safeParse(data); }
    static validateSinFiltros(data) { return z.object({}).strict().safeParse(data); }
}
