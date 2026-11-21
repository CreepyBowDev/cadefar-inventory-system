# CADEFAR — Mejora visual y organización del apartado Reportes

## 1. Estado y objetivo

**Actualizado el 21/11/2026. Fase 1: COMPLETADA (especificación; §10). Fase 2: COMPLETADA (composición y verificación focalizada; §11). Fase 3: COMPLETADA (estadísticas y gráficas; §12). Fase 4: PARCIAL (revisión visual real y regresiones realizadas; pendiente zoom nativo 200%, §13).**

Este documento reemplaza por solicitud expresa el seguimiento anterior de ampliación frontend. La ampliación está implementada; el usuario informa que funciona correctamente. La tarea siguiente es **solo diseño, estructura visual y orden de la información**, para hacer Reportes más intuitivo. No reconstruir consultas, estadísticas, gráficas o descargas. Preparar este plan no ejecuta ninguna fase ni modifica la interfaz.

La intervención permite reorganizar la composición interna de Reportes, mejorar jerarquía, densidad, alineación, agrupación, etiquetas y responsive, conservando la identidad CADEFAR. No autoriza rediseñar toda la aplicación ni cambiar su lógica funcional.

## 2. Alcance y límites

### Incluido

- Reporte de ventas CU38, compras CU39 y pérdidas CU41: filtros, selección de vista, contexto aplicado, resumen, detalle, estadísticas, acciones y exportación.
- Componente de exportación compartido con historial CU40: comprobar su consistencia visual en MovimientosPage, sin rediseñar Inventario ni duplicar la página.
- Presentación visual de barras, líneas y sectores, controles, leyenda, valor explorado y tablas exactas existentes.
- Estados sin selección, cargando, vacío, sin valor gráfico, error, ocupado, cancelación y descarga iniciada.
- Accesibilidad visual/semántica, teclado, orden DOM coherente y adaptación a móvil/escritorio.

### Fuera de alcance

Backend, endpoints/CORS, contratos, Services HTTP, validators, hooks de negocio/consulta/descarga, escala y cálculos estadísticos, filtros permitidos, permisos, URLs/rutas, navegación postlogin, sidebar, dashboard, tema global, documentos PDF/XLSX/CSV y su generación, configuración/despliegue Railway o MySQL. No agregar indicadores, operaciones, librerías visuales/gráficas ni nuevas pantallas.

No corregir silenciosamente incidencias funcionales históricas dentro de una tarea visual. Si se detecta un fallo reproducible que impide verificar diseño, registrarlo y separar su autorización. No usar textos visuales para ocultar un error o afirmar disponibilidad no acreditada.

## 3. Uso obligatorio de frontend-design

**Cargar y utilizar `frontend-design` en cada fase de diseño o adaptación visual.** Aplicarla a jerarquía, lectura, agrupación de tareas, tipografía, alineación, contraste, formularios, tablas, gráficas, foco y responsive. Si no está disponible, indicarlo; no afirmar su uso.

La intención visual es **«espacio de consulta farmacéutica claro y sobrio»**, no dashboard promocional. Preservar colores, fuentes, iconos y lenguaje de componentes de CADEFAR. La libertad de rediseño se concentra en el orden y composición interna de Reportes; no introducir una estética distinta ni modificar estilos globales para conseguirla.

### Base visual comprobada

- `app-foundations.css`: fondo `#f3f5f7`, superficie `#ffffff`, texto `#252930`, secundario `#555f6b`, borde `#dce2e8`, foco `#9b5b00`; consumir variables existentes, no duplicarlas como tema nuevo.
- Tipografía actual: Segoe UI Variable / Aptos / Segoe UI, escala y altura de control existentes. No instalar fuentes.
- Mantener `page-heading`, paneles `catalogo-panel`, campos `form-field`, botones `button`, tablas y paginación actuales; CSS específico de Reportes con selectores acotados.
- Evitar exceso de tarjetas iguales, bordes anidados, etiquetas mayúsculas, iconos decorativos, texto técnico protagonista y animaciones. Los números de negocio son información, no decoración.
- Justificar cada cambio por una mejora concreta: encontrar una acción, distinguir criterios, entender el resultado o reducir ruido. No modificar por preferencia estética sin beneficio de lectura.

## 4. Punto de partida inspeccionado

Rutas relativas a la raíz del repositorio. Leer solo archivos pertinentes a la fase; no volver a analizar todo el software.

| Archivo real | Uso en la mejora |
|---|---|
| `frontend/src/features/reportes/components/ReporteOperacionesConsulta.jsx` | Composición común CU38/CU39; filtros, radios de vista, toolbar, notas, exportación y resultados |
| `frontend/src/features/reportes/pages/PerdidasPage.jsx` | Composición CU41 equivalente con particularidades de pérdidas; mantener callbacks y estados |
| `frontend/src/features/reportes/pages/ReporteVentasPage.jsx`, `ReporteComprasPage.jsx` | Títulos/props de cada fuente; sin nuevas páginas |
| `frontend/src/features/reportes/components/ReporteFilters.jsx` | Presentación de filtros y acciones; no cambiar modalidad/aplicación efectiva |
| `frontend/src/features/reportes/components/ReporteFuenteEstadisticas.jsx` | Granularidad/aplicación, toolbar y exportación estadísticas, resumen y gráfico; actualmente varios bloques de controles separados |
| `frontend/src/features/reportes/components/ReporteEstadisticas.jsx` | Gráfico SVG, selectores, categorías visibles, paneles, valor explorado, distribuciones y tabla alternativa; mejorar presentación, no algoritmos |
| `frontend/src/features/reportes/components/ExportacionTabular.jsx` | Descarga TABULAR/ESTADISTICA y feedback; abundantes notas y criterios en bloque; compartido por CU40 |
| `frontend/src/features/reportes/components/ReporteVentasResultado.jsx`, `ReporteComprasResultado.jsx`, `PerdidasResultado.jsx` | Resúmenes/detalles y enlaces actuales; jerarquía de importes y categorías |
| `frontend/src/features/reportes/styles/reportes.css` | Principal archivo de intervención: grids, márgenes, números, exportación, vista, SVG y tablas |
| `frontend/src/styles/app-foundations.css`, `catalogo.css`, `pagination.css` | Referencia de identidad y convenciones, no objetivos de reescritura |
| `frontend/src/features/inventario/pages/MovimientosPage.jsx` | Verificar efecto del exportador compartido; conservar InventarioNav, filtros, tabla y consulta automática |
| `frontend/src/features/reportes/hooks/*`, `utils/*`, `services/reporte.service.js` | Referencia para preservar comportamiento; no modificar en alcance visual |
| `frontend/tests/reportes-*.test.mjs` | Regresiones existentes de consulta, estadísticas, exportación/ciclo y navegación; usar solo las afectadas |

Observaciones iniciales derivadas del código, no de una revisión visual manual: exportación aparece antes del resumen, vista y granularidad están en bloques separados, ayudas técnicas extensas preceden a resultados, tablas de detalle tienen ancho mínimo de 80rem y estadísticas combina muchos controles/notas/tablas en una sección. El diagnóstico, la comprobación headless y las limitaciones de Fase 1 quedan separados en §10; no atribuir estos problemas a capturas o revisión manual inexistentes.

## 5. Propuesta de organización visual y comportamiento inmutable

### 5.1. Secuencia de lectura objetivo

```text
Título y descripción breve de la fuente
Panel de configuración
  Vista Consulta / Estadísticas claramente reconocible
  Período y estado/motivo existentes
  Acciones Buscar / Limpiar con jerarquía consistente
  Granularidad y Aplicar solo en contexto estadístico, en grupo separado
Contexto aplicado y estado de consulta
Resultados
  Resumen legible (principal vs categorías informativas)
  Consulta: detalle + paginación
  Estadísticas: controles de visualización + gráfico + valores exactos
Acción de descarga vinculada al contexto aplicado
  Formato, exportar/cancelar y feedback
  Ayudas adicionales accesibles en segundo nivel
```

Es una guía de agrupación, no autorización para fusionar las acciones Buscar/Aplicar granularidad o cambiar cuándo consultan. La disposición única fijada en §10 concreta esta guía: descarga al final de la vista, sin ocultar que exporta todas las coincidencias; no se añade otra acción de descarga en la cabecera.

### 5.2. Reglas de jerarquía

- Una acción primaria identificable por tarea, secundarias con menor énfasis; distinguir Buscar, Actualizar, Aplicar granularidad y Exportar sin cambiar callbacks.
- Mantener visible la diferencia entre borrador y criterios aplicados. Presentar período, estado/motivo, vista y granularidad efectivos de forma compacta; no convertir la selección editada en una falsa consulta ya ejecutada.
- Destacar total realizado frente a importes informativos de pendientes/anuladas; pérdidas claramente brutas. No añadir símbolo monetario ni cálculos nuevos.
- Agrupar ayudas extensas en detalles desplegables nativos o bloques secundarios si beneficia la lectura. Mantener visibles las advertencias indispensables: alcance del resultado, criterios de exportación, error, ausencia de acceso y estado de generación/cancelación. No ocultar alertas dentro de un acordeón cerrado.
- Puede simplificarse el texto de interfaz manteniendo significado y selectores de contrato intactos. Valores técnicos pueden tener etiquetas comprensibles, pero sin cambiar enums, unidades, IDs ni nombres de parámetros enviados.
- Tablas: encabezados claros, números alineados, fechas/nulos/acciones legibles, wrapping y scroll localizado. No eliminar campos/datos, cambiar orden de registros o paginación para hacer que «quepa».
- Gráficas: separar configuración, leyenda, gráfico y detalle exacto; alinear colores/etiquetas entre vistas manteniendo identificación estable de categorías y contraste. Sin nuevos tipos de gráfica ni porcentajes, escala o muestreo distintos.
- Distribución y tabla alternativa pueden organizarse con secciones/ayudas de menor peso visual; conservar acceso completo a todas las métricas y paneles. No sustituir tabla accesible por tooltip.

### 5.3. Contrato de no regresión

El rediseño **no cambia**: GET emitidos, query/URL e historial del navegador, vista/granularidad aplicadas, defaults actuales, 1200 intervalos, paginación, resumen completo, filtros abiertos de CU40, categorías/precisión/fechas civiles, permisos, cancelación, timeout, nombres/headers/blob, límites o disponibilidad del servidor.

