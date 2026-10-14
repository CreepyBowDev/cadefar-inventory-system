import { nombreRegistroBitacora } from '../utils/presentacionBitacora.js';
import { METADATOS_BITACORA, fechaMetadatoBitacora, valorBitacora } from '../utils/detalleBitacora.js';
import { BitacoraFecha } from './BitacoraFecha.jsx';

export const BitacoraDatosAdicionales = ({ evento }) => {
  const metadatos = Object.entries(METADATOS_BITACORA).filter(([campo]) => Object.hasOwn(evento.metadatos || {}, campo));
  const referencias = evento.referencias || [];
  return <>
    <section className="catalogo-panel" aria-labelledby="bitacora-metadatos-title">
      <div className="catalogo-toolbar"><h3 id="bitacora-metadatos-title">Contexto de la operación</h3></div>
      {metadatos.length ? <dl className="catalogo-detail bitacora-detail">{metadatos.map(([campo, nombre]) => <div key={campo}><dt>{nombre}</dt><dd>
        {['bloqueadoDesde', 'bloqueadoHasta'].includes(campo) ? <BitacoraFecha valor={fechaMetadatoBitacora(evento.metadatos[campo])} /> : valorBitacora(evento.metadatos[campo], campo)}
      </dd></div>)}</dl> : <p className="catalogo-note">Sin metadatos disponibles para este evento.</p>}
      {evento.metadatos?.estadoEnvio && <p className="catalogo-note">El estado técnico del envío no acredita entrega al buzón ni restablecimiento de contraseña.</p>}
    </section>
    <section className="catalogo-panel" aria-labelledby="bitacora-referencias-title">
      <div className="catalogo-toolbar"><div><h3 id="bitacora-referencias-title">Referencias de la operación</h3><p>{referencias.length} referencias capturadas</p></div></div>
      {referencias.length ? <ul className="bitacora-referencias">{referencias.map((referencia, indice) => <li key={indice}><span>{nombreRegistroBitacora(referencia.tipo)}</span><strong>#{referencia.id}</strong></li>)}</ul> : <p className="catalogo-note">Sin referencias adicionales registradas.</p>}
      {evento.metadatos?.cantidadReferenciasOmitidas > 0 && <p className="catalogo-note bitacora-note">Se omitieron {evento.metadatos.cantidadReferenciasOmitidas} referencias al capturar el evento. Esta lista no representa la operación completa.</p>}
    </section>
  </>;
};
