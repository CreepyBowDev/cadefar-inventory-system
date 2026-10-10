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

Actualmente se ha trabajado principalmente el módulo de usuarios y autenticación.

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

La recuperación de contraseña por correo (CU09) está implementada en el backend con HMAC, cuotas MySQL, envío único mock/Brevo y JWT versionado. El frontend y la validación de correo real están pendientes. El estado local de las migraciones se detalla en la sección de CU09.

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
