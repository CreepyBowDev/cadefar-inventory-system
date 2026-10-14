# Bitácora — cobertura y aceptación del backend

Fecha de revisión: 13/10/2026. Fuentes funcionales: sección 38 del contexto maestro, CU42, RF43–RF53, RI16, RNF18–RNF22 y RN116–RN133.

## Estado por fase

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Contratos, matriz y decisiones | Definidos |
| 1 | Migración, modelo append-only, Repository, Service, validación y contexto | Implementada |
| 2 | Login, bloqueo y logout | Implementada |
| 3 | Recuperación, contraseñas y seguridad transversal | Implementada |
| 4 | API de consulta CU42 | Implementada |
| 5 | Usuarios, catálogo y consultas sensibles CU04/CU05 | Implementada |
| 6 | Compras, anulaciones, ajustes/conciliación y retiros | Implementada |
| 7 | Cobertura integral, documentación y aceptación MySQL aislada | Verificada localmente; pendientes operativos al final |

La revisión original comprendía 33 CU (CU01–CU27, CU33–CU37 y CU40) y 44 endpoints: 26 escrituras y 18 GET. CU42 agrega dos GET: 46 endpoints actuales y 34 CU cubiertos. Los catálogos funcionales mantienen 42 CU, 53 RF, 16 RI, 22 RNF y 133 RN. Compartir un endpoint entre CU no crea endpoints adicionales.

## Matriz de endpoints

Todas las rutas llevan prefijo `/api`. Los nombres de parámetros reproducen las rutas reales; el clasificador interno los normaliza a `:id`. La conciliación comparte POST de ajustes. HEAD se clasifica como GET; no es otro endpoint del catálogo.

`R/T` significa: rechazos de sesión/acceso/validación conservan su tipo transversal; rechazos de negocio conservan tipo de operación o `OPERACION_RECHAZADA` en lecturas rutinarias; fallos técnicos usan `ERROR_TECNICO`. Se registran por causa privada comprobada, sin deducirla únicamente del HTTP o del mensaje. En cada fila con evento se diferencia EXITO, RECHAZADO o FALLO según el hecho y catálogo. Un bloqueo generado es EXITO del control de seguridad, no del login.

