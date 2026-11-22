# CADEFAR — Fases para la implementación de la arquitectura de subsistemas

## 1. Objetivo y estado

**Actualizado: 21/11/2026.** Este documento reemplaza, por solicitud expresa, el seguimiento anterior de mejora visual de Reportes. El nuevo trabajo es exclusivamente documental: elaborar **once diagramas de implementación de subsistemas**, verificables contra el software, y reunirlos en `docs/ai/subsistemas.md`.

No son diagramas de casos de uso, BCE ni clases con atributos y métodos. Cada paquete utiliza tres filas horizontales:

1. **«Interface»**: páginas o componentes React existentes.
2. **«Class»**: todos los controladores HTTP que participan en el paquete.
3. **«Table»**: todas las tablas físicas utilizadas por esos flujos, incluidas las dependencias indirectas y transversales comprobadas.

**Punto de partida:** P1 ya tiene un SVG revisado por el usuario, reorganizado sin cruces ni tramos superpuestos, y su explicación en `subsistemas.md`. Incluye siete interfaces, los dos controladores participantes y cinco tablas, incluida `bitacora_auditoria`. Es la referencia visual vigente; no se debe reconstruir sin necesidad.

La planificación se agrupa en **cuatro fases**, no una fase por paquete. Redactar este seguimiento no ejecuta las fases ni acredita que los paquetes pendientes estén elaborados.

| Fase | Paquetes | Estado actual |
|---|---|---|
| 1. Acceso y catálogos | P1–P3 | COMPLETADA documentalmente: P1 conservado/verificado; P2/P3 generados y verificados |
| 2. Inventario y operaciones | P4–P6 | COMPLETADA documentalmente: P4/P5/P6 generados y verificados |
| 3. Recetas y control de existencias | P7–P9 | COMPLETADA documentalmente: P7/P8/P9 generados y verificados |
| 4. Consultas, auditoría y cierre de la colección | P10–P11 | COMPLETADA documentalmente: P10/P11 y revisión final P1–P11; sin aceptación funcional/productiva |

## 2. Alcance y archivos autorizados

Durante la ejecución de las fases, crear o actualizar únicamente:

- `docs/ai/subsistemas.md`.
- Los once SVG de `docs/ai/diagrama-subsistemas/` definidos en la sección 3.
- `docs/ai/fases.md`, para registrar el avance real y la evidencia de cierre.

No modificar frontend, backend, tablas, migraciones, modelos, controladores, servicios, repositorios, rutas, sidebar, reglas de negocio ni otros diagramas académicos. No adaptar el software al dibujo. No instalar dependencias únicamente para generar SVG si las herramientas disponibles bastan. No hacer commits, push ni despliegues.

No ejecutar una auditoría general del sistema ni todas sus pruebas. No se requiere navegador, capturas de la aplicación ni conexión a MySQL/Railway. Verificar archivos físicos de persistencia no equivale a certificar el esquema ni la disponibilidad de un servidor desplegado.

## 3. Clasificación y entregables obligatorios

Conservar este orden y la correspondencia académica indicada por el usuario. Compartir componentes no permite fusionar paquetes.

| Paquete | Nombre oficial | Casos de uso | SVG en `docs/ai/diagrama-subsistemas/` |
|---|---|---|---|
| P1 | Autenticación y usuarios | CU01–CU09 | `p1-autenticacion-usuarios.svg` |
| P2 | Proveedores y laboratorios | CU10–CU13 | `p2-proveedores-laboratorios.svg` |
| P3 | Medicamentos y composición | CU14–CU20 | `p3-medicamentos-composicion.svg` |
| P4 | Existencias e inventario | CU21–CU24 | `p4-existencias-inventario.svg` |
| P5 | Compras | CU25–CU27 | `p5-compras.svg` |
| P6 | Ventas | CU28–CU30 | `p6-ventas.svg` |
| P7 | Recetas | CU31–CU32 | `p7-recetas.svg` |
| P8 | Vencimientos y retiros | CU33–CU36 | `p8-vencimientos-retiros.svg` |
| P9 | Stock bajo | CU37 | `p9-stock-bajo.svg` |
| P10 | Reportes y consultas | CU38–CU41 | `p10-reportes-consultas.svg` |
| P11 | Bitácora | CU42 | `p11-bitacora.svg` |

Si aparece una clasificación posterior aprobada que contradiga esta tabla, identificar la fuente y la diferencia antes de cambiarla. No resolver contradicciones inventando componentes.

## 4. Contrato visual común

Usar el P1 revisado como plantilla de estilo, no como inventario técnico para otros módulos:

- Orientación horizontal; fondo blanco; recuadro exterior rectangular y borde verde delgado.
- Pestaña verde en la esquina superior izquierda con el nombre oficial del paquete en mayúsculas.
- Cajas rectangulares verde claro, bordes verdes delgados, texto negro centrado y Arial o equivalente. Mantener los colores de P1: cajas `#e2efda`, borde `#548235`, pestaña `#a9d18e` y conexiones `#303030`.
- Pequeño símbolo UML de componente como el utilizado en P1, sin atributos ni métodos.
- Tres filas exclusivas y alineadas: interfaces arriba, controladores en medio y tablas abajo. Todos los componentes de un mismo nivel deben permanecer en su fila.
- Título: `P<n>. PAQUETE DE <NOMBRE OFICIAL>`. Mantener esa convención en el documento y el SVG.
- Espaciado regular, cajas de dimensiones coherentes y tipografía legible. Ampliar el lienzo cuando sea necesario, sin reducir los nombres hasta volverlos ilegibles.
- Interface–Class: conexiones continuas, con puertos circulares como en P1. Representan servicios HTTP frontend y Axios, no importaciones ni llamadas directas entre lenguajes.
- Class–Table: líneas discontinuas con flecha hacia la tabla. Resumen Controller → Service → Repository → Sequelize → MySQL.
- Una ruta independiente por relación, con puertos distintos. **No utilizar distribuidores comunes ni tramos superpuestos.** Evitar cruces; usar carriles ortogonales separados y, cuando convenga, recorridos laterales/inferiores como en P1. Las flechas pueden entrar por distintos bordes de la tabla si la dirección queda inequívoca.
- Las líneas no deben atravesar cajas, textos ni símbolos; las leyendas deben quedar fuera de los recorridos.
- Una caja por controlador o tabla dentro de cada diagrama. Su reutilización entre paquetes es válida y debe explicarse.
- SVG vectorial válido, texto seleccionable, `viewBox`, título y descripción accesibles; sin imágenes remotas ni fuentes externas. No sustituirlo por Mermaid si no reproduce el modelo.

