# Exportaciones CADEFAR — perfil Railway opt-in

## Estado y decisión nueva

Implementación solicitada después del cierre LOCAL de Fase 7. **No desplegada, no habilitada en Railway y sin conexiones MySQL en esta entrega.** Las evidencias y límites históricos de `fases.md` y `contratos-reportes-react.md` no se convierten en aceptación del despliegue.

Se añade disponibilidad explícita para una demostración universitaria pública en Railway, con una réplica/un proceso Node. No se cambia NODE_ENV a development ni se considera loopback al proxy. Contratos de rutas, roles, queries, DTO, documentos, MIME, nombres, snapshots, redondeo, auditoría y cuotas se conservan. La restricción exclusiva LOCAL anterior se extiende **solo** por esta nueva solicitud; los escenarios no acreditados siguen pendientes.

## Configuración prevista, NO aplicada

Solo en el **backend**, tras autorizar y verificar un entorno aislado:

```env
NODE_ENV=production
REPORTES_EXPORTACION_PERFIL=RAILWAY
REPORTES_EXPORTACION_REPLICAS=1
```

Railway debe aportar `RAILWAY_SERVICE_ID`, `RAILWAY_DEPLOYMENT_ID` y `RAILWAY_ENVIRONMENT_ID`. No son permisos ni sustituyen login/roles. El perfil exige Linux y metadatos de formato válido; una cabecera HTTP nunca lo habilita. REPLICAS=1 es declaración de configuración del operador, **no consulta ni comprobación del panel Railway**, y no admite PM2/cluster con varios procesos. Sin opt-in producción conserva 503; test tampoco lo habilita. LOCAL conserva development + socket loopback y sus verificaciones anteriores. Valores desconocidos de perfil se rechazan.

No se requieren nuevos secretos, tablas, migraciones, endpoints, volúmenes o dependencias. No usar el volumen MySQL para documentos. No se han cambiado variables, número de réplicas, límites, configuración de drenaje ni despliegues del usuario. El rollback de disponibilidad es retirar el opt-in y reiniciar por el procedimiento autorizado, no cambiar NODE_ENV.

## Recursos y temporales

- Límite/uso de memoria desde cgroup v2 o v1; rechaza valores ilimitados/sentinelas, ausencia de lectura o menos de 128 MiB de margen. No usa memoria libre del host como prueba de recursos del contenedor.
- Admisión con al menos **640 MiB de disco libre**: cuota existente de 512 MiB por trabajo más margen de 128 MiB. **No reserva físicamente disco** frente a otros procesos.
- Directorio privado fuera del repositorio, bajo el temporal del contenedor. Nombre derivado de servicio/despliegue; mkdir exclusivo 0700, verificación lstat de UID, modo exacto, no symlink e identidad dev/inode. Nunca usar una carpeta pública o el filesystem del frontend.
- Solo el proceso que creó la raíz puede usarla. Si ya existe (otro proceso o residuo de reinicio), perfil cerrado: no chmod, no reclamación por PID/antigüedad, no barrido de /tmp. La recuperación de un residuo requiere inspección/acción operativa específica autorizada; un nuevo despliegue con filesystem efímero propio evita reutilizarlo.
- Cada trabajo sigue usando sus directorios exclusivos y cleanup existente. La raíz del proceso se elimina con rmdir **solo vacía y con identidad comprobada** al cerrar. Si queda residuo, no borrado recursivo indiscriminado; admisión cerrada.
- Vigilancia durante extracción/generación/entrega: RSS del proceso (incluye workers nativos del mismo proceso), incremento permitido hasta 128 MiB respecto a admisión, y sondeo cada segundo del cgroup, disco e identidad del temporal. Aborta por presión de recursos. El RSS es cooperativo/muestreado: **no garantiza capturar todo pico entre comprobaciones ni evita un OOM impuesto por el contenedor**.

Cuotas conservadas: final 128 MiB, trabajo 512 MiB, CSV/XLSX tabular 1.000.000 filas, PDF 10.000 filas/500 páginas, estadísticas 1200 intervalos/8 series/9600 filas. Si no caben, rechazo/error íntegro, no archivo recortado. Un trabajo por **proceso** incluida entrega, sin cola ni retry automático. Durante solapamiento de despliegues puede haber dos procesos/raíces independientes; no se promete exclusión global entre contenedores.

