# AGENTS.md — Frontend CADEFAR

Este archivo define las instrucciones específicas para trabajar dentro del frontend de CADEFAR.

Debe aplicarse junto con el `AGENTS.md` ubicado en la raíz del repositorio.

Antes de realizar cambios que afecten comportamiento funcional, autenticación, autorización o reglas del sistema, consultar también:

```text
docs/ai/contexto-maestro.md
docs/ai/requerimientos.md
docs/ai/reglas-negocio.md
docs/ai/casos-uso.md
```

---

# 1. Stack del frontend

El frontend utiliza:

```text
React
Vite
React Router
Axios
Context API para autenticación
pnpm
```

Vite se utiliza como herramienta de desarrollo y construcción.

React es la librería principal de interfaz.

---

# 2. Arquitectura

El frontend utiliza:

```text
Feature-Based Architecture
+
Component-Based Architecture
```

Esto significa:

- organizar el código principalmente por funcionalidades;
- dividir la interfaz en componentes reutilizables;
- mantener separadas las responsabilidades de páginas, componentes y servicios.

Flujo general:

```text
Page / Component
↓
Service
↓
api.js
↓
Backend
```

El frontend nunca debe acceder directamente a MySQL.

---

# 3. Estructura general

Mantener la estructura:

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

No reorganizar esta estructura sin una necesidad concreta.

---

# 4. Features

La carpeta:

```text
src/features/
```

contiene los módulos funcionales del sistema.

Puede entenderse como:

```text
feature ≈ módulo funcional del frontend
```

Ejemplo:

```text
features/usuarios/
├── pages/
├── components/
└── services/
```

Cada feature debe contener únicamente archivos relacionados con ese módulo.

No mezclar archivos de distintos módulos sin necesidad.

---

# 5. Pages

Las páginas representan vistas completas asociadas normalmente a una ruta.

Ejemplos:

```text
UsuariosPage.jsx
UsuarioFormPage.jsx
VentasPage.jsx
InventarioPage.jsx
```

Responsabilidades principales:

- coordinar la pantalla;
- solicitar datos mediante Services;
- manejar estado propio de la vista;
- pasar datos a componentes;
- reaccionar a acciones del usuario;
- mostrar estados de carga y error.

No colocar reglas críticas de negocio en las páginas.

---

# 6. Components de una feature

Los componentes específicos de un módulo deben permanecer dentro de:

```text
features/<modulo>/components/
```

Ejemplo:

```text
features/usuarios/components/
├── UsuarioForm.jsx
└── UsuarioTable.jsx
```

Estos componentes pertenecen únicamente a Usuarios.

No moverlos a `src/components/` salvo que realmente sean reutilizables en varias features.

---

# 7. Componentes globales

La carpeta:

```text
src/components/
```

se reserva para componentes reutilizables en distintas partes del sistema.

Ejemplos posibles:

```text
Button
Input
Modal
Table
Loading
ConfirmDialog
Pagination
```

No convertir `src/components/` en una carpeta con todos los componentes del proyecto.

Regla:

```text
si es específico de un módulo
→ feature correspondiente

si es reutilizable globalmente
→ src/components/
```

---

# 8. Services del frontend

Los Services de cada feature se encargan principalmente de comunicarse con el backend.

Ejemplo:

```text
features/usuarios/services/usuario.service.js
```

Puede contener funciones como:

```text
getUsuarios()
getUsuario(id)
createUsuario(datos)
updateUsuario(id, datos)
updateEstadoUsuario(id, estado)
```

Los Services del frontend:

- realizan peticiones HTTP;
- reciben parámetros necesarios;
- devuelven respuestas de la API.

No deben contener reglas críticas del negocio.

Ejemplo:

```text
usuario.service.js
→ llama POST /api/usuarios

backend UsuarioService
→ decide si el usuario puede crearse
```

No confundir un Service del frontend con un Service del backend.

---

# 9. Configuración de API

La configuración común de Axios debe centralizarse en:

```text
src/api/api.js
```

Configuración conceptual:

```js
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true
});
```

No repetir la URL base manualmente en cada Service.

No crear una instancia Axios distinta por cada módulo sin una razón concreta.

---

# 10. Variables de entorno

La URL del backend debe configurarse mediante:

```text
VITE_API_URL
```

Ejemplo local:

```env
VITE_API_URL=http://localhost:3000/api
```

No colocar secretos del backend en variables `VITE_*`.

Las variables expuestas mediante Vite son accesibles desde el frontend.

Nunca colocar allí:

