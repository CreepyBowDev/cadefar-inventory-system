import db from '../../data/models/index.js';
import { ventaRepository } from '../../data/repositories/venta.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { medicamentoRepository } from '../../data/repositories/medicamento.repository.js';
import { existenciaMedicamentoRepository } from '../../data/repositories/existencia-medicamento.repository.js';
import { decimalAEntero, enteroADecimal, dividirYRedondear,
    MAXIMO_COEFICIENTE_DECIMAL_14 } from '../../shared/utils/decimal.js';
import { obtenerFechaOperacion } from '../../shared/utils/fecha-operacion.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { referenciasAuditoriaAcotadas } from '../../shared/utils/auditoria-catalogo.js';
import { recetaRepository } from '../../data/repositories/receta.repository.js';
import { movimientoInventarioRepository } from '../../data/repositories/movimiento-inventario.repository.js';
import { calcularVencimiento, compararVencimientos } from '../../shared/utils/vencimiento.js';
import { MOTIVOS_MOVIMIENTO } from '../../shared/constants/motivos-movimiento.js';

const toPlain = registro => registro.get ? registro.get({ plain: true }) : registro;
const conflicto = mensaje => anotarErrorAuditoria(new AppError(mensaje, 409), { causa: 'CONFLICTO' });
const cantidadPersistida = (valor, admiteCero = false) => {
    if (!Number.isInteger(valor) || valor < (admiteCero ? 0 : 1) || valor > 2147483647) {
        throw conflicto('La cantidad almacenada es inconsistente');
    }
    return BigInt(valor);
};
const decimalPersistido = (valor, escala) => {
    let numero;
    try { numero = decimalAEntero(String(valor), escala); }
    catch (error) {
        if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
        throw conflicto('El importe o costo almacenado es inconsistente');
    }
    if (numero > MAXIMO_COEFICIENTE_DECIMAL_14) throw conflicto('El importe o costo almacenado excede su límite');
    return numero;
};
const validarImporte = valor => {
    if (valor > MAXIMO_COEFICIENTE_DECIMAL_14) throw anotarErrorAuditoria(
        new AppError('El subtotal o total supera el importe máximo permitido', 400), { causa: 'ENTRADA_INVALIDA' });
    return valor;
};
const manejarErrorRegistro = error => {
    if (error.name === 'SequelizeUniqueConstraintError') {
        const indice = (error.parent?.sqlMessage || error.original?.sqlMessage || '')
            .match(/for key ['`](?:[^'`]*\.)?([^'`]+)['`]/i)?.[1];
        const campos = Object.keys(error.fields || {});
        if (indice === 'uq_venta_clave_operacion' ||
            (!indice && campos.length === 1 && campos[0] === 'clave_operacion')) {
            throw conflicto('La clave de operación ya está registrada');
        }
    }
    const codigo = error.parent?.code || error.original?.code;
    if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
        throw conflicto('La venta pendiente no pudo guardarse por contención temporal. Reintente con la misma clave de operación');
    }
    throw error;
};

