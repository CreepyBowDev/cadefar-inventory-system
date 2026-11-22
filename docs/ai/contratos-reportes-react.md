# Reportes y pérdidas — contratos técnicos para React

**Actualización documental: 21/11/2026.** Contrato del código existente, no aceptación productiva. Fuentes: rutas `reporte.router.js`/`inventario.router.js`, `reporte.validator.js`, materializadores, Services de reportes/exportación, Repository de extracción y utilidades `reporte-*` en `backend/src/`; consumo React en `frontend/src/features/reportes/` y `inventario/pages/MovimientosPage.jsx`. Frontend ya implementa consulta, estadísticas, gráficas y descargas. Los ejemplos son sintéticos; esta actualización no ejecutó solicitudes ni pruebas.

El documento se originó en la Fase 11 backend del 20/11. Los contratos se consolidan aquí en §1–8 y la evidencia conservada en §9. Las menciones §10.9/§10.16–10.20 de cierres originales son referencias históricas al plan sustituido, no enlaces al actual `fases.md`, dedicado a mejora visual. No se reconstruye evidencia faltante ni se atribuyen a ese seguimiento pruebas backend anteriores. La extensión Railway posterior está en [exportaciones-railway.md](exportaciones-railway.md).

## 1. Disponibilidad, sesión y permisos

Las consultas JSON están montadas. Las exportaciones admiten dos perfiles, seleccionados y comprobados por el backend:

- **LOCAL:** perfil omitido o `REPORTES_EXPORTACION_PERFIL=LOCAL`, `NODE_ENV` ausente o `development`, socket `127.0.0.1`, `::1` o `::ffff:127.0.0.1`, temporal accesible fuera del repositorio y preflight básico satisfactorio. No exponer un proxy loopback a Internet ni usar esta excepción con datos sensibles/equipo compartido.
- **RAILWAY opt-in:** `NODE_ENV=production`, `REPORTES_EXPORTACION_PERFIL=RAILWAY`, `REPORTES_EXPORTACION_REPLICAS=1`, Linux y metadatos Railway válidos. Requiere memoria cgroup acreditada, márgenes de recursos, temporal privado verificado y controles SQL. Una réplica es declaración del operador, no comprobación automática del panel. Configuración, diagnósticos y límites: `exportaciones-railway.md`.

Perfil desconocido, test, producción sin opt-in o guardas/recursos no acreditados: 503 `Formato no disponible`. La implementación del perfil no prueba que un despliegue lo tenga habilitado ni que satisfaga sus guardas. Los recursos comprobados no son una reserva ni una aceptación de infraestructura.

Todas las rutas siguientes son GET, sin body ni parámetros de path. `authMiddleware` → `requireRole` aplica en servidor; ocultar una pantalla no concede seguridad.

| Ruta | Roles | Respuesta |
|---|---|---|
| `/api/reportes/ventas` | Administrador | Consulta paginada |
| `/api/reportes/compras` | Administrador | Consulta paginada |
| `/api/reportes/perdidas` | Administrador, Regente | Consulta paginada |
| `/api/reportes/ventas/estadisticas` | Administrador | Estadística JSON |
| `/api/reportes/compras/estadisticas` | Administrador | Estadística JSON |
| `/api/reportes/perdidas/estadisticas` | Administrador, Regente | Estadística JSON |
| `/api/reportes/ventas/exportar` | Administrador | TABULAR/ESTADISTICA × CSV/XLSX/PDF |
| `/api/reportes/compras/exportar` | Administrador | TABULAR/ESTADISTICA × CSV/XLSX/PDF |
| `/api/reportes/perdidas/exportar` | Administrador, Regente | TABULAR/ESTADISTICA × CSV/XLSX/PDF |
| `/api/inventario/movimientos` | Administrador, Regente | Historial CU24/CU40 existente |
| `/api/inventario/movimientos/exportar` | Administrador, Regente | Solo TABULAR × CSV/XLSX/PDF |

Vendedor no accede; el permiso operativo del Regente en Compras no concede reportes de compras. Son 21 variantes de descarga, no 21 endpoints. Siete rutas nuevas (estadísticas/exportaciones) rechazan HEAD explícitamente con 405 y `Allow: GET`, después de autenticar/autorizar, sin consulta/generación; no usar HEAD como preflight de archivo.

Sesión existente: login coloca cookie `token` HttpOnly, duración 8 horas; `secure` en producción y `sameSite=none` en producción / `lax` fuera de ella (`auth-cookie.js`). `GET /api/auth/me` recupera información pública y logout elimina cookie. React consume con Axios `withCredentials: true` o fetch `credentials: 'include'`; nunca lee/guarda JWT en localStorage, sessionStorage, Context ni estado. Context guarda solo usuario público. Sesión ausente/inválida/expirada/revocada → 401; rol insuficiente → 403.

