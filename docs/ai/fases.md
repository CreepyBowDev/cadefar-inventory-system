# CADEFAR — Ampliación frontend de Reportes y Pérdidas

## 1. Estado inicial

**Plan preparado el 20/11/2026; seguimiento actualizado el 21/11/2026. Fases 1–6 COMPLETADAS mediante pruebas focalizadas/API simulada (Fases 2–6 también navegador). Fase 7 PARCIAL: integración LOCAL autorizada ejecutada desde las páginas actuales, 23/23 comprobaciones finales y 21 variantes binarias acotadas verificadas. Retorno postlogin con query defectuoso reproducido, no corregido; omisiones y gates conservados en su cierre. Sin aceptación productiva.**

Este documento sustituye por solicitud expresa el plan de ampliación backend. La planificación se conserva y las implementaciones ejecutadas se registran en §11. El backend ampliado y el frontend básico ya existen: se amplían, no se reconstruyen. La guía normativa de integración es **`docs/ai/contratos-reportes-react.md`**, que se conserva sin modificaciones.

El frontend previo tiene páginas de ventas, compras y pérdidas, filtros aplicados en URL, resúmenes, tablas, paginación y permisos; CU40 reutiliza Inventario. Las estadísticas JSON y 21 variantes de descarga están implementadas en backend, estas últimas exclusivamente para perfil LOCAL. Implementación, pruebas simuladas, integración local y aceptación productiva son estados distintos (§5.6).

**Solicitud posterior al cierre de Fase 7:** implementado un perfil Railway opt-in separado, sin habilitación ni despliegue, con pruebas sin MySQL. No cambia la evidencia histórica de estas siete fases. Configuración, cambios de disponibilidad/CORS y límites vigentes de esa extensión: [`exportaciones-railway.md`](exportaciones-railway.md).

## 2. Objetivo y alcance

Ampliar las páginas actuales con visualización estadística interactiva y generación de documentos desde los endpoints existentes, conservando consultas dinámicas y todos sus recorridos.

| CU / fuente | Reutilización | Ampliación | Roles |
|---|---|---|---|
| CU38 / ventas | Página, filtros, resumen, tabla y paginación | Estadísticas/gráficas y exportación TABULAR/ESTADISTICA | Administrador |
| CU39 / compras | Página y base compartida con ventas | Estadísticas/gráficas y exportación TABULAR/ESTADISTICA | Administrador |
| CU40 / historial | MovimientosPage, filtros y Service actuales | Descarga exclusivamente TABULAR | Administrador, Regente |
| CU41 / pérdidas | Página, hook, resumen y tabla actuales | Estadísticas/gráficas y exportación TABULAR/ESTADISTICA | Administrador, Regente |

Reportes estáticos son plantillas del servidor descargadas con filtros válidos, no otro cálculo React ni nuevas páginas duplicadas. PDF, XLSX y CSV se descargan del backend; no se generan desde la tabla visible.

Fuera de alcance: backend/CORS/migraciones, operaciones de inventario/ventas/compras/recetas, nuevos endpoints/permisos/CU, indicadores financieros adicionales, ganancias/márgenes/impuestos/contabilidad, proyecciones/metas, múltiples farmacias y estadísticas de saldos históricos. No rehacer dashboard/sidebar ni retomar `transacciones.md` o análisis académico.

## 3. Diseño obligatorio y frontend-design

**Cargar y utilizar `frontend-design` en todas las fases de implementación o adaptación visual. Su uso NO autoriza rediseñar CADEFAR.** Si no está disponible, indicarlo y no afirmar su aplicación. Esta preparación la carga como apoyo de planificación, sin construir UI.

- Conservar colores, tipografías, iconos, bordes/sombras, tamaños, espacios, tarjetas, botones, formularios, tablas, encabezados, layout, sidebar, navegación, estados activos y responsive actuales. No incorporar otra biblioteca de UI ni un tema/tokens nuevos.
- Mantener las rutas `/reportes/ventas`, `/reportes/compras`, `/reportes/perdidas` y `/inventario/movimientos`. Mismo paquete Reportes, nombres/icono/posición y orden CU38 → CU39 → CU40 → CU41; mismos accesos desde Inventario. No agregar módulos «Estadísticas»/«Exportaciones» al sidebar.
- Jerarquía real actual: `page-heading` → `catalogo-panel` con filtros → mensaje → toolbar/Actualizar → nota → resumen → tabla/estado → paginación. Añadir acciones/tabular-estadística dentro de ese panel; no desplazar ni reemplazar la jerarquía de consulta dinámica. Los controles de descarga se integran con las acciones; la sección estadística se muestra solo al elegirla.
- Conservar tipografía/tokens de `app-foundations.css`, shell y `catalogo.css`, reutilizando `reportes.css` de forma localizada. Gráficas con colores existentes, patrones/leyendas para distinguir categorías sin depender solo del color, sin animación exagerada ni estilo de dashboard distinto.
- Labels, fieldsets/legends, foco visible, teclado, `aria-busy`, mensajes de estado y errores como precedentes actuales. Gráficas con nombre/descripción y tabla de valores exactos alternativa; tooltips utilizables con teclado/táctil, no solo hover. Botones con acción/formato claros.
- Responsive a 375 px y escritorio: formularios reorganizados como ahora, gráficos redimensionables sin cambiar datos y tablas con desplazamiento horizontal etiquetado. No ocultar columnas/datos para simular completitud.

## 4. Frontend existente y reutilización concreta

Rutas relativas a la raíz; nombres comprobados al preparar el plan. Son referencias de lectura mínima, no autorización para sobrescribir cambios posteriores.

| Archivo / símbolo existente | Tratamiento |
|---|---|
| `frontend/src/features/reportes/pages/ReporteVentasPage.jsx`, `ReporteComprasPage.jsx` | Mantener páginas/rutas y extender su composición, no reemplazarlas |
| `frontend/src/features/reportes/components/ReporteOperacionesConsulta.jsx` | Coordinador actual CU38/CU39; ampliar compatiblemente para controles/sección nuevos, sin convertirlo en motor universal |
| `frontend/src/features/reportes/pages/PerdidasPage.jsx` | Mantener recorrido específico y reutilizar componentes nuevos que sí sean comunes |
| `frontend/src/features/reportes/hooks/useReporteConsulta.js` | Borrador vs URL aplicada, Buscar/Limpiar, `sidebarItemKey` y prevención de respuestas obsoletas; conservar comportamiento dinámico |
| `frontend/src/features/reportes/utils/consultaReporte.js` | `leerConsultaReporte`, `validarFiltrosReporte`, `serializarConsultaReporte`: actualmente solo filtros ordinarios con página/límite. No usarlos sin adaptar para exportar/estadísticas |
| `frontend/src/features/reportes/services/reporte.service.js` | `getReporteVentas/Compras/Perdidas`; extender el mismo módulo para nuevas operaciones sin crear otra instancia Axios |
| `frontend/src/features/reportes/components/ReporteFilters.jsx` | Modos día/mes/período, estado/motivo y búsqueda explícita; conservar controles y semántica |
| `frontend/src/features/reportes/components/ReporteVentasResultado.jsx`, `ReporteComprasResultado.jsx`, `PerdidasResultado.jsx` | Resúmenes/tablas exactos y enlaces a fichas/historial; reutilizar resúmenes cuando el JSON estadístico los proporcione |
| `frontend/src/features/reportes/styles/reportes.css` | CSS existente del panel, grids 900/620 px, tablas anchas y números alineados; extender solo clases de la feature |
| `frontend/src/features/inventario/pages/MovimientosPage.jsx` | CU40 existente con `sidebarItemKey` de Reportes/Inventario; añadir controles tabulares sin reemplazar página |
| `frontend/src/features/inventario/services/inventario.service.js` | `getMovimientos` permanece; añadir descarga al Service de Inventario usando utilidad binaria compartida si es útil |
| `frontend/src/hooks/useConsultaAutomatica.js` | CU40 tiene debounce/URL propia; exportar solo criterios aplicados estabilizados, no filtros transitorios |
| `frontend/src/hooks/useConsulta.js` | Habilitación, invalidación y descarte de respuestas tardías; usarlo para JSON cuando sea compatible, no forzar blobs en su estado global |
| `frontend/src/api/api.js`, `hooks/useAuth.js`, `routes/ProtectedRoute.jsx`, `RoleRoute.jsx`, `constants/roles.js` | Credenciales, sesión pública y seguridad visual existentes; no guardar JWT ni cambiar permisos |
| `frontend/src/components/{CatalogoState,FeedbackMessage,Pagination,AppIcon}.jsx`, `utils/presentacion.js` | Estados, acciones, paginación y `fechaCivil/horaCivil/cantidad/costoDecimal` sin pérdida monetaria/horaria |
| `frontend/src/constants/navigation.js`, `app/router.jsx`, `layouts/components/AppSidebar.jsx` | Rutas y menú ya implementados; no requieren reconstrucción para estas capacidades |
| `frontend/tests/reportes-{consulta,services,navegacion}.test.mjs`, `reportes-ventas.browser.test.mjs`, `reportes-real.browser.test.mjs` | Reutilizar patrones de pruebas/guardas; no confundir API simulada con motor real |

`frontend/package.json` no declara biblioteca de gráficas. Decidir la solución menor en Fase 3 tras comprobar accesibilidad, precisión de coordenadas, licencia, React/Vite y tamaño de bundle. No instalar ahora ni portar PDFKit/ExcelJS/resvg del servidor al navegador. Archivos nuevos únicamente con uso efectivo, dentro de la feature; evitar duplicar helpers/services, contexts, cachés globales o hooks genéricos innecesarios.

## 5. Contratos backend y dependencias

### 5.1. Fuentes y endpoints implementados

Prioridad: `contratos-reportes-react.md` §1–9 y código pertinente. Fuentes funcionales selectivas: contexto §39, RF35–RF38/RI12, RN91/RN97–RN101, CU38–CU41 y matriz de `bitacora-auditoria.md`. Se contrastaron routers backend de Reportes/Inventario y CORS; no se modifican.

| HTTP | Roles | Uso |
|---|---|---|
| GET /api/reportes/ventas | Administrador | Dinámico existente |
| GET /api/reportes/compras | Administrador | Dinámico existente |
| GET /api/reportes/perdidas | Administrador, Regente | Dinámico existente |
| GET /api/inventario/movimientos | Administrador, Regente | CU40 existente |
| GET /api/reportes/ventas/estadisticas | Administrador | Estadística JSON |
| GET /api/reportes/compras/estadisticas | Administrador | Estadística JSON |
| GET /api/reportes/perdidas/estadisticas | Administrador, Regente | Estadística JSON |
| GET /api/reportes/ventas/exportar | Administrador | TABULAR/ESTADISTICA × PDF/XLSX/CSV |
| GET /api/reportes/compras/exportar | Administrador | TABULAR/ESTADISTICA × PDF/XLSX/CSV |
| GET /api/reportes/perdidas/exportar | Administrador, Regente | TABULAR/ESTADISTICA × PDF/XLSX/CSV |
| GET /api/inventario/movimientos/exportar | Administrador, Regente | Solo TABULAR × PDF/XLSX/CSV |

Los siete nuevos endpoints rechazan HEAD autorizado con 405; no usar HEAD para probar disponibilidad. Axios usa paths relativos a `/api` configurado. Vendedor no accede a ninguna capacidad de este alcance; permisos de compras operativas no habilitan CU39 al Regente.

### 5.2. Matriz estricta de query

Modalidad obligatoria de los tres reportes: exactamente `dia=YYYY-MM-DD`, `mes=YYYY-MM` o `desde=YYYY-MM-DD&hasta=YYYY-MM-DD`, fechas gregorianas reales años 1000–9999, rango cerrado/inclusivo, futuros admitidos y sin máximo de días para GET ordinarios. Sin período implícito. Strings únicos, sin desconocidos, vacíos, repetidos/arrays/objetos o aliases.

Filtros propios: ventas `estadoOperacion=CONFIRMADA|PENDIENTE|ANULADA`; compras `CONFIRMADA|ANULADA`; pérdidas `motivo=VENCIMIENTO|DAÑO`. Omitir «Todos», no enviarlo como enum. Codificar DAÑO con URLSearchParams.

| Operación | Query adicional permitida/obligatoria |
|---|---|
| Dinámica | pagina default 1 (máximo 2147483647), limite default 25 (1–100), enteros canónicos |
| Estadísticas JSON | granularidad=DIA/MES/ANIO obligatoria; sin pagina/limite/formato/presentacion/grafico/metrica |
| TABULAR cualquier formato | presentacion=TABULAR y formato=PDF/XLSX/CSV obligatorios; sin pagina/limite/granularidad/grafico/metrica |
| ESTADISTICA CSV | presentacion=ESTADISTICA, formato=CSV, granularidad obligatorios; sin pagina/limite/grafico/metrica |
| ESTADISTICA PDF/XLSX | presentacion=ESTADISTICA, formato, granularidad, grafico=BARRAS/LINEAS/SECTORES y metrica compatibles, todos obligatorios; sin pagina/limite |

Métricas gráficas: ventas/compras CANTIDAD o IMPORTE; pérdidas CANTIDAD_RETIROS o PERDIDA. **CANTIDAD_RETIRADA existe en datos estadísticos pero no es métrica gráfica admitida.** No defaults HTTP de formato/presentación/granularidad/gráfico/métrica. Controles deben exigir selección o aplicar solo una decisión de UX explícita registrada, no enviar parámetros incompatibles ocultos al cambiar formato/presentación.

CU40: filtros opcionales idMedicamento/idExistencia (1..2147483647), desde/hasta **independientes** y ordenados si concurren, direccion ENTRADA/SALIDA, motivo **texto trim de 1–40**, no enum. Sin filtros = todas las coincidencias. Exportar añade formato y presentacion=TABULAR; prohíbe dia/mes/paginación/granularidad/gráfico/métrica/ESTADISTICA. No aplicar el validator de Reportes al historial.

### 5.3. Respuestas, semántica y exactitud

Dinámico conserva `{ data: { periodo, resumen, detalle }, paginacion }`; resumen completo, detalle paginado. CU40 conserva `{ data: movimientos }` anidado con observación; la descarga CU40 es proyección plana sin observación/saldos reconstruidos, **no** la serialización de su tabla React.

Estadística: `{ data: { fuente, periodo, filtros, granularidad, sinDatos, resumen, intervalos, series, distribuciones } }`, sin paginación. `fuente=VENTAS|COMPRAS|PERDIDAS`; filtros contiene estadoOperacion o motivo, null si no aplicado. `periodo={ modalidad, desde, hasta, zonaHoraria }` igual al contrato vigente.

- `intervalos=[{ etiqueta, desde, hasta, parcial }]`: naturales ascendentes, etiquetas YYYY-MM-DD/YYYY-MM/YYYY; extremos intersectados, ceros incluso en categorías excluidas. **Máximo 1200 intervalos**, con o sin datos; no muestrear, truncar ni cambiar granularidad automáticamente.
- `series=[{ categoria, metrica, unidad, valores: string[], total: string }]`, valores alineados por índice con intervalos. Orden categoría → métrica. Ventas 8 series, compras 4, pérdidas 6.
- `distribuciones=[{ metrica, unidad, total: string, categorias: [{ categoria, valor: string }] }]`, orden métrica → categoría. Valores exactos canónicos: dinero a dos decimales, cantidades strings enteros. Resúmenes/conteos siguen los tipos vigentes; cantidadRetirada agregada es string entero.

| Fuente | Categorías | Métricas / unidades |
|---|---|---|
| Ventas | CONFIRMADA, PENDIENTE, ANULADA_CONFIRMADA, ANULADA_SIN_CONFIRMAR | CANTIDAD/OPERACIONES, IMPORTE/IMPORTE_MONETARIO |
| Compras | CONFIRMADA, ANULADA | CANTIDAD/OPERACIONES, IMPORTE/IMPORTE_MONETARIO |
| Pérdidas | VENCIMIENTO, DAÑO | CANTIDAD_RETIROS/RETIROS, CANTIDAD_RETIRADA/UNIDADES_INVENTARIO_HETEROGENEAS, PERDIDA/IMPORTE_MONETARIO |

`sinDatos` significa conteo cero, **no importe cero**. Totales de distribución de importes de todas las categorías de ventas/compras son informativos, no ingresos/total realizado. Resumen vigente se reutiliza: totalVentasRealizadas/totalComprasRealizadas solo confirmadas. Ventas confirmadas/anuladas confirmadas por fechaVenta, otras por fechaRegistro; compras por adquisición; estado actual del snapshot, no cierre histórico. Pérdidas brutas por costo histórico con RN91 individual antes de sumar, sin restar reversiones ni incluir ajustes negativos.

No porcentajes, crecimiento, deltas, promedios, moneda asumida ni períodos comparativos. React no recalcula resúmenes/totales, precios o pérdidas. `cantidadRetirada` heterogénea no equivale a una unidad farmacéutica común.

Importes/costos/series permanecen strings exactos. Solo coordenadas visuales pueden aproximarse con escalado acotado y explícito; tooltip/tabla/etiquetas conservan el original, jamás `Number(valor).toFixed()` para dinero. Dividir BigInt a proporciones acotadas es una opción de render, no nuevo cálculo de negocio. Sectores sin porcentajes automáticos; total cero = «Sin valor para graficar», `sinDatos` = «Sin operaciones». No sector ficticio ni porcentajes implícitos de una librería. Barras/líneas no mezclan cantidades y dinero en un eje.

Usar `fechaCivil/horaCivil`, no convertir literales civiles a UTC/Date. Conservar null. Respuesta ordenada/ceros/intervalos parciales provienen del servidor, no se fabrican desde React. Cada consulta/descarga tiene su propio snapshot: cambios concurrentes pueden producir diferencias legítimas entre peticiones, no prometer archivo idéntico al resultado consultado antes.

### 5.4. Archivos, descarga y CORS

