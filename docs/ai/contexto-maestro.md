# CADEFAR — Contexto Maestro del Proyecto

> Este archivo resume las decisiones principales del proyecto CADEFAR y debe utilizarse como contexto base por cualquier persona o IA que continúe el desarrollo.
>
> Los detalles completos de requisitos, reglas de negocio y casos de uso se mantienen separados en:
>
> - `docs/ai/requerimientos.md`
> - `docs/ai/reglas-negocio.md`
> - `docs/ai/casos-uso.md`
>
> Si una decisión antigua contradice una decisión más reciente documentada aquí, debe prevalecer la decisión más reciente.

---

## 1. Identificación general

**Nombre del proyecto:**  
Sistema de Información Web para la Administración de Inventario, Ventas y Control de Vencimiento para la Farmacia CADEFAR.

**Empresa:** Farmacia CADEFAR  
**Ubicación:** Santa Cruz de la Sierra, Bolivia.  
**Tipo de sistema:** aplicación web de uso interno.

### Objetivo general

Mantener los procesos de compras, ventas e inventario de la farmacia, mejorando principalmente:

- Control de fechas de vencimiento.
- Control de existencias.
- Alertas de productos próximos a vencer.
- Alertas de stock bajo.
- Registro de retiros por vencimiento o daño.
- Trazabilidad de entradas y salidas mediante movimientos de inventario.

El sistema actual de la farmacia ya permite registrar compras, ventas, consultar inventario y obtener reportes básicos. La principal mejora propuesta se concentra en vencimientos, existencias, alertas y trazabilidad.

No se ha definido como requisito reemplazar completamente el sistema actual ni integrarse técnicamente con él en esta etapa.

---

## 2. Información obtenida de la farmacia

La farmacia actualmente:

- Registra compras.
- Registra ventas.
- Consulta inventario.
- Obtiene reportes diarios y mensuales de ventas.
- Realiza inventario físico manual aproximadamente una vez al año.
- No registra fechas de vencimiento en su sistema actual.
- No trabaja con lotes.
- No dispone de alertas automáticas de vencimiento.
- No dispone de alertas automáticas de stock bajo.

El control de vencimientos se realiza manualmente.

El personal presta especial atención a medicamentos aproximadamente tres meses antes de vencer.

Cuando existen unidades del mismo medicamento con diferentes vencimientos:

- Las que vencen primero se colocan físicamente adelante.
- Los productos próximos a vencer pueden trasladarse a una vitrina o espacio especial.
- Los productos vencidos se retiran y descartan.

La farmacia desea mejorar especialmente:

- Exactitud del control de vencimientos.
- Identificación de productos próximos a vencer.
- Identificación de productos vencidos pendientes de retiro.
- Control de stock bajo.

### Usuarios identificados

**Administrador**
- Administración general.
- Gestión de usuarios.
- Compras.
- Operaciones administrativas.

**Regente**
- Revisión de recetas.
- Control de medicamentos.
- Inventario.
- Vencimientos.

**Vendedor**
- Registro de ventas.
- Consultas necesarias para realizar ventas.

El Administrador puede supervisar y consultar información sin heredar automáticamente las operaciones técnicas del Regente ni el registro de ventas del Vendedor. Los actores de cada operación se detallan en los casos de uso.

Los proveedores deben contar con licencia de funcionamiento y resolución administrativa vigente del SEDES. La comprobación corresponde al personal de la farmacia; el sistema no realiza una validación automática contra SEDES.

Según la información obtenida, el laboratorio también puede actuar como proveedor. Por esta razón se mantiene una única entidad denominada `ProveedorLaboratorio`.

---

## 3. Alcance funcional

El sistema contempla:

- Usuarios.
- Roles.
- Proveedores/laboratorios.
- Medicamentos.
- Principios activos.
- Composición de medicamentos.
- Existencias de medicamentos.
- Compras.
- Detalles de compra.
- Ventas.
- Detalles de venta.
- Recetas.
- Movimientos de inventario.
- Ajustes.
- Vencimientos.
- Stock bajo.
- Retiros por vencimiento.
- Retiros por daño.
- Anulaciones y reversiones.
- Consultas y reportes.

### Fuera de alcance

No incluir:

- Historias clínicas.
- Diagnósticos.
- Consultas médicas.
- Emisión de recetas.
- Gestión clínica.
- Tienda en línea.
- Delivery.
- Contabilidad integral.
- Nómina.
- Facturación fiscal completa.
- Múltiples sucursales.

---

## 4. Decisiones fundamentales del modelo

### 4.1. No se utilizan lotes

La farmacia no maneja lotes actualmente.

Por eso no existe una entidad o tabla `Lote`.

La separación del inventario se realiza mediante `ExistenciaMedicamento`.

---

### 4.2. Medicamento y ExistenciaMedicamento son conceptos diferentes

`Medicamento` representa el producto del catálogo.

Ejemplo:

```text
Paracetamol 500 mg, tableta
```

`ExistenciaMedicamento` representa unidades concretas de ese medicamento agrupadas principalmente por vencimiento.

Ejemplo:

```text
Medicamento:
Paracetamol 500 mg

Existencia 1:
Vence 2026-11

Existencia 2:
Vence 2027-03
```

No se crean dos medicamentos diferentes.

Se crean dos existencias pertenecientes al mismo medicamento.

---

### 4.3. Código de medicamento y código de existencia

Cada medicamento posee un código identificable.

Ejemplo:

```text
PAR001
```

Las existencias utilizan el código del medicamento más un correlativo.

Ejemplo:

```text
PAR001-001
PAR001-002
PAR001-003
```

Interpretación:

```text
PAR001
→ código del medicamento

001
→ correlativo de la existencia
```

El `codigoExistencia`:

- Se genera automáticamente.
- Debe ser único.
- No debe reutilizarse.
- Se conserva históricamente aunque la existencia llegue a saldo cero.

El ID interno de la base de datos es independiente.

Ejemplo:

```text
id_existencia = 15
codigo_existencia = PAR001-003
```

---

### 4.4. No existe una tabla Inventario

El inventario se obtiene principalmente a partir de:

- `ExistenciaMedicamento`
- `MovimientoInventario`

`ExistenciaMedicamento` conserva el saldo actual.

`MovimientoInventario` conserva el historial de entradas y salidas.

---

### 4.5. Stock físico y stock vendible

**Stock físico:** unidades que todavía se encuentran físicamente en la farmacia.

**Stock vendible:** unidades que pueden ser utilizadas en una venta.

Una existencia vencida puede continuar teniendo saldo físico, pero deja de formar parte del stock vendible.

El vencimiento no pone automáticamente el saldo en cero.

El saldo disminuye cuando se registra el retiro físico.

Un medicamento inactivo conserva visible su stock físico y su información histórica, pero su stock vendible es cero. No puede incluirse en nuevas ventas.

Las fechas comerciales se determinan en `America/La_Paz`. Con precisión `DIA`, la existencia deja de ser vendible desde el inicio de la fecha indicada; con precisión `MES`, se almacena el último día del mes y deja de ser vendible desde el primer día del mes siguiente. La fecha efectiva se calcula conforme a RN29, sin una columna adicional.

---

### 4.6. Unidades individuales

El inventario se controla en unidades individuales según el medicamento.

Ejemplos:

- Tabletas.
- Cápsulas.
- Unidades.

No se controla exclusivamente por cajas cuando el medicamento puede venderse por unidades.

---

### 4.7. El stock nunca puede ser negativo

Antes de cualquier salida debe comprobarse que exista cantidad suficiente.

Ninguna venta, ajuste, retiro o reversión puede dejar una existencia con saldo negativo.

---

### 4.8. FEFO para ventas

Cuando existen varias existencias vendibles del mismo medicamento, se debe priorizar la que vence primero.

Se utiliza el criterio:

```text
FEFO
First Expired, First Out
```

Si una sola existencia no tiene suficiente cantidad para cubrir una venta, pueden utilizarse varias existencias.

Cada existencia utilizada se registra en un detalle diferente.

---

### 4.9. Historial y trazabilidad

Las operaciones importantes no deben eliminarse cuando formen parte del historial.

Se utilizan:

- Estados.
- Anulaciones.
- Reversiones.
- Movimientos de inventario.

Las existencias tampoco se eliminan simplemente porque su saldo llegue a cero.

---

### 4.10. Alertas y reportes no son tablas

No existen tablas:

```text
Alerta
Reporte
```

Las alertas y reportes se calculan a partir de los datos existentes.

Alertas principales:

- Próximo a vencer.
- Vencido pendiente de retiro.
- Stock bajo.

Los criterios se detallan en RN85, RN95 y RN32/RN96. La exclusión de medicamentos inactivos corresponde únicamente a stock bajo; sus existencias pueden seguir apareciendo en las consultas de próximos a vencer y vencidos si cumplen las condiciones respectivas.

Reportes principales:

- Ventas.
- Compras.
- Historial de inventario.
- Retiros.
- Pérdidas.
- Stock actual.
- Próximos a vencer.
- Stock bajo.

---

### 4.11. Venta pendiente y revisión de recetas

La venta utiliza los estados `PENDIENTE`, `CONFIRMADA` y `ANULADA`.

El Vendedor puede guardar una venta pendiente con sus detalles y recetas para que el Regente las revise. La receta conserva `id_venta` obligatorio; no se registra como una receta independiente de la venta.

- Una venta nueva queda pendiente por defecto.
- Guardar una venta pendiente no descuenta ni reserva stock y no genera movimientos de inventario.
- `fecha_registro` identifica cuándo se guardó la operación; `fecha_venta` permanece sin valor hasta la confirmación.
- El Regente revisa las recetas; el Vendedor confirma la venta cuando las recetas necesarias estén aprobadas.
- Al confirmar se comprueban nuevamente medicamento activo, stock, vencimientos y FEFO. Las existencias indicadas durante la preparación son provisionales y pueden necesitar redistribución en los detalles.
- La confirmación, los detalles definitivos, la fecha de venta, los movimientos y la disminución de saldos se ejecutan en una transacción.
- Una receta pendiente o rechazada no permite confirmar los detalles que requieren su aprobación.
- Anular una venta pendiente conserva el registro, pero no genera reversiones porque no hubo salida de inventario. Anular una venta confirmada sí compensa sus movimientos originales.

Los reportes de ventas realizadas utilizan la fecha de confirmación y distinguen las operaciones confirmadas de las pendientes y anuladas.

Esta decisión amplía el diseño anterior, que solo contemplaba ventas confirmadas y anuladas. El modelo y las migraciones representan el flujo; su ejecución y autorización pertenecen a los futuros Services y rutas de Ventas y Recetas.

---

### 4.12. Identidad histórica y gestión de composición

Un medicamento tiene historial cuando existe al menos un `MovimientoInventario` asociado a cualquiera de sus `ExistenciaMedicamento`. Una existencia por sí sola, incluso con saldo, no define este criterio. El historial permanece aunque los movimientos se hayan revertido o el saldo sea cero.

Desde el primer movimiento se bloquean los cambios efectivos de código, proveedor/laboratorio, forma farmacéutica, presentación, unidad de inventario, vía de administración y tipo de liberación. También queda bloqueada toda la composición: agregar o retirar ingredientes y cambiar principios activos, cantidades o unidades, incluidas las de referencia.

El nombre comercial, stock mínimo y condición de venta siguen siendo modificables. El estado se cambia únicamente por su operación específica. Una corrección tipográfica del nombre no crea un nuevo medicamento; si cambia realmente la identidad del producto, se registra otro medicamento.

Antes de existir historial, el Regente puede agregar, editar y retirar relaciones de composición. Se autoriza eliminar físicamente una relación únicamente en esa etapa. Corregir un ingrediente incorrecto se realiza retirando la relación y creando la correcta; la edición normal de la relación modifica cantidades y unidades, sin cambiar sus FK.

La búsqueda por varios principios activos utiliza AND: el medicamento debe contener todos los indicados y puede contener otros adicionales. Es una consulta informativa, sin equivalencia terapéutica ni sustitución automática.

Las reglas se implementan en Services y las consultas de historial en Repositories. Las modificaciones protegidas y la comprobación de historial se coordinan mediante transacciones y bloqueos; este bloque no registra operaciones de inventario.

---

## 5. Documentación funcional separada

Para evitar que este archivo sea excesivamente grande, los detalles completos se encuentran en archivos independientes.

### Requerimientos

Consultar:

```text
docs/ai/requerimientos.md
```

Contiene:

- Requerimientos funcionales.
- Requerimientos de información.
- Requerimientos no funcionales.

### Reglas de negocio

Consultar:

```text
docs/ai/reglas-negocio.md
```

Contiene las reglas completas relacionadas con:

- Usuarios.
- Roles.
- Proveedores.
- Medicamentos.
- Existencias.
- Stock.
- Compras.
- Ventas.
- Recetas.
- Movimientos.
- Anulaciones.
- Reversiones.
- Ajustes.
- Vencimientos.
- Retiros.
- Pérdidas.
- Alertas.
- Reportes.
- Integridad y trazabilidad.

### Casos de uso

Consultar:

```text
docs/ai/casos-uso.md
```

Contiene 41 casos de uso, numerados desde CU01 hasta CU41, y los actores correspondientes.

Antes de implementar una funcionalidad nueva que afecte comportamiento del sistema, revisar estos tres documentos.

---

## 6. Entidades principales

Actualmente se manejan las siguientes entidades:

- Rol
- Usuario
- ProveedorLaboratorio
- Medicamento
- PrincipioActivo
- ComposicionMedicamento
- ExistenciaMedicamento
- Compra
- DetalleCompra
- Venta
- DetalleVenta
- Receta
- MovimientoInventario

### Entidades que no existen actualmente

No agregar sin un nuevo requisito:

- Lote
- Inventario
- Alerta
- Reporte
- BajaInventario
- Paciente
- Medico
- Permiso
- RolPermiso
- DetalleReceta
- Auth

---

## 7. Diccionario resumido de clases

### Rol

Representa la función asignada a una cuenta dentro del sistema.

Roles actuales:

- Administrador.
- Regente.
- Vendedor.

### Usuario

Representa una cuenta de acceso al sistema.

Contiene credenciales, estado y rol.

### ProveedorLaboratorio

Representa la entidad que suministra medicamentos.

Proveedor y laboratorio se mantienen unificados en esta etapa.

### Medicamento

Representa un producto del catálogo de la farmacia.

### PrincipioActivo

Representa un ingrediente activo.

### ComposicionMedicamento

Relaciona un medicamento con uno de sus principios activos y conserva los datos necesarios para describir su concentración.

### ExistenciaMedicamento

Representa unidades de un medicamento diferenciadas principalmente por vencimiento.

Conserva:

- Código de existencia.
- Saldo físico.
- Vencimiento.
- Costo promedio.

### Compra

Representa una adquisición realizada a un proveedor/laboratorio.

### DetalleCompra

Representa una línea de una compra vinculada con una existencia.

Conserva `saldo_anterior INT NULL` y `costo_promedio_anterior DECIMAL(14,6) NULL` para respaldar RN36 y RN76. La migración B1 ya está aplicada en desarrollo local (`prueba`), con el CHECK de par completo no negativo o ambos NULL, conforme al hito registrado en la sección de API de Fase 2. Los registros anteriores a esa migración conservaron ambos atributos en NULL y no se completan automáticamente; las compras nuevas registran el par de snapshots conforme a RN36.

