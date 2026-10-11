import { idValido } from '../../../utils/presentacion.js';

// La clave identifica una operación, no una PK. Se conserva durante reintentos.
export const generarClaveCompra = () => `compra-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('')}`;

const fechaValida = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [anio, mes, dia] = value.split('-').map(Number);
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return anio >= 1000 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1];
};

// Validaciones de formato/UX. Vigencia, saldos, agrupación y valoración son del backend.
export const prepararCompra = (form, medicamentos, proveedores) => {
  const claveOperacion = form.claveOperacion.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,64}$/.test(claveOperacion)) throw new Error('La clave admite de 1 a 64 letras sin acentos, números, guion y guion bajo.');
  if (!fechaValida(form.fechaCompra)) throw new Error('Indica una fecha de adquisición válida.');
  if (!form.detalles.length) throw new Error('Agrega al menos una línea de recepción.');
  let proveedor;
  const detalles = form.detalles.map((linea, index) => {
    const error = (message) => { throw new Error(`Línea ${index + 1}: ${message}`); };
    const medicamento = medicamentos.find((m) => String(m.idMedicamento) === linea.idMedicamento);
    if (!medicamento?.estado) error('selecciona un medicamento activo.');
    if (!proveedores.some((p) => p.idProveedorLaboratorio === medicamento.idProveedorLaboratorio && p.estado)) error('el proveedor del medicamento debe estar activo.');
    if (proveedor !== undefined && proveedor !== medicamento.idProveedorLaboratorio) error('todos los medicamentos deben pertenecer al mismo proveedor.');
    proveedor = medicamento.idProveedorLaboratorio;
    const cantidad = linea.cantidad.trim();
    if (!idValido(cantidad)) error('la cantidad debe ser un entero positivo de hasta 2147483647.');
    const costoUnitario = linea.costoUnitario.trim();
    if (!/^\d{1,8}(?:\.\d{1,6})?$/.test(costoUnitario)) error('el costo debe usar punto decimal y hasta seis decimales, sin coma ni exponente. Máximo: 99999999.999999.');
    const [entero, fraccion = ''] = costoUnitario.split('.');
    if (BigInt(entero) * 1000000n + BigInt(fraccion.padEnd(6, '0')) <= 0n) error('el costo unitario debe ser mayor que cero.');
    if (linea.precisionVencimiento === 'MES') {
      if (!fechaValida(`${linea.fechaVencimiento}-01`)) error('indica un mes válido con formato AAAA-MM.');
    } else if (linea.precisionVencimiento !== 'DIA' || !fechaValida(linea.fechaVencimiento)) error('indica una fecha de vencimiento válida.');
    return { idMedicamento: medicamento.idMedicamento, cantidad: Number(cantidad), costoUnitario,
      precisionVencimiento: linea.precisionVencimiento, fechaVencimiento: linea.fechaVencimiento };
  });
  return { claveOperacion, fechaCompra: form.fechaCompra, detalles };
};
