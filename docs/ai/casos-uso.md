# CADEFAR — Casos de Uso del Sistema

> Este archivo contiene los casos de uso completos del sistema CADEFAR.
> El catálogo contiene 42 casos de uso, numerados consecutivamente desde CU01 hasta CU42. CU42 corresponde al módulo Bitácora, implementado en backend; su puesta en funcionamiento requiere la migración y aceptación del entorno.
>
> Forma parte de la documentación ubicada en:
>
> `docs/ai/`
>
> Debe utilizarse junto con:
>
> - `contexto-maestro.md`
> - `requerimientos.md`
> - `reglas-negocio.md`

---

# 1. Consideraciones generales

Los casos de uso representan objetivos completos que los actores realizan dentro del sistema.

No representan botones, pantallas o pasos pequeños de interfaz.

## Actores principales

- Administrador.
- Regente.
- Vendedor.

Cuando una operación pueda ser realizada por más de un rol, se especifican explícitamente los roles correspondientes en el campo Actor.

---

# 2. Autenticación y usuarios

## CU01. Iniciar sesión

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Permitir que un usuario acceda al sistema mediante su nombre de usuario y contraseña.

**Condiciones principales:**

- El usuario debe existir.
- La cuenta debe estar activa.
- La cuenta no debe encontrarse dentro de un bloqueo temporal vigente.
- La contraseña debe coincidir con el hash almacenado.

**Flujo alternativo por credenciales incorrectas:**

- Cada contraseña incorrecta incrementa el contador de intentos fallidos consecutivos.
- El tercer intento fallido bloquea nuevos inicios de sesión durante diez minutos.
- Los intentos realizados durante el bloqueo no extienden su duración.
- Un inicio de sesión correcto reinicia el contador.

**Resultado:**  
El sistema genera un JWT con `idUsuario` e `idRol` y lo almacena en una cookie HttpOnly.

---

## CU02. Cerrar sesión

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Cerrar la sesión actual.

**Resultado:**  
El sistema elimina la cookie que contiene el JWT.

---

## CU03. Crear usuario

**Actor:**  
Administrador.

**Objetivo:**  
Registrar una nueva cuenta de usuario.

**Condiciones principales:**

- El nombre de usuario no debe estar registrado.
- El rol debe existir y estar activo.
- La contraseña debe tener entre 8 y 100 caracteres e incluir mayúscula, minúscula, número y carácter especial.
- La contraseña se guarda mediante hash.

**Resultado:**  
Se crea una nueva cuenta asociada a uno de los roles definidos.

---

## CU04. Consultar usuarios

**Actor:**  
Administrador.

**Objetivo:**  
Consultar las cuentas registradas en el sistema.

**Resultado:**  

- Se muestran los datos permitidos de los usuarios.
- Se muestra su rol.
- Se muestra su estado.
- Nunca se muestra `password_hash`.

---

## CU05. Consultar usuario por ID

**Actor:**  
Administrador.

**Objetivo:**  
Consultar la información de una cuenta específica.

**Condición:**  
El usuario debe existir.

---

## CU06. Modificar usuario

**Actor:**  
Administrador.

**Objetivo:**  
Modificar los datos permitidos de una cuenta.

**Condiciones principales:**

- El usuario debe existir.
- El nombre de usuario debe continuar siendo único.
- El rol asignado debe existir y estar activo.

---

## CU07. Activar o desactivar usuario

**Actor:**  
Administrador.

**Objetivo:**  
Cambiar el estado de una cuenta sin eliminarla físicamente.

**Resultado:**  
Una cuenta inactiva conserva su historial, pero no puede iniciar sesión ni registrar operaciones.

---

## CU08. Cambiar contraseña

**Actor:**  
Administrador, Regente o Vendedor para el cambio propio; Administrador para el restablecimiento administrativo.

**Objetivo:**  
Modificar la contraseña de una cuenta.

**Condiciones principales:**

- La contraseña nueva debe cumplir la política de complejidad definida.
- En el cambio propio, el usuario debe confirmar su contraseña actual.
- En el restablecimiento administrativo no se consulta ni muestra la contraseña anterior.

**Resultado:**  

- La nueva contraseña se almacena únicamente mediante su hash.
- El cambio propio exitoso y el restablecimiento administrativo eliminan cualquier bloqueo temporal y reinician los intentos fallidos.
- Ambos incrementan la versión de credenciales e invalidan recuperaciones pendientes. El cambio propio renueva su cookie actual; el restablecimiento administrativo revoca sesiones anteriores.

---

## CU09. Restablecer contraseña mediante correo electrónico

**Actor:**
Administrador, Regente o Vendedor.

**Objetivo:**
Permitir que un usuario que olvidó su contraseña pueda establecer una nueva mediante un código de verificación enviado a su correo electrónico.

**Condiciones principales:**

- El usuario debe tener una cuenta registrada con un correo electrónico asociado.
- No se requiere iniciar sesión ni conocer la contraseña anterior.
- El código de verificación debe ser válido, no estar vencido y no haber sido utilizado.
- La nueva contraseña debe cumplir la política de complejidad definida.

