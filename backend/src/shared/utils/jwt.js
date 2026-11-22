import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import entorno from './pagos-entorno.cjs';
import { AppError } from '../errors/app-error.js';
import { anotarErrorAuditoria } from './auditoria-error.js';

export const esVersionCredencialesValida = (version) => (
    Number.isInteger(version) && version >= 0 && version <= 4294967295
);

const esPayloadValido = (payload) => (
    payload && typeof payload === 'object' &&
    Number.isInteger(payload.idUsuario) && payload.idUsuario > 0 &&
    Number.isInteger(payload.idRol) && payload.idRol > 0 &&
    esVersionCredencialesValida(payload.versionCredenciales)
);

// Mismo mecanismo JWT, otra firma para la base aislada. Nunca emitir en pruebas
// una cookie que el backend habitual pueda aceptar como sesión propia.
const claveSesion = () => entorno.esPruebaLocal()
    ? createHmac('sha256', process.env.JWT_SECRET).update('CADEFAR:PRUEBA_LOCAL:cadefar_pagos_pruebas:v1').digest('hex')
    : process.env.JWT_SECRET;

export const generarToken = ({ idUsuario, idRol, versionCredenciales }) => {
    if (!esPayloadValido({ idUsuario, idRol, versionCredenciales })) {
        throw new AppError('No se pudo generar la sesión', 500);
    }

    return jwt.sign(
        {
            idUsuario,
            idRol,
            versionCredenciales
        },
        claveSesion(),
        {
            expiresIn: '8h'
        }
    );

};

export const verificarToken = (token) => {
    const payload = jwt.verify(
        token,
        claveSesion()
    );
    if (!esPayloadValido(payload)) {
        throw anotarErrorAuditoria(new AppError('Token inválido o expirado', 401), {
            tipoEvento: 'TOKEN_INVALIDO', causa: 'TOKEN_INVALIDO'
        });
    }
    return payload;
};
