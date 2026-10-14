# CADEFAR — Requerimientos del Sistema

> Este archivo contiene los requerimientos completos del sistema CADEFAR.
>
> Forma parte de la documentación ubicada en:
>
> `docs/ai/`
>
> Debe utilizarse junto con:
>
> - `contexto-maestro.md`
> - `reglas-negocio.md`
> - `casos-uso.md`

---

# 1. Requerimientos funcionales

## RF01. Iniciar sesión

El sistema debe permitir que un usuario inicie sesión mediante nombre de usuario y contraseña.

Después de tres intentos fallidos consecutivos para una cuenta existente y activa, el sistema debe impedir nuevos inicios de sesión durante diez minutos. Un inicio de sesión exitoso debe reiniciar el contador de intentos fallidos.

## RF02. Cerrar sesión

El sistema debe permitir cerrar sesión eliminando la cookie de autenticación correspondiente.

## RF03. Autenticar usuarios

El sistema debe verificar el token JWT almacenado en una cookie HttpOnly antes de permitir el acceso a rutas protegidas.

## RF04. Autorizar por rol

El sistema debe restringir las operaciones según el rol del usuario autenticado.

Los roles definidos son:

- Administrador.
- Regente.
- Vendedor.

## RF05. Crear usuarios

El sistema debe permitir al Administrador crear nuevos usuarios, asignándoles un rol y almacenando la contraseña de forma protegida.

## RF06. Consultar usuarios

El sistema debe permitir al Administrador listar usuarios y consultar sus datos principales y rol.

## RF07. Modificar usuarios

El sistema debe permitir al Administrador modificar los datos permitidos de una cuenta de usuario.

## RF08. Activar o desactivar usuarios

El sistema debe permitir al Administrador cambiar el estado de una cuenta sin eliminarla físicamente.

## RF09. Cambiar contraseña

El sistema debe permitir cambiar la contraseña de un usuario, almacenando únicamente su hash.

Toda contraseña nueva debe tener entre 8 y 100 caracteres e incluir al menos una letra mayúscula, una letra minúscula, un número y un carácter especial.

Además debe respetar un máximo de 72 bytes UTF-8 para bcrypt, sin truncarse ni normalizarse. La política se comparte entre creación, CU08 y CU09; login y comprobación de contraseña actual conservan compatibilidad con hashes históricos.

## RF10. Gestionar proveedores o laboratorios

El sistema debe permitir registrar, consultar, modificar y activar o desactivar proveedores o laboratorios.

## RF11. Gestionar medicamentos

El sistema debe permitir registrar, consultar, buscar, modificar y activar o desactivar medicamentos.

El Regente registra el medicamento y su composición no vacía en una sola operación atómica. El código se genera automáticamente conforme a RN13 y es inmutable desde la creación; no se admite como entrada del alta ni de la edición y no se regenera al cambiar el nombre.

El sistema debe impedir duplicados de identidad comercial y composición completa conforme a RN13, incluidos los que coincidan con medicamentos inactivos. La protección comprende el registro, la edición comercial y las operaciones de composición, también ante solicitudes concurrentes. Un conflicto devuelve 409 sin cambios parciales y permite consultar las referencias públicas del registro existente. Los históricos no se fusionan ni eliminan automáticamente.

La edición normal no modifica estado. Desde el primer movimiento de inventario asociado a alguna existencia del medicamento, se bloquean cambios efectivos de proveedor/laboratorio, forma farmacéutica, presentación, unidad de inventario, vía de administración y tipo de liberación. Nombre comercial, stock mínimo y condición de venta siguen siendo editables, sujetos a RN13. Un cambio real de identidad requiere registrar otro medicamento.

## RF12. Gestionar principios activos

El sistema debe permitir registrar, consultar, modificar y activar o desactivar principios activos.

## RF13. Gestionar composición de medicamentos

El sistema debe permitir relacionar medicamentos con sus principios activos, cantidades y unidades correspondientes.

La composición inicial es obligatoria y se envía junto con el medicamento, con al menos un componente y sin principios repetidos. La interfaz permite agregar, editar y retirar componentes del borrador antes de enviar un único POST; mantiene el borrador ante un error y muestra el código confirmado tras el éxito. La validación definitiva pertenece al backend.

Antes de existir movimientos del medicamento, el Regente puede agregar relaciones, editar cantidades y unidades y retirar relaciones físicamente. La corrección de un principio activo incorrecto se realiza retirando la relación y creando la correcta. Desde el primer movimiento, toda la composición queda bloqueada, incluida la incorporación de nuevos ingredientes.

Cada modificación debe validar la identidad comercial y la composición completa resultante conforme a RN13/RN16. Se permite completar históricos sin composición cuando no tienen movimientos y el resultado no es duplicado; la obligación de composición no vacía del alta no elimina ni transforma esos históricos.

## RF14. Consultar medicamentos por composición

