export const RecetaEstado = ({ resultado, inconsistente = false }) => <span className={`venta-estado ${!inconsistente && resultado === 'APROBADA' ? 'venta-estado--confirmada' : inconsistente || resultado === 'RECHAZADA' ? 'venta-estado--anulada' : 'venta-estado--pendiente'}`}>
  {inconsistente ? 'Datos de revisión inconsistentes' : resultado === null ? 'Pendiente de revisión' : resultado === 'APROBADA' ? 'Aprobada' : resultado === 'RECHAZADA' ? 'Rechazada' : 'Revisión no disponible'}
</span>;
