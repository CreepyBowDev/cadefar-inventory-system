import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';

export const esVersionCredencialesValida = (version) => (
    Number.isInteger(version) && version >= 0 && version <= 4294967295
);

const esPayloadValido = (payload) => (
    payload && typeof payload === 'object' &&
    Number.isInteger(payload.idUsuario) && payload.idUsuario > 0 &&
    Number.isInteger(payload.idRol) && payload.idRol > 0 &&
    esVersionCredencialesValida(payload.versionCredenciales)
);

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
        process.env.JWT_SECRET,
        {
            expiresIn: '8h'
        }
    );

};

export const verificarToken = (token) => {
    const payload = jwt.verify(
        token,
        process.env.JWT_SECRET
    );
    if (!esPayloadValido(payload)) {
        throw new AppError('Token inválido o expirado', 401);
    }
    return payload;
};