| Método | Endpoint | CU | Éxito o hechos específicos | Rechazos/fallos | Fase |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | CU01 | LOGIN_EXITO; fallo de contraseña/inexistente/inactivo; LOGIN_BLOQUEO_GENERADO; LOGIN_INTENTO_BLOQUEADO | R/T | 2 |
| POST | `/api/auth/logout` | CU02 | LOGOUT después de eliminar cookie | R/T; rechazo previo no prueba logout | 2 |
| GET | `/api/auth/me` | Sesión de CU01 | Excluido: recuperación rutinaria de sesión | R/T | 3 |
| POST | `/api/auth/recuperacion/solicitar` | CU09 | RECUPERACION_SOLICITAR, RECUPERACION_EMITIR, RECUPERACION_ENVIO; hechos distintos | R/T y límites/supresión | 3 |
| POST | `/api/auth/recuperacion/restablecer` | CU09 | PASSWORD_RESTABLECER_RECUPERACION | R/T y verificación de código | 3 |
| PATCH | `/api/usuarios/me/password` | CU08 | PASSWORD_CAMBIAR_PROPIA | R/T | 3 |
| PATCH | `/api/usuarios/:idUsuario/password` | CU08 | PASSWORD_RESTABLECER_ADMINISTRADOR | R/T | 3 |
| GET | `/api/usuarios` | CU04 | USUARIOS_CONSULTAR: lectura sensible | R/T | 5 |
| GET | `/api/usuarios/:idUsuario` | CU05 | USUARIO_CONSULTAR: lectura sensible | R/T | 5 |
| POST | `/api/usuarios` | CU03 | USUARIO_CREAR | R/T | 5 |
| PATCH | `/api/usuarios/:idUsuario` | CU06 | USUARIO_MODIFICAR | R/T | 5 |
| PATCH | `/api/usuarios/:idUsuario/estado` | CU07 | USUARIO_ESTADO | R/T | 5 |
| GET | `/api/proveedores-laboratorios` | CU11 | Excluido: lectura rutinaria de catálogo | R/T | 3/5 |
| GET | `/api/proveedores-laboratorios/:idProveedorLaboratorio` | CU11 | Excluido: lectura rutinaria de catálogo | R/T | 3/5 |
| POST | `/api/proveedores-laboratorios` | CU10 | PROVEEDOR_LABORATORIO_CREAR | R/T | 5 |
| PATCH | `/api/proveedores-laboratorios/:idProveedorLaboratorio` | CU12 | PROVEEDOR_LABORATORIO_MODIFICAR | R/T | 5 |
| PATCH | `/api/proveedores-laboratorios/:idProveedorLaboratorio/estado` | CU13 | PROVEEDOR_LABORATORIO_ESTADO | R/T | 5 |
| GET | `/api/principios-activos` | CU18 | Excluido: lectura rutinaria de catálogo | R/T | 3/5 |
| GET | `/api/principios-activos/:idPrincipioActivo` | CU18 | Excluido: lectura rutinaria de catálogo | R/T | 3/5 |
| POST | `/api/principios-activos` | CU18 | PRINCIPIO_ACTIVO_CREAR | R/T | 5 |
| PATCH | `/api/principios-activos/:idPrincipioActivo` | CU18 | PRINCIPIO_ACTIVO_MODIFICAR | R/T | 5 |
| PATCH | `/api/principios-activos/:idPrincipioActivo/estado` | CU18 | PRINCIPIO_ACTIVO_ESTADO | R/T | 5 |
| GET | `/api/medicamentos` | CU15/CU20 | Excluido: listado/búsqueda rutinaria | R/T | 3/5 |
| GET | `/api/medicamentos/:idMedicamento` | CU15 | Excluido: ficha rutinaria | R/T | 3/5 |
| POST | `/api/medicamentos` | CU14 | MEDICAMENTO_CREAR, incluye composición inicial | R/T | 5 |
| PATCH | `/api/medicamentos/:idMedicamento` | CU16 | MEDICAMENTO_MODIFICAR | R/T | 5 |
| PATCH | `/api/medicamentos/:idMedicamento/estado` | CU17 | MEDICAMENTO_ESTADO | R/T | 5 |
| GET | `/api/medicamentos/:idMedicamento/composicion` | CU19 | Excluido: lectura rutinaria de composición | R/T | 3/5 |
| POST | `/api/medicamentos/:idMedicamento/composicion` | CU19 | COMPOSICION_AGREGAR | R/T | 5 |
| PATCH | `/api/medicamentos/:idMedicamento/composicion/:idComposicion` | CU19 | COMPOSICION_MODIFICAR | R/T | 5 |
| DELETE | `/api/medicamentos/:idMedicamento/composicion/:idComposicion` | CU19 | COMPOSICION_RETIRAR; no es borrado de Bitácora | R/T | 5 |
| GET | `/api/compras` | CU26 | Excluido: historial operativo rutinario | R/T | 3/6 |
| GET | `/api/compras/:idCompra` | CU26 | Excluido: detalle operativo rutinario | R/T | 3/6 |
| POST | `/api/compras` | CU25 | COMPRA_REGISTRAR | R/T | 6 |
| POST | `/api/compras/:idCompra/anular` | CU27 | COMPRA_ANULAR; B1/A/MIXTO | R/T | 6 |
| GET | `/api/inventario` | CU21 | Excluido: stock operativo rutinario | R/T | 3/6 |
| GET | `/api/inventario/medicamentos/:idMedicamento/existencias` | CU22 | Excluido: existencias rutinarias | R/T | 3/6 |
| GET | `/api/inventario/movimientos` | CU24/CU40 | Excluido: historial operativo rutinario | R/T | 3/6 |
| GET | `/api/inventario/proximos-a-vencer` | CU33 | Excluido: consulta rutinaria de vencimientos | R/T | 3/6 |
| GET | `/api/inventario/vencidos` | CU34 | Excluido: consulta rutinaria de vencimientos | R/T | 3/6 |
| GET | `/api/inventario/stock-bajo` | CU37 | Excluido: consulta rutinaria de disponibilidad | R/T | 3/6 |
| POST | `/api/inventario/ajustes` | CU23 | INVENTARIO_AJUSTAR o INVENTARIO_CONCILIAR sin diferencia | R/T | 6 |
| POST | `/api/inventario/retiros/vencimiento` | CU35 | INVENTARIO_RETIRAR_VENCIMIENTO | R/T | 6 |
| POST | `/api/inventario/retiros/dano` | CU36 | INVENTARIO_RETIRAR_DANO | R/T | 6 |
| GET | `/api/bitacora` | CU42 | BITACORA_CONSULTAR: lectura sensible | R/T | 4 |
| GET | `/api/bitacora/:idEvento` | CU42 | BITACORA_EVENTO_CONSULTAR: lectura sensible | R/T | 4 |