### Venta

Representa una operación de venta.

### DetalleVenta

Representa una línea de venta vinculada con una existencia específica.

### Receta

Representa una receta presentada para respaldar medicamentos que requieren prescripción.

El sistema registra y revisa recetas, pero no las emite.

### MovimientoInventario

Representa una entrada o salida de una existencia.

Mantiene la trazabilidad histórica del inventario.

---

## 8. Modelo relacional actual

Tablas principales:

```text
1. rol
2. proveedor_laboratorio
3. principio_activo
4. usuario
5. medicamento
6. composicion_medicamento
7. existencia_medicamento
8. compra
9. venta
10. receta
11. detalle_compra
12. detalle_venta
13. movimiento_inventario
```

Orden de migraciones recomendado:

```text
1. rol
2. proveedor_laboratorio
3. principio_activo
4. usuario
5. medicamento
6. composicion_medicamento
7. existencia_medicamento
8. compra
9. venta
10. receta
11. detalle_compra
12. detalle_venta
13. movimiento_inventario
```

---

## 9. Usuarios y roles

Roles predefinidos:

```text
1 = Administrador
2 = Regente
3 = Vendedor
```

Los roles se cargan mediante seeders.

También debe existir un usuario Administrador inicial cargado mediante seeder.

Esto es necesario porque únicamente un Administrador puede crear las demás cuentas.

No se contempla actualmente:

- Crear roles dinámicamente desde el sistema.
- Implementar tablas `Permiso` y `RolPermiso`.
- Configurar permisos individualmente desde un panel.

La autorización actual se basa en roles fijos.

Las contraseñas nuevas deben tener entre 8 y 100 caracteres e incluir mayúscula, minúscula, número y carácter especial.

El inicio de sesión mantiene un contador de intentos fallidos consecutivos. Al tercer fallo, la cuenta impide nuevos inicios de sesión durante diez minutos sin cambiar su estado administrativo. Un inicio correcto, un cambio propio exitoso o un restablecimiento administrativo de contraseña reinicia el contador y elimina el bloqueo.

---

## 10. Arquitectura general del sistema

CADEFAR utiliza una arquitectura cliente-servidor.

```text
Frontend
React + Vite
        │
        │ HTTP / JSON / Cookies
        ▼
Backend
Node.js + Express
        │
        ▼
MySQL
```

El frontend nunca se conecta directamente con MySQL.

Toda operación pasa por la API del backend.

---

# BACKEND

## 11. Arquitectura del backend

El backend utiliza arquitectura por capas.

```text
Presentación
     ↓
Negocio
     ↓
Datos
     ↓
Base de datos
```

Flujo típico:

```text
Route
↓
Middleware
↓
Controller
↓
Service
↓
Repository
↓
Modelo Sequelize
↓
MySQL
```

### Controller

Responsabilidades:

- Recibir `req` y `res`.
- Validar la información de entrada.
- Llamar al Service.
- Devolver la respuesta HTTP.
- Capturar errores y enviarlos mediante `next(error)`.

No debe contener la lógica principal del negocio.

### Service

Responsabilidades:

- Reglas de negocio.
- Decisiones sobre si una operación puede realizarse.
- Coordinación entre repositorios o servicios.
- Hash de contraseñas cuando corresponda.
- Transacciones cuando una operación deba ser atómica.
- Lanzar `AppError` para errores conocidos.

No debe recibir `req` ni `res`.

### Repository

Responsabilidad principal:

- Acceso a datos.
- Consultas Sequelize.
- `findOne`
- `findAll`
- `findByPk`
- `create`
- `update`

No debe tomar decisiones de negocio.

### Model

Representa una tabla mediante Sequelize.

Define:

- Campos.
- Tipos.
- Restricciones.
- Asociaciones.

### Middleware

Se utiliza para responsabilidades transversales como:

- Autenticación.
- Autorización.
- Manejo global de errores.

### Utils

Funciones técnicas reutilizables.

Ejemplo:

- Generar JWT.
- Verificar JWT.

### Diseño técnico de API — Fase 1A

Diseño aprobado; consultas implementadas en el backend e integración verificada en una base MySQL temporal aislada.

| Método y ruta | Casos de uso | Actores autorizados |
|---|---|---|
| `GET /api/inventario` | CU21 | Administrador, Regente o Vendedor |
| `GET /api/inventario/medicamentos/:idMedicamento/existencias` | CU22 | Administrador, Regente o Vendedor |
| `GET /api/inventario/movimientos` | CU24 y CU40 | Administrador o Regente |

CU24 y CU40 comparten la consulta de movimientos e historial. Estas rutas son decisiones técnicas de API y no agregan casos de uso ni modifican permisos.

### Diseño técnico de API — Fase 1B

Consultas implementadas en el backend e integración verificada en una base MySQL temporal aislada.

| Método y ruta | Caso de uso | Actores autorizados |
|---|---|---|
| `GET /api/inventario/proximos-a-vencer` | CU33 | Administrador o Regente |
| `GET /api/inventario/vencidos` | CU34 | Administrador o Regente |
| `GET /api/inventario/stock-bajo` | CU37 | Administrador, Regente o Vendedor |

Estas consultas reutilizan la disponibilidad de Fase 1A y aplican RN85, RN95 y RN32/RN96. No persisten alertas ni modifican saldos. Admiten los filtros `idMedicamento`, `codigoMedicamento` y `nombreComercial` de Inventario.

Las respuestas mantienen `{ data, meta }`, con `meta.fechaComercial` y `meta.zonaHoraria`. Próximos a vencer agrega `meta.fechaHasta` y, por existencia, la `fechaEtiquetaNormalizada` calculada; conserva la fecha almacenada sin corregir registros históricos. El límite de tres meses calendario conserva el día de origen o utiliza el último día del mes destino si ese día no existe allí.

#### Frontend — primera entrega de consultas de Inventario

Implementadas en React las consultas CU21, CU22, CU24/CU40, CU33, CU34 y CU37 mediante los endpoints existentes. La feature `frontend/src/features/inventario/` mantiene páginas, componentes y servicios Axios. Desde la segunda entrega comparte con Compras el hook `frontend/src/hooks/useConsulta.js` para estado local y respuestas tardías, y `frontend/src/utils/presentacion.js` para fechas/decimales. Reutiliza el layout, componentes de catálogo y estilo visual del frontend.

| Ruta de interfaz | Consulta | Roles |
|---|---|---|
| `/inventario` | Inventario por medicamento | Administrador, Regente o Vendedor |
| `/inventario/medicamentos/:idMedicamento/existencias` | Existencias, vencimientos, costos y último movimiento | Administrador, Regente o Vendedor |
| `/inventario/stock-bajo` | Stock bajo | Administrador, Regente o Vendedor |
| `/inventario/movimientos` | Historial y referencias originales/reversiones | Administrador o Regente |
| `/vencimientos` | Próximos a vencer | Administrador o Regente |
| `/vencimientos/vencidos` | Vencidos pendientes de retiro | Administrador o Regente |

Los filtros se aplican explícitamente al consultar y se conservan en la URL para recarga y navegación atrás/adelante. Las consultas ignoran respuestas y errores de solicitudes anteriores, retiran los resultados previos durante la carga y permiten actualizar o reintentar. Ante 401 se ofrece una navegación completa al login para volver a comprobar la sesión y descartar el usuario público obsoleto. Los permisos se aplican tanto en las rutas como en los accesos visibles; la autorización definitiva continúa en el backend.

Físico y vendible se muestran por separado utilizando los valores de la API; no se recalculan stock, vencimiento ni promedio en React. Se conservan los seis decimales como texto, los motivos históricos y las fechas civiles sin conversión a Date, UTC ni normalización de históricos MES. CU22 suministra el saldo y marcador; una consulta de Inventario filtrada por ID aporta únicamente la identificación del medicamento, también cuando no tiene existencias.

Verificación: `node --test tests/inventario.browser.test.mjs`, ejecutado desde frontend, aprobó 20 pruebas en Chrome con 74 peticiones de Inventario interceptadas. Comprueba filtros, recarga, navegación, respuestas/errores tardíos, tres roles, 400/401/403/404/500, errores de red, existencias vacías, costos pequeños/máximos, trazabilidad y tablas desplazables a 375 px. La regresión `tests/cu09.browser.test.mjs` aprobó otras 24 pruebas; `pnpm build` aprobó. Estas pruebas usan API simulada, no conectan ni escriben en MySQL y no sustituyen la verificación de extremo a extremo con backend real prevista para el cierre de las entregas frontend. Las consultas de Compras se incorporan en la segunda entrega, el registro en la tercera y Ajustes en la cuarta; Retiros y anulación de Compras continúan en las siguientes entregas del orden acordado.

### Diseño técnico de API — Fase 2

Decisiones funcionales aprobadas para CU25 y CU26. La Fase 2.0 incorpora estas decisiones a la documentación; la implementación, la migración B1 y las pruebas de escritura requieren autorizaciones separadas. CU27 se reservó inicialmente para la Fase 5 y se adelantó después de Fase 2.4 por solicitud explícita del usuario, con autorización independiente para su integración real en bases temporales.

| Método y ruta | Caso de uso | Actores autorizados |
|---|---|---|
| `POST /api/compras` | CU25 | Administrador |
| `GET /api/compras` | CU26 | Administrador o Regente |
| `GET /api/compras/:idCompra` | CU26 | Administrador o Regente |
| `POST /api/compras/:idCompra/anular` | CU27 | Administrador |

#### Entrada y respuestas

POST admite exclusivamente `claveOperacion`, `fechaCompra` y `detalles`. Cada detalle admite `idMedicamento`, `cantidad`, `costoUnitario`, `precisionVencimiento` y `fechaVencimiento`. IDs y cantidades son enteros positivos dentro del rango INT. Los costos se reciben como cadenas decimales positivas con hasta seis decimales, sin exponente ni coma. `DIA` utiliza `YYYY-MM-DD`; `MES` utiliza `YYYY-MM` y se transforma al último día del mes para almacenamiento. La solicitud debe contener al menos un detalle y se rechazan campos adicionales.

El backend resuelve proveedor, usuario, existencias, códigos, importes, estado anterior, movimientos y horas. Las condiciones de negocio se rigen por RN10, RN14, RN29, RN33 y RN36–RN45. Las consultas conservan el proveedor registrado en la cabecera, sin deducirlo nuevamente desde el catálogo.

GET admite `desde`, `hasta`, `idProveedorLaboratorio`, `estadoOperacion` y `claveOperacion`. Los rangos inclusivos se aplican a `fechaCompra`; un día utiliza extremos iguales y un mes sus días primero y último. `estadoOperacion` admite `CONFIRMADA` y `ANULADA`; sin ese filtro se consultan ambos estados. El filtro por clave añade obligatoriamente el usuario autenticado, también cuando se combina con otros filtros; no acepta un usuario proporcionado por el cliente. Una clave ajena o una búsqueda sin resultados produce `{ data: [] }`. La consulta por ID inexistente devuelve 404. Los estados actuales de medicamentos y proveedores no excluyen compras históricas.

Las respuestas mantienen `{ data }`, agregando `message` al registro exitoso. POST devuelve 201 únicamente después de confirmar la operación completa. Los errores mantienen el formato del middleware global, con `message` y, cuando corresponde, `errors`. Se utiliza 400 para entrada o importes inválidos, incluida fecha de adquisición futura; 404 para referencias requeridas inexistentes; 409 para clave repetida y conflictos funcionales; 401/403 para autenticación/autorización; y 500 para errores inesperados. La contención temporal se distingue de un duplicado y exige rollback completo antes de responder.

#### Clave de operación

Las claves nuevas admiten entre 1 y 64 caracteres ASCII alfanuméricos, guion y guion bajo, sin espacios, normalizados a minúsculas. La igualdad efectiva respeta la colación del UNIQUE de MySQL; los valores históricos no se corrigen.

Una clave existente devuelve 409, sin reconstruir ni comparar solicitudes y sin devolver automáticamente una compra desde POST. Las claves de compras anuladas no se reutilizan. Un rollback no conserva la clave de la operación fallida. El cliente conserva la misma clave durante sus reintentos y puede localizar su operación mediante el filtro personal de GET antes de generar una clave distinta.

La protección utiliza `Compra.clave_operacion VARCHAR(64) UNIQUE`, sin huellas de solicitud ni tablas adicionales de idempotencia. Una comprobación previa es auxiliar: el UNIQUE es la garantía final ante solicitudes simultáneas. Solo su conflicto específico se traduce como clave duplicada; otros errores UNIQUE se identifican por separado. La respuesta de conflicto no revela datos de compras de otros usuarios. Esta protección no demuestra equivalencia de contenido ni impide solicitudes con claves distintas.

#### Cálculos y estado anterior

Los cálculos de escala fija utilizan cadenas y BigInt, sin dependencias decimales adicionales. Se convierten costos a unidades de `0.000001` para multiplicar y sumar cantidades enteras, y se aplica el redondeo de RN40 al dividir o reducir escala. Los importes se guardan y devuelven como cadenas; los BigInt intermedios no se serializan directamente a JSON.

Se verifican cantidades por detalle, sumas por existencia y saldo final hasta `2147483647`; costos y promedios hasta `99999999.999999` para DECIMAL(14,6); y subtotales y total hasta `999999999999.99` para DECIMAL(14,2). Los resultados se comprueban antes de persistir, además de validar los valores individuales. La valoración utiliza costos de seis decimales, no subtotales monetarios de dos decimales.

El estado previo se captura una vez por existencia bloqueada, antes de modificar saldos o promedios, y se copia a todos sus detalles dentro de la misma transacción. Para una existencia nueva se captura `0 / 0.000000`; para una agotada se conserva su promedio previo aunque no aporte valor al cálculo. El promedio de RN45 se calcula una sola vez por grupo, conservando un movimiento original individual por detalle, con cantidad y costo de adquisición coincidentes.

La migración B1 agrega únicamente `saldo_anterior INT NULL` y `costo_promedio_anterior DECIMAL(14,6) NULL` a DetalleCompra, sin valores predeterminados artificiales ni backfill. Un CHECK exige ambos NULL o ambos presentes y no negativos. Las compras nuevas siempre proporcionan el par; la igualdad entre detalles del grupo se asegura en el Service y se revalida al anular. La migración es aditiva y el modelo permanece CommonJS. Su autorización y aplicación son independientes de la implementación funcional de CU27.

#### Transacción, bloqueos e historial

CompraService coordina la transacción completa. Toma bloqueos exclusivos de medicamentos en orden estable, comprueba el proveedor bajo bloqueo compartido y bloquea las existencias antes de insertar movimientos. Identifica existencias por medicamento, fecha almacenada y precisión, reutiliza agotadas y genera códigos a partir del mayor correlativo conservado, sin COUNT + 1. Verifica la longitud de 30 caracteres y mantiene los UNIQUE como barreras finales.

La detección de posteriores para RN76 obtiene todos los originales del grupo y busca, en la misma existencia, movimientos con ID mayor que el menor ID original que no pertenezcan al conjunto original. Esto excluye los distintos originales de la propia compra e ignora movimientos de otras existencias. Una intercalación ajena entre originales es una anomalía que impide la anulación, sin eludirla mediante A. La fiabilidad de esta secuencia exige que toda escritura bloquee la existencia antes del INSERT, mantenga el bloqueo hasta terminar la transacción y utilice IDs automáticos. AUTO_INCREMENT no se interpreta como orden global de commits ni demuestra la secuencia de escrituras externas al protocolo.

