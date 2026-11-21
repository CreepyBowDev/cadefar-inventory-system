import db from '../../data/models/index.js';
import { reporteExtraccionRepository as extraccion } from '../../data/repositories/reporte.extraccion.repository.js';
import { reporteRepository } from '../../data/repositories/reporte.repository.js';
import { materializarEstadisticas, comprobarLimiteIntervalos } from './reporte.estadisticas.js';
import { COLUMNAS_REPORTE, proyectarFila, crearConciliacion, filasEstadisticas } from './reporte.plantillas.js';
import { crearArchivosReporte, leerSpool, errorLimiteExportacion, comprobarRecursosCsvLocal } from '../../shared/utils/reporte-archivos.js';
import { BOM_CSV, registroCsv } from '../../shared/utils/reporte-csv.js';
import { generarXlsx, MIME_XLSX } from '../../shared/utils/reporte-xlsx.js';
import { generarPdf, MIME_PDF } from '../../shared/utils/reporte-pdf.js';
import { obtenerFechaOperacion } from '../../shared/utils/fecha-operacion.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria, obtenerErrorAuditoria, marcarErrorAuditoriaGestionado } from '../../shared/utils/auditoria-error.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { entornoExportacionRailway } from '../../shared/utils/reporte-railway.js';
import { conPlazoSqlReporte } from '../../data/repositories/reporte-plazo-sql.js';

export const tiempoExportacionAgotado = () => anotarErrorAuditoria(new AppError(
    'Se agotó el tiempo de generación; reduzca los filtros o reintente', 503), { causa: 'TIEMPO_AGOTADO' });
export const cancelacionExportacion = () => anotarErrorAuditoria(new Error('Cancelación de exportación'), { causa: 'CANCELACION_CLIENTE' });
const noDisponible = () => new AppError('Formato no disponible', 503);
let ocupado = false, limpiezaPendiente = false;
let cerrando = false;
const trabajos = new Map();