Las lecturas excluidas no crean éxitos porque son consultas operativas frecuentes y pueden ser automáticas. CU04/CU05 y CU42 sí permiten investigar acceso a información sensible. El evento de lectura no contiene la lista devuelta ni filtros completos. Una consulta CU42 se materializa antes de auditarse: su propio evento no pertenece al snapshot recién leído.

## Contrato y garantías de la primera versión

- Tabla única `bitacora_auditoria`, INT AUTO_INCREMENT, referencias lógicas sin FKs/cascadas. Catálogo de tipos extensible en código, sin migración por evento futuro.
- UTC con milisegundos: `fechaEvento` del hecho observado y `fechaRegistro` del registro. Filtros temporales sobre registro, inclusive en ambos extremos y con zona explícita. No reinterpreta DATETIME históricos del negocio.
- 32 KiB para JSON combinados, 100 referencias, formato 1. Altas integrales/compras grandes acotan referencias con total omitido; no crean eventos por componente/detalle/movimiento.
- Correlación de servidor de 32 caracteres hexadecimales. UNIQUE `(correlacion, tipo_evento)`; tercer fallo y bloqueo comparten correlación. No promete idempotencia universal ni cambia la clave de compras.
- IP: exclusivamente socket normalizado, `SOCKET_PEER` o `NO_DISPONIBLE`. Las cabeceras reenviadas no son autoridad; no se cambia normalización/HMAC/cuotas de recuperación. Detrás de Railway puede ser IP del intermediario.
- Responsable comprobado e identidad histórica, distintos de cuenta objetivo. Reconocer una cuenta no autentica al solicitante.
- Excluye contraseñas/hashes/JWT/cookies/códigos/HMAC/secretos/bodies completos y datos personales innecesarios. Cambios de correo/teléfono/dirección/descripción guardan nombres de campos, no valores. SQL logging predeterminado desactivado; diagnósticos propios sanitizados.
- Éxitos críticos en transacción de negocio. Fallo obligatorio: rollback y 503 `No se pudo completar el registro de auditoría`. Rechazos y controles/hechos ya confirmados: transacción independiente, sin revertir protección ni respuesta original ante fallo exclusivo del auditor.
- `intentarRegistrar()` informa CONFIRMADO o NO_CONFIRMADO; este último no prueba ausencia tras commit incierto. No hay reintentos automáticos ni recursión. Errores después del commit conservan efecto CONFIRMADO; pérdida de confirmación indica INCIERTO.
- CU42 exclusivo de Administrador: `{ data, paginacion: { pagina, limite, total, totalPaginas } }` y detalle `{ data }`, DTO camelCase. Página 25/máxima 100; listado/count en REPEATABLE READ. No promete snapshot entre solicitudes.
- Conservación mínima: cinco años, **60 meses calendario desde registro**, o períodos legales superiores aplicables. No acredita cumplimiento legal automático. Sin cron, edición, eliminación o archivo automáticos; cumplir el mínimo no autoriza borrar. `down()` impide DROP automático.

## Evidencia de aceptación

Las suites `backend/tests/auditoria.*.test.js` comprueban contrato/esquema, captura HTTP, seguridad, consultas, catálogo e inventario, privacidad, permisos, rollback, incertidumbre y fallos posteriores. La regresión final sin `*.integration.test.js` aprobó **492 pruebas, cero fallidas/canceladas/omitidas**. Utiliza transporte/estado simulados; no acredita por sí sola InnoDB ni persistencia real. `auditoria.cobertura.test.js` contrasta las 46 rutas Express con el clasificador y esta matriz; comprueba caja/slash/HEAD y SQL logging desactivado. Sintaxis y `git diff --check` aprobados.

