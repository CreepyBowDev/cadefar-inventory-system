# CADEFAR — Desarrollo frontend de Reportes y Pérdidas

## 1. Estado inicial

**Plan frontend preparado el 19/11/2026. Fases 1–5 COMPLETADAS (frontend/API simulada); Fase 6 COMPLETADA el 20/11/2026 en el alcance de aceptación integrada frontend local expresamente autorizado, con límites de §6.7 vigentes. No implica aceptación total backend ni habilitación operativa.**

Este documento reemplaza por solicitud del usuario el plan backend anterior. Su redacción no implementa interfaces ni acredita pruebas funcionales. Es el punto de planificación y seguimiento de sesiones independientes del frontend.

Backend: CU38/CU39/CU41 implementados y montados. Su aceptación conjunta MySQL es **parcial**, no total; las dependencias se conservan en §6.7. CU40 ya tiene backend y frontend funcionales y se reutiliza.

## 2. Objetivo y alcance

Integrar consultas con filtros temporales explícitos, resúmenes completos, tablas, paginación y navegación coherentes con CADEFAR, sin modificar contratos ni cálculos backend.

| Caso | Funcionalidad | Acceso | Trabajo frontend |
|---|---|---|---|
| CU38 / RF35 | Reporte de ventas | Administrador | Nueva consulta visual |
| CU39 / RF36 | Reporte de compras | Administrador | Nueva consulta visual |
| CU40 / RF37 | Historial de inventario | Administrador y Regente | Acceso a la página existente; ninguna duplicación |
| CU41 / RF38 | Consulta de pérdidas | Administrador y Regente | Nueva consulta visual de retiros brutos |

Vendedor no visualiza el paquete ni accede a sus rutas. El permiso de consultar compras operativas del Regente no habilita CU39.

Fuera de alcance: PDF, Excel, impresión, gráficos, ganancias/márgenes, impuestos, contabilidad, programación automática, indicadores nuevos, endpoints nuevos, cambios de backend/DB, operaciones de negocio, rediseño, dashboard nuevo y reescritura del sidebar. No retomar `transacciones.md` ni el análisis académico en estas fases.

## 3. Reglas de diseño y uso de frontend-design

**Obligatorio cargar y utilizar la skill `frontend-design` en cada fase que construya o adapte páginas/componentes visuales. NO autoriza rediseñar CADEFAR.** Se aplica a consistencia, jerarquía, legibilidad, filtros, resúmenes, tablas, accesibilidad, responsive y estados, reutilizando la identidad aprobada. Si la skill no está disponible, indicarlo antes de desarrollar UI, no afirmar que se utilizó.

- Conservar paleta, tipografía, iconografía, dimensiones, distribución, espaciados, bordes, sombras, tarjetas, encabezados, botones, formularios, tablas, carga, errores y paginación actuales. No introducir un tema, biblioteca visual, fuente o sistema de tokens nuevo.
- Patrón de referencia principal: `VentasPage`/`BitacoraPage`; mantener `catalogo-page`, `page-heading`, `catalogo-panel`, filtros, toolbar/Actualizar, notas, resultados y paginación. Insertar el resumen del servidor dentro del mismo panel antes de la tabla, usando la presentación de datos existente, sin convertirlo en un dashboard nuevo.
- Fundamentos existentes: `frontend/src/styles/app-foundations.css` (Segoe UI Variable/Aptos/Segoe UI, superficies y escala), `catalogo.css`, `pagination.css`, `app-shell.css`. Reutilizar sus variables/clases, no copiar sus valores a otro tema. CSS específico solo si hace falta y acotado a la feature.
- Números alineados a la derecha y legibles; nombres largos sin desbordar el viewport. Tablas desplazables horizontalmente como las actuales, con región enfocables/etiquetadas, caption y `scope` en encabezados.
- Controles con labels, fieldsets/legends cuando corresponda, foco visible, botones de teclado y mensajes accesibles. Mantener `aria-busy`/`role=status`/`aria-live` conforme a los precedentes; evitar anuncios repetitivos y animaciones nuevas.
- Validar escritorio y móvil de 375 px, sin cambiar el layout principal ni generar capturas o vistas previas como entrega. No abrir navegadores en la preparación documental actual.

## 4. Punto de partida y componentes reutilizables

Rutas de archivos relativas a la raíz del repositorio. Verificadas al preparar el plan; cada sesión comprobará cambios locales sin volver a investigar todo el proyecto.

| Archivo / elemento real | Uso y límite |
|---|---|
| `frontend/src/app/router.jsx` | `ProtectedRoute`, `RoleRoute`, `MainLayout`; todavía no hay rutas de reportes. CU40 ya está en `/inventario/movimientos` |
| `frontend/src/constants/navigation.js` | `NAVIGATION_ITEMS`, `getNavigationForRole`, `getActiveSidebarItem`, `getPageTitle`. Reportes tiene key `reportes`, label `Reportes`, icon `report`, roles vacíos y available false |
| `frontend/src/layouts/components/AppSidebar.jsx` | Desplegables, `sidebarItemKey`, selección única, autoexpansión, cierre móvil y teclado existentes; no reimplementarlos |
| `frontend/src/api/api.js` | Axios central `api`, VITE_API_URL y withCredentials true; no guardar JWT ni crear otra instancia |
| `frontend/src/hooks/useAuth.js`, `routes/ProtectedRoute.jsx`, `routes/RoleRoute.jsx`, `constants/roles.js` | Sesión pública y controles visuales, sin sustituir seguridad backend |
| `frontend/src/hooks/useConsulta.js` | Acepta consulta habilitada, descarta respuestas tardías y retira datos anteriores. Conserva `data` como objeto y `paginacion`; no adaptarlo globalmente para asumir arrays |
| `frontend/src/features/ventas/pages/VentasPage.jsx` | URL aplicada vs borrador, Buscar/Actualizar, carga/errores, fuera de rango, tabla y paginación |
| `frontend/src/features/bitacora/pages/BitacoraPage.jsx` | Consulta explícita y estados accesibles; no reutilizar conversión temporal de Bitácora para fechas civiles |
| `frontend/src/features/compras/pages/ComprasPage.jsx` | Consistencia visual y enlace a detalle operativo; no heredar consulta automática al abrir un reporte sin período |
| `frontend/src/components/{CatalogoState,FeedbackMessage,Pagination,AppIcon,StatusBadge}.jsx` | Componentes existentes. `Pagination` recibe paginacion/filtros y admite límites válidos distintos de las opciones habituales |
| `frontend/src/utils/presentacion.js` | `fechaCivil`, `horaCivil`, `cantidad`, `costoDecimal`: presentación textual sin Number monetario ni Date UTC |
| `frontend/src/features/inventario/pages/MovimientosPage.jsx` | Página existente CU24/CU40; conservar filtros, tabla, carga y errores propios |
| `frontend/src/features/inventario/services/inventario.service.js` | `getMovimientos`; no crear otro servicio para CU40 |
| `frontend/src/features/inventario/components/MovimientosTable.jsx` | Historial con referencias, responsable y observación; no reemplazarlo por el DTO mínimo de reportes |
| `frontend/src/features/ventas/services/venta.service.js`, `features/compras/services/compra.service.js` | Referencias de transporte y fichas; no usar listados operativos para reconstruir reportes |
| `frontend/tests/ventas-consulta.test.mjs`, `ventas-consulta.browser.test.mjs`, `bitacora-consulta.test.mjs` | Estilo de pruebas focalizadas y arnés existente; no ejecutar scripts globales de otros módulos por defecto |

No se encontraron archivos en `frontend/src/features/reportes/` ni pantalla de reportes en el router inspeccionado. Si al iniciar una fase aparece una implementación parcial posterior, inspeccionarla y adaptarla; no sobrescribirla automáticamente.

### Integración de navegación prevista

Mantener el módulo `Reportes` en su posición actual: después de Recetas y antes de Bitácora, sin cambiar su nombre ni icono. Subopciones en orden CU38 → CU39 → CU40 → CU41, filtradas por rol. Conservar las demás opciones de todos los paquetes.

Rutas frontend previstas para páginas nuevas: `/reportes/ventas`, `/reportes/compras`, `/reportes/perdidas`. Son decisiones de navegación del plan, no rutas existentes ni endpoints nuevos. La ruta padre del paquete debe llevar a una opción realmente habilitada para ese rol; no crear una landing vacía o ruta inexistente `/reportes`.

CU40 enlaza a `/inventario/movimientos`, manteniendo también el acceso actual desde Inventario. Usar la intención `sidebarItemKey` existente para distinguir el acceso desde Reportes sin activar dos subopciones simultáneamente. En recarga/enlace directo sin intención puede identificarse Inventario como origen canónico: no duplicar la página ni reescribir el algoritmo global por esa ambigüedad. Probar selección, desplegado, Atrás/Adelante y navegación móvil.

Publicar solo subopciones con página funcional o reutilizada. En entregas parciales no habilitar links a reportes todavía sin implementar; no cambiar a un rol su acceso a CU40 para ocultar esa parcialidad.

## 5. Organización de implementación

Mantener Page/Component → Service → api.js → backend, estado local y URL aplicada. Feature propuesta `frontend/src/features/reportes/`, con `pages/`, `components/`, `services/`, `utils/` y, solo si se necesita, `styles/`. No crear carpetas/archivos vacíos anticipadamente.

Nombres **previstos, no implementados**: `ReporteVentasPage.jsx`, `ReporteComprasPage.jsx`, `PerdidasPage.jsx`, `ReporteFilters.jsx`, `reporte.service.js`, `consultaReporte.js`. Crear componentes de resumen/tabla específicos según la necesidad real; compartir únicamente lo común y utilizado. No hacer un motor genérico de reportes, Context nuevo, caché global o dependencia nueva.

## 6. Contrato backend y reglas funcionales

Fuentes vigentes: `contexto-maestro.md` §39, RF35–RF38/RI12, RN91/RN92/RN97–RN101 y CU38–CU41. Código leído: `backend/src/presentation/routes/reporte.router.js`, `controllers/reporte.controller.js`, `business/validators/reporte.validator.js` y `business/services/reporte.service.js`. El mapeo público está en Service: **no hay DTO separado que deba inventarse**. `backend/src/app.js` monta `/api/reportes`.

### 6.1. Endpoints y permisos

| HTTP existente | Acceso | Evento backend de consulta, sin implementarlo en React |
|---|---|---|
| GET /api/reportes/ventas | Administrador | REPORTE_VENTAS_CONSULTAR |
| GET /api/reportes/compras | Administrador | REPORTE_COMPRAS_CONSULTAR |
| GET /api/inventario/movimientos | Administrador y Regente | Conservar flujo existente CU40 |
| GET /api/reportes/perdidas | Administrador y Regente | REPORTE_PERDIDAS_CONSULTAR |

Servicios nuevos usan paths relativos `/reportes/...` en `api`, sin duplicar `/api`. Enviar cookie con configuración existente; jamás leer/guardar JWT. No modificar backend, auditoría, contratos o permisos para acomodar React.

### 6.2. Query común de CU38/CU39/CU41

- **Período obligatorio, exactamente una modalidad**: `dia=YYYY-MM-DD`, `mes=YYYY-MM` o `desde=YYYY-MM-DD&hasta=YYYY-MM-DD`. Ambos extremos requeridos para período, inclusivos y no invertidos. No enviar `tipoPeriodo`; modalidad es estado local del formulario, no parámetro HTTP.
- Fechas gregorianas reales, años 1000–9999; bisiestos correctos. No formatos alternativos, blancos, repetidos, arrays/objetos, campos desconocidos ni modalidades combinadas. Al cambiar modalidad limpiar los campos incompatibles del borrador.
- Se permiten futuros y no hay máximo artificial de rango. No añadir límites de consultas operativas de escritura ni un máximo igual al día actual en los inputs.
- Entrada inicial sin selección: estado «Selecciona un período», sin GET. No enviar el mes actual automáticamente. Limpiar vuelve a ese estado, retira resultado previo y restablece página 1/límite 25.
- Opcionales: ventas `estadoOperacion=CONFIRMADA|PENDIENTE|ANULADA`; compras `estadoOperacion=CONFIRMADA|ANULADA`; pérdidas `motivo=VENCIMIENTO|DAÑO`. «Todos» significa omitir el filtro, no enviar TODOS. No filtros por producto/proveedor/usuario/clave ni opciones de orden o agrupación.
- `pagina`: entero textual positivo sin ceros iniciales, máximo 2147483647, default 1. `limite`: entero textual 1–100, default 25; el contrato admite también valores distintos de 25/50/100. Una URL válida con límite 7 no debe romper el selector existente. Codificar DAÑO mediante URLSearchParams, sin cambiarlo a DANO.

