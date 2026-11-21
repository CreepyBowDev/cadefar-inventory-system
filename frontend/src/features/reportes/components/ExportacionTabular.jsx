import { useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import { ROLES } from '../../../constants/roles.js';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { exportarMovimientos } from '../../inventario/services/inventario.service.js';
import { exportarReporteVentas, exportarReporteCompras, exportarReportePerdidas } from '../services/reporte.service.js';
import { prepararTabular, prepararEstadistica } from '../utils/exportacionTabular.js';
import { useExportacionTabular } from '../hooks/useExportacionTabular.js';
import '../styles/reportes.css';

const servicios = { ventas: exportarReporteVentas, compras: exportarReporteCompras, perdidas: exportarReportePerdidas, movimientos: exportarMovimientos };
const etiquetas = { dia: 'Día', mes: 'Mes', desde: 'Desde', hasta: 'Hasta', estadoOperacion: 'Estado', motivo: 'Motivo', idMedicamento: 'Medicamento ID', idExistencia: 'Existencia ID', direccion: 'Dirección', granularidad: 'Granularidad', grafico: 'Gráfica', metrica: 'Métrica' };

export const ExportacionTabular = ({ fuente, pendiente = false, restringida = false, onRestringida, presentacion = 'TABULAR', seleccion }) => {
  const id = useId();
  const location = useLocation();
  const { usuario, loading } = useAuth();
  const [formato, setFormato] = useState('');
  const permitido = !loading && usuario && (usuario.idRol === ROLES.ADMINISTRADOR || (['perdidas', 'movimientos'].includes(fuente) && usuario.idRol === ROLES.REGENTE));
  const estadistica = presentacion === 'ESTADISTICA';
  // CSV no conserva parámetros gráficos ocultos en su solicitud. La selección
  // visual sigue siendo independiente y se comparte solo en PDF/XLSX.
  const seleccionArchivo = estadistica && formato !== 'CSV' ? seleccion : undefined;
  const clave = JSON.stringify([fuente, location.key, location.search, usuario?.idUsuario, usuario?.idRol, loading, pendiente, restringida, presentacion, formato, seleccionArchivo]);
  const { estado, iniciar, cancelar } = useExportacionTabular(clave, servicios[fuente], onRestringida, usuario);
  let params, error = '';
  try { params = estadistica ? prepararEstadistica(location.search, fuente, formato || 'PDF', seleccionArchivo) : prepararTabular(location.search, fuente, formato || 'PDF'); }
  catch (fallo) { error = fallo.message; }
  if (!permitido) return null;
  const bloqueada = restringida || [401, 403].includes(estado.status);
  const criterios = params && Object.entries(params).filter(([campo]) => !['formato', 'presentacion'].includes(campo));
  return <section className="reporte-exportacion" aria-label={estadistica ? 'Exportación estadística' : 'Exportación tabular'}>
    <fieldset aria-busy={estado.ocupada || undefined}>
      <legend>{estadistica ? 'Exportar estadísticas' : 'Exportar tabla'} de {fuente}</legend>
      <p className="catalogo-note">Presentación: {presentacion}. {estadistica ? 'Todas las métricas, series, categorías y ceros del período aplicado, aunque ocultes categorías o muestres un solo panel.' : 'Todas las coincidencias de los filtros aplicados, no solo la página visible.'} Cada archivo usa una consulta independiente y puede diferir del resultado anterior.</p>
      {estadistica && <p className="catalogo-note">CSV contiene datos, no imagen. PDF/XLSX incluyen gráfica y tabla exacta completa; XLSX incluye una imagen, no un gráfico nativo editable. PDF/XLSX usan la selección de Gráfica y Métrica de esta vista (inicialmente barras y cantidad); puedes cambiarla antes de descargar. Máximo 1200 intervalos, 8 series y 9600 filas; no se recortan archivos para encajar límites.</p>}
      <p className="catalogo-note">Solo demostración LOCAL; el servidor determina la disponibilidad. No acredita uso productivo. El archivo puede consumir hasta 128 MiB en el navegador.</p>
      <p className="catalogo-note">Criterios aplicados: {error ? 'no válidos para exportar' : criterios.length ? criterios.map(([campo, valor]) => `${etiquetas[campo]}: ${valor}`).join('; ') : 'todos los movimientos, sin límites temporales'}. {fuente === 'movimientos' && params && 'Los límites temporales omitidos quedan abiertos.'}</p>
      <div className="reporte-exportacion__acciones">
        <div className="form-field"><label htmlFor={id}>Formato de exportación</label><select id={id} value={formato} onChange={event => setFormato(event.target.value)} disabled={!!estado.ocupada || bloqueada}><option value="">Selecciona un formato</option>{['PDF', 'XLSX', 'CSV'].map(valor => <option key={valor} value={valor}>{valor}</option>)}</select></div>
        <button type="button" className="button button--secondary" disabled={!formato || !!error || pendiente || bloqueada || !!estado.ocupada} onClick={() => iniciar(params)}>Exportar {formato || (estadistica ? 'estadísticas' : 'tabla')}</button>
        {estado.ocupada && <button type="button" className="button button--secondary" onClick={cancelar}>Cancelar exportación</button>}
      </div>
      {pendiente && <p role="status">Espera a que se apliquen los filtros del historial.</p>}
      <FeedbackMessage message={error} />
      <FeedbackMessage message={estado.message} tone={estado.error ? 'error' : 'success'} />
      {estado.status === 400 && <p>Revisa los filtros aplicados{estadistica && ' y la granularidad (máximo 1200 intervalos)'} y vuelve a intentarlo manualmente.</p>}
      {estado.status === 401 && <a className="button button--secondary" href="/login">Ir al inicio de sesión</a>}
    </fieldset>
  </section>;
};
