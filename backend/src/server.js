import 'dotenv/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './app.js';
import db from './data/models/index.js';
import { reporteExportacionService } from './business/services/reporte.exportacion.service.js';
import entorno from './shared/utils/pagos-entorno.cjs';

const PORT = process.env.PORT || 3000;
const HOST = entorno.esPruebaLocal() ? '127.0.0.1' : '0.0.0.0';

export const iniciarServidor = async () => {
    if (entorno.esPruebaLocal()) {
        const [identity] = await db.sequelize.query('SELECT DATABASE() AS nombre', { logging: false });
        const [views] = await db.sequelize.query("SELECT IS_UPDATABLE FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuario_sesion_local'", { logging: false });
        if (identity[0]?.nombre !== entorno.BASE_PRUEBAS || views[0]?.IS_UPDATABLE !== 'NO' || !process.env.JWT_SECRET) {
            throw new Error('El entorno aislado exige una vista de identidad no actualizable y configuración JWT');
        }
    }
    const server = app.listen(PORT, HOST);
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    console.log(`Servidor ejecutándose en puerto ${server.address().port}`);

    let closing;
    const cerrar = () => {
        if (!closing) closing = (async () => {
            process.removeListener('SIGTERM', onSignal);
            process.removeListener('SIGINT', onSignal);
            try {
                // Cerrar admisión y abortar generación/entrega antes de cerrar DB.
                // Se espera SQL/limpieza; no liberar conexiones con SELECT vivo.
                const exportaciones = reporteExportacionService.cerrar();
                const http = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
                const resultados = await Promise.allSettled([exportaciones, http]);
                if (resultados.some(r => r.status === 'rejected')) throw new Error('Cierre de exportaciones incompleto');
            } finally { await db.sequelize.close(); }
        })();
        return closing;
    };
    const onSignal = () => { cerrar().catch(() => {
        console.error({ name: 'ShutdownError', message: 'No se pudo cerrar el servidor correctamente' });
        process.exitCode = 1;
    }); };
    process.on('SIGTERM', onSignal);
    process.on('SIGINT', onSignal);
    return { server, cerrar };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    iniciarServidor().catch(() => {
        console.error({ name: 'StartupError', message: 'No se pudo iniciar el servidor' });
        process.exitCode = 1;
    });
}