**Flujo implementado en backend:**

1. Solicitar con `{ correo }` en `POST /api/auth/recuperacion/solicitar`.
2. Validar cuotas IP/cuenta y cuenta activa; persistir HMAC del código con vencimiento de diez minutos e invalidar el anterior en transacción.
3. Después del commit, intentar el envío una vez mediante mock local/test o Brevo HTTPS con timeout de cinco segundos.
4. Devolver respuesta genérica con espera pública mínima de cinco segundos, también para desconocidos, inactivos y solicitudes suprimidas; sin garantía de tiempo constante.
5. Enviar `{ correo, codigo, passwordNueva }` a `POST /api/auth/recuperacion/restablecer`. Verificar/consumir en esta operación, con máximo cinco fallos y límite persistente IP; contraseña nueva de máximo 72 bytes UTF-8.

Si el correo es rechazado explícitamente, se invalida solo esa emisión. Ante timeout/resultado incierto se conserva hasta vencimiento; no se reenvía automáticamente. Una nueva solicitud manual requiere respetar cuotas, incluso si falló el envío anterior.

**Resultado:**

- La nueva contraseña se almacena únicamente mediante su hash.
- El código de verificación utilizado queda invalidado.
- Se reinician los intentos fallidos y se elimina el bloqueo temporal de inicio de sesión.
- Se invalidan las otras recuperaciones pendientes y se incrementa la versión de credenciales, revocando JWT anteriores.
- No se inicia sesión automáticamente ni se emite cookie; no se activa una cuenta inactiva ni se cambia el rol.

---

# 3. Proveedores y laboratorios

## CU10. Registrar proveedor o laboratorio

**Actor:**  
Administrador.

**Objetivo:**  
Registrar una entidad que suministra medicamentos.

**Datos principales:**

- Nombre.
- Teléfono.
- Dirección.
- Estado.

**Consideración:**  
Según la entrevista, el laboratorio también puede funcionar como proveedor, por lo que se mantiene una sola entidad `ProveedorLaboratorio`.

---

## CU11. Consultar proveedores o laboratorios

**Actor:**  
Administrador o Regente.

**Objetivo:**  
Consultar los proveedores o laboratorios registrados y la información relacionada con ellos.

---

## CU12. Modificar proveedor o laboratorio

**Actor:**  
Administrador.

**Objetivo:**  
Actualizar los datos de un proveedor o laboratorio existente.

---

## CU13. Activar o desactivar proveedor o laboratorio

**Actor:**  
Administrador.

**Objetivo:**  
Cambiar su estado sin eliminar el registro ni perder su historial.

---

# 4. Medicamentos y composición

## CU14. Registrar medicamento

**Actor:**  
Regente.

**Objetivo:**  
Agregar un medicamento al catálogo con su composición completa en una sola operación.

**Datos principales:**

- Nombre comercial.
- Forma farmacéutica.
- Presentación.
- Unidad de inventario.
- Stock mínimo.
- Condición de venta.
- Vía de administración.
- Tipo de liberación.
- Estado.
- Proveedor o laboratorio relacionado.
- Composición con al menos un principio activo, cantidad/unidad del ingrediente y cantidad/unidad de referencia.

El código se genera automáticamente conforme a RN13, no se solicita al usuario. `stockMinimo` y `estado` son opcionales en la API; sus valores predeterminados son cero y activo. El formulario utiliza stock mínimo cero por defecto y no envía estado.

**Precondiciones:**

- Sesión autenticada de Regente.
- Proveedor/laboratorio existente y activo.
- Principios activos existentes, sin IDs repetidos en la composición.
- Datos y cantidades válidos conforme a RN13/RN16.

**Flujo principal:**

1. El Regente abre «Crear medicamento» e introduce los datos comerciales y el proveedor.
2. Agrega uno o más componentes. Puede corregir cantidades/unidades o retirar componentes del borrador; estas acciones todavía no persisten datos.
3. Envía el medicamento y todos los componentes mediante un único POST.
4. El backend valida estructura, referencias e identidad comercial/composición completa, incluidos registros inactivos y solicitudes concurrentes.
5. Si no hay duplicado, genera el código y crea medicamento y composición dentro de la misma transacción.
6. Después del commit, devuelve 201 con el medicamento y su composición. La interfaz abre la ficha y muestra el código confirmado.

**Alternativas y errores:**

- Composición ausente/vacía, principio repetido en el arreglo, código manual, cantidades inválidas o nombre sin tres letras válidas: 400.
- Referencia inexistente: 404. Proveedor inactivo: 409.
- Identidad comercial y composición completas coincidentes: 409 conforme a RN13. El formulario conserva el borrador y ofrece consultar los medicamentos existentes indicados por la API, incluso inactivos.
- Correlativo agotado o conflicto temporal de bloqueos: 409. La interfaz conserva los datos para corrección o un nuevo envío manual.
- Fallo durante la operación: rollback completo, sin medicamento huérfano ni componentes parciales. No se reenvía automáticamente desde React.