```text
JWT_SECRET
DB_PASSWORD
credenciales privadas
tokens secretos
```

El archivo `.env` local no debe versionarse si contiene configuración sensible o específica del entorno.

---

# 11. React Router

La configuración principal de rutas debe centralizarse en:

```text
src/app/router.jsx
```

Ejemplos conceptuales:

```text
/login
/usuarios
/proveedores
/medicamentos
/compras
/ventas
/inventario
/vencimientos
/recetas
/reportes
```

No dispersar la definición principal de rutas por archivos no relacionados.

Las páginas protegidas deben utilizar los mecanismos de autenticación definidos.

---

# 12. Layouts

Los Layouts están en:

```text
src/layouts/
```

## MainLayout

Se utiliza para las pantallas principales del sistema.

Puede contener:

- Header.
- Sidebar.
- Navegación.
- Área de contenido.

## AuthLayout

Se utiliza para pantallas de autenticación.

Ejemplo:

```text
Login
```

No duplicar Header, Sidebar o estructura principal dentro de cada página.

---

# 13. Autenticación

La autenticación utiliza JWT almacenado por el backend en una cookie HttpOnly.

React no debe guardar el token.

No almacenar JWT en:

```text
localStorage
sessionStorage
Context
useState
cookies manipuladas manualmente desde JavaScript
```

El navegador administra la cookie HttpOnly.

Axios debe utilizar:

```js
withCredentials: true
```

---

# 14. AuthContext

`AuthContext` se utiliza para compartir el estado público de autenticación.

Puede mantener:

```text
usuario
isAuthenticated
loading
login()
logout()
```

El usuario público puede contener datos como:

```js
{
  idUsuario,
  nombreUsuario,
  idRol
}
```

No almacenar en Context:

```text
JWT
password
password_hash
secretos
```

No utilizar Context como sustituto de toda la gestión de estado de la aplicación.

---

# 15. useAuth

El hook:

```text
src/hooks/useAuth.js
```

debe simplificar el acceso a `AuthContext`.

Ejemplo conceptual:

```js
const { usuario, login, logout } = useAuth();
```

No duplicar manualmente el acceso al contexto en muchos componentes si existe el hook.

---

# 16. Recuperación de sesión

React pierde su estado al recargar la página.

La cookie HttpOnly puede continuar vigente.

Por eso se recomienda utilizar:

```text
GET /api/auth/me
```

Flujo:

```text
Aplicación inicia
↓
AuthContext consulta /api/auth/me
↓
Navegador envía cookie
↓
Backend valida JWT
↓
Backend devuelve usuario público
↓
AuthContext restaura sesión
```

Durante esta comprobación debe existir un estado de carga para evitar redirecciones prematuras.

---

# 17. ProtectedRoute

`ProtectedRoute.jsx` controla si una pantalla requiere un usuario autenticado.

Responsabilidad:

```text
usuario autenticado
→ mostrar contenido

usuario no autenticado
→ redirigir a login
```

No utilizar `ProtectedRoute` como única medida de seguridad.

El backend debe proteger también el endpoint correspondiente.

---

# 18. RoleRoute

`RoleRoute.jsx` controla el acceso visual según el rol.

Ejemplo:

```text
Usuarios
→ Administrador
```

Puede utilizar:

```text
usuario.idRol
```

y constantes de roles.

La autorización definitiva siempre pertenece al backend.

---

# 19. Roles

Mantener constantes en:

```text
src/constants/roles.js
```

Ejemplo:

```js
export const ROLES = {
  ADMINISTRADOR: 1,
  REGENTE: 2,
  VENDEDOR: 3
};
```

Evitar código como:

```js
if (usuario.idRol === 1)
```

si puede utilizarse:

```js
if (usuario.idRol === ROLES.ADMINISTRADOR)
```

No crear nuevos roles desde el frontend.

Los roles actuales son fijos.

---

# 20. Seguridad

El frontend controla experiencia e interfaz.

El backend controla seguridad real.

Ejemplo:

```text
Frontend:
oculta botón "Crear usuario"

Backend:
requireRole(ROLES.ADMINISTRADOR)
```

Ocultar un botón no impide que alguien intente realizar una petición manual.

Nunca eliminar una validación del backend porque ya exista una validación en React.

---

# 21. Validaciones del frontend

El frontend puede validar:

- campos obligatorios;
- formato;
- longitud;
- números válidos;
- mensajes de ayuda;
- consistencia básica del formulario.

Estas validaciones mejoran la experiencia.

No reemplazan las validaciones del backend.