export class ventaService {
    static async anularVenta(idVenta, motivo, idUsuario, auditoria) {
        if (!Number.isInteger(idUsuario) || idUsuario <= 0 || idUsuario > 2147483647) throw new AppError('No autenticado', 401);
        return bitacoraAuditoriaService.ejecutarCambio('VENTA_ANULAR', auditoria,
            { tipo: 'VENTA', id: idVenta }, seguimiento => this.#anularVenta(idVenta, motivo, idUsuario, seguimiento));
    }

    static async #anularVenta(idVenta, motivo, idUsuario, seguimiento) {
        try {
            return await db.sequelize.transaction(async transaction => {
                seguimiento.transaction = transaction;
                const registro = await ventaRepository.findParaAnular({ idVenta, transaction });
                if (!registro) throw anotarErrorAuditoria(new AppError('Venta no encontrada', 404), { causa: 'NO_ENCONTRADO' });
                const venta = toPlain(registro);
                if (venta.estado_operacion === 'ANULADA') throw conflicto('La venta ya está anulada');
                if (!['PENDIENTE', 'CONFIRMADA'].includes(venta.estado_operacion) ||
                    venta.fecha_anulacion !== null || venta.motivo_anulacion !== null || venta.id_usuario_anulador !== null ||
                    (venta.estado_operacion === 'PENDIENTE' ? venta.fecha_venta !== null : venta.fecha_venta === null)) {
                    throw conflicto('El estado o las fechas de la venta son inconsistentes para anular');
                }
                const detalles = (await ventaRepository.findDetallesParaAnular({ idVenta, transaction })).map(toPlain);
                const idsDetallesVenta = detalles.map(d => d.id_detalle_venta);
                const grupos = new Map();
                let originales = [];
                if (venta.estado_operacion === 'CONFIRMADA') {
                    if (!detalles.length) throw conflicto('La venta confirmada no tiene detalles para compensar');
                    // La actividad del medicamento y el vencimiento no impiden
                    // devolver stock físico histórico a sus existencias originales.
                    for (const idExistencia of [...new Set(detalles.map(d => d.id_existencia))].sort((a, b) => a - b)) {
                        const registroExistencia = await existenciaMedicamentoRepository.findByIdParaAnular({ idExistencia, transaction });
                        if (!registroExistencia) throw conflicto('No se encontró una existencia original de la venta');
                        const existencia = toPlain(registroExistencia);
                        grupos.set(idExistencia, { idExistencia,
                            saldoAnterior: cantidadPersistida(existencia.cantidad_fisica, true),
                            promedioAnterior: decimalPersistido(existencia.costo_unitario_promedio, 6), cantidad: 0n, valor: 0n });
                    }
                    originales = (await movimientoInventarioRepository.findParaAnularVenta({ idsDetallesVenta, transaction })).map(toPlain);
                    if (originales.length !== detalles.length) throw conflicto('Las salidas originales de la venta están incompletas o duplicadas');
                    const porDetalle = new Map();
                    for (const original of originales) {
                        if (porDetalle.has(original.id_detalle_venta)) throw conflicto('Un detalle tiene más de un movimiento asociado');
                        porDetalle.set(original.id_detalle_venta, original);
                    }
                    for (const detalle of detalles) {
                        const original = porDetalle.get(detalle.id_detalle_venta);
                        if (!original || original.id_existencia !== detalle.id_existencia ||
                            original.direccion !== 'SALIDA' || original.motivo !== MOTIVOS_MOVIMIENTO.VENTA ||
                            original.id_detalle_compra !== null || original.id_movimiento_original !== null ||
                            original.cantidad !== detalle.cantidad) {
                            throw conflicto('La salida original no coincide con el detalle de venta');
                        }
                        const cantidad = cantidadPersistida(original.cantidad);
                        const costo = decimalPersistido(original.costo_unitario_aplicado, 6);
                        const grupo = grupos.get(detalle.id_existencia);
                        grupo.cantidad += cantidad; grupo.valor += cantidad * costo;
                    }
                    if ((await movimientoInventarioRepository.findReversiones({
                        idsOriginales: originales.map(m => m.id_movimiento), transaction })).length) {
                        throw conflicto('Una salida de la venta ya tiene una reversión');
                    }
                    // Política aprobada en RN78: entrada al valor original,
                    // agrupada por existencia. No aplicar B1/A de Compras.
                    for (const grupo of grupos.values()) {
                        grupo.saldoFinal = grupo.saldoAnterior + grupo.cantidad;
                        if (grupo.saldoFinal > 2147483647n) throw conflicto('La devolución supera el saldo máximo permitido');
                        grupo.promedioFinal = dividirYRedondear(
                            grupo.saldoAnterior * grupo.promedioAnterior + grupo.valor, grupo.saldoFinal);
                        if (grupo.promedioFinal > MAXIMO_COEFICIENTE_DECIMAL_14) throw conflicto('El promedio devuelto supera el máximo permitido');
                    }
                } else if (idsDetallesVenta.length && (await movimientoInventarioRepository.findParaAnularVenta({ idsDetallesVenta, transaction })).length) {
                    throw conflicto('La venta pendiente tiene movimientos incompatibles con su estado');
                }
                // Todo el plan queda validado antes de escribir. Un solo instante
                // posterior a los bloqueos para cabecera y todas las reversiones.
                const { fechaHoraComercial } = obtenerFechaOperacion();
                const antes = { estadoOperacion: venta.estado_operacion,
                    total: enteroADecimal(decimalPersistido(venta.total, 2), 2), cantidadDetalles: detalles.length };
                for (const grupo of grupos.values()) {
                    const [actualizadas] = await existenciaMedicamentoRepository.reintegrarPorAnulacionVenta({
                        idExistencia: grupo.idExistencia, saldoAnterior: Number(grupo.saldoAnterior),
                        promedioAnterior: enteroADecimal(grupo.promedioAnterior, 6), saldoFinal: Number(grupo.saldoFinal),
                        promedioFinal: enteroADecimal(grupo.promedioFinal, 6), transaction });
                    if (actualizadas !== 1) throw conflicto('El saldo o promedio cambió durante la anulación de la venta');
                }
                const referenciasReversiones = [];
                for (const original of originales) {
                    const reversion = await movimientoInventarioRepository.create({ transaction, data: {
                        id_existencia: original.id_existencia, id_usuario: idUsuario,
                        id_detalle_venta: original.id_detalle_venta, id_detalle_compra: null,
                        id_movimiento_original: original.id_movimiento, direccion: 'ENTRADA', cantidad: original.cantidad,
                        costo_unitario_aplicado: original.costo_unitario_aplicado,
                        motivo: MOTIVOS_MOVIMIENTO.ANULACION_VENTA, observacion: motivo, fecha_movimiento: fechaHoraComercial
                    } });
                    referenciasReversiones.push({ tipo: 'MOVIMIENTO', id: reversion.id_movimiento });
                }
                const [anuladas] = await ventaRepository.anular({ idVenta, estadoAnterior: venta.estado_operacion,
                    motivo, idUsuario, fechaHora: fechaHoraComercial, transaction });
                if (anuladas !== 1) throw conflicto('La venta no pudo anularse en su estado actual');
                const resultado = await this.getVentaById(idVenta, transaction);
                const referencias = referenciasAuditoriaAcotadas([
                    ...idsDetallesVenta.map(id => ({ tipo: 'DETALLE_VENTA', id })),
                    ...[...grupos.keys()].map(id => ({ tipo: 'EXISTENCIA', id })),
                    ...originales.map(m => ({ tipo: 'MOVIMIENTO', id: m.id_movimiento })), ...referenciasReversiones
                ]);
                await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                    registro: { tipo: 'VENTA', id: idVenta }, antes, despues: { ...antes, estadoOperacion: 'ANULADA' },
                    referencias: referencias.referencias, metadatos: { cantidadDetalles: detalles.length,
                        cantidadExistencias: grupos.size, cantidadMovimientos: referenciasReversiones.length,
                        cantidadReferenciasOmitidas: referencias.cantidadReferenciasOmitidas }
                }, transaction);
                return resultado;
            });
        } catch (error) {
            const codigo = error.parent?.code || error.original?.code;
            if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
                throw conflicto('La venta no pudo anularse por contención temporal. Consulte su estado y reintente si no está anulada');
            }
            if (error.name === 'SequelizeUniqueConstraintError') {
                const indice = (error.parent?.sqlMessage || error.original?.sqlMessage || '')
                    .match(/for key ['`](?:[^'`]*\.)?([^'`]+)['`]/i)?.[1];
                const campos = Object.keys(error.fields || {});
                if (indice === 'uq_movimiento_original' || (!indice && campos.length === 1 && campos[0] === 'id_movimiento_original')) {
                    throw conflicto('Una salida de la venta ya tiene una reversión');
                }
            }
            throw error;
        }
    }

    static async confirmarVenta(idVenta, idUsuario, auditoria) {
        if (!Number.isInteger(idUsuario) || idUsuario <= 0 || idUsuario > 2147483647) throw new AppError('No autenticado', 401);
        return bitacoraAuditoriaService.ejecutarCambio('VENTA_CONFIRMAR', auditoria,
            { tipo: 'VENTA', id: idVenta }, seguimiento => this.#confirmarVenta(idVenta, idUsuario, seguimiento));
    }

    static async #confirmarVenta(idVenta, idUsuario, seguimiento) {
        try {
            // La referencia provisional permite descubrir medicamentos antes de
            // bloquearlos. RC evita conservar un snapshot anterior a esa espera;
            // la identidad se comprueba otra vez con las existencias bloqueadas.
            return await db.sequelize.transaction({
                isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
            }, async transaction => {
                seguimiento.transaction = transaction;
                const registro = await ventaRepository.findParaConfirmar({ idVenta, transaction });
                if (!registro) throw anotarErrorAuditoria(new AppError('Venta no encontrada', 404), { causa: 'NO_ENCONTRADO' });
                const venta = toPlain(registro);
                if (venta.estado_operacion !== 'PENDIENTE') throw conflicto('Solo se puede confirmar una venta pendiente');
                if (venta.fecha_venta !== null) throw conflicto('La venta pendiente ya tiene una fecha de venta inconsistente');
                const detalles = (await ventaRepository.findDetallesParaConfirmar({ idVenta, transaction })).map(toPlain);
                if (!detalles.length) throw conflicto('La venta debe contener al menos un detalle');
                const idsProvisionales = [...new Set(detalles.map(d => d.id_existencia))];
                const referencias = (await existenciaMedicamentoRepository.findReferenciasParaVenta({
                    idsExistencias: idsProvisionales, transaction })).map(toPlain);
                if (referencias.length !== idsProvisionales.length) throw conflicto('La selección provisional de existencias es inconsistente');
                const medicamentoPorExistencia = new Map(referencias.map(e => [e.id_existencia, e.id_medicamento]));
                const idsMedicamentos = [...new Set(referencias.map(e => e.id_medicamento))].sort((a, b) => a - b);
                const idsRecetas = [...new Set(detalles.map(d => d.id_receta).filter(id => id !== null))].sort((a, b) => a - b);
                const recetas = new Map(idsRecetas.length ? (await recetaRepository.findParaConfirmacion({
                    idVenta, idsRecetas, transaction })).map(toPlain).map(r => [r.id_receta, r]) : []);
                if (recetas.size !== idsRecetas.length) throw conflicto('Las recetas vinculadas deben pertenecer a la misma venta');
                const medicamentos = new Map();
                for (const idMedicamento of idsMedicamentos) {
                    const medicamento = await medicamentoRepository.findById({ idMedicamento, transaction, lock: true });
                    if (!medicamento || !toPlain(medicamento).estado) throw conflicto('No se puede confirmar una venta con medicamentos inactivos o inexistentes');
                    const data = toPlain(medicamento);
                    if (!['LIBRE', 'RECETA_MEDICA'].includes(data.condicion_venta)) {
                        throw conflicto('La condición de venta del medicamento no está reconocida');
                    }
                    medicamentos.set(idMedicamento, data);
                }
                for (const detalle of detalles) {
                    const requiereReceta = medicamentos.get(medicamentoPorExistencia.get(detalle.id_existencia)).condicion_venta === 'RECETA_MEDICA';
                    const receta = recetas.get(detalle.id_receta);
                    if (requiereReceta || detalle.id_receta !== null) {
                        if (!receta || receta.resultado_revision !== 'APROBADA' ||
                            !Number.isInteger(receta.id_usuario_validador) || receta.id_usuario_validador <= 0 ||
                            receta.fecha_validacion === null) {
                            throw conflicto('La venta requiere que las recetas utilizadas estén aprobadas');
                        }
                    }
                }
                const existencias = (await existenciaMedicamentoRepository.findParaConfirmarVenta({
                    idsMedicamentos, transaction })).map(toPlain);
                const porId = new Map(existencias.map(e => [e.id_existencia, e]));
                for (const referencia of referencias) {
                    if (porId.get(referencia.id_existencia)?.id_medicamento !== referencia.id_medicamento) {
                        throw conflicto('La existencia provisional cambió de medicamento; vuelva a preparar la venta');
                    }
                }
                if ((await movimientoInventarioRepository.findPorDetallesVenta({
                    idsDetallesVenta: detalles.map(d => d.id_detalle_venta), transaction })).length) {
                    throw conflicto('Una venta pendiente no puede tener movimientos de inventario previos');
                }
                // Un único instante, después de los bloqueos: no vender una
                // existencia que venció mientras esta operación esperaba stock.
                const { fechaComercial, fechaHoraComercial } = obtenerFechaOperacion();
                const disponibles = new Map(idsMedicamentos.map(id => [id, []]));
                for (const existencia of existencias) {
                    const saldo = cantidadPersistida(existencia.cantidad_fisica, true);
                    if (saldo === 0n) continue;
                    let vencimiento;
                    try { vencimiento = calcularVencimiento(existencia.fecha_vencimiento, existencia.precision_vencimiento, fechaComercial); }
                    catch (error) {
                        if (!(error instanceof RangeError)) throw error;
                        throw conflicto('El vencimiento almacenado es inconsistente');
                    }
                    if (vencimiento.vencida) continue;
                    disponibles.get(existencia.id_medicamento).push({ ...vencimiento,
                        idExistencia: existencia.id_existencia, saldoAnterior: saldo, restante: saldo,
                        costo: enteroADecimal(decimalPersistido(existencia.costo_unitario_promedio, 6), 6) });
                }
                for (const grupo of disponibles.values()) grupo.sort(compararVencimientos);
                const plan = [], consumos = new Map();
                let total = 0n;
                for (const detalle of detalles) {
                    let pendiente = cantidadPersistida(detalle.cantidad);
                    const precio = decimalPersistido(detalle.precio_unitario, 2);
                    const subtotal = pendiente * precio;
                    total += subtotal;
                    if (subtotal !== decimalPersistido(detalle.subtotal, 2) || total > MAXIMO_COEFICIENTE_DECIMAL_14) {
                        throw conflicto('Los subtotales almacenados de la venta son inconsistentes');
                    }
                    const segmentos = [];
                    for (const existencia of disponibles.get(medicamentoPorExistencia.get(detalle.id_existencia))) {
                        if (!pendiente) break;
                        const cantidad = pendiente < existencia.restante ? pendiente : existencia.restante;
                        if (!cantidad) continue;
                        existencia.restante -= cantidad; pendiente -= cantidad;
                        consumos.set(existencia.idExistencia, existencia);
                        segmentos.push({ existencia, cantidad: Number(cantidad), subtotal: enteroADecimal(cantidad * precio, 2) });
                    }
                    if (pendiente) throw anotarErrorAuditoria(new AppError('Stock vendible insuficiente para confirmar la venta', 409), { causa: 'STOCK_INSUFICIENTE' });
                    plan.push({ detalle, segmentos, precioUnitario: enteroADecimal(precio, 2) });
                }
                if (total !== decimalPersistido(venta.total, 2)) throw conflicto('El total almacenado de la venta es inconsistente');
                // No escribir hasta completar todas las validaciones y el plan FEFO.
                for (const existencia of [...consumos.values()].sort((a, b) => a.idExistencia - b.idExistencia)) {
                    const [actualizadas] = await existenciaMedicamentoRepository.descontarParaVenta({
                        idExistencia: existencia.idExistencia, saldoEsperado: Number(existencia.saldoAnterior),
                        cantidad: Number(existencia.saldoAnterior - existencia.restante), transaction });
                    if (actualizadas !== 1) throw conflicto('El saldo cambió durante la confirmación de la venta');
                }
                const referenciasDetalles = [], referenciasMovimientos = [];
                for (const linea of plan) {
                    for (const [indice, segmento] of linea.segmentos.entries()) {
                        const data = { id_existencia: segmento.existencia.idExistencia, id_receta: linea.detalle.id_receta,
                            cantidad: segmento.cantidad, precio_unitario: linea.precioUnitario, subtotal: segmento.subtotal };
                        let idDetalleVenta = linea.detalle.id_detalle_venta;
                        if (indice === 0) {
                            // Precio/subtotal ya fueron verificados. Si tampoco
                            // cambian existencia ni cantidad, MySQL puede informar
                            // cero filas modificadas: no emitir un UPDATE idéntico.
                            if (linea.detalle.id_existencia !== data.id_existencia || linea.detalle.cantidad !== data.cantidad) {
                                const [actualizados] = await ventaRepository.finalizarDetalle({ idVenta, idDetalleVenta, data, transaction });
                                if (actualizados !== 1) throw conflicto('No se pudo finalizar un detalle de la venta');
                            }
                        } else {
                            const detalle = await ventaRepository.createDetalle({ data: { ...data, id_venta: idVenta }, transaction });
                            idDetalleVenta = detalle.id_detalle_venta;
                        }
                        referenciasDetalles.push({ tipo: 'DETALLE_VENTA', id: idDetalleVenta });
                        const movimiento = await movimientoInventarioRepository.create({ transaction, data: {
                            id_usuario: idUsuario, id_existencia: segmento.existencia.idExistencia,
                            id_detalle_venta: idDetalleVenta, id_detalle_compra: null, id_movimiento_original: null,
                            direccion: 'SALIDA', motivo: MOTIVOS_MOVIMIENTO.VENTA, cantidad: segmento.cantidad,
                            costo_unitario_aplicado: segmento.existencia.costo, fecha_movimiento: fechaHoraComercial, observacion: null
                        } });
                        referenciasMovimientos.push({ tipo: 'MOVIMIENTO', id: movimiento.id_movimiento });
                    }
                }
                const [confirmadas] = await ventaRepository.confirmar({ idVenta, total: enteroADecimal(total, 2),
                    fechaHora: fechaHoraComercial, transaction });
                if (confirmadas !== 1) throw conflicto('La venta no pudo confirmarse en su estado actual');
                const resultado = await this.getVentaById(idVenta, transaction);
                const referenciasAuditoria = referenciasAuditoriaAcotadas([...referenciasDetalles,
                    ...[...consumos.keys()].map(id => ({ tipo: 'EXISTENCIA', id })), ...referenciasMovimientos]);
                await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                    registro: { tipo: 'VENTA', id: idVenta },
                    antes: { estadoOperacion: 'PENDIENTE', total: enteroADecimal(total, 2), cantidadDetalles: detalles.length },
                    despues: { estadoOperacion: 'CONFIRMADA', total: enteroADecimal(total, 2), cantidadDetalles: referenciasDetalles.length },
                    referencias: referenciasAuditoria.referencias,
                    metadatos: { cantidadDetalles: referenciasDetalles.length, cantidadExistencias: consumos.size,
                        cantidadMovimientos: referenciasMovimientos.length, cantidadReferenciasOmitidas: referenciasAuditoria.cantidadReferenciasOmitidas }
                }, transaction);
                return resultado;
            });
        } catch (error) {
            const codigo = error.parent?.code || error.original?.code;
            if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
                throw conflicto('La venta no pudo confirmarse por contención temporal. Consulte su estado y reintente si sigue pendiente');
            }
            throw error;
        }
    }

    static async createVenta(data, idUsuarioAutenticado, auditoria) {
        if (!Number.isInteger(idUsuarioAutenticado) || idUsuarioAutenticado <= 0 ||
            idUsuarioAutenticado > 2147483647) throw new AppError('No autenticado', 401);
        return bitacoraAuditoriaService.ejecutarCambio('VENTA_REGISTRAR_PENDIENTE', auditoria, undefined,
            seguimiento => this.#createVenta(data, idUsuarioAutenticado, seguimiento));
    }

    static async #createVenta(data, idUsuario, seguimiento) {
        let total = 0n;
        const lineas = data.detalles.map(detalle => {
            const subtotal = validarImporte(BigInt(detalle.cantidad) * decimalAEntero(detalle.precioUnitario, 2));
            total = validarImporte(total + subtotal);
            return { ...detalle, subtotal: enteroADecimal(subtotal, 2) };
        });
        try {
            // Auxiliar sin snapshot de negocio; UNIQUE es la barrera final ante concurrencia.
            if (await ventaRepository.findByClave({ claveOperacion: data.claveOperacion })) {
                throw conflicto('La clave de operación ya está registrada');
            }
            return await db.sequelize.transaction(async transaction => {
                seguimiento.transaction = transaction;
                // Mismo orden que Compras: medicamentos antes de existencias, IDs ascendentes.
                for (const idMedicamento of [...new Set(lineas.map(d => d.idMedicamento))].sort((a, b) => a - b)) {
                    const registro = await medicamentoRepository.findById({ idMedicamento, transaction, lock: true });
                    if (!registro) throw new AppError('Medicamento no encontrado', 404);
                    if (!toPlain(registro).estado) throw conflicto('No se puede incluir un medicamento inactivo');
                }
                const existencias = new Map();
                for (const idExistencia of [...new Set(lineas.map(d => d.idExistencia))].sort((a, b) => a - b)) {
                    const registro = await existenciaMedicamentoRepository.findByIdParaVenta({ idExistencia, transaction });
                    if (!registro) throw new AppError('Existencia no encontrada', 404);
                    existencias.set(idExistencia, toPlain(registro));
                }
                for (const linea of lineas) {
                    if (existencias.get(linea.idExistencia).id_medicamento !== linea.idMedicamento) {
                        throw conflicto('La existencia provisional no pertenece al medicamento indicado');
                    }
                }
                // La selección provisional no exige saldo ni vencimiento vendible.
                // Los bloqueos duran solo esta transacción, no constituyen una reserva.
                const { fechaHoraComercial } = obtenerFechaOperacion();
                const venta = await ventaRepository.create({ transaction, data: {
                    id_usuario: idUsuario, clave_operacion: data.claveOperacion,
                    fecha_registro: fechaHoraComercial, fecha_venta: null,
                    estado_operacion: 'PENDIENTE', total: enteroADecimal(total, 2)
                } });
                const referenciasDetalles = [];
                for (const linea of lineas) {
                    const detalle = await ventaRepository.createDetalle({ transaction, data: {
                        id_venta: venta.id_venta, id_existencia: linea.idExistencia, id_receta: null,
                        cantidad: linea.cantidad, precio_unitario: linea.precioUnitario, subtotal: linea.subtotal
                    } });
                    referenciasDetalles.push({ tipo: 'DETALLE_VENTA', id: detalle.id_detalle_venta });
                }
                const resultado = await this.getVentaById(venta.id_venta, transaction);
                const { referencias, cantidadReferenciasOmitidas } = referenciasAuditoriaAcotadas([
                    ...referenciasDetalles,
                    ...[...existencias.keys()].map(id => ({ tipo: 'EXISTENCIA', id }))
                ]);
                await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                    registro: { tipo: 'VENTA', id: venta.id_venta },
                    despues: { estadoOperacion: 'PENDIENTE', total: enteroADecimal(total, 2), cantidadDetalles: lineas.length },
                    referencias, metadatos: { cantidadDetalles: lineas.length,
                        cantidadExistencias: existencias.size, cantidadMovimientos: 0, cantidadReferenciasOmitidas }
                }, transaction);
                return resultado;
            });
        } catch (error) { manejarErrorRegistro(error); }
    }

    static async getVentas(filtros) {
        // Total y página pertenecen al mismo snapshot, como la consulta de Bitácora.
        return db.sequelize.transaction({
            isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
        }, transaction => ventaRepository.findAll(filtros, { transaction }));
    }

    static async getVentaById(idVenta, transaction) {
        const venta = await ventaRepository.findById(idVenta, { transaction });
        if (!venta) throw new AppError('Venta no encontrada', 404);
        return venta;
    }
}