El sistema debe permitir buscar medicamentos según sus principios activos o composición.

Cuando se soliciten varios principios activos, el medicamento debe contener todos ellos (AND). Puede contener otros ingredientes; no se exige igualdad exacta de conjuntos ni se establece equivalencia terapéutica.

## RF15. Gestionar existencias

El sistema debe permitir registrar y consultar existencias de medicamentos diferenciadas por vencimiento.

## RF16. Generar código de existencia

El sistema debe generar automáticamente un código único para cada existencia a partir del código del medicamento y un correlativo propio.

Ejemplo:

```text
PAR001-001
PAR001-002
PAR001-003
```

## RF17. Consultar stock físico

El sistema debe permitir consultar la cantidad física existente de cada medicamento y de cada existencia.

El listado de Inventario debe incluir únicamente medicamentos con al menos una existencia registrada. Crear un medicamento en el catálogo no lo incorpora a este listado. Se conservan los medicamentos con existencias agotadas, vencidas o de productos inactivos, así como existencias iniciales o históricas sin compra vinculada, conforme a RN18 y RN24. La consulta de Stock bajo mantiene su criterio independiente y puede incluir productos activos sin existencias.

## RF18. Consultar stock vendible

El sistema debe permitir consultar el stock realmente disponible para venta, excluyendo existencias vencidas y considerando stock vendible cero para medicamentos inactivos, conforme a RN28 y RN29.

## RF19. Registrar ajustes de inventario

El sistema debe permitir registrar ajustes derivados de diferencias detectadas durante conteos físicos.

El Regente proporciona el saldo físico contado, incluido cero, y una observación obligatoria; el sistema calcula diferencia, dirección y cantidad conforme a RN26 y RN82–RN84. Una entrada requiere costo positivo y actualiza el promedio ponderado; una salida aplica el promedio vigente y lo conserva. Sin diferencia se informa que no fue necesario ajustar, sin movimiento ni modificación de saldo/promedio ni historial detallado del conteo. Bitácora registra exclusivamente el resultado sin cambios y la existencia conforme a RF49/RN129.

Se comprueban las precondiciones de saldo e historial de RN103 incluso sin diferencia. Se admiten existencias registradas vencidas o de medicamentos inactivos, sin reactivación ni cambio de vencimiento; los daños identificados y vencimientos se registran mediante RF30/RF31.

## RF20. Registrar compras

El sistema debe permitir registrar compras realizadas a proveedores o laboratorios, incluyendo sus detalles, cantidades y costos.

## RF21. Consultar compras

El sistema debe permitir consultar compras por fecha, proveedor, estado y período.

## RF22. Anular compras

El sistema debe permitir anular compras conservando su historial y compensando sus efectos sobre el inventario.

La operación corresponde al Administrador, registra un motivo obligatorio y aplica la valoración por existencia de RN76 de forma atómica conforme a RN80. Conserva los originales y evita una segunda anulación.

## RF23. Registrar ventas

El sistema debe permitir registrar ventas con sus detalles, cantidades, precios y existencias utilizadas.

El Vendedor debe poder guardar la venta en estado `PENDIENTE` junto con sus recetas para su revisión por el Regente, sin descontar ni reservar stock ni generar movimientos. El Vendedor podrá confirmarla cuando se cumplan las condiciones de venta y todas las recetas requeridas estén aprobadas.

La confirmación debe volver a validar disponibilidad, vencimientos y FEFO, finalizar la asignación de existencias en los detalles y registrar la fecha de venta y sus efectos sobre inventario de forma atómica.

## RF24. Seleccionar existencias para venta

El sistema debe utilizar primero las existencias vendibles con vencimiento más próximo.

## RF25. Consultar ventas

El sistema debe permitir consultar ventas por fecha, usuario, estado y período.

Debe distinguir la fecha de registro de una venta pendiente de la fecha en que se confirmó su venta.

## RF26. Anular ventas

El sistema debe permitir anular ventas conservando su historial y compensando sus efectos sobre el inventario.

La anulación de una venta pendiente conserva fecha, motivo y responsable, pero no genera movimientos de reversión porque todavía no descontó inventario.

## RF27. Registrar recetas

El sistema debe permitir registrar recetas asociadas a una venta cuando los medicamentos lo requieran.

La venta debe guardarse como pendiente para que sus recetas puedan registrarse y revisarse antes de confirmarla. `id_venta` es obligatorio en la receta.

## RF28. Revisar recetas

El sistema debe permitir que un usuario autorizado registre la revisión, aprobación o rechazo de una receta.

La revisión corresponde al Regente. Una revisión pendiente o rechazada impide confirmar los detalles de venta que requieren esa receta.

## RF29. Consultar movimientos de inventario

El sistema debe permitir consultar el historial de entradas, salidas, ajustes, retiros y reversiones.

## RF30. Registrar retiros por vencimiento

