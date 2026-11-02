import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Pagination } from '../../../components/Pagination.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { fechaCivil, horaCivil, idValido } from '../../../utils/presentacion.js';
import { getVenta } from '../../ventas/services/venta.service.js';
import { getRecetas } from '../services/receta.service.js';
import { RecetaEstado } from '../components/RecetaEstado.jsx';
import { RecetaError } from '../components/RecetaError.jsx';
import { leerConsultaRecetas, revisionPendiente } from '../utils/recetaForm.js';
import '../styles/recetas.css';

const consultarRecetas = async ({ idVenta, filtros }) => {
  if (!idValido(idVenta)) throw { response: { status: 400, data: { message: 'El identificador de la venta no es válido.' } } };
  const [venta, recetas] = await Promise.all([getVenta(idVenta), getRecetas(idVenta, filtros)]);
  return { data: { venta: venta.data, recetas: recetas.data }, paginacion: recetas.paginacion };
};

export const RecetasPage = () => {
  const { idVenta } = useParams();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const { filtros, error } = leerConsultaRecetas(query);
  const consulta = useConsulta(consultarRecetas, `${idVenta}?${query}`, { idVenta, filtros }, !error);
  const restringida = consulta.status === 401 || consulta.status === 403;
  const venta = consulta.data?.venta;
  const cambiar = nuevos => { consulta.invalidate(); setParams(new URLSearchParams(nuevos)); };
  const fueraDeRango = consulta.paginacion && consulta.paginacion.pagina > Math.max(1, consulta.paginacion.totalPaginas);
  return <div className="catalogo-page recetas-page">
    <Link className="back-link" to={`/ventas/${idVenta}`}><AppIcon name="arrowLeft" size={17} />Volver a la venta</Link>
    <header className="page-heading"><div><h2>Recetas de la venta #{idVenta}</h2><p>Consulta cada receta pendiente para aprobarla o rechazarla. El listado no muestra datos personales.</p></div>{venta?.estadoOperacion === 'PENDIENTE' && <Link className="button button--primary" to={`/ventas/${idVenta}/recetas/nueva`}>Registrar receta</Link>}</header>
    <section className="catalogo-panel" aria-label="Recetas de la venta">
      <div className="catalogo-toolbar"><div><h3>Recetas registradas</h3><p role="status">{consulta.loading ? 'Consultando recetas…' : consulta.error || error ? 'Consulta no disponible' : `${consulta.data?.recetas.length || 0} de ${consulta.paginacion?.total ?? 0} recetas`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={consulta.loading || restringida || !!error}>Actualizar recetas</button></div>
      <div aria-busy={consulta.loading}>
        {error ? <><FeedbackMessage message={error} /><button className="button button--secondary" type="button" onClick={() => setParams({})}>Limpiar criterios</button></>
          : consulta.loading ? <CatalogoState loading message="Cargando recetas…" /> : consulta.error ? <RecetaError consulta={consulta} />
            : fueraDeRango ? <CatalogoState icon="prescription" title="Esta página no tiene recetas" message="La página solicitada supera las disponibles."><button className="button button--secondary" type="button" onClick={() => cambiar({ ...filtros, pagina: '1' })}>Volver a la primera página</button></CatalogoState>
              : consulta.data?.recetas.length ? <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Listado de recetas"><table className="catalogo-table receta-table"><caption className="visually-hidden">Recetas de esta venta y su estado de revisión</caption><thead><tr><th scope="col">Receta</th><th scope="col">Fecha de receta</th><th scope="col">Registro</th><th scope="col">Modalidad</th><th scope="col">Estado</th><th scope="col">Revisión</th><th scope="col">Detalle</th></tr></thead>
                <tbody>{consulta.data.recetas.map(receta => <tr key={receta.idReceta}><td>#{receta.idReceta}</td><td>{fechaCivil(receta.fechaReceta)}</td><td>{horaCivil(receta.fechaRegistro)}</td><td>{receta.modalidad}</td><td><RecetaEstado resultado={receta.resultadoRevision} inconsistente={receta.resultadoRevision === null && !revisionPendiente(receta)} /></td><td>{horaCivil(receta.fechaValidacion)}{receta.idUsuarioValidador && <small>Usuario #{receta.idUsuarioValidador}</small>}</td><td><Link className="venta-link" to={`/ventas/${idVenta}/recetas/${receta.idReceta}`}>Consultar receta #{receta.idReceta}</Link></td></tr>)}</tbody>
              </table></div> : <CatalogoState icon="prescription" title="Sin recetas registradas" message="Esta venta no tiene recetas asociadas. Si está pendiente, puedes registrar una receta desde este contexto." />}
      </div>
      {!error && <Pagination nombre="Recetas" id="receta" paginacion={consulta.paginacion} filtros={filtros} disabled={consulta.loading || restringida || !!consulta.error} onPage={pagina => cambiar({ ...filtros, pagina: String(pagina) })} onLimit={limite => cambiar({ limite, pagina: '1' })} />}
      <p className="catalogo-note">Aprobar una receta no confirma la venta ni modifica el inventario. La confirmación posterior corresponde al Vendedor.</p>
    </section>
  </div>;
};
