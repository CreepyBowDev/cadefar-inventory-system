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

Esta recuperación corresponde a CU09 y es independiente del cambio propio y del restablecimiento administrativo de CU08. Para utilizarla se requiere un correo registrado; es opcional para las cuentas. Un cambio efectivo o retirada de correo por el Administrador invalida las recuperaciones pendientes; el mismo correo normalizado las conserva. Las cuotas pertenecen a la cuenta y no se reinician por cambiar correo.

## RN108. Código temporal de recuperación

El código de recuperación debe tener un período de validez limitado, permitir un solo uso y almacenarse de manera protegida.

Se utilizan seis dígitos aleatorios y diez minutos de vencimiento absoluto. Se persiste solo HMAC-SHA-256 vinculado a propósito, cuenta, correo normalizado, nonce y vencimiento; no el código ni el mensaje. No se extiende el vencimiento por el envío.

## RN109. Intentos de verificación del código

Los intentos de verificación de un código de recuperación deben estar limitados. Al alcanzar el límite definido no se debe permitir continuar verificándolo.

Se permiten cinco fallos por emisión, persistidos incluso cuando la respuesta pública es un error. El quinto invalida el código. Este límite no reemplaza ni modifica el bloqueo de inicio de sesión de RN07.

## RN110. Solicitudes de recuperación

Las solicitudes de recuperación deben estar limitadas para evitar abusos del mecanismo y del envío de correos.

Se exige un intervalo de 60 segundos y un máximo de tres emisiones por cuenta en ventana móvil de 15 minutos. Por IP se permiten 20 solicitudes y 30 restablecimientos en ventanas independientes de 15 minutos desde la primera petición. Las cuotas se almacenan en MySQL, sin fallback a memoria; desconocidos e inactivos consumen cuota IP. La IP se obtiene del socket, sin confiar en cabeceras.

Una emisión persistida conserva su cuota aunque falle el envío. Se intenta enviar una vez después del commit, sin reintentos automáticos. Rechazo explícito invalida solo esa emisión; timeout/aceptación incierta conservan el código hasta vencimiento. Tras una caída entre commit y envío se requiere otra solicitud manual sujeta a límites.

## RN111. Respuesta pública de recuperación

La respuesta pública a una solicitud de recuperación no debe revelar si el correo electrónico pertenece a una cuenta registrada.

Desconocidos, inactivos y emisiones suprimidas reciben la misma respuesta. Una solicitud válida dentro de cuota IP espera al menos cinco segundos para mitigar diferencias evidentes con un timeout de correo; no se afirma tiempo constante. Logs y respuestas nunca contienen códigos, contraseñas, HMAC, mensajes o secretos.

## RN112. Verificación y nueva contraseña

No se puede restablecer una contraseña mediante CU09 sin superar la verificación de un código correspondiente a la cuenta, válido, no vencido y no utilizado.

La nueva contraseña debe cumplir la política de complejidad de RN07 y almacenarse únicamente mediante su hash.

Toda contraseña nueva debe respetar además el máximo de 72 bytes UTF-8, sin truncar ni normalizar. El consumo revalida cuenta, código, vencimiento y versión de credenciales después de calcular bcrypt fuera de la transacción.

## RN113. Efectos del restablecimiento exitoso

El restablecimiento exitoso mediante CU09 debe invalidar el código utilizado y los demás códigos de recuperación anteriores correspondientes a la cuenta.

También debe reiniciar los intentos fallidos y eliminar el bloqueo temporal de inicio de sesión. Una solicitud de recuperación o una verificación fallida no produce estos efectos.

## RN114. Estado administrativo de la cuenta recuperada

El restablecimiento de contraseña no debe activar una cuenta desactivada administrativamente ni modificar su rol.

Una cuenta inactiva continúa sin poder iniciar sesión ni registrar operaciones, de acuerdo con RN05.

## RN115. Sesiones anteriores al restablecimiento

Debe contemplarse una estrategia segura para invalidar las sesiones previamente emitidas después de cambiar la contraseña mediante el restablecimiento de CU09.

La revocación está implementada mediante `Usuario.version_credenciales` y `versionCredenciales` obligatorio en JWT. CU08 y CU09 incrementan la versión transaccionalmente e invalidan recuperaciones. CU08 propio renueva su cookie; CU08 administrativo y CU09 revocan sesiones previas sin iniciar otra sesión. No se agrega tabla de sesiones ni blacklist; JWT antiguos o desactualizados son rechazados.

---

# 2. Proveedores y laboratorios

## RN09. Proveedor y laboratorio

Para el alcance actual, proveedor y laboratorio se manejan mediante una sola entidad denominada:

`ProveedorLaboratorio`

Según la información obtenida en la farmacia, el laboratorio también puede actuar como proveedor.

## RN10. Estado del proveedor o laboratorio

Al registrar un proveedor o laboratorio se puede indicar su estado. Si no se indica, se utiliza el valor predeterminado de la base de datos: activo. Después del registro, su estado se cambia mediante la operación específica de activación o desactivación; la edición normal modifica únicamente los datos del registro.

Un proveedor o laboratorio inactivo conserva su información, sus relaciones con medicamentos y sus compras anteriores. Puede seguir consultándose y no debe eliminarse físicamente.