Antes de utilizar B1 se comprueban originales íntegros y sin reversiones incompatibles, estado anterior disponible e idéntico en todo el grupo, ausencia de posteriores y coincidencia del saldo y promedio actuales con el resultado agrupado esperado de la compra. La restauración ocurre una vez por existencia; las reversiones son individuales y respetan RN72. Las modalidades y el tratamiento del legado se rigen por RN76 y RN80. Un saldo que coincide después de una salida y una entrada no acredita ausencia de posteriores.

#### Representación temporal

Fecha de adquisición, hora de registro y hora del movimiento conservan sus significados separados. Después de adquirir los bloqueos relevantes y antes de escribir, se toma un único instante para obtener el día comercial de validación y una hora civil común en America/La_Paz. No se generan movimientos retroactivos por la fecha de adquisición.

La implementación construye las nuevas escrituras temporales mediante una expresión Sequelize STR_TO_DATE con valores escapados, evitando convertir el texto civil primero a Date, y lee mediante DATE_FORMAT. Se conserva la configuración global de Sequelize; los DATETIME históricos se devuelven como texto almacenado, sin asignarles una interpretación UTC o comercial no demostrada. Una hora local no recibe un sufijo Z. La Fase 2.4 verificó la persistencia real y la lectura de nuevas operaciones en una base aislada: el instante `2026-11-01T04:15:00Z` queda almacenado en Compra y sus movimientos como `2026-11-01 00:15:00`, mientras la sesión Sequelize conserva `+00:00`.

#### Frontend — segunda entrega: consultas de Compras (CU26)

Implementadas `/compras` y `/compras/:idCompra` para Administrador y Regente. El menú y las rutas aplican esos roles; el Vendedor no accede ni solicita estas consultas. La feature `frontend/src/features/compras/` utiliza los GET existentes, la instancia Axios con cookies y los componentes/estilos del frontend. El registro CU25 se incorpora en la tercera entrega; la acción de anular CU27 pertenece a una entrega posterior.

El listado conserva confirmadas y anuladas y permite combinar `desde`, `hasta`, `idProveedorLaboratorio`, `estadoOperacion` y `claveOperacion`. El período se aplica a la fecha de adquisición e incluye ambos extremos; fechas iguales consultan un día. Los filtros se conservan en URL y al volver del detalle. Se incluyen proveedores inactivos en las opciones, con recuperación independiente si falla su carga. La clave se normaliza a minúsculas y se informa que su búsqueda es personal; React no envía un ID de usuario.

El detalle muestra proveedor registrado, responsable, fecha de adquisición, hora civil de registro, clave, total y todas las líneas recibidas, sin agrupar detalles repetidos ni recalcular importes. Para una anulada muestra además motivo, hora y responsable de anulación, conservando la operación original. Cantidades, costos de seis decimales, subtotales y total de dos decimales se presentan desde la API, con formato textual y sin conversión decimal a Number. Los datos y estados del catálogo se identifican como actuales; el vencimiento MES histórico conserva la fecha guardada. Las existencias recibidas enlazan con las consultas de Inventario e historial.

Verificación: `tests/compras.browser.test.mjs` aprobó 16 pruebas en Chrome con API simulada y 56 consultas de Compras interceptadas en su ejecución final. Comprueba filtros combinados, rango/clave, recarga y retorno, líneas repetidas, importes pequeños/máximos, anulación histórica, proveedores inactivos/error de opciones, respuestas y errores tardíos, permisos, 400/401/403/404/500, errores de red y diseño a 375 px. Las regresiones de Inventario y CU09/Usuarios aprobaron 20 y 24 pruebas respectivamente: 60 pruebas distintas aprobadas. La sincronización de las pruebas espera el render de React después de navegar para evitar comprobar el estado anterior bajo ejecución paralela. `pnpm build` aprobado. No se conectó ni escribió en MySQL; la prueba de extremo a extremo con backend real permanece prevista para el cierre frontend.

#### Frontend — tercera entrega: registro de Compras (CU25)

Implementada `/compras/nueva` exclusivamente para Administrador, con acceso desde el listado. La ruta específica prevalece sobre el detalle por ID y aplica RoleRoute; Regente/Vendedor no cargan opciones ni acceden al registro. La página utiliza los servicios existentes de Medicamentos y Proveedores/Laboratorios y el POST de Compras mediante la instancia Axios con cookies.

El formulario admite fecha civil de adquisición, clave de operación y una o más líneas de recepción con medicamento, cantidad entera positiva, costo como cadena de hasta seis decimales y vencimiento DIA/MES. Solo ofrece medicamentos activos de proveedores activos. El proveedor se deriva de los medicamentos; las opciones de otro proveedor se deshabilitan tras seleccionar el primero y la validación básica señala una mezcla. Se pueden agregar/quitar líneas y repetir medicamento, conservando cada detalle por separado. Cambiar la precisión limpia el vencimiento para evitar reutilizar una fecha incompatible. La revisión previa identifica código, nombre, presentación, unidad, cantidad, costo y vencimiento antes de confirmar.

React valida formato y campos obligatorios, sin calcular total, subtotales, saldos ni costo promedio. El servidor verifica fecha futura, vencimiento con el corte comercial, catálogo vigente, límites agrupados, disponibilidad de clave y efectos transaccionales. POST envía exclusivamente `claveOperacion`, `fechaCompra` y `detalles`; las líneas contienen únicamente los cinco campos permitidos. El éxito navega al detalle y muestra los importes y existencias devueltos por el backend.

La clave inicial se genera con aleatoriedad del navegador, se puede editar antes del envío, se normaliza a minúsculas y queda fija tras el primer intento. El formulario y la clave se conservan ante errores; no hay reintentos automáticos ni cambio automático de clave. Tras un intento se permite consultar la clave mediante el GET personal, manteniendo el borrador en pantalla. Encontrar una operación permite abrir su detalle y bloquea otra confirmación desde ese borrador; no se afirma equivalencia de contenido. Una búsqueda vacía no se interpreta como prueba de rollback ni de finalización de una solicitud concurrente. El borrador es estado local: al salir o recargar se pierde y la interfaz indica copiar la clave para localizar la operación. Los envíos duplicados se bloquean con estado/ref; 401/403 bloquean el registro y 401 ofrece navegación completa al login. Las respuestas de POST/consulta posteriores a salir se ignoran para no secuestrar la navegación.

Verificación final: `node --test tests/compras.browser.test.mjs tests/inventario.browser.test.mjs tests/cu09.browser.test.mjs` aprobó 74 pruebas distintas (30 de Compras CU25/CU26, 20 de Inventario y 24 de CU09/Usuarios). Compras interceptó 83 peticiones, incluidas 11 POST simuladas. Los casos nuevos verifican contrato exacto, DIA/MES, líneas repetidas, costos pequeños/máximos, selección de catálogo, errores/carga/vacío, revisión y bloqueo de duplicados, conservación de clave/borrador, búsqueda personal, recuperación tras pérdida de respuesta con commit simulado, respuesta tardía al salir, roles y diseño a 375 px. Revisión visual de formulario y confirmación en escritorio/móvil; `pnpm build` y `git diff --check` aprobados. Vite emitió un aviso no bloqueante por el bundle principal de 513.12 kB (149.05 kB gzip). No se conectó ni escribió en MySQL; la verificación de extremo a extremo con backend real permanece para el cierre acordado, con escrituras exclusivamente en bases temporales aisladas.

#### Entregas y verificación

Fase 2.0: documentación; Fase 2.1: contratos, validadores y operaciones decimales y temporales; Fase 2.2: consultas; Fase 2.3: registro transaccional completo; Fase 2.4: integración, concurrencia y regresiones. El hito de migración/modelo B1 requiere autorización separada y debe estar aplicado antes de utilizar esos atributos y habilitar POST. Ninguna entrega habilita un registro parcial de cabecera sin sus efectos de inventario.

Fase 2.1 implementada y verificada mediante pruebas puras:

- `compraValidator.validateCreate()`, `validateId()` y `validateFiltros()` validan el contrato estructural. Normalizan clave y costo, y convierten el vencimiento MES al último día para las nuevas entradas, conservando precisión, multiplicidad y orden de los detalles sin modificar el body original.
- `decimalAEntero()`, `enteroADecimal()` y `dividirYRedondear()` proporcionan conversión exacta de escala fija y división de valores no negativos al más cercano con empate hacia arriba. El consumidor verifica los límites de persistencia; las primitivas permiten intermedios superiores a DECIMAL y al rango entero seguro de Number.
- `obtenerFechaOperacion()` recibe un instante Date y devuelve `fechaComercial`, `fechaHoraComercial` y `zonaHoraria` coherentes con America/La_Paz. La hora es texto civil a segundos, sin Z, y no depende de la zona del proceso.

La fecha de adquisición no futura, la recepción no vencida y los estados reales de medicamentos y proveedor se comprobarán en CompraService con el instante obtenido bajo bloqueo. El Validator no decide esas reglas temporales o dependientes de datos. La escritura y lectura de horas en MySQL, las rutas y las transacciones pertenecen a las entregas posteriores.

Verificación de Fase 2.1: 37 pruebas aprobadas, cero fallidas, canceladas u omitidas, incluyendo las suites puras de Inventario y vencimientos. Ejecución sin importar modelos ni conectar a MySQL:

```text
node --test tests/decimal.test.js tests/compra.validator.test.js tests/fecha-operacion.test.js tests/vencimiento.test.js tests/inventario.validator.test.js
```

Fase 2.2 implementada: `GET /api/compras` devuelve cabeceras, ordenadas por fecha de adquisición descendente e ID descendente para desempatar. `GET /api/compras/:idCompra` devuelve la cabecera y `detalles`, ordenados por ID de detalle ascendente, con la existencia recibida y datos públicos de su medicamento. La consulta por ID no admite filtros de query. Las cabeceras incluyen proveedor registrado, usuario registrador y datos de anulación, con usuario anulador cuando existe. Las relaciones del catálogo se consultan en su estado actual; no se presentan como snapshots históricos del catálogo.

Se conserva el total y cada importe registrados, con representación decimal de escala fija, sin recalcular la operación. El vencimiento histórico se devuelve como está almacenado, incluso para MES no canónico. Los DATETIME se seleccionan mediante DATE_FORMAT para devolver texto sin sufijo Z; estas respuestas no consultan los atributos B1. CompraService añade el ID de sesión al filtro por clave y exige una identidad válida antes de ejecutar esa búsqueda.

Verificación conjunta: 56 pruebas aprobadas, cero fallidas, canceladas u omitidas. La suite de Compras ejecutó 54 comprobaciones HTTP y generó 74 SELECT con Sequelize; la regresión HTTP de Inventario generó otros 91 SELECT. Se ejecutaron las capas reales y se simularon únicamente los resultados de SELECT, bloqueando cualquier conexión MySQL. La integración real permanece pendiente de la entrega autorizada correspondiente.

```text
node --test tests/compra.http.test.js tests/compra.validator.test.js tests/decimal.test.js tests/fecha-operacion.test.js tests/vencimiento.test.js tests/inventario.validator.test.js tests/inventario.http.test.js
```

Hito B1: migración y modelo preparados con autorización específica; aplicación posterior autorizada por separado en la base de desarrollo `prueba` de `localhost`:

- `20261010120000-add-compra-existencia-snapshots.js` agrega el par nullable y su CHECK en un único ALTER TABLE, sin defaults artificiales ni backfill. Los IS NOT NULL explícitos impiden que un par incompleto satisfaga el CHECK mediante el resultado UNKNOWN de MySQL.
- `DetalleCompra` declara `saldo_anterior` como INTEGER y `costo_promedio_anterior` como DECIMAL(14,6), ambos nullable, conservando CommonJS, asociaciones y atributos anteriores.
- `down` comprueba si existe información en cualquiera de las columnas y rechaza retirarlas en ese caso para conservar los snapshots. Si ambos campos están vacíos en todos los detalles, retira el CHECK y las dos columnas en un único ALTER TABLE.

La verificación sin conexión ejecuta la migración contra una interfaz simulada e instancia el modelo Sequelize sin persistir. Comprueba el SQL emitido, la propagación de fallos, la protección de snapshots al revertir y la ausencia de valores previos fabricados. La suite conjunta aprueba 62 pruebas, incluidas las seis nuevas de B1 y las regresiones de Compras e Inventario. Estas comprobaciones sin conexión no acreditan por sí solas la ejecución real del DDL ni el cumplimiento del CHECK en MySQL.

```text
node --test tests/compra-b1.schema.test.js tests/compra.http.test.js tests/compra.validator.test.js tests/decimal.test.js tests/fecha-operacion.test.js tests/vencimiento.test.js tests/inventario.validator.test.js tests/inventario.http.test.js
```

B1 aplicada correctamente en `prueba`, MySQL 8.0.46 e InnoDB, mediante Sequelize CLI 6.6.5 seleccionando exclusivamente `20261010120000-add-compra-existencia-snapshots.js` por `--name`. SequelizeMeta conserva las migraciones anteriores y registra únicamente esta nueva ejecución. Las dos columnas tienen los tipos y nulabilidad previstos y `chk_detalle_compra_estado_anterior` figura con ENFORCED=YES.

La comparación completa de datos anteriores antes y después del ALTER confirmó igualdad exacta en 4 compras, 9 detalles, 8 existencias y 19 movimientos. Los nueve detalles históricos conservan ambos atributos nuevos en NULL. Se evaluó la expresión real del CHECK obtenida de information_schema mediante 13 SELECT con pares sintéticos: ambos NULL y pares completos no negativos devuelven verdadero; los incompletos y negativos devuelven falso, sin resultados UNKNOWN. Durante esa aplicación en desarrollo no se ejecutaron INSERT, UPDATE ni DELETE de prueba. Las escrituras que ejercen el CHECK y la reversión de la migración se verificaron posteriormente en la base aislada de Fase 2.4.

Se verificaron además 18 SELECT funcionales reales de Services/Repositories sobre el esquema actualizado: listado y consulta por ID de las cuatro compras y sus nueve detalles, importes y horas coincidentes con los valores almacenados, filtros inclusivos, búsqueda por clave propia y ajena, 404 por ID inexistente, stock físico de las ocho existencias, alertas y los diecinueve movimientos. Esta verificación fue de lectura y no sustituye las pruebas de escritura o concurrencia.

Fase 2.3 implementada en código: `POST /api/compras` está montado con autenticación y permiso exclusivo de Administrador, validación estricta del body y ausencia de filtros de query. Devuelve la compra con detalles y el mensaje de registro exitoso, con 201 únicamente después del commit de la transacción gestionada por Sequelize. Las consultas existentes conservan sus atributos públicos anteriores.

CompraService calcula subtotales, total y sumas por grupo con BigInt; rechaza importes y cantidades agrupadas fuera de rango antes de abrir la transacción. La consulta auxiliar de clave se hace fuera de la transacción para no iniciar una lectura snapshot anterior a los bloqueos. El UNIQUE sigue siendo la garantía final, incluso para compras anuladas y solicitudes simultáneas.

