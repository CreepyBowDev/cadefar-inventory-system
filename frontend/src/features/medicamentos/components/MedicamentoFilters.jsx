import { useMemo, useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';

export const MedicamentoFilters = ({ filters, principios, optionsLoading, optionsError, vendor, onTextChange, onTogglePrincipio, onClear, onRetryOptions }) => {
  const { codigoMedicamento, nombreComercial, idPrincipioActivo: ids } = filters;
  const [ingredientSearch, setIngredientSearch] = useState('');
  const visible = useMemo(() => principios.filter((p) =>
    p.nombre.toLocaleLowerCase('es').includes(ingredientSearch.trim().toLocaleLowerCase('es'))
  ), [principios, ingredientSearch]);

  return (
    <form className="medicamento-filters" onSubmit={(event) => event.preventDefault()}>
      <div className="medicamento-filters__text">
        <div className="form-field"><label htmlFor="filtroCodigo">Código</label><input id="filtroCodigo" type="search" value={codigoMedicamento} onChange={(event) => onTextChange('codigoMedicamento', event.target.value)} maxLength={20} placeholder="Buscar por código" /></div>
        <div className="form-field"><label htmlFor="filtroNombre">Nombre comercial</label><input id="filtroNombre" type="search" value={nombreComercial} onChange={(event) => onTextChange('nombreComercial', event.target.value)} maxLength={150} placeholder="Buscar por nombre" /></div>
      </div>
      <fieldset>
        <legend>Principios activos {ids.length > 0 && `(${ids.length} seleccionados)`}</legend>
        <p className="form-field__help">Debe contener todos los principios seleccionados; puede incluir otros ingredientes. La consulta no establece sustitución terapéutica.</p>
        {vendor && <p className="form-field__help">Opciones obtenidas de las composiciones del catálogo de medicamentos.</p>}
        {optionsLoading ? <p role="status">Cargando criterios de composición…</p> : optionsError ? <>
          <FeedbackMessage message={optionsError} />
          <button className="button button--secondary" type="button" onClick={onRetryOptions}>Reintentar criterios</button>
        </> : principios.length ? <>
          <div className="form-field" style={{ marginTop: '.75rem' }}><label htmlFor="filtroIngrediente">Encontrar un principio activo</label><input id="filtroIngrediente" type="search" value={ingredientSearch} onChange={(event) => setIngredientSearch(event.target.value)} placeholder="Buscar en las opciones" /></div>
          <div className="medicamento-filters__ingredients">
            {visible.map((p) => <label className="medicamento-filters__ingredient" key={p.idPrincipioActivo}>
              <input type="checkbox" checked={ids.includes(String(p.idPrincipioActivo))} onChange={() => onTogglePrincipio(p.idPrincipioActivo)} />
              {p.nombre}{p.estado === false ? ' (inactivo)' : ''}
            </label>)}
            {!visible.length && <p className="form-field__help">No hay opciones con ese nombre.</p>}
          </div>
        </> : <p className="form-field__help">No hay principios disponibles como criterio de búsqueda.</p>}
        {ids.some((id) => !principios.some((p) => String(p.idPrincipioActivo) === id)) && !optionsLoading && <p className="form-field__help">Hay criterios de la URL que no están en las opciones actuales. Puedes limpiar los filtros.</p>}
      </fieldset>
      <div className="medicamento-filters__actions">
        <button className="button button--secondary" type="button" onClick={() => { setIngredientSearch(''); onClear(); }}>Limpiar</button>
      </div>
    </form>
  );
};