Regla:

```text
Frontend
→ experiencia de usuario

Backend
→ integridad y seguridad
```

No duplicar innecesariamente reglas complejas del negocio en React.

---

# 22. Estado local

Utilizar estado local cuando la información solo sea necesaria en una página o componente.

Ejemplos:

```text
formulario
modal abierto
filtro actual
página actual
loading local
mensaje de error
```

No convertir todo el estado en global.

---

# 23. Estado global

Para la primera versión de CADEFAR no utilizar por defecto:

```text
Redux
Redux Toolkit
Zustand
```

La solución inicial debe basarse en:

```text
useState
props
Context API para autenticación
```

Agregar una librería de estado global únicamente si aparece una necesidad real que justifique su uso.

---

# 24. Datos del servidor

No mantener copias globales innecesarias de información obtenida del backend.

Cuando una pantalla necesite datos:

```text
Page
↓
Service
↓
API
```

Mantener el manejo lo más simple posible.

No agregar herramientas adicionales de fetching o caching sin una necesidad concreta.

---

# 25. Formularios

Los formularios deben:

- manejar sus campos claramente;
- mostrar errores comprensibles;
- impedir envíos duplicados mientras una solicitud está en curso cuando corresponda;
- enviar al backend solamente los datos permitidos.

No enviar campos que genera o controla el backend.

Ejemplo al crear usuario, enviar:

```json
{
  "idRol": 3,
  "nombreUsuario": "vendedor01",
  "password": "12345678"
}
```

No enviar:

```text
idUsuario
passwordHash
estado
```

---

# 26. Manejo de errores

Las páginas y componentes deben manejar correctamente errores de la API.

Casos habituales:

```text
400 → datos inválidos
401 → sesión no válida
403 → sin autorización
404 → recurso no encontrado
409 → conflicto
500 → error inesperado
```

Mostrar mensajes útiles al usuario cuando corresponda.

No mostrar:

- stack traces;
- detalles internos de Sequelize;
- secretos;
- información técnica innecesaria.

No asumir que todo error significa 500.

---

# 27. Estados de carga

Cuando una operación espere una respuesta del backend:

- mostrar estado de carga cuando sea útil;
- evitar múltiples envíos accidentales;
- no mostrar datos antiguos como si fueran nuevos;
- restaurar el estado de la interfaz al finalizar.

Utilizar componentes compartidos como `Loading` cuando resulte conveniente.

---

# 28. Páginas por feature

Ejemplo de Usuarios:

```text
features/
└── usuarios/
    ├── pages/
    │   ├── UsuariosPage.jsx
    │   └── UsuarioFormPage.jsx
    │
    ├── components/
    │   ├── UsuarioForm.jsx
    │   └── UsuarioTable.jsx
    │
    └── services/
        └── usuario.service.js
```

Aplicar la misma idea a otros módulos sin crear archivos vacíos o carpetas innecesarias anticipadamente.

Crear cada archivo cuando realmente sea necesario.

---

# 29. Módulos previstos

Features principales:

```text
auth
usuarios
proveedores
medicamentos
compras
ventas
inventario
vencimientos
recetas
reportes
```

No crear una feature por cada tabla automáticamente.

Una feature representa una funcionalidad de la interfaz.

Por ejemplo:

```text
DetalleCompra
```

no necesita necesariamente una feature independiente.

Puede formar parte de:

```text
features/compras/
```

---

# 30. Inventario en la interfaz

Mantener siempre la diferencia entre:

```text
stock físico
stock vendible
```

No mostrar una existencia vencida como disponible para venta.

La interfaz puede ayudar al usuario a visualizar:

- existencias;
- vencimientos;
- stock físico;
- stock vendible;
- stock bajo.

La decisión definitiva sobre si una operación es válida corresponde al backend.

---

# 31. Ventas y FEFO

El backend es responsable de aplicar FEFO.

El frontend puede mostrar información que ayude a comprender qué existencias se utilizarán.

No implementar una lógica de selección independiente que pueda contradecir al backend.

Si el backend distribuye una venta entre varias existencias, la interfaz debe representar correctamente ese resultado.

---

# 32. Vencimientos

La interfaz puede mostrar:

- próximos a vencer;
- vencidos pendientes de retiro;
- fechas de vencimiento;
- cantidades físicas.

No asumir que un medicamento vencido tiene saldo cero.

No permitir visualmente usar una existencia vencida en una nueva venta.

El backend debe validar nuevamente la condición.

---

# 33. Alertas