**Referencia disponible:** la imagen original mencionada por el usuario no está adjunta en la conversación; no afirmar una comparación visual con ella. La base comprobable es el estilo descrito y el P1 revisado.

## 5. Procedimiento verificable dentro de cada fase

Aplicar este procedimiento al conjunto de paquetes de la fase, sin solicitar aprobación individual por paquete ni crear maquetas alternativas.

### 5.1. Inspección focalizada

1. Leer las instrucciones `AGENTS.md` aplicables y las secciones pertinentes de `contexto-maestro.md`, `casos-uso.md`, `requerimientos.md` y `reglas-negocio.md`.
2. Consultar la documentación académica de arquitectura/paquetes y modelo de datos que realmente exista, incluido `analisis-clases-academico-simplificado.md` cuando corresponda. Buscar el apartado «3.1 Análisis de arquitectura» y sus secciones de identificación, relación con CU y vista de paquetes; si no está disponible, declarar la limitación, sin inventar su contenido.
3. Identificar páginas y componentes principales en `frontend/src/features/` y layouts compartidos. Seguir formularios, diálogos, servicios HTTP y rutas para comprobar qué operaciones representan.
4. Revisar routers, middlewares y controladores de `backend/src/presentation/`. Inventariar **todos los controladores efectivamente involucrados**, incluidos los de otros módulos cuando atiendan operaciones del paquete.
5. Seguir sus servicios y repositorios hasta modelos, asociaciones y migraciones para identificar **todas las tablas utilizadas**, incluidas auditoría y persistencia auxiliar cuando intervengan. Confirmar el nombre físico con `tableName` y las migraciones, no solo con el nombre de la clase Sequelize.

### 5.2. Trazabilidad y selección

- Conservar el nombre exacto de cada archivo y tabla, incluida su escritura y extensión cuando sea un archivo. No crear una interfaz ficticia por CU.
- Seleccionar las interfaces reales suficientes para cubrir las responsabilidades del paquete. Un componente compartido o diálogo puede representar una operación sin existir una página independiente.
- Incluir todos los controladores y tablas participantes, aunque sean compartidos o transversales. No incluir controladores solo porque existe un Service del mismo módulo: **un Service no implica que su Controller sea llamado**.
- Por ejemplo, la captura automática de auditoría de P1 utiliza su Service y `bitacora_auditoria`; no utiliza el Controller de consulta manual de P11.
- Incluir relaciones principales comprobadas y suficientes para explicar la participación de cada caja. Pueden omitirse detalles técnicos secundarios, pero no quitar una tabla o controlador participante para simplificar el dibujo.
- En la explicación de cada paquete, conservar una correspondencia breve entre interfaz, operación/CU, controlador y tablas, con rutas relativas verificables a archivos fuente. Identificar los servicios/repositorios que justifican relaciones menos evidentes; estos no se convierten en una cuarta fila.
- Ante una implementación parcial, mostrar solo componentes existentes y explicar la parte pendiente. No completar el dibujo con nombres propuestos.

### 5.3. Producción y actualización del documento

1. Generar los SVG de la fase con el mismo contrato visual y validar sus recorridos.
2. Integrarlos en `subsistemas.md` en el orden P1–P11, mediante enlaces relativos.
3. Añadir explicaciones breves: interfaces, controladores, tablas, responsabilidades, componentes compartidos, relaciones secundarias omitidas y límites comprobados.
4. Actualizar el alcance acumulado sin presentar paquetes pendientes como entregados. Reservar el resumen final completo para el cierre de la fase 4.
5. Registrar en este seguimiento los paquetes entregados, comprobaciones realmente ejecutadas y cualquier limitación.

## 6. Fases de ejecución

### Fase 1 — Acceso y catálogos: P1, P2 y P3

**Objetivo:** consolidar la plantilla aprobada y completar los primeros tres paquetes.

**Trabajo del bloque:**

- **P1 — CU01–CU09:** conservar el diagrama existente y contrastar su cobertura completa con los flujos actuales. Base ya identificada: `auth.controller.js`, `usuario.controller.js`; tablas `limite_recuperacion_ip`, `recuperacion_password`, `usuario`, `bitacora_auditoria` y `rol`. Mantener acceso y recuperación sin exigir sesión previa; cambio propio y administrativo como variantes distintas. No agregar tabla de sesiones ni controlador ficticio de recuperación.
- **P2 — CU10–CU13:** identificar interfaces de consulta/gestión, todos sus controladores y tablas reales. Respetar `ProveedorLaboratorio`: no separar proveedor y laboratorio por analogía con otro proyecto. Incluir persistencia transversal cuando corresponda.
- **P3 — CU14–CU20:** cubrir medicamentos, principios activos y composición con los controladores efectivamente utilizados. Verificar sus relaciones con tablas de catálogo y las dependencias de consulta o validación que realmente usen los flujos; no limitarse a tres cajas por conveniencia.

**Entrega:** tres SVG acumulados y secciones P1–P3 completas en `subsistemas.md`.

**Cierre:** aprobar la lista común de verificaciones de la sección 7 para los tres paquetes; conservar P1 salvo ajustes necesarios y justificados. Estado COMPLETADA solo cuando P2/P3 también estén generados y verificados.

### Fase 2 — Inventario y operaciones: P4, P5 y P6

**Objetivo:** representar inventario, compras y ventas con su persistencia y trazabilidad reales.