CU40 conserva sus propios filtros `idMedicamento`, `idExistencia`, `desde`, `hasta`, `direccion`, `motivo` y contrato vigente. **No imponerle período obligatorio, modalidades, resumen ni paginación de Reportes.**

### 6.3. Respuesta y tipos

200 de los tres reportes:

```text
{ data: { periodo, resumen, detalle }, paginacion }
periodo: { modalidad: DIA|MES|PERIODO, desde, hasta, zonaHoraria: America/La_Paz }
paginacion: { pagina, limite, total, totalPaginas }
```

Servicios devuelven `response.data` completo; no confundir ese envoltorio Axios con `data.detalle`. `useConsulta` puede conservar `consulta.data.periodo/resumen/detalle` y `consulta.paginacion` sin modificación global.

- Resumen incluye **todas** las coincidencias filtradas; detalle solo la página. No sumar la tabla para mostrar totales, ni descargar todas las páginas para calcularlos. Cambiar página no cambia totales por sí mismo, aunque otra solicitud puede observar cambios reales del servidor.
- Importes: strings exactos a dos decimales; costos: strings a seis. `cantidadRetirada` agregada: string entero, incluso por encima del entero seguro. IDs, cantidades individuales, conteos y paginación: enteros JSON. Presentar las cadenas sin Number/parseFloat/toFixed ni recalcular importes.
- Vacío: 200, resumen con ceros, detalle [], total/totalPaginas 0. Página posterior a la última: 200, detalle [], mismo resumen y total, sin corrección automática. Mantener resumen y ofrecer «Volver a la primera página» explícito.
- Orden fijo del servidor por fechaReferencia DESC e ID DESC. No reordenar únicamente la página en cliente ni ofrecer orden inexistente.

| Consulta | Resumen real | Campos de cada fila de detalle |
|---|---|---|
| Ventas | confirmadas, pendientes, anuladasConfirmadas, anuladasSinConfirmar: cada una `{ cantidad, importe }`; totalVentasRealizadas | idVenta, estadoOperacion, categoria, fechaReferencia, fechaRegistro, fechaVenta, fechaAnulacion, total |
| Compras | confirmadas, anuladas: `{ cantidad, importe }`; totalComprasRealizadas | idCompra, idProveedorLaboratorio, estadoOperacion, fechaReferencia, fechaCompra, fechaRegistro, fechaAnulacion, total |
| Pérdidas | vencimiento, dano: `{ cantidadRetiros, cantidadRetirada, perdida }`; cantidadRetiros, cantidadRetirada, perdidaTotal globales | idMovimiento, idExistencia, idMedicamento, codigoExistencia, codigoMedicamento, nombreComercial, idUsuario, motivo, fechaReferencia, fechaMovimiento, cantidad, costoUnitarioAplicado, perdida, idMovimientoReversion |

No exigir que las respuestas contengan nombres de proveedor/responsable, observaciones, claves o datos clínicos que no forman parte del contrato. Mostrar un ID como ID; no realizar consultas masivas adicionales para enriquecer cada fila. Los códigos/nombre en pérdidas son actuales del catálogo, no snapshots históricos.

CU40 usa su respuesta propia `{ data: movimientos }`, con estructura/observación/referencias existentes; consumir mediante `getMovimientos`/`MovimientosPage` y no mediante el nuevo Service de reportes.

### 6.4. Fechas, categorías e importes

Fechas civiles America/La_Paz: `YYYY-MM-DD` y `YYYY-MM-DD HH:mm:ss`, sin Z/offset; null se presenta como ausencia, no fecha falsa. Usar `fechaCivil`/`horaCivil`, no `new Date(texto)`, UTC o ajuste horario del dispositivo. Mostrar período normalizado/zona del resultado aplicado, no del borrador en edición. No fabricar milisegundos que la respuesta no devuelve.

| Categoría de ventas (respuesta) | Eje del período / fechaReferencia |
|---|---|
| CONFIRMADA | fechaVenta |
| PENDIENTE | fechaRegistro |
| ANULADA_CONFIRMADA | fechaVenta |
| ANULADA_SIN_CONFIRMAR | fechaRegistro |

El **filtro** de ventas admite ANULADA, no las categorías derivadas ANULADA_CONFIRMADA/ANULADA_SIN_CONFIRMAR. ANULADA incluye ambas. Etiquetas visibles comprensibles y estado/categoría diferenciados; no inventar estados de DB. `totalVentasRealizadas` solo confirmadas. Pendientes/anuladas son importes informativos, no ingresos vigentes. No sumar/restar esas categorías ni reconstruir un cierre histórico: una anulación posterior puede reclasificar el reporte.

Compras: período por adquisición `fechaCompra`, no registro/anulación. `totalComprasRealizadas` solo confirmadas; anuladas separadas con importe informativo positivo, sin volver a descontarlas. No recalcular detalles.

Pérdidas: **retiros brutos**, originales SALIDA VENCIMIENTO/DAÑO; no ajustes negativos, ventas ni compensaciones. Se informa `idMovimientoReversion` o null sin restarlo ni habilitar una operación de reversión. No llamarlas pérdidas netas. Valor/costo aplicado históricos del servidor, nunca promedio actual. Backend redondea cada retiro antes de sumar: dos valores 0.01 producen 0.02; React no repite la fórmula. Costo cero es válido. Cantidades agregadas de distintos productos no equivalen a una unidad farmacéutica común.

Categorías excluidas por filtro permanecen en cero; no ocultarlas o sustituirlas por valores sin filtrar. Inactividad actual de producto/proveedor y saldo cero no excluyen históricos desde React.

### 6.5. Interacción de consulta y errores

- Borrador local de formulario separado de filtros aplicados en URL. Buscar valida y aplica; no pedir datos por cada tecla/cambio incompleto. GET inicial solo ante URL completa válida. URL inválida (incluidos desconocidos/repetidos) muestra corrección sin emitir consulta ni ignorar silenciosamente claves.
- Aplicar nuevos filtros o límite reinicia página 1. Paginar/Actualizar usa los criterios aplicados, no los cambios de borrador pendientes; mantener el borrador sin presentarlo como consulta ejecutada. Buscar los mismos criterios permite refrescar.
- Conservar URL al recargar y Atrás/Adelante. Para links a fichas existentes, conservar el contexto de retorno del reporte usando el patrón existente; no inventar rutas con ID ausente ni una ficha de reporte nueva. Si el regreso directo de la ficha necesita cambios ajenos, preferir Atrás y documentar el límite antes de extender la tarea.
- Retirar resumen/detalle anteriores durante carga, error o cambio de consulta; no presentar datos de otro período/página como actuales. Ignorar respuestas tardías al salir, cambiar consulta o rol. Reutilizar `useConsulta` y habilitación condicional.
- Distinguir sin período, carga, validación local/400, vacío, página lejana, 401, 403, red y 500. 401 ofrece login según precedente; 403 no conserva datos restringidos ni reintenta automáticamente. Error técnico genérico, nunca SQL/stack. Deshabilitar envíos duplicados y navegación de página mientras carga cuando corresponda.
- No esperar 404/204 por vacío ni tratar fallos exclusivos de auditoría como pérdida de una lectura 200. No emitir eventos de auditoría adicionales desde el navegador.

### 6.6. Contraste mínimo al iniciar una implementación

No reabrir el contrato aprobado. Revisar validator/Service actuales solo para detectar cambios posteriores. Cualquier contradicción real se informa como bloqueo concreto; no se resuelve cambiando backend, inventando filtros o ignorando campos. La validación React mejora experiencia, no sustituye la validación definitiva del servidor.

### 6.7. Dependencia técnica: aceptación backend parcial

Evidencia heredada, **no ejecutada en esta preparación**: última aceptación local Express/Sequelize/MySQL 8.0.46, 11 aprobadas/0 fallidas/1 omitida contando contenedora, con bases temporales eliminadas. Se ejerció concurrencia real controlada entre agregado y detalle, no aceptación de todos los interleavings o Services operativos. Fuente persistente: `contexto-maestro.md` §39 y `bitacora-auditoria.md`.

Límites conservados: DATETIME(0) en fechas relevantes impide comprobar fracciones persistidas, aunque el filtro contratado sea inclusivo hasta 23:59:59.999999; no hay precisión mayor implementada. Cantidad agregada real se probó > INT, no > Number.MAX_SAFE_INTEGER (este último extremo solo simulado). No hubo prueba de volumen/plan/rendimiento, sesión expirada/revocada nuevamente con MySQL, corte de red/servidor/COMMIT del auditor ni privilegios mínimos operativos; limpieza no garantizada ante terminación forzada. No corregir estos límites desde React ni declarar aceptación total por pasar pruebas frontend. Cualquier nueva prueba integrada necesita autorización propia para entorno aislado.

## 7. Tabla general de fases

Se definen seis unidades por dependencias reales: base compartida; tres entregas visuales incrementales; regresión frontend conjunta; aceptación integrada y cierre. CU40 se integra al publicar navegación y se verifica nuevamente al cierre, sin fase de desarrollo duplicada.

| Fase | Propósito | Dependencias | Estado |
|---|---|---|---|
| 1 | Transporte, filtros/URL y pruebas de contrato frontend | Este plan y contrato implementado | COMPLETADA — unitarias/transporte simulado |
| 2 | CU38 completo: UI base, reporte de ventas y navegación con CU40 reutilizado | Fase 1 | COMPLETADA — frontend/API simulada |
| 3 | CU39: reporte de compras sobre la base visual existente | Fase 2 | COMPLETADA — frontend/API simulada |
| 4 | CU41: pérdidas y paquete completo según rol | Fases 2–3 | COMPLETADA — frontend/API simulada |
| 5 | Regresión frontend conjunta, accesibilidad/responsive y build | Fases 2–4 | COMPLETADA — frontend/API simulada |
| 6 | Aceptación integrada autorizada y cierre con límites | Fase 5; entorno real autorizado para aceptación | COMPLETADA — integración frontend local focalizada; límites §6.7 vigentes |

## 8. Desarrollo detallado de fases

### Fase 1 — Base de integración y filtros aplicados

- **Objetivo:** transporte real del contrato y utilidades pequeñas de query/validación, sin UI ni rutas públicas incompletas.
- **Dependencias:** §6; comprobar Git y que no aparezca una feature posterior que deba adaptarse.
- **Lectura mínima:** API central, `useConsulta`, utilidades de consulta de Ventas/Bitácora, validator/Service backend de reportes como referencia; fuentes funcionales solo en secciones vinculadas.
- **Archivos previstos:** `features/reportes/services/reporte.service.js`, `utils/consultaReporte.js`, pruebas focalizadas `frontend/tests/reportes-*.test.mjs`. No crearlos vacíos.
- **Actividades:** funciones HTTP de ventas/compras/pérdidas con Axios existente; lectura/serialización estricta de URL por reporte, modalidades exclusivas, defaults, filtros permitidos y validación civil de experiencia sin dependencias nuevas. Distinguir URL inicial sin período de URL inválida; no aceptar búsquedas sin período. Conservar respuesta anidada y strings intactos.
- **Restricciones:** sin rutas, páginas, sidebar, refactor global de hook, copia de validadores backend al bundle ni cálculo monetario.
- **Verificaciones:** pruebas unitarias/de transporte simulado para paths/params, sin GET al omitir selección desde el futuro coordinador; día/mes/rango, 1900/2000, extremos 1000/9999, futuros, desconocidos/repetidos, filtros cruzados, DAÑO codificado, página/límite (incluido 7), respuesta intacta/importes grandes. Sin conexiones backend/MySQL.
- **Aceptación:** helpers exportados utilizados o con consumidor previsto inmediato, pruebas acotadas aprobadas y `git diff --check`; sin publicar funcionalidades ficticias.
- **Resultado esperado:** nombres y firmas reales, estructura de resultado y manejo de query registrados en el cierre para Fase 2.

