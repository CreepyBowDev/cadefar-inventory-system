import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';

export const CompraFilters = ({ filtros, proveedores, error, onChange, onClear }) => {
  const idProveedor = filtros.idProveedorLaboratorio || '';
  const opciones = proveedores.data || [];
  const campo = (nombre, inmediato = true) => ({ value: filtros[nombre] || '', onChange: (event) => onChange(nombre, event.target.value, inmediato) });
  return <form className="compra-filters" onSubmit={(event) => event.preventDefault()} aria-label="Filtros de compras">
    <div className="compra-filters__fields">
      <div className="form-field"><label htmlFor="compra-desde">Fecha de adquisición desde</label><input id="compra-desde" name="desde" type="date" {...campo('desde')} /></div>
      <div className="form-field"><label htmlFor="compra-hasta">Fecha de adquisición hasta</label><input id="compra-hasta" name="hasta" type="date" {...campo('hasta')} /></div>
      <div className="form-field"><label htmlFor="compra-proveedor">Proveedor / Laboratorio</label><select id="compra-proveedor" name="idProveedorLaboratorio" {...campo('idProveedorLaboratorio')}>
        <option value="">Todos los proveedores</option>
        {idProveedor && !opciones.some((p) => String(p.idProveedorLaboratorio) === idProveedor) && <option value={idProveedor}>Proveedor #{idProveedor}</option>}
        {opciones.map((p) => <option key={p.idProveedorLaboratorio} value={p.idProveedorLaboratorio}>{p.nombre}{p.estado ? '' : ' (inactivo)'}</option>)}
      </select>{proveedores.loading && <small className="form-field__help" role="status">Cargando proveedores…</small>}</div>
      <div className="form-field"><label htmlFor="compra-estado">Estado de la compra</label><select id="compra-estado" name="estadoOperacion" {...campo('estadoOperacion')}><option value="">Confirmadas y anuladas</option><option value="CONFIRMADA">Confirmada</option><option value="ANULADA">Anulada</option></select></div>
      <div className="form-field compra-filters__clave"><label htmlFor="compra-clave">Clave de operación</label><input id="compra-clave" name="claveOperacion" type="search" maxLength={64} {...campo('claveOperacion', false)} placeholder="Buscar una operación propia" /><small className="form-field__help">Al buscar por clave solo se consultan tus compras, también con otros filtros.</small></div>
    </div>
    <p className="form-field__help">El período incluye ambos días y corresponde a la adquisición, no a la hora de registro. Para consultar un día, usa la misma fecha desde y hasta.</p>
    {proveedores.error && <div><FeedbackMessage message="No fue posible cargar las opciones de proveedores. Puedes consultar con los demás filtros." /><button className="button button--secondary" type="button" onClick={proveedores.retry}>Reintentar proveedores</button></div>}
    <FeedbackMessage message={error} />
    <div className="compra-filters__actions"><button className="button button--secondary" type="button" onClick={onClear}>Limpiar filtros</button></div>
  </form>;
};
