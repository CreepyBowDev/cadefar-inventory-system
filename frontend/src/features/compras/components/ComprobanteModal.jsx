import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../../components/Modal.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { activarDescarga } from '../../../utils/activarDescarga.js';
import { getComprobanteCompra, descargarComprobanteCompra } from '../services/compra-comprobante.service.js';
import { CompraError } from './CompraError.jsx';
import '../styles/comprobantes.css';

export const ComprobanteModal = ({ idCompra, idPago, titulo, onClose }) => {
  const ids = { idCompra, idPago };
  const consulta = useConsulta(getComprobanteCompra, `${idCompra}/${idPago ?? ''}`, ids);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const controller = useRef(null), active = useRef(true), inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); }; }, []);
  const descargar = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    try {
      const archivo = await descargarComprobanteCompra(ids, abort.signal);
      if (active.current && !abort.signal.aborted) activarDescarga(archivo);
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  const documento = consulta.data;
  return createPortal(<div className="comprobante-vista">
    <Modal open title={titulo} size="large" manageFocus onClose={onClose}>
      {consulta.loading ? <CatalogoState loading message="Cargando comprobante…" /> : consulta.error ? <CompraError consulta={consulta} /> : documento && <>
        <article className="comprobante-documento" aria-label={documento.titulo}>
          <header className="comprobante-encabezado"><div><strong>CADEFAR</strong><h2>{documento.titulo}</h2></div><p>{documento.numero}{documento.esPrueba && <small>Prueba local · Sin valor bancario ni fiscal</small>}</p></header>
          <table className="comprobante-datos"><tbody>{documento.datos.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
          {documento.columnas.length > 0 && <table className="comprobante-lineas"><thead><tr>{documento.columnas.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{documento.filas.map((fila, i) => <tr key={i}>{fila.map((valor, j) => <td key={j}>{valor}</td>)}</tr>)}</tbody></table>}
          <table className="comprobante-totales"><tbody>{documento.totales.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
          <footer>{documento.notas.map(nota => <p key={nota}>{nota}</p>)}</footer>
        </article>
        <div className="modal__actions comprobante-acciones">
          {documento.urlComprobante && <a className="button button--secondary" href={documento.urlComprobante} target="_blank" rel="noopener noreferrer">Comprobante del proveedor de pagos</a>}
          <button type="button" className="button button--secondary" onClick={() => window.print()}>Imprimir</button>
          <button type="button" className="button button--primary" disabled={busy} onClick={descargar}>{busy ? 'Descargando…' : 'Descargar PDF'}</button>
        </div>
        <FeedbackMessage message={error} />
      </>}
    </Modal>
  </div>, document.body);
};
