import { idValido } from '../../../utils/presentacion.js';

// Clave de operación, no ID de base de datos. No cambia al reintentar.
export const generarClaveVenta = () => `venta-${Array.from(crypto.getRandomValues(new Uint8Array(16)), valor => valor.toString(16).padStart(2, '0')).join('')}`;
const maximoImporte = 99999999999999n;
const decimal = centavos => `${centavos / 100n}.${String(centavos % 100n).padStart(2, '0')}`;

const precioCentavos = (valor) => {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(valor)) throw new Error('el precio debe usar punto decimal y hasta dos decimales. Máximo: 999999999999.99.');
  const [entero, fraccion = ''] = valor.split('.');
  return BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, '0'));
};

// Solo presentación y validación de formato; no decide stock, recetas ni FEFO.
export const calcularImportesVenta = (detalles) => {
  let total = 0n;
  const subtotales = detalles.map((linea, index) => {
    const cantidad = String(linea.cantidad).trim();
    if (!idValido(cantidad)) throw new Error(`Línea ${index + 1}: la cantidad debe ser un entero positivo de hasta 2147483647.`);
    let precio;
    try { precio = precioCentavos(String(linea.precioUnitario).trim()); }
    catch (error) { throw new Error(`Línea ${index + 1}: ${error.message}`); }
    const subtotal = BigInt(cantidad) * precio;
    if (subtotal > maximoImporte) throw new Error(`Línea ${index + 1}: el importe supera 999999999999.99.`);
    total += subtotal;
    return decimal(subtotal);
  });
  if (total > maximoImporte) throw new Error('El total supera 999999999999.99.');
  return { subtotales, total: decimal(total) };
};

export const prepararVenta = (form, medicamentos) => {
  const claveOperacion = form.claveOperacion.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,64}$/.test(claveOperacion)) throw new Error('La clave admite de 1 a 64 letras sin acentos, números, guion y guion bajo.');
  if (!form.detalles.length) throw new Error('Agrega al menos un medicamento.');
  calcularImportesVenta(form.detalles);
  const detalles = form.detalles.map((linea, index) => {
    const medicamento = medicamentos.find(m => String(m.idMedicamento) === linea.idMedicamento);
    if (!medicamento?.estado) throw new Error(`Línea ${index + 1}: selecciona un medicamento activo.`);
    const existencia = linea.existencia;
    if (!idValido(linea.idExistencia) || !existencia || String(existencia.idExistencia) !== linea.idExistencia || existencia.idMedicamento !== medicamento.idMedicamento) {
      throw new Error(`Línea ${index + 1}: selecciona una existencia real de ese medicamento.`);
    }
    return { idMedicamento: medicamento.idMedicamento, idExistencia: existencia.idExistencia,
      cantidad: Number(linea.cantidad.trim()), precioUnitario: decimal(precioCentavos(linea.precioUnitario.trim())) };
  });
  return { claveOperacion, detalles };
};

export const advertenciasRecetasVenta = (venta) => {
  const recetas = new Map(venta.recetas.map(receta => [receta.idReceta, receta]));
  return venta.detalles.filter(detalle => detalle.idReceta !== null && detalle.idReceta !== undefined &&
    recetas.get(detalle.idReceta)?.resultadoRevision !== 'APROBADA');
};
