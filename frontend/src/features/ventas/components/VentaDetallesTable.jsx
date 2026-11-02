import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge.jsx';
import { cantidad, costoDecimal, fechaEtiqueta } from '../../../utils/presentacion.js';

export const VentaDetallesTable = ({ detalles, definitiva }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Productos de la venta">
  <table className="catalogo-table venta-table"><caption className="visually-hidden">Productos y existencias {definitiva ? 'definitivas' : 'provisionales'} de la venta</caption>
    <thead><tr><th scope="col">Detalle / Medicamento</th><th scope="col">Existencia {definitiva ? 'definitiva' : 'provisional'}</th><th scope="col">Vencimiento</th><th scope="col" className="venta-number">Cantidad</th><th scope="col" className="venta-number">Precio unitario</th><th scope="col" className="venta-number">Subtotal</th><th scope="col">Receta vinculada</th></tr></thead>
    <tbody>{detalles.map(detalle => {
      const existencia = detalle.existencia;
      const medicamento = existencia?.medicamento;
      return <tr key={detalle.idDetalleVenta}>
        <td><strong>{medicamento?.nombreComercial || 'Medicamento no disponible'}</strong><small>Detalle #{detalle.idDetalleVenta}{medicamento && ` · ${medicamento.codigoMedicamento}`}</small>{medicamento && <><small>{medicamento.formaFarmaceutica} · {medicamento.presentacion}</small><StatusBadge active={medicamento.estado} /></>}</td>
        <td>{existencia ? <Link className="venta-link" to={`/inventario/medicamentos/${existencia.idMedicamento}/existencias`}>{existencia.codigoExistencia}</Link> : 'Existencia no disponible'}<small>ID {detalle.idExistencia}</small></td>
        <td>{existencia?.fechaVencimiento ? fechaEtiqueta(existencia) : '—'}{existencia && <small>Precisión: {existencia.precisionVencimiento === 'MES' ? 'mes' : 'día'}</small>}</td>
        <td className="venta-number">{cantidad(detalle.cantidad)}<small>{medicamento?.unidadInventario}</small></td><td className="venta-number">{costoDecimal(detalle.precioUnitario)}</td><td className="venta-number">{costoDecimal(detalle.subtotal)}</td>
        <td>{detalle.idReceta ? `Receta #${detalle.idReceta}` : 'Sin receta vinculada'}</td>
      </tr>;
    })}</tbody>
  </table>
</div>;
