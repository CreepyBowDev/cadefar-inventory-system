import db from '../../data/models/index.js';
import { compraService } from './compra.service.js';
import { pagoCompraService } from './pago-compra.service.js';
import { AppError } from '../../shared/errors/app-error.js';
import { obtenerFechaOperacion } from '../../shared/utils/fecha-operacion.js';

// Solo presentación: importes y saldos proceden del cálculo financiero existente.
const decimalVisible = valor => valor == null ? '—' : String(valor).replace('.', ',');
const dinero = (valor, moneda) => `${decimalVisible(valor)}${moneda ? ` ${moneda}` : ''}`;
const fecha = valor => valor ? String(valor).replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1') : '—';
const laboratorio = (compra, local) => {
    const nombre = compra.proveedorLaboratorio?.nombre;
    return nombre ? (local ? nombre.replace(/\s*[·|—-]?\s*PRUEBA_LOCAL\s*$/i, '').trim() : nombre) : `Proveedor #${compra.idProveedorLaboratorio}`;
};

export class compraComprobanteService {
    static async consultar(idCompra, idPago) {
        return db.sequelize.transaction({ isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
            const compra = await compraService.getCompraById(idCompra, transaction);
            const resumen = await pagoCompraService.consultar(idCompra, { transaction });
            const pago = idPago === undefined ? null : resumen.pagos.find(item => item.idPago === idPago);
            if (idPago !== undefined && !pago) throw new AppError('Pago no encontrado', 404);
            if (pago && pago.estado !== 'CONFIRMADO') throw new AppError('El comprobante solo está disponible para pagos confirmados', 409);
            const local = Boolean(resumen.esPrueba || pago?.esPrueba);
            const consulta = obtenerFechaOperacion().fechaHoraComercial;
            const base = {
                titulo: pago ? 'Comprobante de pago' : 'Comprobante de compra',
                numero: pago ? `PAGO-${pago.idPago}` : `COMPRA-${compra.idCompra}`,
                esPrueba: local,
                datos: [['Número de compra', `#${compra.idCompra}`], ['Laboratorio', laboratorio(compra, local)]],
                columnas: [], filas: [], totales: [],
                notas: [local ? 'Prueba local · Documento local sin valor bancario ni fiscal. No representa una transferencia real.' : 'Registro interno de CADEFAR. No sustituye una factura fiscal.',
                    `Saldos vigentes al consultar: ${fecha(consulta)} (America/La_Paz). Solo se consideran pagos confirmados en CADEFAR.`]
            };
            if (pago) {
                base.datos.push(['Fecha y hora del pago', fecha(pago.fechaConfirmacion)],
                    ['Método', pago.metodo === 'TARJETA' ? 'Tarjeta de débito o crédito' : 'PayPal'],
                    ['Estado del pago', 'Confirmado'], ['Moneda', pago.moneda || 'Sin configurar'],
                    ['Referencia de la transacción', (local ? pago.referenciaExterna?.replace(/^PRUEBA_LOCAL_REF_/, 'LOCAL-') : pago.referenciaExterna) || '—'],
                    ['Administrador responsable', pago.administrador?.nombreUsuario || `#${pago.idUsuario}`]);
                // URL ya filtrada por el servicio financiero; nunca credenciales.
                if (pago.urlComprobante) base.urlComprobante = pago.urlComprobante;
                base.totales.push(['Importe pagado', dinero(pago.importe, pago.moneda)],
                    ['Importe en la pasarela', dinero(pago.importePasarela, pago.monedaPasarela)],
                    ['Saldo restante al consultar', dinero(resumen.saldoPendiente, resumen.moneda)]);
                if (pago.referenciaCotizacion) base.datos.push(['Acuerdo de moneda', pago.referenciaCotizacion]);
            } else {
                base.datos.push(['Fecha de compra', fecha(compra.fechaCompra)], ['Estado de la compra', compra.estadoOperacion === 'ANULADA' ? 'Anulada' : 'Confirmada']);
                base.columnas = ['Medicamento / existencia', 'Cantidad', 'Precio unitario', 'Subtotal'];
                base.filas = compra.detalles.map(detalle => {
                    const existencia = detalle.existencia;
                    const medicamento = existencia?.medicamento;
                    return [[medicamento?.codigoMedicamento, medicamento?.nombreComercial, medicamento?.presentacion, existencia?.codigoExistencia].filter(Boolean).join(' · ') || `Detalle #${detalle.idDetalleCompra}`,
                        String(detalle.cantidad), dinero(detalle.costoUnitario, resumen.moneda), dinero(detalle.subtotal, resumen.moneda)];
                });
                base.totales.push(['Total de la compra', dinero(compra.total, resumen.moneda)],
                    ['Importe abonado', dinero(resumen.totalPagado, resumen.moneda)], ['Saldo pendiente', dinero(resumen.saldoPendiente, resumen.moneda)]);
                base.notas.push('Cantidades y precios registrados en la compra; nombres del catálogo actual.');
                if (compra.estadoOperacion === 'ANULADA') base.notas.push('Compra anulada: importes históricos informativos, no exigibles.');
            }
            return base;
        });
    }
}