## 2. Parámetros estrictos

Cada valor HTTP debe ser un string único. Rechazo 400 de desconocidos, vacíos, repetidos/arrays/objetos y enums con caja distinta; no alias (`DAÑO`, no `DANO`). No reenviar indiscriminadamente parámetros de URL de la pantalla.

**Reportes:** exactamente una modalidad obligatoria: `dia=YYYY-MM-DD`, `mes=YYYY-MM` o `desde=YYYY-MM-DD&hasta=YYYY-MM-DD`. Calendario real 1000–9999, desde ≤ hasta, futuros admitidos; sin rango abierto, mezcla ni máximo artificial de días. Día y mes se normalizan a extremos inclusivos. Filtro opcional propio:

| Fuente | Filtro |
|---|---|
| ventas | `estadoOperacion=CONFIRMADA\|PENDIENTE\|ANULADA` |
| compras | `estadoOperacion=CONFIRMADA\|ANULADA` |
| pérdidas | `motivo=VENCIMIENTO\|DAÑO` |

| Operación | Campos adicionales |
|---|---|
| GET ordinario de Reportes | Solo `pagina` (1..2147483647, default 1), `limite` (1..100, default 25), enteros textuales canónicos sin ceros iniciales |
| Estadísticas JSON | `granularidad=DIA\|MES\|ANIO` obligatoria; sin paginación, formato, presentación, gráfico ni métrica |
| Exportación TABULAR | `formato=CSV\|XLSX\|PDF` y `presentacion=TABULAR` obligatorios; sin granularidad/gráfico/métrica/paginación |
| Exportación ESTADISTICA CSV | formato/presentación y granularidad obligatorios; **rechaza** gráfico/métrica/paginación |
| Exportación ESTADISTICA PDF/XLSX | formato/presentación/granularidad y `grafico=BARRAS\|LINEAS\|SECTORES`, `metrica` compatibles, todos obligatorios; sin paginación |

Métricas gráficas: ventas/compras `CANTIDAD|IMPORTE`; pérdidas `CANTIDAD_RETIROS|PERDIDA`, nunca CANTIDAD_RETIRADA. No defaults de presentación/formato/granularidad/gráfico/métrica.

**CU40:** GET existente y exportación reutilizan solo filtros opcionales `idMedicamento`, `idExistencia` (enteros HTTP canónicos 1..2147483647), `desde`, `hasta` (independientes, ordenados si concurren), `direccion=ENTRADA|SALIDA`, `motivo` (texto trim 1–40, **no enum**). Sin filtros = todas las coincidencias. Exportar añade formato obligatorio y `presentacion=TABULAR`; rechaza dia/mes/pagina/limite/granularidad/gráfico/métrica/ESTADISTICA. No segundo historial JSON ni estadística de inventario.

```text
GET /api/reportes/ventas?mes=2026-11&estadoOperacion=ANULADA&pagina=1&limite=25
GET /api/reportes/compras/estadisticas?desde=2026-11-15&hasta=2026-11-20&granularidad=MES
GET /api/reportes/perdidas/exportar?dia=2026-11-20&motivo=DA%C3%91O&formato=CSV&presentacion=TABULAR
GET /api/reportes/compras/exportar?mes=2026-11&formato=XLSX&presentacion=ESTADISTICA&granularidad=DIA&grafico=LINEAS&metrica=IMPORTE
GET /api/inventario/movimientos/exportar?formato=PDF&presentacion=TABULAR&idExistencia=7&desde=2026-01-01
```

## 3. JSON ordinario, fechas y exactitud

200 de Reportes: `{ data: { periodo, resumen, detalle }, paginacion: { pagina, limite, total, totalPaginas } }`. `periodo={ modalidad: 'DIA'|'MES'|'PERIODO', desde, hasta, zonaHoraria: 'America/La_Paz' }`. Resumen de **todas** las coincidencias filtradas; solo detalle paginado. Orden fechaReferencia DESC, ID DESC. Vacío: resumen cero, detalle [], total/totalPaginas 0. Página lejana no se reajusta, conserva resumen/total.

Detalle mínimo (todos los campos presentes):