Preservar props, handlers, condiciones disabled/hidden y semántica de estados. Evitar mover componentes entre ramas o cambiar keys de forma que se desmonten y reinicien formato, selección gráfica, panel explorado, petición o descarga. Cambiar orden visual no debe alterar orden lógico de teclado, provocar nuevas solicitudes ni duplicar una instancia para desktop/móvil. No usar CSS `order` para dejar un recorrido de foco contradictorio.

Scope CSS local: cambios al exportador compartido deben verificarse también en CU40; no filtrar estilos hacia todo Inventario, Ventas operativas u otros módulos. Evitar `!important` para resolver conflictos estructurales y selectores globales nuevos.

## 6. Fases y dependencias

Se definen **cuatro fases**, suficientes para separar decisiones de diseño, composición principal, densidad estadística y verificación final sin repartir cambios pequeños en demasiadas sesiones.

| Fase | Propósito | Dependencias | Estado |
|---|---|---|---|
| 1 | Diagnóstico visual focalizado y especificación de jerarquía | Plan y módulo actual | COMPLETADA — especificación §10 |
| 2 | Reorganización visual de consultas, resúmenes y exportación | Fase 1 | COMPLETADA — cierre §11 |
| 3 | Mejora visual de estadísticas y gráficas | Fases 1–2 | COMPLETADA — cierre §12 |
| 4 | Ajustes responsive/accesibilidad, regresión y cierre | Fases 2–3 | PARCIAL — verificación y pendiente concreto §13 |

### Fase 1 — Diagnóstico y especificación visual

- **Objetivo:** concretar una organización intuitiva basada en pantallas/componentes actuales, con `frontend-design` cargada y aplicada.
- **Dependencias:** este plan y módulo actual disponible; no necesita implementar capacidades nuevas.
- **Lectura mínima:** AGENTS raíz/frontend, este plan, componentes y CSS de §4, cierres previos solo si son necesarios para preservar comportamiento; guía de contratos únicamente como referencia semántica.
- **Archivos:** este documento para decisiones de diseño. Sin implementación funcional ni CSS en esta fase.
- **Actividades:** inspección visual acotada con API simulada/fixtures locales del arnés si está disponible, sin usar datos reales ni conectar a MySQL. Revisar Consulta/Estadísticas/Exportación en desktop y 375px. Especificar orden/agrupación, acción primaria, densidad de ayudas, jerarquía de resumen, tratamiento de tablas y representación de estados. Utilizar tokens/tipografía existentes, no crear un sistema nuevo.
- **Restricciones:** no rediseño general, nuevos flujos, cambio de rutas/Services/hooks ni instalación de herramientas. Si no hay inspección disponible, identificar claramente decisiones verificadas por código vs pendientes visuales; no inventar evidencia.
- **Verificaciones:** un recorrido lógico «configurar → consultar → leer → descargar», ayudas esenciales visibles, foco/DOM coherente y todos los controles/datos conservados. Contrastar la propuesta con las restricciones de §5.3 antes de implementar.
- **Aceptación:** especificación breve y concreta registrada aquí, con componentes afectados y condiciones de no regresión. No exige una ronda de aprobación por cada ajuste ni crear maquetas/capturas como entregable.
- **Entrega:** decisiones suficientes para Fase 2, hallazgos reales y pendientes separados. Ningún cambio de aplicación.

### Fase 2 — Composición principal y descarga

- **Objetivo:** mejorar estructura y orden de Consulta en ventas/compras/pérdidas y presentación del exportador compartido. **Cargar `frontend-design`; conservar identidad CADEFAR.**
- **Dependencias:** Fase 1 y decisiones anotadas; no reabrirlas salvo incompatibilidad demostrada.
- **Lectura mínima:** coordinador CU38/CU39, PerdidasPage, filtros/resultados/exportador, reportes.css y CU40 para efectos compartidos; hooks solo para verificar mounts/props.
- **Archivos previstos:** JSX de composición/presentación en los componentes citados y CSS de Reportes; MovimientosPage solo si hace falta un wrapper/clase visual local. Tests afectados únicamente por semántica/estructura visual legítima.
- **Actividades:** aplicar grupos y espaciados, selección de vista clara, contexto aplicado compacto, resumen principal vs informativo, tablas/acciones consistentes y descarga asociada al resultado. Reducir ruido de notas mediante texto claro/ayuda secundaria manteniendo advertencias críticas y mensajes accesibles.
- **Restricciones:** no cambios a Services/validators/hooks, comportamiento de acciones, campos o permisos. Mantener exportación desde vacío/página lejana según comportamiento vigente; no condicionarla artificialmente a filas visibles. No reiniciar/duplicar exportador al moverlo.
- **Verificaciones:** inspección acotada de tres fuentes y exportador CU40, estados inicial/carga/vacío/error/descarga, teclado/labels, query y número de peticiones iguales para las mismas acciones; prueba focalizada de consulta/tabular/navegación y `git diff --check`.
- **Aceptación:** jerarquía común reconocible, menos ruido y sin pérdida de datos/controles; CU40 sigue siendo su página única y sin cambios visuales globales.
- **Entrega:** archivos/decisiones reales, evidencia simulada y pruebas registradas; Fase 3 habilitada sin ejecutar automáticamente.

### Fase 3 — Estadísticas, gráficas y datos exactos

- **Objetivo:** hacer más legible y ordenada la vista estadística de las tres fuentes. **Cargar `frontend-design` para jerarquía/visualización sin cambiar cálculos ni alcance.**
- **Dependencias:** Fases 1–2, composición principal coherente.
- **Lectura mínima:** ReporteFuenteEstadisticas, ReporteEstadisticas, resúmenes, exportador estadístico y estilos; escalaEstadistica.js solo como referencia no modificable.
- **Archivos previstos:** componentes de presentación estadística y CSS local. Extracción de un componente puramente visual solo si evita duplicación real, conservando propietario de estado y keys.
- **Actividades:** agrupar granularidad/aplicación, toolbar, selección de gráfico/métrica, leyenda y panel; mejorar espacio de gráfica, etiquetas y feedback de valor explorado. Organizar resumen, distribución y tabla alternativa con títulos/ayudas claros; exportación estadística coherente con Fase 2. Distinguir contexto del panel temporal frente a período completo en sectores.
- **Restricciones:** no cambiar coordenadas/cálculos/series, 60 intervalos por panel o límite vigente, totales/ceros/null, identificación de categorías, opciones de gráfico o parámetros de archivo. No introducir porcentajes, moneda, interpolación, nuevas bibliotecas ni datos ocultos definitivamente.
- **Verificaciones:** barras/líneas/sectores con cero/sinDatos/valores grandes, paneles extremos y todas las categorías ocultas, tooltip/foco/táctil/tabla exacta, etiquetas largas y exportación compartiendo selección actual. Regresión focalizada de estadísticas/ciclo y descarga; queries/selecciones sin cambios por rediseñar.
- **Aceptación:** gráfica entendible sin leer toda la documentación técnica, alternativas exactas accesibles y mismos valores/controles/peticiones. Colores se distinguen con leyenda/texto/patrones, no solo por tono.
- **Entrega:** mejoras visuales de tres fuentes verificadas, sin alterar semántica, y Fase 4 habilitada.

### Fase 4 — Responsive, accesibilidad y cierre visual

- **Objetivo:** comprobar la coherencia final y corregir solo defectos de presentación demostrados. **Cargar `frontend-design` para crítica y ajustes finales.**
- **Dependencias:** Fases 2–3.
- **Lectura mínima:** cierres, componentes modificados, tests focalizados de Reportes y CU40; no auditar todo el proyecto.
- **Archivos previstos:** tests visuales/semánticos afectados y JSX/CSS de alcance para ajustes; este seguimiento. No backend ni otros documentos.
- **Actividades/verificaciones:** revisar desktop, 768px y 375px, zoom200%, nombres/fechas/importes largos, foco/orden teclado, contraste y estados de consulta/descarga. Tablas/gráficos pueden desplazarse localmente; página no desborda. Usar API simulada para fixtures conocidos; ejecutar regresiones pertinentes de consulta, estadísticas/exportación/ciclo y navegación, más `pnpm build` y `git diff --check`. No ejecutar suites MySQL/backend o aceptación integrada por una tarea visual.
- **Restricciones:** no debilitar aserciones funcionales para hacer pasar tests; actualizar selectores solo por cambios legítimos de markup/etiqueta preservando intención. Sin instalación, capturas masivas, navegación prolongada, commit/push/despliegue ni conexión a datos operativos.
- **Aceptación:** acciones/localización/jerarquía más claras, funcionalidades intactas en los escenarios ejercidos y revisión visual efectivamente realizada. Si no puede inspeccionarse visualmente, dejar esa aceptación parcial y no presentarla como completada por el build.
- **Entrega:** resumen de qué cambió visualmente, archivos, pruebas reales/avisos y revisión manual pendiente. No afirmar aceptación funcional/productiva nueva por este rediseño.

## 7. Continuidad entre sesiones

1. Leer AGENTS raíz/frontend, este archivo y cierre de dependencias; consultar `git status --short` y preservar cambios locales ajenos.
2. Ejecutar exclusivamente la fase solicitada; leer solo referencias mínimas. Cargar `frontend-design` en cada fase de diseño.
3. No convertir problemas de presentación en refactor funcional. Anotar bloqueos concretos o incidencias fuera de alcance antes de ampliar cambios.
4. Registrar decisiones/archivos/comandos/evidencia y actualizar estado; no iniciar automáticamente la siguiente fase.
5. Navegador solo para revisión/pruebas focalizadas sin datos reales cuando se ejecute la fase; esta preparación no lo utiliza. No hay autorización MySQL ni reutilización de permisos de sesiones antiguas.

Prompt de continuidad:

> Trabaja en frontend. Lee AGENTS.md raíz/frontend y docs/ai/fases.md. Ejecuta únicamente la Fase N de mejora visual de Reportes. Carga frontend-design; conserva identidad CADEFAR y funcionalidades. Reorganiza solo presentación/JSX/CSS dentro del alcance, sin modificar Services, hooks de consulta/descarga, cálculos, backend, rutas o permisos. Preserva mounts/keys/callbacks al cambiar disposición. Verifica visualmente con API simulada y pruebas focalizadas según fase; actualiza cierre y siguiente fase habilitada sin iniciarla.