No existe una entidad `Alerta`.

Las pantallas de alertas muestran resultados calculados por el backend.

No crear almacenamiento independiente de alertas en React como fuente de verdad.

---

# 34. Reportes

No existe una entidad `Reporte`.

Los reportes son consultas.

El frontend:

- solicita parámetros;
- consulta la API;
- presenta resultados.

No duplicar cálculos críticos si el backend ya los proporciona.

---

# 35. CSS y estilos

Mantener estilos organizados y comprensibles.

Utilizar:

```text
src/styles/
```

para estilos globales.

Los estilos específicos pueden mantenerse junto al componente o feature según la convención que se adopte durante el desarrollo.

No incorporar una librería completa de UI o CSS sin necesidad o sin solicitud explícita.

Mantener consistencia visual entre módulos.

---

# 36. Accesibilidad y usabilidad

La interfaz debe ser clara para el personal de la farmacia.

Priorizar:

- etiquetas comprensibles;
- formularios claros;
- botones con acciones identificables;
- mensajes de error visibles;
- confirmación antes de operaciones delicadas;
- navegación consistente.

No sacrificar claridad por diseños innecesariamente complejos.

---

# 37. Confirmaciones

Operaciones importantes pueden requerir confirmación visual.

Ejemplos:

```text
anular compra
anular venta
desactivar usuario
registrar retiro
```

Una confirmación del frontend no sustituye las reglas del backend.

---

# 38. Nombres y convenciones

Mantener nombres coherentes con el proyecto.

Ejemplos:

```text
UsuariosPage.jsx
UsuarioForm.jsx
usuario.service.js
ProtectedRoute.jsx
AuthContext.jsx
```

No cambiar estilos de nombres sin una razón concreta.

Seguir la convención ya existente en el módulo.

---

# 39. Imports

Mantener imports claros y ordenados.

Evitar:

- dependencias circulares;
- rutas innecesariamente complejas cuando la estructura pueda mantenerse simple;
- importar módulos enteros para utilizar una sola utilidad si no es necesario.

No introducir alias de importación sin necesidad si todavía no forman parte del proyecto.

---

# 40. Dependencias

Antes de instalar una nueva dependencia:

1. comprobar si React o las dependencias actuales ya resuelven la necesidad;
2. evitar librerías redundantes;
3. justificar la incorporación;
4. utilizar `pnpm`.

No ejecutar:

```text
npm install
yarn add
```

para agregar dependencias al proyecto salvo solicitud explícita.

Usar:

```text
pnpm add
pnpm add -D
```

según corresponda.

---

# 41. No sobrediseñar

No crear anticipadamente:

- componentes que todavía no se usan;
- hooks innecesarios;
- contexts para cada feature;
- abstracciones genéricas sin uso real;
- wrappers alrededor de Axios sin beneficio concreto;
- sistemas complejos de estado global;
- patrones sofisticados que dificulten el proyecto.

Implementar primero la solución más simple y clara.

---

# 42. Antes de implementar

Antes de escribir código:

1. inspeccionar los archivos actuales;
2. identificar la feature correcta;
3. revisar el endpoint del backend relacionado;
4. revisar requisitos, reglas y caso de uso;
5. comprobar roles involucrados;
6. reutilizar componentes existentes;
7. realizar el cambio mínimo necesario.

No asumir el formato de una respuesta API si puede comprobarse en el backend.

---

# 43. Después de implementar

Revisar:

- carga inicial;
- errores;
- estados vacíos;
- autenticación;
- autorización visual;
- envío de cookies;
- campos enviados al backend;
- navegación;
- recarga de página;
- consistencia visual;
- componentes reutilizados;
- posibles duplicaciones.

Informar al usuario:

- qué archivos fueron modificados;
- qué comportamiento se agregó;
- cualquier requisito del backend necesario para que funcione;
- qué debería probar manualmente.

---

# 44. Git

No ejecutar automáticamente:

```text
git commit
git push
git merge
```

salvo que el usuario lo solicite.

No cambiar de rama sin necesidad.

No modificar archivos no relacionados con la tarea.

---

# 45. Regla final

El frontend debe mantenerse:

```text
simple
modular
comprensible
coherente
reutilizable cuando tenga sentido
alineado con el backend
```

No intentar trasladar al frontend responsabilidades que pertenecen al backend.

Ante varias soluciones válidas, elegir la más sencilla que respete:

- React + Vite;
- la organización por features;
- la seguridad definida;
- los casos de uso;
- las reglas de negocio;
- la experiencia de usuario.
