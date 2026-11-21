import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { reporteValidator } from '../../business/validators/reporte.validator.js';
import { reporteExportacionService, tiempoExportacionAgotado, cancelacionExportacion } from '../../business/services/reporte.exportacion.service.js';
import { ejecutarConAuditoria } from '../../shared/utils/auditoria-http.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { AppError } from '../../shared/errors/app-error.js';

export class reporteExportacionController {
    static ventas(req, res, next) { return exportar('Ventas', req, res, next); }
    static compras(req, res, next) { return exportar('Compras', req, res, next); }
    static perdidas(req, res, next) { return exportar('Perdidas', req, res, next); }
    static movimientos(req, res, next) { return exportar('Movimientos', req, res, next); }
}
const buscarLimite = issues => {
    for (const issue of issues) {
        if (issue.params?.limiteIntervalos) return issue;
        for (const rama of issue.errors ?? []) { const encontrado = buscarLimite(rama); if (encontrado) return encontrado; }
    }
};
const exportar = async (fuente, req, res, next) => {
    let artefacto, timer, desconexion, falloEnvio;
    const cancelacion = new AbortController();
    try {
        const validacion = reporteValidator[`validateExportacion${fuente}`](req.query);
        if (!validacion.success) {
            const limite = buscarLimite(validacion.error.issues);
            throw anotarErrorAuditoria(new AppError(limite?.message ?? 'Datos inválidos', 400, validacion.error.issues),
                { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
        }
        desconexion = () => { if (!res.writableFinished) cancelacion.abort(cancelacionExportacion()); };
        falloEnvio = error => cancelacion.abort(anotarErrorAuditoria(error, { causa: 'ERROR_ENVIO' }));
        res.once('error', falloEnvio);
        res.once('close', desconexion);
        timer = setTimeout(() => cancelacion.abort(tiempoExportacionAgotado()), 120000);
        artefacto = await ejecutarConAuditoria(req, auditoria => reporteExportacionService.preparar(
            fuente.toUpperCase(), validacion.data, auditoria, { signal: cancelacion.signal, direccionRemota: req.socket?.remoteAddress }));
        artefacto.iniciarEntrega();
        clearTimeout(timer);
        timer = setTimeout(() => cancelacion.abort(tiempoExportacionAgotado()), 120000);
        res.status(200).set({ 'Content-Type': artefacto.mime,
            'Content-Disposition': `attachment; filename="${artefacto.nombre}"`,
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': String(artefacto.bytes) });
        const lectura = createReadStream(artefacto.ruta);
        // Un error del archivo no se reclasifica como abandono por el close
        // que pipeline provocará al destruir el transporte.
        lectura.once('error', error => {
            if (!cancelacion.signal.aborted) cancelacion.abort(anotarErrorAuditoria(error, { causa: 'ERROR_INTERNO' }));
        });
        let enviados = 0;
        lectura.on('data', chunk => { enviados += chunk.length; });
        await pipeline(lectura, res, { signal: cancelacion.signal });
        clearTimeout(timer);
        if (!res.writableFinished || enviados !== artefacto.bytes) throw new Error('Entrega incompleta');
        await artefacto.finalizar();
    } catch (error) {
        clearTimeout(timer);
        if (cancelacion.signal.aborted) error = cancelacion.signal.reason;
        if (artefacto) await artefacto.finalizar(error);
        if (res.destroyed) return;
        if (res.headersSent) return res.destroy();
        if (error.message === 'Generación de exportaciones ocupada; reintente más tarde') res.set('Retry-After', '5');
        next(error);
    } finally {
        clearTimeout(timer);
        if (desconexion) res.off('close', desconexion);
        if (falloEnvio) res.off('error', falloEnvio);
        if (artefacto) await artefacto.limpiar();
    }
};
