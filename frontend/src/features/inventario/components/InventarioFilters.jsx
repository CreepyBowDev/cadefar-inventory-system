import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';

export const InventarioFilters = ({ filtros, movimientos = false, error, onChange, onClear }) => {
  const campo = (nombre, inmediato = false) => ({ value: filtros[nombre] || '', onChange: (event) => onChange(nombre, event.target.value, inmediato) });
  return <form className="inventario-filters" onSubmit={(event) => event.preventDefault()} aria-label="Filtros de consulta">
    <div className="inventario-filters__fields">
      {!movimientos && <>
        <div className="form-field"><label htmlFor="inv-codigo">Código del medicamento</label><input id="inv-codigo" name="codigoMedicamento" type="search" maxLength={20} {...campo('codigoMedicamento')} placeholder="Ej. PAR001" /></div>
        <div className="form-field"><label htmlFor="inv-nombre">Nombre comercial</label><input id="inv-nombre" name="nombreComercial" type="search" maxLength={150} {...campo('nombreComercial')} placeholder="Buscar por nombre" /></div>
      </>}
      <div className="form-field"><label htmlFor="inv-id-med">ID del medicamento</label><input id="inv-id-med" name="idMedicamento" inputMode="numeric" maxLength={10} {...campo('idMedicamento')} placeholder="Todos" /></div>
      {movimientos && <>
        <div className="form-field"><label htmlFor="inv-id-ex">ID de la existencia</label><input id="inv-id-ex" name="idExistencia" inputMode="numeric" maxLength={10} {...campo('idExistencia')} placeholder="Todas" /></div>
        <div className="form-field"><label htmlFor="inv-desde">Desde</label><input id="inv-desde" name="desde" type="date" {...campo('desde', true)} /></div>
        <div className="form-field"><label htmlFor="inv-hasta">Hasta</label><input id="inv-hasta" name="hasta" type="date" {...campo('hasta', true)} /></div>
        <div className="form-field"><label htmlFor="inv-direccion">Dirección</label><select id="inv-direccion" name="direccion" {...campo('direccion', true)}><option value="">Entradas y salidas</option><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option></select></div>
        <div className="form-field"><label htmlFor="inv-motivo">Motivo registrado</label><input id="inv-motivo" name="motivo" maxLength={40} {...campo('motivo')} placeholder="Ej. COMPRA" /><small className="form-field__help">También admite motivos históricos.</small></div>
      </>}
    </div>
    <FeedbackMessage message={error} />
    <div className="inventario-filters__actions">
      <button className="button button--secondary" type="button" onClick={onClear}>Limpiar filtros</button>
    </div>
  </form>;
};