Mientras esté inactivo, no puede utilizarse para nuevas compras ni asignarse a nuevos medicamentos o nuevamente al modificar un medicamento. Su inactivación no elimina ni modifica las relaciones existentes o las compras anteriores, ni impide vender medicamentos que ya se encuentran en el inventario.

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

El código de medicamento debe ser único y se genera automáticamente al registrar el producto; no lo proporciona el usuario ni se admite `codigoMedicamento` en POST o PATCH.

### Generación y conservación del código

- Prefijo: las primeras tres letras ASCII del nombre comercial después de convertir a mayúsculas, descomponer acentos y omitir símbolos y números. `Ñ` se convierte en `N`. Esta transformación genera el identificador, no reescribe el nombre almacenado.
- Un nombre con menos de tres letras válidas se rechaza con 400.
- Correlativo: tres dígitos, desde `001` hasta `999`, compartido por todos los productos del mismo prefijo. Paracetamol y Paroxetina comparten `PAR`.
- Se toma el mayor sufijo numérico válido de los códigos conservados para el prefijo más uno; no se utiliza COUNT, el ID, el nombre actual ni se rellenan huecos. Participan medicamentos activos e inactivos.
- Solo se interpretan como correlativos los códigos de longitud seis con tres dígitos ASCII al final; el prefijo se compara según la colación de la columna. Además se comprueba que el candidato no colisione con códigos históricos equivalentes según MySQL.
- Al agotarse `999`, se rechaza el registro con 409. Los históricos irregulares no se normalizan ni renumeran.

El código es inmutable desde la creación, aun sin historial. Cambiar el nombre comercial no lo regenera ni altera los códigos de sus existencias.

### Edición e historial

El proveedor/laboratorio, forma farmacéutica, presentación, unidad de inventario, vía de administración y tipo de liberación no pueden cambiar efectivamente desde que exista al menos un movimiento de inventario en cualquiera de las existencias del medicamento. Estos campos pueden editarse antes de existir ese historial, respetando las demás reglas de referencia y unicidad.

El nombre comercial, stock mínimo y condición de venta siguen siendo modificables con historial. Una corrección tipográfica del nombre no implica otro medicamento. Si cambia realmente la identidad comercial del producto, debe registrarse un nuevo medicamento.

El estado se modifica únicamente mediante su operación específica, fuera de la edición normal.

### Unicidad de identidad comercial

No se permite registrar otro medicamento ni modificar uno existente de modo que coincidan todos estos atributos con otro registro:

- Nombre comercial.
- Proveedor/laboratorio, identificado por su ID.
- Forma farmacéutica.
- Presentación.
- Unidad de inventario.
- Vía de administración.
- Tipo de liberación.
- Composición completa, conforme a RN16: principios activos identificados por ID y todas sus cantidades y unidades, incluidas las de referencia.

Código, IDs técnicos del medicamento y sus relaciones de composición, stock mínimo, estado, condición de venta, fechas, existencias, stock físico y movimientos no diferencian productos. La condición de venta conserva su naturaleza administrativa editable. Un medicamento inactivo también impide registrar su duplicado.

Para comparar textos se recortan espacios exteriores y se reducen secuencias de espacios en blanco a un espacio. La igualdad de caja y acentos utiliza la colación real de las columnas; en el entorno local verificado es `utf8mb4_0900_ai_ci`. Esta normalización de comparación no reescribe textos históricos ni agrega conversiones de unidades.

La composición se compara independientemente del orden, con igual número de componentes y coincidencia de todos sus atributos. Las cantidades son equivalentes numéricamente a escala de cuatro decimales (`500` y `500.0000` coinciden). `mg` y `g` no se convierten entre sí; compartir ingredientes no establece igualdad comercial ni sustitución terapéutica.

La comprobación se aplica al alta, a cambios efectivos de los atributos comerciales anteriores —incluido el nombre— y al agregar, modificar o retirar componentes. Se excluye el propio medicamento de la búsqueda y se evalúa su estado completo resultante. Un conflicto devuelve 409 con el mensaje «Ya existe un medicamento registrado con estas características y composición.» y revierte la operación.

Los duplicados históricos y medicamentos sin composición se conservan; no se fusionan ni eliminan automáticamente. Cambiar únicamente stock mínimo, condición de venta o estado no corrige esos duplicados ni impide administrar esos atributos. Completar una composición histórica requiere ausencia de movimientos y no puede producir un duplicado.

## RN14. Estado del medicamento

Solo los medicamentos activos pueden utilizarse en nuevas operaciones que requieran un medicamento disponible.

Esto incluye la recepción de compras ordinarias. Si algún medicamento está inactivo, la compra completa debe rechazarse.

Un medicamento inactivo conserva su información y su historial.

## RN15. Composición del medicamento

Cada medicamento nuevo debe registrarse con una composición que contenga al menos un principio activo. Medicamento y todos sus componentes se confirman en una sola transacción; si falla cualquier parte, no se conserva un medicamento incompleto ni componentes parciales.

No existe un alta alternativa sin composición. La obligación de composición no vacía corresponde al registro inicial: se conservan los históricos incompletos y, sin movimientos, pueden retirarse relaciones conforme a RN16, incluida la última si el estado resultante respeta la unicidad de RN13.

## RN16. Datos de composición

La composición debe indicar:

- Principio activo.
- Cantidad del ingrediente.
- Unidad de medida.
- Cantidad de referencia.
- Unidad de referencia.

Las cantidades utilizadas en la composición deben ser positivas.

