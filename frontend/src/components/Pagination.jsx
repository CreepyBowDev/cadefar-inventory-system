import '../styles/pagination.css';

export const Pagination = ({ paginacion, filtros, disabled, onPage, onLimit, nombre, id, className = '' }) => <div className={`consulta-pagination ${className}`}>
  <div className="form-field"><label htmlFor={`${id}-limite`}>{nombre} por página</label><select id={`${id}-limite`} value={filtros.limite} disabled={disabled} onChange={event => onLimit(event.target.value)}>
    {![10, 25, 50, 100].includes(Number(filtros.limite)) && <option value={filtros.limite}>{filtros.limite}</option>}
    {[10, 25, 50, 100].map(limite => <option key={limite} value={limite}>{limite}</option>)}
  </select></div>
  <nav aria-label={`Páginas de ${nombre.toLocaleLowerCase('es')}`}>
    <button type="button" className="button button--secondary" disabled={disabled || !paginacion || paginacion.pagina <= 1} onClick={() => onPage(paginacion.pagina - 1)}>Anterior</button>
    <span role="status">{paginacion ? paginacion.pagina > Math.max(1, paginacion.totalPaginas) ? `Página solicitada: ${paginacion.pagina}` : paginacion.totalPaginas ? `Página ${paginacion.pagina} de ${paginacion.totalPaginas}` : 'Sin páginas' : 'Página pendiente'}</span>
    <button type="button" className="button button--secondary" disabled={disabled || !paginacion || paginacion.pagina >= paginacion.totalPaginas} onClick={() => onPage(paginacion.pagina + 1)}>Siguiente</button>
  </nav>
</div>;
