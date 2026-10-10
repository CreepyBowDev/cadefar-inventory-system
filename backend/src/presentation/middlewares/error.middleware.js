import { AppError } from '../../shared/errors/app-error.js';

export const errorHandler = (error, req, res, next) => {

    // El parser de Express genera errores HTTP antes de llegar al Controller.
    // Usar mensajes propios: el error original puede contener el body recibido.
    if (error.type === 'entity.parse.failed' && error.status === 400) {
        error = new AppError('El cuerpo de la solicitud debe contener JSON válido', 400);
    } else if (error.type === 'entity.too.large' && error.status === 413) {
        error = new AppError('El cuerpo de la solicitud supera el tamaño permitido', 413);
    }

    // Errores técnicos de Sequelize pueden contener SQL y hashes en sus valores.
    console.error({
        name: error instanceof AppError ? 'AppError' : error.name,
        message: error instanceof AppError ? error.message : 'Error interno del servidor',
        statusCode: error instanceof AppError ? error.statusCode : 500
    });

    if (error instanceof AppError) {

        const response = {
            message: error.message
        };

        if (error.details) {
            response.errors = error.details;
        }

        return res.status(error.statusCode).json(response);

    }

    return res.status(500).json({
        message: 'Error interno del servidor'
    });

};