Dentro de la transacción se bloquean medicamentos por ID ascendente, se resuelve el proveedor único bajo bloqueo compartido y se bloquean todas las existencias de los medicamentos involucrados por ID de existencia. Las agotadas y los códigos conservados participan en la identificación y en el cálculo del mayor correlativo, sin COUNT + 1 ni reutilización de códigos. Se toma un solo instante después de esos bloqueos y antes del primer INSERT para validar fecha de adquisición y vencimientos, y generar una hora civil común para la compra y sus movimientos.

Los grupos se valoran una sola vez desde su estado anterior; cada detalle comparte el snapshot de la existencia anterior a la compra completa. Una existencia nueva captura cero/cero, mientras una agotada conserva su promedio histórico en el snapshot. Se crean o actualizan existencias, luego se conservan detalles y movimientos individuales con cantidad y costo de adquisición coincidentes. Cada movimiento utiliza únicamente su detalle de compra, sin detalle de venta ni movimiento original. La respuesta se consulta dentro de la misma transacción: un fallo de esa lectura también provoca rollback.

Los errores UNIQUE de clave, código de existencia y combinación medicamento/vencimiento/precisión se identifican por separado. Deadlock y espera de bloqueo agotada devuelven un conflicto de contención temporal después de terminar la transacción fallida, sin confundirse con una clave duplicada ni reintentar automáticamente. Los errores técnicos inesperados conservan la respuesta 500 genérica.

Verificación conjunta de Fase 2.3: 79 pruebas aprobadas, cero fallidas, canceladas u omitidas. La suite nueva ejecuta 61 comprobaciones HTTP del registro con capas, modelos, generación SQL y gestión de transacciones Sequelize reales. Se simulan únicamente el transporte SQL, las conexiones y su estado transaccional, sin conexiones ni escrituras MySQL. Incluye permisos, validación, recepción, límites, promedio agrupado frente a redondeos intermedios, snapshots, correlativos, corte comercial bajo bloqueo, clasificación de conflictos y fallos en cabecera, creación/actualización de existencia, detalles, movimientos y lectura final; el rollback simulado permite reintentar la misma clave.

```text
node --test tests/compra.registro.http.test.js tests/compra-b1.schema.test.js tests/compra.http.test.js tests/compra.validator.test.js tests/decimal.test.js tests/fecha-operacion.test.js tests/vencimiento.test.js tests/inventario.validator.test.js tests/inventario.http.test.js
```

La implementación de Fase 2.3 no ejecutó registros de compra contra `prueba` ni preparó una base de escritura. La aceptación real se completó en Fase 2.4 con autorización específica para crear, migrar, escribir y eliminar bases temporales locales exclusivas.

Fase 2.4 completada y verificada mediante `tests/compra.integration.test.js`. La suite ejecuta las capas HTTP, autenticación, Services, Repositories, modelos y transacciones contra MySQL real, con datos sintéticos. Solo los puntos de fallo y las barreras para provocar carreras se instrumentan desde las pruebas; no se sustituye el transporte SQL ni se agrega infraestructura de concurrencia al backend.

- B1: down/up en una base exclusiva sin snapshots preserva los atributos anteriores y deja el par NULL; escrituras reales rechazan pares incompletos y negativos y admiten los límites representables. La migración rechaza down cuando ya existen snapshots.
- Registro: proveedor automático y único, activos, fechas, precisión DIA/MES, agotadas, códigos correlativos, importes pequeños y máximos, desbordamientos, snapshots comunes y promedio agrupado independiente del orden. Se preservan MES históricos no canónicos y detalles sin estado anterior.
- Horas: Compra y movimientos conservan el mismo texto civil correcto en America/La_Paz; la sesión global no cambia. MES admite el último día inclusive y se rechaza si una espera real cruza su corte comercial antes de tomar el instante de operación.
- Atomicidad: fallos inyectados después de escrituras SQL reales en cada etapa, incluida la lectura final, y un error FK real después de un movimiento previo revierten todos los datos relacionados. La misma clave puede reintentarse después del rollback.
- Concurrencia: dos prechecks simultáneos vacíos para una misma clave producen un solo commit y un 409 específico del UNIQUE; claves distintas sobre la misma existencia serializan snapshots y conservan stock/promedio. Existencias nuevas reciben códigos únicos y solicitudes con orden inverso de medicamentos respetan el orden estable de bloqueos.
- Contención y estados: esperas observadas mediante performance_schema verifican la validación posterior al bloqueo y la inactivación concurrente de medicamentos o proveedor. Lock wait timeout y deadlock reales devuelven el conflicto de contención, revierten la compra y admiten reintento. El escenario de deadlock toma filas individuales por PK para formar deliberadamente el ciclo en la base aislada.
- Consultas e historial: filtros inclusivos, claves propias/ajenas, compras anuladas y referencias inactivas conservan los permisos y los datos históricos. Se comprueba un original por detalle y conciliación entre saldo físico y movimientos. Para la futura B1/A, los movimientos de otras existencias no cuentan como posteriores; salida/entrada con el mismo saldo y movimientos de la misma hora siguen siendo detectables por IDs. CU27 no se implementa en esta fase.

Verificación conjunta final: 116 pruebas aprobadas, cero fallidas, canceladas u omitidas. Compras ejecutó 84 comprobaciones HTTP y observó 1014 sentencias SQL reales en su base temporal. La regresión real de Fases 1A/1B ejecutó 88 comprobaciones HTTP y 140 SELECT en otra base temporal exclusiva. Se incluyen las suites puras y HTTP sin conexión anteriores. Ambas bases fueron eliminadas y se confirmó su ausencia mediante information_schema; las pruebas no escribieron en las bases de desarrollo, producción ni pruebas compartidas.

```text
node --test tests/compra.integration.test.js tests/inventario.integration.test.js tests/compra.registro.http.test.js tests/compra-b1.schema.test.js tests/compra.http.test.js tests/compra.validator.test.js tests/decimal.test.js tests/fecha-operacion.test.js tests/vencimiento.test.js tests/inventario.validator.test.js tests/inventario.http.test.js
```

La aceptación incluye proveedor automático y único, activos y vencimientos, límites y redondeo, saldo cero, existencias nuevas y reutilizadas, snapshots comunes, escrituras concurrentes, clave repetida, rollback y regresión de Fases 1A/1B. Las pruebas de diseño de B1/A comprueban datos conservados, cálculos y selección por historial, incluidos movimientos con la misma hora y operaciones que dejan el mismo saldo. La escritura de reversiones de compra, originalmente prevista para la Fase 5, se adelantó con CU27. Las pruebas que escriben requieren autorización específica para una base aislada.

#### CU27 adelantado — anulación de compra

Implementado después de Fase 2.4 por solicitud expresa. Se reutilizan el esquema y la migración B1 existentes, sin una nueva migración. CU30 permanece pendiente.

`POST /api/compras/:idCompra/anular` requiere autenticación y rol Administrador. Admite exclusivamente `{ "motivo": "Corrección de compra" }`, con motivo obligatorio de 1 a 255 caracteres después de recortar espacios exteriores. El ID es entero positivo dentro de INT; no admite filtros query ni fecha, estado, usuario o modalidad enviados por el cliente. Responde 200 con `{ message: 'Compra anulada exitosamente', data }`, usando el mismo DTO de consulta por ID, únicamente después del commit.

CompraService bloquea primero la cabecera y sus detalles, luego las existencias por ID ascendente. Las lecturas de movimientos y reversiones son actuales bajo bloqueo, no snapshots anteriores a una espera. No se exige actividad actual de medicamentos/proveedor ni vendibilidad de los vencimientos. Se validan todos los grupos antes de escribir:

- Un original íntegro por detalle, con existencia, cantidad y costo coincidentes, dirección ENTRADA, motivo Compra y sin referencia a movimiento original ni detalle de venta.
- Historial de cada existencia con cantidades/costos representables, direcciones válidas, referencias de reversión coherentes y saldo físico conciliado con entradas/salidas. Un enlace incorrecto a un detalle no se ignora aunque apunte a otra existencia.
- Snapshots completos e idénticos por grupo o todos NULL. Pares parciales, mezcla de NULL y valores, contradicciones, intercalaciones y reversiones previas impiden anular; A no elude esas inconsistencias.
- B1 comprueba saldo y promedio agrupado esperados y restaura una sola vez el par anterior exacto, incluido el promedio histórico de una agotada. Sin posteriores ni snapshots se rechaza el legado; no se reconstruye ni completa.
- A aplica RN76 al estado actual usando cantidad y costo original de seis decimales, no subtotales de dos decimales. Se rechazan stock insuficiente, residual negativo, residual no nulo a saldo cero o promedio fuera de rango. Con saldo cero y residual cero conserva el promedio actual.

Dentro de la misma transacción se actualizan saldos/promedios, se crea una SALIDA de motivo Reversión por original, conservando existencia, cantidad y costo y referenciando tanto el original como su detalle de compra, y se marca la compra ANULADA con fecha, motivo y usuario autenticado. La observación de cada reversión conserva el motivo. Un único instante posterior a los bloqueos produce la misma hora civil America/La_Paz para cabecera y reversiones, mediante STR_TO_DATE y DATE_FORMAT. Se conservan originales, detalles, snapshots, total, fecha de adquisición, clave y códigos de existencia.

Los errores mantienen el contrato global: 400 para entrada inválida; 401/403 para sesión/permisos; 404 para compra inexistente; 409 para doble anulación, insuficiencia, valoración incompatible, integridad o contención; 500 genérico para errores inesperados. Timeout/deadlock se traducen después del rollback, sin reintento automático. El bloqueo de cabecera y el UNIQUE de movimiento original impiden dos anulaciones efectivas. Ante una respuesta perdida, GET por ID permite consultar el estado; repetir la anulación ya confirmada devuelve 409.

Verificación de CU27 y regresiones: 130 pruebas aprobadas, cero fallidas, canceladas u omitidas. `tests/compra.integration.test.js` incluye CU25–CU27 con 179 comprobaciones HTTP y 2339 sentencias reales observadas. Cubre mezcla B1/A, redondeo residual, agotadas/nuevas, legado, inconsistencias, intercalaciones, permisos, vencidos/inactivos, rollback en cada etapa, doble anulación concurrente, anulación de compras distintas sobre una existencia, espera a una compra concurrente, timeout y deadlock reales. La regresión 1A/1B mantiene 88 comprobaciones HTTP y 140 SELECT reales. Ambas bases temporales autorizadas se eliminan al finalizar; no se registran anulaciones en desarrollo ni se modifican históricos reales.

---

#### Frontend — sexta entrega: Anulación de Compras (CU27)

El detalle `/compras/:idCompra` incorpora un formulario de anulación exclusivamente para Administrador cuando el estado consultado es CONFIRMADA. Regente conserva la consulta sin formulario y Vendedor no accede al detalle. No se restringe por registrador de la compra, actividad actual del proveedor/medicamento o vencimiento histórico. Se valida motivo obligatorio de hasta 255 caracteres después de recortar espacios exteriores; no se seleccionan líneas ni modalidades B1/A en React. La revisión muestra identificación, fecha de adquisición, proveedor registrado, total exacto, cantidad de detalles y motivo. Explica que se compensa la compra completa preservando sus originales y que el backend valida todas las existencias antes de confirmar.

El servicio envía exclusivamente `{ motivo }` a `POST /api/compras/:idCompra/anular`, sin query ni estado, fecha, usuario, costos, snapshots o precondiciones de Ajustes/Retiros. La confirmación bloquea envíos duplicados, edición del motivo y actualización del detalle mientras el POST está pendiente. La respuesta 200 reemplaza el detalle con el DTO confirmado de la API, muestra el estado ANULADA, fecha/hora civil, responsable y motivo, conserva líneas repetidas/importes/costos/claves originales y retira el formulario. Los enlaces existentes a existencias e historial permiten consultar los saldos actuales y las reversiones; el frontend no calcula la valoración ni atribuye una modalidad B1/A al resultado.

400 conserva el motivo para corregirlo. 409 (doble anulación, stock, valoración, historial o contención), 404 posterior a preparación y resultados inciertos de red/500 bloquean otro envío hasta «Actualizar». La reconsulta usa GET por ID sin query, conserva el motivo local mientras la compra continúe confirmada y exige una nueva revisión. Durante la consulta se retiran detalle y formulario; una consulta fallida no habilita escritura y su reintento conserva el borrador. Una respuesta perdida puede recuperarse consultando el estado: si el GET devuelve ANULADA se muestran los datos realmente persistidos, incluido un motivo distinto registrado desde otra sesión, y no se vuelve a ofrecer anulación. Un GET confirmado no demuestra por sí solo rollback o finalización de una solicitud todavía pendiente. No hay reintentos automáticos ni idempotencia de POST; la autorización, atomicidad y prevención de segunda anulación pertenecen al backend. 401/403 bloquean la operación, 401 ofrece navegación completa al login y las respuestas tardías tras salir se ignoran. El borrador es estado local y se pierde al salir/recargar; cambiar de ID reinicia la pantalla.

Verificación secuencial: `node --test --test-concurrency=1 tests/inventario.browser.test.mjs tests/compras.browser.test.mjs tests/cu09.browser.test.mjs` aprobó 116 pruebas (43 de Compras CU25/CU26/CU27, 49 de Inventario/CU23/CU35/CU36 y 24 de CU09/Usuarios), cero fallidas, canceladas u omitidas. Tras precisar el contador de POST de registro de la suite, Compras se verificó nuevamente: 43/43 aprobadas, 112 peticiones interceptadas, 11 POST de registro y 18 POST de anulación simulados. Inventario conserva 231 peticiones y 35 POST simulados. Los nuevos casos cubren permisos, compras ajenas/catálogo inactivo, motivo/límites, contrato estricto, cancelación, doble confirmación, respuesta 200 sin GET adicional, datos originales, filtros al volver, consulta/recarga de anuladas, conflictos B1/A, anulación concurrente simulada, pérdida de respuesta tras commit simulado, errores y reconsulta fallida, sesiones, respuesta tardía, borrador por ruta y móvil a 375 px. `pnpm build` y revisión visual escritorio/móvil aprobados (bundle de 546.49 kB, 155.60 kB gzip; aviso no bloqueante por superar 500 kB). Las pruebas de navegador usan API simulada, no conectan ni escriben en MySQL y no acreditan concurrencia real integrada. La siguiente unidad acordada es aceptación de extremo a extremo con backend real, roles/sesiones y escrituras únicamente en bases temporales aisladas.

---

### Diseño técnico de API — Fase 3

**CU23 IMPLEMENTADO EN FASE 3.2; CU35 Y CU36 IMPLEMENTADOS EN FASE 3.3; INTEGRACIÓN REAL VERIFICADA EN FASE 3.4.** La Fase 3.0 documenta estas operaciones. Las consultas de Inventario de Fases 1A/1B y Compras CU25–CU27 están implementadas; la Fase 3.1 incorpora los validadores, la ampliación de CU22 y las lecturas de Repository descritas a continuación. Las Fases 3.2/3.3 incorporan el registro transaccional de Ajustes y Retiros, con verificación pura/simulada; 3.4 verifica persistencia, rollback y concurrencia reales en una base temporal aislada. Se reutilizan ExistenciaMedicamento y MovimientoInventario, sin tablas ni columnas nuevas.

