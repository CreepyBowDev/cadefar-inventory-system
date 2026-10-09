# CADEFAR — Reglas de Negocio

> Este archivo contiene las reglas de negocio completas del sistema CADEFAR.
>
> Forma parte de la documentación ubicada en:
>
> `docs/ai/`
>
> Debe utilizarse junto con:
>
> - `contexto-maestro.md`
> - `requerimientos.md`
> - `casos-uso.md`

---

# 1. Usuarios y roles

## RN01. Roles del sistema

Cada usuario debe tener un solo rol.

Un mismo rol puede estar asignado a varios usuarios.

Actualmente el sistema maneja tres roles predefinidos:

- Administrador.
- Regente.
- Vendedor.

No se contempla por ahora la creación dinámica de nuevos roles.

## RN02. Usuario administrador inicial

El sistema debe contar inicialmente con al menos una cuenta activa con rol Administrador.

Esta cuenta permite realizar la administración inicial y crear las demás cuentas del sistema.

## RN03. Creación de usuarios

Solamente un usuario con rol Administrador puede crear nuevas cuentas de usuario.

## RN04. Nombre de usuario único

El nombre de usuario debe ser único dentro del sistema.

No pueden existir dos cuentas con el mismo nombre de usuario.

## RN05. Estado del usuario

Solamente los usuarios activos pueden iniciar sesión y registrar operaciones.

Una cuenta inactiva conserva toda su información e historial, pero no puede utilizar el sistema.

## RN06. Eliminación de usuarios

Los usuarios que tengan información histórica relacionada no deben eliminarse físicamente.

Cuando sea necesario impedir su acceso, se debe cambiar su estado a inactivo.

## RN07. Contraseña del usuario

Las contraseñas nunca deben almacenarse en texto plano.

El sistema debe conservar únicamente su representación protegida mediante hash.

Toda contraseña nueva debe:

- tener entre 8 y 100 caracteres;
- incluir al menos una letra mayúscula;
- incluir al menos una letra minúscula;
- incluir al menos un número;
- incluir al menos un carácter especial.

La política se aplica al crear una cuenta, cambiar la contraseña propia y restablecer administrativamente una contraseña. Las credenciales creadas antes de incorporar esta política pueden continuar utilizándose hasta que su contraseña sea cambiada.

### Bloqueo temporal por intentos fallidos

Después de tres intentos fallidos consecutivos de inicio de sesión, la cuenta debe impedir nuevos inicios de sesión durante diez minutos.

- Un inicio de sesión exitoso reinicia el contador.
- Al finalizar el bloqueo, el siguiente intento comienza desde cero.
- Los intentos realizados durante el bloqueo no amplían su duración.
- El bloqueo temporal no modifica el estado activo o inactivo de la cuenta.
- El bloqueo impide nuevos inicios de sesión, pero no revoca sesiones ya autenticadas.
- Un cambio propio exitoso o un restablecimiento administrativo de contraseña reinicia los intentos fallidos y elimina el bloqueo temporal.
- No se almacenan intentos fallidos para nombres de usuario inexistentes.

## RN08. Responsable de operaciones

Toda operación que requiera responsabilidad o trazabilidad debe registrar el usuario que la realizó.

Esto incluye, según corresponda:

- Compras.
- Ventas.
- Ajustes.
- Retiros.
- Revisión de recetas.
- Anulaciones.
- Movimientos de inventario.

## RN107. Recuperación mediante correo asociado

El Administrador, Regente o Vendedor puede recuperar una contraseña olvidada mediante el correo electrónico asociado a su cuenta, sin iniciar sesión ni conocer la contraseña anterior.

Esta recuperación corresponde a CU09 y es independiente del cambio propio y del restablecimiento administrativo de CU08. Para utilizarla se requiere un correo registrado; no se establece todavía que sea obligatorio para todos los usuarios existentes.

## RN108. Código temporal de recuperación

El código de recuperación debe tener un período de validez limitado, permitir un solo uso y almacenarse de manera protegida.

La longitud del código, el tiempo exacto de expiración y la forma concreta de almacenamiento se definirán antes de implementar CU09.

## RN109. Intentos de verificación del código

Los intentos de verificación de un código de recuperación deben estar limitados. Al alcanzar el límite definido no se debe permitir continuar verificándolo.

