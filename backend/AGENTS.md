# AGENTS.md — Backend CADEFAR

Este archivo define las instrucciones específicas para trabajar dentro del backend de CADEFAR.

Debe aplicarse junto con el `AGENTS.md` ubicado en la raíz del repositorio.

Antes de realizar cambios que afecten lógica de negocio, modelo de datos o comportamiento funcional, consultar también:

```text
docs/ai/contexto-maestro.md
docs/ai/requerimientos.md
docs/ai/reglas-negocio.md
docs/ai/casos-uso.md
```

---

# 1. Stack del backend

El backend utiliza:

```text
Node.js
Express
Sequelize
MySQL
Zod
bcrypt
jsonwebtoken
cookie-parser
pnpm
```

El backend principal utiliza módulos ESM:

```js
import ...
export ...
```

El `package.json` principal utiliza:

```json
{
  "type": "module"
}
```

---

# 2. Arquitectura

El backend utiliza arquitectura por capas.

Flujo general:

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
Sequelize Model
↓
MySQL
```

Mantener esta separación.

No mover responsabilidades entre capas sin una necesidad concreta.

---

# 3. Estructura actual

Mantener la estructura:

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

No reorganizar esta estructura salvo solicitud explícita.

---

# 4. Routes

Las rutas deben:

- definir el endpoint;
- aplicar middlewares;
- llamar al Controller correspondiente.

Ejemplo conceptual:

```js
router.post(
  '/usuarios',
  authMiddleware,
  requireRole(ROLES.ADMINISTRADOR),
  usuarioController.crear
);
```

Las rutas no deben contener lógica de negocio.

No realizar consultas Sequelize directamente desde las rutas.

---

# 5. Middlewares

Los middlewares se utilizan para responsabilidades transversales.

Ejemplos:

- autenticación;
- autorización;
- manejo global de errores;
- otras validaciones transversales cuando realmente correspondan.

No colocar reglas propias de un caso de uso dentro de un middleware si pertenecen al Service.

Orden típico de una ruta protegida:

```text
authMiddleware
↓
requireRole(...)
↓
Controller
```

---

# 6. Controllers

Los Controllers pertenecen a:

```text
src/presentation/controllers/
```

Responsabilidades:

- recibir `req`;
- utilizar `res`;
- obtener parámetros, query o body;
- validar la entrada mediante el validator correspondiente;
- llamar al Service;
- devolver la respuesta HTTP;
- capturar errores y pasarlos mediante `next(error)`.

Ejemplo conceptual:

```js
export const crearUsuario = async (req, res, next) => {
  try {
    const datos = validarCrearUsuario(req.body);

    const usuario = await usuarioService.crearUsuario(datos);

    return res.status(201).json(usuario);
  } catch (error) {
    next(error);
  }
};
```

No colocar en Controllers:

- reglas de negocio importantes;
- consultas directas a Sequelize;
- hash de contraseñas;
- lógica FEFO;
- cálculos complejos de inventario;
- transacciones de negocio.

---

# 7. Services

Los Services pertenecen a:

```text
src/business/services/
```

Son la capa principal de lógica de negocio.

Responsabilidades:

- aplicar reglas de negocio;
- decidir si una operación puede realizarse;
- coordinar Repositories;
- coordinar otros Services cuando corresponda;
- realizar cálculos de negocio;
- manejar transacciones;
- lanzar `AppError` cuando una regla falle.

Ejemplos:

```text
¿el usuario ya existe?
¿el rol existe?
¿el rol está activo?
¿hay stock suficiente?
¿la existencia está vencida?
¿la operación ya fue anulada?
¿la receta está aprobada?
```

Los Services no deben recibir:

```text
req
res
```

No depender de Express dentro de la capa de negocio.

---

# 8. Repositories

Los Repositories pertenecen a:

```text
src/data/repositories/
```

Responsabilidad:

- acceso a datos.

Operaciones típicas:

```text
findOne
findAll
findByPk
create
update
count
consultas con include
consultas agregadas cuando corresponda
```

Los Repositories pueden utilizar modelos Sequelize.

No deben decidir reglas de negocio.

Ejemplo incorrecto:

```text
"Si el medicamento está vencido, impedir venta"
```

Eso pertenece al Service.

Ejemplo correcto:

```text
"Buscar existencias vendibles ordenadas por vencimiento"
```

El Repository puede ejecutar la consulta; el Service decide cómo utilizar el resultado.

---

# 9. Models

Los modelos están en:

```text
src/data/models/
```

Representan tablas Sequelize.

Definen:

- campos;
- tipos;
- restricciones;
- asociaciones.

No colocar lógica de negocio compleja dentro de los modelos.

---

# 10. ESM y CommonJS

El backend general utiliza ESM.

Los modelos generados por Sequelize CLI permanecen CommonJS.

Dentro de:

```text
src/data/models/
```

existe:

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

```text
Controllers → ESM
Services → ESM
Repositories → ESM
Routes → ESM
Middlewares → ESM
Utils → ESM
app.js → ESM
server.js → ESM