| Método y ruta | Caso de uso | Actor autorizado | Estado |
|---|---|---|---|
| `POST /api/inventario/ajustes` | CU23 | Regente | Implementado en 3.2 |
| `POST /api/inventario/retiros/vencimiento` | CU35 | Regente | Implementado en 3.3 |
| `POST /api/inventario/retiros/dano` | CU36 | Regente | Implementado en 3.3 |

Administrador y Vendedor no heredan estos permisos. Las tres rutas utilizan authMiddleware y requireRole con ROLES.REGENTE. Las reglas funcionales pertenecen al Service y las consultas a los Repositories.

#### Ampliación de CU22 y precondiciones

`GET /api/inventario/medicamentos/:idMedicamento/existencias` conserva su contrato y permisos, agregando desde Fase 3.1 por existencia `ultimoMovimiento`, calculado como el mayor `id_movimiento` de esa existencia, o `null` si nunca tuvo movimientos. No es una columna nueva ni un marcador global. `stockFisico` y `ultimoMovimiento` provienen de la misma lectura coherente mediante un MAX correlacionado dentro de la misma sentencia de existencias, sin combinar consultas realizadas en momentos diferentes. La ampliación se limita a CU22; las demás consultas conservan sus DTO.

El cliente enviará `stockObservado` a partir de `stockFisico` y `ultimoMovimientoObservado` a partir de `ultimoMovimiento`. Ambos campos son obligatorios; `ultimoMovimientoObservado` admite `null`, pero cero no representa ausencia. El par detecta cambios de historial aunque el saldo vuelva al valor anterior, y no cambia por movimientos de otras existencias.

#### Entrada

Los cuerpos son estrictos, sin campos adicionales ni parámetros query de escritura. IDs y cantidades utilizan números enteros dentro de INT (`2147483647`): `idExistencia` e IDs de movimiento no nulos son positivos; `stockObservado` y `saldoContado` admiten cero; `cantidad` de retiro es positiva.

- Ajuste: `idExistencia`, `saldoContado`, `stockObservado`, `ultimoMovimientoObservado`, `observacion` y, únicamente para una entrada, `costoUnitario`. La observación se recorta y debe tener entre 1 y 500 caracteres, incluso sin diferencia. `costoUnitario` es una cadena decimal estrictamente positiva, con hasta seis decimales y dentro de DECIMAL(14,6) (`99999999.999999`), sin truncar precisión excesiva. Se exige cuando `saldoContado > stockObservado` y se prohíbe en los demás casos; el Service comprueba primero las precondiciones y no reclasifica solicitudes desactualizadas.
- Retiro por vencimiento: `idExistencia`, `cantidad`, `stockObservado`, `ultimoMovimientoObservado` y `observacion` opcional. Si se proporciona, se recorta y debe tener entre 1 y 500 caracteres; omitida se guarda NULL.
- Retiro por daño: los mismos campos, con `observacion` obligatoria de 1 a 500 caracteres después de recortar.

El cliente no define dirección, diferencia, costo alternativo de salida, pérdida, motivo del movimiento, usuario ni fecha/hora. El backend obtiene el responsable de la sesión y un único instante posterior a los bloqueos en America/La_Paz; las escrituras nuevas conservan hora civil mediante STR_TO_DATE y las lecturas mediante DATE_FORMAT, sin reinterpretar históricos ni cambiar el timezone global.

#### Reglas y valoración

El ajuste calcula `diferencia = saldoContado - saldoRegistrado` sobre la existencia bloqueada. Una diferencia positiva genera ENTRADA por esa cantidad y promedio ponderado con precisión exacta y un único redondeo a seis decimales, al más cercano con empate hacia arriba. Un saldo anterior cero excluye el valor del promedio histórico. Una diferencia negativa genera SALIDA por su valor absoluto al promedio vigente, permitido cero, y conserva el promedio almacenado incluso al agotar la existencia. Sin diferencia se verifican las precondiciones y la observación, pero no se modifica saldo/promedio ni se crea movimiento u otro registro histórico: la respuesta y observación no constituyen una auditoría persistida del conteo.

Los retiros generan SALIDA, requieren saldo suficiente y aplican el promedio vigente, permitido cero, conservándolo incluso con saldo final cero. CU35 exige vencimiento efectivo según DIA/MES y el instante comercial posterior a los bloqueos (RN29); MES vence al comenzar el primer día del mes siguiente. CU36 exige daño identificado y observación, sin exigir vencimiento. Ajustes y retiros operan solo sobre existencias registradas, incluso vencidas o de medicamentos inactivos; no crean existencias arbitrarias, reactivan productos, cambian vencimientos ni convierten stock vencido en vendible.

Los cálculos reutilizan decimalAEntero, enteroADecimal y dividirYRedondear con BigInt. Se validan los límites de cantidades, saldos, costos y promedios persistidos. La pérdida de un retiro se deriva de `cantidad × costoUnitarioAplicado`, conserva precisión exacta intermedia y se presenta como cadena de dos decimales con el redondeo aprobado. No se agrega una columna de pérdida ni se impone a este resultado derivado el límite de un DECIMAL(14,2) que no se persiste. Daño, vencimiento y ajustes negativos permanecen separados; esta fase no implementa reportes.

La nomenclatura vigente se toma de `backend/src/shared/constants/motivos-movimiento.js`: COMPRA, VENTA, ANULACION_COMPRA, ANULACION_VENTA, AJUSTE, VENCIMIENTO y DAÑO. La corrección de Compras ya está aplicada: CU25 escribe COMPRA y CU27 ANULACION_COMPRA; Compra y Reversión son representaciones anteriores de compatibilidad controlada, y ANULACION_VENTA identifica exclusivamente compensaciones legítimas de venta. Las menciones de Compra/Reversión en la descripción anterior de CU27 corresponden a la nomenclatura de esa implementación previa. No se reabre su diseño. CU35 utiliza VENCIMIENTO y CU36 DAÑO. El usuario aprobó **AJUSTE** como literal oficial para CU23 antes de implementar Fase 3.2; las nuevas escrituras utilizan ese valor. Ajuste, presente en fixtures anteriores, no se oficializa ni se normaliza en históricos.

#### Transacción y lectura actual del marcador

Secuencia implementada para cada operación, incluida la conciliación sin diferencia (verificada con InnoDB real en 3.4):

1. Iniciar una transacción Sequelize y bloquear la existencia por PK con FOR UPDATE; si no existe, responder 404.
2. Consultar su último movimiento con una lectura actual bloqueante: `SELECT id_movimiento FROM movimiento_inventario WHERE id_existencia = ? ORDER BY id_movimiento DESC LIMIT 1 FOR UPDATE`; sin filas, el marcador es NULL.
3. Comparar saldo físico y marcador actuales con `stockObservado` y `ultimoMovimientoObservado`; cualquier diferencia produce 409 antes de efectos o de declarar que no hay ajuste.
4. Obtener el instante comercial posterior a los bloqueos y validar conteo, costo, observaciones, stock y, para CU35, vencimiento efectivo.
5. Calcular el resultado; actualizar saldo/promedio y registrar un movimiento sobre esa existencia cuando corresponda, con IDs automáticos y sin referencias de compra, venta o reversión para estos movimientos independientes.
6. Mantener el bloqueo hasta commit o rollback; responder éxito únicamente después del commit. Un fallo revierte toda la operación.

MySQL utiliza REPEATABLE READ. Un SELECT ordinario, incluido un MAX ordinario durante la escritura, puede reutilizar un snapshot anterior; no sirve como comprobación definitiva del marcador después de una espera. La Fase 3.1 prepara `existenciaMedicamentoRepository.findByIdParaMovimiento` para bloquear la existencia y `movimientoInventarioRepository.findUltimoIdParaExistencia` para obtener el ID nullable mediante SELECT ordenado con LIMIT 1 FOR UPDATE; ambos requieren una transacción. `inventarioService.registrarAjuste` coordina estas lecturas desde Fase 3.2 antes de calcular diferencias, incluso sin efectos. En Fase 3.3, `registrarRetiroVencimiento` y `registrarRetiroDano` coordinan el mismo protocolo mediante un flujo interno compartido que recibe el motivo desde esos métodos, nunca del cliente. La Fase 3.4 verificó con esperas reales que el MAX ordinario continúa viendo el snapshot anterior mientras la lectura bloqueante devuelve el marcador actual confirmado y produce 409 si cambió. El MAX de CU22 es una proyección coherente de consulta, no sustituye esta lectura actual de escritura. Cada operación afecta una existencia y no añade bloqueos posteriores de Medicamento o Compra.

Las precondiciones son control de concurrencia, **no idempotencia completa**: no hay clave persistida para recuperar automáticamente una respuesta perdida. Con efectos, dos solicitudes con el mismo par observado deben permitir como máximo un commit; dos conciliaciones sin diferencia pueden responder 200 sin efectos. La garantía depende de que las escrituras controladas bloqueen la existencia antes del INSERT, mantengan el bloqueo hasta terminar y conserven el historial; no cubre DML externo, seeders, renumeración o eliminación de movimientos que incumplan ese protocolo.

#### Respuestas y compatibilidad con CU27

Se utiliza el formato existente de éxito `{ message, data }` y de errores del middleware global. 201 Created corresponde a un movimiento registrado; 200 OK, exclusivamente a una conciliación sin diferencia, informando que no fue necesario ajustar. La respuesta distingue ambos resultados y devuelve el estado resultante; el conteo sin movimiento no se presenta como una operación histórica persistida.

CU23 implementa ese formato con `data = { ajusteRealizado, idExistencia, saldoAnterior, saldoContado, diferencia, stockFisico, costoUnitarioPromedio, ultimoMovimiento, movimiento }`. Una operación efectiva devuelve 201, mensaje `Ajuste registrado exitosamente` y el movimiento creado con ID, existencia, responsable, dirección, cantidad, costo aplicado, AJUSTE, observación y fecha civil, con referencias de compra/venta/original en null. Una conciliación sin diferencia devuelve 200, mensaje `No fue necesario ajustar la existencia`, `ajusteRealizado: false` y `movimiento: null`; mantiene promedio y marcador, y no incluye una observación pretendidamente persistida. En ambos casos la respuesta se entrega después del commit de la transacción gestionada.

CU35/CU36 devuelven 201 con `data = { idExistencia, saldoAnterior, cantidadRetirada, stockFisico, costoUnitarioPromedio, perdida, ultimoMovimiento, movimiento }`. La pérdida es una cadena de dos decimales derivada del movimiento, sin límite artificial DECIMAL(14,2), y el promedio se conserva incluso al agotar la existencia. El movimiento incluye ID, existencia, responsable, SALIDA, cantidad, costo aplicado, VENCIMIENTO o DAÑO, observación y fecha civil; las referencias de compra/venta/original son null. La observación omitida en CU35 queda en null; CU36 exige observación. El mensaje es `Retiro por vencimiento registrado exitosamente` o `Retiro por daño registrado exitosamente`, después del commit.

400 corresponde a entrada inválida; 401 a sesión inválida; 403 a rol no autorizado; 404 a existencia inexistente; 409 a precondiciones desactualizadas, stock insuficiente o conflicto funcional. Errores inesperados utilizan el 500 genérico existente; timeout/deadlock requieren rollback y se tratan como contención temporal conforme a las convenciones de Compras, sin reintento automático.

Un ajuste o retiro efectivo es un movimiento posterior sobre su existencia para RN76: puede impedir B1, conducir a A o provocar rechazo de CU27 por stock/valoración incompatibles. La conciliación sin diferencia no agrega posteriores. Se conservan B1 + A, snapshots, movimientos originales, costos históricos y comprobaciones de CU27.

#### Subfases y verificación

Fase 3.0: documentación; 3.1: contratos/validadores, ampliación de CU22 y lecturas de Repositories; 3.2: ajustes completos; 3.3: retiros completos; 3.4: integración, concurrencia y regresión. La Fase 3.1 implementa `validateAjuste`, `validateRetiroVencimiento` y `validateRetiroDano` con cuerpos estrictos, precondiciones obligatorias y normalización decimal exacta. Estos validadores no consultan stock ni vencimiento: las reglas sobre el estado actual se comprueban en el Service. La Fase 3.2 implementa CU23 y la Fase 3.3 implementa CU35/CU36. Las entregas 3.1–3.3 se verificaron sin escrituras reales; el usuario autorizó continuar con 3.4 y sus escrituras se ejecutan exclusivamente sobre bases temporales locales, con las migraciones existentes, sin modificar el esquema del proyecto ni los datos de las bases protegidas.

Verificación de Fase 3.1: 133 pruebas puras y simuladas aprobadas, cero fallidas, canceladas u omitidas, incluyendo regresiones de Inventario y Compras/B1/A. CU22 se verifica por HTTP y generación SQL con resultados de SELECT simulados; los nuevos Repositories se verifican con SQL generado, transacción como objeto sin BEGIN y resultados simulados. Ninguna de estas pruebas conecta ni escribe en MySQL; no acreditan aislamiento o concurrencia real de InnoDB.

Verificación de Fase 3.2: 153 pruebas puras y simuladas aprobadas, cero fallidas, canceladas u omitidas, incluyendo 60 comprobaciones HTTP de CU23 y regresiones de Inventario, Compras y B1/A. `tests/inventario.ajuste.http.test.js` ejecuta las capas y generación SQL reales con transporte, estado transaccional y commit/rollback simulados: cubre permisos, límites, redondeo, agotadas, promedio cero, marcador null, conciliación sin efectos, precondiciones obsoletas, saldo restaurado con historial distinto, repetición posterior al commit, rollback y contención sin reintento automático. Las regresiones de CU27 incluyen AJUSTE oficial de entrada/salida como posterior para A y rechazo por agotamiento. No se abren conexiones reales ni se escriben datos en MySQL; las repeticiones secuenciales no demuestran carreras concurrentes.

Verificación de Fase 3.3: 174 pruebas puras y simuladas aprobadas, cero fallidas, canceladas u omitidas, incluyendo 129 comprobaciones HTTP de CU35/CU36 y las regresiones de Ajustes, Inventario y Compras/B1/A. `tests/inventario.retiro.http.test.js` verifica SQL real generado con transporte y estado transaccional simulados: permisos exclusivos, observaciones, promedio cero/conservado, agotamiento, stock insuficiente, marcador null/obsoleto, repeticiones secuenciales, rollback y contención. Los cortes DIA/MES se evalúan con el reloj posterior a ambos bloqueos, incluidos febrero bisiesto/no bisiesto y cambio de año. La pérdida máxima derivada se conserva como cadena `214748364699997852.52`, sin columna ni límite DECIMAL(14,2). Las regresiones de CU27 verifican que ambos motivos de retiro cuentan como posteriores para A y pueden impedir la anulación por agotamiento, conservando historial y snapshots. No se abren conexiones reales ni se escriben datos en MySQL.

