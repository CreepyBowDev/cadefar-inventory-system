# resvg-js / @resvg/resvg-wasm 2.6.2

Copyright (c) 2021-present, yisibl (一丝).
Este componente no es propiedad de CADEFAR. Se utiliza sin modificaciones.

Licencia: Mozilla Public License 2.0, copia íntegra en `resvg-MPL-2.0.txt`.
El paquete npm publicado no incluye esa copia; se conserva aquí desde el
commit indicado por su metadata `gitHead`:

- Fuente y avisos originales: <https://github.com/thx/resvg-js/tree/9ca058462ac529120c8cc84ddcd6fef644cc5406>
- Fuente descargable: <https://github.com/thx/resvg-js/archive/9ca058462ac529120c8cc84ddcd6fef644cc5406.tar.gz>
- Paquete exacto: <https://registry.npmjs.org/@resvg/resvg-wasm/-/resvg-wasm-2.6.2.tgz>
- Manifiesto de componentes Rust: `Cargo.toml` en ese commit; usa resvg 0.34.0,
  png =0.17.5, wasm-bindgen 0.2.87 y otros componentes del upstream.
  No hay Cargo.lock publicado en ese commit: no se afirma un SBOM Rust
  reproducible ni una auditoría exhaustiva del binario WASM.

Al redistribuir el ejecutable JS/WASM, conservar estos avisos y licencia,
informar al receptor de cómo obtener el código fuente cubierto por MPL
(enlaces anteriores) y respetar §3.1–3.4, incluidas modificaciones futuras.
No restringir los derechos sobre ese código. Los componentes originales y
sus avisos/licencias permanecen en sus fuentes; no se relicencian como CADEFAR.
No se ha modificado ni compilado el WASM. Noto Sans conserva separadamente
su OFL-1.1 en `fonts/OFL.txt`.

Compatibilidad ejercitada: import ESM, inicialización desde archivo WASM local,
rasterización PNG y liberación en worker efímero, Node 24.18.0 / Windows.
Sin canvas nativo, navegador, fuentes del sistema ni descargas en solicitudes.
Sin promesa de Unicode universal ni certificación de memoria máxima.

Evaluación del 20/11/2026: versión estable latest 2.6.2 (26/03/2024), sin
dependencias npm declaradas. GitHub advisories públicos de resvg-js: `[]`.
Consultas OSV de png 0.17.5, resvg 0.34.0 y wasm-bindgen 0.2.87: sin avisos
devueltos. Esto no certifica todo el grafo Rust ni ausencia de vulnerabilidades.
`pnpm audit` conserva 11 avisos previos del proyecto (ningún camino resvg).
Solo se aceptan SVG construidos por el servidor con geometría y texto
validados; no SVG, rutas, imágenes, URLs, opciones o código del cliente.
