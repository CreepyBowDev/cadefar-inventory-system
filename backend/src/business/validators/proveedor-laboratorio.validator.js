import { z } from 'zod';

const idProveedorLaboratorioSchema = z.object({
    idProveedorLaboratorio: z.coerce.number().int().positive()
}).strict();

const nombreSchema = z.string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(150, 'El nombre no puede superar los 150 caracteres');

const textoOpcional = (maximo, campo) => z.string()
    .trim()
    .max(maximo, `El ${campo} no puede superar los ${maximo} caracteres`)
    .transform((valor) => valor || null)
    .nullable()
    .optional();

const datosSchema = z.object({
    nombre: nombreSchema,
    telefono: textoOpcional(30, 'teléfono'),
    direccion: textoOpcional(255, 'dirección')
});

const createSchema = datosSchema.extend({
    estado: z.boolean().optional()
}).strict();

const updateSchema = datosSchema.partial().strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe enviar al menos un dato para modificar' }
);

const updateEstadoSchema = z.object({
    estado: z.boolean()
}).strict();

export class proveedorLaboratorioValidator {
    static validateId(data) {
        return idProveedorLaboratorioSchema.safeParse(data);
    }

    static validateCreate(data) {
        return createSchema.safeParse(data);
    }

    static validateUpdate(data) {
        return updateSchema.safeParse(data);
    }

    static validateUpdateEstado(data) {
        return updateEstadoSchema.safeParse(data);
    }
}
