import { LIMITES_BITACORA } from '../utils/consultaBitacora.js';

export const BitacoraPagination = ({ meta, filtros, disabled, onPage, onLimit }) => <div className="bitacora-pagination">
  <div className="bitacora-pagination__limit"><label htmlFor="bitacora-limite">Eventos por página</label>
    <select id="bitacora-limite" value={filtros.limite} disabled={disabled} onChange={event => onLimit(event.target.value)}>
      {LIMITES_BITACORA.map(limite => <option key={limite} value={limite}>{limite}</option>)}
    </select>
  </div>
  <nav aria-label="Páginas de Bitácora">
    <button type="button" className="button button--secondary" disabled={disabled || !meta || meta.pagina <= 1} onClick={() => onPage(meta.pagina - 1)}>Anterior</button>
    <span role="status">{meta ? meta.pagina > Math.max(1, meta.totalPaginas) ? `Página solicitada: ${meta.pagina}`
      : meta.totalPaginas ? `Página ${meta.pagina} de ${meta.totalPaginas}` : 'Sin páginas' : 'Página pendiente'}</span>
    <button type="button" className="button button--secondary" disabled={disabled || !meta || meta.pagina >= meta.totalPaginas} onClick={() => onPage(meta.pagina + 1)}>Siguiente</button>
  </nav>
</div>;