La suite `backend/tests/auditoria.integration.test.js` se ejecutó con autorización expresa en **MySQL 8.0.46 local**. Resultado: **19 pruebas aprobadas, cero fallidas/omitidas**. Verificó DDL migrado, CHECK efectivos, JSON, UNIQUE concurrente, UTC milisegundos, rollback InnoDB de auditoría y negocio, recuperación de un evento en otro proceso, API CU42, snapshot REPEATABLE READ frente a INSERT concurrente, login/bloqueo, alta y consulta de usuarios, contraseña/recuperación, compra y rollback obligatorio, carreras de anulación/ajuste e identidades históricas.

Base de la ejecución final aprobada conservada: `cadefar_auditoria_59f43f5565b0`. Se confirmó la creación estricta sin IF NOT EXISTS para que una colisión nunca permita migrar una base previa. Ejecución aprobada anterior conservada: `cadefar_auditoria_7b839b230cee`. Primera ejecución de preparación conservada: `cadefar_auditoria_86174527ead2`; detectó dos expectativas incorrectas del fixture (relación por correlación y nombre del contador), corregidas antes de la ejecución aprobada. Ninguna base existente se migró; no se eliminaron bases ni eventos. Estas bases contienen solo fixtures sintéticos.

Reproducción desde `backend/`, con MySQL local y credenciales existentes (sin copiarlas a documentación):

```powershell
$archivos = Get-ChildItem 'tests/*.test.js' | Where-Object { $_.Name -notlike '*.integration.test.js' }
node --test $archivos.FullName

# Solo después de autorizar una nueva base local conservada:
$env:AUDITORIA_MYSQL_ACCEPTANCE = '1'
node --test tests/auditoria.integration.test.js
```

Cada ejecución de integración crea otra base aleatoria local y la conserva incluso si falla. El opt-in no habilita modificación de bases existentes ni infraestructura remota. Las otras suites MySQL históricas tienen sus propios procedimientos de limpieza; esta aceptación no las ejecutó.

## Integraciones futuras y pendientes operativos

CU28–CU32 (Ventas/Recetas), CU38/CU39 (reportes) y CU41 (pérdidas) conservan su estado funcional pendiente. Integrar auditoría cuando existan sus operaciones; no se crearon fases, endpoints ni migraciones exclusivas para eventos futuros. Las cuatro entregas frontend están completas: acceso, listado, filtros, paginación del servidor y detalle histórico, con aceptación integrada local React/Express/MySQL en Fase 4. La habilitación en el entorno de destino conserva sus pendientes operativos.

Para el entorno de operación: aplicar migración con cuenta de migración y verificar esquema; separar cuenta de aplicación con SELECT/INSERT en Bitácora y sin UPDATE/DELETE/DDL sobre ella. La cuenta local revisada mediante SHOW GRANTS permite modificación/DDL: no se acredita protección SQL append-only con esa cuenta. No se crearon usuarios ni GRANT. Los hooks ORM pueden evitarse con SQL directo o hooks desactivados.

También pendientes: responsables de conservación, respaldos/restauración, RPO/RTO y obligaciones legales superiores; volumen representativo y objetivos de rendimiento; topología/cadena de confianza Railway antes de capturar IP original. Esta prueba no acredita envío al buzón, restauración de respaldo, cumplimiento legal ni disponibilidad de producción. Sequelize 6 puede emitir warnings propios con el mensaje original ante fallos de COMMIT/ROLLBACK; los diagnósticos de la aplicación son sanitizados, pero falta resolver ese comportamiento de dependencia para una garantía completa sobre todos los logs de infraestructura.

Sin tabla disponible, login correcto, cambios efectivos de contraseña y escrituras críticas integradas requieren auditoría y devuelven 503 si no pueden registrarla. No se realizó despliegue ni migración en el entorno operativo.

## Frontend — Fase 1: acceso y listado

Implementada la ruta `/bitacora` dentro de ProtectedRoute/RoleRoute para Administrador, con acceso desde el menú y desde Inicio. Feature `frontend/src/features/bitacora/`: Service, página, tabla, resultado, presentación y estilos. Diseño guiado por `.agents/skills/frontend-design/` conservando los tokens y layout de CADEFAR.