## 8. Plantilla de cierre

```text
Fase / fecha / estado: PENDIENTE, EN CURSO, COMPLETADA, PARCIAL o BLOQUEADA
Skill frontend-design: aplicada y decisiones derivadas
Hallazgos: código / inspección visual realmente realizada
Cambios visuales y motivo de usabilidad:
Archivos/componentes modificados; funciones reutilizadas sin cambio:
Orden visual/DOM y responsive/teclado comprobados:
No regresión: acciones, filtros aplicados, queries, mounts/keys, selección y descargas
Comandos de pruebas/build/diff y resultados reales:
Limitaciones y problemas funcionales detectados fuera de alcance:
Siguiente fase habilitada y lectura mínima:
```

No guardar secretos, cookies, archivos descargados o datos reales en cierres. No commit, push, merge, despliegue ni instalar dependencias para rediseñar.

## 9. Registro inicial y dependencias históricas

- Solo se reemplaza `docs/ai/fases.md`. Skill cargada y revisión selectiva de JSX/CSS/estructura/pruebas disponibles; Git inicial limpio. No se modificó interfaz, ejecutaron pruebas funcionales/build, abrieron navegadores o accedió a backend/MySQL en esta preparación.
- **Estado en la preparación:** las cuatro fases estaban PENDIENTES / NO INICIADAS. El estado vigente y el cierre de Fase 1 están en §1, §6 y §10; no se reimplementaron funciones.
- El usuario informa ampliación terminada y funcional. El cierre anterior registra integración LOCAL focalizada y limitaciones (incluida incidencia histórica de retorno postlogin con query, no corregida allí); no se afirma que esa incidencia siga presente sin comprobarla, ni se incluye su corrección en este plan visual.
- Fuentes técnicas conservadas sin editar: `contratos-reportes-react.md` y extensión posterior `exportaciones-railway.md`. Esta última documenta perfil Railway opt-in implementado, no habilitado/desplegado por aquella entrega. No reutilizar notas históricas «solo LOCAL» para reemplazar disponibilidad actual ni declarar Railway activo sin evidencia. Los avisos funcionales/de disponibilidad se preservan conforme al software vigente.
- Las referencias externas a fases del archivo reemplazado son históricas, no fases completadas de este nuevo plan. No reescribir documentación normativa en esta tarea ni eliminar esas guías.
- Verificación documental de preparación: comprobadas cuatro fases pendientes, uso de skill en cada una, alcance visual y continuidad. `git diff --check` sin errores de espacios (solo aviso de futura normalización LF → CRLF); `git status --short` muestra únicamente este documento modificado. Sin pruebas funcionales y sin ejecución de Fase 1.

## 10. Fase 1 — Diagnóstico y especificación elegida

### 10.1. Evidencia y hallazgos focalizados

Fecha: 21/11/2026. Leídos AGENTS raíz/frontend y este plan; skill `frontend-design` cargada. Git inicial: únicamente ` M ../docs/ai/fases.md`, cambio previo preservado. No se atribuye a esta fase el reemplazo histórico del plan.

**Fuentes de código inspeccionadas:** los seis componentes principales solicitados, los tres archivos de resultados/resúmenes, `reportes.css`, `app-foundations.css` y `catalogo.css`; `MovimientosPage.jsx` solo para integración del exportador CU40. Lectura acotada de `package.json` y los tres arneses browser existentes para comprobar el medio de revisión. Sin releer backend, contratos, hooks, servicios ni el resto del proyecto.

| Hallazgo verificado por código | Fuente concreta | Consecuencia para la propuesta (no observación manual de pantalla) |
|---|---|---|
| Consulta/Estadísticas está después del formulario; granularidad pertenece a otro componente | `ReporteOperacionesConsulta.jsx:25–32`, `PerdidasPage.jsx:24–30`, `ReporteFuenteEstadisticas.jsx:47–52` | Elegir primero la vista; mantener dos grupos de aplicación distintos y próximos, sin extraer estado |
| Actualizar, nota de negocio y exportador preceden al resumen; hay varios párrafos antes del primer dato | Coordinadores anteriores y `ExportacionTabular.jsx:35–47` | Resultado antes de descarga; reducir peso de explicaciones, no de advertencias |
| El total realizado/bruto es el último elemento del mismo `dl` que las categorías | Los tres `*Resultado.jsx`, resúmenes | Colocar el total primero y a ancho completo; categorías después, sin recalcular |
| Todas las tablas de detalle comparten mínimo 80rem, pese a tener 9/9/12 columnas | `reportes.css:8`, tablas de resultados | Dimensionar por fuente/contenido, sin ocultar columnas ni comprimir fechas/importes |
| Gráfica, métrica, leyenda, precisión, panel, gráfico, valor explorado y dos tablas conviven en secuencia extensa | `ReporteEstadisticas.jsx:35–76` | Agrupar controles y separar exploración de consultas exactas secundarias |
| Los valores exactos estadísticos no usan la alineación numérica del detalle; la leyenda tiene texto/número pero no muestra una muestra del trazo/color | `ReporteEstadisticas.jsx:40,74–76`, `reportes.css:10,30–35` | Alinear valores y añadir muestras de las series existentes, con identificación textual estable |
| DOM de acciones: Limpiar → Buscar; móvil usa `column-reverse` y muestra Buscar → Limpiar | `ReporteFilters.jsx:18`, `reportes.css:44` | Unificar DOM y presentación como Buscar → Limpiar, sin invertir con CSS |
| CU40 usa el mismo exportador con `pendiente`, restricción y filtros automáticos; no tiene selector de vista | `MovimientosPage.jsx:16–29` | Solo hereda presentación interna compacta; no mover su exportador ni adaptar su flujo al de Reportes |

**Comprobación real en navegador headless, con API interceptada y datos sintéticos:** se ejecutaron sin modificar los tres arneses existentes indicados en §10.7. React/Router/Axios reales; solo servidor estático de prueba, sin backend/MySQL. Resultado: **119 pruebas aprobadas, 0 fallidas/canceladas/omitidas**, incluyendo contenedoras y subtests, no 119 pantallas revisadas.

- Consulta: tres fuentes, entrada sin período, carga retenida, vacío, página fuera de rango con resumen completo y errores. Estadísticas: tres fuentes, entrada sin granularidad, carga, errores, sin operaciones frente a valor cero, barras/líneas/sectores, paneles y categorías. Descarga: formatos, ocupado/cancelación/error y mensaje de archivo recibido; CU40 cubierto como consumidor compartido, sin rediseñarlo.
- Escritorio de 1366 px y móvil de 375 px en las comprobaciones previstas por el arnés: ancho de documento, labels, regiones desplazables, foco/teclado; también toque en gráfica y exportación estadística. No es una matriz exhaustiva de cada estado × fuente × ancho.
- Las aserciones verifican DOM, textos, geometría, estilos calculados e interacciones. **No hubo inspección visual manual ni lectura de imágenes del navegador**: no se acredita equilibrio óptico, contraste medido, altura del primer resultado ni ausencia de solapamientos en todos los estados. No se generaron capturas. Estos aspectos quedan pendientes de revisión visual durante implementación y cierre, no se presentan como defectos vistos ni como aceptación visual final.

### 10.2. Dirección visual y disposición única

Aplicación de `frontend-design`: la información farmacéutica y su alcance son protagonistas, no tarjetas de dashboard. Alineación a la izquierda, una superficie principal, separaciones por tarea, títulos en sentence case, números tabulares y ayudas de menos de 80 caracteres por línea cuando el ancho lo permita. El énfasis singular será el **total realizado o pérdida bruta**, sin tamaño publicitario, gradientes ni nueva paleta. Autocrítica frente al brief: se descarta convertir cada categoría en una tarjeta destacada, porque equipararía importes informativos con el total efectivo y fragmentaría la lectura.

```text
Título de la fuente + descripción breve
Panel existente
  Vista: Consulta / Estadísticas (radios visibles)
  Período: modalidad → fecha(s) → estado o motivo
  Ayuda esencial de borrador + Buscar / Limpiar
  Solo Estadísticas: Granularidad → Aplicar granularidad + ayuda de aplicación
  Resultados / Resultados estadísticos + estado + Actualizar correspondiente
  Contexto aplicado compacto + alcance esencial
  Total principal → categorías informativas
  Consulta: tabla de detalle → paginación
  Estadísticas:
    Gráfica / Métrica → leyenda → panel de intervalos y alcance
    Gráfica desplazable → valor explorado
    Distribución exacta [desplegable] → intervalos exactos [desplegable]
  Descarga: criterios propios → formato / Exportar / Cancelar → feedback
            alcance y advertencias visibles; detalles técnicos secundarios
```

La descarga permanece al final **en ambas vistas**, fuera de los desplegables de datos exactos y fuera del bloque condicional de éxito del resultado. En Consulta queda después de la paginación. No habrá botón duplicado, modal de exportación ni barra flotante. Así la lectura no atraviesa una configuración de archivo antes del resumen; el archivo sigue accesible aunque el resultado sea vacío o falle su consulta independiente.

### 10.3. Decisiones de organización y motivo