La cantidad máxima exacta y el mecanismo de control quedan pendientes de definición. Este límite no reemplaza ni modifica el bloqueo de inicio de sesión de RN07.

## RN110. Solicitudes de recuperación

Las solicitudes de recuperación deben estar limitadas para evitar abusos del mecanismo y del envío de correos.

Los límites y períodos concretos se definirán antes de implementar CU09.

## RN111. Respuesta pública de recuperación

La respuesta pública a una solicitud de recuperación no debe revelar si el correo electrónico pertenece a una cuenta registrada.

## RN112. Verificación y nueva contraseña

No se puede restablecer una contraseña mediante CU09 sin superar la verificación de un código correspondiente a la cuenta, válido, no vencido y no utilizado.

La nueva contraseña debe cumplir la política de complejidad de RN07 y almacenarse únicamente mediante su hash.

## RN113. Efectos del restablecimiento exitoso

El restablecimiento exitoso mediante CU09 debe invalidar el código utilizado y los demás códigos de recuperación anteriores correspondientes a la cuenta.

También debe reiniciar los intentos fallidos y eliminar el bloqueo temporal de inicio de sesión. Una solicitud de recuperación o una verificación fallida no produce estos efectos.

## RN114. Estado administrativo de la cuenta recuperada

El restablecimiento de contraseña no debe activar una cuenta desactivada administrativamente ni modificar su rol.

Una cuenta inactiva continúa sin poder iniciar sesión ni registrar operaciones, de acuerdo con RN05.

## RN115. Sesiones anteriores al restablecimiento

Debe contemplarse una estrategia segura para invalidar las sesiones previamente emitidas después de cambiar la contraseña mediante el restablecimiento de CU09.

La estrategia técnica para invalidar JWT anteriores queda pendiente de definición antes de implementar la recuperación. No se decide todavía crear una tabla de sesiones ni adoptar otro mecanismo concreto, y esta regla no representa una revocación ya implementada.

---

# 2. Proveedores y laboratorios

## RN09. Proveedor y laboratorio

Para el alcance actual, proveedor y laboratorio se manejan mediante una sola entidad denominada:

`ProveedorLaboratorio`

Según la información obtenida en la farmacia, el laboratorio también puede actuar como proveedor.

## RN10. Estado del proveedor o laboratorio

Al registrar un proveedor o laboratorio se puede indicar su estado. Si no se indica, se utiliza el valor predeterminado de la base de datos: activo. Después del registro, su estado se cambia mediante la operación específica de activación o desactivación; la edición normal modifica únicamente los datos del registro.

Un proveedor o laboratorio inactivo conserva su información, sus relaciones con medicamentos y sus compras anteriores. Puede seguir consultándose y no debe eliminarse físicamente.

Mientras esté inactivo, no puede seleccionarse para nuevas compras ni asignarse a nuevos medicamentos o nuevamente al modificar un medicamento. Su inactivación no elimina ni modifica las relaciones existentes o las compras anteriores, ni impide vender medicamentos que ya se encuentran en el inventario.

## RN11. Verificación del proveedor

Antes de trabajar con un proveedor o laboratorio, el personal de la farmacia debe verificar:

- Licencia de funcionamiento.
- Resolución administrativa vigente del SEDES.

Esta verificación queda bajo responsabilidad del personal.

El sistema no realiza automáticamente la validación ante el SEDES.

## RN12. Relación con medicamentos

Cada medicamento se relaciona con el proveedor o laboratorio correspondiente definido en el catálogo.

Un proveedor o laboratorio puede estar relacionado con varios medicamentos.

---

# 3. Medicamentos y composición

## RN13. Código de medicamento

Cada medicamento debe tener un código que permita identificarlo dentro del sistema.

El código de medicamento debe ser único.

El código, proveedor/laboratorio, forma farmacéutica, presentación, unidad de inventario, vía de administración y tipo de liberación no pueden cambiar efectivamente desde que exista al menos un movimiento de inventario en cualquiera de las existencias del medicamento. Estos campos pueden editarse antes de existir ese historial, respetando las demás reglas de referencia y unicidad.

El nombre comercial, stock mínimo y condición de venta siguen siendo modificables con historial. Una corrección tipográfica del nombre no implica otro medicamento. Si cambia realmente la identidad comercial del producto, debe registrarse un nuevo medicamento.

El estado se modifica únicamente mediante su operación específica, fuera de la edición normal.