Verificación real de Fase 3.4: `tests/inventario.operaciones.integration.test.js` aprobó 26 pruebas, cero fallidas, canceladas u omitidas, con 200 comprobaciones HTTP y 1770 sentencias reales observadas en su ejecución final sobre MySQL 8.0.46 / REPEATABLE READ. Se verificaron CU22 coherente antes/después del commit, marcador null, decimales máximos y diminutos, promedio conservado/cero, persistencia de horas civiles, cortes DIA/MES posteriores a bloqueos y rollback InnoDB tras UPDATE/INSERT reales. Las pruebas fuerzan un snapshot previo, observan la espera en performance_schema y confirman el rechazo 409 cuando salidas/entradas concurrentes restauran el saldo pero cambian el marcador, incluidos CU23, CU35, CU36 y una conciliación sin diferencia. Las carreras con efectos permiten exactamente un 201 y un 409; dos conciliaciones sin diferencia permiten dos 200 sin cambios. Timeout y deadlock reales se verifican en las tres operaciones, con rollback y reintento posterior, sin reintento automático ni cambio de límites globales. Las regresiones B1/A ejercen los endpoints reales de Compra/anulación, los ajustes/retiros posteriores, stock agotado y esperas entre módulos. La conciliación final comprueba saldo físico contra movimientos y referencias/costos válidos.

Las bases `cadefar_test_operaciones_28a0861f38c9` (primera verificación) y `cadefar_test_operaciones_fe18e86efcda` (verificación final con actualizaciones explícitas de salida/entrada en el fixture de saldo restaurado) fueron eliminadas y su ausencia confirmada. Las huellas SHA-256 de datos y SHOW CREATE TABLE de las 16 tablas de `prueba` y las 16 de `cadefar_test` permanecieron idénticas antes/después y entre ejecuciones; las consultas a bases protegidas son exclusivamente SELECT/SHOW. Estas verificaciones acreditan los casos del protocolo ejercidos sobre MySQL local, manteniendo los límites de idempotencia y DML externo descritos anteriormente; las pruebas simuladas previas por sí solas no acreditaban esa concurrencia.

Regresión posterior de Fase 3.4: 229 pruebas aprobadas, cero fallidas, canceladas u omitidas (174 puras/simuladas, 39 de integración real de Compras y 16 de integración real de Inventario). Compras CU25–CU27 conservó sus 213 comprobaciones HTTP y verificó 2909 sentencias reales; Inventario 1A/1B conservó 88 comprobaciones HTTP y 140 SELECT reales. La base `cadefar_test_compras_30c54048d344` y la base temporal de Inventario fueron eliminadas al finalizar sus suites. Junto con las 26 pruebas nuevas de operaciones, la verificación cubre 255 pruebas distintas aprobadas y 501 comprobaciones HTTP contra MySQL real.

#### Frontend — cuarta entrega: Ajustes de Inventario (CU23)

Implementada `/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/ajuste` exclusivamente para Regente. Se accede mediante «Ajustar conteo» desde la consulta de existencias CU22, también para existencias vencidas, agotadas o de medicamentos inactivos. Administrador/Vendedor no ven la acción ni cargan la página protegida. El formulario consulta nuevamente CU22 al abrirse: no reutiliza precondiciones tomadas de la tabla o de las consultas de alertas.

La pantalla identifica medicamento/existencia, estado actual del catálogo, vencimiento consultado, stock físico/vendible, promedio y último movimiento observado. El par de escritura utiliza exclusivamente `stockFisico` y `ultimoMovimiento` de la misma respuesta CU22. Un marcador ausente o inválido bloquea la preparación; nunca se sustituye por null. Se valida el ID de medicamento/existencia y la pertenencia antes de habilitar el formulario. El usuario ingresa saldo contado entero entre cero y `2147483647`, observación obligatoria de hasta 500 caracteres y costo positivo de hasta seis decimales únicamente cuando el conteo supera el saldo observado. La revisión previa conserva y presenta los valores exactos que se enviarán.

POST utiliza `/api/inventario/ajustes` sin query y con los cinco campos obligatorios del contrato, agregando exclusivamente `costoUnitario` para entrada. React no envía dirección, diferencia, cantidad de movimiento, promedio alternativo, motivo, responsable o fecha. No duplica cálculos de valoración ni interpreta una existencia vencida/inactiva como vendible. Los errores conservan el borrador en estado local; 409, 404 posterior al conteo y resultados inciertos de red/500 bloquean otro envío hasta una consulta explícita. La reconsulta conserva el conteo y observación, reemplaza conjuntamente las precondiciones y requiere nueva revisión/confirmación. Si el nuevo stock cambia la clasificación de entrada a salida, el costo no se envía. No se reintenta automáticamente ni se afirma idempotencia o recuperación inequívoca de una respuesta perdida. 401/403 bloquean el registro y 401 ofrece navegación completa al login; las respuestas posteriores a salir se ignoran.

El resultado presenta los saldos, diferencia, promedio y marcador devueltos por el servidor. Una respuesta efectiva muestra el movimiento AJUSTE, dirección/cantidad, costo aplicado, responsable, observación y hora civil; una conciliación sin diferencia informa explícitamente que no se modificó la existencia ni se creó movimiento/auditoría, sin mostrar su observación como persistida. Se ofrecen enlaces para consultar existencias actualizadas e historial, y una acción para preparar otro conteo que vuelve a consultar antes de habilitar un formulario vacío. El stock vendible posterior se obtiene de la consulta de existencias, no se calcula a partir del resultado del ajuste.

Verificación final: `node --test --test-concurrency=1 tests/inventario.browser.test.mjs tests/compras.browser.test.mjs tests/cu09.browser.test.mjs` aprobó 88 pruebas distintas (34 de Inventario/CU23, 30 de Compras y 24 de CU09/Usuarios). Inventario interceptó 197 peticiones, incluidas 15 POST simuladas. Los nuevos casos verifican par fresco CU22, roles, IDs/pertenencia, marcador ausente/null, conteos/costos/observación, contrato exacto, doble confirmación, salida hasta cero, promedio cero/conservado, vencidas/inactivos, conciliación sin auditoría, historial cambiado con saldo restaurado, reconsulta explícita con borrador, errores/red y respuesta tardía tras salir. Revisión visual en escritorio y a 375 px; `pnpm build` aprobado (aviso no bloqueante por bundle de 527.78 kB, 151.89 kB gzip). La ejecución paralela de las suites mostró timeouts intermitentes de arranque con páginas vacías/Chrome sin respuesta; aislar temporalmente las cachés de Vite no los resolvió y se retiró ese cambio. La ejecución secuencial final pasó completa; se conserva diagnóstico del estado de página al agotar la espera. Estas pruebas usan API simulada: no se conectó ni escribió en MySQL y no acreditan concurrencia real de frontend/backend. La aceptación final sigue prevista sobre backend real y bases temporales aisladas.

---

#### Frontend — quinta entrega: Retiros por Vencimiento/Daño (CU35/CU36)

Implementadas `/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/retiro-vencimiento` y `/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/retiro-dano`, exclusivamente para Regente. CU22 ofrece acciones con saldo físico positivo y permite vencimiento únicamente cuando el estado calculado por el backend es vencido. La consulta de vencidos también enlaza a los retiros; al abrir la pantalla se obtiene nuevamente el par desde CU22, sin reutilizar precondiciones de la alerta. Administrador/Vendedor no ven las acciones ni acceden a las rutas protegidas. Daño permite existencias vencidas o medicamentos inactivos y no exige vencimiento; ambos retiros requieren saldo físico suficiente.

Se reutilizan con Ajustes la lectura validada de existencia y la presentación de su estado observado. El saldo y el último movimiento proceden conjuntamente de CU22; un marcador ausente no se sustituye por null. El formulario valida cantidad entera positiva hasta `2147483647`, no superior al físico observado, y observación de hasta 500 caracteres: obligatoria para daño y opcional para vencimiento. Antes de enviar se revisan existencia, motivo, cantidad, promedio consultado, par observado y observación. La confirmación bloquea envíos duplicados. Las fechas DIA/MES se presentan como texto civil; el frontend no determina el corte comercial ni calcula la pérdida.

Los POST utilizan `/api/inventario/retiros/vencimiento` y `/api/inventario/retiros/dano`, sin query, con `idExistencia`, `cantidad`, `stockObservado` y `ultimoMovimientoObservado`; agregan `observacion` cuando contiene texto, después de recortar espacios exteriores. No envían costo alternativo, motivo, pérdida, responsable ni fecha. Los errores conservan cantidad/observación; 409, 404 posterior a preparación y resultados inciertos de red/500 exigen una reconsulta explícita antes de otra revisión y confirmación. No hay POST automático ni garantía de idempotencia. Si la reconsulta reduce el saldo disponible, el usuario debe corregir la cantidad. 401/403 bloquean el registro y 401 ofrece navegación completa al login. Las respuestas posteriores a salir se ignoran; los borradores son estado local y se pierden al salir o recargar.

El resultado presenta únicamente los valores confirmados por el backend: saldo anterior, cantidad retirada, físico posterior, promedio conservado, pérdida exacta, movimiento de salida con motivo oficial VENCIMIENTO/DAÑO, costo aplicado, responsable, fecha/hora civil, observación y último movimiento. La pérdida se formatea desde su cadena decimal sin Number, incluyendo `214748364699997852.52`, sin límite artificial DECIMAL(14,2). Se ofrecen enlaces a existencias actualizadas e historial y una preparación de otro retiro que vacía el borrador y vuelve a consultar. El stock vendible actualizado se obtiene desde CU22.

Verificación final secuencial: `node --test --test-concurrency=1 tests/inventario.browser.test.mjs tests/compras.browser.test.mjs tests/cu09.browser.test.mjs` aprobó 103 pruebas (49 de Inventario/CU23/CU35/CU36, 30 de Compras y 24 de CU09/Usuarios), cero fallidas, canceladas u omitidas. Inventario interceptó 231 peticiones, incluidas 35 POST simuladas; Compras interceptó 58 peticiones, incluidas 11 POST simuladas. Los nuevos casos cubren roles, par fresco, IDs/pertenencia, marcador ausente/null, cantidades/observaciones, contratos exactos, corte MES desde reconsulta backend, saldo agotado, vencidas/inactivos, promedio cero/conservado, pérdida máxima exacta, doble confirmación, conflictos con historial cambiado y saldo restaurado, errores/red, borrador tras reconsulta fallida y respuesta tardía. Revisión visual escritorio/móvil a 375 px y `pnpm build` aprobados (bundle de 540.95 kB, 154.51 kB gzip; aviso no bloqueante por superar 500 kB).

Durante las regresiones reaparecieron páginas vacías intermitentes. El diagnóstico adicional de Chrome capturó `ERR_INSUFFICIENT_RESOURCES` al cargar módulos de Vite tras muchas recargas. Las suites de Inventario y Compras ahora compilan el frontend en un directorio temporal de su ejecución y lo sirven mediante Vite Preview, sin modificar `dist/`; la ejecución secuencial final pasó completa. Esto no acredita que la ejecución paralela esté resuelta. Las pruebas usan API simulada y no se conectan ni escriben en MySQL; la aceptación integrada continúa prevista con backend real y bases temporales aisladas. La siguiente entrega acordada es la interfaz de anulación de Compras CU27.

---

#### Aceptación integrada de las seis entregas frontend — Inventario y Compras

Ejecutada el 11/10/2026 mediante `node --test tests/aceptacion-real.browser.test.mjs` desde frontend. `tests/aceptacion-real.browser.test.mjs` crea y migra una base aleatoria local, carga fixtures sintéticos sin seeders, inicia el Express real y compila React para producción en un directorio temporal servido con Vite Preview (5179). La URL real del backend usa un puerto efímero, con CORS y cookies entre los dos orígenes locales. `tests/helpers/navegadorReal.mjs` controla Chrome mediante CDP con cinco contextos independientes: dos Administradores, dos Regentes y un Vendedor. Los usuarios ingresan por el formulario de login real; no se inyectan tokens ni respuestas API simuladas. El reloj del backend es real y las fechas de fixtures actuales/próximas se derivan del día comercial America/La_Paz.

Resultado final: 16 pruebas aprobadas, cero fallidas, canceladas u omitidas (15 casos y su prueba contenedora), 168 respuestas HTTP reales observadas y 32 POST de negocio reales, incluidos intentos rechazados por autorización. La suite verifica:

- Login real, cookie HttpOnly inaccesible desde JavaScript, ausencia de JWT en almacenamiento web y restauración de sesión por recarga; acciones/rutas por rol y 403 del backend sin efectos.
- CU25/CU26/CU22 con líneas repetidas, clave normalizada, costos diminutos de seis decimales, importes registrados, existencia común y snapshots anteriores iguales por grupo; promedio confirmado tanto en MySQL como en la consulta React.
- CU23 sin diferencia sin movimiento/auditoría; CU27 B1 restaura saldo/promedio previos, conserva íntegros detalles/snapshots y genera una reversión por original con la misma existencia/cantidad/costo. CU25 reutiliza MES histórico no canónico; un retiro posterior conduce a la compensación A, verificada desde SQL y las pantallas.
- Ajustes de entrada/salida hasta cero con promedio confirmado/conservado y actualización entre módulos. Vencimientos DIA/MES e inactividad mantienen la diferencia físico/vendible; MES del mes comercial vigente permanece no vencido y las consultas de próximos/vencidos muestran sus fixtures reales.
- CU35/CU36 parciales/totales, observación opcional de vencimiento, promedio cero/conservado, retiro de un medicamento inactivo y desaparición de la alerta al agotar su físico. La pérdida máxima real `214748364699997852.52` llega a React sin redondeo ni conversión a Number, y se presenta sin desbordamiento a 375 px.
- Dos sesiones de Regente preparan operaciones sobre una existencia. Una salida/entrada que restaura el saldo pero cambia su historial produce 409 para el borrador anterior, sin movimiento adicional; la reconsulta conserva cantidad y observación.
- En una carrera de dos retiros y otra de dos anulaciones se retiene un bloqueo real con una conexión SQL de la base temporal. `performance_schema.data_lock_waits` acredita dos transacciones HTTP diferentes esperando el mismo bloqueo InnoDB antes de liberarlo. Los retiros producen exactamente un 201 y un 409; las anulaciones exactamente un 200 y un 409, con una única reversión por original. La sesión perdedora debe reconsultar y no realiza POST automático.
- Pérdida de respuesta de CU25 y CU27 después del commit real: CDP descarta únicamente las respuestas POST exitosas en la etapa Response, después de leer su DTO genuino; no altera la solicitud ni fabrica estados/cuerpos. SQL confirma persistencia, CU25 recupera por clave y CU27 por ID, bloqueando duplicación desde el formulario.
- Logout real en una segunda pestaña del mismo contexto invalida la cookie compartida; una pestaña con estado público obsoleto recibe 401 al actualizar y la navegación completa al login descarta ese estado. La conciliación final SQL verifica todos los saldos contra movimientos, ausencia de negativos, referencias/costos de reversiones y horas civiles coincidentes entre compras y entradas. No se observaron errores JavaScript ni secretos en respuestas públicas.

La primera tentativa encontró MySQL80 detenido y falló antes de crear bases; el servicio se inició para la verificación y queda activo. Se ajustó la infraestructura de aceptación para conservar también la ausencia de la base de producción configurada, reconocer la salida ANSI de Vite y esperar el cambio de ruta antes de usar el detalle recuperado. Las bases temporales `cadefar_e2e_63c5a3f8c9f48bb2`, `cadefar_e2e_fe75a5e536d84c07` y la final `cadefar_e2e_a7a6ca7c433d5f37` fueron eliminadas, con ausencia confirmada en cada ejecución que las creó. No se requirieron cambios en el código funcional del frontend/backend ni dependencias nuevas.

