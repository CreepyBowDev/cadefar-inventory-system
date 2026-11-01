# CADEFAR — Transacciones del backend en MySQL

**Estado:** Fases 1–4 completadas — inventario, auditoría compartida y traducciones T01–T19/T24. Las traducciones específicas de las Fases 5–6 permanecen pendientes.

Este documento representa en SQL para MySQL las transacciones explícitas del backend actual. Cada entrada se vincula con su implementación; los procedimientos `doc_*` son equivalencias documentales, no procedimientos existentes en la base de datos ni cambios propuestos a la arquitectura.

Fuentes funcionales: `contexto-maestro.md`, `requerimientos.md`, `reglas-negocio.md`, `casos-uso.md` y `bitacora-auditoria.md`. Para auditoría se aplican RF43–RF53, RI16 y RN116–RN133, especialmente RN130/RN132.

## 1. Alcance y organización por fases

Se localizaron **25 puntos de apertura de transacciones** en `backend/src/`. La unidad del inventario es el punto que abre la transacción, no cada llamada, petición, rama condicional o sentencia SQL.

El inventario incluye escrituras y la lectura consistente de página/total de Bitácora. Los auxiliares compartidos se cuentan una sola vez y se identifican sus variantes. Las consultas ordinarias y los INSERT de auditoría que reciben una transacción existente no son nuevas aperturas.

Las migraciones y seeders actuales no contienen aperturas explícitas. Su DDL no se representa como transacción funcional: en MySQL, sentencias como CREATE TABLE o ALTER TABLE pueden provocar confirmaciones implícitas. Las transacciones y savepoints de pruebas pertenecen al arnés de verificación, no a los recorridos funcionales inventariados. Tampoco se cuentan como nuevas transacciones explícitas las sentencias ejecutadas bajo autocommit.

| Fase | Contenido | Estado documental |
|---|---|---|
| 1 | Inventario completo, parámetros y auditoría compartida T24 | Completada; revisión estática |
| 2 | Autenticación y usuarios T01–T06 | Completada; revisión estática |
| 3 | Recuperación T07–T11 | Completada; revisión estática |
| 4 | Proveedores, principios activos y catálogo T12–T19 | Completada; revisión estática |
| 5 | Ajustes, retiros y compras T20–T23 | Pendiente de traducción SQL |
| 6 | Consulta de Bitácora T25, usos posteriores de T24 y cierre integral | Pendiente de traducción SQL |

## 2. Inventario de aperturas

Las referencias de esta tabla son relativas a `backend/src/business/services/`. Las líneas corresponden al estado inspeccionado al crear el documento; el nombre del método identifica la operación si posteriormente se desplazan.

| ID | Operación y método real | Archivo y apertura | Fase SQL |
|---|---|---|---|
| T01 | Inicio de sesión: `authService.login()` | `auth.service.js:45` | 2 |
| T02 | Crear usuario: `usuarioService.createUsuario()` | `usuario.service.js:102` | 2 |
| T03 | Modificar usuario: `usuarioService.updateUsuario()` | `usuario.service.js:151` | 2 |
| T04 | Activar/desactivar usuario: `usuarioService.updateEstado()` | `usuario.service.js:193` | 2 |
| T05 | Restablecimiento administrativo: `usuarioService.updatePassword()` | `usuario.service.js:218` | 2 |
| T06 | Cambio propio de contraseña: `usuarioService.updateOwnPassword()` | `usuario.service.js:259` | 2 |
| T07 | Incrementar cuota IP: `recuperacionPasswordService.verificarLimiteIp()` | `recuperacion-password.service.js:73` | 3 |
| T08 | Invalidar emisión por envío rechazado: `recuperacionPasswordService.invalidarEnvioRechazado()` | `recuperacion-password.service.js:91` | 3 |
| T09 | Emitir recuperación: `recuperacionPasswordService.solicitarRecuperacion()` | `recuperacion-password.service.js:119` | 3 |
| T10 | Verificar código y conservar fallos: primera transacción de `recuperacionPasswordService.restablecerPassword()` | `recuperacion-password.service.js:202` | 3 |
| T11 | Revalidar/consumir código y cambiar contraseña: segunda transacción de `recuperacionPasswordService.restablecerPassword()` | `recuperacion-password.service.js:233` | 3 |
| T12 | Crear proveedor/laboratorio: `proveedorLaboratorioService.createProveedorLaboratorio()` | `proveedor-laboratorio.service.js:25` | 4 |
| T13 | Modificar proveedor/laboratorio: `proveedorLaboratorioService.updateProveedorLaboratorio()` | `proveedor-laboratorio.service.js:59` | 4 |
| T14 | Activar/desactivar proveedor/laboratorio: `proveedorLaboratorioService.updateEstado()` | `proveedor-laboratorio.service.js:76` | 4 |
| T15 | Crear principio activo: `principioActivoService.createPrincipioActivo()` | `principio-activo.service.js:49` | 4 |
| T16 | Modificar principio activo: `principioActivoService.updatePrincipioActivo()` | `principio-activo.service.js:69` | 4 |
| T17 | Activar/desactivar principio activo: `principioActivoService.updateEstado()` | `principio-activo.service.js:93` | 4 |
| T18 | Transacción compartida de identidad/composición: `transaccionCatalogo()` | `identidad-medicamento.js:19` | 4 |
| T19 | Activar/desactivar medicamento: `medicamentoService.updateEstado()` | `medicamento.service.js:234` | 4 |
| T20 | Retiro: auxiliar `ejecutarRetiro()` | `inventario.service.js:149` | 5 |
| T21 | Ajuste: `inventarioService.#registrarAjuste()` | `inventario.service.js:245` | 5 |
| T22 | Registrar compra: `compraService.#createCompra()` | `compra.service.js:362` | 5 |
| T23 | Anular compra: `compraService.#anularCompra()` | `compra.service.js:243` | 5 |
| T24 | Persistir auditoría sin transacción recibida: auxiliar `persistir()` | `bitacora-auditoria.service.js:56` | 1; integración por operación en fases posteriores |
| T25 | Consultar página y total: `bitacoraAuditoriaService.consultar()` | `bitacora-auditoria.service.js:87` | 6 |

### 2.1. Variantes que deben conservarse en las siguientes fases

- **T01:** usuario inexistente, inactivo, bloqueo vigente, contraseña incorrecta, tercer fallo con bloqueo y login exitoso. Un rechazo HTTP no implica necesariamente rollback: el contador/bloqueo puede haber sido confirmado.
- **T07:** ámbitos `solicitud` y `restablecimiento`; la cuota confirmada no se revierte por el posterior rechazo por límite.
- **T10/T11:** son dos transacciones diferentes, con bcrypt entre ellas. No deben fusionarse en una sola transacción de restablecimiento.
- **T18:** `medicamentoService.createMedicamento()` (`medicamento.service.js:143`), `updateMedicamento()` (`:202`) y `composicionMedicamentoService.createComposicion()` (`composicion-medicamento.service.js:41`), `updateComposicion()` (`:83`), `removeComposicion()` (`:108`). El alta integral incluye todos sus componentes; los reintentos internos de código abren nuevas transacciones después del rollback.
- **T20:** `registrarRetiroVencimiento()` y `registrarRetiroDano()` comparten apertura, pero conservan requisitos y motivos distintos.
- **T21:** entrada, salida y conciliación sin diferencia. Esta última registra `INVENTARIO_CONCILIAR` sin crear un movimiento.
- **T23:** B1, A y combinaciones por existencia dentro de una única transacción de anulación.
- **T24:** grupos de uno a diez eventos. Con transacción recibida, el INSERT participa en ella y no abre T24; sin ella, abre una transacción independiente.
- **T25:** página y total comparten snapshot; el evento de consulta sensible se registra después mediante T24.

### 2.2. Aislamiento y propiedad de la transacción

- **T18:** `READ COMMITTED`, explícito en `transaccionCatalogo()`.
- **T25:** `REPEATABLE READ`, explícito en `consultar()`.
- **Resto:** el código no fija un aislamiento por operación y `config.cjs` no establece uno global. Se conserva el aislamiento efectivo de la conexión; no se afirma que todos los entornos utilicen el mismo valor.
- Los Repositories que reciben `transaction` participan en la transacción del Service. `ejecutarCambio()`, `ejecutarSeguridad()` y `registrarCambio()` no abren por sí solos otra transacción.

## 3. Convenciones de traducción a SQL

1. **Motor y versión:** MySQL 8.0.21 o posterior, tablas InnoDB; la referencia de aceptación del proyecto es MySQL 8.0.46. Se utiliza `JSON_VALUE()`, disponible desde 8.0.21.
2. **Parámetros:** `p_*` son parámetros de procedimientos; `v_*`, variables locales; `@*`, variables de sesión suministradas para una llamada. No se incluyen credenciales ni datos reales.
3. **Límites:** quien abre la transacción ejecuta COMMIT o ROLLBACK. Una rutina de inserción compartida no los ejecuta. MySQL no ofrece transacciones anidadas independientes mediante otro START TRANSACTION.
4. **Errores:** los procedimientos propietarios usarán un handler con ROLLBACK y, cuando corresponda, RESIGNAL. Un error de sentencia no garantiza por sí solo rollback de toda la transacción. Los códigos HTTP y los diagnósticos sanitizados siguen perteneciendo al backend.
5. **Aislamiento:** cuando sea explícito se expresará con SET TRANSACTION ISOLATION LEVEL antes de START TRANSACTION. Los bloqueos se traducirán según cada Repository, respetando su orden real.
6. **Identificadores:** AUTO_INCREMENT y LAST_INSERT_ID(), nunca MAX(id) + 1. Los correlativos de códigos funcionales se documentarán aparte según su implementación.
7. **Datos calculados fuera de MySQL:** bcrypt, firma/verificación JWT, HMAC, generación criptográfica, normalización IP, validación/sanitización de eventos y envío de correo se identifican como entradas o pasos externos. No se sustituyen por SHA2 ni por funciones SQL inventadas.
8. **Fechas:** los parámetros de auditoría son texto UTC `YYYY-MM-DD HH:mm:ss.SSS` preparado por el servidor, convertido con STR_TO_DATE. No se cambia el huso de la sesión ni se reinterpretan fechas históricas. Las fases de Compras/Inventario conservarán su convención comercial propia.
9. **Procedimientos documentales:** los CREATE PROCEDURE expresan el flujo en SQL real. DELIMITER es una directiva del cliente MySQL, no una sentencia enviada al servidor. Su definición se separa de las llamadas transaccionales, porque el DDL puede confirmar implícitamente.

## 4. SQL compartido de auditoría

### 4.1. Contrato de entrada y correspondencia

Fuentes:

- `backend/src/business/services/bitacora-auditoria.service.js`: `persistir()`, `registrarEventos()`, `intentarRegistrar()` y `registrarCambio()`.
- `backend/src/business/validators/auditoria.validator.js`: `prepararEventoAuditoria()`.
- `backend/src/shared/constants/auditoria.js`: catálogo y obligatoriedad transaccional por evento.
- `backend/src/data/repositories/bitacora-auditoria.repository.js`: `create()`.
- `backend/src/data/models/bitacora-auditoria.js` y migración `20261013120000-create-bitacora-auditoria.js`: columnas, tipos, índices y CHECK.

`p_eventos` es un arreglo JSON de uno a diez objetos **ya preparados y sanitizados**, con las claves snake_case devueltas por `prepararEventoAuditoria()`. No es un body HTTP. Sus campos opcionales se expresan con null o se omiten; los cuatro campos JSON se convierten a NULL SQL si contienen null JSON.

El backend comprueba previamente catálogo, identidades, causas, perfiles, fechas, IP, ausencia de duplicados del grupo, máximo de 100 referencias y 32 KiB combinados de JSON por evento. La preparación captura un mismo instante de registro para el grupo. Estas comprobaciones son precondiciones de los procedimientos documentales, no nuevas validaciones que se atribuyan al esquema MySQL. La tabla conserva sus propios CHECK y el UNIQUE `(correlacion, tipo_evento)` como barreras adicionales.

La tabla tiene 26 columnas: el INSERT especifica las 25 que prepara el backend; `id_evento` lo genera MySQL. Los hashes/HMAC mencionados para futuras transacciones de credenciales nunca forman parte de este arreglo de auditoría.

### 4.2. Inserción del grupo dentro de una transacción existente

Esta rutina equivale al bucle `insertar(transaction)` y a `bitacoraAuditoriaRepository.create()`. Inserta secuencialmente y obtiene el ID tras cada INSERT, como el código actual. Requiere una transacción activa, propiedad del llamador; no abre otra ni confirma resultados. Si falla, el error se propaga al propietario para revertir el conjunto.

```sql
DELIMITER $$

CREATE PROCEDURE doc_auditoria_insertar_grupo(
    IN p_eventos JSON,
    OUT p_ids JSON
)
BEGIN
    DECLARE v_indice INT DEFAULT 0;
    DECLARE v_cantidad INT;
    DECLARE v_evento JSON;
    DECLARE v_id INT;

    IF p_eventos IS NULL OR JSON_TYPE(p_eventos) <> 'ARRAY' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Se requiere un grupo de eventos';
    END IF;
    SET v_cantidad = JSON_LENGTH(p_eventos);
    IF v_cantidad < 1 OR v_cantidad > 10 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Grupo de auditoria fuera de rango';
    END IF;

    SET p_ids = JSON_ARRAY();
    WHILE v_indice < v_cantidad DO
        SET v_evento = JSON_EXTRACT(p_eventos, CONCAT('$[', v_indice, ']'));

        INSERT INTO bitacora_auditoria (
            tipo_evento, modulo, accion, resultado, causa,
            fecha_registro, fecha_evento,
            id_usuario_responsable, nombre_usuario_responsable, id_rol_responsable,
            id_usuario_objetivo, nombre_usuario_objetivo, id_rol_objetivo,
            nombre_ingresado, direccion_ip, procedencia_ip,
            tipo_registro, id_registro, correlacion, id_evento_relacionado,
            version_formato, antes, despues, metadatos, referencias
        ) VALUES (
            JSON_VALUE(v_evento, '$.tipo_evento' RETURNING CHAR(80)),
            JSON_VALUE(v_evento, '$.modulo' RETURNING CHAR(32)),
            JSON_VALUE(v_evento, '$.accion' RETURNING CHAR(60)),
            JSON_VALUE(v_evento, '$.resultado' RETURNING CHAR(12)),
            JSON_VALUE(v_evento, '$.causa' RETURNING CHAR(64)),
            STR_TO_DATE(JSON_VALUE(v_evento, '$.fecha_registro' RETURNING CHAR(23)), '%Y-%m-%d %H:%i:%s.%f'),
            STR_TO_DATE(JSON_VALUE(v_evento, '$.fecha_evento' RETURNING CHAR(23)), '%Y-%m-%d %H:%i:%s.%f'),
            JSON_VALUE(v_evento, '$.id_usuario_responsable' RETURNING SIGNED),
            JSON_VALUE(v_evento, '$.nombre_usuario_responsable' RETURNING CHAR(60)),
            JSON_VALUE(v_evento, '$.id_rol_responsable' RETURNING SIGNED),
            JSON_VALUE(v_evento, '$.id_usuario_objetivo' RETURNING SIGNED),
            JSON_VALUE(v_evento, '$.nombre_usuario_objetivo' RETURNING CHAR(60)),
            JSON_VALUE(v_evento, '$.id_rol_objetivo' RETURNING SIGNED),
            JSON_VALUE(v_evento, '$.nombre_ingresado' RETURNING CHAR(60)),
            JSON_VALUE(v_evento, '$.direccion_ip' RETURNING CHAR(45)),
            JSON_VALUE(v_evento, '$.procedencia_ip' RETURNING CHAR(24)),
            JSON_VALUE(v_evento, '$.tipo_registro' RETURNING CHAR(32)),
            JSON_VALUE(v_evento, '$.id_registro' RETURNING SIGNED),
            JSON_VALUE(v_evento, '$.correlacion' RETURNING CHAR(32)),
            JSON_VALUE(v_evento, '$.id_evento_relacionado' RETURNING SIGNED),
            JSON_VALUE(v_evento, '$.version_formato' RETURNING UNSIGNED),
            CASE WHEN JSON_TYPE(JSON_EXTRACT(v_evento, '$.antes')) = 'NULL'
                THEN NULL ELSE JSON_EXTRACT(v_evento, '$.antes') END,
            CASE WHEN JSON_TYPE(JSON_EXTRACT(v_evento, '$.despues')) = 'NULL'
                THEN NULL ELSE JSON_EXTRACT(v_evento, '$.despues') END,
            CASE WHEN JSON_TYPE(JSON_EXTRACT(v_evento, '$.metadatos')) = 'NULL'
                THEN NULL ELSE JSON_EXTRACT(v_evento, '$.metadatos') END,
            CASE WHEN JSON_TYPE(JSON_EXTRACT(v_evento, '$.referencias')) = 'NULL'
                THEN NULL ELSE JSON_EXTRACT(v_evento, '$.referencias') END
        );

        SET v_id = LAST_INSERT_ID();
        SET p_ids = JSON_ARRAY_APPEND(p_ids, '$', v_id);
        SET v_indice = v_indice + 1;
    END WHILE;
END$$

DELIMITER ;
```

**Integración en el negocio:** el propietario ejecuta sus consultas y modificaciones, llama a esta rutina y solo después confirma. Las fases siguientes incluirán esos cuerpos completos con su handler. Esta llamada es un fragmento dentro de esa transacción, no una transacción independiente:

```sql
-- @eventos_preparados contiene los eventos de la operacion en curso.
-- La transaccion del negocio ya esta activa en esta misma conexion.
CALL doc_auditoria_insertar_grupo(@eventos_preparados, @ids_eventos);
```

Obtener `@ids_eventos` no acredita COMMIT. Si falla la auditoría obligatoria, el propietario revierte también el negocio; `registrarEventos()` traduce el fallo a 503 sanitizado. No se introduce un COMMIT entre el cambio de negocio y su evento.

### 4.3. T24 — Persistencia en transacción independiente

Se utiliza cuando `persistir()` no recibe una transacción. `registrarEventos()` propaga los fallos y `intentarRegistrar()` devuelve `NO_CONFIRMADO` conservando la respuesta original. La siguiente rutina reúne ambos tratamientos mediante `p_conservar_respuesta`: FALSE representa el primero y TRUE, el segundo. Es un parámetro documental, no un campo del contrato HTTP.

La comprobación de éxito crítico se realiza antes del handler que puede conservar la respuesta: un uso indebido de `intentarRegistrar()` con un éxito que exige transacción de negocio debe fallar, no convertirse silenciosamente en `NO_CONFIRMADO`.

```sql
DELIMITER $$

CREATE PROCEDURE doc_auditoria_independiente(
    IN p_eventos JSON,
    IN p_conservar_respuesta BOOLEAN,
    OUT p_estado VARCHAR(16),
    OUT p_ids JSON
)
BEGIN
    DECLARE v_indice INT DEFAULT 0;
    DECLARE v_evento JSON;

    SET p_estado = 'NO_CONFIRMADO';
    SET p_ids = JSON_ARRAY();

    -- Precondicion: arreglo preparado de 1 a 10 eventos y modo TRUE/FALSE.
    -- Este catalogo reproduce transaccionExito de auditoria.js.
    WHILE v_indice < JSON_LENGTH(p_eventos) DO
        SET v_evento = JSON_EXTRACT(p_eventos, CONCAT('$[', v_indice, ']'));
        IF JSON_VALUE(v_evento, '$.resultado') = 'EXITO'
           AND JSON_VALUE(v_evento, '$.tipo_evento') IN (
               'LOGIN_EXITO',
               'PASSWORD_RESTABLECER_RECUPERACION',
               'PASSWORD_CAMBIAR_PROPIA',
               'PASSWORD_RESTABLECER_ADMINISTRADOR',
               'USUARIO_CREAR', 'USUARIO_MODIFICAR', 'USUARIO_ESTADO',
               'PROVEEDOR_LABORATORIO_CREAR',
               'PROVEEDOR_LABORATORIO_MODIFICAR',
               'PROVEEDOR_LABORATORIO_ESTADO',
               'PRINCIPIO_ACTIVO_CREAR', 'PRINCIPIO_ACTIVO_MODIFICAR', 'PRINCIPIO_ACTIVO_ESTADO',
               'MEDICAMENTO_CREAR', 'MEDICAMENTO_MODIFICAR', 'MEDICAMENTO_ESTADO',
               'COMPOSICION_AGREGAR', 'COMPOSICION_MODIFICAR', 'COMPOSICION_RETIRAR',
               'COMPRA_REGISTRAR', 'COMPRA_ANULAR',
               'INVENTARIO_AJUSTAR', 'INVENTARIO_CONCILIAR',
               'INVENTARIO_RETIRAR_VENCIMIENTO', 'INVENTARIO_RETIRAR_DANO'
           ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'El exito critico requiere la transaccion de negocio';
        END IF;
        SET v_indice = v_indice + 1;
    END WHILE;

    BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
            SET p_estado = 'NO_CONFIRMADO';
            SET p_ids = JSON_ARRAY();
            IF NOT p_conservar_respuesta THEN
                RESIGNAL;
            END IF;
        END;

        -- Se invoca sin otra transaccion activa; no es una transaccion anidada.
        START TRANSACTION;
        CALL doc_auditoria_insertar_grupo(p_eventos, p_ids);
        COMMIT;
        SET p_estado = 'CONFIRMADO';
    END;
END$$

DELIMITER ;
```

Llamada equivalente a `intentarRegistrar()` para un grupo preparado no obligatorio, después de terminar la transacción de origen o de materializar un hecho externo:

```sql
CALL doc_auditoria_independiente(
    @eventos_preparados, TRUE, @estado_auditoria, @ids_eventos
);
SELECT @estado_auditoria AS estado_auditoria, @ids_eventos AS ids_eventos;
```

Para representar `registrarEventos()` sin transacción recibida, se utiliza la misma llamada con FALSE; su fallo se propaga y el backend lo traduce a 503. El diagnóstico `AUDITORIA_PERSISTENCIA_NO_CONFIRMADA` se emite sanitizado desde la aplicación, no se inventa otra tabla SQL de errores.

**Reglas de esta apertura:**

- Todos los INSERT del grupo se confirman juntos o se revierten. No hay INSERT IGNORE, UPSERT, reutilización del ID ni reintento automático ante un duplicado.
- T24 puede registrar el tercer intento fallido y el bloqueo en el mismo grupo, con correlación compartida y tipos distintos. El vínculo no requiere rellenar `id_evento_relacionado`; el backend admite ese atributo, pero no lo asigna automáticamente al insertar el grupo.
- `NO_CONFIRMADO` significa que no se confirmó la persistencia, no que se demostró ausencia del evento. Un COMMIT enviado cuya respuesta se pierde puede haber persistido; ningún procedimiento puede comunicar su resultado si se pierde la conexión. La incertidumbre de transporte y la traducción HTTP las resuelve el backend.
- Un fallo exclusivo de T24 no revierte un contador/bloqueo, cuota o emisión ya confirmados, un logout ni una lectura sensible materializada. No se intenta compensarlos desde esta rutina.
- El evento de éxito crítico usa la rutina de 4.2 dentro de su transacción; no la apertura independiente de 4.3.

## 5. Comprobación y cierre de Fase 1

- Inventariados los 25 puntos de apertura de `backend/src/`, incluyendo la lectura T25 y los auxiliares compartidos.
- Identificadas las cinco llamadas de T18 y las dos variantes de T20 para su desarrollo posterior, sin contarlas como nuevos puntos de apertura.
- Contrastadas las 25 columnas del INSERT con modelo/migración y las 25 clases de éxito crítico con `CATALOGO_AUDITORIA`.
- Revisada la separación entre transacción recibida e independiente, la política de errores, NULL JSON/SQL y fechas UTC.
- Comprobación documental y estática; los procedimientos no se han creado ni ejecutado en MySQL. La revisión no acredita ejecución, rollback ni concurrencia reales del SQL documental.
- La comprobación de cobertura SQL de todas las operaciones corresponde al cierre de Fase 6. En Fase 1 solo se desarrolla el SQL compartido de T24; el resto queda identificado, no traducido todavía.

## 6. Fase 2 — Autenticación y usuarios

Fuentes: `auth.service.js`, `usuario.service.js`, `usuario.repository.js`, `recuperacion-password.repository.js`, modelos `Usuario`/`Rol`/`RecuperacionPassword`, `security.js`, `credenciales.js`, `jwt.js`, validadores de usuario/contraseña y `auditoria-catalogo.js`. Se aplican CU01/CU03/CU06–CU08, RF01/RF05/RF07–RF09, RN01–RN08 y RN107/RN115, además de las reglas de auditoría de la sección 4.

### 6.1. Parámetros y pasos externos de esta fase

- La autenticación/autorización HTTP ya fue comprobada por el backend: T02–T05 requieren Administrador; T06 utiliza el ID y la versión de la sesión del usuario. Un ID o booleano del cliente no sustituye esas comprobaciones.
- Las entradas ya cumplen los validadores actuales. `correo` llega normalizado por el backend; omisión y null son distintos en T03. La contraseña nueva cumple complejidad y máximo de 72 bytes UTF-8; a SQL solo llega su hash bcrypt.
- `p_evento` y `p_eventos` son eventos internos preparados según 4.1, con tipo/módulo/acción, identidad del responsable, correlación e instantes del servidor correspondientes a la operación. Las rutinas SQL completan únicamente los datos obtenidos dentro de la transacción. No aceptan cuerpos HTTP ni reemplazan el filtrado por perfiles.
- `p_invalidada_en` y `p_ahora` representan instantes capturados por el backend en el punto indicado y serializados según la conexión Sequelize existente. No se reemplazan por fechas comerciales ni se altera la zona de la sesión. Las fechas de auditoría conservan su texto UTC independiente.
- Cuando bcrypt o la firma JWT ocurren **dentro** de una transacción, se separan apertura y cierre en dos procedimientos documentales. Ambos se ejecutan en la **misma conexión**, sin liberarla, sin otra apertura y sin COMMIT intermedio. Las variables `@t01_*` son estado interno de esa conexión, nunca campos públicos.
- Si un paso externo falla mientras la transacción está abierta, el backend ejecuta ROLLBACK antes de auditar el fallo. Un flag de firma completada representa el resultado de una llamada real a `generarToken()`, no una función criptográfica de MySQL ni un permiso enviado por el cliente.
- No se añade SET TRANSACTION ISOLATION LEVEL a T01–T06: estas operaciones heredan el aislamiento efectivo como en el código.

### 6.2. Lectura pública y auditoría de usuarios reutilizadas por T02–T04

`doc_usuario_leer_publico()` representa `findById()` con la relación Rol; no adquiere FOR UPDATE ni abre una transacción. `doc_usuario_auditar_cambio()` representa `snapshotUsuario()`, `cuentaAuditoriaUsuario()`, `camposModificadosAuditoria()` y la inserción de `registrarCambio()`. El JSON de auditoría nunca incluye hash ni valores de correo; `correoAsignado` es solo un booleano. La lectura pública sí conserva el correo permitido por el DTO. En un alta no hay snapshot anterior ni lista de campos modificados; en una modificación se conserva esa lista, incluido el nombre `correo` cuando cambió su valor.

```sql
DELIMITER $$

CREATE PROCEDURE doc_usuario_leer_publico(IN p_id INT, OUT p_usuario JSON)
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET p_usuario = NULL;
    SET p_usuario = NULL;
    SELECT JSON_OBJECT(
        'idUsuario', u.id_usuario, 'nombreUsuario', u.nombre_usuario, 'correo', u.correo,
        'estado', JSON_EXTRACT(IF(u.estado, 'true', 'false'), '$'),
        'rol', JSON_OBJECT('idRol', r.id_rol, 'nombre', r.nombre,
            'descripcion', r.descripcion,
            'estado', JSON_EXTRACT(IF(r.estado, 'true', 'false'), '$'))
    ) INTO p_usuario
    FROM usuario AS u LEFT JOIN rol AS r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = p_id;
    IF p_usuario IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario no encontrado';
    END IF;
END$$

CREATE PROCEDURE doc_usuario_auditar_cambio(
    IN p_evento JSON, IN p_antes JSON, IN p_despues JSON, IN p_cambio_correo BOOLEAN
)
BEGIN
    DECLARE v_antes JSON DEFAULT NULL;
    DECLARE v_despues JSON;
    DECLARE v_evento JSON;
    DECLARE v_campos JSON;
    DECLARE v_claves JSON;
    DECLARE v_clave VARCHAR(32);
    DECLARE v_i INT DEFAULT 0;
    DECLARE v_ids JSON;

    SET v_despues = JSON_OBJECT(
        'nombreUsuario', JSON_EXTRACT(p_despues, '$.nombreUsuario'),
        'idRol', JSON_EXTRACT(p_despues, '$.rol.idRol'),
        'estado', JSON_EXTRACT(p_despues, '$.estado'),
        'correoAsignado', JSON_EXTRACT(IF(
            COALESCE(CHAR_LENGTH(JSON_VALUE(p_despues, '$.correo')), 0) > 0,
            'true', 'false'), '$')
    );
    SET v_evento = JSON_SET(p_evento,
        '$.tipo_registro', 'USUARIO',
        '$.id_registro', JSON_EXTRACT(p_despues, '$.idUsuario'),
        '$.id_usuario_objetivo', JSON_EXTRACT(p_despues, '$.idUsuario'),
        '$.nombre_usuario_objetivo', JSON_EXTRACT(p_despues, '$.nombreUsuario'),
        '$.id_rol_objetivo', JSON_EXTRACT(p_despues, '$.rol.idRol'),
        '$.antes', NULL, '$.despues', v_despues,
        '$.metadatos', JSON_OBJECT('efecto', 'CONFIRMADO')
    );
    IF p_antes IS NOT NULL THEN
        SET v_antes = JSON_OBJECT(
            'nombreUsuario', JSON_EXTRACT(p_antes, '$.nombreUsuario'),
            'idRol', JSON_EXTRACT(p_antes, '$.rol.idRol'),
            'estado', JSON_EXTRACT(p_antes, '$.estado'),
            'correoAsignado', JSON_EXTRACT(IF(
                COALESCE(CHAR_LENGTH(JSON_VALUE(p_antes, '$.correo')), 0) > 0,
                'true', 'false'), '$')
        );
        SET v_campos = JSON_ARRAY();
        SET v_claves = JSON_ARRAY('nombreUsuario', 'idRol', 'estado', 'correoAsignado');
        WHILE v_i < JSON_LENGTH(v_claves) DO
            SET v_clave = JSON_UNQUOTE(JSON_EXTRACT(v_claves, CONCAT('$[', v_i, ']')));
            -- Comparacion exacta de los valores de snapshot, como !== en JavaScript.
            IF NOT (CAST(JSON_EXTRACT(v_antes, CONCAT('$.', v_clave)) AS BINARY)
                <=> CAST(JSON_EXTRACT(v_despues, CONCAT('$.', v_clave)) AS BINARY)) THEN
                SET v_campos = JSON_ARRAY_APPEND(v_campos, '$', v_clave);
            END IF;
            SET v_i = v_i + 1;
        END WHILE;
        IF p_cambio_correo THEN
            SET v_campos = JSON_ARRAY_APPEND(v_campos, '$', 'correo');
        END IF;
        SET v_evento = JSON_SET(v_evento, '$.antes', v_antes,
            '$.metadatos.camposModificados', v_campos);
    END IF;
    CALL doc_auditoria_insertar_grupo(JSON_ARRAY(v_evento), v_ids);
END$$

DELIMITER ;
```

### 6.3. T01 — Inicio de sesión, contador y bloqueo

**Origen:** `authService.login()` y `usuarioRepository.findByNombreUsuario()`/`updateLoginSecurity()`.

La primera rutina abre T01 y deja bloqueada la cuenta. La búsqueda conserva la colación de `nombre_usuario`, como Sequelize. La ausencia se maneja sin crear cuenta ni contador.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t01_abrir(IN p_nombre VARCHAR(60))
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET @t01_id = NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET @t01_id = NULL, @t01_rol = NULL, @t01_nombre = NULL, @t01_hash = NULL,
        @t01_estado = NULL, @t01_version = NULL, @t01_intentos = NULL,
        @t01_bloqueado_hasta = NULL;
    START TRANSACTION;
    SELECT id_usuario, id_rol, nombre_usuario, password_hash, estado,
        version_credenciales, intentos_fallidos_login, bloqueado_hasta
    INTO @t01_id, @t01_rol, @t01_nombre, @t01_hash, @t01_estado,
        @t01_version, @t01_intentos, @t01_bloqueado_hasta
    FROM usuario WHERE nombre_usuario = p_nombre LIMIT 1 FOR UPDATE;
    -- Se mantiene abierta la transaccion al regresar al backend.
END$$

CREATE PROCEDURE doc_t01_cerrar(
    IN p_ahora DATETIME(3),
    IN p_password_correcta BOOLEAN,
    IN p_firma_completada BOOLEAN,
    IN p_eventos JSON,
    OUT p_resultado VARCHAR(32),
    OUT p_bloqueado_hasta DATETIME(3)
)
BEGIN
    DECLARE v_intentos BIGINT UNSIGNED;
    DECLARE v_ids JSON;
    DECLARE v_estado_auditoria VARCHAR(16);

    BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
            RESIGNAL;
        END;

        SET p_bloqueado_hasta = NULL;
        IF @t01_id IS NULL THEN
            SET p_resultado = 'INVALID_CREDENTIALS';
        ELSEIF NOT @t01_estado THEN
            SET p_resultado = 'INACTIVE';
        ELSEIF @t01_bloqueado_hasta IS NOT NULL AND @t01_bloqueado_hasta > p_ahora THEN
            SET p_resultado = 'BLOCKED';
            SET p_bloqueado_hasta = @t01_bloqueado_hasta;
        ELSE
            IF p_password_correcta IS NULL THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falta el resultado bcrypt';
            END IF;
            IF NOT p_password_correcta THEN
                SET v_intentos = IF(@t01_bloqueado_hasta IS NOT NULL, 0, @t01_intentos) + 1;
                SET p_bloqueado_hasta = IF(v_intentos >= 3,
                    DATE_ADD(p_ahora, INTERVAL 10 MINUTE), NULL);
                UPDATE usuario SET intentos_fallidos_login = v_intentos,
                    bloqueado_hasta = p_bloqueado_hasta WHERE id_usuario = @t01_id;
                SET p_resultado = IF(v_intentos >= 3, 'BLOCKED', 'INVALID_CREDENTIALS');
            ELSE
                -- JWT ya firmado en memoria usando los datos de la fila bloqueada.
                IF p_firma_completada IS NULL OR NOT p_firma_completada THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pudo generar la sesion';
                END IF;
                IF @t01_intentos > 0 OR @t01_bloqueado_hasta IS NOT NULL THEN
                    UPDATE usuario SET intentos_fallidos_login = 0,
                        bloqueado_hasta = NULL WHERE id_usuario = @t01_id;
                END IF;
                CALL doc_auditoria_insertar_grupo(p_eventos, v_ids);
                SET p_resultado = 'SUCCESS';
            END IF;
        END IF;
        COMMIT;
    END;

    -- Fuera de T01: nunca se deshace un contador o bloqueo confirmado.
    IF p_resultado <> 'SUCCESS' THEN
        CALL doc_auditoria_independiente(p_eventos, TRUE, v_estado_auditoria, v_ids);
    END IF;
