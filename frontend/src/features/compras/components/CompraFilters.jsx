import { useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { idValido } from '../../../utils/presentacion.js';

export const CompraFilters = ({ filtros, proveedores, onSearch, onClear }) => {
  const [error, setError] = useState('');
  const [idProveedor, setIdProveedor] = useState(filtros.idProveedorLaboratorio || '');
  const opciones = proveedores.data || [];
  const submit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, value.trim()]));
    if (values.desde && values.hasta && values.desde > values.hasta) {
      setError('La fecha desde no puede ser posterior a la fecha hasta.'); return;
    }
    if (values.idProveedorLaboratorio && !idValido(values.idProveedorLaboratorio)) {
      setError('El ID del proveedor debe ser un entero positivo de hasta 2147483647.'); return;
    }
    if (values.claveOperacion && !/^[A-Za-z0-9_-]{1,64}$/.test(values.claveOperacion)) {
      setError('La clave admite hasta 64 letras sin acentos, números, guion y guion bajo, sin espacios internos.'); return;
    }
    values.claveOperacion = values.claveOperacion.toLowerCase();
    setError(''); onSearch(values);
  };
  return <form className="compra-filters" onSubmit={submit} aria-label="Filtros de compras">
    <div className="compra-filters__fields">
      <div className="form-field"><label htmlFor="compra-desde">Fecha de adquisición desde</label><input id="compra-desde" name="desde" type="date" defaultValue={filtros.desde || ''} /></div>
      <div className="form-field"><label htmlFor="compra-hasta">Fecha de adquisición hasta</label><input id="compra-hasta" name="hasta" type="date" defaultValue={filtros.hasta || ''} /></div>
      <div className="form-field"><label htmlFor="compra-proveedor">Proveedor / Laboratorio</label><select id="compra-proveedor" name="idProveedorLaboratorio" value={idProveedor} onChange={(event) => setIdProveedor(event.target.value)}>
        <option value="">Todos los proveedores</option>
        {idProveedor && !opciones.some((p) => String(p.idProveedorLaboratorio) === idProveedor) && <option value={idProveedor}>Proveedor #{idProveedor}</option>}
        {opciones.map((p) => <option key={p.idProveedorLaboratorio} value={p.idProveedorLaboratorio}>{p.nombre}{p.estado ? '' : ' (inactivo)'}</option>)}
      </select>{proveedores.loading && <small className="form-field__help" role="status">Cargando proveedores…</small>}</div>
      <div className="form-field"><label htmlFor="compra-estado">Estado de la compra</label><select id="compra-estado" name="estadoOperacion" defaultValue={filtros.estadoOperacion || ''}><option value="">Confirmadas y anuladas</option><option value="CONFIRMADA">Confirmada</option><option value="ANULADA">Anulada</option></select></div>
      <div className="form-field compra-filters__clave"><label htmlFor="compra-clave">Clave de operación</label><input id="compra-clave" name="claveOperacion" type="search" maxLength={64} defaultValue={filtros.claveOperacion || ''} placeholder="Buscar una operación propia" /><small className="form-field__help">Al buscar por clave solo se consultan tus compras, también con otros filtros.</small></div>
    </div>
    <p className="form-field__help">El período incluye ambos días y corresponde a la adquisición, no a la hora de registro. Para consultar un día, usa la misma fecha desde y hasta.</p>
    {proveedores.error && <div><FeedbackMessage message="No fue posible cargar las opciones de proveedores. Puedes consultar con los demás filtros." /><button className="button button--secondary" type="button" onClick={proveedores.retry}>Reintentar proveedores</button></div>}
    <FeedbackMessage message={error} />
    <div className="compra-filters__actions"><button className="button button--secondary" type="button" onClick={(event) => { event.currentTarget.form.reset(); setError(''); setIdProveedor(''); onClear(); }}>Limpiar filtros</button><button className="button button--primary" type="submit">Consultar</button></div>
  </form>;
};
