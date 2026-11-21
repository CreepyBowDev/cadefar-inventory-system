import { decimalAEntero, enteroADecimal, dividirYRedondear } from '../../shared/utils/decimal.js';
import { MOTIVOS_MOVIMIENTO } from '../../shared/constants/motivos-movimiento.js';

const importe = valor => enteroADecimal(decimalAEntero(valor, 2), 2);
const categorias = { CONFIRMADA: 'confirmadas', PENDIENTE: 'pendientes',
    ANULADA_CONFIRMADA: 'anuladasConfirmadas', ANULADA_SIN_CONFIRMAR: 'anuladasSinConfirmar' };

// Funciones puras sobre filas raw del Repository: no DB, HTTP ni auditoría.
// Proyectan solo campos permitidos; no propagar columnas privadas a renderizadores.
export const materializarVenta = row => ({ idVenta: row.id_venta, estadoOperacion: row.estado_operacion,
    categoria: row.categoria, fechaReferencia: row.fecha_referencia,
    fechaRegistro: row.fecha_registro, fechaVenta: row.fecha_venta,
    fechaAnulacion: row.fecha_anulacion, total: importe(row.total) });

export const materializarCompra = row => ({ idCompra: row.id_compra,
    idProveedorLaboratorio: row.id_proveedor_laboratorio, estadoOperacion: row.estado_operacion,
    fechaReferencia: row.fecha_compra, fechaCompra: row.fecha_compra,
    fechaRegistro: row.fecha_registro, fechaAnulacion: row.fecha_anulacion, total: importe(row.total) });

export const materializarPerdida = row => {
    const costo = decimalAEntero(row.costo_unitario_aplicado, 6);
    return { idMovimiento: row.id_movimiento, idExistencia: row.id_existencia,
        idMedicamento: row.id_medicamento, codigoExistencia: row.codigo_existencia,
        codigoMedicamento: row.codigo_medicamento, nombreComercial: row.nombre_comercial,
        idUsuario: row.id_usuario, motivo: row.motivo, fechaReferencia: row.fecha_movimiento,
        fechaMovimiento: row.fecha_movimiento, cantidad: row.cantidad,
        costoUnitarioAplicado: enteroADecimal(costo, 6),
        perdida: enteroADecimal(dividirYRedondear(BigInt(row.cantidad) * costo, 10000n), 2),
        idMovimientoReversion: row.id_movimiento_reversion ?? null };
};

const contar = (valor, total) => {
    const cantidad = Number(valor);
    if (!Number.isSafeInteger(cantidad) || cantidad < 0 || !Number.isSafeInteger(total + cantidad)) {
        throw new RangeError('Conteo no representable');
    }
    return cantidad;
};

export const materializarResumenVentas = grupos => {
    const resumen = Object.fromEntries(Object.values(categorias).map(nombre =>
        [nombre, { cantidad: 0, importe: '0.00' }]));
    let total = 0;
    for (const grupo of grupos) {
        const cantidad = contar(grupo.cantidad, total);
        resumen[categorias[grupo.categoria]] = { cantidad, importe: importe(grupo.importe) };
        total += cantidad;
    }
    resumen.totalVentasRealizadas = resumen.confirmadas.importe;
    return { resumen, total };
};

export const materializarResumenCompras = grupos => {
    const resumen = { confirmadas: { cantidad: 0, importe: '0.00' },
        anuladas: { cantidad: 0, importe: '0.00' } };
    let total = 0;
    for (const grupo of grupos) {
        const cantidad = contar(grupo.cantidad, total);
        const nombre = grupo.estado_operacion === 'CONFIRMADA' ? 'confirmadas' : 'anuladas';
        resumen[nombre] = { cantidad, importe: importe(grupo.importe) };
        total += cantidad;
    }
    resumen.totalComprasRealizadas = resumen.confirmadas.importe;
    return { resumen, total };
};

export const materializarResumenPerdidas = grupos => {
    const resumen = { vencimiento: { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' },
        dano: { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' } };
    let total = 0, unidades = 0n, centavos = 0n;
    for (const grupo of grupos) {
        const cantidad = contar(grupo.cantidad_retiros, total);
        const retirada = decimalAEntero(grupo.cantidad_retirada, 0);
        const perdida = decimalAEntero(grupo.perdida, 2);
        resumen[grupo.motivo === MOTIVOS_MOVIMIENTO.VENCIMIENTO ? 'vencimiento' : 'dano'] = {
            cantidadRetiros: cantidad, cantidadRetirada: retirada.toString(), perdida: enteroADecimal(perdida, 2) };
        total += cantidad;
        unidades += retirada;
        centavos += perdida;
    }
    Object.assign(resumen, { cantidadRetiros: total, cantidadRetirada: unidades.toString(),
        perdidaTotal: enteroADecimal(centavos, 2) });
    return { resumen, total };
};