---

## CU15. Consultar o buscar medicamento

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Buscar medicamentos principalmente por nombre o código.

---

## CU16. Modificar medicamento

**Actor:**  
Regente.

**Objetivo:**  
Actualizar los datos permitidos de un medicamento existente.

**Condiciones de edición:**

- El medicamento debe existir.
- El código es inmutable desde el alta y no se acepta en el PATCH, aun sin historial; cambiar el nombre no lo regenera.
- El estado se modifica mediante CU17, no en esta edición.
- Sin movimientos de inventario pueden editarse los demás datos del catálogo respetando referencias y unicidad.
- Con al menos un movimiento en cualquiera de sus existencias, se bloquean cambios efectivos de proveedor/laboratorio, forma farmacéutica, presentación, unidad de inventario, vía de administración y tipo de liberación.
- Con historial pueden seguir modificándose nombre comercial, stock mínimo y condición de venta.
- Una corrección tipográfica del nombre no crea un nuevo medicamento. Si cambia realmente la identidad del producto, corresponde otro registro.
- Un cambio efectivo de nombre u otro atributo de identidad debe compararse con la composición completa actual. Si coincide con otro medicamento, devuelve 409 y revierte el PATCH; se excluye el propio registro de la comparación.
- El PATCH comercial no recibe `composicion`; las relaciones existentes se gestionan mediante CU19.

**Resultado:**

La interfaz envía solo los campos comerciales modificados y conserva el código. Si el servidor rechaza la edición, conserva los valores del formulario; un conflicto de identidad con referencias públicas permite consultar el producto existente. Cambios únicamente de stock mínimo, condición de venta o estado no fusionan ni corrigen duplicados históricos.

---

## CU17. Activar o desactivar medicamento

**Actor:**  
Regente.

**Objetivo:**  
Cambiar el estado de un medicamento sin eliminarlo físicamente.

**Resultado:**  
Un medicamento inactivo conserva su historial y no puede utilizarse en operaciones que requieran un medicamento activo.

---

## CU18. Gestionar principios activos

**Actor:**  
Administrador y Regente para consultar; Regente para registrar, modificar y activar o desactivar.

**Objetivo:**  
Registrar, consultar, modificar y activar o desactivar principios activos.

---

## CU19. Gestionar composición de medicamento

**Actor:**  
Regente.

**Objetivo:**  
Relacionar un medicamento con uno o más principios activos.

**Datos principales:**

- Principio activo.
- Cantidad del ingrediente.
- Unidad de medida.
- Cantidad de referencia.
- Unidad de referencia.

**Operaciones permitidas:**

- Sin movimientos del medicamento, el Regente puede agregar relaciones, editar cantidades y unidades (incluidas las de referencia) y retirar físicamente una relación.
- Un principio activo incorrecto se corrige retirando la relación y creando la correcta.
- La edición de la relación modifica cantidades y unidades; las FK no se cambian mediante su PATCH normal.
- Una vez que exista al menos un movimiento en cualquier existencia del medicamento, no se puede agregar, retirar ni modificar su composición.
- La relación debe pertenecer al medicamento indicado; no se puede modificar o retirar una relación de otro medicamento mediante su ID.
- No se permite repetir el mismo principio activo dentro del mismo medicamento.
- Se comprueba la identidad comercial con toda la composición resultante, sin depender del orden de los componentes, conforme a RN13/RN16. Agregar, modificar o retirar una relación no puede producir un duplicado con otro medicamento, activo o inactivo; si ocurre, devuelve 409 y revierte la operación completa.
- Un histórico sin composición puede completarse si no tiene movimientos y el resultado respeta la unicidad. La retirada de la última relación antes del historial sigue admitida cuando el resultado no coincide con otro registro; no habilita un alta nueva sin composición.

El registro inicial de todos los componentes pertenece al POST integral de CU14. CU19 mantiene las operaciones independientes sobre medicamentos existentes, con transacción y comprobación del estado completo resultante.

---

## CU20. Consultar medicamentos por composición

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Buscar medicamentos según sus principios activos o composición.

**Consideración:**  
La coincidencia de composición no significa automáticamente que un medicamento pueda sustituir a otro.

Cuando se indiquen varios principios activos, se buscan medicamentos que contengan todos ellos (AND). Se permiten ingredientes adicionales. La respuesta conserva la composición completa del producto, no solo los ingredientes utilizados como filtro.

---

# 5. Existencias e inventario

## CU21. Consultar inventario

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Consultar la disponibilidad de medicamentos y sus existencias.

**Criterio del listado:**

Mostrar medicamentos con al menos una existencia registrada, incluidos agotados, inactivos y vencidos. No exigir compra vinculada ni movimientos para incluir existencias iniciales o históricas. Un medicamento registrado únicamente en el catálogo no aparece en este listado; si los filtros no encuentran medicamentos con existencias, se presenta un resultado vacío. Stock bajo conserva su criterio independiente y puede incluir productos activos sin existencias.

