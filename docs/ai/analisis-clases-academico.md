# CADEFAR — ANÁLISIS DE CLASES POR CASO DE USO

Sistema de Información Web para la Administración de Inventario, Ventas y Control de Vencimiento de la Farmacia CADEFAR.

**Materia:** Sistemas de Información I. **Enfoque:** Boundary–Control–Entity (BCE).

> **Entrega 6 — Fase 6:** Vencimientos y Retiros, CU33–CU36.
> **Cobertura acumulada:** los 33 casos de uso implementados y los 34 diagramas previstos; CU08 conserva dos variantes y los CU agrupados distinguen sus caminos dentro del mismo análisis.
> **Estado:** alcance académico implementado completo. La Fase 6 y el cierre acumulado quedan para revisión.

## 0. Alcance y criterios del análisis académico

Este documento explica cómo colaboran las clases de análisis para cumplir los objetivos del usuario:

**Actor → Vista (Boundary) → Control (Control) → Entidades (Entity).**

Se mantienen dos niveles documentales independientes:

| Documento | Nivel y finalidad |
|---|---|
| [Análisis técnico por caso de uso](analisis-clase.md) | Documenta Controllers, Services, Repositories, Validators, middleware, modelos y métodos reales. Es la fuente principal de este análisis. |
| Este documento | Representa interfaces y controles conceptuales, entidades reales y sus colaboraciones esenciales para una presentación académica. |
| [Diagrama de clases general](diagrama-clases.md) | Permite comprobar nombres, atributos, tipos y asociaciones del modelo persistente. |

Las clases **Vista...** y **Control...** son abstracciones de análisis. No se afirma que existan literalmente como clases JavaScript: React utiliza componentes funcionales y las responsabilidades de un Control están distribuidas entre varias piezas del backend. Las tablas de correspondencia identifican el comportamiento real que respalda cada operación conceptual.

### 0.1. Notación y selección de participantes

- `<<actor>>` representa un rol externo: Administrador, Regente o Vendedor. No hay herencia entre actores ni con Usuario; Administrador no hereda automáticamente permisos del Regente.
- `<<boundary>>` representa la interacción: campos temporales, información mostrada y acciones existentes. Una vista conceptual puede corresponder a una página, formulario, diálogo o acción del layout.
- `<<control>>` reúne la coordinación del CU. Solo aparecen operaciones necesarias para ese objetivo, con nombres conceptuales y sin firmas técnicas de Express, Sequelize o Axios.
- `<<entity>>` identifica un modelo real. Se muestran únicamente atributos relevantes; no se agregan métodos de negocio a los modelos. Las funciones de asociación inicial y los métodos heredados de Sequelize quedan fuera del dibujo.
- Los atributos de las entidades conservan los nombres persistentes `snake_case`. Los campos de las vistas usan nombres de interfaz `camelCase`; una contraseña introducida en una vista es temporal y nunca una columna de Usuario.
- Los tipos `VARCHAR_60`, `CHAR_64`, `INT_UNSIGNED`, `TINYINT_UNSIGNED` y `DATETIME_3` abrevian `VARCHAR(60)`, `CHAR(64)`, `INT UNSIGNED`, `TINYINT UNSIGNED` y `DATETIME(3)`. Las vistas usan tipos conceptuales como String, Integer, Boolean y Lista.
- `+` indica una operación disponible y `-`, información interna del participante. Esta notación no afirma que los campos Sequelize sean privados en JavaScript ni que los atributos de entidad se publiquen en una respuesta.
- `-->` une actor e interfaz; `..>` expresa solicitud o utilización entre Vista, Control y Entidades. No representa acceso directo de React a MySQL ni sustituye las capas reales del backend.
- `--` entre entidades representa una asociación del dominio con multiplicidades estructurales. Se conservan `1` y `0..*` donde corresponde; una FK no implica composición UML. No se dibujan rombos ni herencias inexistentes.
- Cada diagrama utiliza `direction LR` para favorecer la lectura de izquierda a derecha. Mermaid determina la posición exacta de las ramas de entidades.
- Un método o entidad condicional se incluye cuando participa en un camino real del CU. Las etiquetas y explicaciones indican su condición; no todos los caminos ejecutan todas las operaciones.

### 0.2. Organización y avance por fases

| Fase | Agrupación funcional | Casos | Estado académico |
|---|---|---|---|
| 1 | Autenticación, Usuarios y Recuperación | CU01–CU09 | Entregada; nueve CU y diez diagramas |
| 2 | Proveedores y Laboratorios | CU10–CU13 | Entregada; cuatro CU y cuatro diagramas |
| 3 | Medicamentos, Principios Activos y Composición | CU14–CU20 | Entregada; siete CU y siete diagramas |
| 4 | Compras | CU25–CU27 | Entregada; tres CU y tres diagramas |
| 5 | Inventario, Ajustes, Movimientos y Stock bajo | CU21–CU24, CU37 y CU40 | Entregada; seis CU y seis diagramas |
| 6 | Vencimientos y Retiros | CU33–CU36 | Elaborada; cuatro CU y cuatro diagramas; revisión pendiente |

Las seis fases cubren los 33 CU implementados y 34 diagramas, conservando la numeración oficial y el orden por módulo acordado. Los ocho CU funcionalmente pendientes se identifican únicamente en la sección final, sin anticipar sus diagramas.

### 0.3. Fuentes y condiciones compartidas de Fase 1

Además del análisis técnico y del diagrama general, se consultan [Casos de uso](casos-uso.md), [Requerimientos](requerimientos.md), [Reglas de negocio](reglas-negocio.md) y [Contexto maestro](contexto-maestro.md), junto con las instrucciones AGENTS del repositorio, backend y frontend.

Las rutas y archivos de las correspondencias se expresan desde la raíz del repositorio. Las referencias a `authService`, `usuarioService` y `recuperacionPasswordService` corresponden a `backend/src/business/services/`; sus Controllers están en `backend/src/presentation/controllers/` y Validators en `backend/src/business/validators/`.

**Acceso:** CU01 y CU09 son públicos. CU02 y CU08 propio requieren sesión válida para cualquiera de los tres roles. CU03–CU07 y CU08 administrativo requieren Administrador. La implementación comprueba cuenta activa y versión de credenciales mediante authMiddleware/authService.getSessionUsuario, y aplica requireRole cuando corresponde. Esta condición transversal se explica aquí sin añadir un Control de autenticación repetido ni entidades ajenas al objetivo de cada CU.

**Seguridad de contraseñas:** toda contraseña nueva cumple complejidad, 8–100 caracteres y máximo 72 bytes UTF-8. Solo se persiste el hash. El navegador administra la cookie HttpOnly; las vistas no conservan JWT. La confirmación de contraseña es una comprobación local y no se envía al backend.

## 1. Fase 1 — Autenticación, Usuarios y Recuperación

### CU01 — Iniciar sesión

**Actor o actores:** Administrador, Regente o Vendedor, sin sesión previa requerida.

