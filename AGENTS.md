# AGENTS.md — CADEFAR

Este archivo define las instrucciones generales que deben seguir OpenCode y otros agentes de IA al trabajar en el proyecto CADEFAR.

El objetivo es mantener el desarrollo coherente con las decisiones ya tomadas, evitar cambios innecesarios de arquitectura y reducir la posibilidad de que se inventen requisitos.

---

# 1. Proyecto

Nombre:

**Sistema de Información Web para la Administración de Inventario, Ventas y Control de Vencimiento para la Farmacia CADEFAR**

Tipo:

- Aplicación web de uso interno.
- Proyecto universitario.
- Arquitectura cliente-servidor.

Stack principal:

```text
Frontend:
React + Vite

Backend:
Node.js + Express

ORM:
Sequelize

Base de datos:
MySQL

Validación:
Zod

Autenticación:
JWT mediante cookie HttpOnly

Gestor de paquetes:
pnpm
```

---

# 2. Documentación obligatoria

Antes de realizar cambios importantes, consultar la documentación ubicada en:

```text
docs/ai/
```

Archivos principales:

```text
docs/ai/contexto-maestro.md
docs/ai/requerimientos.md
docs/ai/reglas-negocio.md
docs/ai/casos-uso.md
```

Uso recomendado:

```text
contexto-maestro.md
→ decisiones generales, arquitectura, modelo y estado del proyecto

requerimientos.md
→ qué debe hacer el sistema

reglas-negocio.md
→ condiciones que deben cumplirse

casos-uso.md
→ comportamiento esperado de cada operación
```

No es necesario releer toda la documentación para cambios pequeños y puramente visuales.

Cuando una tarea afecte:

- lógica de negocio;
- modelo de datos;
- compras;
- ventas;
- inventario;
- existencias;
- vencimientos;
- recetas;
- movimientos;
- usuarios;
- autorización;
- reportes;

se deben consultar las secciones relacionadas antes de implementar.

---

# 3. Regla principal

No inventar requisitos.

No modificar una decisión del proyecto solamente porque exista otra forma técnicamente válida de hacerlo.

Si una solicitud nueva contradice una decisión documentada:

1. identificar la contradicción;
2. explicarla;
3. no modificar silenciosamente el diseño;
4. aplicar el cambio solamente si la nueva necesidad realmente lo requiere.

Mantener siempre la solución más simple que respete el alcance y las reglas del proyecto.

---

# 4. Decisiones que deben respetarse

Mientras no exista un nuevo requisito explícito:

- No agregar entidad o tabla `Lote`.
- No crear tabla `Inventario`.
- No crear tabla `Alerta`.
- No crear tabla `Reporte`.
- No crear tabla `Auth`.
- No separar `Proveedor` y `Laboratorio`.
- Utilizar `ProveedorLaboratorio`.
- No agregar permisos dinámicos.
- Mantener los roles fijos:
  - Administrador.
  - Regente.
  - Vendedor.
- No usar UUID sin una necesidad concreta.
- Utilizar `INT AUTO_INCREMENT` para las PK numéricas.
- No calcular IDs manualmente.
- No eliminar físicamente información histórica importante.
- No reutilizar códigos de existencia.
- No permitir stock negativo.
- Mantener FEFO para selección de existencias en ventas.
- No almacenar contraseñas en texto plano.
- No devolver `password_hash` al cliente.
- No guardar JWT en `localStorage` ni `sessionStorage`.
- No conectar React directamente con MySQL.
- No duplicar lógica crítica del backend en el frontend.
- No agregar dependencias sin necesidad.
- No agregar capas, tablas, servicios o patrones solo por “buenas prácticas”.
- No mezclar este proyecto con versiones simplificadas realizadas para otras materias.

---

# 5. Modelo de inventario

`Medicamento` representa el producto del catálogo.

`ExistenciaMedicamento` representa unidades concretas de ese medicamento diferenciadas principalmente por vencimiento.

Ejemplo:

```text
Medicamento:
PAR001 - Paracetamol 500 mg

Existencias:
PAR001-001
PAR001-002
PAR001-003
```

El código de existencia:

- se genera automáticamente;
- es único;
- no se reutiliza;
- es diferente del ID técnico de la base de datos.

No existe tabla `Inventario`.

El inventario se obtiene principalmente mediante:

```text
ExistenciaMedicamento
+
MovimientoInventario
```

`ExistenciaMedicamento` mantiene el saldo actual.

`MovimientoInventario` mantiene la trazabilidad histórica.

---

# 6. Stock

Distinguir siempre:

```text
Stock físico
≠
Stock vendible
```

Una existencia vencida puede continuar físicamente en la farmacia, pero no puede venderse.

El vencimiento no pone automáticamente el saldo en cero.

Las unidades dejan el inventario físico cuando se registra su retiro.

Nunca permitir saldo negativo.

---

# 7. FEFO

Cuando existan varias existencias vendibles del mismo medicamento:

```text
FEFO
First Expired, First Out
```

Se debe utilizar primero la existencia cuyo vencimiento sea más próximo.

Si una venta necesita utilizar varias existencias:

