const etiquetas = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', ANULADA: 'Anulada' };

export const VentaEstado = ({ estado }) => <span className={`venta-estado venta-estado--${String(estado).toLowerCase()}`}>
  {etiquetas[estado] || 'Estado no reconocido'}
</span>;
