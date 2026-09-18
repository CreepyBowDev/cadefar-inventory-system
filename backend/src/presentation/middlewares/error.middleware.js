import { AppError } from '../../shared/errors/app-error.js';

export const errorHandler = (error, req, res, next) => {

    console.error(error);

    if (error instanceof AppError) {

        return res.status(error.statusCode).json({
            message: error.message
        });

    }

    return res.status(500).json({
        message: 'Error interno del servidor'
    });

};