| Fuente | Campos en orden de proyección |
|---|---|
| ventas | idVenta, estadoOperacion, categoria, fechaReferencia, fechaRegistro, fechaVenta, fechaAnulacion, total |
| compras | idCompra, idProveedorLaboratorio, estadoOperacion, fechaReferencia, fechaCompra, fechaRegistro, fechaAnulacion, total |
| pérdidas | idMovimiento, idExistencia, idMedicamento, codigoExistencia, codigoMedicamento, nombreComercial, idUsuario, motivo, fechaReferencia, fechaMovimiento, cantidad, costoUnitarioAplicado, perdida, idMovimientoReversion |

IDs/cantidades individuales/conteos/paginación son enteros JSON; importes/pérdidas strings con 2 decimales, costos con 6, cantidadRetirada agregada string entero canónico. Conteos no representables como entero seguro → 500, nunca redondeo. Fechas civiles literales: `YYYY-MM-DD` (adquisición), `YYYY-MM-DD HH:mm:ss` (DATETIME), sin Z ni offset. No aplicar `new Date()` para desplazarlas a UTC. Fechas opcionales de venta/anulación y referencia de reversión ausentes son null. Dinero no se calcula con Number/parseFloat; conservar strings y totales del backend.

Filtro DATETIME inclusivo 00:00:00..23:59:59.999999, DATEONLY inclusivo por día. El esquema **DATETIME(0)** no persiste fracciones: ese límite sigue sin aceptar, no se cambia DDL.

CU40 GET conserva `{ data: movimientos }`, DTO anidado `toPublicMovimiento` de `inventario.service.js`, incluida observacion; no adopta estas columnas mínimas ni paginación. La descarga es una proyección plana distinta (§5).

## 4. Categorías, indicadores y estadística

Ventas usa estado **actual del snapshot**: CONFIRMADA y ANULADA_CONFIRMADA (fecha_venta presente) por fecha_venta; PENDIENTE y ANULADA_SIN_CONFIRMAR por fecha_registro. ANULADA selecciona ambas clases. Compras usa fecha_compra de adquisición, no registro/anulación. Importes históricos de cabecera, no recalculados desde detalles/costos actuales. Una anulación posterior puede reclasificar un período pasado: no es cierre contable histórico.

Pérdidas: originales SALIDA VENCIMIENTO/DAÑO con id_movimiento_original NULL por fecha_movimiento; brutas, no netas. Referencia eventual de reversión se informa sin restar compensaciones, incluso fuera del período; no crea flujo operativo de reversión. RN91 redondea cantidad × costo aplicado **por movimiento** a centavos, empate arriba, antes de sumar (dos 1 × 0.005000 = 0.02). Costo cero cuenta retiro/unidades aunque importe sea cero. No se excluyen históricos por catálogos inactivos/existencias agotadas o vencidas; nombres/códigos relacionados son actuales del snapshot.

Resumen compartido por GET, estadísticas y documentos:

- Ventas: `confirmadas`, `pendientes`, `anuladasConfirmadas`, `anuladasSinConfirmar`, cada una `{ cantidad: number, importe: decimal2String }`; `totalVentasRealizadas` = solo confirmadas.importe.
- Compras: `confirmadas`, `anuladas` con esa estructura; `totalComprasRealizadas` = solo confirmadas.importe.
- Pérdidas: `vencimiento`, `dano` con `{ cantidadRetiros: number, cantidadRetirada: enteroString, perdida: decimal2String }`; globales `cantidadRetiros`, `cantidadRetirada`, `perdidaTotal` con esos mismos tipos.

Estadísticas 200: `{ data: { fuente, periodo, filtros, granularidad, sinDatos, resumen, intervalos, series, distribuciones } }`, sin paginacion. `fuente=VENTAS|COMPRAS|PERDIDAS`; filtros `{ estadoOperacion: valor|null }` o `{ motivo: valor|null }`.

| Fuente | Categorías en orden fijo | Métricas en orden / unidades |
|---|---|---|
| VENTAS | CONFIRMADA, PENDIENTE, ANULADA_CONFIRMADA, ANULADA_SIN_CONFIRMAR | CANTIDAD / OPERACIONES; IMPORTE / IMPORTE_MONETARIO |
| COMPRAS | CONFIRMADA, ANULADA | CANTIDAD / OPERACIONES; IMPORTE / IMPORTE_MONETARIO |
| PERDIDAS | VENCIMIENTO, DAÑO | CANTIDAD_RETIROS / RETIROS; CANTIDAD_RETIRADA / UNIDADES_INVENTARIO_HETEROGENEAS; PERDIDA / IMPORTE_MONETARIO |