### Fase 2 — CU38, interfaz común y acceso reutilizado a CU40

**Obligatorio cargar y utilizar `frontend-design`: conservar exactamente el diseño, estructura y orden visual actuales; NO rediseñar CADEFAR.**

- **Objetivo:** primera consulta visual completa, patrón reutilizable y navegación incremental funcional.
- **Dependencias:** Fase 1; §3/§4/§6; CU40 existente.
- **Lectura mínima:** `VentasPage`, sus filtros/tabla/paginación, `BitacoraPage`, componentes globales, estilos citados, router/navigation/AppSidebar y MovimientosPage. No revisar formularios operativos ajenos.
- **Archivos previstos:** `ReporteVentasPage`, filtros compartidos realmente usados, resumen/tabla de ventas, estilos locales mínimos; `app/router.jsx`, `constants/navigation.js` y pruebas relacionadas. `AppSidebar` solo si hay una necesidad demostrada no resuelta por configuración.
- **Actividades:** formulario Día/Mes/Período con selección explícita, Buscar/Limpiar, filtros aplicados en URL, Actualizar, período/zona, resumen de cuatro categorías y total realizado, detalle/paginación. Links a `/ventas/:idVenta` existentes. Mantener null y etiquetas de categorías sin confundirlas con enum del filtro.
- **Navegación:** montar `/reportes/ventas` solo Administrador. Habilitar en el paquete existente CU38 y CU40; Regente solo ve el CU40 ya funcional en esta entrega. Conservar nombre/icono/posición y acceso CU40 de Inventario. Mantener `sidebarItemKey` al cambiar query cuando proceda y resolver selección única sin crear página de historial nueva.
- **Restricciones:** no links CU39/CU41 antes de implementarlos, landing artificial, cálculos del resumen en cliente ni cambios de rutas/permisos operativos. No mes predeterminado enviado.
- **Verificaciones:** servicios simulados; sin GET al entrar/limpiar sin período; URL válida carga, inválida no; categorías, filtro ANULADA, vacíos/página lejana con resumen, límite, 400/401/403/500/red, respuestas tardías y actualización con borrador sin aplicar. Roles, acceso directo, recarga y navegación de CU40 sin doble activo; teclado/labels/tabla móvil según arnés existente.
- **Aceptación:** CU38 completo con datos del servidor, CU40 reutilizado sin servicio/página duplicados, selección coherente y entrega parcial honesta. Pruebas focalizadas/build según cambios, diff sin errores.
- **Resultado esperado:** componentes visuales reutilizables y decisiones de URL/retorno concretas registradas, sin declarar Reportes completo todavía.

### Fase 3 — CU39: reporte de compras

**Obligatorio cargar y utilizar `frontend-design`: reutilizar el diseño de CADEFAR y la base de Fase 2; NO rediseñar páginas ni sidebar.**

- **Objetivo:** integrar compras con la misma interacción y representación histórica correcta.
- **Dependencias:** Fase 2, base compartida estable y §6 para compras.
- **Lectura mínima:** cierre previo, componentes/Service de reportes creados, CompraTable/detalle solo para presentación/links, permisos de router/navigation.
- **Archivos previstos:** `ReporteComprasPage`, resumen/tabla pertinentes, configuración localizada y pruebas CU39. Extender compartidos sin romper ventas; no copiar una página entera si solo cambia la sección de resultados.
- **Actividades:** filtro CONFIRMADA/ANULADA; resumen separado, `totalComprasRealizadas`, fecha de adquisición como referencia y fechas civiles/null. Enlace a `/compras/:idCompra`, sin consulta adicional por proveedor. Incorporar subopción CU39 entre CU38 y CU40 y ruta solo Administrador.
- **Restricciones:** no filtros de proveedor/clave, nombre de proveedor inventado, recálculo de compras ni permiso de reporte para Regente.
- **Verificaciones:** período obligatorio, estados separados, adquisición distinta de registro/anulación, importes iguales/grandes, filtros y resumen entre páginas, vacíos/errores, URL y roles; regresión focalizada de CU38/CU40 si se tocan elementos compartidos.
- **Aceptación:** CU39 funciona con respuesta real del contrato, apariencia igual a la entrega anterior y sin cambios de compras operativas; pruebas acotadas/diff aprobados.
- **Resultado esperado:** consultas de ventas y compras funcionales para Administrador; CU41 aún no publicado.

### Fase 4 — CU41: pérdidas y navegación completa

**Obligatorio cargar y utilizar `frontend-design`: jerarquía legible de retiros/resúmenes con componentes y estilo actuales; NO rediseñar CADEFAR.**

- **Objetivo:** completar pérdidas para Administrador/Regente y la organización CU38–CU41 del paquete.
- **Dependencias:** Fases 2–3; reglas de pérdidas brutas y strings §6.
- **Lectura mínima:** base Reportes, tabla/respuesta de pérdidas, `presentacion.js`, `MovimientosPage`/`getMovimientos`, navigation/router. Backend solo para confirmar campos, no para cambiar fórmulas.
- **Archivos previstos:** `PerdidasPage`, tabla/resumen específicos, extensión mínima de filtros/configuración y pruebas CU41.
- **Actividades:** motivo VENCIMIENTO/DAÑO, resumen por motivo y global, conteos y cantidades textuales, costo a seis decimales/pérdida a dos sin operaciones monetarias; informar retiros brutos y referencia eventual de reversión sin descontarla. Enlaces al historial existente con filtros compatibles `idExistencia`/`idMedicamento`, o existencias con ruta ya definida; no inventar `/movimientos/:id`.
- **Navegación:** publicar CU41 tras CU40; Regente ve CU40/CU41, Administrador CU38–CU41, Vendedor ninguno. Destino inicial del padre permitido y disponible para el rol. Conservar el resto de módulos y estados activos.
- **Restricciones:** no operación de reversión, etiqueta de pérdida neta, cálculo con promedio actual, conversión a unidad farmacéutica común ni nuevo servicio/página para CU40.
- **Verificaciones:** strings superiores al entero seguro sin pérdida, costo cero, 0.01 + 0.01 mostrado desde resumen como 0.02 sin calcularlo, motivos filtrados/categorías en cero, idMovimientoReversion/null, inactivos/agotados, validación/errores, trazabilidad existente y regreso al reporte. Regresión localizada de elementos compartidos.
- **Aceptación:** CU41 completo y CU38–CU41 navegables por sus roles; ningún cálculo financiero nuevo ni modificación de inventario; pruebas/diff aprobados.
- **Resultado esperado:** alcance funcional frontend completo, pendiente de regresión conjunta/aceptación.

### Fase 5 — Verificación conjunta frontend y build

- **Objetivo:** comprobar integración de UI, consultas y permisos sin confundir API simulada con backend/MySQL real.
- **Dependencias:** Fases 2–4.
- **Lectura mínima:** cierres, pruebas añadidas, arnés frontend existente y solo componentes compartidos afectados.
- **Archivos involucrados:** tests de Reportes y regresiones focalizadas de navegación/Inventario/Ventas pertinentes; archivos funcionales solo para corregir defectos demostrados. Si se adapta UI, **cargar `frontend-design` y conservar diseño/orden; NO rediseñar**.
- **Actividades:** pruebas de navegador con API simulada usando arnés ya disponible, sin instalar dependencias ni producir capturas; comprobar peticiones exactas, formularios, estados, accesibilidad y anchos 375 px/escritorio. Ejecutar pruebas de forma secuencial si así lo requiere el arnés para no repetir agotamiento de recursos de Vite.
- **Verificaciones:** matriz completa Administrador/Regente/Vendedor y accesos directos; filtros/modos inválidos, sin período y Limpiar sin GET; Buscar vs Actualizar/paginación/borrador; recarga/Atrás/Adelante, respuestas fuera de orden y tras salir; vacíos vs página lejana, resumen completo, null, fechas civiles bajo distintos husos del cliente e importes/cantidades grandes; navegación CU40 desde ambos paquetes y sidebar móvil/contraído/teclado. 401/403/red/400/500 sin datos antiguos ni reintentos automáticos ocultos.
- **Restricciones:** no pruebas globales backend, conexión MySQL, afirmación de aceptación integrada ni correcciones ajenas. No abrir inspecciones visuales prolongadas; automatización acotada sin capturas.
- **Aceptación:** pruebas focalizadas frontend y `pnpm build` aprobados; registrar avisos reales, comandos/conteos, alcance simulado y pendientes manuales; `git diff --check` y revisión de archivos nuevos.
- **Resultado esperado:** frontend verificado contra contrato simulado; Fase 6 habilitada, no ejecutada automáticamente.

### Fase 6 — Aceptación integrada y cierre del frontend

- **Objetivo:** comprobar consumo real y cerrar con evidencia diferenciada, sin atribuir al frontend resolución de límites backend.
- **Dependencias:** Fase 5 y autorización nueva para entorno local aislado, login, consultas y cualquier fixture/escritura de auditoría. Autorizaciones históricas backend no se heredan. Sin permiso, mantener esta fase parcial/pendiente y dejar frontend simulado verificado explícitamente.
- **Lectura mínima:** cierres Fases 1–5, §6.7, arnés integrado existente como referencia y guardas de aislamiento antes de conectar.
- **Archivos involucrados:** pruebas integradas frontend focalizadas y este registro. No modificar backend/modelos/migraciones para hacer pasar escenarios; si aparece una incompatibilidad, documentarla y detener el alcance afectado.
- **Actividades:** comprobar React → Axios/cookie → Express/MySQL con datos sintéticos autorizados; roles/login, períodos, filtros, resúmenes/tablas/páginas, anuladas, pérdidas brutas y enlaces CU40. Separar fixtures/auditoría de lecturas; no ejecutar formularios de compra/venta/retiro para poblar la prueba sin autorización expresa.
- **Verificaciones:** contraste de datos conocidos con lo presentado, fechas civiles e importes textuales, permiso efectivo de API y ruta frontend, consulta de historial existente y ausencia de escrituras de negocio por consultar. Documentar entorno, límites y limpieza efectivamente realizada; sin capturas ni despliegue.
- **Restricciones:** no bases operativas/Railway/datos personales, reutilización de secretos en documentación, ampliación a precisión temporal/rendimiento/contabilidad o aceptación total backend. No descargar todo el histórico como prueba de exactitud.
- **Aceptación:** resultados reales o bloqueos explícitos; estado individual de cada fase, alcance implementado frente a verificado, limitaciones backend conservadas y pendientes operativos/manuales separados. Actualizar solo documentación autorizada; el seguimiento de este plan se hace en este archivo, sin actualizar otros documentos automáticamente.
- **Resultado esperado:** cierre frontend con pruebas simuladas y reales claramente distinguidas. Si falta integración autorizada, no marcarla completada ni ocultarla bajo el build exitoso.

## 9. Protocolo de continuidad entre sesiones

1. Leer AGENTS.md raíz/frontend y este documento; backend AGENTS solo si se inspeccionan fuentes de ese ámbito. Consultar cierre y dependencias de la fase solicitada.
2. Ejecutar `git status --short`, preservar cambios ajenos y revisar archivos involucrados antes de editar. Backend ya tiene trabajo local: no revertirlo ni incluirlo como propio.
3. Ejecutar **únicamente** la fase solicitada. No replanificar todo ni avanzar automáticamente; leer solo las referencias mínimas y los cambios posteriores relevantes.
4. En fases visuales cargar `frontend-design`; mantener apariencia, estructura y orden de CADEFAR. No usarla para proponer un tema nuevo.
5. Realizar pruebas correspondientes, registrar resultados/limitaciones y actualizar tabla/avance en este archivo; no copiar todos los logs ni secretos.
6. Indicar siguiente fase habilitada y lectura mínima. Una fase descrita no está implementada; una prueba simulada no acredita API/DB reales.

