export const ReporteFilters = ({ tipo = 'ventas', borrador, onChange, disabled, onSearch, onClear }) => {
  const campo = nombre => ({ value: borrador[nombre] || '', onChange: event => onChange({ ...borrador, [nombre]: event.target.value }) });
  const perdidas = tipo === 'perdidas';
  const modalidad = event => onChange({ modalidad: event.target.value, [perdidas ? 'motivo' : 'estadoOperacion']: borrador[perdidas ? 'motivo' : 'estadoOperacion'] });
  const fecha = (nombre, label, type = 'date') => <div className="form-field"><label htmlFor={`reporte-${nombre}`}>{label}</label><input id={`reporte-${nombre}`} type={type} min={type === 'month' ? '1000-01' : '1000-01-01'} max={type === 'month' ? '9999-12' : '9999-12-31'} {...campo(nombre)} /></div>;
  return <form className="reporte-filters" aria-label={`Filtros del reporte de ${tipo}`} onSubmit={event => { event.preventDefault(); if (!disabled) onSearch(); }} noValidate>
    <fieldset disabled={disabled}>
      <legend>Filtros por aplicar</legend>
      <p className="reporte-filters__label">Período y {perdidas ? 'motivo del retiro' : 'estado de la operación'}</p>
      <div className="reporte-filters__fields">
        <div className="form-field"><label htmlFor="reporte-modalidad">Consultar por</label><select id="reporte-modalidad" value={borrador.modalidad} onChange={modalidad}><option value="">Selecciona una modalidad</option><option value="dia">Día</option><option value="mes">Mes</option><option value="periodo">Período</option></select></div>
        {borrador.modalidad === 'dia' && fecha('dia', 'Día')}
        {borrador.modalidad === 'mes' && fecha('mes', 'Mes', 'month')}
        {borrador.modalidad === 'periodo' && <>{fecha('desde', 'Desde')}{fecha('hasta', 'Hasta')}</>}
        {perdidas ? <div className="form-field"><label htmlFor="reporte-motivo">Motivo del retiro</label><select id="reporte-motivo" {...campo('motivo')}><option value="">Todos los motivos</option><option value="VENCIMIENTO">Vencimiento</option><option value="DAÑO">Daño</option></select></div>
          : <div className="form-field"><label htmlFor="reporte-estado">Estado de la {tipo === 'compras' ? 'compra' : 'venta'}</label><select id="reporte-estado" {...campo('estadoOperacion')}><option value="">Todos los estados</option><option value="CONFIRMADA">Confirmada</option>{tipo === 'ventas' && <option value="PENDIENTE">Pendiente</option>}<option value="ANULADA">Anulada</option></select></div>}
      </div>
      <p className="form-field__help">Ambos días están incluidos. Editar no cambia el resultado: pulsa Buscar para aplicar los filtros.{tipo === 'ventas' && ' Anulada incluye ventas confirmadas y sin confirmar.'}</p>
      <div className="reporte-filters__actions"><button type="submit" className="button button--primary">Buscar</button><button type="button" className="button button--secondary" onClick={onClear}>Limpiar</button></div>
    </fieldset>
  </form>;
};