Models Sequelize → CommonJS
models/index.js → CommonJS
```

Desde un Repository ESM importar el índice CommonJS de esta forma:

```js
import db from '../models/index.js';

const { Usuario, Rol } = db;
```

No convertir automáticamente los modelos a ESM.

---

# 11. Sequelize CLI

La configuración del CLI utiliza:

```text
config.cjs
```

`models/index.js` debe mantener compatibilidad con esa configuración.

No utilizar:

```js
sequelize.sync()
```

como mecanismo principal para crear o modificar tablas.

Utilizar:

```text
migrations
seeders
```

---

# 12. Base de datos

La base actual contiene principalmente:

```text
rol
proveedor_laboratorio
principio_activo
usuario
medicamento
composicion_medicamento
existencia_medicamento
compra
venta
receta
detalle_compra
detalle_venta
movimiento_inventario
```

No agregar nuevas tablas sin revisar primero la documentación funcional.

En particular, no agregar actualmente:

```text
lote
inventario
alerta
reporte
baja_inventario
permiso
rol_permiso
auth
sesion_usuario
```

salvo que aparezca un nuevo requisito explícito que lo justifique.

---

# 13. IDs

Las PK numéricas utilizan:

```text
INT AUTO_INCREMENT
```

No calcular manualmente:

```text
ultimoId + 1
```

Las FK deben recibir IDs existentes.

No utilizar UUID sin una necesidad concreta.

---

# 14. Validación con Zod

Los validators están en:

```text
src/business/validators/
```

Zod valida principalmente:

- tipo;
- formato;
- campos obligatorios;
- longitud;
- estructura.

Ejemplo:

```text
idRol debe ser entero positivo
nombreUsuario debe tener formato válido
password debe cumplir longitud mínima
```

No utilizar Zod para reemplazar las reglas de negocio.

Ejemplo:

```text
Zod:
¿idRol tiene formato correcto?