- `intervalos=[{ etiqueta, desde, hasta, parcial }]`, naturales ascendentes, etiquetas YYYY-MM-DD/ YYYY-MM/ YYYY según granularidad. Intersección inclusiva con período; 15 de noviembre..5 de diciembre con MES produce dos intervalos parciales, sin estimar días ausentes. Máximo **1200** intersectados, aun sin datos; no cambiar granularidad automáticamente. Los GET ordinarios no tienen este límite.
- `series=[{ categoria, metrica, unidad, valores: string[], total: string }]`, orden categoría → métrica; índice de valores alineado con intervalos. 8 series ventas, 4 compras, 6 pérdidas.
- `distribuciones=[{ metrica, unidad, total: string, categorias: [{ categoria, valor: string }] }]`, orden métrica → categorías. Enteros canónicos para cantidades, decimal2 para dinero, siempre strings en series/distribuciones.
- Cada intervalo/categoría sin operaciones, incluso excluida por filtro, mantiene cero. Suma exacta de cada serie = total = categoría de distribución = campo de resumen. Distribución de importes de ventas/compras suma categorías informativas: **no** es total realizado; este último solo confirmadas. Pérdidas PERDIDA.total = perdidaTotal, sin descontar reversiones.
- `sinDatos` depende de conteo cero, no de importe cero. No hay crecimiento/deltas, porcentajes, promedios, márgenes, moneda/símbolo asumidos, pronósticos ni comparación con período anterior. Unidades retiradas de productos distintos no son equivalencia farmacéutica.

Ejemplo completo sintético de estadística de compras (solicitud de §2):

```json
{
  "data": {
    "fuente": "COMPRAS",
    "periodo": { "modalidad": "PERIODO", "desde": "2026-11-15", "hasta": "2026-11-20", "zonaHoraria": "America/La_Paz" },
    "filtros": { "estadoOperacion": null },
    "granularidad": "MES",
    "sinDatos": false,
    "resumen": { "confirmadas": { "cantidad": 1, "importe": "12.30" }, "anuladas": { "cantidad": 0, "importe": "0.00" }, "totalComprasRealizadas": "12.30" },
    "intervalos": [{ "etiqueta": "2026-11", "desde": "2026-11-15", "hasta": "2026-11-20", "parcial": true }],
    "series": [
      { "categoria": "CONFIRMADA", "metrica": "CANTIDAD", "unidad": "OPERACIONES", "valores": ["1"], "total": "1" },
      { "categoria": "CONFIRMADA", "metrica": "IMPORTE", "unidad": "IMPORTE_MONETARIO", "valores": ["12.30"], "total": "12.30" },
      { "categoria": "ANULADA", "metrica": "CANTIDAD", "unidad": "OPERACIONES", "valores": ["0"], "total": "0" },
      { "categoria": "ANULADA", "metrica": "IMPORTE", "unidad": "IMPORTE_MONETARIO", "valores": ["0.00"], "total": "0.00" }
    ],
    "distribuciones": [
      { "metrica": "CANTIDAD", "unidad": "OPERACIONES", "total": "1", "categorias": [{ "categoria": "CONFIRMADA", "valor": "1" }, { "categoria": "ANULADA", "valor": "0" }] },
      { "metrica": "IMPORTE", "unidad": "IMPORTE_MONETARIO", "total": "12.30", "categorias": [{ "categoria": "CONFIRMADA", "valor": "12.30" }, { "categoria": "ANULADA", "valor": "0.00" }] }
    ]
  }
}
```

## 5. Archivos y representación

TABULAR extrae todas las filas seleccionadas, nunca la página visible; pagina/limite dan 400. Ventas/compras/pérdidas usan columnas de §3. CU40 usa exactamente:

```text
idMovimiento, idExistencia, idMedicamento, codigoExistencia, codigoMedicamento, nombreComercial, idUsuario, nombreUsuario, fechaMovimiento, direccion, motivo, cantidad, costoUnitarioAplicado, idDetalleCompra, idCompra, idDetalleVenta, idVenta, idMovimientoOriginal, idMovimientoReversion
```

CU40 conserva idUsuario del movimiento y nombreUsuario null si falta relación; orígenes/reversiones opcionales null. No observacion, estado actual del producto, saldo anterior/posterior reconstruido, resumen monetario ni pérdida neta; solo conteo de movimientos. No altera DTO del GET.

ESTADISTICA exporta **todas** las métricas/series/ceros, no detalle operativo adicional. Tabla común en orden intervalo → categoría → métrica: `intervalo, desde, hasta, parcial, categoria, metrica, unidad, valor`; parcial true/false. Solicitar TABULAR aparte para detalle puede observar otro snapshot.

