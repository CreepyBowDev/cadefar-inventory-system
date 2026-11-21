import db from '../../data/models/index.js';
import { compraRepository } from '../../data/repositories/compra.repository.js';
import { pagoCompraRepository } from '../../data/repositories/pago-compra.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { decimalAEntero, enteroADecimal } from '../../shared/utils/decimal.js';
import { obtenerFechaOperacion } from '../../shared/utils/fecha-operacion.js';
import { monedaCompras, metodosPagoPublicos, obtenerConfiguracionPago, urlRetornoPago } from '../../shared/utils/pagos-config.js';
import { pagosPasarela, urlPagoSegura } from '../../shared/utils/pagos-pasarela.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';

const toPlain = registro => registro.get ? registro.get({ plain: true }) : registro;
const conflicto = mensaje => anotarErrorAuditoria(new AppError(mensaje, 409), { causa: 'CONFLICTO' });
const snapshot = pago => ({ idCompra: pago.id_compra, metodo: pago.metodo, importe: pago.importe,
    moneda: pago.moneda, importePasarela: pago.importe_pasarela, monedaPasarela: pago.moneda_pasarela,
    estado: pago.estado, referenciaExterna: pago.referencia_externa ?? null });
const toPublic = pago => ({
    idPago: pago.id_pago, idCompra: pago.id_compra, idUsuario: pago.id_usuario,
    claveOperacion: pago.clave_operacion, metodo: pago.metodo, importe: pago.importe, moneda: pago.moneda,
    importePasarela: pago.importe_pasarela, monedaPasarela: pago.moneda_pasarela,
    referenciaCotizacion: pago.referencia_cotizacion, estado: pago.estado,
    fecha: pago.fecha_registro, fechaVerificacion: pago.fecha_verificacion, fechaConfirmacion: pago.fecha_confirmacion,
    referenciaExterna: pago.referencia_externa, resultadoProveedor: pago.resultado_proveedor,
    permiteConciliacion: !pago.id_externo && pago.estado === 'PENDIENTE',
    urlPago: urlPagoSegura(pago.url_pago, pago.metodo),
    urlComprobante: urlPagoSegura(pago.url_comprobante, pago.metodo, true),
    administrador: pago.administrador ? { idUsuario: pago.administrador.id_usuario,
        nombreUsuario: pago.administrador.nombre_usuario } : null
});

export const calcularResumenPagos = (compra, pagos, moneda = monedaCompras()) => {
    const total = decimalAEntero(String(compra.total), 2);
    let pagado = 0n, reservado = 0n;
    const monedas = new Set(pagos.map(pago => pago.moneda));
    if (monedas.size > 1 || (moneda && monedas.size && !monedas.has(moneda))) {
        throw conflicto('La moneda configurada no coincide con el historial financiero. Revise la configuración.');
    }
    for (const pago of pagos) {
        const importe = decimalAEntero(String(pago.importe), 2);
        if (pago.estado === 'CONFIRMADO') pagado += importe;
        else if (['PENDIENTE', 'PROCESANDO'].includes(pago.estado)) reservado += importe;
    }
    if (pagado + reservado > total) throw conflicto('El historial financiero supera el total de la compra.');
    return { moneda: moneda || [...monedas][0] || null, total: enteroADecimal(total, 2),
        totalPagado: enteroADecimal(pagado, 2), saldoPendiente: enteroADecimal(total - pagado, 2),
        importeReservado: enteroADecimal(reservado, 2), saldoDisponible: enteroADecimal(total - pagado - reservado, 2),
        estadoFinanciero: compra.estado_operacion === 'ANULADA' ? 'NO_APLICA'
            : reservado > 0n ? 'PROCESANDO' : pagado === total ? 'PAGADO' : pagado > 0n ? 'PARCIAL' : 'PENDIENTE' };
};