1. **Vista antes de filtros:** `fieldset` de radios con legend visible y selección reconocible por control nativo, texto y borde, no solo color. No convertirlo en tabs con otra navegación. Anticipa qué tarea se realizará sin cambiar que seleccionar Estadísticas puede ser una selección local todavía no aplicada.
2. **Período y estado/motivo juntos:** conservar modalidad y campos condicionales, mostrar fechas contiguas Desde/Hasta, luego filtro propio. Buscar será primario y primero en DOM; Limpiar secundario después, en la misma secuencia en móvil. Ayuda visible: días incluidos y «Editar no cambia el resultado; pulsa Buscar». Mantener la aclaración de anuladas en ventas. Reduce ambigüedad entre rellenar y ejecutar.
3. **Granularidad en una fila separada inmediatamente después de filtros, solo en contexto estadístico:** permanece dentro de `ReporteFuenteEstadisticas`, con su selector y botón secundario «Aplicar granularidad». Mostrar granularidad aplicada junto a la ayuda «Los filtros se aplican con Buscar». No incorporar ese botón al submit de filtros ni hacer que Buscar aplique el borrador de granularidad. La proximidad comunica relación; la separación comunica operaciones distintas.
4. **Actualizar en cabecera del resultado**, secundario y con el callback de la vista correspondiente; Buscar no se duplica allí. Exportar es secundario en su grupo de descarga; Cancelar permanece visible durante generación junto al botón. Se distingue configurar, refrescar y producir un archivo sin competir con la acción primaria.
5. **Contexto compacto, no chips editables:** una franja de texto/datos descriptivos bajo cabecera: modalidad, Desde/Hasta efectivos, zona horaria y estado/motivo; en estadísticas, granularidad aplicada y distinción entre vista elegida y configuración ejecutada. Reutilizar valores de `aplicada` y `periodo` recibidos, nunca los campos del borrador como encabezado del resultado. Al carecer de aplicación válida, mostrar el estado inicial/error existente, no un período inventado. El exportador conserva además sus criterios propios (incluyendo gráfica/métrica cuando corresponda): no sustituirlos por esta franja.
6. **Borrador distinguible sin nueva máquina de estados:** rótulos «Filtros por aplicar» y «Criterios aplicados» y ayudas siempre visibles; selector de granularidad frente a su valor aplicado. No es necesario un nuevo detector de cambios ni indicador de «desactualizado». En carga conservar la retirada actual de datos y `aria-busy`; no presentar resultado previo como nueva ejecución.
7. **Resumen:** primero total de ventas/compras realizadas, con «solo confirmadas» inseparable de la cifra; después categorías en dos columnas en escritorio/una en móvil, sin tarjetas independientes. Pérdidas: primero total global de retiros brutos, pérdida total y cantidades con sus etiquetas; luego Vencimiento/Daño. No sumar, redondear de nuevo, asumir moneda ni equiparar cantidades heterogéneas. Permanecen visibles las notas sobre informativos, reclasificación, bruto/reversiones y costos históricos, porque evitan interpretaciones incorrectas.
8. **Tablas de detalle:** mantener el orden actual de columnas y registros, enlaces y paginación inmediatamente debajo. Reducir aire de celdas solo localmente; ancho propio por fuente basado en sus columnas en lugar del mínimo único 80rem. Fechas y números íntegros; nombres largos con wrapping; números a la derecha y tabulares. No sustituir por cards móviles, truncar datos esenciales, ocultar columnas o fijar un ancho sin comprobarlo a 375 px. Hace comparables las filas sin sacrificar trazabilidad.
9. **Estadísticas:** Gráfica/Métrica juntas; leyenda debajo con número, nombre y muestra del color/trazo ya utilizado; panel y su alcance antes del viewport. Conservar el selector de panel también en Sectores y aclarar que afecta a tabla/temporal mientras Sectores representa el período completo. Mantener colores por índice de categoría, trazos y numeración actuales; no reordenar categorías al ocultar. El valor explorado queda inmediatamente después del gráfico, en la superficie sutil existente y con su live region. Mantener visible y asociado por `aria-describedby` que la geometría es aproximada, los valores pequeños pueden no apreciarse y los datos exactos se consultan con teclado/toque/tabla, sin porcentajes ni moneda asumida. Solo el detalle técnico de resolución a millonésimas pasa a ayuda secundaria. Reduce distancia entre acción y lectura exacta sin ocultar límites de interpretación.
10. **Datos exactos accesibles a demanda:** dos `details/summary` nativos, inicialmente cerrados, titulados «Distribución exacta del período completo» y «Tabla exacta del panel …». Cada summary indica alcance y que incluye métricas/categorías/ceros aunque no se vean en gráfica. No renderizar sus hijos condicionalmente: tablas completas dentro del DOM, captions y regiones con foco conservados, apertura nativa con teclado. El panel se sigue eligiendo arriba y no se cambia al abrir/cerrar. Esto acorta la vista y acerca la descarga sin ocultar permanentemente datos ni sustituirlos por tooltip. Advertencias esenciales fuera del `details`.
11. **Descarga compacta y siempre reconocible:** legend, criterios aplicados de esa descarga, selector de formato, Exportar y Cancelar; feedback y orientación de error inmediatamente debajo. Mantener visibles alcance completo/no página, consulta independiente, disponibilidad determinada por servidor, hasta 128 MiB y, para estadísticas, qué incluyen CSV/PDF/XLSX y límites 1200/8/9600. Pasar solo explicación ampliada de formatos (imagen XLSX no editable, selección compartida) a «Detalles del archivo» nativo; selección gráfica vigente sigue identificable en los criterios. Avisos de sesión, bloqueo, filtros pendientes CU40, ocupado, cancelación y fallo nunca dentro del desplegable. No afirmar «guardado»: mantener «Archivo recibido; descarga iniciada» y cualquier advertencia vigente de disponibilidad.

### 10.4. Reutilización y adaptaciones previstas (no ejecutadas)

- **Tokens existentes:** `--color-app-bg` #f3f5f7, `--color-surface` #ffffff, `--color-ink` #252930, `--color-muted` #555f6b, `--color-line` #dce2e8, `--color-focus` #9b5b00; también superficie sutil, borde de control y colores de series actuales. Segoe UI Variable/Aptos/Segoe UI, `--text-title/body/small/control`, `--space-*`, `--control-height` 2.75rem y radios existentes. Sin nuevos tokens globales ni iconografía/fuentes/dependencias nuevas.
- **Componentes/lenguaje:** `page-heading`, `catalogo-panel/toolbar/detail/table-wrap/table/note`, `form-field`, `button--primary/secondary`, `CatalogoState`, `FeedbackMessage`, `Pagination`, controles nativos y SVG actual. Mantener ayudas y títulos con jerarquía semántica, no mayúsculas decorativas.
- **Fase 2:** coordinador CU38/CU39 y `PerdidasPage` para selector y descarga; `ReporteFilters` para agrupación/orden DOM; tres resultados para total/contexto/tablas; `ExportacionTabular` para densidad y ayuda secundaria; CSS acotado en `reportes.css`. No requiere tocar páginas de ventas/compras que aportan props ni `MovimientosPage`: este solo verifica el estilo interno compartido.
- **Fase 3:** `ReporteFuenteEstadisticas` para proximidad de granularidad, cabecera y posición de descarga; `ReporteEstadisticas` para agrupación, leyenda, valor explorado, desplegables y alineación de tablas exactas; CSS local. No extraer componentes con estado ni anticipar un wrapper genérico.
- No editar `app-foundations.css`/`catalogo.css`: referencias, no destinos. Reglas de layout bajo páginas de Reportes; estilos internos `.reporte-exportacion` compartidos intencionalmente con CU40, sin afectar filtros/tabla/navegación de Inventario.

### 10.5. Continuidad de estado y condiciones específicas de no regresión

La nueva disposición se escribe una vez en JSX; **no se alternan árboles por viewport, carga, datos ni aperturas de ayuda**. No usar portales ni copias desktop/móvil. Conservar tipo, propietario, rama condicional y claves de componentes con estado; reorganizar hermanos estáticos en el mismo propietario, no trasladarlos entre coordinadores.

| Componente/ubicación propuesta | Contrato y continuidad que deben conservarse |
|---|---|
| Selector de vista, antes del formulario en ambos coordinadores | Mismos `checked`, `setSeleccionEstadisticas`, `cambiarVista` y efecto por `query`. Consulta y Estadísticas no pasan a consultar al cambiar meramente su presentación |
| `ReporteFilters`, misma instancia en el panel | `tipo/borrador/onChange/disabled/onSearch/onClear`; `buscar/limpiar` y reglas de submit intactas. Solo orden de controles y acciones |
| `ReporteFuenteEstadisticas`, sigue siendo hermano permanente después de filtros/notas | Mismas `tipo/activa/aplicada/restringida/onRestringida/onAplicar`. No envolver su montaje en `estadisticas &&`: actualmente el componente sigue montado y devuelve null si está inactivo. Su granularidad y `seleccionLocal` permanecen en ese propietario |
| Exportador TABULAR, al final de la misma rama `!estadisticas` | Mismas `fuente/restringida/onRestringida`; sin key nueva ligada a página, loading o resultado. Fuera de condiciones de éxito, filas o resumen. Cambio de vista conserva el desmontaje actual; no mantener artificialmente las dos presentaciones montadas |
| Exportador ESTADISTICA, al final del fragmento activo de `ReporteFuenteEstadisticas` | Mismas `fuente/presentacion="ESTADISTICA"/seleccion/restringida/onRestringida`; sigue hermano del bloque `aria-busy`, no dentro de él ni de `ReporteEstadisticas`. Así recargar JSON o abrir datos exactos no reinicia formato ni cancela archivo |
| `ReporteEstadisticas` y tablas exactas | Mantener `key={contexto}`, `data/seleccion/onSeleccion`, propietario de ocultas/panel/explorado, keys de categorías/series/puntos/filas y eventos SVG. No añadir keys por gráfica/métrica ni condicionar montaje a detalles abiertos |
| Resúmenes, tablas y `Pagination` | Mismos props `periodo/resumen/estadoOperacion/motivo`, `detalle/query`; enlaces y state intactos. `Pagination` conserva condiciones, filtros aplicados, callbacks y disabled; no limitar resumen al detalle ni mover descarga dentro del paginado |
| CU40 | Mismas `fuente="movimientos"/pendiente/restringida/onRestringida`, misma ubicación/instancia. No añadir período obligatorio, Buscar o Estadísticas; conservar filtros abiertos y cancelación por cambio efectivo de contexto |

Durante implementación, evitar que inserciones/reordenaciones de hermanos sin key cambien identidad por ramas alternantes; comprobar continuidad con las transiciones del arnés, no «solucionar» reseteos añadiendo keys dinámicas. El nuevo orden debe ser fijo para todos los estados. Los cambios de contexto que hoy reinician/invalidan la selección o descarga deben seguir haciéndolo; solo se prohíben reinicios adicionales por presentación.