La consulta usa exclusivamente `GET /api/bitacora?pagina=1&limite=25` mediante Axios común y cookie HttpOnly. Muestra eventos en el orden del backend y el total recibido, con etiquetas legibles, resultado textual/color, registro afectado, responsable histórico y cuenta objetivo diferenciados. No hace consultas adicionales de usuarios para reconstruir identidades. Las fechas de registro se convierten desde ISO con zona a `America/La_Paz`, con segundos y milisegundos; los instantes originales del backend siguen siendo UTC.

Actualizar/reintentar son explícitos. Carga nueva retira resultados anteriores; respuestas tardías tras salir no alteran otras pantallas. 401/403 bloquean reintentos y 401 ofrece volver al login. Los errores 400/404/500/503/red se distinguen de un historial vacío; una respuesta incompleta tampoco se presenta como cero eventos. Los códigos desconocidos y textos del servidor se muestran como datos, sin HTML ejecutable. La tabla admite desplazamiento horizontal y foco visible por teclado en móvil.

Verificación: `tests/bitacora.browser.test.mjs`, 15 pruebas aprobadas y 20 consultas Bitácora interceptadas; regresiones `app-shell.browser.test.mjs` y `compras.browser.test.mjs`, 54 pruebas aprobadas. Total: 69, cero fallidas/canceladas/omitidas. Revisión de capturas en escritorio y 320/375/768/1440 px. `pnpm build` aprobado, con aviso de chunk superior a 500 kB (560.43 kB, gzip 159.83 kB). API simulada en Chrome real; esta entrega no conectó ni escribió en MySQL y no acredita aún aceptación integrada frontend/backend.

La Fase 2 amplía esta entrega con filtros explícitos y paginación del servidor con criterios en URL; la Fase 3 incorpora detalle histórico y retorno conservando consulta. La Fase 4 completa la aceptación integrada local.

## Frontend — Fase 2: filtros y paginación

Implementados los doce filtros del contrato: desde/hasta, responsable, cuenta objetivo, nombre ingresado, dirección IP capturada, módulo, operación, tipo de evento, resultado, tipo de registro e ID del registro. Los seis principales quedan visibles y los complementarios se agrupan en Más filtros. No se consulta un catálogo de usuarios actuales para filtrar identidades históricas.

Buscar aplica el borrador y reinicia página; editar controles o expandir filtros no consulta ni registra lecturas. Actualizar conserva criterios aplicados incluso con cambios pendientes. Limpiar reinicia filtros, página 1 y tamaño 25. Paginación Anterior/Siguiente con 25/50/100 eventos; cambiar tamaño reinicia página conservando criterios aplicados. Cada acción explícita de lectura hace una petición acotada, sin descargar todo el historial ni reintentos periódicos.

Los criterios aplicados, tamaño y página se conservan en query string. Recarga y Atrás/Adelante restauran consulta y controles; una respuesta tardía de otra página se ignora. Se validan IDs canónicos hasta INT máximo, límites, códigos, rangos y dependencia ID/tipo de registro. Las URLs desconocidas, repetidas o inválidas bloquean la lectura y ofrecen corrección mediante Buscar/Limpiar, sin descartarlas silenciosamente.

Los datetime-local representan hora de Bolivia, no la zona del equipo; se envían como ISO con `-04:00`. Al recuperar una URL UTC o con otra zona se conserva el instante y los milisegundos. Los extremos son inclusivos sobre fecha de registro. Resultado vacío con filtros orienta a modificarlos; página fuera de rango ofrece volver explícitamente a la primera página, sin lectura correctiva automática. Se indica que solicitudes de páginas distintas no comparten una instantánea fija. El Service comprueba también página, límite y totalPaginas recibidos antes de presentar resultados.

Verificación de esta entrega: 29 pruebas de Bitácora aprobadas (5 de contrato/fechas/validación y 24 de navegador, incluida la prueba contenedora), con 50 lecturas interceptadas; 54 regresiones de navegación/Compras aprobadas. Total 83, cero fallidas/canceladas/omitidas. Chrome con API simulada, zona del equipo Asia/Tokyo y revisión de capturas de filtros, tabla y paginador a 320/375/768/1440 px. `pnpm build` y comprobaciones de sintaxis/formato aprobados; permanece el aviso de chunk mayor a 500 kB (569.97 kB, gzip 162.69 kB). No se conectó a MySQL en esta entrega. El detalle se implementa en Fase 3; la aceptación integrada frontend/backend corresponde a Fase 4.