**Trabajo del bloque:**

- **P4 — CU21–CU24:** identificar consultas de medicamentos/existencias, historial y ajustes implementados. Distinguir medicamento, existencia y movimiento; stock físico y vendible. No crear tabla `inventario`.
- **P5 — CU25–CU27:** representar registro, consulta y anulación conforme al código, con compras, detalles, existencias, movimientos y todas las tablas adicionales realmente utilizadas. Contrastar consultas auxiliares de selección y dependencias entre módulos.
- **P6 — CU28–CU30:** cubrir registro, consulta, confirmación y anulación según los flujos implementados. Verificar detalles, FEFO, existencias, movimientos, requisitos de receta y tablas compartidas. No atribuir al frontend la selección FEFO ni representar registro de venta y recetas como una única transacción si el código los separa.

**Entrega:** SVG P4–P6, sus explicaciones y seis paquetes acumulados en el documento.

**Cierre:** aprobar las verificaciones comunes; justificar las tablas compartidas y las dependencias entre compras/ventas/inventario sin convertirlas en paquetes fusionados.

### Fase 3 — Recetas y control de existencias: P7, P8 y P9

**Objetivo:** completar respaldo de ventas, vencimientos, retiros y consulta de stock insuficiente.

**Trabajo del bloque:**

- **P7 — CU31–CU32:** localizar el registro y revisión de recetas, incluso cuando reutilicen páginas de ventas. Incluir todos los controladores y tablas utilizados por esos recorridos. Distinguir registro, revisión y posterior confirmación de venta. No inventar almacenamiento de archivos ni adjuntos.
- **P8 — CU33–CU36:** cubrir consultas de vencimiento y retiros por vencimiento/daño, con existencias, movimientos y demás tablas comprobadas. El vencimiento es una condición de datos, no una tabla; una existencia vencida puede conservar saldo físico.
- **P9 — CU37:** identificar la interfaz real de stock bajo, aunque esté compartida con inventario, y la consulta de stock vendible frente al mínimo. Incluir las tablas realmente consultadas y la persistencia transversal aplicable. No crear tablas `alerta` o `stock_bajo`.

**Entrega:** SVG P7–P9, sus explicaciones y nueve paquetes acumulados.

**Cierre:** aprobar las verificaciones comunes, comprobar la reutilización de componentes y conservar tres diagramas separados aunque compartan controladores o tablas.

### Fase 4 — Consultas, auditoría y cierre: P10 y P11

**Objetivo:** completar la colección y revisar conjuntamente sus once paquetes.

**Trabajo del bloque:**

- **P10 — CU38–CU41:** representar las consultas implementadas, reportes dinámicos/estáticos/estadísticos y exportaciones existentes, incluida la consulta de movimientos CU40. Identificar todos los controladores participantes, incluso los de exportación o de otra feature. Incluir todas las tablas fuente que realmente usan consultas, estadísticas y descargas. Los generadores PDF/XLSX/CSV no son tablas y no existe una tabla `reportes` por el solo hecho de generar documentos. Consultar `contratos-reportes-react.md` y documentación de exportaciones para sus límites, sin afirmar disponibilidad productiva no verificada.
- **P11 — CU42:** representar interfaz de consulta, todos sus controladores y tablas efectivamente utilizadas. Distinguir consulta manual de captura automática de eventos, que es transversal a los demás paquetes. No convertir este diagrama en una repetición de todas las pantallas del sistema.
- Revisar P1–P11 como colección: nombres oficiales, orden, tres filas, estilo, legibilidad, componentes compartidos y ausencia de referencias rotas. No reconstruir paquetes cerrados salvo inconsistencias comprobadas.
- Completar el **RESUMEN FINAL** de `subsistemas.md`: once paquetes, componentes reutilizados, tablas compartidas, dependencias entre módulos y limitaciones/pendientes reales. Eliminar avisos de entrega parcial solo cuando corresponda.

**Entrega:** SVG P10/P11, once SVG totales y `subsistemas.md` completo, con introducción, once secciones y resumen final breve.

**Cierre:** aprobar todas las verificaciones de la sección 7 para la colección completa. Informar archivos creados/modificados, paquetes cubiertos, controladores/tablas compartidos, simplificaciones y resultados reales de las comprobaciones.

## 7. Verificaciones obligatorias por fase

Casillas originales: comprobaciones realizadas para **Fase 1 (P1–P3), 21/11/2026**; se conserva su evidencia histórica. **Fases 2 (P4–P6), 3 (P7–P9) y 4 (P10–P11/cierre de colección), 21/11/2026**, satisfacen estas verificaciones con evidencia **independiente** en §8. Los resultados históricos no se extienden por inferencia a esta fase. P3–P8 y P10 dibujan relaciones principales; las secundarias compartidas se justifican en sus matrices textuales, sin omitir controladores ni tablas. P9/P11 dibujan todas sus dependencias. La revisión final de estructura/geometría/enlaces abarcó los once SVG, sin reejecutar sus flujos funcionales.

### Cobertura y correspondencia con el software

- [x] Cada paquete del bloque tiene exactamente un SVG y su sección en Markdown.
- [x] Se mantiene la clasificación, el orden y los CU de la sección 3.
- [x] Todas las interfaces representadas existen y materializan las operaciones atribuidas.
- [x] Están incluidos todos los controladores HTTP participantes, comprobados mediante rutas y flujos; no se confunden con Services.
- [x] Están incluidas todas las tablas utilizadas por los flujos, incluidas persistencia auxiliar y transversal cuando aplique.
- [x] Los nombres físicos coinciden con modelos y migraciones; se documenta cualquier diferencia importante sin modificar el software.
- [x] Cada relación tiene fundamento en servicios HTTP/rutas o en la cadena de persistencia; no se agregan relaciones solo por FK o proximidad visual.
- [x] Los componentes reutilizados y las partes incompletas quedan explicados sin inventar nombres ni estados.

### Diagramación y archivos

