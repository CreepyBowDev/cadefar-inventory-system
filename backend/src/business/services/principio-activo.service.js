import db from '../../data/models/index.js';
import { principioActivoRepository } from '../../data/repositories/principio-activo.repository.js';
import { AppError } from '../../shared/errors/app-error.js';

const toPublicPrincipioActivo = (principio) => {
    const data = principio.get ? principio.get({ plain: true }) : principio;
    return {
        idPrincipioActivo: data.id_principio_activo,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        estado: Boolean(data.estado)
    };
};

const validateNombreDisponible = async (nombre, transaction, idPrincipioActivo) => {
    const existente = await principioActivoRepository.findByNombre({ nombre, transaction });
    if (existente && existente.id_principio_activo !== idPrincipioActivo) {
        throw new AppError('El nombre de principio activo ya está en uso', 409);
    }
};

const handleDuplicateDatabaseError = (error) => {
    if (error?.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('El nombre de principio activo ya está en uso', 409);
    }
    throw error;
};

export class principioActivoService {
    static async getPrincipiosActivos() {
        const principios = await principioActivoRepository.findAll();
        return principios.map(toPublicPrincipioActivo);
    }

    static async getPrincipioActivoById(idPrincipioActivo, transaction = undefined) {
        const principio = await principioActivoRepository.findById({ idPrincipioActivo, transaction });
        if (!principio) throw new AppError('Principio activo no encontrado', 404);
        return toPublicPrincipioActivo(principio);
    }

    static async createPrincipioActivo(data) {
        try {
            return await db.sequelize.transaction(async (transaction) => {
                await validateNombreDisponible(data.nombre, transaction);
                const principio = await principioActivoRepository.create({ data, transaction });
                return toPublicPrincipioActivo(principio);
            });
        } catch (error) {
            handleDuplicateDatabaseError(error);
        }
    }

    static async updatePrincipioActivo(idPrincipioActivo, data) {
        try {
            return await db.sequelize.transaction(async (transaction) => {
                const principio = await principioActivoRepository.findById({ idPrincipioActivo, transaction, lock: true });
                if (!principio) throw new AppError('Principio activo no encontrado', 404);
                if (data.nombre !== undefined) await validateNombreDisponible(data.nombre, transaction, idPrincipioActivo);
                await principioActivoRepository.update({ idPrincipioActivo, data, transaction });
                return this.getPrincipioActivoById(idPrincipioActivo, transaction);
            });
        } catch (error) {
            handleDuplicateDatabaseError(error);
        }
    }

    static async updateEstado(idPrincipioActivo, { estado }) {
        return db.sequelize.transaction(async (transaction) => {
            const principio = await principioActivoRepository.findById({ idPrincipioActivo, transaction, lock: true });
            if (!principio) throw new AppError('Principio activo no encontrado', 404);
            await principioActivoRepository.updateEstado({ idPrincipioActivo, estado, transaction });
            return this.getPrincipioActivoById(idPrincipioActivo, transaction);
        });
    }
}