Prompt de continuidad:

> Lee AGENTS.md raíz/frontend y docs/ai/fases.md. Ejecuta exclusivamente la Fase N del frontend de Reportes y Pérdidas, verificando dependencias y cambios locales. Respeta el contrato real y reutiliza CU40. Si hay UI, carga frontend-design sin rediseñar CADEFAR ni alterar orden visual/sidebar. No modifiques backend ni operaciones; no uses MySQL sin nueva autorización específica. Ejecuta comprobaciones focalizadas, actualiza el estado/cierre en fases.md y deja la siguiente fase indicada, sin iniciarla automáticamente.

## 10. Plantilla de cierre de cada fase

```text
Fase / fecha / estado: PENDIENTE, EN CURSO, COMPLETADA, PARCIAL o BLOQUEADA
Objetivo ejecutado y dependencias comprobadas:
Skill frontend-design: utilizada (alcance) / no aplica / no disponible
Archivos y símbolos realmente creados/modificados:
CU y rutas efectivamente disponibles por rol:
Contrato consumido y componentes reutilizados:
Diseño/orden preservados; decisiones locales de interacción:
Comandos de comprobación, resultados y avisos:
Evidencia: estática / unitarias / API simulada / integración real autorizada
Acceso a backend/MySQL, fixtures/auditoría y limpieza, si corresponde:
Cambios ajenos preservados:
Limitaciones, pruebas omitidas y pendientes:
Siguiente fase habilitada y lectura mínima:
```

No registrar JWT/cookies/contraseñas, .env o datos personales. No hacer commit, push, merge, despliegue ni instalar dependencias automáticamente.

## 11. Registro de avances, decisiones y pendientes

### Preparación documental — no es ejecución de una fase

- Se reemplazó el plan backend por este plan frontend por solicitud explícita. **Fases 1–6 PENDIENTES / NO INICIADAS.**
- Leídas selectivamente fuentes funcionales CU38–CU41/RF35–RF38/RI12/RN pertinentes, contrato real Routes/Controller/Validator/Service backend, navegación/layout, páginas y componentes de referencia frontend. Skill `frontend-design` cargada para orientar conservación de diseño, no para construir UI.
- No se implementaron fases, modificaron código/otros documentos, ejecutaron pruebas funcionales, abrieron navegadores, generaron capturas, instalaron dependencias ni accedió a MySQL.
- Decisiones del plan: tres páginas con base visual compartida y consulta explícita; CU40 reutilizado; publicación incremental de subopciones solo funcionales; filtros aplicados en URL sin período automático; seis fases según dependencias. No modifica decisiones funcionales backend.
- Las referencias externas al antiguo `fases.md` §7.2–7.8/§7.15–7.16 ahora son históricas por el reemplazo solicitado. Equivalencias actuales: contrato frontend consumido en §6, límites técnicos en §6.7; contexto maestro §39, reglas y casos de uso siguen siendo fuentes vigentes. No se editaron esos documentos fuera de alcance ni se conservaron sus antiguos cierres en este archivo.
- Se preservan los literales de endpoints/tipos de auditoría en §6.1, también usados por la comprobación documental backend existente; no se altera esa prueba ni se la ejecuta en esta tarea.
- Pendientes: todas las implementaciones/pruebas de fases y nueva autorización para aceptación real. Los límites de precisión temporal y aceptación backend parcial no se consideran resueltos.
- Verificación documental de preparación: comprobadas 11 secciones, seis fases pendientes con criterios completos, skill en entregas visuales y conservación de endpoints/tipos de auditoría. `git diff --check` sin errores de espacios (solo avisos de normalización LF/CRLF de cambios previos); revisión adicional del archivo sin seguimiento con `git -c core.autocrlf=false diff --no-index --check -- /dev/null docs/ai/fases.md` sin salida, código 1 por diferencia frente al vacío. Estado Git mantiene los archivos locales previos; únicamente se reescribió este documento. No cuenta como Fase 1 ni como prueba funcional.

Los cierres posteriores se añadirán aquí, manteniendo decisiones útiles y resultados comprobables sin reproducir el historial completo de sesiones.

### Fase 1 — 19/11/2026 — COMPLETADA

- **Alcance:** base de integración CU38/CU39/CU41, sin UI. Leídos AGENTS raíz/frontend y backend para inspección estática, §6/§8 y fuentes funcionales vinculadas; contrastados Validator/Service actuales sin contradicciones. No existía trabajo posterior en `frontend/src/features/reportes/`. Skill `frontend-design`: no aplica (no se construyeron interfaces).
- **Archivos creados y símbolos:**
  - `frontend/src/features/reportes/services/reporte.service.js`: `getReporteVentas(filtros = {})`, `getReporteCompras(filtros = {})`, `getReportePerdidas(filtros = {})`, funciones async. Usan `api` central y GET relativos `/reportes/ventas`, `/reportes/compras`, `/reportes/perdidas` con `params: URLSearchParams`. Devuelven `response.data` completo `{ data: { periodo, resumen, detalle }, paginacion }`, sin transformar fechas, null, cantidades, importes ni recalcular resultados. Propagan errores sin reintentos. Rechazan filtros inválidos/sin período antes del transporte.
  - `frontend/src/features/reportes/utils/consultaReporte.js`: `leerConsultaReporte`, `validarFiltrosReporte`, `serializarConsultaReporte` (contrato abajo). Validación civil gregoriana independiente de Date/UTC, modalidades excluyentes, filtros específicos, paginación textual y serialización estricta determinista.
  - `frontend/tests/reportes-consulta.test.mjs`: ocho pruebas unitarias de filtros/URL.
  - `frontend/tests/reportes-services.test.mjs`: cuatro pruebas principales y tres subpruebas de servicios con `registerHooks`, sustituyendo únicamente `api.js` por transporte simulado que falla si no se configura un mock.
- **Único documento actualizado:** `docs/ai/fases.md` (estado y este registro); las demás fases permanecen pendientes.

#### Contrato de utilidades para Fase 2

- `tipo` obligatorio en las tres funciones: `'ventas' | 'compras' | 'perdidas'`.
- `leerConsultaReporte(query, tipo)`: `query` es string de búsqueda (con o sin `?`) o `URLSearchParams`. Devuelve siempre `{ estado, habilitada, filtros, error }`:
  - `estado: 'sinPeriodo'`, `habilitada: false`, `error: ''`, `filtros` con página/límite textuales y opcionales válidos presentes. Corresponde a entrada inicial sin selección temporal; la futura página debe mostrar «Selecciona un período», sin GET. Un filtro inválido aun sin período produce `invalida`, no se ignora.
  - `estado: 'invalida'`, `habilitada: false`, `filtros: null`, `error` comprensible no vacío. Incluye fechas incompletas, modalidades mezcladas, parámetros desconocidos/repetidos/vacíos, filtros cruzados y formatos inválidos. No hay filtros saneados aprovechables para ejecutar accidentalmente otra consulta.
  - `estado: 'valida'`, `habilitada: true`, `error: ''`, `filtros` serializables completos con defaults `pagina: '1'`, `limite: '25'`. No se crea período predeterminado ni se normaliza el período a extremos: esa respuesta corresponde al servidor.
- `validarFiltrosReporte(filtros, tipo)`: recibe objeto plano de filtros aplicados con valores **string**; devuelve `''` si es válido o mensaje de error. A diferencia de la lectura inicial, exige período para Buscar. No convierte números, arrays, objetos, null o undefined ni recorta espacios.
- `serializarConsultaReporte(filtros, tipo)`: mismo objeto; devuelve string sin `?`, con orden `dia/mes/desde/hasta`, `pagina`, `limite`, opcional específico. Valida primero y **lanza Error** si hay problemas o falta período; nunca descarta silenciosamente claves inválidas. Usa URLSearchParams para `DAÑO` → `DA%C3%91O`. Agrega defaults de paginación si se omiten y no modifica la entrada.
- Integración prevista inmediata: la Fase 2 pasará `consulta.habilitada` como cuarto argumento de `useConsulta`, `consulta.filtros` como filtros y la serialización válida como clave. No serializar ni consultar estados deshabilitados. Mantener el borrador separado: modalidad local no se envía (`tipoPeriodo` es inválido); omitir campos temporales incompatibles y filtros opcionales no seleccionados en vez de enviar `''`/`TODOS`. Al aplicar criterios/límite, la página reiniciará `pagina: '1'`; Limpiar quitará la query y volverá a defaults sin GET. No se implementó ese coordinador ni un helper de formulario anticipado.
- Años 1000–9999, bisiestos 1900/2000, futuros y rango cerrado no invertido sin máximo de días. Página hasta 2147483647 y límite 1–100, incluido 7; sin ceros iniciales o formatos alternativos. Respuestas del servidor conservadas sin aritmética monetaria ni agregación local.

#### Verificaciones y límites

- Desde `frontend`: `node --test tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs` → **15 aprobadas, 0 fallidas, 0 omitidas** (12 pruebas principales + tres subpruebas). Cubre modos, calendario/extremos/futuros, período ausente frente a inválido, guardas sin GET, parámetros estrictos y filtros cruzados, defaults/límites, DAÑO, lectura/serialización coherente sin mutación, paths/params exactos, respuesta anidada por identidad con strings mayores al entero seguro/null/costo cero, vacíos/página lejana y errores HTTP/red sin reintentos.
- `git diff --check` → código 0, sin errores de espacios; únicamente avisos LF→CRLF sobre archivos con cambios ajenos previos. Revisión adicional de los cuatro archivos nuevos y este documento sin seguimiento mediante `git -c core.autocrlf=false diff --no-index --check -- /dev/null <archivo>` → sin salida ni errores de espacios (código 1 esperado por diferencia frente al vacío). Revisado el contenido nuevo y `git status --short`: solo se agregaron los cuatro archivos frontend indicados y se actualizó este plan; los cambios ajenos siguen presentes.
- Evidencia **unitaria y transporte simulado**, no integración real. `useConsulta` solo se leyó; la ausencia de petición se comprobó con utilidades/servicios, no con una página o prueba React. Autenticación/cookies reales, navegación y presentación quedan para fases posteriores.
- No se accedió al servidor backend ni a MySQL: únicamente lectura estática de sus fuentes. Sin fixtures, escrituras, auditoría o limpieza de DB. No se importan validators backend al frontend ni a estas pruebas.
- Sin pruebas funcionales backend, suites globales, build, navegadores, capturas, dependencias nuevas, cambios de rutas/sidebar/dashboard/estilos o consultas operativas. CU40 conserva `getMovimientos`/`MovimientosPage`, sin servicio duplicado. No se publicaron nuevas rutas por rol; permisos y aceptación parcial backend de §6.7 permanecen intactos.
- Cambios locales previos de backend y documentación preservados, incluido el contenido previo de este plan sin seguimiento. No se hicieron commit/push/despliegue.
- **Siguiente fase habilitada: Fase 2, no iniciada.** Lectura mínima: este cierre y §3/§4/§6/Fase 2; los dos módulos y sus pruebas recién creados; `useConsulta`, `VentasPage`/`BitacoraPage`, filtros/tabla/paginación/componentes/estilos citados; router/navigation/AppSidebar y MovimientosPage solo para la integración visual/CU40. Cargar `frontend-design` antes de construir UI, conservando el diseño existente.

### Fase 2 — 19/11/2026 — COMPLETADA (frontend/API simulada)

