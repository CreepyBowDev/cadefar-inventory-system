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
    memoria = () => memoriaContenedor(archivos), diagnosticar = evento => console.warn(evento) } = {}) {
    let raiz, identidad, inicializacion, cerrando = false, fallo = false;
    const emitidos = new Set();
    // Solo constantes internas. Nunca valores de env, Error/code/message,
    // rutas, IDs de Railway, métricas crudas, filtros o contenido del reporte.
    // Acotado a una emisión por causa/etapa/campo durante esta instancia.
    const rechazar = (causa, etapa, campo) => {
        const clave = `${causa}:${etapa}:${campo || ''}`;
        if (!emitidos.has(clave)) {
            emitidos.add(clave);
            try { diagnosticar(Object.freeze({ codigo: 'EXPORTACION_RAILWAY_NO_DISPONIBLE', causa, etapa, ...(campo ? { campo } : {}) })); }
            catch { /* El logger no decide disponibilidad ni reemplaza el error. */ }
        }
        return false;
    };
    const configurado = () => {
        if (proceso.env.NODE_ENV !== 'production') return rechazar('NODE_ENV_INVALIDO', 'CONFIGURACION');
        if (proceso.env.REPORTES_EXPORTACION_PERFIL !== 'RAILWAY') return rechazar('PERFIL_NO_ACTIVO', 'CONFIGURACION');
        if (proceso.env.REPORTES_EXPORTACION_REPLICAS !== '1') return rechazar('REPLICAS_NO_ACREDITADAS', 'CONFIGURACION');
        if (proceso.platform !== 'linux') return rechazar('PLATAFORMA_NO_ADMITIDA', 'CONFIGURACION');
        for (const campo of ['RAILWAY_SERVICE_ID', 'RAILWAY_DEPLOYMENT_ID', 'RAILWAY_ENVIRONMENT_ID']) {
            if (!/^[A-Za-z0-9_-]{1,128}$/.test(proceso.env[campo] || '')) return rechazar('METADATO_RAILWAY_INVALIDO', 'CONFIGURACION', campo);
        }
        return true;
    };
    const recursos = async (margenDisco, etapa) => {
        let recurso = 'MEMORIA';
        try {
            const m = await memoria();
            if (!m) return rechazar('CGROUP_NO_ACREDITADO', etapa);
            if (m.max - m.actual < 128n * MiB) return rechazar('MEMORIA_INSUFICIENTE', etapa);
            recurso = 'DISCO';
            const disco = await archivos.statfs(raiz || sistema.tmpdir(), { bigint: true });
            if (!(disco.bavail * disco.bsize >= margenDisco * MiB)) return rechazar('DISCO_INSUFICIENTE', etapa);
            return true;
        } catch (error) {
            rechazar(recurso === 'MEMORIA' ? 'MEMORIA_NO_CONSULTABLE' : 'DISCO_NO_CONSULTABLE', etapa);
            throw error;
        }
    };
    const privada = s => s.isDirectory() && !s.isSymbolicLink() && s.uid === proceso.getuid()
        && (s.mode & 0o777) === 0o700;
    const mismaRaiz = async etapa => {
        try {
            const s = await archivos.lstat(raiz);
            if (!privada(s)) return rechazar('TEMPORAL_NO_PRIVADO', etapa);
            if (s.dev !== identidad.dev || s.ino !== identidad.ino) return rechazar('TEMPORAL_IDENTIDAD_CAMBIADA', etapa);
            return true;
        } catch (error) { rechazar('TEMPORAL_NO_CONSULTABLE', etapa); throw error; }
    };
    const inicializar = async () => {
        if (!configurado()) return false;
        if (cerrando) return rechazar('SERVIDOR_CERRANDO', 'INICIALIZACION');
        if (fallo) return false; // La causa original ya se emitió; no repetir ni perder fail-closed.
        if (!inicializacion) {
            let paso = 'TEMPORAL_RESOLUCION_FALLIDA';
            inicializacion = (async () => {
                const temporal = await archivos.realpath(sistema.tmpdir());
                paso = 'REPOSITORIO_NO_RESUELTO';
                const repo = await archivos.realpath(repositorio);
                if (!fuera(repo, temporal)) return rechazar('TEMPORAL_DENTRO_REPOSITORIO', 'INICIALIZACION');
                paso = 'RECURSOS';
                if (!await recursos(640n, 'INICIALIZACION')) return false;
                const id = createHash('sha256').update(`${proceso.env.RAILWAY_SERVICE_ID}:${proceso.env.RAILWAY_DEPLOYMENT_ID}`).digest('hex').slice(0, 24);
                const candidata = join(temporal, `cadefar-reportes-railway-${id}`);
                // Sin recursive/IF EXISTS/chmod de un directorio anterior. EEXIST
                // significa instancia activa o residuo: nunca reclamarlo ni barrer /tmp.
                paso = 'TEMPORAL_CREACION_FALLIDA';
                await archivos.mkdir(candidata, { mode: 0o700 });
                raiz = candidata;
                paso = 'TEMPORAL_NO_CONSULTABLE';
                identidad = await archivos.lstat(raiz);
                paso = 'TEMPORAL_NO_PRIVADO';
                if (!privada(identidad)) throw new Error('Temporal no privado');
                return true;
            })().catch(error => {
                fallo = true;
                if (paso !== 'RECURSOS') rechazar(paso === 'TEMPORAL_CREACION_FALLIDA' && error?.code === 'EEXIST' ? 'TEMPORAL_EXISTENTE' : paso, 'INICIALIZACION');
                return false;
            });
        }
        const lista = await inicializacion;
        if (!lista && !fallo) inicializacion = undefined; // Recursos transitorios: reintento manual permitido.
        return lista;
    };
    return {
        async disponibilidad() {
            try {
                if (!await inicializar()) return false;
                if (cerrando) return rechazar('SERVIDOR_CERRANDO', 'DISPONIBILIDAD');
                if (fallo || !await mismaRaiz('DISPONIBILIDAD') || !await recursos(640n, 'DISPONIBILIDAD')) return false;
                return { perfil: 'RAILWAY', raizPrivada: raiz };
            } catch { fallo = true; return false; }
        },
        vigilar(abortar) {
            const base = proceso.memoryUsage().rss;
            const comprobar = () => {
                if (cerrando || fallo || proceso.memoryUsage().rss - base > 128 * 1024 * 1024) {
                    rechazar(cerrando ? 'SERVIDOR_CERRANDO' : fallo ? 'INSTANCIA_BLOQUEADA' : 'INCREMENTO_RSS_EXCEDIDO', 'VIGILANCIA');
                    throw new Error('Recursos de exportación no disponibles');
                }
            };
            let sondeando = false, liberada = false;
            const timer = setInterval(async () => {
                if (sondeando || liberada) return;
                sondeando = true;
                try {
                    comprobar();
                    // 512 MiB por trabajo + 128 MiB de margen al admitir. No es
                    // una reserva física frente a otros procesos del contenedor.
                    if (!await mismaRaiz('VIGILANCIA') || !await recursos(128n, 'VIGILANCIA')) throw new Error('Recursos insuficientes');
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
            if (!await mismaRaiz('CIERRE')) throw new Error('Propiedad temporal no comprobada');
            try { await archivos.rmdir(raiz); }
            catch (error) { rechazar(error?.code === 'ENOTEMPTY' ? 'TEMPORAL_CON_RESIDUOS' : 'TEMPORAL_LIMPIEZA_FALLIDA', 'CIERRE'); throw error; }
            raiz = null;
        }
    };
}

export const entornoExportacionRailway = crearEntornoRailway();