- [x] Tres filas exclusivas: Interface arriba, Class en medio y Table abajo.
- [x] Colores, pestaña, recuadro, tipografía, iconos, títulos y conexiones uniformes.
- [x] No hay cajas vacías, etiquetas cortadas, nombres ilegibles ni componentes duplicados injustificadamente.
- [x] Cada relación tiene su propio recorrido y puertos distinguibles; no hay cruces, tramos superpuestos ni líneas atravesando componentes o textos.
- [x] Se comprueba la geometría de los segmentos contra otras conexiones y contra los límites de las cajas, mediante herramientas disponibles o inspección explícita. No afirmar una comprobación automática si no se ejecutó.
- [x] Los SVG son XML válido, vectoriales, escalables y con textos seleccionables; referencias internas válidas y sin dependencias remotas.
- [x] Los vínculos relativos de imágenes y archivos fuente resuelven correctamente.
- [x] Se ejecuta `git diff --check`; se informan errores y advertencias relevantes sin alterar cambios ajenos.
- [x] Se revisa el alcance de los cambios: solo documentos y SVG autorizados, sin código funcional, dependencias, commits ni despliegues.

### Cierre acumulado

- [x] Al cerrar fase 1: P1–P3, tres diagramas.
- [x] Al cerrar fase 2: P1–P6, seis diagramas.
- [x] Al cerrar fase 3: P1–P9, nueve diagramas.
- [x] Al cerrar fase 4: P1–P11, once diagramas, introducción y resumen final completos.

## 8. Registro de avance y evidencia

### Antecedente — P1 elaborado y revisado

- Archivos existentes: `subsistemas.md` y `diagrama-subsistemas/p1-autenticacion-usuarios.svg`.
- Cobertura: siete interfaces, dos controladores, cinco tablas y ocho relaciones de persistencia individuales.
- En la revisión de P1 se comprobó XML válido, tres filas, referencias internas y 16 vínculos locales válidos. La comprobación geométrica de 56 segmentos no detectó cruces, superposiciones ni componentes atravesados.
- `git diff --check` terminó sin errores de whitespace; emitió advertencias LF/CRLF en archivos previamente modificados del repositorio. Esta evidencia corresponde a P1, no a los paquetes pendientes.
- No se ejecutaron pruebas funcionales ni conexiones de base de datos. No se comparó con la imagen original ausente.

### Estado inicial al redactar este plan (antecedente)

P1 se conserva como referencia aprobada. P2–P11 no se han generado. La fase 1 permanece PARCIAL y las fases 2–4 PENDIENTES. Los criterios de verificación anteriores son requisitos de ejecución, no una declaración de que ya estén cumplidos para toda la colección.

### Cierre de Fase 1 — 21/11/2026

**Estado: COMPLETADA documentalmente.** P1–P3 cubren CU01–CU20; las fases 2–4 siguen PENDIENTES. No se modifica ni genera P4–P11.

| Paquete y evidencia SVG | Interfaces | Controladores | Tablas | Relaciones HTTP / persistencia dibujadas | Segmentos comprobados |
|---|---:|---:|---:|---:|---:|
| [P1 conservado](diagrama-subsistemas/p1-autenticacion-usuarios.svg) | 7 | 2 | 5 | 7 / 8 | 56 |
| [P2 creado](diagrama-subsistemas/p2-proveedores-laboratorios.svg) | 3 | 1 | 3 | 3 / 3 | 17 |
| [P3 creado](diagrama-subsistemas/p3-medicamentos-composicion.svg) | 6 | 4 | 8 | 7 / 14 | 76 |

- [Correspondencias y matrices P1–P3](subsistemas.md) completadas: páginas → servicios Axios → routers/middlewares → Controllers → Services/Repositories → modelos y migraciones. Se incluyen nombres físicos y enlaces relativos a las fuentes. P1 no presenta inconsistencias comprobadas y su SVG no se editó; SHA-256 conservado: `AC548130C6637EDD5E82D58EF7568A013BF97B31E4879675F93FC32E5B728625`.
- P2 incluye `proveedor_laboratorio`, `usuario` (autenticación previa) y `bitacora_auditoria`. P3 añade al catálogo las consultas de `existencia_medicamento`/`movimiento_inventario` que protegen identidad y composición; incluye los Controllers HTTP de Proveedores y Principios por peticiones reales de apoyo. Captura automática y autenticación no implican llamar a los Controllers de Bitácora, Usuarios o Auth.
- Se conservan 16 interfaces, 6 controladores y 11 tablas distintos en el acumulado. P2/P3 comparten el Controller de proveedores y su tabla; `usuario`/`bitacora_auditoria` aparecen en los tres paquetes. La matriz P3 documenta las cargas auxiliares HTTP y las dependencias compartidas secundarias no repetidas como flechas, conforme a §5.2. No se quitaron controladores ni tablas para resolver el trazado.
- **XML:** los tres archivos se cargaron correctamente con `System.Xml.XmlDocument` de .NET. Comprobación adicional con Node.js: filas exclusivas/alineadas, archivos de componentes existentes, tablas coincidentes con `tableName` y migración de creación (incluido el SQL `CREATE TABLE` de Bitácora), IDs únicos, referencias internas válidas y ausencia de imágenes/scripts/recursos remotos.
- **Geometría automática:** 149 segmentos ortogonales (56/17/76), comprobados entre relaciones, contra interiores de cajas y contra los 17 puertos circulares. Cero cruces/contactos entre relaciones, solapes o cajas/puertos atravesados. Se excluyen del cómputo los símbolos de componente y las muestras de leyenda. Los segmentos consecutivos de una misma ruta solo se unen en sus codos; no hay distribuidores.
- **Texto y estilo:** se contrastaron en el SVG los colores, marco, pestaña, iconos, Arial, estereotipos y tipos de conexión con P1. `System.Drawing` midió los 95 textos en Arial, sin desbordamientos de cajas. Los textos externos de título/pestaña/notas/leyenda quedan fuera de los carriles; no se atribuye una revisión en navegador ni un renderizado visual no realizado.
- **Vínculos:** 107 vínculos locales comprobados entre ambos Markdown y sus imágenes, todos con destino existente; no se certifica contenido remoto ni despliegue. Las referencias SVG usan únicamente IDs locales.
- **Whitespace y alcance:** `git diff --check` sin errores; Git advierte conversión LF/CRLF en el árbol de trabajo. Se preservaron cambios previos y se limitaron las ediciones a `subsistemas.md`, `fases.md` y los SVG P2/P3. También se ejecutó `git diff --no-index --check` contra `NUL` para los cuatro archivos sin seguimiento (Markdown y SVG P1–P3), sin errores de whitespace; su código 1 señala diferencia frente al archivo vacío, no un error de espacios. Persisten avisos LF/CRLF, sin normalizar archivos ajenos.
- **Límites:** no se localizó en `docs/` el apartado académico independiente «3.1 Análisis de arquitectura»; se consultaron los bloques pertinentes del análisis académico simplificado y del modelo de clases, sin inventar esa fuente. No se acredita entrega real de correo CU09, esquema operativo ni funcionamiento productivo. Python y el renderer `@resvg/resvg-js` no están disponibles en este entorno; se usaron Node.js/.NET existentes, sin instalar dependencias. No se ejecutaron pruebas funcionales, conexiones MySQL, despliegues, commits ni push.