- **Dependencias:** leídos AGENTS raíz/frontend, §3/§4/§6/Fase 2 y cierre de Fase 1; revisados sus servicios, utilidades y dos pruebas antes de reutilizarlos. Consultadas solo fuentes funcionales CU38/CU40, RF35/RF37/RI12, RN97/RN98 y contexto §39; contraste estático de Validator/Service backend vigentes (sin contradicción), con sus instrucciones. Se preservó el contrato y la aceptación backend parcial de §6.7.
- **Skill `frontend-design`: utilizada sin rediseño.** Plan visual conservador: superficies/colores/tipografía de `app-foundations.css`, encabezado y panel actuales, filtros → toolbar/Actualizar → período/resumen → detalle → paginación. Resumen con `catalogo-detail`, sin dashboard ni tokens nuevos; tabla horizontal enfocable y etiquetada, captions/scope, importes alineados a la derecha, controles con labels/fieldset, foco y estados accesibles existentes. CSS local ajusta únicamente columnas, espaciado y responsive de Reportes.
- **Archivos/símbolos creados:**
  - `frontend/src/features/reportes/pages/ReporteVentasPage.jsx`: coordinación CU38, filtros aplicados URL, borrador local separado, validación explícita, carga/errores, vacío/página lejana y paginación.
  - `frontend/src/features/reportes/components/ReporteFilters.jsx`: modalidad Día/Mes/Período sin selección automática, fechas civiles, estado CONFIRMADA/PENDIENTE/ANULADA, Buscar/Limpiar. Al cambiar modalidad se descartan campos temporales incompatibles.
  - `frontend/src/features/reportes/components/ReporteVentasResultado.jsx`: `ReporteVentasResumen` y `ReporteVentasTable`, período normalizado/zona del servidor, estado aplicado, cuatro categorías/conteos/importes y `totalVentasRealizadas`; detalle y enlaces a fichas existentes. No cálculos monetarios ni agregados de la tabla; strings grandes/decimales y null conservados mediante `cantidad`/`costoDecimal`/`fechaCivil`/`horaCivil`.
  - `frontend/src/features/reportes/styles/reportes.css`: composición localizada con clases/variables existentes, sin fuentes, bibliotecas ni tema nuevo.
  - `frontend/tests/reportes-navegacion.test.mjs`: configuración incremental, destinos del paquete por rol y selección canónica/intencional única.
  - `frontend/tests/reportes-ventas.browser.test.mjs`: arnés CDP headless de estilo existente, compilación/servidor estático temporal y API interceptada; bloquea métodos/endpoints no simulados. No usa el arnés de integración real ni genera capturas.
- **Archivos existentes modificados:**
  - `frontend/src/app/router.jsx`: `/reportes/ventas` dentro de `RoleRoute` exclusivo de Administrador.
  - `frontend/src/constants/navigation.js`: Reportes conserva nombre/icono/posición; hijos `reporte-ventas` (CU38, Administrador) y `reporte-historial` (CU40, Administrador/Regente). Regente recibe como destino del paquete `/inventario/movimientos`; Vendedor no ve Reportes ni accede a esas consultas. Sin CU39/CU41 ni landing `/reportes`.
  - `frontend/src/features/inventario/pages/MovimientosPage.jsx`: conserva página/Service/contrato existentes; transmite intención `sidebarItemKey` al cambiar filtros.
  - `frontend/src/hooks/useConsultaAutomatica.js`: único ajuste compartido justificado por CU40: cuarto argumento opcional `navigationState`, utilizado exclusivamente por Movimientos al reemplazar la query. Antes se perdía la intención al filtrar; ahora se conserva sin tocar consultas/filtros de otros módulos. `useConsulta`, AppSidebar y su algoritmo no se modificaron.
- **Interacción:** `leerConsultaReporte` distingue sinPeriodo/invalida/valida; `useConsulta` recibe la habilitación como cuarto argumento. No se serializan estados deshabilitados ni se hace GET al entrar/Limpiar sin período. Buscar valida, aplica y reinicia página; repetir los mismos criterios refresca. Actualizar, paginar y cambiar límite usan solo URL aplicada y conservan borrador pendiente; cambiar límite reinicia página. Limpiar quita query/resultados y vuelve a página 1/límite 25 sin GET. Recarga y Atrás/Adelante restauran URL/borrador; no se envían `tipoPeriodo`, mes actual ni opcionales vacíos. `limite=7` permanece seleccionable.
- **Históricos y retorno:** filtro ANULADA incluye ambas categorías devueltas sin filtrado local; categorías excluidas permanecen visibles con ceros. El resumen se conserva en vacío/página lejana, nunca se reajusta página automáticamente; primera página es acción explícita. Durante carga/error se retiran resumen/detalle, respuestas tardías se ignoran. Los links a `/ventas/:idVenta` transportan `reporteVentasQuery` y `sidebarItemKey` en state; la ficha operativa no los consume como retorno propio: **volver al reporte mediante Atrás del navegador** (indicado en UI y verificado). No se alteró la ficha ni su enlace de retorno operativo.
- **CU40:** entrada desde Reportes activa solo `Historial de inventario`; desde Inventario activa solo `Consultar movimientos de inventario`. Filtrar/Limpiar conserva el origen, Atrás/Adelante recupera intención y un enlace directo sin state usa Inventario canónico. Sin duplicar `MovimientosPage` ni `getMovimientos`; no se le impuso período obligatorio, modalidades ni resumen de Reportes.
- **Comandos/resultados desde `frontend`:**
  - `node --test tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-navegacion.test.mjs` → **16 aprobadas, 0 fallidas, 0 omitidas** (incluye las tres subpruebas de servicios heredadas).
  - `node --test tests/reportes-ventas.browser.test.mjs` → **13 aprobadas, 0 fallidas, 0 omitidas** (12 escenarios + contenedora). Cubre entrada/Limpiar sin GET, URL válida/inválida estricta, tres modalidades/futuros/rango invertido, ANULADA y categorías, resumen completo independiente de detalle, límite 7, Buscar/Actualizar/paginación/límite con borrador, vacíos/página lejana, links/recarga/historial, errores 400/401/403/500/red, retiro de datos/bloqueo durante carga y respuestas fuera de orden/tras salida. Roles/accesos directos, navegación CU40 única/query/historial/móvil, labels/caption/scope/región de tabla/Tab/Escape y ausencia de desbordamiento a 1366 y 375 px. Fechas civiles verificadas con zona cliente Asia/Tokyo, importes mayores al entero seguro y null.
  - Durante desarrollo se corrigieron dos errores de comillas del test y una expectativa de historial: React Router reemplaza al enlazar al mismo destino; Atrás/Adelante se verifica con URLs distintas. No se cambió Router para forzar historial artificial.
  - `pnpm build` → aprobado, 237 módulos, sin avisos del compilador. `git diff --check` → código 0, sin errores de espacios; solo avisos LF→CRLF sobre archivos previos y modificados. Los seis archivos nuevos de Fase 2 y este plan sin seguimiento también se revisaron con `git -c core.autocrlf=false diff --no-index --check -- /dev/null <archivo>` → sin salida de errores (código 1 esperado por diferencia frente al vacío). Revisados contenido y `git status --short`; no aparecen archivos generados inesperados.
- **Evidencia y límites:** todo lo funcional se verificó en frontend con **API simulada**, no integración real ni aceptación completa de Reportes. Lectura estática backend únicamente; **sin conexiones a backend/MySQL**, login/cookies reales, fixtures, escrituras/auditoría ni limpieza de DB. El arnés elimina solo su perfil/compilación temporal. Roles se simulan en recuperación de sesión; no se acredita revocación real ni transición de rol en una sesión backend viva. Pruebas de accesibilidad/responsive automatizadas focalizadas, no auditoría exhaustiva con lector de pantalla ni revisión visual manual. Sin suites backend/globales, instalaciones, capturas, navegadores manuales, commits, push o despliegue.
- **Preservación:** cambios previos de backend/documentación y archivos sin seguimiento de Fase 1 intactos; solo se añadieron componentes/pruebas frontend indicados, cuatro modificaciones frontend existentes y este documento como único cambio documental. Fases 3–6 no iniciadas; no se publican CU39/CU41.
- **Siguiente fase habilitada: Fase 3, NO iniciada.** Lectura mínima: este cierre, §3/§6 y Fase 3; `ReporteVentasPage`, `ReporteFilters`, `ReporteVentasResultado`/CSS, `reporte.service.js`/`consultaReporte.js` y pruebas reportes; tabla/detalle de Compras solo para presentación/enlaces, router/navigation para CU39 exclusivo de Administrador. Cargar `frontend-design` y extender la base sin duplicar páginas completas ni tocar el contrato CU40. Integración real sigue requiriendo autorización posterior.

### Fase 3 — 20/11/2026 — COMPLETADA (frontend/API simulada)

- **Alcance y dependencias:** ejecutada exclusivamente CU39 sobre Fase 2. Leídos AGENTS raíz/frontend y backend (para contraste estático), §6, Fase 3 y cierre anterior; revisados todos los módulos/pruebas de Reportes antes de reutilizarlos. Lectura mínima funcional: contexto §39, RF36/contrato común, RN97/RN99 y CU39; `CompraTable`/`CompraDetailPage` solo para presentación/enlaces. Validator/Service backend vigentes coinciden con §6; ninguna modificación backend ni de contratos.
- **Skill `frontend-design`: utilizada conservando identidad.** Se mantiene el plan visual de Fase 2: fondo `#f3f5f7`, superficie `#ffffff`, texto `#252930`, secundario `#555f6b`, línea `#dce2e8` y foco `#9b5b00`, todos heredados de las variables existentes (no se crea otro tema). Segoe UI Variable/Aptos/Segoe UI y escala existentes; alineación izquierda, importes a la derecha. Orden encabezado → filtros → toolbar → período/resumen → detalle → paginación. Revisión del plan: no se añaden tarjetas, gráficos, fuentes, tokens o decoración; se extienden únicamente selectores locales para que compras conserve la misma tabla desplazable, foco y responsive de ventas.
- **Archivos/símbolos creados:**
  - `frontend/src/features/reportes/pages/ReporteComprasPage.jsx`: página CU39 con `getReporteCompras`, textos sobre adquisición y resultados específicos.
  - `frontend/src/features/reportes/components/ReporteComprasResultado.jsx`: `ReporteComprasResumen`/`ReporteComprasTable`, estados confirmadas/anuladas con cantidad e importe y `totalComprasRealizadas` del servidor; período normalizado/zona, estado aplicado y detalle con ID de proveedor, fechas civiles y enlaces existentes.
  - `frontend/src/features/reportes/components/ReporteOperacionesConsulta.jsx`: extracción mínima del coordinador anterior de `ReporteVentasPage`; compartido solo por CU38/CU39 mediante tipo, servicio, textos y componentes de resultado. No es motor genérico, no introduce configuración de columnas/fórmulas, hooks globales ni almacenamiento nuevo.
