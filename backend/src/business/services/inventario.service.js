import { existenciaMedicamentoRepository } from '../../data/repositories/existencia-medicamento.repository.js';
import db from '../../data/models/index.js';
import { movimientoInventarioRepository } from '../../data/repositories/movimiento-inventario.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { calcularVencimiento, obtenerFechaComercial, obtenerFechaEtiquetaNormalizada,
    sumarMesesCalendario, ZONA_HORARIA_COMERCIAL } from '../../shared/utils/vencimiento.js';
import { decimalAEntero, enteroADecimal, dividirYRedondear,
    MAXIMO_COEFICIENTE_DECIMAL_14 } from '../../shared/utils/decimal.js';
import { obtenerFechaOperacion } from '../../shared/utils/fecha-operacion.js';
import { MOTIVOS_MOVIMIENTO } from '../../shared/constants/motivos-movimiento.js';

const toPlain = (registro) => registro.get ? registro.get({ plain: true }) : registro;
const decimal6 = (valor) => {
    const [entero, decimales = ''] = String(valor).split('.');
    return `${entero}.${decimales.padEnd(6, '0')}`;
};
const disponibilidadMeta = (fechaComercial) => ({ fechaComercial, zonaHoraria: ZONA_HORARIA_COMERCIAL });
const costoPromedioExistencia = (existencia) => {
    let costo;
    try {
        costo = decimalAEntero(String(existencia.costo_unitario_promedio), 6);
    } catch (error) {
        if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
        throw new AppError('El costo promedio de la existencia es inconsistente', 409);
    }
    if (costo > MAXIMO_COEFICIENTE_DECIMAL_14) {
        throw new AppError('El costo promedio de la existencia es inconsistente', 409);
    }
    return costo;
};
const compararVencimientos = (a, b) => Number(a.fechaEfectivaVencimiento.replaceAll('-', '')) -
    Number(b.fechaEfectivaVencimiento.replaceAll('-', '')) || a.idExistencia - b.idExistencia;

const toPublicExistencias = (medicamento, fechaComercial, incluirUltimoMovimiento = false) => (
    (medicamento.existencias || []).map((existencia) => {
        const vencimiento = calcularVencimiento(existencia.fecha_vencimiento,
            existencia.precision_vencimiento, fechaComercial);
        return {
            idExistencia: existencia.id_existencia,
            idMedicamento: existencia.id_medicamento,
            codigoExistencia: existencia.codigo_existencia,
            fechaVencimiento: existencia.fecha_vencimiento,
            precisionVencimiento: existencia.precision_vencimiento,
            ...vencimiento,
            stockFisico: existencia.cantidad_fisica,
            ...(incluirUltimoMovimiento ? { ultimoMovimiento: existencia.ultimo_movimiento ?? null } : {}),
            stockVendible: medicamento.estado && !vencimiento.vencida ? existencia.cantidad_fisica : 0,
            costoUnitarioPromedio: decimal6(existencia.costo_unitario_promedio)
        };
    }).sort(compararVencimientos)
);

const toPublicInventario = (registro, fechaComercial) => {
    const medicamento = toPlain(registro);
    const existencias = toPublicExistencias(medicamento, fechaComercial);
    return {
        idMedicamento: medicamento.id_medicamento,
        codigoMedicamento: medicamento.codigo_medicamento,
        nombreComercial: medicamento.nombre_comercial,
        formaFarmaceutica: medicamento.forma_farmaceutica,
        presentacion: medicamento.presentacion,
        unidadInventario: medicamento.unidad_inventario,
        stockMinimo: medicamento.stock_minimo,
        estado: Boolean(medicamento.estado),
        stockFisico: existencias.reduce((total, existencia) => total + existencia.stockFisico, 0),
        stockVendible: existencias.reduce((total, existencia) => total + existencia.stockVendible, 0),
        existencias
    };
};

const existenciasDeInventario = (medicamentos) => medicamentos.flatMap((medicamento) =>
    medicamento.existencias.map((existencia) => ({
        ...existencia,
        medicamento: {
            idMedicamento: medicamento.idMedicamento,
            codigoMedicamento: medicamento.codigoMedicamento,
            nombreComercial: medicamento.nombreComercial,
            formaFarmaceutica: medicamento.formaFarmaceutica,
            presentacion: medicamento.presentacion,
            unidadInventario: medicamento.unidadInventario,
            estado: medicamento.estado
        }
    }))
);