El mismo principio activo no puede repetirse para el mismo medicamento, conforme al UNIQUE compuesto existente. Las cantidades respetan el tipo `DECIMAL(12,4)` y las unidades las longitudes definidas en el esquema.

Las cantidades son positivas, hasta `99999999.9999` y con un máximo de cuatro decimales; cada unidad admite hasta 30 caracteres. La API recibe cantidades como números JSON y las devuelve como cadenas decimales. Los principios activos referenciados deben existir; su estado inactivo no impide por sí solo una relación de composición en el contrato actual.

Mientras no exista historial, el Regente puede agregar ingredientes, editar cantidades y unidades (incluidas las de referencia) y retirar una relación de composición. Se autoriza la eliminación física de esa relación únicamente en esa etapa. Un ingrediente registrado por error se corrige retirando la relación incorrecta y creando la correcta, sin modificar silenciosamente su FK.

Desde el primer movimiento del medicamento, se prohíbe agregar o retirar ingredientes y cambiar principios activos, cantidades o unidades de su composición. Si la composición correcta representa otro producto, se registra un nuevo medicamento.

Toda alta, edición o retirada de un componente debe comprobar la identidad comercial y la composición completa resultante conforme a RN13, dentro de la misma transacción. Compartir solo una parte de los ingredientes con otro producto no constituye un duplicado.

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

El listado de Inventario incluye un medicamento si tiene al menos una `ExistenciaMedicamento` registrada. No exige saldo positivo, estado activo, movimientos ni compra vinculada; las existencias agotadas, vencidas e iniciales o históricas se conservan. Un producto registrado únicamente en el catálogo queda fuera del listado, pero mantiene su ficha y la consulta de existencias vacía. Este criterio no restringe Stock bajo, que puede incluir medicamentos activos sin existencias con stock vendible cero.

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

El saldo físico contado para una conciliación puede ser un entero no negativo, incluido cero. No es la cantidad de un movimiento: el sistema calcula la diferencia y solo registra movimientos de cantidad positiva cuando existe diferencia, conforme a RN82.

---

# 5. Stock físico y stock vendible

## RN27. Stock físico

El stock físico representa las unidades que todavía se encuentran físicamente en la farmacia.

Una existencia vencida puede continuar teniendo stock físico hasta que sus unidades sean retiradas.

## RN28. Stock vendible

El stock vendible representa las unidades que pueden utilizarse para una venta.

Una existencia vencida no forma parte del stock vendible.

El stock vendible de un medicamento inactivo se considera cero. Su stock físico permanece visible y se conservan sus existencias y movimientos históricos.

Esta inactividad no excluye sus existencias de las consultas de próximos a vencer o vencidos cuando cumplen las condiciones correspondientes.

## RN29. Medicamentos vencidos

Cuando una existencia alcanza su fecha efectiva de vencimiento, determinada según su precisión:

- Deja de ser vendible.
- No se elimina automáticamente.
- Su saldo físico se conserva hasta registrar el retiro correspondiente.

La precisión de vencimiento utiliza los valores `DIA` y `MES`:

- `DIA`: se almacena la fecha específica indicada y la existencia deja de ser vendible desde el inicio de esa fecha comercial.
- `MES`: se almacena el último día del mes indicado en la etiqueta. La existencia puede venderse durante todo ese día y deja de ser vendible desde el inicio del primer día del mes siguiente.

Ejemplos: una existencia `DIA` con fecha `2026-10-15` está vencida desde el 15/10/2026; una existencia `MES` con etiqueta `10/2026` almacena `2026-10-31` y está vencida desde el 01/11/2026.

La fecha efectiva desde la cual deja de ser vendible se calcula; no requiere una columna adicional.

La fecha comercial actual y las comparaciones de días comerciales se determinan en `America/La_Paz`. Esta decisión no autoriza convertir ni reinterpretar automáticamente los `DATETIME` históricos; su convención de almacenamiento debe verificarse antes de proponer cambios.

Tampoco se modifican ni normalizan automáticamente fechas de registros históricos. Las discrepancias deben revisarse antes de plantear una corrección de datos.

## RN30. Stock negativo

Ninguna operación puede dejar el saldo de una existencia por debajo de cero.

Antes de registrar una salida debe verificarse que exista cantidad suficiente.

## RN31. Stock mínimo

Cada medicamento puede tener definido un stock mínimo.

El stock mínimo no puede ser negativo.

## RN32. Stock bajo

Un medicamento activo se considera con stock bajo cuando:

```text
stockVendible <= stockMinimo
```

El cálculo se realiza utilizando la suma de sus existencias que todavía sean vendibles.

---

# 6. Compras

## RN33. Compra y proveedor

Cada compra debe pertenecer a un único proveedor o laboratorio.

El sistema lo obtiene automáticamente de las relaciones de los medicamentos en el catálogo; el Administrador no selecciona un proveedor independiente. Todos los medicamentos incluidos deben pertenecer al mismo proveedor. Si pertenecen a proveedores diferentes, la compra completa se rechaza y deben registrarse compras separadas. El sistema no divide automáticamente la solicitud.

El proveedor utilizado queda relacionado con la cabecera para conservar el historial de la operación.

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

Para las nuevas compras, cada detalle conserva también el saldo físico y el costo promedio anteriores de su existencia. Cuando varios detalles corresponden a la misma existencia, todos conservan el mismo estado previo a la compra completa, no estados intermedios. Esta información respalda la restauración prevista en RN76.