- crear detalles separados;
- mantener trazabilidad por existencia.

---

# 8. Historial y trazabilidad

Las operaciones históricas importantes no deben corregirse eliminando registros.

Priorizar:

```text
Estado
Anulación
Reversión
Movimiento de inventario
```

Los movimientos de inventario no se eliminan.

Cuando corresponda compensar un movimiento:

- conservar el movimiento original;
- generar un movimiento de reversión;
- mantener la relación con el movimiento original.

---

# 9. Arquitectura general

Flujo general:

```text
React + Vite
      ↓
HTTP / JSON / Cookies
      ↓
Node.js + Express
      ↓
Sequelize
      ↓
MySQL
```

El frontend consume la API.

El frontend nunca accede directamente a la base de datos.

---

# 10. Backend

El backend utiliza arquitectura por capas:

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

Para reglas específicas del backend consultar:

```text
backend/AGENTS.md
```

si ese archivo existe.

## Controller

Debe encargarse principalmente de:

- HTTP;
- `req`;
- `res`;
- validación de entrada;
- llamar al Service;
- devolver la respuesta;
- pasar errores mediante `next(error)`.

No colocar lógica de negocio importante en Controllers.

## Service

Debe encargarse principalmente de:

- reglas de negocio;
- decisiones;
- coordinación de operaciones;
- transacciones;
- validaciones de negocio.

No debe recibir `req` ni `res`.

## Repository

Debe encargarse del acceso a datos.

Ejemplos:

```text
findOne
findAll
findByPk
create
update
```

No colocar reglas de negocio en Repositories.

## Model

Representa una tabla mediante Sequelize.

No utilizar `sequelize.sync()` como mecanismo principal de creación de tablas.

Utilizar migrations.

---

# 11. Validación

Se utiliza Zod para validación estructural.

Zod valida principalmente:

- tipos;
- campos obligatorios;
- formato;
- longitud;
- estructura.

El Service valida reglas de negocio.

Ejemplo:

```text
Zod:
¿idRol es un entero positivo?

Service:
¿el rol existe y está activo?
```

La base de datos funciona como última barrera de integridad.

---

# 12. Errores

Utilizar `AppError` para errores conocidos del sistema.

Ejemplo:

```js
throw new AppError('El nombre de usuario ya está en uso', 409);
```

Los Controllers deben pasar errores al middleware global:

```js
next(error);
```

No agregar `try/catch` a Services o Repositories solamente para capturar y volver a lanzar exactamente el mismo error.

---

# 13. Autenticación

La autenticación utiliza:

- bcrypt;
- JWT;
- cookie HttpOnly;
- cookie-parser.

El JWT debe contener solamente la información necesaria.

Payload esperado:

```js
{
  idUsuario,
  idRol
}
```

Nunca incluir:

- contraseña;
- `password_hash`;
- información sensible innecesaria.

El JWT está firmado, no cifrado.

---

# 14. Autorización

Flujo:

```text
authMiddleware
↓
requireRole(...)
↓
Controller
```

`authMiddleware` autentica.

`requireRole` autoriza.

No volver a verificar el JWT dentro de `requireRole`.

Utilizar constantes de roles en lugar de números mágicos.

---

# 15. Frontend

El frontend utiliza:

```text
React
Vite
React Router
Axios
Context API para autenticación
```

Arquitectura:

```text
Feature-Based
+
Component-Based
```

Flujo:

```text
Page / Component
↓
Service
↓
API
↓
Backend
```

Para reglas específicas del frontend consultar:

```text
frontend/AGENTS.md
```

si ese archivo existe.

---

# 16. Organización del frontend

Estructura general prevista:

```text
frontend/
├── public/
├── src/
│   ├── api/
│   ├── app/
│   ├── components/
│   ├── layouts/
│   ├── features/
│   ├── hooks/
│   ├── routes/
│   ├── constants/
│   ├── utils/
│   ├── styles/
│   ├── App.jsx
│   └── main.jsx
├── .env
├── package.json
└── vite.config.js
```

Las funcionalidades principales se organizan dentro de:

```text
src/features/
```

Ejemplo:

```text
features/usuarios/
├── pages/
├── components/
└── services/
```

`src/components/` debe reservarse para componentes realmente reutilizables por varias features.

---

# 17. Autenticación en React

No almacenar el JWT en:

- `localStorage`;
- `sessionStorage`;
- Context;
- estado local.

El navegador mantiene la cookie HttpOnly.

Axios debe utilizar:

```js
withCredentials: true
```

`AuthContext` conserva únicamente información pública de la sesión.

Ejemplo:

```js
{
  idUsuario,
  nombreUsuario,
  idRol
}
```

---

# 18. Seguridad frontend vs backend

Las restricciones del frontend son únicamente de interfaz.

Ejemplo:

```text
RoleRoute
→ controla qué pantalla puede ver el usuario
```

La seguridad real debe permanecer en el backend:

```text
authMiddleware
+
requireRole
```

Nunca confiar solamente en React para proteger una operación.

---

# 19. Cambios de código

Antes de modificar código existente:

1. inspeccionar los archivos involucrados;
2. comprender la implementación actual;
3. revisar la documentación relacionada;
4. respetar nombres y convenciones existentes;
5. identificar dependencias;
6. realizar el cambio mínimo necesario.

No reestructurar archivos no relacionados con la tarea.

No realizar refactors grandes sin que sean necesarios para cumplir la solicitud.

No renombrar carpetas, clases, funciones o rutas sin una razón concreta.

---

# 20. Implementaciones nuevas

Cuando se solicite una funcionalidad nueva:

1. localizar el módulo correcto;
2. revisar el requerimiento relacionado;
3. revisar las reglas de negocio;
4. revisar el caso de uso;
5. revisar código existente similar;
6. implementar respetando la arquitectura;
7. comprobar manejo de errores;
8. comprobar autorización;
9. comprobar integridad de datos;
10. revisar efectos colaterales.

Para operaciones que afecten varios registros relacionados, utilizar transacciones cuando corresponda.

Ejemplos principales:

- compras;
- ventas;
- anulaciones;
- ajustes;
- retiros.

---

# 21. No asumir

Si falta información necesaria para implementar correctamente una tarea:

- no inventarla;
- revisar primero la documentación y el código;
- si continúa siendo ambigua, indicarlo.

No asumir automáticamente:

- nuevos campos;
- nuevas tablas;
- nuevos estados;
- nuevos roles;
- nuevos permisos;
- nuevas relaciones;
- nuevas reglas del negocio.

---

# 22. Cambios en la base de datos

No modificar directamente el esquema existente sin considerar:

- migrations;
- modelos Sequelize;
- asociaciones;
- repositories;
- reglas de negocio;
- datos históricos.

Una modificación del modelo debe mantenerse coherente entre:

```text
Migration
Model
Repository
Service
API
Frontend cuando corresponda
```

---

# 23. Dependencias

Antes de instalar una nueva dependencia:

1. comprobar si el proyecto ya cuenta con una solución;
2. comprobar si puede resolverse de forma sencilla con las herramientas actuales;
3. evitar dependencias redundantes;
4. justificar la necesidad.

Gestor de paquetes:

```text
pnpm
```

No utilizar `npm install` o `yarn` para agregar paquetes al proyecto salvo que se solicite explícitamente.

---

# 24. Archivos sensibles

Nunca versionar:

```text
.env
credenciales
contraseñas reales
JWT reales
JWT_SECRET
DB_PASSWORD
tokens
claves privadas
```

No escribir secretos reales dentro de:

- código;
- documentación;
- ejemplos;
- commits.

---

# 25. Git

Trabajar preferentemente mediante ramas feature.

Ejemplo:

```bash
git switch -c feature/nombre-funcionalidad
```

Realizar commits relacionados con una sola unidad lógica de trabajo.

Ejemplos de mensajes:

```text
feat: implementar listado de usuarios
fix: corregir validación de estado de usuario
refactor: simplificar servicio de autenticación
docs: actualizar reglas de negocio
```

No realizar commits ni pushes automáticamente salvo que el usuario lo solicite.

No modificar `main` directamente si el flujo actual está utilizando ramas feature.

---

# 26. Revisión antes de finalizar una tarea

Antes de considerar una implementación terminada, revisar:

- ¿Respeta el requerimiento?
- ¿Respeta las reglas de negocio?
- ¿Respeta el caso de uso?
- ¿Respeta la arquitectura?
- ¿Mantiene trazabilidad?
- ¿Maneja errores?
- ¿Respeta autenticación y autorización?
- ¿Puede producir stock negativo?
- ¿Puede romper información histórica?
- ¿Se agregó complejidad innecesaria?
- ¿Se modificaron archivos que no era necesario modificar?

---

# 27. Forma de responder al usuario

Después de realizar cambios importantes:

- resumir qué se modificó;
- indicar los archivos principales afectados;
- explicar decisiones relevantes de forma breve;
- mencionar cualquier punto que deba revisar manualmente;
- no ocultar errores o limitaciones encontradas.

Cuando el usuario esté aprendiendo una parte del proyecto, priorizar explicaciones claras de:

```text
qué hace
por qué existe
dónde pertenece
cómo se conecta con las demás capas
```

No limitarse a entregar código sin contexto cuando la conversación indique que el usuario quiere comprender la implementación.

---

# 28. Prioridad de fuentes

Cuando exista información contradictoria, utilizar este orden:

```text
1. Solicitud actual explícita del usuario
2. Decisiones más recientes del proyecto
3. docs/ai/contexto-maestro.md
4. docs/ai/requerimientos.md
5. docs/ai/reglas-negocio.md
6. docs/ai/casos-uso.md
7. Código actual del repositorio
8. Suposiciones generales
```

Las suposiciones generales nunca deben reemplazar una decisión documentada del proyecto.

---

# 29. Objetivo final

El objetivo no es generar la mayor cantidad posible de código.

El objetivo es mantener CADEFAR:

- coherente;
- entendible;
- mantenible;
- simple;
- trazable;
- acorde con los requisitos;
- acorde con las reglas de negocio;
- acorde con la arquitectura definida.

Ante dos soluciones correctas, preferir la más simple que mantenga estas condiciones.