const manejarConflicto = error => {
    if (error.name === 'SequelizeUniqueConstraintError') throw conflicto('La operación o transacción ya está registrada. Consulte el historial antes de continuar.');
    if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.parent?.code || error.original?.code)) {
        throw conflicto('El pago está siendo actualizado. Consulte su estado antes de reintentar con la misma clave.');
    }
    throw error;
};
const transaccion = async operacion => {
    try {
        return await db.sequelize.transaction({ isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED }, operacion);
    } catch (error) { manejarConflicto(error); }
};
const buscarCompra = async (idCompra, transaction) => {
    const registro = await compraRepository.findParaAnular({ idCompra, transaction });
    if (!registro) throw anotarErrorAuditoria(new AppError('Compra no encontrada', 404), { causa: 'NO_ENCONTRADO' });
    return toPlain(registro);
};

export class pagoCompraService {
    static async consultar(idCompra) {
        return db.sequelize.transaction({ isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
            const registro = await compraRepository.findById(idCompra, { transaction });
            if (!registro) throw new AppError('Compra no encontrada', 404);
            const compra = toPlain(registro);
            const pagos = (await pagoCompraRepository.findHistorial({ idCompra, transaction })).map(toPlain);
            return { ...calcularResumenPagos(compra, pagos), pagos: pagos.map(toPublic),
                metodos: metodosPagoPublicos(compra.id_proveedor_laboratorio) };
        });
    }

    static async iniciar(idCompra, data, idUsuario, auditoria) {
        const config = obtenerConfiguracionPago((await this.#identificarCompra(idCompra)).id_proveedor_laboratorio, data.metodo);
        urlRetornoPago(idCompra);
        const importePasarela = config.moneda === monedaCompras() ? data.importe : data.importePasarela;
        if (!importePasarela || (config.moneda !== monedaCompras() && !data.referenciaCotizacion) ||
            (config.moneda === monedaCompras() && data.importePasarela && data.importePasarela !== data.importe)) {
            throw new AppError('Indique el importe y la referencia acordados con el laboratorio para la moneda de la pasarela.', 400);
        }
        const idPago = await bitacoraAuditoriaService.ejecutarCambio('PAGO_COMPRA_INICIAR', auditoria,
            { tipo: 'COMPRA', id: idCompra }, seguimiento => transaccion(async transaction => {
                seguimiento.transaction = transaction;
                const compra = await buscarCompra(idCompra, transaction);
                const previo = await pagoCompraRepository.findByClave({ claveOperacion: data.claveOperacion, transaction });
                if (previo) {
                    const pago = toPlain(previo);
                    if (pago.id_compra !== idCompra || pago.id_usuario !== idUsuario || pago.metodo !== data.metodo ||
                        pago.importe !== data.importe || pago.moneda !== monedaCompras() || pago.cuenta_destino !== config.cuenta ||
                        pago.importe_pasarela !== importePasarela || pago.moneda_pasarela !== config.moneda ||
                        (pago.referencia_cotizacion ?? null) !== (data.referenciaCotizacion ?? null)) {
                        throw conflicto('La clave de operación ya fue utilizada con otros datos.');
                    }
                    return pago.id_pago;
                }
                if (compra.estado_operacion !== 'CONFIRMADA') throw conflicto('No se puede pagar una compra anulada.');
                const pagos = (await pagoCompraRepository.findAll({ idCompra, transaction, lock: true })).map(toPlain);
                const resumen = calcularResumenPagos(compra, pagos);
                if (pagos.some(pago => ['PENDIENTE', 'PROCESANDO'].includes(pago.estado))) {
                    throw conflicto('Existe un pago pendiente de verificación. Resuélvalo antes de iniciar otro.');
                }
                if (decimalAEntero(data.importe, 2) > decimalAEntero(resumen.saldoDisponible, 2)) {
                    throw conflicto('El importe no puede superar el saldo pendiente disponible.');
                }
                const registro = await pagoCompraRepository.create({ transaction, data: {
                    id_compra: idCompra, id_usuario: idUsuario, clave_operacion: data.claveOperacion,
                    metodo: data.metodo, importe: data.importe, moneda: monedaCompras(),
                    importe_pasarela: importePasarela, moneda_pasarela: config.moneda,
                    referencia_cotizacion: data.referenciaCotizacion ?? null, cuenta_destino: config.cuenta,
                    estado: 'PENDIENTE', fecha_registro: obtenerFechaOperacion().fechaHoraComercial
                } });
                await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                    registro: { tipo: 'PAGO_COMPRA', id: registro.id_pago },
                    despues: snapshot({ ...toPlain(registro), referencia_externa: null }),
                    referencias: [{ tipo: 'COMPRA', id: idCompra }]
                }, transaction);
                return registro.id_pago;
            }));
        // La reserva y su clave se confirman ANTES del primer contacto externo.
        // Un timeout, caída o rollback posterior nunca libera un pago incierto.
        return this.verificar(idCompra, idPago, false, auditoria);
    }