- Backend envía 200 binario real terminado, MIME correcto, attachment, Cache-Control no-store, nosniff y Content-Length. CSV text/csv UTF-8; PDF application/pdf; XLSX application/vnd.openxmlformats-officedocument.spreadsheetml.sheet. No base64 ni URL pública persistida.
- TABULAR descarga todas las coincidencias dentro de límites técnicos, no solo 25 filas. ESTADISTICA incluye todos los indicadores/métricas/ceros/series, no otra copia de detalle operativo. Gráfico seleccionado no filtra la tabla exacta completa del archivo. CU40 solo tabular, sin resumen monetario.
- CSV: UTF-8 BOM, separador `;`, decimal `.`, CRLF, protección de fórmulas y null vacío; no gráfica. XLSX: valores monetarios/IDs/fechas/series textuales exactos; estadístico con Resumen/Estadisticas/Grafica e imágenes PNG, **no gráfico Excel nativo editable**. PDF estadístico incluye PNG y tabla completa. No ofrecer edición local de archivos ni corregir su tipado desde React.
- Axios de descarga con `responseType: 'blob'`, credenciales centrales y cancelación. Parsear Blob JSON de error como sobre seguro message/errors, no guardar un error como .pdf. Comprobar MIME esperado, Blob no vacío y Content-Length cuando sea accesible/comparable; contemplar compresión/transporte, no inventar integridad garantizada solo por MIME/tamaño.
- Solo tras transporte finalizado y respuesta válida crear object URL, activar descarga con nombre seguro y revocarla cuando ya no se use; limpiar anchors/URLs/cancelación al salir. No revocar antes de que el navegador pueda consumirla ni descargar una respuesta tardía tras desmontar/cambiar contexto. Sin logs del contenido, localStorage o caché permanente.
- Nombre servidor cuando cabecera accesible y válida, rechazando rutas, controles, separadores y extensiones incompatibles. Fallback cliente ASCII seguro de fuente/presentación/formato, sin datos personales ni nombre ingresado; documentar que es alternativo, no nombre recibido. No afirmar guardado/apertura efectiva: «Archivo recibido; descarga iniciada» como máximo.
- **Dependencia comprobada:** `backend/src/app.js` no configura exposedHeaders. Entre orígenes Content-Disposition y Retry-After no son legibles por JavaScript aunque viajen; Content-Type/Length son safelisted. Misma procedencia permite leerlos. No modificar CORS/proxy/backend para pasar la tarea ni ocultar el fallo con `no-cors`. Usar fallback de nombre y reintento manual, y verificar ambos escenarios antes de prometer esas cabeceras.

### 5.5. Estados de error y disponibilidad

400 parámetros/combos inválidos o más de 1200 intervalos: conservar selección y orientar a otra granularidad/período, sin corregir automáticamente. 401 sesión: seguir recuperación/login actual y retirar información restringida. 403 sin acceso: no reintentar ni descargar. 413 límite: informar reducir filtros o cambiar formato, nunca archivo recortado. 503 puede ser ocupado (Retry-After 5 si accesible), formato/perfil no disponible o timeout de generación: distinguir mensaje seguro y no reintentar automáticamente. 500/red/transporte truncado: no ofrecer éxito ni guardar archivo; reintento manual.

Permitir archivos vacíos válidos 200 con plantillas/cabeceras, no tratarlos como error por no haber registros. No HEAD de disponibilidad ni polling/cola cliente. Error de estadística/exportación no debe borrar un resultado dinámico válido independiente, pero sí retirar un resultado estadístico obsoleto y su estado de éxito. El fallo exclusivo del auditor no es error de descarga 200; React no registra eventos duplicados ni envía contenido a Bitácora.

### 5.6. Dependencias de infraestructura y evidencia heredada

Exportaciones LOCAL: desarrollo (NODE_ENV ausente/development), socket loopback admitido y preflight/temporal fuera del repo. Producción/test/remotos/no disponible devuelven 503. No derivar disponibilidad únicamente del hostname de React ni mostrar «listo para producción» por recibir un archivo. Mostrar nota LOCAL/no disponibilidad conforme a la guía; no habilitar proxy público loopback para eludir el gate.

Límites implementados: un trabajo por instancia incluida entrega, sin cola; CSV/XLSX TABULAR ≤1.000.000 filas, PDF ≤10.000 y ≤500 páginas; estadísticas ≤1200 intervalos/8 series/9600 filas; artefacto final ≤128 MiB, espacio de trabajo ≤512 MiB. Tiempos generación ≤120 s desde admisión y entrega ≤120 s desde headers; extracción ≤60 s incluida en generación. Timeout cliente debe contemplar ambas etapas, con cancelación explícita y sin promesa de interrumpir SQL instantáneamente. Blob final de hasta 128 MiB también consume recursos del navegador; no convertir a base64/ArrayBuffer duplicado innecesario ni garantizar compatibilidad ilimitada en móviles.

Evidencia heredada en guía §9, no reejecutada aquí: estadísticas y 21 variantes acotadas probadas localmente con MySQL 8.0.46; multibloque real CSV, XLSX/PDF multibloque solo simulado. Fase backend conjunta guardas/integración: 43 aprobadas/1 omitida DATETIME(0); sin motor: 288 aprobadas. No son aceptación productiva ni de la nueva UI.

Gates aún pendientes: RAM base/pico, reserva de disco, ACL privada Windows, recuperación/propiedad de huérfanos, deadline SQL duro, hosting/proxy, revisión visual manual PDF/PNG/XLSX y aceptación backend completa. No resolverlos desde frontend ni heredar autorización MySQL de otra sesión. Datos/fechas fraccionarias no persistibles y fallos tardíos no ejercidos integralmente siguen limitados. Las antiguas secciones de `fases.md` referenciadas por otros documentos son históricas tras el reemplazo; conservar como fuentes la guía §1–9 y documentación funcional, sin editarlas en esta preparación.

## 6. Alcance funcional de la ampliación

### Integración dentro de páginas existentes

Mantener consulta dinámica como vista inicial y rutas actuales. Añadir selector accesible de vista «Consulta»/«Estadísticas» dentro del panel, no páginas/sidebar nuevos. Filtros comerciales/temporales compartidos según su aplicación real; control de granularidad solo en estadística. La vista dinámica mantiene sus parámetros y paginación. Si se guardan vista/granularidad en URL, serán parámetros de UI reconocidos/validados separadamente, nunca reenviados al GET ordinario ni ignorando claves arbitrarias; definir esquema mínimo en Fase 1 para no romper enlaces anteriores. No sincronizar la URL en cada tecla.

Conservar borrador/aplicado: Buscar aplica, Actualizar usa criterios aplicados, editar no cambia reporte sin acción. Estadística carga solo cuando está seleccionada y hay filtros/granularidad válidos explícitos; no tres GET preventivos al entrar a cada página. Cambiar solo página dinámica no debe refrescar estadística ni alterar sus indicadores. Carga/error/estado vacío independientes por operación; claves incluyen fuente/filtros/granularidad para descartar respuestas tardías.

### Gráficas interactivas

Barras/líneas por intervalos/categorías y sectores por distribución del período, con métrica compatible. Interacción mínima útil: seleccionar representación/métrica, mostrar u ocultar categorías de forma explícita sin recalcular totales, explorar punto/categoría con tooltip exacto y tabla accesible. No todas esas selecciones deben disparar GET si reutilizan el mismo JSON.

Hasta 1200 intervalos sin muestreo ni reducción automática: estrategia de paneles o viewport/scroll que permita acceder a todos los puntos, etiquetas espaciadas sin eliminar valores. No unir extremos de paneles como si fueran consecutivos visibles ni presentar panel parcial como total del período. Mostrar intervalo parcial y su rango real. Tablas exactas pueden paginarse visualmente de forma explícita, sin confundirlas con paginación backend o exportación incompleta.

### Generación y descarga

Controles locales de presentación/formato y gráfico/métrica cuando corresponda; resumen textual de criterios que se enviarán. Usar exclusivamente **filtros aplicados válidos**, no el borrador ni pagina/limite. En CU40, esperar fin de debounce/aplicación o impedir descarga de filtros pendientes; no cambiar su consulta automática a búsqueda explícita por comodidad.

Exportar TABULAR desde vista dinámica; ESTADISTICA desde contexto estadístico con granularidad aplicada. No forzar que el detalle visible tenga registros para permitir un archivo vacío válido. No reutilizar gráfico/métrica al cambiar a CSV/TABULAR: eliminar parámetros prohibidos, no ocultarlos solo en la UI. El archivo estadístico incluye todas las series aun si una categoría se ocultó localmente en la gráfica; avisarlo sin cambiar contrato.

Estado de exportación separado de carga JSON, botón deshabilitado mientras su trabajo está en curso, cancelación y feedback sin borrar consulta. La concurrencia servidor es global por instancia, no por fuente; mantener 503 ocupado honesto entre pestañas/usuarios. No crear cola/reintento automático ni bloquear todo el sistema por una descarga. Navegar/cambiar filtros/rol cancela o invalida el trabajo antiguo para evitar descargas inesperadas; avisar que cancelar no garantiza deshacer una generación/auditoría ya terminada.

## 7. Tabla de fases

Se definen **siete fases** por dependencias: contrato/transporte reutilizado, descarga tabular común, primera visualización estadística, extensión a fuentes restantes, descarga estadística, verificación conjunta y aceptación local. No se divide por formato de archivo porque React consume un único mecanismo binario, no tres generadores.

| Fase | Objetivo | Dependencias | Estado |
|---|---|---|---|
| 1 | Extender servicios, queries y utilidades seguras de descarga | Guía y frontend básico | COMPLETADA — unitarias/transporte simulado (§11) |
| 2 | Descargas TABULAR en CU38–CU41 dentro de páginas actuales | Fase 1 | COMPLETADA — unitarias/navegador con API simulada (§11) |
| 3 | Estadísticas y gráficas: base común y ventas CU38 | Fase 1; Fase 2 para acciones coexistentes | COMPLETADA — unitarias/navegador con API simulada (§11) |
| 4 | Integrar estadísticas de compras/pérdidas sin duplicar páginas | Fase 3 | COMPLETADA — unitarias/navegador con API simulada (§11) |
| 5 | Exportaciones ESTADISTICA y combinaciones compatibles | Fases 2–4 | COMPLETADA — unitarias/navegador con API simulada (§11) |
| 6 | Regresión conjunta frontend, seguridad, responsive y build | Fases 2–5 | COMPLETADA — regresión focalizada/navegador con API simulada (§11) |
| 7 | Integración local autorizada y cierre con límites | Fase 6; autorización propia para entorno real | PARCIAL — integración LOCAL verificada; pendiente postlogin y límites (§11) |

## 8. Desarrollo detallado de fases

### Fase 1 — Base de integración ampliada

- **Objetivo:** extender el transporte y la validación frontend sin UI ni alteración del flujo ordinario.
- **Dependencias:** guía vigente y símbolos de §4, sin decisiones funcionales backend pendientes que deban reinventarse.
- **Lectura mínima:** reporte.service/consultaReporte/useReporteConsulta, api.js, errores/AbortSignal Axios, guide §2/4/6 y tests de consultas/services existentes; validators backend solo si se requiere contrastar discrepancia concreta.
- **Archivos previstos:** extender Service/utilidades de Reportes y Service de Inventario para descarga CU40; helper binario compartido usado por ambos y pruebas en frontend/tests. No archivos vacíos, segunda instancia Axios o parser duplicado por formato.
- **Actividades:** servicios JSON estadísticos, query por operación con whitelist propia y sin defaults de página en estadísticas/exportaciones, separación de parámetros de UI de HTTP. Documentar esquema local vista/granularidad compatible con URLs ordinarias anteriores. Helper Blob/MIME/errores/filename seguro/fallback/CORS/cancelación; definir timeout compatible con tiempos guía, sin generación de archivos real.
- **Restricciones:** sin componentes/rutas/estilos/sidebar, backend/CORS ni cálculos de negocio. No exigir periodo al CU40 ni usar serializador paginado para exportar. No ampliar useConsulta global para blobs.
- **Skill:** no aplica a esta base sin UI; obligatoria al construir UI en fases siguientes.
- **Verificaciones:** unitarias/transporte simulado: paths/params exactos de 7 operaciones nuevas, periodos/granularidad 1200/1201, futuros/bisiestos/años extremos, filtros cruzados/repetidos, 21 variantes válidas y combinaciones prohibidas, CU40 abierto/motivo texto; blobs válidos/fallos JSON/MIME incompatible/truncado/cabeceras inaccesibles/nombres hostiles/aborto. Preservar cadenas/null y regresión GET anteriores.
- **Aceptación:** pruebas focalizadas y diff limpios, API de helpers definida/compatible; sin requests funcionales ni frontend visual nuevo.
- **Entrega y continuación:** registrar firmas, estructuras/error seguro y esquema de URL, habilitando Fase 2 únicamente al aprobar regresiones de contratos actuales.

### Fase 2 — Exportación TABULAR de las cuatro fuentes

**Cargar y utilizar `frontend-design`: conservar diseño, estructura, dimensiones, orden y sidebar actuales; NO rediseñar CADEFAR.**

- **Objetivo:** integrar estáticos PDF/XLSX/CSV usando un control común con estados claros.
- **Dependencias:** Fase 1; proyección/errores/perfil LOCAL documentados.
- **Lectura mínima:** páginas/coordinador/resultados Reportes, MovimientosPage/useConsultaAutomatica, estilos y componentes de acciones/feedback; helper de descarga ya probado.
- **Archivos previstos:** control de exportación específico compartido por fuentes, hook local si se justifica, ampliaciones mínimas de páginas/coordinador/CU40 y reportes.css; pruebas focalizadas. No otra página «Reporte estático».
- **Actividades:** selección explícita formato, TABULAR sin parámetros estadísticos, filtros aplicados completos sin pagina/limite, estado generando/recibiendo/cancelado/error y limpieza de object URLs. Mostrar origen/período efectivo, aviso LOCAL y descarga de todas las coincidencias. Adaptar CU40 en su página, sin duplicar filtros/Service/historial.
- **Restricciones:** sin generación PDF/XLSX/CSV cliente, dependencia de filas visibles, lectura garantizada de headers no expuestos, éxito de guardado/apertura, cambio de CORS ni bloquear consultas por 503 de descarga.
- **Verificaciones:** navegador/API simulada acotado sin capturas: fuente/roles/paths exactos, sin período implícito en Reportes, CU40 abierto, no enviar borrador/debounce pendiente, página lejana/vacío exportables, 400/401/403/413/503/500/Blob JSON/red/aborto, doble clic y respuestas tras salir. Botones/labels/teclado/375 px; contenido dinámico intacto.
- **Aceptación:** cuatro fuentes descargables con tres formatos simulados sin combinaciones inválidas; nombre fallback y no disponibilidad honestos, sin nuevas rutas ni cambios operativos.
- **Entrega y continuación:** anotar componentes/ciclo de recursos y pruebas; Fase 3 habilitada, no iniciada automáticamente.

### Fase 3 — Vista estadística y gráficas de ventas

**Cargar y utilizar `frontend-design`: integrar indicadores/gráficas en el mismo panel y estilo aprobado, sin nuevo dashboard ni rediseño.**

- **Objetivo:** crear la base estadística común y consumir CU38 como primer recorrido completo, conservando su vista dinámica inicial.
- **Dependencias:** Fase 1 y coexistencia probada con acciones de Fase 2.
- **Lectura mínima:** useReporteConsulta/coordinador/filtros/resumen ventas, JSON guía §4, contrato de estado/URL Fase 1, estilos y utilidades exactas. Evaluar únicamente biblioteca gráfica candidata si es necesaria, React/Vite/licencia/tamaño/accesibilidad y ausencia de cálculos de porcentajes automáticos.
- **Archivos previstos:** componentes/hook estadísticos utilizados, adaptador visual puro de series/escala con strings exactos, vista opcional en página/coordinador y CSS localizado. Dependencia y pnpm-lock solo al justificar y usar; no biblioteca de UI ni generadores backend.
- **Actividades:** selector de vista, granularidad DIA/MES/ANIO explícita, consulta condicional con filtros aplicados y estado independiente. Reutilizar resumen; barras/líneas/sectores seleccionables con métrica CANTIDAD/IMPORTE; explorar valores exactos con teclado/táctil, leyendas/categorías y tabla alternativa. Mantener ceros/parciales/orden hasta1200, escala aproximada solo geometría y etiqueta precisa. URL/restauración sin reenviar campos de UI a API.
- **Restricciones:** no porcentajes ni suma monetaria flotante, muestreo, cambio de granularidad invisible o confusión distribución total/ingresos; no deshacer lógica de borrador/página/cuatro categorías de ventas.
- **Verificaciones:** datos controlados 8 series, intervalos parciales, categorías excluidas/cero, sinDatos vs importe0, precisión enorme/bajo resolución, 1200/1201 y todos los puntos accesibles, cambios rápidos/URL/limpiar/volver a dinámica sin requests innecesarios. Seleccionar gráfica no vuelve a consultar si basta el JSON. Accesibilidad y responsive.
- **Aceptación:** CU38 estadístico completo con visualizaciones y alternativa exacta, regresión dinámica/exportación tabular, parámetros válidos y sin nuevas rutas/sidebar.
- **Entrega y continuación:** registrar biblioteca o solución usada, política de escalado/paneles y contratos internos, habilitando Fase 4.

### Fase 4 — Estadísticas de compras y pérdidas

**Cargar y utilizar `frontend-design`: extender los componentes de Fase 3 conservando jerarquía, colores y estructura actuales, sin duplicar páginas.**

