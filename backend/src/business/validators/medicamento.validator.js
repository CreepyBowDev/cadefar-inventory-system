import { z } from 'zod';

const idSchema = z.number().int().positive().max(2147483647);
const texto = (maximo) => z.string().trim().min(1).max(maximo);

const paramsSchema = z.object({
    idMedicamento: z.coerce.number().int().positive().max(2147483647)
}).strict();

const datosSchema = z.object({
    idProveedorLaboratorio: idSchema,
    codigoMedicamento: texto(20),
    nombreComercial: texto(150),
    formaFarmaceutica: texto(80),
    presentacion: texto(150),
    unidadInventario: texto(50),
    stockMinimo: z.number().int().nonnegative().max(2147483647),
    condicionVenta: texto(40),
    viaAdministracion: texto(80),
    tipoLiberacion: texto(80)
});

const createSchema = datosSchema.extend({
    stockMinimo: datosSchema.shape.stockMinimo.optional(),
    estado: z.boolean().optional()
}).strict();

const updateSchema = datosSchema.partial().strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe enviar al menos un dato para modificar' }
);

const updateEstadoSchema = z.object({ estado: z.boolean() }).strict();

const idFiltroSchema = z.coerce.number().int().positive().max(2147483647);
const filtrosSchema = z.object({
    codigoMedicamento: texto(20).optional(),
    nombreComercial: texto(150).optional(),
    idPrincipioActivo: z.union([
        idFiltroSchema,
        z.array(idFiltroSchema).min(1)
    ]).transform((valor) => [...new Set(Array.isArray(valor) ? valor : [valor])]).optional()
}).strict();

export class medicamentoValidator {
    static validateId(data) { return paramsSchema.safeParse(data); }
    static validateCreate(data) { return createSchema.safeParse(data); }
    static validateUpdate(data) { return updateSchema.safeParse(data); }
    static validateUpdateEstado(data) { return updateEstadoSchema.safeParse(data); }
    static validateFiltros(data) { return filtrosSchema.safeParse(data); }
}
