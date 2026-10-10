import { existenciaMedicamentoRepository } from '../../data/repositories/existencia-medicamento.repository.js';
import { movimientoInventarioRepository } from '../../data/repositories/movimiento-inventario.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { calcularVencimiento, obtenerFechaComercial, obtenerFechaEtiquetaNormalizada,
    sumarMesesCalendario, ZONA_HORARIA_COMERCIAL } from '../../shared/utils/vencimiento.js';

const toPlain = (registro) => registro.get ? registro.get({ plain: true }) : registro;
const decimal6 = (valor) => {
    const [entero, decimales = ''] = String(valor).split('.');
    return `${entero}.${decimales.padEnd(6, '0')}`;
};
const disponibilidadMeta = (fechaComercial) => ({ fechaComercial, zonaHoraria: ZONA_HORARIA_COMERCIAL });
const compararVencimientos = (a, b) => Number(a.fechaEfectivaVencimiento.replaceAll('-', '')) -
    Number(b.fechaEfectivaVencimiento.replaceAll('-', '')) || a.idExistencia - b.idExistencia;

const toPublicExistencias = (medicamento, fechaComercial) => (
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

export class inventarioService {
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
            data: toPublicExistencias(toPlain(registro), fechaComercial),
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