- **Objetivo:** completar las tres fuentes estadísticas manteniendo particularidades de cada una.
- **Dependencias:** Fase 3, transporte y selectors por fuente ya definidos.
- **Lectura mínima:** páginas/resúmenes CU39/CU41, base estadística y guía categorías/métricas/unidades; no volver a inspeccionar todo Inventario o flujos backend.
- **Archivos previstos:** ampliar composición de páginas y componentes compartidos reales, etiquetas/configuración de métricas por fuente y tests; no copiar coordinadores completos por cada fuente ni convertir todo en motor universal.
- **Actividades:** compras con 4 series y adquisición; pérdidas con 6 series, retiros brutos, costo histórico y cantidades textuales heterogéneas. CANTIDAD_RETIRADA disponible como datos exactos/tabla, **no** selector de gráfica o exportación gráfica. Regente solo pérdidas/historial; Admin tres fuentes. Misma tabla alternativa, intervalos/parciales y feedback de consultas.
- **Restricciones:** sin estadísticas de CU40, pérdidas netas/saldos históricos, nuevos filtros ni recalcular RN91. Reutilizar los ceros y totales ya materializados por servidor.
- **Verificaciones:** comparaciones por campos con fixtures exactos, ejemplo0.02 del backend sin calcularlo en React, motivoDAÑO/costo0/reversión/null/categorías excluidas, conteos vs dinero/unidades sin mezcla, estados/rangos errores y ruta directa por rol; regresión CU38 y CU40/tabular.
- **Aceptación:** tres fuentes con vistas estadísticas y gráficas compatibles, consulta dinámica sin cambios y sin indicadores inventados; build/pruebas focalizados si cambia dependencia o composición compartida.
- **Entrega y continuación:** anotar capacidades/métricas reales y tests, habilitando Fase 5.

### Fase 5 — Exportaciones ESTADISTICA integradas

**Cargar y utilizar `frontend-design`: ampliar el control de descarga de Fase 2 con selecciones legibles, sin cambiar diseño/orden de la página.**

- **Objetivo:** completar 18 variantes de reportes y 3 de CU40 con selectores compatibles y contexto aplicado visible.
- **Dependencias:** Fases 2–4.
- **Lectura mínima:** control/helper binarios, vista/métricas/granularidad aplicadas, guía §2/5/6; no código de generadores servidor salvo discrepancia contractual concreta.
- **Archivos previstos:** extender control/validator de parámetros de exportación, coordinadores existentes y pruebas. No endpoint nuevo, generador gráfico-documental cliente o serializador de tabla.
- **Actividades:** elegir TABULAR/ESTADISTICA donde permitido, PDF/XLSX requieren gráfico+metrica+granularidad; CSV estadístico solo granularidad. Cambios limpian campos incompatibles; preservar selección legítima sin enviar valores ocultos inválidos. Avisar que PDF/XLSX llevan gráfica y tabla, CSV solo datos y XLSX imagen no editable; archivo incluye todas las métricas/ceros, no solo las series visibles. Descargas independientes pueden observar otro snapshot.
- **Restricciones:** CU40 solo TABULAR, sin pagina/limite, sin usar nombres recibidos inseguros ni reintento automático por503. No inferir finalizado-servidor desde renderizado o que cancelar asegure ausencia de auditoría.
- **Verificaciones:** matriz21 variantes y cruces inválidos, transiciones PDF/XLSX/CSV y presentaciones, parámetros exactos y filtros aplicados vs borrador/página, granularidad cambiada pero no aplicada, 413/503/errorBlob/cabeceras/CORS; usuarios/rutas, cancelación y feedback independiente. No generar archivos reales durante pruebas simuladas usando motor backend.
- **Aceptación:** todas las combinaciones admitidas accesibles con una sola descarga por acción y ausencia de combinaciones prohibidas; archivo generado solo por backend y nunca reducido a tabla visible.
- **Entrega y continuación:** matriz implementado/verificado y pendientes documentados, habilitando Fase 6.

### Fase 6 — Regresión frontend conjunta y build

- **Objetivo:** comprobar ampliación y no regresión del módulo previo, sin atribuir a mocks integración real.
- **Dependencias:** Fases 2–5.
- **Lectura mínima:** cierres, pruebas/arnés frontend actuales y archivos compartidos afectados. Si se adapta UI, **cargar `frontend-design`, sin rediseñar ni alterar orden**.
- **Archivos previstos:** tests unitarios/services y navegador API simulada del módulo, regresiones focalizadas de navegación/CU40; cambios funcionales solo para defectos demostrados.
- **Actividades:** ampliar las pruebas conjuntas según los escenarios siguientes y ejecutarlas secuencialmente con el arnés existente para evitar agotamiento de recursos.
- **Verificaciones:** roles/login simulado/rutas directas, tabs/borrador/aplicado/URL/recarga/Atrás/Adelante, stats sin consultas espurias por paginar, 1200 puntos/tabla exacta/teclado/móvil375 px, exportación21 variantes y errores/red/truncado/aborto/limpieza/objectURLs, CORS simulado con y sin headers. Estados vacíos válidos, cadenas enormes/nulls/fechas sin desplazamiento y ausencia de datos anteriores tras401/403/cambio de sesión.
- **Restricciones:** sin MySQL/backend real, suites globales backend, capturas, instalaciones adicionales por comodidad o afirmación productiva. No pruebas sobre el sistema con datos del usuario.
- **Aceptación:** pruebas focalizadas y `pnpm build` aprobados, `git diff --check` y archivos nuevos revisados; registrar avisos/bundle/límites y cualquier revisión manual pendiente. No omitir escenarios fallidos para aparentar éxito.
- **Entrega y continuación:** evidencias simuladas con comandos/conteos y cobertura; Fase 7 habilitada, todavía necesita nueva autorización de integración.

### Fase 7 — Integración LOCAL autorizada y cierre

- **Objetivo:** verificar consumo real y diferenciar alcance local de preparación productiva.
- **Dependencias:** Fase 6; autorización propia explícita de destino local aislado, migraciones existentes, fixtures sintéticos, login/consultas/auditoría y limpieza. No reutilizar permisos históricos ni asumir que GET no escribe Bitácora.
- **Lectura mínima:** guía §1/6/7/9, cierres y guardas/arnés `reportes-real.browser.test.mjs` como referencia. Confirmar perfil compatible: exportación en NODE_ENV=test devuelve503; no cambiar gate/backend ni abrir proxy público para eludirlo.
- **Archivos previstos:** pruebas integradas frontend acotadas y este registro, sin modificación backend o guía. Si se corrige UI, **cargar `frontend-design` y conservar diseño/orden**.
- **Actividades:** login real por roles; dinámico/estadístico con datos conocidos y descargas reales autorizadas, validación de MIME/bytes/nombre fallback en verdadero cross-origin y acceso de cabeceras observable. Verificar endpoint consumido no solo archivo mock, cancelación y503 real cuando sea ejercitable sin dañar entorno. No crear fixtures mediante operaciones reales de farmacia sin autorización específica.
- **Verificaciones:** matriz acotada de fuentes/formatos con estado real registrado, filtros/1200 según alcance, exactitud visual-textual, 401/403/ocupado/no disponible, contexto del archivo vs consulta por snapshot independiente, gráficos React accesibles y descargas no duplicadas. CORS sin exposedHeaders exige fallback probado, no corrección del servidor en esta fase. Si revisión visual de documentos se autoriza, registrar alcance; de lo contrario mantener gate pendiente sin fabricar aceptación.
- **Restricciones:** sin Railway/producción/datos sensibles/DB operativa, capturas, despliegue, cambio de contratos o garantía de memoria/rendimiento productivos. Sin autorización: no conectar, dejar integración parcial/bloqueada y explicar frontend simulado completo.
- **Aceptación:** resultados reales/omitidos/limpieza diferenciados de simulación; backend permanece con sus límites no resueltos. Cierre identifica capacidades listas localmente, pendientes manuales/operativos y contratos consumidos, sin declarar habilitación productiva.
- **Entrega y continuación:** actualizar estados y matriz final en este archivo. No actualizar guía normativa/otros documentos ni iniciar ampliaciones extra automáticamente; cualquier corrección documental ajena necesita alcance expreso.

## 9. Protocolo de continuidad entre sesiones

1. Leer AGENTS.md raíz/frontend, este plan y cierre de dependencias; guía normativa en secciones mínimas. Backend AGENTS solo si se inspeccionan esos archivos.
2. Consultar `git status --short` y preservar cambios ajenos. Muchos archivos backend/documentación tienen trabajo previo: no revertirlo ni adjudicárselo.
3. Ejecutar **únicamente** la fase solicitada; no replanificar ni auditar todo de nuevo. Si un contrato difiere del código actual, indicar discrepancia concreta antes de inventar solución o cambiar backend.
4. En UI cargar `frontend-design`, conservar identidad/orden y extender componentes existentes. Dependencias nuevas solo justificadas, mediante pnpm y al usarlas realmente.
5. Ejecutar comprobaciones de esa fase, actualizar tabla/registro con hechos y separar estática/unitaria/API simulada/integración real.
6. Indicar siguiente fase y lectura mínima sin empezarla. Toda integración necesita autorización nueva para entorno aislado; documentación o mocks no la conceden.

Prompt de continuidad:

> Trabaja en frontend. Lee AGENTS.md raíz/frontend, docs/ai/fases.md y el cierre de dependencias. Ejecuta únicamente la Fase N de ampliación frontend de Reportes, usando contratos-reportes-react.md como fuente normativa. Extiende lo existente, no reconstruyas páginas/sidebar ni modifiques backend. Si hay UI, carga frontend-design y conserva diseño, estructura y orden de CADEFAR. No inventes métricas, formatos o cálculos financieros. No uses MySQL/backend real sin autorización nueva para entorno aislado. Prueba solo el alcance correspondiente, actualiza estado/cierre en fases.md y explica siguiente fase habilitada sin iniciarla.

## 10. Plantilla de cierre de fase

```text
Fase / fecha / estado: PENDIENTE, EN CURSO, COMPLETADA, PARCIAL o BLOQUEADA
Objetivo ejecutado y dependencias comprobadas:
Skill frontend-design: aplicada y alcance / no aplica / no disponible
Archivos y símbolos reales creados/modificados; reutilización:
Rutas frontend existentes preservadas y endpoints consumidos por rol:
Consulta dinámica / estadística / exportación efectivamente disponibles:
Decisiones locales de UX/URL/gráficas, exactitud y descarga:
Dependencia incorporada si corresponde: motivo/versión/licencia/bundle
Comandos, resultados, avisos y alcance de pruebas:
Evidencia: estática / unitarias / API simulada / integración LOCAL real autorizada
CORS/headers, fallback, disponibilidad LOCAL y límites comprobados:
Acceso a backend/MySQL, fixtures/auditoría y limpieza si se autorizó:
Cambios ajenos preservados:
Limitaciones, escenarios omitidos y pendientes:
Siguiente fase habilitada y lectura mínima:
```

No secretos/.env/JWT/cookies/credenciales ni contenido de reportes en cierres/logs. No commit, push, merge, despliegue ni instalaciones preventivas. Una fase redactada no está implementada; build exitoso no certifica integración o producción.

## 11. Registro de decisiones, avances y pendientes

### Preparación documental — no ejecuta una fase

- Se sustituye por solicitud explícita el plan backend por este plan exclusivo de ampliación frontend. **Las siete fases quedan PENDIENTES / NO INICIADAS.** Frontend básico y ampliación backend son antecedentes implementados, no entregas nuevas de esta sesión.
- Leídas guía React completa, contratos/cierres y límites relevantes del plan sustituido, fuentes funcionales selectivas y matriz de auditoría; páginas/hooks/servicios/estilos/rutas/navigation/tests existentes y routers/CORS backend. Skill `frontend-design` cargada para planificar conservación de diseño, no crear UI.
- Decisiones de planificación: conservar mismas páginas y rutas, dinámico como entrada, estadísticas opcionales dentro del panel, base de descarga común, CU40 tabular reutilizado, sin nuevos módulos de sidebar ni generadores cliente. Siete fases según dependencias de transporte, UI, fuentes y verificación; no reabrir contratos aprobados.
- Dependencias/gates heredados siguen en guía §7–9: LOCAL, CORS/headers, RAM/disco/ACL/huérfanos/deadline SQL/hosting, revisión visual de documentos y aceptación backend parcial. Sus antiguas referencias a `fases.md` son históricas después del reemplazo; fuente vigente es `contratos-reportes-react.md`, intacta, sin copiar todos los cierres. No se declara producción lista.
- Estado Git inicial con cambios backend/documentales y archivos nuevos previos; preservarlos. En esta tarea únicamente se reescribe `docs/ai/fases.md`. No código, pruebas funcionales, conexiones, instalaciones, navegadores, capturas o archivos binarios de prueba.
- Verificación documental de preparación: comprobadas siete fases pendientes con criterios completos, skill en fases visuales, once secciones, endpoints y dependencias CORS/LOCAL. `git diff --check` sin errores de espacios, solo advertencias de normalización futura LF → CRLF. Solo se reescribió este documento; cambios previos ajenos preservados. No se ejecutaron pruebas funcionales y esta revisión no cuenta como Fase 1.

Agregar aquí cierres posteriores y decisiones locales de implementación, sin duplicar la guía normativa ni sustituir evidencia por propuestas.

### Fase 1 / 20-11-2026 / COMPLETADA — base sin UI

**Objetivo ejecutado y dependencias comprobadas:** ampliados los Services existentes para los tres GET estadísticos y las cuatro rutas de exportación. Leídos AGENTS raíz/frontend, este plan, guía normativa y secciones funcionales relacionadas del contexto, requerimientos, reglas y CU38–CU41. Inspeccionados api.js, Services, consultaReporte, useReporteConsulta, apiError y pruebas pertinentes. Sin discrepancia contractual que requiriera inspeccionar/modificar backend.

**Skill frontend-design:** no aplica; esta fase no implementa interfaz.

**Archivos y símbolos reales; firmas públicas (paths desde raíz):**

| Archivo | Cambio / firma |
|---|---|
| `frontend/src/features/reportes/services/reporte.service.js` | Añadidos `getEstadisticasVentas/Compras/Perdidas(filtros, opciones?)` y `exportarReporteVentas/Compras/Perdidas(params, opciones?)`. `opciones={ signal?: AbortSignal }`. Reutilizan api y helper binario. Los tres `getReporte*` anteriores quedan intactos. |
| `frontend/src/features/inventario/services/inventario.service.js` | Añadido `exportarMovimientos(params, { signal } = {})`. GET y escrituras anteriores sin cambios de comportamiento. |
| `frontend/src/features/reportes/utils/consultaReporte.js` | Añadidos `serializarEstadisticasReporte(params, tipo)`, `serializarExportacionReporte(params, tipo)` → query string; validación estricta y 1200 intervalos inclusivos. Añadido `leerConsultaReporteAmpliada(query, tipo)` opt-in. Lectura/validación/serialización ordinarias conservan sus firmas, defaults y respuestas. |
| `frontend/src/features/inventario/utils/consultaExportacionMovimientos.js` (nuevo) | `serializarExportacionMovimientos(params)` → query string CU40 estricta; período abierto/ausente, IDs canónicos y motivo textual trim 1–40, nunca enum de pérdidas. |
| `frontend/src/utils/parametrosHttp.js` (nuevo) | `leerParametrosUnicos(entrada)` → copia de objeto textual o query/URLSearchParams, rechaza repetidos; `exigirCamposTextuales(params, campos)` → valida o lanza Error; `fechaCivilValida(valor)` → boolean. Calendario civil extraído sin cambiar su lógica, reutilizado por Reportes/CU40. |
| `frontend/src/utils/descargaBinaria.js` (nuevo) | `recibirArchivo(path, params: URLSearchParams, { fuente, presentacion, formato, signal? })` → Promise de archivo validado; `TIMEOUT_EXPORTACION_MS=270000`. Usado por ambos Services. |
| `frontend/tests/reportes-ampliacion-consulta.test.mjs` (nuevo) | Matriz/queries, calendario, 1200/1201, parámetros UI/HTTP, CU40 abierto y cruces inválidos. |
| `frontend/tests/reportes-ampliacion-services.test.mjs` (nuevo) | Axios real con adapter simulado (api.js solo sustituye variable Vite para Node), 21 variantes, credenciales, estadísticas exactas y errores/Blob/headers/nombres/cancelación. Algunos casos de headers crudos sustituyen api.get porque Axios normaliza controles antes de entregarlos al helper. |
| `docs/ai/fases.md` | Estado actual, tabla y este cierre; preservado el resto del plan y trabajo previo. |

**Rutas/roles y disponibilidad efectiva:** paths HTTP relativos `/reportes/{ventas|compras|perdidas}/{estadisticas|exportar}` y `/inventario/movimientos/exportar`, sin duplicar `/api`; withCredentials central intacto. Administrador: ventas/compras; Administrador/Regente: pérdidas/CU40; autorización definitiva backend sin cambios. No se modifican rutas frontend, componentes, páginas, sidebar, estilos, hooks visuales, useConsulta, sesión ni permisos. Las nuevas capacidades están disponibles a nivel Service, todavía no desde controles visuales.

**Salida estadística:** se devuelve `response.data` íntegro, es decir `{ data: { fuente, periodo, filtros, granularidad, sinDatos, resumen, intervalos, series, distribuciones } }`. Sin mapeo, Number sobre magnitudes exactas, indicadores nuevos, recálculo, paginación ni normalización de null. Cada petición tiene snapshot independiente. Los errores JSON estadísticos conservan el comportamiento Axios actual, sin reintento.

**Parámetros UI / aplicados / HTTP:**