## SQL y cierre

`reporte-plazo-sql.js` aplica exclusivamente a la transacción RR de una exportación Railway:

1. Comprueba MySQL 8 y lee los valores de sesión anteriores en esa conexión.
2. Antes de **cada** SELECT de resumen/bloque/series, establece max_execution_time con presupuesto restante de extracción (máximo 60 s) y lock_wait_timeout con el resto redondeado a segundos. No otorga otros 60 s por bloque.
3. Espera siempre la resolución/rechazo del SELECT; no Promise.race que libere SQL vivo. Errores MySQL 3024/1205 se presentan como timeout de generación seguro.
4. Restaura ambos valores antes de finalizar/devolver la conexión. Si restaurar falla, fuerza descarte de la conexión, marca la transacción finalizada e impide nuevas exportaciones en esa instancia; nunca vuelve al pool una sesión de límites desconocidos.

GET ordinarios/estadísticas independientes no reciben cambios de configuración. No se cambia zona horaria, cálculo monetario, selección o contenido de consulta. SET SESSION no modifica datos de farmacia. Generación sigue con 120 s desde admisión, entrega con otros 120 s, cliente con 270 s. **Los límites del motor no son un deadline duro de red, adquisición de conexión, SET/COMMIT/ROLLBACK ni garantía de interrupción instantánea de MySQL**; efectividad y privilegios de sesión requieren prueba posterior con motor real.

SIGTERM/SIGINT: el servidor cierra admisión, aborta las señales de trabajos y espera sus terminales/cleanup, además del cierre HTTP, antes de cerrar Sequelize. Incluso si una limpieza falla se espera el cierre HTTP. El operador debe comprobar el drenaje de Railway y el comportamiento ante terminación forzada: SIGKILL no ejecuta finally ni garantiza auditoría terminal/cleanup. No se ha configurado automáticamente `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` ni una coordinación distribuida.

La señal efectiva del trabajo se mantiene en el artefacto interno y la utiliza el pipeline HTTP: un cierre o aborto por recursos también interrumpe entrega, no solo generación. La prueba de cierre incluye un transporte bloqueado y verifica terminal de cancelación, destrucción del flujo y limpieza antes de completar el cierre.

## HTTP y frontend

CORS mantiene FRONTEND_URL explícito y credentials:true; añade exposedHeaders para Content-Disposition/Retry-After. No CORS '*', no cambio de cookies/roles/rutas. El fallback seguro sigue funcionando si otro intermediario oculta el nombre.

En `ExportacionTabular.jsx` únicamente se neutraliza el aviso exclusivo LOCAL: el servidor decide disponibilidad por entorno/recursos. Se conservan límite Blob, snapshots independientes, mensajes sin prometer guardado/apertura y cancelación sin prometer detener SQL o deshacer auditoría. Skill frontend-design aplicada para conservar diseño; sin cambios de CSS, jerarquía, controles o sidebar.

El arnés `reportes-real.browser.test.mjs` se adapta a las nuevas cabeceras expuestas (nombre servidor y Retry-After), **pero no se ejecuta**: necesita autorización nueva para conexiones. Su evidencia LOCAL histórica de cabeceras ocultas corresponde al código anterior y se conserva como tal.

## Pruebas y verificación pendiente

`backend/tests/reporte.railway.test.js`: configuración fail-closed, cgroups v1/v2, disco/memoria, privacidad/identidad, residuo, presión transitoria, vigilancia/liberación, SQL generado/presupuesto/restauración/descarte, CORS, cierre HTTP/DB, cancelación al cerrar y 21 variantes con NODE_ENV=production y generadores reales sobre SQL simulado. Una guarda prohíbe getConnection. Linux/cgroups/permisos se simulan mediante dependencias inyectadas en Windows: **no son verificación de un contenedor Railway real**.

