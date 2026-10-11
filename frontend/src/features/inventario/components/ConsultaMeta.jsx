import { fechaCivil } from '../../../utils/presentacion.js';

export const ConsultaMeta = ({ meta }) => meta ? <p className="inventario-meta">
  Disponibilidad al {fechaCivil(meta.fechaComercial)} · {meta.zonaHoraria}
  {meta.fechaHasta && ` · Etiquetas hasta ${fechaCivil(meta.fechaHasta)}`}
</p> : null;
