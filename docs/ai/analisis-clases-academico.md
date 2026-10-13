# CADEFAR — ANÁLISIS DE CLASES POR CASO DE USO

Sistema de Información Web para la Administración de Inventario, Ventas y Control de Vencimiento de la Farmacia CADEFAR.

**Materia:** Sistemas de Información I. **Enfoque:** Boundary–Control–Entity (BCE).

> **Corrección según el docente — Fases 1 y 2:** CU01–CU13, con funciones locales reales de React, colaboración HTTP resumida y operaciones backend verificables.
> **Cobertura documental:** 33 CU implementados y 34 diagramas; CU08 conserva dos variantes.
> **Avance de la corrección:** trece CU y catorce diagramas corregidos. Las fases 3–6 conservan la versión conceptual anterior y quedan pendientes de esta corrección.

## 0. Alcance y criterios del análisis académico

Este documento explica cómo colaboran las clases de análisis para cumplir los objetivos del usuario:

**Actor → Interfaz React (Boundary) → Control HTTP / Control de negocio → Repository → Entidades (Entity).**

Las funciones HTTP del frontend y los contextos intermediarios se identifican en las tablas y notas; las dependencias HTTP del dibujo resumen esa colaboración.

Se mantienen dos niveles documentales independientes:

| Documento | Nivel y finalidad |
|---|---|
| [Análisis técnico por caso de uso](analisis-clase.md) | Documenta Controllers, Services, Repositories, Validators, middleware, modelos y métodos reales. Es la fuente principal de este análisis. |
| Este documento | Conserva BCE y, en las fases corregidas, representa componentes React, clases backend y modelos con nombres verificables en sus archivos fuente. |
| [Diagrama de clases general](diagrama-clases.md) | Permite comprobar nombres, atributos, tipos y asociaciones del modelo persistente. |

**Criterio del docente aplicado a las fases corregidas:** los componentes funcionales de React se representan como elementos `«boundary»`. Su compartimento de operaciones muestra las **funciones locales reales** que participan en el CU, con una nota que las distingue de métodos de clases JavaScript. Los callbacks recibidos se representan como props de tipo Function; los eventos inline se identifican en las correspondencias. Las funciones exportadas de servicios HTTP del frontend se documentan como intermediarias en las tablas, sin cajas independientes ni atribución de sus operaciones al componente. Las dependencias Boundary–Controller etiquetadas con verbo/endpoint son **colaboraciones HTTP resumidas**, no llamadas directas entre esos elementos. Los Controllers, Services y Repositories son clases exportadas reales: cada método dibujado pertenece a su clase. Los modelos conservan sus atributos persistentes completos. Los actores son elementos conceptuales UML, expresamente distintos del modelo Usuario.

**Transición por fases:** los nombres Vista... y Control... de las fases 3–6 son las abstracciones de la versión anterior, todavía pendientes de sustitución; no se consideran nombres implementados. Los cierres históricos de esas fases describen aquella entrega, no la verificación de la corrección actual.

### 0.1. Notación y selección de participantes

- `<<actor>>` representa un rol externo: Administrador, Regente o Vendedor. No hay herencia entre actores ni con Usuario; Administrador no hereda automáticamente permisos del Regente.
- `<<boundary>>` identifica un componente funcional real en las fases corregidas. Muestra estado/props relevantes y operaciones de análisis con el nombre y parámetros exactos de funciones locales, **sin `$`**. La nota del gráfico aclara que no son métodos de clase. `form.campo` identifica un dato anidado del estado, no una propiedad de clase.
- Una prop/callback como onSubmit, onConfirm u onLogout se muestra como dato Function, no como operación propia. La tabla identifica quién la implementa. Los eventos inline, callbacks anónimos de hooks y setters proporcionados por useState no se convierten en operaciones inventadas. Una función local a un efecto, como loadUsuario, se indica expresamente como tal y solo se incluye en el CU que la ejecuta.
- Los servicios HTTP del frontend son **módulos ES, no clases JavaScript**. Se documentan por archivo y firma exacta en la tabla de cada CU, sin cajas propias ni operaciones importadas en los Boundary. En las etiquetas HTTP, `(resumen)` identifica la colaboración con esos intermediarios; el fuente Mermaid utiliza `#58;` para mostrar el `:` de los parámetros de ruta sin interpretarlo como delimitador del diagrama.
- `<<control>>` identifica las clases reales Controller y Service en las fases corregidas; el sufijo de su nombre distingue ambas capas. Se muestran solo operaciones ejecutadas en el CU y caminos condicionales válidos, con `$` para indicar métodos estáticos.
- `<<repository>>` hace explícita la intermediación real entre Service y modelos. Se omiten Validators, utilidades y errores del gráfico principal por legibilidad; sus participaciones verificadas se explican en el texto y las tablas.
- `<<entity>>` identifica un modelo real. En las fases corregidas se muestran todos sus atributos persistentes, sin métodos de negocio inventados. `associate(models)` y los métodos heredados de Sequelize quedan fuera del dibujo.
- Los atributos de las entidades conservan los nombres persistentes `snake_case`. Los campos de las vistas usan nombres de interfaz `camelCase`; una contraseña introducida en una vista es temporal y nunca una columna de Usuario.
- Los tipos `VARCHAR_60`, `CHAR_64`, `INT_UNSIGNED`, `TINYINT_UNSIGNED` y `DATETIME_3` abrevian los tipos SQL indicados en el diagrama general. En Boundary, String, Boolean, Object, Array y Function describen los datos JavaScript verificados; no son declaraciones TypeScript del proyecto.
- `metodo(...)` abrevia exclusivamente los parámetros por legibilidad, nunca el nombre del método. Su **firma exacta**, incluidos objetos desestructurados y valores predeterminados, aparece en la tabla inmediatamente posterior al diagrama. Todos los métodos de Control/Repository de las fases corregidas son `static async`.
- `+` en Boundary identifica una operación de análisis respaldada por una función local, no un método público literal de JavaScript; en Control/Repository, un método propio. `-` identifica datos de estado, props o persistencia según el participante; no afirma visibilidad privada en JavaScript ni publicación de atributos de entidad en la API.
- `-->` une actor e interfaz. `..>` entre componentes identifica uso de props/callbacks, presentación o navegación por ruta, según su etiqueta. De Boundary a Controller, con **verbo/endpoint y `(resumen)`**, representa una colaboración HTTP resumida, **no una invocación directa**: la tabla identifica la función exportada, el archivo y el endpoint real. En CU01/CU02 también interviene useAuth / AuthProvider, explicado en nota y tabla. Entre clases backend expresa una dependencia real; únicamente los Repositories se conectan con los modelos para acceder a sus datos. No se utiliza herencia ni composición para llamadas/importaciones.
- `--` entre entidades representa una asociación del dominio con multiplicidades estructurales. Se conservan `1` y `0..*` donde corresponde; una FK no implica composición UML. No se dibujan rombos ni herencias inexistentes.
- Cada diagrama utiliza `direction LR` para favorecer la lectura de izquierda a derecha. Mermaid determina la posición exacta de las ramas de entidades.
- Un método o entidad condicional se incluye cuando participa en un camino real del CU. Las etiquetas y explicaciones indican su condición; no todos los caminos ejecutan todas las operaciones.

### 0.2. Organización y avance por fases

| Fase | Agrupación funcional | Casos | Estado académico |
|---|---|---|---|
| 1 | Autenticación, Usuarios y Recuperación | CU01–CU09 | Corregida contra código; nueve CU y diez diagramas; para revisión |
| 2 | Proveedores y Laboratorios | CU10–CU13 | Corregida contra código; cuatro CU y cuatro diagramas; para revisión |
| 3 | Medicamentos, Principios Activos y Composición | CU14–CU20 | Versión anterior; corrección pendiente |
| 4 | Compras | CU25–CU27 | Versión anterior; corrección pendiente |
| 5 | Inventario, Ajustes, Movimientos y Stock bajo | CU21–CU24, CU37 y CU40 | Versión anterior; corrección pendiente |
| 6 | Vencimientos y Retiros | CU33–CU36 | Versión anterior; corrección pendiente |

Las seis fases cubren los 33 CU implementados y 34 diagramas, conservando la numeración oficial y el orden por módulo acordado. Los ocho CU funcionalmente pendientes se identifican únicamente en la sección final, sin anticipar sus diagramas.

### 0.3. Fuentes y condiciones compartidas de Fase 1

Además del análisis técnico y del diagrama general, se consultan [Casos de uso](casos-uso.md), [Requerimientos](requerimientos.md), [Reglas de negocio](reglas-negocio.md) y [Contexto maestro](contexto-maestro.md), junto con las instrucciones AGENTS del repositorio, backend y frontend.

Las rutas y archivos de las correspondencias se expresan desde la raíz del repositorio. Las referencias a `authService`, `usuarioService` y `recuperacionPasswordService` corresponden a `backend/src/business/services/`; sus Controllers están en `backend/src/presentation/controllers/` y Validators en `backend/src/business/validators/`.

**Intermediarios HTTP del frontend:** `auth.service.js (frontend)` está en `frontend/src/features/auth/services/`; `usuario.service.js (frontend)`, en `frontend/src/features/usuarios/services/`. Ambos importan api de `frontend/src/api/api.js`, instancia Axios con `baseURL: import.meta.env.VITE_API_URL` y `withCredentials: true`. Los endpoints completos del dibujo corresponden a los prefijos `/api/auth` y `/api/usuarios` montados en `backend/src/app.js` más las rutas de sus routers; `:idUsuario` representa el parámetro sustituido por el ID real en la URL. Estas funciones y Axios se documentan sin cajas independientes. Los nombres de archivo frontend no se confunden con las clases authService/usuarioService del backend.

**Acceso:** CU01 y CU09 son públicos. CU02 y CU08 propio requieren sesión válida para cualquiera de los tres roles. CU03–CU07 y CU08 administrativo requieren Administrador. La implementación comprueba cuenta activa y versión de credenciales mediante authMiddleware/authService.getSessionUsuario, y aplica requireRole cuando corresponde. Esta condición transversal se explica aquí sin añadir un Control de autenticación repetido ni entidades ajenas al objetivo de cada CU.

**Seguridad de contraseñas:** toda contraseña nueva cumple complejidad, 8–100 caracteres y máximo 72 bytes UTF-8. Solo se persiste el hash. El navegador administra la cookie HttpOnly; las vistas no conservan JWT. La confirmación de contraseña es una comprobación local y no se envía al backend.

## 1. Fase 1 — Autenticación, Usuarios y Recuperación

### CU01 — Iniciar sesión

**Actor o actores:** Administrador, Regente o Vendedor, sin sesión previa requerida.

