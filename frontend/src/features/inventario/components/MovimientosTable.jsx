import { Link } from 'react-router-dom';
import { cantidad, costoDecimal, horaCivil } from '../../../utils/presentacion.js';

export const MovimientosTable = ({ movimientos }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Historial de movimientos">
  <table className="catalogo-table inventario-table inventario-table--movimientos">
    <caption className="visually-hidden">Historial de entradas, salidas y reversiones; horas civiles sin conversión</caption>
    <thead><tr><th scope="col">Movimiento / Fecha</th><th scope="col">Medicamento / Existencia</th><th scope="col">Dirección</th><th scope="col" className="inventario-number">Cantidad</th><th scope="col" className="inventario-number">Costo aplicado</th><th scope="col">Motivo / Responsable</th><th scope="col">Trazabilidad</th></tr></thead>
    <tbody>{movimientos.map((m) => <tr key={m.idMovimiento}>
      <td><strong>#{m.idMovimiento}</strong><small>{horaCivil(m.fechaMovimiento)}</small></td>
      <td><Link className="inventario-link" to={`/inventario/medicamentos/${m.existencia.idMedicamento}/existencias`}>{m.existencia.medicamento.nombreComercial}</Link><small>{m.existencia.codigoExistencia} · ID {m.idExistencia}</small></td>
      <td><span className={`inventario-badge ${m.direccion === 'ENTRADA' ? 'inventario-badge--entry' : 'inventario-badge--exit'}`}>{m.direccion === 'ENTRADA' ? 'Entrada' : 'Salida'}</span></td>
      <td className="inventario-number">{cantidad(m.cantidad)}</td><td className="inventario-number">{costoDecimal(m.costoUnitarioAplicado)}</td>
      <td><strong>{m.motivo}</strong><small>{m.usuario?.nombreUsuario || `Usuario #${m.idUsuario}`}</small></td>
      <td><details className="inventario-trace"><summary>Ver referencias y observación</summary><dl>
        <div><dt>Observación</dt><dd>{m.observacion || 'Sin observación'}</dd></div>
        <div><dt>Compra / Detalle</dt><dd>{m.compra ? `#${m.compra.idCompra} / #${m.compra.idDetalleCompra}` : '—'}</dd></div>
        <div><dt>Venta / Detalle</dt><dd>{m.venta ? `#${m.venta.idVenta} / #${m.venta.idDetalleVenta}` : '—'}</dd></div>
        <div><dt>Movimiento original</dt><dd>{m.idMovimientoOriginal === null ? '—' : `#${m.idMovimientoOriginal}`}</dd></div>
        <div><dt>Movimiento de reversión</dt><dd>{m.idMovimientoReversion === null ? '—' : `#${m.idMovimientoReversion}`}</dd></div>
      </dl></details></td>
    </tr>)}</tbody>
  </table>
</div>;
