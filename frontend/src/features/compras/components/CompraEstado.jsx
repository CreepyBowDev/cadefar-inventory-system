export const CompraEstado = ({ estado }) => <span className={`compra-estado ${estado === 'ANULADA' ? 'compra-estado--anulada' : ''}`}>
  {estado === 'CONFIRMADA' ? 'Confirmada' : estado === 'ANULADA' ? 'Anulada' : estado}
</span>;