Los lectores/archivos/servidores localhost de las regresiones son pruebas controladas, no acceso a servicios desplegados. PDF.js conserva avisos por canvas/DOMMatrix/Path2D opcionales; texto/operadores no equivalen a rasterización o revisión visual. No instalar dependencias para ocultarlos.

Pendiente, con autorización específica de entorno aislado: disponibilidad cgroup/disco reales, propietarios/permisos y residuos tras reinicio, pico de RAM de formatos y datos acotados/grandes, MySQL 8/SET SESSION/timeout real y restitución del pool, límites del edge/drenaje/solapamiento, cookies/CORS desde navegador entre dominios reales, las 21 variantes/lecturas y revisión visual de documentos. No probar con información operativa ni reutilizar autorizaciones anteriores. El defecto de retorno postlogin con query de Fase 7 no se corrige en esta tarea.

**Implementación no equivale a habilitación ni aceptación productiva.** No se realizó commit, push, despliegue o acceso Railway/MySQL; habilitar el opt-in en el servicio público es una acción posterior.

## Registro de verificación de esta entrega — 21/11/2026

Archivos principales: `backend/src/shared/utils/reporte-railway.js`, `data/repositories/reporte-plazo-sql.js`, `reporte.repository.js`, `reporte.extraccion.repository.js`, `business/services/reporte.exportacion.service.js`, `presentation/controllers/reporte-exportacion.controller.js`, `app.js` y `server.js`; frontend `ExportacionTabular.jsx`, `reportes-tabular.browser.test.mjs` y adaptación no ejecutada del arnés real. Documentación nueva aquí y enlace desde `fases.md`; guía normativa original conservada.

Comandos desde backend:

```text
node --test --test-concurrency=1 tests/reporte.railway.test.js tests/reporte.exportacion.test.js tests/reporte.conjunta.test.js tests/reporte.base.test.js tests/reporte.estadisticas.test.js tests/reporte.perdidas.estadisticas.test.js
96 aprobadas, 0 fallidas/canceladas/omitidas. 13 pruebas del archivo Railway;
sus bucles de 21 variantes no se cuentan como tests adicionales.
```

Desde frontend (navegadores secuenciales/API siempre simulada):

```text
node --test --test-concurrency=1 tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs tests/reportes-tabular.browser.test.mjs tests/reportes-ventas.browser.test.mjs tests/reportes-estadisticas.test.mjs tests/reportes-estadisticas-fuentes.test.mjs tests/reportes-estadisticas-ciclo.test.mjs tests/reportes-estadisticas.browser.test.mjs tests/reportes-navegacion.test.mjs
205 aprobadas: 86 unitarias/ciclo/transporte + 119 navegador/API simulada.
pnpm build
Vite 8.3.0: 254 módulos; JS 352.98 kB (gzip 81.66), vendor 362.77 kB
(gzip 116.99), CSS 80.44 kB (gzip 12.79). Sin dependencias nuevas.
node --check tests/reportes-real.browser.test.mjs
Solo sintaxis: NO se ejecutó ese arnés ni se reutilizó su autorización.
git diff --check
```

Primera ejecución backend: 52/53; la expectativa de identidad de una transacción vacía del test falló porque Sequelize clona objetos planos al preparar opciones. Se corrigió el fixture a una instancia de clase, como una Transaction real; no se modificó Sequelize para satisfacer el test. Después 54/54, ampliación 95/95 y final 96/96. La revisión de código reforzó la propagación de aborto al pipeline de entrega y su prueba de cierre bloqueado. No se ocultan fallos ni se suman iteraciones. Estática/unitarias/HTTP local/archivos/SQL simulados son evidencia distinta de motor/contendor/hosting, que no se ejercieron.

Estado Git inicial limpio, sin cambios ajenos que sobrescribir. No modificación de entorno local, secretos, migrations, paquetes/lock, rutas, permisos, sidebar ni diseño. Los temporales de pruebas controladas se eliminan en finally; no creación/limpieza de recursos Railway o MySQL.

`git diff --check` aprobado (solo avisos de normalización futura LF → CRLF). Cuatro archivos nuevos revisados individualmente con `git -c core.autocrlf=false diff --no-index --check -- NUL <archivo>`, sin diagnósticos de espacios. Sin archivos frontend nuevos sin seguimiento.

