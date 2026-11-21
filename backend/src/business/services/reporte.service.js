import db from '../../data/models/index.js';
import { reporteRepository } from '../../data/repositories/reporte.repository.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { comprobarLimiteIntervalos, materializarEstadisticas } from './reporte.estadisticas.js';
import { materializarVenta, materializarCompra, materializarPerdida,
    materializarResumenVentas, materializarResumenCompras,
    materializarResumenPerdidas } from './reporte.materializacion.js';

export class reporteService {
    static async estadisticasPerdidas(filtros, auditoria) {
        return consultarEstadisticas('PERDIDAS', filtros, auditoria);
    }

    static async estadisticasVentas(filtros, auditoria) {
        return consultarEstadisticas('VENTAS', filtros, auditoria);
    }

    static async estadisticasCompras(filtros, auditoria) {
        return consultarEstadisticas('COMPRAS', filtros, auditoria);
    }

    static async consultarPerdidas(filtros, { contexto, responsable }) {
        const resultado = await db.sequelize.transaction({
            isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
        }, async transaction => {
            const { grupos, rows } = await reporteRepository.consultarPerdidas(filtros, { transaction });
            const { resumen, total } = materializarResumenPerdidas(grupos);
            const detalle = rows.map(materializarPerdida);
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
            const { resumen, total } = materializarResumenCompras(grupos);
            const detalle = rows.map(materializarCompra);
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
            const { resumen, total } = materializarResumenVentas(grupos);
            const detalle = rows.map(materializarVenta);
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

const consultarEstadisticas = async (fuente, filtros, { contexto, responsable }) => {
    comprobarLimiteIntervalos(filtros.periodo, filtros.granularidad);
    const data = await db.sequelize.transaction({
        isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
    }, async transaction => {
        const agregados = await reporteRepository[{
            VENTAS: 'estadisticasVentas', COMPRAS: 'estadisticasCompras', PERDIDAS: 'estadisticasPerdidas'
        }[fuente]](
            filtros, { transaction });
        return materializarEstadisticas(fuente, filtros, agregados);
    });
    await bitacoraAuditoriaService.intentarRegistrar({ contexto, responsable,
        tipoEvento: `REPORTE_${fuente}_ESTADISTICAS`, resultado: 'EXITO',
        metadatos: { granularidad: data.granularidad, cantidadIntervalos: data.intervalos.length } });
    return { data };
};