    static async #identificarCompra(idCompra) {
        const registro = await compraRepository.findById(idCompra);
        if (!registro) throw new AppError('Compra no encontrada', 404);
        return toPlain(registro);
    }

    static async verificar(idCompra, idPago, capturar, auditoria, idExternoRecuperado) {
        return bitacoraAuditoriaService.ejecutarCambio('PAGO_COMPRA_VERIFICAR', auditoria,
            { tipo: 'PAGO_COMPRA', id: idPago }, seguimiento => transaccion(async transaction => {
                seguimiento.transaction = transaction;
                const compra = await buscarCompra(idCompra, transaction);
                const registro = await pagoCompraRepository.findById({ idCompra, idPago, transaction });
                if (!registro) throw anotarErrorAuditoria(new AppError('Pago no encontrado', 404), { causa: 'NO_ENCONTRADO' });
                const pago = toPlain(registro);
                if (['CONFIRMADO', 'RECHAZADO'].includes(pago.estado)) return toPublic(pago);
                if (compra.estado_operacion !== 'CONFIRMADA') throw conflicto('La compra ya no admite pagos. Se requiere revisión financiera.');
                if (idExternoRecuperado && pago.id_externo && pago.id_externo !== idExternoRecuperado) {
                    throw conflicto('El pago ya tiene una referencia de inicio diferente.');
                }
                const idExterno = pago.id_externo || idExternoRecuperado;
                const config = obtenerConfiguracionPago(compra.id_proveedor_laboratorio, pago.metodo, capturar || !idExterno);
                if (config.cuenta !== pago.cuenta_destino || config.moneda !== pago.moneda_pasarela) {
                    throw conflicto('La cuenta receptora o moneda cambió. Restaure la configuración del pago antes de verificar.');
                }
                // PayPal retiene normalmente claves seis horas; se usa un margen
                // conservador de cinco. Nunca recrear automáticamente fuera de él.
                if (!idExterno && pago.fecha_registro < obtenerFechaOperacion(new Date(Date.now() - 5 * 3600000)).fechaHoraComercial) {
                    throw conflicto('El inicio del pago requiere conciliación con el laboratorio. No se creará otra transacción ni se liberará su importe sin verificación.');
                }
                // Una referencia recuperada no acredita un pago: debe superar
                // la misma consulta de cuenta, moneda, importe y clave internos.
                const respuesta = idExterno ? await pagosPasarela.consultar(config, { ...pago, id_externo: idExterno }, capturar)
                    : await pagosPasarela.crear(config, pago);
                const fecha = obtenerFechaOperacion().fechaHoraComercial;
                const data = { ...respuesta, ...(idExterno ? { id_externo: idExterno } : {}), fecha_verificacion: fecha,
                    fecha_confirmacion: respuesta.estado === 'CONFIRMADO' ? fecha : null };
                const pagos = (await pagoCompraRepository.findAll({ idCompra, transaction, lock: true })).map(toPlain);
                calcularResumenPagos(compra, pagos.map(p => p.id_pago === idPago ? { ...p, ...data } : p));
                const [actualizados] = await pagoCompraRepository.update({ idPago, data, transaction });
                if (actualizados !== 1) throw conflicto('No fue posible registrar el resultado verificado.');
                const resultado = { ...pago, ...data };
                await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                    antes: snapshot(pago), despues: snapshot(resultado), referencias: [{ tipo: 'COMPRA', id: idCompra }]
                }, transaction);
                return toPublic(resultado);
            }));
    }
}