const toPublicMovimiento = (registro) => {
    const data = toPlain(registro);
    const medicamento = data.existencia.medicamento;
    return {
        idMovimiento: data.id_movimiento,
        idExistencia: data.id_existencia,
        idUsuario: data.id_usuario,
        idDetalleCompra: data.id_detalle_compra,
        idDetalleVenta: data.id_detalle_venta,
        idMovimientoOriginal: data.id_movimiento_original,
        idMovimientoReversion: data.movimientoReversion?.id_movimiento ?? null,
        direccion: data.direccion,
        cantidad: data.cantidad,
        fechaMovimiento: data.fecha_movimiento,
        motivo: data.motivo,
        observacion: data.observacion,
        costoUnitarioAplicado: decimal6(data.costo_unitario_aplicado),
        usuario: data.usuario ? {
            idUsuario: data.usuario.id_usuario, nombreUsuario: data.usuario.nombre_usuario
        } : null,
        existencia: {
            idExistencia: data.existencia.id_existencia,
            idMedicamento: data.existencia.id_medicamento,
            codigoExistencia: data.existencia.codigo_existencia,
            medicamento: {
                idMedicamento: medicamento.id_medicamento,
                codigoMedicamento: medicamento.codigo_medicamento,
                nombreComercial: medicamento.nombre_comercial,
                estado: Boolean(medicamento.estado)
            }
        },
        compra: data.detalleCompra ? {
            idCompra: data.detalleCompra.id_compra, idDetalleCompra: data.detalleCompra.id_detalle_compra
        } : null,
        venta: data.detalleVenta ? {
            idVenta: data.detalleVenta.id_venta, idDetalleVenta: data.detalleVenta.id_detalle_venta
        } : null
    };
};

// Flujo compartido exclusivamente por CU35/CU36. El motivo lo seleccionan los
// métodos de negocio, nunca el cuerpo enviado por el cliente.
const registrarRetiro = async (data, idUsuarioAutenticado, motivo) => {
    if (!Number.isInteger(idUsuarioAutenticado) || idUsuarioAutenticado <= 0 ||
        idUsuarioAutenticado > 2147483647) throw new AppError('No autenticado', 401);
    try {
        return await db.sequelize.transaction(async transaction => {
            const registro = await existenciaMedicamentoRepository.findByIdParaMovimiento({
                idExistencia: data.idExistencia, transaction
            });
            if (!registro) throw new AppError('Existencia no encontrada', 404);
            const existencia = toPlain(registro);
            const ultimoMovimiento = await movimientoInventarioRepository.findUltimoIdParaExistencia({
                idExistencia: data.idExistencia, transaction
            });
            if (existencia.cantidad_fisica !== data.stockObservado ||
                ultimoMovimiento !== data.ultimoMovimientoObservado) {
                throw new AppError('La existencia cambió. Consulte su saldo e historial antes de retirar', 409);
            }
            const { fechaComercial, fechaHoraComercial } = obtenerFechaOperacion();
            if (!Number.isInteger(existencia.cantidad_fisica) || existencia.cantidad_fisica < 0 ||
                existencia.cantidad_fisica > 2147483647) {
                throw new AppError('El saldo de la existencia es inconsistente', 409);
            }
            if (motivo === MOTIVOS_MOVIMIENTO.VENCIMIENTO) {
                let vencimiento;
                try {
                    vencimiento = calcularVencimiento(existencia.fecha_vencimiento,
                        existencia.precision_vencimiento, fechaComercial);
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                    throw new AppError('El vencimiento de la existencia es inconsistente', 409);
                }
                if (!vencimiento.vencida) throw new AppError('La existencia todavía no está vencida', 409);
            }
            if (data.cantidad > existencia.cantidad_fisica) {
                throw new AppError('Stock físico insuficiente para el retiro', 409);
            }
            const promedio = costoPromedioExistencia(existencia);
            const costoAplicado = enteroADecimal(promedio, 6);
            const stockFisico = existencia.cantidad_fisica - data.cantidad;
            // Solo se limita lo persistido. El importe derivado puede superar
            // DECIMAL(14,2); se conserva como cadena exacta, sin columna nueva.
            const perdida = enteroADecimal(dividirYRedondear(BigInt(data.cantidad) * promedio, 10000n), 2);
            const [actualizadas] = await existenciaMedicamentoRepository.updateSaldoYCosto({
                idExistencia: data.idExistencia, cantidadFisica: stockFisico,
                costoUnitarioPromedio: costoAplicado, transaction
            });
            if (actualizadas !== 1) throw new AppError('No se pudo actualizar la existencia', 409);
            const observacion = data.observacion ?? null;
            const movimiento = await movimientoInventarioRepository.create({ transaction, data: {
                id_existencia: data.idExistencia, id_usuario: idUsuarioAutenticado,
                id_detalle_compra: null, id_detalle_venta: null, id_movimiento_original: null,
                direccion: 'SALIDA', cantidad: data.cantidad, costo_unitario_aplicado: costoAplicado,
                motivo, observacion, fecha_movimiento: fechaHoraComercial
            } });
            return {
                idExistencia: existencia.id_existencia, saldoAnterior: existencia.cantidad_fisica,
                cantidadRetirada: data.cantidad, stockFisico, costoUnitarioPromedio: costoAplicado,
                perdida, ultimoMovimiento: movimiento.id_movimiento,
                movimiento: {
                    idMovimiento: movimiento.id_movimiento, idExistencia: data.idExistencia,
                    idUsuario: idUsuarioAutenticado, idDetalleCompra: null, idDetalleVenta: null,
                    idMovimientoOriginal: null, direccion: 'SALIDA', cantidad: data.cantidad,
                    costoUnitarioAplicado: costoAplicado, motivo, observacion, fechaMovimiento: fechaHoraComercial
                }
            };
        });
    } catch (error) {
        const codigo = error.parent?.code || error.original?.code;
        if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
            throw new AppError('El retiro no pudo confirmarse por contención temporal. Consulte la existencia y reintente', 409);
        }
        throw error;
    }
};

