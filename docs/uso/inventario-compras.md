# Uso de Inventario y Compras

Este bloque está implementado en React y Express y cuenta con aceptación automatizada contra MySQL local en bases temporales. Utiliza tu cuenta existente para la revisión manual de las pantallas.

La corrección posterior del listado de Inventario para exigir existencias registradas está verificada con pruebas backend puras/simuladas y frontend con API simulada. Su integración MySQL está pendiente de autorización y ejecución; la aceptación anterior del bloque no acredita esta corrección.

## Arranque local

1. Mantén MySQL iniciado.
2. Desde `backend/`, ejecuta `pnpm start`.
3. Desde `frontend/`, ejecuta `pnpm dev --host localhost --port 5173 --strictPort`.
4. Abre `http://localhost:5173` e inicia sesión.

La configuración habitual es `PORT=3000`, `FRONTEND_URL=http://localhost:5173` y `VITE_API_URL=http://localhost:3000/api`. Si el puerto cambia, ajusta las URLs correspondientes. Ambos proyectos tienen su propio `.env`; el frontend solo necesita la URL pública de la API. La base configurada debe tener las migraciones del bloque, incluida la de snapshots B1. Las instrucciones generales de instalación están en el [README](../../README.md).

## Acceso por rol

| Función | Administrador | Regente | Vendedor |
|---|---|---|---|
| Inventario, existencias y stock bajo | Sí | Sí | Sí |
| Movimientos, próximos a vencer y vencidos | Sí | Sí | No |
| Consultar compras y su detalle | Sí | Sí | No |
| Registrar y anular compras | Sí | No | No |
| Conciliar conteo físico y registrar retiros | No | Sí | No |

Los permisos se comprueban también en la API. Una sesión deja de estar disponible al cerrar sesión; si otra pestaña mantiene datos públicos anteriores, una consulta 401 ofrece volver al login y comprobarla nuevamente.

## Consultas de Inventario

- **Inventario** (`/inventario`): stock físico y vendible de medicamentos con al menos una existencia registrada, incluidos agotados, inactivos y vencidos. También incluye existencias iniciales o históricas sin compra vinculada. Crear un producto en el catálogo no registra existencias ni lo incorpora a este listado.
- **Existencias**: abre «Ver existencias» en Inventario o en la ficha del medicamento para consultar sus saldos, vencimientos, costos y último movimiento. Un producto sin existencias muestra una lista vacía y conserva su nombre, código y enlace a la ficha; Administrador y Regente también pueden abrir su historial. La identificación procede del catálogo y los datos de existencias de su consulta específica.
- **Stock bajo** (`/inventario/stock-bajo`): medicamentos activos cuyo stock vendible es menor o igual al mínimo, incluidos productos sin existencias. Su criterio es independiente del listado de Inventario.
- **Movimientos** (`/inventario/movimientos`): historial con dirección, motivo, responsable, costo aplicado y referencias a compra/venta, original y reversión.
- **Próximos a vencer** (`/vencimientos`) y **Vencidos** (`/vencimientos/vencidos`): resultados calculados por el backend.

Aplica los filtros con «Consultar». Quedan en la URL para recarga y navegación atrás/adelante. «Actualizar» vuelve a consultar los valores actuales.

El **físico** representa unidades presentes; el **vendible** excluye vencidas y vale cero para medicamentos inactivos. Una existencia vencida puede conservar stock físico hasta que se registre su retiro. DIA vence al inicio de su fecha; MES desde el primer día del mes siguiente. Las fechas se presentan como fechas civiles de Bolivia y los valores decimales conservan su precisión.

## Registrar una compra — Administrador

1. En Compras (`/compras`), elige registrar una compra.
2. Ingresa fecha de adquisición y conserva la clave de operación generada, o edítala antes del primer envío.
3. Selecciona medicamentos activos de un único proveedor activo; el proveedor se obtiene de la selección.
4. Ingresa cantidades, costos con punto decimal de hasta seis decimales y vencimientos DIA/MES. Puedes agregar líneas repetidas.
5. Revisa y confirma.
6. Comprueba el detalle, las existencias actualizadas y sus movimientos.

La API calcula los importes, identifica las existencias y actualiza sus promedios. El total y las líneas del detalle son los registrados, incluso si posteriormente cambia el catálogo.

Si se pierde la respuesta o la clave ya existe, usa «Consultar mi compra por clave» y revisa la compra encontrada antes de continuar. Encontrarla no compara su contenido con el borrador. Una consulta vacía no prueba que una solicitud pendiente haya terminado. Conserva la misma clave para los reintentos; no se reutiliza aunque la compra se anule. Copia la clave antes de salir o recargar, ya que el borrador es local.

## Conciliar un conteo — Regente

