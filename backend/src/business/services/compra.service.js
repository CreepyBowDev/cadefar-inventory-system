import db from '../../data/models/index.js';
import { compraRepository } from '../../data/repositories/compra.repository.js';
import { medicamentoRepository } from '../../data/repositories/medicamento.repository.js';
import { existenciaMedicamentoRepository } from '../../data/repositories/existencia-medicamento.repository.js';
import { movimientoInventarioRepository } from '../../data/repositories/movimiento-inventario.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { decimalAEntero, enteroADecimal, dividirYRedondear,
    MAXIMO_COEFICIENTE_DECIMAL_14 } from '../../shared/utils/decimal.js';
import { calcularVencimiento } from '../../shared/utils/vencimiento.js';
import { obtenerFechaOperacion } from '../../shared/utils/fecha-operacion.js';

const MAXIMO_INT = 2147483647n;
const validarImporte = (valor, nombre) => {
    if (valor > MAXIMO_COEFICIENTE_DECIMAL_14) {
        throw new AppError(`${nombre} supera el importe máximo permitido`, 400);
    }
    return valor;
};
const claveExistencia = (data) => `${data.idMedicamento}|${data.fechaVencimiento}|${data.precisionVencimiento}`;

const manejarErrorRegistro = (error) => {
    if (error.name === 'SequelizeUniqueConstraintError') {
        const indice = (error.parent?.sqlMessage || error.original?.sqlMessage || '')
            .match(/for key ['`](?:[^'`]*\.)?([^'`]+)['`]/i)?.[1];
        const campos = Object.keys(error.fields || {});
        if (indice === 'uq_compra_clave_operacion' ||
            (!indice && campos.length === 1 && campos[0] === 'clave_operacion')) {
            throw new AppError('La clave de operación ya está registrada', 409);
        }
        if (indice === 'uq_existencia_codigo') {
            throw new AppError('Conflicto al generar el código de existencia', 409);
        }
        if (indice === 'uq_existencia_medicamento_vencimiento_precision') {
            throw new AppError('Conflicto al identificar la existencia recibida', 409);
        }
    }
    const codigo = error.parent?.code || error.original?.code;
    if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
        throw new AppError('La compra no pudo confirmarse por contención temporal. Reintente con la misma clave de operación', 409);
    }
    throw error;
};

const toPlain = (registro) => registro.get ? registro.get({ plain: true }) : registro;
const decimal = (valor, escala) => enteroADecimal(decimalAEntero(String(valor), escala), escala);
const inconsistenciaAnulacion = () => new AppError('No se puede anular: el historial o el estado anterior de la compra es inconsistente', 409);
const cantidadHistorica = (valor, permiteCero = false) => {
    if (!Number.isInteger(valor) || valor < (permiteCero ? 0 : 1) || valor > Number(MAXIMO_INT)) {
        throw inconsistenciaAnulacion();
    }
    return BigInt(valor);
};
const costoHistorico = (valor) => {
    try {
        const costo = decimalAEntero(String(valor), 6);
        if (costo > MAXIMO_COEFICIENTE_DECIMAL_14) throw inconsistenciaAnulacion();
        return costo;
    } catch (error) {
        if (error instanceof TypeError || error instanceof RangeError) throw inconsistenciaAnulacion();
        throw error;
    }
};