**Información principal:**

- Medicamento.
- Código de existencia.
- Fecha de vencimiento.
- Precisión de vencimiento.
- Fecha efectiva desde la cual la existencia deja de ser vendible.
- Saldo físico.
- Stock vendible.
- Costo promedio.

---

## CU22. Consultar existencias de un medicamento

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Consultar las diferentes existencias asociadas a un medicamento.

**Consideración:**  
Un mismo medicamento puede tener varias existencias diferenciadas principalmente por vencimiento.

Un medicamento existente sin existencias devuelve una lista vacía, conservando en la interfaz su identificación y el enlace a la ficha del catálogo, así como el enlace al historial para Administrador o Regente. La identificación se consulta desde la ficha del catálogo; los saldos, vencimientos, costos y último movimiento proceden del endpoint de existencias. Un medicamento inexistente devuelve 404.

---

## CU23. Registrar ajuste de inventario

**Actor:**  
Regente.

**Objetivo:**  
Registrar diferencias encontradas durante un conteo físico.

**Condiciones:**

- La existencia debe existir.
- El ajuste no puede producir saldo negativo.
- El saldo físico y el último movimiento deben coincidir con los observados al preparar la solicitud, incluso si no existe diferencia (RN103).
- El saldo contado es entero no negativo; la observación es obligatoria. Si corresponde una entrada, se exige costo unitario positivo con hasta seis decimales.
- Se permiten existencias vencidas o de medicamentos inactivos, sin crear existencias, reactivar productos ni modificar vencimientos.

**Entrada:**

- Existencia seleccionada, saldo físico contado, stock físico observado y último movimiento observado (null si nunca tuvo movimientos).
- Observación obligatoria y costo unitario únicamente cuando corresponde una entrada. Responsable y fecha/hora no los define el cliente.

**Flujo principal:**

1. El Regente consulta la existencia y registra el conteo y la observación.
2. El sistema comprueba dentro de una transacción las precondiciones sobre la existencia bloqueada y calcula `saldoContado - saldoRegistrado`.
3. Si la diferencia es positiva, registra una entrada y calcula el promedio ponderado según RN82; si es negativa, registra una salida al promedio vigente, conservándolo según RN83.
4. Confirma el saldo, la valoración aplicable y el movimiento de forma atómica, con usuario autenticado y fecha/hora del backend.

**Casos alternativos:**

- Sin diferencia, tras comprobar precondiciones y observación, informa que no fue necesario ajustar; no modifica saldo/promedio ni genera movimiento. Registra en Bitácora únicamente el resultado sin cambios y la existencia, sin historial detallado del conteo.
- Saldo o historial desactualizado: rechaza por conflicto y exige volver a consultar la existencia.
- Existencia inexistente, entrada inválida o error: rechaza sin cambios parciales. Un daño identificado o vencimiento se registra mediante CU36 o CU35, no mediante ajuste genérico.

**Resultado:**  

- Cuando existe diferencia, se genera un movimiento de inventario de cantidad positiva y se actualiza el saldo de la existencia al contado, con valoración según RN82/RN83.
- Sin diferencia, se devuelve la conciliación sin efectos de inventario; Bitácora registra solo resultado y existencia. Su observación y respuesta no constituyen un historial persistido del conteo.
- Se conserva el historial y se cumple RN103; un ajuste efectivo es posterior para RN76, mientras la conciliación sin diferencia no agrega posteriores.

---

## CU24. Consultar movimientos de inventario

**Actor:**  
Administrador o Regente.

**Objetivo:**  
Consultar el historial de entradas y salidas de una existencia o medicamento.

**Información principal:**

- Existencia.
- Usuario responsable.
- Dirección del movimiento.
- Cantidad.
- Fecha.
- Motivo.
- Observación.
- Costo aplicado.
- Operación relacionada cuando corresponda.

---

# 6. Compras

## CU25. Registrar compra

**Actor:**  
Administrador.

**Objetivo:**  
Registrar una adquisición realizada a un proveedor o laboratorio.

**Condiciones principales:**

- El proveedor único se obtiene de los medicamentos y debe cumplir RN10 y RN33.
- Los medicamentos deben existir y estar activos.
- Los vencimientos y la fecha de adquisición deben cumplir RN29 y RN41.
- La compra debe contener al menos un detalle.
- La clave de operación no debe estar registrada previamente.

**Durante la operación el sistema debe:**

- Registrar la compra.
- Registrar sus detalles.
- Conservar el estado anterior común de cada existencia conforme a RN36.
- Identificar o crear las existencias correspondientes.
- Generar el código de existencia cuando sea necesario.
- Incrementar los saldos.
- Generar movimientos de entrada.
- Actualizar el costo promedio agrupadamente conforme a RN45.
- Calcular subtotales y total.

