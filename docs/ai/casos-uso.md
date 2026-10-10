# CADEFAR — Casos de Uso del Sistema

> Este archivo contiene los casos de uso completos del sistema CADEFAR.
> El catálogo contiene 41 casos de uso, numerados consecutivamente desde CU01 hasta CU41.
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
Agregar un medicamento al catálogo.

**Datos principales:**

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
- Proveedor o laboratorio relacionado.

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
- El estado se modifica mediante CU17, no en esta edición.
- Sin movimientos de inventario pueden editarse los datos del catálogo respetando referencias y unicidad.
- Con al menos un movimiento en cualquiera de sus existencias, se bloquean cambios efectivos de código, proveedor/laboratorio, forma farmacéutica, presentación, unidad de inventario, vía de administración y tipo de liberación.
- Con historial pueden seguir modificándose nombre comercial, stock mínimo y condición de venta.
- Una corrección tipográfica del nombre no crea un nuevo medicamento. Si cambia realmente la identidad del producto, corresponde otro registro.

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

**Información principal:**

- Medicamento.
- Código de existencia.
- Fecha de vencimiento.
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

---

## CU23. Registrar ajuste de inventario

**Actor:**  
Regente.

**Objetivo:**  
Registrar diferencias encontradas durante un conteo físico.

**Condiciones:**

- La existencia debe existir.
- El ajuste no puede producir saldo negativo.

**Resultado:**  

- Se genera un movimiento de inventario.
- Se actualiza el saldo de la existencia.

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

- El proveedor o laboratorio debe existir.
- Los medicamentos deben existir.
- La compra debe contener al menos un detalle.

**Durante la operación el sistema debe:**

- Registrar la compra.
- Registrar sus detalles.
- Identificar o crear las existencias correspondientes.
- Generar el código de existencia cuando sea necesario.
- Incrementar los saldos.
- Generar movimientos de entrada.
- Actualizar el costo promedio.
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

---

## CU27. Anular compra

**Actor:**  
Administrador.

**Objetivo:**  
Anular una compra sin eliminarla físicamente.

**Condiciones:**

- La compra debe existir.
- No debe estar anulada previamente.
- La reversión no puede dejar inconsistencias ni stock negativo.

**Resultado:**

- Se registra fecha, motivo y usuario responsable.
- Se generan movimientos de reversión.
- Se compensan los efectos originales.
- La compra permanece en el historial como anulada.

---

# 7. Ventas

## CU28. Registrar venta

**Actor:**  
Vendedor.

**Objetivo:**  
Preparar, guardar y confirmar la venta de medicamentos.

**Registro pendiente:**

- El Vendedor guarda la venta en estado `PENDIENTE` con sus detalles y recetas cuando correspondan.
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
Se consideran próximas a vencer aquellas con saldo físico positivo cuyo vencimiento se encuentre entre la fecha actual y los próximos tres meses.

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

**Resultado:**

- Se genera un movimiento de salida.
- Se disminuye el saldo físico.
- Se conserva el costo aplicado.
- Se registra la pérdida correspondiente.

---

## CU36. Registrar retiro por daño

**Actor:**  
Regente.

**Objetivo:**  
Registrar la salida de unidades que ya no pueden utilizarse por daño.

**Condición:**  
Debe existir saldo suficiente.

**Resultado:**

- Se genera un movimiento de salida.
- Se actualiza el saldo.
- Se conserva el costo aplicado.
- Se registra la pérdida correspondiente.

---

# 10. Stock bajo

## CU37. Consultar medicamentos con stock bajo

**Actor:**  
Administrador, Regente o Vendedor.

**Objetivo:**  
Identificar medicamentos cuya cantidad disponible necesita reposición.

**El sistema debe:**

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
