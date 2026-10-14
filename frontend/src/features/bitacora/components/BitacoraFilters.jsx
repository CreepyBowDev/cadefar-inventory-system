import { useState } from 'react';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { MODULOS_BITACORA, REGISTROS_BITACORA, TIPOS_EVENTO_BITACORA } from '../utils/presentacionBitacora.js';
import { ACCIONES_BITACORA, RESULTADOS_BITACORA, LIMITES_BITACORA, aplicarBorradorBitacora, borradorBitacora } from '../utils/consultaBitacora.js';

export const BitacoraFilters = ({ filtros, disabled, onSearch, onClear }) => {
  const inicial = borradorBitacora(filtros);
  const [borrador, setBorrador] = useState(inicial);
  const [error, setError] = useState('');
  const pendiente = JSON.stringify(borrador) !== JSON.stringify(inicial);
  const campo = nombre => ({ name: nombre, value: borrador[nombre], onChange: event => {
    setBorrador(actual => ({ ...actual, [nombre]: event.target.value })); setError('');
  } });
  const input = (nombre, label, extra = {}) => <div className="form-field" key={nombre}>
    <label htmlFor={`bitacora-${nombre}`}>{label}</label><input id={`bitacora-${nombre}`} {...campo(nombre)} {...extra} />
  </div>;
  const select = (nombre, label, opciones) => <div className="form-field" key={nombre}>
    <label htmlFor={`bitacora-${nombre}`}>{label}</label><select id={`bitacora-${nombre}`} {...campo(nombre)}>
      <option value="">Todos</option>
      {borrador[nombre] && !Object.hasOwn(opciones, borrador[nombre]) && <option value={borrador[nombre]}>Valor no válido: {borrador[nombre]}</option>}
      {Object.entries(opciones).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
    </select>
  </div>;
  const avanzados = ['idUsuarioObjetivo', 'nombreIngresado', 'direccionIp', 'accion', 'tipoRegistro', 'idRegistro'];
  return <form className="bitacora-filters" aria-label="Filtros de Bitácora" onSubmit={event => {
    event.preventDefault();
    const limite = LIMITES_BITACORA.includes(Number(filtros.limite)) ? String(Number(filtros.limite)) : '25';
    const resultado = aplicarBorradorBitacora(borrador, limite);
    setError(resultado.error);
    if (!resultado.error) onSearch(resultado.filtros);
  }}>
    <div className="bitacora-filters__heading"><h3>Buscar eventos</h3><p>Combina criterios y pulsa Buscar para aplicarlos.</p></div>
    <fieldset disabled={disabled} className="bitacora-filters__fieldset">
      <legend className="visually-hidden">Criterios de búsqueda</legend>
      <div className="bitacora-filters__fields">
        {input('desde', 'Desde (hora de Bolivia)', { type: 'datetime-local', step: '0.001', min: '0999-12-31T20:00', max: '9999-12-31T19:59:59.999' })}
        {input('hasta', 'Hasta (inclusive)', { type: 'datetime-local', step: '0.001', min: '0999-12-31T20:00', max: '9999-12-31T19:59:59.999' })}
        {select('resultado', 'Resultado', RESULTADOS_BITACORA)}
        {select('modulo', 'Módulo', MODULOS_BITACORA)}
        {select('tipoEvento', 'Tipo de evento', TIPOS_EVENTO_BITACORA)}
        {input('idUsuarioResponsable', 'ID del responsable', { inputMode: 'numeric', maxLength: 10, placeholder: 'Ej. 17' })}
      </div>
      <details className="bitacora-filters__more" open={avanzados.some(nombre => inicial[nombre]) || undefined}>
        <summary>Más filtros</summary>
        <div className="bitacora-filters__fields">
          {input('idUsuarioObjetivo', 'ID de la cuenta objetivo', { inputMode: 'numeric', maxLength: 10 })}
          {input('nombreIngresado', 'Nombre ingresado', { maxLength: 60 })}
          {input('direccionIp', 'Dirección IP capturada', { maxLength: 45, placeholder: 'IPv4 o IPv6' })}
          {select('accion', 'Operación', ACCIONES_BITACORA)}
          {select('tipoRegistro', 'Tipo de registro', REGISTROS_BITACORA)}
          {input('idRegistro', 'ID del registro', { inputMode: 'numeric', maxLength: 10 })}
        </div>
        <p>Los IDs consultan identidades históricas. La cuenta objetivo no identifica a un responsable autenticado. La IP capturada puede corresponder a un intermediario.</p>
      </details>
      <FeedbackMessage message={error} />
      <div className="bitacora-filters__actions">
        <p role="status">{pendiente ? 'Hay cambios sin aplicar. Pulsa Buscar.' : 'Período sobre fecha de registro; extremos inclusivos.'}</p>
        <button type="button" className="button button--secondary" onClick={onClear}>Limpiar</button>
        <button type="submit" className="button button--primary"><AppIcon name="search" size={17} />Buscar</button>
      </div>
    </fieldset>
  </form>;
};
