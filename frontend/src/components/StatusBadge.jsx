export const StatusBadge = ({ active }) => (
  <span className={`catalogo-status ${active ? 'catalogo-status--active' : 'catalogo-status--inactive'}`}>
    <span aria-hidden="true" />
    {active ? 'Activo' : 'Inactivo'}
  </span>
);
