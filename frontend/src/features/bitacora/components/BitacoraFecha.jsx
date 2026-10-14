import { fechaRegistroBitacora } from '../utils/presentacionBitacora.js';

export const BitacoraFecha = ({ valor }) => {
  const instante = fechaRegistroBitacora(valor);
  return instante ? <time dateTime={valor}>{instante.fecha}<small>{instante.hora}</small></time> : <span>Fecha no disponible</span>;
};