export class inventarioService {
    static async registrarRetiroVencimiento(data, idUsuarioAutenticado) {
        return registrarRetiro(data, idUsuarioAutenticado, MOTIVOS_MOVIMIENTO.VENCIMIENTO);
    }

    static async registrarRetiroDano(data, idUsuarioAutenticado) {
        return registrarRetiro(data, idUsuarioAutenticado, MOTIVOS_MOVIMIENTO.DANO);
    }

    static async registrarAjuste(data, idUsuarioAutenticado) {
        if (!Number.isInteger(idUsuarioAutenticado) || idUsuarioAutenticado <= 0 ||
            idUsuarioAutenticado > 2147483647) throw new AppError('No autenticado', 401);
        try {
            return await db.sequelize.transaction(async transaction => {
                const registro = await existenciaMedicamentoRepository.findByIdParaMovimiento({
                    idExistencia: data.idExistencia, transaction
                });
                if (!registro) throw new AppError('Existencia no encontrada', 404);
                const existencia = toPlain(registro);
                const ultimoMovimiento = await movimientoInventarioRepository.findUltimoIdParaExistencia({
                    idExistencia: data.idExistencia, transaction
                });
                if (existencia.cantidad_fisica !== data.stockObservado ||
                    ultimoMovimiento !== data.ultimoMovimientoObservado) {
                    throw new AppError('La existencia cambió. Consulte su saldo e historial antes de ajustar', 409);
                }
                // Un instante posterior a ambos bloqueos, sin leer Medicamento
                // ni abrir un snapshot ordinario para comprobar precondiciones.
                const { fechaHoraComercial } = obtenerFechaOperacion();
                if (!Number.isInteger(existencia.cantidad_fisica) || existencia.cantidad_fisica < 0 ||
                    existencia.cantidad_fisica > 2147483647) {
                    throw new AppError('El saldo de la existencia es inconsistente', 409);
                }
                const promedioAnterior = costoPromedioExistencia(existencia);
                const diferencia = data.saldoContado - existencia.cantidad_fisica;
                const respuesta = {
                    ajusteRealizado: diferencia !== 0,
                    idExistencia: existencia.id_existencia,
                    saldoAnterior: existencia.cantidad_fisica,
                    saldoContado: data.saldoContado,
                    diferencia,
                    stockFisico: data.saldoContado,
                    costoUnitarioPromedio: enteroADecimal(promedioAnterior, 6),
                    ultimoMovimiento,
                    movimiento: null
                };
                if (diferencia === 0) return respuesta;

                const entrada = diferencia > 0;
                const cantidad = Math.abs(diferencia);
                const costoAplicado = entrada ? decimalAEntero(data.costoUnitario, 6) : promedioAnterior;
                const promedioFinal = entrada ? dividirYRedondear(
                    BigInt(existencia.cantidad_fisica) * promedioAnterior + BigInt(cantidad) * costoAplicado,
                    BigInt(data.saldoContado)) : promedioAnterior;
                if (promedioFinal > MAXIMO_COEFICIENTE_DECIMAL_14) {
                    throw new AppError('El costo promedio resultante supera el máximo permitido', 409);
                }
                respuesta.costoUnitarioPromedio = enteroADecimal(promedioFinal, 6);
                const [actualizadas] = await existenciaMedicamentoRepository.updateSaldoYCosto({
                    idExistencia: data.idExistencia, cantidadFisica: data.saldoContado,
                    costoUnitarioPromedio: respuesta.costoUnitarioPromedio, transaction
                });
                if (actualizadas !== 1) throw new AppError('No se pudo actualizar la existencia', 409);
                const movimiento = await movimientoInventarioRepository.create({ transaction, data: {
                    id_existencia: data.idExistencia, id_usuario: idUsuarioAutenticado,
                    id_detalle_compra: null, id_detalle_venta: null, id_movimiento_original: null,
                    direccion: entrada ? 'ENTRADA' : 'SALIDA', cantidad,
                    costo_unitario_aplicado: enteroADecimal(costoAplicado, 6),
                    motivo: MOTIVOS_MOVIMIENTO.AJUSTE, observacion: data.observacion,
                    fecha_movimiento: fechaHoraComercial
                } });
                respuesta.ultimoMovimiento = movimiento.id_movimiento;
                respuesta.movimiento = {
                    idMovimiento: movimiento.id_movimiento, idExistencia: data.idExistencia,
                    idUsuario: idUsuarioAutenticado, idDetalleCompra: null, idDetalleVenta: null,
                    idMovimientoOriginal: null, direccion: entrada ? 'ENTRADA' : 'SALIDA', cantidad,
                    costoUnitarioAplicado: enteroADecimal(costoAplicado, 6), motivo: MOTIVOS_MOVIMIENTO.AJUSTE,
                    observacion: data.observacion, fechaMovimiento: fechaHoraComercial
                };
                // La transacción gestionada entrega la respuesta solo tras commit.
                return respuesta;
            });
        } catch (error) {
            const codigo = error.parent?.code || error.original?.code;
            if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
                throw new AppError('El ajuste no pudo confirmarse por contención temporal. Consulte la existencia y reintente', 409);
            }
            throw error;
        }
    }

    static async getInventario(filtros, fechaComercial = obtenerFechaComercial()) {
        const medicamentos = await existenciaMedicamentoRepository.findInventario(filtros);
        return {
            data: medicamentos.map((medicamento) => toPublicInventario(medicamento, fechaComercial)),
            meta: disponibilidadMeta(fechaComercial)
        };
    }

    static async getExistencias(idMedicamento, fechaComercial = obtenerFechaComercial()) {
        const registro = await existenciaMedicamentoRepository.findMedicamentoConExistencias(idMedicamento);
        if (!registro) throw new AppError('Medicamento no encontrado', 404);
        return {
            data: toPublicExistencias(toPlain(registro), fechaComercial, true),
            meta: disponibilidadMeta(fechaComercial)
        };
    }

    static async getProximosAVencer(filtros, fechaComercial = obtenerFechaComercial()) {
        const inventario = await this.getInventario(filtros, fechaComercial);
        const fechaHasta = sumarMesesCalendario(fechaComercial, 3);
        const data = existenciasDeInventario(inventario.data)
            .filter((existencia) => existencia.stockFisico > 0 && !existencia.vencida)
            .map((existencia) => ({
                ...existencia,
                fechaEtiquetaNormalizada: obtenerFechaEtiquetaNormalizada(
                    existencia.fechaVencimiento, existencia.precisionVencimiento)
            }))
            .filter((existencia) => existencia.fechaEtiquetaNormalizada >= fechaComercial &&
                existencia.fechaEtiquetaNormalizada <= fechaHasta)
            .sort((a, b) => a.fechaEtiquetaNormalizada.localeCompare(b.fechaEtiquetaNormalizada) ||
                a.idExistencia - b.idExistencia);
        return { data, meta: { ...inventario.meta, fechaHasta } };
    }

    static async getVencidos(filtros, fechaComercial = obtenerFechaComercial()) {
        const inventario = await this.getInventario(filtros, fechaComercial);
        const data = existenciasDeInventario(inventario.data)
            .filter((existencia) => existencia.stockFisico > 0 && existencia.vencida)
            .sort(compararVencimientos);
        return { data, meta: inventario.meta };
    }

    static async getStockBajo(filtros, fechaComercial = obtenerFechaComercial()) {
        const inventario = await this.getInventario(filtros, fechaComercial);
        const data = inventario.data.filter((medicamento) => medicamento.estado &&
            medicamento.stockVendible <= medicamento.stockMinimo);
        return { data, meta: inventario.meta };
    }

    static async getMovimientos(filtros) {
        const movimientos = await movimientoInventarioRepository.findAll(filtros);
        return movimientos.map(toPublicMovimiento);
    }
}