| Formato | Contrato real |
|---|---|
| CSV | UTF-8 BOM EF BB BF, `;`, decimal `.`, CRLF. Todas las celdas citadas, comillas interiores duplicadas, saltos conservados. Una tabla, sin `sep=`, resumen narrativo, pseudohojas ni imagen. Null y string vacío indistinguibles; no equivalen a cero. Strings no confiables con prefijos de fórmula `= + - @` tras blancos/controles, TAB/CR/LF iniciales o apóstrofo reciben un apóstrofo protector sin trim; importador consciente retira exactamente uno cuando aplique. Bytes exactos **no controlan tipado automático de Excel**; importar IDs/decimales/fechas como texto o elegir XLSX. |
| XLSX TABULAR | `Resumen` y `Detalle`; metadatos/diccionario/totales y todas las filas, encabezado congelado/autofiltro. Writer streaming con commits, no libro histórico completo en RAM. |
| XLSX ESTADISTICA | `Resumen`, `Estadisticas`, `Grafica`; libro documental acotado, PNG incrustadas, no gráfica nativa editable ni hoja Detalle. |
| PDF TABULAR | A4 horizontal, márgenes 12 mm, datos ≥8 pt; campos por bandas/continuaciones, encabezados repetidos y página X de Y. Dos pasadas sobre spool, sin segunda consulta DB. Null visible `—`. |
| PDF ESTADISTICA | A4 vertical; indicadores, distribuciones, PNG incrustadas y tabla exacta completa, multipágina. No solo captura ni enlace externo. |

XLSX almacena dinero/costo/cantidades agregadas/series, IDs/códigos y **todas** las fechas como string explícito `@`, sin Date JS/serial Excel ni fórmula. Cantidades individuales/conteos solo numéricos si enteros seguros y ≤15 dígitos; resto texto. Null celda vacía. No fórmulas/hipervínculos/relaciones externas ni garantía de sumas automáticas sobre texto. Celda >32767 caracteres falla 413, no corta. Fechas 1000/9999 permanecen literales.

PDF/XLSX incluyen CADEFAR textual, fuente/presentación, período/zona, filtros efectivos (también todos o límites abiertos CU40), generación civil congelada, conteo y resumen cuando corresponde, notas sobre snapshot/catálogos actuales y pérdidas brutas. CSV lleva período/filtros en solicitud, no filas narrativas.

Gráficas: BARRAS agrupadas y LINEAS rectas por intervalo/categoría; SECTORES por categorías del período, sin porcentajes. Paneles de ≤60 intervalos, hasta 20, sin muestreo/omitir ceros/unir extremos entre paneles. PNG reales 1200×800, ≤8 MiB/panel. Solo geometría aproximada: escala común S=max(valores) o suma de categorías en sectores, división BigInt a millonésimas antes de Number. Tabla/etiquetas conservan texto exacto; aviso de escala relativa y valores bajo resolución. Cero total no crea sectores y muestra «Sin valor para graficar»; ausencia muestra «Sin operaciones». Glifos/controles no representables con fuente autorizada fallan antes de headers; no Unicode universal.

## 6. HTTP de descarga y consumo React

200 con archivo real terminado/verificado (no JSON/base64 ni URL pública persistida):

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="cadefar-compras-estadistica-20261120-103000-0123456789abcdef0123456789abcdef.pdf"
Cache-Control: no-store
X-Content-Type-Options: nosniff
Content-Length: <cantidad real de bytes del artefacto terminado>
```

El bloque es ilustrativo, longitud no literal. MIME XLSX `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; CSV `text/csv; charset=utf-8`. Nombre ASCII seguro generado: `cadefar-{ventas|compras|perdidas|movimientos}-{tabular|estadistica}-{YYYYMMDD-HHmmss}-{correlacion32hex}.{csv|xlsx|pdf}`; fecha comercial de generación, sin nombre/path/título del cliente. No endpoint PNG separado.

Vacío siempre 200 con plantilla válida, nunca 204/404: CSV TABULAR BOM+cabeceras; CSV ESTADISTICA todas las filas cero; PDF/XLSX metadatos/categorías cero y aviso sin operaciones. CU40 solo conteo y detalle vacío.

Reglas de consumo a implementar posteriormente, no UI entregada:

1. GET con credenciales y query mínima válida; JSON para consulta/estadística, `responseType: 'blob'` para Axios de descarga (fetch: comprobar `ok`/Content-Type antes de `blob()`). No procesar PDF/XLSX como JSON ni renombrar un error como archivo.
2. En error con Blob JSON, leer texto y parsear solo el sobre seguro `{ message, errors? }`. Distinguir vacío de error/cancelación, 401/403 de reintento técnico y 413 de reducción de filtros. Cancelación cliente no acredita archivo ni deshace auditoría terminal registrada. Sin reintentos automáticos que generen descargas duplicadas.
3. Validar MIME/longitud disponible y finalización del transporte antes de ofrecer éxito; una respuesta truncada no es descarga completa. Si se crean object URLs en una futura UI, liberarlas. No afirmar que terminar HTTP implica guardado/apertura del usuario.
4. **CORS vigente:** `backend/src/app.js` conserva origen permitido explícito y `credentials: true`, y expone `Content-Disposition` y `Retry-After` mediante `exposedHeaders`. Axios/fetch puede leerlas entre orígenes cuando el proxy y navegador respetan esa configuración. Se conserva el fallback seguro si una cabecera falta o un intermediario la oculta; la configuración del código no acredita cookies/CORS en dominios desplegados reales. El hallazgo anterior de ausencia de exposición quedó superado por la extensión Railway.

Antes de headers, errores JSON `{ message: string, errors?: issuesZod }`, sin SQL/stack/paths/query cruda:

| Estado | Mensaje / tratamiento |
|---|---|
| 400 | `Datos inválidos` + issues; incompatibilidad/campo desconocido/paginación en exportación |
| 400 | `La consulta supera 1200 intervalos; elija otra granularidad o un período menor` + issues cuando proviene del validator |
| 401/403 | Sesión/rol actuales; no generar ni intentar como vacío |
| 405 HEAD | `Allow: GET`, sin cuerpo/generación tras controles de sesión/rol |
| 413 | `La exportación supera el límite técnico; reduzca los filtros o utilice otro formato` |
| 503 | `Generación de exportaciones ocupada; reintente más tarde`, `Retry-After: 5`, sin cola |
| 503 | `Formato no disponible` (perfil o recursos no admitidos) |
| 503 | `Se agotó el tiempo de generación; reduzca los filtros o reintente` |
| 500 | `Error interno del servidor` (SQL, render, disco, inconsistencia, representabilidad/glifos) |

Después de headers, fallo/timeout destruye transporte, sin segundo JSON/status. Cliente ya desconectado: no nueva respuesta. No 409 por vacío/estado ni 503 por fallo exclusivo del auditor.

## 7. Snapshot, recursos y auditoría

GET ordinario de Reportes: agregado y página en RR por petición. Estadística: agregado y series conciliados en mismo snapshot. Exportación: misma conexión/transacción REPEATABLE READ para agregados, bloques y relaciones; primer SELECT consistente fija snapshot, sin FOR UPDATE/escrituras de negocio. CU40 GET original **no** adquiere por esta ampliación transacción/snapshot ni paginación nuevos; su exportación sí usa el pipeline RR.

TABULAR lee keyset exclusivo `(fechaReferenciaOriginal DESC, id DESC)` en bloques ≤1000; no OFFSET, max(ID), transacción por bloque ni array completo. Cursor interno conserva precisión textual del motor, no fecha truncada del DTO. Spool NDJSON acotado y conciliación de conteo/totales dentro de transacción, luego cierre y liberación **antes** de render/PNG. ESTADISTICA materializa solo agregados acotados, no histórico operativo. Archivo/streams/hash/tamaño comprobados antes de headers; envío con backpressure y cleanup propio. No consistencia prometida entre peticiones/páginas/descargas separadas.

| Recurso | Límite común implementado / aceptación operativa separada |
|---|---|
| Concurrencia | Un trabajo por instancia incluida entrega; sin cola ni coordinación multiinstancia; ocupado 503 |
| TABULAR | CSV/XLSX ≤1000000 datos; PDF ≤10000 datos y ≤500 páginas; exceso 413 entero, sin truncado/división automática |
| Estadística | ≤1200 intervalos, ≤8 series, ≤9600 filas; PDF ≤500 páginas |
| Disco | Spool+artefactos+PNG/intermedios ≤512 MiB/trabajo, final ≤128 MiB; cuotas no son reserva operativa |
| RAM | Presupuesto incremental ≤128 MiB acordado, **RAM base y pico máximo sin demostrar** (libro/PNG/WASM/compresión incluidos) |
| Tiempo | Extracción ≤60 s incluyendo apertura/spool; generación ≤120 s desde admisión (no 60+120); entrega timer independiente ≤120 s desde headers |