END$$

DELIMITER ;
```

**Secuencia de uso:** llamar a `doc_t01_abrir()`. Bajo ese bloqueo, el backend captura identidad y fecha del evento; para una cuenta activa captura el instante `p_ahora` y comprueba bloqueo. Solo si no hay bloqueo vigente ejecuta bcrypt contra `@t01_hash`; si coincide, firma JWT con `@t01_id`, `@t01_rol` y `@t01_version`. Después prepara el grupo correspondiente y llama a `doc_t01_cerrar()` en la misma conexión, pasando el mismo instante anterior a bcrypt. No se calcula la contraseña antes del bloqueo ni se firma para cuentas inexistentes, inactivas o bloqueadas.

| Rama | Grupo preparado para `p_eventos` | Resultado posterior al COMMIT |
|---|---|---|
| Nombre inexistente | `LOGIN_USUARIO_INEXISTENTE`, RECHAZADO/USUARIO_INEXISTENTE; sin identidades ficticias | 401 genérico |
| Cuenta inactiva | `LOGIN_USUARIO_INACTIVO`, RECHAZADO/USUARIO_INACTIVO | 403 |
| Bloqueo vigente | `LOGIN_INTENTO_BLOQUEADO`, RECHAZADO/BLOQUEO_VIGENTE; contador y límites observados | 423; no comprueba bcrypt ni amplía bloqueo |
| Contraseña incorrecta, fallos 1–2 | `LOGIN_PASSWORD_INCORRECTA`, RECHAZADO/PASSWORD_INCORRECTA; contador confirmado | 401 genérico |
| Tercer fallo | `LOGIN_PASSWORD_INCORRECTA` y `LOGIN_BLOQUEO_GENERADO` (EXITO/BLOQUEO_GENERADO); misma correlación, contador, inicio, diez minutos y finalización | 423; ambos eventos en T24, después de confirmar T01 |
| Login válido | `LOGIN_EXITO`, EXITO; responsable comprobado y efecto CONFIRMADO | 200; auditoría en T01 y cookie solo después del COMMIT |

El grupo deriva de los datos capturados bajo bloqueo, no de una relectura después del COMMIT. En errores técnicos anteriores a confirmar se revierte T01; después se intenta auditar el error mediante T24 si la capa de auditoría no lo marcó ya como gestionado. Un fallo de auditoría obligatoria impide entregar JWT/cookie; un fallo exclusivo de auditoría de un rechazo conserva el 401/403/423 original. T01 no valida que el Rol esté activo: esa comprobación no forma parte del login actual.

### 6.4. T02 — Crear usuario

**Origen:** `usuarioService.createUsuario()`. Antes de abrir T02 se comprueban nombre, correo cuando no es null y rol existente/activo, en ese orden; después se calcula bcrypt con coste 10. Las siguientes lecturas representan esas comprobaciones previas, no bloqueos añadidos a T02:

```sql
SELECT id_usuario FROM usuario WHERE nombre_usuario = @nombre_usuario LIMIT 1;
-- Se omite esta consulta cuando no se proporciona correo o es NULL.
SELECT id_usuario FROM usuario WHERE correo = @correo LIMIT 1;
SELECT id_rol, nombre, descripcion, estado FROM rol WHERE id_rol = @id_rol;
```

Los duplicados se rechazan con 409, el rol inexistente con 404 y el inactivo con 409. No hay transacción abierta durante bcrypt. El procedimiento recibe el hash ya generado y la base del evento `USUARIO_CREAR`/EXITO; completa su ID y snapshot tras el INSERT.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t02_crear_usuario(
    IN p_rol INT, IN p_nombre VARCHAR(60), IN p_hash VARCHAR(255),
    IN p_correo VARCHAR(255), IN p_evento JSON,
    OUT p_id INT, OUT p_usuario JSON
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    INSERT INTO usuario (id_rol, nombre_usuario, password_hash, correo)
    VALUES (p_rol, p_nombre, p_hash, p_correo);
    SET p_id = LAST_INSERT_ID();
    CALL doc_usuario_leer_publico(p_id, p_usuario);
    CALL doc_usuario_auditar_cambio(p_evento, NULL, p_usuario, FALSE);
    COMMIT;
END$$

DELIMITER ;
```

El estado activo, versión 0, contador 0 y bloqueo NULL proceden de los valores predeterminados reales. No se envían como datos de creación desde el cliente. UNIQUE de nombre/correo y FK de rol siguen siendo las barreras ante conflictos concurrentes; no se inventa un bloqueo de Rol dentro de T02. Un error de lectura pública o auditoría revierte el alta. Solo después de confirmar se entrega la respuesta 201.

### 6.5. T03 — Modificar usuario y, si cambia correo, invalidar recuperaciones

