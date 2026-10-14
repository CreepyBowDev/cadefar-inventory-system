import { cambiosBitacora, valorBitacora } from '../utils/detalleBitacora.js';

export const BitacoraCambios = ({ evento }) => {
  const campos = cambiosBitacora(evento);
  return <section className="catalogo-panel" aria-labelledby="bitacora-cambios-title">
    <div className="catalogo-toolbar"><div><h3 id="bitacora-cambios-title">Valores registrados</h3><p>Información antes y después de la operación, cuando fue capturada.</p></div></div>
    {campos.length ? <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Valores antes y después">
      <table className="catalogo-table bitacora-cambios"><caption className="visually-hidden">Campos capturados y sus valores históricos</caption>
        <thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead>
        <tbody>{campos.map(({ campo, nombre, sinValor }) => <tr key={campo}><th scope="row">{nombre}{sinValor && <small>Solo se conserva que cambió</small>}</th>
          <td>{sinValor ? 'Valor no conservado' : valorBitacora(evento.antes?.[campo], campo)}</td>
          <td>{sinValor ? 'Valor no conservado' : valorBitacora(evento.despues?.[campo], campo)}</td></tr>)}</tbody>
      </table>
    </div> : <p className="catalogo-note">Este evento no contiene valores antes/después ni campos modificados disponibles. Su ausencia no indica que la operación haya fallado.</p>}
  </section>;
};
