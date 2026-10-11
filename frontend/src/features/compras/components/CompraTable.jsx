import { Link } from 'react-router-dom';
import { fechaCivil, horaCivil, costoDecimal } from '../../../utils/presentacion.js';
import { CompraEstado } from './CompraEstado.jsx';

export const CompraTable = ({ compras, query }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Compras registradas">
  <table className="catalogo-table compra-table"><caption className="visually-hidden">Compras confirmadas y anuladas con fecha de adquisición, proveedor y total registrado</caption>
    <thead><tr><th scope="col">Compra / Clave</th><th scope="col">Adquisición / Registro</th><th scope="col">Proveedor / Laboratorio</th><th scope="col">Registrada por</th><th scope="col">Estado</th><th scope="col" className="compra-number">Total registrado</th><th scope="col">Detalle</th></tr></thead>
    <tbody>{compras.map((c) => <tr key={c.idCompra}>
      <td><strong>#{c.idCompra}</strong><small className="compra-clave">{c.claveOperacion ?? 'Sin clave registrada'}</small></td>
      <td><strong>{fechaCivil(c.fechaCompra)}</strong><small>Registro: {horaCivil(c.fechaRegistro)}</small></td>
      <td>{c.proveedorLaboratorio?.nombre || `Proveedor #${c.idProveedorLaboratorio}`}{c.proveedorLaboratorio?.estado === false && <small>Actualmente inactivo</small>}</td>
      <td>{c.usuarioRegistrador?.nombreUsuario || `Usuario #${c.idUsuario}`}</td>
      <td><CompraEstado estado={c.estadoOperacion} /></td><td className="compra-number"><strong>{costoDecimal(c.total)}</strong></td>
      <td><Link className="compra-link" to={`/compras/${c.idCompra}`} state={{ comprasQuery: query }}>Ver detalle <span className="visually-hidden">de la compra #{c.idCompra}</span></Link></td>
    </tr>)}</tbody>
  </table>
</div>;