## RN37. Cantidad comprada

La cantidad recibida en una compra debe ser mayor que cero.

## RN38. Costo de compra

El costo unitario debe ser un valor válido mayor que cero, con un máximo de seis decimales. Una entrada con mayor precisión debe rechazarse, sin truncarla ni redondearla silenciosamente.

## RN39. Subtotal de compra

El subtotal de cada detalle se calcula mediante:

```text
cantidad × costoUnitario
```

El resultado se redondea a dos decimales conforme a RN40. Un costo unitario positivo puede producir un subtotal de 0.00 por efecto de ese redondeo.

## RN40. Total de compra

El total de una compra corresponde a la suma de los subtotales de sus detalles ya redondeados.

Los subtotales y el total se conservan con dos decimales. Cuando corresponda redondear un valor no negativo, se utiliza el valor más cercano y, en caso de empate, se redondea hacia arriba.

## RN41. Efecto de una compra

Cuando una compra queda confirmada:

- Se registra la compra.
- Se registran sus detalles.
- Se incrementa el saldo de las existencias correspondientes.
- Se generan movimientos de entrada.
- Se actualiza el costo promedio cuando corresponda.

Una compra ordinaria solo puede confirmarse con medicamentos activos y vencimientos todavía admitidos conforme a RN29. El vencimiento se evalúa con el día comercial del registro, no con una fecha de adquisición retroactiva. Si falla un detalle, se rechaza toda la operación.

La fecha de adquisición es obligatoria y puede ser anterior o igual al día comercial del registro en America/La_Paz, pero no posterior. Los efectos de inventario se registran al ejecutar la operación; no se generan movimientos retroactivos por indicar una fecha de adquisición anterior.

## RN42. Compra y existencia

Durante una compra, el sistema debe determinar si corresponde utilizar una existencia existente o crear una nueva según el medicamento, la fecha de vencimiento almacenada y su precisión. Una existencia con saldo cero se reutiliza cuando corresponde a esa misma combinación.

Cuando deba crearse una nueva existencia, se genera automáticamente su código de existencia.

## RN43. Atomicidad de la compra

La compra, sus detalles, los movimientos de inventario y las modificaciones de saldo deben registrarse como una sola operación lógica.

Si una parte de la operación falla, no deben quedar cambios parciales.

La captura y conservación del estado anterior de las existencias forma parte de la misma operación transaccional.

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

Todos los detalles de una misma compra dirigidos a una existencia se calculan agrupadamente:

```text
saldoFinal = saldoAnterior + sumaCantidades

promedioFinal = redondear6(
  (saldoAnterior × promedioAnterior
   + suma(cantidad × costoUnitario))
  / saldoFinal
)
```

Se redondea una sola vez a seis decimales por existencia y compra, conforme a RN40. El orden de los detalles no debe alterar el resultado. Los detalles y movimientos se conservan individualmente. Si el saldo anterior es cero, el promedio histórico no aporta valor a la nueva entrada.

## RN46. Salidas de inventario

Las salidas por venta, vencimiento, daño u otros motivos deben conservar el costo aplicado en el momento en que se realizó el movimiento.

Las salidas no deben modificar retroactivamente los costos registrados anteriormente.

## RN47. Valoración histórica

Los movimientos deben conservar su costo aplicado para permitir conocer posteriormente el valor histórico de:

- Ventas.
- Retiros.
- Pérdidas.
- Reversiones.

El costo unitario aplicado a los movimientos se conserva con seis decimales.

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

Para comparar vencimientos con precisión `DIA` y `MES`, se utiliza la fecha efectiva desde la cual dejan de ser vendibles, definida en RN29.

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

El motivo es obligatorio. La actividad actual del medicamento o proveedor y el vencimiento de la existencia no son condiciones de recepción aplicables a la anulación de una compra histórica.

## RN76. Efecto de anular compra

La anulación de una compra debe compensar los movimientos de entrada generados originalmente.

La valoración se determina por existencia:

- **B1:** si no existen movimientos ajenos posteriores, los originales están íntegros, el estado anterior está disponible y es consistente entre los detalles, y el estado actual coincide con el resultado esperado de la compra, se restauran exactamente el saldo y el costo promedio anteriores.
- **A:** si existen movimientos posteriores, se calcula una reversión conservadora desde el saldo y promedio actuales:

```text
cantidadRevertida = suma(cantidades originales)
valorRevertido = suma(cantidadOriginal × costoOriginal)
saldoFinal = saldoActual − cantidadRevertida
valorResidual = saldoActual × promedioActual − valorRevertido
```

Si el saldo final es positivo, el nuevo promedio se obtiene dividiendo el valor residual por el saldo final y redondeando a seis decimales conforme a RN40. Se rechazan saldo negativo, valor residual negativo o promedio no representable. Si el saldo final es cero, el valor residual debe ser cero; el promedio almacenado puede conservarse sin efecto valorizado.

No se aplican tolerancias arbitrarias ni se modifican costos históricos. La alternativa A puede rechazar una anulación aun cuando exista cantidad suficiente y no reconstruye el pasado como si la compra nunca hubiera ocurrido.

