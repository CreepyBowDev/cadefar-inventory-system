import { AppError } from '../errors/app-error.js';
import { esVersionCredencialesValida } from './jwt.js';

export const siguienteVersionCredenciales = (usuario) => {
    const version = usuario.version_credenciales;
    if (!esVersionCredencialesValida(version) || !esVersionCredencialesValida(version + 1)) {
        throw new AppError('No se pudo actualizar la contraseña', 500);
    }
    return version + 1;
};
