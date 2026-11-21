import fs from 'node:fs/promises';
import os from 'node:os';
import { join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const MiB = 1024n * 1024n;
const repositorio = fileURLToPath(new URL('../../../../', import.meta.url));
const fuera = (padre, ruta) => {
    const r = relative(padre, ruta);
    return r && (isAbsolute(r) || r === '..' || r.startsWith(`..${sep}`));
};
const entero = texto => /^\d+$/.test(texto.trim()) ? BigInt(texto.trim()) : null;

// No os.freemem(): en Linux el límite y el consumo deben ser del cgroup.
export async function memoriaContenedor(archivos = fs) {
    for (const [limite, uso] of [
        ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory.current'],
        ['/sys/fs/cgroup/memory/memory.limit_in_bytes', '/sys/fs/cgroup/memory/memory.usage_in_bytes']
    ]) {
        try {
            const max = entero(await archivos.readFile(limite, 'utf8'));
            const actual = entero(await archivos.readFile(uso, 'utf8'));
            // "max"/sentinelas de v1 no acreditan un contenedor acotado.
            if (max !== null && actual !== null && max > 0n && max < (1n << 60n) && actual <= max) return { max, actual };
        } catch { /* Probar el otro layout; si ninguno es legible, fail-closed. */ }
    }
    return null;
}

// Factoría para pruebas sin Railway, cgroups ni conexiones reales.
export function crearEntornoRailway({ archivos = fs, sistema = os, proceso = process,
    memoria = () => memoriaContenedor(archivos) } = {}) {
    let raiz, identidad, inicializacion, cerrando = false, fallo = false;
    const configurado = () => proceso.env.NODE_ENV === 'production' && proceso.env.REPORTES_EXPORTACION_PERFIL === 'RAILWAY'
        && proceso.env.REPORTES_EXPORTACION_REPLICAS === '1' && proceso.platform === 'linux'
        && ['RAILWAY_SERVICE_ID', 'RAILWAY_DEPLOYMENT_ID', 'RAILWAY_ENVIRONMENT_ID'].every(k => /^[A-Za-z0-9_-]{1,128}$/.test(proceso.env[k] || ''));
    const recursos = async margenDisco => {
        const m = await memoria();
        if (!m || m.max - m.actual < 128n * MiB) return false;
        const disco = await archivos.statfs(raiz || sistema.tmpdir(), { bigint: true });
        return disco.bavail * disco.bsize >= margenDisco * MiB;
    };
    const privada = s => s.isDirectory() && !s.isSymbolicLink() && s.uid === proceso.getuid()
        && (s.mode & 0o777) === 0o700;
    const mismaRaiz = async () => {
        const s = await archivos.lstat(raiz);
        return privada(s) && s.dev === identidad.dev && s.ino === identidad.ino;
    };
    const inicializar = async () => {
        if (!configurado() || cerrando || fallo) return false;
        if (!inicializacion) inicializacion = (async () => {
            const temporal = await archivos.realpath(sistema.tmpdir());
            const repo = await archivos.realpath(repositorio);
            if (!fuera(repo, temporal) || !await recursos(640n)) return false;
            const id = createHash('sha256').update(`${proceso.env.RAILWAY_SERVICE_ID}:${proceso.env.RAILWAY_DEPLOYMENT_ID}`).digest('hex').slice(0, 24);
            const candidata = join(temporal, `cadefar-reportes-railway-${id}`);
            // Sin recursive/IF EXISTS/chmod de un directorio anterior. EEXIST
            // significa instancia activa o residuo: nunca reclamarlo ni barrer /tmp.
            await archivos.mkdir(candidata, { mode: 0o700 });
            raiz = candidata;
            identidad = await archivos.lstat(raiz);
            if (!privada(identidad)) throw new Error('Temporal no privado');
            return true;
        })().catch(() => { fallo = true; return false; });
        const lista = await inicializacion;
        if (!lista && !fallo) inicializacion = undefined; // Recursos transitorios: reintento manual permitido.
        return lista;
    };
    return {
        async disponibilidad() {
            try {
                if (!await inicializar() || cerrando || fallo || !await mismaRaiz() || !await recursos(640n)) return false;
                return { perfil: 'RAILWAY', raizPrivada: raiz };
            } catch { fallo = true; return false; }
        },
        vigilar(abortar) {
            const base = proceso.memoryUsage().rss;
            const comprobar = () => {
                if (cerrando || fallo || proceso.memoryUsage().rss - base > 128 * 1024 * 1024) throw new Error('Recursos de exportación no disponibles');
            };
            let sondeando = false, liberada = false;
            const timer = setInterval(async () => {
                if (sondeando || liberada) return;
                sondeando = true;
                try {
                    comprobar();
                    // 512 MiB por trabajo + 128 MiB de margen al admitir. No es
                    // una reserva física frente a otros procesos del contenedor.
                    if (!await mismaRaiz() || !await recursos(128n)) throw new Error('Recursos insuficientes');
                } catch { if (!liberada) abortar(); }
                finally { sondeando = false; }
            }, 1000);
            timer.unref?.();
            return { comprobar, liberar() { liberada = true; clearInterval(timer); } };
        },
        async cerrar() {
            cerrando = true;
            if (inicializacion) await inicializacion;
            if (!raiz || !identidad) return;
            // Solo nuestra raíz vacía e idéntica. Si hay residuo, no borrar
            // recursivamente ni habilitar otra exportación en esta instancia.
            if (!await mismaRaiz()) throw new Error('Propiedad temporal no comprobada');
            await archivos.rmdir(raiz);
            raiz = null;
        }
    };
}

export const entornoExportacionRailway = crearEntornoRailway();
