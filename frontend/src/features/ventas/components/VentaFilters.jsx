import { useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { serializarConsultaVenta, validarFiltrosVenta } from '../utils/consultaVenta.js';

export const VentaFilters = ({ filtros, disabled, onSearch, onClear }) => {
  const [borrador, setBorrador] = useState(filtros);
  const [error, setError] = useState('');
  const campo = (nombre) => ({ value: borrador[nombre] || '', onChange: event => {
    setBorrador(actual => ({ ...actual, [nombre]: event.target.value })); setError('');
  } });
  const buscar = (event) => {
    event.preventDefault();
    const nuevos = Object.fromEntries(new URLSearchParams(serializarConsultaVenta({ ...borrador, pagina: '1' })));
    const mensaje = validarFiltrosVenta(nuevos);
    setError(mensaje);
    if (!mensaje) onSearch(nuevos);
  };
  return <form className="venta-filters" onSubmit={buscar} aria-label="Filtros de ventas">
    <fieldset disabled={disabled}>
      <legend className="visually-hidden">Criterios de consulta</legend>
      <div className="venta-filters__fields">
        <div className="form-field"><label htmlFor="venta-id">Identificador de venta</label><input id="venta-id" type="text" inputMode="numeric" maxLength={10} {...campo('idVenta')} /></div>
        <div className="form-field"><label htmlFor="venta-responsable">ID del responsable</label><input id="venta-responsable" type="text" inputMode="numeric" maxLength={10} {...campo('idUsuario')} /><small className="form-field__help">Identificador del usuario que registró la venta.</small></div>
        <div className="form-field"><label htmlFor="venta-estado">Estado de la venta</label><select id="venta-estado" {...campo('estadoOperacion')}><option value="">Todos los estados</option><option value="PENDIENTE">Pendiente</option><option value="CONFIRMADA">Confirmada</option><option value="ANULADA">Anulada</option></select></div>
        <div className="form-field"><label htmlFor="venta-campo-fecha">Fecha del período</label><select id="venta-campo-fecha" {...campo('campoFecha')}><option value="fechaRegistro">Fecha de registro</option><option value="fechaVenta">Fecha efectiva de venta</option></select></div>
        <div className="form-field"><label htmlFor="venta-desde">Desde</label><input id="venta-desde" type="date" min="1000-01-01" max="9999-12-31" {...campo('desde')} /></div>
        <div className="form-field"><label htmlFor="venta-hasta">Hasta</label><input id="venta-hasta" type="date" min="1000-01-01" max="9999-12-31" {...campo('hasta')} /></div>
      </div>
      <p className="form-field__help">El período incluye ambos días. Las ventas pendientes no tienen fecha efectiva de venta.</p>
      <FeedbackMessage message={error} />
      <div className="venta-filters__actions"><button className="button button--secondary" type="button" onClick={onClear}>Limpiar filtros</button><button className="button button--primary" type="submit">Buscar ventas</button></div>
    </fieldset>
  </form>;
};