- API anterior `leerConsultaReporte` y hook actual siguen estrictos: no aceptan parámetros UI. URLs ordinarias sin campos nuevos funcionan igual.
- El lector separado `leerConsultaReporteAmpliada` reconoce exclusivamente `vista=CONSULTA|ESTADISTICAS` y `uiGranularidad=DIA|MES|ANIO`. Ausencia de vista equivale a CONSULTA, sin agregar defaults HTTP. ESTADISTICAS exige uiGranularidad; CONSULTA la rechaza. Resto de claves pasa por lector ordinario estricto, no se ignoran desconocidos/repetidos.
- Retorna el resultado ordinario `{ estado, habilitada, filtros, error }`, más `ui` y `filtrosAplicados` en resultados válidos/sinPeriodo. `filtros` conserva pagina/limite; `filtrosAplicados` los separa explícitamente **solo después de validar toda la URL**. Si es inválida retorna el resultado inválido sin criterios utilizables. `habilitada` sigue indicando validez del período ordinario, no autorización ni validación estadística: antes de GET estadístico se debe pasar por su serializador (incluye 1200).
- Futuros coordinadores usarán `filtrosAplicados` + selección explícita por operación, nunca el objeto paginado completo. Convertir `ui.uiGranularidad` a `granularidad` solo para estadísticas/ESTADISTICA. Presentación/formato/gráfico/métrica son selecciones locales de exportación, no campos admitidos en URL de consulta por este lector.
- Serializadores nuevos aceptan objeto de strings, query string o URLSearchParams; devuelven string, sin mutar entrada, y lanzan Error de validación local antes de HTTP. Rechazan paginación, filtros cruzados, repetidos, arrays/objetos, vacíos y combinaciones incompatibles; no eliminan claves para reparar solicitudes inválidas. TABULAR no tiene límite temporal artificial. CU40 usa serializador propio, sin período obligatorio ni estadísticas.

**Resultado/error binario y descarga:**

- Resultado `{ blob, nombre, nombreServidor: boolean, mime, longitudVerificada: boolean }`, exclusivamente tras 200 + Blob no vacío + MIME esperado en header y Blob. Plantilla sin filas con bytes es válida; 204/Blob vacío/error JSON no lo son. No certifica estructura interna, hash ni guardado/apertura del usuario.
- Rechazo `Error` con `name='DescargaError'`, `message`, `status` (HTTP o undefined), `code`, `errors` (issues acotados a path/message seguros), `retryAfter` (segundos textuales accesibles o null). Con HTTP incluye `response={ status, data: { message, errors? } }`, compatible con guardas de sesión/apiError; nunca copia el body/stack crudo. Códigos: `HTTP_EXPORTACION`, `ARCHIVO_INVALIDO`, `LONGITUD_INVALIDA`, `ERR_CANCELED`, `TIEMPO_AGOTADO`, `RED`, `CONFIGURACION`. Validación previa de parámetros lanza Error local ordinario, no simula HTTP.
- Sobres Blob JSON se leen solo si MIME JSON y tamaño ≤64 KiB; mensajes superiores permitidos por lista contractual y fallback por estado, issues filtrados/acotados. Distingue los tres mensajes 503 documentados; 401/403/413 conservan status y explicación segura. JSON malformado/sobredimensionado conserva estado y fallback. Ningún error se entrega como archivo.
- AbortSignal se pasa a Axios; se comprueba antes/después del transporte y tras lectura asíncrona de error. No retry automático, HEAD, polling, gate por hostname, logs de archivo ni persistencia.
- Timeout 270000 ms = generación documentada 120 s + entrega 120 s + margen 30 s de transporte/admisión. No garantiza cancelación SQL inmediata ni revierte auditoría ya terminada.
- Longitud: valida sintaxis accesible; compara con Blob.size solo con `Content-Encoding: identity` explícito o URL **final del transporte** comprobada de mismo origen y ausencia de encoding. Si hay compresión u origen/codificación no comprobables, `longitudVerificada=false`: Content-Encoding puede estar oculto por CORS; no se inventa equivalencia de bytes comprimidos/descomprimidos. MIME y tamaño no garantizan integridad completa.
- Nombre servidor solo para Content-Disposition accesible, attachment ASCII inequívoco y extensión compatible; rechaza rutas, controles, separadores, extensiones dobles/incompatibles, nombres reservados Windows y variantes ambiguas. Fallback fijo `cadefar-{ventas|compras|perdidas|movimientos}-{tabular|estadistica}.{pdf|xlsx|csv}`, `nombreServidor=false`, sin datos personales. Cabeceras ausentes o getters inaccesibles no causan promesas falsas.
- **No se implementa activador de descarga ni se crean anchors/object URLs.** Fase 2 deberá validar vigencia, decidir activación y gestionar esos recursos/limpieza con pruebas propias; recibir un archivo no dispara un efecto lateral.

**Dependencias:** ninguna nueva. Sin Context, caché, generadores cliente, librerías de UI/gráficas ni refactor global.

**Comandos y evidencia real (solo unitarias/API simulada):**

```text
node --test tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs
65 aprobadas, 0 fallidas/canceladas/omitidas (incluye subtests y regresiones ordinarias).
git diff --check
Sin errores de espacios; únicamente avisos de futura normalización LF → CRLF.
git -c core.autocrlf=false diff --no-index --check -- NUL <archivo nuevo>
Cinco archivos nuevos revisados, sin diagnósticos de espacios.
```

Primera iteración: 61/63, dos fallos del arnés corregidos (controles normalizados por Axios y mock de propiedad location inexistente en Node). Se agregaron después dos pruebas explícitas de cancelación al parsear Blob/Retry-After y propagación de errores estadísticos. Ejecución final: 65/65. En la revisión sin seguimiento, la primera guarda PowerShell interpretó como fallo el exit 1 normal de no-index por diferencias con NUL; se corrigió para comprobar diagnósticos y errores reales (>1), revisando los cinco archivos. Un control adicional de archivos seguidos con core.autocrlf=false interpretó CRLF existentes como espacios finales; se repitió `git diff --check -- . ../docs/ai/fases.md` con la configuración del repositorio y pasó, sin normalizar archivos ajenos. Revisados también diffs de Services/consulta y contenido de helpers/pruebas nuevos. No se ocultaron escenarios fallidos. Sin suites globales, build, backend/MySQL, solicitudes reales, documentos PDF/XLSX/CSV reales, navegadores ni capturas. Las pruebas de transporte usan exclusivamente fixtures sintéticos en memoria.

**CORS/LOCAL y límites:** no se modificó CORS/proxy/backend. Content-Disposition y Retry-After siguen potencialmente ilegibles entre orígenes; Content-Type/Length safelisted. Se ejercitaron cabeceras presentes, ausentes/inaccesibles y compresión simuladas, no CORS en navegador real. La disponibilidad LOCAL sigue determinada por el servidor y sus 503, no por una inferencia del cliente. Permanecen todos los gates heredados de RAM/disco/ACL/huérfanos/deadline SQL/hosting, visual de documentos y aceptación backend parcial.

**Cambios ajenos preservados:** estado inicial con modificaciones/archivos nuevos backend y documentación (incluido este plan); no revertidos, ni incluidos como implementación de esta fase. No cambios de rama, instalaciones, commits, push o despliegues.

**Pendientes y siguiente fase:** Fase 2 habilitada por contratos/regresiones simuladas, **NO INICIADA**; Fases 3–7 pendientes. Lectura mínima: este cierre, guía §2/5–7, Services/serializadores/helper y pruebas nuevas; luego coordinador/páginas Reportes y MovimientosPage/useConsultaAutomatica, componentes/estilos de acciones existentes. Cargar frontend-design al ejecutar la fase visual. Probar allí filtros aplicados vs borrador/debounce, vigencia de respuestas por navegación/sesión, activación y limpieza real de recursos. Integración LOCAL y aceptación visual/productiva no se acreditan con esta fase.

### Fase 2 / 20-11-2026 / COMPLETADA — TABULAR con API simulada

**Objetivo y dependencias:** integradas exclusivamente exportaciones TABULAR PDF/XLSX/CSV en las cuatro páginas existentes. Reutilizados sin modificar los Services, serializadores y `recibirArchivo` de Fase 1, sus pruebas y firmas reales. Consultados AGENTS raíz/frontend, cierre de Fase 1, guía normativa, contexto §39, RF35–RF38, RN97–RN101 y CU38–CU41. No se inicia Fase 3.

**Skill frontend-design aplicada:** conservación del diseño, tipografía, colores y tokens existentes, `form-field`, botones secundarios y feedback compartido. Control dentro del panel entre nota y resultados, sin reemplazar filtros, toolbar, resumen, tabla o paginación. Sin nuevo tema, rutas, sidebar, iconografía ni biblioteca. Acciones se reorganizan verticalmente en móvil; criterios/nombres admiten salto de línea.

**Archivos y símbolos reales (paths relativos a raíz):**

| Archivo | Cambio / reutilización |
|---|---|
| `frontend/src/features/reportes/components/ExportacionTabular.jsx` (nuevo) | Control común de las cuatro fuentes, formato explícito sin selección inicial, criterios aplicados, nota LOCAL/snapshot/recursos, cancelación y feedback seguro. Usa Services existentes, useAuth y constantes ROLES. |
| `frontend/src/features/reportes/utils/exportacionTabular.js` (nuevo) | `prepararTabular(query, fuente, formato)`: valida consulta completa; solo después separa pagina/limite legítimos de Reportes. CU40 valida URL original mediante serializador propio, conservando repetidos/desconocidos para rechazo. No repara criterios inválidos. |
| `frontend/src/features/reportes/hooks/useExportacionTabular.js` (nuevo) | `useExportacionTabular(clave, exportar, onRestringida, sesion)`: trabajo independiente, bloqueo síncrono de duplicados, AbortController, vigencia por contexto y referencia de sesión, cancelación explícita. |
| `frontend/src/utils/activarDescarga.js` (nuevo) | `activarDescarga({ blob, nombre })`: activación DOM separada de React y de recibirArchivo. |
| `frontend/src/features/reportes/components/ReporteOperacionesConsulta.jsx` | Inserta el control CU38/CU39, sin reconstruir páginas ni resultados. |
| `frontend/src/features/reportes/pages/PerdidasPage.jsx` | Reutiliza el control CU41, conserva recorrido específico. |
| `frontend/src/features/reportes/hooks/useReporteConsulta.js` | Añade `restringir(status)` para invalidar/retirar lectura visible tras 401/403 de descarga, manteniendo recuperación/login existente. Otros errores no borran la consulta. |
| `frontend/src/features/inventario/pages/MovimientosPage.jsx` | Integra CU40, bloqueo pendiente/inválido y retiro local de datos ante 401/403. Conserva navegación desde ambos paquetes. |
| `frontend/src/hooks/useConsultaAutomatica.js` | Expone boolean `pendiente` ya calculado; sin cambiar debounce, transformación, URL ni consultas de otros consumidores. |
| `frontend/src/features/reportes/styles/reportes.css` | Solo clases localizadas del control y adaptación móvil, reutilizando tokens existentes. |
| `frontend/tests/reportes-tabular.test.mjs` (nuevo) | Preparación estricta cuatro × tres, períodos/filtros abiertos, paginación y activación/limpieza incluso ante fallo DOM. |
| `frontend/tests/reportes-tabular-ciclo.test.mjs` (nuevo) | Ciclo del hook con hooks React simulados: promesas no cooperativas, navegación/filtros/sesión/rol/desmontaje, doble click y cancelación seguida de otro trabajo. No sustituye navegador React real. |
| `frontend/tests/reportes-tabular.browser.test.mjs` (nuevo) | React/Router/Axios reales, API CDP simulada, doce variantes y estados/recursos/accesibilidad. Anchor observado sin guardado de archivos. |
| `docs/ai/fases.md` | Estado/tabla y este cierre, preservando el plan/cierre previos. |

**Rutas, endpoints y roles:** se preservan `/reportes/ventas`, `/reportes/compras`, `/reportes/perdidas`, `/inventario/movimientos`. GET relativos a api.js: `/reportes/ventas/exportar`, `/reportes/compras/exportar` solo Administrador; `/reportes/perdidas/exportar`, `/inventario/movimientos/exportar` Administrador/Regente. Vendedor/sesión ausente sin acceso visual; backend conserva autorización definitiva. Sin HEAD, hostname gate, proxy ni permisos nuevos.

**Disponibilidad efectiva y UX:** consulta ordinaria intacta; estadísticas y exportaciones ESTADISTICA no se ofrecen. Selección explícita PDF/XLSX/CSV, presentación TABULAR fija y visible; no hay selección de formato predeterminada en HTTP (el control usa PDF solo para comprobar localmente validez de criterios antes de seleccionar formato). Sin período en Reportes no se habilita exportación; CU40 permite ausencia de filtros o límites abiertos y motivo textual. Se exportan todas las coincidencias aun en vacíos/páginas lejanas; nunca pagina/limite/granularidad/grafico/metrica. Borrador de Reportes no modifica criterios de descarga. CU40 impide exportar durante debounce y cancela el trabajo viejo en cuanto cambia ese estado. No cálculo de importes ni generación/serialización local de documentos.

**Ciclo de descarga y recursos:** `recibirArchivo` entrega Blob/metadatos validados, sin efectos DOM. Hook espera y comprueba vigencia (ruta/key/query, fuente, pendiente/restricción, identidad/rol/carga y referencia de sesión) antes de activar. Layout cleanup aborta y retira referencia del trabajo al cambiar contexto o desmontarse; respuesta obsoleta nunca crea URL. Referencia síncrona bloquea doble click antes del render. Cancelar permite reintento manual, sin que el finally de una respuesta vieja libere un trabajo nuevo. Tras validación se crea una URL y anchor oculto, se conecta, activa una sola vez y retira en finally. URL se revoca mediante temporizador independiente a los 60 s, también ante fallo de click; desmontar después de activarla no revoca prematuramente el recurso. Cerrar el documento destruye sus recursos nativos. Los tests interceptan este temporizador y ejecutan su callback explícitamente, no esperan 60 s ni prueban compatibilidad ilimitada de navegadores. No se conserva Blob en estado/contexto/caché ni se convierte a base64 para producto. Mensaje máximo «Archivo recibido; descarga iniciada», nunca guardado/apertura comprobados. Cancelar no promete detener SQL ni revertir auditoría.

**Errores/CORS/LOCAL:** reutilizado sobre seguro de Fase 1 para 400, 401, 403, 413, tres 503 (ocupado/no disponible/tiempo), 500, red, JSON Blob 200/error, MIME/transporte/longitud inválidos y cancelación. Sin retry automático; Retry-After solo si accesible, reintento siempre manual. 401/403 retiran datos restringidos y bloquean descarga; 401 ofrece login mediante recorrido existente. Otros fallos conservan resultado dinámico independiente. Nombre servidor solo si seguro/accesible; fallback explícitamente alternativo `cadefar-{fuente}-tabular.{ext}` si cabecera ausente/inaccesible/inválida. Nota LOCAL y límite Blob 128 MiB visibles. Cabeceras ocultas simuladas en navegador filtrando acceso XHR a Content-Disposition/Retry-After; no equivale a probar CORS real entre orígenes. No se altera CORS ni se deduce disponibilidad por hostname.

**Comandos y resultados (alcance focalizado, sin suites globales):**

```text
node --test --test-concurrency=1 tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs tests/reportes-tabular.browser.test.mjs tests/reportes-ventas.browser.test.mjs
137 aprobadas, 0 fallidas/canceladas/omitidas (incluye contenedoras/subtests).
git diff --check
Sin errores de espacios; solo avisos LF → CRLF (incluidos archivos ajenos).
git -c core.autocrlf=false diff --no-index --check -- NUL <archivo>
12 archivos frontend sin seguimiento comprobados individualmente (7 nuevos de esta fase y 5 previos de Fase 1), sin diagnósticos de espacios.
```

Incluye las 65 heredadas, 6 unitarias nuevas de preparación/recursos/ciclo y 66 de navegador (10 nuevas incluyendo contenedora, 56 de regresión incluyendo contenedoras). Cobertura: cuatro fuentes × tres formatos, roles/paths exactos, consulta vacía/página lejana, borrador vs aplicado/debounce, filtros inválidos no saneados, sin período implícito, consultas ordinarias/URL/Atrás/Adelante/tablas/decimales intactos, cancelación/doble click/respuestas obsoletas, nombre servidor/fallback/Retry-After accesible e inaccesible, recursos únicos/limpieza diferida tras navegar, labels/teclado/foco y 375 px/escritorio. Navegador genera únicamente build temporal del frontend para servirlo sin proxy; API siempre interceptada o rechazada, sin backend real.

Iteraciones fallidas registradas: dos unitarias iniciales intentaron mockear propiedad document inexistente en Node (corregido definiéndola/restaurándola); dos casos de navegador intentaban responder una intercepción que Chrome ya había retirado por aborto XHR (corregido aceptando exclusivamente Invalid InterceptionId en entrega deliberadamente tardía, comprobando cero activaciones). Después se añadieron pruebas del hook con promesas que ignoran AbortSignal, evitando depender solo del aborto de Chrome. No escenarios omitidos para aparentar éxito.

**Evidencia y acceso real:** estática + unitarias/transporte simulado + navegador con API simulada. Sin backend/MySQL, fixtures persistidos, archivos reales generados/guardados, capturas o auditoría real. Sin instalaciones, commit/push/despliegue. Perfiles/builds temporales propios del arnés retirados en finally. Implementación no certifica compatibilidad de archivos PDF/XLSX/CSV, CORS real, infraestructura o disponibilidad productiva.

**Cambios ajenos preservados:** modificaciones/archivos nuevos previos de backend, documentación (incluido plan) y base Fase 1 en frontend; no revertidos ni adjudicados a Fase 2. Services, helper binario, serializadores base, contratos normativos, rutas y sidebar no modificados en esta fase.

**Límites y pendientes:** revisión visual manual de CADEFAR y documentos reales, integración LOCAL autorizada y CORS entre orígenes reales siguen pendientes. Persisten gates de RAM/disco/ACL/huérfanos/deadline SQL/hosting y aceptación backend parcial. Pruebas de ciclo de sesión usan harness unitario; permisos/rutas/login se verifican con React real y API simulada, no revocación real de cookie. Ninguna afirmación de guardado o apertura por el usuario.

