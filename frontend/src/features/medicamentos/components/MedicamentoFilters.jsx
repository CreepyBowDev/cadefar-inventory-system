import { useMemo, useState } from 'react';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';

export const MedicamentoFilters = ({ initialFilters, principios, optionsLoading, optionsError, vendor, loading, onSearch, onClear, onRetryOptions }) => {
  const [codigoMedicamento, setCodigo] = useState(initialFilters.codigoMedicamento);
  const [nombreComercial, setNombre] = useState(initialFilters.nombreComercial);
  const [ids, setIds] = useState(initialFilters.idPrincipioActivo);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const visible = useMemo(() => principios.filter((p) =>
    p.nombre.toLocaleLowerCase('es').includes(ingredientSearch.trim().toLocaleLowerCase('es'))
  ), [principios, ingredientSearch]);

  const toggle = (id) => setIds((current) => current.includes(String(id))
    ? current.filter((value) => value !== String(id)) : [...current, String(id)]);

  return (
    <form className="medicamento-filters" onSubmit={(event) => {
      event.preventDefault();
      if (!loading) onSearch({ codigoMedicamento, nombreComercial, idPrincipioActivo: ids });
    }}>
      <div className="medicamento-filters__text">
        <div className="form-field"><label htmlFor="filtroCodigo">Código</label><input id="filtroCodigo" type="search" value={codigoMedicamento} onChange={(event) => setCodigo(event.target.value)} maxLength={20} placeholder="Buscar por código" disabled={loading} /></div>
        <div className="form-field"><label htmlFor="filtroNombre">Nombre comercial</label><input id="filtroNombre" type="search" value={nombreComercial} onChange={(event) => setNombre(event.target.value)} maxLength={150} placeholder="Buscar por nombre" disabled={loading} /></div>
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
              <input type="checkbox" checked={ids.includes(String(p.idPrincipioActivo))} onChange={() => toggle(p.idPrincipioActivo)} disabled={loading} />
              {p.nombre}{p.estado === false ? ' (inactivo)' : ''}
            </label>)}
            {!visible.length && <p className="form-field__help">No hay opciones con ese nombre.</p>}
          </div>
        </> : <p className="form-field__help">No hay principios disponibles como criterio de búsqueda.</p>}
        {ids.some((id) => !principios.some((p) => String(p.idPrincipioActivo) === id)) && !optionsLoading && <p className="form-field__help">Hay criterios de la URL que no están en las opciones actuales. Puedes limpiar los filtros.</p>}
      </fieldset>
      <div className="medicamento-filters__actions">
        <button className="button button--secondary" type="button" disabled={loading} onClick={() => { setCodigo(''); setNombre(''); setIds([]); setIngredientSearch(''); onClear(); }}>Limpiar</button>
        <button className="button button--primary" type="submit" disabled={loading}><AppIcon name="search" size={18} />{loading ? 'Buscando…' : 'Buscar'}</button>
      </div>
    </form>
  );
};