## Frontend — Fase 3: detalle histórico

Implementada `/bitacora/:idEvento` dentro de la misma protección del Administrador. El nombre del evento en cada fila abre su detalle; filtros, página y límite viajan en la URL de React, permitiendo recarga o apertura en otra pestaña y retorno mediante Volver a Bitácora. El Service solicita exclusivamente `GET /api/bitacora/:idEvento`, sin trasladar criterios del listado al backend. El enlace al evento relacionado conserva también la consulta de retorno y no dispara lecturas anticipadas.

Se presentan identificador, tipo de evento, módulo/operación, resultado/causa, fecha de registro y fecha del evento, identidades históricas del responsable y cuenta objetivo, nombre ingresado, registro afectado, IP/procedencia, correlación, relación y versión. La interfaz distingue responsable autenticado de cuenta objetivo y no reconstruye identidades mediante usuarios actuales. Las fechas se muestran en Bolivia con milisegundos; los metadatos de bloqueo almacenados como texto SQL UTC se convierten explícitamente, sin tomar la zona del equipo.

Valores registrados compara únicamente campos permitidos del contrato antes/después y campos modificados capturados. Distingue ausente, nulo, cero y booleanos, conserva cadenas decimales sin redondeo y muestra cambios sin valores conservados cuando corresponde (correo/teléfono/dirección/descripción). Contexto de la operación presenta los metadatos pertinentes; referencias presenta las capturadas y el contador de omisiones cuando existe. No consulta automáticamente los recursos referenciados ni interpreta ausencia de snapshots como fallo. No se vuelca JSON arbitrario; claves ajenas al contrato quedan fuera de la presentación, y todos los textos se renderizan como datos. Una versión futura muestra datos generales y aviso de incompatibilidad sin interpretar sus JSON como versión 1.

IDs inválidos no solicitan la API; 404 informa evento no encontrado. El Service identifica respuestas incompletas o referencias inválidas antes de renderizar. Actualizar y reintentar son explícitos; se retira el detalle anterior durante carga, y respuestas tardías al cambiar evento/salir se ignoran. 401/403 bloquean reintentos; 401 ofrece navegación al login. El detalle enfoca el encabezado y comienza arriba al cambiar evento. No incorpora formularios de edición o eliminación.

Verificación: 40 pruebas de Bitácora aprobadas (5 de contrato/fechas/validación y 35 de navegador, incluida la contenedora), más 54 regresiones de navegación/Compras: 94 aprobadas, cero fallidas/canceladas/omitidas. Se interceptaron 53 lecturas de listado y 30 de detalle; ninguna escritura ni API de recursos adicionales. Chrome con API simulada y zona Asia/Tokyo; revisión visual a 320/375/768/1440 px, con nombres largos y 100 referencias. Build, sintaxis y formato aprobados; aviso de chunk mayor a 500 kB (584.57 kB, gzip 166.21 kB). Esta entrega no conectó a MySQL; la aceptación integrada se registra en Fase 4.

## Frontend — Fase 4: aceptación integrada local (13/10/2026)

Nueva suite `frontend/tests/bitacora-real.browser.test.mjs`, con opt-in `BITACORA_FRONTEND_MYSQL_ACCEPTANCE=1`. Crea estrictamente una base local nueva, aplica migrations y el seeder de roles, y conserva base/eventos al terminar o fallar. No reutiliza/migra bases preexistentes ni ejecuta suites históricas que eliminan sus bases temporales. Reutiliza `tests/helpers/navegadorReal.mjs` con selector de espera configurable, tamaño de ventana, zona horaria y observación de query CU42; no utiliza su intercepción de respuestas. Chrome solicita DTOs, cookies y estados HTTP al Express real, que accede a MySQL real.

**Resultado aprobado: 14 pruebas integradas, cero fallidas/canceladas/omitidas, MySQL 8.0.46.** Base final conservada: `cadefar_bitacora_ui_b2f20788ca1e`. Ejecución inicial de preparación conservada: `cadefar_bitacora_ui_a2c1a4fa4a23`; falló por tres expectativas del fixture: compra con referencias aún inferiores al límite, búsqueda que encontraba el 404 recién auditado, y diagnósticos de rechazos esperados que no eran una lista vacía. Se corrigieron las expectativas, sin cambiar frontend/backend funcional por esos resultados.

