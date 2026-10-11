import { useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { idValido } from '../../../utils/presentacion.js';

export const InventarioFilters = ({ filtros, movimientos = false, onSearch, onClear }) => {
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, value.trim()]));
    if (['idMedicamento', 'idExistencia'].some((key) => values[key] && !idValido(values[key]))) {
      setError('Los identificadores deben ser enteros positivos de hasta 2147483647.'); return;
    }
    if (values.desde && values.hasta && values.desde > values.hasta) {
      setError('La fecha desde no puede ser posterior a la fecha hasta.'); return;
    }
    setError(''); onSearch(values);
  };
  return <form className="inventario-filters" onSubmit={submit} aria-label="Filtros de consulta">
    <div className="inventario-filters__fields">
      {!movimientos && <>
        <div className="form-field"><label htmlFor="inv-codigo">Código del medicamento</label><input id="inv-codigo" name="codigoMedicamento" type="search" maxLength={20} defaultValue={filtros.codigoMedicamento || ''} placeholder="Ej. PAR001" /></div>
        <div className="form-field"><label htmlFor="inv-nombre">Nombre comercial</label><input id="inv-nombre" name="nombreComercial" type="search" maxLength={150} defaultValue={filtros.nombreComercial || ''} placeholder="Buscar por nombre" /></div>
      </>}
      <div className="form-field"><label htmlFor="inv-id-med">ID del medicamento</label><input id="inv-id-med" name="idMedicamento" inputMode="numeric" maxLength={10} defaultValue={filtros.idMedicamento || ''} placeholder="Todos" /></div>
      {movimientos && <>
        <div className="form-field"><label htmlFor="inv-id-ex">ID de la existencia</label><input id="inv-id-ex" name="idExistencia" inputMode="numeric" maxLength={10} defaultValue={filtros.idExistencia || ''} placeholder="Todas" /></div>
        <div className="form-field"><label htmlFor="inv-desde">Desde</label><input id="inv-desde" name="desde" type="date" defaultValue={filtros.desde || ''} /></div>
        <div className="form-field"><label htmlFor="inv-hasta">Hasta</label><input id="inv-hasta" name="hasta" type="date" defaultValue={filtros.hasta || ''} /></div>
        <div className="form-field"><label htmlFor="inv-direccion">Dirección</label><select id="inv-direccion" name="direccion" defaultValue={filtros.direccion || ''}><option value="">Entradas y salidas</option><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option></select></div>
        <div className="form-field"><label htmlFor="inv-motivo">Motivo registrado</label><input id="inv-motivo" name="motivo" maxLength={40} defaultValue={filtros.motivo || ''} placeholder="Ej. COMPRA" /><small className="form-field__help">También admite motivos históricos.</small></div>
      </>}
    </div>
    <FeedbackMessage message={error} />
    <div className="inventario-filters__actions">
      <button className="button button--secondary" type="button" onClick={() => { setError(''); onClear(); }}>Limpiar filtros</button>
      <button className="button button--primary" type="submit">Consultar</button>
    </div>
  </form>;
};