// B1 restaura el snapshot sin aplicar residuos. A utiliza el estado actual;
// nunca se usa para eludir originales, snapshots o secuencias inconsistentes.
const calcularCompensacion = (existencia, detalles, movimientos) => {
    const saldoActual = cantidadHistorica(existencia.cantidad_fisica, true);
    const promedioActual = costoHistorico(existencia.costo_unitario_promedio);
    const historial = movimientos.filter(m => m.id_existencia === existencia.id_existencia);
    const porId = new Map(historial.map(m => [m.id_movimiento, m]));
    let saldoHistorial = 0n;
    for (const movimiento of historial) {
        const cantidad = cantidadHistorica(movimiento.cantidad);
        costoHistorico(movimiento.costo_unitario_aplicado);
        if (!['ENTRADA', 'SALIDA'].includes(movimiento.direccion)) throw inconsistenciaAnulacion();
        if (movimiento.id_detalle_compra !== null && movimiento.id_detalle_venta !== null) throw inconsistenciaAnulacion();
        saldoHistorial += movimiento.direccion === 'ENTRADA' ? cantidad : -cantidad;
        if (movimiento.id_movimiento_original !== null) {
            const original = porId.get(movimiento.id_movimiento_original);
            if (!original || original.id_movimiento >= movimiento.id_movimiento || original.id_movimiento_original !== null ||
                original.direccion === movimiento.direccion || original.cantidad !== movimiento.cantidad ||
                costoHistorico(original.costo_unitario_aplicado) !== costoHistorico(movimiento.costo_unitario_aplicado) ||
                movimiento.motivo !== 'Reversión') throw inconsistenciaAnulacion();
        }
    }
    if (saldoHistorial !== saldoActual) throw inconsistenciaAnulacion();

    let cantidadTotal = 0n, valorTotal = 0n;
    const originales = [];
    let anterior;
    for (const detalle of detalles) {
        const cantidad = cantidadHistorica(detalle.cantidad);
        const costo = costoHistorico(detalle.costo_unitario);
        if (costo === 0n) throw inconsistenciaAnulacion();
        const asociados = movimientos.filter(m => m.id_detalle_compra === detalle.id_detalle_compra);
        if (asociados.length !== 1) throw inconsistenciaAnulacion();
        const [original] = asociados;
        if (original.id_existencia !== existencia.id_existencia || original.direccion !== 'ENTRADA' ||
            original.motivo !== 'Compra' || original.id_movimiento_original !== null || original.id_detalle_venta !== null ||
            original.cantidad !== detalle.cantidad || costoHistorico(original.costo_unitario_aplicado) !== costo) {
            throw inconsistenciaAnulacion();
        }
        originales.push(original);
        cantidadTotal += cantidad; valorTotal += cantidad * costo;
        const sinSaldo = detalle.saldo_anterior === null;
        const sinCosto = detalle.costo_promedio_anterior === null;
        if (sinSaldo !== sinCosto) throw inconsistenciaAnulacion();
        const snapshot = sinSaldo ? null : {
            saldo: cantidadHistorica(detalle.saldo_anterior, true), costo: costoHistorico(detalle.costo_promedio_anterior)
        };
        if (anterior === undefined) anterior = snapshot;
        else if ((anterior === null) !== (snapshot === null) || (anterior &&
            (anterior.saldo !== snapshot.saldo || anterior.costo !== snapshot.costo))) throw inconsistenciaAnulacion();
    }
    if (cantidadTotal > MAXIMO_INT) throw inconsistenciaAnulacion();
    const ids = new Set(originales.map(m => m.id_movimiento));
    const menor = originales.reduce((minimo, m) => Math.min(minimo, m.id_movimiento), originales[0].id_movimiento);
    const mayor = originales.reduce((maximo, m) => Math.max(maximo, m.id_movimiento), originales[0].id_movimiento);
    const posteriores = historial.filter(m => m.id_movimiento > menor && !ids.has(m.id_movimiento));
    if (posteriores.some(m => m.id_movimiento < mayor)) throw inconsistenciaAnulacion();
    if (anterior !== null && anterior.saldo + cantidadTotal > MAXIMO_INT) throw inconsistenciaAnulacion();
    let saldoFinal, promedioFinal;
    if (posteriores.length === 0) {
        if (anterior === null) throw new AppError('No se puede anular: falta el estado anterior de la compra histórica', 409);
        const saldoEsperado = anterior.saldo + cantidadTotal;
        const promedioEsperado = dividirYRedondear(anterior.saldo * anterior.costo + valorTotal, saldoEsperado);
        if (saldoActual !== saldoEsperado || promedioActual !== promedioEsperado) throw inconsistenciaAnulacion();
        saldoFinal = anterior.saldo; promedioFinal = anterior.costo;
    } else {
        saldoFinal = saldoActual - cantidadTotal;
        const residual = saldoActual * promedioActual - valorTotal;
        if (saldoFinal < 0n) throw new AppError('No se puede anular: stock físico insuficiente', 409);
        if (residual < 0n || (saldoFinal === 0n && residual !== 0n)) {
            throw new AppError('No se puede anular: la valoración residual es incompatible', 409);
        }
        promedioFinal = saldoFinal === 0n ? promedioActual : dividirYRedondear(residual, saldoFinal);
        if (promedioFinal > MAXIMO_COEFICIENTE_DECIMAL_14) {
            throw new AppError('No se puede anular: el costo promedio resultante supera el máximo permitido', 409);
        }
    }
    return { idExistencia: existencia.id_existencia, saldoFinal: Number(saldoFinal),
        promedioFinal: enteroADecimal(promedioFinal, 6), originales };
};
const toPublicUsuario = (usuario) => usuario ? {
    idUsuario: usuario.id_usuario, nombreUsuario: usuario.nombre_usuario
} : null;
const toPublicCompra = (data) => ({
    idCompra: data.id_compra,
    idUsuario: data.id_usuario,
    idProveedorLaboratorio: data.id_proveedor_laboratorio,
    fechaCompra: data.fecha_compra,
    fechaRegistro: data.fecha_registro,
    estadoOperacion: data.estado_operacion,
    claveOperacion: data.clave_operacion,
    total: decimal(data.total, 2),
    fechaAnulacion: data.fecha_anulacion,
    motivoAnulacion: data.motivo_anulacion,
    idUsuarioAnulador: data.id_usuario_anulador,
    proveedorLaboratorio: data.proveedorLaboratorio ? {
        idProveedorLaboratorio: data.proveedorLaboratorio.id_proveedor_laboratorio,
        nombre: data.proveedorLaboratorio.nombre,
        estado: Boolean(data.proveedorLaboratorio.estado)
    } : null,
    usuarioRegistrador: toPublicUsuario(data.usuarioRegistrador),
    usuarioAnulador: toPublicUsuario(data.usuarioAnulador)
});
const toPublicDetalle = (data) => {
    const existencia = data.existencia;
    const medicamento = existencia.medicamento;
    return {
        idDetalleCompra: data.id_detalle_compra,
        idCompra: data.id_compra,
        idExistencia: data.id_existencia,
        cantidad: data.cantidad,
        costoUnitario: decimal(data.costo_unitario, 6),
        subtotal: decimal(data.subtotal, 2),
        existencia: {
            idExistencia: existencia.id_existencia,
            idMedicamento: existencia.id_medicamento,
            codigoExistencia: existencia.codigo_existencia,
            fechaVencimiento: existencia.fecha_vencimiento,
            precisionVencimiento: existencia.precision_vencimiento,
            medicamento: {
                idMedicamento: medicamento.id_medicamento,
                codigoMedicamento: medicamento.codigo_medicamento,
                nombreComercial: medicamento.nombre_comercial,
                formaFarmaceutica: medicamento.forma_farmaceutica,
                presentacion: medicamento.presentacion,
                unidadInventario: medicamento.unidad_inventario,
                estado: Boolean(medicamento.estado)
            }
        }
    };
};