Inmutables además de §5.3: número y parámetros HTTP, URL/rutas/roles/sidebar; filtros borrador frente a aplicados; Buscar frente a Aplicar; escala, series, valores exactos, distribución y geometría SVG; selección compartida PDF/XLSX y ausencia de parámetros gráficos en CSV; categorías ocultas/panel no recortan exportación; vacío/página lejana siguen exportables conforme al comportamiento vigente. No cambiar disponibilidad, estados, cancelación, callbacks, condiciones disabled/hidden ni hooks para permitir una composición visual.

### 10.6. Accesibilidad, responsive y estados a validar

- **Orden DOM/teclado objetivo:** radios (navegación nativa con flechas) → modalidad/fechas/filtro → Buscar → Limpiar → granularidad/Aplicar cuando corresponda → Actualizar → tabla/paginación o selectores de gráfica/métrica, categorías, panel, viewport/puntos → desplegables exactos → formato/Exportar/Cancelar → ayuda secundaria. Errores y estado en el lugar de su tarea, sin autofocus al refrescar ni tabIndex positivo. El DOM del resumen sigue su lectura visual: total primero.
- **Responsive:** conservar cortes 900/620 px; filtros 3/2/1 columnas con Desde/Hasta consecutivos; resumen total a ancho completo y categorías 2/1 columnas. A 375 px, radios envolventes y grupos de acciones en columna sin `column-reverse`/`order`; granularidad y Aplicar dentro del ancho disponible. Misma instancia y orden a cualquier ancho.
- Tabla/gráfica con scroll **local**, región etiquetada y foco visible; no scroll horizontal del documento ni reducción artificial de SVG/escala para encajar. Nombres y criterios largos envuelven; números enormes permanecen íntegros y desplazables si es necesario. Asegurar `min-width: 0` en contenedores; comprobar también 768 px y zoom 200% en la fase final.
- Reutilizar outline de foco y controles de al menos 2.75rem; labels/legend/caption/scope, `aria-busy` y live regions actuales. Leyenda comprensible sin color; no quitar numeración/trazos. Verificar contraste de texto normal 4.5:1 y controles/foco 3:1 durante adaptación, sin afirmar que ya se midió. Sin animación nueva ni cambio de preferencia de movimiento.
- **Inicial:** instrucciones específicas de período/granularidad, sin totales ficticios. **Carga:** estado/bloqueo actuales y descarga independiente. **Vacío:** ceros del servidor, resumen y posibilidad de archivo según contexto. **Página lejana:** resumen completo y acción existente de primera página. **Error:** distinguir filtros, consulta, permisos y descarga; conservar retry/login donde hoy corresponden. **Gráfica sin valor/todas ocultas:** mensaje visible y acceso exacto, sin inventar sectores. **Descarga:** sin selección, bloqueo, ocupado, cancelar, fallo y archivo recibido junto a sus controles.

### 10.7. Cierre de Fase 1 (plantilla §8)

- **Fase / fecha / estado:** Fase 1 / 21-11-2026 / **COMPLETADA como diagnóstico y especificación**. Se satisfacen aceptación y entrega de §6: una propuesta concreta compatible con componentes actuales, fuentes separadas y condiciones de no regresión. La revisión visual manual pendiente no se oculta ni se sustituye por tests; esta fase permite expresamente documentar esa limitación. No equivale al cierre visual exigido por Fase 4.
- **Skill frontend-design:** aplicada a jerarquía de total, secuencia configurar/leer/descargar, agrupación, densidad, texto, accesibilidad y responsive; identidad preservada y alternativa de dashboard descartada (§10.2).
- **Hallazgos:** código en §10.1; navegador headless/API sintética para DOM/interacción/anchos, sin inspección manual de imágenes. No se ha medido visualmente la mejora propuesta, porque no se implementó.
- **Cambios visuales y motivo de usabilidad:** solo decisiones §10.2–10.6; **ningún cambio visual implementado**.
- **Archivos/componentes modificados; funciones reutilizadas sin cambio:** únicamente `docs/ai/fases.md`. Todos los componentes, props/callbacks, servicios, hooks y cálculos inspeccionados permanecen intactos; adaptaciones futuras listadas en §10.4.
- **Orden visual/DOM y responsive/teclado comprobados:** orden actual verificado por código; etiquetas, foco, anchos/scroll y toque ejercidos por arneses existentes. Orden propuesto especificado, todavía no comprobable en interfaz implementada. Inversión Buscar/Limpiar móvil identificada por CSS, pendiente de adaptación.
- **No regresión:** propuesta contrastada con §5.3 y contratos de montaje de §10.5; pruebas de base aprobadas sin modificar aplicación. No se afirma regresión de una implementación todavía inexistente.
- **Comandos de pruebas/build/diff y resultados reales:** desde frontend:

  ```text
  git status --short
  Inicial: únicamente M ../docs/ai/fases.md (trabajo previo preservado).

  node --test --test-concurrency=1 tests/reportes-ventas.browser.test.mjs tests/reportes-estadisticas.browser.test.mjs tests/reportes-tabular.browser.test.mjs
  119 aprobadas; 0 fallidas/canceladas/omitidas; duración aproximada 59 s.
  Builds temporales internos del arnés; no pnpm build independiente.
  Sin cambios de arnés, capturas ni guardado de descargas; temporales propios limpiados por finally.

  git diff --check
  Sin errores de espacios; únicamente aviso de futura normalización LF → CRLF.
  Revisión documental: una propuesta, trazabilidad de fuentes, preservación de estado,
  criterios responsive/accesibles y cierre/lectura mínima coherentes; Fases 2–4 pendientes.
  git status --short
  Únicamente M ../docs/ai/fases.md; ningún archivo de aplicación o pruebas modificado.
  ```

- **Limitaciones y problemas funcionales fuera de alcance:** sin revisión visual manual, contraste medido, lector de pantalla, otros navegadores/dispositivos ni matriz completa de estados/anchos. No se detectó un nuevo fallo funcional en las pruebas ejecutadas; la incidencia histórica postlogin de §9 no se reinvestigó ni se considera corregida por estos resultados. Sin MySQL/backend, instalación, contratos reconstruidos, commit/push o despliegue.
- **Siguiente fase habilitada y lectura mínima:** **Fase 2 habilitada, NO INICIADA**; Fases 3–4 también pendientes. Leer AGENTS raíz/frontend, §5.3, definición Fase 2 y §10 de este documento; después coordinador CU38/CU39, PerdidasPage, filtros, tres resultados, exportador y `reportes.css`. `app-foundations.css`/`catalogo.css` solo para tokens; `MovimientosPage` solo para comprobar exportador. Revisar `ReporteFuenteEstadisticas` únicamente para no alterar su montaje; su adaptación visual pertenece a Fase 3. No reabrir backend/contratos ni releer todas las suites. Inspección visual manual del resultado y continuidad de formato/descarga son comprobaciones necesarias en la implementación, no autorizan ejecutar Fases 2–4 en esta sesión.

## 11. Fase 2 — Composición principal y descarga

### 11.1. Cierre según plantilla

