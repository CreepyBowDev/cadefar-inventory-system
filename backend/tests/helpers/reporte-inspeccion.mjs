// Inspección óptica opt-in de PDF reales con PDF.js en navegador (sin canvas Node).
// Uso: node tests/helpers/reporte-inspeccion.mjs <directorio externo de fixtures>
// No es un visor de Excel ni una prueba de aceptación productiva.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv[2]) await inspeccionar(process.argv[2]);

async function inspeccionar(ruta) {
const directorio = resolve(ruta);
const navegador = process.env.CADEFAR_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(navegador, 'Se requiere Chrome o Edge ya instalado');
const perfil = await mkdtemp(join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'cadefar-pdf-visual-'));
const modulo = fileURLToPath(import.meta.resolve('pdfjs-dist/build/pdf.mjs'));
const worker = fileURLToPath(import.meta.resolve('pdfjs-dist/build/pdf.worker.mjs'));
const html = `<!doctype html><meta charset="utf-8"><canvas id="pagina"></canvas><script type="module">
import {getDocument, GlobalWorkerOptions} from '/pdf.mjs';
GlobalWorkerOptions.workerSrc='/worker.mjs';
window.renderizar=async(archivo,n)=>{
 const tarea=getDocument({url:'/archivo/'+encodeURIComponent(archivo)});const pdf=await tarea.promise;
 const pagina=await pdf.getPage(n||pdf.numPages),viewport=pagina.getViewport({scale:1.5});
 const canvas=document.querySelector('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
 await pagina.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
 const resultado={paginas:pdf.numPages,png:canvas.toDataURL('image/png').split(',')[1]};
 await tarea.destroy();return resultado;
};</script>`;
const servidor = createServer(async (req, res) => {
    try {
        const path = new URL(req.url, 'http://127.0.0.1').pathname;
        if (path === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
        if (path === '/pdf.mjs' || path === '/worker.mjs') {
            res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(path === '/pdf.mjs' ? modulo : worker)); return;
        }
        const archivo = /^\/archivo\/([a-z]+-(?:tabular|estadistica)-(?:extenso|vacio)\.pdf)$/.exec(path);
        if (!archivo) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', 'application/pdf'); res.end(await readFile(join(directorio, archivo[1])));
    } catch { res.writeHead(500).end(); }
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
let browser, socket;
const esperar = async fn => {
    const inicio = Date.now();
    while (Date.now() - inicio < 15000) { const valor = await fn(); if (valor) return valor; await new Promise(r => setTimeout(r, 50)); }
    throw new Error('Tiempo agotado al preparar el visor local');
};
try {
    browser = spawn(navegador, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
        '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
    const port = await esperar(async () => { try { return (await readFile(join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(r => socket.addEventListener('open', r, { once: true }));
    let secuencia = 0; const pendientes = new Map();
    socket.addEventListener('message', e => {
        const m = JSON.parse(e.data), p = pendientes.get(m.id);
        if (p) { pendientes.delete(m.id); clearTimeout(p.timer); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); }
    });
    const enviar = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++secuencia, timer = setTimeout(() => { pendientes.delete(id); reject(new Error(method)); }, 30000);
        pendientes.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluar = async expression => {
        const r = await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
    };
    await enviar('Page.navigate', { url: `http://127.0.0.1:${servidor.address().port}/` });
    await esperar(() => evaluar('typeof window.renderizar === "function"'));
    for (const archivo of (await readdir(directorio)).filter(f => f.endsWith('.pdf'))) {
        const primera = await evaluar(`renderizar(${JSON.stringify(archivo)},1)`);
        await writeFile(join(directorio, archivo + '-1.png'), Buffer.from(primera.png, 'base64'));
        if (primera.paginas > 1) {
            const ultima = await evaluar(`renderizar(${JSON.stringify(archivo)},0)`);
            await writeFile(join(directorio, archivo + '-final.png'), Buffer.from(ultima.png, 'base64'));
        }
        // Para estadísticas, la página 3 contiene normalmente el primer panel.
        if (archivo.includes('estadistica') && primera.paginas >= 3) {
            const panel = await evaluar(`renderizar(${JSON.stringify(archivo)},3)`);
            await writeFile(join(directorio, archivo + '-3.png'), Buffer.from(panel.png, 'base64'));
        }
        console.log(`${archivo}: ${primera.paginas} páginas; imágenes renderizadas, pendientes de lectura visual`);
    }
} finally {
    socket?.close();
    if (browser && browser.exitCode === null) { const fin = new Promise(r => browser.once('exit', r)); browser.kill(); await fin; }
    await new Promise(r => servidor.close(r));
    await rm(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
}