### Cierre de Fase 2 — 21/11/2026

**Estado: COMPLETADA documentalmente.** P4–P6 cubren CU21–CU30; acumulado de **seis paquetes P1–P6**, sin avanzar a Fase 3. P7–P11 y el resumen final de la colección permanecen pendientes. La entrada de Fase 1 anterior es histórica y no se reescribe como evidencia de esta fase.

| Paquete y evidencia SVG | Interfaces | Controllers HTTP | Tablas físicas | Relaciones HTTP / persistencia dibujadas | Segmentos comprobados |
|---|---:|---:|---:|---:|---:|
| [P4 Existencias e inventario](diagrama-subsistemas/p4-existencias-inventario.svg) | 5 | 3 | 10 | 6 / 11 | 57 |
| [P5 Compras](diagrama-subsistemas/p5-compras.svg) | 3 | 3 | 12 | 5 / 13 | 58 |
| [P6 Ventas](diagrama-subsistemas/p6-ventas.svg) | 4 | 3 | 11 | 5 / 14 | 70 |

- **Cobertura y fuentes:** [matrices P4–P6](subsistemas.md) contrastadas selectivamente con CU21–CU30, RF17–RF29, reglas de stock/compras/FEFO/recetas/anulaciones/ajustes y transacciones T21–T24; páginas/componentes → servicios Axios → routers/auth/roles → Controllers → Services/Repositories → modelos/migraciones. Se comprobaron archivos reales y nombres físicos, sin conectar a MySQL. El inventario de `transacciones.md` no enumera las actuales aperturas de Ventas: sus límites se verificaron directamente en el Service implementado.
- **Dependencias que no se omitieron:** P4 incorpora la ficha auxiliar (Medicamentos), el componente de exportación del historial y `reporte-exportacion.controller.js`; CU24/exportación leen detalles, no cabeceras de compra/venta. P5 incluye `venta`/`detalle_venta` por comprobación condicional de compensaciones históricas CU27, y composición/principio por el selector de medicamentos. P6 incorpora la consulta provisional de existencias y ficha/catálogo; `receta` se consulta desde Ventas sin llamar a su Controller. Las matrices identifican cada relación secundaria no repetida como flecha, justificando su selección conforme a §5.2.
- **Integridad y límites funcionales representados:** inventario sin tabla propia; medicamento/existencia/movimiento y físico/vendible distintos; ajuste con precondiciones, conciliación sin movimiento pero con evento de resultado; compra y anulación con costos/reversiones, B1/A; alta de venta pendiente sin stock ni recetas, confirmación posterior FEFO y validación RN58, anulación pendiente sin reversión o confirmada con devolución RN78. Cada registro posterior de receta y su revisión son transacciones independientes: no se representa un alta atómica venta+recetas ni se desarrolla P7.
- **Compartidos:** Medicamentos participa por HTTP en los tres nuevos paquetes; Proveedores en P5, Inventario en P4/P6 y Exportación en P4 (también reutilizable por P10 pendiente). Usuario/autenticación y Bitácora automática participan sin agregar los Controllers de Auth, Usuarios o consulta de Bitácora. Ningún Service/Repository compartido se convierte en Controller ficticio.
- **Preservación:** SHA-256 de P1–P3 contrastados antes/después, sin cambios: P1 `AC548130C6637EDD5E82D58EF7568A013BF97B31E4879675F93FC32E5B728625`; P2 `E33CFFA46D439C53EEF220515E427605995725EA0C415F79E0609AF88C6FBF1B`; P3 `74FA04C11EA7A59B187A58F21DD1A3CE028960D20E2061CF708953A48BD5C94D`. En el texto de P3 solo se actualiza la referencia de P4 pendiente a incorporado; no se rediseña P3.
- **XML y estructura:** .NET `System.Xml.XmlDocument` cargó correctamente los tres nuevos SVG; Node.js comprobó tres filas exclusivas/alineadas, archivos existentes, `tableName` y creación en migraciones (incluido SQL de Bitácora), IDs únicos y referencias internas. SVG vectoriales con `viewBox`, título/descripción accesibles, textos seleccionables, sin imágenes/scripts ni recursos remotos. Definiciones de estilo copiadas de P2 y contrastadas con P1 (Arial, verde claro, borde/pestaña verdes, símbolo de componente, puertos y tipos de línea).
- **Geometría automática:** 185 segmentos no nulos, 57/58/70 por SVG, contrastados entre relaciones, contra interiores de cajas, 16 puertos circulares y límites de los textos. Cero cruces/contactos entre relaciones, solapes o componentes/puertos/textos atravesados. Los segmentos no consecutivos de una misma ruta también se compararon; las relaciones tienen salidas/entradas distintas y no usan distribuidores. Se excluyeron iconos y muestras de leyenda del conteo de conexiones. Los extremos de cada flecha de persistencia coinciden con el borde de su tabla y parten del Controller indicado.
- **Texto:** `System.Drawing` midió 126 textos en Arial (42 por SVG), sin desbordamientos horizontales de cajas. Se contrastaron sus límites estimados conservadores de altura con los recorridos y entre textos, sin intersecciones. No se atribuye renderizado en navegador ni comparación con la imagen original ausente.
- **Vínculos y whitespace:** 196 vínculos locales comprobados entre ambos Markdown y sus destinos de código/imágenes, todos existentes. `git diff --check` sin errores de whitespace. También `git diff --no-index --check` contra `NUL` para `subsistemas.md` y los seis SVG sin seguimiento: sin errores de espacios; código 1 por diferencia frente al archivo vacío. Git emitió avisos LF/CRLF, también en cambios previos; no se normalizan archivos ajenos. El estado final conserva la lista previa de archivos modificados y agrega solo los tres SVG previstos dentro de la carpeta ya sin seguimiento.
- **Discrepancias y limitaciones:** no se encontró el apartado académico independiente «3.1 Análisis de arquitectura». Se consultaron los bloques pertinentes del análisis académico simplificado/modelo de clases; dos notas históricas del modelo sobre Ventas y conciliación contradicen código/reglas vigentes y se señalan en `subsistemas.md`, sin editar aquel documento. No se acredita disponibilidad de exportaciones LOCAL/Railway, entrega de descargas ni esquema operativo; tampoco aplicación de la migración de receta sin adjuntos. Solo se usaron Node.js/.NET existentes, sin instalar dependencias ni realizar pruebas funcionales, conexiones MySQL, despliegues, commits o push. Los auxiliares de generación/comprobación quedaron en el directorio temporal de OpenCode, fuera del repositorio.