**Resultado:**  
La compra y todos sus efectos sobre inventario deben registrarse de forma conjunta.

---

## CU26. Consultar compras

**Actor:**  
Administrador o Regente.

**Objetivo:**  
Consultar compras registradas.

**Criterios posibles:**

- Fecha.
- Período.
- Proveedor o laboratorio.
- Estado.
- Clave de operación.

La búsqueda específica por clave devuelve únicamente operaciones del usuario autenticado. Esta búsqueda no modifica los permisos generales de consulta del Administrador y del Regente.

---

## CU27. Anular compra

**Actor:**  
Administrador.

**Objetivo:**  
Anular una compra sin eliminarla físicamente.

**Condiciones:**

- La compra debe existir.
- No debe estar anulada previamente.
- El Administrador debe indicar un motivo obligatorio.
- La reversión no puede dejar inconsistencias ni stock negativo.
- La valoración se determina por existencia mediante B1 o A, con las condiciones y límites de RN76.
- La actividad actual de medicamentos/proveedor y el vencimiento no impiden compensar una compra histórica.

**Resultado:**

- Se registra fecha, motivo y usuario responsable.
- Se generan movimientos de reversión.
- Se compensan los efectos originales.
- La compra permanece en el historial como anulada.

La anulación completa se confirma dentro de una única transacción. Si una existencia no puede compensarse, se conserva toda la compra sin cambios. Una segunda anulación se rechaza.

---

# 7. Ventas

## CU28. Registrar venta

**Actor:**  
Vendedor.

**Objetivo:**  
Preparar, guardar y confirmar la venta de medicamentos.

**Registro pendiente:**

- El Vendedor guarda la venta en estado `PENDIENTE` con sus detalles y recetas cuando correspondan.
- Los medicamentos incluidos en una nueva venta deben estar activos, conforme a RN14.
- Se calcula el total y se registra la fecha de registro, sin fecha de venta todavía.
- Las existencias indicadas en los detalles son una selección provisional.
- No se descuenta ni reserva stock ni se generan movimientos de inventario.
- Las recetas quedan vinculadas con la venta para que el Regente las revise.

**Condiciones para confirmar:**

- La venta debe estar pendiente y contener al menos un detalle.
- El medicamento debe estar activo.
- La existencia no debe estar vencida.
- Debe existir stock suficiente.
- Si el medicamento requiere receta, su detalle debe estar respaldado por una receta de esa misma venta aprobada por el Regente.

**Durante la confirmación, realizada por el Vendedor:**

- El sistema vuelve a verificar stock, vencimientos y recetas y selecciona las existencias vendibles.
- Se priorizan las existencias con vencimiento más próximo.
- Si se requieren varias existencias, se finalizan detalles separados y se conserva la relación con las recetas correspondientes.
- Se calculan subtotales y total.
- Se registra la fecha de venta y se cambia el estado a `CONFIRMADA`.
- Se generan movimientos de salida.
- Se actualizan los saldos.

**Resultado:**  
La confirmación y sus efectos sobre inventario se registran de forma conjunta mediante una transacción. Si falla, la venta sigue pendiente y no quedan cambios parciales de la confirmación.

**Flujo alternativo:**

Si una receta necesaria está pendiente o rechazada, la venta permanece pendiente y no puede confirmarse ni descontar inventario.

---

## CU29. Consultar ventas

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Consultar ventas registradas.

**Criterios posibles:**

- Fecha.
- Período.
- Usuario responsable.
- Estado.

Se distinguen la fecha de registro y la fecha de venta efectiva, así como las ventas pendientes, confirmadas y anuladas.

---

## CU30. Anular venta

**Actor:**  
Administrador.

**Objetivo:**  
Anular una venta conservando su historial.

**Condiciones:**

- La venta debe existir.
- No debe estar previamente anulada.

**Resultado:**

- Se registra fecha, motivo y responsable.
- Si la venta estaba confirmada, se generan movimientos inversos y las unidades correspondientes regresan al inventario.
- Si estaba pendiente, se anula sin movimientos de reversión ni cambios de saldo.
- La venta queda marcada como anulada.

---

# 8. Recetas

## CU31. Registrar receta

**Actor:**  
Regente o Vendedor.

**Objetivo:**  
Registrar una receta utilizada para respaldar medicamentos que requieren prescripción.

**Información principal:**

- Número.
- Fecha.
- Datos del paciente.
- Datos del médico.
- Archivo adjunto.
- Modalidad.

**Resultado:**  
La receta queda vinculada con la venta pendiente correspondiente, mediante `id_venta` obligatorio, y disponible para revisión antes de la confirmación de la venta.

---

## CU32. Revisar receta

**Actor:**  
Regente.

**Objetivo:**  
Registrar la revisión de una receta.

**El sistema debe conservar:**

- Resultado de la revisión.
- Usuario validador.
- Fecha de validación.
- Observación.

**Resultado:**  
La receta puede quedar aprobada o rechazada. Su revisión no descuenta inventario ni confirma automáticamente la venta. El Vendedor confirma cuando se cumplen las condiciones de CU28.

