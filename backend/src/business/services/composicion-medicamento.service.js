import db from '../../data/models/index.js';
import { composicionMedicamentoRepository } from '../../data/repositories/composicion-medicamento.repository.js';
import { medicamentoService, toPublicComposicion } from './medicamento.service.js';
import { AppError } from '../../shared/errors/app-error.js';

const getComposicion = async (idMedicamento, idComposicion, transaction) => {
    const composicion = await composicionMedicamentoRepository.findById({ idMedicamento, idComposicion, transaction });
    if (!composicion) throw new AppError('Composición de medicamento no encontrada', 404);
    return composicion;
};

export class composicionMedicamentoService {
    static async getComposicionMedicamento(idMedicamento) {
        const medicamento = await medicamentoService.getMedicamentoById(idMedicamento);
        return medicamento.composicion;
    }

    static async createComposicion(idMedicamento, data) {
        try {
            return await db.sequelize.transaction(async (transaction) => {
                await medicamentoService.getMedicamentoForUpdate(idMedicamento, transaction);
                await medicamentoService.validateSinHistorial(idMedicamento, transaction);
                const principio = await composicionMedicamentoRepository.findPrincipioById({
                    idPrincipioActivo: data.idPrincipioActivo, transaction
                });
                if (!principio) throw new AppError('Principio activo no encontrado', 404);
                const existente = await composicionMedicamentoRepository.findByPrincipio({
                    idMedicamento, idPrincipioActivo: data.idPrincipioActivo, transaction
                });
                if (existente) throw new AppError('El principio activo ya pertenece a la composición del medicamento', 409);
                const composicion = await composicionMedicamentoRepository.create({
                    data: {
                        id_medicamento: idMedicamento,
                        id_principio_activo: data.idPrincipioActivo,
                        cantidad_principio_activo: data.cantidadPrincipioActivo,
                        unidad_principio_activo: data.unidadPrincipioActivo,
                        cantidad_referencia: data.cantidadReferencia,
                        unidad_referencia: data.unidadReferencia
                    }, transaction
                });
                return toPublicComposicion(await getComposicion(idMedicamento, composicion.id_composicion, transaction));
            });
        } catch (error) {
            if (error?.name === 'SequelizeUniqueConstraintError') {
                throw new AppError('El principio activo ya pertenece a la composición del medicamento', 409);
            }
            throw error;
        }
    }

    static async updateComposicion(idMedicamento, idComposicion, data) {
        return db.sequelize.transaction(async (transaction) => {
            await medicamentoService.getMedicamentoForUpdate(idMedicamento, transaction);
            await getComposicion(idMedicamento, idComposicion, transaction);
            await medicamentoService.validateSinHistorial(idMedicamento, transaction);
            const campos = {
                cantidadPrincipioActivo: 'cantidad_principio_activo',
                unidadPrincipioActivo: 'unidad_principio_activo',
                cantidadReferencia: 'cantidad_referencia',
                unidadReferencia: 'unidad_referencia'
            };
            const values = Object.fromEntries(Object.entries(data).map(([campo, valor]) => [campos[campo], valor]));
            await composicionMedicamentoRepository.update({ idMedicamento, idComposicion, data: values, transaction });
            return toPublicComposicion(await getComposicion(idMedicamento, idComposicion, transaction));
        });
    }

    static async removeComposicion(idMedicamento, idComposicion) {
        return db.sequelize.transaction(async (transaction) => {
            await medicamentoService.getMedicamentoForUpdate(idMedicamento, transaction);
            await getComposicion(idMedicamento, idComposicion, transaction);
            await medicamentoService.validateSinHistorial(idMedicamento, transaction);
            await composicionMedicamentoRepository.remove({ idMedicamento, idComposicion, transaction });
        });
    }
}