## RN14. Estado del medicamento

Solo los medicamentos activos pueden utilizarse en nuevas operaciones que requieran un medicamento disponible.

Un medicamento inactivo conserva su información y su historial.

## RN15. Composición del medicamento

Cada medicamento puede estar relacionado con uno o más principios activos mediante su composición.

## RN16. Datos de composición

La composición debe indicar:

- Principio activo.
- Cantidad del ingrediente.
- Unidad de medida.
- Cantidad de referencia.
- Unidad de referencia.

Las cantidades utilizadas en la composición deben ser positivas.

El mismo principio activo no puede repetirse para el mismo medicamento, conforme al UNIQUE compuesto existente. Las cantidades respetan el tipo `DECIMAL(12,4)` y las unidades las longitudes definidas en el esquema.

Mientras no exista historial, el Regente puede agregar ingredientes, editar cantidades y unidades (incluidas las de referencia) y retirar una relación de composición. Se autoriza la eliminación física de esa relación únicamente en esa etapa. Un ingrediente registrado por error se corrige retirando la relación incorrecta y creando la correcta, sin modificar silenciosamente su FK.

Desde el primer movimiento del medicamento, se prohíbe agregar o retirar ingredientes y cambiar principios activos, cantidades o unidades de su composición. Si la composición correcta representa otro producto, se registra un nuevo medicamento.

## RN17. Consulta por composición

La coincidencia entre la composición de dos medicamentos no implica automáticamente que uno pueda sustituir al otro.

La búsqueda por composición tiene finalidad informativa dentro del sistema.

La búsqueda por varios principios activos aplica AND: debe contener todos los solicitados, aunque incluya otros ingredientes adicionales. Un producto que contenga solo una parte de los ingredientes solicitados no coincide.

---

# 4. Existencias de medicamentos

## RN18. Medicamento y existencia

`Medicamento` representa el producto del catálogo.

`ExistenciaMedicamento` representa una agrupación concreta de unidades de ese medicamento diferenciada principalmente por su vencimiento.

Un medicamento puede tener varias existencias.

## RN19. No se manejan lotes

El sistema no utilizará una entidad `Lote`.

La separación de las unidades de un mismo medicamento se realizará mediante `ExistenciaMedicamento` y su información de vencimiento.

## RN20. Agrupación por vencimiento

Las unidades de un mismo medicamento que correspondan al mismo vencimiento pueden formar parte de la misma existencia.

Cuando se reciba el mismo medicamento con un vencimiento diferente, debe utilizarse una existencia diferente.

## RN21. Código de existencia

Cada existencia debe tener un código único.

El código se genera automáticamente tomando como base el código del medicamento y un correlativo de sus existencias.

Ejemplo:

```text
Medicamento:
PAR001

Existencias:
PAR001-001
PAR001-002
PAR001-003
```

## RN22. Correlativo de existencia

El correlativo identifica cada existencia generada para un medicamento.

Un código de existencia utilizado anteriormente no debe reutilizarse aunque su saldo llegue posteriormente a cero.

## RN23. Identificador y código de existencia

El identificador interno de la base de datos y el código de existencia son conceptos diferentes.

Ejemplo:

```text
id_existencia = 15
codigo_existencia = PAR001-003
```

El ID funciona como clave técnica de la base de datos.

El código de existencia permite identificar la existencia dentro de la lógica del sistema.

## RN24. Conservación de existencias

Una existencia no debe eliminarse solamente porque su saldo llegue a cero.

Debe conservarse para mantener la relación histórica con:

- Compras.
- Ventas.
- Movimientos.
- Ajustes.
- Retiros.
- Reversiones.

## RN25. Unidad de inventario

El inventario se controla mediante unidades individuales.

Dependiendo del medicamento, pueden representar:

- Tabletas.
- Cápsulas.
- Unidades individuales.

Las cantidades de entrada, salida y retiro deben expresarse utilizando la unidad de inventario definida para el medicamento.

## RN26. Cantidades de inventario

Las cantidades compradas, vendidas, ajustadas o retiradas deben ser enteros positivos.

El saldo físico de una existencia nunca puede ser negativo.

---

# 5. Stock físico y stock vendible

## RN27. Stock físico

El stock físico representa las unidades que todavía se encuentran físicamente en la farmacia.

Una existencia vencida puede continuar teniendo stock físico hasta que sus unidades sean retiradas.

