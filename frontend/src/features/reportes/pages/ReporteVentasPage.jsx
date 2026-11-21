import { ReporteOperacionesConsulta } from '../components/ReporteOperacionesConsulta.jsx';
import { ReporteVentasResumen, ReporteVentasTable } from '../components/ReporteVentasResultado.jsx';
import { getReporteVentas } from '../services/reporte.service.js';

export const ReporteVentasPage = () => <ReporteOperacionesConsulta key="ventas" tipo="ventas" consultar={getReporteVentas}
  titulo="Reporte de ventas" descripcion="Consulta ventas por día, mes o período, con importes históricos y categorías diferenciadas."
  nota="Confirmadas y anuladas confirmadas se consultan por fecha de confirmación; pendientes y anuladas sin confirmar, por registro."
  Resumen={ReporteVentasResumen} Table={ReporteVentasTable} estadisticasVentas />;
