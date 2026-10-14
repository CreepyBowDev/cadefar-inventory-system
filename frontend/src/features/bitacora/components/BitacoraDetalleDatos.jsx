import { Link } from 'react-router-dom';
import { getRoleName } from '../../../constants/roles.js';
import { nombreModuloBitacora, nombreRegistroBitacora } from '../utils/presentacionBitacora.js';
import { nombreCausaBitacora } from '../utils/detalleBitacora.js';
import { ACCIONES_BITACORA } from '../utils/consultaBitacora.js';
import { BitacoraFecha } from './BitacoraFecha.jsx';

const Identidad = ({ identidad, ausente }) => identidad ? <>
  <strong>{identidad.nombreUsuario}</strong><small>{getRoleName(identidad.idRol)} · Usuario #{identidad.idUsuario}</small>
</> : <span className="bitacora-ausente">{ausente}</span>;

export const BitacoraDetalleDatos = ({ evento, search }) => <>
  <p className="catalogo-note bitacora-note" id="bitacora-detalle-zona">Hora de Bolivia (America/La_Paz, UTC−4). Identidades y valores corresponden al momento del evento.</p>
  <dl className="catalogo-detail bitacora-detail" aria-describedby="bitacora-detalle-zona">
    <div><dt>Fecha de registro</dt><dd><BitacoraFecha valor={evento.fechaRegistro} /></dd></div>
    <div><dt>Fecha del evento</dt><dd><BitacoraFecha valor={evento.fechaEvento} /></dd></div>
    <div><dt>Módulo</dt><dd>{nombreModuloBitacora(evento.modulo)}</dd></div>
    <div><dt>Operación</dt><dd>{Object.hasOwn(ACCIONES_BITACORA, evento.accion) ? ACCIONES_BITACORA[evento.accion] : evento.accion || 'No disponible'}</dd></div>
    <div><dt>Responsable autenticado</dt><dd><Identidad identidad={evento.responsable} ausente="Sin responsable autenticado" /></dd></div>
    <div><dt>Cuenta objetivo</dt><dd><Identidad identidad={evento.cuentaObjetivo} ausente="Sin cuenta objetivo registrada" /></dd></div>
    <div><dt>Nombre ingresado</dt><dd>{evento.nombreIngresado ?? 'No registrado'}</dd></div>
    <div><dt>Causa</dt><dd>{nombreCausaBitacora(evento.causa)}{evento.causa && <small>{evento.causa}</small>}</dd></div>
    <div><dt>Registro afectado</dt><dd>{evento.registro ? `${nombreRegistroBitacora(evento.registro.tipo)} #${evento.registro.id}` : 'Sin registro asociado'}</dd></div>
    <div><dt>Dirección IP capturada</dt><dd>{evento.direccionIp ?? 'No disponible'}<small>{evento.procedenciaIp === 'SOCKET_PEER' ? 'Conexión directa al servidor (SOCKET_PEER)' : evento.procedenciaIp === 'NO_DISPONIBLE' ? 'Sin IP disponible (NO_DISPONIBLE)' : evento.procedenciaIp || 'Procedencia no disponible'}</small></dd></div>
    <div><dt>Correlación de la solicitud</dt><dd className="bitacora-id">{evento.correlacion ?? 'No disponible'}</dd></div>
    <div><dt>Evento relacionado</dt><dd>{evento.idEventoRelacionado ? <Link className="bitacora-link" to={`/bitacora/${evento.idEventoRelacionado}${search}`}>Ver evento #{evento.idEventoRelacionado}</Link> : 'Sin evento relacionado'}</dd></div>
    <div><dt>Tipo de evento</dt><dd>{evento.tipoEvento}</dd></div>
    <div><dt>Versión del formato</dt><dd>{evento.versionFormato}</dd></div>
  </dl>
  <p className="catalogo-note">La cuenta objetivo y el nombre ingresado no acreditan la identidad del solicitante. La IP puede identificar un intermediario; no equivale necesariamente a la IP original del cliente.</p>
</>;
