import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge.jsx';
import { cantidad, costoDecimal, fechaCivil, fechaEtiqueta } from '../../../utils/presentacion.js';

export const CompraDetallesTable = ({ detalles }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Detalles recibidos en la compra">
  <table className="catalogo-table compra-table"><caption className="visually-hidden">Cada detalle de compra conserva cantidad, costo, subtotal y existencia recibida</caption>
    <thead><tr><th scope="col">Detalle / Medicamento</th><th scope="col">Existencia recibida</th><th scope="col">Vencimiento registrado</th><th scope="col" className="compra-number">Cantidad</th><th scope="col" className="compra-number">Costo unitario</th><th scope="col" className="compra-number">Subtotal</th></tr></thead>
    <tbody>{detalles.map((d) => <tr key={d.idDetalleCompra}>
      <td><strong>{d.existencia.medicamento.nombreComercial}</strong><small>Detalle #{d.idDetalleCompra} · {d.existencia.medicamento.codigoMedicamento}</small><small>{d.existencia.medicamento.formaFarmaceutica} · {d.existencia.medicamento.presentacion}</small><StatusBadge active={d.existencia.medicamento.estado} /></td>
      <td><Link className="compra-link" to={`/inventario/medicamentos/${d.existencia.idMedicamento}/existencias`}>{d.existencia.codigoExistencia}</Link><small>ID {d.idExistencia}</small><Link className="compra-link" to={`/inventario/movimientos?idExistencia=${d.idExistencia}`}>Ver movimientos</Link></td>
      <td>{fechaEtiqueta(d.existencia)}<small>Precisión: {d.existencia.precisionVencimiento === 'MES' ? 'mes' : 'día'}</small><small>Fecha guardada: {fechaCivil(d.existencia.fechaVencimiento)}</small></td>
      <td className="compra-number">{cantidad(d.cantidad)}<small>{d.existencia.medicamento.unidadInventario}</small></td><td className="compra-number">{costoDecimal(d.costoUnitario)}</td><td className="compra-number">{costoDecimal(d.subtotal)}</td>
    </tr>)}</tbody>
  </table>
</div>;
