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

CU28–CU32 (Ventas/Recetas), CU38/CU39 (reportes) y CU41 (pérdidas) conservan su estado funcional pendiente. Integrar auditoría cuando existan sus operaciones; no se crearon fases, endpoints ni migraciones exclusivas para eventos futuros. La UI de Bitácora queda pendiente.

Para el entorno de operación: aplicar migración con cuenta de migración y verificar esquema; separar cuenta de aplicación con SELECT/INSERT en Bitácora y sin UPDATE/DELETE/DDL sobre ella. La cuenta local revisada mediante SHOW GRANTS permite modificación/DDL: no se acredita protección SQL append-only con esa cuenta. No se crearon usuarios ni GRANT. Los hooks ORM pueden evitarse con SQL directo o hooks desactivados.

También pendientes: responsables de conservación, respaldos/restauración, RPO/RTO y obligaciones legales superiores; volumen representativo y objetivos de rendimiento; topología/cadena de confianza Railway antes de capturar IP original. Esta prueba no acredita envío al buzón, restauración de respaldo, cumplimiento legal ni disponibilidad de producción. Sequelize 6 puede emitir warnings propios con el mensaje original ante fallos de COMMIT/ROLLBACK; los diagnósticos de la aplicación son sanitizados, pero falta resolver ese comportamiento de dependencia para una garantía completa sobre todos los logs de infraestructura.

Sin tabla disponible, login correcto, cambios efectivos de contraseña y escrituras críticas integradas requieren auditoría y devuelven 503 si no pueden registrarla. No se realizó despliegue ni migración en el entorno operativo.