1. Desde Existencias, abre «Ajustar conteo».
2. La pantalla obtiene nuevamente saldo y último movimiento de esa existencia.
3. Ingresa el **saldo total contado**, no la diferencia, y una observación obligatoria.
4. Si el saldo contado supera el consultado, ingresa el costo de las unidades adicionales.
5. Revisa y confirma. Comprueba el resultado y consulta las existencias o el historial.

Una salida conserva el promedio vigente. Si el conteo coincide y las precondiciones siguen vigentes, se informa que no fue necesario ajustar: no se crea movimiento ni auditoría persistida del conteo. Vencidas/inactivos admiten conteos, sin habilitarlos para venta.

## Registrar un retiro — Regente

1. Desde Existencias o Vencidos, abre «Retirar por vencimiento» o «Retirar por daño».
2. Ingresa una cantidad positiva que no supere el físico consultado.
3. Para daño, describe la observación obligatoria; para vencimiento es opcional.
4. Revisa y confirma.
5. Comprueba cantidad, saldo confirmado, movimiento, costo y pérdida valorizada; consulta existencias e historial.

Vencimiento requiere una existencia vencida con saldo físico positivo. Daño no exige vencimiento. Se admiten medicamentos inactivos. La API aplica y conserva el promedio vigente, incluido cero, y calcula la pérdida exacta.

## Anular una compra — Administrador

1. Abre el detalle de una compra confirmada desde Compras.
2. En «Anular esta compra», indica el motivo obligatorio de hasta 255 caracteres.
3. Revisa y confirma la anulación completa.
4. Comprueba estado ANULADA, motivo, responsable y fecha. Abre las existencias o los movimientos desde las líneas para ver los saldos y las reversiones.

El servidor determina la compensación B1/A por existencia y conserva la compra, sus detalles, snapshots y movimientos originales. Los movimientos posteriores pueden impedir anular incluso con stock suficiente. Si alguna existencia no puede compensarse, la operación completa se rechaza. Una compra anulada no ofrece otra anulación. El estado actual del proveedor/medicamento y el vencimiento histórico no impiden solicitar la compensación.

## Conflictos y resultados inciertos

- **409 en conteos/retiros**: vuelve a consultar la existencia; se conservará el borrador y tendrás que revisar/confirmar nuevamente.
- **409 en anulación**: usa «Actualizar» en el detalle. Si ya figura anulada, se muestran los datos persistidos y se retira el formulario.
- **404 posterior a preparación o error de red/500**: consulta nuevamente antes de otro envío. La ausencia de una respuesta no demuestra que el servidor haya hecho rollback.
- **401**: utiliza el enlace de inicio de sesión para recuperar la sesión pública correctamente.
- **403**: comprueba que tu cuenta tenga el rol correspondiente.

Los formularios bloquean confirmaciones duplicadas y no realizan reintentos POST automáticos. Los borradores de compra, conteo, retiro y motivo de anulación se pierden al salir o recargar.

## Revisión manual del bloque

En la aplicación local puedes verificar mediante consultas:

- Con cada rol, que se muestren los módulos y acciones de la tabla de permisos.
- Que los filtros, el detalle y el regreso al listado mantengan el contexto de consulta.
- Que un producto registrado únicamente en el catálogo no aparezca en Inventario; desde su ficha, «Ver existencias» debe mostrar el estado vacío con su nombre y enlaces correspondientes al rol.
- Que un producto con existencias agotadas siga visible en Inventario con físico y vendible cero, y que una existencia inicial o histórica sin compra vinculada también se incluya.
- Que Stock bajo pueda seguir mostrando productos activos sin existencias.
- Que una existencia vencida/inactiva tenga físico separado de vendible y conserve sus fechas históricas.
- Que las compras confirmadas/anuladas y sus referencias de historial sigan visibles.
- Que las pantallas sean utilizables desde el teléfono y permitan desplazar sus tablas.

Para repetir la verificación automatizada con escrituras aisladas, desde `frontend/`:

```bash
node --test tests/aceptacion-real.browser.test.mjs
```

La suite completa también registra compras, conteos, retiros y anulaciones reales sobre sus fixtures, compara datos/esquemas de las bases protegidas y elimina la base temporal. Su configuración y las regresiones simuladas se describen en el [README](../../README.md). La revisión manual del usuario con sus datos complementa esa evidencia; no se da por realizada automáticamente.

Verificación de la corrección del listado (11/10/2026): 325 pruebas backend puras/simuladas y 128 frontend con API simulada aprobadas, incluidas 50 de Inventario; build y revisión de diff aprobados. La suite específica `backend/tests/inventario.integration.test.js` está adaptada al nuevo criterio, pero no se ha ejecutado contra MySQL para esta corrección.
