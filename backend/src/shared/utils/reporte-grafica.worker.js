import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

// Worker efímero: no fuentes del sistema, red, configuración o recursos cliente.
await initWasm(await readFile(new URL(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm'))));
const font = await readFile(new URL('../resources/fonts/NotoSans-Regular.ttf', import.meta.url));
const svg = new Resvg(workerData, { font: { fontBuffers: [font], defaultFontFamily: 'Noto Sans', loadSystemFonts: false } });
let imagen;
try {
    imagen = svg.render();
    const png = imagen.asPng();
    parentPort.postMessage(png, [png.buffer]);
} finally { imagen?.free(); svg.free(); }
