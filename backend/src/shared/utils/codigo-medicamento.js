import { AppError } from '../errors/app-error.js';
import { anotarErrorAuditoria } from './auditoria-error.js';

// Normalizar exclusivamente el identificador; no transformar el nombre almacenado.
export const obtenerPrefijoMedicamento = (nombreComercial) => {
    const letras = nombreComercial.trim().toUpperCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
    if (letras.length < 3) {
        throw anotarErrorAuditoria(new AppError('El nombre comercial debe contener al menos tres letras válidas para generar el código del medicamento', 400), { causa: 'ENTRADA_INVALIDA' });
    }
    return letras.slice(0, 3);
};