**Objetivo:** acceder al sistema con una cuenta activa mediante nombre de usuario y contraseña.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaIniciarSesion | Boundary | Recoge las credenciales y solicita el acceso. |
| ControlIniciarSesion | Control | Valida credenciales, controla fallos/bloqueo y establece la sesión permitida. |
| Usuario | Entity | Representa la cuenta, sus credenciales protegidas y condiciones de acceso. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaIniciarSesion {
        <<boundary>>
        -String nombreUsuario
        -String password
        +enviarCredenciales()
    }
    class ControlIniciarSesion {
        <<control>>
        +iniciarSesion()
        +validarCredenciales()
        +controlarIntentosFallidos()
        +establecerSesion()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 password_hash
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    Administrador --> VistaIniciarSesion
    Regente --> VistaIniciarSesion
    Vendedor --> VistaIniciarSesion
    VistaIniciarSesion ..> ControlIniciarSesion : solicita
    ControlIniciarSesion ..> Usuario : autentica
```

**Descripción de relaciones:** los tres actores utilizan la misma vista. El Control utiliza Usuario para comprobar existencia, actividad, bloqueo y contraseña; el rol se obtiene de la cuenta sin consultar la entidad Rol. No hay una entidad SesionUsuario.

Una contraseña incorrecta incrementa los fallos de una cuenta activa no bloqueada; el tercero bloquea diez minutos. Los intentos durante el bloqueo no lo prolongan. El éxito reinicia el contador cuando corresponde. Solo las credenciales aceptadas permiten establecer sesión; una cuenta inexistente no genera un contador persistido.

**Correspondencia con la implementación:** `frontend/src/features/auth/pages/LoginPage.jsx` y `frontend/src/features/auth/components/LoginForm.jsx` representan la vista. AuthContext coordina la llamada HTTP de login. Las operaciones del Control se respaldan así:

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| iniciarSesion | `authController.login` y `authService.login` coordinan `POST /api/auth/login`. |
| validarCredenciales | `authValidator.validateLogin`, búsqueda por nombre y comprobación de estado/bloqueo y bcrypt dentro del flujo de login. |
| controlarIntentosFallidos | `authService.login` utiliza `usuarioRepository.updateLoginSecurity` ante fallo o limpieza necesaria. |
| establecerSesion | Generación del JWT con ID, rol y versión; el Controller coloca la cookie y devuelve usuario público. |

La restauración al recargar mediante `/api/auth/me` es una solicitud de apoyo distinta y no se añade como método de este Control. Referencias: RF01/RF03; RN05/RN07/RN115.

### CU02 — Cerrar sesión

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** finalizar la sesión actual en el navegador.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaCerrarSesion | Boundary | Ofrece la acción de salida desde las opciones de cuenta. |
| ControlCerrarSesion | Control | Comprueba la sesión actual y coordina su cierre en el navegador. |
| Usuario | Entity | Aporta el estado y versión para comprobar la sesión antes de cerrar. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaCerrarSesion {
        <<boundary>>
        +solicitarCierre()
    }
    class ControlCerrarSesion {
        <<control>>
        +comprobarSesionActual()
        +cerrarSesion()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
    }
    Administrador --> VistaCerrarSesion
    Regente --> VistaCerrarSesion
    Vendedor --> VistaCerrarSesion
    VistaCerrarSesion ..> ControlCerrarSesion : solicita
    ControlCerrarSesion ..> Usuario : comprueba sesion
```

**Descripción de relaciones:** la vista solicita el cierre al Control. Usuario participa únicamente en la comprobación previa de la sesión; no se modifica ni se crea un registro de salida. Cerrar sesión elimina la cookie actual, sin incrementar la versión de credenciales ni revocar todas las posibles copias del token.

**Correspondencia con la implementación:** `frontend/src/layouts/components/AppHeader.jsx`, `AppSidebar.jsx` y `frontend/src/layouts/MainLayout.jsx` representan la acción de interfaz; no existe una página independiente de logout. AuthContext limpia el estado público de autenticación incluso si la solicitud falla.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| comprobarSesionActual | authMiddleware utiliza `authService.getSessionUsuario` y `usuarioRepository.findByIdForSession` antes del Controller. |
| cerrarSesion | `authController.logout` atiende `POST /api/auth/logout` y elimina la cookie mediante clearCookie. |

ControlCerrarSesion es una abstracción que reúne esas responsabilidades; no implica la existencia de `authService.logout`. Referencias: RF02/RF03 y CU02.

### CU03 — Crear usuario

**Actor o actores:** Administrador autenticado.

**Objetivo:** registrar una cuenta con un rol existente y activo, nombre único y contraseña protegida.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaCrearUsuario | Boundary | Recoge nombre, rol, contraseña inicial, confirmación local y correo opcional. |
| ControlCrearUsuario | Control | Valida datos, comprueba unicidad/rol y registra la cuenta con hash. |
| Usuario | Entity | Representa la cuenta creada y su identificación. |
| Rol | Entity | Representa uno de los roles fijos asignables. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaCrearUsuario {
        <<boundary>>
        -String nombreUsuario
        -Integer idRol
        -String password
        -String confirmacionPassword
        -String correo
        +seleccionarRol()
        +comprobarConfirmacion()
        +enviarRegistro()
    }
    class ControlCrearUsuario {
        <<control>>
        +validarDatos()
        +comprobarUnicidad()
        +verificarRolActivo()
        +registrarUsuario()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 correo
        -VARCHAR_255 password_hash
        -BOOLEAN estado
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
        -BOOLEAN estado
    }
    Administrador --> VistaCrearUsuario
    VistaCrearUsuario ..> ControlCrearUsuario : solicita
    ControlCrearUsuario ..> Usuario : registra
    ControlCrearUsuario ..> Rol : valida
    Rol "1" -- "0..*" Usuario : rol
```

**Descripción de relaciones:** el Control utiliza Usuario para verificar el nombre y, si se proporciona, el correo; utiliza Rol para comprobar la asignación permitida. Cada Usuario pertenece a un Rol y un Rol puede estar asociado a cero o más usuarios. Esta asociación no representa herencia de permisos.

La contraseña se transforma en hash antes de persistir. Su confirmación se comprueba localmente y no se envía al backend. El ID y el estado inicial proceden del backend; el actor no los introduce. Correo es opcional y único cuando está presente. No se crea una recuperación al registrar la cuenta.

**Correspondencia con la implementación:** `/usuarios/nuevo`, `frontend/src/features/usuarios/pages/UsuarioFormPage.jsx` y `frontend/src/features/usuarios/components/UsuarioForm.jsx` representan la vista; el servicio HTTP invoca `POST /api/usuarios`.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarDatos | `usuarioController.createUsuario`, `usuarioValidator.validateCreateUsuario` y política compartida de contraseña. |
| comprobarUnicidad | El flujo `usuarioService.createUsuario` busca nombre y correo mediante usuarioRepository; el correo se comprueba solo si no es nulo. |
| verificarRolActivo | Validación del rol mediante `usuarioRepository.findRolById`. |
| registrarUsuario | `usuarioService.createUsuario` aplica bcrypt, registra y consulta lo creado mediante `getUsuarioById` para devolver datos públicos. |

Referencias: RF04/RF05/RF09; RN01–RN07/RN107.

### CU04 — Consultar usuarios

**Actor o actores:** Administrador autenticado.

**Objetivo:** consultar las cuentas registradas, con sus datos públicos, rol y estado.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarUsuarios | Boundary | Muestra el listado y aplica búsqueda y filtro locales. |
| ControlConsultarUsuarios | Control | Obtiene las cuentas y prepara información pública. |
| Usuario | Entity | Representa las cuentas activas e inactivas consultadas. |
| Rol | Entity | Identifica el rol de cada cuenta. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaConsultarUsuarios {
        <<boundary>>
        -String busqueda
        -String filtroEstado
        -Lista usuarios
        +solicitarListado()
        +aplicarFiltrosLocales()
    }
    class ControlConsultarUsuarios {
        <<control>>
        +consultarUsuarios()
        +prepararDatosPublicos()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 correo
        -BOOLEAN estado
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
    }
    Administrador --> VistaConsultarUsuarios
    VistaConsultarUsuarios ..> ControlConsultarUsuarios : solicita
    ControlConsultarUsuarios ..> Usuario : consulta
    ControlConsultarUsuarios ..> Rol : incluye
    Rol "1" -- "0..*" Usuario : rol
```

**Descripción de relaciones:** el Control consulta Usuario con su Rol y entrega el resultado a la vista. El listado conserva cuentas activas e inactivas; vacío es un resultado válido. La búsqueda por nombre/rol y el filtro de estado actúan sobre los datos recibidos en la interfaz, sin crear operaciones adicionales del backend.

**Correspondencia con la implementación:** `/usuarios`, `frontend/src/features/usuarios/pages/UsuariosPage.jsx` y `frontend/src/features/usuarios/components/UsuarioTable.jsx` representan la vista.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| consultarUsuarios | `usuarioController.getUsuarios`, `usuarioService.getUsuarios` y `usuarioRepository.findAllUsuarios` atienden `GET /api/usuarios`, incluyendo Rol. |
| prepararDatosPublicos | Selección de datos y conversión pública del Service; no devuelve password_hash ni información privada de seguridad. |

No se atribuye un Validator específico al listado ni una escritura a sus filtros. Referencias: RF04/RF06 y CU04.

### CU05 — Consultar usuario por ID

**Actor o actores:** Administrador autenticado.

**Objetivo:** obtener los datos públicos de una cuenta específica existente.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarUsuario | Boundary | Solicita y muestra la cuenta identificada en la ruta de edición. |
| ControlConsultarUsuario | Control | Valida el identificador y consulta la cuenta con su rol. |
| Usuario | Entity | Representa la cuenta consultada. |
| Rol | Entity | Aporta el rol asociado a la cuenta. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaConsultarUsuario {
        <<boundary>>
        -Integer idUsuario
        -String nombreUsuario
        -String correo
        -Integer idRol
        +solicitarDatos()
    }
    class ControlConsultarUsuario {
        <<control>>
        +validarIdentificador()
        +consultarUsuario()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 correo
        -BOOLEAN estado
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
    }
    Administrador --> VistaConsultarUsuario
    VistaConsultarUsuario ..> ControlConsultarUsuario : solicita
    ControlConsultarUsuario ..> Usuario : consulta
    ControlConsultarUsuario ..> Rol : incluye
    Rol "1" -- "0..*" Usuario : rol
```

**Descripción de relaciones:** el identificador permite consultar Usuario y su Rol. Si no existe la cuenta, el Control informa que no fue encontrada. La consulta no modifica datos, estado ni contraseña.

**Correspondencia con la implementación:** VistaConsultarUsuario representa la carga inicial de `frontend/src/features/usuarios/pages/UsuarioFormPage.jsx` en `/usuarios/:idUsuario/editar`; no implica una pantalla independiente de detalle. Los valores mostrados preparan CU06, cuya escritura se analiza por separado.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarIdentificador | `usuarioController.getUsuarioById` utiliza el auxiliar de lectura del ID y `usuarioValidator.validateIdUsuario`. |
| consultarUsuario | `usuarioService.getUsuarioById` y `usuarioRepository.findById` obtienen datos públicos con Rol para `GET /api/usuarios/:idUsuario`. |

Referencias: RF04/RF06 y CU05.

### CU06 — Modificar usuario

**Actor o actores:** Administrador autenticado.

**Objetivo:** modificar nombre, rol y/o correo de una cuenta, manteniendo las condiciones de unicidad y seguridad.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaModificarUsuario | Boundary | Permite editar los datos autorizados de una cuenta. |
| ControlModificarUsuario | Control | Valida los cambios y coordina la actualización con sus efectos sobre recuperaciones. |
| Usuario | Entity | Representa la cuenta y los datos modificables. |
| Rol | Entity | Representa la asignación que se valida cuando se proporciona un rol. |
| RecuperacionPassword | Entity | Representa emisiones pendientes que se invalidan ante cambio efectivo o retirada de correo. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaModificarUsuario {
        <<boundary>>
        -Integer idUsuario
        -String nombreUsuario
        -Integer idRol
        -String correo
        +seleccionarRol()
        +enviarCambios()
    }
    class ControlModificarUsuario {
        <<control>>
        +validarCambios()
        +comprobarUnicidadYRol()
        +actualizarUsuario()
        +invalidarRecuperacionesPorCorreo()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
        -VARCHAR_255 correo
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
        -BOOLEAN estado
    }
    class RecuperacionPassword {
        <<entity>>
        -INT id_recuperacion
        -DATETIME_3 consumida_en
        -DATETIME_3 invalidada_en
    }
    Administrador --> VistaModificarUsuario
    VistaModificarUsuario ..> ControlModificarUsuario : solicita
    ControlModificarUsuario ..> Usuario : actualiza
    ControlModificarUsuario ..> Rol : valida rol enviado
    ControlModificarUsuario ..> RecuperacionPassword : si cambia o retira correo
    Rol "1" -- "0..*" Usuario : rol
    Usuario "1" -- "0..*" RecuperacionPassword : recuperacionesPassword
```

**Descripción de relaciones:** cada cuenta conserva un rol y puede tener varias recuperaciones históricas. El Control utiliza RecuperacionPassword únicamente si el correo cambia efectivamente o se retira. Correo omitido se conserva; correo nulo se retira; el mismo correo normalizado no invalida emisiones. Actualización e invalidación aplicable se confirman juntas.

Los chequeos de nombre, correo y rol dependen de los campos proporcionados. El CU no cambia contraseña, estado, versión de credenciales ni cuotas IP. La carga preparatoria corresponde a CU05.

**Correspondencia con la implementación:** `/usuarios/:idUsuario/editar`, `frontend/src/features/usuarios/pages/UsuarioFormPage.jsx` y `frontend/src/features/usuarios/components/UsuarioForm.jsx` representan la vista.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarCambios | `usuarioController.updateUsuario`, `usuarioValidator.validateIdUsuario` y `validateUpdateUsuario` comprueban el PATCH permitido. |
| comprobarUnicidadYRol | `usuarioService.updateUsuario` y sus auxiliares consultan nombre/correo y rol mediante usuarioRepository según los campos enviados. |
| actualizarUsuario | El Service obtiene la cuenta, actualiza y utiliza `getUsuarioById` para devolver la cuenta dentro de la misma operación. |
| invalidarRecuperacionesPorCorreo | `recuperacionPasswordRepository.invalidatePendingByUsuario` se ejecuta si cambia o se retira el correo. |

Referencias: RF04/RF07, RI15; RN04/RN107.

### CU07 — Activar o desactivar usuario

**Actor o actores:** Administrador autenticado.

**Objetivo:** cambiar el estado administrativo de una cuenta conservando su información e historial.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaCambiarEstadoUsuario | Boundary | Identifica la cuenta y permite confirmar el estado solicitado. |
| ControlCambiarEstadoUsuario | Control | Valida el cambio, comprueba existencia y actualiza únicamente el estado. |
| Usuario | Entity | Representa la cuenta cuyo estado cambia. |
| Rol | Entity | Aporta el rol en las lecturas públicas de la cuenta antes y después del cambio. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaCambiarEstadoUsuario {
        <<boundary>>
        -Integer idUsuario
        -Boolean estadoSolicitado
        +confirmarCambioEstado()
    }
    class ControlCambiarEstadoUsuario {
        <<control>>
        +validarCambioEstado()
        +consultarCuenta()
        +cambiarEstado()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
        -BOOLEAN estado
    }
    class Rol {
        <<entity>>
        -INT id_rol
        -VARCHAR_60 nombre
    }
    Administrador --> VistaCambiarEstadoUsuario
    VistaCambiarEstadoUsuario ..> ControlCambiarEstadoUsuario : solicita
    ControlCambiarEstadoUsuario ..> Usuario : cambia estado
    ControlCambiarEstadoUsuario ..> Rol : incluye
    Rol "1" -- "0..*" Usuario : rol
```

**Descripción de relaciones:** el Control utiliza Usuario para verificar y cambiar el estado, y Rol para las lecturas públicas. La desactivación conserva la cuenta e impide acceso en comprobaciones posteriores. El bloqueo temporal de login es una condición diferente del estado administrativo.

Esta operación no cambia contraseña/versión, no reinicia intentos y no elimina recuperaciones. No se incorpora una regla de protección del último Administrador o de prohibición de cambiar el propio estado, porque no está implementada en este flujo.

**Correspondencia con la implementación:** `frontend/src/features/usuarios/pages/UsuariosPage.jsx`, `frontend/src/features/usuarios/components/UsuarioTable.jsx` y `frontend/src/components/ConfirmDialog.jsx` representan selección y confirmación.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarCambioEstado | `usuarioController.updateEstado`, `usuarioValidator.validateIdUsuario` y `validateUpdateEstado`. |
| consultarCuenta | `usuarioService.updateEstado` llama a `getUsuarioById` antes y después del cambio, con Rol incluido. |
| cambiarEstado | `usuarioRepository.updateEstado` actualiza el estado en `PATCH /api/usuarios/:idUsuario/estado`. |

Referencias: RF04/RF08; RN05/RN06.

### CU08 — Cambiar contraseña

El CU conserva dos variantes con permisos y resultados diferentes. Se muestran por separado para distinguir la contraseña actual exigida al cambiar la propia de la intervención administrativa sobre una cuenta seleccionada.

#### Variante A — Cambio propio

**Actor o actores:** Administrador, Regente o Vendedor autenticado.

**Objetivo:** cambiar la contraseña propia, comprobar la actual y mantener la sesión del navegador con credenciales renovadas.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaCambiarContrasenaPropia | Boundary | Recoge contraseña actual, nueva y confirmación local. |
| ControlCambiarContrasenaPropia | Control | Comprueba credenciales, actualiza contraseña y coordina invalidación y renovación. |
| Usuario | Entity | Representa la cuenta autenticada y su seguridad de acceso. |
| RecuperacionPassword | Entity | Representa las recuperaciones pendientes que dejan de ser utilizables. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class Vendedor { <<actor>> }
    class VistaCambiarContrasenaPropia {
        <<boundary>>
        -String passwordActual
        -String passwordNueva
        -String confirmacionPassword
        +comprobarConfirmacion()
        +enviarCambio()
    }
    class ControlCambiarContrasenaPropia {
        <<control>>
        +validarNuevaContrasena()
        +verificarCredencialesActuales()
        +actualizarCredenciales()
        +invalidarRecuperaciones()
        +renovarSesionActual()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -INT id_rol
        -VARCHAR_255 password_hash
        -BOOLEAN estado
        -INT_UNSIGNED version_credenciales
        -INT_UNSIGNED intentos_fallidos_login
        -DATETIME bloqueado_hasta
    }
    class RecuperacionPassword {
        <<entity>>
        -INT id_recuperacion
        -DATETIME_3 consumida_en
        -DATETIME_3 invalidada_en
    }
    Administrador --> VistaCambiarContrasenaPropia
    Regente --> VistaCambiarContrasenaPropia
    Vendedor --> VistaCambiarContrasenaPropia
    VistaCambiarContrasenaPropia ..> ControlCambiarContrasenaPropia : solicita
    ControlCambiarContrasenaPropia ..> Usuario : cambia credenciales
    ControlCambiarContrasenaPropia ..> RecuperacionPassword : invalida pendientes
    Usuario "1" -- "0..*" RecuperacionPassword : recuperacionesPassword
```

**Descripción de relaciones:** el Control usa la cuenta autenticada, sin aceptar un usuario objetivo elegido por el cliente. Revalida actividad y credenciales, cambia hash, incrementa versión y limpia contador/bloqueo; invalida las recuperaciones pendientes de esa cuenta. Estas modificaciones se confirman conjuntamente.

La cookie renovada mantiene esta sesión; las sesiones con la versión anterior dejan de ser válidas. Se utiliza el ID de rol almacenado en Usuario para renovar las credenciales, sin consultar Rol. No se modifican cuotas IP.

**Correspondencia con la implementación:** `frontend/src/features/usuarios/components/ChangeOwnPasswordDialog.jsx`, abierto desde MainLayout, representa la vista. Su confirmación local no forma parte del body de `PATCH /api/usuarios/me/password`.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarNuevaContrasena | `usuarioValidator.validateUpdateOwnPassword` y política compartida de contraseña. |
| verificarCredencialesActuales | `usuarioService.updateOwnPassword` comprueba contraseña actual con bcrypt y vuelve a comprobar actividad, hash y versión. |
| actualizarCredenciales | El Service genera el hash y `usuarioRepository.updatePassword` actualiza contraseña/versión y limpia bloqueo/contador. |
| invalidarRecuperaciones | `recuperacionPasswordRepository.invalidatePendingByUsuario` en la operación de cambio. |
| renovarSesionActual | El Service firma el nuevo token y `usuarioController.updateOwnPassword` renueva la cookie tras el cambio válido. |

Referencias: RF09; RN07/RN115 y CU08.

#### Variante B — Restablecimiento administrativo

**Actor o actores:** Administrador autenticado.

**Objetivo:** establecer una nueva contraseña para una cuenta seleccionada sin conocer ni mostrar la anterior.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaRestablecerContrasenaUsuario | Boundary | Identifica la cuenta y recoge la nueva contraseña con confirmación local. |
| ControlRestablecerContrasenaUsuario | Control | Comprueba existencia, valida contraseña y coordina el restablecimiento. |
| Usuario | Entity | Representa la cuenta objetivo y sus credenciales. |
| Rol | Entity | Aporta el rol en la lectura pública previa de la cuenta objetivo. |
| RecuperacionPassword | Entity | Representa recuperaciones pendientes que se invalidan. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaRestablecerContrasenaUsuario {
        <<boundary>>
        -Integer idUsuario
        -String passwordNueva
        -String confirmacionPassword
        +comprobarConfirmacion()
        +enviarRestablecimiento()
    }
    class ControlRestablecerContrasenaUsuario {
        <<control>>
        +validarSolicitud()
        +consultarCuentaObjetivo()
        +restablecerCredenciales()
        +invalidarRecuperaciones()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
        -VARCHAR_60 nombre_usuario
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
    }
    class RecuperacionPassword {
        <<entity>>
        -INT id_recuperacion
        -DATETIME_3 consumida_en
        -DATETIME_3 invalidada_en
    }
    Administrador --> VistaRestablecerContrasenaUsuario
    VistaRestablecerContrasenaUsuario ..> ControlRestablecerContrasenaUsuario : solicita
    ControlRestablecerContrasenaUsuario ..> Usuario : cambia credenciales
    ControlRestablecerContrasenaUsuario ..> Rol : lectura previa
    ControlRestablecerContrasenaUsuario ..> RecuperacionPassword : invalida pendientes
    Rol "1" -- "0..*" Usuario : rol
    Usuario "1" -- "0..*" RecuperacionPassword : recuperacionesPassword
```

**Descripción de relaciones:** el Administrador actúa sobre la cuenta seleccionada; el actor no es una subclase de Usuario. El Control utiliza Usuario y su Rol en la lectura previa, y coordina el cambio de hash/versión, limpieza de bloqueo/contador e invalidación de recuperaciones. Rol y estado administrativo se conservan.

No se exige contraseña anterior ni se emite cookie de renovación para la cuenta objetivo. Sus sesiones anteriores quedan obsoletas, incluso si el Administrador utiliza esta variante sobre su propia cuenta. La selección desde el listado corresponde a CU04; no se incorpora como consulta independiente de este Control.

**Correspondencia con la implementación:** `frontend/src/features/usuarios/components/ResetPasswordDialog.jsx`, abierto desde el listado de usuarios, representa la vista. El servicio HTTP envía la contraseña nueva con la propiedad `password`; `passwordNueva` es aquí el nombre conceptual del campo.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarSolicitud | `usuarioController.updatePassword`, `usuarioValidator.validateIdUsuario` y `validateUpdatePassword`. |
| consultarCuentaObjetivo | `usuarioService.updatePassword` utiliza `getUsuarioById` antes del cambio, con Rol incluido. |
| restablecerCredenciales | Bcrypt y `usuarioRepository.updatePassword` actualizan hash/versión y limpian bloqueo/contador en el restablecimiento. |
| invalidarRecuperaciones | `recuperacionPasswordRepository.invalidatePendingByUsuario` se confirma junto al cambio. |

La ruta es `PATCH /api/usuarios/:idUsuario/password`. Referencias: RF04/RF09; RN07/RN115 y CU08.

### CU09 — Restablecer contraseña mediante correo electrónico

**Actor o actores:** Administrador, Regente o Vendedor que olvidó su contraseña; acceso público sin sesión previa.

**Objetivo:** establecer una nueva contraseña mediante un código enviado al correo asociado a una cuenta activa.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaRecuperarContrasena | Boundary | Permite solicitar el código y enviarlo con la nueva contraseña. |
| ControlRecuperarContrasena | Control | Coordina solicitud, cuotas, envío, verificación y consumo con cambio de credenciales. |
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
    class VistaRecuperarContrasena {
        <<boundary>>
        -String correo
        -String codigo
        -String passwordNueva
        -String confirmacionPassword
        +solicitarCodigo()
        +comprobarConfirmacion()
        +enviarRestablecimiento()
    }
    class ControlRecuperarContrasena {
        <<control>>
        +validarDatos()
        +controlarCuotas()
        +solicitarCodigo()
        +gestionarEnvioYRespuesta()
        +verificarCodigo()
        +restablecerCredenciales()
        +invalidarRecuperaciones()
    }
    class Usuario {
        <<entity>>
        -INT id_usuario
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
    Administrador --> VistaRecuperarContrasena
    Regente --> VistaRecuperarContrasena
    Vendedor --> VistaRecuperarContrasena
    VistaRecuperarContrasena ..> ControlRecuperarContrasena : solicita
    ControlRecuperarContrasena ..> Usuario : cambia credenciales
    ControlRecuperarContrasena ..> RecuperacionPassword : emite o consume
    ControlRecuperarContrasena ..> LimiteRecuperacionIp : controla cuotas
    Usuario "1" -- "0..*" RecuperacionPassword : recuperacionesPassword
```

**Descripción de relaciones:** cada recuperación pertenece a exactamente un Usuario; una cuenta puede conservar cero o más emisiones históricas. LimiteRecuperacionIp se utiliza para cuotas independientes por ámbito y no tiene FK ni asociación con Usuario o RecuperacionPassword. Se incluye por ser persistencia real de un control de seguridad relevante, sin crear una entidad adicional de correo o sesión.

El dibujo reúne dos operaciones del mismo CU. La verificación del código se realiza al solicitar el restablecimiento; no existe un tercer endpoint de verificación independiente.

| Camino | Responsabilidades y condiciones |
|---|---|
| Solicitar código | Valida correo/cuota IP, comprueba cuenta activa y cuotas de cuenta; cuando corresponde, invalida la emisión anterior y registra código protegido/vigencia. Intenta el correo una vez después de confirmar la emisión. Devuelve respuesta pública genérica también para desconocidos, inactivos y solicitudes suprimidas. |
| Resultado del envío | Un rechazo explícito invalida únicamente esa emisión; un resultado incierto conserva el código hasta vencer. No hay reenvío automático. La espera mínima pública se aplica en el bloque documentado de solicitud admitida, sin afirmar tiempo constante. |
| Restablecer | Valida correo, código y nueva contraseña, consume cuota IP y comprueba cuenta, código y vigencia. Los fallos de verificación se registran; solo una verificación válida permite cambiar credenciales y consumir la emisión. Invalida las demás recuperaciones pendientes. |

El código tiene seis dígitos, diez minutos de vigencia y máximo cinco fallos; no se persiste en claro. Las cuotas de cuenta proceden del historial y las cuotas IP de LimiteRecuperacionIp. Cambiar credenciales incrementa versión y limpia bloqueo/contador de login. No reactiva una cuenta, no cambia el rol ni inicia sesión automáticamente.

**Correspondencia con la implementación:** `/recuperar-contrasena` y `frontend/src/features/auth/pages/RecuperacionPasswordPage.jsx` representan la vista. Sus funciones HTTP están en `frontend/src/features/auth/services/auth.service.js`.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarDatos | `authController.solicitarRecuperacion`/`restablecerPassword` y `recuperacionPasswordValidator.validateSolicitud`/`validateRestablecimiento`; el Service también valida. |
| controlarCuotas | `recuperacionPasswordService.verificarLimiteIp`, cuota IP persistente y consulta del historial de emisiones para cuota de cuenta. |
| solicitarCodigo | `recuperacionPasswordService.solicitarRecuperacion` verifica cuenta/correo, genera protección HMAC y registra emisión/vigencia. |
| gestionarEnvioYRespuesta | Transporte de correo, `invalidarEnvioRechazado` cuando existe rechazo explícito y `esperarRespuesta` en el bloque de solicitud documentado. |
| verificarCodigo | Comprobaciones de correspondencia, vigencia y estado en `restablecerPassword`, mediante auxiliares de verificación; registro de fallos y revalidación antes del consumo. |
| restablecerCredenciales | `recuperacionPasswordService.restablecerPassword` aplica bcrypt, actualiza Usuario y consume la emisión conjuntamente. |
| invalidarRecuperaciones | `invalidatePendingByUsuario` al emitir un nuevo código o tras cambiar válidamente la contraseña; `updateById` invalida una emisión en los caminos de rechazo/fallos aplicables. |

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

**Criterio de comprobación:** contrastar participantes y permisos con el análisis técnico; cada operación conceptual tiene respaldo explícito en su tabla de correspondencia. Los atributos de entidad son subconjuntos del modelo general y las únicas asociaciones persistentes de esta fase son Rol–Usuario y Usuario–RecuperacionPassword, ambas con `1`–`0..*`. LimiteRecuperacionIp permanece sin asociaciones inventadas. No se añaden métodos a las entidades ni clases técnicas a los diagramas BCE.

**Validación de esta entrega:** se comprobaron los nueve nombres/números contra el catálogo, sin duplicados ni ausencias de CU01–CU09, y las dos variantes de CU08. Los diez diagramas contienen diez Boundary y diez Control, con 37 operaciones conceptuales respaldadas por sus correspondencias. Se contrastaron las cuatro entidades participantes —Usuario, Rol, RecuperacionPassword y LimiteRecuperacionIp— con las de cada CU técnico; los 86 atributos contados en sus apariciones son selecciones del modelo general, con nombres/tipos existentes. Se comprobaron permisos, asociaciones y cardinalidades; las entidades no declaran métodos inventados y los diagramas no contienen clases de infraestructura.

Los diez dibujos se analizaron y renderizaron con Mermaid 11.12.0 y se revisaron visualmente sus capturas. Se comprobó la disposición actor → Boundary → Control de izquierda a derecha y ausencia de solapamiento entre cajas. Las entidades asociadas se distribuyen en ramas según el trazado de Mermaid; los SVG permiten ampliar los dibujos de mayor anchura. Se revisaron formato Markdown, enlaces y rutas de correspondencia. Los hashes SHA-256 de los seis documentos fuente se conservaron y Git identifica únicamente este archivo nuevo. La comprobación fue documental y visual, sin conexión a MySQL ni pruebas funcionales del backend.

**Avance al cierre de Fase 1:** nueve de los 33 CU implementados, con diez de los 34 diagramas previstos. La Fase 2 se incorpora a continuación por solicitud de continuidad del usuario.

## 3. Fase 2 — Proveedores y Laboratorios

### 3.1. Condiciones compartidas y relaciones de contexto

Se conservan las convenciones BCE de la primera entrega. En los nombres conceptuales Vista...Proveedor y Control...Proveedor, **Proveedor representa la entidad unificada ProveedorLaboratorio**, que también puede ser un laboratorio. No se introducen clases separadas para ambos tipos.

**Acceso:** CU10, CU12 y CU13 requieren Administrador; CU11 permite Administrador o Regente. Todas las solicitudes requieren sesión válida, cuenta activa y versión de credenciales vigente. La comprobación previa utiliza authMiddleware, authService.getSessionUsuario y usuarioRepository.findByIdForSession; requireRole verifica el rol. Como condición transversal, se explica aquí sin repetir Usuario ni un segundo Control en los cuatro dibujos. Esto no elimina su participación técnica en la autenticación.

**Entidad y datos:** ProveedorLaboratorio tiene ID generado por la base, nombre obligatorio, teléfono/dirección opcionales y estado. Los tipos `VARCHAR_150` y `VARCHAR_30` abrevian `VARCHAR(150)` y `VARCHAR(30)`. Nombre y contactos se recortan; los contactos vacíos se convierten a NULL. Teléfono admite texto de hasta 30 caracteres, sin imponer un patrón numérico. Nombre admite 1–150 caracteres y dirección, hasta 255. No hay restricción de nombre único ni comprobación de duplicados en estas operaciones.

**Relaciones persistentes de contexto:**

| Asociación | Multiplicidades estructurales | Participación en esta fase |
|---|---|---|
| ProveedorLaboratorio — Medicamento | Cada medicamento tiene `1` proveedor/laboratorio; cada proveedor tiene `0..*` medicamentos. | CU10–CU13 no cargan ni modifican la colección. |
| ProveedorLaboratorio — Compra | Cada compra tiene `1` proveedor/laboratorio; cada proveedor tiene `0..*` compras. | CU10–CU13 no cargan ni modifican la colección. |

Las FK no nullable están en Medicamento y Compra. Sus restricciones RESTRICT no implican composición UML. No se dibujan como participantes porque las consultas de esta fase no las incluyen; sus asociaciones se representarán cuando esas entidades participen en sus CU. ProveedorLaboratorio no tiene una FK hacia Usuario ni registra al actor como creador o modificador.

**Estado e historial:** se admite un estado inicial opcional al crear; si la API lo omite, se aplica activo por defecto. Después, la edición normal modifica únicamente nombre/teléfono/dirección, y el cambio de estado tiene una operación específica. Los registros inactivos siguen siendo consultables y editables; se conserva su historial. Las comprobaciones para nuevas compras y asignaciones de medicamentos corresponden a esos flujos consumidores.

RN11 exige al personal comprobar licencia y resolución SEDES. Es una verificación humana: no se agregan atributos, métodos ni entidades de validación automática ante SEDES.

Las correspondencias utilizan `proveedorLaboratorioController`, `proveedorLaboratorioValidator`, `proveedorLaboratorioService` y `proveedorLaboratorioRepository`, documentados en el análisis técnico. La comunicación HTTP de las vistas se realiza mediante `frontend/src/features/proveedores/services/proveedor-laboratorio.service.js` y la configuración API compartida. Referencias comunes: RF03/RF04/RF10; RN09–RN12.

### CU10 — Registrar proveedor o laboratorio

**Actor o actores:** Administrador autenticado.

**Objetivo:** registrar una entidad que suministra medicamentos, con nombre, contactos opcionales y estado inicial.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaRegistrarProveedor | Boundary | Recoge nombre, teléfono, dirección y estado inicial. |
| ControlRegistrarProveedor | Control | Valida la solicitud, registra la entidad y prepara sus datos públicos. |
| ProveedorLaboratorio | Entity | Representa al proveedor o laboratorio registrado. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaRegistrarProveedor {
        <<boundary>>
        -String nombre
        -String telefono
        -String direccion
        -Boolean estado
        +seleccionarEstadoInicial()
        +enviarRegistro()
    }
    class ControlRegistrarProveedor {
        <<control>>
        +validarDatos()
        +registrarProveedor()
        +prepararDatosPublicos()
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -VARCHAR_30 telefono
        -VARCHAR_255 direccion
        -BOOLEAN estado
    }
    Administrador --> VistaRegistrarProveedor
    VistaRegistrarProveedor ..> ControlRegistrarProveedor : solicita
    ControlRegistrarProveedor ..> ProveedorLaboratorio : registra
```

**Descripción de relaciones:** el Administrador introduce los datos en la vista y el Control coordina la creación de ProveedorLaboratorio. El ID no se introduce ni se calcula manualmente. El formulario ofrece estado inicial, activo por defecto; la API admite omitirlo. El estado pertenece a la entidad, no a un tipo diferente de proveedor.

El Control prepara la respuesta a partir del registro recién creado, sin una segunda consulta por ID. Este CU no registra compras ni medicamentos y no exige unicidad del nombre. Tras éxito se vuelve al listado, cuya carga corresponde a CU11; ante error se conserva el borrador.

**Correspondencia con la implementación:** `/proveedores/nuevo`, `frontend/src/features/proveedores/pages/ProveedorLaboratorioFormPage.jsx` en modo create y `frontend/src/features/proveedores/components/ProveedorLaboratorioForm.jsx` representan la vista.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarDatos | `proveedorLaboratorioController.createProveedorLaboratorio` utiliza `proveedorLaboratorioValidator.validateCreate`; admite nombre obligatorio, contactos y estado opcionales, y rechaza campos extra. |
| registrarProveedor | `proveedorLaboratorioService.createProveedorLaboratorio` coordina `proveedorLaboratorioRepository.create`, enviando los campos opcionales presentes. |
| prepararDatosPublicos | La función externa `toPublicProveedorLaboratorio` transforma directamente la instancia creada al DTO público. No es un método del modelo. |

La función HTTP `createProveedorLaboratorio` invoca `POST /api/proveedores-laboratorios`; devuelve 201 con mensaje y datos. Entrada inválida, sesión/permisos o fallo inesperado se comunican como error. Referencias: RF10; RN09–RN11 y CU10.

### CU11 — Consultar proveedores o laboratorios

**Actor o actores:** Administrador o Regente autenticado.

**Objetivo:** consultar el listado de proveedores/laboratorios y los datos de un registro seleccionado.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaConsultarProveedores | Boundary | Representa listado y detalle; muestra datos públicos y aplica filtros locales al listado. |
| ControlConsultarProveedores | Control | Coordina la consulta general o por ID y prepara los datos públicos. |
| ProveedorLaboratorio | Entity | Representa los registros activos e inactivos consultados. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class Regente { <<actor>> }
    class VistaConsultarProveedores {
        <<boundary>>
        -String busqueda
        -String filtroEstado
        -Lista proveedores
        -Integer idProveedorLaboratorio
        +solicitarListado()
        +aplicarFiltrosLocales()
        +solicitarDetalle()
    }
    class ControlConsultarProveedores {
        <<control>>
        +consultarListado()
        +validarIdentificador()
        +consultarProveedor()
        +prepararDatosPublicos()
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -VARCHAR_30 telefono
        -VARCHAR_255 direccion
        -BOOLEAN estado
    }
    Administrador --> VistaConsultarProveedores
    Regente --> VistaConsultarProveedores
    VistaConsultarProveedores ..> ControlConsultarProveedores : solicita
    ControlConsultarProveedores ..> ProveedorLaboratorio : consulta
```

**Descripción de relaciones:** ambos actores utilizan la vista conceptual para solicitar listado o detalle al mismo Control. La vista agrupa las interfaces de consulta del CU, sin afirmar que ambas sean un componente React único. La entidad aporta nombre, contactos y estado; las colecciones de compras/medicamentos no se cargan.

| Camino | Responsabilidades y condiciones |
|---|---|
| Listado | `consultarListado` obtiene todos los registros ordenados por ID ascendente; `prepararDatosPublicos` transforma cada resultado. No valida un ID. Activos/inactivos y un resultado vacío son válidos. |
| Detalle | `validarIdentificador` comprueba el ID antes de `consultarProveedor`; se verifica existencia y se prepara el resultado público. ID inválido produce 400 y registro inexistente, 404. |
| Filtros de interfaz | `aplicarFiltrosLocales` busca por nombre, teléfono o dirección y filtra por estado sobre el listado recibido. No genera una consulta de filtros al backend ni una escritura. |

El Regente consulta; las acciones administrativas del listado/detalle se reservan al Administrador. Se muestran carga, vacío y error cuando corresponde. La lectura por ID también prepara la edición de CU12, sin efectuar su escritura.

**Correspondencia con la implementación:** `/proveedores`, `frontend/src/features/proveedores/pages/ProveedoresPage.jsx` y `frontend/src/features/proveedores/components/ProveedorLaboratorioTable.jsx` representan el listado; `/proveedores/:idProveedorLaboratorio` y `frontend/src/features/proveedores/pages/ProveedorLaboratorioDetailPage.jsx`, el detalle.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| consultarListado | `proveedorLaboratorioController.getProveedoresLaboratorios` → `proveedorLaboratorioService.getProveedoresLaboratorios` → `proveedorLaboratorioRepository.findAll`. |
| validarIdentificador | El Controller utiliza `proveedorLaboratorioValidator.validateId` mediante su auxiliar de lectura del ID, únicamente en el camino por ID. |
| consultarProveedor | `proveedorLaboratorioController.getProveedorLaboratorioById` → `proveedorLaboratorioService.getProveedorLaboratorioById` → `proveedorLaboratorioRepository.findById`; el Service rechaza un registro inexistente. |
| prepararDatosPublicos | Los métodos de consulta del Service utilizan la función externa `toPublicProveedorLaboratorio` para convertir instancia o listado. |

Las funciones HTTP `getProveedoresLaboratorios` y `getProveedorLaboratorio` invocan `GET /api/proveedores-laboratorios` y `GET /api/proveedores-laboratorios/:idProveedorLaboratorio`. Ambas devuelven 200 con datos; sesión/permisos y errores inesperados se manejan por separado. Referencias: RF10; RN09/RN10 y CU11.

### CU12 — Modificar proveedor o laboratorio

**Actor o actores:** Administrador autenticado.

**Objetivo:** actualizar nombre y/o contactos de un proveedor/laboratorio existente, conservando su identidad y estado.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaModificarProveedor | Boundary | Permite editar nombre, teléfono y dirección de la entidad seleccionada. |
| ControlModificarProveedor | Control | Valida los cambios, comprueba existencia y coordina actualización y lectura del resultado. |
| ProveedorLaboratorio | Entity | Representa el registro cuyos datos se actualizan. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaModificarProveedor {
        <<boundary>>
        -Integer idProveedorLaboratorio
        -String nombre
        -String telefono
        -String direccion
        +enviarCambios()
    }
    class ControlModificarProveedor {
        <<control>>
        +validarCambios()
        +consultarProveedor()
        +actualizarDatos()
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -VARCHAR_30 telefono
        -VARCHAR_255 direccion
        -BOOLEAN estado
    }
    Administrador --> VistaModificarProveedor
    VistaModificarProveedor ..> ControlModificarProveedor : solicita
    ControlModificarProveedor ..> ProveedorLaboratorio : actualiza datos
```

**Descripción de relaciones:** la vista identifica el registro y envía los datos editables al Control. Este consulta ProveedorLaboratorio antes de escribir para comprobar existencia y después para devolver el resultado público. Estado se muestra en la entidad como dato conservado: no forma parte de los campos editables de esta vista.

La API admite uno o varios de nombre/teléfono/dirección; un campo omitido se conserva y un contacto nulo o vacío se limpia. El formulario actual envía los tres campos de datos. También se puede editar una entidad inactiva. El ID y las relaciones históricas permanecen; no se exige unicidad del nombre. Las lecturas y actualización son sentencias independientes, sin transacción conjunta explícita del Service.

**Correspondencia con la implementación:** `/proveedores/:idProveedorLaboratorio/editar`, `frontend/src/features/proveedores/pages/ProveedorLaboratorioFormPage.jsx` en modo edit y `frontend/src/features/proveedores/components/ProveedorLaboratorioForm.jsx` representan la vista. La carga inicial utiliza CU11; no se atribuye a esta operación de escritura.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarCambios | `proveedorLaboratorioController.updateProveedorLaboratorio` utiliza `proveedorLaboratorioValidator.validateId` y `validateUpdate`; el PATCH es estricto, no vacío y excluye ID/estado del body. |
| consultarProveedor | `proveedorLaboratorioService.updateProveedorLaboratorio` llama a `getProveedorLaboratorioById` antes y después de escribir; este usa `proveedorLaboratorioRepository.findById` y prepara el DTO público. |
| actualizarDatos | `proveedorLaboratorioService.updateProveedorLaboratorio` coordina `proveedorLaboratorioRepository.update` con los datos permitidos. |

La función HTTP `updateProveedorLaboratorio` invoca `PATCH /api/proveedores-laboratorios/:idProveedorLaboratorio`; devuelve 200 con mensaje y datos. Tras éxito se vuelve al listado; ante error se conserva el borrador. Se manejan entrada inválida, sesión/permisos, inexistencia y fallo inesperado. Referencias: RF10; RN09/RN10 y CU12.

### CU13 — Activar o desactivar proveedor o laboratorio

**Actor o actores:** Administrador autenticado.

**Objetivo:** cambiar el estado administrativo de la entidad conservando su registro, relaciones e historial.

**Clases participantes:**

| Clase | Estereotipo | Responsabilidad |
|---|---|---|
| VistaCambiarEstadoProveedor | Boundary | Identifica la entidad y solicita confirmación del estado objetivo. |
| ControlCambiarEstadoProveedor | Control | Valida el estado, comprueba existencia y coordina el cambio y su resultado. |
| ProveedorLaboratorio | Entity | Representa la entidad que se activa o desactiva. |

**Diagrama de clases:**

```mermaid
classDiagram
    direction LR
    class Administrador { <<actor>> }
    class VistaCambiarEstadoProveedor {
        <<boundary>>
        -Integer idProveedorLaboratorio
        -Boolean estadoSolicitado
        +confirmarCambioEstado()
    }
    class ControlCambiarEstadoProveedor {
        <<control>>
        +validarCambioEstado()
        +consultarProveedor()
        +cambiarEstado()
    }
    class ProveedorLaboratorio {
        <<entity>>
        -INT id_proveedor_laboratorio
        -VARCHAR_150 nombre
        -BOOLEAN estado
    }
    Administrador --> VistaCambiarEstadoProveedor
    VistaCambiarEstadoProveedor ..> ControlCambiarEstadoProveedor : solicita
    ControlCambiarEstadoProveedor ..> ProveedorLaboratorio : cambia estado
```

**Descripción de relaciones:** el Administrador confirma la acción en la vista; el Control consulta la entidad antes y después de cambiar exclusivamente su estado. Nombre identifica el registro seleccionado; los contactos se conservan, aunque no se repitan como atributos relevantes en este dibujo.

La interfaz propone el estado inverso al actual, pero la API recibe un booleano objetivo; el Service no exige que difiera del existente. No se elimina el registro ni se modifican en cascada medicamentos, compras o inventario. Inactivar impide su uso en nuevas compras/asignaciones según los flujos consumidores; no impide vender medicamentos que ya están en inventario. Activar no cambia el estado propio de los medicamentos relacionados.

**Correspondencia con la implementación:** `/proveedores`, `frontend/src/features/proveedores/pages/ProveedoresPage.jsx`, `frontend/src/features/proveedores/components/ProveedorLaboratorioTable.jsx` y `frontend/src/components/ConfirmDialog.jsx` representan selección y confirmación.

| Operación conceptual | Comportamiento real de respaldo |
|---|---|
| validarCambioEstado | `proveedorLaboratorioController.updateEstado` utiliza `proveedorLaboratorioValidator.validateId` y `validateUpdateEstado` para ID positivo y body estricto con estado booleano. |
| consultarProveedor | `proveedorLaboratorioService.updateEstado` llama a `getProveedorLaboratorioById` antes y después del cambio, mediante `proveedorLaboratorioRepository.findById`, y transforma el resultado público. |
| cambiarEstado | `proveedorLaboratorioService.updateEstado` coordina `proveedorLaboratorioRepository.updateEstado`; se modifica únicamente estado, sin transacción conjunta explícita para toda la secuencia. |

La función HTTP `updateEstadoProveedorLaboratorio` invoca `PATCH /api/proveedores-laboratorios/:idProveedorLaboratorio/estado`; devuelve 200 con mensaje y datos. La vista impide envíos duplicados y actualiza la fila con el DTO devuelto, sin un GET adicional inmediato. Ante error muestra el mensaje y cierra la confirmación sin aplicar un cambio local exitoso. Referencias: RF10; RN09/RN10/RN102 y CU13.

## 4. Cierre y revisión de la segunda entrega

| Caso de uso | Diagramas | Aspecto principal de revisión |
|---|---|---|
| CU10 — Registrar proveedor o laboratorio | 1 | Contactos opcionales, estado inicial y ausencia de unicidad de nombre. |
| CU11 — Consultar proveedores o laboratorios | 1 | Listado/detalle, filtros locales y consulta por Administrador o Regente. |
| CU12 — Modificar proveedor o laboratorio | 1 | Solo datos permitidos; lectura de existencia y resultado; estado conservado. |
| CU13 — Activar o desactivar proveedor o laboratorio | 1 | Confirmación, estado objetivo y conservación de relaciones/historial. |
| **Total de Fase 2** | **4** | **Cuatro CU, numeración única CU10–CU13.** |

**Criterio de comprobación:** cada dibujo contiene un Boundary y un Control, con ProveedorLaboratorio como única entidad del objetivo. Las 13 operaciones conceptuales tienen correspondencias explícitas; las 18 apariciones de atributos seleccionados pertenecen a los cinco atributos reales de esa entidad. Los permisos y caminos de CU11 se contrastan con el análisis técnico. Las asociaciones persistentes de contexto conservan `1`–`0..*` y no se convierten en relaciones de composición, cascadas ni métodos del modelo.

**Validación de esta entrega:** se comprobaron los nombres y números CU10–CU13 contra el catálogo oficial, la estructura de los cuatro análisis y las correspondencias de sus 13 operaciones conceptuales. Se contrastaron actores/permisos y las 18 apariciones de atributos con los cinco campos reales de ProveedorLaboratorio; la participación transversal de Usuario queda explicada sin duplicar infraestructura. CU11 conserva los caminos de listado/detalle y su validación de ID condicional. Las multiplicidades de contexto se verificaron contra el análisis técnico y el modelo general, sin asociaciones inventadas en los dibujos.

Los cuatro diagramas se analizaron y renderizaron con Mermaid 11.12.0; se revisaron sus capturas visualmente. Se comprobó la distribución completa actor → Boundary → Control → Entity de izquierda a derecha, sin cajas solapadas ni errores de renderizado. Se verificaron formato Markdown, enlaces y rutas de correspondencia. Los hashes SHA-256 de los diez diagramas académicos de Fase 1 y de los seis documentos fuente se conservaron; Git identifica únicamente este documento académico nuevo. La comprobación fue documental y visual, sin conexión a MySQL ni pruebas funcionales del backend.

**Avance al cierre de Fase 2:** trece de los 33 CU implementados, con catorce de los 34 diagramas previstos. La Fase 3 se incorpora a continuación por solicitud de continuidad del usuario.

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