## Diagnóstico sanitizado de disponibilidad — entrega posterior

Ante «Formato no disponible», el control Railway emite en el **log del backend**:

```text
{ codigo: 'EXPORTACION_RAILWAY_NO_DISPONIBLE',
  causa: 'CGROUP_NO_ACREDITADO', etapa: 'INICIALIZACION' }
```

Ejemplo ilustrativo, **no causa observada en el despliegue**. No se accedió a Railway/MySQL. Para identificar el rechazo real hay que desplegar este cambio mediante el procedimiento del operador, intentar una exportación y buscar el código anterior. No se añade endpoint de diagnóstico ni se expone información extra en HTTP: el cliente conserva 503 «Formato no disponible».

| Causa | Significado |
|---|---|
| NODE_ENV_INVALIDO / PERFIL_NO_ACTIVO / REPLICAS_NO_ACREDITADAS / PLATAFORMA_NO_ADMITIDA | La configuración no satisface las guardas existentes. |
| METADATO_RAILWAY_INVALIDO | Falta un metadato válido. `campo` identifica únicamente el nombre SERVICE_ID/DEPLOYMENT_ID/ENVIRONMENT_ID completo, nunca su valor. |
| CGROUP_NO_ACREDITADO | Ningún layout v1/v2 proporciona límite/consumo finitos y válidos; puede ser inaccesible, ilimitado o no válido. No implica que falte RAM. |
| MEMORIA_INSUFICIENTE / MEMORIA_NO_CONSULTABLE | Margen insuficiente o fallo de comprobación de memoria. |
| DISCO_INSUFICIENTE / DISCO_NO_CONSULTABLE | Espacio libre insuficiente o statfs fallido. |
| TEMPORAL_RESOLUCION_FALLIDA / REPOSITORIO_NO_RESUELTO / TEMPORAL_DENTRO_REPOSITORIO | No se acredita ubicación segura fuera del repositorio. |
| TEMPORAL_EXISTENTE | mkdir exclusivo encontró raíz previa; no se reclama ni borra. |
| TEMPORAL_CREACION_FALLIDA / TEMPORAL_NO_CONSULTABLE | Creación o inspección fallida, sin mostrar mensaje/path/code crudos del SO. |
| TEMPORAL_NO_PRIVADO / TEMPORAL_IDENTIDAD_CAMBIADA | Fallan las verificaciones de propiedad/permisos/tipo o identidad. |
| INCREMENTO_RSS_EXCEDIDO | El trabajo excede el incremento RSS permitido. |
| SERVIDOR_CERRANDO / INSTANCIA_BLOQUEADA | Cierre o bloqueo de seguridad durante vigilancia. |
| TEMPORAL_CON_RESIDUOS / TEMPORAL_LIMPIEZA_FALLIDA | No se pudo retirar la raíz propia al cerrar; no se barre recursivamente. |

`etapa` es CONFIGURACION/INICIALIZACION/DISPONIBILIDAD/VIGILANCIA/CIERRE. Se registra **como máximo una vez por causa/etapa/campo por instancia**, también si se reintenta el mismo rechazo. Buscar en todo el log del despliegue activo, no solo la última petición. Un fallo permanente conserva su causa original; no la reemplaza en cada intento con un bloqueo genérico. No reiniciar repetidamente ni borrar temporales para obtener un log nuevo.

La salida contiene solo constantes internas; no valores de variables, credenciales, IDs de Railway, cookies/JWT, nombres de usuario, filtros, reportes, rutas, stack, mensajes/códigos arbitrarios de excepciones o métricas crudas. Un logger que falla no altera la disponibilidad ni habilita el perfil. No se modifican umbrales, política de reintento/limpieza, respuesta HTTP, roles o configuración del servidor.

Archivos modificados: `backend/src/shared/utils/reporte-railway.js`, `backend/tests/reporte.railway.test.js` y este registro. Estado Git inicial limpio. Pruebas focalizadas desde backend:

