import { Link } from 'react-router-dom';
import { horaCivil, costoDecimal } from '../../../utils/presentacion.js';
import { VentaEstado } from './VentaEstado.jsx';

export const VentaTable = ({ ventas, query, modo, sidebarItemKey }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Ventas registradas">
  <table className="catalogo-table venta-table"><caption className="visually-hidden">Ventas pendientes, confirmadas y anuladas con fechas diferenciadas</caption>
    <thead><tr><th scope="col">Venta</th><th scope="col">Fecha de registro</th><th scope="col">Fecha efectiva de venta</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col" className="venta-number">Total registrado</th><th scope="col">Detalle</th></tr></thead>
    <tbody>{ventas.map(venta => <tr key={venta.idVenta}>
      <td><strong>#{venta.idVenta}</strong><small className="venta-clave">{venta.claveOperacion ?? 'Sin clave registrada'}</small></td><td>{horaCivil(venta.fechaRegistro)}</td>
      <td>{venta.fechaVenta ? horaCivil(venta.fechaVenta) : 'Sin confirmación registrada'}</td>
      <td>{venta.usuarioRegistrador?.nombreUsuario || `Usuario #${venta.idUsuario}`}</td>
      <td><VentaEstado estado={venta.estadoOperacion} /></td><td className="venta-number"><strong>{costoDecimal(venta.total)}</strong></td>
      <td>{modo === 'registrarReceta' ? venta.estadoOperacion === 'PENDIENTE' ? <Link className="venta-link" to={`/ventas/${venta.idVenta}/recetas/nueva`}>Registrar receta <span className="visually-hidden">para la venta #{venta.idVenta}</span></Link> : <span>Solo ventas pendientes</span>
        : modo === 'revisarRecetas' ? <Link className="venta-link" to={`/ventas/${venta.idVenta}/recetas`}>Consultar recetas <span className="visually-hidden">de la venta #{venta.idVenta}</span></Link>
          : <Link className="venta-link" to={`/ventas/${venta.idVenta}`} state={{ ventasQuery: query, sidebarItemKey }}>Ver detalle <span className="visually-hidden">de la venta #{venta.idVenta}</span></Link>}</td>
    </tr>)}</tbody>
  </table>
</div>;
