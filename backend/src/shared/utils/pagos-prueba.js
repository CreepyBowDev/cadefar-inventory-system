import entorno from './pagos-entorno.cjs';
import { AppError } from '../errors/app-error.js';

export const esPagoPrueba = pago => String(pago.cuenta_destino || '').startsWith('PRUEBA_LOCAL_LAB_');
export const exigirPagoPrueba = pago => {
    if (!entorno.esPruebaLocal() || !esPagoPrueba(pago) || pago.moneda !== 'BOB' || pago.moneda_pasarela !== 'BOB') {
        throw new AppError('El pago no pertenece al procesador local autorizado', 409);
    }
};
// Adaptador determinista y sin dependencias de red. Su estado se persiste en
// pago_compra: sobrevive reinicios y no puede parecer una respuesta financiera.
export class pagosPrueba {
    static crear(config, pago) {
        exigirPagoPrueba(pago);
        return { id_externo: `PRUEBA_LOCAL_PAGO_${pago.id_pago}`, estado: 'PROCESANDO',
            resultado_proveedor: 'PRUEBA_LOCAL_ESPERANDO', url_pago: null };
    }
    static autorizar(pago, decision) {
        exigirPagoPrueba(pago);
        if (['CONFIRMADO', 'RECHAZADO'].includes(pago.estado)) return {};
        if (!['APROBAR', 'RECHAZAR', 'CANCELAR', 'PENDIENTE'].includes(decision)) throw new AppError('Decisión de prueba inválida', 400);
        if (decision !== 'CANCELAR' && ['PRUEBA_LOCAL_APROBADO', 'PRUEBA_LOCAL_AUTORIZADO'].includes(pago.resultado_proveedor)) return {};
        if (['RECHAZAR', 'CANCELAR'].includes(decision)) return { estado: 'RECHAZADO', url_pago: null,
            resultado_proveedor: decision === 'CANCELAR' ? 'PRUEBA_LOCAL_CANCELADO' : 'PRUEBA_LOCAL_RECHAZADO' };
        return { estado: 'PROCESANDO', resultado_proveedor: decision === 'PENDIENTE' ? 'PRUEBA_LOCAL_EN_REVISION'
            : pago.metodo === 'PAYPAL' ? 'PRUEBA_LOCAL_AUTORIZADO' : 'PRUEBA_LOCAL_APROBADO' };
    }
    static consultar(config, pago, confirmar = false) {
        exigirPagoPrueba(pago);
        const aprobado = pago.resultado_proveedor === 'PRUEBA_LOCAL_APROBADO' ||
            (pago.resultado_proveedor === 'PRUEBA_LOCAL_AUTORIZADO' && confirmar);
        if (!aprobado) return { estado: pago.estado, resultado_proveedor: pago.resultado_proveedor };
        return { estado: 'CONFIRMADO', resultado_proveedor: 'PRUEBA_LOCAL_CONFIRMADO',
            referencia_externa: `PRUEBA_LOCAL_REF_${pago.id_pago}`, url_pago: null, url_comprobante: null };
    }
}