---

# 9. Vencimientos y retiros

## CU33. Consultar productos próximos a vencer

**Actor:**  
Administrador o Regente.

**Objetivo:**  
Identificar existencias próximas a vencer.

**Condición:**  
Se consideran próximas a vencer aquellas con saldo físico positivo, todavía no vencidas, cuya fecha normalizada de etiqueta esté comprendida entre la fecha comercial actual y los próximos tres meses calendario, conforme a RN85.

---

## CU34. Consultar productos vencidos

**Actor:**  
Administrador o Regente.

**Objetivo:**  
Identificar existencias vencidas que todavía tengan saldo físico.

**Resultado:**  
Se muestran las unidades vencidas pendientes de retiro.

---

## CU35. Registrar retiro por vencimiento

**Actor:**  
Regente.

**Objetivo:**  
Registrar la salida física de medicamentos vencidos.

**Condiciones:**

- La existencia debe estar vencida.
- Debe existir saldo físico suficiente.
- Debe ser una existencia registrada y la cantidad debe ser un entero positivo.
- Saldo físico y último movimiento deben coincidir con los observados al preparar la solicitud (RN103).
- El vencimiento efectivo se determina según DIA/MES y el día comercial America/La_Paz de RN29; MES vence desde el primer día del mes siguiente.
- Se permite el retiro aunque el medicamento esté inactivo. La observación es opcional.

**Entrada:**

- Existencia, cantidad a retirar, stock físico observado y último movimiento observado (null si nunca tuvo movimientos).
- Observación opcional. Responsable, fecha/hora, costo aplicado y pérdida los determina el backend.

**Flujo principal:**

1. El Regente consulta la existencia y proporciona cantidad y, opcionalmente, observación.
2. El sistema inicia una transacción, bloquea la existencia y comprueba las precondiciones.
3. Con el instante comercial posterior a los bloqueos verifica el vencimiento efectivo y el saldo suficiente.
4. Calcula la salida al promedio vigente, admitido cero, conserva el promedio almacenado y deriva la pérdida conforme a RN91.
5. Confirma atómicamente la disminución del saldo y el movimiento de salida con responsable y fecha/hora del backend.

**Casos alternativos:**

- Saldo o historial desactualizado, existencia no vencida o stock insuficiente: rechaza por conflicto sin efectos.
- Existencia inexistente, entrada inválida o error: rechaza sin cambios parciales.

**Resultado:**

- Se genera un movimiento de salida.
- Se disminuye el saldo físico.
- Se conserva el costo aplicado.
- Se presenta la pérdida derivada del movimiento con dos decimales, sin columna adicional.
- Se conserva el promedio incluso al agotar la existencia, y no se modifica el vencimiento ni se elimina el historial. El retiro es posterior para RN76 y puede condicionar la anulación de una compra.

---

## CU36. Registrar retiro por daño

**Actor:**  
Regente.

**Objetivo:**  
Registrar la salida de unidades que ya no pueden utilizarse por daño.

**Condición:**  
Debe existir saldo suficiente.

- La existencia debe estar registrada y la cantidad debe ser un entero positivo.
- Saldo físico y último movimiento deben coincidir con los observados al preparar la solicitud (RN103).
- La observación del daño es obligatoria.
- No se exige vencimiento: se admiten existencias vencidas y medicamentos inactivos, sin cambiar vencimientos o reactivar productos.

**Entrada:**

- Existencia, cantidad dañada a retirar, stock físico observado y último movimiento observado (null si nunca tuvo movimientos).
- Observación obligatoria. Responsable, fecha/hora, costo aplicado y pérdida los determina el backend.

**Flujo principal:**

1. El Regente identifica las unidades dañadas y registra cantidad y observación.
2. El sistema inicia una transacción, bloquea la existencia y comprueba las precondiciones y el saldo suficiente.
3. Calcula la salida al promedio vigente, admitido cero, conserva el promedio almacenado y deriva la pérdida conforme a RN91.
4. Confirma atómicamente la disminución del saldo y el movimiento por daño, con responsable y fecha/hora del backend.

**Casos alternativos:**

- Saldo o historial desactualizado o stock insuficiente: rechaza por conflicto sin efectos.
- Existencia inexistente, cantidad inválida, observación ausente o error: rechaza sin cambios parciales.

**Resultado:**

- Se genera un movimiento de salida.
- Se actualiza el saldo.
- Se conserva el costo aplicado.
- Se presenta la pérdida derivada con dos decimales, sin columna adicional, diferenciada de vencimientos y ajustes negativos.
- Se conserva el promedio incluso al agotar la existencia y el historial original. El retiro es posterior para RN76 y puede condicionar la anulación de una compra.

---

# 10. Stock bajo

## CU37. Consultar medicamentos con stock bajo

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Identificar medicamentos cuya cantidad disponible necesita reposición.

**El sistema debe:**

