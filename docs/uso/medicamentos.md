# Medicamentos y composición — guía de uso

El catálogo registra el producto y su composición en una sola operación, genera el código automáticamente y evita duplicados de identidad comercial/composición. Para iniciar MySQL, backend y frontend, consulta [el README](../../README.md#ejecutar-el-sistema).

## Acceso y permisos

| Pantalla o acción | Roles |
|---|---|
| Listado, ficha y consulta de composición | Administrador, Regente y Vendedor |
| Crear, editar y activar/desactivar medicamento | Regente |
| Agregar, modificar o retirar composición existente | Regente, antes de tener movimientos |

El catálogo está en `/medicamentos`. Las restricciones de la interfaz acompañan la autorización del backend; los roles conservan sus permisos anteriores.

## Registrar un medicamento

1. Como Regente, abre **Medicamentos → Crear medicamento** (`/medicamentos/nuevo`).
2. Introduce nombre comercial, forma farmacéutica, presentación, unidad de inventario, condición de venta, vía de administración, tipo de liberación y stock mínimo; selecciona un proveedor/laboratorio activo.
3. En **Composición del medicamento**, pulsa **Agregar componente**. Selecciona el principio activo y completa cantidad/unidad del ingrediente y cantidad/unidad de referencia.
4. Agrega los demás ingredientes si corresponde. El selector excluye los ya incluidos. Puedes editar cantidades/unidades o retirar filas antes de guardar; estas acciones solo modifican el borrador.
5. Pulsa **Crear medicamento**. Se envían producto y todos los componentes en un único POST. No se pueden hacer envíos dobles mientras la solicitud está en curso.
6. Tras el éxito, se abre la ficha `/medicamentos/:idMedicamento`, con composición completa y el código confirmado por el servidor.

La composición debe tener al menos un ingrediente, sin repeticiones. Las cantidades son positivas, hasta `99999999.9999`, con un máximo de cuatro decimales. Las unidades admiten hasta 30 caracteres. La ausencia de principios activos en el catálogo bloquea la creación; si falla la carga de opciones, la pantalla ofrece reintentar. El contrato actual permite seleccionar un principio registrado inactivo, identificado como tal; sí exige proveedor activo.

**No hay un campo para escribir el código.** Se genera con las primeras tres letras válidas del nombre y un correlativo (`PAR001`, `PAR002`, etc.). Nombres con menos de tres letras válidas se rechazan. El código se muestra solo después de confirmar el registro, se conserva al editar el nombre y no cambia los códigos de existencia.

Si falla el registro, el servidor revierte producto y componentes. El formulario conserva los datos para corregirlos o realizar un nuevo envío manual; no guarda primero un medicamento vacío ni reenvía automáticamente.

## Qué se considera duplicado

Deben coincidir **todos** estos datos con otro registro:

- Nombre comercial y proveedor/laboratorio.
- Forma farmacéutica, presentación y unidad de inventario.
- Vía de administración y tipo de liberación.
- Todos los principios activos con sus cantidades, unidades y cantidades/unidades de referencia.

Cambiar el orden de los componentes, escribir cantidades equivalentes (`500` y `500.0000`) o variar caja, acentos o espacios según la comparación documentada de MySQL no distingue productos. Tampoco los diferencian código, stock mínimo, estado, condición de venta o vencimientos de sus existencias. Los medicamentos inactivos también participan en la comprobación.

Compartir un ingrediente no basta para ser duplicado. Una diferencia en marca, laboratorio, presentación, cantidad, unidad u otro atributo de identidad puede distinguir productos. No se convierten unidades (`mg` a `g`) ni se decide que un medicamento sustituya terapéuticamente a otro.

Ante un duplicado, la API responde 409: **«Ya existe un medicamento registrado con estas características y composición.»** El formulario conserva el borrador y muestra **Medicamentos ya registrados**, con enlaces para consultar las coincidencias, incluidas las inactivas. No se elimina, fusiona ni reactiva automáticamente ningún producto.

## Editar medicamento y composición

- La edición comercial está en `/medicamentos/:idMedicamento/editar`. Envía solo los campos cambiados; no permite modificar código ni estado. El estado tiene su acción específica.
- La composición existente se administra en `/medicamentos/:idMedicamento/composicion`. Su edición modifica cantidades/unidades, no el principio referenciado. Para corregir un ingrediente, retira la relación y agrega la correcta antes del historial.
- Desde el primer movimiento de inventario de cualquier existencia, se bloquean proveedor/laboratorio, forma farmacéutica, presentación, unidad de inventario, vía de administración, tipo de liberación y toda la composición. Una existencia sin movimientos no basta para definir historial. Revertir movimientos o agotar saldo no elimina el historial.
- Nombre comercial, stock mínimo y condición de venta siguen editables con historial. Un cambio del nombre también debe respetar la unicidad del producto.
- Cada alta, edición o retirada de composición comprueba el producto completo resultante. Si duplicaría otro medicamento, el backend devuelve 409 y revierte la operación.

Los históricos sin composición se conservan y pueden completarse si no tienen movimientos ni producen duplicados. La gestión independiente todavía permite retirar la última relación sin historial si el resultado no duplica otro registro; esto no permite crear un medicamento nuevo sin composición. Los duplicados históricos se conservan y pueden administrar stock mínimo, condición de venta y estado sin fusionarlos.

## Conflictos y verificación manual

Un conflicto de identidad, un historial protegido, un proveedor inactivo, el agotamiento del correlativo o una espera de bloqueo pueden producir 409 con mensajes distintos. Revisa el mensaje antes de corregir o volver a enviar. Un conflicto de identidad no se evita cambiando stock mínimo o estado.

Para revisar el flujo con datos de prueba:

1. Crea un producto con uno o varios componentes y comprueba su código y composición en la ficha.
2. Intenta registrar la misma identidad y composición: debe rechazarse y ofrecer el enlace al existente.
3. Revisa agregar, editar y retirar componentes del borrador antes de confirmar; no deben realizar altas independientes.
4. Comprueba que editar el nombre conserva el código y que una edición que duplicaría otro producto se rechaza.
5. Comprueba el acceso del Regente y las consultas de Administrador/Vendedor, también a 375 px.

## Pruebas automatizadas

Desde `backend/`, pruebas de código y registro integral sin conexiones MySQL:

```powershell
node --test tests/medicamento.codigo.test.js tests/medicamento.integral.test.js
```

Desde `frontend/`, con Chrome/Edge instalado o `CADEFAR_TEST_BROWSER` configurado, navegador real con API simulada (sin MySQL):

```powershell
node --test tests/medicamentos.browser.test.mjs
pnpm build
```

Desde `backend/`, integración Express/MySQL en base aleatoria aislada, solo cuando se autorice crear/migrar/eliminar esa base:

```powershell
$env:CADEFAR_AUTORIZAR_CATALOGO_AISLADO = '1'
try { node --test tests/medicamento.integral.integration.test.js }
finally { Remove-Item Env:CADEFAR_AUTORIZAR_CATALOGO_AISLADO }
```

La suite usa la conexión configurada en `backend/.env`, fixtures sintéticos sin seeders y una base `cadefar_catalogo_*`; requiere permisos para crear/migrar/eliminar la base y consultar `performance_schema.data_lock_waits` y `events_transactions_current`. No cambia la configuración global de MySQL: las escrituras de identidad usan READ COMMITTED por transacción, con bloqueo exclusivo por proveedor. Comprueba eliminación de la base temporal y huellas de esquema/datos de las bases protegidas, incluidos `prueba` y `cadefar_test`.

La verificación registrada del 11/10/2026 aprobó 323 pruebas backend puras/simuladas, 127 frontend con API simulada (11 de Medicamentos incluidas) y 7 de integración Express/MySQL. Las carreras reales de creación y edición comprobaron esperas InnoDB y un único éxito con un conflicto. Una auditoría de solo lectura no encontró duplicados exactos en la base local de desarrollo en esa revisión. React y Express/MySQL se probaron por separado para este bloque; la aceptación integrada de los tres y la revisión manual con datos del usuario no forman parte de esa evidencia.

Para el contrato HTTP y las decisiones completas, consulta [el contexto maestro](../ai/contexto-maestro.md#api-de-medicamentos-y-composición--registro-integral), [RN13/RN15/RN16](../ai/reglas-negocio.md#3-medicamentos-y-composición) y [CU14/CU16/CU19](../ai/casos-uso.md#4-medicamentos-y-composición).
