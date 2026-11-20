import db from '../../data/models/index.js';
import { reporteRepository } from '../../data/repositories/reporte.repository.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { decimalAEntero, enteroADecimal, dividirYRedondear } from '../../shared/utils/decimal.js';
import { MOTIVOS_MOVIMIENTO } from '../../shared/constants/motivos-movimiento.js';

const importe = valor => enteroADecimal(decimalAEntero(valor, 2), 2);
const categorias = { CONFIRMADA: 'confirmadas', PENDIENTE: 'pendientes',
    ANULADA_CONFIRMADA: 'anuladasConfirmadas', ANULADA_SIN_CONFIRMAR: 'anuladasSinConfirmar' };

export class reporteService {
    static async consultarPerdidas(filtros, { contexto, responsable }) {
        const resultado = await db.sequelize.transaction({
            isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
        }, async transaction => {
            const { grupos, rows } = await reporteRepository.consultarPerdidas(filtros, { transaction });
            const resumen = { vencimiento: { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' },
                dano: { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' } };
            let total = 0, unidades = 0n, centavos = 0n;
            for (const grupo of grupos) {
                const cantidad = Number(grupo.cantidad_retiros);
                if (!Number.isSafeInteger(cantidad) || cantidad < 0 || !Number.isSafeInteger(total + cantidad)) {
                    throw new RangeError('Conteo no representable');
                }
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
            const detalle = rows.map(row => {
                const costo = decimalAEntero(row.costo_unitario_aplicado, 6);
                return { idMovimiento: row.id_movimiento, idExistencia: row.id_existencia,
                    idMedicamento: row.id_medicamento, codigoExistencia: row.codigo_existencia,
                    codigoMedicamento: row.codigo_medicamento, nombreComercial: row.nombre_comercial,
                    idUsuario: row.id_usuario, motivo: row.motivo, fechaReferencia: row.fecha_movimiento,
                    fechaMovimiento: row.fecha_movimiento, cantidad: row.cantidad,
                    costoUnitarioAplicado: enteroADecimal(costo, 6),
                    perdida: enteroADecimal(dividirYRedondear(BigInt(row.cantidad) * costo, 10000n), 2),
                    idMovimientoReversion: row.id_movimiento_reversion ?? null };
            });
            return { data: { periodo: filtros.periodo, resumen, detalle }, paginacion: {
                pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) } };
        });
        await bitacoraAuditoriaService.intentarRegistrar({ contexto, responsable,
            tipoEvento: 'REPORTE_PERDIDAS_CONSULTAR', resultado: 'EXITO',
            metadatos: { cantidadResultados: resultado.data.detalle.length } });
        return resultado;
    }

    static async consultarCompras(filtros, { contexto, responsable }) {
        const resultado = await db.sequelize.transaction({
            isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
        }, async transaction => {
            const { grupos, rows } = await reporteRepository.consultarCompras(filtros, { transaction });
            const resumen = { confirmadas: { cantidad: 0, importe: '0.00' },
                anuladas: { cantidad: 0, importe: '0.00' } };
            let total = 0;
            for (const grupo of grupos) {
                const cantidad = Number(grupo.cantidad);
                if (!Number.isSafeInteger(cantidad) || cantidad < 0 || !Number.isSafeInteger(total + cantidad)) {
                    throw new RangeError('Conteo no representable');
                }
                const nombre = grupo.estado_operacion === 'CONFIRMADA' ? 'confirmadas' : 'anuladas';
                resumen[nombre] = { cantidad, importe: importe(grupo.importe) };
                total += cantidad;
            }
            resumen.totalComprasRealizadas = resumen.confirmadas.importe;
            const detalle = rows.map(row => ({ idCompra: row.id_compra,
                idProveedorLaboratorio: row.id_proveedor_laboratorio, estadoOperacion: row.estado_operacion,
                fechaReferencia: row.fecha_compra, fechaCompra: row.fecha_compra,
                fechaRegistro: row.fecha_registro, fechaAnulacion: row.fecha_anulacion, total: importe(row.total) }));
            return { data: { periodo: filtros.periodo, resumen, detalle }, paginacion: {
                pagina: filtros.pagina, limite: filtros.limite, total,
                totalPaginas: Math.ceil(total / filtros.limite)
            } };
        });
        // Independiente del snapshot ya terminado; no escribe operaciones de compra.
        await bitacoraAuditoriaService.intentarRegistrar({ contexto, responsable,
            tipoEvento: 'REPORTE_COMPRAS_CONSULTAR', resultado: 'EXITO',
            metadatos: { cantidadResultados: resultado.data.detalle.length } });
        return resultado;
    }

    static async consultarVentas(filtros, { contexto, responsable }) {
        const resultado = await db.sequelize.transaction({
            isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
        }, async transaction => {
            const { grupos, rows } = await reporteRepository.consultarVentas(filtros, { transaction });
            const resumen = Object.fromEntries(Object.values(categorias).map(nombre =>
                [nombre, { cantidad: 0, importe: '0.00' }]));
            let total = 0;
            for (const grupo of grupos) {
                const cantidad = Number(grupo.cantidad);
                if (!Number.isSafeInteger(cantidad) || cantidad < 0 || !Number.isSafeInteger(total + cantidad)) {
                    throw new RangeError('Conteo no representable');
                }
                resumen[categorias[grupo.categoria]] = { cantidad, importe: importe(grupo.importe) };
                total += cantidad;
            }
            resumen.totalVentasRealizadas = resumen.confirmadas.importe;
            const detalle = rows.map(row => ({ idVenta: row.id_venta, estadoOperacion: row.estado_operacion,
                categoria: row.categoria, fechaReferencia: row.fecha_referencia,
                fechaRegistro: row.fecha_registro, fechaVenta: row.fecha_venta,
                fechaAnulacion: row.fecha_anulacion, total: importe(row.total) }));
            return { data: { periodo: filtros.periodo, resumen, detalle }, paginacion: {
                pagina: filtros.pagina, limite: filtros.limite, total,
                totalPaginas: Math.ceil(total / filtros.limite)
            } };
        });
        // Lectura materializada y snapshot terminado antes de la auditoría independiente.
        await bitacoraAuditoriaService.intentarRegistrar({ contexto, responsable,
            tipoEvento: 'REPORTE_VENTAS_CONSULTAR', resultado: 'EXITO',
            metadatos: { cantidadResultados: resultado.data.detalle.length } });
        return resultado;
    }
}