Plazos de SQL son cooperativos: se espera SELECT pendiente antes de rollback/liberación, no Promise.race que devuelva conexión activa; **no deadline SQL duro**. LOCAL comprueba ≥512 MiB disco y ≥128 MiB RAM libres instantáneos, sin reserva ni benchmark. Railway exige ≥640 MiB de disco al admitir, margen de memoria cgroup ≥128 MiB, vigilancia y límites de sesión SQL; su protocolo y limitaciones se detallan en `exportaciones-railway.md`. Temporales exclusivos fuera de public/repositorio; mode POSIX no acredita ACL Windows. Cleanup solo recursos propios; fallo residual cierra admisión. Kill puede dejar archivos y terminal ausente; no recuperación segura de huérfanos demostrada ni borrado amplio por antigüedad.

Auditoría: estadísticas intentan un REPORTE_*_ESTADISTICAS tras conciliar/cerrar lectura, metadatos granularidad/cantidadIntervalos. Exportaciones un REPORTE_*_EXPORTAR o INVENTARIO_MOVIMIENTOS_EXPORTAR **terminal único**; EXITO solo tras `finish`/`writableFinished` y bytes completos, `estadoEntrega=FINALIZADA_SERVIDOR`, no recepción/guardado/apertura por usuario. Sin éxito al crear spool/archivo ni eventos por lote/panel. Eventos sin snapshot ficticio, `transaccionExito=false`. Cancelación FALLO/CANCELACION_CLIENTE; timeout FALLO/TIEMPO_AGOTADO; técnico FALLO con causa comprobada; límite RECHAZADO/LIMITE_EXPORTACION; ocupado/no disponible RECHAZADO/RECURSO_NO_DISPONIBLE. Rechazos previos de sesión/rol/query mantienen captura transversal única con operaciónOrigen; errores gestionados no se duplican.

Allowlist específica: formato/presentacion, granularidad, grafico/metrica cuando apliquen, cantidadFilas textual completa conocida, cantidadIntervalos, etapaExportacion y estadoEntrega. No importes, filas, IDs en lista, filtros/query/URL crudos, nombres de archivo/rutas temporales ni datos clínicos. GET de Reportes conserva cantidadResultados de página; CU40 GET excluye éxitos rutinarios. Fallo exclusivo del auditor conserva respuesta/archivo/cleanup y diagnóstico sanitizado, sin promesa de persistencia ni reintento automático. Ver matriz de [Bitácora](bitacora-auditoria.md).

## 8. Dependencias, fuentes y licencias utilizadas

No instalaciones ni consultas remotas en Fase 11. Versiones fijadas de formatos y avisos se contrastaron con package/recursos y cierres previos; presencia instalada no certifica cada escenario MySQL.

| Recurso real | Uso / licencia |
|---|---|
| ExcelJS 4.4.0 | XLSX streaming TABULAR y documental ESTADISTICA / MIT |
| PDFKit 0.21.0 | PDF dos pasadas y embedding / MIT, aviso `backend/src/shared/resources/PDFKit-LICENSE.txt` |
| @resvg/resvg-wasm 2.6.2 | SVG construido por servidor → PNG en worker efímero, no modificado / MPL-2.0; `resvg-MPL-2.0.txt` y `resvg-NOTICE.md` conservan fuentes y obligaciones de redistribución |
| Noto Sans Regular 2.008 | TTF local sin modificar, subconjuntos PDF y raster / OFL-1.1; `fonts/OFL.txt` y `fonts/README.md` conservan copyright, commit de origen y SHA-256 |
| pdfjs-dist 6.5.438 (dev) | Lector independiente de PDF de pruebas, **no generación ni revisión visual** / Apache-2.0 |
| CSV / SVG servidor | Serializador pequeño con streams Node y geometría SVG validada; **no se usa ECharts**, candidata histórica no instalada como capacidad |

Runtime previamente ejercitado: Node 24.18.0 / Windows, Express 5.2.1, Sequelize 6.37.8, mysql2 3.24.4. JSZip/png-js transitivos se usaron en lectores/validación del cierre histórico, no nuevas APIs de producto. Fuentes actuales para dependencias/licencias: tabla anterior y avisos de recursos locales; la evaluación original pertenecía al plan sustituido. Sin fuentes Windows, navegador/canvas, URLs/JS/assets del cliente ni descargas en solicitudes. Licencias ajenas no se relicencian como CADEFAR. Avisos previos de dependencias no se consideran resueltos; no nueva auditoría/SBOM Rust completo ni certificado de ausencia de vulnerabilidades.

## 9. Matriz de implementación y evidencia (no nuevas ejecuciones)