export const reporteExportacionService = {
    // Railway es opt-in; no se simula una dirección loopback ni development.
    async comprobarDisponibilidad({ direccionRemota } = {}) {
        if (cerrando) return false;
        if (process.env.REPORTES_EXPORTACION_PERFIL === 'RAILWAY') return entornoExportacionRailway.disponibilidad();
        if (process.env.REPORTES_EXPORTACION_PERFIL && process.env.REPORTES_EXPORTACION_PERFIL !== 'LOCAL') return false;
        return comprobarRecursosCsvLocal(direccionRemota);
    },

    async cerrar() {
        cerrando = true;
        for (const controller of trabajos.keys()) controller.abort(cancelacionExportacion());
        await Promise.allSettled([...trabajos.values()]);
        await entornoExportacionRailway.cerrar();
    },

    async preparar(fuente, filtros, auditoria, { signal, direccionRemota } = {}) {
        const metadatos = { formato: filtros.formato, presentacion: filtros.presentacion,
            ...(filtros.granularidad ? { granularidad: filtros.granularidad } : {}),
            ...(filtros.grafico ? { grafico: filtros.grafico, metrica: filtros.metrica } : {}) };
        const controller = new AbortController();
        signal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
        let terminal = false, reservado = false, archivos, etapa = 'EXTRACCION', cantidadFilas, limpieza, vigilancia, terminar;
        const inicio = performance.now();
        const generacionCivil = obtenerFechaOperacion().fechaHoraComercial;
        const generacion = generacionCivil.replaceAll('-', '').replace(' ', '-').replaceAll(':', '');
        const tipoEvento = fuente === 'MOVIMIENTOS' ? 'INVENTARIO_MOVIMIENTOS_EXPORTAR' : `REPORTE_${fuente}_EXPORTAR`;
        const finalizar = async error => {
            if (terminal) return;
            terminal = true;
            const causa = error ? obtenerErrorAuditoria(error)?.causa ?? (error.statusCode === 413 ? 'LIMITE_EXPORTACION'
                : error.statusCode === 503 ? 'RECURSO_NO_DISPONIBLE' : 'ERROR_INTERNO') : undefined;
            if (error) marcarErrorAuditoriaGestionado(error);
            const rechazado = ['LIMITE_EXPORTACION', 'RECURSO_NO_DISPONIBLE'].includes(causa);
            try {
                await bitacoraAuditoriaService.intentarRegistrar({ ...auditoria, tipoEvento,
                    resultado: error ? rechazado ? 'RECHAZADO' : 'FALLO' : 'EXITO', ...(causa ? { causa } : {}),
                    metadatos: { ...metadatos, ...(cantidadFilas === undefined ? {} : { cantidadFilas: String(cantidadFilas) }),
                        etapaExportacion: etapa, estadoEntrega: !error ? 'FINALIZADA_SERVIDOR'
                            : causa === 'CANCELACION_CLIENTE' ? 'ABORTADA' : etapa === 'ENTREGA' ? 'FALLIDA' : 'NO_INICIADA' } });
            } catch {
                // Defensa adicional: ni siquiera un auditor reemplazado debe romper entrega/cleanup.
                console.error({ codigo: 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA' });
            }
        };
        const limpiar = () => limpieza ??= (async () => {
            try { if (archivos) await archivos.limpiar(); }
            catch {
                // Residual desconocido: cerrar admisión, no olvidar cuota ni reintentar borrados amplios.
                limpiezaPendiente = true;
                console.error({ codigo: 'EXPORTACION_LIMPIEZA_PENDIENTE' });
            } finally {
                vigilancia?.liberar();
                if (reservado) { ocupado = false; reservado = false; }
                trabajos.delete(controller); terminar?.();
            }
        })();
        const comprobar = () => {
            if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : cancelacionExportacion();
            try { vigilancia?.comprobar(); } catch { throw noDisponible(); }
            const ahora = performance.now();
            if (ahora - inicio > 120000) throw tiempoExportacionAgotado();
        };
        try {
            if (!['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS'].includes(fuente)) throw new TypeError('Fuente inválida');
            if (filtros.presentacion === 'ESTADISTICA') {
                if (fuente === 'MOVIMIENTOS') throw new TypeError('Presentación inválida');
                comprobarLimiteIntervalos(filtros.periodo, filtros.granularidad);
            }
            if (!['CSV', 'XLSX', 'PDF'].includes(filtros.formato) ||
                limpiezaPendiente || cerrando) throw noDisponible();
            const disponibilidad = await this.comprobarDisponibilidad({ direccionRemota });
            if (!disponibilidad || !disponibilidad.raizPrivada || cerrando) throw noDisponible();
            if (ocupado) throw new AppError('Generación de exportaciones ocupada; reintente más tarde', 503);
            ocupado = true; reservado = true;
            trabajos.set(controller, new Promise(resolve => { terminar = resolve; }));
            if (disponibilidad.perfil === 'RAILWAY') vigilancia = entornoExportacionRailway.vigilar(() => controller.abort(noDisponible()));
            comprobar();
            archivos = await crearArchivosReporte(disponibilidad.raizPrivada, comprobar);
            const spool = await archivos.escritor('spool');
            const maxFilas = filtros.formato === 'PDF' ? 10000 : 1000000;
            let filas = 0, metadata;
            // Incluir la apertura: no iniciar SELECT si obtener/abrir el snapshot
            // ya consumió el plazo. No interrumpir ni liberar SQL pendiente.
            const apertura = performance.now();
            await db.sequelize.transaction({ isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
                const comprobarExtraccion = () => { comprobar(); if (performance.now() - apertura > 60000) throw tiempoExportacionAgotado(); };
                comprobarExtraccion();
                const extraer = async () => {
                    // Esperar SIEMPRE SQL antes de rollback/liberación. LOCAL
                    // conserva plazo cooperativo; Railway añade límites MySQL.
                    if (filtros.presentacion === 'ESTADISTICA') {
                        const agregados = await reporteRepository[`estadisticas${{ VENTAS: 'Ventas', COMPRAS: 'Compras', PERDIDAS: 'Perdidas' }[fuente]}`](filtros, { transaction });
                        comprobarExtraccion();
                        const data = materializarEstadisticas(fuente, filtros, agregados);
                        metadata = data;
                        for (const fila of filasEstadisticas(data)) {
                            comprobarExtraccion(); await spool.escribir(JSON.stringify(fila) + '\n'); filas++;
                        }
                        metadatos.cantidadIntervalos = data.intervalos.length;
                        if (filas > 9600) throw errorLimiteExportacion();
                    } else {
                        const grupos = await extraccion.resumen(fuente, filtros, { transaction });
                        comprobarExtraccion();
                        const conteo = grupos.reduce((total, grupo) => total + BigInt(
                            fuente === 'PERDIDAS' ? grupo.cantidad_retiros : grupo.cantidad), 0n);
                        if (conteo > BigInt(maxFilas)) throw errorLimiteExportacion();
                        const conciliacion = crearConciliacion(fuente, grupos);
                        if (conciliacion.total > BigInt(maxFilas)) throw errorLimiteExportacion();
                        metadata = { fuente, periodo: filtros.periodo ?? null, resumen: conciliacion.resumen,
                            cantidad: conciliacion.total.toString() };
                        let cursor = null;
                        for (;;) {
                            comprobarExtraccion();
                            const bloque = await extraccion.bloque(fuente, filtros, { transaction, cursor, limite: 1000 });
                            comprobarExtraccion();
                            if (bloque.length > 1000) throw new Error('Bloque inconsistente');
                            if (!bloque.length) break;
                            for (const raw of bloque) {
                                comprobarExtraccion();
                                const siguiente = { fecha: raw._cursor_fecha, id: raw._cursor_id };
                                if (typeof siguiente.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2}\.\d{6})?$/.test(siguiente.fecha) ||
                                    typeof siguiente.id !== 'string' || !/^[1-9]\d*$/.test(siguiente.id) ||
                                    (cursor && !(siguiente.fecha < cursor.fecha || (siguiente.fecha === cursor.fecha && BigInt(siguiente.id) < BigInt(cursor.id))))) throw new Error('Orden inconsistente');
                                cursor = siguiente;
                                const fila = proyectarFila(fuente, raw);
                                conciliacion.agregar(fila);
                                if (++filas > maxFilas) throw errorLimiteExportacion();
                                await spool.escribir(JSON.stringify(fila) + '\n');
                            }
                        }
                        conciliacion.comprobar();
                    }
                    await spool.cerrar();
                    await archivos.verificar('spool');
                    comprobarExtraccion();
                };
                if (disponibilidad.perfil === 'RAILWAY') {
                    await conPlazoSqlReporte(transaction, () => { comprobarExtraccion(); return Math.max(1, Math.floor(60000 - (performance.now() - apertura))); }, extraer);
                } else await extraer();
            });
            comprobar();
            // Snapshot terminado antes de abrir/renderizar el artefacto.
            etapa = 'GENERACION';
            const extension = filtros.formato.toLowerCase();
            if (filtros.formato === 'PDF') {
                await generarPdf({ archivos, fuente, filtros, metadata, filas, comprobar, generacion: generacionCivil });
            } else if (filtros.formato === 'XLSX') {
                await generarXlsx({ archivos, fuente, filtros, metadata, filas, comprobar,
                    generacion: generacionCivil });
            } else {
                const columnas = COLUMNAS_REPORTE[filtros.presentacion === 'ESTADISTICA' ? 'ESTADISTICA' : fuente];
                const csv = await archivos.escritor('csv');
                await csv.escribir(BOM_CSV + registroCsv(columnas));
                let renderizadas = 0;
                for await (const fila of leerSpool(archivos.rutas.spool, comprobar)) {
                    await csv.escribir(registroCsv(columnas.map(c => fila[c]))); renderizadas++;
                }
                if (renderizadas !== filas) throw new Error('Artefacto incompleto');
                await csv.cerrar();
            }
            const bytes = await archivos.verificar(extension);
            comprobar();
            cantidadFilas = filas;
            const correlacion = auditoria.contexto.correlacion;
            if (!/^[a-f0-9]{32}$/.test(correlacion)) throw new Error('Correlación inválida');
            return { ruta: archivos.rutas[extension], bytes, cantidadFilas: filas, metadata, signal,
                mime: filtros.formato === 'PDF' ? MIME_PDF : filtros.formato === 'XLSX' ? MIME_XLSX : 'text/csv; charset=utf-8',
                nombre: `cadefar-${fuente.toLowerCase()}-${filtros.presentacion.toLowerCase()}-${generacion}-${correlacion}.${extension}`,
                iniciarEntrega() { comprobar(); etapa = 'ENTREGA'; }, finalizar, limpiar };
        } catch (error) {
            if ([3024, 1205].includes(error.original?.errno) || ['ER_QUERY_TIMEOUT', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.original?.code)) error = tiempoExportacionAgotado();
            if (error.residuoExportacion || error.sesionExportacionInsegura) {
                limpiezaPendiente = true;
                console.error({ codigo: error.sesionExportacionInsegura ? 'EXPORTACION_SESION_NO_REUTILIZABLE' : 'EXPORTACION_LIMPIEZA_PENDIENTE' });
            }
            // Cancelación observada tras esperar el SQL: no liberar conexión prematuramente.
            if (signal?.aborted) error = signal.reason instanceof Error ? signal.reason : cancelacionExportacion();
            await finalizar(error);
            await limpiar();
            throw error;
        }
    }
};
