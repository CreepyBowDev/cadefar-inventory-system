const resultados = Object.freeze({
  EXITO: { texto: 'Éxito', clase: 'exito' },
  RECHAZADO: { texto: 'Rechazado', clase: 'rechazado' },
  FALLO: { texto: 'Fallo', clase: 'fallo' }
});

export const BitacoraResultado = ({ resultado }) => {
  const presentacion = Object.hasOwn(resultados, resultado) ? resultados[resultado] : { texto: resultado || 'No disponible', clase: 'desconocido' };
  return <span className={`bitacora-resultado bitacora-resultado--${presentacion.clase}`}>
    <span aria-hidden="true" />{presentacion.texto}
  </span>;
};
