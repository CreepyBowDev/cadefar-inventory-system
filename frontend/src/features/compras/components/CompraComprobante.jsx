import { useState } from 'react';
import { ComprobanteModal } from './ComprobanteModal.jsx';

export const CompraComprobante = ({ compra }) => {
  const [open, setOpen] = useState(false);
  return <section className="catalogo-panel" aria-label="Comprobante de compra">
    <div className="catalogo-toolbar"><h3>Comprobante de compra</h3><button className="button button--secondary" type="button" onClick={() => setOpen(true)}>Ver comprobante de compra</button></div>
    {open && <ComprobanteModal idCompra={compra.idCompra} titulo="Comprobante de compra" onClose={() => setOpen(false)} />}
  </section>;
};
