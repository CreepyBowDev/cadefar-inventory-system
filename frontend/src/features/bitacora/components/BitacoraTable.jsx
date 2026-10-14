import { Link } from 'react-router-dom';
import { getRoleName } from '../../../constants/roles.js';
import { fechaRegistroBitacora, nombreEventoBitacora, nombreModuloBitacora, nombreRegistroBitacora } from '../utils/presentacionBitacora.js';
import { BitacoraResultado } from './BitacoraResultado.jsx';

export const BitacoraTable = ({ eventos, query }) => <div className="catalogo-table-wrap bitacora-table-wrap" tabIndex={0} role="region" aria-label="Eventos de Bitácora" aria-describedby="bitacora-zona">
  <table className="catalogo-table bitacora-table">
    <caption className="visually-hidden">Eventos ordenados por fecha de registro e identificador, de más reciente a más antiguo</caption>
    <thead><tr>
      <th scope="col">Fecha de registro</th><th scope="col">Evento</th><th scope="col">Módulo</th>
      <th scope="col">Responsable / Cuenta objetivo</th><th scope="col">Resultado</th><th scope="col">Registro afectado</th>
    </tr></thead>
    <tbody>{eventos.map(evento => {
      const instante = fechaRegistroBitacora(evento.fechaRegistro);
      return <tr key={evento.idEvento}>
        <td className="bitacora-fecha">{instante ? <time dateTime={evento.fechaRegistro}><strong>{instante.fecha}</strong><small>{instante.hora}</small></time> : 'Fecha no disponible'}</td>
        <td className="bitacora-evento"><Link className="bitacora-link" to={`/bitacora/${evento.idEvento}${query ? `?${query}` : ''}`} aria-label={`Ver detalle del evento #${evento.idEvento}: ${nombreEventoBitacora(evento.tipoEvento)}`}><strong>{nombreEventoBitacora(evento.tipoEvento)}</strong></Link><small>Evento #{evento.idEvento}</small></td>
        <td>{nombreModuloBitacora(evento.modulo)}</td>
        <td className="bitacora-identidad">
          {evento.responsable ? <><strong>{evento.responsable.nombreUsuario}</strong><small>{getRoleName(evento.responsable.idRol)} · Usuario #{evento.responsable.idUsuario}</small></> : <span className="bitacora-ausente">Sin responsable autenticado</span>}
          {evento.cuentaObjetivo && <small className="bitacora-objetivo">Cuenta objetivo: {evento.cuentaObjetivo.nombreUsuario} (#{evento.cuentaObjetivo.idUsuario})</small>}
          {!evento.cuentaObjetivo && evento.nombreIngresado && <small className="bitacora-objetivo">Nombre ingresado: {evento.nombreIngresado}</small>}
        </td>
        <td><BitacoraResultado resultado={evento.resultado} /></td>
        <td>{evento.registro ? <><span>{nombreRegistroBitacora(evento.registro.tipo)}</span><small className="bitacora-id">#{evento.registro.id}</small></> : <span className="bitacora-ausente">Sin registro asociado</span>}</td>
      </tr>;
    })}</tbody>
  </table>
</div>;
