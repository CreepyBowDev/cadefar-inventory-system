import { Link } from 'react-router-dom';
import { cantidad, costoDecimal, horaCivil } from '../../../utils/presentacion.js';

export const RetiroResultado = ({ resultado, idMedicamento, onNuevoRetiro }) => {
  const movimiento = resultado.movimiento;
  const motivo = movimiento.motivo === 'DAÑO' ? 'daño' : 'vencimiento';
  return <section className="catalogo-panel retiro-resultado" aria-label="Resultado del retiro">
    <div className="catalogo-toolbar"><div><h3>Retiro por {motivo} registrado</h3><p role="status">El saldo físico y el movimiento se confirmaron conjuntamente.</p></div></div>
    <dl className="catalogo-detail">
      <div><dt>Saldo anterior</dt><dd>{cantidad(resultado.saldoAnterior)}</dd></div><div><dt>Cantidad retirada</dt><dd>{cantidad(resultado.cantidadRetirada)}</dd></div>
      <div><dt>Stock físico confirmado</dt><dd>{cantidad(resultado.stockFisico)}</dd></div><div><dt>Costo promedio conservado</dt><dd>{costoDecimal(resultado.costoUnitarioPromedio)}</dd></div>
      <div className="retiro-perdida"><dt>Pérdida valorizada por {motivo}</dt><dd>{costoDecimal(resultado.perdida)}</dd></div><div><dt>Costo unitario aplicado</dt><dd>{costoDecimal(movimiento.costoUnitarioAplicado)}</dd></div>
      <div><dt>Movimiento registrado</dt><dd>#{movimiento.idMovimiento} · Salida · {movimiento.motivo}</dd></div><div><dt>Último movimiento confirmado</dt><dd>#{resultado.ultimoMovimiento}</dd></div>
      <div><dt>Responsable del movimiento</dt><dd>Usuario #{movimiento.idUsuario}</dd></div><div><dt>Fecha y hora</dt><dd>{horaCivil(movimiento.fechaMovimiento)}</dd></div><div><dt>Observación registrada</dt><dd>{movimiento.observacion ?? 'Sin observación'}</dd></div>
    </dl>
    <p className="catalogo-note">La pérdida se deriva del movimiento y su costo aplicado; no es una columna adicional. Consulta las existencias para ver el stock vendible actualizado. El retiro conserva el vencimiento y el historial.</p>
    <div className="retiro-resultado__actions"><Link className="button button--secondary" to={`/inventario/medicamentos/${idMedicamento}/existencias`}>Ver existencias actualizadas</Link><Link className="button button--secondary" to={`/inventario/movimientos?idExistencia=${resultado.idExistencia}`}>Ver historial de la existencia</Link><button className="button button--primary" type="button" onClick={onNuevoRetiro}>Preparar otro retiro</button></div>
  </section>;
};
