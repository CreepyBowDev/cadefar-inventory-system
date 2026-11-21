// El prefijo es reversible: se añade exactamente uno, nunca se elimina contenido.
export const protegerCeldaCsv = valor => {
    const texto = valor == null ? '' : String(valor);
    const significativo = texto.replace(/^[\s\p{Cc}\p{Cf}]*/u, '');
    return /^[=+\-@']/u.test(significativo) || /^[\s\p{Cc}\p{Cf}]*[\t\r\n]/u.test(texto) ? `'${texto}` : texto;
};
export const registroCsv = valores => valores.map(valor => `"${protegerCeldaCsv(valor).replaceAll('"', '""')}"`).join(';') + '\r\n';
export const BOM_CSV = '\uFEFF';