**Objetivo:** acceder al sistema con una cuenta activa mediante nombre de usuario y contraseña.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| LoginForm | Boundary; componente funcional | Recoge las credenciales y solicita el acceso desde LoginPage. |
| auth.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta login y realiza la petición de acceso, por intervención de AuthProvider. |
| authController | Control HTTP; clase | Valida la entrada, llama al Service y coloca la cookie. |
| authService | Control de negocio; clase | Verifica cuenta/contraseña y administra contador/bloqueo dentro de login. |
| usuarioRepository | Repository; clase | Busca la cuenta y actualiza su seguridad cuando corresponde. |
| Usuario | Entity | Representa la cuenta, sus credenciales protegidas y condiciones de acceso. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class LoginForm {
        <<boundary>>
        -String nombreUsuario
        -String password
        -Boolean submitting
        -String errorMessage
        +handleSubmit(event)
    }
    class authController {
        <<control>>
        +login(req, res, next)$
    }
    class authService {
        <<control>>
        +login(...)$
    }
    class usuarioRepository {
        <<repository>>
        +findByNombreUsuario(...)$
        +updateLoginSecurity(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -VARCHAR_255 correo
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    Administrador --> LoginForm
    Regente --> LoginForm
    Vendedor --> LoginForm
    LoginForm ..> authController : POST /api/auth/login (resumen)
    authController ..> authService : login
    authService ..> usuarioRepository : lectura y escritura condicional
    usuarioRepository ..> Usuario : acceso Sequelize
    note for LoginForm "handleSubmit es funcion local React; no metodo de clase.\nHTTP resumido via useAuth / AuthProvider;\nlogin(credentials) de auth.service.js (frontend)."
```

**Correspondencia verificable y firmas exactas** (los puntos suspensivos del dibujo solo abrevian parámetros):

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU01 | LoginForm | Componente funcional LoginForm | `frontend/src/features/auth/components/LoginForm.jsx` | Función local `handleSubmit(event)` | Evento onSubmit; valida, llama a login recibido de useAuth y navega. login no es función propia del formulario. |
| CU01 | authController | Clase authController | `backend/src/presentation/controllers/auth.controller.js` | `login(req, res, next)` | Entrada HTTP; coloca cookie. |
| CU01 | authService | Clase authService | `backend/src/business/services/auth.service.js` | `login({ nombreUsuario, password })` | Cuenta, bcrypt, contador/bloqueo y generación del JWT dentro del método. |
| CU01 | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findByNombreUsuario({ nombreUsuario, transaction = undefined, lock = false })`; `updateLoginSecurity({ idUsuario, intentosFallidosLogin, bloqueadoHasta, transaction })` | La escritura ocurre ante fallo o limpieza necesaria tras éxito. |
| CU01 | Usuario | Modelo Usuario | `backend/src/data/models/usuario.js` | — | Nueve atributos persistentes; sin operaciones propias de negocio. |
| CU01 | AuthProvider, intermediario en nota | Componente funcional; función de contexto | `frontend/src/features/auth/context/AuthContext.jsx` | Local `login(credentials)` | LoginForm obtiene login mediante useAuth; AuthProvider llama a loginRequest(credentials) y actualiza usuario. No es la función del módulo HTTP. |
| CU01 | auth.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/auth/services/auth.service.js` | `login(credentials)` | AuthProvider la importa como loginRequest; api.post('/auth/login', credentials). No es authService del backend. |
| CU01 | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/auth.router.js`; `backend/src/app.js` | `POST /api/auth/login` | authRouter.post('/login', authController.login), con prefijo /api/auth; no es un método React. |

**Descripción de relaciones:** los actores utilizan LoginForm, contenido en LoginPage. handleSubmit utiliza login obtenido de useAuth; AuthProvider ejecuta su función local login y llama a loginRequest, alias de la exportación login del módulo auth.service.js (frontend). La dependencia LoginForm–authController resume esta colaboración, explícita en nota y tabla, no una llamada directa del formulario. La función HTTP solicita POST /api/auth/login mediante Axios. authController llama a authService; este accede a Usuario mediante usuarioRepository. El rol se obtiene de la FK sin consultar Rol. No hay una entidad SesionUsuario ni métodos Usuario.validarCredenciales.

**Interacción Boundary:** los onChange de nombre/contraseña y el onClick de visibilidad son eventos inline que utilizan setters de useState; no existen updateField, handleChange ni un handler de visibilidad independiente en LoginForm. getLoginErrorMessage es una función de módulo del mismo archivo, no una operación local del componente.

Una contraseña incorrecta incrementa los fallos de una cuenta activa no bloqueada; el tercero bloquea diez minutos. Los intentos durante el bloqueo no lo prolongan. El éxito reinicia el contador cuando corresponde. Solo las credenciales aceptadas permiten establecer sesión; una cuenta inexistente no genera un contador persistido.

**Apoyos reales omitidos del dibujo:** `authValidator.validateLogin(data)` en `backend/src/business/validators/auth.validator.js` valida el body. `generarToken({ idUsuario, idRol, versionCredenciales })` en `backend/src/shared/utils/jwt.js` es una función exportada, no un método de authService. bcrypt.compare pertenece a la librería. `POST /api/auth/login` está declarado en `backend/src/presentation/routes/auth.router.js`.

La restauración al recargar mediante `/api/auth/me` es una solicitud de apoyo distinta y no se añade como método de este Control. Referencias: RF01/RF03; RN05/RN07/RN115.

### CU02 — Cerrar sesión

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** finalizar la sesión actual en el navegador.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| AppHeader / AppSidebar | Boundary; componentes funcionales | Ofrecen la acción de salida mediante la prop onLogout. |
| MainLayout | Boundary; componente funcional padre | Implementa handleLogout y lo pasa a ambas interfaces como onLogout. |
| auth.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta logout y solicita el cierre, por intervención de AuthProvider. |
| authController | Control HTTP; clase | Elimina la cookie en logout. |
| authMiddleware | Función de middleware | Comprueba la sesión antes del Controller. |
| authService | Control de negocio; clase | Comprueba la cuenta activa y su versión en getSessionUsuario. |
| usuarioRepository | Repository; clase | Lee la cuenta para comprobar la sesión. |
| Usuario | Entity | Aporta el estado y versión para comprobar la sesión antes de cerrar. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class AppHeader {
        <<boundary>>
        -Boolean closingSession
        -Function onLogout
    }
    class AppSidebar {
        <<boundary>>
        -Boolean closingSession
        -Function onLogout
    }
    class MainLayout {
        <<boundary>>
        -Boolean closingSession
        +handleLogout()
    }
    class authController {
        <<control>>
        +logout(req, res, next)$
    }
    class authMiddleware {
        <<funcion>>
    }
    class authService {
        <<control>>
        +getSessionUsuario(idUsuario, versionCredenciales)$
    }
    class usuarioRepository {
        <<repository>>
        +findByIdForSession(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -VARCHAR_255 correo
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    Administrador --> AppHeader
    Regente --> AppHeader
    Vendedor --> AppHeader
    Administrador --> AppSidebar
    Regente --> AppSidebar
    Vendedor --> AppSidebar
    AppHeader ..> MainLayout : callback onLogout
    AppSidebar ..> MainLayout : callback onLogout
    MainLayout ..> authController : POST /api/auth/logout (resumen)
    authMiddleware ..> authController : next antes de logout
    authMiddleware ..> authService : getSessionUsuario
    authService ..> usuarioRepository : findByIdForSession
    usuarioRepository ..> Usuario : lectura Sequelize
    note for MainLayout "handleLogout es funcion local React; no metodo de clase.\nHTTP resumido via useAuth / AuthProvider;\nlogout() de auth.service.js (frontend)."
    note for AppHeader "onLogout es prop; sin funcion local de cierre"
    note for AppSidebar "onLogout es prop; sin funcion local de cierre"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU02 | AppHeader / AppSidebar | Componentes funcionales | `frontend/src/layouts/components/AppHeader.jsx`; `frontend/src/layouts/components/AppSidebar.jsx` | Reciben la prop onLogout | onClick usa ese callback; ninguno define una función local de cierre. handleKeyDown de AppSidebar corresponde a navegación/foco y no se incorpora al logout. |
| CU02 | MainLayout | Componente funcional padre | `frontend/src/layouts/MainLayout.jsx` | Función local `handleLogout()` | Pasa handleLogout como onLogout a AppHeader y AppSidebar; llama a logout recibido de useAuth. |
| CU02 | authController | Clase authController | `backend/src/presentation/controllers/auth.controller.js` | `logout(req, res, next)` | Elimina cookie; no llama a authService.logout. |
| CU02 | authMiddleware | Función exportada | `backend/src/presentation/middlewares/auth.middleware.js` | `authMiddleware(req, res, next)` | No es clase; usa getSessionUsuario y llama next. |
| CU02 | authService | Clase authService | `backend/src/business/services/auth.service.js` | `getSessionUsuario(idUsuario, versionCredenciales)` | Ejecutado por middleware, no por logout. |
| CU02 | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findByIdForSession({ idUsuario })` | Solo lectura de la cuenta. |
| CU02 | Usuario | Modelo Usuario | `backend/src/data/models/usuario.js` | — | Nueve atributos; no se modifica. |
| CU02 | AuthProvider, intermediario en nota | Componente funcional; función de contexto | `frontend/src/features/auth/context/AuthContext.jsx` | Local `logout()` | MainLayout obtiene logout de useAuth; AuthProvider llama a logoutRequest y limpia usuario en finally. |
| CU02 | auth.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/auth/services/auth.service.js` | `logout()` | AuthProvider la importa como logoutRequest; api.post('/auth/logout'). No existe authService.logout del backend. |
| CU02 | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/auth.router.js`; `backend/src/app.js` | `POST /api/auth/logout` | authRouter.post('/logout', authMiddleware, authController.logout), con prefijo /api/auth. |

**Descripción de relaciones:** AppHeader y AppSidebar invocan la prop onLogout, implementada como handleLogout en MainLayout. Este llama a logout del contexto mediante useAuth; AuthProvider llama a logoutRequest, alias de la función exportada logout de auth.service.js (frontend). El módulo solicita `POST /api/auth/logout` y MainLayout navega a login. La dependencia MainLayout–authController resume esta colaboración HTTP, identificando la intermediación del contexto en nota y tabla; no afirma una llamada directa. authMiddleware comprueba Usuario mediante authService y usuarioRepository antes de autorizar la ejecución de authController.logout. No existe dependencia logout → authService. Cerrar sesión elimina la cookie sin incrementar versión ni revocar todas las posibles copias del token.

**Correspondencia con la implementación:** `frontend/src/layouts/components/AppHeader.jsx`, `AppSidebar.jsx` y `frontend/src/layouts/MainLayout.jsx` representan la acción de interfaz; no existe una página independiente de logout. AuthContext limpia el estado público de autenticación incluso si la solicitud falla.

`res.clearCookie` es una operación de Express, no un método propio del Controller. La ruta está en `backend/src/presentation/routes/auth.router.js`. Referencias: RF02/RF03 y CU02.

### CU03 — Crear usuario

**Actor o actores:** Administrador autenticado.

**Objetivo:** registrar una cuenta con un rol existente y activo, nombre único y contraseña protegida.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| UsuarioFormPage / UsuarioForm | Boundary; componentes funcionales | Coordinan el alta y sus campos reales, incluida confirmPassword. |
| usuario.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta createUsuario y envía los datos recibidos de la página. |
| usuarioController | Control HTTP; clase | Valida la entrada y atiende createUsuario. |
| usuarioService | Control de negocio; clase | Comprueba unicidad/rol, genera hash, crea y relee los datos públicos. |
| usuarioRepository | Repository; clase | Consulta Usuario/Rol, inserta y obtiene la cuenta creada. |
| Usuario | Entity | Representa la cuenta creada y su identificación. |
| Rol | Entity | Representa uno de los roles fijos asignables. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class UsuarioForm {
        <<boundary>>
        -String form.nombreUsuario
        -String form.idRol
        -String form.password
        -String form.confirmPassword
        -String form.correo
        -Function onSubmit
        -Function onCancel
        +updateField(event)
        +handleSubmit(event)
    }
    class UsuarioFormPage {
        <<boundary>>
        -String mode
        -Boolean submitting
        -String errorMessage
        +handleSubmit(data)
    }
    class usuarioController {
        <<control>>
        +createUsuario(req, res, next)$
    }
    class usuarioService {
        <<control>>
        +createUsuario(...)$
        +getUsuarioById(...)$
    }
    class usuarioRepository {
        <<repository>>
        +findByNombreUsuario(...)$
        +findByCorreo(...)$
        +findRolById(...)$
        +createUsuario(...)$
        +findById(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 correo
        -VARCHAR_255 password_hash
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
        -VARCHAR_255 descripcion
        -BOOLEAN estado
    }
    Administrador --> UsuarioForm
    UsuarioForm ..> UsuarioFormPage : callback onSubmit
    UsuarioFormPage ..> usuarioController : POST /api/usuarios (resumen)
    usuarioController ..> usuarioService : createUsuario
    usuarioService ..> usuarioRepository
    usuarioRepository ..> Usuario : consultas e insercion
    usuarioRepository ..> Rol : valida e incluye
    Rol "1" -- "0..*" Usuario : rol
    note for UsuarioForm "Operaciones = funciones locales React; no metodos de clase. onSubmit y onCancel son props"
    note for UsuarioFormPage "handleSubmit(data) es funcion local de la pagina React; no metodo de clase"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU03 | UsuarioForm | Componente funcional | `frontend/src/features/usuarios/components/UsuarioForm.jsx` | Locales `updateField(event)` y `handleSubmit(event)` | onChange usa updateField; onSubmit del elemento form usa handleSubmit. Este convierte idRol a Number y llama a la prop onSubmit, sin realizar HTTP. |
| CU03 | UsuarioFormPage | Componente funcional | `frontend/src/features/usuarios/pages/UsuarioFormPage.jsx` | Local `handleSubmit(data)` | mode=create; pasa esta función como onSubmit y llama a createUsuario(data). onCancel recibe una función inline de navegación; no existe handleCancel. |
| CU03 | usuarioController | Clase usuarioController | `backend/src/presentation/controllers/usuario.controller.js` | `createUsuario(req, res, next)` | Entrada HTTP. |
| CU03 | usuarioService | Clase usuarioService | `backend/src/business/services/usuario.service.js` | `createUsuario({ idRol, nombreUsuario, password, correo })`; `getUsuarioById(idUsuario, transaction = undefined)` | El segundo método se llama dentro del alta, no por otra petición. |
| CU03 | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findByNombreUsuario({ nombreUsuario, transaction = undefined, lock = false })`; `findByCorreo({ correo, transaction = undefined })`; `findRolById({ idRol, transaction = undefined })`; `createUsuario({ idRol, nombreUsuario, passwordHash, correo = null })`; `findById({ idUsuario, transaction = undefined })` | Correo se consulta si no es nulo/omitido; findById incluye Rol. |
| CU03 | Usuario / Rol | Modelos Usuario y Rol | `backend/src/data/models/usuario.js`; `backend/src/data/models/rol.js` | — | Nueve y cuatro atributos completos. |
| CU03 | usuario.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/usuarios/services/usuario.service.js` | `createUsuario(data)` | UsuarioFormPage la importa y llama desde handleSubmit en modo create; api.post('/usuarios', data). |
| CU03 | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/usuario.router.js`; `backend/src/app.js` | `POST /api/usuarios` | usuarioRouter.post('/', usuarioController.createUsuario), con prefijo /api/usuarios y middleware de Administrador. |

**Descripción de relaciones:** UsuarioFormPage renderiza UsuarioForm y recibe sus datos por onSubmit. Su handleSubmit llama a createUsuario del módulo usuario.service.js (frontend), que solicita POST /api/usuarios; no hay llamada HTTP propia de UsuarioForm. usuarioController llama a usuarioService, que consulta y escribe mediante usuarioRepository. Cada Usuario pertenece a un Rol; un Rol tiene cero o más usuarios. No hay herencia de permisos.

**Interacción Boundary de CU03:** UsuarioForm.handleSubmit(event) es una función local que valida y ejecuta la prop onSubmit; la página suministra su propia handleSubmit(data). createUsuario(data) pertenece al módulo HTTP, no a ninguno de los componentes. loadUsuario está definida dentro del efecto de UsuarioFormPage, pero ese efecto retorna antes de ejecutarla en modo create: no participa en CU03. El botón Cancelar invoca onCancel, recibido como `() => navigate('/usuarios')`. PasswordInput maneja la visibilidad con un evento inline y PasswordRequirements presenta reglas, sin handlers locales nombrados necesarios en este dibujo; no se añaden cajas auxiliares ni operaciones ficticias.

La contraseña se transforma en hash antes de persistir. Su confirmación se comprueba localmente y no se envía al backend. El ID y el estado inicial proceden del backend; el actor no los introduce. Correo es opcional y único cuando está presente. No se crea una recuperación al registrar la cuenta.

**Correspondencia con la implementación:** `/usuarios/nuevo`, `frontend/src/features/usuarios/pages/UsuarioFormPage.jsx` y `frontend/src/features/usuarios/components/UsuarioForm.jsx` representan la vista; el servicio HTTP invoca `POST /api/usuarios`.

**Funciones externas, no métodos del Service:** `throwIfDuplicateUsuario(nombreUsuario, idUsuario = undefined, transaction = undefined)`, `throwIfDuplicateCorreo(correo, idUsuario = undefined, transaction = undefined)`, `validateRolActivo(idRol, transaction = undefined)`, `handleDuplicateDatabaseError(error)` y `toPublicUsuario(usuario)` están declaradas a nivel de módulo en `backend/src/business/services/usuario.service.js`. El Controller usa `usuarioValidator.validateCreateUsuario(data)` en `backend/src/business/validators/usuario.validator.js`. bcrypt.hash es de librería.

Referencias: RF04/RF05/RF09; RN01–RN07/RN107.

### CU04 — Consultar usuarios

**Actor o actores:** Administrador autenticado.

**Objetivo:** consultar las cuentas registradas, con sus datos públicos, rol y estado.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| UsuariosPage / UsuarioTable | Boundary; componentes funcionales | Cargan y muestran el listado, con filtros locales reales. |
| usuario.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta getUsuarios y consulta el listado para UsuariosPage. |
| usuarioController / usuarioService | Control; clases | Atienden getUsuarios y preparan datos públicos. |
| usuarioRepository | Repository; clase | Consulta cuentas con su Rol. |
| Usuario | Entity | Representa las cuentas activas e inactivas consultadas. |
| Rol | Entity | Identifica el rol de cada cuenta. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class UsuariosPage {
        <<boundary>>
        -String search
        -String statusFilter
        -Array usuarios
        +loadUsuarios()
    }
    class UsuarioTable {
        <<boundary>>
        -Array usuarios
    }
    class usuarioController {
        <<control>>
        +getUsuarios(req, res, next)$
    }
    class usuarioService {
        <<control>>
        +getUsuarios()$
    }
    class usuarioRepository {
        <<repository>>
        +findAllUsuarios()$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -VARCHAR_255 correo
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
        -VARCHAR_255 descripcion
        -BOOLEAN estado
    }
    Administrador --> UsuariosPage
    UsuariosPage ..> UsuarioTable : renderiza listado filtrado
    UsuariosPage ..> usuarioController : GET /api/usuarios (resumen)
    usuarioController ..> usuarioService
    usuarioService ..> usuarioRepository
    usuarioRepository ..> Usuario : lectura
    usuarioRepository ..> Rol : include
    Rol "1" -- "0..*" Usuario : rol
    note for UsuariosPage "loadUsuarios es funcion local React; no metodo de clase"
    note for UsuarioTable "Presentacion del listado; sin funcion local de consulta"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU04 | UsuariosPage | Componente funcional | `frontend/src/features/usuarios/pages/UsuariosPage.jsx` | Local `loadUsuarios()` | Invocada desde useEffect y onClick de Reintentar; llama a getUsuarios del módulo HTTP. |
| CU04 | UsuarioTable | Componente funcional | `frontend/src/features/usuarios/components/UsuarioTable.jsx` | — | Recibe usuarios; muestra ID, nombre, rol y estado. No define una función local de consulta. |
| CU04 | usuarioController | Clase usuarioController | `backend/src/presentation/controllers/usuario.controller.js` | `getUsuarios(req, res, next)` | GET /api/usuarios. |
| CU04 | usuarioService | Clase usuarioService | `backend/src/business/services/usuario.service.js` | `getUsuarios()` | Usa toPublicUsuario, función externa del mismo módulo. |
| CU04 | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findAllUsuarios()` | include Rol; sin escritura. |
| CU04 | Usuario / Rol | Modelos | `backend/src/data/models/usuario.js`; `backend/src/data/models/rol.js` | — | Atributos completos del modelo, no todos se devuelven al cliente. |
| CU04 | usuario.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/usuarios/services/usuario.service.js` | `getUsuarios()` | UsuariosPage la importa y llama desde loadUsuarios; api.get('/usuarios'). |
| CU04 | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/usuario.router.js`; `backend/src/app.js` | `GET /api/usuarios` | usuarioRouter.get('/', usuarioController.getUsuarios), con prefijo /api/usuarios. |

**Descripción de relaciones:** loadUsuarios de UsuariosPage llama a getUsuarios del módulo usuario.service.js (frontend), que solicita GET /api/usuarios. usuarioRepository consulta Usuario con include Rol. usuarioService convierte a DTO público y usuarioController devuelve los datos a través del cliente HTTP a UsuariosPage, que renderiza UsuarioTable con filteredUsuarios. El listado conserva activos/inactivos y admite resultado vacío. Los filtros no generan operaciones de backend.

**Interacción Boundary:** search/statusFilter cambian mediante onChange inline; filteredUsuarios es un valor calculado por un callback anónimo de useMemo, no una función propia denominada aplicarFiltros. Los callbacks de cambio de estado/restablecimiento de UsuarioTable corresponden a CU07/CU08 y no se añaden como operaciones de consulta.

**Correspondencia con la implementación:** `/usuarios`, `frontend/src/features/usuarios/pages/UsuariosPage.jsx` y `frontend/src/features/usuarios/components/UsuarioTable.jsx` representan la vista.

La conversión usa la función de módulo `toPublicUsuario(usuario)` en `backend/src/business/services/usuario.service.js`; no es un método de usuarioService. No se devuelve password_hash ni información privada de seguridad.

No se atribuye un Validator específico al listado ni una escritura a sus filtros. Referencias: RF04/RF06 y CU04.

### CU05 — Consultar usuario por ID

**Actor o actores:** Administrador autenticado.

**Objetivo:** obtener los datos públicos de una cuenta específica existente.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| UsuarioFormPage / UsuarioForm | Boundary; componentes funcionales | Cargan la cuenta por ID y presentan initialData en edición. |
| usuario.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta getUsuario y consulta la cuenta por ID. |
| usuarioController / usuarioService | Control; clases | Validan ID y obtienen datos públicos de la cuenta. |
| usuarioRepository | Repository; clase | Consulta Usuario con include Rol. |
| Usuario | Entity | Representa la cuenta consultada. |
| Rol | Entity | Aporta el rol asociado a la cuenta. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class UsuarioFormPage {
        <<boundary>>
        -String idUsuario
        -Object usuario
        -Boolean loading
        +loadUsuario()
    }
    class UsuarioForm {
        <<boundary>>
        -Object initialData
        -String form.nombreUsuario
        -String form.correo
        -String form.idRol
    }
    class usuarioController {
        <<control>>
        +getUsuarioById(req, res, next)$
    }
    class usuarioService {
        <<control>>
        +getUsuarioById(...)$
    }
    class usuarioRepository {
        <<repository>>
        +findById(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -VARCHAR_255 correo
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
        -VARCHAR_255 descripcion
        -BOOLEAN estado
    }
    Administrador --> UsuarioFormPage
    UsuarioFormPage ..> UsuarioForm : renderiza con initialData
    UsuarioFormPage ..> usuarioController : GET /api/usuarios/#58;idUsuario (resumen)
    usuarioController ..> usuarioService
    usuarioService ..> usuarioRepository
    usuarioRepository ..> Usuario : lectura
    usuarioRepository ..> Rol : include
    Rol "1" -- "0..*" Usuario : rol
    note for UsuarioFormPage "loadUsuario es funcion local al efecto React; no metodo de clase"
    note for UsuarioForm "En CU05 carga initialData mediante efecto anonimo; handlers de edicion en CU06"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU05 | UsuarioFormPage | Componente funcional | `frontend/src/features/usuarios/pages/UsuarioFormPage.jsx` | Local al efecto `loadUsuario()` | El efecto la define y ejecuta en edición; usa getUsuario(numericId) del módulo HTTP. No es función pública del componente. |
| CU05 | UsuarioForm | Componente funcional | `frontend/src/features/usuarios/components/UsuarioForm.jsx` | — | Carga form desde initialData mediante un efecto anónimo. updateField/handleSubmit participan en CU06, no en esta lectura. |
| CU05 | usuarioController | Clase usuarioController | `backend/src/presentation/controllers/usuario.controller.js` | `getUsuarioById(req, res, next)` | Usa la función externa getIdUsuario(params), del mismo archivo. |
| CU05 | usuarioService | Clase usuarioService | `backend/src/business/services/usuario.service.js` | `getUsuarioById(idUsuario, transaction = undefined)` | Error 404 si no existe. |
| CU05 | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findById({ idUsuario, transaction = undefined })` | Incluye Rol. |
| CU05 | Usuario / Rol | Modelos | `backend/src/data/models/usuario.js`; `backend/src/data/models/rol.js` | — | Atributos persistentes completos. |
| CU05 | usuario.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/usuarios/services/usuario.service.js` | `getUsuario(idUsuario)` | loadUsuario, local al efecto de UsuarioFormPage, llama a getUsuario(numericId); api.get con /usuarios/${idUsuario}. |
| CU05 | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/usuario.router.js`; `backend/src/app.js` | `GET /api/usuarios/:idUsuario` | usuarioRouter.get('/:idUsuario', usuarioController.getUsuarioById), con prefijo /api/usuarios. |

**Descripción de relaciones:** loadUsuario de UsuarioFormPage llama a getUsuario del módulo usuario.service.js (frontend), que solicita GET /api/usuarios/:idUsuario. El Controller llama al Service, que lee mediante Repository; initialData alimenta UsuarioForm. La consulta no modifica datos, estado ni contraseña.

**Correspondencia con la implementación:** es la carga inicial en `/usuarios/:idUsuario/editar`, sin pantalla independiente de detalle. Prepara CU06, cuya escritura se analiza por separado. `usuarioValidator.validateIdUsuario(data)` está en `backend/src/business/validators/usuario.validator.js`; `getIdUsuario(params)` y `getValidatedData(result)` son funciones de módulo del Controller, no métodos de su clase.

Referencias: RF04/RF06 y CU05.

### CU06 — Modificar usuario

**Actor o actores:** Administrador autenticado.

**Objetivo:** modificar nombre, rol y/o correo de una cuenta, manteniendo las condiciones de unicidad y seguridad.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| UsuarioFormPage / UsuarioForm | Boundary; componentes funcionales | Coordinan la edición y envío de campos permitidos. |
| usuario.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta updateUsuario y envía los cambios de la página. |
| usuarioController / usuarioService | Control; clases | Atienden updateUsuario y su lectura pública interna. |
| usuarioRepository | Repository; clase | Bloquea, valida datos relacionados, actualiza y relee la cuenta. |
| recuperacionPasswordRepository | Repository; clase | Invalida pendientes si cambia o se retira el correo. |
| Usuario | Entity | Representa la cuenta y los datos modificables. |
| Rol | Entity | Representa la asignación que se valida cuando se proporciona un rol. |
| RecuperacionPassword | Entity | Representa emisiones pendientes que se invalidan ante cambio efectivo o retirada de correo. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class UsuarioForm {
        <<boundary>>
        -String form.nombreUsuario
        -String form.idRol
        -String form.correo
        -Function onSubmit
        -Function onCancel
        +updateField(event)
        +handleSubmit(event)
    }
    class UsuarioFormPage {
        <<boundary>>
        -String idUsuario
        -Boolean submitting
        -String errorMessage
        +handleSubmit(data)
    }
    class usuarioController {
        <<control>>
        +updateUsuario(req, res, next)$
    }
    class usuarioService {
        <<control>>
        +updateUsuario(...)$
        +getUsuarioById(...)$
    }
    class usuarioRepository {
        <<repository>>
        +findByIdForUpdate(...)$
        +findByNombreUsuario(...)$
        +findByCorreo(...)$
        +findRolById(...)$
        +updateUsuario(...)$
        +findById(...)$
    }
    class recuperacionPasswordRepository {
        <<repository>>
        +invalidatePendingByUsuario(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -VARCHAR_255 correo
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
        -VARCHAR_255 descripcion
        -BOOLEAN estado
    }
    class RecuperacionPassword {
        <<entity>>
        -INT id_recuperacion
        -INT id_usuario
        -CHAR_64 codigo_hmac
        -CHAR_36 nonce
        -DATETIME_3 fecha_solicitud
        -DATETIME_3 expira_en
        -TINYINT_UNSIGNED intentos_fallidos
        -DATETIME_3 consumida_en
        -DATETIME_3 invalidada_en
    }
    Administrador --> UsuarioForm
    UsuarioForm ..> UsuarioFormPage : callback onSubmit
    UsuarioFormPage ..> usuarioController : PATCH /api/usuarios/#58;idUsuario (resumen)
    usuarioController ..> usuarioService : updateUsuario
    usuarioService ..> usuarioRepository
    usuarioService ..> recuperacionPasswordRepository : si cambia o retira correo
    usuarioRepository ..> Usuario
    usuarioRepository ..> Rol : valida condicional e incluye
    recuperacionPasswordRepository ..> RecuperacionPassword : invalidacion condicional
    Rol "1" -- "0..*" Usuario : rol
    Usuario "1" -- "0..*" RecuperacionPassword : recuperacionesPassword
    note for UsuarioForm "Operaciones = funciones locales React; no metodos de clase. onSubmit y onCancel son props"
    note for UsuarioFormPage "handleSubmit(data) es funcion local de la pagina React; no metodo de clase"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU06 | UsuarioForm | Componente funcional | `frontend/src/features/usuarios/components/UsuarioForm.jsx` | Locales `updateField(event)` y `handleSubmit(event)` | mode=edit; onChange actualiza campos y onSubmit del form ejecuta handleSubmit, que invoca la prop onSubmit. No envía contraseña. |
| CU06 | UsuarioFormPage | Componente funcional | `frontend/src/features/usuarios/pages/UsuarioFormPage.jsx` | Local `handleSubmit(data)` | Recibida por UsuarioForm como onSubmit; llama a updateUsuario(Number(idUsuario), data). onCancel recibe navegación inline, sin handleCancel. |
| CU06 | usuarioController | Clase usuarioController | `backend/src/presentation/controllers/usuario.controller.js` | `updateUsuario(req, res, next)` | PATCH /api/usuarios/:idUsuario. |
| CU06 | usuarioService | Clase usuarioService | `backend/src/business/services/usuario.service.js` | `updateUsuario(idUsuario, { idRol, nombreUsuario, correo })`; `getUsuarioById(idUsuario, transaction = undefined)` | La lectura pública ocurre dentro de updateUsuario. |
| CU06 | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findByIdForUpdate({ idUsuario, transaction })`; `findByNombreUsuario({ nombreUsuario, transaction = undefined, lock = false })`; `findByCorreo({ correo, transaction = undefined })`; `findRolById({ idRol, transaction = undefined })`; `updateUsuario({ idUsuario, idRol, nombreUsuario, correo, transaction = undefined })`; `findById({ idUsuario, transaction = undefined })` | Unicidad/rol según campos recibidos; findById incluye Rol. |
| CU06 | recuperacionPasswordRepository | Clase recuperacionPasswordRepository | `backend/src/data/repositories/recuperacion-password.repository.js` | `invalidatePendingByUsuario({ idUsuario, invalidadaEn, transaction })` | Solo ante cambio efectivo o retirada del correo. |
| CU06 | Usuario / Rol / RecuperacionPassword | Modelos | `backend/src/data/models/usuario.js`; `backend/src/data/models/rol.js`; `backend/src/data/models/recuperacion-password.js` | — | Nueve, cuatro y nueve atributos completos. |
| CU06 | usuario.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/usuarios/services/usuario.service.js` | `updateUsuario(idUsuario, data)` | UsuarioFormPage la importa y llama desde handleSubmit en modo edit; api.patch con /usuarios/${idUsuario} y data. |
| CU06 | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/usuario.router.js`; `backend/src/app.js` | `PATCH /api/usuarios/:idUsuario` | usuarioRouter.patch('/:idUsuario', usuarioController.updateUsuario), con prefijo /api/usuarios. |

**Descripción de relaciones:** la página recibe datos del formulario mediante onSubmit; su handleSubmit llama a updateUsuario del módulo usuario.service.js (frontend), que solicita PATCH /api/usuarios/:idUsuario. usuarioController llama a usuarioService; este accede por los dos Repositories. Cada cuenta conserva un rol y puede tener varias recuperaciones históricas. RecuperacionPassword se modifica únicamente si el correo cambia efectivamente o se retira: omitido se conserva, nulo se retira y el mismo correo normalizado no invalida. Actualización e invalidación se confirman juntas.

Los chequeos de nombre, correo y rol dependen de los campos proporcionados. El CU no cambia contraseña, estado, versión de credenciales ni cuotas IP. La carga preparatoria corresponde a CU05.

**Interacción Boundary:** se reutilizan las dos funciones locales de UsuarioForm, pero la rama edit de handleSubmit no valida ni envía la contraseña inicial. El handleSubmit de la página ejecuta updateUsuario del módulo HTTP, no createUsuario. loadUsuario y la carga desde initialData se analizan en CU05; no se copian como operaciones de esta escritura.

**Correspondencia con la implementación:** `/usuarios/:idUsuario/editar`, `frontend/src/features/usuarios/pages/UsuarioFormPage.jsx` y `frontend/src/features/usuarios/components/UsuarioForm.jsx` representan la vista.

**Apoyos externos:** `usuarioValidator.validateIdUsuario(data)` y `validateUpdateUsuario(data)` están en `backend/src/business/validators/usuario.validator.js`. Las funciones de módulo `throwIfDuplicateUsuario`, `throwIfDuplicateCorreo`, `validateRolActivo`, `handleDuplicateDatabaseError` y `toPublicUsuario`, descritas en CU03, no se presentan como métodos de usuarioService. La lectura HTTP preparatoria pertenece a CU05; la lectura interna getUsuarioById sí participa en este PATCH.

Referencias: RF04/RF07, RI15; RN04/RN107.

### CU07 — Activar o desactivar usuario

**Actor o actores:** Administrador autenticado.

**Objetivo:** cambiar el estado administrativo de una cuenta conservando su información e historial.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| UsuariosPage / UsuarioTable / ConfirmDialog | Boundary; componentes funcionales | Seleccionan cuenta y confirman el cambio de estado. |
| usuario.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta updateEstadoUsuario y solicita el cambio confirmado por la página. |
| usuarioController / usuarioService | Control; clases | Atienden updateEstado y las lecturas públicas internas. |
| usuarioRepository | Repository; clase | Lee con Rol y actualiza únicamente estado. |
| Usuario | Entity | Representa la cuenta cuyo estado cambia. |
| Rol | Entity | Aporta el rol en las lecturas públicas de la cuenta antes y después del cambio. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class UsuariosPage {
        <<boundary>>
        -Object estadoTarget
        -Boolean updatingEstado
        +handleUpdateEstado()
    }
    class UsuarioTable {
        <<boundary>>
        -Array usuarios
        -Function onToggleEstado
    }
    class ConfirmDialog {
        <<boundary>>
        -Boolean open
        -Boolean busy
        -Function onConfirm
    }
    class usuarioController {
        <<control>>
        +updateEstado(req, res, next)$
    }
    class usuarioService {
        <<control>>
        +updateEstado(...)$
        +getUsuarioById(...)$
    }
    class usuarioRepository {
        <<repository>>
        +findById(...)$
        +updateEstado(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -VARCHAR_255 correo
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
        -VARCHAR_255 descripcion
        -BOOLEAN estado
    }
    Administrador --> UsuarioTable
    Administrador --> ConfirmDialog
    UsuarioTable ..> UsuariosPage : callback onToggleEstado
    ConfirmDialog ..> UsuariosPage : callback onConfirm
    UsuariosPage ..> usuarioController : PATCH /api/usuarios/#58;idUsuario/estado (resumen)
    usuarioController ..> usuarioService : updateEstado
    usuarioService ..> usuarioRepository
    usuarioRepository ..> Usuario : lectura y cambio de estado
    usuarioRepository ..> Rol : include de lecturas
    Rol "1" -- "0..*" Usuario : rol
    note for UsuariosPage "handleUpdateEstado es funcion local React; no metodo de clase"
    note for UsuarioTable "onToggleEstado es prop; seleccion por callback inline"
    note for ConfirmDialog "onConfirm es prop; sin handler local de confirmacion"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU07 | UsuariosPage | Componente funcional | `frontend/src/features/usuarios/pages/UsuariosPage.jsx` | Local `handleUpdateEstado()` | Pasa esta función como onConfirm a ConfirmDialog; llama a updateEstadoUsuario del módulo HTTP. |
| CU07 | UsuarioTable | Componente funcional | `frontend/src/features/usuarios/components/UsuarioTable.jsx` | Prop callback onToggleEstado | Recibe setEstadoTarget de la página; onClick inline ejecuta onToggleEstado(usuario). Sin función local nombrada de cambio de estado. |
| CU07 | ConfirmDialog | Componente funcional | `frontend/src/components/ConfirmDialog.jsx` | Prop callback onConfirm | Recibe handleUpdateEstado y busy=updatingEstado; onClick utiliza onConfirm. No define una función local de confirmación. |
| CU07 | usuarioController | Clase usuarioController | `backend/src/presentation/controllers/usuario.controller.js` | `updateEstado(req, res, next)` | PATCH /api/usuarios/:idUsuario/estado. |
| CU07 | usuarioService | Clase usuarioService | `backend/src/business/services/usuario.service.js` | `updateEstado(idUsuario, { estado })`; `getUsuarioById(idUsuario, transaction = undefined)` | Lee antes y después del cambio. |
| CU07 | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findById({ idUsuario, transaction = undefined })`; `updateEstado({ idUsuario, estado })` | Rol participa por include en findById. |
| CU07 | Usuario / Rol | Modelos | `backend/src/data/models/usuario.js`; `backend/src/data/models/rol.js` | — | Nueve y cuatro atributos completos. |
| CU07 | usuario.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/usuarios/services/usuario.service.js` | `updateEstadoUsuario(idUsuario, estado)` | handleUpdateEstado de UsuariosPage la llama con estadoTarget.idUsuario y nextEstado; api.patch con /usuarios/${idUsuario}/estado y { estado }. |
| CU07 | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/usuario.router.js`; `backend/src/app.js` | `PATCH /api/usuarios/:idUsuario/estado` | usuarioRouter.patch('/:idUsuario/estado', usuarioController.updateEstado), con prefijo /api/usuarios. El nombre frontend es updateEstadoUsuario; el backend usa updateEstado. |

**Descripción de relaciones:** UsuariosPage coordina selección en UsuarioTable y confirmación en ConfirmDialog. onConfirm ejecuta handleUpdateEstado de la página, que llama a updateEstadoUsuario del módulo usuario.service.js (frontend). Este solicita PATCH /api/usuarios/:idUsuario/estado, atendido por usuarioController.updateEstado. usuarioService lee y modifica mediante usuarioRepository; Rol participa en las lecturas públicas. Desactivar conserva historial e impide acceso posterior. Bloqueo temporal y estado administrativo son diferentes.

**Interacción Boundary:** setEstadoTarget es un setter de useState, no una función propia inventada del componente. El cierre de ConfirmDialog recibe `() => setEstadoTarget(null)` como onClose; se documenta como callback inline de la página. loadUsuarios y handlePasswordReset corresponden a CU04/CU08 y no se incorporan a este cambio de estado.

Esta operación no cambia contraseña/versión, no reinicia intentos y no elimina recuperaciones. No se incorpora una regla de protección del último Administrador o de prohibición de cambiar el propio estado, porque no está implementada en este flujo.

**Correspondencia con la implementación:** `frontend/src/features/usuarios/pages/UsuariosPage.jsx`, `frontend/src/features/usuarios/components/UsuarioTable.jsx` y `frontend/src/components/ConfirmDialog.jsx` representan selección y confirmación.

`usuarioValidator.validateIdUsuario(data)` y `validateUpdateEstado(data)` en `backend/src/business/validators/usuario.validator.js` comprueban ID/body. La lectura inicial del listado corresponde a CU04; getUsuarioById es aquí una llamada interna real, no otro endpoint.

Referencias: RF04/RF08; RN05/RN06.

### CU08 — Cambiar contraseña

El CU conserva dos variantes con permisos y resultados diferentes. Se muestran por separado para distinguir la contraseña actual exigida al cambiar la propia de la intervención administrativa sobre una cuenta seleccionada.

#### Variante A — Cambio propio

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** cambiar la contraseña propia, comprobar la actual y mantener la sesión del navegador con credenciales renovadas.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| ChangeOwnPasswordDialog | Boundary; componente funcional | Recoge los campos reales del estado form. |
| usuario.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta updateOwnPassword y envía las contraseñas actual/nueva. |
| usuarioController / usuarioService | Control; clases | Ejecutan updateOwnPassword; el Controller renueva cookie. |
| usuarioRepository / recuperacionPasswordRepository | Repository; clases | Consultan/actualizan la cuenta e invalidan recuperaciones. |
| Usuario | Entity | Representa la cuenta autenticada y su seguridad de acceso. |
| RecuperacionPassword | Entity | Representa las recuperaciones pendientes que dejan de ser utilizables. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class ChangeOwnPasswordDialog {
        <<boundary>>
        -String form.passwordActual
        -String form.passwordNueva
        -String form.confirmPassword
        -Boolean submitting
        -Boolean open
        -Function onClose
        +updateField(event)
        +handleSubmit(event)
    }
    class usuarioController {
        <<control>>
        +updateOwnPassword(req, res, next)$
    }
    class usuarioService {
        <<control>>
        +updateOwnPassword(...)$
    }
    class usuarioRepository {
        <<repository>>
        +findByIdWithPassword(...)$
        +updatePassword(...)$
    }
    class recuperacionPasswordRepository {
        <<repository>>
        +invalidatePendingByUsuario(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -VARCHAR_255 correo
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class RecuperacionPassword {
        <<entity>>
        -INT id_recuperacion
        -INT id_usuario
        -CHAR_64 codigo_hmac
        -CHAR_36 nonce
        -DATETIME_3 fecha_solicitud
        -DATETIME_3 expira_en
        -TINYINT_UNSIGNED intentos_fallidos
        -DATETIME_3 consumida_en
        -DATETIME_3 invalidada_en
    }
    Administrador --> ChangeOwnPasswordDialog
    Regente --> ChangeOwnPasswordDialog
    Vendedor --> ChangeOwnPasswordDialog
    ChangeOwnPasswordDialog ..> usuarioController : PATCH /api/usuarios/me/password (resumen)
    usuarioController ..> usuarioService : updateOwnPassword
    usuarioService ..> usuarioRepository
    usuarioService ..> recuperacionPasswordRepository
    usuarioRepository ..> Usuario
    recuperacionPasswordRepository ..> RecuperacionPassword
    Usuario "1" -- "0..*" RecuperacionPassword : recuperacionesPassword
    note for ChangeOwnPasswordDialog "Operaciones = funciones locales React; no metodos de clase. onClose es prop"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU08-A | ChangeOwnPasswordDialog | Componente funcional | `frontend/src/features/usuarios/components/ChangeOwnPasswordDialog.jsx` | Locales `updateField(event)` y `handleSubmit(event)` | updateField recibe onChange de PasswordInput; handleSubmit atiende onSubmit y llama a updateOwnPassword del módulo HTTP. open/onClose son props; confirmPassword es local. |
| CU08-A | usuarioController | Clase usuarioController | `backend/src/presentation/controllers/usuario.controller.js` | `updateOwnPassword(req, res, next)` | ID y versión proceden de req.usuario, no del body. |
| CU08-A | usuarioService | Clase usuarioService | `backend/src/business/services/usuario.service.js` | `updateOwnPassword(idUsuario, { passwordActual, passwordNueva }, versionCredenciales)` | Firma exacta del método abreviado en el dibujo. |
| CU08-A | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findByIdWithPassword({ idUsuario, transaction = undefined, lock = false })`; `updatePassword({ idUsuario, passwordHash, versionCredenciales, transaction })` | Primera lectura y revalidación bloqueada; después escritura. |
| CU08-A | recuperacionPasswordRepository | Clase recuperacionPasswordRepository | `backend/src/data/repositories/recuperacion-password.repository.js` | `invalidatePendingByUsuario({ idUsuario, invalidadaEn, transaction })` | Misma transacción del cambio. |
| CU08-A | Usuario / RecuperacionPassword | Modelos | `backend/src/data/models/usuario.js`; `backend/src/data/models/recuperacion-password.js` | — | Nueve atributos completos en cada entidad. |
| CU08-A | usuario.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/usuarios/services/usuario.service.js` | `updateOwnPassword(data)` | ChangeOwnPasswordDialog la importa y llama desde handleSubmit; api.patch('/usuarios/me/password', data). No utiliza login/logout del contexto. |
| CU08-A | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/usuario.router.js`; `backend/src/app.js` | `PATCH /api/usuarios/me/password` | usuarioRouter.patch('/me/password', authMiddleware, usuarioController.updateOwnPassword), antes del middleware de Administrador. |

**Descripción de relaciones:** handleSubmit de ChangeOwnPasswordDialog llama directamente a la exportación updateOwnPassword del módulo usuario.service.js (frontend), que solicita PATCH /api/usuarios/me/password. usuarioController llama a usuarioService con ID/versión autenticados. El Service utiliza los dos Repositories, revalida credenciales y actualiza hash/versión, contador/bloqueo y recuperaciones conjuntamente. No acepta usuario objetivo elegido por el cliente.

**Interacción Boundary:** MainLayout controla open y pasa `() => setPasswordDialogOpen(false)` como onClose; no hay una función local handleClose en el diálogo. Su efecto de reinicio es anónimo. Los auxiliares PasswordInput/PasswordRequirements no ejecutan la solicitud HTTP ni reciben las operaciones de negocio como métodos propios.

La cookie renovada mantiene esta sesión; las sesiones con la versión anterior dejan de ser válidas. Se utiliza el ID de rol almacenado en Usuario para renovar las credenciales, sin consultar Rol. No se modifican cuotas IP.

**Correspondencia con la implementación:** `frontend/src/features/usuarios/components/ChangeOwnPasswordDialog.jsx`, abierto desde MainLayout, representa la vista. Su confirmación local no forma parte del body de `PATCH /api/usuarios/me/password`.

**Funciones externas:** `requireCurrentCredentials(usuario, versionCredenciales, passwordHash = undefined)` está a nivel de módulo en `backend/src/business/services/usuario.service.js`, no en la clase. `siguienteVersionCredenciales(usuario)` está en `backend/src/shared/utils/credenciales.js`; `generarToken({ idUsuario, idRol, versionCredenciales })`, en `backend/src/shared/utils/jwt.js`. El Validator ejecuta `validateUpdateOwnPassword(data)` en `backend/src/business/validators/usuario.validator.js`; bcrypt.compare/hash y res.cookie son operaciones de librerías. No se dibuja getUsuarioById porque este camino no lo llama.

Referencias: RF09; RN07/RN115 y CU08.

#### Variante B — Restablecimiento administrativo

**Actor o actores:** Administrador autenticado.

**Objetivo:** establecer una nueva contraseña para una cuenta seleccionada sin conocer ni mostrar la anterior.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| ResetPasswordDialog | Boundary; componente funcional | Recibe usuario y maneja password y confirmation. |
| usuario.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta resetPasswordUsuario y envía la contraseña de la cuenta objetivo. |
| usuarioController / usuarioService | Control; clases | Ejecutan updatePassword y la lectura pública previa. |
| usuarioRepository / recuperacionPasswordRepository | Repository; clases | Consultan/actualizan cuenta e invalidan recuperaciones. |
| Usuario | Entity | Representa la cuenta objetivo y sus credenciales. |
| Rol | Entity | Aporta el rol en la lectura pública previa de la cuenta objetivo. |
| RecuperacionPassword | Entity | Representa recuperaciones pendientes que se invalidan. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class ResetPasswordDialog {
        <<boundary>>
        -Object usuario
        -String password
        -String confirmation
        -Boolean submitting
        -Function onClose
        -Function onSuccess
        +handleSubmit(event)
    }
    class usuarioController {
        <<control>>
        +updatePassword(req, res, next)$
    }
    class usuarioService {
        <<control>>
        +updatePassword(...)$
        +getUsuarioById(...)$
    }
    class usuarioRepository {
        <<repository>>
        +findById(...)$
        +findByIdForUpdate(...)$
        +updatePassword(...)$
    }
    class recuperacionPasswordRepository {
        <<repository>>
        +invalidatePendingByUsuario(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -VARCHAR_255 correo
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
        -VARCHAR_255 descripcion
        -BOOLEAN estado
    }
    class RecuperacionPassword {
        <<entity>>
        -INT id_recuperacion
        -INT id_usuario
        -CHAR_64 codigo_hmac
        -CHAR_36 nonce
        -DATETIME_3 fecha_solicitud
        -DATETIME_3 expira_en
        -TINYINT_UNSIGNED intentos_fallidos
        -DATETIME_3 consumida_en
        -DATETIME_3 invalidada_en
    }
    Administrador --> ResetPasswordDialog
    ResetPasswordDialog ..> usuarioController : PATCH /api/usuarios/#58;idUsuario/password (resumen)
    usuarioController ..> usuarioService : updatePassword
    usuarioService ..> usuarioRepository
    usuarioService ..> recuperacionPasswordRepository
    usuarioRepository ..> Usuario
    usuarioRepository ..> Rol : include previo
    recuperacionPasswordRepository ..> RecuperacionPassword
    Rol "1" -- "0..*" Usuario : rol
    Usuario "1" -- "0..*" RecuperacionPassword : recuperacionesPassword
    note for ResetPasswordDialog "handleSubmit es funcion local React; no metodo de clase. onClose y onSuccess son props"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU08-B | ResetPasswordDialog | Componente funcional | `frontend/src/features/usuarios/components/ResetPasswordDialog.jsx` | Local `handleSubmit(event)` | Atiende onSubmit; llama a resetPasswordUsuario y después a la prop onSuccess(usuario). Los onChange de password/confirmation son inline, sin updateField propio. |
| CU08-B | Callback del padre, omitido del gráfico | Componente UsuariosPage | `frontend/src/features/usuarios/pages/UsuariosPage.jsx` | Local `handlePasswordReset(usuario)` | Pasa esta función como onSuccess; limpia resetTarget y muestra el mensaje. onClose recibe `() => setResetTarget(null)`, no handleCancel. |
| CU08-B | usuarioController | Clase usuarioController | `backend/src/presentation/controllers/usuario.controller.js` | `updatePassword(req, res, next)` | PATCH /api/usuarios/:idUsuario/password. |
| CU08-B | usuarioService | Clase usuarioService | `backend/src/business/services/usuario.service.js` | `updatePassword(idUsuario, { password })`; `getUsuarioById(idUsuario, transaction = undefined)` | getUsuarioById se ejecuta internamente antes del cambio. |
| CU08-B | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findById({ idUsuario, transaction = undefined })`; `findByIdForUpdate({ idUsuario, transaction })`; `updatePassword({ idUsuario, passwordHash, versionCredenciales, transaction })` | include Rol solo en la lectura pública previa. |
| CU08-B | recuperacionPasswordRepository | Clase recuperacionPasswordRepository | `backend/src/data/repositories/recuperacion-password.repository.js` | `invalidatePendingByUsuario({ idUsuario, invalidadaEn, transaction })` | En la transacción del cambio. |
| CU08-B | Usuario / Rol / RecuperacionPassword | Modelos | `backend/src/data/models/usuario.js`; `backend/src/data/models/rol.js`; `backend/src/data/models/recuperacion-password.js` | — | Nueve, cuatro y nueve atributos completos. |
| CU08-B | usuario.service.js (frontend) | Módulo ES; función exportada | `frontend/src/features/usuarios/services/usuario.service.js` | `resetPasswordUsuario(idUsuario, password)` | ResetPasswordDialog la importa y llama desde handleSubmit; api.patch con /usuarios/${idUsuario}/password y { password }. |
| CU08-B | API, relación HTTP | Endpoint Express | `backend/src/presentation/routes/usuario.router.js`; `backend/src/app.js` | `PATCH /api/usuarios/:idUsuario/password` | usuarioRouter.patch('/:idUsuario/password', usuarioController.updatePassword), con prefijo /api/usuarios. La exportación frontend no se llama updatePassword. |

**Descripción de relaciones:** el Administrador usa ResetPasswordDialog sobre una cuenta recibida del listado. Su handleSubmit llama directamente a resetPasswordUsuario del módulo usuario.service.js (frontend), que solicita PATCH /api/usuarios/:idUsuario/password, atendido por usuarioController.updatePassword. El Service lee con Rol y cambia credenciales por los dos Repositories. Se conservan rol/estado y se limpian fallos/bloqueo. Los actores no son subclases de Usuario.

**Interacción Boundary:** handleSubmit es propia de ResetPasswordDialog; handlePasswordReset pertenece a UsuariosPage y se recibe como onSuccess. La página se documenta en la correspondencia sin otra caja para mantener el gráfico acotado. Los callbacks inline de campos/cierre y el efecto anónimo de reinicio no originan métodos adicionales.

No se exige contraseña anterior ni se emite cookie de renovación para la cuenta objetivo. Sus sesiones anteriores quedan obsoletas, incluso si el Administrador utiliza esta variante sobre su propia cuenta. La selección desde el listado corresponde a CU04; no se incorpora su GET como consulta HTTP independiente de este diagrama.

**Apoyos reales:** `usuarioValidator.validateIdUsuario(data)` y `validateUpdatePassword(data)` están en `backend/src/business/validators/usuario.validator.js`; `siguienteVersionCredenciales(usuario)` es función exportada de `backend/src/shared/utils/credenciales.js`. No se consulta la contraseña anterior ni se llama a updateOwnPassword. El campo real y la propiedad enviada son password, no passwordNueva; confirmation es solo local.

La ruta es `PATCH /api/usuarios/:idUsuario/password`. Referencias: RF04/RF09; RN07/RN115 y CU08.

### CU09 — Restablecer contraseña mediante correo electrónico

**Actor o actores:** Administrador, Regente o Vendedor que olvidó su contraseña; acceso público sin sesión previa.

**Objetivo:** establecer una nueva contraseña mediante un código enviado al correo asociado a una cuenta activa.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| RecuperacionPasswordPage | Boundary; componente funcional | Maneja correo, step y form; solicita código y restablece. |
| auth.service.js (frontend) | Módulo ES intermediario; sin caja | Exporta solicitarRecuperacion/restablecerPassword, cada una con su endpoint. |
| authController | Control HTTP; clase | Atiende los dos endpoints públicos y pasa la IP del socket. |
| recuperacionPasswordService | Control de negocio; clase | Coordina emisión/consumo y sus auxiliares reales de cuota, espera y rechazo. |
| usuarioRepository | Repository; clase | Busca/bloquea la cuenta y actualiza credenciales al consumir. |
| recuperacionPasswordRepository | Repository; clase | Persiste cuotas IP, emisiones, intentos, consumo e invalidaciones. |
| Usuario | Entity | Representa la cuenta asociada al correo y sus credenciales. |
| RecuperacionPassword | Entity | Representa la emisión protegida, su vigencia, fallos y estados de uso. |
| LimiteRecuperacionIp | Entity | Representa las cuotas persistentes por ámbito/IP protegida; solo participa en este CU de la fase. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class RecuperacionPasswordPage {
        <<boundary>>
        -String correo
        -String step
        -String form.codigo
        -String form.passwordNueva
        -String form.confirmPassword
        -Boolean submitting
        +handleRequest(event)
        +handleReset(event)
        +requestAnotherCode()
        +updatePasswordField(event)
    }
    class authController {
        <<control>>
        +solicitarRecuperacion(req, res, next)$
        +restablecerPassword(req, res, next)$
    }
    class recuperacionPasswordService {
        <<control>>
        +solicitarRecuperacion(...)$
        +restablecerPassword(data, ip)$
        +verificarLimiteIp(ambito, ip)$
        +esperarRespuesta(inicio)$
        +invalidarEnvioRechazado(...)$
    }
    class usuarioRepository {
        <<repository>>
        +findByCorreo(...)$
        +findByIdForRecovery(...)$
        +updatePassword(...)$
    }
    class recuperacionPasswordRepository {
        <<repository>>
        +getCurrentDate(...)$
        +incrementIpQuota(...)$
        +findHistoryByUsuario(...)$
        +invalidatePendingByUsuario(...)$
        +create(...)$
        +findByIdForUpdate(...)$
        +updateById(...)$
        +findLatestByUsuario(...)$
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 correo
        -BOOLEAN estado
        -VARCHAR_255 password_hash
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class RecuperacionPassword {
        <<entity>>
        -INT id_recuperacion
        -INT id_usuario
        -CHAR_64 codigo_hmac
        -CHAR_36 nonce
        -DATETIME_3 fecha_solicitud
        -DATETIME_3 expira_en
        -TINYINT_UNSIGNED intentos_fallidos
        -DATETIME_3 consumida_en
        -DATETIME_3 invalidada_en
    }
    class LimiteRecuperacionIp {
        <<entity>>
        -VARCHAR_24 ambito
        -CHAR_64 clave_ip_hmac
        -DATETIME_3 ventana_hasta
        -INT_UNSIGNED cantidad
    }
    Administrador --> RecuperacionPasswordPage
    Regente --> RecuperacionPasswordPage
    Vendedor --> RecuperacionPasswordPage
    RecuperacionPasswordPage ..> authController : POST /api/auth/recuperacion/solicitar (resumen)
    RecuperacionPasswordPage ..> authController : POST /api/auth/recuperacion/restablecer (resumen)
    authController ..> recuperacionPasswordService
    recuperacionPasswordService ..> usuarioRepository
    recuperacionPasswordService ..> recuperacionPasswordRepository
    usuarioRepository ..> Usuario
    recuperacionPasswordRepository ..> RecuperacionPassword
    recuperacionPasswordRepository ..> LimiteRecuperacionIp : incrementIpQuota
    Usuario "1" -- "0..*" RecuperacionPassword : recuperacionesPassword
    note for RecuperacionPasswordPage "Operaciones = funciones locales React; no metodos de clase ni endpoints HTTP"
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU09 | RecuperacionPasswordPage | Componente funcional | `frontend/src/features/auth/pages/RecuperacionPasswordPage.jsx` | Locales `handleRequest(event)`; `handleReset(event)`; `requestAnotherCode()`; `updatePasswordField(event)` | onSubmit selecciona handleRequest/handleReset según step; onClick usa requestAnotherCode; PasswordInput recibe updatePasswordField como onChange. Ninguna es método de clase. |
| CU09 | authController | Clase authController | `backend/src/presentation/controllers/auth.controller.js` | `solicitarRecuperacion(req, res, next)`; `restablecerPassword(req, res, next)` | Dos entradas HTTP públicas, IP de req.socket.remoteAddress. |
| CU09 | recuperacionPasswordService | Clase recuperacionPasswordService | `backend/src/business/services/recuperacion-password.service.js` | `solicitarRecuperacion(data, ip, mailOptions = {})`; `restablecerPassword(data, ip)`; `verificarLimiteIp(ambito, ip)`; `esperarRespuesta(inicio)`; `invalidarEnvioRechazado({ idUsuario, idRecuperacion, nonce })` | Solo operaciones realmente declaradas; auxiliares según camino descrito abajo. |
| CU09 | usuarioRepository | Clase usuarioRepository | `backend/src/data/repositories/usuario.repository.js` | `findByCorreo({ correo, transaction = undefined })`; `findByIdForRecovery({ idUsuario, transaction })`; `updatePassword({ idUsuario, passwordHash, versionCredenciales, transaction })` | updatePassword solo al consumir válidamente; no llama updateLoginSecurity. |
| CU09 | recuperacionPasswordRepository | Clase recuperacionPasswordRepository | `backend/src/data/repositories/recuperacion-password.repository.js` | `getCurrentDate({ transaction } = {})`; `incrementIpQuota({ ambito, claveIpHmac, ahora, ventanaHasta, transaction })`; `findHistoryByUsuario({ idUsuario, desde, transaction })`; `invalidatePendingByUsuario({ idUsuario, invalidadaEn, transaction })`; `create({ values, transaction })`; `findByIdForUpdate({ idRecuperacion, idUsuario, transaction })`; `updateById({ idRecuperacion, values, transaction })`; `findLatestByUsuario({ idUsuario, transaction })` | Parámetros abreviados únicamente en el gráfico; matriz de caminos a continuación. |
| CU09 | Usuario / RecuperacionPassword / LimiteRecuperacionIp | Modelos | `backend/src/data/models/usuario.js`; `backend/src/data/models/recuperacion-password.js`; `backend/src/data/models/limite-recuperacion-ip.js` | — | Nueve, nueve y cuatro atributos completos; IP con PK compuesta, sin FK. |
| CU09 | auth.service.js (frontend), solicitar | Módulo ES; función exportada | `frontend/src/features/auth/services/auth.service.js` | `solicitarRecuperacion({ correo })` | handleRequest de RecuperacionPasswordPage la llama directamente; api.post('/auth/recuperacion/solicitar', { correo }). |
| CU09 | auth.service.js (frontend), restablecer | Módulo ES; función exportada | `frontend/src/features/auth/services/auth.service.js` | `restablecerPassword({ correo, codigo, passwordNueva })` | handleReset de RecuperacionPasswordPage la llama directamente; api.post('/auth/recuperacion/restablecer', { correo, codigo, passwordNueva }). |
| CU09 | API, relación de solicitud | Endpoint Express | `backend/src/presentation/routes/auth.router.js`; `backend/src/app.js` | `POST /api/auth/recuperacion/solicitar` | authRouter.post('/recuperacion/solicitar', authController.solicitarRecuperacion), con prefijo /api/auth. |
| CU09 | API, relación de restablecimiento | Endpoint Express | `backend/src/presentation/routes/auth.router.js`; `backend/src/app.js` | `POST /api/auth/recuperacion/restablecer` | authRouter.post('/recuperacion/restablecer', authController.restablecerPassword), con prefijo /api/auth. |

**Descripción de relaciones:** la página importa directamente las dos funciones de auth.service.js (frontend): handleRequest llama a solicitarRecuperacion y handleReset a restablecerPassword. El módulo solicita los dos POST indicados en relaciones separadas; no interviene AuthProvider ni se realiza login. authController llama a recuperacionPasswordService y este a los Repositories. Cada RecuperacionPassword pertenece a un Usuario; una cuenta tiene cero o más emisiones históricas. LimiteRecuperacionIp se utiliza por ámbito/IP y no tiene FK ni asociación con las otras entidades. No se añade una clase ficticia de correo ni se dibujan consultas directas del Service a los modelos.

**Interacción Boundary:** handleRequest llama a solicitarRecuperacion del módulo HTTP; handleReset llama a restablecerPassword de ese módulo. requestAnotherCode solo limpia el borrador y vuelve a step=request, sin enviar otro correo automáticamente. updatePasswordField modifica passwordNueva/confirmPassword; correo y código usan onChange inline, con restricción de dígitos para el código. getRecoveryErrorMessage es una función de módulo, no local al componente. No se añaden funciones ficticias de verificación ni login tras el éxito.

El dibujo reúne dos operaciones del mismo CU. La verificación del código se realiza al solicitar el restablecimiento; no existe un tercer endpoint de verificación independiente.

| Camino | Responsabilidades y condiciones |
|---|---|
| Solicitar código | Valida correo/cuota IP, comprueba cuenta activa y cuotas de cuenta; cuando corresponde, invalida la emisión anterior y registra código protegido/vigencia. Intenta el correo una vez después de confirmar la emisión. Devuelve respuesta pública genérica también para desconocidos, inactivos y solicitudes suprimidas. |
| Resultado del envío | Un rechazo explícito invalida únicamente esa emisión; un resultado incierto conserva el código hasta vencer. No hay reenvío automático. La espera mínima pública se aplica en el bloque documentado de solicitud admitida, sin afirmar tiempo constante. |
| Restablecer | Valida correo, código y nueva contraseña, consume cuota IP y comprueba cuenta, código y vigencia. Los fallos de verificación se registran; solo una verificación válida permite cambiar credenciales y consumir la emisión. Invalida las demás recuperaciones pendientes. |

El código tiene seis dígitos, diez minutos de vigencia y máximo cinco fallos; no se persiste en claro. Las cuotas de cuenta proceden del historial y las cuotas IP de LimiteRecuperacionIp. Cambiar credenciales incrementa versión y limpia bloqueo/contador de login. No reactiva una cuenta, no cambia el rol ni inicia sesión automáticamente.

**Correspondencia con la implementación:** `/recuperar-contrasena` y `frontend/src/features/auth/pages/RecuperacionPasswordPage.jsx` representan la vista. Sus funciones HTTP están en `frontend/src/features/auth/services/auth.service.js`.

| Camino | Operaciones reales participantes |
|---|---|
| Solicitar | authController.solicitarRecuperacion → recuperacionPasswordService.solicitarRecuperacion; verificarLimiteIp usa getCurrentDate/incrementIpQuota. Busca por findByCorreo/findByIdForRecovery; findHistoryByUsuario comprueba cuota/códigos recientes; invalidatePendingByUsuario/create se ejecutan al emitir. esperarRespuesta se llama en finally del bloque de solicitud, después de admitir cuota IP y crear transporte. |
| Rechazo explícito del correo | invalidarEnvioRechazado utiliza findByIdForRecovery, findByIdForUpdate y, si coincide nonce y sigue pendiente, updateById/getCurrentDate. Resultado incierto no ejecuta esta invalidación. |
| Restablecer | authController.restablecerPassword → recuperacionPasswordService.restablecerPassword; verificarLimiteIp usa getCurrentDate/incrementIpQuota. Busca por findByCorreo/findByIdForRecovery/findLatestByUsuario; updateById registra invalidez, fallos o consumo según rama. updatePassword e invalidatePendingByUsuario solo después de revalidar el consumo. No llama esperarRespuesta ni invalidarEnvioRechazado. |

**Funciones y objetos externos, expresamente distintos de métodos del Service:**

| CU | Elemento de apoyo | Clase, componente o función real | Archivo fuente | Firma real | Observación UML |
|---|---|---|---|---|---|
| CU09 | Comprobación de cuenta/código | Funciones de módulo | `backend/src/business/services/recuperacion-password.service.js` | `findCurrentUsuario(idUsuario, correo, transaction)`; `isUsable(recovery, ahora, transaction)`; `matchesCode(usuario, recovery, codigo)`; `generateNonRepeatedCode(usuario, history, ahora)` | Declaradas fuera de recuperacionPasswordService; no se dibujan como métodos. |
| CU09 | Protección criptográfica | Funciones exportadas | `backend/src/shared/utils/recuperacion-crypto.js` | `generarCodigoRecuperacion()`; `generarNonceRecuperacion()`; `calcularCodigoHmac({ codigo, ...metadata } = {})`; `verificarCodigoHmac({ codigo, codigoHmac, ...metadata } = {})`; `calcularClaveIpHmac({ ambito, ipNormalizada } = {})`; `normalizarIpRecuperacion(ip)` | No pertenecen a la clase Service. |
| CU09 | Correo | Función exportada y método de objeto retornado | `backend/src/shared/utils/recuperacion-mail.js` | `crearTransporteRecuperacion({ resolverMock } = {})`; `enviar(payload, { signal } = {})` | enviar está en un objeto Object.freeze, no en una clase de servicio ni modelo. |
| CU09 | Configuración / versión | Funciones exportadas | `backend/src/shared/utils/recuperacion-config.js`; `backend/src/shared/utils/credenciales.js` | `exigirRecuperacionHabilitada()`; `siguienteVersionCredenciales(usuario)` | No son métodos de recuperacionPasswordService. |

`recuperacionPasswordValidator.validateSolicitud(data)` y `validateRestablecimiento(data)` se declaran en `backend/src/business/validators/recuperacion-password.validator.js` y se ejecutan tanto en Controller como en Service. Las rutas públicas se comprueban en `backend/src/presentation/routes/auth.router.js`. No hay login automático, consulta a Rol ni método verificarCodigo de esta clase.

La solicitud usa `POST /api/auth/recuperacion/solicitar`; el consumo, `POST /api/auth/recuperacion/restablecer`. La confirmación local no se envía. La activación/configuración y validación del envío a un buzón real siguen siendo pendientes operativos documentados, aunque el CU esté implementado. Referencias: RF40–RF42, RI15; RN107–RN115.

## 2. Cierre y revisión de la primera entrega

| Caso de uso | Diagramas | Aspecto principal de revisión |
|---|---|---|
| CU01 — Iniciar sesión | 1 | Cuenta activa, bloqueo temporal y establecimiento de sesión. |
| CU02 — Cerrar sesión | 1 | Eliminación de cookie con comprobación previa, sin modificación de cuenta. |
| CU03 — Crear usuario | 1 | Unicidad, rol activo y contraseña protegida. |
| CU04 — Consultar usuarios | 1 | Datos públicos y filtros locales de interfaz. |
| CU05 — Consultar usuario por ID | 1 | Lectura reutilizada al preparar edición, sin escritura. |
| CU06 — Modificar usuario | 1 | Invalidación condicional de recuperaciones por correo. |
| CU07 — Activar o desactivar usuario | 1 | Estado administrativo distinto del bloqueo temporal. |
| CU08 — Cambiar contraseña | 2 | Cambio propio con renovación frente a restablecimiento administrativo. |
| CU09 — Recuperación por correo | 1 | Emisión/consumo, cuotas persistentes y respuesta pública genérica. |
| **Total de Fase 1** | **10** | **Nueve CU, numeración única CU01–CU09.** |

**Criterio de comprobación de la corrección:** cada nombre implementado del dibujo debe encontrarse en su fuente y participar en el CU o una rama válida. Los métodos backend se declaran en su clase; las operaciones Boundary son funciones locales de componentes React, identificadas por notas, sin presentarlas como métodos de clase. Las dependencias HTTP etiquetadas `(resumen)` sintetizan la colaboración Boundary–Controller a través de funciones exportadas y, cuando corresponde, del contexto. Las tablas identifican esos intermediarios con firma, propietario, archivo y endpoint, contrastados con las solicitudes Axios y rutas Express; no se dibujan como clases ni se atribuyen sus funciones al Boundary. Se incluyen funciones locales a efectos solo donde se ejecutan, como loadUsuario en CU05.

**Entidades completas:** Usuario tiene nueve atributos, Rol cuatro, RecuperacionPassword nueve y LimiteRecuperacionIp cuatro: **26 atributos persistentes distintos**. Se conservan todos en cada aparición. Usuario.correo y bloqueado_hasta, Rol.descripcion y RecuperacionPassword.consumida_en/invalidada_en admiten NULL. Los ID numéricos son PK autoincrementales, salvo FK; LimiteRecuperacionIp tiene PK compuesta ambito/clave_ip_hmac y carece de id técnico adicional. Todos estos modelos usan timestamps:false; no hay createdAt/updatedAt implícitos. Las asociaciones pertinentes son Rol `1`–`0..*` Usuario y Usuario `1`–`0..*` RecuperacionPassword, sin composición ni herencia. Las demás asociaciones de Usuario pertenecen a otros CU y no se cargan en esta fase.

**Acceso verificado:** `backend/src/presentation/routes/auth.router.js` mantiene login/recuperación públicos y logout protegido por authMiddleware. `backend/src/presentation/routes/usuario.router.js` declara el cambio propio antes del requireRole de Administrador; las demás operaciones de usuarios requieren ese rol. `frontend/src/app/router.jsx` protege las rutas de usuarios con RoleRoute; MainLayout abre el cambio propio para los tres roles. `requireRole(...rolesPermitidos)` en `backend/src/presentation/middlewares/role.middleware.js` es una función factory, no una clase. Para evitar duplicación, la comprobación transversal de sesión se describe en 0.3; en CU02 se dibuja porque es su única lectura de entidad y se distingue de logout.

**Resultado de la revisión de Fase 1:** nueve CU y diez diagramas con Boundary revisados. Sus compartimentos muestran **15 funciones locales distintas, en 18 apariciones**, con propietario y parámetros contrastados con el código. MainLayout aparece en CU02 porque implementa handleLogout, recibido por AppHeader/AppSidebar como onLogout. UsuarioTable, ConfirmDialog y los elementos de solo lectura conservan compartimentos sin operaciones cuando no hay una función local nombrada pertinente al CU. handlePasswordReset de UsuariosPage se documenta como callback padre de CU08-B, sin otra caja. Los **47 métodos backend distintos**, en **66 apariciones**, y las **154 apariciones de atributos persistentes** se conservan respecto de la corrección anterior, junto con entidades, asociaciones y permisos. Los Validators, AppError, bcrypt, Express y utilidades permanecen separados de las operaciones propias.

**Comunicación frontend–backend compacta:** los diez diagramas utilizan **11 colaboraciones HTTP resumidas**, con verbo/endpoint. Las tablas conservan las **11 funciones exportadas** y sus archivos: auth.service.js (frontend) aporta login/logout y las dos operaciones de recuperación; usuario.service.js (frontend), las siete operaciones de usuarios. Se retiraron las diez cajas de módulos HTTP; sus funciones no se trasladaron a compartimentos Boundary. AuthProvider se identifica como intermediario de CU01/CU02 en notas y tablas; Axios se documenta en 0.3. Las funciones homónimas de contexto y backend son implementaciones distintas. La restauración de sesión getSession y los GET preparatorios de otros CU no se añaden a operaciones que no los utilizan.

**Comprobación acotada de la representación HTTP compacta:** las once funciones exportadas, sus firmas, archivos y endpoints se contrastaron con las solicitudes Axios, los routers y sus prefijos Express. Las 18 apariciones de funciones Boundary conservan sus declaraciones locales en los componentes correspondientes. **10/10 diagramas de Fase 1 con sintaxis válida en Mermaid 11.12.0**, mediante mermaid.parse. Se comprobó la ausencia de cajas/identificadores de módulos HTTP y la conservación exacta de las declaraciones de los demás participantes, incluidos sus atributos y operaciones. Las relaciones previas se conservan, sustituyendo únicamente los recorridos por módulos HTTP por dependencias resumidas Boundary–Controller con los mismos endpoints. `git diff --check` aprobado; únicamente cambia este Markdown. El bloque desde Fase 2 permanece idéntico a la versión previa. No se ejecutaron pruebas funcionales ni conexiones a MySQL; no se generaron capturas, SVG ni suites extensas. La revisión visual exhaustiva se reserva para el cierre del documento completo.

**Avance de corrección:** Fase 1 queda para revisión del usuario: **9/33 CU y 10/34 diagramas corregidos**. El documento conserva la cobertura total de 33 CU/34 diagramas. Las cinco fases siguientes mantienen sus entregas anteriores hasta que se autorice corregirlas.

## 3. Fase 2 — Proveedores y Laboratorios

### 3.1. Condiciones compartidas y relaciones de contexto

Se aplican las convenciones BCE de Fase 1: componentes React con sus funciones locales, Controller y Service reales, Repository como intermediario de persistencia y **ProveedorLaboratorio como entidad unificada**. Los cuatro diagramas usan llamadas HTTP resumidas con verbo/endpoint; sus funciones frontend y archivos se identifican en las tablas, sin cajas de módulos HTTP.

**Acceso:** CU10, CU12 y CU13 requieren Administrador; CU11 permite Administrador o Regente. Todas las solicitudes requieren sesión válida, cuenta activa y versión de credenciales vigente. La comprobación previa utiliza authMiddleware, authService.getSessionUsuario y usuarioRepository.findByIdForSession; requireRole verifica el rol. Como condición transversal, se explica aquí sin repetir Usuario ni un segundo Control en los cuatro dibujos. Esto no elimina su participación técnica en la autenticación.

**Entidad y datos:** ProveedorLaboratorio tiene cinco atributos persistentes, repetidos completos en cada diagrama: id_proveedor_laboratorio, nombre, telefono, direccion y estado. El ID es INT, PK autoincremental; telefono/direccion admiten NULL y estado tiene default true. El modelo utiliza timestamps:false, sin createdAt/updatedAt implícitos. Los tipos `VARCHAR_150` y `VARCHAR_30` abrevian `VARCHAR(150)` y `VARCHAR(30)`. Nombre y contactos se recortan; los contactos vacíos se convierten a NULL. Teléfono admite texto de hasta 30 caracteres, sin imponer un patrón numérico. Nombre admite 1–150 caracteres y dirección, hasta 255. No hay restricción de nombre único ni comprobación de duplicados en estas operaciones.

**Relaciones persistentes de contexto:**

| Asociación | Multiplicidades estructurales | Participación en esta fase |
|---|---|---|
| ProveedorLaboratorio — Medicamento | Cada medicamento tiene `1` proveedor/laboratorio; cada proveedor tiene `0..*` medicamentos. | CU10–CU13 no cargan ni modifican la colección. |
| ProveedorLaboratorio — Compra | Cada compra tiene `1` proveedor/laboratorio; cada proveedor tiene `0..*` compras. | CU10–CU13 no cargan ni modifican la colección. |

Las FK no nullable están en Medicamento y Compra. Sus restricciones RESTRICT no implican composición UML. No se dibujan como participantes porque las consultas de esta fase no las incluyen; sus asociaciones se representarán cuando esas entidades participen en sus CU. ProveedorLaboratorio no tiene una FK hacia Usuario ni registra al actor como creador o modificador.

**Estado e historial:** se admite un estado inicial opcional al crear; si la API lo omite, se aplica activo por defecto. Después, la edición normal modifica únicamente nombre/teléfono/dirección, y el cambio de estado tiene una operación específica. Los registros inactivos siguen siendo consultables y editables; se conserva su historial. Las comprobaciones para nuevas compras y asignaciones de medicamentos corresponden a esos flujos consumidores.

RN11 exige al personal comprobar licencia y resolución SEDES. Es una verificación humana: no se agregan atributos, métodos ni entidades de validación automática ante SEDES.

Las correspondencias utilizan `proveedorLaboratorioController`, `proveedorLaboratorioValidator`, `proveedorLaboratorioService` y `proveedorLaboratorioRepository`, documentados en el análisis técnico. La comunicación HTTP de las vistas se realiza mediante `frontend/src/features/proveedores/services/proveedor-laboratorio.service.js` y la configuración API compartida. Referencias comunes: RF03/RF04/RF10; RN09–RN12.

**Intermediarios y apoyos reales:** el módulo HTTP exporta cinco funciones y utiliza basePath='/proveedores-laboratorios', api de `frontend/src/api/api.js` y response.data.data. El router de `backend/src/presentation/routes/proveedor-laboratorio.router.js` se monta en `/api/proveedores-laboratorios` desde `backend/src/app.js`. Ninguna de estas solicitudes utiliza login/logout de AuthProvider; useAuth aporta el usuario para las restricciones visuales. `toPublicProveedorLaboratorio(proveedorLaboratorio)` es una función de módulo en `backend/src/business/services/proveedor-laboratorio.service.js`, no un método de proveedorLaboratorioService. `getValidatedData(result)` y `getIdProveedorLaboratorio(params)` son funciones de módulo del Controller. El Validator de `backend/src/business/validators/proveedor-laboratorio.validator.js` declara validateCreate(data), validateId(data), validateUpdate(data) y validateUpdateEstado(data); se documenta su uso por CU sin otra caja. Los esquemas Zod y `textoOpcional(maximo, campo)` son externos a esa clase. No se atribuyen al modelo las operaciones heredadas de Sequelize ni a los Services las funciones auxiliares.

### CU10 — Registrar proveedor o laboratorio

**Actor o actores:** Administrador autenticado.

**Objetivo:** registrar una entidad que suministra medicamentos, con nombre, contactos opcionales y estado inicial.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| ProveedorLaboratorioForm / ProveedorLaboratorioFormPage | Boundary; componentes funcionales | Recogen los datos y coordinan el alta en modo create mediante onSubmit. |
| proveedorLaboratorioController | Control HTTP; clase | Valida la entrada y atiende createProveedorLaboratorio. |
| proveedorLaboratorioService | Control de negocio; clase | Coordina la creación y convierte el registro creado a datos públicos. |
| proveedorLaboratorioRepository | Repository; clase | Inserta nombre y los campos opcionales presentes. |
| ProveedorLaboratorio | Entity | Representa al proveedor o laboratorio registrado. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class ProveedorLaboratorioForm {
        <<boundary>>
        -String form.nombre
        -String form.telefono
        -String form.direccion
        -Boolean form.estado
        -Function onSubmit
        -Function onCancel
        +updateField(event)
        +handleSubmit(event)
    }
    class ProveedorLaboratorioFormPage {
        <<boundary>>
        -String mode
        -Boolean submitting
        -String errorMessage
        +handleSubmit(data)
    }
    class proveedorLaboratorioController {
        <<control>>
        +createProveedorLaboratorio(req, res, next)$
    }
    class proveedorLaboratorioService {
        <<control>>
        +createProveedorLaboratorio(data)$
    }
    class proveedorLaboratorioRepository {
        <<repository>>
        +create(...)$
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -VARCHAR_30 telefono
        -VARCHAR_255 direccion
        -BOOLEAN estado
    }
    Administrador --> ProveedorLaboratorioForm
    ProveedorLaboratorioForm ..> ProveedorLaboratorioFormPage : callback onSubmit
    ProveedorLaboratorioFormPage ..> proveedorLaboratorioController : POST /api/proveedores-laboratorios (resumen)
    proveedorLaboratorioController ..> proveedorLaboratorioService : createProveedorLaboratorio
    proveedorLaboratorioService ..> proveedorLaboratorioRepository : create
    proveedorLaboratorioRepository ..> ProveedorLaboratorio : insercion Sequelize
    note for ProveedorLaboratorioForm "Operaciones = funciones locales React; no metodos de clase.\nonSubmit y onCancel son props."
    note for ProveedorLaboratorioFormPage "handleSubmit(data) es funcion local React;\nfuncion HTTP importada y archivo en tabla."
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU10 | ProveedorLaboratorioForm | Componente funcional | `frontend/src/features/proveedores/components/ProveedorLaboratorioForm.jsx` | Locales `updateField(event)`; `handleSubmit(event)` | updateField atiende onChange, convirtiendo estado a booleano; handleSubmit recorta/valida y llama a la prop onSubmit. Envía contactos vacíos como null. |
| CU10 | ProveedorLaboratorioFormPage | Componente funcional | `frontend/src/features/proveedores/pages/ProveedorLaboratorioFormPage.jsx` | Local `handleSubmit(data)` | mode=create; pasa esta función como onSubmit y llama a createProveedorLaboratorio(data). onCancel recibe `() => navigate('/proveedores')`; no existe handleCancel. |
| CU10 | proveedorLaboratorioController | Clase proveedorLaboratorioController | `backend/src/presentation/controllers/proveedor-laboratorio.controller.js` | `createProveedorLaboratorio(req, res, next)` | Utiliza proveedorLaboratorioValidator.validateCreate(data) mediante getValidatedData; responde 201 con mensaje y datos. |
| CU10 | proveedorLaboratorioService | Clase proveedorLaboratorioService | `backend/src/business/services/proveedor-laboratorio.service.js` | `createProveedorLaboratorio(data)` | Llama a Repository.create; usa toPublicProveedorLaboratorio, función externa al Service. |
| CU10 | proveedorLaboratorioRepository | Clase proveedorLaboratorioRepository | `backend/src/data/repositories/proveedor-laboratorio.repository.js` | `create({ nombre, telefono, direccion, estado })` | Solo incluye contactos/estado si no son undefined; no consulta por ID ni comprueba nombre duplicado. |
| CU10 | ProveedorLaboratorio | Modelo ProveedorLaboratorio | `backend/src/data/models/proveedor-laboratorio.js` | — | Cinco atributos persistentes completos; create es heredado de Sequelize. |
| CU10 | Función HTTP intermediaria | Módulo ES; función exportada | `frontend/src/features/proveedores/services/proveedor-laboratorio.service.js` | `createProveedorLaboratorio(data)` | Importada por la página; api.post(basePath, data). No es una función local del formulario ni un método de la página. |
| CU10 | API, relación HTTP resumida | Endpoint Express | `backend/src/presentation/routes/proveedor-laboratorio.router.js`; `backend/src/app.js` | `POST /api/proveedores-laboratorios` | POST '/' con prefijo /api/proveedores-laboratorios; authMiddleware y requireRole de Administrador. |

**Descripción de relaciones:** el Administrador utiliza ProveedorLaboratorioForm. La página recibe sus datos por onSubmit y llama a createProveedorLaboratorio del módulo HTTP; la dependencia hacia el Controller resume esa petición y no representa una llamada directa. El Controller llama al Service; este inserta por Repository y convierte la instancia devuelta. El ID no se introduce ni se calcula manualmente. El formulario ofrece estado inicial, activo por defecto; la API admite omitirlo. El estado pertenece a la entidad, no a un tipo diferente de proveedor.

El Service prepara la respuesta a partir del registro recién creado, sin una segunda consulta por ID. Este CU no registra compras ni medicamentos y no exige unicidad del nombre. Tras éxito se vuelve al listado, cuya carga corresponde a CU11; ante error se conserva el borrador.

**Correspondencia con la implementación:** `/proveedores/nuevo`, `frontend/src/features/proveedores/pages/ProveedorLaboratorioFormPage.jsx` en modo create y `frontend/src/features/proveedores/components/ProveedorLaboratorioForm.jsx` representan la vista.

**Interacción Boundary:** el submit del elemento form ejecuta handleSubmit(event); la prop onSubmit es la función handleSubmit(data) de la página. loadProveedor, local al efecto de la página, solo se ejecuta en edición: no se incorpora a CU10. Los callbacks anónimos del efecto y los setters de useState no se convierten en operaciones propias adicionales. validateCreate es estricto: rechaza ID y campos extra; estado, telefono y direccion son opcionales para la API.

La función HTTP `createProveedorLaboratorio` invoca `POST /api/proveedores-laboratorios`; devuelve 201 con mensaje y datos. Entrada inválida, sesión/permisos o fallo inesperado se comunican como error. Referencias: RF10; RN09–RN11 y CU10.

### CU11 — Consultar proveedores o laboratorios

**Actor o actores:** Administrador o Regente autenticado.

**Objetivo:** consultar el listado de proveedores/laboratorios y los datos de un registro seleccionado.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| ProveedoresPage / ProveedorLaboratorioTable | Boundary; componentes funcionales | Cargan y presentan el listado con filtros locales y enlaces reales. |
| ProveedorLaboratorioDetailPage | Boundary; componente funcional | Carga la entidad por ID y presenta sus datos públicos. |
| proveedorLaboratorioController / proveedorLaboratorioService | Control; clases | Atienden listado y consulta por ID, con validación de ID/existencia cuando corresponde. |
| proveedorLaboratorioRepository | Repository; clase | Lee todos los registros o el seleccionado por PK. |
| ProveedorLaboratorio | Entity | Representa los registros activos e inactivos consultados. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class ProveedoresPage {
        <<boundary>>
        -String search
        -String statusFilter
        -Array proveedores
        -Boolean loading
        +loadProveedores()
    }
    class ProveedorLaboratorioTable {
        <<boundary>>
        -Array proveedores
        -Boolean canManage
    }
    class ProveedorLaboratorioDetailPage {
        <<boundary>>
        -String idProveedorLaboratorio
        -Object proveedor
        -Boolean loading
        -String errorMessage
        +loadProveedor()
    }
    class proveedorLaboratorioController {
        <<control>>
        +getProveedoresLaboratorios(req, res, next)$
        +getProveedorLaboratorioById(req, res, next)$
    }
    class proveedorLaboratorioService {
        <<control>>
        +getProveedoresLaboratorios()$
        +getProveedorLaboratorioById(idProveedorLaboratorio)$
    }
    class proveedorLaboratorioRepository {
        <<repository>>
        +findAll()$
        +findById(...)$
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -VARCHAR_30 telefono
        -VARCHAR_255 direccion
        -BOOLEAN estado
    }
    Administrador --> ProveedoresPage
    Regente --> ProveedoresPage
    Administrador --> ProveedorLaboratorioDetailPage
    Regente --> ProveedorLaboratorioDetailPage
    ProveedoresPage ..> ProveedorLaboratorioTable : renderiza listado filtrado
    ProveedorLaboratorioTable ..> ProveedorLaboratorioDetailPage : enlace via React Router
    ProveedoresPage ..> proveedorLaboratorioController : GET /api/proveedores-laboratorios (resumen)
    ProveedorLaboratorioDetailPage ..> proveedorLaboratorioController : GET /api/proveedores-laboratorios/#58;idProveedorLaboratorio (resumen)
    proveedorLaboratorioController ..> proveedorLaboratorioService : consulta de listado o por ID
    proveedorLaboratorioService ..> proveedorLaboratorioRepository : findAll o findById
    proveedorLaboratorioRepository ..> ProveedorLaboratorio : lectura Sequelize
    note for ProveedoresPage "loadProveedores es funcion local React; no metodo de clase."
    note for ProveedorLaboratorioTable "Sin funcion local de consulta;\nel enlace navega a la ruta de detalle."
    note for ProveedorLaboratorioDetailPage "loadProveedor es local al efecto React;\nno metodo de clase."
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU11 | ProveedoresPage | Componente funcional | `frontend/src/features/proveedores/pages/ProveedoresPage.jsx` | Local `loadProveedores()` | Invocada desde useEffect y Reintentar; llama a getProveedoresLaboratorios. loadRequest, referencia de useRef, descarta respuestas obsoletas. |
| CU11 | ProveedorLaboratorioTable | Componente funcional | `frontend/src/features/proveedores/components/ProveedorLaboratorioTable.jsx` | — | Recibe proveedores/canManage; el Link de detalle navega por React Router, no llama a una función del componente de detalle. No hay handler local de consulta. |
| CU11 | ProveedorLaboratorioDetailPage | Componente funcional | `frontend/src/features/proveedores/pages/ProveedorLaboratorioDetailPage.jsx` | Local al efecto `loadProveedor()` | idProveedorLaboratorio viene como cadena de useParams; valida y convierte a numericId antes de getProveedorLaboratorio(numericId). |
| CU11 | Carga de edición, documentada sin otra caja | Componente ProveedorLaboratorioFormPage | `frontend/src/features/proveedores/pages/ProveedorLaboratorioFormPage.jsx` | Local al efecto `loadProveedor()` | Camino preparatorio de CU12, solo para Administrador. Modo edit; usa el mismo GET por ID y pasa proveedor como initialData a ProveedorLaboratorioForm. Es distinta de la función homónima del detalle. |
| CU11 | proveedorLaboratorioController | Clase proveedorLaboratorioController | `backend/src/presentation/controllers/proveedor-laboratorio.controller.js` | `getProveedoresLaboratorios(req, res, next)`; `getProveedorLaboratorioById(req, res, next)` | validateId(data), mediante getIdProveedorLaboratorio, solo en la consulta por ID. |
| CU11 | proveedorLaboratorioService | Clase proveedorLaboratorioService | `backend/src/business/services/proveedor-laboratorio.service.js` | `getProveedoresLaboratorios()`; `getProveedorLaboratorioById(idProveedorLaboratorio)` | Convierte mediante toPublicProveedorLaboratorio; por ID rechaza inexistencia con 404. |
| CU11 | proveedorLaboratorioRepository | Clase proveedorLaboratorioRepository | `backend/src/data/repositories/proveedor-laboratorio.repository.js` | `findAll()`; `findById({ idProveedorLaboratorio })` | Orden ascendente por ID; sin include de compras/medicamentos ni escrituras. |
| CU11 | ProveedorLaboratorio | Modelo ProveedorLaboratorio | `backend/src/data/models/proveedor-laboratorio.js` | — | Cinco atributos completos; findAll/findByPk son heredados de Sequelize. |
| CU11 | Función HTTP de listado | Módulo ES; función exportada | `frontend/src/features/proveedores/services/proveedor-laboratorio.service.js` | `getProveedoresLaboratorios()` | Importada por ProveedoresPage; api.get(basePath). |
| CU11 | Función HTTP por ID | Módulo ES; función exportada | `frontend/src/features/proveedores/services/proveedor-laboratorio.service.js` | `getProveedorLaboratorio(idProveedorLaboratorio)` | Importada por las páginas de detalle/edición; api.get con basePath e ID. No es getProveedorLaboratorioById del Service backend. |
| CU11 | API, listado resumido | Endpoint Express | `backend/src/presentation/routes/proveedor-laboratorio.router.js`; `backend/src/app.js` | `GET /api/proveedores-laboratorios` | GET '/' → proveedorLaboratorioController.getProveedoresLaboratorios; Administrador/Regente. |
| CU11 | API, consulta por ID resumida | Endpoint Express | `backend/src/presentation/routes/proveedor-laboratorio.router.js`; `backend/src/app.js` | `GET /api/proveedores-laboratorios/:idProveedorLaboratorio` | GET '/:idProveedorLaboratorio' → proveedorLaboratorioController.getProveedorLaboratorioById; Administrador/Regente. |

**Descripción de relaciones:** ambos actores acceden al listado y al detalle, representados por sus componentes reales. ProveedoresPage renderiza la tabla; su Link conduce al detalle mediante React Router. Cada página llama a su función HTTP importada y las dependencias hacia el Controller resumen las solicitudes, sin llamadas directas. El Controller llama al Service, que lee por Repository. La entidad aporta nombre, contactos y estado; las colecciones de compras/medicamentos no se cargan.

| Camino | Responsabilidades y condiciones |
|---|---|
| Listado | getProveedoresLaboratorios llama a findAll y convierte cada resultado mediante toPublicProveedorLaboratorio. No valida un ID. Activos/inactivos y un resultado vacío son válidos. |
| Detalle | getIdProveedorLaboratorio usa validateId antes de getProveedorLaboratorioById; este llama a findById y verifica existencia. ID inválido produce 400 y registro inexistente, 404. |
| Filtros de interfaz | filteredProveedores es un valor calculado por un callback anónimo de useMemo: busca por nombre/teléfono/dirección y filtra por estado. Los onChange de search/statusFilter son inline; no existe aplicarFiltrosLocales como función implementada. No genera una consulta de filtros al backend ni una escritura. |

El Regente consulta; las acciones administrativas del listado/detalle se reservan al Administrador. Se muestran carga, vacío y error cuando corresponde. La lectura por ID también prepara la edición de CU12, sin efectuar su escritura.

**Correspondencia con la implementación:** `/proveedores`, `frontend/src/features/proveedores/pages/ProveedoresPage.jsx` y `frontend/src/features/proveedores/components/ProveedorLaboratorioTable.jsx` representan el listado; `/proveedores/:idProveedorLaboratorio` y `frontend/src/features/proveedores/pages/ProveedorLaboratorioDetailPage.jsx`, el detalle.

**Interacción Boundary:** loadProveedores pertenece a ProveedoresPage y loadProveedor es local al efecto del detalle. La función homónima del efecto de ProveedorLaboratorioFormPage participa en la carga preparatoria, no en CU10 ni en la escritura de CU12. ProveedorLaboratorioForm carga initialData con un efecto anónimo. onToggleEstado de la tabla y handleUpdateEstado de la página corresponden a CU13, sin añadirse como operaciones del listado. El Regente no accede a la ruta de edición aunque tenga permiso para consultar el GET por ID.

Las funciones HTTP `getProveedoresLaboratorios` y `getProveedorLaboratorio` invocan `GET /api/proveedores-laboratorios` y `GET /api/proveedores-laboratorios/:idProveedorLaboratorio`. Ambas devuelven 200 con datos; sesión/permisos y errores inesperados se manejan por separado. Referencias: RF10; RN09/RN10 y CU11.

### CU12 — Modificar proveedor o laboratorio

**Actor o actores:** Administrador autenticado.

**Objetivo:** actualizar nombre y/o contactos de un proveedor/laboratorio existente, conservando su identidad y estado.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| ProveedorLaboratorioForm / ProveedorLaboratorioFormPage | Boundary; componentes funcionales | Coordinan la edición de nombre y contactos en modo edit. |
| proveedorLaboratorioController / proveedorLaboratorioService | Control; clases | Atienden updateProveedorLaboratorio y las lecturas internas de existencia/resultado. |
| proveedorLaboratorioRepository | Repository; clase | Lee por PK y actualiza los campos permitidos. |
| ProveedorLaboratorio | Entity | Representa el registro cuyos datos se actualizan. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class ProveedorLaboratorioForm {
        <<boundary>>
        -String form.nombre
        -String form.telefono
        -String form.direccion
        -Function onSubmit
        -Function onCancel
        +updateField(event)
        +handleSubmit(event)
    }
    class ProveedorLaboratorioFormPage {
        <<boundary>>
        -String idProveedorLaboratorio
        -Boolean submitting
        -String errorMessage
        +handleSubmit(data)
    }
    class proveedorLaboratorioController {
        <<control>>
        +updateProveedorLaboratorio(req, res, next)$
    }
    class proveedorLaboratorioService {
        <<control>>
        +updateProveedorLaboratorio(idProveedorLaboratorio, data)$
        +getProveedorLaboratorioById(idProveedorLaboratorio)$
    }
    class proveedorLaboratorioRepository {
        <<repository>>
        +findById(...)$
        +update(...)$
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -VARCHAR_30 telefono
        -VARCHAR_255 direccion
        -BOOLEAN estado
    }
    Administrador --> ProveedorLaboratorioForm
    ProveedorLaboratorioForm ..> ProveedorLaboratorioFormPage : callback onSubmit
    ProveedorLaboratorioFormPage ..> proveedorLaboratorioController : PATCH /api/proveedores-laboratorios/#58;idProveedorLaboratorio (resumen)
    proveedorLaboratorioController ..> proveedorLaboratorioService : updateProveedorLaboratorio
    proveedorLaboratorioService ..> proveedorLaboratorioRepository : findById y update
    proveedorLaboratorioRepository ..> ProveedorLaboratorio : lecturas y actualizacion Sequelize
    note for ProveedorLaboratorioForm "Operaciones = funciones locales React; no metodos de clase.\nonSubmit y onCancel son props."
    note for ProveedorLaboratorioFormPage "handleSubmit(data) es funcion local React;\nla carga por ID corresponde a CU11."
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU12 | ProveedorLaboratorioForm | Componente funcional | `frontend/src/features/proveedores/components/ProveedorLaboratorioForm.jsx` | Locales `updateField(event)`; `handleSubmit(event)` | mode=edit; onChange usa updateField, el submit usa handleSubmit y este invoca la prop onSubmit sin incluir estado. |
| CU12 | ProveedorLaboratorioFormPage | Componente funcional | `frontend/src/features/proveedores/pages/ProveedorLaboratorioFormPage.jsx` | Local `handleSubmit(data)` | Pasa esta función como onSubmit; llama a updateProveedorLaboratorio(Number(idProveedorLaboratorio), data). onCancel recibe navegación inline. |
| CU12 | proveedorLaboratorioController | Clase proveedorLaboratorioController | `backend/src/presentation/controllers/proveedor-laboratorio.controller.js` | `updateProveedorLaboratorio(req, res, next)` | validateId(data) mediante getIdProveedorLaboratorio y validateUpdate(data) mediante getValidatedData; responde con mensaje y datos. |
| CU12 | proveedorLaboratorioService | Clase proveedorLaboratorioService | `backend/src/business/services/proveedor-laboratorio.service.js` | `updateProveedorLaboratorio(idProveedorLaboratorio, data)`; `getProveedorLaboratorioById(idProveedorLaboratorio)` | El segundo método se ejecuta dentro del primero antes/después de escribir; no es un GET HTTP adicional. |
| CU12 | proveedorLaboratorioRepository | Clase proveedorLaboratorioRepository | `backend/src/data/repositories/proveedor-laboratorio.repository.js` | `findById({ idProveedorLaboratorio })`; `update({ idProveedorLaboratorio, data })` | UPDATE por PK entre dos lecturas; no abre transacción conjunta ni bloquea explícitamente la fila. |
| CU12 | ProveedorLaboratorio | Modelo ProveedorLaboratorio | `backend/src/data/models/proveedor-laboratorio.js` | — | Cinco atributos completos; conserva ID y estado. |
| CU12 | Función HTTP intermediaria | Módulo ES; función exportada | `frontend/src/features/proveedores/services/proveedor-laboratorio.service.js` | `updateProveedorLaboratorio(idProveedorLaboratorio, data)` | Importada por la página; api.patch con basePath/ID y data. No es método local de la página. |
| CU12 | API, relación HTTP resumida | Endpoint Express | `backend/src/presentation/routes/proveedor-laboratorio.router.js`; `backend/src/app.js` | `PATCH /api/proveedores-laboratorios/:idProveedorLaboratorio` | PATCH '/:idProveedorLaboratorio' → proveedorLaboratorioController.updateProveedorLaboratorio; Administrador. |

**Descripción de relaciones:** ProveedorLaboratorioForm invoca onSubmit, implementado como handleSubmit(data) en la página. Esta llama a updateProveedorLaboratorio del módulo HTTP, sintetizado por la dependencia hacia el Controller. El Controller llama al Service, que consulta por Repository antes de escribir para comprobar existencia y después para devolver el resultado público. Estado se muestra en la entidad como dato conservado: no forma parte de los campos editables de esta vista.

La API admite uno o varios de nombre/teléfono/dirección; un campo omitido se conserva y un contacto nulo o vacío se limpia. El formulario actual envía los tres campos de datos. También se puede editar una entidad inactiva. El ID y las relaciones históricas permanecen; no se exige unicidad del nombre. Las lecturas y actualización son sentencias independientes, sin transacción conjunta explícita del Service.

**Correspondencia con la implementación:** `/proveedores/:idProveedorLaboratorio/editar`, `frontend/src/features/proveedores/pages/ProveedorLaboratorioFormPage.jsx` en modo edit y `frontend/src/features/proveedores/components/ProveedorLaboratorioForm.jsx` representan la vista. La carga inicial utiliza CU11; no se atribuye a esta operación de escritura.

**Interacción Boundary y validación:** la rama edit de handleSubmit(event) envía nombre/teléfono/dirección y omite estado; aunque form.estado se conserva en el estado interno, no hay selector en edición. El callback onCancel no origina un handleCancel ficticio. loadProveedor y el efecto de initialData pertenecen a la lectura preparatoria de CU11. El PATCH backend es estricto, no vacío y excluye ID/estado del body. toPublicProveedorLaboratorio convierte las lecturas sin ser un método del Service.

La función HTTP `updateProveedorLaboratorio` invoca `PATCH /api/proveedores-laboratorios/:idProveedorLaboratorio`; devuelve 200 con mensaje y datos. Tras éxito se vuelve al listado; ante error se conserva el borrador. Se manejan entrada inválida, sesión/permisos, inexistencia y fallo inesperado. Referencias: RF10; RN09/RN10 y CU12.

### CU13 — Activar o desactivar proveedor o laboratorio

**Actor o actores:** Administrador autenticado.

**Objetivo:** cambiar el estado administrativo de la entidad conservando su registro, relaciones e historial.

**Elementos participantes:**

| Elemento | Estereotipo / tipo | Responsabilidad |
|---|---|---|
| ProveedoresPage / ProveedorLaboratorioTable / ConfirmDialog | Boundary; componentes funcionales | Coordinan selección del proveedor o laboratorio, confirmación y cambio de estado. |
| proveedorLaboratorioController / proveedorLaboratorioService | Control; clases | Atienden updateEstado y las lecturas públicas internas. |
| proveedorLaboratorioRepository | Repository; clase | Consulta por PK y modifica únicamente estado. |
| ProveedorLaboratorio | Entity | Representa la entidad que se activa o desactiva. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class ProveedoresPage {
        <<boundary>>
        -Object estadoTarget
        -Boolean updatingEstado
        +handleUpdateEstado()
    }
    class ProveedorLaboratorioTable {
        <<boundary>>
        -Array proveedores
        -Boolean canManage
        -Function onToggleEstado
    }
    class ConfirmDialog {
        <<boundary>>
        -Boolean open
        -Boolean busy
        -Function onConfirm
    }
    class proveedorLaboratorioController {
        <<control>>
        +updateEstado(req, res, next)$
    }
    class proveedorLaboratorioService {
        <<control>>
        +updateEstado(...)$
        +getProveedorLaboratorioById(idProveedorLaboratorio)$
    }
    class proveedorLaboratorioRepository {
        <<repository>>
        +findById(...)$
        +updateEstado(...)$
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -VARCHAR_30 telefono
        -VARCHAR_255 direccion
        -BOOLEAN estado
    }
    Administrador --> ProveedorLaboratorioTable
    Administrador --> ConfirmDialog
    ProveedorLaboratorioTable ..> ProveedoresPage : callback onToggleEstado
    ConfirmDialog ..> ProveedoresPage : callback onConfirm
    ProveedoresPage ..> proveedorLaboratorioController : PATCH /api/proveedores-laboratorios/#58;idProveedorLaboratorio/estado (resumen)
    proveedorLaboratorioController ..> proveedorLaboratorioService : updateEstado
    proveedorLaboratorioService ..> proveedorLaboratorioRepository : findById y updateEstado
    proveedorLaboratorioRepository ..> ProveedorLaboratorio : lecturas y cambio de estado Sequelize
    note for ProveedoresPage "handleUpdateEstado es funcion local React; no metodo de clase."
    note for ProveedorLaboratorioTable "onToggleEstado es prop;\nseleccion por onClick inline."
    note for ConfirmDialog "onConfirm es prop;\nsin funcion local de confirmacion."
```

**Correspondencia verificable y firmas exactas:**

| CU | Elemento / intermediario | Clase, componente o función real | Archivo fuente | Método o función real | Simplificación UML / condición |
|---|---|---|---|---|---|
| CU13 | ProveedoresPage | Componente funcional | `frontend/src/features/proveedores/pages/ProveedoresPage.jsx` | Local `handleUpdateEstado()` | Pasa esta función como onConfirm; llama a updateEstadoProveedorLaboratorio con estadoTarget.idProveedorLaboratorio y !estadoTarget.estado. |
| CU13 | ProveedorLaboratorioTable | Componente funcional | `frontend/src/features/proveedores/components/ProveedorLaboratorioTable.jsx` | Prop callback onToggleEstado | Recibe setEstadoTarget de la página; onClick inline ejecuta onToggleEstado(proveedor). canManage limita las acciones al Administrador. No define un handler local de cambio. |
| CU13 | ConfirmDialog | Componente funcional | `frontend/src/components/ConfirmDialog.jsx` | Props onConfirm/onClose | onConfirm recibe handleUpdateEstado; busy recibe updatingEstado. onClose recibe `() => setEstadoTarget(null)`. No tiene función local de confirmación. |
| CU13 | proveedorLaboratorioController | Clase proveedorLaboratorioController | `backend/src/presentation/controllers/proveedor-laboratorio.controller.js` | `updateEstado(req, res, next)` | Usa validateId(data) y validateUpdateEstado(data); recibe estado booleano objetivo y responde con mensaje/datos. |
| CU13 | proveedorLaboratorioService | Clase proveedorLaboratorioService | `backend/src/business/services/proveedor-laboratorio.service.js` | `updateEstado(idProveedorLaboratorio, { estado })`; `getProveedorLaboratorioById(idProveedorLaboratorio)` | Consulta internamente antes/después de escribir, sin petición GET adicional; no exige estado diferente del existente. |
| CU13 | proveedorLaboratorioRepository | Clase proveedorLaboratorioRepository | `backend/src/data/repositories/proveedor-laboratorio.repository.js` | `findById({ idProveedorLaboratorio })`; `updateEstado({ idProveedorLaboratorio, estado })` | Solo modifica estado; sin transacción conjunta explícita de la secuencia. |
| CU13 | ProveedorLaboratorio | Modelo ProveedorLaboratorio | `backend/src/data/models/proveedor-laboratorio.js` | — | Cinco atributos completos; no elimina registro ni relaciones. |
| CU13 | Función HTTP intermediaria | Módulo ES; función exportada | `frontend/src/features/proveedores/services/proveedor-laboratorio.service.js` | `updateEstadoProveedorLaboratorio(idProveedorLaboratorio, estado)` | Importada por ProveedoresPage; api.patch con basePath/ID/estado y { estado }. El nombre difiere de updateEstado del backend. |
| CU13 | API, relación HTTP resumida | Endpoint Express | `backend/src/presentation/routes/proveedor-laboratorio.router.js`; `backend/src/app.js` | `PATCH /api/proveedores-laboratorios/:idProveedorLaboratorio/estado` | PATCH '/:idProveedorLaboratorio/estado' → proveedorLaboratorioController.updateEstado; Administrador. |

**Descripción de relaciones:** la tabla selecciona el registro mediante la prop onToggleEstado; ConfirmDialog invoca onConfirm, función handleUpdateEstado de ProveedoresPage. La página solicita el PATCH mediante la función HTTP importada; su dependencia al Controller resume esa colaboración. El Controller llama al Service, que accede por Repository antes/después de modificar exclusivamente estado. Nombre identifica el registro seleccionado; teléfono/dirección permanecen y se muestran completos en la entidad.

La interfaz propone el estado inverso al actual, pero la API recibe un booleano objetivo; el Service no exige que difiera del existente. No se elimina el registro ni se modifican en cascada medicamentos, compras o inventario. Inactivar impide su uso en nuevas compras/asignaciones según los flujos consumidores; no impide vender medicamentos que ya están en inventario. Activar no cambia el estado propio de los medicamentos relacionados.

**Correspondencia con la implementación:** `/proveedores`, `frontend/src/features/proveedores/pages/ProveedoresPage.jsx`, `frontend/src/features/proveedores/components/ProveedorLaboratorioTable.jsx` y `frontend/src/components/ConfirmDialog.jsx` representan selección y confirmación.

**Interacción Boundary y validación:** setEstadoTarget es un setter de useState, no una función propia inventada. El callback de cierre es inline y no se dibuja como handleClose. La carga inicial loadProveedores corresponde a CU11; CU13 sustituye la fila local con el resultado del PATCH. El Controller exige ID positivo y body estricto con estado booleano; el Service usa toPublicProveedorLaboratorio como función externa al convertir las lecturas.

La función HTTP `updateEstadoProveedorLaboratorio` invoca `PATCH /api/proveedores-laboratorios/:idProveedorLaboratorio/estado`; devuelve 200 con mensaje y datos. La vista impide envíos duplicados y actualiza la fila con el DTO devuelto, sin un GET adicional inmediato. Ante error muestra el mensaje y cierra la confirmación sin aplicar un cambio local exitoso. Referencias: RF10; RN09/RN10/RN102 y CU13.

## 4. Cierre y revisión de la segunda entrega

| Caso de uso | Diagramas | Aspecto principal de revisión |
|---|---|---|
| CU10 — Registrar proveedor o laboratorio | 1 | Contactos opcionales, estado inicial y ausencia de unicidad de nombre. |
| CU11 — Consultar proveedores o laboratorios | 1 | Listado/detalle, filtros locales y consulta por Administrador o Regente. |
| CU12 — Modificar proveedor o laboratorio | 1 | Solo datos permitidos; lectura de existencia y resultado; estado conservado. |
| CU13 — Activar o desactivar proveedor o laboratorio | 1 | Confirmación, estado objetivo y conservación de relaciones/historial. |
| **Total de Fase 2** | **4** | **Cuatro CU, numeración única CU10–CU13.** |

**Criterio de comprobación:** las operaciones de los Boundary pertenecen a sus componentes React; las de Controller, Service y Repository son métodos propios de sus clases, con firmas exactas en las tablas. Las colaboraciones HTTP se identifican como resumidas y conservan función exportada/archivo/endpoint. CU11 reúne listado/detalle y documenta la carga preparatoria de edición; CU12/CU13 distinguen esa petición de sus lecturas internas. ProveedorLaboratorio permanece como única entidad del objetivo, con todos sus atributos. Las asociaciones persistentes de contexto conservan `1`–`0..*` y no se convierten en composición, cascadas ni métodos del modelo.

**Resultado de la corrección de Fase 2:** cuatro CU y cuatro diagramas con nombres implementados. Se representan seis componentes funcionales, tres clases backend y el modelo ProveedorLaboratorio. Los gráficos contienen **6 funciones locales distintas en 9 apariciones**, **15 métodos backend distintos en 19 apariciones** y **20 apariciones de atributos persistentes**, cinco en cada entidad. Las cinco funciones HTTP se documentan en las tablas, sin cajas adicionales ni métodos importados en los Boundary. loadProveedor del efecto de la página de edición se documenta como función adicional del camino preparatorio de CU11, sin otra caja.

**Comprobación acotada:** participantes, firmas, estados/props, callbacks y funciones HTTP contrastados con sus archivos fuente; permisos con el catálogo y rutas protegidas; atributos con el modelo y su migración; multiplicidades de contexto con sus asociaciones. **4/4 diagramas de Fase 2 con sintaxis válida en Mermaid 11.12.0**, mediante mermaid.parse. Se comprobó la conservación íntegra de Fase 1 y del bloque desde Fase 3; `git diff --check` aprobado y únicamente cambia este Markdown. Se mantienen los 33 CU y 34 diagramas del documento. La revisión visual exhaustiva se reserva para el cierre integral; no se ejecutaron pruebas funcionales, conexiones a MySQL, suites extensas, hashes del repositorio ni capturas/SVG.

**Avance de corrección al cierre de Fase 2:** **13/33 CU y 14/34 diagramas corregidos**. Fase 2 queda para revisión del usuario. Las fases 3–6 conservan su versión conceptual anterior y permanecen pendientes de autorización para corregirlas.

## 5. Fase 3 — Medicamentos, Principios Activos y Composición

### 5.1. Condiciones compartidas, permisos y asociaciones

Se mantiene un Control conceptual principal por CU. Sus operaciones reúnen la coordinación real de Controllers, Validators, Services, Repositories y auxiliares, sin representar esas piezas como clases académicas adicionales ni trasladar sus métodos a las entidades.

| Caso o camino | Actores autorizados |
|---|---|
| CU14, CU16 y CU17 | Regente. |
| CU15 y CU20 | Administrador, Regente o Vendedor. |
| CU18: listado y consulta por ID | Administrador o Regente. |
| CU18: registro, edición y cambio de estado | Regente. |
| CU19: agregar, editar y retirar componentes | Regente, actor principal del CU. |
| CU19: lectura de apoyo de la pantalla | Administrador, Regente o Vendedor. |

Todas las solicitudes requieren sesión válida y cuenta activa, con versión de credenciales vigente. La autenticación transversal conserva el flujo documentado de authMiddleware/authService/usuarioRepository; requireRole autoriza cada operación. Usuario no se repite como entidad del objetivo ni se confunde con los actores.

**Atributos y tipos:** los dibujos seleccionan campos persistentes relevantes. `VARCHAR_20`, `VARCHAR_40`, `VARCHAR_50` y `VARCHAR_80` abrevian las longitudes SQL; `DECIMAL_12_4` representa `DECIMAL(12,4)`. Las cantidades de composición son positivas, con hasta cuatro decimales y unidades de hasta 30 caracteres; la API recibe números JSON y devuelve cadenas decimales. Los campos de las vistas son temporales; Lista representa arreglos del formulario o de resultados.

| Asociación persistente utilizada | Multiplicidades | Interpretación |
|---|---|---|
| ProveedorLaboratorio — Medicamento | `1` — `0..*` | Cada medicamento tiene un proveedor/laboratorio; este puede no tener medicamentos. |
| Medicamento — ComposicionMedicamento | `1` — `0..*` | Cada componente pertenece a un medicamento; estructuralmente se conservan históricos sin componentes. |
| PrincipioActivo — ComposicionMedicamento | `1` — `0..*` | Cada componente referencia un principio; un principio puede participar en varios medicamentos. |
| Medicamento — ExistenciaMedicamento | `1` — `0..*` | Cada existencia pertenece a un medicamento. En CU16/CU19 se consulta para comprobar historial. |
| ExistenciaMedicamento — MovimientoInventario | `1` — `0..*` | Cada movimiento pertenece a una existencia; basta un movimiento para establecer historial del medicamento. |

Las asociaciones se dibujan cuando ambas entidades participan. ComposicionMedicamento es la clase asociativa con cantidades/unidades: no se agrega una relación directa muchos-a-muchos que oculte esos datos. Las FK no nullable y RESTRICT no constituyen composición UML. La asociación persistente adicional **Usuario `1` — `0..*` MovimientoInventario** identifica al responsable histórico; queda como contexto, porque CU16/CU19 no cargan al responsable de los movimientos. El usuario autenticado no tiene que ser su autor.

**Mínimo funcional y persistencia:** CU14 exige al menos un componente al crear; no se cambia por ello la multiplicidad estructural `0..*`. Se conservan históricos incompletos y CU19 permite retirar la última relación sin movimientos si el resultado respeta la unicidad. El par medicamento/principio es único; un principio inactivo no impide por sí solo relacionarlo en el contrato vigente.

**Identidad e historial:** el código se genera en el backend y es inmutable desde el alta. La identidad comercial compara nombre, proveedor, forma, presentación, unidad de inventario, vía, liberación y composición completa con todos sus datos, incluidos registros inactivos y excluyendo el propio registro al modificar. No equivale a compartir ingredientes. Un historial existe por movimientos asociados, aunque se hayan revertido o el saldo sea cero; una existencia por sí sola no basta. `tieneHistorial` no es columna ni campo público.

CU14/CU16/CU19 coordinan transacción de catálogo, bloqueos y comprobación de identidad; CU17 y las escrituras de CU18 también usan transacciones, según sus flujos reales. Consultar historial no registra movimientos ni modifica stock. La carga preparatoria de proveedores y principios reutiliza CU11/CU18; no se incorpora como operación propia de alta o edición de Medicamento.

Las correspondencias remiten a `medicamentoService`, `principioActivoService` y `composicionMedicamentoService` y a sus Controllers/Validators/Repositories documentados en el análisis técnico. `backend/src/business/services/identidad-medicamento.js` exporta auxiliares compartidos, no otra entidad ni otro Service. Referencias comunes: RF03/RF04, RF11–RF14; RN10/RN13–RN17.

### CU14 — Registrar medicamento

**Actor o actores:** Regente autenticado.

**Objetivo:** registrar un medicamento y su composición inicial no vacía mediante una única operación atómica.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaRegistrarMedicamento | Boundary | Recoge datos comerciales y prepara componentes en un borrador local. |
| ControlRegistrarMedicamento | Control | Valida alta, referencias e identidad, genera código y coordina registro integral y resultado. |
| Medicamento | Entity | Representa el producto nuevo del catálogo. |
| ProveedorLaboratorio | Entity | Representa el proveedor existente y activo asignado. |
| PrincipioActivo | Entity | Identifica cada ingrediente existente. |
| ComposicionMedicamento | Entity | Representa los componentes registrados junto al medicamento. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Regente { <<actor>> }
    class VistaRegistrarMedicamento {
        <<boundary>>
        -String nombreComercial
        -Integer idProveedorLaboratorio
        -String formaFarmaceutica
        -String presentacion
        -String unidadInventario
        -Integer stockMinimo
        -String condicionVenta
        -String viaAdministracion
        -String tipoLiberacion
        -Lista composicion
        +agregarComponenteBorrador()
        +editarComponenteBorrador()
        +retirarComponenteBorrador()
        +enviarRegistroIntegral()
    }
    class ControlRegistrarMedicamento {
        <<control>>
        +validarAlta()
        +validarReferencias()
        +comprobarIdentidad()
        +generarCodigo()
        +registrarMedicamentoConComposicion()
        +consultarResultado()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_80 forma_farmaceutica
        -VARCHAR_150 presentacion
        -VARCHAR_50 unidad_inventario
        -INT stock_minimo
        -VARCHAR_40 condicion_venta
        -VARCHAR_80 via_administracion
        -VARCHAR_80 tipo_liberacion
        -BOOLEAN estado
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -BOOLEAN estado
    }
    class PrincipioActivo {
        <<entity>>
        -INT id_principio_activo
        -VARCHAR_150 nombre
    }
    class ComposicionMedicamento {
        <<entity>>
        -INT id_composicion
        -DECIMAL_12_4 cantidad_principio_activo
        -VARCHAR_30 unidad_principio_activo
        -DECIMAL_12_4 cantidad_referencia
        -VARCHAR_30 unidad_referencia
    }
    Regente --> VistaRegistrarMedicamento
    VistaRegistrarMedicamento ..> ControlRegistrarMedicamento : solicita
    ControlRegistrarMedicamento ..> Medicamento : registra
    ControlRegistrarMedicamento ..> ProveedorLaboratorio : valida
    ControlRegistrarMedicamento ..> PrincipioActivo : verifica existencia
    ControlRegistrarMedicamento ..> ComposicionMedicamento : registra componentes
    ProveedorLaboratorio "1" -- "0..*" Medicamento : proveedorLaboratorio
    Medicamento "1" -- "0..*" ComposicionMedicamento : composiciones
    PrincipioActivo "1" -- "0..*" ComposicionMedicamento : principioActivo
```

**Descripción de relaciones:** el Regente prepara el medicamento y uno o más componentes; agregar, corregir o retirar del borrador no escribe entidades. El Control comprueba proveedor activo, principios existentes y ausencia de ingredientes repetidos, compara la identidad completa y registra Medicamento y ComposicionMedicamento juntos. Las asociaciones expresan a qué producto e ingrediente pertenece cada componente; las FK pueden omitirse como atributos cuando ya están representadas por la asociación.

El código se genera con tres letras válidas normalizadas del nombre y el mayor correlativo conservado del prefijo más uno, sin reutilizar huecos. La comparación de identidad incluye inactivos. El estado inicial de medicamento es activo por defecto; el formulario no envía estado ni código/IDs técnicos. Stock mínimo utiliza cero por defecto. El mínimo de un componente pertenece a la precondición del alta, no a un cambio de la multiplicidad persistente.

Una colisión específica de código puede repetir la transacción hasta cinco intentos; agotamiento, referencia inválida o duplicado rechazan el alta. Cualquier fallo revierte todas las inserciones. No se crean existencias ni movimientos y no se incorpora stock físico al dar de alta el catálogo.

**Correspondencia con la implementación:** `/medicamentos/nuevo`, `frontend/src/features/medicamentos/pages/MedicamentoFormPage.jsx`, `frontend/src/features/medicamentos/components/MedicamentoForm.jsx`, `ComposicionForm.jsx` y `ComposicionTable.jsx` representan la vista y su borrador. El servicio HTTP de Medicamentos usa `POST /api/medicamentos`.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarAlta | `medicamentoController.createMedicamento` y `medicamentoValidator.validateCreate` validan body estricto y composición no vacía/sin principios repetidos; usan el esquema compartido de componentes. |
| validarReferencias | `medicamentoService.createMedicamento`, `medicamentoRepository.findProveedorById` y `composicionMedicamentoRepository.findPrincipioById` verifican las referencias dentro de la transacción. |
| comprobarIdentidad | Auxiliares de `identidad-medicamento.js` y `medicamentoRepository.findDuplicadosIdentidad` comparan atributos y composición completa. |
| generarCodigo | Función externa `generarCodigo`, con `findMayorCorrelativo`/`findByCodigo`; no es un método del modelo ni de medicamentoService. |
| registrarMedicamentoConComposicion | `medicamentoService.createMedicamento` coordina `medicamentoRepository.create` y `composicionMedicamentoRepository.create` para todos los componentes. |
| consultarResultado | `medicamentoService.getMedicamentoById` obtiene el DTO con proveedor y composición antes de confirmar la transacción. |

Resultado 201 después del commit; la interfaz abre la ficha con el código confirmado. Ante rechazo conserva el borrador y, si recibe referencias de duplicados, permite consultarlas. Referencias: RF11/RF13; RN10/RN13/RN15/RN16 y CU14.

### CU15 — Consultar o buscar medicamento

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** consultar el catálogo por nombre/código y obtener la ficha de un medicamento seleccionado.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarMedicamentos | Boundary | Recoge filtros textuales y presenta listado o ficha. |
| ControlConsultarMedicamentos | Control | Valida la consulta y obtiene datos públicos con asociaciones. |
| Medicamento | Entity | Representa los productos activos e inactivos consultados. |
| ProveedorLaboratorio | Entity | Identifica al proveedor incluido en la respuesta. |
| ComposicionMedicamento | Entity | Aporta la composición completa de cada producto. |
| PrincipioActivo | Entity | Identifica los ingredientes de los componentes. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaConsultarMedicamentos {
        <<boundary>>
        -String codigoMedicamento
        -String nombreComercial
        -Integer idMedicamento
        -Lista medicamentos
        +solicitarListado()
        +aplicarBusqueda()
        +solicitarFicha()
    }
    class ControlConsultarMedicamentos {
        <<control>>
        +validarConsulta()
        +consultarListado()
        +consultarDetalle()
        +prepararDatosPublicos()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_80 forma_farmaceutica
        -VARCHAR_150 presentacion
        -VARCHAR_50 unidad_inventario
        -VARCHAR_40 condicion_venta
        -BOOLEAN estado
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
    }
    class ComposicionMedicamento {
        <<entity>>
        -INT id_composicion
        -DECIMAL_12_4 cantidad_principio_activo
        -VARCHAR_30 unidad_principio_activo
        -DECIMAL_12_4 cantidad_referencia
        -VARCHAR_30 unidad_referencia
    }
    class PrincipioActivo {
        <<entity>>
        -INT id_principio_activo
        -VARCHAR_150 nombre
    }
    Administrador --> VistaConsultarMedicamentos
    Regente --> VistaConsultarMedicamentos
    Vendedor --> VistaConsultarMedicamentos
    VistaConsultarMedicamentos ..> ControlConsultarMedicamentos : solicita
    ControlConsultarMedicamentos ..> Medicamento : consulta
    ControlConsultarMedicamentos ..> ProveedorLaboratorio : incluye
    ControlConsultarMedicamentos ..> ComposicionMedicamento : incluye completa
    ControlConsultarMedicamentos ..> PrincipioActivo : incluye
    ProveedorLaboratorio "1" -- "0..*" Medicamento : proveedorLaboratorio
    Medicamento "1" -- "0..*" ComposicionMedicamento : composiciones
    PrincipioActivo "1" -- "0..*" ComposicionMedicamento : principioActivo
```

**Descripción de relaciones:** los tres actores solicitan listado/búsqueda o detalle al mismo Control conceptual. Las entidades asociadas se leen para la respuesta pública, sin invocar por ello sus Services de mantenimiento. La selección de atributos del dibujo no limita el DTO real, que contiene los datos comerciales y todos los componentes.

| Camino | Responsabilidades y condiciones |
|---|---|
| Listado y búsqueda | Valida filtros y ejecuta `consultarListado`; código/nombre se buscan como texto contenido y pueden combinarse. Un listado vacío es válido. |
| Detalle | Valida ID y ejecuta `consultarDetalle`; un producto inexistente devuelve 404. |

La búsqueda textual espera 350 ms en la interfaz y conserva criterios en URL; se descartan respuestas anteriores al cambiar el borrador. El contrato mantiene activos/inactivos e históricos sin composición, sin filtro de estado ni paginación. La ficha no calcula stock ni historial; sus enlaces reutilizan otros CU. La búsqueda por ingredientes se detalla por separado en CU20.

**Correspondencia con la implementación:** `/medicamentos`, `frontend/src/features/medicamentos/pages/MedicamentosPage.jsx`, `frontend/src/features/medicamentos/components/MedicamentoFilters.jsx` y `MedicamentoTable.jsx` representan el listado; `/medicamentos/:idMedicamento` y `frontend/src/features/medicamentos/pages/MedicamentoDetailPage.jsx`, la ficha.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarConsulta | `medicamentoController` utiliza `medicamentoValidator.validateFiltros` para query o `validateId` para detalle. |
| consultarListado | `medicamentoController.getMedicamentos` → `medicamentoService.getMedicamentos` → `medicamentoRepository.findAll`, con asociaciones completas. |
| consultarDetalle | `medicamentoController.getMedicamentoById` → `medicamentoService.getMedicamentoById` → `medicamentoRepository.findById`. |
| prepararDatosPublicos | Funciones externas `toPublicMedicamento` y `toPublicComposicion` transforman las instancias y cantidades para el DTO. |

Las consultas usan `GET /api/medicamentos` y `GET /api/medicamentos/:idMedicamento`; devuelven 200 sin escrituras. Referencias: RF11; RN13–RN16 y CU15.

### CU16 — Modificar medicamento

**Actor o actores:** Regente autenticado.

**Objetivo:** actualizar datos comerciales permitidos, conservando código, composición e integridad histórica.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaModificarMedicamento | Boundary | Permite editar datos comerciales y envía únicamente los modificados. |
| ControlModificarMedicamento | Control | Coordina validación, historial/identidad condicionales, actualización y resultado. |
| Medicamento | Entity | Representa el producto editado y su identidad comercial. |
| ProveedorLaboratorio | Entity | Representa referencias bloqueadas y proveedor enviado que debe estar activo. |
| ComposicionMedicamento | Entity | Aporta composición actual para identidad y lectura final; no se modifica. |
| PrincipioActivo | Entity | Identifica los ingredientes incluidos en la lectura final. |
| ExistenciaMedicamento | Entity | Permite localizar y bloquear las existencias al comprobar historial. |
| MovimientoInventario | Entity | Determina si existe historial que impide cambios protegidos. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Regente { <<actor>> }
    class VistaModificarMedicamento {
        <<boundary>>
        -Integer idMedicamento
        -String nombreComercial
        -Integer idProveedorLaboratorio
        -String formaFarmaceutica
        -String presentacion
        -String unidadInventario
        -Integer stockMinimo
        -String condicionVenta
        -String viaAdministracion
        -String tipoLiberacion
        +enviarCamposModificados()
    }
    class ControlModificarMedicamento {
        <<control>>
        +validarCambios()
        +comprobarHistorial()
        +verificarProveedor()
        +comprobarIdentidad()
        +actualizarMedicamento()
        +consultarResultado()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_80 forma_farmaceutica
        -VARCHAR_150 presentacion
        -VARCHAR_50 unidad_inventario
        -INT stock_minimo
        -VARCHAR_40 condicion_venta
        -VARCHAR_80 via_administracion
        -VARCHAR_80 tipo_liberacion
        -BOOLEAN estado
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -BOOLEAN estado
    }
    class ComposicionMedicamento {
        <<entity>>
        -INT id_composicion
        -DECIMAL_12_4 cantidad_principio_activo
        -VARCHAR_30 unidad_principio_activo
        -DECIMAL_12_4 cantidad_referencia
        -VARCHAR_30 unidad_referencia
    }
    class PrincipioActivo {
        <<entity>>
        -INT id_principio_activo
        -VARCHAR_150 nombre
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -INT id_medicamento
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -INT id_existencia
    }
    Regente --> VistaModificarMedicamento
    VistaModificarMedicamento ..> ControlModificarMedicamento : solicita
    ControlModificarMedicamento ..> Medicamento : actualiza
    ControlModificarMedicamento ..> ProveedorLaboratorio : verifica referencia
    ControlModificarMedicamento ..> ComposicionMedicamento : identidad y lectura
    ControlModificarMedicamento ..> PrincipioActivo : lectura final
    ControlModificarMedicamento ..> ExistenciaMedicamento : historial condicional
    ControlModificarMedicamento ..> MovimientoInventario : historial condicional
    ProveedorLaboratorio "1" -- "0..*" Medicamento : proveedorLaboratorio
    Medicamento "1" -- "0..*" ComposicionMedicamento : composiciones
    PrincipioActivo "1" -- "0..*" ComposicionMedicamento : principioActivo
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
```

**Descripción de relaciones:** el Control utiliza Medicamento y sus referencias para editar y devolver el resultado. ComposicionMedicamento y PrincipioActivo participan en identidad/lectura, no como relaciones que se escriban aquí. Las dependencias hacia ExistenciaMedicamento y MovimientoInventario son condicionales: solo un cambio efectivo de campos protegidos ejecuta la comprobación de historial.

| Cambio solicitado | Condición y efecto |
|---|---|
| Proveedor, forma, presentación, unidad de inventario, vía o liberación | Si cambia efectivamente, exige ausencia de movimientos en cualquiera de las existencias. |
| Nombre comercial | Puede cambiar con historial; un cambio efectivo exige comparar identidad con la composición completa. |
| Stock mínimo o condición de venta | Pueden cambiar con historial; por sí solos no activan la comparación de identidad. |
| Código, estado o composición | No se aceptan en este PATCH; código inmutable, estado mediante CU17 y composición mediante CU19. |

Si se envía proveedor, debe estar activo incluso si es el mismo ID; la interfaz omite una asignación conservada, permitiendo mantener su proveedor inactivo. Se bloquean producto y proveedores y se comprueba historial/identidad cuando corresponde; se excluye el propio producto de la búsqueda de duplicados. Una existencia sin movimientos no basta para bloquear el cambio. Actualización y lectura final se confirman juntas; un conflicto revierte el PATCH.

**Correspondencia con la implementación:** `/medicamentos/:idMedicamento/editar`, MedicamentoFormPage y MedicamentoForm representan la vista. La preparación reutiliza CU15/CU11. La función HTTP `updateMedicamento` envía `PATCH /api/medicamentos/:idMedicamento` sin código, estado ni composición.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarCambios | `medicamentoController.updateMedicamento`, `medicamentoValidator.validateId` y `validateUpdate` validan el PATCH estricto/no vacío. |
| comprobarHistorial | `medicamentoService.validateSinHistorial` y `medicamentoRepository.hasMovimientos` bloquean existencias y buscan un movimiento cuando cambian campos protegidos. |
| verificarProveedor | `medicamentoService.updateMedicamento` y auxiliares compartidos bloquean proveedores; `findProveedorById` comprueba la referencia enviada y su actividad. |
| comprobarIdentidad | Ante cambios efectivos de nombre/identidad, `composicionMedicamentoRepository.findAllForMedicamento` y auxiliares de identidad/`findDuplicadosIdentidad` comparan el estado completo resultante. |
| actualizarMedicamento | `medicamentoService.updateMedicamento`, `getMedicamentoForUpdate` y `medicamentoRepository.update` coordinan bloqueo y escritura. |
| consultarResultado | `medicamentoService.getMedicamentoById` devuelve el DTO con asociaciones dentro de la misma transacción. |

Resultado 200; datos inválidos, referencias, historial o duplicado se comunican según el error real. El formulario conserva el borrador ante rechazo y abre la ficha al éxito. No se regeneran códigos ni se escriben movimientos. Referencias: RF11; RN10/RN13 y CU16.

### CU17 — Activar o desactivar medicamento

**Actor o actores:** Regente autenticado.

**Objetivo:** cambiar el estado del medicamento sin eliminar el registro ni su historial.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaCambiarEstadoMedicamento | Boundary | Identifica el producto y confirma el estado objetivo. |
| ControlCambiarEstadoMedicamento | Control | Valida el estado y coordina cambio y lectura del resultado. |
| Medicamento | Entity | Representa el producto cuyo estado cambia. |
| ProveedorLaboratorio | Entity | Aporta datos asociados del resultado, sin cambio ni validación de actividad. |
| ComposicionMedicamento | Entity | Aporta composición de la lectura final, sin modificación. |
| PrincipioActivo | Entity | Identifica ingredientes de la lectura final. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Regente { <<actor>> }
    class VistaCambiarEstadoMedicamento {
        <<boundary>>
        -Integer idMedicamento
        -Boolean estadoSolicitado
        +confirmarCambioEstado()
    }
    class ControlCambiarEstadoMedicamento {
        <<control>>
        +validarEstado()
        +cambiarEstado()
        +consultarResultado()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -BOOLEAN estado
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
    }
    class ComposicionMedicamento {
        <<entity>>
        -INT id_composicion
        -DECIMAL_12_4 cantidad_principio_activo
        -VARCHAR_30 unidad_principio_activo
        -DECIMAL_12_4 cantidad_referencia
        -VARCHAR_30 unidad_referencia
    }
    class PrincipioActivo {
        <<entity>>
        -INT id_principio_activo
        -VARCHAR_150 nombre
    }
    Regente --> VistaCambiarEstadoMedicamento
    VistaCambiarEstadoMedicamento ..> ControlCambiarEstadoMedicamento : solicita
    ControlCambiarEstadoMedicamento ..> Medicamento : cambia estado
    ControlCambiarEstadoMedicamento ..> ProveedorLaboratorio : lectura final
    ControlCambiarEstadoMedicamento ..> ComposicionMedicamento : lectura final
    ControlCambiarEstadoMedicamento ..> PrincipioActivo : lectura final
    ProveedorLaboratorio "1" -- "0..*" Medicamento : proveedorLaboratorio
    Medicamento "1" -- "0..*" ComposicionMedicamento : composiciones
    PrincipioActivo "1" -- "0..*" ComposicionMedicamento : principioActivo
```

**Descripción de relaciones:** el Control modifica únicamente estado en Medicamento; proveedor, composición y principios participan en el DTO final. El flujo no comprueba historial, actividad del proveedor ni duplicados comerciales. No se crea ni modifica una existencia o movimiento; por ello no se agregan como entidades del dibujo.

La API recibe estado booleano objetivo, aunque la interfaz proponga el inverso. Se acepta el estado ya existente. Inactivar conserva código e información, no pone saldo físico a cero; los consumidores de stock aplican las condiciones de disponibilidad vendible en sus CU. El cambio y resultado se confirman en una transacción con bloqueo del producto.

**Correspondencia con la implementación:** MedicamentosPage, MedicamentoTable y `frontend/src/components/ConfirmDialog.jsx` representan selección y confirmación en `/medicamentos`.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarEstado | `medicamentoController.updateEstado`, `medicamentoValidator.validateId` y `validateUpdateEstado`. |
| cambiarEstado | `medicamentoService.updateEstado` utiliza `getMedicamentoForUpdate` y `medicamentoRepository.updateEstado`, que delega en su propio `update`. |
| consultarResultado | `medicamentoService.getMedicamentoById` consulta las asociaciones para la respuesta dentro de la transacción. |

La función HTTP `updateEstadoMedicamento` usa `PATCH /api/medicamentos/:idMedicamento/estado`; devuelve 200 con mensaje/DTO. El listado actualiza la fila con la respuesta y cierra la confirmación; un error no se muestra como cambio exitoso. Referencias: RF11; RN13/RN14 y CU17.

### CU18 — Gestionar principios activos

**Actor o actores:** Administrador o Regente para consultar; exclusivamente Regente para registrar, modificar y cambiar estado.

**Objetivo:** mantener el catálogo de principios activos mediante consulta, registro, edición y activación/desactivación.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaGestionarPrincipios | Boundary | Agrupa listado/formulario y confirmación, mostrando acciones según el rol. |
| ControlGestionarPrincipios | Control | Coordina la operación solicitada, validación y unicidad del nombre cuando corresponde. |
| PrincipioActivo | Entity | Representa el ingrediente de referencia con nombre único, descripción y estado. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class VistaGestionarPrincipios {
        <<boundary>>
        -Integer idPrincipioActivo
        -String nombre
        -String descripcion
        -Boolean estado
        -String busqueda
        +solicitarConsulta()
        +filtrarListadoLocal()
        +enviarRegistro()
        +enviarCambios()
        +confirmarEstado()
    }
    class ControlGestionarPrincipios {
        <<control>>
        +validarSolicitud()
        +consultarPrincipios()
        +consultarPrincipio()
        +comprobarNombreDisponible()
        +registrarPrincipio()
        +modificarPrincipio()
        +cambiarEstado()
    }
    class PrincipioActivo {
        <<entity>>
        -INT id_principio_activo
        -VARCHAR_150 nombre
        -VARCHAR_255 descripcion
        -BOOLEAN estado
    }
    Administrador --> VistaGestionarPrincipios : solo consulta
    Regente --> VistaGestionarPrincipios : consulta y administra
    VistaGestionarPrincipios ..> ControlGestionarPrincipios : solicita
    ControlGestionarPrincipios ..> PrincipioActivo : segun operacion
```

**Descripción de relaciones:** la vista conceptual reúne interfaces de mantenimiento, sin afirmar que exista una única página o clase JavaScript. Una solicitud ejecuta el camino elegido, no todas las operaciones del Control. No se carga ComposicionMedicamento al mantener el principio; su asociación `1` — `0..*` es contexto y se representa en los CU donde sí participa.

| Camino | Permiso y responsabilidades |
|---|---|
| Listado | Administrador/Regente; `consultarPrincipios`, sin Validator específico. Búsqueda local por nombre/descripción; resultado vacío válido. |
| Consulta por ID | Administrador/Regente; valida ID y `consultarPrincipio`. La edición reutiliza esta carga. |
| Registro | Regente; valida datos y nombre único y registra. Estado inicial opcional en API, activo por defecto. |
| Edición | Regente; valida PATCH/ID, bloquea principio, comprueba nombre si se envía y modifica datos; consulta resultado. |
| Cambio de estado | Regente; valida ID/booleano, bloquea y cambia estado; consulta resultado. |

Nombre es obligatorio, recortado y hasta 150 caracteres; descripción opcional admite NULL y vacío como retirada. Un duplicado de nombre produce 409. Desactivar conserva principio y relaciones; no elimina ni modifica componentes. La relación de composición exige existencia del principio, no actividad. Cambiar nombre/descripción del catálogo no cambia sus FK, cantidades ni unidades en composición y no ejecuta la comprobación de identidad comercial del medicamento. Vendedor no accede a este catálogo de mantenimiento.

**Correspondencia con la implementación:** `frontend/src/features/principios-activos/pages/PrincipiosActivosPage.jsx`, `frontend/src/features/principios-activos/components/PrincipioActivoTable.jsx`, `frontend/src/features/principios-activos/pages/PrincipioActivoFormPage.jsx` y `frontend/src/features/principios-activos/components/PrincipioActivoForm.jsx`, más ConfirmDialog, representan la vista.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarSolicitud | `principioActivoController` y `principioActivoValidator.validateId`/`validateCreate`/`validateUpdate`/`validateUpdateEstado`, según camino; el listado no ejecuta Validator. |
| consultarPrincipios | `principioActivoService.getPrincipiosActivos` y `principioActivoRepository.findAll`, ordenados por ID. |
| consultarPrincipio | `principioActivoService.getPrincipioActivoById` y `principioActivoRepository.findById`; también lectura final de edición/estado. |
| comprobarNombreDisponible | Auxiliar externo `validateNombreDisponible`, `findByNombre` y UNIQUE; traducción externa del conflicto a 409. |
| registrarPrincipio | `principioActivoService.createPrincipioActivo` y `principioActivoRepository.create`, en transacción; DTO de la instancia creada. |
| modificarPrincipio | `principioActivoService.updatePrincipioActivo`, consulta bloqueante, `principioActivoRepository.update` y lectura final dentro de la transacción. |
| cambiarEstado | `principioActivoService.updateEstado` y `principioActivoRepository.updateEstado` → `update`, con bloqueo/lectura final en transacción. |

El servicio HTTP `frontend/src/features/principios-activos/services/principio-activo.service.js` utiliza `/api/principios-activos`: GET de listado/ID, POST de registro, PATCH de datos y PATCH `/:idPrincipioActivo/estado`. Resultado 201 en alta y 200 en las demás operaciones. El formulario conserva borrador ante error y vuelve al listado al guardar. Referencias: RF12; RN16 y CU18.

### CU19 — Gestionar composición de medicamento

**Actor o actores:** Regente para administrar, actor principal del CU. Administrador, Regente o Vendedor en la lectura de apoyo de la pantalla.

**Objetivo:** consultar y administrar componentes de un medicamento existente, respetando historial, pertenencia e identidad comercial completa.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaGestionarComposicion | Boundary | Muestra componentes y permite al Regente agregar, editar o confirmar retiro. |
| ControlGestionarComposicion | Control | Coordina el camino solicitado, las comprobaciones previas y la identidad resultante. |
| Medicamento | Entity | Identifica el producto al que debe pertenecer la composición. |
| ProveedorLaboratorio | Entity | Participa en sincronización de identidad y lectura, sin exigir actividad aquí. |
| ComposicionMedicamento | Entity | Representa la relación que se consulta, crea, modifica o retira. |
| PrincipioActivo | Entity | Identifica ingredientes y valida existencia al agregar. |
| ExistenciaMedicamento | Entity | Permite comprobar ausencia de historial antes de toda escritura. |
| MovimientoInventario | Entity | Establece historial que impide administrar la composición. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Regente { <<actor>> }
    class Administrador { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaGestionarComposicion {
        <<boundary>>
        -Integer idMedicamento
        -Integer idComposicion
        -Integer idPrincipioActivo
        -Number cantidadPrincipioActivo
        -String unidadPrincipioActivo
        -Number cantidadReferencia
        -String unidadReferencia
        -Lista composicion
        +solicitarComposicion()
        +enviarNuevoComponente()
        +enviarCantidadesYUnidades()
        +confirmarRetiroRelacion()
    }
    class ControlGestionarComposicion {
        <<control>>
        +validarSolicitud()
        +consultarComposicion()
        +comprobarAusenciaHistorial()
        +verificarRelacion()
        +agregarComponente()
        +modificarComponente()
        +retirarRelacion()
        +comprobarIdentidad()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_80 forma_farmaceutica
        -VARCHAR_150 presentacion
        -VARCHAR_50 unidad_inventario
        -VARCHAR_80 via_administracion
        -VARCHAR_80 tipo_liberacion
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
    }
    class ComposicionMedicamento {
        <<entity>>
        -INT id_composicion
        -DECIMAL_12_4 cantidad_principio_activo
        -VARCHAR_30 unidad_principio_activo
        -DECIMAL_12_4 cantidad_referencia
        -VARCHAR_30 unidad_referencia
    }
    class PrincipioActivo {
        <<entity>>
        -INT id_principio_activo
        -VARCHAR_150 nombre
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -INT id_medicamento
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -INT id_existencia
    }
    Regente --> VistaGestionarComposicion : administra
    Administrador --> VistaGestionarComposicion : solo lectura
    Vendedor --> VistaGestionarComposicion : solo lectura
    VistaGestionarComposicion ..> ControlGestionarComposicion : solicita
    ControlGestionarComposicion ..> Medicamento : comprueba y consulta
    ControlGestionarComposicion ..> ProveedorLaboratorio : identidad y lectura
    ControlGestionarComposicion ..> ComposicionMedicamento : segun operacion
    ControlGestionarComposicion ..> PrincipioActivo : referencia e include
    ControlGestionarComposicion ..> ExistenciaMedicamento : solo escrituras
    ControlGestionarComposicion ..> MovimientoInventario : solo escrituras
    ProveedorLaboratorio "1" -- "0..*" Medicamento : proveedorLaboratorio
    Medicamento "1" -- "0..*" ComposicionMedicamento : composiciones
    PrincipioActivo "1" -- "0..*" ComposicionMedicamento : principioActivo
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
```

**Descripción de relaciones:** el Control coordina producto y relación asociativa. Consultar composición utiliza la lectura completa del medicamento con proveedor y principios; no ejecuta el Repository de Composición en ese camino. Las escrituras bloquean producto, proveedor y existencias para exigir ausencia de movimientos. MovimientoInventario se busca si se encontraron existencias; no se carga ni se modifica su responsable histórico.

| Camino | Condiciones y resultado |
|---|---|
| Consulta de apoyo | Los tres roles pueden leer; devuelve todos los componentes. No comprueba ausencia de historial ni escribe. |
| Agregar | Solo Regente y sin historial; principio existente, sin repetición para ese producto. Crea la relación y valida identidad completa resultante. |
| Editar | Solo Regente y sin historial; relación buscada por medicamento y componente. Modifica únicamente cantidades/unidades y valida identidad resultante. |
| Retirar relación | Solo Regente y sin historial; confirma retiro, verifica pertenencia y elimina físicamente esa relación. Valida identidad resultante, también si se retira la última. |

El PATCH no cambia medicamento/principio por FK. Un ingrediente equivocado se corrige retirando su relación y creando la correcta. Un componente de otro medicamento produce 404; un historial, ingrediente repetido o identidad duplicada rechaza el cambio según su condición. Toda escritura y comprobación resultante se confirman juntas o se revierten. Se permite completar un histórico vacío y retirar la última relación sin historial si no se produce duplicado; no habilita un alta nueva sin composición.

El proveedor se bloquea para sincronizar identidad, pero este CU no exige que proveedor o medicamento estén activos. Los principios deben existir, sin exigir estado activo. No se escriben existencias/movimientos. Las altas iniciales pertenecen al registro integral de CU14.

**Correspondencia con la implementación:** `/medicamentos/:idMedicamento/composicion`, `frontend/src/features/medicamentos/pages/MedicamentoComposicionPage.jsx`, `frontend/src/features/medicamentos/components/ComposicionForm.jsx` y `ComposicionTable.jsx`, Modal y ConfirmDialog representan la vista. Ficha y opciones preparatorias reutilizan CU15 y, solo para Regente, CU18.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarSolicitud | `composicionMedicamentoController` y `composicionMedicamentoValidator.validateMedicamentoId`/`validateId`/`validateCreate`/`validateUpdate`, según camino. |
| consultarComposicion | `composicionMedicamentoService.getComposicionMedicamento` llama a `medicamentoService.getMedicamentoById` y devuelve su composición completa. |
| comprobarAusenciaHistorial | Auxiliar externo `prepararModificacion`, `medicamentoService.getMedicamentoForUpdate`/`validateSinHistorial` y `medicamentoRepository.hasMovimientos` en toda escritura. |
| verificarRelacion | En alta, `findPrincipioById`/`findByPrincipio` comprueban referencia y no repetición; en edición/retiro, `findById` comprueba ambos IDs y pertenencia. |
| agregarComponente | `composicionMedicamentoService.createComposicion` y `composicionMedicamentoRepository.create`, con lectura final de la relación. |
| modificarComponente | `composicionMedicamentoService.updateComposicion` y `composicionMedicamentoRepository.update`, sin cambiar FK y con lectura final. |
| retirarRelacion | `composicionMedicamentoService.removeComposicion` y `composicionMedicamentoRepository.remove` utilizan destroy heredado solo para la relación. |
| comprobarIdentidad | Auxiliar externo `validarResultado`, `findAllForMedicamento` y auxiliares compartidos/`findDuplicadosIdentidad` comprueban composición completa resultante antes del commit. |

Las rutas bajo `/api/medicamentos/:idMedicamento/composicion` utilizan GET/POST y PATCH/DELETE `/:idComposicion`. Resultado 201 al agregar y 200 en las demás operaciones; DELETE devuelve mensaje sin data. Ante fallo se conserva el formulario; tras éxito la interfaz actualiza componentes locales. Referencias: RF13; RN13/RN15/RN16 y CU19.

### CU20 — Consultar medicamentos por composición

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** buscar medicamentos que contengan todos los principios activos seleccionados, admitiendo ingredientes adicionales.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaBuscarPorComposicion | Boundary | Permite selección múltiple de principios y filtros textuales complementarios. |
| ControlBuscarPorComposicion | Control | Valida filtros, coordina coincidencia AND y consulta datos completos de los resultados. |
| ComposicionMedicamento | Entity | Permite identificar medicamentos que contienen todos los principios solicitados. |
| Medicamento | Entity | Representa los productos coincidentes y los filtros textuales. |
| ProveedorLaboratorio | Entity | Identifica el proveedor en la respuesta completa. |
| PrincipioActivo | Entity | Identifica todos los ingredientes de los productos encontrados. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaBuscarPorComposicion {
        <<boundary>>
        -Lista idsPrincipiosActivos
        -String codigoMedicamento
        -String nombreComercial
        -Lista medicamentos
        +seleccionarPrincipios()
        +quitarPrincipio()
        +solicitarBusqueda()
    }
    class ControlBuscarPorComposicion {
        <<control>>
        +validarFiltros()
        +seleccionarCoincidencias()
        +consultarResultados()
    }
    class ComposicionMedicamento {
        <<entity>>
        -INT id_composicion
        -INT id_principio_activo
        -DECIMAL_12_4 cantidad_principio_activo
        -VARCHAR_30 unidad_principio_activo
        -DECIMAL_12_4 cantidad_referencia
        -VARCHAR_30 unidad_referencia
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_80 forma_farmaceutica
        -VARCHAR_150 presentacion
        -BOOLEAN estado
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
    }
    class PrincipioActivo {
        <<entity>>
        -INT id_principio_activo
        -VARCHAR_150 nombre
    }
    Administrador --> VistaBuscarPorComposicion
    Regente --> VistaBuscarPorComposicion
    Vendedor --> VistaBuscarPorComposicion
    VistaBuscarPorComposicion ..> ControlBuscarPorComposicion : solicita
    ControlBuscarPorComposicion ..> ComposicionMedicamento : seleccion AND e include
    ControlBuscarPorComposicion ..> Medicamento : consulta coincidencias
    ControlBuscarPorComposicion ..> ProveedorLaboratorio : incluye
    ControlBuscarPorComposicion ..> PrincipioActivo : incluye todos
    ProveedorLaboratorio "1" -- "0..*" Medicamento : proveedorLaboratorio
    Medicamento "1" -- "0..*" ComposicionMedicamento : composiciones
    PrincipioActivo "1" -- "0..*" ComposicionMedicamento : principioActivo
```

**Descripción de relaciones:** la selección utiliza ComposicionMedicamento para localizar IDs de medicamentos con todos los principios pedidos. Si hay coincidencias, consulta Medicamento con proveedor y composición completa, incluidos ingredientes adicionales. Las cantidades/unidades se muestran como información del resultado: no son criterios comparados por este filtro.

Solicitar A y B exige ambos, pero un producto A+B+C también coincide. Un ID de principio válido sin coincidencias devuelve listado vacío, no 404. El filtro no ejecuta la igualdad comercial de CU14/CU16/CU19 ni indica sustitución terapéutica. Mantiene activos/inactivos y no calcula stock vendible.

Administrador/Regente obtienen opciones mediante CU18. Vendedor obtiene opciones deduplicando principios del catálogo autorizado mediante CU15; no llama al catálogo de principios activos restringido. Las opciones no se limitan a los resultados filtrados. La selección de principios consulta inmediatamente; los filtros textuales conservan 350 ms de espera y los criterios se mantienen en URL.

**Correspondencia con la implementación:** MedicamentosPage y MedicamentoFilters representan la vista en `/medicamentos`. `frontend/src/features/medicamentos/services/medicamento.service.js` utiliza `getMedicamentos(filtros)` con `GET /api/medicamentos?idPrincipioActivo=...`, repitiendo el parámetro para varios IDs.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarFiltros | `medicamentoController.getMedicamentos` y `medicamentoValidator.validateFiltros` validan IDs positivos, eliminan repetidos y admiten código/nombre combinados. |
| seleccionarCoincidencias | `medicamentoRepository.findAll` consulta ComposicionMedicamento con IN, agrupación por medicamento y COUNT DISTINCT igual al número de principios solicitados. |
| consultarResultados | El mismo `findAll` consulta Medicamento y todas sus asociaciones si hay IDs coincidentes; `medicamentoService.getMedicamentos` prepara los DTO públicos. Sin coincidencias, retorna [] sin esa segunda consulta. |

No existe un método técnico adicional buscarPorComposicion: los nombres del Control son conceptuales. Las dos consultas son lecturas sin transacción conjunta explícita. Resultado 200 con composición completa; se manejan query inválida, sesión/permisos y fallo inesperado. Referencias: RF14; RN16/RN17 y CU20.

## 6. Cierre y revisión de la tercera entrega

| Caso de uso | Diagramas | Aspecto principal de revisión |
|---|---|---|
| CU14 — Registrar medicamento | 1 | Alta integral, código automático, composición no vacía e identidad completa. |
| CU15 — Consultar o buscar medicamento | 1 | Listado/ficha, filtros textuales y lectura de todas las asociaciones. |
| CU16 — Modificar medicamento | 1 | Historial e identidad condicionales; código/composición conservados. |
| CU17 — Activar o desactivar medicamento | 1 | Estado específico y lectura final, sin modificar stock ni historial. |
| CU18 — Gestionar principios activos | 1 | Consulta y mantenimiento con permisos diferenciados y nombre único. |
| CU19 — Gestionar composición de medicamento | 1 | Consulta de apoyo y tres escrituras; pertenencia, historial e identidad resultante. |
| CU20 — Consultar medicamentos por composición | 1 | Selección AND, ingredientes adicionales y opciones autorizadas por rol. |
| **Total de Fase 3** | **7** | **Siete CU, numeración única CU14–CU20.** |

**Criterio de comprobación:** cada dibujo utiliza un Boundary y un Control conceptual, con operaciones respaldadas por sus correspondencias. Se contrastan entidades y atributos relevantes, permisos por camino y multiplicidades persistentes; se distingue el mínimo de alta de la cardinalidad estructural. Existencias/movimientos solo participan como comprobación de historial en CU16/CU19. No se agregan entidades de inventario, herencias, composiciones UML ni métodos de Service a los modelos.

**Validación de esta entrega:** se comprobaron los nombres/números CU14–CU20 contra el catálogo oficial, sin duplicados ni ausencias, y la estructura completa de cada análisis. Los siete dibujos contienen siete Boundary y siete Control, con 37 operaciones conceptuales respaldadas por sus correspondencias. Se contrastaron seis entidades reales —Medicamento, ProveedorLaboratorio, PrincipioActivo, ComposicionMedicamento, ExistenciaMedicamento y MovimientoInventario— y 117 apariciones de atributos seleccionados con el modelo general. Se verificaron las 22 apariciones de asociaciones del objetivo contra cada CU técnico y sus multiplicidades contra el diagrama general; Usuario y su relación de responsabilidad histórica se explican como contexto.

Se revisaron permisos y caminos de CU15/CU18/CU19, historial e identidad condicionales de CU16, composición inicial obligatoria frente a multiplicidad estructural, conservación de stock en CU17 y selección AND de CU20 con opciones según rol. Los siete diagramas se analizaron y renderizaron con Mermaid 11.12.0 y se revisaron visualmente sus capturas: actores, Boundary y Control se disponen de izquierda a derecha, con entidades a la derecha y sin cajas solapadas. CU16/CU19 tienen mayor anchura por sus ramas de historial; sus SVG permiten ampliar la lectura sin perder detalle.

Se verificaron formato Markdown, tablas, enlaces y rutas de correspondencia. Los hashes SHA-256 de los 13 análisis académicos anteriores, sus 14 diagramas y los seis documentos fuente se conservaron; Git identifica únicamente este documento académico nuevo. La comprobación fue documental y visual, sin conexión a MySQL ni pruebas funcionales del backend.

**Avance al cierre de Fase 3:** veinte de los 33 CU implementados, con veintiún diagramas de los 34 previstos. La Fase 4 se incorpora a continuación por solicitud de continuidad del usuario, conservando la numeración oficial y el orden acordado.

## 7. Fase 4 — Compras

### 7.1. Condiciones compartidas, participantes y asociaciones

Se mantienen las convenciones BCE y un Control conceptual principal por CU. CU25 y CU27 requieren **Administrador**; CU26 permite **Administrador o Regente**. Todos requieren sesión válida y cuenta activa, con versión de credenciales vigente, y autorización del backend por operación.

Usuario se incorpora como entidad del objetivo porque la compra identifica registrador y anulador, y los movimientos identifican responsable. Sus atributos académicos seleccionados son ID y nombre público; el actor Administrador no es una subclase de Usuario. La autenticación transversal conserva la comprobación documentada sin añadir otro Control.

| Asociación persistente | Multiplicidades | Significado |
|---|---|---|
| Usuario — Compra, registrador | `1` — `0..*` | Cada compra tiene un registrador; una cuenta puede registrar varias compras. |
| Usuario — Compra, anulador | `0..1` — `0..*` | La anulación tiene un responsable distinto de la asociación de registro; inicialmente puede estar ausente. |
| ProveedorLaboratorio — Compra | `1` — `0..*` | La cabecera conserva el proveedor único derivado de los medicamentos recibidos. |
| Compra — DetalleCompra | `1` — `0..*` | Cada línea pertenece a una compra; el mínimo de una línea se exige al registrar, no por la FK. |
| ExistenciaMedicamento — DetalleCompra | `1` — `0..*` | Cada detalle identifica la existencia recibida. |
| DetalleCompra — MovimientoInventario | `0..1` — `0..*` | Un movimiento puede referir un detalle de compra; el esquema no limita a un solo movimiento por detalle. |
| MovimientoInventario — MovimientoInventario | `0..1` — `0..1` | Una reversión identifica un original; cada original admite como máximo una reversión. |
| Venta — DetalleVenta | `1` — `0..*` | Referencia de contexto que participa condicionalmente en integridad de CU27. |
| ExistenciaMedicamento — DetalleVenta | `1` — `0..*` | Permite comprobar la existencia de una referencia histórica de venta. |
| DetalleVenta — MovimientoInventario | `0..1` — `0..*` | Referencia opcional de venta utilizada en esa comprobación condicional. |

También se conservan Medicamento–ExistenciaMedicamento, ExistenciaMedicamento–MovimientoInventario y Usuario–MovimientoInventario con `1` — `0..*`; CU25 representa además ProveedorLaboratorio–Medicamento para derivar el proveedor. Los dibujos seleccionan las asociaciones del CU técnico, no todas las relaciones globales de cada modelo. No hay composición UML inferida de las FK o de RESTRICT.

**Mínimos funcionales:** una compra nueva exige al menos un detalle y crea exactamente un original de entrada por línea. Una anulación válida genera una reversión por original. Esos requisitos no convierten la multiplicidad estructural de detalles/movimientos en `1..*` o `1`. Un movimiento puede referir detalle de compra o de venta, nunca ambos; movimientos independientes pueden no referir ninguno.

**Importes y snapshots:** `DECIMAL_14_2` representa `DECIMAL(14,2)` para total/subtotales y `DECIMAL_14_6`, `DECIMAL(14,6)` para costos/promedios. Los valores monetarios de la API son cadenas, sin trasladar cálculos exactos a React. DetalleCompra conserva saldo/costo promedio anteriores por existencia; los históricos pueden tener ambos NULL. Las nuevas compras proporcionan el par completo, común a todas las líneas del grupo. Estos atributos persistentes no se exponen en el DTO público de consulta.

`ENUM_CONFIRMADA_ANULADA`, `ENUM_CONFIRMADA_ANULADA_PENDIENTE`, `ENUM_DIA_MES` y `ENUM_ENTRADA_SALIDA` abrevian los estados de Compra/Venta, la precisión de vencimiento y la dirección real del movimiento. La fecha de adquisición DATE se distingue de la hora civil de registro/movimientos en America/La_Paz; indicar adquisición anterior no genera movimientos retroactivos.

**Claves y respuestas inciertas:** la clave de operación es única globalmente y no se reutiliza tras anular. Un 409 por clave no acredita igualdad de solicitudes ni devuelve automáticamente la compra desde POST. CU26 permite buscar la clave únicamente entre operaciones del usuario autenticado, sin restringir el listado general ni la ficha por ID. La interfaz conserva clave/borrador y no reenvía automáticamente.

Las correspondencias remiten a compraController, compraValidator, compraService, compraRepository y los Repositories de existencias/movimientos del análisis técnico. El Control coordina esas responsabilidades de forma conceptual; no implica clases nuevas ni métodos de negocio en los modelos. El servicio HTTP es `frontend/src/features/compras/services/compra.service.js`. Referencias comunes: RF03/RF04/RF20–RF22; RN33–RN45/RN71–RN76/RN79/RN80.

### CU25 — Registrar compra

**Actor o actores:** Administrador autenticado.

**Objetivo:** registrar una adquisición con todas sus líneas y efectos de inventario de manera conjunta.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaRegistrarCompra | Boundary | Recoge clave, adquisición y líneas; permite revisar y confirmar la recepción. |
| ControlRegistrarCompra | Control | Valida la recepción y coordina importes, existencias, cabecera, detalles y entradas. |
| Compra | Entity | Conserva cabecera, clave, fechas, proveedor, responsable y total. |
| DetalleCompra | Entity | Conserva cada línea recibida, importes y estado anterior común del grupo. |
| Medicamento | Entity | Identifica productos existentes y activos de la recepción. |
| ProveedorLaboratorio | Entity | Permite derivar y comprobar el proveedor único y activo. |
| ExistenciaMedicamento | Entity | Representa saldo y promedio de la existencia nueva o reutilizada. |
| MovimientoInventario | Entity | Registra una entrada individual por detalle con trazabilidad. |
| Usuario | Entity | Identifica al registrador y responsable de las entradas mediante la sesión. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaRegistrarCompra {
        <<boundary>>
        -String claveOperacion
        -String fechaCompra
        -Lista detalles
        -Integer idMedicamento
        -Integer cantidad
        -String costoUnitario
        -String precisionVencimiento
        -String fechaVencimiento
        +agregarLinea()
        +quitarLinea()
        +revisarRecepcion()
        +confirmarRegistro()
    }
    class ControlRegistrarCompra {
        <<control>>
        +validarRecepcion()
        +comprobarClave()
        +validarMedicamentosYProveedor()
        +calcularImportes()
        +actualizarExistencias()
        +registrarCompraYEntradas()
        +consultarResultado()
    }
    class Compra {
        <<entity>>
        -INT id_compra
        -VARCHAR_64 clave_operacion
        -DATE fecha_compra
        -DATETIME fecha_registro
        -ENUM_CONFIRMADA_ANULADA estado_operacion
        -DECIMAL_14_2 total
    }
    class DetalleCompra {
        <<entity>>
        -INT id_detalle_compra
        -INT cantidad
        -DECIMAL_14_6 costo_unitario
        -DECIMAL_14_2 subtotal
        -INT saldo_anterior
        -DECIMAL_14_6 costo_promedio_anterior
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -BOOLEAN estado
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -BOOLEAN estado
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -DATE fecha_vencimiento
        -ENUM_DIA_MES precision_vencimiento
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -ENUM_ENTRADA_SALIDA direccion
        -INT cantidad
        -DATETIME fecha_movimiento
        -VARCHAR_40 motivo
        -DECIMAL_14_6 costo_unitario_aplicado
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
    }
    Administrador --> VistaRegistrarCompra
    VistaRegistrarCompra ..> ControlRegistrarCompra : solicita
    ControlRegistrarCompra ..> Compra : registra
    ControlRegistrarCompra ..> DetalleCompra : registra lineas
    ControlRegistrarCompra ..> Medicamento : valida
    ControlRegistrarCompra ..> ProveedorLaboratorio : deriva y valida
    ControlRegistrarCompra ..> ExistenciaMedicamento : crea o actualiza
    ControlRegistrarCompra ..> MovimientoInventario : registra entradas
    ControlRegistrarCompra ..> Usuario : responsable de sesion
    Usuario "1" -- "0..*" Compra : usuarioRegistrador
    Usuario "0..1" -- "0..*" Compra : usuarioAnulador
    ProveedorLaboratorio "1" -- "0..*" Compra : proveedorLaboratorio
    ProveedorLaboratorio "1" -- "0..*" Medicamento : proveedorLaboratorio
    Compra "1" -- "0..*" DetalleCompra : detallesCompra
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
    ExistenciaMedicamento "1" -- "0..*" DetalleCompra : existencia
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
    Usuario "1" -- "0..*" MovimientoInventario : usuario
    DetalleCompra "0..1" -- "0..*" MovimientoInventario : detalleCompra
```

**Descripción de relaciones:** la vista prepara líneas con medicamento, cantidad, costo y vencimiento; esos campos corresponden a una línea temporal de detalles, no a otra entidad. El Control deriva proveedor de los medicamentos y responsable de la sesión, sin aceptarlos como campos libres. Compra conserva cabecera y DetalleCompra cada línea, asociada a una existencia. Cada movimiento original de entrada referencia su detalle, existencia y responsable. El anulador es opcional y permanece ausente al registrar; incluir su asociación no atribuye una anulación a este CU.

La recepción agrupa cantidades/valor por medicamento–fecha almacenada–precisión para calcular saldo/promedio una vez por existencia, pero conserva cada detalle y movimiento individual, incluidas líneas repetidas. Los subtotales se redondean a dos decimales y el total suma esos subtotales. Los costos y promedio mantienen seis decimales. Todos los detalles del mismo grupo guardan el mismo estado previo a la compra completa; si la existencia es nueva, el par es 0/0.000000.

| Camino de existencia | Condición y efecto |
|---|---|
| Nueva | No existe la combinación medicamento–fecha–precisión; se crea con código generado a partir del máximo correlativo conservado más uno. |
| Existente | Se reutiliza la combinación, aunque tenga saldo cero, y se actualizan saldo/promedio agrupados. |

Una compra puede utilizar ambos caminos en distintos grupos. Se comprueban medicamentos/proveedor activos, proveedor único, fecha de adquisición no futura y recepción no vencida con el día comercial posterior a los bloqueos. MES se recibe como YYYY-MM y se normaliza al último día; DIA utiliza YYYY-MM-DD. La clave se normaliza a minúsculas y el UNIQUE protege las solicitudes concurrentes.

Cabecera, detalles, existencias, snapshots y entradas se confirman en una transacción o se revierten íntegramente. No se reciben total, subtotal, IDs/códigos de existencia, responsable, proveedor o snapshots desde React. Tampoco se crea composición ni se consulta el catálogo de principios.

**Correspondencia con la implementación:** `/compras/nueva`, `frontend/src/features/compras/pages/CompraFormPage.jsx`, `frontend/src/features/compras/components/CompraForm.jsx`, `CompraLinea.jsx` y revisión en Modal representan la vista. Proveedores/medicamentos preparatorios reutilizan CU11/CU15; la recuperación por clave reutiliza CU26.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarRecepcion | `compraController.createCompra`, `compraValidator.validateSinFiltros` y `validateCreate`; el Service comprueba fechas comerciales, vencimientos y límites. |
| comprobarClave | `compraRepository.findByClave` es comprobación previa auxiliar; el UNIQUE de clave es la barrera final y el conflicto se traduce mediante auxiliares del registro. |
| validarMedicamentosYProveedor | `compraService.createCompra` utiliza `medicamentoRepository.findById` con bloqueo y `findProveedorById` para productos/proveedor activos y proveedor único. |
| calcularImportes | Cálculos exactos del flujo `createCompra` y utilidades decimales calculan subtotales, total y promedio agrupado, sin métodos inventados de Compra. |
| actualizarExistencias | `existenciaMedicamentoRepository.findParaCompra` y, por grupo, `create` o `updateSaldoYCosto`; se conserva el snapshot común. |
| registrarCompraYEntradas | `compraRepository.create`/`createDetalle` y `movimientoInventarioRepository.create` registran cabecera, líneas y ENTRADA de motivo COMPRA en la misma operación. |
| consultarResultado | `compraService.getCompraById` y `compraRepository.findById` realizan lectura final dentro de la transacción, con datos públicos de responsables y asociaciones. |

`createCompra` del servicio HTTP usa `POST /api/compras`; responde 201 únicamente después del commit. Un error conserva clave/borrador; la interfaz impide duplicados y abre el detalle al éxito. Una clave existente produce 409 sin reproducir el POST; la consulta posterior vacía no prueba que una solicitud pendiente haya terminado. Referencias: RF20; RN10/RN14/RN29/RN33–RN45 y CU25.

### CU26 — Consultar compras

**Actor o actores:** Administrador o Regente autenticado.

**Objetivo:** consultar compras mediante filtros o ficha por ID, conservando los datos originales y la información de anulación.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarCompras | Boundary | Agrupa listado/filtros y ficha con líneas originales y responsables. |
| ControlConsultarCompras | Control | Valida la consulta y obtiene datos públicos según listado o detalle. |
| Compra | Entity | Aporta cabecera, clave, importes originales y datos de anulación. |
| ProveedorLaboratorio | Entity | Identifica al proveedor registrado en la cabecera. |
| Usuario | Entity | Identifica registrador/anulador y determina el filtro personal por clave. |
| DetalleCompra | Entity | Aporta líneas originales únicamente en la ficha. |
| ExistenciaMedicamento | Entity | Identifica las existencias recibidas únicamente en la ficha. |
| Medicamento | Entity | Aporta identificación actual del producto a través de existencia, solo en ficha. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class VistaConsultarCompras {
        <<boundary>>
        -String desde
        -String hasta
        -Integer idProveedorLaboratorio
        -String estadoOperacion
        -String claveOperacion
        -Integer idCompra
        -Lista compras
        +aplicarFiltros()
        +solicitarListado()
        +solicitarFicha()
    }
    class ControlConsultarCompras {
        <<control>>
        +validarConsulta()
        +consultarListado()
        +consultarDetalle()
        +prepararDatosPublicos()
    }
    class Compra {
        <<entity>>
        -INT id_compra
        -VARCHAR_64 clave_operacion
        -DATE fecha_compra
        -DATETIME fecha_registro
        -ENUM_CONFIRMADA_ANULADA estado_operacion
        -DECIMAL_14_2 total
        -DATETIME fecha_anulacion
        -VARCHAR_255 motivo_anulacion
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
    }
    class DetalleCompra {
        <<entity>>
        -INT id_detalle_compra
        -INT cantidad
        -DECIMAL_14_6 costo_unitario
        -DECIMAL_14_2 subtotal
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -DATE fecha_vencimiento
        -ENUM_DIA_MES precision_vencimiento
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_150 presentacion
        -BOOLEAN estado
    }
    Administrador --> VistaConsultarCompras
    Regente --> VistaConsultarCompras
    VistaConsultarCompras ..> ControlConsultarCompras : solicita
    ControlConsultarCompras ..> Compra : consulta
    ControlConsultarCompras ..> ProveedorLaboratorio : proveedor registrado
    ControlConsultarCompras ..> Usuario : responsables y clave propia
    ControlConsultarCompras ..> DetalleCompra : solo ficha
    ControlConsultarCompras ..> ExistenciaMedicamento : solo ficha
    ControlConsultarCompras ..> Medicamento : solo ficha
    Usuario "1" -- "0..*" Compra : usuarioRegistrador
    Usuario "0..1" -- "0..*" Compra : usuarioAnulador
    ProveedorLaboratorio "1" -- "0..*" Compra : proveedorLaboratorio
    Compra "1" -- "0..*" DetalleCompra : detallesCompra
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
    ExistenciaMedicamento "1" -- "0..*" DetalleCompra : existencia
```

**Descripción de relaciones:** la vista conceptual reúne listado y ficha. Compra, proveedor y responsables participan en ambos caminos; detalles, existencias y medicamentos solo en la ficha. La relación de proveedor parte de la cabecera histórica, no se deriva nuevamente del catálogo actual. No se consulta MovimientoInventario ni se calculan saldos en este CU.

| Camino | Responsabilidades y condiciones |
|---|---|
| Listado general | Valida fechas inclusivas sobre adquisición, proveedor y estado; puede consultar operaciones de otros registradores. Orden por fecha de adquisición e ID descendentes. |
| Listado por clave | Usa el mismo listado filtrado, pero agrega ID de usuario desde sesión; clave ajena o sin coincidencia devuelve []. No recibe un usuario elegido por el cliente. |
| Ficha por ID | Valida ID y query vacío; obtiene todas las líneas por ID ascendente. No aplica el filtro personal de clave; compra inexistente produce 404. |

Una compra anulada conserva líneas, importes, clave y datos de anulación. Las líneas repetidas no se agrupan y los importes no se recalculan. Nombres/presentación/estados del catálogo son actuales; no hay snapshots de esos textos. El DTO no expone los snapshots B1, stock físico actual ni promedio de la existencia, por lo que no se incorporan como datos mostrados en este dibujo. Consultar por período no implementa el reporte futuro CU39.

**Correspondencia con la implementación:** `/compras`, `frontend/src/features/compras/pages/ComprasPage.jsx`, `frontend/src/features/compras/components/CompraFilters.jsx` y `CompraTable.jsx` representan listado/filtros; `/compras/:idCompra`, `frontend/src/features/compras/pages/CompraDetailPage.jsx` y `CompraDetallesTable.jsx`, la ficha. La búsqueda automática utiliza useConsultaAutomatica, con espera de 300 ms para texto y controles de aplicación inmediata; conserva filtros aplicados en URL y al volver del detalle. La carga de proveedores reutiliza CU11, incluidos inactivos.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarConsulta | `compraController` utiliza `compraValidator.validateFiltros` en listado o `validateId`/`validateSinFiltros` en ficha. |
| consultarListado | `compraService.getCompras` utiliza `compraRepository.findAll`; si hay clave añade el ID autenticado. No ejecuta findByClave. |
| consultarDetalle | `compraService.getCompraById` y `compraRepository.findById` cargan cabecera y líneas con asociaciones, sin los Repositories de Inventario. |
| prepararDatosPublicos | Auxiliares externos `toPublicCompra`, `toPublicDetalle` y `toPublicUsuario` conservan importes y presentan fechas civiles y datos públicos. |

Las funciones HTTP `getCompras` y `getCompra` usan `GET /api/compras` y `GET /api/compras/:idCompra`; resultado 200 sin escrituras. Se manejan carga, vacío y errores de filtros, sesión/permisos o inexistencia. Los enlaces de inventario/historial invocan sus CU correspondientes. Referencias: RF21; RN33–RN40/RN75 y CU26.

### CU27 — Anular compra

**Actor o actores:** Administrador autenticado; puede anular una compra de otro registrador.

**Objetivo:** compensar íntegramente una compra mediante reversión, conservando sus originales e historial.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaAnularCompra | Boundary | Recoge motivo obligatorio y permite revisar/confirmar la anulación completa. |
| ControlAnularCompra | Control | Valida estado/integridad, calcula compensación y coordina actualización, reversiones y anulación. |
| Compra | Entity | Conserva operación original y registra estado, fecha, motivo y anulador. |
| DetalleCompra | Entity | Aporta cantidades/costos originales y snapshots del estado anterior. |
| ExistenciaMedicamento | Entity | Aporta saldo/promedio actual y recibe el estado compensado. |
| MovimientoInventario | Entity | Aporta historial/originales y conserva nuevas reversiones ligadas a ellos. |
| Usuario | Entity | Identifica registrador, anulador y responsable de reversiones. |
| Medicamento | Entity | Identifica productos incluidos en la lectura final, sin modificar el catálogo. |
| ProveedorLaboratorio | Entity | Identifica proveedor registrado en la lectura final, sin exigir actividad actual. |
| Venta | Entity | Aporta estado de referencias históricas de venta solo cuando integridad lo necesita. |
| DetalleVenta | Entity | Identifica referencias de venta/existencia en esa comprobación condicional. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaAnularCompra {
        <<boundary>>
        -Integer idCompra
        -String motivo
        +revisarAnulacion()
        +confirmarAnulacion()
    }
    class ControlAnularCompra {
        <<control>>
        +validarAnulacion()
        +comprobarIntegridad()
        +calcularCompensacion()
        +actualizarExistencias()
        +registrarReversiones()
        +marcarCompraAnulada()
        +consultarResultado()
    }
    class Venta {
        <<entity>>
        -INT id_venta
        -ENUM_CONFIRMADA_ANULADA_PENDIENTE estado_operacion
    }
    class DetalleVenta {
        <<entity>>
        -INT id_detalle_venta
        -INT id_venta
        -INT id_existencia
    }
    class Compra {
        <<entity>>
        -INT id_compra
        -VARCHAR_64 clave_operacion
        -DATE fecha_compra
        -DATETIME fecha_registro
        -ENUM_CONFIRMADA_ANULADA estado_operacion
        -DECIMAL_14_2 total
        -DATETIME fecha_anulacion
        -VARCHAR_255 motivo_anulacion
    }
    class DetalleCompra {
        <<entity>>
        -INT id_detalle_compra
        -INT cantidad
        -DECIMAL_14_6 costo_unitario
        -DECIMAL_14_2 subtotal
        -INT saldo_anterior
        -DECIMAL_14_6 costo_promedio_anterior
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -INT id_movimiento_original
        -INT id_detalle_compra
        -ENUM_ENTRADA_SALIDA direccion
        -INT cantidad
        -DECIMAL_14_6 costo_unitario_aplicado
        -DATETIME fecha_movimiento
        -VARCHAR_40 motivo
        -VARCHAR_500 observacion
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
    }
    Administrador --> VistaAnularCompra
    VistaAnularCompra ..> ControlAnularCompra : solicita
    ControlAnularCompra ..> Compra : valida y anula
    ControlAnularCompra ..> ExistenciaMedicamento : compensa
    ControlAnularCompra ..> MovimientoInventario : historial y reversiones
    ControlAnularCompra ..> Usuario : responsables
    ControlAnularCompra ..> Medicamento : lectura final
    ControlAnularCompra ..> ProveedorLaboratorio : lectura final
    Usuario "1" -- "0..*" Compra : usuarioRegistrador
    Usuario "0..1" -- "0..*" Compra : usuarioAnulador
    ProveedorLaboratorio "1" -- "0..*" Compra : proveedorLaboratorio
    Compra "1" -- "0..*" DetalleCompra : detallesCompra
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
    ExistenciaMedicamento "1" -- "0..*" DetalleCompra : existencia
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
    Usuario "1" -- "0..*" MovimientoInventario : usuario
    DetalleCompra "0..1" -- "0..*" MovimientoInventario : detalleCompra
    MovimientoInventario "0..1" -- "0..1" MovimientoInventario : movimientoOriginal
    DetalleVenta "0..*" -- "1" Venta : venta
    ExistenciaMedicamento "1" -- "0..*" DetalleVenta : existencia
    DetalleVenta "0..1" -- "0..*" MovimientoInventario : detalleVenta
```

**Descripción de relaciones:** el Control usa Compra y sus líneas para validar y compensar la operación completa, no una selección de detalles. ExistenciaMedicamento aporta el estado actual y MovimientoInventario el historial, originales y reversiones; la asociación reflexiva conserva el vínculo y la reversión única. Usuario representa responsabilidades distintas: el anulador puede no ser el registrador. Medicamento/proveedor participan en la respuesta final, sin validación de actividad ni cambios de catálogo. Para facilitar la lectura, DetalleCompra, DetalleVenta y Venta se vinculan por sus asociaciones de dominio sin repetir todas las dependencias del Control; sus responsabilidades se conservan en las tablas. Las asociaciones no representan un orden de ejecución.

Venta y DetalleVenta se leen únicamente si el historial contiene referencias de compensaciones de venta que requieren comprobar existencia, pertenencia y estado. El método de lectura de referencias se invoca aunque no haya IDs, pero consulta esos modelos solo con listas no vacías. No se escribe una venta ni se implementa CU30; Receta no participa.

La compra debe existir, estar CONFIRMADA y no tener datos previos de anulación. Se bloquean cabecera/detalles y existencias por ID; se comprueban saldo conciliado, referencias íntegras y exactamente un original de entrada por detalle, con igual existencia/cantidad/costo. Se rechazan snapshots parciales/contradictorios, intercalaciones o reversiones incompatibles. Todos los grupos se validan antes de escribir.

| Valoración por existencia | Condiciones y efecto |
|---|---|
| B1: sin posteriores ajenos | Exige snapshots completos e iguales y estado actual igual al resultado agrupado esperado; restaura exactamente saldo/promedio anteriores una vez por existencia. Sin estado anterior disponible, rechaza el legado. |
| A: con posteriores ajenos | Resta cantidad y valor originales desde saldo/promedio actuales; calcula promedio residual a seis decimales. Rechaza saldo o residual negativos, promedio fuera de rango y residual no cero a saldo cero; con ambos cero conserva promedio actual. |

La decisión es del backend, no de la vista. A puede aceptar históricos con ambos snapshots NULL si el historial es íntegro, pero no elude inconsistencias. Los posteriores se identifican en la misma existencia excluyendo los originales de esta compra; se usa el orden por ID dentro del protocolo de bloqueo, no como garantía global de orden de commits. La valoración utiliza costos de seis decimales, no subtotales monetarios redondeados.

Se actualiza una vez el saldo/promedio de cada existencia y se crea una SALIDA ANULACION_COMPRA por original, conservando cantidad/costo/existencia y referencias al original y detalle. Su observación conserva el motivo. Compra se marca ANULADA con fecha/motivo/anulador; todas las reversiones y la cabecera comparten el instante comercial posterior a los bloqueos. El literal histórico Reversión sigue siendo reconocido al consultar/validar; no es el motivo de nuevas escrituras del flujo vigente.

La transacción conserva detalles, snapshots, originales, total, adquisición, clave y códigos. Un fallo revierte toda la operación; bloqueo de cabecera y UNIQUE del original impiden dos anulaciones efectivas. Actividad actual o vencimiento no impiden compensar una compra histórica; saldo suficiente por sí solo no garantiza valoración válida.

**Correspondencia con la implementación:** `/compras/:idCompra`, CompraDetailPage, `frontend/src/features/compras/components/CompraAnularForm.jsx` y revisión en Modal representan la vista. CU26 carga/reconsulta la ficha; solo Administrador ve el formulario para una compra confirmada. El body contiene exclusivamente motivo obligatorio de 1–255 caracteres tras trim; no recibe modalidad, fecha, usuario, líneas ni precondiciones de ajustes/retiros.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarAnulacion | `compraController.anularCompra`, `compraValidator.validateId`/`validateSinFiltros`/`validateAnular`, responsable de sesión y `compraRepository.findParaAnular`/`findDetallesParaAnular` comprueban solicitud y estado bajo bloqueo. |
| comprobarIntegridad | `existenciaMedicamentoRepository.findByIdParaAnular` y `movimientoInventarioRepository.findParaAnular`/`findReferenciasParaAnular`/`findReversiones`, con auxiliares de integridad del flujo. |
| calcularCompensacion | Función externa `calcularCompensacion` en compra.service.js determina B1/A y valores exactos por grupo; no es un método técnico de compraService ni de una entidad. |
| actualizarExistencias | `existenciaMedicamentoRepository.updateSaldoYCosto` escribe el par compensado una vez por existencia dentro de la transacción. |
| registrarReversiones | `movimientoInventarioRepository.create` inserta una reversión por original con motivo ANULACION_COMPRA, dirección SALIDA y responsable autenticado. |
| marcarCompraAnulada | `compraRepository.anular` registra estado, instante, motivo y anulador sin eliminar la compra. |
| consultarResultado | `compraService.getCompraById` y `compraRepository.findById` obtienen el DTO dentro de la misma transacción; no invocan el Controller de consulta. |

El servicio HTTP `anularCompra` usa `POST /api/compras/:idCompra/anular`; resultado 200 después del commit. Entrada inválida produce 400, inexistencia 404 y estado/integridad/stock/valoración/contención 409, además de sesión/permisos y fallos inesperados. El éxito reemplaza la ficha y retira el formulario sin GET inmediato. Ante 400 conserva motivo; 404/409/red/500 exigen actualizar antes de otro envío, y 401/403 bloquean escritura. La respuesta perdida se recupera mediante CU26; no se reintenta automáticamente y repetir una anulación confirmada devuelve 409. Referencias: RF22; RN30/RN71–RN76/RN79/RN80 y CU27.

## 8. Cierre y revisión de la cuarta entrega

| Caso de uso | Diagramas | Aspecto principal de revisión |
|---|---|---|
| CU25 — Registrar compra | 1 | Recepción integral, proveedor derivado, existencias nuevas/reutilizadas, importes agrupados y snapshots. |
| CU26 — Consultar compras | 1 | Listado/ficha, clave propia frente a consulta general e importes originales. |
| CU27 — Anular compra | 1 | Integridad, B1/A por existencia, reversión única y conservación histórica. |
| **Total de Fase 4** | **3** | **Tres CU, numeración única CU25–CU27.** |

**Criterio de comprobación:** cada dibujo utiliza un Boundary y un Control conceptual, con responsabilidades respaldadas por la implementación documentada. Se verifican atributos relevantes, referencias y multiplicidades persistentes, diferenciando mínimos exigidos por el flujo. Usuario participa por responsabilidad de dominio; Venta/DetalleVenta solo como lectura condicional de integridad. Las entidades no declaran métodos de Service ni se agregan clases de inventario, anulación o reversión persistente separadas.

**Validación de esta entrega:** se comprobaron nombres/números CU25–CU27 contra el catálogo oficial y la estructura completa de los tres análisis. Los dibujos contienen tres Boundary y tres Control, con 18 operaciones conceptuales respaldadas. Se contrastaron nueve entidades reales —Compra, DetalleCompra, Medicamento, ProveedorLaboratorio, ExistenciaMedicamento, MovimientoInventario, Usuario, Venta y DetalleVenta— y 97 apariciones de atributos seleccionados con sus tipos del modelo general. Las 29 apariciones de asociaciones conservan extremos, multiplicidades y significado del CU técnico, incluidas FK opcionales y relación reflexiva de reversión. La asociación DetalleVenta–Venta se presenta con extremos invertidos para favorecer el trazado, sin cambiar su multiplicidad.

Se revisaron permisos, caminos de existencia nueva/reutilizada, listado/ficha y clave propia, snapshots y valoración B1/A, conservación histórica y referencias de venta condicionales. Ante la diferencia de literal entre una descripción histórica del contexto y el análisis técnico vigente, se comprobó en compra.service.js que las nuevas reversiones usan ANULACION_COMPRA; Reversión es reconocido como literal histórico. No se modificó ninguna fuente.

Los tres diagramas se analizaron y renderizaron con Mermaid 11.12.0 y se revisaron sus capturas visualmente. Se comprobó disposición actor → Boundary → Control de izquierda a derecha y entidades a la derecha, sin cajas solapadas. Los dibujos de registro/anulación son más anchos por las asociaciones de trazabilidad y sus SVG permiten ampliar atributos y multiplicidades; el trazado de las relaciones no expresa secuencia temporal. Se verificaron formato Markdown, tablas, enlaces y rutas de correspondencia. Los hashes SHA-256 de los 20 análisis académicos anteriores, sus 21 diagramas y los seis documentos fuente se conservaron; Git identifica únicamente este documento académico nuevo. La comprobación fue documental y visual, sin conexión a MySQL ni pruebas funcionales del backend.

**Avance al cierre de Fase 4:** veintitrés de los 33 CU implementados, con veinticuatro diagramas de los 34 previstos. La Fase 5 se incorpora a continuación por solicitud de continuidad del usuario, conservando la numeración oficial y el orden acordado.

## 9. Fase 5 — Inventario, Ajustes, Movimientos y Stock bajo

### 9.1. Condiciones compartidas, estado y asociaciones

Cada CU mantiene una Vista y un Control conceptuales. CU21, CU22 y CU37 permiten **Administrador, Regente o Vendedor**; CU24 y CU40, **Administrador o Regente**; CU23, únicamente **Regente**. No existe herencia de permisos del Regente hacia Administrador. Todos requieren sesión válida, cuenta activa y versión de credenciales vigente, con autorización definitiva del backend. Usuario aparece en CU23 por responsabilidad del ajuste y en CU24/CU40 por identificación del responsable; en las demás consultas su uso es transversal y no se repite en el dibujo.

**Fuentes:** Fase 5 del análisis técnico y sección 5 del diagrama general, contrastadas con CU21–CU24/CU37/CU40, RF15/RF17–RF19/RF29/RF34/RF37/RF39 y RN18/RN24/RN26–RN32/RN64–RN74/RN81–RN84/RN93/RN96/RN100/RN102–RN104. Las correspondencias de inventarioController, inventarioValidator e inventarioService remiten a `backend/src/presentation/controllers/`, `backend/src/business/validators/` y `backend/src/business/services/`; los Repositories, a `backend/src/data/repositories/`.

| Asociación persistente | Multiplicidades | Participación en esta fase |
|---|---|---|
| Medicamento — ExistenciaMedicamento | `1` — `0..*` | Producto del catálogo y existencias concretas; CU21 exige al menos una en el resultado, no en toda la persistencia. |
| ExistenciaMedicamento — MovimientoInventario | `1` — `0..*` | Marcador de CU22, comprobación/escritura de CU23 y hechos históricos de CU24/CU40. |
| Usuario — MovimientoInventario | `1` — `0..*` | Responsable autenticado del ajuste o responsable público consultado en historial. |
| DetalleCompra — MovimientoInventario | `0..1` — `0..*` | Identificación opcional de origen por detalle en CU24/CU40. |
| DetalleVenta — MovimientoInventario | `0..1` — `0..*` | Identificación opcional de origen por detalle en CU24/CU40, sin completar Ventas. |
| MovimientoInventario — MovimientoInventario | `0..1` — `0..1` | Original y reversión única consultados en CU24/CU40. |

Se muestran las asociaciones seleccionadas en cada CU técnico. Medicamento–Existencia permanece como contexto del dominio en CU23: el POST no consulta Medicamento y la preparación reutiliza CU22/CU15. Usuario–Movimiento en CU22 es contexto histórico, sin consulta al responsable. Las cabeceras Compra/Venta y Receta no se cargan en CU24/CU40; sus FK en los detalles no justifican agregarlas al dibujo. No se infiere composición UML ni se crea entidad Inventario, Ajuste, Conteo, Alerta o Reporte.

| Información | Naturaleza y uso |
|---|---|
| cantidad_fisica, costo_unitario_promedio | Saldo y promedio persistidos en ExistenciaMedicamento. |
| stockFisico | Proyección del saldo por existencia o suma por medicamento. |
| stockVendible | Calculado por backend según actividad del producto y vencimiento; cero para inactivos/vencidos. |
| fechaEfectivaVencimiento, vencida | Resultados calculados; no columnas nuevas. |
| ultimoMovimiento | Mayor ID por existencia o null; CU22 lo consulta junto con el saldo en una sentencia. |
| stockObservado, ultimoMovimientoObservado | Precondiciones temporales tomadas de CU22 y revalidadas bajo bloqueo en CU23. |
| saldoContado, diferencia, ajusteRealizado | Entrada/resultado de conciliación; no entidades ni auditoría persistida independiente. |
| data, meta | Respuesta de disponibilidad con fecha comercial y zona horaria; no modelos del dominio. |

`ENUM_DIA_MES` y `ENUM_ENTRADA_SALIDA` conservan valores reales de precisión y dirección; `DECIMAL_14_6` conserva DECIMAL(14,6). Los costos se reciben/presentan como cadenas de seis decimales. DIA deja de ser vendible al inicio de su fecha comercial; MES, desde el primer día del mes siguiente. Se utiliza una fecha comercial común America/La_Paz por consulta, sin cambiar fechas históricas ni convertir DATETIME históricos a UTC. React muestra los valores calculados por API, no decide vendibilidad ni valoración.

**Interfaz común:** las funciones HTTP están en `frontend/src/features/inventario/services/inventario.service.js` y usan la configuración Axios con cookies. Las consultas reutilizan useConsultaAutomatica/useConsulta, filtros en URL y estados de carga/vacío/error; las búsquedas textuales esperan 300 ms y los controles inmediatos siguen su configuración. Las respuestas tardías se descartan y los resultados anteriores no se presentan como actuales durante carga. El Control académico reúne coordinación, validación y acceso a datos sin representar una clase JavaScript adicional.

### CU21 — Consultar inventario

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** consultar disponibilidad física y vendible de medicamentos con existencias registradas.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarInventario | Boundary | Recoge filtros y muestra productos, existencias y cantidades diferenciadas. |
| ControlConsultarInventario | Control | Valida filtros, consulta productos con existencias y prepara disponibilidad. |
| Medicamento | Entity | Aporta identidad, unidad, actividad y mínimo del producto. |
| ExistenciaMedicamento | Entity | Aporta vencimiento, precisión, saldo físico y promedio por existencia. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaConsultarInventario {
        <<boundary>>
        -Integer idMedicamento
        -String codigoMedicamento
        -String nombreComercial
        -Lista medicamentos
        +aplicarFiltros()
        +actualizarConsulta()
    }
    class ControlConsultarInventario {
        <<control>>
        +validarFiltros()
        +consultarProductosConExistencias()
        +prepararDisponibilidad()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_50 unidad_inventario
        -INT stock_minimo
        -BOOLEAN estado
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -DATE fecha_vencimiento
        -ENUM_DIA_MES precision_vencimiento
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    Administrador --> VistaConsultarInventario
    Regente --> VistaConsultarInventario
    Vendedor --> VistaConsultarInventario
    VistaConsultarInventario ..> ControlConsultarInventario : solicita
    ControlConsultarInventario ..> Medicamento : consulta identidad y estado
    ControlConsultarInventario ..> ExistenciaMedicamento : calcula disponibilidad
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
```

**Descripción de relaciones:** el Control consulta Medicamento con sus existencias obligatorias en este resultado; la multiplicidad global sigue siendo cero o muchas. Una existencia agotada, vencida o de producto inactivo basta para incluir el producto. No exige compras ni movimientos, por lo que también admite existencias iniciales/históricas sin esas referencias. Crear solo un producto de catálogo no lo incorpora a Inventario.

La cantidad física se conserva aunque esté vencida; la vendible es cero si producto inactivo o existencia vencida. Se suman ambas por producto sin mezclar sus significados. Cada existencia conserva código, fecha, precisión y promedio; la fecha efectiva y condición de vencida se calculan. Se ordenan productos por ID y existencias por vencimiento efectivo/ID. No se consulta MovimientoInventario ni se aporta ultimoMovimiento: preparar un ajuste exige CU22.

**Correspondencia con la implementación:** `/inventario`, `frontend/src/features/inventario/pages/InventarioPage.jsx` en vista inventario, `frontend/src/features/inventario/components/InventarioFilters.jsx` e `InventarioTable.jsx` representan la vista. ConsultaMeta/ConsultaResultado presentan disponibilidad y estados de consulta; enlaces de producto conducen a CU22.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarFiltros | `inventarioController.getInventario` y `inventarioValidator.validateFiltrosInventario` validan query estricto: ID entero positivo, código de 1–20 y nombre de 1–150 tras trim, todos opcionales/combinables. |
| consultarProductosConExistencias | `inventarioService.getInventario` usa el auxiliar externo `consultarDisponibilidad`; `existenciaMedicamentoRepository.findInventario` recibe `{ soloConExistencias: true }` y aplica include obligatorio. |
| prepararDisponibilidad | Auxiliares externos de disponibilidad y utilidades de vencimiento preparan DTO físico/vendible, existencias, sumas y metadatos comunes, sin método agregado a Medicamento. |

`getInventario` HTTP usa `GET /api/inventario` y devuelve 200 `{ data, meta }`. Código/nombre son coincidencias parciales LIKE con metacaracteres escapados; ID es exacto. Filtro sin resultados, ID inexistente o producto sin existencias devuelve lista vacía, no 404. Query inválido produce 400; sesión/permisos, 401/403; fallo inesperado, 500. No modifica saldos ni ejecuta getExistencias/getMovimientos. Referencias: RF15/RF17/RF18; RN18/RN24/RN27–RN29 y CU21.

### CU22 — Consultar existencias de un medicamento

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** consultar existencias, disponibilidad y marcador coherente de movimientos de un producto.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarExistencias | Boundary | Muestra identidad del producto y existencias, también cuando la lista está vacía. |
| ControlConsultarExistencias | Control | Valida producto, obtiene sus existencias/marcador y prepara disponibilidad. |
| Medicamento | Entity | Identifica el producto y su actividad; existe aun sin existencias. |
| ExistenciaMedicamento | Entity | Aporta saldo, promedio, código y vencimiento de cada agrupación. |
| MovimientoInventario | Entity | Aporta exclusivamente el máximo ID por existencia mediante consulta SQL. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaConsultarExistencias {
        <<boundary>>
        -Integer idMedicamento
        -Lista existencias
        +solicitarExistencias()
        +actualizarConsulta()
    }
    class ControlConsultarExistencias {
        <<control>>
        +validarConsulta()
        +consultarProductoYExistencias()
        +obtenerMarcadorConSaldo()
        +prepararDisponibilidad()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_50 unidad_inventario
        -BOOLEAN estado
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -DATE fecha_vencimiento
        -ENUM_DIA_MES precision_vencimiento
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
    }
    Administrador --> VistaConsultarExistencias
    Regente --> VistaConsultarExistencias
    Vendedor --> VistaConsultarExistencias
    VistaConsultarExistencias ..> ControlConsultarExistencias : solicita
    ControlConsultarExistencias ..> Medicamento : comprueba producto
    ControlConsultarExistencias ..> ExistenciaMedicamento : consulta saldos y vencimientos
    ControlConsultarExistencias ..> MovimientoInventario : solo MAX por existencia
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
```

**Descripción de relaciones:** el producto puede tener cero o varias existencias y cada una, cero o varios movimientos. El máximo ID se obtiene en SQL junto con el saldo, no mediante una segunda consulta HTTP o carga completa del historial. Sin movimientos el marcador es null, nunca cero; ultimoMovimiento es una proyección calculada, no atributo persistente de existencia ni garantía de idempotencia.

No se exige saldo positivo, actividad, compra o movimiento para incluir una existencia. Se prepara físico/vendible, fecha almacenada, precisión, vencida, fecha efectiva y promedio, ordenados por vencimiento efectivo/ID, con meta comercial común. Un producto existente sin existencias mantiene identidad y enlaces; producto inexistente produce 404.

**Correspondencia con la implementación:** `/inventario/medicamentos/:idMedicamento/existencias`, `frontend/src/features/inventario/pages/ExistenciasPage.jsx` y `frontend/src/features/inventario/components/ExistenciasTable.jsx` representan la vista. `getExistenciasMedicamento` HTTP consulta en paralelo este endpoint y la ficha CU15 del catálogo. CU15 aporta identidad visible, incluso ante lista vacía; no se atribuye esa llamada de apoyo a inventarioService. Historial se enlaza solo para Administrador/Regente; ajuste/retiro, solo para Regente.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarConsulta | `inventarioController.getExistencias` utiliza `inventarioValidator.validateId` y `validateSinFiltros`: ID positivo dentro de INT y query vacío. |
| consultarProductoYExistencias | `inventarioService.getExistencias` y `existenciaMedicamentoRepository.findMedicamentoConExistencias` realizan findByPk del producto con include opcional de existencias. |
| obtenerMarcadorConSaldo | La misma sentencia de `findMedicamentoConExistencias` contiene MAX correlacionado de id_movimiento por existencia; no llama a movimientoInventarioRepository. |
| prepararDisponibilidad | Auxiliar externo `toPublicExistencias` y utilidades de vencimiento presentan disponibilidad, marcador y costos de seis decimales, con fecha comercial del Service. |

`GET /api/inventario/medicamentos/:idMedicamento/existencias` devuelve 200 `{ data: existencias, meta }`, incluida lista vacía. ID/query inválido produce 400; medicamento inexistente, 404; sesión/permisos, 401/403; fallo inesperado, 500. El Regente vuelve a consultar este CU al preparar ajuste/retiro, sin reutilizar el marcador antiguo de la tabla. `findUltimoIdParaExistencia` se reserva para comprobación bloqueante de escritura, no esta lectura. Referencias: RF15/RF17/RF18; RN18/RN24/RN27–RN29/RN103 y CU22.

### CU23 — Registrar ajuste de inventario

**Actor o actores:** Regente autenticado.

**Objetivo:** conciliar un conteo físico con el saldo registrado, dejando movimiento solo si hay diferencia.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaRegistrarAjuste | Boundary | Recoge conteo, observación y costo de entrada, y conserva el par observado para revisión. |
| ControlRegistrarAjuste | Control | Comprueba precondiciones bajo bloqueo, calcula diferencia/valoración y confirma efectos atómicos. |
| ExistenciaMedicamento | Entity | Aporta saldo/promedio actual y recibe valores conciliados si corresponde. |
| MovimientoInventario | Entity | Aporta marcador actual y registra entrada o salida independiente de ajuste. |
| Usuario | Entity | Identifica al responsable del ajuste desde la sesión autenticada. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Regente { <<actor>> }
    class VistaRegistrarAjuste {
        <<boundary>>
        -Integer idExistencia
        -Integer saldoContado
        -Integer stockObservado
        -Integer ultimoMovimientoObservado
        -String observacion
        -String costoUnitario
        +revisarConteo()
        +confirmarAjuste()
    }
    class ControlRegistrarAjuste {
        <<control>>
        +validarSolicitud()
        +comprobarParObservado()
        +calcularDiferenciaYValoracion()
        +actualizarExistencia()
        +registrarMovimiento()
        +prepararResultado()
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -ENUM_ENTRADA_SALIDA direccion
        -INT cantidad
        -DECIMAL_14_6 costo_unitario_aplicado
        -DATETIME fecha_movimiento
        -VARCHAR_40 motivo
        -VARCHAR_500 observacion
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
    }
    Regente --> VistaRegistrarAjuste
    VistaRegistrarAjuste ..> ControlRegistrarAjuste : solicita
    ControlRegistrarAjuste ..> ExistenciaMedicamento : bloquea y concilia
    ControlRegistrarAjuste ..> MovimientoInventario : marcador y escritura condicional
    ControlRegistrarAjuste ..> Usuario : responsable autenticado
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
    Usuario "1" -- "0..*" MovimientoInventario : usuario
```

**Descripción de relaciones:** el Control toma el responsable de sesión, bloquea la existencia y lee actualmente su último movimiento. Compara saldo y marcador con el par preparado antes de calcular diferencia, incluso si el conteo coincide. Que el saldo vuelva al valor anterior no elimina el conflicto si cambió el historial. El marcador observado admite null solo si CU22 informó explícitamente ausencia de movimientos; un campo ausente/incorrecto no se convierte en null.

Usuario representa responsabilidad de dominio; su nombre público corresponde al resultado del movimiento y no implica otro mantenimiento de cuentas. Medicamento no se consulta en este POST: la identificación/pertenencia preparatorias reutilizan CU22/CU15. Actividad/vencimiento no son condiciones para contar una existencia registrada; agotadas, vencidas o de productos inactivos son válidas, sin crear existencias ni reactivar producto o modificar fechas.

| Camino | Valoración y efecto |
|---|---|
| Entrada | Diferencia positiva; exige costo unitario positivo y calcula promedio ponderado exacto, con un redondeo a seis decimales y empate hacia arriba. Saldo anterior cero no aporta valor del promedio histórico. |
| Salida | Diferencia negativa; cantidad positiva igual a su valor absoluto. Aplica y conserva promedio vigente, admitido cero, incluso al agotar; el cliente no proporciona costo alternativo. |
| Sin diferencia | Comprueba igualmente precondiciones, integridad y observación, pero no modifica saldo/promedio ni registra movimiento u otra auditoría; no persiste observación. |

La dirección, cantidad, diferencia, motivo y valoración son decisiones del backend. Con diferencia se confirma saldo contado, promedio aplicable y un movimiento AJUSTE conjuntamente; referencia a detalle de compra, detalle de venta y original quedan NULL. Fecha/hora comercial se toma después de los bloqueos y responsable procede de sesión. Todo fallo revierte los efectos y nunca deja saldo negativo. El ajuste efectivo puede ser posterior para CU27; sin diferencia no agrega posteriores. Un daño/vencimiento identificado corresponde al retiro CU36/CU35, no a este ajuste ni a una pérdida genérica.

**Correspondencia con la implementación:** `/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/ajuste`, `frontend/src/features/inventario/pages/AjusteFormPage.jsx`, `frontend/src/features/inventario/components/AjusteForm.jsx`, revisión en Modal y AjusteResultado representan la vista. `frontend/src/features/inventario/utils/consultaExistencia.js` vuelve a consultar CU22/CU15 y valida IDs/pertenencia y par fresco antes de habilitar preparación.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarSolicitud | `inventarioController.registrarAjuste`, `inventarioValidator.validateSinFiltros` y `validateAjuste` validan query vacío/body estricto y coherencia de costo según conteo observado. |
| comprobarParObservado | `inventarioService.registrarAjuste` usa `existenciaMedicamentoRepository.findByIdParaMovimiento` y `movimientoInventarioRepository.findUltimoIdParaExistencia` bajo bloqueo; compara ambos valores antes de diferencia. |
| calcularDiferenciaYValoracion | El flujo `registrarAjuste` y utilidades decimales calculan diferencia y promedio exacto, verificando saldos/costos representables; no ejecutan registrarRetiro. |
| actualizarExistencia | `existenciaMedicamentoRepository.updateSaldoYCosto` se ejecuta solo con diferencia distinta de cero dentro de la transacción. |
| registrarMovimiento | `movimientoInventarioRepository.create` se ejecuta solo con diferencia, con cantidad positiva, dirección derivada, motivo AJUSTE y referencias de origen NULL. |
| prepararResultado | `registrarAjuste` retorna los valores confirmados y el Controller responde directamente; no invoca consultas de inventario/stock/historial para construir el resultado. |

`registrarAjuste` HTTP usa `POST /api/inventario/ajustes`, con idExistencia, saldoContado, stockObservado, ultimoMovimientoObservado y observacion; agrega costoUnitario únicamente en entrada. Conteo/saldo observado son enteros 0–2147483647; marcador es ID positivo dentro de INT o null; observación, 1–500 tras trim; costo positivo en cadena, hasta 99999999.999999 y máximo seis decimales. No envía dirección, cantidad de movimiento, diferencia, promedio, motivo, fecha o responsable.

Responde 201 si hay movimiento y 200 si ajusteRealizado es false y movimiento null, con `{ message, data }`; muestra saldo anterior/contado, diferencia, físico, promedio y marcador resultante. No devuelve vendible posterior: se obtiene mediante CU22. Contrato inválido produce 400; existencia ausente, 404; par cambiado/integridad/contención, 409; sesión/permisos, 401/403; fallo inesperado, 500.

La interfaz evita doble confirmación y conserva borrador ante errores. 404/409/red/500 exigen reconsulta explícita y nueva revisión antes de otro envío; reemplaza conjuntamente las precondiciones, conservando conteo/observación y omitiendo costo si ya no corresponde entrada. No hay POST automático, clave de idempotencia ni recuperación inequívoca de respuesta perdida. Dos conciliaciones sin efectos pueden ser exitosas sobre el mismo par. Referencias: RF19/RF39; RN26/RN30/RN40/RN64–RN70/RN81–RN84/RN103/RN104 y CU23.

### CU24 — Consultar movimientos de inventario

**Actor o actores:** Administrador o Regente autenticado.

**Objetivo:** consultar entradas y salidas por existencia o medicamento, con responsables y referencias de origen/reversión.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarMovimientos | Boundary | Recoge filtros y muestra hechos de entrada/salida y referencias. |
| ControlConsultarMovimientos | Control | Valida filtros, obtiene movimientos y prepara datos históricos públicos. |
| MovimientoInventario | Entity | Conserva hechos originales, costo aplicado y referencia de compensación. |
| ExistenciaMedicamento | Entity | Identifica la existencia de cada movimiento y permite filtro por producto. |
| Medicamento | Entity | Aporta identificación actual del producto asociado a existencia. |
| Usuario | Entity | Aporta identidad pública actual del responsable de cada hecho. |
| DetalleCompra | Entity | Identifica detalle/compra de origen cuando existe la referencia. |
| DetalleVenta | Entity | Identifica detalle/venta de origen cuando existe la referencia. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class VistaConsultarMovimientos {
        <<boundary>>
        -Integer idMedicamento
        -Integer idExistencia
        -String desde
        -String hasta
        -String direccion
        -String motivo
        -Lista movimientos
        +aplicarFiltros()
        +actualizarConsulta()
    }
    class ControlConsultarMovimientos {
        <<control>>
        +validarFiltros()
        +consultarMovimientos()
        +prepararHechosPublicos()
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -INT id_movimiento_original
        -ENUM_ENTRADA_SALIDA direccion
        -INT cantidad
        -DATETIME fecha_movimiento
        -VARCHAR_40 motivo
        -VARCHAR_500 observacion
        -DECIMAL_14_6 costo_unitario_aplicado
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
    }
    class DetalleCompra {
        <<entity>>
        -INT id_detalle_compra
        -INT id_compra
    }
    class DetalleVenta {
        <<entity>>
        -INT id_detalle_venta
        -INT id_venta
    }
    Administrador --> VistaConsultarMovimientos
    Regente --> VistaConsultarMovimientos
    VistaConsultarMovimientos ..> ControlConsultarMovimientos : solicita
    ControlConsultarMovimientos ..> MovimientoInventario : consulta hechos y reversion
    ControlConsultarMovimientos ..> ExistenciaMedicamento : identifica existencia
    ControlConsultarMovimientos ..> Medicamento : identifica producto
    ControlConsultarMovimientos ..> Usuario : responsable publico
    ControlConsultarMovimientos ..> DetalleCompra : origen opcional
    ControlConsultarMovimientos ..> DetalleVenta : origen opcional
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
    Usuario "1" -- "0..*" MovimientoInventario : usuario
    DetalleCompra "0..1" -- "0..*" MovimientoInventario : detalleCompra
    DetalleVenta "0..1" -- "0..*" MovimientoInventario : detalleVenta
    MovimientoInventario "0..1" -- "0..1" MovimientoInventario : movimientoReversion
```

**Descripción de relaciones:** cada hecho corresponde a existencia y responsable; el producto se obtiene a través de existencia. Las referencias a detalle de compra o venta son opcionales y excluyentes. Sus IDs identifican operación de origen sin cargar cabeceras Compra/Venta ni Receta. Ajustes/retiros independientes pueden tener ambas referencias NULL, sin perder existencia/responsable.

La asociación reflexiva permite incluir la reversión única del original; id_movimiento_original identifica al original desde una reversión sin recargar todos sus atributos. Se mantienen ambos hechos, sus cantidades positivas, dirección, motivo/observación, fecha y costo aplicado. No se recalculan costos históricos con el promedio actual, se borran originales ni se compensa nada al consultar. Nombres de usuario/producto y códigos se presentan desde sus datos actuales.

**Correspondencia con la implementación:** `/inventario/movimientos`, `frontend/src/features/inventario/pages/MovimientosPage.jsx`, InventarioFilters y `frontend/src/features/inventario/components/MovimientosTable.jsx` representan la vista. Accesos desde CU22/Compras preparan filtros de producto/existencia cuando corresponde. IDs/motivo esperan 300 ms; fechas, dirección y Limpiar aplican inmediatamente, con filtros en URL.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarFiltros | `inventarioController.getMovimientos` e `inventarioValidator.validateFiltrosMovimientos` validan query estricto, IDs, rango civil, dirección y motivo. |
| consultarMovimientos | `inventarioService.getMovimientos` utiliza `movimientoInventarioRepository.findAll` con includes de existencia/producto, Usuario, detalles opcionales y movimientoReversion. |
| prepararHechosPublicos | Auxiliar externo `toPublicMovimiento` presenta datos públicos, referencias de IDs y fecha/hora civil preservada, sin recalcular valoración histórica. |

`getMovimientos` HTTP usa `GET /api/inventario/movimientos`: IDs positivos dentro de INT, fechas desde/hasta con orden válido, ENTRADA/SALIDA y motivo de 1–40 tras trim, todos opcionales/combinables. Motivo usa igualdad según colación, no coincidencia parcial ni enum que descarte textos históricos. El período abarca desde 00:00:00 hasta 23:59:59.999999 del día final sobre DATETIME almacenado, sin conversión UTC. Orden por fecha y luego ID descendentes; DATE_FORMAT publica hora civil.

Responde 200 `{ data: movimientos }`, sin meta de disponibilidad. Sin coincidencias o IDs sin movimientos devuelve lista vacía, no 404. Query inválido produce 400; sesión/permisos, 401/403; fallo inesperado, 500. No llama a existenciaMedicamentoRepository, compraRepository, getInventario ni Services de ventas/recetas; tampoco ejecuta findReversiones/findReferenciasParaAnular de CU27. CU40 comparte este flujo con otro objetivo académico. Referencias: RF29/RF39; RN64–RN74/RN102 y CU24.

### CU37 — Consultar medicamentos con stock bajo

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** identificar productos activos cuyo stock vendible necesita reposición según el mínimo definido.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarStockBajo | Boundary | Recoge filtros y muestra productos que cumplen el criterio calculado. |
| ControlConsultarStockBajo | Control | Consulta disponibilidad amplia y selecciona activos con vendible menor o igual al mínimo. |
| Medicamento | Entity | Aporta identidad, actividad, unidad y stock mínimo del producto. |
| ExistenciaMedicamento | Entity | Aporta saldos, vencimientos y promedios cuando existan agrupaciones. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaConsultarStockBajo {
        <<boundary>>
        -Integer idMedicamento
        -String codigoMedicamento
        -String nombreComercial
        -Lista medicamentos
        +aplicarFiltros()
        +actualizarConsulta()
    }
    class ControlConsultarStockBajo {
        <<control>>
        +validarFiltros()
        +consultarDisponibilidadAmplia()
        +prepararDisponibilidad()
        +seleccionarStockBajo()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_50 unidad_inventario
        -INT stock_minimo
        -BOOLEAN estado
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -DATE fecha_vencimiento
        -ENUM_DIA_MES precision_vencimiento
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    Administrador --> VistaConsultarStockBajo
    Regente --> VistaConsultarStockBajo
    Vendedor --> VistaConsultarStockBajo
    VistaConsultarStockBajo ..> ControlConsultarStockBajo : solicita
    ControlConsultarStockBajo ..> Medicamento : actividad y minimo
    ControlConsultarStockBajo ..> ExistenciaMedicamento : disponibilidad opcional
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
```

**Descripción de relaciones:** la asociación permite productos sin existencias, que tienen físico/vendible cero. El Control consulta disponibilidad amplia y aplica **activo y stockVendible <= stockMinimo**. Igualar el mínimo también es stock bajo; un activo sin existencias y mínimo cero se incluye. Un activo con solo unidades vencidas puede tener físico positivo y vendible cero. Los inactivos se excluyen de esta consulta, aunque sus existencias sigan visibles en CU21/CU22.

El criterio usa suma vendible, no física; no exige compra, movimiento ni saldo positivo. El DTO conserva existencias y costos cuando hay, así como metadatos comunes. La alerta es resultado de consulta, no otra entidad persistida ni disponibilidad garantizada para una futura venta.

**Correspondencia con la implementación:** `/inventario/stock-bajo`, InventarioPage en vista stockBajo, InventarioFilters e InventarioTable representan la vista, reutilizando filtros automáticos, URL, ConsultaMeta/ConsultaResultado y enlaces a CU22. React no repite el criterio de selección.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarFiltros | `inventarioController.getStockBajo` utiliza `inventarioValidator.validateFiltrosInventario`, con el mismo contrato estricto que CU21. |
| consultarDisponibilidadAmplia | `inventarioService.getStockBajo` usa `consultarDisponibilidad` externo y `existenciaMedicamentoRepository.findInventario` con soloConExistencias false por defecto/include opcional. |
| prepararDisponibilidad | Auxiliares de disponibilidad y utilidades de vencimiento preparan cantidades físicas/vendibles y metadatos, compartidos con las demás consultas. |
| seleccionarStockBajo | El flujo `getStockBajo` conserva únicamente activos cuyo total vendible es menor o igual al mínimo; no ejecuta getInventario. |

`getStockBajo` HTTP usa `GET /api/inventario/stock-bajo` y responde 200 `{ data, meta }`, incluida lista vacía válida. Contrato/errores de filtros son los de CU21: 400/401/403/500; no modifica stock ni persiste alertas. La consulta amplia es esencial: llamar a getInventario excluiría indebidamente los productos sin existencias. Referencias: RF34; RN28/RN29/RN31/RN32/RN93/RN96 y CU37.

### CU40 — Consultar historial de inventario

**Actor o actores:** Administrador o Regente autenticado.

**Objetivo:** consultar trazabilidad histórica de inventario, relacionando hechos, responsables y compensaciones.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarHistorialInventario | Boundary | Presenta historial filtrado con responsables, origen y vínculos original/reversión. |
| ControlConsultarHistorialInventario | Control | Coordina la misma consulta de CU24 para el objetivo de trazabilidad histórica. |
| MovimientoInventario | Entity | Conserva entradas, salidas, ajustes, retiros y compensaciones sin reemplazar originales. |
| ExistenciaMedicamento | Entity | Identifica la agrupación de unidades afectada por cada hecho. |
| Medicamento | Entity | Identifica el producto de la existencia mediante datos actuales. |
| Usuario | Entity | Identifica públicamente al responsable de cada movimiento. |
| DetalleCompra | Entity | Identifica origen de compra cuando el movimiento lo referencia. |
| DetalleVenta | Entity | Identifica origen de venta cuando el movimiento lo referencia. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class VistaConsultarHistorialInventario {
        <<boundary>>
        -Integer idMedicamento
        -Integer idExistencia
        -String desde
        -String hasta
        -String direccion
        -String motivo
        -Lista movimientos
        +aplicarFiltros()
        +actualizarConsulta()
    }
    class ControlConsultarHistorialInventario {
        <<control>>
        +validarFiltros()
        +consultarMovimientos()
        +prepararHechosPublicos()
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -INT id_movimiento_original
        -ENUM_ENTRADA_SALIDA direccion
        -INT cantidad
        -DATETIME fecha_movimiento
        -VARCHAR_40 motivo
        -VARCHAR_500 observacion
        -DECIMAL_14_6 costo_unitario_aplicado
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
    }
    class DetalleCompra {
        <<entity>>
        -INT id_detalle_compra
        -INT id_compra
    }
    class DetalleVenta {
        <<entity>>
        -INT id_detalle_venta
        -INT id_venta
    }
    Administrador --> VistaConsultarHistorialInventario
    Regente --> VistaConsultarHistorialInventario
    VistaConsultarHistorialInventario ..> ControlConsultarHistorialInventario : solicita
    ControlConsultarHistorialInventario ..> MovimientoInventario : hechos originales y compensaciones
    ControlConsultarHistorialInventario ..> ExistenciaMedicamento : identifica existencia
    ControlConsultarHistorialInventario ..> Medicamento : identifica producto
    ControlConsultarHistorialInventario ..> Usuario : responsable publico
    ControlConsultarHistorialInventario ..> DetalleCompra : origen opcional
    ControlConsultarHistorialInventario ..> DetalleVenta : origen opcional
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
    Usuario "1" -- "0..*" MovimientoInventario : usuario
    DetalleCompra "0..1" -- "0..*" MovimientoInventario : detalleCompra
    DetalleVenta "0..1" -- "0..*" MovimientoInventario : detalleVenta
    MovimientoInventario "0..1" -- "0..1" MovimientoInventario : movimientoReversion
```

**Descripción de relaciones:** conserva las asociaciones/atributos de CU24: existencia y responsable obligatorios, origen por detalle opcional y reversión única. Cada hecho conserva cantidades, costo aplicado, motivo/observación y hora registrados, mientras identidad pública de producto/responsable corresponde a datos actuales. Los motivos históricos permanecen sin normalización. Nuevas compras/anulaciones identifican detalle y, en reversión, original; ajustes/retiros independientes pueden no tener detalles.

Un movimiento compensado no desaparece: el vínculo permite distinguir original y reversión. Una consulta parcial no demuestra que se esté mostrando todo el historial, ni reconstruye saldo acumulado o valoración desde el promedio actual. La consulta no ejecuta un reporte de pérdidas ni de ventas, ni carga cabeceras de operaciones/Receta. Estos objetivos siguen en sus CU correspondientes.

**Correspondencia con la implementación:** MovimientosPage, InventarioFilters y MovimientosTable en `/inventario/movimientos` representan también esta vista conceptual. Accesos desde existencias, compras y resultados de ajustes/retiros pueden conservar el filtro de producto/existencia. No hay otra página/Service de Reportes ni segunda ejecución adicional por llamarse historial.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarFiltros | `inventarioController.getMovimientos` e `inventarioValidator.validateFiltrosMovimientos`, idénticos a CU24. |
| consultarMovimientos | `inventarioService.getMovimientos` y `movimientoInventarioRepository.findAll` incluyen los mismos hechos, referencias de origen, responsable y movimientoReversion. |
| prepararHechosPublicos | Auxiliar externo `toPublicMovimiento` conserva información histórica y expone únicamente datos públicos y referencias; no calcula saldos/reportes. |

`getMovimientos` HTTP usa el mismo `GET /api/inventario/movimientos`, filtros, rango inclusivo, orden descendente y respuesta 200 `{ data }` de CU24. Lista vacía válida, 400/401/403/500 y ausencia de escrituras son compartidos. El análisis/diagrama se mantienen separados para el objetivo oficial CU40, sin duplicar implementación ni inventar un endpoint. Ventas/Recetas y reportes CU38/CU39/CU41 permanecen pendientes. Referencias: RF37/RF39; RN70–RN74/RN97/RN100/RN102/RN104 y CU40.

## 10. Cierre y revisión de la quinta entrega

| Caso de uso | Diagramas | Aspecto principal de revisión |
|---|---|---|
| CU21 — Consultar inventario | 1 | Existencias obligatorias en listado y stock físico/vendible diferenciado. |
| CU22 — Consultar existencias de un medicamento | 1 | Saldo y marcador en una sentencia, identidad de apoyo y lista vacía frente a 404. |
| CU23 — Registrar ajuste de inventario | 1 | Par revalidado bajo bloqueo y entrada/salida/sin diferencia con valoración propia. |
| CU24 — Consultar movimientos de inventario | 1 | Hechos, responsable público, origen opcional y reversión conservada. |
| CU37 — Consultar medicamentos con stock bajo | 1 | Activo y vendible menor o igual al mínimo, incluso sin existencias. |
| CU40 — Consultar historial de inventario | 1 | Trazabilidad con análisis separado y consulta compartida con CU24. |
| **Total de Fase 5** | **6** | **Seis CU, numeración oficial y orden de fases conservados.** |

**Criterio de comprobación:** una Vista y un Control conceptual por dibujo, con operaciones respaldadas por sus correspondencias. Se distingue persistencia de datos derivados y precondiciones temporales, y multiplicidad global de condición de selección/creación del flujo. MovimientoInventario participa en CU22 por MAX SQL, no historial completo; en CU23 por comprobación/escritura condicional; en CU24/CU40 por lectura histórica. Usuario no se repite por infraestructura. No se agregan herencias, composiciones UML ni entidades/métodos de modelo inexistentes.

**Validación de esta entrega:** se comprobaron los nombres/números CU21–CU24/CU37/CU40 contra el catálogo oficial, sin duplicados ni ausencias, y la estructura completa de los seis análisis. Los dibujos contienen seis Boundary y seis Control, con 23 operaciones conceptuales respaldadas por sus correspondencias. Se contrastaron seis entidades reales —Medicamento, ExistenciaMedicamento, MovimientoInventario, Usuario, DetalleCompra y DetalleVenta— y 87 apariciones de atributos seleccionados con los tipos del modelo general. Las 18 apariciones de asociaciones conservan participantes, multiplicidades y significado de cada CU técnico; las asociaciones de Usuario omitidas en disponibilidad corresponden exclusivamente a contexto transversal o histórico no consultado.

Se revisaron los permisos por operación, inclusión de productos con/sin existencias, físico/vendible y fecha efectiva, lectura conjunta de saldo/marcador y sus precondiciones, así como entrada/salida/conciliación sin efectos. CU24/CU40 conservan idénticas entidades, atributos, asociaciones y métodos reales de consulta, con análisis separados por objetivo. Se verificaron formato Markdown, tablas, enlaces y rutas de correspondencia.

Los seis diagramas se analizaron y renderizaron con Mermaid 11.12.0 y sus capturas se revisaron visualmente: actores → Boundary → Control de izquierda a derecha y entidades a la derecha, sin cajas solapadas. Los SVG permiten ampliar los atributos y multiplicidades de los dibujos más anchos. Los hashes SHA-256 de los 23 análisis académicos anteriores, sus 24 diagramas y los seis documentos fuente se conservaron; Git identifica únicamente este documento académico nuevo. La comprobación fue documental y visual, sin conexión a MySQL ni pruebas funcionales del backend.

**Avance al cierre de Fase 5:** veintinueve de los 33 CU implementados, con treinta diagramas de los 34 previstos. La Fase 6 se incorpora a continuación por solicitud de continuidad del usuario, conservando la numeración oficial y el orden acordado.

## 11. Fase 6 — Vencimientos y Retiros

### 11.1. Condiciones compartidas, fechas y valoración

Cada CU conserva una Vista y un Control conceptuales. CU33/CU34 permiten **Administrador o Regente**; CU35/CU36, únicamente **Regente**. La autorización de consulta no concede permiso de retiro. Todos requieren sesión válida, cuenta activa y versión de credenciales vigente, verificadas por el backend. Usuario participa por responsabilidad del movimiento en los retiros; en las consultas su uso de autenticación es transversal y no se repite en los dibujos.

**Fuentes:** Fase 6 del análisis técnico, secciones 5/6 del diagrama general, CU33–CU36, RF30–RF33/RF39 y RN28–RN30/RN40/RN64–RN70/RN85–RN95/RN103/RN104, contrastadas con las decisiones de API e interfaz del contexto maestro. Se reutilizan inventarioController, inventarioValidator, inventarioService y los Repositories de existencias/movimientos; no se introducen clases técnicas de Vencimientos, Retiro o Pérdida.

| Asociación persistente | Multiplicidades | Participación |
|---|---|---|
| Medicamento — ExistenciaMedicamento | `1` — `0..*` | Identificación y estado del producto en CU33/CU34; solo se presentan existencias que cumplen su criterio físico/temporal. |
| ExistenciaMedicamento — MovimientoInventario | `1` — `0..*` | Marcador actual y salida independiente en CU35/CU36. |
| Usuario — MovimientoInventario | `1` — `0..*` | Responsable autenticado del retiro y datos públicos del resultado. |

La multiplicidad persistente no exige saldo positivo ni actividad; esas condiciones dependen de cada operación. Un retiro válido crea un movimiento de cantidad positiva, sin convertir la asociación global en uno a uno. Medicamento–Existencia es contexto en los POST: la preparación reutiliza CU22/CU15, pero la escritura no consulta Medicamento. Los retiros dejan id_detalle_compra, id_detalle_venta e id_movimiento_original en NULL; no son reversión de un original ni requieren cabeceras de Compra/Venta/Receta. No se infiere composición UML de las FK.

| Información temporal | Significado y uso |
|---|---|
| fecha_vencimiento, precision_vencimiento | Fecha y precisión persistidas, conservadas incluso en registros históricos MES no canónicos. |
| fechaEtiquetaNormalizada | Fecha calculada: DIA usa su fecha; MES, último día del mes de etiqueta. CU33 la usa para el intervalo inclusivo. |
| fechaEfectivaVencimiento | Fecha calculada de no venta: DIA desde el inicio de su fecha; MES desde el primer día del mes siguiente. |
| fechaComercial, zonaHoraria | Metadatos de disponibilidad, determinados por backend en America/La_Paz, no por un parámetro del cliente. |
| fechaHasta | Fecha comercial más tres meses calendario; solo CU33 la agrega a meta. |
| stockObservado, ultimoMovimientoObservado | Par temporal tomado conjuntamente de CU22 y vuelto a comprobar bajo bloqueo en CU35/CU36. |

Las nuevas recepciones MES almacenan fin de mes, pero estas consultas/retiros no corrigen fechas históricas. Tres meses calendario conservan el día de origen o usan el último día del mes destino si no existe ese día; no equivalen a 90 días. Se diferencia etiqueta de fecha efectiva, sin crear columnas para sus proyecciones. `ENUM_DIA_MES`, `ENUM_ENTRADA_SALIDA` y `DECIMAL_14_6` conservan los tipos/valores reales del modelo.

**Stock y pérdida:** vencer o desactivar un producto deja vendible cero, pero conserva físico. CU33/CU34 pueden incluir productos inactivos; consultar no retira unidades. CU35/CU36 aplican el promedio vigente, admitido cero, y lo conservan incluso al agotar. La pérdida es cantidad retirada × costo aplicado, calculada exactamente y redondeada a dos decimales con empate hacia arriba; se devuelve como cadena, sin columna o entidad propia. El movimiento conserva costo aplicado a seis decimales. El importe derivado puede superar DECIMAL(14,2), que no es límite de ese resultado; React no convierte importes a Number ni calcula la pérdida.

**Preparación:** el formulario vuelve a consultar CU22 junto con CU15 para identidad del catálogo y valida pertenencia. El par procede de saldo/marcador de la misma respuesta CU22, no de una alerta ni de la tabla previa. Un marcador ausente no se sustituye por null. Los campos de Vista son temporales; el Controller/Service reales y sus auxiliares respaldan el Control conceptual. `consultarDisponibilidad` y `registrarRetiro` son funciones externas de módulo, no métodos de inventarioService.

### CU33 — Consultar productos próximos a vencer

**Actor o actores:** Administrador o Regente autenticado.

**Objetivo:** identificar existencias con saldo físico que todavía no vencieron y cuya etiqueta está dentro de los próximos tres meses calendario.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarProximosAVencer | Boundary | Recoge filtros de producto y presenta fechas, saldos y horizonte calculados. |
| ControlConsultarProximosAVencer | Control | Consulta disponibilidad y selecciona existencias por saldo, no vencimiento e intervalo de etiqueta. |
| Medicamento | Entity | Aporta identidad, unidad y estado del producto asociado. |
| ExistenciaMedicamento | Entity | Aporta fecha/precisión, físico y promedio para control preventivo. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class VistaConsultarProximosAVencer {
        <<boundary>>
        -Integer idMedicamento
        -String codigoMedicamento
        -String nombreComercial
        -Lista existencias
        +aplicarFiltros()
        +actualizarConsulta()
    }
    class ControlConsultarProximosAVencer {
        <<control>>
        +validarFiltros()
        +consultarDisponibilidad()
        +seleccionarProximasAVencer()
        +prepararResultado()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_50 unidad_inventario
        -BOOLEAN estado
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -DATE fecha_vencimiento
        -ENUM_DIA_MES precision_vencimiento
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    Administrador --> VistaConsultarProximosAVencer
    Regente --> VistaConsultarProximosAVencer
    VistaConsultarProximosAVencer ..> ControlConsultarProximosAVencer : solicita
    ControlConsultarProximosAVencer ..> Medicamento : identifica producto y estado
    ControlConsultarProximosAVencer ..> ExistenciaMedicamento : saldo y etiqueta en intervalo
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
```

**Descripción de relaciones:** el Control obtiene productos con existencias opcionales, aplana sus existencias y conserva únicamente físico positivo, todavía no vencida y **fechaComercial <= fechaEtiquetaNormalizada <= fechaHasta**. Productos sin existencias no aportan filas; no exige compra ni movimiento. Las existencias de productos inactivos pueden aparecer por su control físico, aunque tengan vendible cero.

Para MES el intervalo utiliza el último día del mes de etiqueta, no el primer día del mes siguiente de no venta. DIA ya está vencida al comenzar su fecha y se excluye aunque coincida con el extremo inferior del intervalo. Se ordena por etiqueta normalizada e ID de existencia. Los cálculos no modifican la fecha persistida ni implican selección FEFO de una venta.

**Correspondencia con la implementación:** `/vencimientos`, `frontend/src/features/inventario/pages/InventarioPage.jsx` en vista proximos, `frontend/src/features/inventario/components/InventarioFilters.jsx` y `ExistenciasTable.jsx` representan la vista. Búsqueda automática de 300 ms para texto, filtros en URL, ConsultaMeta y estados de carga/vacío/error presentan la consulta calculada; la fecha comercial y el horizonte no son campos elegidos por el usuario.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarFiltros | `inventarioController.getProximosAVencer` e `inventarioValidator.validateFiltrosInventario` validan query estricto, con ID/código/nombre de producto del contrato CU21. |
| consultarDisponibilidad | `inventarioService.getProximosAVencer` utiliza `consultarDisponibilidad` externo y `existenciaMedicamentoRepository.findInventario` con include opcional, sin activar soloConExistencias de CU21. |
| seleccionarProximasAVencer | El flujo `getProximosAVencer`, `existenciasDeInventario` y funciones externas `sumarMesesCalendario`/`obtenerFechaEtiquetaNormalizada` filtran físico/no vencida/intervalo y ordenan resultados. |
| prepararResultado | Auxiliares de disponibilidad y el flujo de consulta conservan fecha almacenada, agregan etiqueta normalizada y publican meta con fechaComercial/zonaHoraria/fechaHasta. |

`getProximosAVencer` de `frontend/src/features/inventario/services/inventario.service.js` usa `GET /api/inventario/proximos-a-vencer`. Responde 200 `{ data: existenciasConMedicamento, meta }`, incluida lista vacía válida; 400 por query inválido, 401/403 por sesión/permisos y 500 inesperado. Cada fila muestra existencia con producto, fechas/precisión, físico/vendible y costo promedio. No incluye ultimoMovimiento, no lee MovimientoInventario ni ejecuta getInventario/getExistencias/retiros; no persiste alertas. Referencias: RF32; RN28/RN29/RN85/RN93/RN94 y CU33.

### CU34 — Consultar productos vencidos

**Actor o actores:** Administrador o Regente autenticado.

**Objetivo:** identificar existencias vencidas que conservan unidades físicas pendientes de retiro.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarVencidos | Boundary | Recoge filtros y muestra existencias vencidas con saldo físico. |
| ControlConsultarVencidos | Control | Consulta disponibilidad y selecciona vencidas con físico positivo. |
| Medicamento | Entity | Aporta identificación, unidad y estado actual del producto. |
| ExistenciaMedicamento | Entity | Aporta fecha/precisión, físico y promedio de unidades pendientes. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class VistaConsultarVencidos {
        <<boundary>>
        -Integer idMedicamento
        -String codigoMedicamento
        -String nombreComercial
        -Lista existencias
        +aplicarFiltros()
        +actualizarConsulta()
    }
    class ControlConsultarVencidos {
        <<control>>
        +validarFiltros()
        +consultarDisponibilidad()
        +seleccionarVencidasPendientes()
        +prepararResultado()
    }
    class Medicamento {
        <<entity>>
        -INT id_medicamento
        -VARCHAR_20 codigo_medicamento
        -VARCHAR_150 nombre_comercial
        -VARCHAR_50 unidad_inventario
        -BOOLEAN estado
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -DATE fecha_vencimiento
        -ENUM_DIA_MES precision_vencimiento
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    Administrador --> VistaConsultarVencidos
    Regente --> VistaConsultarVencidos
    VistaConsultarVencidos ..> ControlConsultarVencidos : solicita
    ControlConsultarVencidos ..> Medicamento : identifica producto y estado
    ControlConsultarVencidos ..> ExistenciaMedicamento : vencida y saldo positivo
    Medicamento "1" -- "0..*" ExistenciaMedicamento : existencias
```

**Descripción de relaciones:** el Control aplana existencias de la disponibilidad amplia y selecciona **vencida y stockFisico > 0**, sin excluir productos inactivos. Todas las vencidas tienen vendible cero; físico se mantiene hasta una salida registrada. Una agotada no aparece aunque esté vencida y un producto sin existencias no aporta filas. Se ordena por fecha efectiva e ID.

El vencimiento efectivo MES comienza el primer día del mes siguiente, incluso si la fecha histórica guardada no era canónica de fin de mes. Se conserva el DATE almacenado. Consultar no pone saldo en cero ni registra automáticamente un retiro, y no necesita historial o compra vinculada.

**Correspondencia con la implementación:** `/vencimientos/vencidos`, InventarioPage en vista vencidos, InventarioFilters y ExistenciasTable representan la vista. Se reutilizan consulta automática, URL, metadatos y estados de consulta. El enlace a retiro por vencimiento solo se ofrece al Regente y abre CU35 con nueva lectura CU22/CU15; el saldo de la alerta no es precondición definitiva de escritura.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarFiltros | `inventarioController.getVencidos` e `inventarioValidator.validateFiltrosInventario` utilizan el contrato de filtros de disponibilidad. |
| consultarDisponibilidad | `inventarioService.getVencidos` utiliza `consultarDisponibilidad` externo y `existenciaMedicamentoRepository.findInventario` con include opcional amplio. |
| seleccionarVencidasPendientes | El flujo `getVencidos`, `existenciasDeInventario` y utilidades de vencimiento filtran físico positivo/vencida según fecha comercial común y ordenan por fecha efectiva/ID. |
| prepararResultado | Auxiliares de disponibilidad preparan existencia/producto y meta de fechaComercial/zonaHoraria, sin agregar horizonte ni marcador. |

`getVencidos` HTTP usa `GET /api/inventario/vencidos` y responde 200 `{ data: existenciasConMedicamento, meta }`, vacío válido; 400/401/403/500 según contrato compartido. No agrega fechaHasta/fechaEtiquetaNormalizada de CU33 ni ultimoMovimiento de CU22. No lee movimientos, llama a registrarRetiroVencimiento o persiste alertas. Referencias: RF33; RN27–RN29/RN86/RN87/RN93/RN95 y CU34.

### CU35 — Registrar retiro por vencimiento

**Actor o actores:** Regente autenticado.

**Objetivo:** registrar salida física de unidades vencidas, conservar su trazabilidad y presentar la pérdida derivada.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaRegistrarRetiroVencimiento | Boundary | Recoge cantidad y observación opcional, conserva par observado y permite revisión/confirmación. |
| ControlRegistrarRetiroVencimiento | Control | Comprueba precondiciones/vencimiento bajo bloqueo, valora salida y coordina retiro atómico. |
| ExistenciaMedicamento | Entity | Aporta fecha/precisión y saldo/promedio actuales; recibe saldo reducido con promedio conservado. |
| MovimientoInventario | Entity | Aporta marcador actual y conserva salida VENCIMIENTO con costo y responsable. |
| Usuario | Entity | Identifica al responsable autenticado del movimiento y sus datos públicos. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Regente { <<actor>> }
    class VistaRegistrarRetiroVencimiento {
        <<boundary>>
        -Integer idExistencia
        -Integer cantidad
        -Integer stockObservado
        -Integer ultimoMovimientoObservado
        -String observacion
        +revisarRetiro()
        +confirmarRetiro()
    }
    class ControlRegistrarRetiroVencimiento {
        <<control>>
        +validarSolicitud()
        +comprobarParObservado()
        +verificarVencimiento()
        +valorarSalida()
        +actualizarExistencia()
        +registrarRetiro()
        +prepararResultado()
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -DATE fecha_vencimiento
        -ENUM_DIA_MES precision_vencimiento
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -ENUM_ENTRADA_SALIDA direccion
        -INT cantidad
        -DECIMAL_14_6 costo_unitario_aplicado
        -DATETIME fecha_movimiento
        -VARCHAR_40 motivo
        -VARCHAR_500 observacion
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
    }
    Regente --> VistaRegistrarRetiroVencimiento
    VistaRegistrarRetiroVencimiento ..> ControlRegistrarRetiroVencimiento : solicita
    ControlRegistrarRetiroVencimiento ..> ExistenciaMedicamento : bloquea valida y reduce saldo
    ControlRegistrarRetiroVencimiento ..> MovimientoInventario : marcador y salida VENCIMIENTO
    ControlRegistrarRetiroVencimiento ..> Usuario : responsable autenticado
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
    Usuario "1" -- "0..*" MovimientoInventario : usuario
```

**Descripción de relaciones:** el Control bloquea existencia y obtiene su último movimiento actual; compara ambos valores observados antes de efectos. Sin existencia rechaza antes de leer marcador. El par cambiado produce conflicto aunque el saldo haya sido restituido. El instante comercial se obtiene después de los bloqueos y se comprueba vencimiento efectivo DIA/MES, sin usar fecha del cliente o condición antigua de una alerta.

Exige cantidad positiva no superior al físico y promedio vigente representable, permitido cero. El saldo final es saldo actual menos cantidad, con promedio conservado. La pérdida se deriva del costo aplicado y cantidad, sin otra clase persistente. Actualiza exactamente una existencia y crea una SALIDA VENCIMIENTO con responsable, hora civil y observación opcional; las referencias de compra/venta/original quedan NULL. Conserva existencia/código, fecha y costos históricos, incluso al agotar o retirar producto inactivo.

No hay un retiro válido sin efectos por cantidad cero. Cabecera de producto/compras/ventas y Receta no se leen en el POST; no se crea existencia ni se cambia vencimiento. La transacción confirma saldo y movimiento conjuntamente o revierte íntegramente ante fallo, manteniendo bloqueos hasta commit/rollback. El movimiento efectivo es posterior para RN76 y puede condicionar CU27; no modifica snapshots para facilitar anulación. Presentar su pérdida no completa el reporte CU41.

**Correspondencia con la implementación:** `/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/retiro-vencimiento`, `frontend/src/features/inventario/pages/RetiroFormPage.jsx` en tipo vencimiento, `frontend/src/features/inventario/components/RetiroForm.jsx`, revisión en Modal y RetiroResultado representan la vista. Accede desde CU22/CU34 y vuelve a consultar CU22/CU15 mediante `frontend/src/features/inventario/utils/consultaExistencia.js`. Antes de preparar exige saldo positivo y vencida según backend; la escritura lo comprueba nuevamente bajo bloqueo.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarSolicitud | `inventarioController.registrarRetiroVencimiento` utiliza `inventarioValidator.validateSinFiltros` y `validateRetiroVencimiento` para query vacío/body estricto. Query inválido interrumpe antes de body y Service. |
| comprobarParObservado | `inventarioService.registrarRetiroVencimiento` delega al auxiliar externo `registrarRetiro`, que usa `existenciaMedicamentoRepository.findByIdParaMovimiento` y `movimientoInventarioRepository.findUltimoIdParaExistencia` bajo bloqueo. |
| verificarVencimiento | La rama VENCIMIENTO del auxiliar `registrarRetiro` ejecuta la función externa `calcularVencimiento` con instante comercial posterior a bloqueos, rechazando existencia no vencida o fecha/precisión inconsistentes. |
| valorarSalida | El auxiliar valida cantidad/saldo/promedio y calcula saldo final/pérdida mediante utilidades decimales exactas, aplicando promedio vigente y redondeo de pérdida a dos decimales. |
| actualizarExistencia | `existenciaMedicamentoRepository.updateSaldoYCosto` reduce saldo y conserva promedio, solo después de aprobar todas las condiciones. |
| registrarRetiro | `movimientoInventarioRepository.create` crea SALIDA VENCIMIENTO después de actualizar exactamente una existencia, dentro de la misma transacción; no es un método agregado al modelo. |
| prepararResultado | El flujo de retiro y el Controller devuelven valores confirmados y movimiento creado después del commit; no invocan consultas de disponibilidad/historial para formar el resultado. |

`registrarRetiroVencimiento` HTTP usa `POST /api/inventario/retiros/vencimiento`, con idExistencia/cantidad positivos hasta 2147483647, stockObservado entero 0–2147483647 y ultimoMovimientoObservado positivo dentro de INT o null. Observación opcional: si se envía, exige 1–500 caracteres tras trim; vacío/null no son válidos. React omite texto vacío y el backend conserva NULL si no se proporcionó. No envía ID de medicamento de la ruta visual, costo alternativo, pérdida, motivo, dirección, fecha o responsable.

Responde 201 `{ message, data }` tras commit: idExistencia, saldoAnterior, cantidadRetirada, stockFisico, costoUnitarioPromedio, perdida, ultimoMovimiento y movimiento. Costos/promedio son cadenas de seis decimales y pérdida de dos, sin límite artificial DECIMAL(14,2); cero de promedio produce 0.00. Vendible posterior se obtiene de CU22. Contrato inválido produce 400; sesión/permisos, 401/403; existencia ausente, 404; par obsoleto/vencimiento/stock/saldo/costo/contención, 409; fallo inesperado, 500. Timeout/deadlock se traducen después de rollback.

La interfaz bloquea duplicados, conserva borrador ante error y exige reconsulta explícita/nueva revisión tras 404/409/red/500; 401/403 bloquean envío. No hay POST automático, clave de idempotencia ni reconstrucción inequívoca de respuesta perdida. Resultado ofrece existencias/historial y preparar otro retiro con nueva consulta. Referencias: RF30/RF39; RN29/RN30/RN40/RN64–RN70/RN87/RN88/RN90–RN92/RN103/RN104 y CU35.

### CU36 — Registrar retiro por daño

**Actor o actores:** Regente autenticado.

**Objetivo:** retirar unidades dañadas conservando observación, responsable, costo aplicado y pérdida derivada.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaRegistrarRetiroDano | Boundary | Recoge cantidad/observación obligatoria y par observado para revisión del daño. |
| ControlRegistrarRetiroDano | Control | Comprueba precondiciones, saldo y costo y coordina salida atómica sin condición de vencimiento. |
| ExistenciaMedicamento | Entity | Aporta saldo/promedio vigente y recibe saldo reducido con promedio conservado. |
| MovimientoInventario | Entity | Aporta marcador actual y conserva SALIDA DAÑO con observación obligatoria. |
| Usuario | Entity | Identifica al responsable autenticado del retiro y sus datos públicos. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Regente { <<actor>> }
    class VistaRegistrarRetiroDano {
        <<boundary>>
        -Integer idExistencia
        -Integer cantidad
        -Integer stockObservado
        -Integer ultimoMovimientoObservado
        -String observacion
        +revisarRetiro()
        +confirmarRetiro()
    }
    class ControlRegistrarRetiroDano {
        <<control>>
        +validarSolicitud()
        +comprobarParObservado()
        +valorarSalida()
        +actualizarExistencia()
        +registrarRetiro()
        +prepararResultado()
    }
    class ExistenciaMedicamento {
        <<entity>>
        -INT id_existencia
        -VARCHAR_30 codigo_existencia
        -INT cantidad_fisica
        -DECIMAL_14_6 costo_unitario_promedio
    }
    class MovimientoInventario {
        <<entity>>
        -INT id_movimiento
        -ENUM_ENTRADA_SALIDA direccion
        -INT cantidad
        -DECIMAL_14_6 costo_unitario_aplicado
        -DATETIME fecha_movimiento
        -VARCHAR_40 motivo
        -VARCHAR_500 observacion
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
    }
    Regente --> VistaRegistrarRetiroDano
    VistaRegistrarRetiroDano ..> ControlRegistrarRetiroDano : solicita
    ControlRegistrarRetiroDano ..> ExistenciaMedicamento : bloquea y reduce saldo
    ControlRegistrarRetiroDano ..> MovimientoInventario : marcador y salida DAÑO
    ControlRegistrarRetiroDano ..> Usuario : responsable autenticado
    ExistenciaMedicamento "1" -- "0..*" MovimientoInventario : movimientosInventario
    Usuario "1" -- "0..*" MovimientoInventario : usuario
```

**Descripción de relaciones:** mantiene existencia y responsable obligatorios del movimiento, con el mismo protocolo de bloqueo y comparación del par de CU35. Una referencia de origen de compra/venta o reversión no es necesaria: quedan NULL en este retiro independiente. Usuario identifica responsable, no una cuenta elegida por el formulario.

El daño admite existencias vencidas y productos inactivos sin cambiar vencimientos o reactivar catálogo. No ejecuta calcularVencimiento ni exige actividad; por eso fecha/precisión no se seleccionan como atributos del objetivo de escritura en este dibujo. Preparar la pantalla con CU22/CU15 sigue mostrando identidad y disponibilidad, sin atribuir sus consultas al POST.

Con saldo suficiente y promedio válido, aplica costo vigente, permitido cero, reduce físico y conserva promedio aun al agotar. Crea SALIDA DAÑO con observación obligatoria, costo aplicado, responsable y hora civil. La pérdida deriva exactamente de cantidad/costo y se devuelve a dos decimales; no es ajuste negativo ni retiro por vencimiento. El costo guardado permanece histórico aunque después cambie el promedio. La transacción mantiene atomicidad de saldo y movimiento, y no completa una nueva entidad de baja/pérdida ni el reporte CU41.

**Correspondencia con la implementación:** `/inventario/medicamentos/:idMedicamento/existencias/:idExistencia/retiro-dano`, RetiroFormPage en tipo dano, RetiroForm, Modal y RetiroResultado representan la vista. Reutiliza la preparación fresca CU22/CU15 y validación de pertenencia por consultaExistencia; solo Regente puede preparar/confirmar. Cantidad se valida como entero positivo no superior al físico observado y observación como texto obligatorio.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarSolicitud | `inventarioController.registrarRetiroDano` utiliza `inventarioValidator.validateSinFiltros` y `validateRetiroDano`, con observación obligatoria/body estricto. |
| comprobarParObservado | `inventarioService.registrarRetiroDano` delega al auxiliar externo `registrarRetiro`, con `existenciaMedicamentoRepository.findByIdParaMovimiento` y `movimientoInventarioRepository.findUltimoIdParaExistencia` bajo bloqueo. |
| valorarSalida | El auxiliar `registrarRetiro` comprueba saldo/cantidad/promedio y calcula saldo final y pérdida exacta; la rama de daño no ejecuta calcularVencimiento. |
| actualizarExistencia | `existenciaMedicamentoRepository.updateSaldoYCosto` reduce físico y conserva promedio vigente, después de las validaciones. |
| registrarRetiro | `movimientoInventarioRepository.create` crea SALIDA DAÑO con observación normalizada y referencias de origen NULL, después de actualizar exactamente una existencia en la transacción. |
| prepararResultado | El flujo de retiro y el Controller devuelven el DTO confirmado de CU35 tras commit, con pérdida derivada y movimiento, sin calcular vendible posterior. |

`registrarRetiroDano` HTTP usa `POST /api/inventario/retiros/dano`, con los mismos IDs/cantidad/par observado de CU35 y observacion obligatoria de 1–500 tras trim. No admite costo alternativo, pérdida, motivo, dirección, responsable o fecha. El método backend fija MOTIVOS_MOVIMIENTO.DANO, cuyo literal persistido es DAÑO; el formulario no selecciona el motivo mediante un body parametrizado.

Responde 201 `{ message, data }`, con los saldos, cantidad retirada, promedio conservado, pérdida, marcador y movimiento del contrato CU35. Observación se conserva como texto, no NULL; promedio cero produce pérdida 0.00. Vendible actualizado se consulta con CU22: retirar no vuelve vendibles unidades vencidas/inactivas. Errores 400/401/403/404/409/500 comparten el flujo de CU35, sin rechazo por no estar vencida. Un conflicto o fallo revierte íntegramente.

Tras 404/409/red/500 conserva borrador y requiere reconsulta/revisión explícita, sin reintento automático ni idempotencia completa. La reconsulta reemplaza conjuntamente las precondiciones; si disminuye el saldo, el usuario corrige cantidad. Resultado ofrece CU22/CU24/CU40 y otro retiro con preparación nueva. El movimiento DAÑO es posterior para RN76 y conserva su categoría separada de VENCIMIENTO/AJUSTE. Referencias: RF31/RF39; RN30/RN40/RN64–RN70/RN89–RN92/RN103/RN104 y CU36.

## 12. Cierre y revisión de la sexta entrega

| Caso de uso | Diagramas | Aspecto principal de revisión |
|---|---|---|
| CU33 — Consultar productos próximos a vencer | 1 | Etiqueta normalizada, tres meses calendario, físico positivo y no vencida. |
| CU34 — Consultar productos vencidos | 1 | Fecha efectiva de no venta y físico pendiente, incluidos inactivos. |
| CU35 — Registrar retiro por vencimiento | 1 | Par fresco/bloqueado, corte DIA/MES, observación opcional y salida VENCIMIENTO. |
| CU36 — Registrar retiro por daño | 1 | Observación obligatoria, salida DAÑO sin condición temporal y promedio conservado. |
| **Total de Fase 6** | **4** | **Cuatro CU y cuatro diagramas; alcance implementado completo.** |

**Criterio de comprobación:** una Vista y un Control por CU con operaciones conceptuales respaldadas, atributos relevantes de entidades reales y asociaciones persistentes. Se distingue fecha almacenada, etiqueta y fecha efectiva; alerta consultada frente a nueva preparación de retiro; y saldo físico frente a vendible. Usuario aparece por responsabilidad del movimiento, sin repetir infraestructura en consultas. La pérdida es resultado derivado; el retiro se representa por ExistenciaMedicamento/MovimientoInventario, sin entidades ni métodos de modelo nuevos.

**Validación de esta entrega:** se contrastaron los nombres/números CU33–CU36 con el catálogo oficial y la estructura completa de cada análisis. Los dibujos contienen cuatro Boundary y cuatro Control, con 21 operaciones conceptuales respaldadas por sus correspondencias. Se comprobaron cuatro entidades reales —Medicamento, ExistenciaMedicamento, MovimientoInventario y Usuario— y 50 apariciones de atributos relevantes con sus tipos del modelo general. Las seis apariciones de asociaciones conservan participantes, multiplicidades y significado del CU técnico; Usuario transversal se omite en las consultas y se incorpora por responsabilidad en los retiros.

Se revisaron permisos de consulta/escritura, etiqueta normalizada frente a fecha efectiva, intervalo inclusivo de tres meses calendario, histórico MES conservado e inactivos con saldo físico. Se comprobaron preparación fresca CU22/CU15, par revalidado bajo bloqueo, corte temporal exclusivo de CU35, observación opcional/obligatoria, saldo suficiente, promedio aplicado/conservado y pérdida derivada sin columna ni límite artificial DECIMAL(14,2). También se verificaron transacción, referencias NULL de retiro independiente, errores y reconsulta sin POST automático o garantía de idempotencia.

Los cuatro diagramas se analizaron y renderizaron con Mermaid 11.12.0 y sus capturas se revisaron visualmente: actores → Boundary → Control de izquierda a derecha, entidades a la derecha y cajas sin solapamientos. Los SVG permiten ampliar atributos y multiplicidades. Se comprobaron formato Markdown, tablas, enlaces y rutas. Los hashes SHA-256 de los 29 análisis académicos anteriores, sus 30 diagramas y los seis documentos fuente se conservaron; Git identifica únicamente este documento académico nuevo. La comprobación fue documental y visual, sin conexión a MySQL ni pruebas funcionales del backend.

## 13. Cobertura acumulada y cierre del alcance académico implementado

| Fase | Casos incluidos | CU analizados | Diagramas |
|---|---|---|---|
| 1 — Autenticación, Usuarios y Recuperación | CU01–CU09 | 9 | 10; CU08 con dos variantes |
| 2 — Proveedores y Laboratorios | CU10–CU13 | 4 | 4 |
| 3 — Medicamentos, Principios Activos y Composición | CU14–CU20 | 7 | 7 |
| 4 — Compras | CU25–CU27 | 3 | 3 |
| 5 — Inventario, Ajustes, Movimientos y Stock bajo | CU21–CU24, CU37 y CU40 | 6 | 6 |
| 6 — Vencimientos y Retiros | CU33–CU36 | 4 | 4 |
| **Total** | **33 CU únicos implementados** | **33** | **34** |

Cada caso conserva actores, objetivo, tabla de participantes, diagrama de clases BCE, descripción de relaciones y correspondencia resumida con la implementación. CU08 mantiene variante propia/administrativa; CU11/CU15/CU18/CU19 agrupan sus caminos y permisos. CU24/CU40 conservan análisis/dibujos independientes sobre el mismo flujo. Compras precede a Inventario por el orden de fases acordado, sin renumerar el catálogo.

**Comprobación acumulada:** los 33 identificadores son únicos y coinciden con el alcance implementado del análisis técnico; cada caso tiene un diagrama salvo CU08, con dos. Los 34 dibujos conservan un Boundary y un Control por variante, y todos los análisis mantienen su plantilla completa. Los 30 diagramas de las entregas previas permanecen idénticos a sus versiones verificadas; los cuatro de esta entrega completan el conjunto renderizado en las seis fases. Los ocho casos funcionalmente pendientes del catálogo no tienen análisis ni diagramas anticipados.

**Estado de revisión:** esta entrega completa el análisis académico de los 33 CU implementados y queda para revisión del usuario. El documento técnico independiente mantiene capas, firmas y atributos completos; este documento mantiene abstracciones BCE y atributos relevantes. Las comprobaciones documentales/visuales no representan aceptación funcional adicional ni despliegue. El pendiente operativo de activar/validar el envío de CU09 a un buzón real se conserva conforme a la documentación del proyecto.

## 14. Casos futuros fuera del alcance implementado

CU28–CU32 (Ventas y Recetas), CU38 (reporte de ventas), CU39 (reporte de compras) y CU41 (consultar pérdidas) están funcionalmente pendientes. Su análisis académico se completará cuando exista el diseño o implementación correspondiente; no se presentan como implementados ni se incluyen diagramas anticipados en esta entrega.