## RN28. Stock vendible

El stock vendible representa las unidades que pueden utilizarse para una venta.

Una existencia vencida no forma parte del stock vendible.

## RN29. Medicamentos vencidos

Cuando una existencia alcanza su fecha de vencimiento:

- Deja de ser vendible.
- No se elimina automáticamente.
- Su saldo físico se conserva hasta registrar el retiro correspondiente.

## RN30. Stock negativo

Ninguna operación puede dejar el saldo de una existencia por debajo de cero.

Antes de registrar una salida debe verificarse que exista cantidad suficiente.

## RN31. Stock mínimo

Cada medicamento puede tener definido un stock mínimo.

El stock mínimo no puede ser negativo.

## RN32. Stock bajo

Un medicamento se considera con stock bajo cuando:

```text
stockVendible <= stockMinimo
```

El cálculo se realiza utilizando la suma de sus existencias que todavía sean vendibles.

---

# 6. Compras

## RN33. Compra y proveedor

Cada compra debe pertenecer a un único proveedor o laboratorio.

## RN34. Responsable de compra

Cada compra debe identificar al usuario responsable de su registro.

## RN35. Detalles de compra

Toda compra debe contener al menos un detalle.

Cada detalle pertenece a una sola compra.

## RN36. Información del detalle de compra

Cada detalle debe identificar:

- Existencia recibida.
- Cantidad.
- Costo unitario.
- Subtotal.

## RN37. Cantidad comprada

La cantidad recibida en una compra debe ser mayor que cero.

## RN38. Costo de compra

El costo unitario debe ser un valor válido mayor que cero.

## RN39. Subtotal de compra

El subtotal de cada detalle se calcula mediante:

```text
cantidad × costoUnitario
```

## RN40. Total de compra

El total de una compra corresponde a la suma de los subtotales de sus detalles.

Los valores monetarios deben manejarse con la precisión definida para el sistema.

## RN41. Efecto de una compra

Cuando una compra queda confirmada:

- Se registra la compra.
- Se registran sus detalles.
- Se incrementa el saldo de las existencias correspondientes.
- Se generan movimientos de entrada.
- Se actualiza el costo promedio cuando corresponda.

## RN42. Compra y existencia

Durante una compra, el sistema debe determinar si corresponde utilizar una existencia existente o crear una nueva existencia según el medicamento y su vencimiento.

Cuando deba crearse una nueva existencia, se genera automáticamente su código de existencia.

## RN43. Atomicidad de la compra

La compra, sus detalles, los movimientos de inventario y las modificaciones de saldo deben registrarse como una sola operación lógica.

Si una parte de la operación falla, no deben quedar cambios parciales.

---

# 7. Costo promedio

## RN44. Costo promedio

Cada existencia conserva un costo promedio asociado a sus unidades.

## RN45. Actualización del costo promedio

Cuando una compra incorpora nuevas unidades a una existencia que ya tiene saldo, el costo promedio debe calcularse mediante promedio ponderado considerando:

- Cantidad existente.
- Costo promedio existente.
- Cantidad recibida.
- Costo de las nuevas unidades.

## RN46. Salidas de inventario

Las salidas por venta, vencimiento, daño u otros motivos deben conservar el costo aplicado en el momento en que se realizó el movimiento.

Las salidas no deben modificar retroactivamente los costos registrados anteriormente.

## RN47. Valoración histórica

Los movimientos deben conservar su costo aplicado para permitir conocer posteriormente el valor histórico de:

- Ventas.
- Retiros.
- Pérdidas.
- Reversiones.

---

# 8. Ventas

## RN48. Detalles de venta

Toda venta debe contener al menos un detalle.

Cada detalle pertenece a una sola venta.

## RN49. Información del detalle de venta

Cada detalle debe identificar:

- Existencia utilizada.
- Cantidad.
- Precio unitario.
- Subtotal.
- Receta cuando corresponda.

## RN50. Cantidad vendida

La cantidad vendida debe ser mayor que cero.

## RN51. Subtotal de venta

El subtotal de una línea de venta se calcula mediante:

```text
cantidad × precioUnitario
```

## RN52. Total de venta

El total de la venta corresponde a la suma de sus subtotales.

## RN53. Condiciones para vender

Una venta se guarda inicialmente en estado `PENDIENTE`, con sus detalles y recetas cuando correspondan. Este registro no descuenta ni reserva stock ni genera movimientos de inventario.