Las huellas SHA-256 de datos y SHOW CREATE TABLE, obtenidas mediante SELECT/SHOW y serialización canónica de filas, fueron idénticas antes/después en cada ejecución: `prueba`, 16 tablas, `18fe1970825e47f3ca92b16517235afb08e6844383c612a433e125a77707c951`; `cadefar_test`, 16 tablas, `bb1361d71b03e4817dc9b74eac3d8cd36fdd021f9367b1b729634574f901e79f`. Estas huellas usan la serialización de esta suite y no sustituyen el algoritmo de las verificaciones backend anteriores. `cadefar_production` permanece ausente. La huella del archivo `backend/tests/compra.integration.test.js` también se conservó exactamente. Los procesos de Express, Vite y Chrome y sus directorios temporales se cerraron/eliminaron al finalizar.

Esta evidencia completa la aceptación automatizada integrada del alcance Inventario/Compras ejercido, complementando las 116 pruebas de navegador con API simulada y las verificaciones backend anteriores. No se presenta como aceptación de Ventas/Recetas/Reportes ni como aprobación manual del usuario con sus datos. Tampoco acredita idempotencia de POST, DML externo incompatible o resolución de la ejecución paralela de suites; conserva los límites documentados del protocolo. Las escrituras reales de aceptación se realizaron exclusivamente en las bases temporales descritas.

---

## 12. Estructura del backend

```text
backend/
├── src/
│   ├── presentation/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   └── dtos/
│   │
│   ├── business/
│   │   ├── services/
│   │   └── validators/
│   │
│   ├── data/
│   │   ├── models/
│   │   ├── repositories/
│   │   └── database/
│   │       ├── config/
│   │       ├── migrations/
│   │       └── seeders/
│   │
│   ├── shared/
│   │   ├── errors/
│   │   ├── utils/
│   │   └── constants/
│   │
│   └── app.js
│
├── server.js
├── .env
├── .sequelizerc
├── package.json
└── pnpm-lock.yaml
```

---

## 13. ESM y CommonJS

El backend principal utiliza ESM:

```text
import
export
```

El `package.json` principal utiliza:

```json
{
  "type": "module"
}
```

Sequelize CLI genera modelos CommonJS:

```text
require
module.exports
```

Para mantener compatibilidad, dentro de:

```text
src/data/models/
```

se utiliza:

```text
package.json
```

con:

```json
{
  "type": "commonjs"
}
```

Por lo tanto:

- Controllers usan ESM.
- Services usan ESM.
- Repositories usan ESM.
- Routes usan ESM.
- `app.js` y `server.js` usan ESM.
- Modelos generados por Sequelize CLI permanecen CommonJS.

Desde un Repository ESM:

```js
import db from '../models/index.js';

const { Usuario } = db;
```

La configuración de Sequelize CLI utiliza:

```text
config.cjs
```

---

## 14. Sequelize y base de datos

Sequelize se utiliza como ORM.

Conceptualmente:

```text
Model
→ representa una tabla

Repository
→ utiliza el Model para consultar o modificar datos
```

Ejemplos:

```js
Usuario.create(...)
Usuario.findOne(...)
Usuario.findAll(...)
```

No utilizar `sequelize.sync()` para definir la estructura principal de la base.

La estructura de la base se administra mediante migrations.

Las claves primarias numéricas utilizan:

```text
INT AUTO_INCREMENT
```

No calcular IDs manualmente mediante:

```text
ultimoId + 1
```

No se considera necesario utilizar UUID para la versión actual.

---

## 15. Validaciones

Se utiliza Zod para validación de entrada.

Zod se utiliza para validar:

- Tipo de dato.
- Campos obligatorios.
- Longitud.
- Formato.
- Estructura.

Las reglas de negocio se validan en el Service.

Ejemplos:

```text
Zod:
"¿idRol es un entero positivo?"

Service:
"¿ese rol realmente existe y está activo?"
```

La base de datos permanece como última barrera de integridad mediante:

- PK.
- FK.
- UNIQUE.
- NOT NULL.
- CHECK cuando corresponda.

---

## 16. Manejo de errores

Existe una clase:

```text
AppError
```

para errores esperados de la aplicación.

Ejemplo:

```js
throw new AppError('El nombre de usuario ya está en uso', 409);
```

Los controllers utilizan `try/catch`.

En caso de error:

```js
next(error);
```

El middleware global `errorHandler` centraliza la respuesta.

Códigos principales:

```text
400 = datos inválidos
401 = no autenticado
403 = no autorizado
404 = no encontrado
409 = conflicto
500 = error interno
```

No agregar `try/catch` a Services o Repositories solamente para capturar y volver a lanzar el mismo error.

Un `catch` en esas capas solo tiene sentido si:

- Se transforma un error técnico.
- Se agrega contexto útil.
- Se puede recuperar de una situación concreta.

---

## 17. Autenticación

La autenticación utiliza:

- `bcrypt`
- `jsonwebtoken`
- `cookie-parser`
- JWT
- Cookie HttpOnly

### Login

El usuario envía:

```text
nombreUsuario
password
```

El proceso conceptual:

```text
Buscar usuario
↓
Verificar que exista
↓
Verificar estado activo
↓
bcrypt.compare()
↓
Generar JWT
↓
Guardar JWT en cookie HttpOnly
```

Payload mínimo:

```js
{
  idUsuario,
  idRol,
  versionCredenciales
}
```

Nunca incluir:

- `password`
- `password_hash`

El JWT está firmado, no cifrado.

No guardar información sensible en su payload.

### Recuperación de contraseña mediante correo electrónico — CU09

Los usuarios Administrador, Regente o Vendedor podrán restablecer una contraseña olvidada mediante el correo electrónico asociado a su cuenta. Para utilizar la recuperación deberán disponer de un correo registrado, sin necesidad de iniciar sesión ni conocer la contraseña anterior.

El sistema enviará un código temporal de verificación. El código deberá ser válido, no estar vencido ni haber sido utilizado, y validarse antes de permitir establecer la nueva contraseña. Su almacenamiento deberá estar protegido y se limitarán las solicitudes y los intentos de verificación. La respuesta pública no revelará si el correo pertenece a una cuenta registrada.

La nueva contraseña deberá cumplir la política de seguridad existente y seguirá almacenándose únicamente mediante hash. Un restablecimiento exitoso invalidará el código utilizado y los demás códigos de recuperación anteriores correspondientes a la cuenta, reiniciará los intentos fallidos y eliminará el bloqueo temporal de inicio de sesión.

Este mecanismo es independiente del cambio propio y del restablecimiento administrativo existentes en CU08; ambas operaciones se conservan. La recuperación no activará cuentas desactivadas administrativamente ni modificará roles o permisos, y no deberá debilitar los controles de autenticación y autorización.

Decisiones aprobadas e implementadas en el backend:

- `Usuario.correo`: opcional, nullable, único, `VARCHAR(255)` con `utf8mb4_bin`. Se normaliza con trim exterior y minúsculas, conservando puntos y `+`. Lo asigna el Administrador de forma supervisada, sin `correo_verificado`. Un PATCH omitido conserva el correo, `null` lo retira y un cambio efectivo invalida recuperaciones sin reiniciar cuotas de cuenta.
- `Usuario.version_credenciales`: `INT UNSIGNED DEFAULT 0`. JWT exige `versionCredenciales`; firma válida no basta si la versión difiere de la cuenta. Tokens antiguos sin versión se rechazan sin transición.
- CU08 y CU09 incrementan esa versión, invalidan recuperaciones y limpian intentos/bloqueo de login. CU08 propio renueva la cookie actual; CU08 administrativo y CU09 revocan sesiones anteriores. CU09 no inicia sesión automáticamente.
- Códigos de seis dígitos generados con `crypto.randomInt`, diez minutos de vigencia absoluta, cinco fallos máximos y un solo uso. Se almacena únicamente HMAC-SHA-256 vinculado a propósito, cuenta, correo normalizado, nonce y vencimiento; la comparación utiliza `timingSafeEqual`.
- El secreto HMAC es estable, explícito e independiente de JWT, sin generación automática ni fallback. No se requiere clave AES.
- Política compartida de contraseñas nuevas: 8–100 caracteres, complejidad existente y máximo 72 bytes UTF-8. No se truncan ni normalizan contraseñas; login y contraseña actual mantienen compatibilidad histórica.
- Cuotas persistentes: 60 segundos entre emisiones y tres por cuenta en ventana móvil de 15 minutos; 20 solicitudes y 30 restablecimientos por IP en ventanas de 15 minutos desde la primera petición. Una emisión persistida consume cuota aunque falle el correo.
- La IP procede exclusivamente del socket. IPv4 mapped se unifica con IPv4; IPv6 se agrupa por /56. Las claves IP se almacenan como HMAC por ámbito, sin IP en claro. No se confía en cabeceras ni se usa fallback de cuotas a memoria.

Flujo simplificado de envío:

```text
validar entrada/cuota IP → buscar cuenta activa → bloquear Usuario
→ comprobar cuota de cuenta → invalidar anterior/persistir HMAC/vencimiento
→ COMMIT → un intento de correo → resultado sanitizado → respuesta genérica
```

El componente `recuperacion-mail.js` soporta mock local/test y Brevo mediante `fetch` HTTPS, sin SDK, con timeout de cinco segundos y cancelación. No hay procesador persistente, polling, reservas, reconciliación, reintentos automáticos ni mensajes cifrados pendientes. Un rechazo explícito invalida exclusivamente la emisión correspondiente; timeout, fallo de red, respuesta 5xx o aceptación incierta conservan el código hasta vencimiento. Una caída entre commit y envío requiere una nueva solicitud manual sujeta a cuotas. Aceptación del proveedor no garantiza entrega al buzón.

Las solicitudes válidas dentro de la cuota IP tienen una espera pública mínima de cinco segundos, incluso para correos desconocidos, inactivos o emisiones suprimidas. Reduce diferencias evidentes con el timeout, sin afirmar tiempo constante. Los errores de validación, indisponibilidad y cuota IP son uniformes e independientes de la existencia de la cuenta.

La tabla `recuperacion_password` tiene nueve atributos definitivos:

```text
id_recuperacion, id_usuario, codigo_hmac, nonce, fecha_solicitud,
expira_en, intentos_fallidos, consumida_en, invalidada_en
```

Se conserva `limite_recuperacion_ip` con `ambito`, `clave_ip_hmac`, `ventana_hasta`, `cantidad` y PK compuesta por ámbito/HMAC. El consumo hace preverificación corta, bcrypt fuera de transacción y revalidación final, manteniendo orden de bloqueo Usuario → Recuperación y confirmando los fallos antes del error público.

API pública, sin cookie de autenticación en la respuesta:

- `POST /api/auth/recuperacion/solicitar`: `{ correo }`.
- `POST /api/auth/recuperacion/restablecer`: `{ correo, codigo, passwordNueva }`; valida y consume el código junto con el cambio de contraseña.

Estado local actualizado el 09/10/2026: las tres migraciones originales y la correctiva `20261009120300-simplify-recuperacion-password.js` están aplicadas en `cadefar_test` y en desarrollo local (`prueba`), con nueve columnas físicas de recuperación e historial conservado. La actualización de `prueba` fue autorizada y comprobó conservación de los registros y campos anteriores de las 13 tablas existentes, incluidos los hashes de los 16 usuarios. Los usuarios anteriores reciben correo NULL y versión inicial 0. La base configurada de producción local no existe; no se comprobó ni modificó Railway.

La correctiva conserva las migraciones originales y las filas, elimina cuatro columnas de envío y su índice en un único ALTER, y se detiene si contienen datos. Se ejecuta con el backend detenido y autorización; MySQL DDL hace commit implícito y no se proporciona rollback automático. Para otra base, revisar migraciones/datos y autorizar previamente; no reconstruir bases ni borrar historial. Las pruebas de integración crean/eliminan bases temporales con datos sintéticos autorizados, sin correos reales.

Pendientes: frontend de CU09, remitente/Brevo real y prueba de envío expresamente autorizada, y validación de infraestructura si se requiere otra fuente IP. CU09 continúa deshabilitado en la configuración local hasta su activación explícita. Requisitos RF40–RF42, RI15 y RNF15–RNF17; reglas RN107–RN115.

---

## 18. Cookies

El JWT se almacena en una cookie HttpOnly.

Configuración conceptual:

```js
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000
}
```

`HttpOnly` evita que JavaScript del navegador pueda leer directamente el token.

El navegador almacena la cookie y la envía automáticamente en las peticiones correspondientes.

---

## 19. AuthMiddleware

`authMiddleware`:

- Obtiene el JWT desde la cookie.
- Verifica la firma y expiración.
- Comprueba cuenta activa y coincidencia de `versionCredenciales` con la base de datos.
- Extrae el payload.
- Agrega la información a `req.usuario`.

Ejemplo:

```js
req.usuario = {
  idUsuario,
  idRol,
  versionCredenciales
};
```

Luego llama:

```js
next();
```

Los middlewares y controllers posteriores utilizan el mismo objeto `req`.

---

## 20. Autorización

Se utiliza un middleware factory:

```text
requireRole(...rolesPermitidos)
```

Ejemplo:

```js
requireRole(ROLES.ADMINISTRADOR)
```

Orden:

```text
authMiddleware
↓
requireRole(...)
↓
controller
```

`authMiddleware` autentica.

`requireRole` autoriza.

`requireRole` no debe volver a leer o verificar el JWT.

Utiliza:

```text
req.usuario.idRol
```

Los roles deben mantenerse centralizados mediante constantes y evitar números mágicos.

---

## 21. Logout

El logout elimina la cookie mediante:

```text
res.clearCookie(...)
```

En esta versión no existe una tabla de sesiones ni una blacklist de tokens.

Por lo tanto, una copia externa del JWT seguiría siendo válida hasta su expiración mientras la cuenta continúe activa y no cambie su versión de credenciales.

Para el alcance actual se considera suficiente.

`SesionUsuario` solo sería una mejora futura si apareciera el requisito de revocación inmediata.

Estas consideraciones describen el logout. CU08 y CU09 revocan sesiones anteriores incrementando `version_credenciales`, sin tabla de sesiones ni blacklist; logout sigue eliminando la cookie.

---

# FRONTEND

## 22. Tecnología y arquitectura del frontend

El frontend utilizará:

- React.
- Vite.
- React Router.
- Axios.
- Context API para autenticación.

Vite se utiliza como herramienta de desarrollo y construcción de la aplicación React.

La arquitectura del frontend será:

```text
Feature-Based Architecture
+
Component-Based Architecture
```

Es decir:

- Organización modular por funcionalidades.
- Interfaz dividida en componentes reutilizables.

El frontend no replica la arquitectura del backend.

Flujo conceptual:

```text
Page / Component
↓
Service
↓
API
↓
Backend
```

---

## 23. Estructura del frontend

