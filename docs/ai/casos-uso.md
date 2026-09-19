# CADEFAR — Casos de Uso del Sistema

> Este archivo contiene los casos de uso completos del sistema CADEFAR.
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

Cuando una operación pueda ser realizada por más de un rol, se utiliza el término:

`Usuario autorizado`

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
- La contraseña debe coincidir con el hash almacenado.

**Resultado:**  
El sistema genera un JWT con `idUsuario` e `idRol` y lo almacena en una cookie HttpOnly.

---

## CU02. Cerrar sesión

**Actor:**  
Usuario autenticado.

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
- La contraseña debe cumplir las validaciones establecidas.
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
Usuario autorizado o Administrador según el mecanismo definido.

**Objetivo:**  
Modificar la contraseña de una cuenta.

**Resultado:**  
La nueva contraseña se almacena únicamente mediante su hash.

---

# 3. Proveedores y laboratorios

## CU09. Registrar proveedor o laboratorio

**Actor:**  
Usuario autorizado.

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

## CU10. Consultar proveedores o laboratorios

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Consultar los proveedores o laboratorios registrados y la información relacionada con ellos.

---

## CU11. Modificar proveedor o laboratorio

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Actualizar los datos de un proveedor o laboratorio existente.

---

## CU12. Activar o desactivar proveedor o laboratorio

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Cambiar su estado sin eliminar el registro ni perder su historial.

---

# 4. Medicamentos y composición

## CU13. Registrar medicamento

**Actor:**  
Usuario autorizado.

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

## CU14. Consultar o buscar medicamento

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Buscar medicamentos principalmente por nombre o código.

---

## CU15. Modificar medicamento

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Actualizar los datos permitidos de un medicamento existente.

---

## CU16. Activar o desactivar medicamento

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Cambiar el estado de un medicamento sin eliminarlo físicamente.

**Resultado:**  
Un medicamento inactivo conserva su historial y no puede utilizarse en operaciones que requieran un medicamento activo.

---

## CU17. Gestionar principios activos

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Registrar, consultar, modificar y activar o desactivar principios activos.

---

## CU18. Gestionar composición de medicamento

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Relacionar un medicamento con uno o más principios activos.

**Datos principales:**

- Principio activo.
- Cantidad del ingrediente.
- Unidad de medida.
- Cantidad de referencia.
- Unidad de referencia.

---

## CU19. Consultar medicamentos por composición

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Buscar medicamentos según sus principios activos o composición.

**Consideración:**  
La coincidencia de composición no significa automáticamente que un medicamento pueda sustituir a otro.

---

# 5. Existencias e inventario

## CU20. Consultar inventario

**Actor:**  
Usuario autorizado.

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

## CU21. Consultar existencias de un medicamento

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Consultar las diferentes existencias asociadas a un medicamento.

**Consideración:**  
Un mismo medicamento puede tener varias existencias diferenciadas principalmente por vencimiento.

---

## CU22. Registrar ajuste de inventario

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Registrar diferencias encontradas durante un conteo físico.

**Condiciones:**

- La existencia debe existir.
- El ajuste no puede producir saldo negativo.

**Resultado:**  

- Se genera un movimiento de inventario.
- Se actualiza el saldo de la existencia.

---

## CU23. Consultar movimientos de inventario

**Actor:**  
Usuario autorizado.

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

## CU24. Registrar compra

**Actor:**  
Usuario autorizado para compras.

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

## CU25. Consultar compras

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Consultar compras registradas.

**Criterios posibles:**

- Fecha.
- Período.
- Proveedor o laboratorio.
- Estado.

---

## CU26. Anular compra

**Actor:**  
Usuario autorizado.

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

## CU27. Registrar venta

**Actor:**  
Vendedor o usuario autorizado.

**Objetivo:**  
Registrar la venta de medicamentos.

**Condiciones principales:**

- El medicamento debe estar activo.
- La existencia no debe estar vencida.
- Debe existir stock suficiente.
- Si el medicamento requiere receta, debe existir una receta válida.

**Durante la operación:**

- El sistema selecciona las existencias vendibles.
- Se priorizan las existencias con vencimiento más próximo.
- Si se requieren varias existencias, se registran detalles separados.
- Se calculan subtotales y total.
- Se generan movimientos de salida.
- Se actualizan los saldos.

**Resultado:**  
La venta y sus efectos sobre inventario se registran de forma conjunta.

---

## CU28. Consultar ventas

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Consultar ventas registradas.

**Criterios posibles:**

- Fecha.
- Período.
- Usuario responsable.
- Estado.

---

## CU29. Anular venta

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Anular una venta conservando su historial.

**Condiciones:**

- La venta debe existir.
- No debe estar previamente anulada.

**Resultado:**

- Se registra fecha, motivo y responsable.
- Se generan movimientos inversos.
- Las unidades correspondientes regresan al inventario.
- La venta queda marcada como anulada.

---

# 8. Recetas

## CU30. Registrar receta

**Actor:**  
Usuario autorizado.

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
La receta queda vinculada con la venta correspondiente.

---

## CU31. Revisar receta

**Actor:**  
Regente o usuario autorizado.

**Objetivo:**  
Registrar la revisión de una receta.

**El sistema debe conservar:**

- Resultado de la revisión.
- Usuario validador.
- Fecha de validación.
- Observación.

**Resultado:**  
La receta puede quedar aprobada o rechazada.

---

# 9. Vencimientos y retiros

## CU32. Consultar productos próximos a vencer

**Actor:**  
Regente o usuario autorizado.

**Objetivo:**  
Identificar existencias próximas a vencer.

**Condición:**  
Se consideran próximas a vencer aquellas con saldo físico positivo cuyo vencimiento se encuentre entre la fecha actual y los próximos tres meses.

---

## CU33. Consultar productos vencidos

**Actor:**  
Regente o usuario autorizado.

**Objetivo:**  
Identificar existencias vencidas que todavía tengan saldo físico.

**Resultado:**  
Se muestran las unidades vencidas pendientes de retiro.

---

## CU34. Registrar retiro por vencimiento

**Actor:**  
Regente o usuario autorizado.

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

## CU35. Registrar retiro por daño

**Actor:**  
Usuario autorizado.

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

## CU36. Consultar medicamentos con stock bajo

**Actor:**  
Usuario autorizado.

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

## CU37. Consultar reporte de ventas

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Consultar las ventas realizadas por día, mes o período.

---

## CU38. Consultar reporte de compras

**Actor:**  
Usuario autorizado.

**Objetivo:**  
Consultar las compras realizadas por día, mes o período.

---

## CU39. Consultar historial de inventario

**Actor:**  
Usuario autorizado.

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

## CU40. Consultar pérdidas

**Actor:**  
Usuario autorizado.

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
- Registrar una venta implica consultar stock vendible, seleccionar existencias y generar movimientos de salida.
- Cuando existen varias existencias de un medicamento, la venta prioriza la existencia vendible que vence primero.
- Registrar una venta puede requerir registrar y aprobar una receta.
- Anular una compra o venta genera movimientos de reversión en lugar de eliminar los movimientos originales.
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
