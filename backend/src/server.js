import 'dotenv/config';

import { app } from './app.js';
// import db from './data/models/index.js';

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const iniciarServidor = async () => {
    try {
        // await db.sequelize.authenticate();
        // console.log('Conexión con la base de datos establecida');

        app.listen(PORT, HOST, () => {
            console.log(`Servidor ejecutándose en puerto ${PORT}`);
        });

    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

iniciarServidor();