El sistema debe permitir registrar la salida de unidades vencidas y conservar su pérdida valorizada.

La operación corresponde al Regente sobre una existencia registrada, con cantidad positiva, saldo suficiente y precondiciones vigentes. Comprueba el vencimiento efectivo DIA/MES según RN29 y RN88, con observación opcional. Aplica el promedio vigente y conserva ese costo en el movimiento; la pérdida se deriva conforme a RN91/RN92, sin almacenarla en una columna adicional. La inactividad del medicamento no impide el retiro.

## RF31. Registrar retiros por daño

El sistema debe permitir registrar la salida de unidades dañadas y conservar su pérdida valorizada.

La operación corresponde al Regente sobre una existencia registrada, con cantidad positiva, saldo suficiente, observación obligatoria y precondiciones vigentes. Puede realizarse aunque la existencia esté vencida o el medicamento inactivo, conforme a RN89. Aplica el promedio vigente y conserva ese costo en el movimiento; la pérdida se deriva según RN91/RN92, separada de los ajustes negativos y retiros por vencimiento.

## RF32. Consultar productos próximos a vencer

El sistema debe mostrar existencias con saldo físico positivo, todavía no vencidas, cuya fecha normalizada de etiqueta esté comprendida entre la fecha comercial actual y los próximos tres meses calendario, conforme a RN85.

## RF33. Consultar productos vencidos

El sistema debe mostrar existencias vencidas que todavía tengan saldo físico pendiente de retiro.

## RF34. Consultar stock bajo

El sistema debe mostrar medicamentos activos cuyo stock vendible sea menor o igual al stock mínimo definido.

## RF35. Consultar reportes de ventas

El sistema debe permitir consultar ventas por día, mes o período.

Los reportes de ventas realizadas deben utilizar la fecha de confirmación y distinguir las operaciones pendientes y anuladas de las ventas confirmadas.

## RF36. Consultar reportes de compras

El sistema debe permitir consultar compras por día, mes o período.

## RF37. Consultar historial de inventario

El sistema debe permitir consultar los movimientos históricos del inventario.

## RF38. Consultar pérdidas

El sistema debe permitir consultar pérdidas por vencimiento o daño, valorizadas según el costo aplicado en los movimientos.

## RF39. Mantener trazabilidad

El sistema debe identificar al usuario responsable de las operaciones registradas.

## RF40. Solicitar recuperación de contraseña por correo

El sistema debe permitir al Administrador, Regente o Vendedor solicitar la recuperación de una contraseña olvidada desde la pantalla de inicio de sesión, indicando el correo electrónico asociado a su cuenta.

No se debe requerir iniciar sesión ni conocer la contraseña anterior. El sistema debe enviar un código temporal de verificación al correo asociado, sin revelar en la respuesta pública si el correo pertenece a una cuenta registrada.

## RF41. Verificar código de recuperación

El sistema debe permitir proporcionar el código recibido y verificar que corresponda a la recuperación solicitada, sea válido, no esté vencido y no haya sido utilizado.

No se debe permitir establecer una nueva contraseña sin superar la verificación correspondiente.

## RF42. Restablecer contraseña después de la verificación

El sistema debe permitir establecer una nueva contraseña después de verificar el código de recuperación, aplicando la política de complejidad de RF09 y almacenando únicamente su hash.

El restablecimiento exitoso debe invalidar el código utilizado y los demás códigos de recuperación anteriores correspondientes a la cuenta, reiniciar los intentos fallidos y eliminar el bloqueo temporal de inicio de sesión, sin activar una cuenta desactivada administrativamente.

La recuperación de CU09 es independiente del cambio propio y del restablecimiento administrativo de CU08; no los reemplaza.

### Bitácora de auditoría — backend implementado

RF43–RF53 incorporan el módulo solicitado para Sistemas de Información I. Su captura automática y API CU42 están implementadas en backend, conforme a RN116, con información de RI16 y sin alterar las políticas vigentes. La puesta en funcionamiento requiere la migración en destino. La evidencia de aceptación se mantiene en `bitacora-auditoria.md`; Ventas/Recetas permanecen pendientes. Frontend incorpora acceso, listado, filtros explícitos, paginación 25/50/100 con criterios en URL y detalle histórico; las cuatro entregas están completas con aceptación integrada local React/Express/MySQL aprobada en Fase 4.

## RF43. Auditar inicios de sesión

El sistema debe conservar un evento por cada resultado de inicio de sesión: exitoso, contraseña incorrecta, usuario inexistente o acceso rechazado por cuenta desactivada. Debe registrar fecha/hora, IP y resultado; usuario, identificador y rol cuando estén comprobados y sean pertinentes; nombre de usuario ingresado y contador consecutivo cuando correspondan.

Un nombre inexistente no requiere un identificador válido ni un contador de cuenta. La información de auditoría no debe agregarse a las respuestas públicas ni permitir enumerar cuentas; se conserva la respuesta genérica para nombre inexistente o contraseña incorrecta. Relaciones: CU01; RN117–RN121 y RN125.

