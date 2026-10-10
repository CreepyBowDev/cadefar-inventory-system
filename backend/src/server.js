import 'dotenv/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './app.js';
import db from './data/models/index.js';

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

export const iniciarServidor = async () => {
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
                await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
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
