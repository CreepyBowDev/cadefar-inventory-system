import { ReporteOperacionesConsulta } from '../components/ReporteOperacionesConsulta.jsx';
import { ReporteComprasResumen, ReporteComprasTable } from '../components/ReporteComprasResultado.jsx';
import { getReporteCompras } from '../services/reporte.service.js';

export const ReporteComprasPage = () => <ReporteOperacionesConsulta key="compras" tipo="compras" consultar={getReporteCompras}
  titulo="Reporte de compras" descripcion="Consulta compras por día, mes o período de adquisición, con importes históricos y estados separados."
  nota="El período corresponde a la fecha de adquisición (fecha de compra), no al registro ni a la anulación."
  Resumen={ReporteComprasResumen} Table={ReporteComprasTable} />;