## RF44. Auditar bloqueo temporal de inicio de sesión

El sistema debe conservar el intento incorrecto que desencadena el bloqueo y un evento diferenciado del bloqueo producido, relacionados como parte de la misma solicitud. Debe conservar el contador correspondiente, instante del bloqueo, duración de diez minutos definida por RN07 y fecha/hora de finalización prevista.

También debe registrar cada intento recibido durante un bloqueo vigente sin confundirlo con otra contraseña comprobada ni con un nuevo bloqueo. La auditoría observa RN07, no cambia umbral, duración, reinicios ni efectos sobre sesiones. Relaciones: CU01; RN122, RN123 y RN131.

## RF45. Auditar cierre de sesión y rechazos de sesión

El sistema debe registrar el logout explícito completado mediante `POST /api/auth/logout`, con responsable autenticado, fecha/hora, IP y resultado. Una solicitud de logout rechazada por autenticación no se debe registrar como cierre exitoso.

Los rechazos por token inválido, expirado o credenciales de sesión desactualizadas son eventos diferentes. Solo pueden observarse cuando el backend recibe una solicitud y detecta esa condición; no se afirma capturar el instante exacto de expiración sin solicitud, ni el cierre de pestaña o navegador. Relaciones: CU02 y rutas protegidas; RN118, RN124 y RN131.

## RF46. Auditar errores y denegaciones de autenticación y acceso

El sistema debe distinguir credenciales incorrectas, cuenta desactivada, bloqueo, falta de autorización, errores de validación y errores técnicos del servidor. Debe registrar contexto mínimo de operación, categoría o código seguro, fecha/hora, IP y resultado, incluida la información disponible cuando la validación o autenticación falla antes del Controller.

La categoría no debe deducirse únicamente del estado HTTP: actualmente tanto el tercer fallo de login como un intento durante el bloqueo producen 423. Deben poder investigarse fallos internos, de conexión y otros errores técnicos recibidos por el backend sin copiar errores completos ni secretos. Un fallo de red que impide que la petición llegue al servidor no puede garantizarse como evento capturado. Relaciones: CU01, CU02, CU08, CU09 y controles de acceso; RN118, RN121, RN125, RN132 y RN133.

## RF47. Auditar recuperación y modificación de contraseñas

El sistema debe registrar solicitud de recuperación, solicitud rechazada o suprimida por límites o condiciones de cuenta, restablecimiento exitoso o fallido, cambio propio y restablecimiento administrativo, distinguiendo responsable autenticado y cuenta objetivo cuando corresponda.

Debe diferenciar la emisión de una recuperación y el resultado técnico del intento de envío: aceptación, rechazo o resultado incierto del proveedor no prueban entrega al buzón ni restablecimiento de contraseña. La respuesta genérica de recuperación tampoco prueba que se haya emitido un código. Se conservan los límites, respuestas públicas y efectos actuales de CU08/CU09 y RN107–RN115, sin almacenar contraseñas, hashes, códigos, HMAC de recuperación, JWT o cookies. Relaciones: RN117, RN118, RN121, RN125, RN130 y RN133.

## RF48. Auditar operaciones administrativas y de catálogo

El sistema debe registrar las altas, modificaciones y cambios de estado de usuarios, proveedores/laboratorios, principios activos y medicamentos, así como las altas, modificaciones y retiradas permitidas de relaciones de composición. Debe distinguir asignación o cambio de rol de una cuenta de una gestión dinámica de roles, que no existe en el alcance actual.

Debe conservar operación, responsable autenticado, registro afectado, fecha/hora, IP y resultado exitoso, rechazado o fallido. Para cambios efectivos debe identificar los campos permitidos afectados y un resumen mínimo sanitizado, sin copiar registros completos ni valores sensibles. La creación integral de un medicamento comprende su composición inicial como una operación lógica. CU08 se cubre específicamente por RF47. Relaciones: CU03, CU06, CU07, CU10, CU12, CU13, CU14 y CU16–CU19; RN117, RN125 y RN129–RN133.

## RF49. Auditar operaciones críticas de negocio

El sistema debe registrar solicitudes de registro y anulación de compras, ajustes y retiros por vencimiento o daño, distinguiendo éxito confirmado, rechazo y fallo técnico. Debe conservar responsable, fecha/hora, IP, resultado y referencias pertinentes a compra, existencia y movimientos, sin sustituir esos registros ni modificar reglas de stock, valoración, reversión o concurrencia.

Una conciliación de CU23 sin diferencia debe identificarse como operación completada sin cambios de inventario, sin generar movimiento ni historial detallado de conteos. Este evento pertenece exclusivamente a Bitácora; conserva referencia a la existencia y resultado, sin snapshots, conteo ni observación. RF19/RI09 describen la ausencia de historial detallado de conteos, no la ausencia de este evento.