Escenarios verificados de extremo a extremo:

- Login real en sesiones independientes, cookie HttpOnly/SameSite Lax, CORS con credenciales y sesión restaurada por recarga; ningún token en almacenamiento React accesible.
- Orden descendente estable de 63 eventos sintéticos con igual instante, páginas 25/50/100 y total contrastados contra la base. Los eventos históricos de preparación se insertan mediante el preparador/Repository del backend con fecha explícita; no se presentan como capturas de solicitudes reales anteriores.
- Filtros combinados, extremos temporales exactos inclusivos y milisegundos en Bolivia desde navegador Asia/Tokyo; editar/expandir no hace consultas. Cuenta objetivo y nombre ingresado también llegan al backend y distinguen resultados vacíos.
- Cada lectura materializada genera su evento posterior, excluido de su propio snapshot. El rechazo 404 real queda consultable al buscar el registro de Bitácora correspondiente; no se confunde con ausencia de eventos.
- Cambio real del nombre/rol/correo de un usuario: valores antes/después y campos privados sin valores conservados; eventos anteriores mantienen nombre/rol históricos. Detalle, recarga y retorno conservan criterios/página/tamaño sin pasar filtros al GET por ID.
- Tres contraseñas incorrectas desde Login generan tres fallos y un bloqueo distinto, correlacionados; la UI distingue responsable ausente de cuenta objetivo y presenta tiempos/metadatos del bloqueo.
- Compra real de 52 líneas: una operación/evento, 52 detalles/movimientos, importes recibidos sin recálculo en React, 100 referencias capturadas y 5 omitidas. Se crean exclusivamente datos sintéticos de la base aislada mediante el endpoint existente.
- Regente/Vendedor/sin sesión: restricciones visuales y rechazos reales 403/401 de listado y detalle. Cambio del rol en servidor frente a Context previo provoca 403; logout por API frente a Context previo provoca 401, bloqueo de reintento y enlace al login.
- URLs inválidas bloquean lecturas en React; la API valida 400 y detalle inexistente 404. Una parada real del servidor HTTP provoca error de red, retira datos y admite reintento explícito tras reiniciar el listener. Otro proceso Node recupera exactamente el evento/fecha/total persistidos; los DTOs anteriores permanecen intactos.
- Revisión visual de datos reales a 320/375/768/1440 px; ausencia de desbordamiento, sin contraseñas/hashes/correo privado en DTOs, DOM o diagnósticos sanitizados. Las 39 solicitudes CU42 observadas son GET; Bitácora no origina escrituras ni formularios de edición.

Regresión final: **185 pruebas frontend sin MySQL** (Bitácora/contrato, navegación, Compras, Inventario, Medicamentos, CU09/Usuarios) y **492 backend sin suites MySQL**, todas aprobadas. Con las 14 integradas: **691 pruebas aprobadas, cero fallidas/canceladas/omitidas en las ejecuciones finales**. La aceptación MySQL backend de 19 pruebas de Fase 7 conserva su evidencia anterior; no se repitió en esta entrega. Build, sintaxis y formato aprobados; permanece el aviso de bundle de 584.57 kB (gzip 166.21 kB). No se realizó despliegue, migración de base operativa, commit ni push.

Reproducción desde `frontend/`, después de autorizar otra base local nueva y conservada:

```powershell
$env:BITACORA_FRONTEND_MYSQL_ACCEPTANCE = '1'
node --test tests/bitacora-real.browser.test.mjs

node --test --test-concurrency=1 tests/bitacora-consulta.test.mjs tests/bitacora.browser.test.mjs tests/app-shell.browser.test.mjs tests/compras.browser.test.mjs tests/inventario.browser.test.mjs tests/medicamentos.browser.test.mjs tests/cu09.browser.test.mjs
pnpm build
```

Las credenciales se leen de la configuración local backend; no se copian en comandos/documentación. La aceptación acredita el alcance local ejercido, sin sustituir la revisión manual con datos del entorno de destino ni resolver los pendientes operativos descritos arriba.