La columna sin motor refiere SQL/snapshot/sesión/auditor simulados con HTTP localhost/archivos/streams reales; motor refiere **solo** al cierre histórico de Fase 10 backend sobre MySQL 8.0.46 local aislado, resumido aquí y en `bitacora-auditoria.md`. No todas las gráficas/filtros/interleavings se comprobaron con motor. Las referencias §10.19/§10.20 en esta matriz identifican aquel cierre, no secciones del actual seguimiento visual.

| Capacidad implementada | Probado sin MySQL (§10.19 y suites focalizadas) | Probado con MySQL (§10.20) | Pendiente/límite |
|---|---|---|---|
| Tres GET paginados, CU40 reutilizado | Contratos/DTOs/auth/fechas/decimales | Login/roles reales, invalidación/expiración/revocación, GET, agregados, no mutación | No aceptación backend conjunta completa |
| Tres estadísticas JSON | Series/ceros/intervalos/parciales/distribuciones y conciliación | SQL conocido DIA/MES/ANIO/filtros, snapshot agregado→series con COMMIT externo | No cierres contables entre peticiones |
| Ventas/compras/pérdidas 18 archivos + CU40 3 | Las 21 variantes, lectura CSV/XLSX/PDF completa sobre fixtures comunes | Las 21 variantes acotadas comparadas con GET, MIME/bytes/celdas/textos/PNG incrustadas | Revisión visual PDF/PNG/XLSX posterior |
| Keyset completo/snapshot de cuatro fuentes | Varios bloques simulados y renderizadores reales | CSV **1000+2+0**, escritor externo entre bloques, siguiente petición ve cambio | XLSX/PDF multibloque **solo simulados**, aunque archivos acotados sí usan motor |
| RN91, bruto, ceros y exactitud | Extremos sintéticos >MAX_SAFE_INTEGER y fuera de esquema | 0.005000+0.005000→0.02, reversión/costo cero, INT/DECIMAL persistibles y años 1000/9999 | Fracciones DATETIME(0) omitidas; valores fuera del esquema no son persistencia real |
| PDF/XLSX/PNG estructura | PDF.js, ZIP/CRC/OOXML/reapertura, píxeles PNG, fuentes/glifos, paneles 60/61/1200 | PDF/celdas de archivos acotados y embedding real; extremos persistibles delimitados en §10.20 | No apertura/legibilidad visual manual ni compatibilidad visual certificada |
| Cupo/aborto/errores/auditor terminal | Backpressure, errores tardíos/timeout/COMMIT perdido/ENOSPC inyectados | SELECT pendiente SLEEP(0.5), aborto extracción, ocupado, fallo SQL y rechazo SQL del auditor, rollback/cleanup/terminal persistido | Fallos tardíos transporte/conexión/COMMIT no reproducidos íntegramente con motor; no caída real/kill |
| Cuotas/privacidad/limpieza | Límites reducidos, vecino intacto, cierre admisión por residuo | Preflight instantáneo, cleanup propio verificado, cuatro DB temporales eliminadas con ausencia registrada | RAM pico/reserva/ACL/huérfanos/deadline SQL/hosting no acreditados |

**Resultados heredados, no reejecutados aquí:** Fase 10 conjunta guardas/integración 43 aprobadas, 0 fallidas/canceladas, 1 omitida por DATETIME(0); regresión conjunta sin MySQL 288 aprobadas sin fallidas/canceladas/omitidas. Cuatro bases y temporales propios eliminados con ausencia verificada en esa fase, no nueva inspección/limpieza DB en Fase 11. Comandos y delimitaciones originales en §10.19–10.20; no sumar iteraciones ni contar guardas como evidencia del motor.

**Estado histórico conservado:** Fases 5–6 PARCIALES productivas; 7–8 implementadas LOCAL sin aceptación visual/productiva; 9 PARCIAL visual; 10 PARCIAL por límites anteriores; 11 cierre documental independiente. Es la numeración del plan backend sustituido. Sus gates no se consideran resueltos por documentarlos: **RAM base y pico máximo, reserva operativa de disco, ACL Windows privada, propiedad/recuperación de huérfanos, deadline SQL duro, hosting/proxy y revisión visual manual PDF/PNG/XLSX**.

**Estado posterior del software:** frontend implementado; evidencia de su mejora visual en `fases.md`, separada de esta matriz backend. Railway opt-in y exposición CORS implementados; pruebas/limitaciones y correcciones posteriores en `exportaciones-railway.md`. Sus controles cooperativos no garantizan deadline duro ni acreditan hosting real. Esta actualización no habilita producción, repite integración MySQL ni certifica documentos exportados visualmente.