### Cierre de Fase 3 — 21/11/2026

**Estado: COMPLETADA documentalmente.** P7–P9 cubren CU31–CU37; acumulado de **nueve paquetes P1–P9 (CU01–CU37)**. Se conservan los cierres históricos de Fases 1/2. P10/P11 y el resumen final permanecen pendientes; no se ejecuta Fase 4.

| Paquete y evidencia SVG | Interfaces | Controllers HTTP | Tablas físicas | Relaciones HTTP / persistencia dibujadas | Segmentos comprobados |
|---|---:|---:|---:|---:|---:|
| [P7 Recetas](diagrama-subsistemas/p7-recetas.svg) | 5 | 2 | 7 | 6 / 10 | 58 |
| [P8 Vencimientos y retiros](diagrama-subsistemas/p8-vencimientos-retiros.svg) | 3 | 2 | 8 | 4 / 8 | 38 |
| [P9 Stock bajo](diagrama-subsistemas/p9-stock-bajo.svg) | 1 | 1 | 4 | 1 / 4 | 14 |

- **Archivos y trazabilidad:** tres SVG nuevos y actualización de [subsistemas.md](subsistemas.md)/este seguimiento. Matrices P7–P9 contrastadas con CU31–CU37, RF27/RF28/RF30–RF34, reglas de recetas/vencimientos/retiros/stock bajo y transacciones T20/T24. Se siguieron páginas/componentes → servicios HTTP/Axios → routers/middlewares/roles → Controllers → Services/Repositories → modelos/migraciones. Todos los archivos dibujados existen y cada nombre físico coincide con `tableName` y creación en migraciones, incluido SQL de Bitácora. No se conectó a MySQL.
- **P7:** incluye VentasPage y VentaDetailPage por selección/contexto real, además de las tres páginas de Recetas. Dos Controllers: Recetas y Ventas, este último solo GET dentro del paquete. Sus includes justifican medicamento/existencia; no añaden Controller de Medicamentos ni movimientos. Alta de venta/detalles, cada receta/vínculos, revisión y confirmación son transacciones independientes. Registro/revisión no confirman ni reservan/descuentan stock ni crean movimientos. Se verificaron permisos, pertenencia de detalles, revisión inicial NULL, decisión única y auditoría sensible. Se inspeccionó la migración que permite `archivo_receta` NULL, sin ejecutarla; no hay adjuntos ni almacenamiento de archivos.
- **P8/P9:** P8 comparte InventarioPage/ExistenciasPage e incluye RetiroFormPage y Controller auxiliar de Medicamentos por ficha preparatoria. Se contrastaron cortes DIA/MES, horizonte de tres meses calendario, físico/vendible, precondiciones saldo/último movimiento, costos y pérdida derivada con auditoría transaccional. No se agregan tablas de alerta/retiro/pérdida ni compras/ventas por referencias NULL o enlaces de navegación. P9 utiliza InventarioPage `vista="stockBajo"`: activos, `stockVendible <= stockMinimo`, LEFT JOIN que admite productos sin existencias; a diferencia de CU21 con `soloConExistencias: true`. No ejecuta Controller de Medicamentos ni lee movimientos.
- **Compartidos y simplificaciones:** matrices explícitas para todas las tablas. P7 resume únicamente flechas transversales Ventas → usuario/bitácora y GET de apoyo desde dos páginas de Recetas (dibujado desde el formulario con el mismo servicio). P8 resume Medicamentos → medicamento/usuario/bitácora y ficha desde ExistenciasPage (dibujada desde RetiroFormPage). P9 no omite relaciones. Formularios/componentes internos quedan en sus páginas; no se omiten Controllers o tablas por conveniencia gráfica. No se convierten servicios de autenticación/auditoría en Controllers HTTP adicionales. P7/P8/P9 siguen separados.
- **Preservación:** comparación SHA-256 antes/después de P1–P6, sin diferencias. P1–P3 conservan los hashes registrados en Fases 1/2. P4: `36CF8CE59AF8A33D3EEF1C718C1B018D63E384D52E2BFB65C33F8C49EE774960`; P5: `8A2332CD0201111577EF218AD55972272BAAB6F9CDE9AC607779C84E2B9B042F`; P6: `EB696D9157CD346B9DEDBED57C33646DBF3CA453CE2446F3DFA5AFCF7A46AD56`. También se compararon los demás archivos previamente modificados/sin seguimiento fuera de los dos Markdown autorizados, sin cambios. Las notas históricas de los SVG no se reescriben para alterar sus cierres.
- **XML, estructura y estilo:** los tres SVG se cargaron con `System.Xml.XmlDocument` de .NET. Node.js comprobó filas exclusivas/alineadas, componentes existentes, nombres físicos, IDs únicos y referencias locales. SVG vectoriales con `viewBox`, título/descripción accesibles, texto seleccionable y sin imágenes/scripts/recursos remotos. Definiciones visuales reutilizadas de P2/P1: marco/pestaña verdes, cajas verde claro, Arial, símbolo UML de componente, líneas HTTP continuas con puertos y persistencia discontinua con flecha hacia tabla.
- **Geometría automática y texto:** auxiliares temporales de Fase 2 revisados y adaptados exclusivamente a P7–P9. Se compararon **110 segmentos ortogonales** (58/38/14) entre relaciones y contra interiores de cajas, **11 puertos** y límites de textos; también segmentos no consecutivos de una misma ruta. Cero cruces/contactos entre relaciones, tramos superpuestos ni cajas/puertos/textos atravesados. Se comprobaron origen Controller y destino en borde de tabla. `System.Drawing` midió **84 textos Arial** (34/32/18), sin desbordamiento horizontal de cajas/lienzos ni textos superpuestos. Se excluyen iconos/muestras de leyenda del conteo de conexiones. No se afirma renderizado en navegador.
- **Comprobación adicional de contrato visual:** estilos normalizados idénticos a P1; recuentos exactos de interfaces/Controllers/tablas, cajas únicas y dentro del marco, `viewBox` coherente con dimensiones, `aria-labelledby` resolviendo título/descripción. Cada ruta HTTP parte del borde de una interfaz real, llega a un puerto circular distinto y continúa hasta el borde de un Controller mediante su propio tramo.
- **Vínculos, whitespace y alcance:** **269 vínculos locales** de ambos Markdown comprobados, todos con destino existente. `git diff --check` sin errores de whitespace. También `git diff --no-index --check` contra `NUL` para los diez archivos sin seguimiento de esta colección (subsistemas.md y SVG P1–P9): sin errores de espacios; código 1 por diferencia frente al archivo vacío. Persisten avisos LF/CRLF de Git, incluidos cambios ajenos, sin normalizarlos. El estado mantiene todos los cambios previos; solo se añaden P7–P9 y se editan los dos Markdown autorizados. Sin cambios de código, base de datos, dependencias u otros diagramas.
- **Límites documentales/operativos:** no se localizó el apartado académico independiente «3.1 Análisis de arquitectura»; se consultaron selectivamente los bloques pertinentes del análisis académico simplificado, sin confundir sus agrupaciones BCE con Controllers HTTP. El inventario histórico de `transacciones.md` no enumera las aperturas actuales de Recetas: se verificaron directamente en su Service. No se acredita esquema operativo ni aplicación de migraciones en destino, funcionalidad ejecutada o disponibilidad de despliegue. Solo herramientas Node.js/.NET existentes, sin dependencias nuevas, pruebas funcionales, MySQL, despliegues, commits ni push. Los auxiliares permanecen fuera del repositorio, en el temporal de OpenCode.