**Origen:** `usuarioService.updateUsuario()`. Los flags `p_tiene_*` representan presencia de campos ya validada, no decisiones de permisos. Si se omite correo se conserva; si se envía null se retira. Las comprobaciones de duplicados y de Rol son lecturas normales dentro de T03, sin FOR UPDATE añadido; la fila de Usuario sí se bloquea primero.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t03_modificar_usuario(
    IN p_id INT,
    IN p_tiene_nombre BOOLEAN, IN p_nombre VARCHAR(60),
    IN p_tiene_rol BOOLEAN, IN p_rol INT,
    IN p_tiene_correo BOOLEAN, IN p_correo VARCHAR(255),
    IN p_invalidada_en DATETIME(3), IN p_evento JSON,
    OUT p_usuario JSON
)
BEGIN
    DECLARE v_id INT DEFAULT NULL;
    DECLARE v_rol INT;
    DECLARE v_nombre VARCHAR(60);
    DECLARE v_correo VARCHAR(255);
    DECLARE v_estado BOOLEAN;
    DECLARE v_rol_existe INT DEFAULT NULL;
    DECLARE v_rol_activo BOOLEAN;
    DECLARE v_antes JSON;
    DECLARE v_cambio_correo BOOLEAN;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    SELECT id_usuario, id_rol, nombre_usuario, correo, estado
    INTO v_id, v_rol, v_nombre, v_correo, v_estado
    FROM usuario WHERE id_usuario = p_id FOR UPDATE;
    IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario no encontrado';
    END IF;
    SET v_antes = JSON_OBJECT('idUsuario', v_id, 'nombreUsuario', v_nombre,
        'correo', v_correo, 'estado', JSON_EXTRACT(IF(v_estado, 'true', 'false'), '$'),
        'rol', JSON_OBJECT('idRol', v_rol));

    IF p_tiene_nombre AND EXISTS (
        SELECT 1 FROM usuario WHERE nombre_usuario = p_nombre AND id_usuario <> p_id
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nombre de usuario ya esta en uso';
    END IF;
    IF p_tiene_rol THEN
        BEGIN
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_rol_existe = NULL;
            SELECT id_rol, estado INTO v_rol_existe, v_rol_activo FROM rol WHERE id_rol = p_rol;
        END;
        IF v_rol_existe IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El rol indicado no existe';
        END IF;
        IF NOT v_rol_activo THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El rol indicado esta inactivo';
        END IF;
    END IF;
    IF p_tiene_correo AND p_correo IS NOT NULL AND EXISTS (
        SELECT 1 FROM usuario WHERE correo = p_correo AND id_usuario <> p_id
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo ya esta en uso';
    END IF;

    UPDATE usuario SET
        nombre_usuario = IF(p_tiene_nombre, p_nombre, nombre_usuario),
        id_rol = IF(p_tiene_rol, p_rol, id_rol),
        correo = IF(p_tiene_correo, p_correo, correo)
    WHERE id_usuario = p_id;

    -- Comparacion exacta y null-safe, equivalente al !== del correo normalizado.
    SET v_cambio_correo = p_tiene_correo
        AND NOT (CAST(p_correo AS BINARY) <=> CAST(v_correo AS BINARY));
    IF v_cambio_correo THEN
        UPDATE recuperacion_password SET invalidada_en = p_invalidada_en
        WHERE id_usuario = p_id AND consumida_en IS NULL AND invalidada_en IS NULL;
    END IF;
    CALL doc_usuario_leer_publico(p_id, p_usuario);
    CALL doc_usuario_auditar_cambio(p_evento, v_antes, p_usuario, v_cambio_correo);
    COMMIT;
END$$

DELIMITER ;
```

`p_evento` corresponde a `USUARIO_MODIFICAR`/EXITO. La invalidación conserva códigos consumidos/invalidados y no exige que aún no hayan vencido, igual que `invalidatePendingByUsuario()`. No se reinician cuotas, intentos, bloqueo ni versión por cambiar correo, nombre o rol. Un correo normalizado idéntico conserva las recuperaciones. La representación con IF conserva los campos omitidos; no incorpora `estado` a esta edición.

### 6.6. T04 — Activar o desactivar usuario

**Origen:** `usuarioService.updateEstado()`. Se bloquea solo Usuario, se captura el snapshot anterior, se cambia estado y se lee el resultado público. No se añade una regla contra la desactivación propia ni una comprobación de «último administrador», porque no existen en este recorrido.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t04_estado_usuario(
    IN p_id INT, IN p_estado BOOLEAN, IN p_evento JSON, OUT p_usuario JSON
)
BEGIN
    DECLARE v_id INT DEFAULT NULL;
    DECLARE v_rol INT;
    DECLARE v_nombre VARCHAR(60);
    DECLARE v_correo VARCHAR(255);
    DECLARE v_estado BOOLEAN;
    DECLARE v_antes JSON;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    SELECT id_usuario, id_rol, nombre_usuario, correo, estado
    INTO v_id, v_rol, v_nombre, v_correo, v_estado
    FROM usuario WHERE id_usuario = p_id FOR UPDATE;
    IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario no encontrado';
    END IF;
    SET v_antes = JSON_OBJECT('idUsuario', v_id, 'nombreUsuario', v_nombre,
        'correo', v_correo, 'estado', JSON_EXTRACT(IF(v_estado, 'true', 'false'), '$'),
        'rol', JSON_OBJECT('idRol', v_rol));
    UPDATE usuario SET estado = p_estado WHERE id_usuario = p_id;
    CALL doc_usuario_leer_publico(p_id, p_usuario);
    CALL doc_usuario_auditar_cambio(p_evento, v_antes, p_usuario, FALSE);
    COMMIT;
END$$

DELIMITER ;
```

El evento es `USUARIO_ESTADO`/EXITO, incluso si se pide el estado ya existente; en ese caso la lista de campos modificados es vacía. No se borran históricos ni se incrementa la versión ni se invalidan recuperaciones desde T04. La cuenta inactiva se rechaza al comprobar las siguientes solicitudes protegidas en `getSessionUsuario()`.

### 6.7. T05 — Restablecimiento administrativo de contraseña

**Origen:** `usuarioService.updatePassword()`. Primero se consulta públicamente la cuenta, sin bloqueo ni transacción, y se calcula bcrypt con coste 10. Dentro de T05 se revalida existencia bajo FOR UPDATE y se toma la versión actual; no se comprueba la contraseña anterior ni se exige que la cuenta objetivo esté activa.

```sql
-- Previo a bcrypt y a START TRANSACTION; falla si la cuenta no existe.
CALL doc_usuario_leer_publico(@id_usuario, @usuario_previo);
```

```sql
DELIMITER $$

CREATE PROCEDURE doc_t05_password_administrador(
    IN p_id INT, IN p_hash_nuevo VARCHAR(255), IN p_invalidada_en DATETIME(3),
    IN p_evento JSON, OUT p_version BIGINT UNSIGNED
)
BEGIN
    DECLARE v_id INT DEFAULT NULL;
    DECLARE v_rol INT;
    DECLARE v_nombre VARCHAR(60);
    DECLARE v_version BIGINT UNSIGNED;
    DECLARE v_evento JSON;
    DECLARE v_ids JSON;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    SELECT id_usuario, id_rol, nombre_usuario, version_credenciales
    INTO v_id, v_rol, v_nombre, v_version
    FROM usuario WHERE id_usuario = p_id FOR UPDATE;
    IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario no encontrado';
    END IF;
    IF v_version IS NULL OR v_version >= 4294967295 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pudo actualizar la contrasena';
    END IF;
    SET p_version = v_version + 1;
    UPDATE usuario SET password_hash = p_hash_nuevo, version_credenciales = p_version,
        intentos_fallidos_login = 0, bloqueado_hasta = NULL WHERE id_usuario = p_id;
    UPDATE recuperacion_password SET invalidada_en = p_invalidada_en
    WHERE id_usuario = p_id AND consumida_en IS NULL AND invalidada_en IS NULL;

    SET v_evento = JSON_SET(p_evento,
        '$.tipo_registro', 'USUARIO', '$.id_registro', v_id,
        '$.id_usuario_objetivo', v_id, '$.nombre_usuario_objetivo', v_nombre,
        '$.id_rol_objetivo', v_rol);
    -- p_evento: PASSWORD_RESTABLECER_ADMINISTRADOR/EXITO, sin snapshots,
    -- metadatos {"efecto":"CONFIRMADO"}; responsable = Administrador autenticado.
    CALL doc_auditoria_insertar_grupo(JSON_ARRAY(v_evento), v_ids);
    COMMIT;
END$$

DELIMITER ;
```

La versión es INT UNSIGNED en la tabla; se usan variables BIGINT para poder detectar el máximo antes de sumar. No hay desbordamiento silencioso ni reinicio a cero. Contraseña, versión, limpieza de bloqueo, invalidaciones y auditoría son atómicas. No se activa la cuenta ni se cambia su rol; tampoco se firma JWT ni se crea cookie para ella. La versión de salida es información interna de la equivalencia, no un nuevo campo de respuesta HTTP.

### 6.8. T06 — Cambio propio de contraseña

**Origen:** `usuarioService.updateOwnPassword()` y `requireCurrentCredentials()`. Antes de T06 se lee la cuenta con hash y versión sin bloqueo; el backend comprueba estado y versión de sesión, compara la contraseña actual con bcrypt y calcula el hash nuevo. El hash leído se conserva internamente para revalidarlo dentro de T06; no se almacena en Bitácora.

```sql
-- Lectura interna previa; su ausencia produce 404 antes de abrir T06.
SELECT id_usuario, id_rol, nombre_usuario, estado, password_hash, version_credenciales
FROM usuario WHERE id_usuario = @id_usuario;
```

La primera rutina abre T06, revalida credenciales y escribe; devuelve los datos necesarios para firmar sin confirmar todavía. La comparación de hashes es binaria y null-safe para reproducir la igualdad exacta de JavaScript, no la colación de texto del esquema.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t06_actualizar(
    IN p_id INT, IN p_version_sesion BIGINT,
    IN p_hash_verificado VARCHAR(255), IN p_hash_nuevo VARCHAR(255),
    IN p_invalidada_en DATETIME(3),
    OUT p_rol INT, OUT p_nombre VARCHAR(60), OUT p_version_nueva BIGINT UNSIGNED
)
BEGIN
    DECLARE v_id INT DEFAULT NULL;
    DECLARE v_estado BOOLEAN;
    DECLARE v_hash VARCHAR(255);
    DECLARE v_version BIGINT UNSIGNED;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    SELECT id_usuario, id_rol, nombre_usuario, estado, password_hash, version_credenciales
    INTO v_id, p_rol, p_nombre, v_estado, v_hash, v_version
    FROM usuario WHERE id_usuario = p_id FOR UPDATE;
    IF v_id IS NULL OR NOT v_estado OR p_version_sesion IS NULL
       OR p_version_sesion < 0 OR p_version_sesion > 4294967295
       OR v_version <> p_version_sesion
       OR NOT (CAST(v_hash AS BINARY) <=> CAST(p_hash_verificado AS BINARY)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sesion no valida';
    END IF;
    IF v_version >= 4294967295 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pudo actualizar la contrasena';
    END IF;
    SET p_version_nueva = v_version + 1;
    UPDATE usuario SET password_hash = p_hash_nuevo, version_credenciales = p_version_nueva,
        intentos_fallidos_login = 0, bloqueado_hasta = NULL WHERE id_usuario = p_id;
    UPDATE recuperacion_password SET invalidada_en = p_invalidada_en
    WHERE id_usuario = p_id AND consumida_en IS NULL AND invalidada_en IS NULL;
    -- Mantiene T06 abierta mientras el backend firma con p_rol y p_version_nueva.
END$$

CREATE PROCEDURE doc_t06_confirmar(
    IN p_firma_completada BOOLEAN, IN p_eventos JSON
)
BEGIN
    DECLARE v_ids JSON;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Misma conexion y misma T06 abierta por doc_t06_actualizar().
    IF p_firma_completada IS NULL OR NOT p_firma_completada THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pudo generar la sesion';
    END IF;
    -- PASSWORD_CAMBIAR_PROPIA/EXITO, sin snapshots ni hashes;
    -- responsable y cuenta objetivo capturados de la fila bloqueada.
    CALL doc_auditoria_insertar_grupo(p_eventos, v_ids);
    COMMIT;
END$$

DELIMITER ;
```

Entre ambas rutinas el backend firma con `{ idUsuario, idRol: p_rol, versionCredenciales: p_version_nueva }`; conserva el token solo en memoria. Si la firma lanza un error se ejecuta ROLLBACK en esa misma conexión. No se confirma la contraseña antes de firmar. El evento conserva la identidad y `fechaEvento` capturadas bajo bloqueo antes de actualizar la contraseña, como en el Service; su preparación para persistencia ocurre después de la firma. Se completa la auditoría y se confirma; la cookie se renueva después del COMMIT.

Una contraseña actual incorrecta se rechaza con 401 **antes** de abrir T06. Si la cuenta se desactivó o desapareció entre la primera lectura y el bloqueo, o si cambió hash/versión, se rechaza con 401 dentro de T06 y se revierte. Un cambio de nombre o rol por sí solo no incumple esta revalidación; la firma y la identidad auditada utilizan los datos actuales bloqueados. La ausencia en la primera lectura conserva el 404 del Service. El máximo de versión es un error técnico 500, no un permiso para conservar la versión anterior.

### 6.9. Rechazos, fallos y operaciones sin apertura nueva

Los SIGNAL documentales expresan interrupción del recorrido; no son nuevos códigos HTTP del backend. Las capas existentes conservan su traducción: inexistencia 404, conflicto 409, sesión/contraseña actual inválida 401, entrada inválida 400, error técnico 500 y fallo de auditoría obligatoria 503. Un UNIQUE concurrente de nombre/correo se traduce a 409 después del rollback. Los errores anteriores a abrir la transacción también pueden generar auditoría.

En T02–T06, después de terminar un rollback, `ejecutarCambio()`/`ejecutarSeguridad()` intentan registrar el rechazo o fallo si no se marcó ya como gestionado. El grupo de error se prepara con la causa segura, identidad/contexto disponibles y etapa real. No se inserta el evento de error en la transacción revertida ni se duplica un error ya gestionado por auditoría. El siguiente SQL es **solo** la rama posterior al error, no una continuación del camino exitoso:

```sql
-- El handler ya ejecuto ROLLBACK; el backend preparo el evento pertinente.
CALL doc_auditoria_independiente(
    @eventos_error_preparados, TRUE, @estado_auditoria_error, @ids_eventos_error
);
```

Si se perdió la confirmación del COMMIT no se afirma rollback conocido: se conserva el tratamiento INCIERTO de la sección 4. Un error posterior de cookie/respuesta tampoco revierte ni repite un cambio ya confirmado.

CU02/logout elimina una cookie en HTTP y registra su evento mediante T24; no abre otra transacción de Usuario. CU04/CU05 materializan la consulta y después usan T24 para su evento sensible, mientras la lectura pública interna de T02–T04 pertenece al evento de la escritura. `/auth/me`, autenticación de solicitudes y comprobaciones ordinarias de Rol no añaden una apertura funcional a este inventario.

## 7. Comprobación y cierre de Fase 2

- Traducidas T01–T06 con sus seis aperturas, conservando el SQL compartido de la Fase 1. Los pares de rutinas de T01/T06 son fragmentos de una misma transacción por operación.
- Login: seis ramas, umbral de tres fallos, diez minutos, reinicio tras bloqueo vencido, firma anterior al reinicio y rechazo auditado después del COMMIT.
- Usuarios: prevalidaciones de alta fuera de T02, bloqueo de la cuenta en ediciones, presencia/null de correo, invalidación selectiva de recuperaciones y snapshots mínimos sin datos sensibles.
- Contraseñas: bcrypt fuera de T05/T06, revalidación binaria de hash/versión en T06, límite 4294967295 y firma propia anterior al COMMIT.
- Revisados nombres de tablas/columnas, rutinas documentales llamadas, auditoría integrada e independiente, handlers de error y ubicación de START TRANSACTION/COMMIT/ROLLBACK mediante comprobaciones estáticas.
- No se han creado procedimientos ni ejecutado estas transacciones en MySQL. La verificación estática no acredita ejecución ni concurrencia reales.

## 8. Fase 3 — Recuperación de contraseña

Fuentes: `recuperacion-password.service.js`, `recuperacion-password.repository.js`, consultas de recuperación de `usuario.repository.js`, modelos y migraciones de `RecuperacionPassword`/`LimiteRecuperacionIp`, `recuperacion-password.js`, `recuperacion-crypto.js`, `recuperacion-config.js` y su validator. Se aplican CU09, RF40–RF42, RI15, RN107–RN115 y las reglas de auditoría de la sección 4.

### 8.1. Contrato, reloj y pasos externos

- Antes de T07 se comprueban configuración habilitada y entrada válida. El correo ya está normalizado; código y contraseña se validan en Node. La IP procede del socket, normalizada como IPv4 individual o IPv6 /56, y su clave HMAC se calcula fuera de SQL, con ámbito `solicitud` o `restablecimiento`.
- La secuencia de solicitud es **T07 → búsqueda por correo → T09 → auditoría independiente → un intento de envío → T08 solo ante rechazo explícito**. Para correo desconocido no se abre T09. La secuencia de restablecimiento es **T07 → búsqueda por correo → T10 → bcrypt fuera de transacción → T11**; si falla la búsqueda o T10 no hay T11.
- Los fragmentos de cada T08–T11 utilizan la **misma conexión reservada** hasta COMMIT/ROLLBACK, como T01/T06. Las variables con prefijos `@rc_`, `@t08_`, `@t09_`, `@t10_` y `@t11_` son estado interno, no parámetros HTTP. Cada apertura reinicia los indicadores que utiliza; no se intercalan operaciones en esa conexión.
- Los auxiliares no abren ni confirman transacciones. Si falla un auxiliar o un paso Node entre apertura y cierre, el propietario ejecuta ROLLBACK en esa conexión y propaga el error antes de intentar su auditoría independiente. Los handlers de apertura/cierre cubren los errores de sus propios bloques.
- `getCurrentDate()` consulta el reloj de MySQL, con precisión de milisegundos, **en el punto real del flujo**. Cuando debe leerse después de adquirir bloqueos se utiliza una sentencia independiente entre llamadas:

```sql
-- Solo en la rama que necesita el instante, despues de los bloqueos indicados.
SELECT CURRENT_TIMESTAMP(3) INTO @rc_ahora;
```

No se adelanta esa lectura al principio de una rutina que todavía puede esperar por un bloqueo: MySQL evalúa CURRENT_TIMESTAMP al inicio de la sentencia que llama al procedimiento. Se conserva la conversión de fechas de la conexión Sequelize, sin cambiar zona horaria. Fechas internas serializadas como texto para Node deben reconstruir el mismo instante que devolvería ese driver; el HMAC utiliza milisegundos desde epoch, no el texto SQL ni una reinterpretación UTC de la hora de sesión.

- Código aleatorio de seis dígitos, nonce, HMAC-SHA-256, comparación `timingSafeEqual`, bcrypt con coste 10, transporte de correo y espera pública son pasos Node. Un resultado booleano HMAC en estas rutinas representa esa comprobación interna real sobre la fila bloqueada; nunca lo proporciona el cliente.
- El nonce UUID pertenece exclusivamente al protocolo de recuperación ya implementado; no sustituye las PK INT AUTO_INCREMENT. No se almacenan código en claro, mensaje ni contraseña en las tablas o en Bitácora. Los estados internos y las salidas documentales tampoco son nuevas respuestas públicas.
- T07–T11 heredan el aislamiento efectivo; no se añade un SET TRANSACTION ISOLATION LEVEL.

### 8.2. Lecturas bloqueadas y comprobación de uso compartidas

Estos auxiliares representan `findByIdForRecovery()`, `findLatestByUsuario()` e `isUsable()`. Se bloquea primero Usuario y después Recuperación. La última emisión se selecciona por fecha descendente e ID descendente **sin filtrar** consumidas, invalidadas ni vencidas: no se rescata un código anterior utilizable.

```sql
DELIMITER $$

CREATE PROCEDURE doc_recuperacion_usuario(IN p_id INT)
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET @rc_usuario = NULL;
    SET @rc_usuario = NULL, @rc_rol = NULL, @rc_nombre = NULL,
        @rc_correo = NULL, @rc_estado = NULL, @rc_version = NULL;
    SELECT id_usuario, id_rol, nombre_usuario, correo, estado, version_credenciales
    INTO @rc_usuario, @rc_rol, @rc_nombre, @rc_correo, @rc_estado, @rc_version
    FROM usuario WHERE id_usuario = p_id FOR UPDATE;
END$$

CREATE PROCEDURE doc_recuperacion_ultima()
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET @rc_recuperacion = NULL;
    SET @rc_recuperacion = NULL, @rc_hmac = NULL, @rc_nonce = NULL,
        @rc_solicitud = NULL, @rc_expira = NULL, @rc_intentos = NULL,
        @rc_consumida = NULL, @rc_invalidada = NULL;
    SELECT id_recuperacion, codigo_hmac, nonce, fecha_solicitud, expira_en,
        intentos_fallidos, consumida_en, invalidada_en
    INTO @rc_recuperacion, @rc_hmac, @rc_nonce, @rc_solicitud, @rc_expira,
        @rc_intentos, @rc_consumida, @rc_invalidada
    FROM recuperacion_password WHERE id_usuario = @rc_usuario
    ORDER BY fecha_solicitud DESC, id_recuperacion DESC LIMIT 1 FOR UPDATE;
END$$

CREATE PROCEDURE doc_recuperacion_evaluar_uso(
    OUT p_utilizable BOOLEAN, OUT p_proteccion_actualizada BOOLEAN
)
BEGIN
    SET p_utilizable = FALSE, p_proteccion_actualizada = FALSE;
    IF @rc_recuperacion IS NOT NULL AND @rc_consumida IS NULL AND @rc_invalidada IS NULL THEN
        IF CAST(@rc_expira AS DATETIME(3)) <= @rc_ahora OR @rc_intentos >= 5 THEN
            UPDATE recuperacion_password SET invalidada_en = @rc_ahora
            WHERE id_recuperacion = @rc_recuperacion;
            SET p_proteccion_actualizada = TRUE;
        ELSE
            SET p_utilizable = TRUE;
        END IF;
    END IF;
END$$

DELIMITER ;
```

`doc_recuperacion_evaluar_uso()` requiere la última fila y el instante ya capturados bajo bloqueo. Si ya estaba consumida o invalidada no vuelve a escribirla, incluso si venció. Si vence o agotó cinco fallos sin invalidación previa, registra `invalidada_en` y señala una protección que debe confirmarse, aunque el restablecimiento se rechace.

### 8.3. T07 — Cuota persistente por IP y ámbito

**Origen:** `verificarLimiteIp()` e `incrementIpQuota()`. La clave de entrada es el HMAC ya calculado. La ventana es fija de quince minutos desde la primera petición; no se desplaza al incrementar dentro de una ventana vigente. El orden de las asignaciones del UPSERT conserva la comparación con el vencimiento anterior.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t07_cuota_ip(
    IN p_ambito VARCHAR(24), IN p_clave_hmac CHAR(64), OUT p_cantidad BIGINT UNSIGNED
)
BEGIN
    DECLARE v_ahora DATETIME(3);
    DECLARE v_hasta DATETIME(3);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    SELECT CURRENT_TIMESTAMP(3) INTO v_ahora;
    SET v_hasta = DATE_ADD(v_ahora, INTERVAL 15 MINUTE);
    INSERT INTO limite_recuperacion_ip (ambito, clave_ip_hmac, ventana_hasta, cantidad)
    VALUES (p_ambito, p_clave_hmac, v_hasta, 1)
    ON DUPLICATE KEY UPDATE
        cantidad = IF(ventana_hasta <= v_ahora, 1, LEAST(cantidad + 1, 4294967295)),
        ventana_hasta = IF(ventana_hasta <= v_ahora, v_hasta, ventana_hasta);
    SELECT cantidad INTO p_cantidad FROM limite_recuperacion_ip
    WHERE ambito = p_ambito AND clave_ip_hmac = p_clave_hmac FOR UPDATE;
    COMMIT;
END$$

DELIMITER ;
```

**Después del COMMIT**, Node compara la cantidad con 20 para `solicitud` o 30 para `restablecimiento`. Solo si es **mayor** lanza 429/LIMITE_IP. No se ejecuta ROLLBACK por exceder cuota: esa petición y las siguientes continúan contándose, con saturación en 4294967295. Al llegar exactamente a `ventana_hasta` comienza una ventana nueva con cantidad 1.

No se comprueba aquí si existe la cuenta. Desconocidos e inactivos consumen cuota IP; solicitudes y restablecimientos no comparten contador. T07 no inserta un evento propio: el rechazo se audita desde el recorrido exterior mediante T24. Un error de persistencia no permite continuar usando una cuota en memoria.

### 8.4. T08 — Invalidar exclusivamente una emisión cuyo envío fue rechazado

**Origen:** `invalidarEnvioRechazado()`. Se recibe internamente el ID de Usuario, el ID de Recuperación y el nonce devueltos por T09. Se bloquea Usuario aunque no se inspeccione su estado; después se busca esa recuperación concreta, no la última.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t08_abrir(IN p_usuario INT, IN p_recuperacion INT, IN p_nonce CHAR(36))
BEGIN
    DECLARE v_id INT DEFAULT NULL;
    DECLARE v_nonce CHAR(36);
    DECLARE v_consumida DATETIME(3);
    DECLARE v_invalidada DATETIME(3);
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET @t08_id = NULL;
    START TRANSACTION;
    CALL doc_recuperacion_usuario(p_usuario);
    SELECT id_recuperacion, nonce, consumida_en, invalidada_en
    INTO v_id, v_nonce, v_consumida, v_invalidada
    FROM recuperacion_password
    WHERE id_usuario = p_usuario AND id_recuperacion = p_recuperacion FOR UPDATE;
    IF v_id IS NOT NULL AND CAST(v_nonce AS BINARY) = CAST(p_nonce AS BINARY)
       AND v_consumida IS NULL AND v_invalidada IS NULL THEN
        SET @t08_id = v_id;
    END IF;
END$$

CREATE PROCEDURE doc_t08_cerrar(IN p_ahora DATETIME(3))
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    IF @t08_id IS NOT NULL THEN
        UPDATE recuperacion_password SET invalidada_en = p_ahora
        WHERE id_recuperacion = @t08_id;
    END IF;
    COMMIT;
END$$

DELIMITER ;
```

Después de abrir, solo si `@t08_id` no es NULL se lee `CURRENT_TIMESTAMP(3)` mediante la sentencia independiente de 8.1; se pasa ese instante al cierre. Si no corresponde invalidar se llama al cierre con NULL y se confirma sin cambios. No se comprueba vencimiento, versión ni estado activo en esta invalidación.

Una emisión posterior no puede invalidarse por el rechazo de una anterior: se conservan ID y nonce exactos. Tampoco se modifica una recuperación consumida o ya invalidada. T08 no devuelve cuota IP ni de cuenta y no incorpora un evento obligatorio en su transacción. Ante fallo se revierte T08; el Service registra un diagnóstico sanitizado e intenta `ERROR_TECNICO` independiente, manteniendo la respuesta pública genérica de solicitud.

### 8.5. T09 — Cuota de cuenta, nueva emisión e invalidación de pendientes

**Origen:** `solicitarRecuperacion()`. Después de T07 se ejecuta una lectura ordinaria por correo:

```sql
SELECT id_usuario FROM usuario WHERE correo = @correo_normalizado LIMIT 1;
```

Si no existe, se audita `RECUPERACION_SOLICITAR`/RECHAZADO/USUARIO_INEXISTENTE mediante T24 y se devuelve la respuesta genérica, sin abrir T09. Si existe, su ID se pasa a la apertura. Se revalida el correo con igualdad exacta como en JavaScript; la prioridad de supresión en T09 es inexistente, correo distinto y, finalmente, inactivo.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t09_abrir(IN p_usuario INT, IN p_correo VARCHAR(255))
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SET @t09_cuenta_apta = FALSE, @t09_emitir = FALSE,
        @t09_causa = NULL, @rc_ahora = NULL;
    START TRANSACTION;
    CALL doc_recuperacion_usuario(p_usuario);
    IF @rc_usuario IS NULL THEN
        SET @t09_causa = 'USUARIO_INEXISTENTE';
    ELSEIF NOT (CAST(@rc_correo AS BINARY) <=> CAST(p_correo AS BINARY)) THEN
        SET @t09_causa = 'CORREO_NO_DISPONIBLE';
    ELSEIF NOT @rc_estado THEN
        SET @t09_causa = 'USUARIO_INACTIVO';
    ELSE
        SET @t09_cuenta_apta = TRUE;
    END IF;
END$$

CREATE PROCEDURE doc_t09_historial(OUT p_historia JSON)
BEGIN
    DECLARE v_fin BOOLEAN DEFAULT FALSE;
    DECLARE v_cantidad INT DEFAULT 0;
    DECLARE v_id INT;
    DECLARE v_hmac CHAR(64);
    DECLARE v_nonce CHAR(36);
    DECLARE v_fecha DATETIME(3);
    DECLARE v_expira DATETIME(3);
    DECLARE v_ultima DATETIME(3) DEFAULT NULL;
    DECLARE c_historia CURSOR FOR
        SELECT id_recuperacion, codigo_hmac, nonce, fecha_solicitud, expira_en
        FROM recuperacion_password
        WHERE id_usuario = @rc_usuario
          AND fecha_solicitud > DATE_SUB(@rc_ahora, INTERVAL 15 MINUTE)
        ORDER BY fecha_solicitud DESC, id_recuperacion DESC FOR UPDATE;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fin = TRUE;

    -- Solo se llama para una cuenta apta, con @rc_ahora ya leido de MySQL.
    SET p_historia = JSON_ARRAY();
    OPEN c_historia;
    leer: LOOP
        FETCH c_historia INTO v_id, v_hmac, v_nonce, v_fecha, v_expira;
        IF v_fin THEN LEAVE leer; END IF;
        IF v_cantidad = 0 THEN SET v_ultima = v_fecha; END IF;
        SET v_cantidad = v_cantidad + 1;
        SET p_historia = JSON_ARRAY_APPEND(p_historia, '$', JSON_OBJECT(
            'id_recuperacion', v_id, 'id_usuario', @rc_usuario,
            'codigo_hmac', v_hmac, 'nonce', v_nonce,
            'fecha_solicitud', v_fecha, 'expira_en', v_expira));
    END LOOP;
    CLOSE c_historia;
    IF v_cantidad >= 3 OR (v_ultima IS NOT NULL
        AND @rc_ahora < DATE_ADD(v_ultima, INTERVAL 60 SECOND)) THEN
        SET @t09_causa = 'LIMITE_CUENTA';
    ELSE
        SET @t09_emitir = TRUE;
    END IF;
END$$

CREATE PROCEDURE doc_t09_cerrar(
    IN p_hmac CHAR(64), IN p_nonce CHAR(36), OUT p_recuperacion INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SET p_recuperacion = NULL;
    IF @t09_emitir THEN
        UPDATE recuperacion_password SET invalidada_en = @rc_ahora
        WHERE id_usuario = @rc_usuario AND consumida_en IS NULL AND invalidada_en IS NULL;
        INSERT INTO recuperacion_password (id_usuario, codigo_hmac, nonce, fecha_solicitud, expira_en)
        VALUES (@rc_usuario, p_hmac, p_nonce, @rc_ahora, DATE_ADD(@rc_ahora, INTERVAL 10 MINUTE));
        SET p_recuperacion = LAST_INSERT_ID();
    END IF;
    COMMIT;
END$$

DELIMITER ;
```

**Secuencia interna:** abrir; capturar identidad/fecha del evento si existe Usuario; si la cuenta es apta, leer el instante MySQL de 8.1 y llamar al historial. El cursor conserva filtro, orden y bloqueo de la consulta original, entregando solo las columnas que necesitan cuota/generación; **cuenta también las emisiones consumidas, invalidadas o con envío fallido**. La ventana usa `fecha_solicitud > ahora − 15 minutos`, no >=; a los sesenta segundos exactos se permite otra emisión si no se agotó la ventana.

Solo si `@t09_emitir` es TRUE, Node genera un código no repetido: filtra el historial por `expira_en > ahora` sin excluir consumidos/invalidados y prueba hasta 32 candidatos aleatorios contra sus HMAC, usando el correo actual y el contexto de cada fila. Si se agotan, lanza 500 y revierte T09. Genera nonce, vencimiento absoluto `ahora + 10 minutos`, HMAC vinculado a propósito/cuenta/correo/nonce/vencimiento y mensaje en memoria; después llama al cierre con HMAC y nonce. La fecha inicial no se renueva por el tiempo de generación ni por el envío.

Una supresión llama al cierre con NULL/NULL: confirma sin invalidar pendientes ni insertar una emisión. Para una emisión nueva, invalidación e INSERT son atómicos; `intentos_fallidos = 0`, `consumida_en = NULL` e `invalidada_en = NULL` proceden del esquema. No se modifica la contraseña, versión, bloqueo ni contador de login.

**Después de T09:** Node marca efecto CONFIRMADO si obtuvo ID o NO_APLICA si hubo supresión; registra `RECUPERACION_SOLICITAR` mediante T24 con EXITO o RECHAZADO y la causa segura. En una emisión, `fechaEvento` es el instante MySQL de la emisión; en una supresión conserva la fecha observada por el Service. Si emitió, registra además `RECUPERACION_EMITIR`/EXITO mediante **otra** T24, y realiza un único intento de correo aun si esas auditorías no confirmaron su persistencia. No se agrupan ambas aperturas independientes ni se integra correo dentro de T09.

| Resultado del transporte | Tratamiento de la emisión confirmada | Evento posterior mediante T24 |
|---|---|---|
| ACEPTADO | Se conserva; aceptación no acredita entrega al buzón | `RECUPERACION_ENVIO`/EXITO, `estadoEnvio: ACEPTADO` |
| RECHAZADO explícito | Se intenta T08 para esa emisión; la cuota permanece | `RECUPERACION_ENVIO`/FALLO/ENVIO_RECHAZADO, `estadoEnvio: RECHAZADO` |
| AMBIGUO, excepción o timeout | Se conserva hasta vencimiento, sin reintento automático | `RECUPERACION_ENVIO`/FALLO/ENVIO_INCIERTO, `estadoEnvio: INCIERTO` |

El evento de envío usa un nuevo `fechaEvento` y efecto CONFIRMADO de la emisión, incluso si falló su envío o su invalidación posterior. No contiene destinatario, código, HMAC, nonce ni payload. Una caída entre COMMIT y envío no se compensa con una reversión ni una cola nueva.

La respuesta de solicitud válida dentro de cuota IP es siempre «Si el correo corresponde a una cuenta habilitada, recibirás un código de recuperación». El `finally` del Service aplica una espera mínima de cinco segundos desde después de T07, también para desconocidos/supresiones y errores del bloque de búsqueda/emisión/envío; no es SQL ni una garantía de tiempo constante. Validación, configuración y exceso de cuota IP se resuelven antes de esa espera con sus respuestas uniformes.

### 8.6. T10 — Preverificación y confirmación de fallos de código

**Origen:** primera transacción de `restablecerPassword()`. Tras T07/restablecimiento se busca por correo como en 8.5; si no existe, se devuelve el error genérico de verificación 400 y se audita su causa sin abrir T10. La prioridad de rechazo de cuenta en T10 es inexistente, inactivo y correo distinto, según el Service.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t10_abrir(IN p_usuario INT, IN p_correo VARCHAR(255))
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SET @t10_cuenta_apta = FALSE, @t10_causa = 'CODIGO_INVALIDO', @rc_ahora = NULL;
    START TRANSACTION;
    CALL doc_recuperacion_usuario(p_usuario);
    IF @rc_usuario IS NULL THEN
        SET @t10_causa = 'USUARIO_INEXISTENTE';
    ELSEIF NOT @rc_estado THEN
        SET @t10_causa = 'USUARIO_INACTIVO';
    ELSEIF NOT (CAST(@rc_correo AS BINARY) <=> CAST(p_correo AS BINARY)) THEN
        SET @t10_causa = 'CORREO_NO_DISPONIBLE';
    ELSE
        SET @t10_cuenta_apta = TRUE;
        CALL doc_recuperacion_ultima();
    END IF;
END$$

CREATE PROCEDURE doc_t10_cerrar(
    IN p_hmac_coincide BOOLEAN,
    OUT p_verificada BOOLEAN, OUT p_id_verificado INT,
    OUT p_version_verificada BIGINT UNSIGNED, OUT p_proteccion BOOLEAN
)
BEGIN
    DECLARE v_utilizable BOOLEAN;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SET p_verificada = FALSE, p_id_verificado = NULL,
        p_version_verificada = NULL, p_proteccion = FALSE;
    IF @t10_cuenta_apta THEN
        SET @t10_causa = CASE
            WHEN @rc_recuperacion IS NULL THEN 'CODIGO_INVALIDO'
            WHEN @rc_consumida IS NOT NULL THEN 'CODIGO_UTILIZADO'
            WHEN CAST(@rc_expira AS DATETIME(3)) <= @rc_ahora THEN 'CODIGO_VENCIDO'
            ELSE 'CODIGO_INVALIDO' END;
        CALL doc_recuperacion_evaluar_uso(v_utilizable, p_proteccion);
        IF v_utilizable THEN
            IF p_hmac_coincide IS NULL THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falta la comprobacion HMAC';
            END IF;
            IF NOT p_hmac_coincide THEN
                SET @rc_intentos = @rc_intentos + 1;
                UPDATE recuperacion_password SET intentos_fallidos = @rc_intentos,
                    invalidada_en = IF(@rc_intentos >= 5, @rc_ahora, invalidada_en)
                WHERE id_recuperacion = @rc_recuperacion;
                SET p_proteccion = TRUE;
            ELSE
                SET p_verificada = TRUE, p_id_verificado = @rc_recuperacion,
                    p_version_verificada = @rc_version;
            END IF;
        END IF;
    END IF;
    COMMIT;
END$$

DELIMITER ;
```

Después de abrir se captura identidad/fecha como `observarCuenta()`. Solo para cuenta apta se lee el instante MySQL **después** de la consulta bloqueada de última emisión y se sustituye `fechaEvento` por ese instante, exista o no una recuperación. Con las columnas observadas, Node omite HMAC si no hay recuperación, si ya está consumida/invalidada, si venció o si llegó a cinco fallos; en esas ramas pasa NULL. En la rama utilizable compara el código presentado con el HMAC/contexto de esa fila bloqueada y pasa el booleano real. El cierre aplica las mutaciones de `isUsable()` y del fallo antes de confirmar; ninguna operación externa fallable se introduce entre una invalidación por inutilizabilidad y su COMMIT.

El contador para auditoría se toma de la fila antes de evaluar uso y se actualiza al nuevo valor cuando falla HMAC. `@t10_causa` conserva la prioridad `consumida → vencida → inválida`; estar invalidada por sí solo no crea una causa adicional, y una fila simultáneamente invalidada y vencida puede clasificarse CODIGO_VENCIDO sin volver a escribirla.

| Rama de T10 | Escritura confirmada | Continuación |
|---|---|---|
| Cuenta no apta o sin emisión | Ninguna | Error genérico 400, causa interna correspondiente |
| Consumida o previamente invalidada | Ninguna | Error genérico 400 |
| Vencida o cinco fallos sin invalidación previa | `invalidada_en = ahora` | Error 400 con efecto CONFIRMADO |
| HMAC incorrecto, fallos 1–4 | Incremento de `intentos_fallidos` | Error 400 con efecto CONFIRMADO |
| Quinto fallo HMAC | Incremento a 5 e invalidación | Error 400 con efecto CONFIRMADO |
| HMAC correcto | Ninguna; código aún no consumido | Se conserva internamente ID/version y se calcula bcrypt fuera de transacción |

Tras el COMMIT, el Service establece efecto CONFIRMADO si se actualizó protección o NO_APLICA en otro caso. Si no verificó, lanza `verificationError(@t10_causa)` **después** de confirmar y `ejecutarSeguridad()` intenta la auditoría de rechazo mediante T24. No se hace SIGNAL/ROLLBACK por ese rechazo dentro de T10. Si verificó, no se inserta un éxito de restablecimiento ni se entrega una prueba al cliente: T10/T11 forman parte de una sola petición HTTP, sin ticket o token intermedio.

### 8.7. T11 — Revalidación, consumo y cambio atómico de contraseña

**Origen:** segunda transacción de `restablecerPassword()`. Solo se alcanza después de T10 verificada y `bcrypt.hash(passwordNueva, 10)` completado **sin transacción activa**. Se conserva en memoria el ID de cuenta encontrado y el par ID de recuperación/versión devuelto por T10.

La apertura se separa de las lecturas para representar `exigirRecuperacionHabilitada()` dentro de T11 y **antes** de adquirir los bloqueos. Si esa comprobación Node falla, se ejecuta ROLLBACK y se conserva el 503; no se llama a los pasos restantes.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t11_abrir()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SET @t11_cuenta_apta = FALSE, @rc_ahora = NULL;
    START TRANSACTION;
END$$

CREATE PROCEDURE doc_t11_bloquear(IN p_usuario INT, IN p_correo VARCHAR(255))
BEGIN
    CALL doc_recuperacion_usuario(p_usuario);
    IF @rc_usuario IS NOT NULL AND @rc_estado
       AND CAST(@rc_correo AS BINARY) = CAST(p_correo AS BINARY) THEN
        SET @t11_cuenta_apta = TRUE;
        CALL doc_recuperacion_ultima();
    END IF;
END$$

CREATE PROCEDURE doc_t11_cerrar(
    IN p_id_verificado INT, IN p_version_verificada BIGINT UNSIGNED,
    IN p_hmac_coincide BOOLEAN, IN p_hash_nuevo VARCHAR(255), IN p_eventos JSON,
    OUT p_consumida BOOLEAN, OUT p_proteccion BOOLEAN
)
BEGIN
    DECLARE v_utilizable BOOLEAN;
    DECLARE v_ids JSON;
    DECLARE v_version BIGINT UNSIGNED;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SET p_consumida = FALSE, p_proteccion = FALSE;
    IF @t11_cuenta_apta THEN
        -- Se evalua uso ANTES de comparar ID/version, como el cortocircuito JS.
        CALL doc_recuperacion_evaluar_uso(v_utilizable, p_proteccion);
        IF v_utilizable AND @rc_recuperacion = p_id_verificado
           AND @rc_version = p_version_verificada THEN
            IF p_hmac_coincide IS NULL THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falta la revalidacion HMAC';
            END IF;
            IF p_hmac_coincide THEN
                SET v_version = @rc_version;
                IF v_version IS NULL OR v_version >= 4294967295 THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pudo actualizar la contrasena';
                END IF;
                UPDATE usuario SET password_hash = p_hash_nuevo,
                    version_credenciales = v_version + 1,
                    intentos_fallidos_login = 0, bloqueado_hasta = NULL
                WHERE id_usuario = @rc_usuario;
                UPDATE recuperacion_password SET consumida_en = @rc_ahora
                WHERE id_recuperacion = @rc_recuperacion;
                UPDATE recuperacion_password SET invalidada_en = @rc_ahora
                WHERE id_usuario = @rc_usuario AND consumida_en IS NULL AND invalidada_en IS NULL;
                -- PASSWORD_RESTABLECER_RECUPERACION/EXITO, efecto CONFIRMADO.
                -- Sin responsable autenticado; cuenta objetivo observada bajo bloqueo.
                CALL doc_auditoria_insertar_grupo(p_eventos, v_ids);
                SET p_consumida = TRUE;
            END IF;
        END IF;
    END IF;
    COMMIT;
END$$

DELIMITER ;
```

**Secuencia:** abrir → revalidar configuración en Node → bloquear → si cuenta apta, leer reloj MySQL de 8.1 → comprobar las columnas de uso, ID y versión → solo si todo coincide, repetir HMAC en Node sobre la emisión actual → cerrar. La evaluación externa de esas condiciones solo decide si ejecutar HMAC; el cierre mantiene las escrituras y el orden de `isUsable()`. Se utiliza el mismo instante capturado antes de HMAC, sin añadir otro vencimiento posterior que el código actual no comprueba.

El evento exitoso ya preparado que se pasa al cierre utiliza la cuenta objetivo y el instante MySQL capturados en T11, registro USUARIO y metadatos `{ "efecto": "CONFIRMADO" }`, sin snapshots ni datos criptográficos. La operación pública no tiene responsable autenticado aunque se conozca la cuenta objetivo. Si se ha cambiado el rol, se usa el actual; ese cambio por sí solo no invalida la versión de T10.

Si desapareció Usuario, dejó de estar activo, cambió su correo, apareció una emisión posterior, cambió la versión o dejó de coincidir el HMAC, se confirma T11 con `p_consumida = FALSE` y después se lanza 400/PRECONDICIONES_DESACTUALIZADAS. **No se incrementa el contador HMAC en T11**. Si la emisión observada venció o agotó intentos y no estaba invalidada, primero se confirma esa invalidación y el efecto será CONFIRMADO; los demás rechazos no escriben y usan NO_APLICA. La causa exterior en esta segunda transacción es siempre PRECONDICIONES_DESACTUALIZADAS para esos retornos falsos, no se reutiliza la clasificación detallada de T10.

La fila consumida queda con `consumida_en = ahora`; el UPDATE posterior de pendientes **la excluye**. No se le asigna además `invalidada_en` por esa sentencia, aunque funcionalmente ya no puede utilizarse. Las otras emisiones todavía pendientes se invalidan, sin filtrar por vencimiento. Hash nuevo, incremento de versión, limpieza de login, consumo, invalidaciones y auditoría obligatoria se confirman juntos. El máximo de versión y cualquier fallo SQL/auditoría revierten T11; un fallo de auditoría obligatoria se traduce a 503.

Después de confirmar éxito se responde «Contraseña restablecida exitosamente». No se inicia sesión ni se emiten JWT o cookies; las sesiones anteriores quedan desactualizadas por la nueva versión. T11 no activa Usuario ni cambia Rol.

### 8.8. Auditoría independiente y límites entre transacciones

Cada llamada independiente indicada en esta fase usa la rutina T24, con un arreglo de eventos previamente preparados y sin transacción de negocio activa:

```sql
CALL doc_auditoria_independiente(
    @eventos_recuperacion_preparados, TRUE, @estado_auditoria_recuperacion, @ids_auditoria_recuperacion
);
```

- `RECUPERACION_SOLICITAR`, `RECUPERACION_EMITIR` y `RECUPERACION_ENVIO` son hechos posteriores o rechazos; su fallo exclusivo de auditoría no deshace cuotas, emisión, envío ni invalidación ya confirmados.
- Los rechazos de `PASSWORD_RESTABLECER_RECUPERACION` se auditan después de T10/T11 o de la comprobación exterior que los produjo. `intentosCodigoFallidos` procede de los datos capturados en T10, actualizado si allí falló HMAC; el rechazo final no inventa una nueva lectura para cambiarlo. Cuenta/fecha se actualizan cuando el Service realmente las observa; si T11 no encuentra cuenta apta, conserva el contexto previo de T10.
- El **éxito** `PASSWORD_RESTABLECER_RECUPERACION` se inserta exclusivamente dentro de T11. No se pasa a T24 después de confirmar ni se repite como evento independiente.
- Las transacciones T07 y T08 no se asignan a `seguimiento.transaction` en el Service actual; las T09–T11 sí durante su ejecución y se limpian tras una terminación conocida. Se conserva la información realmente disponible para el tratamiento de errores, sin atribuir una detección nueva de confirmación incierta a cada apertura. Una pérdida de respuesta al COMMIT no demuestra ausencia ni autoriza reintentar la operación automáticamente.
- Un error técnico antes de confirmar revierte la transacción que esté activa, pero no una T07/T09/T10 anterior ya confirmada. Los errores no gestionados por auditoría se registran con causa segura, etapa y efecto disponibles mediante `ejecutarSeguridad()`; un error ya gestionado no genera un duplicado.

## 9. Comprobación y cierre de Fase 3

- Traducidas las cinco aperturas T07–T11; los fragmentos de cada una conservan una sola transacción. Las dos T07 por ámbito comparten definición, no una cuota.
- Conservados UPSERT/PK compuesta de IP, saturación y umbrales 20/30, ventana de quince minutos, cuota móvil de cuenta, tres emisiones y separación de sesenta segundos.
- Revisados orden Usuario → Recuperación, última emisión sin filtro de estado, reloj MySQL después de bloqueos y HMAC/generación/bcrypt fuera de SQL en sus límites reales.
- Conservados COMMIT de fallos, invalidación al quinto intento, emisión precisa ante rechazo de correo, revalidación de ID/versión/HMAC y auditoría obligatoria del cambio final.
- Contrastados nombres y tipos con modelos/migraciones, llamadas entre rutinas y ubicación de aperturas, confirmaciones y handlers mediante revisión y comprobación estática acotadas a esta fase.
- Los procedimientos son documentales; no se han creado ni ejecutado en MySQL. La revisión estática no acredita ejecución ni concurrencia reales.

## 10. Fase 4 — Proveedores, principios activos y catálogo

Fuentes: Services y Repositories de ProveedorLaboratorio, PrincipioActivo, Medicamento y ComposicionMedicamento; `identidad-medicamento.js`, `codigo-medicamento.js`, `decimal.js`, validators, modelos y migraciones correspondientes. Se aplican CU10/CU12–CU14/CU16–CU19, RF10–RF13, RN09–RN16/RN105 y auditoría RF48/RN129–RN133.

### 10.1. Contrato y cierre compartido

- T12–T14 requieren Administrador. T15–T17, T19 y las cinco variantes de T18 requieren Regente. Autenticación, autorización y validación estructural se realizan en las capas existentes antes de estas llamadas.
- Los parámetros JSON `p_datos` usan nombres camelCase de los validators y contienen exclusivamente los campos permitidos para cada operación. No son cuerpos sin validar. Omisión conserva el valor en PATCH; null solo se admite en teléfono/dirección/descripción. Vacío y espacios exteriores ya fueron tratados como en sus validators. Los campos de medicamento/composición no admiten null.
- Cantidades de composición se representan internamente con decimales exactos a escala cuatro, conforme a `decimalAEntero()`/`enteroADecimal()`. No se redondean entradas inválidas mediante un CAST. La API sigue recibiendo números validados y devolviendo cadenas decimales; las rutinas no agregan conversiones de unidades.
- Los procedimientos se dividen en apertura, operación cuando corresponda y cierre para dejar visible la preparación Node de `registrarCambio()`. Se reserva la **misma conexión** hasta terminar. Ningún auxiliar o preparación externa abre otra transacción. Cualquier fallo entre fragmentos obliga al propietario a ejecutar ROLLBACK antes de traducir/auditar el error.
- Las variables `@cat_*` conservan IDs y lecturas internas para construir DTOs/snapshots; no son entradas del cliente ni nuevos campos de respuesta. Los fragmentos se llaman una sola vez por recorrido, sin intercalar peticiones. Si se reintenta un alta por colisión de código, se descartan los datos de ese intento y se inicia otro completo.
- Las rutinas de comparación se definen con el mismo charset/colación que los textos de catálogo del esquema contrastado (`utf8mb4_0900_ai_ci` en la referencia local). Parámetros y columnas textuales de JSON_TABLE deben conservar esa compatibilidad; no se aplica una colación binaria nueva a la identidad. Si otra instalación utiliza distintas colaciones por columna, la comparación debe reproducir cada columna como el Repository, sin alterar los históricos ni el esquema. Las comparaciones de **cambio efectivo** sí usan igualdad binaria, equivalente a JavaScript.
- T12–T17/T19 heredan aislamiento. Solo la apertura común T18 declara READ COMMITTED, para la próxima transacción y sin cambiar el aislamiento global.

Todas las aperturas de esta fase terminan mediante el siguiente cierre, equivalente a `registrarCambio()` seguido del COMMIT del propietario. `p_eventos` ya contiene el evento preparado/sanitizado correspondiente, con la fecha capturada por Node en el punto de auditoría, responsable autenticado, registro, snapshots mínimos y referencias de la operación. Un error revierte también todas las escrituras anteriores de esa misma apertura.

```sql
DELIMITER $$

CREATE PROCEDURE doc_catalogo_confirmar(IN p_eventos JSON)
BEGIN
    DECLARE v_ids JSON;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    CALL doc_auditoria_insertar_grupo(p_eventos, v_ids);
    COMMIT;
END$$

DELIMITER ;
```

Este cierre no es una apertura adicional. Se invoca con una sola transacción activa de T12–T19; no se llama a T24 para sus éxitos críticos.

### 10.2. Lecturas de proveedor y principio activo

Representan `getProveedorLaboratorioById()` y `getPrincipioActivoById()` con DTO público. Se usan con bloqueo al editar/cambiar estado y sin él para releer el resultado; una ausencia lanza la interrupción documental que el backend traduce a 404. No se bloquean asociaciones.

```sql
DELIMITER $$

CREATE PROCEDURE doc_proveedor_leer(IN p_id INT, IN p_bloquear BOOLEAN, OUT p_resultado JSON)
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET p_resultado = NULL;
    SET p_resultado = NULL;
    IF p_bloquear THEN
        SELECT JSON_OBJECT('idProveedorLaboratorio', id_proveedor_laboratorio,
            'nombre', nombre, 'telefono', telefono, 'direccion', direccion,
            'estado', JSON_EXTRACT(IF(estado, 'true', 'false'), '$'))
        INTO p_resultado FROM proveedor_laboratorio WHERE id_proveedor_laboratorio = p_id FOR UPDATE;
    ELSE
        SELECT JSON_OBJECT('idProveedorLaboratorio', id_proveedor_laboratorio,
            'nombre', nombre, 'telefono', telefono, 'direccion', direccion,
            'estado', JSON_EXTRACT(IF(estado, 'true', 'false'), '$'))
        INTO p_resultado FROM proveedor_laboratorio WHERE id_proveedor_laboratorio = p_id;
    END IF;
    IF p_resultado IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Proveedor o laboratorio no encontrado';
    END IF;
END$$

CREATE PROCEDURE doc_principio_leer(IN p_id INT, IN p_bloquear BOOLEAN, OUT p_resultado JSON)
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET p_resultado = NULL;
    SET p_resultado = NULL;
    IF p_bloquear THEN
        SELECT JSON_OBJECT('idPrincipioActivo', id_principio_activo,
            'nombre', nombre, 'descripcion', descripcion,
            'estado', JSON_EXTRACT(IF(estado, 'true', 'false'), '$'))
        INTO p_resultado FROM principio_activo WHERE id_principio_activo = p_id FOR UPDATE;
    ELSE
        SELECT JSON_OBJECT('idPrincipioActivo', id_principio_activo,
            'nombre', nombre, 'descripcion', descripcion,
            'estado', JSON_EXTRACT(IF(estado, 'true', 'false'), '$'))
        INTO p_resultado FROM principio_activo WHERE id_principio_activo = p_id;
    END IF;
    IF p_resultado IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Principio activo no encontrado';
    END IF;
END$$

DELIMITER ;
```

### 10.3. T12–T14 — Alta, edición y estado de proveedor/laboratorio

T12 no busca nombre duplicado ni exige un UNIQUE de nombre que el esquema no contiene. `estado` es opcional en alta y predetermina activo. T13 admite únicamente nombre/teléfono/dirección y distingue campo omitido de null. T14 solo cambia estado, sin cascadas sobre medicamentos, compras ni stock.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t12_proveedor_crear(IN p_datos JSON)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
    INSERT INTO proveedor_laboratorio (nombre, telefono, direccion, estado)
    VALUES (JSON_VALUE(p_datos, '$.nombre'), JSON_VALUE(p_datos, '$.telefono'),
        JSON_VALUE(p_datos, '$.direccion'), COALESCE(JSON_VALUE(p_datos, '$.estado') = 'true', TRUE));
    SET @cat_id = LAST_INSERT_ID(), @cat_antes = NULL;
    -- DTO de la instancia creada, sin agregar una relectura al alta real.
    SET @cat_despues = JSON_OBJECT('idProveedorLaboratorio', @cat_id,
        'nombre', JSON_VALUE(p_datos, '$.nombre'), 'telefono', JSON_VALUE(p_datos, '$.telefono'),
        'direccion', JSON_VALUE(p_datos, '$.direccion'),
        'estado', JSON_EXTRACT(IF(COALESCE(JSON_VALUE(p_datos, '$.estado') = 'true', TRUE), 'true', 'false'), '$'));
END$$

CREATE PROCEDURE doc_t13_proveedor_modificar(IN p_id INT, IN p_datos JSON)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
    CALL doc_proveedor_leer(p_id, TRUE, @cat_antes);
    UPDATE proveedor_laboratorio SET
        nombre = IF(JSON_CONTAINS_PATH(p_datos, 'one', '$.nombre'), JSON_VALUE(p_datos, '$.nombre'), nombre),
        telefono = IF(JSON_CONTAINS_PATH(p_datos, 'one', '$.telefono'), JSON_VALUE(p_datos, '$.telefono'), telefono),
        direccion = IF(JSON_CONTAINS_PATH(p_datos, 'one', '$.direccion'), JSON_VALUE(p_datos, '$.direccion'), direccion)
    WHERE id_proveedor_laboratorio = p_id;
    CALL doc_proveedor_leer(p_id, FALSE, @cat_despues);
    SET @cat_id = p_id;
END$$

CREATE PROCEDURE doc_t14_proveedor_estado(IN p_id INT, IN p_estado BOOLEAN)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
    CALL doc_proveedor_leer(p_id, TRUE, @cat_antes);
    UPDATE proveedor_laboratorio SET estado = p_estado WHERE id_proveedor_laboratorio = p_id;
    CALL doc_proveedor_leer(p_id, FALSE, @cat_despues);
    SET @cat_id = p_id;
END$$

DELIMITER ;
```

Después de cada apertura, Node prepara el evento indicado en 10.11 y llama a `doc_catalogo_confirmar()`. Los snapshots de proveedor son exclusivamente `{ nombre, estado }`. En T13 se añade a `camposModificados` el nombre `telefono` y/o `direccion` si cambió su valor exacto; **no se copian esos valores a Bitácora**. T14 puede pedir el mismo estado: conserva el evento y una lista vacía de campos modificados. Un proveedor inactivo puede editarse y conserva todas sus relaciones.

### 10.4. T15–T17 — Alta, edición y estado de principio activo

El nombre debe estar disponible según la colación de `principio_activo.nombre`, incluidos principios inactivos. T15 comprueba dentro de su transacción con lectura normal, sin FOR UPDATE añadido; T16 bloquea primero el objetivo y comprueba nombre solo si se envió. El UNIQUE `uq_principio_activo_nombre` sigue siendo la barrera final concurrente.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t15_principio_crear(IN p_datos JSON)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
    IF EXISTS (SELECT 1 FROM principio_activo WHERE nombre = JSON_VALUE(p_datos, '$.nombre')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nombre de principio activo ya esta en uso';
    END IF;
    INSERT INTO principio_activo (nombre, descripcion, estado)
    VALUES (JSON_VALUE(p_datos, '$.nombre'), JSON_VALUE(p_datos, '$.descripcion'),
        COALESCE(JSON_VALUE(p_datos, '$.estado') = 'true', TRUE));
    SET @cat_id = LAST_INSERT_ID(), @cat_antes = NULL;
    SET @cat_despues = JSON_OBJECT('idPrincipioActivo', @cat_id,
        'nombre', JSON_VALUE(p_datos, '$.nombre'), 'descripcion', JSON_VALUE(p_datos, '$.descripcion'),
        'estado', JSON_EXTRACT(IF(COALESCE(JSON_VALUE(p_datos, '$.estado') = 'true', TRUE), 'true', 'false'), '$'));
END$$

CREATE PROCEDURE doc_t16_principio_modificar(IN p_id INT, IN p_datos JSON)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
    CALL doc_principio_leer(p_id, TRUE, @cat_antes);
    IF JSON_CONTAINS_PATH(p_datos, 'one', '$.nombre') AND EXISTS (
        SELECT 1 FROM principio_activo WHERE nombre = JSON_VALUE(p_datos, '$.nombre') AND id_principio_activo <> p_id
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nombre de principio activo ya esta en uso';
    END IF;
    UPDATE principio_activo SET
        nombre = IF(JSON_CONTAINS_PATH(p_datos, 'one', '$.nombre'), JSON_VALUE(p_datos, '$.nombre'), nombre),
        descripcion = IF(JSON_CONTAINS_PATH(p_datos, 'one', '$.descripcion'), JSON_VALUE(p_datos, '$.descripcion'), descripcion)
    WHERE id_principio_activo = p_id;
    CALL doc_principio_leer(p_id, FALSE, @cat_despues);
    SET @cat_id = p_id;
END$$

CREATE PROCEDURE doc_t17_principio_estado(IN p_id INT, IN p_estado BOOLEAN)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
    CALL doc_principio_leer(p_id, TRUE, @cat_antes);
    UPDATE principio_activo SET estado = p_estado WHERE id_principio_activo = p_id;
    CALL doc_principio_leer(p_id, FALSE, @cat_despues);
    SET @cat_id = p_id;
END$$

DELIMITER ;
```

Se prepara el evento y se llama al cierre compartido antes de responder. Los snapshots son `{ nombre, estado }`. T16 añade solo el nombre `descripcion` a `camposModificados` cuando cambió, sin auditar el contenido. Un cambio de estado no cambia ni elimina composiciones existentes. T15/T16 traducen duplicados de nombre, incluidos los detectados por UNIQUE, a 409 después del rollback; T17 no incorpora esa comprobación de nombre.

### 10.5. Auxiliares de T18/T19 — Medicamento, proveedores e historial

`doc_medicamento_bloquear()` carga solo la fila objetivo, sin asociaciones, como `getMedicamentoForUpdate()`. `doc_medicamento_ficha()` representa la lectura pública final con ambas relaciones y composición ordenada por ID; Node reconstruye el DTO sin repetir el medicamento por cada fila del JOIN. La composición ausente produce `[]`, no una relación ficticia.

```sql
DELIMITER $$

CREATE PROCEDURE doc_medicamento_bloquear(IN p_id INT)
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET @cat_actual = NULL;
    SET @cat_actual = NULL;
    SELECT JSON_OBJECT('idMedicamento', id_medicamento, 'idProveedorLaboratorio', id_proveedor_laboratorio,
        'codigoMedicamento', codigo_medicamento, 'nombreComercial', nombre_comercial,
        'formaFarmaceutica', forma_farmaceutica, 'presentacion', presentacion,
        'unidadInventario', unidad_inventario, 'stockMinimo', stock_minimo,
        'condicionVenta', condicion_venta, 'viaAdministracion', via_administracion,
        'tipoLiberacion', tipo_liberacion, 'estado', JSON_EXTRACT(IF(estado, 'true', 'false'), '$'))
    INTO @cat_actual FROM medicamento WHERE id_medicamento = p_id FOR UPDATE;
    IF @cat_actual IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Medicamento no encontrado';
    END IF;
    SET @cat_id = p_id;
END$$

CREATE PROCEDURE doc_medicamento_ficha(IN p_id INT)
BEGIN
    SELECT m.*, p.id_proveedor_laboratorio AS proveedor_id, p.nombre AS proveedor_nombre,
        c.id_composicion, c.id_medicamento AS composicion_medicamento_id,
        c.id_principio_activo, CAST(c.cantidad_principio_activo AS CHAR) AS cantidad_principio_activo,
        c.unidad_principio_activo, CAST(c.cantidad_referencia AS CHAR) AS cantidad_referencia,
        c.unidad_referencia, a.id_principio_activo AS principio_id, a.nombre AS principio_nombre
    FROM medicamento m
    LEFT JOIN proveedor_laboratorio p ON p.id_proveedor_laboratorio = m.id_proveedor_laboratorio
    LEFT JOIN composicion_medicamento c ON c.id_medicamento = m.id_medicamento
    LEFT JOIN principio_activo a ON a.id_principio_activo = c.id_principio_activo
    WHERE m.id_medicamento = p_id ORDER BY c.id_composicion ASC;
END$$

CREATE PROCEDURE doc_catalogo_proveedores(IN p_origen INT, IN p_destino INT)
BEGIN
    DECLARE v_id INT;
    DECLARE v_estado BOOLEAN;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;
    SET v_id = NULL;
    SELECT id_proveedor_laboratorio, estado INTO v_id, v_estado
    FROM proveedor_laboratorio WHERE id_proveedor_laboratorio = LEAST(p_origen, p_destino) FOR UPDATE;
    IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Proveedor o laboratorio no encontrado';
    END IF;
    IF v_id = p_destino THEN SET @cat_destino_activo = v_estado; END IF;
    IF p_origen <> p_destino THEN
        SET v_id = NULL;
        SELECT id_proveedor_laboratorio, estado INTO v_id, v_estado
        FROM proveedor_laboratorio WHERE id_proveedor_laboratorio = GREATEST(p_origen, p_destino) FOR UPDATE;
        IF v_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Proveedor o laboratorio no encontrado';
        END IF;
        IF v_id = p_destino THEN SET @cat_destino_activo = v_estado; END IF;
    END IF;
END$$

CREATE PROCEDURE doc_catalogo_principio(IN p_id INT)
BEGIN
    DECLARE v_id INT DEFAULT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;
    SELECT id_principio_activo INTO v_id FROM principio_activo WHERE id_principio_activo = p_id FOR SHARE;
    IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Principio activo no encontrado';
    END IF;
END$$

CREATE PROCEDURE doc_catalogo_sin_historial(IN p_id INT)
BEGIN
    DECLARE v_fin BOOLEAN DEFAULT FALSE;
    DECLARE v_existencia INT;
    DECLARE v_movimiento INT DEFAULT NULL;
    DECLARE v_ids JSON DEFAULT (JSON_ARRAY());
    DECLARE c_existencias CURSOR FOR SELECT id_existencia FROM existencia_medicamento
        WHERE id_medicamento = p_id ORDER BY id_existencia ASC FOR UPDATE;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fin = TRUE;
    OPEN c_existencias;
    leer: LOOP
        FETCH c_existencias INTO v_existencia;
        IF v_fin THEN LEAVE leer; END IF;
        SET v_ids = JSON_ARRAY_APPEND(v_ids, '$', v_existencia);
    END LOOP;
    CLOSE c_existencias;
    IF JSON_LENGTH(v_ids) > 0 THEN
        SELECT id_movimiento INTO v_movimiento FROM movimiento_inventario
        WHERE id_existencia IN (SELECT j.id FROM JSON_TABLE(v_ids, '$[*]' COLUMNS (id INT PATH '$')) j)
        LIMIT 1 FOR UPDATE;
        IF v_movimiento IS NOT NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El medicamento tiene historial: no se puede modificar su identidad ni su composicion';
        END IF;
    END IF;
END$$

DELIMITER ;
```

La secuencia de edición es Medicamento propio → proveedores únicos por ID ascendente → existencias cuando deba comprobarse historial → movimiento si hay existencias. No se bloquean medicamentos candidatos. El criterio de historial es **cualquier** movimiento, incluso revertido, sin filtrar saldo, motivo ni dirección; tener existencias sin movimientos no basta. Los bloqueos y FK conservan la protección frente a la incorporación concurrente del primer movimiento.

`doc_catalogo_principio()` utiliza bloqueo compartido y comprueba existencia, **no estado activo**. El proveedor se exige activo al crear medicamento y cuando el PATCH incluye explícitamente su ID, aunque coincida con el actual. Editar otros datos o composición no exige activar el proveedor actual.

### 10.6. T18 — Apertura, composición completa e identidad comercial

Esta es la única apertura documental de T18, compartida por sus cinco operaciones. El cierre es `doc_catalogo_confirmar()` y no hay COMMIT entre medicamento y componentes ni entre modificación y comprobación de identidad resultante.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t18_abrir()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    SET @cat_id = NULL, @cat_antes = NULL, @cat_despues = NULL,
        @cat_actual = NULL, @cat_conflictos = JSON_ARRAY(), @cat_destino_activo = NULL;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
END$$

CREATE PROCEDURE doc_composicion_lista(IN p_id INT, OUT p_lista JSON)
BEGIN
    DECLARE v_fin BOOLEAN DEFAULT FALSE;
    DECLARE v_principio INT;
    DECLARE v_cantidad DECIMAL(12,4);
    DECLARE v_unidad VARCHAR(30);
    DECLARE v_referencia DECIMAL(12,4);
    DECLARE v_unidad_referencia VARCHAR(30);
    DECLARE c_componentes CURSOR FOR
        SELECT id_principio_activo, cantidad_principio_activo, unidad_principio_activo,
            cantidad_referencia, unidad_referencia FROM composicion_medicamento
        WHERE id_medicamento = p_id ORDER BY id_principio_activo ASC;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fin = TRUE;
    SET p_lista = JSON_ARRAY();
    OPEN c_componentes;
    leer: LOOP
        FETCH c_componentes INTO v_principio, v_cantidad, v_unidad, v_referencia, v_unidad_referencia;
        IF v_fin THEN LEAVE leer; END IF;
        SET p_lista = JSON_ARRAY_APPEND(p_lista, '$', JSON_OBJECT('idPrincipioActivo', v_principio,
            'cantidadPrincipioActivo', CAST(v_cantidad AS CHAR), 'unidadPrincipioActivo', v_unidad,
            'cantidadReferencia', CAST(v_referencia AS CHAR), 'unidadReferencia', v_unidad_referencia));
    END LOOP;
    CLOSE c_componentes;
END$$

CREATE PROCEDURE doc_catalogo_identidad(IN p_medicamento JSON, IN p_composicion JSON, IN p_excluir INT)
BEGIN
    DECLARE v_fin BOOLEAN DEFAULT FALSE;
    DECLARE v_id INT;
    DECLARE v_codigo VARCHAR(20);
    DECLARE v_nombre VARCHAR(150);
    DECLARE v_estado BOOLEAN;
    DECLARE c_duplicados CURSOR FOR
        SELECT m.id_medicamento, m.codigo_medicamento, m.nombre_comercial, m.estado
        FROM medicamento m
        WHERE m.id_proveedor_laboratorio = JSON_VALUE(p_medicamento, '$.idProveedorLaboratorio' RETURNING SIGNED)
          AND m.id_medicamento <> COALESCE(p_excluir, 0)
          AND TRIM(REGEXP_REPLACE(m.nombre_comercial, '[[:space:]]+', ' ')) =
              TRIM(REGEXP_REPLACE(JSON_VALUE(p_medicamento, '$.nombreComercial' RETURNING CHAR(150)), '[[:space:]]+', ' '))
          AND TRIM(REGEXP_REPLACE(m.forma_farmaceutica, '[[:space:]]+', ' ')) =
              TRIM(REGEXP_REPLACE(JSON_VALUE(p_medicamento, '$.formaFarmaceutica' RETURNING CHAR(80)), '[[:space:]]+', ' '))
          AND TRIM(REGEXP_REPLACE(m.presentacion, '[[:space:]]+', ' ')) =
              TRIM(REGEXP_REPLACE(JSON_VALUE(p_medicamento, '$.presentacion' RETURNING CHAR(150)), '[[:space:]]+', ' '))
          AND TRIM(REGEXP_REPLACE(m.unidad_inventario, '[[:space:]]+', ' ')) =
              TRIM(REGEXP_REPLACE(JSON_VALUE(p_medicamento, '$.unidadInventario' RETURNING CHAR(50)), '[[:space:]]+', ' '))
          AND TRIM(REGEXP_REPLACE(m.via_administracion, '[[:space:]]+', ' ')) =
              TRIM(REGEXP_REPLACE(JSON_VALUE(p_medicamento, '$.viaAdministracion' RETURNING CHAR(80)), '[[:space:]]+', ' '))
          AND TRIM(REGEXP_REPLACE(m.tipo_liberacion, '[[:space:]]+', ' ')) =
              TRIM(REGEXP_REPLACE(JSON_VALUE(p_medicamento, '$.tipoLiberacion' RETURNING CHAR(80)), '[[:space:]]+', ' '))
          AND (SELECT COUNT(*) FROM composicion_medicamento c WHERE c.id_medicamento = m.id_medicamento) = JSON_LENGTH(p_composicion)
          AND NOT EXISTS (
              SELECT 1 FROM JSON_TABLE(p_composicion, '$[*]' COLUMNS (
                  principio INT PATH '$.idPrincipioActivo', cantidad DECIMAL(12,4) PATH '$.cantidadPrincipioActivo',
                  unidad VARCHAR(30) PATH '$.unidadPrincipioActivo', referencia DECIMAL(12,4) PATH '$.cantidadReferencia',
                  unidad_referencia VARCHAR(30) PATH '$.unidadReferencia')) j
              WHERE NOT EXISTS (SELECT 1 FROM composicion_medicamento c
                  WHERE c.id_medicamento = m.id_medicamento AND c.id_principio_activo = j.principio
                    AND c.cantidad_principio_activo = j.cantidad AND c.cantidad_referencia = j.referencia
                    AND TRIM(REGEXP_REPLACE(c.unidad_principio_activo, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(j.unidad, '[[:space:]]+', ' '))
                    AND TRIM(REGEXP_REPLACE(c.unidad_referencia, '[[:space:]]+', ' ')) = TRIM(REGEXP_REPLACE(j.unidad_referencia, '[[:space:]]+', ' ')))
          ) ORDER BY m.id_medicamento ASC;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fin = TRUE;
    SET @cat_conflictos = JSON_ARRAY();
    OPEN c_duplicados;
    leer: LOOP
        FETCH c_duplicados INTO v_id, v_codigo, v_nombre, v_estado;
        IF v_fin THEN LEAVE leer; END IF;
        SET @cat_conflictos = JSON_ARRAY_APPEND(@cat_conflictos, '$', JSON_OBJECT(
            'idMedicamento', v_id, 'codigoMedicamento', v_codigo, 'nombreComercial', v_nombre,
            'estado', JSON_EXTRACT(IF(v_estado, 'true', 'false'), '$')));
    END LOOP;
    CLOSE c_duplicados;
    IF JSON_LENGTH(@cat_conflictos) > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un medicamento registrado con estas caracteristicas y composicion.';
    END IF;
END$$

DELIMITER ;
```

La consulta expresa mediante JSON_TABLE la conjunción de EXISTS que genera el Repository para cada ingrediente. Igual número de componentes más coincidencia de todos equivale al mismo conjunto, sin depender de orden. Se utiliza dentro de T18/READ COMMITTED y con los proveedores ya bloqueados; no añade FOR UPDATE, filtros de estado ni conversiones farmacéuticas. Una composición vacía compara correctamente con otros registros vacíos.

Solo nombre, proveedor, forma, presentación, unidad de inventario, vía, liberación y composición intervienen en identidad. Código, estado, stock mínimo y condición de venta no distinguen productos. Los conflictos conservan todas las referencias públicas mínimas ordenadas en `@cat_conflictos`; Node las utiliza para el 409 después de revertir. El límite de 100 referencias de Bitácora no recorta esa lista de coincidencias HTTP.

### 10.7. T18-A — Alta integral y generación de código

Antes de abrir T18, Node rechaza `codigoMedicamento`, composición vacía/ausente y principios repetidos. Calcula el prefijo mediante `obtenerPrefijoMedicamento()`: trim, mayúsculas, NFD, eliminación de marcas de acento y de caracteres distintos de A–Z, y primeras tres letras. Si no alcanza tres letras, responde 400 sin apertura. No se normaliza el nombre que se almacena.

```sql
DELIMITER $$

CREATE PROCEDURE doc_medicamento_codigo(IN p_prefijo CHAR(3), OUT p_codigo VARCHAR(20))
BEGIN
    DECLARE v_mayor INT;
    DECLARE v_numero INT;
    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_medicamento, 4) AS UNSIGNED)), 0) INTO v_mayor
    FROM medicamento WHERE CHAR_LENGTH(codigo_medicamento) = 6
      AND LEFT(codigo_medicamento, 3) = p_prefijo
      AND REGEXP_LIKE(SUBSTRING(codigo_medicamento, 4), '^[0-9]{3}$', 'c');
    SET v_numero = v_mayor + 1, p_codigo = NULL;
    buscar: WHILE v_numero <= 999 DO
        SET p_codigo = CONCAT(p_prefijo, LPAD(v_numero, 3, '0'));
        IF NOT EXISTS (SELECT 1 FROM medicamento WHERE codigo_medicamento = p_codigo) THEN
            LEAVE buscar;
        END IF;
        SET p_codigo = NULL, v_numero = v_numero + 1;
    END WHILE;
    IF p_codigo IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Se agotaron los codigos del prefijo: el correlativo maximo es 999';
    END IF;