La ausencia de estado anterior en compras históricas no autoriza inferirlo desde el estado actual. B1 no puede utilizarse cuando falta esa información o no puede demostrarse la coherencia del estado. Una compra histórica sin estado anterior y sin movimientos posteriores no puede restaurarse exactamente y su anulación debe rechazarse por información insuficiente. Si existen movimientos posteriores, puede utilizarse A siempre que los originales y el historial sean íntegros.

Un estado anterior parcialmente disponible o contradictorio, originales incompletos o reversiones previas incompatibles impiden la anulación; no se utiliza A para eludir una inconsistencia.

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

Una compra puede aplicar B1 a unas existencias y A a otras. Todos los grupos se validan dentro de la misma transacción; si alguno falla, se rechaza la anulación completa.

---

# 12. Ajustes de inventario

## RN81. Conteo físico

El conteo físico continúa siendo realizado por el personal de la farmacia.

El sistema sirve como apoyo para consultar y actualizar las diferencias encontradas.

## RN82. Ajuste de inventario

Cuando exista una diferencia entre el saldo registrado y el conteo físico, la corrección debe realizarse mediante un movimiento de ajuste.

No debe modificarse el saldo directamente sin dejar trazabilidad.

El Regente proporciona el saldo físico contado y el sistema calcula `diferencia = saldoContado - saldoRegistrado` después de comprobar las precondiciones de RN103. La dirección y cantidad del ajuste no las decide el cliente: una diferencia positiva genera entrada y una negativa, salida por su valor absoluto. Sin diferencia no se genera movimiento ni se modifica saldo o promedio; se informa que no fue necesario ajustar, después de verificar igualmente las precondiciones.

Una entrada exige costo unitario estrictamente positivo, con hasta seis decimales. Su promedio ponderado se calcula con precisión exacta y un único redondeo a seis decimales, al más cercano con empate hacia arriba, conforme al criterio de RN40. Si el saldo anterior es cero, el promedio histórico no aporta valor a esa entrada.

Se permiten conciliaciones de existencias registradas aunque el medicamento esté inactivo o la existencia vencida. No crean existencias arbitrarias, reactivan medicamentos, cambian vencimientos ni convierten unidades vencidas en vendibles. Los ajustes concilian conteos; un daño identificado o un vencimiento debe registrarse mediante el retiro específico de RN88/RN89, no como ajuste genérico.

## RN83. Ajuste negativo

Un ajuste de salida no puede dejar el saldo físico de la existencia por debajo de cero.

Se aplica el costo promedio vigente, admitido cero, y se conserva el promedio almacenado incluso al agotar la existencia. El cliente no proporciona un costo alternativo. Un ajuste negativo no se clasifica como pérdida por daño o vencimiento.

## RN84. Responsable del ajuste

Todo ajuste debe registrar:

- Usuario responsable.
- Fecha.
- Cantidad.
- Motivo.
- Observación obligatoria.

El responsable es el Regente autenticado y la fecha/hora real la determina el backend. La observación se exige también en una conciliación sin diferencia, pero no se conserva como historial del conteo. Esa conciliación no genera movimiento; Bitácora guarda solo el resultado sin cambios y la existencia conforme a RN129, sin snapshots, conteo ni observación. No se crea una entidad adicional para conteos.

---

# 13. Vencimientos

## RN85. Existencia próxima a vencer

Una existencia se considera próxima a vencer cuando:

- Tiene saldo físico positivo.
- Todavía no está vencida.
- Su fecha de vencimiento normalizada de la etiqueta está comprendida entre la fecha comercial actual y los próximos tres meses calendario.

Con precisión `MES`, para este intervalo se utiliza el último día del mes indicado en la etiqueta, no la fecha efectiva de no venta del mes siguiente. La condición de no estar vencida se comprueba conforme a RN29.

Tres meses calendario no se sustituyen automáticamente por 90 días.

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

El Regente debe seleccionar una existencia registrada y una cantidad positiva que cumpla RN90. El vencimiento efectivo se comprueba según DIA/MES y el día comercial America/La_Paz de RN29, después de verificar las precondiciones de RN103; MES vence al comenzar el primer día del mes siguiente, no durante el último día de su etiqueta. La inactividad del medicamento no impide la baja física.

Se utiliza el promedio vigente como costo aplicado, admitido cero, con seis decimales; se conserva el promedio almacenado incluso al agotar la existencia. La observación es opcional. Responsable y fecha/hora los determina el backend. El retiro no modifica el vencimiento ni elimina el historial; su pérdida se obtiene conforme a RN91/RN92.

## RN89. Retiro por daño

Las unidades dañadas deben retirarse mediante un movimiento de salida con motivo de daño.

El retiro corresponde al Regente, sobre una existencia registrada, con cantidad positiva, saldo suficiente según RN90 y precondiciones vigentes según RN103. Puede realizarse aunque el medicamento esté inactivo o la existencia vencida; no exige vencimiento, no cambia esa fecha ni reactiva el medicamento. La reducción del saldo físico se refleja en el stock vendible cuando corresponda, sin volver vendibles unidades vencidas o de un medicamento inactivo.

La observación del daño es obligatoria. Responsable y fecha/hora los determina el backend. Se aplica el promedio vigente, admitido cero, con seis decimales y se conserva el promedio almacenado incluso al agotar la existencia. Su pérdida se obtiene según RN91/RN92, separada de vencimientos y ajustes negativos.

## RN90. Cantidad retirada

La cantidad retirada no puede superar el saldo físico disponible de la existencia.