El registro de existencias y sus modificaciones derivadas de compras, anulaciones, ajustes y retiros se auditan dentro de sus operaciones de origen; no se presupone una edición independiente de existencias. Se prevé integrar las futuras operaciones de registro/confirmación y anulación de ventas, y registro/revisión de recetas cuando se implementen CU28, CU30, CU31 y CU32. Relaciones actuales: CU23, CU25, CU27, CU35 y CU36; RN129–RN133, sin reemplazar RN43, RN80 ni RN103/RN104.

## RF50. Consultar historial de auditoría

El sistema debe permitir al Administrador consultar los eventos persistidos, ordenados de más reciente a más antiguo con desempate estable por identificador. Sin coincidencias debe mostrar una lista vacía; un fallo de lectura debe informarse como error, no como ausencia de eventos. La consulta comprende información capturada desde la puesta en funcionamiento, sin inferir eventos históricos faltantes. Relaciones: CU42; RN126–RN128.

## RF51. Filtrar y paginar eventos de auditoría

El sistema debe permitir combinar filtros por período, responsable o cuenta objetivo, nombre ingresado, IP, módulo, operación, tipo de evento, resultado y registro afectado, y navegar por páginas acotadas conservando los criterios. Debe validar rango temporal y paginación y devolver el total de coincidencias; los tamaños permitidos se definirán antes de implementar, sin descarga completa por defecto.

La consulta por tipo de intento fallido debe permitir conocer cuántos eventos coinciden en el período sin sumar los eventos de bloqueo como contraseñas incorrectas adicionales. La ordenación estable no implica que páginas sucesivas sean una instantánea inmutable mientras se agregan eventos. Relaciones: CU42; RN119, RN126 y RN131; RNF21.

## RF52. Consultar detalle de evento de auditoría

El sistema debe permitir al Administrador consultar un evento por su identificador y ver la información pertinente de RI16 y las referencias disponibles. Debe volver a comprobar autorización para el detalle, informar si el evento no existe y excluir datos sensibles incluso en errores. Relaciones: CU42; RN125–RN128 y RN133.

## RF53. Restringir acceso a la bitácora general

El sistema debe comprobar en el backend una sesión válida y rol Administrador para listado, filtros y detalle, conforme a los mecanismos actuales de autenticación y autorización por roles fijos. Regente y Vendedor generan eventos mediante sus operaciones, pero no pueden consultar la bitácora general. La restricción visual no sustituye la comprobación del backend. Relaciones: CU42; RN126 y RN127; RNF18/RNF19.

---

# 2. Requerimientos de información

## RI01. Usuarios y roles

Registrar:

- Identificador.
- Nombre de usuario.
- Contraseña protegida.
- Estado.
- Rol.

Conservar:

- Nombre del rol.
- Descripción.
- Estado del rol.

El sistema debe permitir identificar al responsable de cada operación.

## RI02. Proveedores y laboratorios

Conservar:

- Identificador.
- Nombre.
- Teléfono.
- Dirección.
- Estado.

## RI03. Catálogo de medicamentos

Registrar:

- Código único generado automáticamente e inmutable.
- Nombre comercial.
- Forma farmacéutica.
- Presentación.
- Unidad de inventario.
- Stock mínimo.
- Condición de venta.
- Vía de administración.
- Tipo de liberación.
- Estado.

Conservar además el proveedor/laboratorio relacionado y la composición completa. El código y las PK se generan en el servidor/base de datos; no forman parte de la identidad comercial utilizada para evitar duplicados. La entrada y salida de la API se detallan en la sección de Medicamentos del contexto maestro.

Permitir búsquedas por:

- Nombre.
- Código.

## RI04. Principios activos y composición

Registrar de los principios activos:

- Nombre.
- Descripción.
- Estado.

Relacionarlos con los medicamentos mediante:

- Cantidad del ingrediente.
- Unidad de medida.
- Cantidad de referencia.
- Unidad de referencia.

Las cantidades de composición utilizan `DECIMAL(12,4)`: valores positivos, hasta cuatro decimales y dentro de su rango. La API recibe cantidades numéricas y las devuelve como cadenas decimales para conservar la precisión del almacenamiento.

Cada relación identifica un principio activo existente; no puede repetirse su ID dentro del medicamento. Las unidades del ingrediente y de referencia admiten hasta 30 caracteres. La composición inicial se persiste junto al medicamento; el orden del arreglo y los IDs técnicos de las relaciones no intervienen en la comparación de duplicados.

## RI05. Existencias y disponibilidad

Registrar:

- Identificador.
- Código de existencia.
- Medicamento.
- Fecha de vencimiento.
- Precisión de vencimiento.
- Cantidad física.
- Costo promedio.

Permitir consultar:

- Stock físico.
- Stock vendible.