**Continuación:** Fase 3 habilitada, NO INICIADA. Lectura mínima: este cierre y Fase 1, guía §2–4/6–7, control/hook de exportación, useReporteConsulta/coordinador/resultados ventas, estilos actuales. Cargar frontend-design conservando identidad; cualquier integración real requiere autorización propia posterior.

### Fase 3 / 20-11-2026 / COMPLETADA — CU38 estadístico con API simulada

**Objetivo ejecutado y dependencias comprobadas:** exclusivamente estadísticas/gráficas de ventas CU38 dentro del panel existente. Leídos AGENTS raíz/frontend, Fase 3 y cierres 1–2, guía normativa, contexto §39, RF35/ampliación común, RN97–RN98 y CU38. Inspeccionadas firmas reales de Service, lectores/serializadores, hook/coordinador, página/resumen/tabla/filtros, control/hook TABULAR, estilos y arneses focalizados. Se mantienen los cierres históricos anteriores, no se reinterpretan como integración real.

**Skill frontend-design aplicada:** se conserva Segoe UI Variable/Aptos/Segoe UI, paleta existente (superficie #ffffff, tinta #252930, muted #555f6b, bordes #dce2e8 y foco #9b5b00), jerarquía del panel y controles de catálogo. Se añade selector radio Consulta/Estadísticas debajo de filtros y sección opcional; no nuevo dashboard, tema, sidebar, rutas, iconos ni biblioteca de UI. CSS localizado, controles flexibles y tablas/viewport con scroll etiquetado a 375 px.

**Archivos y símbolos reales (desde raíz):**

| Archivo | Implementación / reutilización |
|---|---|
| `frontend/src/features/reportes/pages/ReporteVentasPage.jsx` | Activa únicamente CU38 mediante prop `estadisticasVentas`; conserva composición, textos y resultado ordinario. |
| `frontend/src/features/reportes/components/ReporteOperacionesConsulta.jsx` | Selector radio accesible dentro del panel; monta `ReporteVentasEstadisticas` solo para la capacidad CU38. Consulta inicial, filtros, tabla, paginación y TABULAR conservados; compras sin vista nueva. |
| `frontend/src/features/reportes/hooks/useReporteConsulta.js` | Firma compatible `useReporteConsulta(tipo, consultar, ampliada = false)`. Opt-in de `leerConsultaReporteAmpliada`, preservación de UI al aplicar filtros, `cambiarVista(vista, granularidad)`, borrador no aplicado al cambiar vista. Restricción 401/403 no se levanta cambiando solo vista; canonización de URL compara clave HTTP sin campos UI. |
| `frontend/src/features/reportes/components/ReporteVentasEstadisticas.jsx` (nuevo) | Coordinación CU38, granularidad borrador/aplicada, consulta condicional y Actualizar estadísticas. Usa `getEstadisticasVentas`, `serializarEstadisticasReporte`, `useAuth`/ROLES y `ReporteVentasResumen` existentes. Clave ordenada tras validar, sin pagina/limite ni representación. |
| `frontend/src/features/reportes/hooks/useReporteEstadisticas.js` (nuevo) | `useReporteEstadisticas(consultar, clave, sesion, onRestringida)`; estado/revisión independientes, AbortSignal, identidad de sesión y cleanup de layout; ignora promesas no cooperativas de contextos obsoletos. Devuelve data/loading/error/status/retry, sin caché global ni blobs. |
| `frontend/src/features/reportes/components/ReporteEstadisticas.jsx` (nuevo) | `ReporteEstadisticas({ data })`: barras/líneas por intervalos y sectores del período; cantidad/importe separados, leyenda numerada/seleccionable, exploración exacta por foco/Enter/Espacio/click/toque, distribuciones y tabla alternativa completa por panel. |
| `frontend/src/features/reportes/utils/escalaEstadistica.js` (nuevo) | `magnitudExacta`, `proporcionVisual`, `escalaSeries`, `panelesIntervalos`; adaptador puro de coordenadas y paneles, sin cálculo de negocio ni modificación del JSON. |
| `frontend/src/features/reportes/utils/exportacionTabular.js` | Ventas valida URL ampliada completa antes de separar paginación; admite `vista=CONSULTA` explícita y rechaza TABULAR desde ESTADISTICAS. Otras tres fuentes conservan sus lectores estrictos. |
| `frontend/src/features/reportes/styles/reportes.css` | Clases localizadas selector/leyenda/controles/viewport/series/foco; conserva estilos previos de filtros, resultados y exportación. |
| `frontend/tests/fixtures/estadisticasVentas.mjs` (nuevo) | Fixture sintético de ocho series/cuatro categorías, parciales, ceros/exclusiones, importes enormes/0.01 y 1200 intervalos. Aritmética de fixture exclusivamente en tests, no frontend. |
| `frontend/tests/reportes-estadisticas.test.mjs` (nuevo) | Escala acotada/strings/orden/no mutación, paneles 60/61/1200, 1201 rechazado, UI/HTTP, TABULAR y vacío frente a importe cero. |
| `frontend/tests/reportes-estadisticas-ciclo.test.mjs` (nuevo) | Hooks React simulados: respuestas no cooperativas fuera de orden, filtros/sesión/rol/salida/desmontaje, clave estable y retiro 401/403. No sustituye navegador real. |
| `frontend/tests/reportes-estadisticas.browser.test.mjs` (nuevo) | Patrón CDP del arnés existente; React/Router/Axios reales, API simulada, sin capturas. 11 escenarios más contenedora. |
| `docs/ai/fases.md` | Estado/tabla y cierre, conservando decisiones/cierres previos y trabajo ajeno. |

**Rutas, endpoints y rol:** ninguna ruta/sidebar modificada. Se consume exclusivamente `/reportes/ventas/estadisticas` desde la capacidad nueva, Administrador; autorización definitiva backend intacta. Los GET ordinarios siguen disponibles con sus permisos y cookies centrales. No estadísticas de compras/pérdidas/CU40 ni exportación ESTADISTICA. Services, lector ampliado/serializadores base, ReporteFilters, ReporteVentasResultado, ExportacionTabular y useExportacionTabular se reutilizan sin modificarlos.

**Estado/URL y coexistencia:** entrada sin UI = Consulta. ESTADISTICAS aplicado usa `vista=ESTADISTICAS&uiGranularidad=DIA|MES|ANIO`, esquema opt-in de Fase 1, nunca HTTP ordinario. Elegir Estadísticas sin granularidad abre selección local pendiente; no GET hasta aplicar granularidad explícita y tener período aplicado válido. `Aplicar granularidad` no aplica borrador comercial; Buscar conserva granularidad aplicada, no la editada. Editar no consulta; Actualizar estadísticas usa exclusivamente criterios aplicados. Volver a Consulta retira parámetros UI, conserva página/límite y ofrece TABULAR (PDF/XLSX/CSV) sin parámetros estadísticos. Vista/granularidad aplicadas restaurables por URL/recarga/Atrás/Adelante; desconocidos/repetidos siguen inválidos. Gráfica/métrica/categorías/panel son locales; decisión UX explícita de barras/cantidad iniciales, sin defaults HTTP. No nueva consulta por representación, categorías, orden de URL o página. La lectura dinámica existente conserva su ciclo independiente y puede ejecutarse al aplicar sus filtros también estando en Estadísticas; no es un GET estadístico preventivo. Salir de Estadísticas invalida su lectura; volver exige selección/aplicación y obtiene otro snapshot, sin caché.

**Solución gráfica/dependencias:** SVG nativo + React ya instalado; sin incorporación a package/lock/licencias/bundle de terceros. Es la solución menor para tres representaciones, cuatro categorías y tabla accesible: evita porcentajes, normalizaciones y defaults implícitos de una biblioteca. Colores existentes, números 1–4 en puntos/sectores/leyenda y trazos diferenciados en líneas, sin depender solo del color ni animaciones.

**Escalado y exactitud:** cantidades/dinero permanecen strings, null de filtros se conserva, fechas civiles se imprimen literalmente sin Date/UTC. No Number/parseFloat sobre dinero para mostrar/sumar; no recomputar resúmenes/totales/indicadores. Solo geometría: BigInt de unidades exactas, máximo común de todas las series de la métrica/período (incluidas ocultas); cociente entero a millonésimas y recién después Number en [0,1]. Error geométrico absoluto menor a una millonésima de escala. Sectores usan total contractual y acumulación BigInt solo para posiciones; ocultar conserva huecos/denominador original, no redistribuye ni cambia totales. Valores bajo resolución avisados y disponibles exactos en foco/tabla. El total informativo de distribución no se presenta como `totalVentasRealizadas`; resumen reutilizado solo confirmadas. `sinDatos` gobierna «Sin operaciones», distinto de «Sin valor para graficar» con importe cero. Sin sectores ficticios, porcentajes, promedios, crecimiento o moneda asumida.

**Paneles/viewport/accesibilidad:** hasta 20 paneles de 60 intervalos seleccionables explícitamente, sin muestreo/truncado/cambio automático de granularidad. SVG temporal de 96 px/intervalo y scroll horizontal; selector común a gráfica temporal y tabla (no paginación HTTP). Líneas solo unen puntos del panel visible. Se indican índice/alcance del panel, total de intervalos, extremos reales y parciales; sectores siempre período completo. Tabla alternativa incluye las ocho series/ceros/categorías ocultas y totales originales, hasta 480 filas/panel y 9600 accesibles en 1200 intervalos. Distribución exacta completa independiente del panel y métrica visual. Grupos SVG con nombre exacto/title, foco visible y Enter/Espacio; panel de valor persistente/live con teclado/click/toque, no solo hover. Fieldsets/legends/labels, aria-busy, tablas con caption/headers y regiones desplazables etiquetadas/focalizables. Verificados DOM/teclado/toque CDP y ancho 375 px, no aceptación manual con lectores de pantalla.

**Errores/ciclo:** estado estadístico independiente de consulta/exportación; 400/límite local conserva selección y solicita elegir otra granularidad/período sin reparación automática; 500/red permite reintento manual. Carga retira datos anteriores. 401/403 invalidan ambas vistas y bloquean datos/descarga; se conserva recorrido de login existente sin manipular cookie/JWT. Cleanup aborta transporte y descarta respuestas viejas incluso si ignoran AbortSignal, al cambiar filtros/granularidad, sesión/rol, salir de vista o desmontar. No HEAD, polling ni retry automático.

**Comandos/resultados focalizados:**

```text
node --test --test-concurrency=1 tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs tests/reportes-tabular.browser.test.mjs tests/reportes-ventas.browser.test.mjs tests/reportes-estadisticas.test.mjs tests/reportes-estadisticas-ciclo.test.mjs tests/reportes-estadisticas.browser.test.mjs
156 aprobadas, 0 fallidas/canceladas/omitidas, incluyendo contenedoras/subtests.
pnpm build
Build Vite aprobado: 254 módulos; JS principal 349.74 kB (gzip 80.67 kB), vendor 362.77 kB (gzip 116.99 kB), CSS 80.44 kB (gzip 12.79 kB). Sin dependencia nueva ni avisos de chunks grandes.
git diff --check
Sin errores de espacios; avisos de normalización futura LF → CRLF.
git -c core.autocrlf=false diff --no-index --check -- NUL <archivo frontend sin seguimiento>
20 archivos frontend sin seguimiento comprobados individualmente (8 nuevos de esta fase y 12 previos), sin diagnósticos de espacios.
```

La ejecución conjunta conserva 137 pruebas previas e incorpora 19 (7 unitarias/ciclo, 12 navegador incluyendo contenedora). Verificados ocho series/cuatro categorías, grandes exactos y bajo resolución, parciales/ceros/exclusiones, vacío frente a importe cero, 1200 accesibles/1201 sin autoajuste, ausencia de GET adicionales por representación/paginación, borrador/URL/recarga/Atrás/Adelante, errores, roles, respuestas retenidas/desmontaje, labels/foco/teclado/toque/375 px y regresión consulta ordinaria/TABULAR de las cuatro fuentes. Heredados tests de transporte de 21 variantes verifican Services de Fase 1, no agregan exportación ESTADISTICA a UI.

**Iteraciones y errores encontrados:** primera corrida nueva 13/19: cuatro escenarios fallaban por comillas mal escapadas en expresiones CDP del arnés, y otro detectó restricción 401/403 que se perdía al cambiar vista (más contenedora fallida). Corregidos arnés y ámbito de restricción, sin omitir escenarios. En revisión posterior se corrigió canonización de Buscar con campos UI para no dejar la consulta dinámica invalidada/formulario bloqueado cuando no cambia su clave HTTP; se añadió regresión. Clave estadística ordenada tras validación evita refrescos por mero orden de URL; añadida comprobación. La comprobación de 1200 recorre todos los paneles, cuenta 4800 puntos y 9600 filas; verifica líneas de 60 puntos y foco en último intervalo.

Al reforzar esa última comprobación después de una ejecución conjunta 156/156, una corrida conjunta dio 154/156 (escenario y contenedora) y las iteraciones aisladas reprodujeron el fallo: el arnés esperaba actualizar el explorador solo con foco SVG programático al extremo del viewport. Se añadió margen final de 64 px para no recortar el último punto y se comprobó explícitamente scroll/foco/aria-label y activación de teclado Enter, en lugar de asumir que foco programático equivale a activación. El escenario completo se conserva y vuelve a aprobar: ejecución conjunta final **156/156**, sin fallidas/canceladas/omitidas. No se contó el foco sin activación como evidencia de valor explorado.

**Evidencia, CORS/LOCAL y límites:** únicamente estática/unitarias/transporte y navegador con API simulada; build no acredita integración ni disponibilidad productiva. No backend/MySQL, fixtures persistidos, auditoría real, capturas, archivos reales guardados/generados, instalaciones, commit/push/despliegue. El arnés sirve build temporal sin proxy y rechaza API no interceptada, perfiles propios retirados en finally. CORS/cabeceras/perfil LOCAL mantienen límites de Fases 1–2: simulación no equivale a CORS real, no cambio de configuración ni aceptación de documentos. Pendientes integración LOCAL autorizada, lector de pantalla/revisión visual manual y compatibilidad de otros navegadores/dispositivos; gates backend de RAM/disco/ACL/huérfanos/deadline SQL/hosting/documentos siguen vigentes.

**Cambios ajenos preservados:** modificaciones/archivos nuevos preexistentes de backend, documentación y Fases 1–2 frontend; no revertidos ni adjudicados a Fase 3. Solo frontend pertinente y seguimiento en este documento modificados. Contratos normativos, backend, CORS/proxy/base de datos, rutas/sidebar intactos.

**Siguiente fase:** Fase 4 habilitada por evidencia simulada, **NO INICIADA**. Lectura mínima: este cierre, guía §2–4, componentes/hook/adaptador nuevos y páginas/resúmenes específicos CU39/CU41. Reutilizar sin duplicar ni asumir métricas de pérdidas; cualquier integración real requiere autorización nueva. No se inicia Fase 4 automáticamente.

### Fase 4 / 20-11-2026 / COMPLETADA — CU39/CU41 con API simulada

**Objetivo ejecutado y dependencias comprobadas:** integradas exclusivamente estadísticas de compras y pérdidas sobre la base de Fase 3; ventas CU38 y TABULAR de las cuatro fuentes conservados. Leídos AGENTS raíz/frontend, definición de Fase 4 y cierres 1–3, guía normativa, contexto §39, RF36/RF38 y ampliación común, RN91/RN99/RN101, CU39/CU41. Inspeccionadas las firmas reales de componentes, hooks, escala, lectores/serializadores, filtros, Services, exportación, resultados/resúmenes, CSS y arneses pertinentes. Sin discrepancia contractual que requiriera modificar o inspeccionar flujos backend adicionales.

**Skill frontend-design aplicada:** conservación de la paleta, tipografía, controles, jerarquía y responsive existentes descritos en Fase 3. Mismo selector radio Consulta/Estadísticas dentro de cada panel y misma sección SVG/tabla, sin nuevo tema ni dashboard. No se modifica CSS: las clases existentes cubren las dos nuevas fuentes, foco y 375 px.

**Archivos y símbolos reales (desde raíz):**

| Archivo | Cambio / reutilización |
|---|---|
| `frontend/src/features/reportes/components/ReporteFuenteEstadisticas.jsx` | Renombrado y extendido desde `ReporteVentasEstadisticas.jsx`, que deja de existir. `ReporteFuenteEstadisticas({ tipo, activa, aplicada, restringida, onRestringida, onAplicar })` coordina las tres fuentes con mapa explícito de Service/Resumen; sin copiar coordinadores ni motor universal. Usa los tres `getEstadisticas*`, el mismo hook y serializador. |
| `frontend/src/features/reportes/components/ReporteEstadisticas.jsx` | Conserva firma `{ data }`, geometría, paneles, tabla y exploración; etiquetas de ANULADA/VENCIMIENTO/DAÑO y métricas gráficas explícitas por `data.fuente`. Pérdidas inicia con CANTIDAD_RETIROS; CANTIDAD_RETIRADA no aparece en opciones gráficas. |
| `frontend/src/features/reportes/components/ReporteOperacionesConsulta.jsx` | Añade prop compatible `estadisticasCompras=false`, conserva `estadisticasVentas`. Opt-in del lector ampliado para CU39 y uso del coordinador compartido por tipo; mismos resultados/filtros/paginación ordinarios. |
| `frontend/src/features/reportes/pages/ReporteComprasPage.jsx` | Activa `estadisticasCompras`, conserva textos sobre adquisición y componentes de resultado. |
| `frontend/src/features/reportes/pages/PerdidasPage.jsx` | Activa `useReporteConsulta('perdidas', getReportePerdidas, true)`, selector local y `ReporteFuenteEstadisticas`; conserva su recorrido específico, nota de retiros brutos, resultados y enlaces a CU40. |
| `frontend/src/features/reportes/utils/exportacionTabular.js` | `prepararTabular` usa lector ampliado para las tres fuentes de Reportes, siempre validando toda la URL antes de separar página/UI. CU40 conserva su serializador propio. TABULAR solo Consulta, sin parámetros estadísticos. |
| `frontend/tests/fixtures/estadisticasComprasPerdidas.mjs` | `estadisticasFuente(tipo, params?, opciones?)`: cuatro/seis series sintéticas, calendario civil DIA/MES/ANIO/parciales, ceros/filtros/1200/extremos; agregados exactos y ejemplo 0.02 recibidos como JSON. `detallePerdidas` simula costo cero, dos costos 0.005000 con pérdidas individuales 0.01, reversión informativa y null. La aritmética de fixture no pertenece a React. |
| `frontend/tests/reportes-estadisticas-fuentes.test.mjs` | Cuatro unitarias nuevas para unidades/series, exclusiones, exactitud, grandes/bajo resolución, opt-in estricto, TABULAR, 1200/1201 y no mutación. |
| `frontend/tests/reportes-estadisticas-ciclo.test.mjs` | Reutiliza simulación de hooks y promesas no cooperativas; añade granularidad y cambio de Service/fuente con igual query, incluyendo rechazo 403 tardío sin restringir el contexto vigente. |
| `frontend/tests/reportes-estadisticas.browser.test.mjs` | Parametriza el arnés CDP existente para las tres fuentes. Conserva regresión CU38 y añade comparaciones campo por campo de todas las series/distribuciones CU39/CU41, filtros propios, referencias, métricas y roles específicos. |
| `docs/ai/fases.md` | Estado/tabla y este cierre; cierres anteriores preservados como evidencia histórica. |

**Reutilización sin modificar:** `useReporteEstadisticas`, `useReporteConsulta`, `escalaEstadistica`, `consultaReporte` (incluido lector ampliado opt-in), `ReporteFilters`, los tres resúmenes/resultados, `reporte.service`, `ExportacionTabular`, hook/transporte binario y `reportes.css`. No Context nuevo, caché, biblioteca, dependencia o modificación package/lock. Se mantiene `withCredentials` y sesión pública con cookie HttpOnly, sin JWT cliente.

**Rutas/endpoints/roles:** mismas rutas `/reportes/ventas`, `/reportes/compras`, `/reportes/perdidas` y `/inventario/movimientos`, sin cambios de Router/sidebar. Nuevo consumo visual de GET `/reportes/compras/estadisticas` solo Administrador y `/reportes/perdidas/estadisticas` Administrador/Regente, relativos al api.js central. CU38 sigue Administrador; Regente conserva únicamente pérdidas/CU40 en Reportes. Ningún GET estadístico preventivo de otras fuentes, HEAD o estadística CU40. Backend mantiene autorización definitiva.

**Categorías, métricas y particularidades:**

- Compras: CONFIRMADA/ANULADA; cuatro series CANTIDAD/OPERACIONES e IMPORTE/IMPORTE_MONETARIO. Referencia de adquisición conservada en nota y rango del servidor, no registro/anulación. `ReporteComprasResumen` muestra `totalComprasRealizadas` solo confirmadas; distribución de importes de ambas categorías identificada como informativa, no total realizado.
- Pérdidas: VENCIMIENTO/DAÑO; seis series CANTIDAD_RETIROS/RETIROS, CANTIDAD_RETIRADA/UNIDADES_INVENTARIO_HETEROGENEAS y PERDIDA/IMPORTE_MONETARIO. Selector gráfico exclusivamente CANTIDAD_RETIROS/PERDIDA. Distribuciones y tabla alternativa incluyen las seis series y todos sus valores exactos, también categorías ocultas/excluidas y ceros. Nota explícita de cantidades heterogéneas sin equivalencia farmacéutica y pérdidas brutas históricas sin descontar reversiones. RN91 no se implementa en React: 0.02 proviene del JSON simulado; costos cero cuentan retiros, referencias null/reversión permanecen informativas en la consulta ordinaria.

**Exactitud, escala, paneles y accesibilidad:** conservados strings y orden del JSON, fechas civiles sin Date/UTC, null y resúmenes del servidor. No recálculo de importes/pérdidas/totales, porcentajes, moneda, promedios o nuevos indicadores. Resúmenes ordinarios conservan formateo decimal español exacto; tablas estadísticas/explorador conservan strings originales. SVG nativo, escalado geométrico BigInt a millonésimas y mismo aviso de bajo resolución; métricas/unidades nunca comparten eje. Ocultar no modifica totales ni tabla. `sinDatos` diferencia Sin operaciones de importe/pérdida cero (Sin valor para graficar), sin sectores ficticios.

Hasta 1200 intervalos sin muestreo, truncado ni autoajuste; 1201 conserva selección y orienta al usuario. Paneles de hasta 60 con selector, viewport desplazable y rangos/parciales visibles; no líneas entre extremos de paneles. Se recorrieron los 20 paneles: compras 4800 filas/2400 puntos y pérdidas 7200 filas/2400 puntos, además de ventas 9600/4800. Tabla completa accesible por panel, distribución del período independiente. Labels/legends, numeración, foco, Enter, toque y ancho 375 px comprobados mediante DOM/CDP; no sustituyen revisión manual con lector de pantalla.

**Estado/URL y coexistencia con TABULAR:** consulta inicial sin UI, selección estadística pendiente sin GET hasta período y granularidad explícitos aplicados. Misma URL validada `vista=ESTADISTICAS&uiGranularidad=DIA|MES|ANIO`; no se envía UI/página/límite a estadísticas. Buscar aplica borrador temporal/comercial conservando granularidad aplicada; Aplicar granularidad no aplica filtros borrador. Recarga/Atrás/Adelante restauran selección. Gráfica/métrica/categorías/panel y cambios de página/orden equivalente de URL no disparan estadísticas. Estados independientes, retry manual, 400/500/red no borran consulta ordinaria válida. 401/403 retiran ambos resultados y cambiar solo vista no levanta restricción. Cleanup existente aborta e invalida respuestas por filtros/granularidad/fuente/sesión/rol/salida/desmontaje, incluso promesas no cooperativas.

TABULAR sigue disponible exclusivamente desde Consulta, con las cuatro fuentes/tres formatos y criterios aplicados, sin granularidad/grafico/metrica/UI/paginación en HTTP. No hay control ni descarga ESTADISTICA; las pruebas heredadas de transporte de 21 combinaciones son regresión del Service de Fase 1, no implementación de Fase 5.

**Comandos y resultados focalizados:**

```text
node --test --test-concurrency=1 tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs tests/reportes-tabular.browser.test.mjs tests/reportes-ventas.browser.test.mjs tests/reportes-estadisticas.test.mjs tests/reportes-estadisticas-fuentes.test.mjs tests/reportes-estadisticas-ciclo.test.mjs tests/reportes-estadisticas.browser.test.mjs
189 aprobadas, 0 fallidas/canceladas/omitidas, incluyendo contenedoras/subtests.
pnpm build
Vite aprobado: 254 módulos; JS principal 351.24 kB (gzip 81.07 kB), vendor 362.77 kB (gzip 116.99 kB), CSS 80.44 kB (gzip 12.79 kB). Sin avisos de chunks grandes ni dependencia nueva.
git diff --check
Sin errores de espacios; solo avisos de futura normalización LF → CRLF, incluidos archivos ajenos.
git -c core.autocrlf=false diff --no-index --check -- NUL <archivo frontend sin seguimiento>
22 archivos frontend sin seguimiento comprobados individualmente, sin diagnósticos de espacios. Revisados contenido de archivos nuevos/extendidos de esta fase y diffs pertinentes; sin normalizar cambios ajenos.
```

La ejecución conserva 156 pruebas anteriores y añade 33 (5 unitarias/ciclo, 28 navegador incluyendo contenedoras). Sin suites globales. Iteraciones: primer bloque unitario 67/67 y navegador base ampliado 36/36. Tras reforzar comparación de resúmenes, conjunta 183/187: dos aserciones y sus contenedoras fallaron por esperar punto decimal crudo en resúmenes que ya usaban coma/separadores españoles. Corregidas únicamente expectativas del arnés (también costos a seis decimales), no la UI ni los datos; se añadieron dos pruebas de filtros propios. Resultado final 189/189 sin omisiones. Durante revisión se ordenó el import React al principio de PerdidasPage, sin efecto funcional. No se ocultaron fallos.

**Evidencia y límites:** estática, unitarias/transporte simulado y navegador React/Router/Axios reales con API siempre interceptada/rechazada. Build temporal del arnés sin proxy; procesos/perfiles propios retirados en finally. Sin backend/MySQL, fixtures persistidos, auditoría real, capturas, documentos generados/guardados, instalaciones, commits/push/despliegue. CORS/headers/fallback/perfil LOCAL conservan los límites de Fases 1–3: las pruebas simuladas no acreditan CORS real, disponibilidad LOCAL real ni producción. Siguen pendientes integración autorizada, revisión visual/manual/lector de pantalla, compatibilidad de otros navegadores/dispositivos y gates backend de RAM/disco/ACL/huérfanos/deadline SQL/hosting/documentos. Ninguna modificación de contratos normativos/CORS/proxy/base de datos/backend/rutas/sidebar.

**Cambios ajenos preservados:** estado inicial amplio con backend/documentación y frontend de Fases 1–3 modificado/sin seguimiento; conservado sin revertir ni atribuir a esta fase. Solo frontend pertinente y seguimiento en este documento afectados.

**Siguiente fase:** Fase 5 habilitada por aceptación simulada de Fases 2–4, **NO INICIADA**. Lectura mínima: este cierre, contratos §2/5–7, `ReporteFuenteEstadisticas`, control/hook TABULAR, serializadores y pruebas de transporte/combinaciones. Integrar exportación ESTADISTICA requiere otra solicitud; integración real y aceptación productiva siguen separadas.

### Fase 5 / 21-11-2026 / COMPLETADA — ESTADISTICA con API simulada

**Objetivo ejecutado y dependencias comprobadas:** exclusivamente exportaciones ESTADISTICA de ventas CU38, compras CU39 y pérdidas CU41. Fases 1–4 conservadas; no se inicia Fase 6. Leídos AGENTS raíz/frontend, definición de fase y cierres anteriores, guía normativa completa y secciones pertinentes de contexto §39, RF35–RF38, RN97–RN101 y CU38–CU41. Inspeccionadas todas las firmas solicitadas de componentes, hooks, Services, serializadores, transporte, activador y CSS, y arneses ampliacion/tabular/estadisticas. Sin discrepancia que requiera inspeccionar generadores o modificar backend.

**Skill frontend-design aplicada:** se conservan paleta/tipografía/tokens descritos en Fase 3, jerarquía del panel, controles `form-field`, botones secundarios, feedback y estilos responsive existentes. Se extiende el control de Fase 2 dentro del contexto estadístico, antes de resultados, sin desplazar consulta inicial ni reconstruir página/coordinador/sidebar. No se modifica CSS, rutas, navegación, iconos ni dependencias. Labels, foco visible, teclado, toque y 375 px ejercitados sin capturas; no revisión manual con lector de pantalla.

**Archivos y símbolos reales modificados (desde raíz):**

| Archivo | Cambio / reutilización |
|---|---|
| `frontend/src/features/reportes/components/ExportacionTabular.jsx` | Firma compatible `ExportacionTabular({ fuente, pendiente=false, restringida=false, onRestringida, presentacion='TABULAR', seleccion })`. Extiende el mismo control para ESTADISTICA; formato explícito sin selección inicial, notas/criterios y ciclo de descarga existentes. CSV construye solicitud sin selección gráfica; PDF/XLSX la comparten con la visualización. Clave de vigencia incluye presentación/formato/selección efectiva del archivo además de URL/navegación/sesión/restricción anteriores. Nombre histórico conservado para no renombrar consumidores CU40/páginas. |
| `frontend/src/features/reportes/utils/exportacionTabular.js` | Añade `prepararEstadistica(query, fuente, formato, seleccion)` → objeto textual validado para Service. Reutiliza lector ampliado, whitelist de selección y serializador estricto. URL completa validada antes de tomar filtrosAplicados/granularidad UI; rechaza CU40, vista incorrecta, campos repetidos/desconocidos, combinaciones incompatibles y >1200. `prepararTabular` intacto. |
| `frontend/src/features/reportes/components/ReporteFuenteEstadisticas.jsx` | Eleva únicamente selección gráfica/métrica al coordinador existente, con contexto fuente/filtros/granularidad aplicado; agrega control compartido ESTADISTICA y pasa selección/callback al gráfico. No copia coordinadores ni restaura `ReporteVentasEstadisticas`. |
| `frontend/src/features/reportes/components/ReporteEstadisticas.jsx` | Firma ampliada compatible `ReporteEstadisticas({ data, seleccion, onSeleccion })`; selección controlada desde coordinador y respaldo local para uso anterior. Categorías/panel/exploración permanecen locales, sin modificar datos/escala/tabla. |
| `frontend/tests/reportes-tabular.test.mjs` | Matriz de preparación estadística, las seis combinaciones gráfica/métrica por fuente en PDF/XLSX, CSV sin ellas, URL completa, cruces incompatibles y protección contra sobrescribir presentación/granularidad desde selección. Conserva pruebas TABULAR/recursos. |
| `frontend/tests/reportes-tabular-ciclo.test.mjs` | Reutiliza arnés de hooks/promesas no cooperativas; extiende contextos a granularidad aplicada/presentación/formato/gráfica y añade 401/403 tardíos que no restringen otra presentación/sesión. |
| `frontend/tests/reportes-tabular.browser.test.mjs` | Extiende el arnés CDP/API simulada existente con fixtures estadísticos previos; nueve escenarios adicionales, sin duplicar otro arnés. UI de 21 variantes, todas las selecciones gráficas compatibles, transiciones, vacíos, parámetros, errores/roles/recursos/teclado/toque/móvil. |
| `docs/ai/fases.md` | Estado, tabla y este cierre; registros históricos y cambios locales anteriores preservados. |

**Reutilización sin modificación:** `useExportacionTabular(clave, exportar, onRestringida, sesion)`, `useReporteConsulta`, `useReporteEstadisticas`, `consultaReporte` y sus serializadores/lector ampliado, los tres `exportarReporte*`, `recibirArchivo`, `activarDescarga`, Axios central, sesión pública/ROLES, resúmenes/tablas y `reportes.css`. Páginas, `ReporteOperacionesConsulta`, CU40 y sus Services no requieren cambios. Sin Context/caché/abstracción universal, paquete nuevo ni generadores documentales/imágenes en React.

**Rutas/endpoints y roles preservados:** `/reportes/ventas` y `/reportes/compras`, solo Administrador; `/reportes/perdidas` y `/inventario/movimientos`, Administrador/Regente. Vendedor y sesión ausente sin acceso. Mismos GET relativos `/reportes/{ventas|compras|perdidas}/exportar` y `/inventario/movimientos/exportar`, con cookies HttpOnly/withCredentials central; autorización definitiva backend. Los tres GET estadísticos existentes permanecen; nunca estadística CU40 ni endpoint nuevo/HEAD/polling/cola/retry automático.

**Matriz disponible y verificada con API simulada (21 variantes):**

| Fuente | Consulta → TABULAR | Estadísticas → ESTADISTICA | Métricas gráficas PDF/XLSX |
|---|---|---|---|
| Ventas CU38 | PDF / XLSX / CSV | PDF / XLSX / CSV | CANTIDAD / IMPORTE |
| Compras CU39 | PDF / XLSX / CSV | PDF / XLSX / CSV | CANTIDAD / IMPORTE |
| Pérdidas CU41 | PDF / XLSX / CSV | PDF / XLSX / CSV | CANTIDAD_RETIROS / PERDIDA |
| Historial CU40 | PDF / XLSX / CSV | No disponible | No aplica |

Son 18 variantes Reportes + 3 CU40, no 21 endpoints. PDF/XLSX ESTADISTICA admiten BARRAS/LINEAS/SECTORES y métrica compatible, además de granularidad aplicada. CSV ESTADISTICA exige presentación/formato/granularidad, prohíbe gráfico/métrica. TABULAR no envía granularidad/gráfico/métrica. Nunca página/límite/vista/uiGranularidad al exportar. CANTIDAD_RETIRADA permanece solo en datos/tabla/archivo completo, no selector gráfico.

**Decisiones UX/URL/selecciones y alcance del archivo:** la presentación se elige mediante la vista existente, no con otro selector que permita TABULAR en Estadísticas o viceversa. Entrada sigue Consulta. Formato debe seleccionarse en cada control montado; cambiar de vista desmonta el control anterior y elimina su solicitud/selecciones de exportación. PDF/XLSX comparten la selección visual sin duplicar controles. Se conserva y declara explícitamente la decisión UX previa barras/cantidad iniciales (CANTIDAD_RETIROS en pérdidas); no defaults HTTP en Services. La selección se asocia a fuente/criterios/granularidad aplicados, no a borradores o página; volver a un contexto puede recuperar su última selección legítima. Las opciones propias por fuente impiden métricas incompatibles.

Cambiar a CSV elimina gráfico/métrica del objeto a validar/enviar, no solo oculta controles; la selección visual independiente sigue disponible y puede reutilizarse al volver a PDF/XLSX. Cambiar representación/métrica durante una descarga gráfica invalida ese trabajo; en CSV no altera su solicitud, que carece de esos campos. Cambiar presentación, filtros, granularidad aplicada, navegación, sesión/rol/carga o desmontar aborta/invalida el contexto viejo. Editar borrador de filtros o granularidad no cambia criterios de descarga. Selección gráfica no consulta de nuevo JSON. URL desconocida/repetida/incompatible se rechaza íntegra, sin reparar silenciosamente ni perder claves antes de validarla.

Archivo estadístico siempre solicita todo el período aplicado con filtros propios; no envía categorías ocultas, panel visual ni JSON/tabla/SVG del cliente. Incluye todas las métricas/series/categorías/ceros según contrato del servidor. Aviso visible: CSV datos sin imagen; PDF/XLSX gráfica y tabla exacta completa, XLSX imagen no gráfico nativo editable. Cada descarga tiene snapshot propio, puede diferir de consulta previa. No se calculan RN91/importes/resúmenes/pérdidas; strings exactos (incluido 0.02), null, fechas civiles y cantidades heterogéneas siguen proviniendo del servidor. Las pruebas de UI verifican criterios y alcance solicitado, no contenido de un documento real generado.

**Transporte, errores, seguridad y recursos:** el mismo hook conserva estado separado de JSON, bloqueo síncrono de doble click, AbortController y vigencia incluso ante promesas no cooperativas. Cancelación/reintento exclusivamente manual; cancelar no garantiza detener SQL ni deshacer generación/auditoría ya terminadas. 401/403 retiran datos restringidos de ambas vistas mediante `restringir`; cambiar solo vista/formato no levanta restricción. Fallos independientes de exportación no borran consulta válida. 400 orienta filtros/granularidad/1200; 413 reduce filtros/cambia formato; tres 503 diferenciados, 500/red/transporte/Blob JSON sin archivo ni éxito falso.

Se reutilizan validaciones 200/Blob no vacío/MIME/longitud comparable y sobre JSON seguro, nombre servidor seguro si accesible y fallback honesto `cadefar-{fuente}-estadistica.{ext}`. Object URL solo tras respuesta válida y vigente, un anchor conectado/activado/retirado, revocación diferida 60 s incluso tras navegación; tests ejecutan callback de limpieza sin esperar ese plazo ni guardar archivos. Máximo mensaje «Archivo recibido; descarga iniciada», no guardado/apertura. Nota LOCAL, límite Blob 128 MiB y estadísticas ≤1200 intervalos/8 series/9600 filas visibles. Tiempos/limpieza/cuotas reales del servidor no se certifican con mocks.

**CORS/headers y disponibilidad:** Content-Disposition/Retry-After accesibles e inaccesibles simulados, fallback alternativo y ausencia de retry comprobados. No se modifica CORS/proxy ni se deduce LOCAL por hostname. Simular ocultación de headers XHR no acredita CORS real entre orígenes ni disponibilidad productiva. Cookies/sesión/roles son simulados, no revocación real de JWT. Ninguna promesa de detener SQL al abortar.

**Comandos, resultados y avisos (pruebas focalizadas de Fase 5, no ejecución de Fase 6):**

```text
node --test --test-concurrency=1 tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs tests/reportes-tabular.browser.test.mjs
Primera ejecución: 75 aprobadas, 0 fallidas/canceladas/omitidas.

node --test --test-concurrency=1 tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs tests/reportes-tabular.browser.test.mjs tests/reportes-ventas.browser.test.mjs tests/reportes-estadisticas.test.mjs tests/reportes-estadisticas-fuentes.test.mjs tests/reportes-estadisticas-ciclo.test.mjs tests/reportes-estadisticas.browser.test.mjs
Ejecución final: 200 aprobadas, 0 fallidas/canceladas/omitidas, incluyendo contenedoras/subtests.

pnpm build
Vite aprobado: 254 módulos. JS principal 352.97 kB (gzip 81.67 kB), vendor 362.77 kB (gzip 116.99 kB), CSS 80.44 kB (gzip 12.79 kB). Sin dependencias nuevas ni aviso de chunks grandes.

git diff --check
Sin errores de espacios; solo advertencias de normalización futura LF → CRLF, incluidas las de cambios ajenos.

git -c core.autocrlf=false diff --no-index --check -- NUL <archivo frontend sin seguimiento>
22 archivos frontend sin seguimiento comprobados individualmente, sin diagnósticos de espacios.
```

Se conservan las 189 pruebas anteriores y se añaden 11 (dos unitarias/ciclo y nueve escenarios navegador); las ampliaciones dentro de bucles no se cuentan como tests adicionales. Sin suites globales. No iteraciones fallidas en esta fase. Revisión estática reforzó whitelist gráfica para impedir sobrescribir granularidad/presentación desde selección; añadidas expectativas de rechazo, vacíos estadísticos de las tres fuentes/formatos y denegaciones tardías. Tras ajustar el label inicial del botón a «Exportar estadísticas», se repitieron el mismo comando focalizado (200/200) y build; cifras arriba corresponden al código final. Cobertura: matriz 21, transiciones CSV/PDF/XLSX y vistas, borrador/aplicado/página/URL/Atrás, seis selecciones gráficas por fuente, panel 20/categorías ocultas sin restricción del archivo, ceros/vacíos/0.02/DAÑO/heterogeneidad, errores y Blob JSON, headers/fallback, doble click/cancelación/tardías, limpieza, roles y 375 px/teclado/foco/toque. Regresiones estadísticas CU38/CU39/CU41 mantienen recorridos de 1200/1201, exactitud completa y consultas ordinarias/TABULAR intactos.

**Evidencia y acceso real:** estática + unitarias/transporte simulado + navegador React/Router/Axios reales con API interceptada/rechazada. Builds/perfiles temporales propios del arnés retirados en finally. Sin backend/MySQL, datos persistidos, auditoría real, documentos/imágenes generados ni archivos guardados, capturas, instalaciones, commit/push/despliegue. Build no equivale a integración LOCAL, CORS real ni aceptación productiva.

**Cambios ajenos preservados:** estado inicial amplio de backend/documentación/frontend de fases anteriores, incluidos archivos sin seguimiento, no revertido ni adjudicado a esta fase. Solo los siete archivos frontend indicados y este seguimiento modificados por Fase 5. Contrato normativo, backend, CORS/proxy, base de datos, rutas/sidebar y package/lock intactos.

**Limitaciones, omitidos y pendientes:** no comprobación de contenido/PNG de documentos reales desde esta UI ni revisión visual manual/lector de pantalla/otros navegadores/dispositivos, integración LOCAL autorizada ni CORS real. Gates heredados de RAM base/pico, reserva de disco, ACL Windows, huérfanos, deadline SQL duro, hosting y aceptación backend siguen pendientes. Sin escenarios focalizados fallidos u omitidos; los límites reales no ejercidos se conservan explícitos.

**Siguiente fase habilitada:** Fase 6, **NO INICIADA**; Fase 7 tampoco iniciada y requiere autorización propia de entorno real. Lectura mínima: este cierre, definición Fase 6, guía §2/4–7, composición/selección compartida y arneses ampliacion/tabular/estadisticas actuales. No se continúa automáticamente.

### Fase 6 / 21-11-2026 / COMPLETADA — regresión conjunta frontend simulada

**Objetivo ejecutado y dependencias comprobadas:** regresión conjunta de Consulta, estadísticas/gráficas CU38/CU39/CU41 y 21 variantes de exportación (18 Reportes + 3 TABULAR CU40). Leídos AGENTS raíz/frontend, definición de Fase 6 y cierres 1–5, guía normativa completa y secciones relacionadas de contexto §39, RF35–RF38, RN91/RN97–RN101 y CU38–CU41. Comprobado `git status --short` antes de intervenir; preservado el trabajo previo. Exclusivamente Fase 6, sin comenzar Fase 7.

**Skill frontend-design:** no aplica en esta fase: no se adapta UI ni se modifica código funcional/CSS. Diseño, estructura, jerarquía, rutas y sidebar permanecen intactos.

**Archivos y símbolos reales modificados (desde raíz):**

| Archivo | Cambio / reutilización |
|---|---|
| `frontend/tests/reportes-tabular.browser.test.mjs` | Extiende el mismo arnés CDP existente, sin otro motor/arnés. Añade cuatro escenarios conjuntos: JSON/archivo simultáneos, denegación JSON durante descarga, URL completa inválida en las tres fuentes y login/logout simulados. `plannedJson`/`heldJson` controlan únicamente las respuestas JSON del mock; `loginRol` devuelve usuario público ficticio sin JWT/cookie fabricados ni registro de credenciales. Reutiliza `archivo`, `fulfill`, `entregarTardia`, `field`, fixtures y observación de anchors/object URLs. |
| `docs/ai/fases.md` | Estado, tabla y este cierre; se conservan íntegros los cierres históricos y la planificación de Fase 7. |

**Reutilización comprobada, sin modificación:** `ReporteFuenteEstadisticas({ tipo, activa, aplicada, restringida, onRestringida, onAplicar })`, `ExportacionTabular({ fuente, pendiente, restringida, onRestringida, presentacion, seleccion })`, `ReporteEstadisticas({ data, seleccion, onSeleccion })`; `useExportacionTabular`, `useReporteConsulta`, `useReporteEstadisticas`, serializadores/preparadores, Services, `recibirArchivo` en descargaBinaria y `activarDescarga`. No se reconstruye ReporteVentasEstadisticas ni se copian coordinadores. Reutilizados todos los arneses focalizados ampliacion/tabular/estadisticas y reportes-ventas; se incluye además reportes-navegacion. Sin dependencias nuevas ni cambios de package/lock.

**Rutas, endpoints y roles:** preservadas `/reportes/ventas`, `/reportes/compras`, `/reportes/perdidas`, `/inventario/movimientos`. Administrador: CU38/CU39; Administrador/Regente: CU40/CU41. Regente no obtiene reportes de ventas/compras; Vendedor/sesión ausente sin acceso. Los mismos GET de consulta, tres `/estadisticas`, tres `/exportar` de Reportes y `/inventario/movimientos/exportar`, siempre simulados; CU40 exclusivamente TABULAR. Login/logout POST simulados a través del formulario/acciones existentes, restauración `/auth/me` simulada. No HEAD/polling ni backend real; cookies HttpOnly/withCredentials central sin cambios.

**Consulta dinámica / estadística / exportación verificadas:**

| Cobertura | Evidencia focalizada final |
|---|---|
| Entrada, filtros y navegación | Consulta inicial; Buscar/Actualizar/Limpiar, borrador/aplicado, página/límite, recarga y Atrás/Adelante. URL completa estricta sin ignorar desconocidos/repetidos/vacíos/arrays/campos UI incompatibles ni reparar la URL. Nueva matriz conjunta inválida comprueba cero GET de Reportes/descargas y cero URLs de objetos. |
| Estadísticas y exactitud | Tres fuentes, métricas compatibles y CANTIDAD_RETIRADA solo datos; strings enormes, null, fechas civiles bajo tres husos en consulta, ceros frente a sinDatos, 0.02, DAÑO y unidades heterogéneas. Sin recálculo RN91/totales. Sin GET estadístico por paginación/representación/categorías/orden equivalente de URL. |
| 1200 / 1201 | Recorrido completo de 20 paneles por fuente: ventas 9600 filas/4800 puntos, compras 4800/2400 y pérdidas 7200/2400; último intervalo accesible con teclado. 1201 rechazado conservando selección, sin autoajuste/muestreo. |
| 21 variantes | Services y UI: TABULAR PDF/XLSX/CSV × cuatro fuentes; ESTADISTICA PDF/XLSX/CSV × tres. Parámetros exactos, sin página/límite/UI; CSV estadístico sin gráfico/métrica; PDF/XLSX con gráfico/métrica compatibles y granularidad aplicada. Transiciones sin campos incompatibles ocultos; panel/categorías ocultas no reducen el alcance solicitado. |
| Independencia reforzada | En cada fuente y con éxito/error 500 JSON: archivo termina mientras JSON sigue retenido; el resultado JSON posterior no borra éxito de descarga. En orden inverso, refrescar JSON a sinDatos no cancela el archivo pendiente ni altera su solicitud. Son snapshots simulados independientes, no comparación de contenido documental real. |
| Errores y denegaciones | Vacíos 200 válidos con bytes; Blob JSON incluso 200, 400/401/403/413/tres 503/500/red/MIME/transporte/longitud inválidos. 401/403 de JSON durante archivo pendiente retiran datos e invalidan entrega; cambiar solo vista/formato no desbloquea. Fallos exclusivos de archivo conservan consulta independiente. |
| Concurrencia y recursos | Doble click, cancelación, reintento manual, cambios de filtros/granularidad aplicada/presentación/formato/gráfica/navegación, sesión/rol y desmontaje. Promesas que ignoran AbortSignal en pruebas de hooks; rechazos 401/403 viejos no restringen contexto nuevo. Cero activación obsoleta, anchors retirados y revocación diferida segura. Logout SPA con archivo pendiente lo invalida antes de entregar respuesta tardía. |
| Accesibilidad y responsive | Labels/legends, teclado, foco visible, toque CDP, tablas/viewport desplazables y ancho 375 px/escritorio. Regresión de selección única del sidebar y CU40 desde ambos paquetes sin modificar navegación. No revisión manual con lector de pantalla. |

**Decisiones locales y garantías conservadas:** no nuevas decisiones de UX/URL/gráficas. Estado de archivo separado de JSON, snapshot propio por petición, notas LOCAL/recursos y alcance completo del archivo. Solo geometría aproximada; datos exactos del servidor. No generación documental/imágenes desde React. Mensaje máximo «Archivo recibido; descarga iniciada», sin prometer guardado/apertura. Cancelar no garantiza detener SQL ni deshacer generación/auditoría ya terminadas.

**Comandos, resultados y avisos (desde frontend):**

```text
node --test --test-concurrency=1 tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs tests/reportes-tabular.browser.test.mjs tests/reportes-ventas.browser.test.mjs tests/reportes-estadisticas.test.mjs tests/reportes-estadisticas-fuentes.test.mjs tests/reportes-estadisticas-ciclo.test.mjs tests/reportes-estadisticas.browser.test.mjs tests/reportes-navegacion.test.mjs
Base antes de ampliar el arnés: 201 aprobadas, 0 fallidas/canceladas/omitidas.
Final tras ampliación: 205 aprobadas, 0 fallidas/canceladas/omitidas.

node --test --test-concurrency=1 tests/reportes-tabular.browser.test.mjs
Primera extensión: 21 aprobadas, 2 fallidas (escenario de login y contenedora).
Tras ajustar el recorrido del arnés: 23 aprobadas, 0 fallidas/canceladas/omitidas.

pnpm build
Vite 8.3.0 aprobado: 254 módulos. JS principal 352.97 kB (gzip 81.67 kB),
vendor 362.77 kB (gzip 116.99 kB), CSS 80.44 kB (gzip 12.79 kB).
Sin dependencia nueva ni aviso de chunks grandes; imágenes existentes de 819.92 y 1074.66 kB.

git diff --check
Sin errores de espacios; advertencias de futura normalización LF → CRLF,
incluidos archivos ajenos, sin normalizarlos.

git ls-files --others --exclude-standard -- .
git -c core.autocrlf=false diff --no-index --check -- NUL <cada archivo listado>
22 archivos frontend sin seguimiento comprobados individualmente: 11 src,
2 fixtures y 9 pruebas. Sin diagnósticos de espacios; exit 1 normal de no-index
por diferencias con NUL no se interpreta como error (sí diagnósticos o exit >1).
```

Conteos incluyen contenedoras/subtests; no sumar iteraciones. Ejecución final: **86 unitarias/ciclo/transporte simulado + 119 de navegador con API simulada = 205**. Se conservan las 200 de Fase 5, se ejecuta una prueba existente de navegación y se añaden cuatro escenarios navegador (sus bucles no cuentan como tests adicionales). Los arneses de navegador se ejecutaron secuencialmente mediante `--test-concurrency=1`; sin suites globales ni ejecución del arnés real.

**Fallo encontrado y corrección:** la primera extensión del escenario login agotó la espera al asumir que el acceso directo previo al login devolvería inmediatamente al panel de pérdidas. No se modificaron autenticación ni rutas para hacerlo pasar. Se hizo explícito el recorrido verificado `/login` → dashboard → enlace existente de pérdidas → aplicación de período/granularidad, conservando las pruebas independientes de rutas directas por rol. El retorno exacto de enlace profundo/query después del login no queda acreditado por ese escenario; revisión manual pendiente. El escenario corregido conserva login de tres roles, logout, descarga pendiente y almacenamiento vacío; no se eliminó el escenario. Ningún defecto demostrado dentro de Consulta/Estadísticas/descargas requirió corrección funcional.

**Evidencia diferenciada:**

- **Estática:** firmas/composición/Services/serializadores/transporte/ciclo de recursos y guardas inspeccionados; estado Git, build y espacios comprobados, incluidos los 22 archivos frontend sin seguimiento. Contratos normativos intactos.
- **Unitarias/ciclo/transporte simulado:** 86; incluye simulación de hooks con promesas no cooperativas y adapter Axios, no React renderizado ni SQL/cookie reales.
- **Navegador/API simulada:** 119; React/Router/Axios reales y Chrome headless con CDP. API interceptada/rechazada; servidor del arnés solo sirve build temporal sin proxy. Anchors observados sin guardado, temporizador de revocación ejecutado por el arnés sin esperar 60 s. Procesos/perfiles/builds temporales propios retirados en finally.
- **Integración LOCAL real:** **NO EJECUTADA, NO AUTORIZADA en esta fase**. Sin backend/MySQL, fixtures persistidos, auditoría real, documentos/PNG reales generados/abiertos, capturas ni certificación de contenido binario real. Sin subagentes, instalaciones, commits, push o despliegue.

**CORS/headers, LOCAL y límites:** probados headers accesibles e inaccesibles simulados en adapter/XHR, nombres seguros/hostiles, fallback alternativo honesto y Retry-After solo cuando legible; sin retry automático. Esto no prueba CORS real ni disponibilidad del perfil LOCAL/productivo. Se mantienen las notas sobre 128 MiB de Blob, límites documentados y tiempo/cancelación del servidor sin prometer recursos ilimitados. Sin cambios CORS/proxy/backend ni inferencia de disponibilidad por hostname.

**Cambios ajenos preservados:** todo el estado inicial de backend/documentación/frontend, incluidos archivos sin seguimiento, sigue presente. Solo se editan en esta fase el arnés existente indicado y este documento. No cambios de código funcional, contratos normativos, backend, base de datos, rutas, sidebar, estilos ni dependencias.

**Limitaciones, omitidos y pendientes:** sin fallos/cancelaciones/omisiones en la ejecución focalizada final. Siguen pendientes integración LOCAL autorizada y CORS real; revisión visual manual de UI/documentos/PNG/XLSX, lectores de pantalla, otros navegadores/dispositivos y retorno postlogin de enlaces profundos indicado arriba. Los bytes sintéticos solo prueban transporte/activación, no estructura documental. Permanecen gates backend de RAM base/pico, reserva de disco, ACL Windows, propiedad/recuperación de huérfanos, deadline SQL duro, hosting/proxy y aceptación backend conjunta. Build/simulación no acreditan aceptación productiva ni resuelven esos gates.

**Siguiente fase habilitada:** Fase 7 por regresión simulada aprobada, **NO INICIADA**. Requiere autorización **nueva y explícita** del destino LOCAL aislado y del alcance de login, consultas, fixtures, auditoría y limpieza; no reutilizar permisos históricos. Lectura mínima: este cierre, definición de Fase 7, guía normativa §1/6/7/9 y arnés real como referencia, sin ejecutarlo hasta contar con autorización.

### Fase 7 / 21-11-2026 / PARCIAL — integración LOCAL autorizada y cierre

**Objetivo ejecutado y dependencias comprobadas:** consumo real desde las páginas existentes de CU38/CU39/CU41 y CU40, con React/Router/Axios, Express, cookie HttpOnly y MySQL 8.0.46. Leídos AGENTS raíz/frontend/backend, definición de Fase 7 y cierres 1–6, guía normativa intacta y contexto §39, RF35–RF38, RN91/RN97–RN101, CU38–CU41. Inspeccionados previamente arnés real, helper MySQL, navegador, firmas de coordinador/controles/selección, Services/serializadores y transporte/activador. Sin reconstruir componentes ni alterar UI o funcionalidad.

**Autorización propia y destino:** el prompt inicial no autorizaba conexiones. Tras presentar guardas, destino y operaciones, el usuario respondió expresamente «si» a backend/MySQL `127.0.0.1:3306`, base nueva aleatoria `cadefar_reportes_f6_<16hex>`, migraciones existentes, fixtures sintéticos, login/consultas/descargas/auditoría, cambios sintéticos para snapshots y limpieza propia. No se reutilizó autorización histórica. El opt-in `REPORTES_MYSQL_ACCEPTANCE` se suministró desde el comando, antes de cargar configuración. Se conservaron rechazo de destinos remotos/producción, CREATE sin IF NOT EXISTS, fijación de modelo/host/base y DROP solo de la base creada. Sin consultas a tablas de bases operativas.

El primer intento no conectó: `MySQL80` detenido. `Start-Service -Name MySQL80 -ErrorAction Stop` fue denegado por Windows; no se elevó el proceso. El usuario eligió iniciar el servicio manualmente; se comprobó Running antes de reintentar. El servicio queda iniciado por el usuario: **no se detuvo ni se limpió como recurso propio**.

**Skill frontend-design:** no aplica; solo pruebas y este registro. No adaptación de UI, CSS, diseño, estructura, jerarquía, rutas ni sidebar. Sin dependencias nuevas, instalaciones, capturas, subagentes, commits, push o despliegue.

**Archivos y símbolos reales modificados (desde raíz):**

| Archivo | Cambio / reutilización |
|---|---|
| `frontend/tests/reportes-real.browser.test.mjs` | Extiende el arnés existente, no otro arnés. Conserva fixtures/base/roles/consultas previos y añade segundo producto con unidad distinta, estadísticas reales, helper local `estadistica`, `exportar` e instrumentación de XHR/activación. Whitelist del servidor **de prueba** añade los endpoints actuales; no cambia routers de aplicación. Lectores ya instalados ExcelJS/PDF.js, sin generación en React. Guardas comprueban que la instancia Sequelize sigue en la base aislada antes de usar el perfil development LOCAL. |
| `frontend/tests/helpers/navegadorReal.mjs` | Añade opción opt-in `captureReports=false`, query/entries para detectar repetidos, cabeceras binarias seleccionadas sin cookies y captura en memoria de respuesta binaria; `initScript(source)` para instrumentación del test. Comportamiento anterior por defecto conservado para otros consumidores. |
| `docs/ai/fases.md` | Estado/tabla y este cierre; historia previa conservada, no reescrita como nueva evidencia. |

**Reutilización y perfil:** `ReporteFuenteEstadisticas` sigue coordinando las tres fuentes; `ExportacionTabular` soporta ambas presentaciones y `ReporteEstadisticas` comparte seleccion/onSeleccion. Hooks, serializadores, Services, api.js/withCredentials, descargaBinaria y activarDescarga intactos. El helper backend existente migra e importa el modelo bajo test; después el arnés cambia únicamente NODE_ENV del proceso a development, conservando/verificando la misma instancia/base aleatoria. No se cambia el gate ni el preflight del servidor; producción/test siguen no disponibles. TEMP/TMP del proceso se circunscriben a un directorio propio bajo `C:\Users\jesus\AppData\Local\Temp\opencode`, fuera del repositorio. Frontend y Express en puertos efímeros **distintos**, ambos loopback; sin proxy ni mocks de API/SQL/renderizador/cupo.

**Rutas y permisos preservados:** `/reportes/ventas`, `/reportes/compras`, `/reportes/perdidas` y `/inventario/movimientos`. Administrador CU38/CU39; Administrador/Regente CU41/CU40; Vendedor sin paquete/acceso directo. Regente rechazado en reportes de ventas/compras aunque tenga permisos operativos en Compras. Comprobados 401/403 reales de estadísticas/exportaciones y consultas. CU40 no ofrece estadísticas; solicitud directa ESTADISTICA rechazada 400. Siete rutas nuevas existentes, sin HEAD, polling o nuevas rutas.

**Cobertura LOCAL efectiva (no simulada):**

| Recorrido | Ejecutado / límites |
|---|---|
| Login y consulta dinámica | Tres roles por formulario, cookie HttpOnly/SameSite Lax, `/auth/me` tras recarga, almacenamiento JWT vacío. Tres modalidades día/mes/período, filtros propios, paginación/página lejana, vacío y ceros, resúmenes y celdas contra JSON real; fichas/CU40 y Atrás. Fechas civiles bajo America/La_Paz, Honolulu y Tokio; null y costos seis decimales. |
| Estadísticas | Tres fuentes desde las páginas, DIA/MES/ANIO, filtros ANULADA/DAÑO, categorías excluidas/cero, parcial/null/sinDatos vs importe cero. Comparación textual de tabla del primer panel contra series/intervalos recibidos; 8/4/6 series. Pérdida 0.02 por dos movimientos a 0.005000, costo cero, reversión informativa fuera del período y cantidades de tableta/frasco sin equivalencia. No RN91 en React. |
| 1200/1201 | Compras: JSON real con 1200 intervalos; primer panel, selector al panel 20 y sus 240 filas, último intervalo/valor exacto comprobados. 1201 rechazado por API real de compras; límite también rechazado en ventas. No recorrido real de todos los paneles de las tres fuentes: ese recorrido completo sigue siendo evidencia simulada de Fase 6. |
| Matriz 21 | Ventas/compras Administrador: TABULAR y ESTADISTICA × CSV/XLSX/PDF; pérdidas Regente: mismas seis; CU40 Regente: tres TABULAR. Estadística documental acotada DIA/BARRAS/CANTIDAD (CANTIDAD_RETIROS en pérdidas), no todas las gráficas/métricas. Administrador adicionalmente descarga pérdidas filtradas y CU40 filtrado. |
| Criterios/archivos | Reportes TABULAR desde página 100/límite 1 descargan contenido aunque detalle visible vacío. Query exacta sin repetidos/página/límite/UI; borrador de día no se exporta. DAÑO codificado, CU40 con desde abierto/idExistencia/dirección sin período obligatorio y sin observacion en CSV. Vacío ventas devuelve plantilla CSV 200. MIME, tamaño Blob vs Content-Length, no-store/nosniff, firma/nombre servidor seguro observado en red, fallback usado en UI, una petición/activación ante doble click y anchor retirado. |
| Lectura documental automatizada | CSV BOM/CRLF/separadores y valores seleccionados; XLSX reabierto con hojas esperadas y texto exacto seleccionado (importes/costo/0.02), imágenes en hoja Grafica; PDF reabierto por PDF.js, texto CADEFAR/0.02 e imágenes incrustadas en estadísticos. No comparación exhaustiva de cada celda/documento ni revisión visual, OCR, apertura Excel o render manual. |
| CORS real | Puertos distintos, cookies y Axios reales. Cabeceras de red contienen Content-Disposition; JavaScript XHR recibe null, usa nombre alternativo anunciado. Content-Type/Length sí legibles. Ocupado real entrega Retry-After 5 observable en red pero null para XHR. No exposedHeaders/CORS/proxy alterados. Lectura de filename servidor en mismo origen mantiene solo evidencia simulada/estática, no otra topología real. |
| Ocupado y cancelación | Generación XLSX ventas de 61 intervalos, otra sesión solicita CSV CU40: 503 ocupado real, sin cola/retry ni URL de objeto. Cancelar la primera solicitud desde UI produce cero activaciones/URLs y terminal FALLO/CANCELACION_CLIENTE persistido. Sin retener SQL, sustituir cupo ni fabricar respuesta. No garantía de parar SQL inmediatamente ni deshacer generación/auditoría. |
| No disponible / errores | NODE_ENV=test controlado sobre la misma instancia aislada: 503 Formato no disponible real, sin archivo ni pérdida de resultado dinámico. 400 parámetros incompatibles y límite, 401/403 reales. No se provocaron 413, 500, timeout, disco lleno, truncado o fallo tardío de transporte reales; su evidencia sigue simulada. |
| Snapshots independientes | Tras JSON ventas, dos UPDATE sintéticos autorizados cambian/restauran una cabecera: CSV posterior ve valor nuevo, resumen React conserva valor anterior. No nuevo cálculo del cliente ni promesa de igualdad entre peticiones. Es COMMIT **entre** peticiones; no prueba escritura concurrente dentro de la transacción RR ni todos sus interleavings. |
| Auditoría / negocio | Eventos EXPORTAR con correlación terminal única (conteo en toda Bitácora), EXITO con FINALIZADA_SERVIDOR, antes/después null y metadatos sin contenido de reportes; cancelación real persistida. Snapshot de todas las tablas de negocio idéntico al inicial tras restaurar fixture. Los dos UPDATE propios usan logging:false por operación y se declaran aparte; el registro SQL de HTTP permanece activo y sus escrituras son solo INSERT de auditoría. |

Cada archivo mantiene snapshot propio/estado separado de JSON, nota LOCAL y límites. Activador real reutilizado: el test observa y detiene el click de anchor para no guardar archivos; **no acredita guardado/apertura del usuario**. Para comprobar bytes CSV con BOM, el test lee exclusivamente el último Blob pequeño vía arrayBuffer; esa copia es instrumentación de pruebas, no cambio ni promesa de memoria para el producto. No se persistieron contenidos/cookies/JWT/credenciales en logs o documentos. No se crearon PDF/XLSX/PNG en React; los generó únicamente backend dentro de sus temporales.

**Comandos y resultados (desde frontend, arneses navegador siempre secuenciales):**

```text
$env:REPORTES_MYSQL_ACCEPTANCE='CREAR_MIGRAR_FIXTURES_ELIMINAR_LOCAL'; node --test --test-concurrency=1 tests/reportes-real.browser.test.mjs
Ejecución final: 23 aprobadas, 0 fallidas/canceladas/omitidas.
22 subtests + contenedora; uno caracteriza el defecto postlogin, NO acredita retorno correcto.
MySQL 8.0.46, 17 tablas InnoDB tras migraciones existentes, REPEATABLE-READ.
278 peticiones API observadas; 178 INSERT de auditoría registrados; snapshot de negocio idéntico.
25 descargas pequeñas válidas (21 matriz + 3 filtros/vacío + 1 snapshot),
además de cancelación/rechazos; ninguna guardada/abierta por el test.

node --test --test-concurrency=1 tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-ampliacion-services.test.mjs tests/reportes-tabular.browser.test.mjs tests/reportes-ventas.browser.test.mjs tests/reportes-estadisticas.test.mjs tests/reportes-estadisticas-fuentes.test.mjs tests/reportes-estadisticas-ciclo.test.mjs tests/reportes-estadisticas.browser.test.mjs tests/reportes-navegacion.test.mjs
205 aprobadas: 86 unitarias/ciclo/transporte simulado y 119 navegador/API simulada.

pnpm build
Vite 8.3.0: 254 módulos; JS 352.97 kB (gzip 81.67), vendor 362.77 kB
(gzip 116.99), CSS 80.44 kB (gzip 12.79). Sin dependencias nuevas ni aviso de chunks grandes.

git diff --check
git ls-files --others --exclude-standard -- .
git -c core.autocrlf=false diff --no-index --check -- NUL <cada archivo frontend listado>
Sin errores de espacios; solo advertencias LF → CRLF, incluidos cambios ajenos.
22 archivos frontend sin seguimiento comprobados individualmente: 11 src,
2 fixtures y 9 pruebas; sin diagnósticos, aceptando exit 1 normal de no-index.
```

**Iteraciones/fallos y correcciones del arnés:** primer intento de conexión fallido sin base creada por servicio detenido. Primera ejecución con motor: 13 aprobadas/7 fallidas contando contenedora; CDP quitó BOM al decodificar CSV (diferencia de tres bytes), y se esperaba raíz temporal vacía aunque Chrome la usaba. Corregido leyendo Blob real y comprobando específicamente ausencia de directorios de exportación, sin tocar transporte/backend. Siguiente ejecución 20/20. Al ampliar ocupado/cancelación, una espera sin límite dependía de req.url ya modificado por Express: 15 aprobadas/6 fallidas/2 canceladas por timeout padre; se corrigió a originalUrl y espera acotada, no se omitió el escenario. Ausencia de esa base verificada adicionalmente por nombre exacto. Ejecución ampliada 23/23; tras reforzar no repetidos, última fila de 1200, terminal de cancelación y conteo por correlación, **final 23/23**. No sumar iteraciones como cobertura adicional.

PDF.js advierte falta de @napi-rs/canvas/DOMMatrix/Path2D: lectura de texto/operadores aprobada, **no rasterización ni revisión visual**. No se instaló canvas para ocultar el aviso. Los AppError esperados 400/401/403/503 aparecen sanitizados en consola del servidor; no se copian secretos ni contenidos.

**Fallo funcional confirmado / motivo del estado PARCIAL:** un contexto sin sesión entra a `/reportes/perdidas` con período/vista/granularidad en query y hace login real. La query queda vacía. Inspección: ProtectedRoute conserva location en state, pero `LoginForm` solo toma `from.pathname`; `LoginPage` además redirige al dashboard al autenticarse. El test caracteriza la pérdida y admite los destinos actuales pérdidas/dashboard, **no lo cuenta como aceptación del retorno exacto**. No se corrigieron autenticación ni rutas fuera del módulo de reportes. Requiere alcance posterior explícito para corrección y regresión del login completo; no se inicia automáticamente.

**Limpieza y acceso real:** cinco bases nuevas creadas en las iteraciones con motor y eliminadas: `cadefar_reportes_f6_1421ea89e1673a89`, `cadefar_reportes_f6_b9e5fc5505b19802`, `cadefar_reportes_f6_f5db289ea36d935d`, `cadefar_reportes_f6_f6843ba258cc2ec4`, `cadefar_reportes_f6_89399727c75d767a`. Helper verifica ausencia tras DROP; en la ejecución agotada se comprobó adicionalmente ausencia por nombre exacto. Limpieza de directorios de exportación tras éxito/cancelación, cierre de Chrome/servidores/conexión y retiro de perfiles/builds/temporales propios. No limpieza de recursos vecinos/preexistentes ni del servicio iniciado manualmente. Sin DB operativa, producción o despliegue.

Comprobación final adicional autorizada: consulta parametrizada de `information_schema.SCHEMATA` restringida a esos cinco nombres propios, cero coincidencias; conexión cerrada. Listado de directorios `cadefar-reportes-real-*` bajo el temporal autorizado sin resultados, sin borrado adicional. Regresiones 205/205 y build repetidos tras la última modificación del arnés; resultados anteriores corresponden al estado final, no a una versión intermedia.

**Evidencia diferenciada y omisiones:** estática (firmas/guardas/código/contrato), 86 unitarias/ciclo/transporte simulado, 119 navegador/API simulada y **23 comprobaciones LOCAL reales** son categorías distintas. Los tests de caracterización no convierten defectos conocidos en criterios cumplidos. No revisión visual documental/UI/lector de pantalla ni otros navegadores/dispositivos; PDF/XLSX multibloque voluminosos, todos los gráficos/métricas/filtros en archivos reales, extremos fuera del esquema, fracciones DATETIME(0), 413/500/red/truncado/timeout/auditor caído y fallos tardíos no se acreditan aquí. No prueba de rendimiento/volumen ni de consistencia entre archivos independientes.

Persisten gates de **RAM base/pico, reserva de disco, ACL privada Windows, propiedad/recuperación de huérfanos, deadline SQL duro, hosting/proxy, revisión visual PDF/PNG/XLSX y aceptación backend conjunta**. El preflight LOCAL instantáneo no resuelve esos gates. Cancelar no garantiza parar SQL ni revertir auditoría; recibir bytes no promete guardado/apertura. **No producción lista.**

**Cambios ajenos preservados y continuación:** todo el estado inicial amplio de backend/documentación/frontend, incluidos 22 archivos frontend sin seguimiento, se conserva sin revertir ni atribuir a esta fase. Solo los dos archivos de pruebas indicados y este registro se modifican; backend, guía normativa, contratos, CORS, proxy, rutas, sidebar, componentes, estilos y dependencias intactos. No existe Fase 8 en este plan; no se inicia ampliación adicional. Cualquier corrección del postlogin, nueva integración o resolución de gates requiere su alcance/autorización correspondiente.