### Cierre de Fase 4 y de la colección — 21/11/2026

**Estado: COMPLETADA documentalmente.** P10/P11 cubren CU38–CU42; acumulado de **once paquetes P1–P11, CU01–CU42**, introducción y **RESUMEN FINAL** completos en [subsistemas.md](subsistemas.md). Se preservan íntegros los cierres históricos de Fases 1–3; sus cifras no se atribuyen a esta ejecución. No es aceptación funcional, aplicación de migraciones ni habilitación productiva.

| Paquete y evidencia SVG | Interfaces | Controllers HTTP | Tablas físicas | Relaciones HTTP / persistencia dibujadas | Segmentos / textos / puertos comprobados |
|---|---:|---:|---:|---:|---:|
| [P10 Reportes y consultas](diagrama-subsistemas/p10-reportes-consultas.svg) | 6 | 3 | 9 | 6 / 11 | 55 / 42 / 6 |
| [P11 Bitácora](diagrama-subsistemas/p11-bitacora.svg) | 2 | 1 | 2 | 2 / 2 | 14 / 16 / 2 |

- **Alcance de edición:** solo se crean P10/P11 y se actualizan `subsistemas.md`/este seguimiento. Estado inicial con cambios ajenos y colección sin seguimiento: registrado antes de editar, sin descartar nada. Comparación SHA-256 de **24 archivos previos fuera de los dos Markdown autorizados**, incluidos P1–P9 y los demás modificados/sin seguimiento, sin diferencias. No se reconstruye ningún diagrama cerrado. P1–P6 mantienen los hashes de las fases anteriores; P7 `02479F183E0E828594C8E750D3933953C9568BC011A5921BB9A182CCE7E64F57`, P8 `E35619872F66249F10F7F0D07F66FB4E526A8B59939C2CF173FCB5C4E89685B3`, P9 `7046D783804D8C39C969506288362F5A41040B5A2E83CF14C545E3C09133C2B2`.
- **Cobertura P10:** CU38/CU39/CU40/CU41 contrastados con interfaces → servicios HTTP/Axios → routers/auth/roles → los tres Controllers reales → Services/Repositories → modelos/migraciones. Incluye Reportes, Exportación e Inventario; no Controllers de módulos por usar sus modelos/repositorios. Matriz por rama: ventas/compras solo cabeceras; pérdidas agregado/series sobre movimientos y detalle con existencia/medicamento/autoasociación de reversión; CU40 GET y descarga con usuario/detalles de origen, sin cabeceras por FK. Nueve tablas incluidas, ninguna `reporte`/`perdida`/documento.
- **Semántica P10 comprobada estáticamente:** RN91/RN101, originales SALIDA VENCIMIENTO/DAÑO sin original, costo aplicado histórico, redondeo individual DECIMAL/BigInt antes de sumar, ceros incluidos y reversiones informativas sin netear ni habilitar su operación. Separación de persistencia/agregados/documentos y snapshots internos por solicitud; CU40 comparte MovimientosPage/ExportacionTabular/endpoints con CU24/P4, sin RR/paginación nuevos para su GET. Exportación RR independiente, keyset/spool y cierre antes del render. Permisos, eventos sensibles/terminal único y guardas LOCAL/Railway opt-in comprobados en código, sin acreditar su disponibilidad real ni entrega/guardado de descargas.
- **Cobertura P11:** dos páginas y un Controller para CU42, listado/filtros/paginación/detalle; dos tablas: usuario por autenticación y bitacora_auditoria por consulta/evento posterior. No consultas HTTP auxiliares ni JOIN a identidades actuales; referencias JSON/IDs no incorporan módulos/tablas de origen. Página/total RR y evento sensible independiente posterior; detalle individual no abre el RR del listado. DTO, permisos, datos permitidos, errores y separación de captura automática frente a consulta manual contrastados con código/política de auditoría.
- **Simplificaciones y compartidos:** matrices de P10 explican exactamente las flechas secundarias Inventario → usuario/existencia/medicamento/bitácora y Exportación → usuario/venta/compra/existencia/medicamento/detalles/bitácora. Se dibujan sus dependencias principales independientes, sin distribuidores. Las páginas anfitrionas delegan estadísticas/exportación en componentes compartidos mostrados una sola vez. P11 dibuja todas sus relaciones. Services, Repositories, modelos, middlewares y generadores no se convierten en Controllers ni en una cuarta fila. La colección reúne **38 interfaces, 13 Controllers y 16 tablas distintos**; reutilización y límites descritos en el resumen final.
- **XML/estructura/estilo de la colección:** once SVG cargados con `System.Xml.XmlDocument` (.NET). Node.js verifica orden P1–P11, once secciones/títulos concordantes, tres filas exclusivas/alineadas, recuentos y cajas únicas, archivos existentes, `tableName` y creación en migraciones (incluido SQL de Bitácora), IDs únicos/referencias locales y extremos de relaciones. `viewBox`, título/descripción accesibles, texto seleccionable, sin imágenes/scripts/recursos remotos. Estilos normalizados idénticos a P1 (Arial, marco/pestaña/bordes verdes, cajas verde claro, símbolo UML, puertos HTTP y persistencia discontinua con flecha).
- **Geometría y texto, evidencia nueva:** validador temporal adaptado a **los once SVG**, incluidos los puertos/tramos múltiples propios de P1/P2, no solo a archivos/filas de Fase 3. **513 segmentos ortogonales**, **52 puertos** y límites de **363 textos Arial** comprobados; cero cruces/contactos entre relaciones, tramos superpuestos, componentes/puertos/textos atravesados o textos superpuestos. También se compararon segmentos no consecutivos de cada ruta; entradas/salidas en bordes y puertos distintos. P10/P11 aportan **69 segmentos, 8 puertos y 58 textos**, no las cifras históricas de Fase 3. `System.Drawing` midió textos sin desbordamientos horizontales de cajas/lienzos; límites verticales conservadores para colisiones, no renderizado real. Se excluyen símbolos y muestras de leyenda del cómputo de conexiones. **No hubo revisión en navegador** ni comparación con la imagen original ausente.
- **Vínculos y whitespace:** comprobación de todos los vínculos locales de ambos Markdown, imágenes y archivos fuente; sin destinos rotos. `git diff --check` y comprobación individual contra `NUL` de los doce archivos sin seguimiento de la colección (`subsistemas.md` y once SVG), sin errores de whitespace; código 1 frente a `NUL` solo indica contenido distinto del vacío. Avisos LF/CRLF previos conservados, sin normalizar archivos ajenos. Detalle cuantitativo final de enlaces: 343 comprobados.
- **Fuentes y limitaciones:** lectura selectiva de CU38–CU42, RF35–RF38/RF50–RF53, RN91/RN97–RN101 y auditoría, contexto §38–39, transacciones T24/T25 y aclaración histórica, contratos de Reportes, exportaciones Railway y política de Bitácora. El inventario T01–T25 no desarrolla las aperturas actuales de Reportes/Exportación; se inspeccionaron sus Services. Análisis académico simplificado CU40/CU42/modelo de clases §8 consultados; no se localizó el apartado independiente «3.1 Análisis de arquitectura». Los diagramas de reportes pendientes en otros análisis no se atribuyen como carencia funcional ni se editan fuera de alcance. Referencias a planes sustituidos conservadas como antecedentes, no como evidencias de esta fase.
- **Pendientes separados:** aplicación/validación de migraciones en destino (Bitácora, receta NULL), permisos SQL/retención/respaldos/volumen/rendimiento/proxies, entrega real de correo y aceptación de exportaciones/recursos/entorno LOCAL/Railway/documentos. Se conserva la aceptación backend parcial de Reportes y sus límites de DATETIME(0), multibloque/fallos tardíos; no se resuelven por documentarlos. Solo herramientas Node.js/.NET existentes, sin instalaciones, pruebas funcionales, MySQL, descargas reales, despliegues, commits ni push. Auxiliares/baseline/resultados en el temporal de OpenCode, fuera del repositorio.

**Resultado final:** colección documental completa, once paquetes separados y evidencia focalizada nueva; ningún cierre documental sustituye la autorización y verificación operativa posterior.

**Referencia histórica:** otros documentos pueden conservar enlaces o menciones a las antiguas fases de mejora visual de Reportes. Este reemplazo no reinterpreta sus cierres ni acredita nuevas pruebas de aquel trabajo; esas referencias no describen las fases de subsistemas aquí definidas. No modificar otros documentos para ajustarlas dentro de esta tarea.