La precisión utiliza `DIA` y `MES`; el almacenamiento y la interpretación comercial de la fecha se rigen por RN29. La fecha efectiva desde la cual la existencia deja de ser vendible es información calculada y consultable, no un nuevo atributo persistido.

La consulta de existencias CU22 debe proporcionar conjuntamente el stock físico y el identificador de su último movimiento, o null si nunca hubo movimientos. Este marcador se calcula desde el historial, sin columna nueva, y permite comprobar junto con el saldo las precondiciones de ajustes y retiros de RN103. La ampliación de la consulta está implementada desde Fase 3.1 y su uso en escrituras desde Fases 3.2/3.3; la lectura coherente y las precondiciones se verificaron con concurrencia real de MySQL en Fase 3.4, según la sección de API de Fase 3.

## RI06. Compras

Registrar:

- Fecha de adquisición.
- Fecha y hora de registro.
- Proveedor o laboratorio.
- Usuario responsable.
- Estado.
- Clave de operación.
- Total.

En los detalles almacenar:

- Existencia recibida.
- Cantidad.
- Costo unitario.
- Subtotal.
- Saldo físico anterior de la existencia.
- Costo promedio anterior de la existencia.

El estado anterior se conserva conforme a RN36 para las nuevas compras. Puede no estar disponible en compras históricas; su uso en anulaciones se rige por RN76.

## RI07. Ventas

Registrar:

- Fecha y hora de registro.
- Fecha y hora de confirmación de la venta, sin valor mientras esté pendiente.
- Usuario responsable.
- Estado: `PENDIENTE`, `CONFIRMADA` o `ANULADA`.
- Total.

En los detalles almacenar:

- Existencia utilizada.
- Cantidad.
- Precio unitario.
- Subtotal.
- Receta cuando corresponda.

## RI08. Recetas

Conservar:

- Número.
- Fecha.
- Datos del paciente.
- Datos del médico.
- Archivo adjunto.
- Modalidad.
- Resultado de revisión.
- Usuario validador.
- Fecha de validación.
- Observación.

## RI09. Movimientos de inventario

Registrar:

- Existencia afectada.
- Usuario responsable.
- Dirección de entrada o salida.
- Cantidad.
- Fecha.
- Motivo.
- Observación.
- Costo unitario aplicado.
- Referencia a compra cuando corresponda.
- Referencia a venta cuando corresponda.
- Referencia a movimiento original cuando exista una reversión.

En ajustes y retiros efectivos, el responsable autenticado y la fecha/hora los determina el backend. La observación es obligatoria para ajustes y daño, y opcional para vencimiento, conforme a RN84, RN88 y RN89. El costo aplicado se conserva con seis decimales; las pérdidas de retiro se derivan y presentan según RN91, sin un atributo persistido adicional. Las conciliaciones sin diferencia no crean movimiento ni registro histórico de conteo. La atomicidad y conservación histórica se mantienen conforme a RN103/RN104 y RNF05/RNF07.

## RI10. Anulaciones

Conservar:

- Estado.
- Fecha de anulación.
- Motivo.
- Usuario responsable.
- Movimientos utilizados para compensar los efectos de la operación.

## RI11. Alertas

Mostrar información sobre:

- Existencias próximas a vencer.
- Existencias vencidas pendientes de retiro.
- Medicamentos con stock bajo.

Según corresponda, indicar:

- Producto.
- Fecha de vencimiento.
- Cantidad disponible.

## RI12. Reportes y pérdidas

Mantener consultas de:

- Compras por período.
- Ventas por período.
- Historial de inventario.
- Cantidades retiradas por vencimiento.
- Cantidades retiradas por daño.
- Pérdidas valorizadas utilizando el costo registrado en cada movimiento.

## RI13. Códigos de existencia

Conservar un código único de existencia generado automáticamente a partir del código del medicamento y un correlativo.

El código no debe reutilizarse.

## RI14. Seguridad y sesión

Conservar únicamente la información necesaria para identificar al usuario autenticado y su rol.

Las contraseñas deben almacenarse protegidas y nunca en texto plano.

## RI15. Correo y recuperación de contraseña

Para utilizar la recuperación de CU09, la cuenta debe disponer de un correo electrónico asociado.

El sistema debe conservar de manera protegida la información necesaria para vincular el código temporal con la cuenta y comprobar su validez, vencimiento, uso e intentos de verificación.

El correo es opcional, nullable y único; su asignación administrativa supervisada normaliza trim exterior/minúsculas y conserva puntos y `+`. Un cambio efectivo o retirada invalida recuperaciones, sin reiniciar cuotas. Se utilizan `recuperacion_password` (nueve atributos funcionales, HMAC y estados) y `limite_recuperacion_ip` (cuotas persistentes por ámbito/IP protegida mediante HMAC).

## RI16. Eventos de auditoría

