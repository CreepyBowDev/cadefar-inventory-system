import { Buffer } from 'node:buffer';
import { z } from 'zod';

// Solo para establecer contraseñas nuevas; no usar en login ni passwordActual.
export const newPasswordSchema = z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede superar los 100 caracteres')
    .regex(/\p{Lu}/u, 'La contraseña debe contener al menos una letra mayúscula')
    .regex(/\p{Ll}/u, 'La contraseña debe contener al menos una letra minúscula')
    .regex(/\p{N}/u, 'La contraseña debe contener al menos un número')
    .regex(
        /[\p{P}\p{S}]/u,
        'La contraseña debe contener al menos un carácter especial'
    )
    .refine(
        (password) => Buffer.byteLength(password, 'utf8') <= 72,
        { message: 'La contraseña no puede superar los 72 bytes en UTF-8' }
    );