## RN91. Pérdida valorizada

La pérdida producida por un retiro se calcula mediante:

```text
cantidadRetirada × costoUnitarioAplicado
```

El costo aplicado corresponde al promedio vigente al retirar y queda conservado en el movimiento con seis decimales. Los cálculos intermedios mantienen precisión monetaria exacta; la pérdida se presenta a dos decimales, al más cercano con empate hacia arriba, según el criterio de RN40. No se agrega una columna de pérdida: el importe se deriva del movimiento. Las pérdidas por daño y vencimiento se distinguen por su motivo; los ajustes negativos no se incluyen en esas categorías.

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

El sistema debe identificar los medicamentos activos cuyo stock vendible sea menor o igual al stock mínimo.

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

En ajustes y retiros debe verificarse, dentro de la operación atómica y antes de efectos, que el saldo físico y el último movimiento de la existencia continúan coincidiendo con los observados al preparar la solicitud. Si cambiaron, se rechaza la solicitud por conflicto sin modificar saldo ni historial. La comprobación también se exige para una conciliación sin diferencia; un saldo que volvió al valor observado no basta si el historial cambió. Este control no equivale a idempotencia ni a una auditoría persistida del conteo sin movimiento.

Los ajustes y retiros efectivos confirman juntos saldo, valoración aplicable y movimiento. Cuentan como posteriores para RN76 sobre su existencia y pueden impedir B1 o hacer que A rechace la anulación; una conciliación sin diferencia no agrega movimientos posteriores. No se modifican snapshots ni costos históricos para facilitar una anulación.

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

---

# 19. Bitácora de auditoría

**Estado:** backend implementado en Fases 1–6; cobertura, documentación y aceptación MySQL local de Fase 7 verificadas. RN116–RN133 complementan la trazabilidad actual sin cambiar las políticas vigentes de autenticación, compras o inventario. La disponibilidad operativa exige aplicar la migración en destino; la evidencia y los pendientes de infraestructura se registran en `bitacora-auditoria.md`.

## RN116. Registro automático de eventos relevantes

El backend debe registrar automáticamente los resultados relevantes de autenticación y seguridad y las operaciones administrativas o críticas previstas en RF43–RF49. El usuario no decide si registra su acción ni proporciona el resultado de auditoría como fuente de verdad.

El registro es transversal a los casos de uso de origen; CU42 representa su consulta. No se requiere registrar cada pulsación, renderizado, consulta rutinaria o petición automática. Los rechazos relevantes de autenticación y autorización se distinguen de esas consultas ordinarias.

## RN117. Responsable y cuenta objetivo

Cuando exista sesión validada, el responsable debe obtenerse del contexto autenticado del backend, nunca de un ID, nombre o rol arbitrario enviado por el cliente. Deben conservarse sus datos identificativos pertinentes del momento del evento, sin que un cambio posterior reatribuya el historial.

En un login exitoso, la identidad se obtiene de las credenciales verificadas por el backend, aunque no hubiera sesión previa; reconocer el nombre por sí solo no basta.

La cuenta sobre la que se actúa es una referencia distinta: en un restablecimiento administrativo, por ejemplo, Administrador responsable y cuenta objetivo pueden ser diferentes. El mero reconocimiento de una cuenta en login o recuperación no autentica al solicitante ni demuestra que su titular haya realizado el intento.

## RN118. Eventos sin autenticación o sin cuenta reconocida

Los eventos de login, recuperación y rechazos de autenticación pueden registrarse sin sesión, sin responsable autenticado y sin un `id_usuario` válido. El nombre ingresado en un login debe conservarse cuando esté disponible y sea válido, con sanitización y longitud acotada; un cuerpo inválido no obliga a copiar sus valores arbitrarios.

No deben crearse usuarios ficticios ni atribuir roles desde la entrada o desde un JWT no validado. Registrar un intento contra un nombre inexistente en Bitácora no crea un contador de bloqueo para ese nombre y no modifica RN07. La respuesta pública no debe revelar información interna de auditoría que permita enumerar cuentas.

## RN119. Fecha y hora del servidor

El instante del evento debe obtenerse del servidor, sin aceptar como fecha real una proporcionada por el cliente. Debe distinguirse del vencimiento de un bloqueo o de una fecha comercial de adquisición.

Los nuevos eventos se almacenan en UTC mediante `DATETIME(3)` y se presentan como ISO 8601 con `Z` y milisegundos. Los filtros exigen zona u offset explícitos, se convierten a UTC y operan sobre fecha de registro con extremos inclusivos. Esta decisión no autoriza convertir ni reinterpretar los `DATETIME` históricos ni modificar el día comercial America/La_Paz de RN29.

## RN120. Captura segura de dirección IP

La IP debe obtenerse en el backend a partir de la conexión o de una cadena de proxies de confianza verificada. No se acepta como autoridad una IP del body ni una cabecera reenviada arbitraria. El dato debe conservar su procedencia y, si no está disponible, indicarse esa condición sin inventarlo.

Actualmente `app.js` no configura `trust proxy` y CU09 usa `req.socket.remoteAddress` conforme a RN110. Bitácora normaliza ese socket como `SOCKET_PEER` o indica `NO_DISPONIBLE`; no usa cabeceras reenviadas ni `req.ip`. Detrás de un proxy puede corresponder al intermediario; no debe presentarse automáticamente como la IP original del cliente. La cadena de Railway y cualquier nueva fuente/confianza quedan pendientes de verificación y aprobación. Esta regla no cambia la fuente ni la protección HMAC de las cuotas actuales de recuperación.

