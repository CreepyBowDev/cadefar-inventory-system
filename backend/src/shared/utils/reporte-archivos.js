import { open, stat, rm, mkdtemp, chmod } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Writable } from 'node:stream';
import { AppError } from '../errors/app-error.js';

export const errorLimiteExportacion = () => new AppError('La exportación supera el límite técnico; reduzca los filtros o utilice otro formato', 413);
// Excepción aprobada para demostración local (§10.15), NO checker de producción.
// La dirección procede del socket del servidor, nunca de cabeceras reenviadas.
export const comprobarRecursosCsvLocal = async direccionRemota => {
    if ((process.env.NODE_ENV ?? 'development') !== 'development' ||
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(direccionRemota)) return false;
    try {
        const raizPrivada = await fs.realpath(os.tmpdir());
        const repositorio = await fs.realpath(fileURLToPath(new URL('../../../../', import.meta.url)));
        const relativa = relative(repositorio, raizPrivada);
        if (!relativa || (!isAbsolute(relativa) && relativa !== '..' && !relativa.startsWith(`..${sep}`))) return false;
        await fs.access(raizPrivada, fs.constants.W_OK | fs.constants.R_OK);
        const disco = await fs.statfs(raizPrivada, { bigint: true });
        if (disco.bavail * disco.bsize < 512n * 1024n * 1024n || os.freemem() < 128 * 1024 * 1024) return false;
        // Lectura instantánea, no reserva, benchmark de pico ni certificación de ACL.
        return { raizPrivada, perfil: 'LOCAL' };
    } catch { return false; }
};
// Escrituras serializadas y esperadas: un solo registro pendiente, sin Buffer histórico.
export const crearArchivosReporte = async (raiz, comprobar, limites = {}) => {
    const maxDisco = limites.disco ?? 512 * 1024 * 1024, maxFinal = limites.final ?? 128 * 1024 * 1024;
    const directorio = await mkdtemp(join(raiz, 'cadefar-exportacion-'));
    // El root no procede del cliente. En el perfil LOCAL se acepta la protección
    // del temporal del usuario; mode NO acredita ACL Windows para producción.
    try { if (process.platform !== 'win32') await chmod(directorio, 0o700); }
    catch (error) {
        try { await rm(directorio, { recursive: true }); }
        catch { error.residuoExportacion = true; }
        throw error;
    }
    const rutas = { spool: join(directorio, 'datos.ndjson'), csv: join(directorio, 'archivo.csv'), xlsx: join(directorio, 'archivo.xlsx'), pdf: join(directorio, 'archivo.pdf') };
    const tamanos = { spool: 0, csv: 0, xlsx: 0, pdf: 0 }, hashes = {}, abiertos = new Set();
    return {
        rutas,
        agregarTemporal(tipo, nombre) {
            if (!/^png\d{1,2}$/.test(tipo) || !/^panel-\d{1,2}\.png$/.test(nombre) || rutas[tipo]) throw new Error('Temporal inválido');
            rutas[tipo] = join(directorio, nombre); tamanos[tipo] = 0;
        },
        async quitarTemporal(tipo) {
            if (!/^png\d{1,2}$/.test(tipo) || !rutas[tipo]) throw new Error('Temporal inválido');
            await rm(rutas[tipo]); delete rutas[tipo]; delete tamanos[tipo]; delete hashes[tipo];
        },
        async flujo(tipo) {
            const escritor = await this.escritor(tipo);
            let pendiente = Promise.resolve(), cerrado = false;
            const cerrar = async () => { if (!cerrado) { cerrado = true; await escritor.cerrar(); } };
            return new Writable({ highWaterMark: 65536,
                write(chunk, encoding, callback) {
                    pendiente = escritor.escribir(chunk);
                    pendiente.then(() => callback(), callback);
                },
                final(callback) { cerrar().then(() => callback(), callback); },
                destroy(error, callback) {
                    pendiente.catch(() => {}).then(cerrar).then(() => callback(error), callback);
                }
            });
        },
        async escritor(tipo) {
            const archivo = await open(rutas[tipo], 'wx', 0o600);
            abiertos.add(archivo);
            const hash = createHash('sha256');
            return {
                async escribir(texto) {
                    comprobar();
                    const bytes = Buffer.byteLength(texto);
                    if (Object.values(tamanos).reduce((a, b) => a + b, 0) + bytes > maxDisco || (tipo !== 'spool' && tamanos[tipo] + bytes > maxFinal)) throw errorLimiteExportacion();
                    await archivo.writeFile(texto, 'utf8');
                    tamanos[tipo] += bytes;
                    hash.update(texto, 'utf8');
                    comprobar();
                },
                async cerrar() {
                    await archivo.close();
                    abiertos.delete(archivo);
                    hashes[tipo] = hash.digest('hex');
                }
            };
        },
        async verificar(tipo) {
            comprobar();
            const hash = createHash('sha256');
            let bytes = 0;
            for await (const chunk of createReadStream(rutas[tipo])) { comprobar(); bytes += chunk.length; hash.update(chunk); }
            if (!hashes[tipo] || hash.digest('hex') !== hashes[tipo] || bytes !== tamanos[tipo] || (await stat(rutas[tipo])).size !== bytes) throw new Error('Archivo inconsistente');
            comprobar();
            return bytes;
        },
        async limpiar() {
            for (const archivo of abiertos) await archivo.close();
            abiertos.clear();
            // Solo el directorio aleatorio creado por esta operación, jamás el root.
            await rm(directorio, { recursive: true });
        }
    };
};
export async function* leerSpool(ruta, comprobar) {
    const stream = createReadStream(ruta, { encoding: 'utf8' });
    const lineas = createInterface({ input: stream, crlfDelay: Infinity });
    try {
        for await (const linea of lineas) { comprobar(); yield JSON.parse(linea); }
    } finally { lineas.close(); stream.destroy(); }
}
