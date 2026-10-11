import { idValido } from '../../../utils/presentacion.js';
import { getExistenciasMedicamento } from '../services/inventario.service.js';

const rechazar = (status, message) => { throw { response: { status, data: { message } } }; };

// CU22 es la fuente conjunta del saldo y marcador de ajustes y retiros.
export const consultarExistencia = async ({ idMedicamento, idExistencia }) => {
  if (!idValido(idMedicamento) || !idValido(idExistencia)) rechazar(400, 'Los identificadores del medicamento y de la existencia deben ser enteros positivos válidos.');
  const response = await getExistenciasMedicamento(idMedicamento);
  const existencia = response.data.existencias.find((e) => String(e.idExistencia) === idExistencia && String(e.idMedicamento) === idMedicamento);
  if (!existencia) rechazar(404, 'La existencia no pertenece a este medicamento o no existe.');
  // No sustituir un marcador ausente por null ni fabricar precondiciones.
  const marcador = existencia.ultimoMovimiento;
  if (!response.data.medicamento || !Number.isInteger(existencia.stockFisico) || existencia.stockFisico < 0 || existencia.stockFisico > 2147483647 || !(marcador === null || (Number.isInteger(marcador) && marcador > 0 && marcador <= 2147483647))) {
    rechazar(409, 'La consulta no proporciona saldo e historial válidos para preparar la operación. Vuelve a consultar la existencia.');
  }
  return { data: { medicamento: response.data.medicamento, existencia }, meta: response.meta };
};