La venta solamente puede confirmarse y utilizar una existencia para la salida de inventario cuando:

- El medicamento esté activo.
- La existencia no esté vencida.
- Exista stock suficiente.
- Se cumplan los requisitos de receta cuando corresponda.

El Vendedor confirma la venta; la revisión de las recetas corresponde al Regente. Una venta confirmada o anulada no puede confirmarse nuevamente.

Las condiciones se comprueban de nuevo al confirmar. Las existencias indicadas en los detalles pendientes son una selección provisional, sin garantía de disponibilidad; deben redistribuirse si la disponibilidad o FEFO lo requieren.

## RN54. Prioridad por vencimiento

Cuando existan varias existencias vendibles del mismo medicamento, se debe utilizar primero la que tenga el vencimiento más próximo.

Se aplica el criterio:

```text
FEFO
First Expired, First Out
```

## RN55. Uso de varias existencias

Si una sola existencia no tiene cantidad suficiente para completar la venta, pueden utilizarse varias existencias del mismo medicamento.

Cada existencia utilizada debe registrarse en un detalle separado para mantener la trazabilidad.

## RN56. Efecto de una venta

Cuando una venta queda confirmada:

- Se cambia su estado de `PENDIENTE` a `CONFIRMADA`.
- Se registra `fecha_venta` con la fecha y hora de confirmación.
- Se finalizan sus detalles y la asignación de existencias mediante FEFO.
- Se disminuyen los saldos correspondientes.
- Se generan movimientos de salida.

`fecha_registro` conserva la fecha y hora en que se guardó la venta pendiente. `fecha_venta` permanece sin valor hasta confirmarse; una venta confirmada debe tener fecha de venta.

## RN57. Atomicidad de la venta

El registro inicial de la venta pendiente, sus detalles y sus recetas debe realizarse de forma conjunta, sin efectos sobre inventario.

La confirmación, los detalles definitivos, la fecha de venta, los movimientos y la actualización del inventario deben realizarse de forma conjunta mediante otra transacción.

Si alguna parte de la confirmación falla, la venta conserva su estado pendiente y no deben permanecer cambios parciales de la confirmación ni del inventario.

---

# 9. Recetas

## RN58. Medicamentos que requieren receta

Cuando un medicamento requiera receta, su detalle no puede confirmarse respaldado por una receta inexistente o no aprobada. Mientras la venta esté pendiente, la receta puede estar registrada sin revisión o rechazada, pero no autoriza la entrega.

## RN59. Receta y venta

Una receta debe estar relacionada con la venta en la que será utilizada.

La receta se registra vinculada a una venta pendiente, antes de su confirmación. Su FK `id_venta` es obligatoria.

## RN60. Receta y detalles

Una receta puede respaldar varios detalles de una misma venta cuando corresponda.

Una venta puede contener más de una receta.

La receta de un detalle debe pertenecer a la misma venta que ese detalle.

## RN61. Revisión de receta

La revisión debe ser realizada por un usuario autorizado.

El sistema debe conservar:

- Resultado de la revisión.
- Usuario validador.
- Fecha de validación.
- Observación cuando corresponda.

## RN62. Resultado de receta

Una receta puede ser aprobada o rechazada según la revisión correspondiente.

La ausencia de `resultado_revision`, usuario validador y fecha de validación representa una revisión pendiente. Al registrar una revisión se conservan conjuntamente su resultado, responsable y fecha.

Solo una receta aprobada puede respaldar una entrega que requiera prescripción.

## RN63. Alcance de la receta

El sistema no emite recetas médicas.

Únicamente registra y controla las recetas presentadas para respaldar una venta.

---

# 10. Movimientos de inventario

## RN64. Movimiento y existencia

Cada movimiento de inventario debe afectar una sola existencia.

## RN65. Dirección del movimiento

Un movimiento debe representar una de las siguientes direcciones:

- Entrada.
- Salida.

## RN66. Cantidad del movimiento

La cantidad de un movimiento debe ser mayor que cero.

La dirección del movimiento determina si esa cantidad incrementa o disminuye el saldo.

## RN67. Motivo del movimiento

Todo movimiento debe indicar su motivo.

Ejemplos:

- Compra.
- Venta.
- Ajuste.
- Retiro por vencimiento.
- Retiro por daño.
- Reversión.

