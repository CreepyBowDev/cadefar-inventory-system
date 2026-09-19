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

## RF10. Gestionar proveedores o laboratorios

El sistema debe permitir registrar, consultar, modificar y activar o desactivar proveedores o laboratorios.

## RF11. Gestionar medicamentos

El sistema debe permitir registrar, consultar, buscar, modificar y activar o desactivar medicamentos.

## RF12. Gestionar principios activos

El sistema debe permitir registrar, consultar, modificar y activar o desactivar principios activos.

## RF13. Gestionar composición de medicamentos

El sistema debe permitir relacionar medicamentos con sus principios activos, cantidades y unidades correspondientes.

## RF14. Consultar medicamentos por composición

El sistema debe permitir buscar medicamentos según sus principios activos o composición.

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

## RF24. Seleccionar existencias para venta

El sistema debe utilizar primero las existencias vendibles con vencimiento más próximo.

## RF25. Consultar ventas

El sistema debe permitir consultar ventas por fecha, usuario, estado y período.

## RF26. Anular ventas

El sistema debe permitir anular ventas conservando su historial y compensando sus efectos sobre el inventario.

## RF27. Registrar recetas

El sistema debe permitir registrar recetas asociadas a una venta cuando los medicamentos lo requieran.

## RF28. Revisar recetas

El sistema debe permitir que un usuario autorizado registre la revisión, aprobación o rechazo de una receta.

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

## RF36. Consultar reportes de compras

El sistema debe permitir consultar compras por día, mes o período.

## RF37. Consultar historial de inventario

El sistema debe permitir consultar los movimientos históricos del inventario.

## RF38. Consultar pérdidas

El sistema debe permitir consultar pérdidas por vencimiento o daño, valorizadas según el costo aplicado en los movimientos.

## RF39. Mantener trazabilidad

El sistema debe identificar al usuario responsable de las operaciones registradas.

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

Permitir consultar:

- Medicamentos asociados.
- Compras realizadas a cada proveedor o laboratorio.

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

- Fecha y hora.
- Usuario responsable.
- Estado.
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
