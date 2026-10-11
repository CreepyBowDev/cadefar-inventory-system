export const MOTIVOS_MOVIMIENTO = Object.freeze({
    COMPRA: 'COMPRA',
    VENTA: 'VENTA',
    ANULACION_COMPRA: 'ANULACION_COMPRA',
    ANULACION_VENTA: 'ANULACION_VENTA',
    VENCIMIENTO: 'VENCIMIENTO',
    DANO: 'DAÑO'
});

// Solo para lectura y validación del historial, nunca para nuevas escrituras.
export const MOTIVOS_MOVIMIENTO_HISTORICOS = Object.freeze({
    COMPRA: 'Compra',
    ANULACION_COMPRA: 'Reversión'
});
