// Nunca convierte magnitudes monetarias a flotantes. Solo geometría relativa:
// división entera a millonésimas, error absoluto < 1/1.000.000 de la escala.
export const magnitudExacta = valor => BigInt(valor.replace('.', ''));
export const proporcionVisual = (valor, escala) => escala === 0n ? 0 : Number(magnitudExacta(valor) * 1000000n / escala) / 1000000;
export const escalaSeries = series => series.reduce((max, serie) => serie.valores.reduce((m, valor) => {
  const n = magnitudExacta(valor); return n > m ? n : m;
}, max), 0n);
export const panelesIntervalos = intervalos => Array.from({ length: Math.ceil(intervalos.length / 60) }, (_, panel) => ({ inicio: panel * 60, intervalos: intervalos.slice(panel * 60, (panel + 1) * 60) }));