END$$

CREATE PROCEDURE doc_t18_crear_medicamento(IN p_datos JSON, IN p_prefijo CHAR(3))
BEGIN
    DECLARE v_fin BOOLEAN DEFAULT FALSE;
    DECLARE v_principio INT;
    DECLARE v_i INT DEFAULT 0;
    DECLARE v_composicion JSON;
    DECLARE v_componente JSON;
    DECLARE v_codigo VARCHAR(20);
    DECLARE c_principios CURSOR FOR
        SELECT j.id FROM JSON_TABLE(p_datos, '$.composicion[*]' COLUMNS (id INT PATH '$.idPrincipioActivo')) j ORDER BY j.id ASC;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_fin = TRUE;

    CALL doc_catalogo_proveedores(JSON_VALUE(p_datos, '$.idProveedorLaboratorio' RETURNING SIGNED),
        JSON_VALUE(p_datos, '$.idProveedorLaboratorio' RETURNING SIGNED));
    IF NOT @cat_destino_activo THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El proveedor o laboratorio esta inactivo';
    END IF;
    OPEN c_principios;
    leer: LOOP
        FETCH c_principios INTO v_principio;
        IF v_fin THEN LEAVE leer; END IF;
        CALL doc_catalogo_principio(v_principio);
    END LOOP;
    CLOSE c_principios;
    SET v_composicion = JSON_EXTRACT(p_datos, '$.composicion');
    CALL doc_catalogo_identidad(p_datos, v_composicion, NULL);
    CALL doc_medicamento_codigo(p_prefijo, v_codigo);
    INSERT INTO medicamento (id_proveedor_laboratorio, codigo_medicamento, nombre_comercial,
        forma_farmaceutica, presentacion, unidad_inventario, stock_minimo, condicion_venta,
        via_administracion, tipo_liberacion, estado)
    VALUES (JSON_VALUE(p_datos, '$.idProveedorLaboratorio' RETURNING SIGNED), v_codigo,
        JSON_VALUE(p_datos, '$.nombreComercial'), JSON_VALUE(p_datos, '$.formaFarmaceutica'),
        JSON_VALUE(p_datos, '$.presentacion'), JSON_VALUE(p_datos, '$.unidadInventario'),
        COALESCE(JSON_VALUE(p_datos, '$.stockMinimo' RETURNING SIGNED), 0), JSON_VALUE(p_datos, '$.condicionVenta'),
        JSON_VALUE(p_datos, '$.viaAdministracion'), JSON_VALUE(p_datos, '$.tipoLiberacion'),
        COALESCE(JSON_VALUE(p_datos, '$.estado') = 'true', TRUE));
    SET @cat_id = LAST_INSERT_ID(), @cat_antes = NULL;
    WHILE v_i < JSON_LENGTH(v_composicion) DO
        SET v_componente = JSON_EXTRACT(v_composicion, CONCAT('$[', v_i, ']'));
        INSERT INTO composicion_medicamento (id_medicamento, id_principio_activo,
            cantidad_principio_activo, unidad_principio_activo, cantidad_referencia, unidad_referencia)
        VALUES (@cat_id, JSON_VALUE(v_componente, '$.idPrincipioActivo' RETURNING SIGNED),
            CAST(JSON_VALUE(v_componente, '$.cantidadPrincipioActivo') AS DECIMAL(12,4)), JSON_VALUE(v_componente, '$.unidadPrincipioActivo'),
            CAST(JSON_VALUE(v_componente, '$.cantidadReferencia') AS DECIMAL(12,4)), JSON_VALUE(v_componente, '$.unidadReferencia'));
        SET v_i = v_i + 1;
    END WHILE;
    CALL doc_medicamento_ficha(@cat_id);