```text
frontend/
├── public/
│
├── src/
│   ├── api/
│   │   └── api.js
│   │
│   ├── app/
│   │   └── router.jsx
│   │
│   ├── components/
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Modal.jsx
│   │   ├── Table.jsx
│   │   └── Loading.jsx
│   │
│   ├── layouts/
│   │   ├── MainLayout.jsx
│   │   └── AuthLayout.jsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── usuarios/
│   │   ├── proveedores/
│   │   ├── medicamentos/
│   │   ├── compras/
│   │   ├── ventas/
│   │   ├── inventario/
│   │   ├── vencimientos/
│   │   ├── recetas/
│   │   └── reportes/
│   │
│   ├── hooks/
│   │   └── useAuth.js
│   │
│   ├── routes/
│   │   ├── ProtectedRoute.jsx
│   │   └── RoleRoute.jsx
│   │
│   ├── constants/
│   │   └── roles.js
│   │
│   ├── utils/
│   │
│   ├── styles/
│   │   └── global.css
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── .env
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## 24. Organización por features

`features` representa las funcionalidades o módulos del frontend.

Puede entenderse como:

```text
feature ≈ módulo funcional
```

Ejemplo:

```text
features/usuarios/
├── pages/
├── components/
└── services/
```

### pages

Representan pantallas completas asociadas normalmente a rutas.

Ejemplo:

```text
UsuariosPage.jsx
UsuarioFormPage.jsx
```

### components

Componentes específicos de la feature.

Ejemplo:

```text
UsuarioForm.jsx
UsuarioTable.jsx
```

### services

Funciones encargadas de comunicarse con el backend.

Ejemplo:

```text
getUsuarios()
getUsuario(id)
createUsuario(datos)
updateUsuario(id, datos)
```

Los Services del frontend no contienen las reglas críticas del negocio.

---

## 25. Componentes globales

La carpeta:

```text
src/components/
```

se utiliza únicamente para componentes reutilizables en varias features.

Ejemplos:

- Button.
- Input.
- Modal.
- Table.
- Loading.
- ConfirmDialog.
- Pagination.

Los componentes exclusivos de un módulo permanecen dentro de:

```text
features/<modulo>/components/
```

---

## 26. API del frontend

Se utilizará un archivo central:

```text
src/api/api.js
```

para configurar Axios.

Conceptualmente:

```js
axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true
});
```

`withCredentials: true` es necesario porque la autenticación utiliza cookies.

La URL de la API se almacena en:

```text
VITE_API_URL
```

dentro del `.env` del frontend.

---

## 27. Autenticación en React

React no almacena el JWT manualmente.

No utilizar:

- `localStorage`
- `sessionStorage`
- estado de React para guardar el JWT

El JWT permanece en la cookie HttpOnly.

React mantiene únicamente información pública del usuario.

Ejemplo:

```js
{
  idUsuario,
  nombreUsuario,
  idRol
}
```

---

## 28. AuthContext

`AuthContext` se utilizará para mantener el estado global básico de autenticación.

Puede contener:

- Usuario autenticado.
- Estado de autenticación.
- Estado de carga.
- Función `login`.
- Función `logout`.

Un hook:

```text
useAuth()
```

permitirá acceder al contexto desde componentes.

No utilizar Redux o Zustand mientras no exista una necesidad real.

---

## 29. Recuperación de sesión

El estado de React desaparece al recargar la página, pero la cookie puede continuar vigente.

Por eso se recomienda implementar en el backend:

```text
GET /api/auth/me
```

Flujo:

```text
React inicia
↓
GET /api/auth/me
↓
Navegador envía cookie
↓
authMiddleware
↓
Backend devuelve usuario público
↓
AuthContext recupera sesión
```

---

## 30. Rutas protegidas

El frontend puede utilizar:

```text
ProtectedRoute.jsx
RoleRoute.jsx
```

`ProtectedRoute` controla si existe una sesión autenticada.

`RoleRoute` controla qué pantallas se muestran según el rol.

Esto solo controla la interfaz.

La seguridad real siempre se valida nuevamente en el backend mediante:

- `authMiddleware`
- `requireRole`

---

## 31. Responsabilidades del frontend

El frontend se encarga principalmente de:

- Mostrar información.
- Recibir datos del usuario.
- Validar formularios para mejorar la experiencia.
- Navegar entre pantallas.
- Mostrar u ocultar opciones según el rol.
- Consumir la API.
- Mostrar errores y resultados.
- Gestionar estado visual.

Las reglas críticas de negocio deben permanecer en el backend.

Ejemplo:

El frontend puede impedir visualmente vender más unidades de las disponibles.

Pero el backend debe volver a verificar:

- Stock.
- Vencimiento.
- Estado.
- Receta.
- Autorización.

---

## 32. Estado actual del desarrollo

Actualmente están implementados autenticación, usuarios, proveedores/laboratorios, medicamentos/composición, Inventario y Compras. El estado y la evidencia de cada bloque se detallan a continuación.

Implementado o diseñado:

- Creación de usuarios.
- Roles mediante seeders.
- Usuario Administrador inicial mediante seeder.
- Validación mediante Zod.
- Hash de contraseñas mediante bcrypt.
- Política de complejidad para contraseñas nuevas.
- Bloqueo temporal de inicio de sesión después de tres intentos fallidos.
- `AppError`.
- Middleware global de errores.
- Login.
- JWT.
- Cookie HttpOnly.
- Logout.
- `authMiddleware`.
- `requireRole`.
- Roles fijos.
- Listado y consulta de usuarios.
- Modificación y activación/desactivación de usuarios.
- Cambio propio y restablecimiento administrativo de contraseña.

El módulo Usuarios se encuentra implementado para el alcance actual del backend.

La recuperación de contraseña por correo (CU09) está implementada en backend y frontend, con HMAC, cuotas MySQL, envío único mock/Brevo y JWT versionado. El frontend se verifica en la suite CU09/Usuarios; la validación de envío de correo real continúa pendiente. El estado local de las migraciones se detalla en la sección de CU09.

También se encuentra implementado el backend de Medicamentos, Principios Activos y Composición (CU14–CU20), con autorización por rol, búsqueda por código/nombre, búsqueda AND por principios activos y bloqueo de identidad/composición desde el primer movimiento de inventario. La corrección de un ingrediente utiliza retiro y alta antes de existir historial.

Las pruebas de integración de este bloque se ejecutan con `pnpm test`, requieren MySQL configurado y utilizan datos temporales dentro de una transacción que se revierte. Se comprueban las rutas HTTP, JWT, permisos, validación, referencias, unicidad y reglas históricas sin modificar registros históricos.

Verificación de la simplificación CU09 (09/10/2026): suite completa con 146 pruebas aprobadas, cero fallidas, canceladas u omitidas; Brevo simulado y mock sin correos reales. En PowerShell, seleccionar explícitamente el entorno de pruebas antes de ejecutar:

```powershell
$env:NODE_ENV = 'test'
pnpm test
```

Las suites de credenciales, correo y recuperación crean, migran y eliminan únicamente sus bases aleatorias con fixtures sintéticos. La suite de esquema verifica la correctiva y su rechazo ante datos de envío, sin ciclos down/up. Catálogo y contraseñas usan `DB_NAME_TEST` con rollback exterior; esta base debe estar migrada y ser distinta de desarrollo/producción.

Correcciones posteriores a la revisión general del backend (09/10/2026): el middleware global traduce errores `entity.parse.failed` a 400 y `entity.too.large` a 413 con mensajes propios, sin registrar el body; los errores técnicos siguen siendo 500 genéricos. La prueba de catálogo ahora selecciona y comprueba `DB_NAME_TEST` antes de importar Sequelize, igual que las demás suites de integración.

Verificación de estas correcciones: suite completa con 151 pruebas aprobadas, cero fallidas, canceladas u omitidas, ejecutada partiendo de `NODE_ENV=development` para comprobar la selección interna del entorno de pruebas. La consulta de Usuario en desarrollo ya no falla por columnas ausentes y las comprobaciones HTTP del backend real confirman 400/413 para entradas malformadas/excesivas. No se enviaron correos reales.

La Fase 2 de Compras (CU25 y CU26) está implementada y verificada hasta Fase 2.4. La Fase 2.0 conserva numeración, actores y referencias; la Fase 2.1 aporta validación y utilidades decimales/temporales; la Fase 2.2 incorpora las consultas y la Fase 2.3 el registro transaccional completo. El hito B1 está aplicado en `prueba` con autorización específica, conservando exactamente los datos anteriores y ambos atributos nuevos en NULL para históricos. La Fase 2.4 verificó escritura/lectura temporal, restricciones, rollback InnoDB, concurrencia, consultas e integridad histórica en bases temporales autorizadas, junto con las regresiones de Inventario: 116 pruebas aprobadas. CU27, reservado inicialmente para la Fase 5, se adelantó por solicitud del usuario y está implementado con B1 + A por existencia. Su integración y las regresiones aprobaron 130 pruebas; las bases temporales autorizadas fueron eliminadas. Backend y frontend de Compras cubren CU25–CU27; la interfaz de anulación está verificada en navegador con API simulada. El contrato técnico y las verificaciones se conservan en la sección de API de Fase 2.

La Fase 3.0 documenta el diseño aprobado de Ajustes (CU23) y Retiros (CU35/CU36), con las precondiciones stockObservado + ultimoMovimientoObservado. La Fase 3.1 implementa sus validadores de entrada, amplía CU22 con ultimoMovimiento y prepara las lecturas bloqueantes de Repositories, sin tablas ni columnas nuevas. La Fase 3.2 implementa el registro transaccional de Ajustes con motivo AJUSTE aprobado por el usuario, promedio exacto y respuesta sin movimiento cuando no existe diferencia. La Fase 3.3 implementa Retiros por Vencimiento/Daño con motivos oficiales, control DIA/MES, conservación del promedio y pérdida derivada exacta. La Fase 3.4 verifica persistencia, rollback y concurrencia reales de estas operaciones y compatibilidad B1/A sobre una base temporal aislada, conservando las bases protegidas. El diseño y las verificaciones se detallan en la sección de API de Fase 3.

El frontend de consultas de Inventario (CU21/CU22/CU24/CU40/CU33/CU34/CU37), Ajustes (CU23), Retiros por Vencimiento/Daño (CU35/CU36), listado/detalle de Compras (CU26), registro de Compras (CU25) y anulación de Compras (CU27) está implementado y verificado: 49 pruebas simuladas de Inventario/CU23/CU35/CU36, 43 de Compras y 24 de regresión CU09/Usuarios aprobadas (116), además de 16 pruebas de aceptación integrada React/Express/MySQL aprobadas el 11/10/2026 en bases temporales aisladas. Las seis entregas y su aceptación automatizada integrada están completas para el alcance ejercido de Inventario/Compras, con build exitoso. Los contratos, escenarios, huellas de bases protegidas y límites de verificación se conservan en las secciones de API de Fases 1A/1B, Fase 2 y Fase 3. No hay aprobación manual comunicada del usuario con sus datos. Ventas, Recetas y Reportes mantienen su estado pendiente independiente de esta aceptación.

Cierre operativo del bloque (11/10/2026), por elección explícita del usuario de cerrar Inventario/Compras: actualizado el README con el punto de entrada real `backend/src/server.js`, `pnpm start`, los módulos entregados y los comandos de verificación. Incorporada `docs/uso/inventario-compras.md` con arranque, rutas, permisos, operaciones, conflictos y revisión manual. El backend se inició con `pnpm start` en el puerto 3000 y el frontend con `pnpm dev --host localhost --port 5173 --strictPort`. El smoke local verificó HTTP 200 del frontend, 401 esperado de `/api/auth/me` sin cookie, CORS con credenciales para localhost:5173, conexión MySQL mediante SELECT y presencia de ambos snapshots B1. Chrome verificó que React renderiza el login y redirige Inventario sin sesión, sin errores JavaScript. No se registraron operaciones de negocio ni se ejecutaron migraciones/seeders en la base local. MySQL y ambos servidores quedan activos para que el usuario abra `http://localhost:5173`. Este cierre no implica aprobación manual con sus datos.

---

## 33. Orden recomendado de desarrollo

Después de completar Usuarios:

1. Medicamentos.
2. Proveedores/Laboratorios.
3. Compras.
4. Ventas.
5. Inventario / Existencias / Movimientos.
6. Vencimientos y alertas.
7. Reportes.

Este orden puede ajustarse si una dependencia funcional requiere adelantar una parte concreta.

---

## 34. Git y flujo de trabajo

Repositorio general:

```text
cadefar-inventory-system/
├── AGENTS.md
├── docs/
├── backend/
└── frontend/
```

El proyecto utiliza Git y ramas feature.

Flujo general:

```bash
git switch -c feature/nombre
git add .
git commit -m "..."
git push origin feature/nombre
```

Después:

```bash
git switch main
git pull
git merge feature/nombre
git push origin main
```

No modificar `main` directamente cuando se esté trabajando mediante una feature branch.

---

## 35. Documentación para IA / OpenCode

La documentación relevante se almacena en:

```text
docs/ai/
```

Estructura prevista:

```text
docs/
└── ai/
    ├── contexto-maestro.md
    ├── requerimientos.md
    ├── reglas-negocio.md
    └── casos-uso.md
```

`contexto-maestro.md` explica el proyecto y sus decisiones generales.

Los otros archivos contienen el detalle funcional.

Los archivos `AGENTS.md` indican a OpenCode cómo debe trabajar con el repositorio.

Estructura prevista:

```text
cadefar-inventory-system/
├── AGENTS.md
├── docs/
│   └── ai/
│       ├── contexto-maestro.md
│       ├── requerimientos.md
│       ├── reglas-negocio.md
│       └── casos-uso.md
├── backend/
│   ├── AGENTS.md
│   └── ...
└── frontend/
    ├── AGENTS.md
    └── ...
```

Estos archivos deben versionarse en Git.

Nunca colocar en ellos:

- Contraseñas reales.
- JWT reales.
- Credenciales de MySQL.
- Secretos.
- Claves privadas.
- Contenido de `.env`.

---

## 36. Decisiones que no deben cambiarse sin un nuevo requisito

No modificar estas decisiones simplemente por preferencia técnica:

- No agregar `Lote`.
- No crear tabla `Inventario`.
- No crear tabla `Alerta`.
- No crear tabla `Reporte`.
- No separar Proveedor y Laboratorio actualmente.
- No implementar permisos dinámicos por ahora.
- No crear una entidad `Auth`.
- No utilizar UUID sin una necesidad concreta.
- No calcular IDs manualmente.
- No eliminar físicamente registros históricos importantes.
- No almacenar contraseñas en texto plano.
- No devolver `password_hash`.
- No almacenar JWT en `localStorage`.
- No duplicar la verificación del JWT dentro de `requireRole`.
- No colocar reglas críticas del negocio en React.
- No conectar React directamente a MySQL.
- No agregar dependencias o complejidad sin una necesidad real.
- No mezclar este proyecto con versiones simplificadas realizadas para otras materias.

---

## 37. Regla general para continuar el proyecto

Antes de implementar una funcionalidad:

1. Revisar este archivo.
2. Revisar los requerimientos relacionados.
3. Revisar las reglas de negocio relacionadas.
4. Revisar los casos de uso relacionados.
5. Examinar el código existente antes de modificarlo.
6. Mantener las convenciones actuales del proyecto.
7. No inventar requisitos.
8. No modificar arquitectura, modelo o alcance sin una razón derivada de un requisito nuevo.
9. Si una nueva necesidad contradice una decisión anterior, señalar la contradicción antes de cambiar el diseño.
10. Elegir la solución más simple que respete las reglas y arquitectura actuales.

---

**Este archivo funciona como contexto maestro del proyecto CADEFAR.**