- **Archivos modificados:** `ReporteVentasPage.jsx` queda como composición de ese coordinador con su servicio/resumen/tabla previos. `ReporteFilters.jsx` adapta labels y ofrece PENDIENTE solo en ventas; compras admite únicamente CONFIRMADA/ANULADA. `styles/reportes.css` amplía los selectores existentes a ambas páginas. `frontend/src/app/router.jsx` monta `/reportes/compras` bajo RoleRoute de Administrador; `frontend/src/constants/navigation.js` agrega CU39 entre CU38/CU40 y su título, sin cambiar algoritmo/sidebar. `tests/reportes-navegacion.test.mjs` actualiza la entrega incremental y `tests/reportes-ventas.browser.test.mjs` conserva su nombre y reutiliza el arnés para ambas consultas secuencialmente, con fixtures/aserciones CU39 específicos. Servicios, utilidades, hooks globales, MovimientosPage y compras operativas no fueron modificados.
- **Interacción:** habilitación como cuarto argumento de `useConsulta`; ningún estado deshabilitado se serializa/consulta. Entrada/Limpiar sin período no emiten GET, no hay mes actual ni tipoPeriodo. Buscar valida/aplica URL y reinicia página, repetir refresca; Actualizar/paginar/límite usan la URL aplicada preservando borrador pendiente. Recarga/Atrás/Adelante restauran criterios; límite 7 válido. URL desconocida/repetida/inválida se rechaza sin sanear ni consultar. Resumen y detalle anteriores se retiran al cargar/fallar; respuestas tardías se descartan con el hook existente. Vacío y página lejana mantienen resumen; retorno a primera página solo explícito.
- **Representación histórica:** adquisición `fechaCompra`/`fechaReferencia` DATEONLY, registro y anulación diferenciados, sin Date/UTC. Se usan `fechaCivil`, `horaCivil`, `cantidad`, `costoDecimal`; importes textuales grandes e iguales, ceros y null sin Number/parseFloat ni recálculo monetario. Resumen completo del servidor independiente de la página; total realizado solo confirmadas, anuladas positivas informativas sin descontarlas. No se consulta proveedores para enriquecer filas ni se inventan nombres.
- **Navegación/retorno:** Administrador dispone de CU38 → CU39 → CU40; Regente conserva solo CU40 en Reportes y no accede directamente a CU39; Vendedor no accede a Reportes. CU41 sigue sin publicar y no hay landing vacía. CU40 conserva `MovimientosPage`/`getMovimientos`, filtros e intención `sidebarItemKey`. Enlaces `/compras/:idCompra` transportan `reporteComprasQuery` y `sidebarItemKey` siguiendo CU38. La ficha operativa no consume ese contexto para su propio enlace de retorno: **usar Atrás del navegador**, indicado en UI y comprobado; no se modificó su retorno a Compras ni sus permisos/acciones.
- **Comandos/resultados desde `frontend`:**
  - `node --test tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-navegacion.test.mjs` → **16 aprobadas, 0 fallidas, 0 omitidas** (incluye tres subpruebas de transporte heredadas).
  - `node --test tests/reportes-ventas.browser.test.mjs` → **26 aprobadas, 0 fallidas, 0 omitidas** (12 escenarios por consulta + dos contenedoras). CU38/CU39: período obligatorio/entrada/Limpiar sin GET; URLs estrictas, límite 7, modalidades y estados; adquisición distinta de registro/anulación; importes iguales/grandes exactos, null y fechas bajo cliente Asia/Tokyo; resúmenes invariantes al paginar con detalle reducido y página lejana, vacíos; Buscar frente a Actualizar/paginación/límite con borrador; fichas/recarga/historial; 400/401/403/500/red sin datos viejos/reintentos; carga/bloqueo y respuestas fuera de orden/tras salida. Roles/acceso directo y regresión CU40 desde ambos paquetes/query/Atrás/Adelante; labels, caption/scope/región enfocable, Tab/Escape y viewport sin desbordamiento a 1366/375 px. No endpoints no simulados ni métodos distintos de GET.
  - `pnpm build` → aprobado, **240 módulos**, sin avisos del compilador.
  - `git diff --check` y revisión adicional de archivos frontend de Reportes y este documento sin seguimiento: verificación de espacios y contenido al cierre, sin archivos generados inesperados; se conservan los avisos de normalización LF/CRLF de archivos existentes.
- **Evidencia/límites:** solo frontend con API y sesión **simuladas**, no integración real. No se inició ni conectó backend/MySQL, no hubo login/cookies reales, fixtures ni escrituras/auditoría/limpieza de DB. Backend solo leído estáticamente. El arnés CDP headless compila/serve frontend temporal, intercepta API y elimina únicamente su perfil/compilación; sin capturas ni navegadores manuales. Roles comprobados con recuperación de sesión simulada, no revocación viva. Accesibilidad/responsive automatizados focalizados, no auditoría exhaustiva ni lector de pantalla/revisión visual manual. Límites backend §6.7 intactos; Fases 5–6 no ejecutadas por estas regresiones localizadas.
- **Preservación:** cambios previos y archivos sin seguimiento de backend, documentación y frontend conservados. Único documento actualizado: `docs/ai/fases.md`. Sin suites backend/globales, dependencias, subagentes, commits, push o despliegue.
- **Siguiente fase habilitada: Fase 4, NO iniciada.** Lectura mínima: este cierre, §3/§6 y Fase 4; `ReporteOperacionesConsulta`, páginas/composición CU38/CU39, filtros/resultados/CSS y servicios/utilidades/pruebas Reportes; `presentacion.js`, contrato de pérdidas y navegación; CU40 solo como referencia de enlaces, sin duplicarlo. Cargar `frontend-design`; no asumir que el coordinador exclusivo CU38/CU39 deba convertirse en motor para pérdidas. Integración real requiere autorización posterior independiente.

### Fase 4 — 20/11/2026 — COMPLETADA (frontend/API simulada)

- **Alcance/dependencias:** ejecutada exclusivamente Fase 4/CU41. Leídos AGENTS raíz/frontend y backend para contraste estático, §6/Fase 4/cierre Fase 3 y base/pruebas Reportes existentes antes de reutilizarlas. Consultadas secciones vinculadas contexto §39, RF38, RN101 y CU41; Validator/Service/Router backend coinciden con el contrato. Sin modificar backend, contratos, operaciones ni consultas de otros módulos.
- **Skill `frontend-design`: utilizada sin rediseño.** Se conserva fondo `#f3f5f7`, superficie `#ffffff`, texto `#252930`, secundario `#555f6b`, línea `#dce2e8` y foco `#9b5b00` mediante variables existentes; Segoe UI Variable/Aptos/Segoe UI, espaciado y componentes actuales. Orden encabezado → filtros → toolbar → período/resumen → detalle → paginación. Revisión del plan: sin dashboard, tarjetas, fuentes, tokens ni decoración nuevos. Tabla horizontal enfocable/etiquetada, caption/scope, cantidades/importes a la derecha y responsive heredado; CSS extendido solo a la página de pérdidas.
- **Archivos/símbolos nuevos:**
  - `frontend/src/features/reportes/pages/PerdidasPage.jsx`: coordinación visual propia CU41, estados, consulta explícita, resumen, detalle y paginación.
  - `frontend/src/features/reportes/components/PerdidasResultado.jsx`: `PerdidasResumen` y `PerdidasTable`, resumen completo por vencimiento/daño/global, campos históricos y trazabilidad por existencia/medicamento.
  - `frontend/src/features/reportes/hooks/useReporteConsulta.js`: extracción mínima de interacción URL/borrador desde el coordinador CU38/CU39, reutilizada por pérdidas. Conserva habilitación como cuarto argumento de `useConsulta`, guardas y descarte de respuestas tardías; solo selecciona el opcional `estadoOperacion`/`motivo`, sin definir tablas, cálculos ni resultados.
- **Archivos modificados:** `ReporteOperacionesConsulta.jsx` delega solo esa interacción al hook y **sigue exclusivo CU38/CU39**, sin convertirse en motor de pérdidas. `ReporteFilters.jsx` agrega motivo y conserva el opcional al cambiar modalidad, retirando fechas incompatibles; `styles/reportes.css` extiende selectores locales. `app/router.jsx` monta `/reportes/perdidas` bajo Administrador/Regente; `constants/navigation.js` publica CU41 tras CU40 y su título. `tests/reportes-navegacion.test.mjs` refleja el paquete completo; `tests/reportes-ventas.browser.test.mjs` conserva nombre/arnés y agrega fixtures/aserciones CU41, ejecutando secuencialmente las tres consultas. No se modificaron servicios, utilidades de contrato/presentación, hooks globales, sidebar, MovimientosPage/getMovimientos ni páginas operativas.
- **Interacción:** sin GET al entrar o Limpiar sin período, sin mes predeterminado ni tipoPeriodo. URL aplicada separada del borrador; Buscar valida/aplica/reinicia página, repetir refresca. Actualizar/paginar/límite usan criterios aplicados sin aplicar ni destruir edición pendiente (incluido motivo); límite reinicia página. Recarga/Atrás/Adelante recuperan URL. Desconocidos/repetidos/inválidos se rechazan sin consulta ni saneamiento silencioso; estados deshabilitados no se serializan. `limite=7` válido y DAÑO codificado con URLSearchParams, nunca DANO. Carga/error retiran resumen/detalle; respuestas tardías no reaparecen. Vacío/página lejana conservan resumen y ofrecen retorno explícito a página 1, sin reajuste automático.
- **Pérdidas:** muestra retiros brutos originales SALIDA por VENCIMIENTO/DAÑO; excluye conceptualmente ajustes/ventas/compensaciones conforme a selección backend, sin filtrar/recalcular filas en React. Referencia `idMovimientoReversion` o ausencia sin descuento ni botón operativo. Costos a seis decimales (cero válido), importes a dos y cantidades agregadas textuales exactas mediante utilidades existentes, sin Number/parseFloat/toFixed ni promedio actual. Dos filas 0.01 y resumen 0.02 se muestran desde el servidor. Categorías filtradas permanecen visibles en cero. No se excluyen históricos por actividad/saldo ni se enriquecen filas consultando otros módulos. Nota explícita sobre cantidades heterogéneas y códigos/nombres actuales frente a valores históricos.
- **Permisos/navegación:** Administrador CU38 → CU39 → CU40 → CU41; Regente CU40 → CU41 (sin CU38/CU39); Vendedor sin Reportes/acceso directo. Padre conserva destino disponible por rol y no hay landing vacía. CU40 mantiene página/servicio/filtros/sidebarItemKey. Trazabilidad a `/inventario/movimientos?idExistencia=…&idMedicamento=…`, filtros verificados; estado `reportePerdidasQuery` y `sidebarItemKey: reporte-historial`. No existe ni se inventa ficha de movimiento. **Retorno con Atrás del navegador**, indicado en UI y probado para Administrador/Regente: el historial no consume el contexto para crear un enlace de retorno propio y puede conservar solo su intención al cambiar filtros; no se extendió su comportamiento operativo.
- **Comandos/resultados desde `frontend`:**
  - `node --test tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-navegacion.test.mjs` → **16 aprobadas, 0 fallidas, 0 omitidas**, incluidas tres subpruebas de transporte.
  - `node --test tests/reportes-ventas.browser.test.mjs` → **40 aprobadas, 0 fallidas, 0 omitidas** (37 escenarios + tres contenedoras). Última ejecución tras añadir recorrido Regente/historial/retorno y publicación móvil. Cubre período obligatorio/Limpiar/default 25 sin GET; URL válida/inválida/DAÑO/límite 7; modos, motivos/categorías en cero; borrador pendiente frente a Buscar/Actualizar/paginación/límite; resumen invariante con detalle reducido; cantidades > entero seguro; costo cero/seis decimales; dos filas 0.01/resumen 0.02; referencia de reversión presente/null; históricos inactivos/agotados sin endpoints de enriquecimiento; fechas civiles bajo Asia/Tokyo/null/importes grandes; vacíos/página lejana; 400/401/403/500/red, carga y respuestas tardías; roles/acceso directo/recarga/historial y enlaces/retorno; labels/fieldset/caption/scope/región, Tab/Escape, escritorio 1366 px/móvil 375 px y navegación móvil. Regresión localizada CU38/CU39/CU40 por extracción del hook/filtros/CSS/navegación compartidos.
  - `pnpm build` → aprobado, **243 módulos**, sin avisos del compilador.
  - `git diff --check` y revisión de contenido/espacios de archivos sin seguimiento de Reportes/pruebas/este plan al cierre; sin errores de espacios. Avisos Git LF→CRLF heredados no son fallos de build ni de pruebas.
- **Evidencia y límites:** estática + unitarias/transporte + frontend con API/sesión **simuladas**, no integración real. El arnés CDP headless compila/serve frontend temporal, intercepta API y bloquea métodos/endpoints no simulados; no abre navegadores manuales ni genera capturas. Histórico inactivo/agotado se representa sin campos de actividad/saldo (no existen en el DTO) y sin consultas adicionales: la selección efectiva en DB no se acredita con estos mocks. Los extremos monetarios/cantidades son sintéticos; no se atribuyen a aceptación MySQL. Accesibilidad/responsive automatizados focalizados, no auditoría exhaustiva ni lector de pantalla/revisión visual manual. Permisos mediante sesión simulada, no cookies reales ni revocación viva. Límites backend §6.7 intactos.
- **Ausencia de acceso backend/MySQL:** solo lectura estática de fuentes, sin iniciar/conectar backend, suites backend/globales, login real, fixtures, escrituras, auditoría o limpieza de DB. El arnés limpia únicamente su propio perfil/build temporal. Sin dependencias nuevas, subagentes, commits, push o despliegue.
- **Preservación:** cambios locales ajenos, incluidos todos los archivos sin seguimiento de backend/documentación/frontend, conservados. Único documento actualizado: `docs/ai/fases.md`.
- **Siguiente fase habilitada: Fase 5, NO iniciada.** Fases 5–6 permanecen pendientes; las regresiones anteriores son verificaciones focalizadas de esta entrega, no ejecución de la Fase 5. Lectura mínima: este cierre, §3/§6/§6.7 y Fase 5; `useReporteConsulta`, `PerdidasPage`/`PerdidasResultado`, filtros/CSS, coordinador CU38/CU39 y pruebas `reportes-*`; router/navigation y CU40 solo si la regresión lo necesita. Integración real requiere autorización posterior independiente.