END$$

DELIMITER ;
```

Se llama a `doc_t18_abrir()`, a esta variante, se prepara `MEDICAMENTO_CREAR` y se confirma. Los principios se comprueban en orden ascendente para los bloqueos compartidos; los INSERT de componentes respetan el orden original del arreglo. Cualquier fallo de componente, ficha o auditoría revierte el conjunto.

El correlativo funcional toma el máximo sufijo válido + 1, no calcula una PK. Incluye activos/inactivos, respeta la colación al comparar prefijos y códigos, conserva huecos y no modifica históricos irregulares. El proveedor no es un mutex global del prefijo: dos proveedores diferentes pueden generar el mismo candidato, por lo que permanece el UNIQUE `uq_medicamento_codigo`.

**Reintento real:** solo `SequelizeUniqueConstraintError` identificado específicamente como colisión de `uq_medicamento_codigo` permite hasta **cinco intentos totales**. Node espera el rollback del intento, reinicia seguimiento/evento/etapa y vuelve a abrir T18, comprobar proveedor/principios/identidad, generar código e insertar todo. No se repite solo el INSERT ni se reutiliza el snapshot. El agotamiento de los cinco intentos produce 409; cualquier otro UNIQUE, deadlock, timeout o fallo de auditoría no activa este bucle. No se traduce todo 1062 indiscriminadamente como colisión de código.

### 10.8. T18-B — Edición comercial de medicamento

El PATCH ya rechazó código, estado y composición. Siempre bloquea el medicamento y los proveedores origen/destino, aunque cambie solo stock mínimo. Se comprueba historial únicamente ante cambio **efectivo** de uno de los seis atributos protegidos; el nombre no pertenece a ese grupo, pero sí activa la comprobación de duplicado cuando cambia.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t18_modificar_medicamento(IN p_id INT, IN p_datos JSON)
BEGIN
    DECLARE v_origen INT;
    DECLARE v_destino INT;
    DECLARE v_resultante JSON;
    DECLARE v_composicion JSON;
    DECLARE v_campos JSON DEFAULT (JSON_ARRAY('idProveedorLaboratorio', 'formaFarmaceutica',
        'presentacion', 'unidadInventario', 'viaAdministracion', 'tipoLiberacion', 'nombreComercial'));
    DECLARE v_campo VARCHAR(32);
    DECLARE v_i INT DEFAULT 0;
    DECLARE v_cambia_historia BOOLEAN DEFAULT FALSE;
    DECLARE v_cambia_identidad BOOLEAN DEFAULT FALSE;

    CALL doc_medicamento_bloquear(p_id);
    SET @cat_antes = @cat_actual;
    SET v_origen = JSON_VALUE(@cat_actual, '$.idProveedorLaboratorio' RETURNING SIGNED);
    SET v_destino = COALESCE(JSON_VALUE(p_datos, '$.idProveedorLaboratorio' RETURNING SIGNED), v_origen);
    CALL doc_catalogo_proveedores(v_origen, v_destino);
    WHILE v_i < JSON_LENGTH(v_campos) DO
        SET v_campo = JSON_UNQUOTE(JSON_EXTRACT(v_campos, CONCAT('$[', v_i, ']')));
        IF JSON_CONTAINS_PATH(p_datos, 'one', CONCAT('$.', v_campo)) AND NOT (
            CAST(JSON_EXTRACT(p_datos, CONCAT('$.', v_campo)) AS BINARY)
            <=> CAST(JSON_EXTRACT(@cat_actual, CONCAT('$.', v_campo)) AS BINARY)) THEN
            SET v_cambia_identidad = TRUE;
            IF v_campo <> 'nombreComercial' THEN SET v_cambia_historia = TRUE; END IF;
        END IF;
        SET v_i = v_i + 1;
    END WHILE;
    IF v_cambia_historia THEN CALL doc_catalogo_sin_historial(p_id); END IF;
    IF JSON_CONTAINS_PATH(p_datos, 'one', '$.idProveedorLaboratorio') AND NOT @cat_destino_activo THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El proveedor o laboratorio esta inactivo';
    END IF;
    SET v_resultante = JSON_MERGE_PATCH(@cat_actual, p_datos);
    IF v_cambia_identidad THEN
        CALL doc_composicion_lista(p_id, v_composicion);
        CALL doc_catalogo_identidad(v_resultante, v_composicion, p_id);
    END IF;
    UPDATE medicamento SET
        id_proveedor_laboratorio = JSON_VALUE(v_resultante, '$.idProveedorLaboratorio' RETURNING SIGNED),
        nombre_comercial = JSON_VALUE(v_resultante, '$.nombreComercial'),
        forma_farmaceutica = JSON_VALUE(v_resultante, '$.formaFarmaceutica'),
        presentacion = JSON_VALUE(v_resultante, '$.presentacion'), unidad_inventario = JSON_VALUE(v_resultante, '$.unidadInventario'),
        stock_minimo = JSON_VALUE(v_resultante, '$.stockMinimo' RETURNING SIGNED), condicion_venta = JSON_VALUE(v_resultante, '$.condicionVenta'),
        via_administracion = JSON_VALUE(v_resultante, '$.viaAdministracion'), tipo_liberacion = JSON_VALUE(v_resultante, '$.tipoLiberacion')
    WHERE id_medicamento = p_id;
    CALL doc_medicamento_ficha(p_id);
END$$

DELIMITER ;
```