export class compraService {
    static async anularCompra(idCompra, motivo, idUsuarioAutenticado) {
        if (!Number.isInteger(idUsuarioAutenticado) || idUsuarioAutenticado <= 0 ||
            idUsuarioAutenticado > Number(MAXIMO_INT)) throw new AppError('No autenticado', 401);
        try {
            return await db.sequelize.transaction(async transaction => {
                const registro = await compraRepository.findParaAnular({ idCompra, transaction });
                if (!registro) throw new AppError('Compra no encontrada', 404);
                const compra = toPlain(registro);
                if (compra.estado_operacion === 'ANULADA') throw new AppError('La compra ya está anulada', 409);
                if (compra.estado_operacion !== 'CONFIRMADA' || compra.fecha_anulacion !== null ||
                    compra.motivo_anulacion !== null || compra.id_usuario_anulador !== null) throw inconsistenciaAnulacion();
                const detalles = (await compraRepository.findDetallesParaAnular({ idCompra, transaction })).map(toPlain);
                if (!detalles.length) throw inconsistenciaAnulacion();
                // No se exige actividad del catálogo/proveedor ni vencimiento
                // vendible: se compensa una operación histórica ya registrada.
                const idsExistencias = [...new Set(detalles.map(d => d.id_existencia))].sort((a, b) => a - b);
                const existencias = [];
                for (const idExistencia of idsExistencias) {
                    const existencia = await existenciaMedicamentoRepository.findByIdParaAnular({ idExistencia, transaction });
                    if (!existencia) throw inconsistenciaAnulacion();
                    existencias.push(toPlain(existencia));
                }
                const movimientos = (await movimientoInventarioRepository.findParaAnular({ idsExistencias,
                    idsDetalles: detalles.map(d => d.id_detalle_compra), transaction })).map(toPlain);
                // Validar todos los grupos antes de producir cualquier efecto.
                const grupos = existencias.map(e => calcularCompensacion(e,
                    detalles.filter(d => d.id_existencia === e.id_existencia), movimientos));
                const originales = grupos.flatMap(g => g.originales).sort((a, b) => a.id_movimiento - b.id_movimiento);
                if ((await movimientoInventarioRepository.findReversiones({
                    idsOriginales: originales.map(m => m.id_movimiento), transaction })).length) throw inconsistenciaAnulacion();
                const { fechaHoraComercial } = obtenerFechaOperacion();
                for (const grupo of grupos) {
                    const [actualizadas] = await existenciaMedicamentoRepository.updateSaldoYCosto({ transaction,
                        idExistencia: grupo.idExistencia, cantidadFisica: grupo.saldoFinal, costoUnitarioPromedio: grupo.promedioFinal });
                    if (actualizadas !== 1) throw inconsistenciaAnulacion();
                }
                for (const original of originales) {
                    await movimientoInventarioRepository.create({ transaction, data: {
                        id_existencia: original.id_existencia, id_usuario: idUsuarioAutenticado,
                        id_detalle_compra: original.id_detalle_compra, id_detalle_venta: null,
                        id_movimiento_original: original.id_movimiento, direccion: 'SALIDA', cantidad: original.cantidad,
                        costo_unitario_aplicado: original.costo_unitario_aplicado, motivo: 'Reversión',
                        observacion: motivo, fecha_movimiento: fechaHoraComercial
                    } });
                }
                const [actualizadas] = await compraRepository.anular({ idCompra, motivo, idUsuario: idUsuarioAutenticado,
                    fechaHora: fechaHoraComercial, transaction });
                if (actualizadas !== 1) throw inconsistenciaAnulacion();
                return this.getCompraById(idCompra, transaction);
            });
        } catch (error) {
            const codigo = error.parent?.code || error.original?.code;
            if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
                throw new AppError('La compra no pudo anularse por contención temporal. Consulte su estado y reintente', 409);
            }
            if (error.name === 'SequelizeUniqueConstraintError' &&
                /uq_movimiento_original/.test(error.parent?.sqlMessage || error.original?.sqlMessage || '')) {
                throw inconsistenciaAnulacion();
            }
            throw error;
        }
    }

    static async createCompra(data, idUsuarioAutenticado) {
        if (!Number.isInteger(idUsuarioAutenticado) || idUsuarioAutenticado <= 0 ||
            idUsuarioAutenticado > Number(MAXIMO_INT)) throw new AppError('No autenticado', 401);

        const grupos = new Map();
        let total = 0n;
        const lineas = data.detalles.map((detalle) => {
            const costo = decimalAEntero(detalle.costoUnitario, 6);
            const cantidad = BigInt(detalle.cantidad);
            const subtotal = validarImporte(dividirYRedondear(cantidad * costo, 10000n), 'El subtotal');
            total = validarImporte(total + subtotal, 'El total');
            const clave = claveExistencia(detalle);
            if (!grupos.has(clave)) grupos.set(clave, { ...detalle, cantidadTotal: 0n, valorTotal: 0n });
            const grupo = grupos.get(clave);
            grupo.cantidadTotal += cantidad;
            grupo.valorTotal += cantidad * costo;
            if (grupo.cantidadTotal > MAXIMO_INT) {
                throw new AppError('La cantidad agrupada supera el máximo permitido', 400);
            }
            return { ...detalle, clave, subtotal: enteroADecimal(subtotal, 2) };
        });

        try {
            // Auxiliar fuera de la transacción para no abrir una lectura snapshot
            // anterior a los bloqueos. El UNIQUE sigue siendo la garantía final.
            if (await compraRepository.findByClave({ claveOperacion: data.claveOperacion })) {
                throw new AppError('La clave de operación ya está registrada', 409);
            }
            return await db.sequelize.transaction(async (transaction) => {
                const medicamentos = new Map();
                const ids = [...new Set(lineas.map((linea) => linea.idMedicamento))].sort((a, b) => a - b);
                for (const idMedicamento of ids) {
                    const registro = await medicamentoRepository.findById({ idMedicamento, transaction, lock: true });
                    if (!registro) throw new AppError('Medicamento no encontrado', 404);
                    const medicamento = toPlain(registro);
                    if (!medicamento.estado) throw new AppError('No se puede recibir un medicamento inactivo', 409);
                    medicamentos.set(idMedicamento, medicamento);
                }
                const proveedores = new Set([...medicamentos.values()].map((m) => m.id_proveedor_laboratorio));
                if (proveedores.size !== 1) throw new AppError('Todos los medicamentos deben pertenecer al mismo proveedor', 409);
                const [idProveedorLaboratorio] = proveedores;
                const proveedor = await medicamentoRepository.findProveedorById({ idProveedorLaboratorio, transaction });
                if (!proveedor) throw new AppError('Proveedor o laboratorio no encontrado', 404);
                if (!toPlain(proveedor).estado) throw new AppError('El proveedor o laboratorio está inactivo', 409);

                const existencias = new Map(), correlativos = new Map();
                for (const idMedicamento of ids) {
                    const registros = await existenciaMedicamentoRepository.findParaCompra({ idMedicamento, transaction });
                    let mayor = 0n;
                    for (const registro of registros) {
                        const existencia = toPlain(registro);
                        existencias.set(claveExistencia({ idMedicamento,
                            fechaVencimiento: existencia.fecha_vencimiento,
                            precisionVencimiento: existencia.precision_vencimiento }), existencia);
                        const sufijo = existencia.codigo_existencia.match(/-(\d+)$/)?.[1];
                        if (sufijo && BigInt(sufijo) > mayor) mayor = BigInt(sufijo);
                    }
                    correlativos.set(idMedicamento, mayor);
                }

                // Un instante después de los bloqueos, antes de cualquier INSERT.
                const { fechaComercial, fechaHoraComercial } = obtenerFechaOperacion();
                if (data.fechaCompra > fechaComercial) throw new AppError('La fecha de compra no puede ser futura', 400);
                for (const [clave, grupo] of grupos) {
                    if (calcularVencimiento(grupo.fechaVencimiento, grupo.precisionVencimiento, fechaComercial).vencida) {
                        throw new AppError('No se puede recibir una existencia vencida', 409);
                    }
                    const anterior = existencias.get(clave);
                    const saldoAnterior = BigInt(anterior?.cantidad_fisica ?? 0);
                    const promedioAnterior = decimalAEntero(String(anterior?.costo_unitario_promedio ?? '0'), 6);
                    const saldoFinal = saldoAnterior + grupo.cantidadTotal;
                    if (saldoFinal > MAXIMO_INT) throw new AppError('El saldo final supera el máximo permitido', 409);
                    const promedioFinal = validarImporte(dividirYRedondear(
                        saldoAnterior * promedioAnterior + grupo.valorTotal, saldoFinal), 'El costo promedio');
                    Object.assign(grupo, {
                        idExistencia: anterior?.id_existencia,
                        saldoAnterior: Number(saldoAnterior),
                        promedioAnterior: enteroADecimal(promedioAnterior, 6),
                        saldoFinal: Number(saldoFinal),
                        promedioFinal: enteroADecimal(promedioFinal, 6)
                    });
                    if (!anterior) {
                        const correlativo = correlativos.get(grupo.idMedicamento) + 1n;
                        correlativos.set(grupo.idMedicamento, correlativo);
                        grupo.codigoExistencia = `${medicamentos.get(grupo.idMedicamento).codigo_medicamento}-${String(correlativo).padStart(3, '0')}`;
                        if (grupo.codigoExistencia.length > 30) throw new AppError('El código de existencia supera la longitud permitida', 409);
                    }
                }

                const compra = await compraRepository.create({ transaction, data: {
                    id_usuario: idUsuarioAutenticado, id_proveedor_laboratorio: idProveedorLaboratorio,
                    clave_operacion: data.claveOperacion, fecha_compra: data.fechaCompra,
                    fecha_registro: fechaHoraComercial, estado_operacion: 'CONFIRMADA', total: enteroADecimal(total, 2)
                } });
                for (const grupo of grupos.values()) {
                    if (grupo.idExistencia === undefined) {
                        const existencia = await existenciaMedicamentoRepository.create({ transaction, data: {
                            id_medicamento: grupo.idMedicamento, codigo_existencia: grupo.codigoExistencia,
                            fecha_vencimiento: grupo.fechaVencimiento, precision_vencimiento: grupo.precisionVencimiento,
                            cantidad_fisica: grupo.saldoFinal, costo_unitario_promedio: grupo.promedioFinal
                        } });
                        grupo.idExistencia = existencia.id_existencia;
                    } else {
                        const [actualizadas] = await existenciaMedicamentoRepository.updateSaldoYCosto({
                            idExistencia: grupo.idExistencia, cantidadFisica: grupo.saldoFinal,
                            costoUnitarioPromedio: grupo.promedioFinal, transaction
                        });
                        if (actualizadas !== 1) throw new AppError('No se pudo actualizar la existencia recibida', 409);
                    }
                }
                for (const linea of lineas) {
                    const grupo = grupos.get(linea.clave);
                    const detalle = await compraRepository.createDetalle({ transaction, data: {
                        id_compra: compra.id_compra, id_existencia: grupo.idExistencia, cantidad: linea.cantidad,
                        costo_unitario: linea.costoUnitario, subtotal: linea.subtotal,
                        saldo_anterior: grupo.saldoAnterior, costo_promedio_anterior: grupo.promedioAnterior
                    } });
                    await movimientoInventarioRepository.create({ transaction, data: {
                        id_usuario: idUsuarioAutenticado, id_existencia: grupo.idExistencia,
                        id_detalle_compra: detalle.id_detalle_compra, id_detalle_venta: null,
                        id_movimiento_original: null, direccion: 'ENTRADA', cantidad: linea.cantidad,
                        costo_unitario_aplicado: linea.costoUnitario, fecha_movimiento: fechaHoraComercial,
                        motivo: 'Compra', observacion: null
                    } });
                }
                // Leer la respuesta dentro de la transacción: si falla, rollback.
                // La promesa gestionada no devuelve al Controller hasta el commit.
                return this.getCompraById(compra.id_compra, transaction);
            });
        } catch (error) { manejarErrorRegistro(error); }
    }

    static async getCompras(filtros = {}, idUsuarioAutenticado) {
        const filtrosConsulta = { ...filtros };
        if (filtros.claveOperacion !== undefined) {
            if (!Number.isInteger(idUsuarioAutenticado) || idUsuarioAutenticado <= 0 ||
                idUsuarioAutenticado > 2147483647) {
                throw new AppError('No autenticado', 401);
            }
            // La identidad proviene de la sesión, nunca del filtro del cliente.
            filtrosConsulta.idUsuario = idUsuarioAutenticado;
        }
        const compras = await compraRepository.findAll(filtrosConsulta);
        return compras.map((compra) => toPublicCompra(toPlain(compra)));
    }

    static async getCompraById(idCompra, transaction) {
        const compra = await compraRepository.findById(idCompra, { transaction });
        if (!compra) throw new AppError('Compra no encontrada', 404);
        const data = toPlain(compra);
        return { ...toPublicCompra(data), detalles: data.detallesCompra.map(toPublicDetalle) };
    }
}
