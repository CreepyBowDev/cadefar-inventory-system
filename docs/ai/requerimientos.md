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

La edición normal no modifica estado. Desde el primer movimiento de inventario asociado a alguna existencia del medicamento, se bloquean cambios efectivos de código, proveedor/laboratorio, forma farmacéutica, presentación, unidad de inventario, vía de administración y tipo de liberación. Nombre comercial, stock mínimo y condición de venta siguen siendo editables. Un cambio real de identidad requiere registrar otro medicamento.

## RF12. Gestionar principios activos

El sistema debe permitir registrar, consultar, modificar y activar o desactivar principios activos.

## RF13. Gestionar composición de medicamentos

El sistema debe permitir relacionar medicamentos con sus principios activos, cantidades y unidades correspondientes.

Antes de existir movimientos del medicamento, el Regente puede agregar relaciones, editar cantidades y unidades y retirar relaciones físicamente. La corrección de un principio activo incorrecto se realiza retirando la relación y creando la correcta. Desde el primer movimiento, toda la composición queda bloqueada, incluida la incorporación de nuevos ingredientes.

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

## RF18. Consultar stock vendible

El sistema debe permitir consultar el stock realmente disponible para venta, excluyendo existencias vencidas.

## RF19. Registrar ajustes de inventario

El sistema debe permitir registrar ajustes derivados de diferencias detectadas durante conteos físicos.

## RF20. Registrar compras

El sistema debe permitir registrar compras realizadas a proveedores o laboratorios, incluyendo sus detalles, cantidades y costos.

## RF21. Consultar compras

El sistema debe permitir consultar compras por fecha, proveedor, estado y período.

## RF22. Anular compras

El sistema debe permitir anular compras conservando su historial y compensando sus efectos sobre el inventario.

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

## RF31. Registrar retiros por daño

El sistema debe permitir registrar la salida de unidades dañadas y conservar su pérdida valorizada.

## RF32. Consultar productos próximos a vencer

El sistema debe mostrar existencias con saldo físico positivo cuyo vencimiento se encuentre entre la fecha actual y los próximos tres meses.

## RF33. Consultar productos vencidos

El sistema debe mostrar existencias vencidas que todavía tengan saldo físico pendiente de retiro.

## RF34. Consultar stock bajo

El sistema debe mostrar medicamentos cuyo stock vendible sea menor o igual al stock mínimo definido.

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

- Código.
- Nombre comercial.
- Forma farmacéutica.
- Presentación.
- Unidad de inventario.
- Stock mínimo.
- Condición de venta.
- Vía de administración.
- Tipo de liberación.
- Estado.

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

## RI06. Compras

Registrar:

- Fecha.
- Proveedor o laboratorio.
- Usuario responsable.
- Estado.
- Total.

En los detalles almacenar:

- Existencia recibida.
- Cantidad.
- Costo unitario.
- Subtotal.

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