Se usa apertura T18 → variante → preparación `MEDICAMENTO_MODIFICAR` → cierre compartido. Asignar en el SQL resultante los valores conservados representa el PATCH parcial sin cambiar los omitidos; no se incluye código ni estado en UPDATE. Un valor protegido exactamente igual no provoca consulta de historial; diferencias tipográficas que JavaScript considera distintas sí la provocan, aunque la identidad comercial use otra normalización. Cambiar solo stock mínimo/condición de venta no vuelve a comprobar duplicados históricos.

### 10.9. T18-C/D/E — Agregar, editar o retirar composición

Las tres variantes ejecutan siempre la preparación común, incluso si el PATCH contiene cantidades/unidades iguales: medicamento propio bloqueado, proveedor actual bloqueado y ausencia de historial. No exigen medicamento ni proveedor activos. La lectura de una relación comprueba **ambos identificadores del recorrido** (ID de medicamento e ID de composición) para verificar su pertenencia.

```sql
DELIMITER $$

CREATE PROCEDURE doc_composicion_preparar(IN p_medicamento INT)
BEGIN
    CALL doc_medicamento_bloquear(p_medicamento);
    CALL doc_catalogo_proveedores(JSON_VALUE(@cat_actual, '$.idProveedorLaboratorio' RETURNING SIGNED),
        JSON_VALUE(@cat_actual, '$.idProveedorLaboratorio' RETURNING SIGNED));
    CALL doc_catalogo_sin_historial(p_medicamento);
END$$

CREATE PROCEDURE doc_composicion_leer(IN p_medicamento INT, IN p_composicion INT, OUT p_resultado JSON)
BEGIN
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET p_resultado = NULL;
    SET p_resultado = NULL;
    SELECT JSON_OBJECT('idComposicion', c.id_composicion, 'idMedicamento', c.id_medicamento,
        'idPrincipioActivo', c.id_principio_activo, 'cantidadPrincipioActivo', CAST(c.cantidad_principio_activo AS CHAR),
        'unidadPrincipioActivo', c.unidad_principio_activo, 'cantidadReferencia', CAST(c.cantidad_referencia AS CHAR),
        'unidadReferencia', c.unidad_referencia,
        'principioActivo', JSON_OBJECT('idPrincipioActivo', a.id_principio_activo, 'nombre', a.nombre))
    INTO p_resultado FROM composicion_medicamento c
    LEFT JOIN principio_activo a ON a.id_principio_activo = c.id_principio_activo
    WHERE c.id_medicamento = p_medicamento AND c.id_composicion = p_composicion;
    IF p_resultado IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Composicion de medicamento no encontrada';
    END IF;
END$$

CREATE PROCEDURE doc_composicion_validar_resultado(IN p_medicamento INT)
BEGIN
    DECLARE v_lista JSON;
    CALL doc_composicion_lista(p_medicamento, v_lista);
    CALL doc_catalogo_identidad(@cat_actual, v_lista, p_medicamento);
END$$

CREATE PROCEDURE doc_t18_composicion_agregar(IN p_medicamento INT, IN p_datos JSON)
BEGIN
    CALL doc_composicion_preparar(p_medicamento);
    CALL doc_catalogo_principio(JSON_VALUE(p_datos, '$.idPrincipioActivo' RETURNING SIGNED));
    IF EXISTS (SELECT 1 FROM composicion_medicamento WHERE id_medicamento = p_medicamento
        AND id_principio_activo = JSON_VALUE(p_datos, '$.idPrincipioActivo' RETURNING SIGNED)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El principio activo ya pertenece a la composicion del medicamento';
    END IF;
    INSERT INTO composicion_medicamento (id_medicamento, id_principio_activo,
        cantidad_principio_activo, unidad_principio_activo, cantidad_referencia, unidad_referencia)
    VALUES (p_medicamento, JSON_VALUE(p_datos, '$.idPrincipioActivo' RETURNING SIGNED),
        CAST(JSON_VALUE(p_datos, '$.cantidadPrincipioActivo') AS DECIMAL(12,4)), JSON_VALUE(p_datos, '$.unidadPrincipioActivo'),
        CAST(JSON_VALUE(p_datos, '$.cantidadReferencia') AS DECIMAL(12,4)), JSON_VALUE(p_datos, '$.unidadReferencia'));
    SET @cat_composicion = LAST_INSERT_ID(), @cat_antes = NULL;
    CALL doc_composicion_validar_resultado(p_medicamento);
    CALL doc_composicion_leer(p_medicamento, @cat_composicion, @cat_despues);
END$$

CREATE PROCEDURE doc_t18_composicion_modificar(IN p_medicamento INT, IN p_composicion INT, IN p_datos JSON)
BEGIN
    DECLARE v_resultante JSON;
    CALL doc_composicion_preparar(p_medicamento);
    CALL doc_composicion_leer(p_medicamento, p_composicion, @cat_antes);
    SET v_resultante = JSON_MERGE_PATCH(@cat_antes, p_datos);
    UPDATE composicion_medicamento SET
        cantidad_principio_activo = CAST(JSON_VALUE(v_resultante, '$.cantidadPrincipioActivo') AS DECIMAL(12,4)),
        unidad_principio_activo = JSON_VALUE(v_resultante, '$.unidadPrincipioActivo'),
        cantidad_referencia = CAST(JSON_VALUE(v_resultante, '$.cantidadReferencia') AS DECIMAL(12,4)),
        unidad_referencia = JSON_VALUE(v_resultante, '$.unidadReferencia')
    WHERE id_medicamento = p_medicamento AND id_composicion = p_composicion;
    CALL doc_composicion_validar_resultado(p_medicamento);
    CALL doc_composicion_leer(p_medicamento, p_composicion, @cat_despues);
    SET @cat_composicion = p_composicion;
END$$

CREATE PROCEDURE doc_t18_composicion_retirar(IN p_medicamento INT, IN p_composicion INT)
BEGIN
    CALL doc_composicion_preparar(p_medicamento);
    CALL doc_composicion_leer(p_medicamento, p_composicion, @cat_antes);
    DELETE FROM composicion_medicamento WHERE id_medicamento = p_medicamento AND id_composicion = p_composicion;
    CALL doc_composicion_validar_resultado(p_medicamento);
    SET @cat_composicion = p_composicion, @cat_despues = NULL;
END$$

DELIMITER ;
```