```text
node --test --test-concurrency=1 tests/reporte.railway.test.js tests/reporte.exportacion.test.js
36 aprobadas antes de añadir cobertura de diagnósticos posteriores a admisión.
node --test --test-concurrency=1 tests/reporte.railway.test.js tests/reporte.exportacion.test.js tests/reporte.conjunta.test.js
Final: 60 aprobadas, 0 fallidas/canceladas/omitidas.
git diff --check
```

Pruebas con guardas que prohíben conexiones MySQL, recursos Linux/cgroup simulados y regresión de los generadores/HTTP localhost controlados; incluye privacidad exacta del objeto registrado, deduplicación, errores con contenido sintético hostil, logger roto y rechazo conservado. No ejecución del arnés real, conexiones externas, lectura de .env para diagnóstico, instalaciones, frontend/build innecesarios, commit, push ni despliegue. Se mantienen los avisos PDF.js opcionales de la regresión, sin revisión visual.

## Corrección de raíz de código para backend desplegado separado

El usuario aportó el diagnóstico sanitizado `TEMPORAL_DENTRO_REPOSITORIO` en INICIALIZACION. Se comprobó un defecto concreto sin acceder al servidor: el cálculo fijo `../../../../` desde `src/shared/utils/reporte-railway.js` presupone un directorio backend dentro de un monorepo. En un paquete desplegado directamente en `/app`, ese cálculo devuelve `/`, y cualquier temporal como `/tmp` se considera contenido en el supuesto repositorio. La estructura exacta del contenedor del usuario no se inspeccionó; la reproducción acredita el defecto de ese layout, no una inspección remota.

`resolverRaizCodigo(archivos?, modulo?)` parte ahora de **tres** niveles hasta la raíz del paquete y valida su `package.json` (`name=backend`, `type=module`). Si el paquete se llama estructuralmente `backend` y existe el manifiesto hermano de `frontend` con `name=cadefar-frontend`, protege la raíz del monorepo completo. Si ese hermano no existe, protege el paquete backend separado; nunca supone que su padre sea el repositorio ni usa cwd o una variable del cliente. Manifiesto backend ausente/incorrecto, permisos de lectura o JSON inválido conservan cierre seguro con REPOSITORIO_NO_RESUELTO. No se buscan manifiestos ascendiendo hasta `/`.

Temporal y raíz siguen pasando por realpath, por lo que un enlace a una carpeta del código se rechaza. No se permiten temporales iguales a la raíz o contenidos en el código/public/frontend del monorepo acreditado. Privacidad/UID/mode/dev/inode, mkdir exclusivo, recursos, cuotas, cleanup y perfil production permanecen sin cambios. No se modifica el checker LOCAL ni otros módulos.

Archivos de esta corrección: `backend/src/shared/utils/reporte-railway.js`, `backend/tests/reporte.railway.test.js` y este documento. Nuevas pruebas: raíz de monorepo, backend en `/app`, backend independiente llamado `backend` sin hermano frontend, admisión externa, rechazo de raíces/subcarpetas/public/frontend y symlink resuelto dentro, manifiestos ausentes/incorrectos/ilegibles y lectura de la estructura real del repositorio sin escribir. Layouts de despliegue y filesystem simulados localmente; no aceptación de Linux/Railway real.

```text
Desde backend:
node --test --test-concurrency=1 tests/reporte.railway.test.js tests/reporte.exportacion.test.js tests/reporte.conjunta.test.js
63 aprobadas, 0 fallidas/canceladas/omitidas.
git diff --check
```

Primera ejecución 62/63: el mock realpath devolvía un separador final que el filesystem real elimina. Se corrigió exclusivamente su normalización, sin modificar guardas para satisfacer la expectativa. No escenarios omitidos ni suma de iteraciones. Avisos PDF.js opcionales heredados; sin revisión visual, frontend/build, dependencias, migraciones, conexiones Railway/MySQL, commit, push o despliegue. Estado Git inicial limpio. La corrección debe desplegarse por el operador para verificar si resuelve el rechazo reportado; pueden aparecer otras guardas no acreditadas todavía. No se deben borrar temporales ni desactivar comprobaciones.