### Fase 5 — 20/11/2026 — COMPLETADA (frontend/API y sesión simuladas)

- **Preparación y alcance:** ejecutada exclusivamente la verificación conjunta CU38–CU41 desde frontend, sin subagentes. Leídos AGENTS raíz/frontend, §6/§6.7/Fase 5/cierre Fase 4; revisados hook, coordinador exclusivo CU38/CU39, las tres páginas, filtros/resultados/CSS, servicios/utilidades y las cuatro pruebas `reportes-*` antes de ejecutarlas. Router/navigation/sidebar/Pagination/useConsulta y MovimientosPage/getMovimientos se inspeccionaron solo para esta regresión. Consultadas fuentes funcionales relacionadas contexto §39, RF35–RF38, RN97–RN101 y CU38–CU41. No surgió discrepancia contractual que exigiera inspección backend; no se leyeron ni modificaron sus fuentes en esta fase.
- **Defecto demostrado y corregido:** con URL válida `?mes=2026-11`, pulsar Buscar sin editar canonizaba a `mes=2026-11&pagina=1&limite=25`, invalidaba la respuesta anterior y dejaba carga indefinida sin GET: la URL cambiaba, pero la clave canónica de `useConsulta` permanecía igual y su efecto no volvía a ejecutarse. Afectaba CU38/CU39/CU41; también era reproducible con parámetros reordenados. En `frontend/src/features/reportes/hooks/useReporteConsulta.js`, `cambiarConsulta` ahora solicita una revisión explícita si cambia la URL sin cambiar la clave. Mantiene canonización, borrador, intención de navegación y una sola petición; no modifica `useConsulta` ni otros hooks globales.
- **Archivos modificados en esta sesión:** únicamente ese hook, `frontend/tests/reportes-ventas.browser.test.mjs` y este documento. No se crearon archivos nuevos adicionales. `ReporteOperacionesConsulta` sigue exclusivo CU38/CU39; pérdidas conserva su página/resultados propios. Sin cambios de router, sidebar, CSS, servicios, cálculos, permisos operativos o módulos ajenos.
- **Skill `frontend-design`: cargada antes de corregir la interacción UI y aplicada sin rediseño.** Plan conservador: conservar paleta existente (fondo `#f3f5f7`, superficie `#ffffff`, texto `#252930`, secundario `#555f6b`, línea `#dce2e8`, foco `#9b5b00`), tipografía Segoe UI Variable/Aptos/Segoe UI, alineación izquierda y números a la derecha. Se revisó contra el alcance y se descartó cualquier cambio visual: siguen encabezado → filtros → toolbar → período/resumen → tabla → paginación. No se tocaron estilos, markup, orden, tokens ni dimensiones; ninguna captura o inspección manual de navegador.

#### Cobertura ejecutada y ampliada

- **Reejecutada, no atribuida como nueva:** cobertura heredada completa de URL estricta (desconocidos, repetidos, inválidos, modalidades incompatibles), calendario gregoriano, bisiestos/futuros/extremos, entrada y Limpiar sin GET, Día/Mes/Período, DAÑO con URLSearchParams y límite 7. URL aplicada frente a borrador, Buscar/Actualizar/página/límite, recarga/Atrás/Adelante, trazabilidad y retorno. Resumen completo independiente de detalle paginado, categorías filtradas visibles con cero, vacío/página lejana sin reajuste automático. Fechas civiles/null e importes grandes textuales exactos; CU41 cantidades agregadas > entero seguro, costos a seis decimales/cero, dos filas 0.01/resumen 0.02 del servidor, referencia de reversión presente/null sin descuento e históricos conservados sin enriquecimiento.
- **Ampliación real del mismo arnés:** 16 escenarios adicionales (cinco por consulta y uno conjunto): extremos 1000/9999 introducidos por formulario y rango completo, rechazo en navegador de modalidades mezcladas; nuevas cargas renderizadas bajo `Pacific/Honolulu`, `Asia/Tokyo` y `America/La_Paz`, comparando tabla y resumen completos; bloqueo efectivo de clicks duplicados de Buscar/Actualizar y paginación/límite durante respuestas retenidas; regresión explícita Buscar con defaults omitidos, parámetros reordenados y URL canónica, una sola petición; teclado real Enter/Tab desde paquete contraído, foco visible y selección única; recorrido conjunto Administrador CU38 → CU39 → CU40 → CU41 y Regente CU40 → CU41 desde destino del dashboard por rol, Vendedor sin acceso de paquete. El arnés de ventas admite únicamente los otros dos GET simulados necesarios para ese recorrido; el de pérdidas mantiene su guarda sin enriquecimiento.
- **Roles/CU40 y regresión localizada:** accesos directos permitidos/denegados para los tres roles y sin sesión; menú/destinos por rol, sin landing vacía. CU40 conserva MovimientosPage/getMovimientos, filtros propios, consulta sin período obligatorio y `sidebarItemKey`; acceso desde Inventario/Reportes, selección única, cambio/limpieza de query, Atrás/Adelante y origen canónico de enlace directo. No se alteró la consulta existente para satisfacer Reportes.
- **Errores y asincronía:** 400/401/403/500/red sin datos anteriores ni reintentos automáticos observados; mensajes técnicos seguros, login para 401, bloqueo para 401/403. Carga retira resumen/detalle, controles bloquean duplicados; respuestas fuera de orden y tras salir no reaparecen. Cambio de rol comprobado mediante nueva recuperación de sesión simulada, no revocación viva.
- **Accesibilidad/responsive focalizados:** labels, fieldsets/legend, estados `aria-live`/`aria-busy`, caption/scope y región de tabla etiquetada/enfocable. Extendida la prueba existente con desplazamiento horizontal por ArrowRight a 375 px, Enter en menú/enlace, foco visible y ciclo Shift+Tab/Tab dentro del menú móvil, Escape/restauración del foco. Sin desbordamiento del documento a 1366/375 px, cierre móvil al navegar y paquete contraído de escritorio. No equivale a auditoría exhaustiva WCAG, lector de pantalla o revisión visual humana.

#### Comandos, resultados y avisos

Desde `frontend`, secuencialmente para el arnés de navegador:

- `node --test tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-navegacion.test.mjs` → **16 aprobadas, 0 fallidas, 0 omitidas**, ejecutado al inicio y nuevamente tras la corrección. Incluye tres subpruebas de transporte.
- `node --test tests/reportes-ventas.browser.test.mjs` → base original **40/40** ejecutada antes de ampliar. La ampliación inicialmente dio **42 aprobadas/11 fallidas** contando contenedoras: reprodujo el defecto de canonización y fallos en cascada por respuesta planificada pendiente; además el evento Enter del nuevo test CDP necesitaba `code`/`text: '\r'` para producir la acción nativa, sin defecto de sidebar. Diagnóstico reducido `node --test --test-skip-pattern="compras:|perdidas:|Recorrido|Paquete" tests/reportes-ventas.browser.test.mjs` → **13 aprobadas/3 fallidas**, confirmó URL canonizada, carga activa y cero petición nueva. Tras corregir el hook: **47/6**, quedando solo Enter del arnés y contenedoras; corregida esa emisión: **53/53**. Se retiró el diagnóstico temporal y se añadieron regresiones explícitas de equivalencia URL.
- **Última ejecución completa:** `node --test tests/reportes-ventas.browser.test.mjs` → **56 aprobadas, 0 fallidas, 0 omitidas** (53 escenarios + tres contenedoras), sin errores JS ni peticiones no simuladas; solo GET. La suma final de ambos comandos focalizados es **72 pruebas aprobadas** contando sus contenedoras/subpruebas, no 72 escenarios de navegador. No se suman intentos anteriores ni se ocultan sus fallos ya resueltos.
- `pnpm build` → **aprobado, 243 módulos, sin avisos del compilador**.
- `git diff --check` → código 0, sin errores de espacios; avisos Git heredados LF→CRLF en archivos previamente modificados, no fallos del frontend. Revisión adicional de contenido y espacios de todos los archivos sin seguimiento de la feature Reportes, cuatro pruebas y este plan con `git -c core.autocrlf=false diff --no-index --check -- /dev/null <archivo>`: sin errores; código 1 esperado por diferencia frente al vacío. Ningún archivo generado inesperado en el estado Git final.

#### Evidencia, límites y continuidad

- **Solo frontend con API y sesión simuladas**, no integración real. CDP headless sobre build/servidor estático temporal, API interceptada y métodos/endpoints no simulados rechazados. No se inició ni conectó backend/MySQL, ni se ejecutaron suites backend/globales, login/cookies reales, fixtures, escrituras, auditoría o limpieza de DB. El arnés elimina únicamente su perfil/build temporal. Sin dependencias nuevas, subagentes, capturas, navegadores manuales, commit, push o despliegue.
- Históricos inactivos/agotados y extremos monetarios/cantidades son sintéticos; el DTO no contiene actividad/saldo y React no consulta para excluirlos. No demuestra selección SQL, precisión persistida, cantidades reales > entero seguro, concurrencia real, auditoría persistida, privilegios mínimos ni rendimiento. **Todos los límites backend de §6.7 siguen vigentes**, sin aceptación total atribuida al build o mocks.
- Retorno desde fichas/historial: se mantiene **Atrás del navegador**, probado con el contexto/URL, sin adaptar el enlace operativo de retorno ni extender otros módulos. Pendientes manuales: revisión visual/lector de pantalla y navegadores/dispositivos adicionales; autenticación/cookies y consumo real solo dentro de aceptación integrada expresamente autorizada. No quedan defectos frontend demostrados abiertos en los escenarios ejercidos.
- Cambios locales ajenos de backend/documentación/frontend preservados, incluidos archivos sin seguimiento; `git status --short` comprobado antes y al cierre. **Único documento actualizado: `docs/ai/fases.md`.**
- **Fase 6 habilitada por dependencias frontend, NO INICIADA.** Requiere autorización nueva e independiente para cualquier integración real y entorno aislado; esta sesión no la concede ni la ejecuta. Lectura mínima para continuar: este cierre y cierres 1–4 solo en lo pertinente, §6/§6.7/Fase 6, `useReporteConsulta` y pruebas `reportes-*`; router/navigation y CU40 únicamente si hace falta contrastar navegación. Antes de conectar, revisar guardas/arnés integrado y acordar explícitamente entorno, datos sintéticos y alcance de auditoría/limpieza.

### Fase 6 — 20/11/2026 — COMPLETADA en el alcance integrado frontend autorizado, con límites

#### Preparación, autorización y archivos