- Considerar únicamente medicamentos activos.
- Calcular el stock vendible total del medicamento.
- Compararlo con su stock mínimo.

**Condición:**

```text
stockVendible <= stockMinimo
```

**Resultado:**  
Se muestran los medicamentos considerados con stock bajo.

---

# 11. Reportes y consultas

## CU38. Consultar reporte de ventas

**Actor:**  
Administrador.

**Objetivo:**  
Consultar las ventas realizadas por día, mes o período.

**Consideración:**

Se utiliza la fecha de confirmación y se distinguen las ventas confirmadas de las pendientes y anuladas. Las pendientes no se contabilizan como ventas realizadas.

---

## CU39. Consultar reporte de compras

**Actor:**  
Administrador.

**Objetivo:**  
Consultar las compras realizadas por día, mes o período.

---

## CU40. Consultar historial de inventario

**Actor:**  
Administrador o Regente.

**Objetivo:**  
Consultar la trazabilidad histórica del inventario.

**Debe incluir:**

- Entradas.
- Salidas.
- Ajustes.
- Retiros.
- Reversiones.
- Usuario responsable.
- Fecha.
- Motivo.
- Operación de origen cuando corresponda.

---

## CU41. Consultar pérdidas

**Actor:**  
Administrador o Regente.

**Objetivo:**  
Consultar pérdidas producidas por vencimiento o daño.

**El sistema debe calcularlas utilizando:**

```text
cantidad retirada × costo unitario aplicado
```

Las pérdidas se obtienen de los movimientos registrados y no requieren una tabla independiente.

---

# 12. Relaciones importantes entre casos de uso

- Crear, modificar, consultar y activar/desactivar usuarios requiere autenticación y autorización de Administrador.
- Registrar una compra implica actualizar existencias, generar movimientos de entrada y actualizar el costo promedio.
- Guardar una venta pendiente conserva sus detalles y recetas sin afectar inventario; confirmarla implica volver a consultar stock vendible, seleccionar existencias y generar movimientos de salida.
- Cuando existen varias existencias de un medicamento, la venta prioriza la existencia vendible que vence primero.
- Confirmar una venta puede requerir que el Regente apruebe las recetas previamente vinculadas con la venta pendiente.
- Anular una compra o venta confirmada genera movimientos de reversión en lugar de eliminar los movimientos originales. Anular una venta pendiente no genera reversiones.
- Registrar un ajuste modifica el saldo mediante `MovimientoInventario`.
- Registrar un retiro por vencimiento o daño genera un movimiento de salida y permite calcular la pérdida.
- Consultar productos próximos a vencer, vencidos o con stock bajo se realiza a partir de los datos actuales de `Medicamento` y `ExistenciaMedicamento`.
- Las alertas no requieren una tabla `Alerta`.
- Los reportes no requieren una tabla `Reporte`.
- Las existencias no se eliminan cuando su saldo llega a cero, porque deben conservar su relación con compras, ventas y movimientos históricos.
- Todas las operaciones que afecten simultáneamente una operación, sus detalles, movimientos y saldos deben ejecutarse de forma transaccional para evitar cambios parciales.

---

# 13. Relación con el resto de la documentación

Estos casos de uso deben interpretarse junto con:

```text
docs/ai/contexto-maestro.md
docs/ai/requerimientos.md
docs/ai/reglas-negocio.md
```

Antes de implementar un caso de uso:

1. Revisar sus requerimientos relacionados.
2. Revisar las reglas de negocio que aplican.
3. Mantener las decisiones del `contexto-maestro.md`.
4. No convertir un caso de uso en una simple pantalla o botón.
5. No omitir condiciones o resultados definidos para simplificar la implementación.
6. Si una necesidad nueva contradice un caso de uso existente, señalar la contradicción antes de modificarlo.

---

# 14. Bitácora

**Estado del módulo:** captura y API implementadas en backend (Fases 1–6). Frontend implementado: acceso del Administrador, listado, filtros con Buscar, paginación del servidor 25/50/100, criterios en URL para recarga/Atrás/Adelante y detalle histórico con retorno conservando consulta. Las cuatro entregas frontend están completas; Fase 4 aprobó 14 pruebas integradas React/Express/MySQL 8.0.46 en una base local nueva conservada. La evidencia de aceptación, matriz de endpoints y pendientes operativos se registran en `bitacora-auditoria.md`. La puesta en funcionamiento exige aplicar la migración en destino.

## CU42. Consultar bitácora del sistema

**Actor:**

Administrador.

**Objetivo:**

Consultar e investigar los eventos de autenticación, seguridad y operaciones relevantes del sistema, identificando qué ocurrió, cuándo, sobre qué registro y con qué resultado, con los datos de responsabilidad disponibles.

**Precondiciones:**

- Sesión válida de una cuenta activa con rol Administrador.
- Módulo Bitácora implementado y almacenamiento de auditoría disponible. Puede no haber eventos para los criterios solicitados.

**Información principal:**