Cada variante se llama después de `doc_t18_abrir()` y antes de `doc_catalogo_confirmar()`. Un duplicado del resultado revierte también el INSERT/UPDATE/DELETE que acaba de realizarse. La edición no permite cambiar ID de principio ni de medicamento; un ingrediente incorrecto se corrige retirando y agregando mediante las operaciones existentes. La retirada física es exclusivamente de la relación sin historial y **puede retirar la última**, siempre que la composición vacía resultante no duplique otro medicamento. No elimina el medicamento, existencias o movimientos.

En alta independiente, un conflicto del UNIQUE `uq_composicion_medicamento_principio` se traduce a 409; no se confunde con el reintento del código de medicamento. Ninguna de estas tres variantes tiene reintento automático. La respuesta de retirada conserva el contrato actual del Controller; no se inventa un DTO posterior de la relación eliminada.

### 10.10. T19 — Cambiar estado de medicamento

T19 utiliza aislamiento heredado, no la apertura READ COMMITTED de T18. Bloquea únicamente el medicamento, captura snapshot, cambia estado y consulta la ficha con relaciones antes de auditar. No ejecuta protocolo de identidad, bloqueo explícito de proveedor ni comprobación de historial.

```sql
DELIMITER $$

CREATE PROCEDURE doc_t19_medicamento_estado(IN p_id INT, IN p_estado BOOLEAN)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
    CALL doc_medicamento_bloquear(p_id);
    SET @cat_antes = @cat_actual;
    UPDATE medicamento SET estado = p_estado WHERE id_medicamento = p_id;
    CALL doc_medicamento_ficha(p_id);
END$$

DELIMITER ;
```

Node prepara `MEDICAMENTO_ESTADO` y llama al cierre compartido. Pedir el mismo estado conserva el evento con lista vacía. No se modifica cantidad física, composición, código, costos, vencimientos ni movimientos; sus efectos sobre disponibilidad vendible derivan de las consultas y reglas existentes.

### 10.11. Preparación de eventos, errores y llamadas finales

Los DTOs internos de esta fase **no se insertan completos** en Bitácora. Node aplica los helpers existentes de `auditoria-catalogo.js` y `prepararEventoAuditoria()`; la tabla resume exactamente el evento exitoso que se pasa al cierre. Todas las filas usan EXITO y metadatos `efecto: CONFIRMADO`.

| Apertura/variante | Tipo de evento | Registro y snapshots/referencias |
|---|---|---|
| T12 | `PROVEEDOR_LABORATORIO_CREAR` | PROVEEDOR_LABORATORIO/ID nuevo; solo después `{ nombre, estado }` |
| T13 | `PROVEEDOR_LABORATORIO_MODIFICAR` | Mismo registro; antes/después mínimos; campos modificados más nombres de privados cambiados |
| T14 | `PROVEEDOR_LABORATORIO_ESTADO` | Mismo registro; antes/después mínimos y campos modificados |
| T15 | `PRINCIPIO_ACTIVO_CREAR` | PRINCIPIO_ACTIVO/ID nuevo; solo después `{ nombre, estado }` |
| T16 | `PRINCIPIO_ACTIVO_MODIFICAR` | Mismo registro; antes/después mínimos; campos modificados más `descripcion` si cambió |
| T17 | `PRINCIPIO_ACTIVO_ESTADO` | Mismo registro; antes/después mínimos y campos modificados |
| T18-A | `MEDICAMENTO_CREAR` | MEDICAMENTO/ID nuevo; después `snapshotMedicamento`; referencias COMPOSICION |
| T18-B | `MEDICAMENTO_MODIFICAR` | MEDICAMENTO/ID objetivo; antes/después `snapshotMedicamento` y campos modificados |
| T18-C | `COMPOSICION_AGREGAR` | COMPOSICION/ID nuevo; solo después `snapshotComposicion`; referencia MEDICAMENTO |
| T18-D | `COMPOSICION_MODIFICAR` | COMPOSICION/ID objetivo; antes/después `snapshotComposicion` y campos modificados; referencia MEDICAMENTO |
| T18-E | `COMPOSICION_RETIRAR` | COMPOSICION/ID retirado; solo antes `snapshotComposicion`, después NULL; referencia MEDICAMENTO; sin lista de campos modificados |
| T19 | `MEDICAMENTO_ESTADO` | MEDICAMENTO/ID objetivo; antes/después `snapshotMedicamento` y campos modificados |

`snapshotMedicamento` conserva código, nombre, proveedor, forma, presentación, unidad de inventario, stock mínimo, condición de venta, vía, liberación y estado; excluye IDs de registro, objetos de asociaciones y composición anidada. `snapshotComposicion` conserva IDs de medicamento/principio y las cuatro propiedades de cantidades/unidades; no incluye ID de composición ni nombre del principio. Las comparaciones de campos modificados son exactas sobre esos snapshots, con las cantidades en su representación de cadena del DTO.

T18-A registra **un solo evento** para medicamento y composición inicial, sin eventos COMPOSICION_AGREGAR por cada fila. Las referencias proceden de la ficha final en orden de ID de composición, limitadas a las primeras 100; se incluyen `cantidadComponentes` y `cantidadReferenciasOmitidas`, incluso cero. En modificaciones/retirada independiente se referencia el medicamento padre. Teléfono/dirección/descripción se excluyen de los snapshots, aunque se informe el nombre del campo modificado.

Ejemplo del cierre, después de preparar el evento de la variante y todavía bajo su transacción:

```sql
CALL doc_catalogo_confirmar(@eventos_catalogo_preparados);
```

Los SIGNAL expresan interrupciones documentales; la traducción HTTP permanece en backend: referencias/objetivo inexistentes 404, conflictos 409, datos inválidos 400 y errores técnicos 500. `ER_LOCK_DEADLOCK`/`ER_LOCK_WAIT_TIMEOUT` de T18 se convierten a 409 **después del rollback**, sin reintento automático por contención. Si falla la auditoría obligatoria, se revierte la apertura completa y se conserva el 503 sanitizado. No se agregan reintentos a T12–T17/T19 ni se extiende silenciosamente a ellas la conversión específica de T18.

Los rechazos y fallos no gestionados se intentan auditar mediante T24 después del rollback, siguiendo `ejecutarCambio()`/`ejecutarSeguridad()` y la etapa/contexto realmente capturados. No se registra un éxito del intento de código que fue revertido ni se duplica un error ya gestionado. Una pérdida de respuesta al COMMIT conserva la incertidumbre descrita en la sección 4; un error HTTP posterior no vuelve a ejecutar la escritura.

Las consultas ordinarias de proveedores/principios/medicamentos/composición no abren nuevas transacciones de este inventario. La búsqueda AND por principios activos permite componentes adicionales; no se confunde con la igualdad exacta de composición exigida al comprobar identidad comercial.

## 11. Comprobación y cierre de Fase 4

- Traducidas T12–T19: seis aperturas simples, una apertura T18 compartida por cinco variantes y una apertura T19; todas cierran negocio y auditoría juntos.
- Conservados presencia/null, estados predeterminados y snapshots mínimos de proveedores/principios, con nombres de campos privados cambiados sin sus valores.
- Conservados READ COMMITTED por T18, mutex exclusivo por proveedor, orden de bloqueos, principios compartidos, historial por movimientos y consultas de candidatos sin FOR UPDATE.
- Documentados alta integral, código por máximo sufijo válido, cinco intentos solo para el UNIQUE específico y validación del estado completo tras cambios de composición, incluida retirada de última relación sin historial.
- Contrastados tablas, columnas, tipos, claves y restricciones con modelos/migraciones; revisadas llamadas, aperturas/cierre, permisos y eventos mediante comprobaciones estáticas acotadas a esta fase.
- No se han creado procedimientos ni ejecutado transacciones en MySQL. La verificación estática no acredita ejecución ni concurrencia reales.

**Siguiente fase:** Fase 5 — retiros, ajustes y compras T20–T23, incluyendo valoración, movimientos y anulaciones.