Una IP no identifica por sí sola a una persona; puede ser compartida, cambiar o pertenecer a un proxy.

## RN121. Resultado y causa del evento

Cada evento debe identificar operación y resultado exitoso, rechazado o fallido, con causa sanitizada pertinente. Deben distinguirse credenciales incorrectas, cuenta desactivada, cuenta bloqueada, falta de autorización, entrada inválida y fallo técnico.

No basta con copiar un código HTTP: el resultado funcional depende de la causa y del estado confirmado. Una respuesta genérica de recuperación no prueba emisión o envío; una aceptación del proveedor de correo no prueba entrega. Si el resultado de la solicitud difiere del efecto persistido, debe conservarse esa distinción; si el efecto es incierto, no se debe afirmar éxito confirmado.

## RN122. Auditoría del fallo que desencadena el bloqueo

Debe registrarse el intento de contraseña incorrecta que alcanza el umbral de RN07, con cuenta objetivo, nombre ingresado, fecha/hora, IP y contador confirmado correspondiente. Debe poder relacionarse con el evento de bloqueo producido sin contarlo como dos contraseñas incorrectas.

El tercer fallo es una causa diferente de intentar ingresar con un bloqueo ya vigente, aunque la implementación actual devuelve 423 en ambos casos. La auditoría debe observar el resultado interno confirmado, sin cambiar las respuestas ni la política de login.

## RN123. Auditoría del bloqueo y de los intentos durante su vigencia

El evento de bloqueo debe conservar cuenta objetivo, instante, duración de diez minutos establecida por RN07, finalización prevista y relación con el fallo desencadenante. Cada intento recibido mientras el bloqueo siga vigente debe registrarse como rechazo durante el bloqueo, conservando los datos pertinentes disponibles.

No se debe describir ese intento como nueva comprobación de contraseña ni como nuevo bloqueo. La auditoría observa el vencimiento y los reinicios existentes sin prolongar el bloqueo, cambiar el estado administrativo o revocar sesiones por su cuenta. RN07 continúa siendo la fuente de la política y RN113/RN115 de los efectos de recuperación; no se crean nuevas sanciones ni límites.

## RN124. Logout explícito y eventos de sesión

Solo se registra como logout explícito exitoso el cierre completado por el endpoint de autenticación después de validar la sesión y eliminar su cookie. Un rechazo previo del middleware no acredita cierre de sesión.

La expiración o invalidez de un token, una versión de credenciales desactualizada y un acceso denegado son eventos distintos, observables al recibir una solicitud. El cierre de una pestaña o del navegador y la expiración sin solicitud no se consideran logout explícito ni eventos garantizados del backend. La auditoría no agrega revocación inmediata ni tabla de sesiones.

## RN125. Exclusión de datos sensibles

La Bitácora y los diagnósticos asociados no deben contener:

- Contraseñas, actuales o nuevas, ni hashes de contraseña.
- JWT, cookies de sesión ni cabeceras que los contengan.
- Códigos de recuperación ni su HMAC u otros valores secretos de verificación.
- Secretos del sistema, credenciales de base de datos o claves de proveedores externos.
- Cuerpos completos de solicitudes sin filtrado, respuestas externas completas o errores técnicos sin sanitizar.
- Información personal innecesaria, incluidos datos clínicos o de pacientes ajenos al objetivo del evento.

Solo se incorporan datos expresamente permitidos y pertinentes de RI16. Los textos externos o ingresados deben validarse, acotarse y tratarse como datos, sin permitir que inyecten contenido de registro o ejecución al consultarlos. No se guardan valores sensibles anteriores/nuevos al auditar cambios de contraseña ni se copia el correo de recuperación por defecto.

## RN126. Consulta exclusiva del Administrador

Listado, filtros y detalle de CU42 requieren sesión válida de una cuenta activa y rol Administrador comprobado en el backend con los mecanismos actuales de autenticación y autorización.

Regente y Vendedor generan eventos mediante sus operaciones, pero no tienen acceso a la bitácora general. No se crean roles nuevos, permisos dinámicos ni excepciones por ocultar o mostrar una pantalla.

## RN127. Protección frente a modificaciones ordinarias

Los registros de auditoría no deben poder editarse ni eliminarse mediante las operaciones ordinarias del sistema, tampoco por el Administrador desde CU42. Un cambio posterior de una operación de negocio no reescribe su evento anterior; debe originar el evento pertinente de la nueva acción.

Esta restricción no afirma protección absoluta frente a intervenciones en la infraestructura. Cualquier archivo o depuración extraordinaria deberá sujetarse a una política aprobada según RN128.

## RN128. Conservación y retención de auditoría

Los eventos confirmados deben persistir y continuar disponibles para consulta autorizada después de reiniciar la aplicación. La conservación mínima aprobada es de cinco años: 60 meses calendario desde la fecha de registro. Se aplican períodos superiores cuando una obligación legal pertinente lo requiera; esta decisión técnica no acredita por sí sola cumplimiento legal.

