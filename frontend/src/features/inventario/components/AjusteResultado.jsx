import { Link } from 'react-router-dom';
import { cantidad, costoDecimal, horaCivil } from '../../../utils/presentacion.js';

export const AjusteResultado = ({ resultado, idMedicamento, onNuevoConteo }) => {
  const movimiento = resultado.movimiento;
  return <section className="catalogo-panel ajuste-resultado" aria-label="Resultado del conteo">
    <div className="catalogo-toolbar"><div><h3>{resultado.ajusteRealizado ? 'Ajuste registrado' : 'No fue necesario ajustar la existencia'}</h3><p role="status">{resultado.ajusteRealizado ? 'El saldo, la valoración y el movimiento se confirmaron conjuntamente.' : 'Conciliación sin movimiento ni cambios de saldo o costo promedio.'}</p></div></div>
    <dl className="catalogo-detail">
      <div><dt>Saldo anterior</dt><dd>{cantidad(resultado.saldoAnterior)}</dd></div><div><dt>Saldo contado</dt><dd>{cantidad(resultado.saldoContado)}</dd></div>
      <div><dt>Stock físico confirmado</dt><dd>{cantidad(resultado.stockFisico)}</dd></div><div><dt>Costo promedio confirmado</dt><dd>{costoDecimal(resultado.costoUnitarioPromedio)}</dd></div>
      <div><dt>Diferencia calculada por el servidor</dt><dd>{cantidad(resultado.diferencia)}</dd></div><div><dt>Último movimiento confirmado</dt><dd>{resultado.ultimoMovimiento === null ? 'Sin movimientos' : `#${resultado.ultimoMovimiento}`}</dd></div>
      {movimiento && <><div><dt>Movimiento registrado</dt><dd>#{movimiento.idMovimiento} · {movimiento.direccion === 'ENTRADA' ? 'Entrada' : 'Salida'} · {movimiento.motivo}</dd></div><div><dt>Cantidad del movimiento</dt><dd>{cantidad(movimiento.cantidad)}</dd></div><div><dt>Costo unitario aplicado</dt><dd>{costoDecimal(movimiento.costoUnitarioAplicado)}</dd></div><div><dt>Fecha y hora</dt><dd>{horaCivil(movimiento.fechaMovimiento)}</dd></div><div><dt>Responsable del movimiento</dt><dd>Usuario #{movimiento.idUsuario}</dd></div><div><dt>Observación registrada</dt><dd>{movimiento.observacion}</dd></div></>}
    </dl>
    <p className="catalogo-note">{resultado.ajusteRealizado ? 'Consulta las existencias para ver el stock físico y vendible actualizado. Ajustar una existencia vencida o de un medicamento inactivo no la habilita para venta.' : 'La observación y esta respuesta no se guardaron como auditoría del conteo. El historial no recibió un movimiento nuevo.'}</p>
    <div className="ajuste-resultado__actions"><Link className="button button--secondary" to={`/inventario/medicamentos/${idMedicamento}/existencias`}>Ver existencias actualizadas</Link><Link className="button button--secondary" to={`/inventario/movimientos?idExistencia=${resultado.idExistencia}`}>Ver historial de la existencia</Link><button className="button button--primary" type="button" onClick={onNuevoConteo}>Preparar otro conteo</button></div>
  </section>;
};