Service:
¿ese rol existe y está activo?
```

---

# 15. Manejo de errores

Utilizar:

```text
AppError
```

para errores esperados de la aplicación.

Ubicación:

```text
src/shared/errors/
```

Ejemplo:

```js
throw new AppError('El usuario ya está en uso', 409);
```

Códigos habituales:

```text
400 → datos inválidos
401 → no autenticado
403 → no autorizado
404 → no encontrado
409 → conflicto
500 → error interno
```

Los Controllers deben pasar errores al middleware global:

```js
next(error);
```

No agregar `try/catch` en Services o Repositories únicamente para volver a lanzar exactamente el mismo error.

Solo capturar allí cuando se necesite:

- transformar un error técnico;
- agregar contexto útil;
- recuperar una situación;
- manejar una transacción.

---

# 16. Usuarios

Solo el Administrador puede crear nuevas cuentas.

Entrada de creación esperada:

```json
{
  "idRol": 3,
  "nombreUsuario": "vendedor01",
  "password": "12345678"
}
```

El cliente no debe enviar:

```text
idUsuario
passwordHash
estado
```

`idUsuario` lo genera MySQL.

La contraseña se transforma en hash dentro del Service.

El Repository recibe:

```text
idRol
nombreUsuario
passwordHash
```

La contraseña en texto plano no debe llegar al Repository.

Antes de crear un usuario:

- comprobar nombre duplicado;
- comprobar que el rol exista;
- comprobar que el rol esté activo.

Mantener `UNIQUE(nombre_usuario)` en la base de datos como barrera final.

---

# 17. Contraseñas

Utilizar bcrypt.

Nunca almacenar contraseñas en texto plano.

Nunca devolver:

```text
password
password_hash
```

al cliente.

No registrar contraseñas en logs.

---

# 18. Login

El login recibe:

```text
nombreUsuario
password
```

Flujo:

```text
buscar usuario
↓
verificar que exista
↓
verificar que esté activo
↓
bcrypt.compare()
↓
generar JWT
↓
Controller coloca cookie
```

Para usuario inexistente o contraseña incorrecta puede utilizarse un mensaje genérico:

```text
Usuario o contraseña incorrectos
```

---

# 19. JWT

Utilizar `jsonwebtoken`.

La utilidad JWT pertenece a:

```text
src/shared/utils/
```

Funciones esperadas:

```text
generarToken()
verificarToken()
```

El secreto se obtiene desde variable de entorno:

```text
JWT_SECRET
```

o la variable equivalente ya utilizada por el proyecto.

Payload mínimo:

```js
{
  idUsuario,
  idRol
}
```

No incluir datos sensibles.

El JWT está firmado, no cifrado.

---

# 20. Cookies

El JWT se almacena en cookie HttpOnly.

Configuración conceptual:

```js
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000
}
```

La cookie debe configurarse en la capa HTTP, normalmente desde el Controller.

No hacer que el AuthService dependa de `res.cookie()`.

---

# 21. authMiddleware

Responsabilidades:

- leer token desde `req.cookies`;
- verificar JWT;
- extraer payload;
- colocar usuario autenticado en `req.usuario`;
- llamar `next()`.

Ejemplo:

```js
req.usuario = {
  idUsuario,
  idRol
};
```

Token inválido o expirado debe terminar en respuesta 401.

No devolver 500 por un JWT inválido esperado.

---

# 22. requireRole

`requireRole(...rolesPermitidos)` es un middleware factory.

Ejemplo:

```js
requireRole(ROLES.ADMINISTRADOR)
```

o:

```js
requireRole(
  ROLES.ADMINISTRADOR,
  ROLES.REGENTE
)
```

Debe utilizar:

```text
req.usuario.idRol
```

No volver a verificar el JWT dentro de `requireRole`.

Mantener constantes en:

```text
src/shared/constants/
```

Ejemplo:

```js
export const ROLES = {
  ADMINISTRADOR: 1,
  REGENTE: 2,
  VENDEDOR: 3
};
```

Evitar números mágicos.

---

# 23. Logout

Logout elimina la cookie con:

```js
res.clearCookie(...)
```

En la versión actual no existe:

- blacklist de tokens;
- tabla de sesiones;
- revocación inmediata del JWT.

No agregar estas estructuras sin un nuevo requisito.

---

# 24. Sesión actual

Para integración con React se recomienda disponer de:

```text
GET /api/auth/me
```

Este endpoint debe:

- requerir `authMiddleware`;
- devolver información pública del usuario autenticado;
- nunca devolver `password_hash`.

Su objetivo es permitir que React recupere la sesión después de recargar la página.

---

# 25. Inventario

No existe tabla `Inventario`.

Utilizar:

```text
ExistenciaMedicamento
+
MovimientoInventario
```

`ExistenciaMedicamento` mantiene el estado actual.

`MovimientoInventario` mantiene el historial.

No modificar saldo directamente sin registrar el movimiento correspondiente cuando la operación represente una entrada o salida.

---

# 26. Stock físico y vendible

Mantener la distinción:

```text
saldo físico
≠
stock vendible
```

Una existencia vencida:

- puede mantener saldo físico;
- no es vendible;
- permanece hasta registrar un retiro.

No colocar saldo en cero automáticamente por vencimiento.

---

# 27. FEFO

En ventas:

```text
FEFO
First Expired, First Out
```

Entre existencias vendibles del mismo medicamento, utilizar primero la que vence antes.

Si una existencia no alcanza:

- usar la siguiente existencia válida;
- crear detalles separados por existencia.

No permitir ventas desde existencias vencidas.

---

# 28. Compras

Registrar una compra puede implicar:

```text
Compra
+
DetalleCompra
+
ExistenciaMedicamento
+
MovimientoInventario
+
actualización de costo promedio
```

Debe ser una operación atómica mediante transacción.

Si una parte falla:

```text
ROLLBACK
```

No dejar cambios parciales.

Al recibir un medicamento:

- utilizar una existencia existente cuando corresponda;
- crear una nueva si el vencimiento requiere diferenciarla;
- generar código de existencia cuando sea nueva.

---

# 29. Costo promedio

Cada existencia mantiene costo promedio.

Cuando una compra agrega unidades a una existencia existente, utilizar promedio ponderado.

Conceptualmente:

```text
(cantidadActual × costoActual)
+
(cantidadNueva × costoNuevo)
--------------------------------
cantidadActual + cantidadNueva
```

Las salidas deben conservar el costo aplicado al momento del movimiento.

No recalcular retroactivamente movimientos históricos.

---

# 30. Ventas

Antes de confirmar una venta verificar:

- medicamento activo;
- existencia no vencida;
- stock suficiente;
- requisitos de receta;
- autorización del usuario.

La venta debe registrar de forma atómica:

```text
Venta
+
DetalleVenta
+
disminución de saldos
+
Movimientos de salida
```

No permitir cambios parciales.

---

# 31. Recetas

El sistema:

- registra recetas;
- revisa recetas;
- puede aprobarlas o rechazarlas;
- las utiliza para respaldar ventas cuando corresponda.

El sistema no emite recetas médicas.

No convertir CADEFAR en sistema clínico.

---

# 32. Movimientos de inventario

Todo movimiento debe afectar una sola existencia.

Dirección:

```text
ENTRADA
o
SALIDA
```

Motivos posibles incluyen:

```text
Compra
Venta
Ajuste
Retiro por vencimiento
Retiro por daño
Reversión
```

Un movimiento puede referenciar:

```text
DetalleCompra
o
DetalleVenta
```

pero no ambos simultáneamente.

Ajustes y retiros pueden existir sin detalle de compra o venta.

Los movimientos no se eliminan.

---

# 33. Reversiones

Para compensar un movimiento existente:

- conservar movimiento original;
- crear movimiento de reversión;
- utilizar misma existencia;
- utilizar misma cantidad;
- utilizar mismo costo aplicado;
- usar dirección contraria;
- referenciar movimiento original.

Cada movimiento original puede tener como máximo una reversión.

---

# 34. Anulaciones

Las compras y ventas anuladas no se eliminan.

Deben conservar:

- información original;
- estado;
- fecha de anulación;
- motivo;
- usuario responsable.

Los efectos del inventario se compensan mediante movimientos de reversión.

No permitir:

- anular dos veces;
- anulación parcial;
- dejar stock negativo;
- romper trazabilidad.

Las anulaciones deben ejecutarse mediante transacción.

---

# 35. Ajustes

Los ajustes de inventario deben registrarse mediante movimientos.

No modificar el saldo de una existencia directamente sin trazabilidad.

Un ajuste negativo no puede producir saldo menor a cero.

Registrar:

- usuario;
- fecha;
- cantidad;
- motivo;
- observación cuando corresponda.

---

# 36. Vencimientos

Una existencia próxima a vencer debe cumplir:

- saldo físico positivo;
- todavía no vencida;
- vencimiento dentro de los próximos tres meses.

Una existencia vencida:

- no puede venderse;
- puede continuar físicamente registrada;
- debe retirarse mediante movimiento de salida.

---

# 37. Retiros y pérdidas

Retiro por vencimiento:

```text
Movimiento de salida
motivo = vencimiento
```

Retiro por daño:

```text
Movimiento de salida
motivo = daño
```

No retirar más unidades que el saldo físico.

Pérdida valorizada:

```text
cantidadRetirada × costoUnitarioAplicado
```

No crear tabla `Perdida`.

Obtener las pérdidas desde los movimientos correspondientes.

---

# 38. Alertas

No existe tabla `Alerta`.

Calcular dinámicamente:

- próximo a vencer;
- vencido pendiente de retiro;
- stock bajo.

Stock bajo:

```text
stockVendible <= stockMinimo
```

---

# 39. Reportes

No existe tabla `Reporte`.

Los reportes son consultas sobre los datos existentes.

Ejemplos:

- ventas por período;
- compras por período;
- historial de inventario;
- pérdidas;
- retiros;
- stock actual;
- próximos a vencer;
- stock bajo.

---

# 40. Transacciones

Utilizar transacciones Sequelize en operaciones que modifican varios registros relacionados.

Especialmente:

- compras;
- ventas;
- anulaciones;
- ajustes cuando impliquen varios cambios;
- retiros cuando impliquen varios cambios.

Regla:

```text
todo se confirma
o
nada se confirma
```

No dejar estados intermedios.

---

# 41. Dependencias entre Services

Un Service puede llamar a otro Service cuando realmente exista una dependencia de negocio.

Evitar dependencias circulares.

No crear Services artificiales únicamente para aumentar la cantidad de capas.

---

# 42. Consultas complejas

Las consultas relacionadas con datos deben permanecer en Repositories.

Ejemplos:

- existencias vendibles ordenadas por vencimiento;
- cálculo agregado de stock;
- historial de movimientos;
- búsquedas con filtros;
- consultas para reportes.

El Service decide cómo utilizar los resultados.

---

# 43. Nombres

Mantener nombres coherentes con el proyecto.

Ejemplos:

```text
usuario.controller.js
usuario.service.js
usuario.repository.js
```

No renombrar a estilos diferentes sin necesidad.

Seguir el estilo ya existente en cada módulo.

---

# 44. Nuevos módulos

Antes de crear un nuevo módulo:

1. comprobar si realmente representa una funcionalidad del sistema;
2. revisar el contexto maestro;
3. revisar requerimientos;
4. revisar reglas de negocio;
5. revisar casos de uso.

No crear módulos solamente porque una entidad exista en la base de datos.

---

# 45. Antes de implementar

Antes de escribir código:

1. inspeccionar el código actual;
2. identificar archivos involucrados;
3. revisar documentación relacionada;
4. detectar dependencias;
5. respetar la arquitectura existente;
6. reutilizar utilidades existentes;
7. evitar duplicación;
8. implementar el cambio mínimo necesario.

---

# 46. Después de implementar

Revisar:

- validación;
- reglas de negocio;
- autorización;
- errores;
- integridad de datos;
- transacciones;
- trazabilidad;
- efectos sobre inventario;
- información sensible;
- consistencia entre capas.

Informar al usuario:

- qué se modificó;
- archivos principales;
- decisiones importantes;
- cualquier punto pendiente o que requiera prueba manual.

---

# 47. Git

No hacer automáticamente:

```text
git commit
git push
git merge
```

salvo que el usuario lo solicite.

No cambiar de rama sin necesidad.

No modificar archivos ajenos a la tarea.

---

# 48. Regla final

El backend debe mantenerse:

```text
simple
coherente
por capas
trazable
seguro
acorde a las reglas de negocio
```

No priorizar patrones sofisticados sobre la claridad del proyecto.

Ante varias soluciones correctas, elegir la más simple que preserve la arquitectura y los requisitos de CADEFAR.