La primera versión no incluye cron, eliminación ni archivado automático, ni edición ordinaria de eventos, tampoco por el Administrador. Cumplir el mínimo no autoriza borrar. Las responsabilidades operativas, respaldos, eventual archivo y cualquier procedimiento extraordinario de depuración siguen pendientes de aprobación. La ausencia de borrado no constituye una decisión de retención ilimitada ni reemplaza la planificación del volumen y recuperación de información.

## RN129. Complemento de los historiales administrativos y de inventario

La Bitácora identifica operación, responsable cuando exista, instante, registro afectado y resultado, con referencias a compras, existencias y movimientos pertinentes. No sustituye el historial de compras, futuras ventas ni `MovimientoInventario`; tampoco autoriza saldos directos sin movimiento ni cambios de valoración histórica.

La creación/modificación de existencias derivada de una compra, anulación, ajuste o retiro pertenece a la operación de origen; no se inventa una edición independiente. Un alta integral de medicamento incluye su composición inicial en el mismo evento lógico; las modificaciones independientes de composición se auditan como sus propias operaciones permitidas.

CU23, RF19/RI09 y RN84/RN103 distinguen el conteo del resultado de la operación. Bitácora registra la conciliación sin diferencia como operación sin cambios, con referencia a la existencia, sin snapshots, conteo, observación, movimiento ni cambios de saldo/promedio. No crea un historial detallado de conteos ni reemplaza RN82–RN84 o sus precondiciones.

Ventas y Recetas se integrarán cuando se implementen sus operaciones; su previsión de auditoría no acredita que ya estén desarrolladas.

## RN130. Consistencia con las transacciones y efectos confirmados

Un evento de éxito debe corresponder a efectos confirmados; un rollback no puede dejar la operación como realizada exitosamente. Los éxitos críticos comparten transacción con el negocio. Debe distinguirse una operación confirmada de un fallo posterior al preparar o enviar su respuesta, respetando las transacciones vigentes.

Los eventos de rechazo o fallo no deben perderse simplemente por intentar conservarlos en una transacción de negocio revertida. En login y verificación de recuperación hay fallos esperados cuyos contadores o bloqueos se confirman antes del error público; debe auditarse ese estado confirmado sin revertir la protección ni tratar todo error HTTP como rollback.

Una caída que impida conocer el resultado no autoriza inventar éxito o repetir automáticamente la operación. Un commit sin confirmación se clasifica como efecto `INCIERTO`. El resultado `NO_CONFIRMADO` de la escritura del auditor no demuestra ausencia del evento; no ocasiona reintento. El tratamiento por proceso se describe en RN132.

## RN131. Eventos diferenciados sin duplicación innecesaria

La misma causa no debe registrarse varias veces por atravesar Middleware, Controller, Service y manejador global de errores. Debe definirse un responsable de captura por evento y conservar relaciones pertinentes cuando una solicitud origine hechos distintos.

El fallo desencadenante y el bloqueo producido son dos hechos relacionados; no dos intentos incorrectos. Los detalles o movimientos de una misma operación no exigen duplicar su evento de cabecera. Los reintentos internos del catálogo no son operaciones exitosas adicionales; un nuevo intento real recibido del usuario puede generar su propio evento con el resultado efectivo.

La consulta ordinaria de Bitácora no debe originar un ciclo de auditoría de sus propias lecturas. Esto no excluye registrar un rechazo relevante de acceso no autorizado. No se promete idempotencia universal ni se cambia la clave de operación de Compras.

## RN132. Fallos de escritura de auditoría

Un fallo de persistencia debe detectarse y producir diagnóstico técnico sanitizado sin afirmar que el evento se guardó. No debe generar un ciclo de intentos de auditar su propio error, exponer secretos ni revertir o repetir automáticamente una operación ya confirmada.

La política aprobada exige auditoría en la transacción de login exitoso, cambios efectivos de contraseña y escrituras administrativas/críticas, incluida conciliación sin diferencia. Si falla antes de confirmar, se revierte el conjunto y se devuelve 503 sanitizado. Los rechazos, contadores/bloqueos ya confirmados, emisión/cuotas de recuperación, resultado del envío, logout y consultas sensibles materializadas usan auditoría independiente; un fallo exclusivo del auditor conserva su efecto y respuesta originales. No se reenvía correo ni se repite negocio automáticamente. El diagnóstico seguro es `AUDITORIA_PERSISTENCIA_NO_CONFIRMADA`. Un fallo no autoriza permitir un login rechazado, suprimir límites, eliminar un bloqueo ni romper atomicidad de inventario.

Si el almacenamiento está caído, no puede garantizarse registrar el fallo en ese mismo almacenamiento. La eventual alternativa de conservación y recuperación queda pendiente, sin asumir nuevos servicios, colas ni disponibilidad absoluta. No se considera aceptable omitir silenciosamente el fallo ni presentar consola como persistencia de Bitácora.

## RN133. Información técnica segura para investigación

Los errores técnicos deben conservar operación, categoría o código seguro, fecha/hora, resultado y contexto mínimo disponible según RI16, con referencias pertinentes y sin copiar el objeto de error completo. No se almacenan SQL, parámetros, stacks o respuestas externas sin filtrar que puedan revelar secretos.

Las categorías de validación, credenciales, bloqueo y denegación no se etiquetan como errores técnicos del servidor por el solo hecho de producir una respuesta no exitosa. Los fallos de conexión y envío se distinguen de esos rechazos. El diagnóstico público conserva mensajes seguros; el detalle de auditoría solo está disponible para el Administrador conforme a RN126.