## RN68. Relación con compra o venta

Un movimiento puede relacionarse con:

- Un detalle de compra.

o

- Un detalle de venta.

Nunca con ambos simultáneamente.

## RN69. Movimientos independientes

Los movimientos correspondientes a:

- Ajustes.
- Retiros por vencimiento.
- Retiros por daño.

no necesitan estar asociados a un detalle de compra o venta.

## RN70. Historial de movimientos

Los movimientos de inventario forman parte del historial del sistema.

No deben eliminarse físicamente para corregir una operación.

---

# 11. Reversiones y anulaciones

## RN71. Corrección mediante reversión

Cuando sea necesario compensar un movimiento ya registrado, debe generarse un movimiento de reversión.

El movimiento original debe conservarse.

## RN72. Movimiento de reversión

La reversión debe conservar:

- La misma existencia.
- La misma cantidad.
- El mismo costo aplicado.

Pero debe utilizar la dirección contraria al movimiento original.

## RN73. Relación de reversión

Una reversión debe identificar el movimiento original que está compensando.

## RN74. Una sola reversión

Cada movimiento original puede tener como máximo una reversión.

No se permite revertir varias veces el mismo movimiento.

## RN75. Anulación de compra

Una compra anulada no debe eliminarse.

Debe conservar:

- Información original.
- Fecha de anulación.
- Motivo.
- Usuario responsable.

## RN76. Efecto de anular compra

La anulación de una compra debe compensar los movimientos de entrada generados originalmente.

Si la reversión provocaría un stock negativo debido a que las unidades ya fueron utilizadas, la anulación no debe realizarse de forma que deje inconsistente el inventario.

## RN77. Anulación de venta

Una venta anulada no debe eliminarse.

Debe conservar:

- Información original.
- Fecha de anulación.
- Motivo.
- Usuario responsable.

## RN78. Efecto de anular venta

Al anular una venta confirmada deben generarse los movimientos necesarios para devolver al inventario las cantidades descontadas originalmente. Su fecha de venta original se conserva.

Al anular una venta pendiente no se generan movimientos de reversión ni se modifican saldos, ya que no hubo salida de inventario. Su fecha de venta permanece sin valor. En ambos casos se conserva el registro con fecha de anulación, motivo y usuario responsable.

## RN79. Anulación única

Una compra o venta no puede anularse más de una vez.

## RN80. Atomicidad de las anulaciones

La modificación del estado de la operación, los movimientos de reversión y los cambios de inventario deben realizarse conjuntamente.

No deben quedar anulaciones parciales.

---

# 12. Ajustes de inventario

## RN81. Conteo físico

El conteo físico continúa siendo realizado por el personal de la farmacia.

El sistema sirve como apoyo para consultar y actualizar las diferencias encontradas.

## RN82. Ajuste de inventario

Cuando exista una diferencia entre el saldo registrado y el conteo físico, la corrección debe realizarse mediante un movimiento de ajuste.

No debe modificarse el saldo directamente sin dejar trazabilidad.

## RN83. Ajuste negativo

Un ajuste de salida no puede dejar el saldo físico de la existencia por debajo de cero.

## RN84. Responsable del ajuste

Todo ajuste debe registrar:

- Usuario responsable.
- Fecha.
- Cantidad.
- Motivo.
- Observación cuando corresponda.

---

# 13. Vencimientos

## RN85. Existencia próxima a vencer

Una existencia se considera próxima a vencer cuando:

- Tiene saldo físico positivo.
- Todavía no está vencida.
- Su vencimiento se encuentra entre la fecha actual y los próximos tres meses.

## RN86. Existencia vencida

Una existencia se considera vencida cuando su fecha de vencimiento ya no permite su comercialización según el vencimiento registrado.

Una existencia vencida no puede utilizarse en nuevas ventas.

## RN87. Conservación del saldo vencido

El vencimiento no elimina automáticamente las unidades del inventario físico.

Las unidades permanecen registradas hasta que se realice el retiro correspondiente.

---

# 14. Retiros y pérdidas

## RN88. Retiro por vencimiento

Las unidades vencidas deben retirarse mediante un movimiento de salida con motivo de vencimiento.

## RN89. Retiro por daño

Las unidades dañadas deben retirarse mediante un movimiento de salida con motivo de daño.

## RN90. Cantidad retirada