**Estado:** implementada en `bitacora_auditoria`, modelo `BitacoraAuditoria`, con referencias lógicas sin FK ni cascadas. El contrato HTTP y los límites se describen en `bitacora-auditoria.md`.

Conservar únicamente los datos pertinentes de cada evento:

- Identificador del evento, tipo, módulo y operación.
- Fecha y hora obtenidas del servidor: UTC con milisegundos, `DATETIME(3)` y presentación ISO 8601 con `Z`.
- Resultado y causa o categoría sanitizada, distinguiendo el resultado de la solicitud del efecto persistido cuando difieran.
- Identificador y nombre del responsable autenticado, cuando exista, y rol comprobado cuando corresponda; información identificativa del momento del evento para que cambios posteriores de nombre o rol no reatribuyan el pasado.
- Cuenta objetivo cuando haya sido reconocida, diferenciada del responsable. En login fallido, nombre ingresado validado/sanitizado aunque no exista cuenta; no se exige un usuario válido ni se asume que el titular realizó el intento.
- Dirección IP obtenida por el backend y procedencia confiable de la captura; si no puede determinarse, indicar su indisponibilidad sin fabricar una dirección ni confiar en el cliente.
- Tipo e identificador del registro afectado y referencias disponibles a operación y movimientos, cuando correspondan.
- Contador consecutivo, instante, duración y finalización prevista del bloqueo, para los eventos pertinentes; datos relacionados para distinguir el fallo desencadenante del bloqueo producido.
- Campos permitidos afectados y resumen mínimo sanitizado de cambios administrativos, cuando corresponda.

No conservar contraseñas, hashes de contraseña, JWT, cookies, códigos ni HMAC de recuperación, secretos, cuerpos completos sin filtrado ni información personal innecesaria. Los datos ingresados no se consideran identidad autenticada. No se exige copiar el correo de recuperación para auditar su resultado. Relaciones: RF43–RF53; RN117–RN125, RN129–RN133 y RNF18–RNF22.

---

# 3. Requerimientos no funcionales

## RNF01. Seguridad de contraseñas

Las contraseñas deben almacenarse mediante hash seguro y nunca en texto plano.

## RNF02. Seguridad de autenticación

El sistema debe utilizar JWT firmado mediante una clave secreta almacenada en variables de entorno.

## RNF03. Protección del token

El JWT debe almacenarse en una cookie HttpOnly para impedir su lectura directa desde JavaScript del navegador.

## RNF04. Control de acceso

Las rutas protegidas deben requerir autenticación y, cuando corresponda, autorización según el rol.

## RNF05. Integridad transaccional

Las operaciones de compra, venta, anulación, ajuste y movimientos asociados deben ejecutarse de forma atómica, evitando cambios parciales.

## RNF06. Integridad de datos

La base de datos debe mantener restricciones de:

- Claves primarias.
- Claves foráneas.
- Unicidad.
- Campos obligatorios.
- Restricciones necesarias para conservar datos válidos.

## RNF07. Persistencia histórica

Las operaciones históricas no deben eliminarse físicamente cuando sean necesarias para mantener la trazabilidad.

Las anulaciones deben conservar los registros originales.

## RNF08. Disponibilidad de información

El sistema debe mantener disponibles las consultas de:

- Inventario.
- Compras.
- Ventas.
- Vencimientos.
- Movimientos.

para los usuarios autorizados.

## RNF09. Usabilidad

El sistema debe presentar una interfaz web clara y comprensible para el personal de la farmacia.

## RNF10. Rendimiento

Las operaciones habituales de consulta y registro deben responder en tiempos adecuados para el uso normal de una farmacia.

## RNF11. Mantenibilidad

El backend debe mantener separación por capas entre:

- Presentación.
- Lógica de negocio.
- Acceso a datos.
- Base de datos.

El frontend debe mantener una organización modular por funcionalidades y componentes reutilizables.

## RNF12. Configuración segura

Las credenciales de base de datos, claves JWT y otros secretos deben mantenerse en variables de entorno y no deben versionarse en el repositorio.

## RNF13. Compatibilidad web

El sistema debe funcionar como aplicación web de uso interno y permitir su acceso desde navegadores modernos.

## RNF14. Trazabilidad

Las operaciones relevantes deben conservar información suficiente para identificar:

- Qué operación fue realizada.
- Qué usuario la realizó.
- Cuándo fue realizada.
- Qué registros fueron afectados cuando corresponda.

## RNF15. Protección y confidencialidad de la recuperación

Los códigos de recuperación deben almacenarse de manera protegida, tener validez limitada y permitir un solo uso. La respuesta pública a una solicitud no debe revelar si el correo pertenece a una cuenta registrada.

La recuperación no debe debilitar los controles de autenticación, autorización ni protección de contraseñas existentes.

## RNF16. Prevención de abusos en la recuperación