- Antes de conectar se leyeron AGENTS raíz/frontend/backend, contrato §6 y límites §6.7, cierres y Fase 6; `useReporteConsulta`, las cuatro pruebas `reportes-*` existentes y la regresión Buscar con defaults omitidos/orden distinto/URL canónica. Consultadas únicamente referencias funcionales RF35–RF38/RI12, RN91/RN92/RN97–RN101, CU38–CU41 y contexto §39; arnés `ventas-recetas-real.browser.test.mjs`, helper `navegadorReal.mjs` y guardas `backend/tests/helpers/reportes-mysql.js`, sin ejecutar sus suites operativas.
- `git status --short` comprobado al inicio y cierre: todo el trabajo local previo, incluidos archivos sin seguimiento de backend/frontend/documentación y este plan, preservado. No se modificó backend, modelos, migraciones, permisos, Services operativos ni código de producción frontend.
- Preparación previa sin conexión: Node v24.18.0/Windows; comprobación sanitizada de configuración local/3306, no producción, credenciales técnicas configuradas y opt-in ausente (solo booleanos, sin valores privados). Se propuso explícitamente loopback, esquema nuevo aleatorio, migraciones existentes, fixtures directos sintéticos, login/consultas/auditoría y limpieza. El usuario respondió **«si, autorizo el alcance»** antes de la primera conexión. No se heredó autorización histórica.
- **Archivo creado:** `frontend/tests/reportes-real.browser.test.mjs`, siete escenarios y una contenedora. Reutiliza helpers existentes sin alterarlos. Exige opt-in externo antes de cargar configuración, rechaza producción, aplica guardas de host/puerto/esquema nuevo del helper MySQL; comprueba destino del ORM y tablas InnoDB. Borde HTTP del test permite solo GET acotados, POST login y preflight; bloquea operaciones de negocio. Express auténtico, build React/Axios auténtico y sesiones CDP headless independientes, sin DTOs/cookies/HTTP simulados.
- **Único documento modificado:** `docs/ai/fases.md`. Skill `frontend-design`: no aplica; no se detectó defecto de UI ni se alteraron interfaz, estilos, identidad visual o interacción. No se añadieron dependencias, scripts globales, capturas, navegadores manuales, subagentes, commits, pushes o despliegues.

#### Entorno y contraste real

- MySQL Community Server **8.0.46**, `127.0.0.1:3306`, **17 tablas InnoDB** tras migraciones existentes, sin `sync`. Frontend/Express en puertos efímeros `127.0.0.1`, CORS real y cookie HttpOnly/SameSite Lax. Perfil/build temporal bajo `%LOCALAPPDATA%/Temp/opencode`, sin usar la configuración VITE operativa para el destino del test.
- Fixtures directos exclusivamente en cada esquema nuevo: tres usuarios sintéticos con contraseña aleatoria en memoria/hash bcrypt y JWT secret efímero; proveedor/producto inactivos, existencia vencida, cuatro categorías de ventas, dos estados de compras, tres retiros originales y referencia de reversión posterior. No hay datos personales, cuentas reales, Railway, bases preexistentes, formularios de compra/venta/retiro ni ejecución de Services operativos de escritura.
- Los fixtures no representan aceptación de creación/anulación operativa: los totales históricos de cabecera se fijan expresamente, independientes del detalle sintético mínimo de trazabilidad. Expectativas literales: cada categoría de venta y compra tiene una operación de **12345678.91**; solo confirmadas forman total realizado. Pérdidas: dos retiros de vencimiento a costo **0.005000**, cada uno informado como **0.01**, resumen **0.02**; daño retira tres unidades a costo **0.000000**, pérdida **0.00**; cantidad agregada textual **'5'**. Reversión de un original fuera del período informada sin descontar. No se reimplementa fórmula ni aritmética monetaria en el test o React.
- Verificados: login React de tres roles y recuperación real por cookie tras recarga, token inaccesible a `document.cookie`, sin almacenamiento web; Administrador CU38 → CU39 → CU40 → CU41 y Regente CU40 → CU41 desde Reportes, selección única. Regente sin CU38/CU39 tanto en navegación/ruta como API; Vendedor sin paquete/rutas ni endpoints de los cuatro CU. Consulta sin sesión produce 401 real.
- CU38/CU39/CU41: sin GET al entrar sin período o Limpiar; día por formulario, mes/rango por URL, todos los filtros de estado/motivo, DAÑO codificado, resumen completo comparado con literales y con texto DOM, detalle/páginas 1–2 a límite 1, página 100/límite 7 con resumen intacto, vacío con ceros y sin reajuste automático. Importes/costos/cantidades textuales, null y fechas civiles a segundos contrastados en celdas; nueva carga bajo Honolulu/Tokyo sin desplazamiento civil. Compras mantiene adquisición distinta del registro/anulación. Buscar con defaults omitidos/parámetros reordenados/URL canónica provoca exactamente una consulta real y canoniza URL en los tres reportes.
- Trazabilidad real desde fichas de venta/compra y pérdidas al historial filtrado existente, con responsable/observación y cinco movimientos del fixture; CU40 conserva `MovimientosPage/getMovimientos` y su contrato sin período obligatorio. Retorno comprobado mediante **Atrás del navegador**, sin modificar enlaces operativos de retorno.
- Snapshot de todos los modelos de negocio idéntico antes/después de login y consultas. En la última ejecución, las sentencias de escritura observadas después de fixtures fueron únicamente **77 INSERT de auditoría**, sin UPDATE/DELETE/INSERT de negocio. **143 peticiones API observadas** (GET, tres POST login y sus preflight); cero endpoints/métodos no permitidos y cero errores JS. Eventos de reporte persistidos: **20 ventas, 19 compras, 21 pérdidas**; los otros INSERT pertenecen al flujo transversal de autenticación/rechazos. Eventos de reporte con metadato exclusivo `cantidadResultados`, sin snapshots. El SQL se inspecciona en memoria, no se vuelca al registro.

#### Comandos, resultados, intentos y limpieza

Desde `frontend`:

- `node --test tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-navegacion.test.mjs` → **16 aprobadas, 0 fallidas, 0 omitidas**: unitarias y transporte simulado, no integración real.
- `node --test tests/reportes-ventas.browser.test.mjs` → **56 aprobadas, 0 fallidas, 0 omitidas**, contenedoras incluidas: regresión React con API/sesión simuladas. Se conserva cobertura Fase 5 de errores 400/401/403/500/red, asincronía, accesibilidad, escritorio/375 px y cantidades/importes extremos; no se atribuye ese extremo al motor real.
- Comando integrado PowerShell: `$env:REPORTES_MYSQL_ACCEPTANCE='CREAR_MIGRAR_FIXTURES_ELIMINAR_LOCAL'; node --test tests/reportes-real.browser.test.mjs` → última ejecución **8 aprobadas, 0 fallidas, 0 omitidas** (siete escenarios más contenedora). Evidencia real, independiente de las **72 pruebas simuladas/unitarias**; no sumar intentos como nuevas pruebas.
- Se ejecutó el comando integrado cuatro veces, con esquema nuevo en cada ocasión. Primer intento **5 aprobadas/3 fallidas** contando contenedora: etiqueta esperada `Pérdidas` en vez de `Consulta de pérdidas`, y aserción que no admitía OPTIONS de CORS. Segundo **6/2**: faltaba navegar la sesión invitada desde about:blank al origen frontend antes de su fetch (CORS/origen del test). Corregido solo el test; tercer intento **8/0**. Se completaron aserciones de ceros/todos los filtros y la última ejecución fue nuevamente **8/0**. Ningún fallo acreditó defecto del frontend ni incompatibilidad backend.
- Avisos reales: Express emitió diagnósticos sanitizados esperados de 401/403/400 al probar rechazos; no se ocultaron como fallos técnicos ni se generaron artificialmente 500/cortes del auditor. `pnpm build` → **aprobado, 243 módulos, sin avisos del compilador**.
- Limpieza MySQL comprobada por DROP del esquema creado y SELECT de ausencia en los cuatro intentos: `cadefar_reportes_f6_743c4655f56693f2`, `cadefar_reportes_f6_6cf4ff7059af686d`, `cadefar_reportes_f6_d5433d7c5b7653d9`, `cadefar_reportes_f6_4218cfd7c68d9b4b`. Cerrados navegador/conexiones/servidores propios; perfil y build temporal eliminados por el arnés en cada intento. No se borraron datos históricos de ninguna base preexistente. La eliminación del esquema sintético es limpieza de fixtures, no una operación de negocio.
- `git diff --check` → código 0, sin errores de espacios; avisos heredados LF→CRLF en cambios locales previos. Revisado el contenido completo del nuevo test y este cierre; comprobación adicional de espacios de ambos archivos sin seguimiento mediante `git -c core.autocrlf=false diff --no-index --check -- /dev/null <archivo>` sin errores. Estado final sin archivos generados inesperados, solo nuevo test y actualización de este plan atribuibles a la sesión.

#### Límites, pendientes y estado final

- **Fase 6 frontend COMPLETADA en el alcance local integrado autorizado.** Fases 1–5 conservan su estado completado con evidencia simulada; ahora hay evidencia adicional real focalizada para CU38–CU41. No quedan bloqueos de compatibilidad o defectos frontend demostrados en lo ejercido. No significa aceptación backend total, datos operativos listos ni autorización para otra integración futura.
- **§6.7 permanece íntegro:** DATETIME(0) sin fracciones persistidas, cantidades reales no superiores al entero seguro en esta sesión, sin volumen/planes/rendimiento, sesión expirada/revocada no reejercida, sin cortes de red/servidor/COMMIT del auditor, privilegios mínimos operativos ni garantía de limpieza ante terminación forzada. No se repitió concurrencia ni auditoría fallida; su evidencia sigue siendo heredada/parcial, no ejecución de este test. Importes enormes/cantidades > entero seguro siguen comprobados solo en simulación, no por estos fixtures reales.
- Pendientes manuales: revisión visual humana/lector de pantalla, navegadores/dispositivos adicionales. Migraciones en entorno de uso, privilegios, respaldos y despliegue siguen fuera de alcance y requieren decisión independiente. No hay una fase siguiente iniciada automáticamente.

### Revisión final del módulo — 20/11/2026

- Solicitud posterior: revisar el módulo para completar su cierre. Se preservó el alcance aprobado: sin nuevas conexiones MySQL, ampliaciones backend, datos operativos, dependencias ni cambios visuales. La autorización de la aceptación anterior no se reutilizó. No se encontraron defectos demostrables que exigieran corrección ni se cambió código para mejorar artificialmente el resultado.
- Revisión estática de páginas/componentes/filtros, servicios, validación/serialización, `useReporteConsulta`/`useConsulta`, paginación, rutas, navegación por rol y Axios central. Se conserva consulta explícita, borrador separado, canonización/refresco, rechazo de URL inválida, retiro de datos obsoletos, estados restringidos sin reintento, fechas civiles, null, strings exactos y CU40 reutilizado. Las conversiones `Number` encontradas en utilidades de Reportes corresponden exclusivamente a calendario, página/límite y conteo de modalidades; ninguna convierte importes, costos o cantidades agregadas.
- Reejecutado `node --test tests/reportes-consulta.test.mjs tests/reportes-services.test.mjs tests/reportes-navegacion.test.mjs`: **16/16 aprobadas**. Reejecutado después `node --test tests/reportes-ventas.browser.test.mjs`: **56/56 aprobadas**. Total de esta revisión: **72 aprobadas, 0 fallidas, 0 omitidas**, con API/sesión simuladas y contenedoras incluidas. Incluye regresión Buscar/defaults/orden/URL canónica, roles, errores, asincronía y accesibilidad/responsive automatizados a 1366/375 px. No se acredita revisión visual humana ni lector de pantalla con esas pruebas.
- `pnpm build`: **aprobado, 243 módulos, sin avisos del compilador**. Revisión de espacios de **18 archivos sin seguimiento** relacionados (feature Reportes, cinco tests y este plan) mediante `git -c core.autocrlf=false diff --no-index --check -- /dev/null <archivo>`: **0 incidencias**. `git diff --check`: sin errores; avisos heredados LF→CRLF, no cambios funcionales. `git status --short` mantiene el trabajo local previo y no muestra archivos generados inesperados. Único archivo actualizado por esta revisión: `docs/ai/fases.md`.
- **Estado:** implementación frontend de las seis fases completada y regresión final aprobada; integración local real previamente aprobada (8/8), **no reejecutada en esta revisión**. No se afirma un «100 %» absoluto: siguen pendientes la aceptación visual/lector de pantalla y los límites backend de §6.7. Cerrarlos requiere trabajo humano o un alcance técnico y autorización nuevos, no otra marca de completado en este documento. Sin fixtures, escrituras o limpieza DB nuevos; el arnés simulado retiró sus temporales.