- **Fase / fecha / estado:** Fase 2 / 21-11-2026 / **COMPLETADA** dentro de su aceptación focalizada: jerarquía común implementada y revisada, controles/datos conservados y CU40 sin cambios de página ni flujo. Fases 3–4 **PENDIENTES / NO INICIADAS**; este cierre no sustituye la aceptación visual final de Fase 4.
- **Preparación y preservación:** leídos AGENTS raíz/frontend, §5.3, definición de Fase 2 y §10 completo. Git inicial: únicamente ` M ../docs/ai/fases.md`. Se conserva íntegro ese trabajo previo; esta sesión actualiza estado y agrega §11, sin atribuirse el reemplazo histórico del documento. Lectura focalizada conforme al prompt; no se reabrieron backend, contratos, servicios ni hooks.
- **Skill frontend-design:** cargada y aplicada a la propuesta única de §10.2. Paleta existente (fondo #f3f5f7, superficie #ffffff, texto #252930, secundario #555f6b, borde #dce2e8, foco #9b5b00), Segoe UI Variable/Aptos/Segoe UI, controles y componentes CADEFAR. Alineación izquierda, una superficie, total efectivo/bruto como énfasis singular; sin tarjetas de dashboard, nuevos iconos, fuentes o tokens globales.
- **Hallazgos por código:** la composición permite mover hermanos en la misma rama, sin wrappers condicionales ni nuevas keys. Los resúmenes y el exportador también se reutilizan en Estadísticas: heredan exclusivamente su presentación interna; no se reorganizó `ReporteFuenteEstadisticas` ni `ReporteEstadisticas`.
- **Cambios visuales y motivo de usabilidad:**
  - Radios Consulta/Estadísticas antes de los filtros, selección nativa reconocible por control, borde y peso. Período y estado/motivo en el mismo fieldset rotulado «Filtros por aplicar»; ayuda de aplicación siempre visible.
  - Buscar primario antes de Limpiar secundario, tanto en DOM como en escritorio/móvil; eliminado `column-reverse` de estas acciones.
  - Franja «Criterios aplicados» con fechas, modalidad, zona horaria y estado/motivo recibidos; no lee borradores. Resumen completo: total primero, ancho completo, después categorías 2/1 columnas. Notas informativas y advertencias de bruto/reclasificación/costos históricos intactas.
  - Tablas completas con mínimos propios (ventas 74rem, compras 68rem, pérdidas 94rem), menor padding local, fechas/números/estados/enlaces íntegros y nombres envolventes. Se mantiene el scroll local, región etiquetada, captions, columnas, registros, enlaces y paginación. Los mínimos pueden crecer con el contenido, sin comprimir importes grandes.
  - Exportador TABULAR al final de Consulta, después del detalle/paginación y fuera del éxito/filas/resumen. Criterios propios → formato/Exportar/Cancelar → feedback próximo → alcance y advertencias visibles. Quitado el borde anidado, sin esconder disponibilidad del servidor, consulta independiente, todas las coincidencias ni 128 MiB.
  - Exportador estadístico compartido: límites 1200/8/9600 y contenido CSV/PDF/XLSX siguen visibles; solo la explicación de imagen XLSX no editable/selección compartida pasa a `details` nativo. Su ubicación en Estadísticas queda para Fase 3. CU40 conserva su exportador antes del resultado y su consulta automática.

### 11.2. Archivos y continuidad de estado

Rutas relativas a la raíz:

| Archivos modificados | Alcance |
|---|---|
| `frontend/src/features/reportes/components/ReporteOperacionesConsulta.jsx` | Orden de vista y exportador TABULAR CU38/CU39 |
| `frontend/src/features/reportes/pages/PerdidasPage.jsx` | Mismo orden para CU41 |
| `frontend/src/features/reportes/components/ReporteFilters.jsx` | Legend/agrupación y Buscar → Limpiar |
| `frontend/src/features/reportes/components/ReporteVentasResultado.jsx` | Contexto y total primero |
| `frontend/src/features/reportes/components/ReporteComprasResultado.jsx` | Contexto y total primero |
| `frontend/src/features/reportes/components/PerdidasResultado.jsx` | Contexto y total bruto primero |
| `frontend/src/features/reportes/components/ExportacionTabular.jsx` | Composición interna compacta y ayuda secundaria |
| `frontend/src/features/reportes/styles/reportes.css` | Estilos locales; solo interior del exportador compartido alcanza CU40 |
| `frontend/tests/reportes-ventas.browser.test.mjs` | Selectores de total adaptados a su nuevo lugar sin perder aserciones; orden DOM/foco y capturas opt-in |
| `frontend/tests/reportes-tabular.browser.test.mjs` | Continuidad del nodo/formato/descarga al Actualizar y cambiar ancho en cuatro fuentes; capturas CU40 opt-in |
| `docs/ai/fases.md` | Estado y este cierre; trabajo documental previo preservado |

- **Reutilizados sin cambio:** `CatalogoState`, `FeedbackMessage`, `Pagination`, funciones de presentación, callbacks, props y condiciones disabled/hidden; sin editar servicios, validators, hooks, URLs/rutas/roles/sidebar, cálculos ni backend. `MovimientosPage.jsx`, `ReporteFuenteEstadisticas.jsx`, `ReporteEstadisticas.jsx`, estilos globales y fixtures no modificados.
- **Montaje/keys:** `ReporteFuenteEstadisticas` continúa como hermano permanente, con las mismas props y posición de montaje, incluso inactivo; conserva granularidad y selección local. Exportador TABULAR permanece en la misma rama `!estadisticas`, sin key nueva, siempre fuera de carga/error/éxito y paginación. No se duplican árboles por viewport. No se alteraron `key={contexto}`, propietarios ni keys gráficas. El cambio de vista conserva sus desmontajes actuales, no se mantienen artificialmente ambas descargas.
- **Continuidad comprobada automáticamente:** en ventas/compras/pérdidas/CU40, se retiene una descarga XLSX, se pulsa Actualizar y se alternan 1366/375 px: mismo nodo select y valor XLSX, `aria-busy` de exportación activo, exactamente un GET de archivo y uno de actualización, y archivo finalmente recibido sin cancelación adicional. Las regresiones conservan borrador/aplicado, paginación/resumen completo, consultas sin selección, límites, errores, selecciones estadísticas, categorías/paneles, cancelaciones esperadas y respuestas tardías. No se fusionaron Buscar y Aplicar granularidad.

### 11.3. Verificaciones reales y límites

**Automatizadas (API interceptada, datos sintéticos, React/Router/Axios reales):** inicial sin período, carga retenida, vacío/ceros, página lejana con resumen completo, errores 400/401/403/500/red; descarga sin formato/ocupada/cancelación/fallo/archivo recibido, filtros pendientes de CU40, tres formatos y consultas independientes. Tres fuentes, exportador CU40, navegación por rol, Atrás/Adelante y recarga. Orden vista/filtros, Buscar/Limpiar, total/categorías y paginación/descarga comprobado en DOM; labels, caption/scope, Tab real, foco visible y desplazamiento horizontal local con teclado a 375 px. Sin desbordamiento horizontal del documento en los escenarios de ancho ejercidos. No es una matriz exhaustiva estado × fuente × viewport.

```text
Desde frontend, última ejecución completa:
$env:CADEFAR_REPORTES_SCREENSHOTS = 'C:\Users\jesus\AppData\Local\Temp\opencode\cadefar-fase2-visual'
node --test --test-concurrency=1 tests/reportes-consulta.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-navegacion.test.mjs tests/reportes-ventas.browser.test.mjs tests/reportes-tabular.browser.test.mjs tests/reportes-estadisticas.browser.test.mjs
143 aprobadas; 0 fallidas/canceladas/omitidas; ~62 s (incluye contenedoras y subtests).
Builds Vite temporales del arnés; no pnpm build independiente ni suite backend/real.
git diff --check
Sin errores de espacios; avisos de normalización futura LF → CRLF.
```

La primera ejecución dio 141 aprobadas y 2 fallidas (subtest nuevo y contenedora) por intentar devolver un nodo DOM serializado mediante CDP: `Object reference chain is too long`. Corregida únicamente la expresión de prueba con `void`; repetición tabular 24/24 y última ejecución conjunta 143/143. Ninguna aserción funcional debilitada.

**Inspección visual real:** se generaron y leyeron ocho imágenes del navegador headless: `ventas-1366.png`, `ventas-375.png`, `compras-1366.png`, `compras-375.png`, `perdidas-1366.png`, `perdidas-375.png`, `movimientos-1366.png`, `movimientos-375.png`, en el directorio temporal indicado, no versionadas. Consultas con filas, nombres históricos e importes sintéticos extremos; CU40 vacío tras descarga XLSX recibida. Se revisó composición, separación borrador/aplicado, jerarquía de total, wrapping, orden de descarga y proximidad de feedback. La primera lectura mostró cortes dentro de «Confirmada»/categorías/motivos; se corrigieron con anchos/nowrap locales y se volvieron a generar y leer las ocho imágenes finales. Sin solapamientos apreciados en esas capturas; las tablas se recortan al viewport propio, no eliminan datos. Las capturas de éxito no se presentan como inspección óptica de todos los estados.

**Contraste acotado:** cálculo sRGB sobre tokens reutilizados, no auditoría completa: texto #252930/blanco 14,60:1 y sobre superficie sutil 13,59:1; secundario #555f6b/blanco 6,49:1 y sobre superficie sutil 6,04:1; foco #9b5b00/blanco 5,40:1; borde de control #7e8b99/blanco 3,48:1. No se certifican todos los estados/controles de la aplicación por estas relaciones.

**Limitaciones y fuera de alcance:** revisión de imágenes headless y teclado automatizado, no recorrido manual interactivo con usuario, lector de pantalla ni dispositivo físico. Inicial/carga/error/cancelación se comprobaron por aserciones, no por imágenes de cada combinación. Pendientes para Fase 4: 768 px, zoom 200%, matriz visual ampliada y revisión accesible final después de Fase 3. No se detectó una incidencia funcional nueva en las pruebas; la histórica postlogin de §9 no se reinvestigó ni se declara resuelta. Sin MySQL, datos reales, pruebas backend, dependencias nuevas, subagentes, commit/push o despliegue. Los archivos descargados son bytes sintéticos y se observa el anchor; no acredita validez de documentos generados ni disponibilidad productiva.

**Siguiente fase habilitada y lectura mínima:** **Fase 3 habilitada, NO INICIADA**. Fase 4 pendiente. Leer AGENTS raíz/frontend, §5.3, definición Fase 3, §10.2–10.6 y este cierre; después `ReporteFuenteEstadisticas.jsx`, `ReporteEstadisticas.jsx`, resúmenes, `ExportacionTabular.jsx` y `reportes.css`. `escalaEstadistica.js` solo como referencia si resulta necesario; sin reabrir backend/servicios/contratos. Sigue pendiente en Fase 3 acercar granularidad, reorganizar gráfico/datos exactos y mover su exportador al final, conservando propietarios/props/keys/selección y descarga independiente de §10.5. No rehacer Consulta ni CU40.

## 12. Fase 3 — Estadísticas, gráficas y datos exactos

### 12.1. Cierre según plantilla

- **Fase / fecha / estado:** Fase 3 / 21-11-2026 / **COMPLETADA** en su alcance focalizado. Tres fuentes con composición común, leyenda textual y muestras, alcance explícito y alternativas exactas accesibles, sin cambios de valores/controles/peticiones en los escenarios ejercidos. **Fase 4 habilitada, PENDIENTE / NO INICIADA**; no se sustituye su revisión final ampliada.
- **Preparación y preservación:** leídos AGENTS raíz/frontend, §5.3, definición de Fase 3, §10.2–10.6 y cierre completo §11. Git inicial con **11 rutas modificadas** de trabajo previo: este documento, exportador, tres resultados, filtros, coordinador, PerdidasPage, CSS y dos arneses (ventas/tabular). Todos preservados; no se atribuyen a Fase 3 sus cambios anteriores. Lectura focalizada de componentes/resúmenes/exportador/CSS y pruebas/fixtures pertinentes; consulta normativa acotada de los cuatro documentos AI por las secciones de Reportes. Sin reabrir backend ni editar servicios, hooks, validators o utilidades de escala.
- **Skill frontend-design:** cargada y aplicada a la propuesta única: superficie sobria de consulta farmacéutica, alineación izquierda, agrupación por tarea y jerarquía sin tarjetas nuevas. Conservados colores/tokens, tipografía, iconos y componentes CADEFAR. Se descartó destacar cada serie como una tarjeta: la leyenda se mantiene compacta, numerada y vinculada al gráfico existente.
- **Hallazgos y cambios visuales / motivo de usabilidad:**
  - Granularidad y Aplicar en fieldset separado, próximo a los filtros dentro del propietario actual, con ayuda explícita de que Buscar aplica los filtros. No se fusionan acciones.
  - Cabecera con Actualizar estadísticas y estado; contexto de vista elegida/granularidad aplicada antes del resumen. Los criterios de período/estado/motivo siguen procediendo del resumen recibido, no del borrador.
  - Gráfica/Métrica juntas; leyenda con checkbox, número, nombre y muestra SVG que reutiliza clase/color y patrón de línea existentes por índice. No modifica las series ni el SVG de datos.
  - Selector de panel y alcance antes del viewport. En Sectores se indica explícitamente período completo y que el panel solo modifica la tabla; Barras/Líneas identifican su alcance temporal.
  - Valor explorado inmediatamente después del viewport, con rótulo y live region conservada. Avisos de aproximación, valores pequeños y acceso exacto con teclado/toque/tabla permanecen visibles y asociados por `aria-describedby`; solo precisión técnica en millonésimas pasa a ayuda secundaria.
  - Distribución completa y tabla exacta del panel en dos `details/summary` nativos inicialmente cerrados; tablas siempre en DOM, sin renderizado condicionado por apertura. Summary explica métricas/categorías ocultas/ceros, y se conservan caption, scope y regiones con foco. Valores alineados a la derecha, números tabulares, fechas/identificadores íntegros con scroll local.
  - Exportador ESTADISTICA al final del fragmento activo, fuera de `aria-busy`, éxito y desplegables. Reutiliza sin cambios la presentación interna de Fase 2. Consulta y CU40 no se reorganizaron.

### 12.2. Archivos y continuidad

Rutas relativas a la raíz; solo estos seis archivos recibieron cambios nuevos en esta fase:

| Archivo | Cambio de Fase 3 |
|---|---|
| `frontend/src/features/reportes/components/ReporteFuenteEstadisticas.jsx` | Grupo de aplicación, contexto y posición final del exportador |
| `frontend/src/features/reportes/components/ReporteEstadisticas.jsx` | Leyenda, alcance, valor explorado y desplegables exactos |
| `frontend/src/features/reportes/styles/reportes.css` | CSS local estadístico y tablas exactas; preserva CSS previo de Fase 2 |
| `frontend/tests/reportes-estadisticas.browser.test.mjs` | Interacción/estado/DOM, extremos, cero/vacío y capturas opt-in |
| `frontend/tests/reportes-tabular.browser.test.mjs` | Continuidad estadística durante descarga; selector de SVG de datos acotado al viewport |
| `docs/ai/fases.md` | Estado y este cierre, sin reemplazar cierres anteriores |

- **Reutilizados sin cambio:** resúmenes y exportador, CatalogoState/FeedbackMessage, props/callbacks/disabled, series/categorías/fechas/precisión/cálculos/geometría SVG, eventos y keys de puntos/filas. No modificaciones de HTTP, parámetros, URLs, permisos, sidebar, paginación, resumen completo ni disponibilidad de archivos.
- **Montaje:** coordinadores intactos; `ReporteFuenteEstadisticas` sigue montado también inactivo y conserva su `return null`, granularidad y selección local. `ReporteEstadisticas` conserva `key={contexto}`, props y propietarios de ocultas/panel/explorado. No keys por tipo de gráfico/métrica ni árboles desktop/móvil. Exportador sigue hermano del bloque ocupado y sin key nueva. Los desmontajes actuales por carga/contexto/vista permanecen: no se promete conservar panel/ocultas/explorado al refrescar JSON, porque ya se desmontaba el gráfico en carga.
- **Continuidad automatizada:** apertura/cierre de desplegables y cambios 1366/375 px conservan nodo del gráfico y filas, panel extremo, ocultas, valor explorado, formato XLSX y descarga retenida. Actualizar conserva nodo/formato del exportador, selección LINEAS + IMPORTE/PERDIDA y archivo en curso; exactamente un GET de archivo y uno de actualización. Archivo recibido sin cancelación adicional. Gráfico/métrica/leyenda/panel/desplegables no agregan GET. Cambios de contexto y cancelaciones intencionales siguen cubiertos.
- **Descargas:** matriz existente de CSV/PDF/XLSX en las tres fuentes aprobada. CSV sin parámetros gráficos; PDF/XLSX con selección vigente. Panel visible/categorías ocultas no recortan solicitud; vacío/error/carga no condicionan artificialmente el exportador. CU40 conserva ubicación, consulta automática y comportamiento previo, ejercidos por el arnés compartido.

### 12.3. Verificaciones reales y limitaciones

**Automatizadas, API simulada y datos sintéticos:** tres fuentes, barras/líneas/sectores, métricas disponibles, magnitudes enormes y bajo resolución, ceros/sinDatos, categorías excluidas y todas ocultas, 1200 intervalos/20 paneles y extremos primero/último, límite 1201, datos exactos campo por campo, roles/errores/respuestas tardías, borradores/aplicados y navegación. Teclado Enter/Espacio abre/cierra desplegables; foco visible, scroll local con flecha en tablas abiertas a 375 px, selección/exploración por foco y toque en los tres gráficos, labels/leyenda y orden DOM de valor/exportación. Sin desbordamiento del documento en anchos ejercidos. No es una matriz óptica exhaustiva de cada estado × ancho × fuente.

```text
Desde frontend, última ejecución completa:
$env:CADEFAR_REPORTES_SCREENSHOTS = 'C:\Users\jesus\AppData\Local\Temp\opencode\cadefar-fase3-visual'
node --test --test-concurrency=1 tests/reportes-estadisticas.test.mjs tests/reportes-estadisticas-fuentes.test.mjs tests/reportes-estadisticas-ciclo.test.mjs tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-estadisticas.browser.test.mjs tests/reportes-tabular.browser.test.mjs
91 aprobadas; 0 fallidas/canceladas/omitidas; ~60 s (incluye contenedoras y subtests).
Builds Vite temporales del arnés; no pnpm build independiente ni pruebas backend.
git diff --check
Sin errores de espacios; avisos de normalización futura LF → CRLF.
```

**Iteraciones de prueba registradas:** primera conjunta 83/91, con cuatro subtests nuevos fallidos y sus contenedoras: CDP Enter sin texto no activaba summary, y el fixture de ventas no tenía opt-in de 1200 intervalos en la nueva comprobación de panel 19. Corregida solo la preparación de prueba, repetición browser 71/71. Al ampliar toque/tablas, conjunta 89/91: el toque en el centro común de Sectores extremos alcanzaba otra categoría. Se movió el punto de prueba al interior del sector mayor, sin modificar eventos/geometría ni debilitar la comprobación del valor. Última conjunta 91/91. Ningún fallo funcional de aplicación nuevo reproducido por estas incidencias del arnés.

**Inspección visual real, no solo aserciones:** capturas opt-in guardadas fuera del repositorio en la ruta anterior. Leídas durante iteración las composiciones `ventas-BARRAS`, `compras-LINEAS`, `perdidas-SECTORES` en 1366/375 px, además de `compras-SECTORES-1366`, `ventas-SECTORES-375`, `compras-BARRAS-375` y `perdidas-LINEAS-375`. Leídas también las seis imágenes finales `{ventas,compras,perdidas}-exactos-{1366,375}.png` (recortes de hasta 1500 px de altura, no todas las filas/columnas a la vez). Las primeras imágenes de tablas abiertas mostraron cortes dentro de fechas/identificadores; se corrigió exclusivamente CSS local `white-space` y se regeneraron/leyeron las seis finales. En las imágenes revisadas se reconocen grupos, leyenda textual/muestras, alcance, valor próximo, ayudas y descarga al final; las tablas desbordan su región, no el documento. No se afirma haber leído todas las capturas generadas ni revisión óptica de estados de error/carga/vacío por cada combinación.

**Limitaciones y fuera de alcance:** headless con teclado/toque emulados, no dispositivo físico, recorrido interactivo de usuario ni lector de pantalla. No medición nueva de contraste completa (tokens y relaciones acotadas de §11 se reutilizan); 768 px, zoom 200% y revisión accesible/visual final ampliada pertenecen a Fase 4 y no se ejecutaron. Bytes de descarga sintéticos/anchor observado: no valida documentos reales, backend ni disponibilidad productiva. No incidencia funcional nueva pendiente de corrección; la histórica postlogin de §9 no se reinvestigó ni se declara resuelta. Sin MySQL/datos reales/pruebas backend/dependencias/subagentes/commit/push/despliegues.

**Siguiente fase habilitada / lectura mínima:** **Fase 4 HABILITADA, PENDIENTE / NO INICIADA**. Leer AGENTS raíz/frontend, §5.3, definición Fase 4, §10.5–10.6 y cierres §11–12; después solo los componentes/CSS y arneses afectados de Reportes, con CU40 como consumidor del exportador compartido. Ampliar a 768 px/zoom 200%, estados y contraste/foco según Fase 4, ejecutar sus regresiones/build/diff y corregir únicamente defectos visuales demostrados. No reabrir cálculos/backend/servicios ni rehacer Consulta/CU40.

## 13. Fase 4 — Verificación final responsive y accesible

### 13.1. Cierre según plantilla

- **Fase / fecha / estado:** Fase 4 / 21-11-2026 / **PARCIAL**. Revisión visual real de capturas y regresiones focalizadas completadas en entorno simulado. Se verificó el reflow equivalente al 200% mediante viewport de 683 píxeles CSS y DPR 2, pero **no el zoom nativo del navegador al 200%**. Por criterio conservador, esa comprobación queda pendiente antes de marcar la fase COMPLETADA; no se sustituye por build ni por capturas a DPR 2.
- **Preparación y preservación:** leídos AGENTS raíz/frontend, §5.3, definición Fase 4, §10.5–10.6 y cierres completos §11–12. Git inicial con 14 rutas modificadas: documento, diez archivos de aplicación/CSS y tres arneses browser de Fases 2–3. Se preservó todo ese trabajo. Lectura focalizada de esos componentes/CSS y pruebas relacionadas; MovimientosPage solo para verificar exportador CU40. Utilidades de exportación/validación consultadas exclusivamente para entender el dato sintético rechazado, sin modificarlas.
- **Skill frontend-design:** cargada y aplicada como crítica final, no como nuevo diseño. Conservados fondo #f3f5f7, blanco, texto #252930, secundario #555f6b, foco #9b5b00 y tokens existentes; Segoe UI Variable/Aptos/Segoe UI, iconos y componentes CADEFAR. Se confirmó la secuencia configurar → leer → descargar, énfasis único en total efectivo/bruto, ayudas secundarias y alineación numérica. No se reabrieron las decisiones de Fases 2–3.
- **Hallazgos / cambios visuales:** no se reprodujo un defecto de presentación que justificara editar la aplicación en los escenarios revisados. Nombres extensos envuelven, fechas/importes quedan completos en regiones desplazables, ayudas y feedback siguen próximos a sus controles, foco reconocible y exportación fuera del resultado. **Ninguna corrección JSX/CSS nueva**: no introducir cambios estéticos por preferencia es parte del alcance. Se amplió únicamente la evidencia de regresión y el seguimiento.

### 13.2. Archivos y continuidad de estado

Solo estas cuatro rutas recibieron cambios de esta sesión; sus modificaciones previas se conservaron:

| Archivo relativo a raíz | Cambio de Fase 4 |
|---|---|
| `frontend/tests/reportes-ventas.browser.test.mjs` | Añade 768px/reflow equivalente 200% al recorrido accesible existente; denominación comercial sintética extensa con cadena sin espacios para pérdidas |
| `frontend/tests/reportes-estadisticas.browser.test.mjs` | Amplía anchos de continuidad/exploración/desplegables; inicial/carga/error a 768px, contraste sRGB y capturas opt-in representativas |
| `frontend/tests/reportes-tabular.browser.test.mjs` | Amplía continuidad durante descarga a 768px/reflow 200%, apertura de ayuda del archivo, estados de descarga y criterios CU40 largos válidos |
| `docs/ai/fases.md` | Estado y cierre §13; cierres anteriores preservados como registros históricos |

- **Reutilizados sin cambio:** todos los componentes, CSS, props, callbacks, condiciones, servicios, hooks, validators, utilidades y backend. ReporteFuenteEstadisticas permanece montado inactivo; `key={contexto}`, propietarios de selección/ocultas/panel/explorado y keys/eventos SVG intactos. Los desplegables exactos conservan sus hijos montados. No se añadieron solicitudes, cancelaciones, resets, ramas por viewport ni instancias duplicadas.
- **Continuidad automatizada:** mismos nodos de gráfico y filas al abrir/cerrar exactos y alternar 1366/768/683/375px; mismo panel extremo, categorías ocultas, valor explorado, nodo/formato XLSX y descarga retenida al cambiar ancho/abrir ayudas. Actualizar mantiene formato/selección compartida y descarga, con exactamente un GET JSON y uno de archivo. Conservado el desmontaje previo del gráfico durante carga JSON: no se promete conservar panel/ocultas/explorado al Actualizar.
- **Contratos conservados y ejercidos:** Buscar distinto de Aplicar granularidad; borrador/aplicado, paginación y resumen completo; geometría/series/precisión/ceros/null/fechas civiles/límites; HTTP/query/URLs/permisos/navegación; CSV sin parámetros gráficos, PDF/XLSX con selección vigente. Categorías ocultas y panel no recortan archivos. Exportadores fuera de éxito/filas y del bloque ocupado del resultado; CU40 en su ubicación previa, automático y sin período obligatorio.

### 13.3. Verificaciones automatizadas y resultados reales

API interceptada por CDP, datos y bytes sintéticos, React/Router/Axios reales; no backend/MySQL ni datos operativos.

- Consulta de ventas/compras/pérdidas y exportador CU40: inicial, carga retenida, vacío/ceros, error, página lejana, filtros/roles, resumen completo, recarga, Atrás/Adelante y enlaces existentes.
- Estadísticas de tres fuentes: barras/líneas/sectores, métricas, 1200 intervalos/20 paneles/extremos, cero/sinDatos, todas las categorías ocultas, exactitud campo por campo, foco/teclado/toque y datos exactos abiertos/cerrados. Interacciones de presentación sin GET adicionales.
- 1366/768/375px y 683 CSS px con DPR 2: sin overflow horizontal del documento en los escenarios ejercidos; tablas/gráficos con scroll local, regiones etiquetadas y foco. Orden DOM de vista/filtros/Buscar/Limpiar/resultado/datos/descarga, labels, legend, caption y scope conservados; Enter/Espacio en summary y Tab real. No es una auditoría de lector de pantalla ni una matriz óptica exhaustiva estado × fuente × ancho.
- Descarga ocupada/cancelada/fallida/recibida, simultánea con JSON, respuestas tardías, recursos y matriz de formatos/presentaciones; criterios CU40 con motivo sin espacios de 40 caracteres, fechas civiles extremas e IDs máximos válidos. Nombre comercial largo de pérdidas sin ocultar ni truncar el dato.
- **Contraste medido automáticamente sobre tokens efectivos compilados:** texto/blanco 14,60:1; secundario/blanco 6,49:1; foco/blanco 5,40:1; borde de control/blanco 3,48:1. Sobre superficie sutil: 13,59 / 6,04 / 5,03 / 3,24 respectivamente. Superan 4,5:1 para texto y 3:1 para foco/controles; las cuatro series reutilizan esos colores. No equivale a certificación de cada estado, hover, control nativo o color de feedback.

```text
Desde frontend, última ejecución conjunta:
$env:CADEFAR_REPORTES_SCREENSHOTS = 'C:\Users\jesus\AppData\Local\Temp\opencode\cadefar-fase4-visual'
node --test --test-concurrency=1 tests/reportes-consulta.test.mjs tests/reportes-ampliacion-consulta.test.mjs tests/reportes-estadisticas.test.mjs tests/reportes-estadisticas-fuentes.test.mjs tests/reportes-estadisticas-ciclo.test.mjs tests/reportes-tabular.test.mjs tests/reportes-tabular-ciclo.test.mjs tests/reportes-navegacion.test.mjs tests/reportes-ventas.browser.test.mjs tests/reportes-estadisticas.browser.test.mjs tests/reportes-tabular.browser.test.mjs
167 aprobadas; 0 fallidas/canceladas/omitidas; ~95 s, incluyendo contenedoras y subtests.
pnpm build
Correcto: Vite 8.3.0, 254 módulos; sin dependencias nuevas.
git diff --check
Sin errores de espacios; avisos de normalización futura LF → CRLF.
```

**Iteraciones del arnés:** primera conjunta 164/166: nuevo subtest CU40 y contenedora fallaron porque el motivo sintético excedía el máximo vigente de 40 caracteres; se corrigió el fixture de esa prueba, sin tocar validator ni disponibilidad de descarga (repetición tabular 26/26). Segunda conjunta 165/167: prueba nueva de contraste y contenedora fallaron porque el lector hex no contemplaba `#fff` abreviado por Vite; se corrigió el parser de prueba para hex de 3/6 dígitos, manteniendo umbrales. Última conjunta 167/167. Las capturas de secciones vuelven al scroll inicial para evitar artefactos del header sticky en imágenes extendidas. No se debilitaron aserciones funcionales ni se corrigió código de aplicación para resolver incidencias del arnés.

### 13.4. Evidencia visual realmente inspeccionada

Capturas opt-in fuera del repositorio en el directorio temporal del comando anterior. Se **leyeron como imágenes**, además de las aserciones DOM:

- Consulta: `ventas-768.png`, `compras-683.png` y `perdidas-375.png` (incluida su versión final con denominación muy larga). Resumen/criterios, acciones y paginación/descarga sin solapamientos apreciados; nombre largo envuelve dentro de su celda.
- Gráficas: `ventas-BARRAS-1366.png`, `ventas-BARRAS-768.png`, `compras-LINEAS-683.png`, `perdidas-SECTORES-375.png`. Leyenda, alcance, valor explorado, foco de summary y ayudas coherentes; misma propuesta CADEFAR. Las magnitudes sintéticas extremas mantienen la advertencia de aproximación, no se altera la escala para hacerlas visibles.
- Exactos abiertos: `ventas-exactos-768.png`, `compras-exactos-683.png`, `perdidas-exactos-768.png`. Fechas, categorías y valores íntegros dentro de regiones horizontalmente desplazables; captions/columnas extensas pueden quedar fuera del recorte local, no se eliminan. Imágenes de hasta 1500px de altura, no inspección simultánea de todas las filas/columnas.
- Estados: `ventas-inicial-768.png`, `ventas-carga-768.png`, `ventas-error-768.png`, `ventas-ocultas-768.png` (releída sin artefacto sticky), `compras-cero-375.png`, `perdidas-vacio-375.png`. Mensajes distinguibles y controles/datos exactos disponibles conforme al estado; recortes de hasta 1200px, no todo el documento.
- CU40: `movimientos-683.png` y `descarga-{ocupada,cancelada,fallida,recibida}-375.png`. Criterios largos envuelven, Cancelar permanece visible durante generación y feedback cerca de formato/Exportar, sin rediseñar Inventario.

No se afirma haber inspeccionado todas las imágenes generadas ni cada combinación de estados. Las comprobaciones de continuidad son automatizadas; las imágenes por sí solas no prueban identidad de nodos, ausencia de peticiones ni cancelaciones.

### 13.5. Limitaciones y pendiente de cierre

- **Pendiente concreto para completar Fase 4:** recorrido visual con **zoom nativo 200%** en navegador de escritorio: Consulta y Estadísticas de las tres fuentes y exportador CU40; abrir/cerrar exactos/ayuda y retener una descarga para comprobar continuidad, controles y scroll local. Ya se verificó el reflow equivalente mediante viewport/DPR, pero no se presenta como uso del zoom nativo. Registrar el resultado aquí, sin rehacer Fases 2–3 ni ampliar lógica.
- Resto de límites: navegador headless, teclado/toque emulados y lectura de imágenes, no dispositivos físicos ni lector de pantalla; contraste acotado a tokens, no auditoría WCAG integral. Descargas con bytes sintéticos/anchor observado: no acredita documentos reales, disponibilidad del servidor ni aceptación backend/productiva. No hay nuevo requisito de backend para estos cambios de pruebas.
- No se reprodujo una incidencia funcional nueva de aplicación en las regresiones ejecutadas. El motivo excesivo fue un error del nuevo dato de prueba, no un defecto funcional. Incidencia histórica postlogin de §9 no reinvestigada ni declarada resuelta.
- Sin MySQL, datos reales, pruebas backend, servicios/hooks/validators modificados, CORS/Railway, dependencias nuevas, subagentes, commit/push ni despliegues. **No hay Fase 5 habilitada:** continuar únicamente el pendiente de Fase 4. Lectura mínima: AGENTS raíz/frontend, §5.3, §10.5–10.6 y §13; arneses actuales y componentes solo si se demuestra un defecto visual.