El código tiene seis dígitos, diez minutos absolutos y cinco fallos máximos. Las emisiones requieren 60 segundos entre sí y se limitan a tres por cuenta en ventana móvil de 15 minutos. Se admiten 20 solicitudes y 30 restablecimientos por IP en ventanas independientes de 15 minutos. Las cuotas son persistentes y un fallo de correo no devuelve la cuota de una emisión confirmada.

El envío se intenta una sola vez fuera de transacciones MySQL, con timeout de cinco segundos, sin procesador ni reintentos automáticos. Un rechazo explícito invalida esa emisión; timeout/resultado incierto conservan su vigencia. La espera pública mínima de cinco segundos reduce diferencias evidentes, sin prometer tiempo constante.

## RNF17. Seguridad de sesiones después del restablecimiento

La implementación de CU09 debe contemplar una estrategia segura para invalidar las sesiones previamente emitidas después de un restablecimiento exitoso, de acuerdo con RN115.

Se exige `versionCredenciales` en JWT y se contrasta con `Usuario.version_credenciales`. CU08 y CU09 incrementan la versión de forma transaccional; JWT anteriores, ausentes o desactualizados se rechazan. CU08 propio renueva su cookie; CU09 no inicia sesión automáticamente. Se conserva la cookie HttpOnly y no se agrega tabla de sesiones.

### Bitácora de auditoría — backend implementado

## RNF18. Integridad y protección de registros de auditoría

Los eventos persistidos deben conservar su información histórica y no admitir edición ni eliminación mediante las operaciones ordinarias, incluida la interfaz del Administrador. Debe comprobarse que el listado y detalle no permiten escrituras y que las solicitudes no autorizadas son rechazadas en el backend. Esta protección no equivale a garantizar inviolabilidad frente a un administrador de la infraestructura. Relaciones: RF50–RF53; RN126–RN128.

## RNF19. Seguridad y privacidad de la auditoría

La captura, persistencia, consulta y diagnóstico de auditoría deben excluir los datos prohibidos por RN125 y limitarse a RI16. La verificación deberá cubrir eventos exitosos, rechazados, fallidos y errores de validación con entradas sintéticas, así como intentos de consulta sin sesión y con roles no autorizados. Ninguna respuesta pública de autenticación debe incorporar los motivos internos exclusivos de auditoría. Relaciones: RF43–RF53; RN117, RN118, RN120, RN125, RN126 y RN133.

## RNF20. Persistencia, conservación y disponibilidad de auditoría

Los eventos cuya persistencia se haya confirmado deben permanecer consultables después de reiniciar la aplicación durante un mínimo de cinco años: 60 meses calendario desde registro, o períodos legales superiores cuando correspondan. Consola y memoria temporal no cumplen por sí solas este requisito. Una consulta fallida debe distinguirse de un historial vacío. La primera versión no elimina ni archiva automáticamente; superar el mínimo no autoriza borrar. Responsabilidades, respaldo, archivo y eventual depuración extraordinaria requieren definición según RN128; el plazo técnico no acredita cumplimiento legal automático. Relaciones: RF50–RF52; RN127, RN128 y RN132.

## RNF21. Rendimiento de la captura y consulta de auditoría

La consulta debe utilizar filtros y páginas acotadas en el servidor, sin cargar el historial completo en React. La captura debe limitarse a eventos relevantes y datos mínimos, sin registrar cada renderizado ni cada petición automática. Antes de implementar se definirán tamaños permitidos de página, volumen de prueba y objetivos medibles de tiempo de respuesta para verificar captura y consultas con datos sintéticos. No se fijan cuotas de almacenamiento ni tiempos arbitrarios en esta incorporación documental. Relaciones: RF43–RF53; RN116 y RN131.

## RNF22. Fiabilidad y consistencia de la auditoría

La verificación futura debe demostrar que un rollback no deja una operación como exitosa, que los intentos fallidos y bloqueos confirmados no se pierden por confundir un rechazo HTTP con rollback, y que no se generan eventos duplicados por registrar la misma causa en distintas capas. Los fallos de escritura deben ser detectables con diagnóstico sanitizado, sin afirmar persistencia inexistente ni provocar ciclos de registro de errores. La política por proceso y el tratamiento de indisponibilidad se aprobarán antes de implementar, conforme a RN130–RN133. No se promete captura completa durante una caída del servidor o del almacenamiento. Relaciones: RF43–RF49 y RI16.

---

# 4. Relación con el resto de la documentación

Los requerimientos de este archivo deben interpretarse junto con:

```text
docs/ai/contexto-maestro.md
docs/ai/reglas-negocio.md
docs/ai/casos-uso.md
```

Antes de implementar una funcionalidad:

1. Identificar los requerimientos relacionados.
2. Revisar las reglas de negocio correspondientes.
3. Revisar los casos de uso relacionados.
4. Mantener las decisiones definidas en `contexto-maestro.md`.
5. No inventar requisitos adicionales sin una necesidad nueva.