- Identificador, tipo de evento, módulo y operación.
- Fecha y hora del servidor, resultado y causa sanitizada.
- Responsable autenticado cuando exista; cuenta objetivo o nombre ingresado cuando corresponda, sin atribuir un intento fallido al titular de esa cuenta.
- Rol cuando esté comprobado y sea pertinente.
- Dirección IP y procedencia de su captura, sin considerarla prueba de identidad personal.
- Registro afectado y referencias de la operación, cuando existan.
- Contador de intentos y datos del bloqueo cuando correspondan al evento, sin secretos.

**Flujo principal:**

1. El Administrador solicita consultar la bitácora.
2. El backend comprueba autenticación y autorización de Administrador.
3. El sistema muestra una página del historial, ordenada de más reciente a más antiguo y con un desempate estable por identificador.
4. El Administrador puede combinar filtros de período, responsable o cuenta objetivo, nombre ingresado, IP, módulo, operación, tipo de evento, resultado o registro afectado. El sistema valida los criterios y devuelve los eventos coincidentes y el total correspondiente, sin cargar todo el historial.
5. El Administrador navega por los resultados y selecciona un evento.
6. El sistema vuelve a comprobar el acceso y muestra su detalle permitido, incluidas las referencias disponibles, sin modificarlo ni mostrar datos sensibles.

**Casos alternativos y errores:**

- Sin eventos coincidentes: muestra un resultado vacío, no un error.
- Filtros, período o paginación inválidos: rechaza la consulta e informa cómo corregirla, sin detalles internos.
- Evento inexistente: informa que no fue encontrado, después de comprobar autorización.
- Sesión ausente, inválida o expirada: rechaza por falta de autenticación; no equivale a un logout explícito.
- Regente o Vendedor: rechaza el acceso general, incluso mediante una petición directa al backend.
- Fallo de consulta o almacenamiento indisponible: informa que la consulta no pudo completarse; no presenta el fallo como ausencia de eventos.

**Resultado:**

El Administrador consulta el historial y los detalles disponibles. La consulta no cambia datos de negocio ni permite editar o eliminar eventos. Solo comprende eventos realmente capturados desde la puesta en funcionamiento; no reconstruye automáticamente auditoría de operaciones anteriores. Cada lectura CU42 materializada registra una consulta sensible posterior, sin recursión ni filtros completos; si falla exclusivamente ese registro se conserva la lectura original.

**Reglas de negocio relacionadas:**

RN117–RN121 y RN125–RN128; RN133 para la información técnica permitida. RN116–RN133 rigen el comportamiento transversal del módulo.

**Requerimientos relacionados:**

RF50–RF53, RI16 y RNF18–RNF22. Los eventos consultables proceden del registro transversal de RF43–RF49.

### Registro automático asociado a los casos de uso

Registrar un evento no es un objetivo manual del actor: es un comportamiento automático del backend asociado a los procesos existentes. Por ello no se agrega un CU interno independiente ni un CU por cada tipo de evento; filtros y detalles forman parte del objetivo de consulta de CU42.

| Procesos relacionados | Auditoría de backend | Requerimientos |
|---|---|---|
| CU01 | Login exitoso; contraseña incorrecta; tercer fallo y bloqueo; intento durante el bloqueo; nombre inexistente; cuenta desactivada | RF43, RF44, RF46 |
| CU02 y solicitudes protegidas | Logout explícito; rechazo por sesión inválida o expirada y por falta de autorización, diferenciados del cierre de sesión | RF45, RF46 |
| CU08 y CU09 | Cambio propio, restablecimiento administrativo, solicitud de recuperación, rechazo o limitación, restablecimiento exitoso o fallido y problemas técnicos de envío | RF47, RF46 |
| CU03, CU06, CU07, CU10, CU12, CU13 y escrituras de CU14/CU16–CU19 | Altas, modificaciones, cambios de estado y cambios de composición; responsable y registro afectado | RF48 |
| CU23, CU25, CU27, CU35 y CU36 | Ajustes, registro/anulación de compra y retiros, con resultado y referencias a operaciones y movimientos existentes | RF49 |
| CU28, CU30, CU31 y CU32 | Integración futura del registro y confirmación de venta, anulación, registro y revisión de recetas | RF49 |

Los procesos de autenticación, administración, catálogo, compras, ajustes y retiros indicados están integrados con Bitácora. Ventas y Recetas conservan su estado funcional pendiente. Los éxitos de CU04/CU05 y CU42 se auditan como consultas sensibles; los éxitos rutinarios del catálogo/inventario y `/auth/me` se excluyen. Sus rechazos y errores relevantes recibidos por el backend conservan captura transversal.

CU23 registra el resultado sin cambios según RF49/RN129, sin crear un movimiento, un historial detallado de conteos ni alterar las precondiciones y valoración actuales. No guarda la observación ni el conteo de esa conciliación. La bitácora complementa, pero no sustituye, CU24/CU40 ni el historial de compras y futuras ventas.