La cantidad retirada no puede superar el saldo físico disponible de la existencia.

## RN91. Pérdida valorizada

La pérdida producida por un retiro se calcula mediante:

```text
cantidadRetirada × costoUnitarioAplicado
```

## RN92. Historial de pérdidas

Las pérdidas no requieren una tabla independiente.

Se obtienen a partir de los movimientos de retiro registrados y su costo aplicado.

---

# 15. Alertas

## RN93. Alertas calculadas

Las alertas se obtienen dinámicamente a partir de la información registrada.

No se necesita una tabla independiente denominada `Alerta`.

## RN94. Alerta de próximo vencimiento

El sistema debe identificar las existencias próximas a vencer utilizando el criterio definido de tres meses.

## RN95. Alerta de vencido pendiente de retiro

El sistema debe identificar las existencias vencidas que todavía mantengan saldo físico positivo.

## RN96. Alerta de stock bajo

El sistema debe identificar los medicamentos cuyo stock vendible sea menor o igual al stock mínimo.

---

# 16. Reportes y consultas

## RN97. Reportes calculados

Los reportes se generan a partir de la información almacenada en las operaciones del sistema.

No se requiere una tabla independiente denominada `Reporte`.

## RN98. Consultas de ventas

El sistema debe permitir consultar ventas por:

- Día.
- Mes.
- Período.

Las consultas deben distinguir los estados `PENDIENTE`, `CONFIRMADA` y `ANULADA`. Los reportes de ventas realizadas utilizan `fecha_venta`, correspondiente a la confirmación, sin contabilizar las pendientes como ventas efectivas.

## RN99. Consultas de compras

El sistema debe permitir consultar compras por:

- Día.
- Mes.
- Período.

## RN100. Historial de inventario

El sistema debe permitir reconstruir la evolución del inventario mediante los movimientos registrados.

## RN101. Consulta de pérdidas

Las pérdidas por vencimiento o daño deben poder consultarse por período utilizando los movimientos correspondientes.

---

# 17. Integridad y trazabilidad general

## RN102. Conservación histórica

Las operaciones importantes del sistema no deben eliminarse cuando sean necesarias para mantener la trazabilidad.

Se debe priorizar:

- Cambio de estado.
- Anulación.
- Reversión.

en lugar de eliminar información histórica.

## RN103. Operaciones transaccionales

Toda operación que afecte simultáneamente varios registros relacionados debe completarse en su totalidad o no aplicarse.

Esto incluye principalmente:

- Compras.
- Ventas.
- Anulaciones.
- Ajustes.
- Retiros.

## RN104. Consistencia entre saldo y movimientos

Los cambios realizados sobre el inventario deben estar respaldados por el movimiento correspondiente.

No se debe modificar el saldo de una existencia sin conservar una causa trazable cuando la operación represente una entrada o salida de inventario.

## RN105. Datos históricos

Para aplicar el bloqueo de identidad y composición, un medicamento tiene historial desde el primer `MovimientoInventario` asociado a cualquiera de sus `ExistenciaMedicamento`. No basta con tener una existencia sin movimientos. El criterio no depende del saldo, dirección, motivo ni de que el movimiento haya sido revertido.

Los cambios posteriores en:

- Usuarios.
- Medicamentos.
- Proveedores.
- Costos.
- Existencias.

no deben destruir la información necesaria para comprender operaciones realizadas anteriormente.

## RN106. Responsabilidad de las operaciones

Cuando una operación pueda afectar inventario, dinero, vencimientos, recetas o información administrativa, debe conservarse suficiente información para determinar:

- Qué se realizó.
- Cuándo se realizó.
- Qué cantidad fue afectada.
- Qué usuario fue responsable.
- Qué registro originó la operación cuando corresponda.

---

# 18. Relación con el resto de la documentación

Estas reglas deben interpretarse junto con:

```text
docs/ai/contexto-maestro.md
docs/ai/requerimientos.md
docs/ai/casos-uso.md
```

Antes de implementar una funcionalidad:

1. Identificar las reglas de negocio que le corresponden.
2. Revisar los requerimientos relacionados.
3. Revisar el caso de uso correspondiente.
4. Mantener las decisiones definidas en `contexto-maestro.md`.
5. No omitir una regla de negocio por simplificar la implementación.
6. Si una nueva necesidad contradice una regla existente, señalar la contradicción antes de modificarla.
