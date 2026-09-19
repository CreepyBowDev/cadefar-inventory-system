import { AppError } from '../../shared/errors/app-error.js';

export const errorHandler = (error, req, res, next) => {

    console.error(error);

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
